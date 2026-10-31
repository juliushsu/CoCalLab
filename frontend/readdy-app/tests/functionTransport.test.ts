import test from 'node:test';
import assert from 'node:assert/strict';
import { FunctionsClient } from '@supabase/functions-js';
import { buildFunctionRequest } from '../src/services/functionRequest.ts';

function transportHarness() {
  const requests: Array<{ url: string; init: RequestInit }> = [];
  const client = new FunctionsClient('https://example.invalid/functions/v1', {
    headers: { apikey: 'fixture-public-key' },
    customFetch: async (url, init) => {
      requests.push({ url: String(url), init: init ?? {} });
      return new Response(JSON.stringify({ success: true, data: {} }), {
        headers: { 'Content-Type': 'application/json' },
      });
    },
  });
  return { client, requests };
}

test('actual FunctionsClient preserves GET query, authorization and no-body semantics', async () => {
  const { client, requests } = transportHarness();
  const request = buildFunctionRequest({ functionName: 'analytics-emissions', method: 'GET', query: {
    organization_id: 'org/with space', dimension: 'ghg_scope', project_id: 'project-1',
  } });
  const result = await client.invoke(request.functionPath, {
    method: request.method,
    ...(request.body === undefined ? {} : { body: request.body }),
    headers: { Authorization: 'Bearer fixture-user-token' },
  });
  assert.equal(result.error, null);
  assert.equal(requests.length, 1);
  const captured = requests[0];
  const url = new URL(captured.url);
  assert.equal(url.pathname, '/functions/v1/analytics-emissions');
  assert.equal(url.searchParams.get('organization_id'), 'org/with space');
  assert.equal(url.searchParams.get('dimension'), 'ghg_scope');
  assert.equal(url.searchParams.get('project_id'), 'project-1');
  assert.equal(captured.init.method, 'GET');
  assert.equal(captured.init.body, undefined);
  assert.equal(new Headers(captured.init.headers).get('Authorization'), 'Bearer fixture-user-token');
  assert.equal(new Headers(captured.init.headers).get('apikey'), 'fixture-public-key');
});

test('actual FunctionsClient serializes complete POST payload and retains authorization', async () => {
  const { client, requests } = transportHarness();
  const payload = { organization_id: 'org', project_id: 'project', report_version: 2,
    claim_purpose: 'internal_management', language: 'zh', request_id: 'request', nested: { count: 0 } };
  const request = buildFunctionRequest({ functionName: 'generate-report', payload });
  const result = await client.invoke(request.functionPath, {
    method: request.method,
    ...(request.body === undefined ? {} : { body: request.body }),
    headers: { Authorization: 'Bearer fixture-user-token' },
  });
  assert.equal(result.error, null);
  assert.equal(requests.length, 1);
  const captured = requests[0];
  assert.equal(new URL(captured.url).pathname, '/functions/v1/generate-report');
  assert.equal(captured.init.method, 'POST');
  assert.equal(typeof captured.init.body, 'string');
  assert.deepEqual(JSON.parse(captured.init.body as string), payload);
  assert.equal(new Headers(captured.init.headers).get('Content-Type'), 'application/json');
  assert.equal(new Headers(captured.init.headers).get('Authorization'), 'Bearer fixture-user-token');
  assert.equal(new Headers(captured.init.headers).get('apikey'), 'fixture-public-key');
});
