/// <reference types="vite/client" />
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    'Supabase environment variables are missing! Local state will fallback if connection isn\'t active.'
  );
}

// Ensure supabase client creation doesn't crash on empty URL
const fallbackUrl = supabaseUrl && supabaseUrl.trim() !== '' ? supabaseUrl : 'https://placeholder-url.supabase.co';
const fallbackKey = supabaseAnonKey && supabaseAnonKey.trim() !== '' ? supabaseAnonKey : 'placeholder-key';

export const supabase = createClient(fallbackUrl, fallbackKey);

/**
 * Helper to determine if Supabase auth endpoints are reachable and configured.
 */
export const isSupabaseConfigured = (): boolean => {
  return !!supabaseUrl && !!supabaseAnonKey && supabaseUrl.includes('supabase.co');
};

