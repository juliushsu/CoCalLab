import { createContext } from 'react';
import type { User, Session } from '@supabase/supabase-js';

/** Mock role for governance-aware navigation — to be replaced by real auth system */
type MockRole = 'viewer' | 'editor' | 'owner' | 'platform_admin';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  /** Mock role for sidebar governance — NOT real auth. Replace with real roles API. */
  role: MockRole | null;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

