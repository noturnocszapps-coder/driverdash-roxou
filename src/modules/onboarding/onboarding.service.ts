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
  rentalAmount?: string;
  weeklyKmLimit?: string;
  operatingCosts?: string;
  ipva?: string;
  insurance?: string;
  maintenance?: string;
  depreciation?: string;
  kmPerLiter?: string;
  fuelPrice?: string;
  kwhPer100km?: string;
  electricityPrice?: string;
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
   * Helper to remove undefined or null fields from progress payload
   */
  cleanPayload(progress: OnboardingProgress): OnboardingProgress {
    const cleaned = { ...progress };
    Object.keys(cleaned).forEach(key => {
      const val = cleaned[key as keyof OnboardingProgress];
      if (val === undefined || val === null || val === '') {
        delete cleaned[key as keyof OnboardingProgress];
      }
    });
    return cleaned;
  },

  /**
   * Helper to merge existing profile progress with incoming state to prevent losing fields
   */
  mergeWithExisting(existing: OnboardingProgress | null, incoming: OnboardingProgress): OnboardingProgress {
    if (!existing) return incoming;

    // Protection against empty/null/undefined or uninitialized incoming resets
    if (existing.onboarding_completed && !incoming.onboarding_completed) {
      console.warn('[ONBOARDING_BLOCK_EMPTY_RESET] Proteção ativada: Impedindo que carregamento inicial ou falha temporária de rede limpe as configurações concluídas.');
      const merged = { ...existing };
      return merged;
    }

    const merged = { ...existing, ...incoming };
    
    // Safety guards: Never overwrite valid data with empty/falsy values
    if (!incoming.objective && existing.objective) {
      merged.objective = existing.objective;
    }
    if (!incoming.brand && existing.brand) merged.brand = existing.brand;
    if (!incoming.model && existing.model) merged.model = existing.model;
    if (!incoming.year && existing.year) merged.year = existing.year;
    if (!incoming.ownershipType && existing.ownershipType) merged.ownershipType = existing.ownershipType;
    if (!incoming.fuelType && existing.fuelType) merged.fuelType = existing.fuelType;
    if ((!incoming.platforms || incoming.platforms.length === 0) && existing.platforms && existing.platforms.length > 0) {
      merged.platforms = existing.platforms;
    }

    return merged;
  },

  /**
   * Save progress immediately to localStorage, and asynchronously sync to Supabase.
   */
  async saveProgress(userId: string, progress: OnboardingProgress, dbConnected: boolean): Promise<boolean> {
    try {
      console.log('[ONBOARDING_CHECK_START] Iniciando salvamento de progresso');

      // Safety guard: do not allow saving if payload is empty/invalid
      if (!progress || (!progress.objective && !progress.brand && progress.current_step !== 1)) {
        console.warn('[ONBOARDING_BLOCK_EMPTY_RESET] Tentativa de salvar payload vazio ou incompleto bloqueada.');
        return false;
      }

      // Load existing local progress and merge with incoming progress to avoid loss
      let currentProgress = progress;
      const local = localStorage.getItem(ONBOARDING_KEY);
      if (local) {
        try {
          const parsed = JSON.parse(local) as OnboardingProgress;
          currentProgress = this.mergeWithExisting(parsed, progress);
        } catch (err) {
          console.warn('[ONBOARDING] Falha ao analisar o progresso local existente:', err);
        }
      }

      const cleanedProgress = this.cleanPayload(currentProgress);
      const updatedProgress = {
        ...cleanedProgress,
        updated_at: new Date().toISOString(),
        syncPending: true
      };

      // 1. Save to local storage immediately
      localStorage.setItem(ONBOARDING_KEY, JSON.stringify(updatedProgress));

      // 2. Try to sync with Supabase
      if (dbConnected && userId) {
        try {
          // Check current profile status first to prevent overwriting completed state with false
          const { data: currentProfile } = await supabase
            .from('profiles')
            .select('onboarding_completed, onboarding_progress')
            .eq('id', userId)
            .maybeSingle();

          let finalProgress = updatedProgress;
          if (currentProfile) {
            if (currentProfile.onboarding_completed && !updatedProgress.onboarding_completed) {
              console.warn('[ONBOARDING_BLOCK_EMPTY_RESET] Banco possui onboarding_completed como TRUE. Bloqueando reset falso.');
              finalProgress.onboarding_completed = true;
              finalProgress.current_step = 6;
            }
            if (currentProfile.onboarding_progress) {
              finalProgress = this.mergeWithExisting(currentProfile.onboarding_progress as OnboardingProgress, finalProgress);
            }
          }

          const { error } = await supabase
            .from('profiles')
            .update({
              onboarding_step: finalProgress.current_step,
              onboarding_progress: finalProgress,
              onboarding_completed: finalProgress.onboarding_completed
            })
            .eq('id', userId);

          if (error) {
            console.warn('Supabase onboarding progress sync failed:', error.message);
            console.log('[ONBOARDING] Sincronização pendente');
            return false;
          }

          // Success sync
          finalProgress.syncPending = false;
          localStorage.setItem(ONBOARDING_KEY, JSON.stringify(finalProgress));
          console.log('[ONBOARDING_SAVE_COMPLETED] Sincronização concluída com sucesso!');
          return true;
        } catch (dbErr) {
          console.warn('Database error syncing onboarding progress:', dbErr);
          console.log('[ONBOARDING] Sincronização pendente por erro de rede');
          return false;
        }
      } else {
        console.log('[ONBOARDING] Sincronização pendente (offline/sem login)');
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
    console.log('[ONBOARDING_CHECK_START] Iniciando carregamento de progresso de onboarding...');
    let remoteProgress: OnboardingProgress | null = null;

    // 1. Try Supabase first
    if (dbConnected && userId) {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('onboarding_step, onboarding_progress, onboarding_completed')
          .eq('id', userId)
          .maybeSingle();

        if (!error && data) {
          console.log('[ONBOARDING_PROFILE_FOUND] Perfil do usuário carregado com sucesso do Supabase.');
          
          if (data.onboarding_completed) {
            console.log('[ONBOARDING_ALREADY_COMPLETED] Onboarding verificado como concluído no Supabase!');
            const progressObj = (data.onboarding_progress as OnboardingProgress) || { ...ONBOARDING_DEFAULTS };
            progressObj.onboarding_completed = true;
            progressObj.current_step = 6;
            localStorage.setItem(ONBOARDING_KEY, JSON.stringify(progressObj));
            return progressObj;
          }

          if (data.onboarding_progress) {
            remoteProgress = data.onboarding_progress as OnboardingProgress;
            console.log('[ONBOARDING_PROFILE_FOUND] Progresso parcial recuperado do Supabase.');
            
            // Sync back to local storage to keep aligned
            localStorage.setItem(ONBOARDING_KEY, JSON.stringify(remoteProgress));
            return remoteProgress;
          }
        }
      } catch (e) {
        console.warn('Failed to load onboarding progress from Supabase:', e);
      }
    }

    // 2. Fallback to localStorage (Cache local seguro)
    try {
      const local = localStorage.getItem(ONBOARDING_KEY);
      if (local) {
        const parsed = JSON.parse(local) as OnboardingProgress;
        
        // Ensure we never overwrite valid data with empty/corrupted data
        if (parsed && typeof parsed.current_step === 'number') {
          console.log('[ONBOARDING_PROFILE_FOUND] Progresso recuperado com sucesso do cache local (LocalStorage).');
          if (parsed.onboarding_completed) {
            console.log('[ONBOARDING_ALREADY_COMPLETED] Onboarding verificado como concluído no cache local!');
          }
          return parsed;
        }
      }
    } catch (e) {
      console.error('Failed to load onboarding progress from localStorage:', e);
    }

    // 3. Fallback to defaults
    console.log('[ONBOARDING_SHOW_WIZARD] Nenhum progresso prévio encontrado no Supabase ou LocalStorage. O Wizard será exibido.');
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

      console.log('[ONBOARDING] Tentando sincronização automática pendente...');
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
        console.log('[ONBOARDING_SAVE_COMPLETED] Sincronização pendente realizada com sucesso!');
        return true;
      } else {
        console.warn('[ONBOARDING] Falha na retentativa de sincronização:', error.message);
        return false;
      }
    } catch (e) {
      console.error('[ONBOARDING] Erro durante a retentativa de sincronização:', e);
      return false;
    }
  }
};
