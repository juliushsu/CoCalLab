import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { getSupabaseClient, isSupabaseConnected, getAuthStorage } from '../lib/supabase';
import { AuthContext } from './authContextValue';
import { currentSession as sessionIsCurrent } from '../services/navigationScope';
import { createAuthSessionGate } from '../services/authSessionGate';
import { signOutWithPersistence } from '../services/authPersistence';
import { createAuthContinuity } from '../services/authContinuity';

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [authNotice, setAuthNotice] = useState('');
  const authVersion = useRef(0);
  const authAction = useRef(0);
  const sessionGate = useRef(createAuthSessionGate<Session>());
  const continuity=useRef(createAuthContinuity<Session>());
  const [authEpoch,setAuthEpoch]=useState(0);
  const isAuthenticationCurrent=useCallback((epoch:number,userId:string)=>continuity.current.isCurrent(epoch,userId),[]);

  useEffect(() => {
    let active = true;
    let unsubscribe: (() => void) | undefined;
    const applySession = (currentSession: Session | null,event='INITIAL_SESSION') => {
      if (!active) return;
      const valid = sessionGate.current.acceptEvent(currentSession);
      setAuthEpoch(continuity.current.accept(event,valid));
      setSession(valid);
      setUser(valid?.user ?? null);
      setLoading(false);
    };

    if (!isSupabaseConnected()) {
      applySession(null);
      return () => { active = false; };
    }

    try {
      const supabase = getSupabaseClient();
      const { data: { subscription } } = supabase.auth.onAuthStateChange((event, currentSession) => {
        authVersion.current += 1;
        applySession(currentSession,event);
      });
      unsubscribe = () => subscription.unsubscribe();
      const initialVersion = authVersion.current;
      void supabase.auth.getSession().then(({ data, error }) => {
        // A newer auth event wins over this initial async snapshot.
        if (authVersion.current === initialVersion) applySession(error ? null : data.session);
      }).catch(() => {
        if (authVersion.current === initialVersion) applySession(null);
      });
    } catch {
      // Missing/invalid configuration and initialization failures stay signed out.
      applySession(null);
    }

    return () => {
      active = false;
      unsubscribe?.();
    };
  }, []);

  useEffect(() => {
    if (!session) return;
    const expiry = session.expires_at! * 1000;
    const timer = setTimeout(() => {
      if (continuity.current.latest()===session&&!sessionIsCurrent(session)) {
        authVersion.current += 1;
        setAuthEpoch(continuity.current.invalidate());
        setSession(null); setUser(null);
      }
    }, Math.min(Math.max(expiry - Date.now(), 0), 2147483647));
    return () => clearTimeout(timer);
  }, [session]);

  const signIn = async (email: string, password: string) => {
    if (!isSupabaseConnected()) throw new Error('Authentication service is not configured.');
    const supabase = getSupabaseClient();
    authAction.current += 1;
    const attempt = sessionGate.current.beginSignIn();
    setAuthEpoch(continuity.current.invalidate());
    authVersion.current += 1;
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      const accepted = sessionGate.current.finishSignIn(attempt, error ? null : data.session);
      if (error) throw error;
      if (!accepted) throw new Error('Sign-in was superseded or returned an invalid session.');
      try { getAuthStorage().acceptLogin(accepted); }
      catch (error) {
        sessionGate.current.signOut();
        setAuthEpoch(continuity.current.invalidate());
        setSession(null); setUser(null);
        throw error;
      }
      authVersion.current += 1;
      setAuthEpoch(continuity.current.accept('EXPLICIT_SIGN_IN',accepted));
      setSession(accepted); setUser(accepted.user); setLoading(false); setAuthNotice('');
    } catch (error) {
      sessionGate.current.finishSignIn(attempt, null);
      throw error;
    }
  };

  const signOut = async () => {
    const action = ++authAction.current;
    const accessToken = session?.access_token ?? null;
    sessionGate.current.signOut();
    setAuthEpoch(continuity.current.invalidate());
    authVersion.current += 1;
    setSession(null); setUser(null); setLoading(false);
    setAuthNotice('已停止此頁面的登入狀態，正在確認本機登出與本次工作階段撤銷。');
    let result: {localCleared:boolean;remoteRevoked:boolean};
    try { result = await signOutWithPersistence(getSupabaseClient().auth,getAuthStorage(),accessToken); }
    catch { result = {localCleared:false,remoteRevoked:false}; }
    if (authAction.current !== action) throw new Error('Logout was superseded by a new authentication action.');
    const notice = !result.localCleared
      ? '無法保證本機持久登出；目前頁面已封鎖登入狀態，請檢查瀏覽器儲存權限後重試。'
      : !result.remoteRevoked
        ? '已登出此瀏覽器；伺服器尚未確認撤銷本次舊工作階段，其他裝置的登入不受本操作影響。'
        : '已登出此瀏覽器，伺服器已接受本次舊工作階段的撤銷請求；既有存取權杖仍可能有效至到期，其他裝置的登入不受影響。';
    setAuthNotice(notice);
    if (!result.localCleared || !result.remoteRevoked) throw new Error(notice);
  };

  const value = {
    user,
    session,
    loading,
    authEpoch,
    isAuthenticationCurrent,
    signIn,
    signOut,
  };

  return <AuthContext.Provider value={value}>
    {children}
    {authNotice && <div role="alert" className="fixed bottom-4 left-4 right-4 z-[100] mx-auto max-w-3xl rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 shadow-lg">{authNotice}</div>}
  </AuthContext.Provider>;
}
