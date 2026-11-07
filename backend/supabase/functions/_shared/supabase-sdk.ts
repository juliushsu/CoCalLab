// Pin Node declarations as well as the SDK. The transitive wildcard otherwise
// resolves newer Node globals that conflict with the checked Deno web types.
/// <reference types="npm:@types/node@22.12.0" />
export { createClient } from 'npm:@supabase/supabase-js@2.49.4';
export type { SupabaseClient } from 'npm:@supabase/supabase-js@2.49.4';
