// Read-only Railway cron observer. No mutation, variables, logs, backup or Supabase API.
import {pathToFileURL} from 'node:url';

export const RAILWAY_API = 'https://backboard.railway.com/graphql/v2';
const MAX_BODY = 256 * 1024;
const HOUR = 3_600_000;
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const SCOPE_QUERY = 'query UatWatchdogScope { projectToken { project { id name } environment { id name } } }';
const RUNS_QUERY = `query UatWatchdogRuns($environmentId: String!, $serviceId: String!, $input: DeploymentInstanceExecutionListInput!) {
  serviceInstance(environmentId: $environmentId, serviceId: $serviceId) { id serviceName }
  deploymentInstanceExecutions(input: $input, first: 20) {
    edges { node { id status createdAt completedAt } }
  }
}`;

export class WatchdogError extends Error {
  constructor(code) { super(code); this.code = code; }
}
const fail = code => { throw new WatchdogError(code); };
function utc(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(value)) fail('INVALID_TIME');
  const n = Date.parse(value);
  if (!Number.isFinite(n) || new Date(n).toISOString().slice(0,19) !== value.slice(0,19)) fail('INVALID_TIME');
  return n;
}

export function readWatchdogConfig(env, now = Date.now()) {
  if (!env.UAT_LIFECYCLE_ENABLED || env.UAT_LIFECYCLE_ENABLED === 'false') return null;
  if (env.UAT_LIFECYCLE_ENABLED !== 'true') fail('INVALID_ACTIVATION');
  const config = {
    projectId: env.UAT_RAILWAY_PROJECT_ID, environmentId: env.UAT_RAILWAY_ENVIRONMENT_ID,
    serviceId: env.UAT_RAILWAY_SERVICE_ID, createdAt: env.UAT_LIFECYCLE_T0_UTC,
    expectedProjectName: 'CoCalLab-UAT-LIFECYCLE-01', expectedEnvironmentName: 'uat-lifecycle',
    expectedServiceName: 'uat-lifecycle-cron',
  };
  if (![config.projectId, config.environmentId, config.serviceId].every(x => typeof x === 'string' && UUID.test(x))) fail('INVALID_TARGET_CONFIG');
  const start = utc(config.createdAt);
  if (!Number.isFinite(now) || now < start) fail('CLOCK_BEFORE_START');
  // Bounded read-only cleanup observation; never renew a paid resource or its lease.
  if (now > start + 14 * 24 * HOUR + 2 * HOUR) fail('MONITOR_WINDOW_ENDED_OWNER_ACTION_REQUIRED');
  return config;
}

async function query(fetchImpl, token, operation, variables, timeoutMs) {
  let response;
  try {
    response = await fetchImpl(RAILWAY_API, {
      method: 'POST', redirect: 'error', signal: AbortSignal.timeout(timeoutMs),
      headers: {'Content-Type': 'application/json', 'Project-Access-Token': token},
      body: JSON.stringify({query: operation, variables}),
    });
    if (!response.ok) { await response.body?.cancel(); fail('PROVIDER_HTTP_FAILURE'); }
    const headerLength = response.headers.get('content-length');
    if (headerLength && (!/^\d+$/.test(headerLength) || Number(headerLength) > MAX_BODY)) { await response.body?.cancel(); fail('PROVIDER_RESPONSE_TOO_LARGE'); }
    if (!response.body) fail('PROVIDER_RESPONSE_INVALID');
    const reader = response.body.getReader();
    let length = 0; const chunks = [];
    try {
      while (true) {
        const {value, done} = await reader.read(); if (done) break;
        length += value.byteLength;
        if (length > MAX_BODY) { await reader.cancel(); fail('PROVIDER_RESPONSE_TOO_LARGE'); }
        chunks.push(Buffer.from(value));
      }
    } finally { reader.releaseLock(); }
    let parsed;
    try { parsed = JSON.parse(Buffer.concat(chunks).toString('utf8')); }
    catch { fail('PROVIDER_RESPONSE_INVALID'); }
    if (!parsed || (parsed.errors != null && (!Array.isArray(parsed.errors) || parsed.errors.length)) || !parsed.data) fail('PROVIDER_QUERY_FAILED');
    return parsed.data;
  } catch (error) {
    // Never log a provider error, request, body or underlying exception: these can echo secrets.
    if (error instanceof WatchdogError) throw error;
    fail('PROVIDER_READ_FAILED');
  }
}

export function inspectCronRuns(edges, createdAt, now) {
  if (!Array.isArray(edges) || !edges.length || edges.length > 20) fail('CRON_HISTORY_MISSING_OR_INVALID');
  const start = utc(createdAt), ids = new Set();
  const rows = edges.map(edge => {
    const row = edge?.node;
    if (!row || typeof row.id !== 'string' || !UUID.test(row.id) || ids.has(row.id)) fail('CRON_HISTORY_INVALID');
    ids.add(row.id);
    const at = utc(row.createdAt), done = row.completedAt == null ? null : utc(row.completedAt);
    if (at > now || (done != null && (done < at || done > now))) fail('CRON_CLOCK_INVALID');
    if (!['EXITED','CRASHED','RUNNING','CREATED','INITIALIZING','RESTARTING','SKIPPED','STOPPED','REMOVED','REMOVING'].includes(row.status)) fail('CRON_STATUS_UNKNOWN');
    if (row.status === 'EXITED' && done == null) fail('CRON_COMPLETION_UNPROVEN');
    return {...row, at, done};
  }).filter(row => row.at >= start).sort((a,b) => b.at - a.at);
  if (!rows.length || now - rows[0].at > HOUR) fail('PRIMARY_CRON_STALE');
  const latest = rows[0];
  const recent = rows.filter(row => now - row.at <= HOUR);
  if (recent.some(row => ['CRASHED','SKIPPED','STOPPED','REMOVED','REMOVING'].includes(row.status))) fail('RECENT_CRON_FAILURE_OR_SKIP');
  if (recent.some(row => ['RUNNING','CREATED','INITIALIZING','RESTARTING'].includes(row.status) && now - row.at > 20 * 60_000)) fail('PRIMARY_CRON_OVERTIME');
  if (recent.some(row => row.status === 'EXITED' && row.done - row.at > 20 * 60_000)) fail('PRIMARY_CRON_OVERTIME');
  if (!recent.some(row => row.status === 'EXITED' && now - row.done <= HOUR)) fail('NO_RECENT_COMPLETED_CRON');
  return {status: latest.status === 'EXITED' ? 'RECENT_CRON_EXIT_CONFIRMED' : 'RECENT_EXIT_WITH_RUN_IN_PROGRESS',
    meaning: 'Process execution only; not proof of backup validity, deletion or UAT acceptance'};
}

export async function runWatchdog({env = process.env, fetchImpl = fetch, now = Date.now(), timeoutMs = 10_000} = {}) {
  const config = readWatchdogConfig(env, now);
  if (!config) return {status: 'DISABLED_NOT_ARMED', providerReads: 0};
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 30_000) fail('INVALID_TIMEOUT');
  const token = env.UAT_RAILWAY_PROJECT_TOKEN;
  if (typeof token !== 'string' || token.length < 16 || token.length > 512 || /\s/.test(token)) fail('MISSING_OR_INVALID_PROJECT_TOKEN');
  const scope = (await query(fetchImpl, token, SCOPE_QUERY, {}, timeoutMs)).projectToken;
  if (scope?.project?.id !== config.projectId || scope?.environment?.id !== config.environmentId ||
      scope.project.name !== config.expectedProjectName || scope.environment.name !== config.expectedEnvironmentName) fail('PROJECT_TOKEN_SCOPE_MISMATCH');
  const data = await query(fetchImpl, token, RUNS_QUERY, {
    environmentId: config.environmentId, serviceId: config.serviceId,
    input: {environmentId: config.environmentId, serviceId: config.serviceId},
  }, timeoutMs);
  if (typeof data.serviceInstance?.id !== 'string' || !UUID.test(data.serviceInstance.id) || data.serviceInstance?.serviceName !== config.expectedServiceName) fail('SERVICE_SCOPE_MISMATCH');
  const observation = inspectCronRuns(data.deploymentInstanceExecutions?.edges, config.createdAt, now);
  return {...observation, providerReads: 2};
}

export async function watchdogMain(env, write = console.log, writeError = console.error) {
  try { write(JSON.stringify(await runWatchdog({env}))); return 0; }
  catch (error) { writeError(JSON.stringify({status: 'ALERT_REQUIRED', code: error instanceof WatchdogError ? error.code : 'WATCHDOG_FAILED'})); return 1; }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exitCode = await watchdogMain(process.env);
