import { currentSession } from './navigationScope.ts';
interface SessionIdentity { access_token?: string; expires_at?: number; user?: {id?: string} }

/** Serialize explicit login/logout intent against delayed SDK auth callbacks. */
export function createAuthSessionGate<T extends SessionIdentity>() {
  let signedOut = false;
  let nextAttempt = 0;
  let pendingAttempt: number | null = null;
  return {
    signOut() { signedOut = true; pendingAttempt = null; nextAttempt += 1; },
    beginSignIn() { pendingAttempt = ++nextAttempt; return pendingAttempt; },
    finishSignIn(attempt: number, session: T | null): T | null {
      if (pendingAttempt !== attempt) return null;
      pendingAttempt = null;
      if (!currentSession(session)) return null;
      signedOut = false;
      return session;
    },
    acceptEvent(session: T | null): T | null {
      if (signedOut || pendingAttempt !== null || !currentSession(session)) return null;
      return session;
    },
  };
}
