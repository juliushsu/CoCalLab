// Native Deno + the exact application SDK. Local synthetic HTTP only; this is
// an SDK/header contract, not real Supabase/JWT/tenant acceptance.
import assert from 'node:assert/strict';
import { createServiceRoleClient, createRequestScopedClient } from '../supabase/functions/_shared/supabase-client.ts';

const envNames = ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY'] as const;
async function withLocalSdk(action: (url: string, calls: { path: string; authorization: string | null; apikey: string | null }[]) => Promise<void>) {
  const previous = envNames.map(name => Deno.env.get(name));
  const calls: { path: string; authorization: string | null; apikey: string | null }[] = [];
  const server = Deno.serve({ hostname: '127.0.0.1', port: 0, onListen() {} }, req => {
    calls.push({ path: new URL(req.url).pathname, authorization: req.headers.get('authorization'), apikey: req.headers.get('apikey') });
    return Response.json([{ ok: true }]);
  });
  const url = `http://127.0.0.1:${server.addr.port}`;
  Deno.env.set('SUPABASE_URL', url);
  Deno.env.set('SUPABASE_ANON_KEY', 'SYNTHETIC-PUBLIC-KEY');
  Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', 'SYNTHETIC-SERVICE-KEY');
  try { await action(url, calls); } finally {
    await server.shutdown();
    envNames.forEach((name, index) => previous[index] === undefined ? Deno.env.delete(name) : Deno.env.set(name, previous[index]!));
  }
}

Deno.test('native pinned SDK keeps request JWT and public apikey separate from service credentials', async () => {
  await withLocalSdk(async (url, calls) => {
    const requestClient = createRequestScopedClient(new Request(url, { headers: { Authorization: 'Bearer SYNTHETIC-USER-JWT' } }));
    const serviceClient = createServiceRoleClient();
    assert.equal((await requestClient.rpc('synthetic_probe')).error, null);
    assert.equal((await serviceClient.rpc('synthetic_probe')).error, null);
    assert.deepEqual(calls, [
      { path: '/rest/v1/rpc/synthetic_probe', authorization: 'Bearer SYNTHETIC-USER-JWT', apikey: 'SYNTHETIC-PUBLIC-KEY' },
      { path: '/rest/v1/rpc/synthetic_probe', authorization: 'Bearer SYNTHETIC-SERVICE-KEY', apikey: 'SYNTHETIC-SERVICE-KEY' },
    ]);
  });
});

Deno.test('native request SDK never substitutes the service key when incoming Authorization is absent', async () => {
  await withLocalSdk(async (url, calls) => {
    const client = createRequestScopedClient(new Request(url));
    assert.equal((await client.rpc('synthetic_probe')).error, null);
    assert.equal(calls[0].authorization, '');
    assert.equal(calls[0].apikey, 'SYNTHETIC-PUBLIC-KEY');
  });
});

Deno.test('native SDK client creation rejects a missing required environment value before HTTP', async () => {
  await withLocalSdk(async (_url, calls) => {
    Deno.env.delete('SUPABASE_SERVICE_ROLE_KEY');
    assert.throws(() => createServiceRoleClient(), /Missing env: SUPABASE_SERVICE_ROLE_KEY/);
    Deno.env.delete('SUPABASE_ANON_KEY');
    assert.throws(() => createRequestScopedClient(new Request('http://127.0.0.1')), /Missing env: SUPABASE_ANON_KEY/);
    assert.equal(calls.length, 0);
  });
});
