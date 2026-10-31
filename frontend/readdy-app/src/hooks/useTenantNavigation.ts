import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import type { Session } from '@supabase/supabase-js';
import { useAuth } from './useAuth';
import { getTenantNavigationRole } from '../services/tenantNavigationService';
import { currentSession, resolveNavigationScope, matchingNavigationMembership, type NavigationScope, type TenantRole } from '../services/navigationScope';

export function useTenantNavigation() {
  const location = useLocation();
  const {session,user,loading:authLoading} = useAuth();
  const scope = useMemo(() => resolveNavigationScope(location.pathname,location.search),[location.pathname,location.search]);
  const [result,setResult] = useState<{session:Session;scope:NavigationScope;membership:{organizationId:string;role:TenantRole} | null} | null>(null);
  const validSession = !authLoading && currentSession(session) && session?.user.id === user?.id;
  useEffect(() => {
    let active = true;
    if (!validSession || !session || !user || scope.kind === 'none' || scope.kind === 'invalid') return;
    getTenantNavigationRole(scope,user.id).then(membership => {
      if (active && currentSession(session)) setResult({session,scope,membership});
    }).catch(() => {
      if (active) setResult({session,scope,membership:null});
    });
    return () => { active = false; };
  },[session,user,validSession,scope]);
  // Scope visit/session object identity removes old authority before effects run.
  // Returning A → B → A creates a new scope object and cannot reuse prior A roles.
  const membership = validSession ? matchingNavigationMembership(result,session,scope) : null;
  return {
    role:membership?.role ?? null,
    organizationId:membership?.organizationId ?? null,
    status: !validSession ? 'signed_out' : scope.kind === 'invalid' ? 'invalid_scope' : scope.kind === 'none' ? 'select_scope' : result?.session === session && result?.scope === scope ? membership ? 'ready' : 'unavailable' : 'loading',
  };
}
