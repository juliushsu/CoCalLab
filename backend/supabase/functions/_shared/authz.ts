import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';
import { createRequestScopedClient } from './supabase-client.ts';

const WRITE_ROLES = new Set(['owner', 'admin', 'editor']);

export class AuthzError extends Error {
  code: string;
  httpStatus: number;

  constructor(code: string, message: string, httpStatus: number) {
    super(message);
    this.code = code;
    this.httpStatus = httpStatus;
  }
}

export async function requireOrganizationWriteAccess(
  request: Request,
  serviceClient: SupabaseClient,
  organizationId: string,
): Promise<{ user_id: string; email: string | null }> {
  const authorization = request.headers.get('authorization');
  if (!authorization) {
    throw new AuthzError('AUTH_REQUIRED', 'Missing Authorization header', 401);
  }

  const requestClient = createRequestScopedClient(request);
  const { data: userData, error: userError } = await requestClient.auth.getUser();

  if (userError || !userData?.user?.id) {
    throw new AuthzError('INVALID_JWT', 'Unable to resolve authenticated user from JWT', 401);
  }

  const user = userData.user;

  const { data: member, error: memberError } = await serviceClient
    .from('organization_members')
    .select('role, status')
    .eq('organization_id', organizationId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (memberError) {
    throw new AuthzError('AUTHZ_LOOKUP_FAILED', memberError.message, 500);
  }

  if (!member || member.status !== 'active' || !WRITE_ROLES.has(member.role)) {
    throw new AuthzError('FORBIDDEN_ROLE', 'User is not allowed to perform write actions in this organization', 403);
  }

  return {
    user_id: user.id,
    email: user.email ?? null,
  };
}

export async function requireOrganizationReadAccess(
  request: Request,
  serviceClient: SupabaseClient,
  organizationId: string,
): Promise<{ user_id: string; email: string | null; role: string }> {
  const authorization = request.headers.get('authorization');
  if (!authorization) {
    throw new AuthzError('AUTH_REQUIRED', 'Missing Authorization header', 401);
  }

  const requestClient = createRequestScopedClient(request);
  const { data: userData, error: userError } = await requestClient.auth.getUser();

  if (userError || !userData?.user?.id) {
    throw new AuthzError('INVALID_JWT', 'Unable to resolve authenticated user from JWT', 401);
  }

  const user = userData.user;

  const { data: member, error: memberError } = await serviceClient
    .from('organization_members')
    .select('role, status')
    .eq('organization_id', organizationId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (memberError) {
    throw new AuthzError('AUTHZ_LOOKUP_FAILED', memberError.message, 500);
  }

  if (!member || member.status !== 'active') {
    throw new AuthzError('FORBIDDEN_MEMBERSHIP', 'User is not an active member in this organization', 403);
  }

  return {
    user_id: user.id,
    email: user.email ?? null,
    role: member.role,
  };
}
