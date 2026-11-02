import test from 'node:test';
import assert from 'node:assert/strict';
import {createAuthContinuity} from '../src/services/authContinuity.ts';
const user='00000000-0000-4000-8000-000000000001';
const jwt=(sid:string,nonce:number)=>'eyJhbGciOiJub25lIn0.'+Buffer.from(JSON.stringify({session_id:sid,iat:nonce})).toString('base64url')+'.synthetic';
const session=(sid='family-A',nonce=1,id=user)=>({access_token:jwt(sid,nonce),expires_at:Date.now()/1000+3600,user:{id}});
test('same-user token refresh and focus SIGNED_IN keep operation epoch but use the latest expiry',()=>{
  const continuity=createAuthContinuity<ReturnType<typeof session>>();
  const epoch=continuity.accept('INITIAL_SESSION',session());
  assert.equal(continuity.accept('TOKEN_REFRESHED',session('family-A',2)),epoch);
  assert.equal(continuity.accept('SIGNED_IN',session('family-A',3)),epoch);
  assert.equal(continuity.isCurrent(epoch,user),true);
});
test('logout and explicit re-login invalidate old operations even for the same account and session identifier',()=>{
  const continuity=createAuthContinuity<ReturnType<typeof session>>();
  const old=continuity.accept('INITIAL_SESSION',session());continuity.invalidate();
  assert.equal(continuity.isCurrent(old,user),false);
  const fresh=continuity.accept('EXPLICIT_SIGN_IN',session());assert.notEqual(fresh,old);
  assert.equal(continuity.isCurrent(old,user),false);assert.equal(continuity.isCurrent(fresh,user),true);
});
test('new login session family and user switch invalidate old operations, not just token expiry',()=>{
  const continuity=createAuthContinuity<ReturnType<typeof session>>();
  const old=continuity.accept('INITIAL_SESSION',session());
  const other=continuity.accept('SIGNED_IN',session('family-B',2));assert.notEqual(other,old);
  const next=continuity.accept('TOKEN_REFRESHED',session('family-B',3,'different-user'));
  assert.notEqual(next,other);assert.equal(continuity.isCurrent(other,user),false);
});
test('expired latest session and sign-out never preserve authority; token parsing is continuity only',()=>{
  const continuity=createAuthContinuity<ReturnType<typeof session>>();
  const old=continuity.accept('INITIAL_SESSION',session());
  continuity.accept('TOKEN_REFRESHED',{...session(),expires_at:1});assert.equal(continuity.isCurrent(old,user),false);
  const fresh=continuity.accept('SIGNED_IN',session());continuity.accept('SIGNED_OUT',null);
  assert.equal(continuity.isCurrent(fresh,user),false);
});

test('refresh uses latest expiry while an ambiguous new SIGNED_IN without session family invalidates old operations', () => {
  const continuity = createAuthContinuity<ReturnType<typeof session>>();
  const nearExpiry = { ...session(), expires_at: 100 };
  const epoch = continuity.accept('INITIAL_SESSION', nearExpiry);
  // Artificial clock just before expiry; accept itself uses the real clock.
  const valid = continuity.accept('INITIAL_SESSION', session());
  assert.notEqual(valid, epoch);
  continuity.accept('TOKEN_REFRESHED', { ...session('family-A', 2), expires_at: Date.now() / 1000 + 7200 });
  assert.equal(continuity.isCurrent(valid, user, Date.now() + 3600 * 1000), true);
  const noFamily = { ...session(), access_token: 'synthetic-no-family-A' };
  const first = continuity.accept('SIGNED_IN', noFamily);
  const refreshed = continuity.accept('TOKEN_REFRESHED', { ...noFamily, access_token: 'synthetic-no-family-B' });
  assert.equal(refreshed, first);
  assert.notEqual(continuity.accept('SIGNED_IN', { ...noFamily, access_token: 'synthetic-no-family-C' }), refreshed);
});

test('Upload-N1: failed explicit login restores a retained valid session under a fresh epoch, never reviving the old upload', () => {
  const continuity = createAuthContinuity<ReturnType<typeof session>>();
  const retained = session();
  const old = continuity.accept('INITIAL_SESSION', retained);
  const pending = continuity.invalidate();
  assert.equal(continuity.isCurrent(old, user), false);
  const recovered = continuity.restoreAfterFailedSignIn(pending, retained);
  assert.notEqual(recovered, null);
  assert.notEqual(recovered, pending);
  assert.equal(continuity.latest(), retained);
  assert.equal(continuity.isCurrent(old, user), false);
  assert.equal(continuity.isCurrent(recovered!, user), true);
  assert.equal(continuity.isCurrent(recovered!, user, retained.expires_at * 1000 + 1), false);
});

test('Upload-N1: failed login cannot restore an expired session or overwrite logout, another login or accepted auth event', () => {
  const expired = createAuthContinuity<ReturnType<typeof session>>();
  const pending = expired.invalidate();
  const epoch = expired.restoreAfterFailedSignIn(pending, { ...session(), expires_at: 1 });
  assert.notEqual(epoch, null);
  assert.equal(expired.latest(), null);
  for (const boundary of ['logout', 'newLogin', 'authEvent'] as const) {
    const continuity = createAuthContinuity<ReturnType<typeof session>>();
    const retained = session();
    continuity.accept('INITIAL_SESSION', retained);
    const started = continuity.invalidate();
    if (boundary === 'logout') continuity.accept('SIGNED_OUT', null);
    if (boundary === 'newLogin') continuity.invalidate();
    if (boundary === 'authEvent') continuity.accept('SIGNED_IN', session('new-family', 2, 'new-user'));
    const latest = continuity.latest();
    assert.equal(continuity.restoreAfterFailedSignIn(started, retained), null, boundary);
    assert.equal(continuity.latest(), latest);
  }
});
