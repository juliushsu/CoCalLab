import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Supabase 環境變數 - 修正為正確的鍵名
const SUPABASE_URL = import.meta.env.VITE_PUBLIC_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = import.meta.env.VITE_PUBLIC_SUPABASE_ANON_KEY || '';

// Supabase client 單例
let supabaseInstance: SupabaseClient | null = null;

/**
 * 取得 Supabase client 單例
 * 確保整個應用程式只有一個 Supabase client 實例
 */
export function getSupabaseClient(): SupabaseClient {
  if (!supabaseInstance) {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      throw new Error('Supabase URL and Anon Key must be provided');
    }
    
    supabaseInstance = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    });
  }
  
  return supabaseInstance;
}

/**
 * 檢查 Supabase 是否已連接
 */
export function isSupabaseConnected(): boolean {
  const url = import.meta.env.VITE_PUBLIC_SUPABASE_URL;
  const key = import.meta.env.VITE_PUBLIC_SUPABASE_ANON_KEY;
  return Boolean(url && key);
}