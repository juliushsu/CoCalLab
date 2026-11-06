// LOCAL SYNTHETIC PRODUCT ADAPTER ONLY. Production app/build must not import this.
import { Worker } from 'node:worker_threads';

export async function createProductRuntime({ port = 4194, withFactor = true, scenario = 'manual', exportPolicy = 'tenant_write_v1' } = {}) {
  if(exportPolicy!==null&&exportPolicy!=='tenant_write_v1')throw new Error('Unknown synthetic export policy');
  if(!['manual','showcase','manual-transcription','verified-upload'].includes(scenario))throw new Error('Unknown local product scenario');
  if(!Number.isInteger(port)||port<0||port>65535)throw new Error('Invalid local product port');
  const worker = new Worker(new URL('./worker.js', import.meta.url), { workerData: { port, withFactor, scenario, exportPolicy }, execArgv: [] });
  let sequence = 0, ended = false;
  const pending = new Map();
  let readyResolve, readyReject;
  const ready = new Promise((resolve, reject) => { readyResolve = resolve; readyReject = reject; });
  worker.on('error', error => { readyReject(error); for (const entry of pending.values()) entry.reject(error); pending.clear(); });
  worker.on('exit', code => { if (!ended) {const error=new Error(`Synthetic product worker exited ${code}`);readyReject(error);for(const entry of pending.values())entry.reject(error);pending.clear();} });
  worker.on('message', message => {
    if (message.kind === 'ready') { readyResolve(message); return; }
    if (message.kind === 'fatal') { readyReject(Object.assign(new Error(message.message), { code: message.code })); return; }
    const entry = pending.get(message.id); if (!entry) return; pending.delete(message.id);
    if (message.error) entry.reject(Object.assign(new Error(message.error.message), { code: message.error.code })); else entry.resolve(message.value);
  });
  function command(kind, value) { if(ended&&kind!=='close')return Promise.reject(new Error('Synthetic product runtime is closed'));const id = ++sequence; return new Promise((resolve, reject) => { pending.set(id, { resolve, reject }); worker.postMessage({ id, kind, value }); }); }
  let info;
  try { info = await ready; } catch (error) { await worker.terminate(); throw error; }
  return {
    scope: info.scope, baseUrl: info.baseUrl, publicKey: info.publicKey, accounts: info.accounts,
    config: info.config,
    async handle(request) {
      const body = ['GET', 'HEAD'].includes(request.method) ? undefined : new Uint8Array(await request.arrayBuffer());
      const result = await command('request', { url: request.url, method: request.method, headers: [...request.headers], body });
      return new Response(result.body, { status: result.status, headers: result.headers });
    },
    /** Test-only fault control, not an HTTP business operation or production API. */
    failNext(fault) { return command('fault', fault); },
    async close() { if (ended) return; ended = true; try { await command('close'); } finally { await worker.terminate(); } },
  };
}
