/**
 * Supabase configuration and connectivity indicators
 * Module: Shared
 * When to edit: When modifying Supabase configuration detection or adding check hooks.
 */

import { isSupabaseConfigured, supabase } from '../../lib/supabase';

export const isDbConnected = (): boolean => {
  return isSupabaseConfigured();
};

export { supabase };
