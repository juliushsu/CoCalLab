import { useEffect, useState, type ReactNode } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { getSupabaseClient, isSupabaseConnected } from '../lib/supabase';
import { AuthContext } from './authContextValue';

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  /** Mock role — hardcoded to 'owner' for closed beta. No real auth system yet. */
  const [role] = useState<'owner'>('owner');

  useEffect(() => {
    let active = true;
    let authVersion = 0;
    let unsubscribe: (() => void) | undefined;
    const applySession = (currentSession: Session | null) => {
      if (!active) return;
      setSession(currentSession);
      setUser(currentSession?.user ?? null);
      setLoading(false);
    };

    if (!isSupabaseConnected()) {
      applySession(null);
      return () => { active = false; };
    }

    try {
      const supabase = getSupabaseClient();
      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, currentSession) => {
        authVersion += 1;
        applySession(currentSession);
      });
      unsubscribe = () => subscription.unsubscribe();
      const initialVersion = authVersion;
      void supabase.auth.getSession().then(({ data, error }) => {
        // A newer auth event wins over this initial async snapshot.
        if (authVersion === initialVersion) applySession(error ? null : data.session);
      }).catch(() => {
        if (authVersion === initialVersion) applySession(null);
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

  const signIn = async (email: string, password: string) => {
    if (!isSupabaseConnected()) throw new Error('Authentication service is not configured.');
    const supabase = getSupabaseClient();
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
  };

  const signOut = async () => {
    const supabase = getSupabaseClient();
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  };

  const value = {
    user,
    session,
    loading,
    role,
    signIn,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
