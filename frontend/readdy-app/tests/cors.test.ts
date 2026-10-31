import test from 'node:test';
import assert from 'node:assert/strict';
import { createCorsHandler, serveWithCors } from '../../../backend/supabase/functions/_shared/cors.ts';

const origin = 'https://app.example.test';
const req = (method = 'POST', requestOrigin: string | null = origin, headers: Record<string, string> = {}) => new Request('https://api.example.test/functions/v1/example', {
  method, headers: { ...(requestOrigin === null ? {} : { Origin: requestOrigin }), ...headers },
});
const config = { allowedOrigins: origin, allowedMethods: ['POST'] as const };

test('exact allowed origin success and handler errors receive CORS; server calls retain authorization path', async () => {
  let calls = 0;
  const handler = createCorsHandler(request => {
    calls++;
    assert.equal(request.headers.get('Authorization'), 'Bearer fixture');
    return new Response('denied by auth', { status: 401, headers: { Vary: 'Accept', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Credentials': 'true' } });
  }, config);
  const result = await handler(req('POST', origin, { Authorization: 'Bearer fixture' }));
  assert.equal(result.status, 401);
  assert.equal(await result.text(), 'denied by auth');
  assert.equal(result.headers.get('Access-Control-Allow-Origin'), origin);
  assert.equal(result.headers.get('Access-Control-Allow-Credentials'), null);
  assert.match(result.headers.get('Vary') || '', /Accept, Origin/);
  const server = await handler(req('POST', null, { Authorization: 'Bearer fixture' }));
  assert.equal(server.status, 401);
  assert.equal(server.headers.get('Access-Control-Allow-Origin'), null);
  assert.equal(calls, 2);
  const success = await createCorsHandler(() => new Response('ok'), config)(req());
  assert.equal(success.status, 200);
  assert.equal(success.headers.get('Access-Control-Allow-Origin'), origin);
  const thrown = await createCorsHandler(() => { throw new Error('private detail'); }, config)(req());
  assert.equal(thrown.status, 500);
  assert.equal(thrown.headers.get('Access-Control-Allow-Origin'), origin);
  assert.doesNotMatch(await thrown.text(), /private detail/);
});

test('untrusted, null and lookalike origins never trigger mutation callbacks', async () => {
  let mutations = 0;
  const handler = createCorsHandler(() => { mutations++; return new Response('changed'); }, config);
  for (const value of ['https://evil.example', 'https://app.example.test.evil.test', 'http://app.example.test', 'null', 'https://app.example.test/']) {
    const response = await handler(req('POST', value));
    assert.equal(response.status, 403);
    assert.equal(response.headers.get('Access-Control-Allow-Origin'), null);
    assert.equal(response.headers.get('Vary'), 'Origin');
  }
  assert.equal(mutations, 0);
});

test('preflight accepts SDK headers, rejects unsupported methods/headers and never invokes handler', async () => {
  let calls = 0;
  const handler = createCorsHandler(() => { calls++; return new Response('business'); }, config);
  const headers = 'Authorization, apikey, Content-Type, x-client-info, x-request-id, x-correlation-id, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version';
  const response = await handler(req('OPTIONS', origin, { 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': headers }));
  assert.equal(response.status, 204);
  assert.equal(await response.text(), '');
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), origin);
  assert.equal(response.headers.get('Access-Control-Allow-Methods'), 'POST');
  assert.match(response.headers.get('Access-Control-Allow-Headers') || '', /authorization/);
  assert.match(response.headers.get('Vary') || '', /Access-Control-Request-Headers/);
  for (const invalidHeaders of [
    { 'Access-Control-Request-Method': 'DELETE' },
    { 'Access-Control-Request-Method': 'GET' },
    { 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'authorization, x-admin-bypass' },
    {},
  ]) {
    const denied = await handler(req('OPTIONS', origin, invalidHeaders));
    assert.equal(denied.status, 403);
    assert.equal(denied.headers.get('Access-Control-Allow-Origin'), origin);
    assert.equal(denied.headers.get('Access-Control-Allow-Methods'), null);
  }
  assert.equal((await handler(req('OPTIONS', null))).status, 400);
  assert.equal((await handler(req('DELETE'))).status, 405);
  assert.equal(calls, 0);
});

test('unset configuration permits only listed local development origins; invalid configuration is fail closed', async () => {
  let calls = 0;
  const business = () => { calls++; return new Response('ok'); };
  const local = createCorsHandler(business, { allowedMethods: ['POST'] });
  for (const value of ['http://localhost:5173', 'http://localhost:5174', 'http://127.0.0.1:5173', 'http://127.0.0.1:5174']) {
    assert.equal((await local(req('POST', value))).status, 200);
  }
  assert.equal((await local(req('POST', 'http://localhost:3000'))).status, 403);
  const before = calls;
  for (const value of ['', '*', 'null', `${origin},`, `${origin},*`, `${origin}/path`, `${origin}/`, 'https://user:secret@app.example.test']) {
    const invalid = createCorsHandler(business, { ...config, allowedOrigins: value });
    for (const requestOrigin of [origin, null]) {
      const response = await invalid(req('POST', requestOrigin));
      assert.equal(response.status, 503);
      assert.equal(response.headers.get('Access-Control-Allow-Origin'), null);
    }
  }
  assert.equal(calls, before);
  const multi = createCorsHandler(business, { ...config, allowedOrigins: `${origin}, https://second.example.test` });
  assert.equal((await multi(req('POST', 'https://second.example.test'))).headers.get('Access-Control-Allow-Origin'), 'https://second.example.test');
});

test('runtime wrapper reads environment once and accepts explicitly injected configuration', async () => {
  const host = globalThis as unknown as { Deno?: unknown };
  const original = host.Deno;
  let registered: ((request: Request) => Response | Promise<Response>) | null = null;
  let envReads = 0;
  try {
    host.Deno = {
      env: { get: (name: string) => { envReads++; assert.equal(name, 'CORS_ALLOWED_ORIGINS'); return origin; } },
      serve: (handler: typeof registered) => { registered = handler; return 'registered'; },
    };
    assert.equal(serveWithCors(() => new Response('ok'), { allowedMethods: ['POST'] }), 'registered');
    assert.equal((await registered!(req())).status, 200);
    assert.equal((await registered!(req('POST', 'http://localhost:5173'))).status, 403);
    assert.equal(envReads, 1);
    serveWithCors(() => new Response('ok'), { ...config, allowedOrigins: 'https://injected.example.test' });
    assert.equal((await registered!(req('POST', 'https://injected.example.test'))).status, 200);
    assert.equal(envReads, 1);
    host.Deno = {
      env: { get: () => { throw new Error('environment access denied'); } },
      serve: (handler: typeof registered) => { registered = handler; },
    };
    serveWithCors(() => new Response('must not run'), { allowedMethods: ['POST'] });
    assert.equal((await registered!(req('POST', null))).status, 503);
  } finally {
    if (original === undefined) delete host.Deno;
    else host.Deno = original;
  }
});
