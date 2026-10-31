import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { getSupabaseClient, isSupabaseConnected } from '../lib/supabase';
import { AuthContext } from './authContextValue';
import { currentSession as sessionIsCurrent } from '../services/navigationScope';
import { createAuthSessionGate } from '../services/authSessionGate';

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const authVersion = useRef(0);
  const sessionGate = useRef(createAuthSessionGate<Session>());

  useEffect(() => {
    let active = true;
    let unsubscribe: (() => void) | undefined;
    const applySession = (currentSession: Session | null) => {
      if (!active) return;
      const valid = sessionGate.current.acceptEvent(currentSession);
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
      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, currentSession) => {
        authVersion.current += 1;
        applySession(currentSession);
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
      if (!sessionIsCurrent(session)) {
        authVersion.current += 1;
        setSession(null); setUser(null);
      }
    }, Math.min(Math.max(expiry - Date.now(), 0), 2147483647));
    return () => clearTimeout(timer);
  }, [session]);

  const signIn = async (email: string, password: string) => {
    if (!isSupabaseConnected()) throw new Error('Authentication service is not configured.');
    const supabase = getSupabaseClient();
    const attempt = sessionGate.current.beginSignIn();
    authVersion.current += 1;
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      const accepted = sessionGate.current.finishSignIn(attempt, error ? null : data.session);
      if (error) throw error;
      if (!accepted) throw new Error('Sign-in was superseded or returned an invalid session.');
      authVersion.current += 1;
      setSession(accepted); setUser(accepted.user); setLoading(false);
    } catch (error) {
      sessionGate.current.finishSignIn(attempt, null);
      throw error;
    }
  };

  const signOut = async () => {
    sessionGate.current.signOut();
    authVersion.current += 1;
    setSession(null); setUser(null); setLoading(false);
    const supabase = getSupabaseClient();
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  };

  const value = {
    user,
    session,
    loading,
    signIn,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
