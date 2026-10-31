import {test} from 'node:test';
import assert from 'node:assert/strict';
import {AuthClient, type Session} from '@supabase/supabase-js';
import {createLogoutSafeStorage,signOutWithPersistence, type BrowserAuthStorage} from '../src/services/authPersistence.ts';
const key = 'sb-offline-fixture-auth-token';
function fixtureSession(): Session {
  return {access_token:'offline-fixture-access',refresh_token:'offline-fixture-refresh',token_type:'bearer',expires_at:Math.floor(Date.now()/1000)+3600,expires_in:3600,user:{id:'00000000-0000-0000-0000-000000000001',aud:'authenticated',app_metadata:{},user_metadata:{},created_at:'2026-01-01T00:00:00Z'}};
}
function memoryStorage() {
  const values = new Map<string,string>();
  const raw:BrowserAuthStorage = {getItem:key=>values.get(key) ?? null,setItem:(key,value)=>{values.set(key,value);},removeItem:key=>{values.delete(key);}};
  return {raw,values};
}
function client(storage:BrowserAuthStorage,fetcher:typeof fetch) {
  return new AuthClient({url:'https://offline-fixture.invalid/auth/v1',storageKey:key,storage,persistSession:true,autoRefreshToken:false,detectSessionInUrl:false,fetch:fetcher});
}
const failedRemote:typeof fetch = async () => new Response(JSON.stringify({message:'Fixture remote unavailable'}),{status:500,headers:{'Content-Type':'application/json'}});

test('actual SDK remote logout failure preserves a plain session; persistent fence prevents reload resurrection', async () => {
  const baseline = memoryStorage();
  baseline.raw.setItem(key,JSON.stringify(fixtureSession()));
  const plain = client(baseline.raw,failedRemote);
  await plain.getSession();
  assert.ok((await plain.signOut()).error);
  assert.ok(baseline.raw.getItem(key)); // Actual auth-js 2.71.1 behavior, not a mock SDK.

  const {raw} = memoryStorage();
  const session = fixtureSession();
  raw.setItem(key,JSON.stringify(session));
  raw.setItem(`${key}-code-verifier`,'fixture-verifier');
  raw.setItem(`${key}-user`,'fixture-user');
  raw.setItem('enterprise-project-draft','preserve-this');
  const storage = createLogoutSafeStorage(raw,key);
  const sdk = client(storage,failedRemote);
  await sdk.getSession();
  const result = await signOutWithPersistence(sdk,storage,session.access_token);
  assert.deepEqual(result,{localCleared:true,remoteRevoked:false});
  assert.equal((await sdk.getSession()).data.session,null);
  storage.setItem(key,JSON.stringify(session)); // Late refresh is fenced.
  assert.equal(raw.getItem(key),null);
  assert.equal(raw.getItem(`${key}-code-verifier`),null);
  assert.equal(raw.getItem(`${key}-user`),null);
  const reloaded = client(createLogoutSafeStorage(raw,key),failedRemote);
  assert.equal((await reloaded.getSession()).data.session,null);
  assert.equal(raw.getItem('enterprise-project-draft'),'preserve-this');
});

test('actual SDK failed login retains logout intent; only confirmed successful login survives a fresh client reload', async () => {
  const {raw} = memoryStorage();
  const storage = createLogoutSafeStorage(raw,key);
  storage.markLogout();
  let goodPassword = false;
  const sdk = client(storage,async () => goodPassword
    ? new Response(JSON.stringify(fixtureSession()),{status:200,headers:{'Content-Type':'application/json'}})
    : new Response(JSON.stringify({message:'Invalid credentials'}),{status:400,headers:{'Content-Type':'application/json'}}));
  assert.ok((await sdk.signInWithPassword({email:'offline@example.invalid',password:'invalid-fixture'})).error);
  assert.equal((await client(createLogoutSafeStorage(raw,key),failedRemote).getSession()).data.session,null);
  goodPassword = true;
  const {data,error} = await sdk.signInWithPassword({email:'offline@example.invalid',password:'valid-fixture'});
  assert.equal(error,null);
  assert.ok(data.session);
  assert.equal(raw.getItem(key),null); // SDK writes cannot release the fence themselves.
  storage.acceptLogin(data.session!);
  const restored = await client(createLogoutSafeStorage(raw,key),failedRemote).getSession();
  assert.equal(restored.data.session?.user.id,fixtureSession().user.id);
});

test('storage failures report unverified persistent logout and block current-client reads', async () => {
  const backing = memoryStorage();
  backing.raw.setItem(key,JSON.stringify(fixtureSession()));
  let fail = false;
  const raw:BrowserAuthStorage = {
    getItem:key=>backing.raw.getItem(key),
    setItem:(key,value)=>{if(fail) throw new Error('Fixture storage write failure');backing.raw.setItem(key,value);},
    removeItem:key=>{if(fail) throw new Error('Fixture storage removal failure');backing.raw.removeItem(key);},
  };
  const storage = createLogoutSafeStorage(raw,key);
  const sdk = client(storage,failedRemote);
  await sdk.getSession();
  fail = true;
  const result = await signOutWithPersistence(sdk,storage,null);
  assert.equal(result.localCleared,false);
  assert.equal(storage.getItem(key),null);
  assert.ok(backing.raw.getItem(key)); // Reload safety is deliberately NOT claimed.
  const unavailable = () => { throw new Error('Fixture storage unavailable'); };
  const inaccessible = createLogoutSafeStorage({getItem:unavailable,setItem:unavailable,removeItem:unavailable},key);
  assert.equal(inaccessible.getItem(key),null);
  const inaccessibleSDK = client(inaccessible,failedRemote);
  assert.equal((await signOutWithPersistence(inaccessibleSDK,inaccessible,null)).localCleared,false);
});

test('actual SDK deferred logout targets captured old session and cannot clear a newer login locally', {timeout:5000}, async () => {
  const {raw} = memoryStorage();
  const oldSession = fixtureSession();
  const newSession = {...fixtureSession(),access_token:'offline-fixture-new-access',refresh_token:'offline-fixture-new-refresh'};
  raw.setItem(key,JSON.stringify(oldSession));
  const storage = createLogoutSafeStorage(raw,key);
  let requestStarted!: () => void;
  const started = new Promise<void>(resolve => { requestStarted = resolve; });
  let finishRemote!: (response:Response) => void;
  const remoteResponse = new Promise<Response>(resolve => { finishRemote = resolve; });
  let logoutRequests = 0;
  const sdk = client(storage,async (input,options) => {
    const url = new URL(String(input));
    if (url.pathname.endsWith('/logout')) {
      logoutRequests += 1;
      assert.equal(url.searchParams.get('scope'),'local');
      assert.equal(new Headers(options?.headers).get('Authorization'),`Bearer ${oldSession.access_token}`);
      requestStarted();
      return remoteResponse;
    }
    assert.equal(url.pathname.endsWith('/token'),true);
    return new Response(JSON.stringify(newSession),{status:200,headers:{'Content-Type':'application/json'}});
  });
  await sdk.getSession();
  const pendingLogout = signOutWithPersistence(sdk,storage,oldSession.access_token);
  await started;
  const {data,error} = await sdk.signInWithPassword({email:'offline@example.invalid',password:'new-valid-fixture'});
  assert.equal(error,null);
  assert.equal(data.session?.user.id,oldSession.user.id); // Same account, new session.
  storage.acceptLogin(data.session!);
  assert.equal(JSON.parse(raw.getItem(key)!).access_token,newSession.access_token);
  finishRemote(new Response(null,{status:204}));
  assert.deepEqual(await pendingLogout,{localCleared:true,remoteRevoked:true});
  assert.equal(logoutRequests,1);
  assert.equal((await sdk.getSession()).data.session?.access_token,newSession.access_token);
  assert.equal((await client(createLogoutSafeStorage(raw,key),failedRemote).getSession()).data.session?.access_token,newSession.access_token);
  // This proves SDK request scope/ordering and local persistence under deferred
  // fixture responses, not the behavior of a live Auth server's token revocation.
});
