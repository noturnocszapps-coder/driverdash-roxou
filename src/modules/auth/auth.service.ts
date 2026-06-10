/**
 * Authentication Service Routines
 * Module: Authentication (auth)
 * When to edit: When altering Supabase Auth behaviors, Google OAuth setups, or mock demo logic.
 */

import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { Profile, UserRole, UserPlan } from './auth.types';
import { STORAGE_PREFIX } from '../shared/constants';

export const authService = {
  /**
   * Triggers Google Sign In via Supabase Sign In with OAuth.
   */
  async loginWithGoogle(): Promise<void> {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase is not configured yet. Use Local Sandbox Mode instead.');
    }
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin + '/dashboard',
      }
    });
    if (error) throw error;
  },

  /**
   * Triggers email and password login.
   */
  async loginWithEmailAndPassword(email: string, password: string) {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase connection parameters are unavailable yet in this live container.');
    }
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
    return data;
  },

  /**
   * Triggers graceful Supabase logout.
   */
  async logout(): Promise<void> {
    if (isSupabaseConfigured()) {
      await supabase.auth.signOut();
    }
  },

  /**
   * Handles user profiling fetch or auto-creation fallback.
   */
  async fetchOrCreateProfile(userId: string, email: string): Promise<Profile> {
    let { data: profileData, error: profileErr } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (profileErr) {
      if (profileErr.code !== 'PGRST116') {
        throw profileErr;
      }

      console.warn("Profile not found in database, generating standard automatic row sync...");
      const initialProfile: Profile = {
        id: userId,
        name: email.split('@')[0],
        email: email,
        avatar_url: null,
        role: email.includes('admin') || email === 'noturnocszapps@gmail.com' ? 'admin' : 'driver',
        plan: 'free',
        created_at: new Date().toISOString()
      };

      const { data: inserted, error: insertErr } = await supabase
        .from('profiles')
        .insert([initialProfile])
        .select()
        .single();

      if (insertErr) {
        console.error("Critical error building database profile:", insertErr);
        return initialProfile;
      }
      return inserted;
    }

    return profileData;
  },

  /**
   * Updates profile onboarding complete status.
   */
  async completeOnboarding(userId: string): Promise<void> {
    if (isSupabaseConfigured()) {
      await supabase
        .from('profiles')
        .update({ onboarding_completed: true })
        .eq('id', userId);
    }
  }
};
