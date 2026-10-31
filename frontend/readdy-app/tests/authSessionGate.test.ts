import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createAuthSessionGate} from '../src/services/authSessionGate.ts';
const session = (id: string) => ({access_token:`test-${id}`,expires_at:Date.now()/1000+3600,user:{id}});
test('explicit logout rejects delayed refresh while new login is pending or fails', () => {
  const gate = createAuthSessionGate<ReturnType<typeof session>>();
  const old = session('old');
  assert.equal(gate.acceptEvent(old),old);
  gate.signOut();
  assert.equal(gate.acceptEvent(old),null);
  const attempt = gate.beginSignIn();
  assert.equal(gate.acceptEvent(old),null);
  assert.equal(gate.finishSignIn(attempt,null),null);
  assert.equal(gate.acceptEvent(old),null);
});
test('only confirmed new-login session releases logout latch', () => {
  const gate = createAuthSessionGate<ReturnType<typeof session>>();
  gate.signOut();
  const attempt = gate.beginSignIn();
  const fresh = session('new');
  assert.equal(gate.acceptEvent(fresh),null);
  assert.equal(gate.finishSignIn(attempt,fresh),fresh);
  assert.equal(gate.acceptEvent(fresh),fresh);
});
test('logout or a newer login prevents late sign-in completion from restoring authority', () => {
  const gate = createAuthSessionGate<ReturnType<typeof session>>();
  const attempt = gate.beginSignIn();
  gate.signOut();
  assert.equal(gate.finishSignIn(attempt,session('old')),null);
  assert.equal(gate.acceptEvent(session('old')),null);
  const older = gate.beginSignIn();
  const newer = gate.beginSignIn();
  assert.equal(gate.finishSignIn(older,session('old')),null);
  assert.equal(gate.finishSignIn(newer,session('new'))?.user.id,'new');
});
