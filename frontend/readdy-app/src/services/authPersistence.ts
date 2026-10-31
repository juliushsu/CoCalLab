import type { AuthClient, Session } from '@supabase/supabase-js';

export interface BrowserAuthStorage {
  getItem(key:string):string|null;
  setItem(key:string,value:string):void;
  removeItem(key:string):void;
}
/** Fence only this application's SDK auth namespace, never other browser data. */
export function createLogoutSafeStorage(raw: BrowserAuthStorage, storageKey: string) {
  const intentKey = `${storageKey}-logout-intent`;
  const sessionKeys = [storageKey,`${storageKey}-code-verifier`,`${storageKey}-user`];
  let blockedInMemory = false;
  const blocked = () => {
    if (blockedInMemory) return true;
    try { return raw.getItem(intentKey) === '1'; }
    catch { blockedInMemory = true; return true; }
  };
  return {
    getItem(key:string) {
      if (sessionKeys.includes(key) && blocked()) return null;
      return raw.getItem(key);
    },
    setItem(key:string,value:string) {
      if (sessionKeys.includes(key) && blocked()) return;
      raw.setItem(key,value);
    },
    removeItem(key:string) { raw.removeItem(key); },
    markLogout() {
      blockedInMemory = true;
      let failed = false;
      try { raw.setItem(intentKey,'1'); } catch { failed = true; }
      for (const key of sessionKeys) {
        try { raw.removeItem(key); } catch { failed = true; }
      }
      try {
        if (raw.getItem(intentKey) !== '1' || sessionKeys.some(key => raw.getItem(key) !== null)) failed = true;
      } catch { failed = true; }
      if (failed) throw new Error('Local persistent logout could not be verified.');
    },
    /** Called only with the SDK result of a confirmed, current login attempt. */
    acceptLogin(session: Session) {
      try {
        raw.setItem(storageKey,JSON.stringify(session));
        raw.removeItem(intentKey);
        if (raw.getItem(intentKey) !== null) throw new Error('Logout intent remains active.');
        blockedInMemory = false;
      } catch {
        blockedInMemory = true;
        throw new Error('Unable to persist the new login safely.');
      }
    },
  };
}
export type LogoutSafeStorage = ReturnType<typeof createLogoutSafeStorage>;

export async function signOutWithPersistence(
  auth: Pick<InstanceType<typeof AuthClient>,'signOut'|'admin'>,
  storage: LogoutSafeStorage,
  accessToken: string | null,
): Promise<{localCleared:boolean;remoteRevoked:boolean}> {
  let localCleared = true;
  try { storage.markLogout(); } catch { localCleared = false; }
  // The fenced SDK sees no local session: this emits SIGNED_OUT and cleans up
  // without depending on a remote request or using private SDK methods.
  try {
    const {error} = await auth.signOut({scope:'local'});
    if (error) localCleared = false;
  } catch { localCleared = false; }
  let remoteRevoked = false;
  if (accessToken) {
    // This public SDK logout API accepts the current user's JWT, not an admin key.
    // Revoke only the captured old session. A delayed global logout could also
    // revoke a newer login for the same account. Other device sessions stay intact.
    try { remoteRevoked = !(await auth.admin.signOut(accessToken,'local')).error; }
    catch { remoteRevoked = false; }
  }
  return {localCleared,remoteRevoked};
}
