import { supabase } from '../../lib/supabase';
import { STORAGE_PREFIX } from '../shared/constants';

export interface OnboardingProgress {
  ownershipType: 'own' | 'rented';
  fuelType: 'gasolina' | 'etanol' | 'flex' | 'diesel' | 'hybrid' | 'electric';
  platforms: string[];
  daysPerWeek: number;
  hoursPerDay: number;
  objective: 'max_profit' | 'max_revenue' | 'min_wear' | 'min_hours' | 'other';
  brand: string;
  model: string;
  year: string;
  current_step: number;
  onboarding_completed: boolean;
  updated_at?: string;
  syncPending?: boolean;
}

const ONBOARDING_KEY = `${STORAGE_PREFIX}onboarding_v2_progress`;

export const ONBOARDING_DEFAULTS: OnboardingProgress = {
  ownershipType: 'own',
  fuelType: 'flex',
  platforms: ['uber'],
  daysPerWeek: 5,
  hoursPerDay: 8,
  objective: 'max_profit',
  brand: 'Chevrolet',
  model: 'Onix',
  year: '2022',
  current_step: 1,
  onboarding_completed: false
};

export const onboardingService = {
  /**
   * Save progress immediately to localStorage, and asynchronously sync to Supabase.
   */
  async saveProgress(userId: string, progress: OnboardingProgress, dbConnected: boolean): Promise<boolean> {
    try {
      const updatedProgress = {
        ...progress,
        updated_at: new Date().toISOString(),
        syncPending: true
      };

      // 1. Save to local storage immediately
      localStorage.setItem(ONBOARDING_KEY, JSON.stringify(updatedProgress));
      console.log('[ONBOARDING] Step Saved', updatedProgress.current_step);

      // 2. Try to sync with Supabase
      if (dbConnected && userId) {
        try {
          const { error } = await supabase
            .from('profiles')
            .update({
              onboarding_step: updatedProgress.current_step,
              onboarding_progress: updatedProgress,
              onboarding_completed: updatedProgress.onboarding_completed
            })
            .eq('id', userId);

          if (error) {
            // Check if column missing error or other pgrest errors
            console.warn('Supabase onboarding progress sync failed:', error.message);
            console.log('[ONBOARDING] Sync Pending');
            return false;
          }

          // Success sync
          updatedProgress.syncPending = false;
          localStorage.setItem(ONBOARDING_KEY, JSON.stringify(updatedProgress));
          console.log('[ONBOARDING] Sync Completed');
          return true;
        } catch (dbErr) {
          console.warn('Database error syncing onboarding progress:', dbErr);
          console.log('[ONBOARDING] Sync Pending');
          return false;
        }
      } else {
        console.log('[ONBOARDING] Sync Pending');
        return false;
      }
    } catch (e) {
      console.error('Failed to save onboarding progress:', e);
      return false;
    }
  },

  /**
   * Loads driver onboarding progress following priority rules:
   * 1. Supabase
   * 2. localStorage
   * 3. defaults
   */
  async loadProgress(userId: string, dbConnected: boolean): Promise<OnboardingProgress> {
    let remoteProgress: OnboardingProgress | null = null;

    // 1. Try Supabase first
    if (dbConnected && userId) {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('onboarding_step, onboarding_progress, onboarding_completed')
          .eq('id', userId)
          .maybeSingle();

        if (!error && data && data.onboarding_progress) {
          remoteProgress = data.onboarding_progress as OnboardingProgress;
          console.log('[ONBOARDING] Profile Loaded (From Supabase)');
          
          // Sync back to local storage to keep aligned
          localStorage.setItem(ONBOARDING_KEY, JSON.stringify(remoteProgress));
          return remoteProgress;
        }
      } catch (e) {
        console.warn('Failed to load onboarding progress from Supabase:', e);
      }
    }

    // 2. Fallback to localStorage
    try {
      const local = localStorage.getItem(ONBOARDING_KEY);
      if (local) {
        const parsed = JSON.parse(local) as OnboardingProgress;
        
        // Ensure we never overwrite valid data with empty/corrupted data
        if (parsed && typeof parsed.current_step === 'number') {
          console.log('[ONBOARDING] Profile Loaded (From LocalStorage)');
          if (parsed.current_step > 1) {
            console.log('[ONBOARDING] Recovery', parsed.current_step);
          }
          return parsed;
        }
      }
    } catch (e) {
      console.error('Failed to load onboarding progress from localStorage:', e);
    }

    // 3. Fallback to defaults
    console.log('[ONBOARDING] Profile Loaded (Defaults)');
    return { ...ONBOARDING_DEFAULTS };
  },

  /**
   * Background / Offline Sync Retry logic
   */
  async syncPendingProgress(userId: string, dbConnected: boolean): Promise<boolean> {
    if (!dbConnected || !userId) return false;

    try {
      const local = localStorage.getItem(ONBOARDING_KEY);
      if (!local) return false;

      const parsed = JSON.parse(local) as OnboardingProgress;
      if (!parsed.syncPending) return false;

      console.log('[ONBOARDING] Attempting automatic sync retry...');
      const { error } = await supabase
        .from('profiles')
        .update({
          onboarding_step: parsed.current_step,
          onboarding_progress: parsed,
          onboarding_completed: parsed.onboarding_completed
        })
        .eq('id', userId);

      if (!error) {
        parsed.syncPending = false;
        localStorage.setItem(ONBOARDING_KEY, JSON.stringify(parsed));
        console.log('[ONBOARDING] Sync Completed');
        return true;
      } else {
        console.warn('[ONBOARDING] Sync retry failed:', error.message);
        return false;
      }
    } catch (e) {
      console.error('[ONBOARDING] Error during sync retry:', e);
      return false;
    }
  }
};
