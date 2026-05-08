import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';
import { currentRuntimeEnv } from './staging-guard.ts';

type ActionLogInput = {
  user_id: string;
  organization_id?: string | null;
  project_id?: string | null;
  action: string;
  table_name: string;
  record_id: string;
  metadata?: Record<string, unknown>;
};

export async function insertActionLog(
  serviceClient: SupabaseClient,
  input: ActionLogInput,
): Promise<void> {
  const { error } = await serviceClient.from('action_logs').insert({
    user_id: input.user_id,
    organization_id: input.organization_id || null,
    project_id: input.project_id || null,
    action: input.action,
    table_name: input.table_name,
    record_id: input.record_id,
    env: currentRuntimeEnv(),
    is_test: true,
    metadata: input.metadata || {},
  });

  if (error) {
    throw new Error(`action_log_insert_failed: ${error.message}`);
  }
}
