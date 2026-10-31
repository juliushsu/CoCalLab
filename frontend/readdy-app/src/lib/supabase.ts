import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { createLogoutSafeStorage, type BrowserAuthStorage, type LogoutSafeStorage } from '../services/authPersistence';

// Supabase 環境變數 - 修正為正確的鍵名
const SUPABASE_URL = import.meta.env.VITE_PUBLIC_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = import.meta.env.VITE_PUBLIC_SUPABASE_ANON_KEY || '';

// Supabase client 單例
let supabaseInstance: SupabaseClient | null = null;
let authStorage: LogoutSafeStorage | null = null;
function browserStorage(): BrowserAuthStorage {
  try { if (typeof window !== 'undefined' && window.localStorage) return window.localStorage; } catch { /* unavailable storage */ }
  // Do not claim durable logout via a fresh Map while inaccessible browser
  // storage might still contain an older session. The wrapper reads fail closed.
  const unavailable = () => { throw new Error('Browser authentication storage is unavailable.'); };
  return {getItem:unavailable,setItem:unavailable,removeItem:unavailable};
}
export function getAuthStorage(): LogoutSafeStorage {
  if (!authStorage) {
    if (!SUPABASE_URL) throw new Error('Authentication service is not configured.');
    const key = `sb-${new URL(SUPABASE_URL).hostname.split('.')[0]}-auth-token`;
    authStorage = createLogoutSafeStorage(browserStorage(),key);
  }
  return authStorage;
}

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
        storage: getAuthStorage(),
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