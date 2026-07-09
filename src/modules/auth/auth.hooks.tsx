/**
 * Authentication Hook and Context Provider
 * Module: Authentication (auth)
 * When to edit: When adding authentication listeners, changing session persistence, or adding demo variables.
 */

import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { STORAGE_PREFIX } from '../shared/constants';
import { Profile, UserRole, UserPlan, AuthContextType } from './auth.types';
import { authService } from './auth.service';
import { auditLogger } from '../observability/auditLogger';

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<any | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [dbStatus, setDbStatus] = useState<'connected' | 'fallback' | 'checking'>('checking');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Sync / Load fallback files
  const loadLocalDemoSession = () => {
    setDbStatus('fallback');
    const localUserStr = localStorage.getItem(`${STORAGE_PREFIX}user`);
    const localProfileStr = localStorage.getItem(`${STORAGE_PREFIX}profile`);
    
    if (localUserStr && localProfileStr) {
      const userObj = JSON.parse(localUserStr);
      const profileObj = JSON.parse(localProfileStr);
      setUser(userObj);
      setProfile(profileObj);
    } else {
      setUser(null);
      setProfile(null);
    }
  };

  const fetchProfileAndData = async (userId: string, email: string) => {
    try {
      console.log('[ONBOARDING_CHECK_START] Iniciando checagem de perfil ao autenticar');
      setDbStatus('checking');
      let loadedProfile = await authService.fetchOrCreateProfile(userId, email);
      
      if (loadedProfile) {
        console.log('[ONBOARDING_PROFILE_FOUND] Perfil do usuário carregado com sucesso do Supabase.');
      }
      
      // Check local sources for onboarding_completed override
      const localProfileStr = localStorage.getItem(`${STORAGE_PREFIX}profile`);
      const localProgressStr = localStorage.getItem(`${STORAGE_PREFIX}onboarding_v2_progress`);
      
      let isCompletedLocally = false;

      if (localProfileStr) {
        try {
          const parsedLocal = JSON.parse(localProfileStr);
          if (parsedLocal && parsedLocal.id === userId && parsedLocal.onboarding_completed) {
            isCompletedLocally = true;
          }
        } catch (e) {
          console.warn('Erro ao analisar perfil local:', e);
        }
      }

      if (localProgressStr) {
        try {
          const parsedProgress = JSON.parse(localProgressStr);
          if (parsedProgress && parsedProgress.onboarding_completed) {
            isCompletedLocally = true;
          }
        } catch (e) {
          console.warn('Erro ao analisar progresso local:', e);
        }
      }

      // If either local or remote profile is completed, ensure it is completed
      if (loadedProfile.onboarding_completed || isCompletedLocally) {
        console.log('[ONBOARDING_ALREADY_COMPLETED] Onboarding verificado como concluído!');
        if (!loadedProfile.onboarding_completed) {
          console.log('[ONBOARDING_PROFILE_LOADED_LOCAL] Sincronizando conclusão local com Supabase');
          await authService.completeOnboarding(userId);
        }
        loadedProfile = {
          ...loadedProfile,
          onboarding_completed: true
        };
      } else {
        // Protection against falsy/empty/null database overrides if local state was already completed
        if (profile?.onboarding_completed) {
          console.warn('[ONBOARDING_BLOCK_EMPTY_RESET] Bloqueando reset falso de onboarding concluído!');
          loadedProfile = {
            ...loadedProfile,
            onboarding_completed: true
          };
          await authService.completeOnboarding(userId);
        } else {
          console.log('[ONBOARDING_SHOW_WIZARD] Nenhum onboarding concluído encontrado. O Wizard de configuração será exibido.');
        }
      }

      setProfile(loadedProfile);
      localStorage.setItem(`${STORAGE_PREFIX}profile`, JSON.stringify(loadedProfile));
      setDbStatus('connected');
    } catch (err: any) {
      console.error('Database user check failed. Failing back to local offline backup profiles:', err);
      
      // Try to load from secure local cache first to maintain single source of truth priority
      const localProfileStr = localStorage.getItem(`${STORAGE_PREFIX}profile`);
      if (localProfileStr) {
        try {
          const parsedLocal = JSON.parse(localProfileStr);
          if (parsedLocal && parsedLocal.id === userId) {
            console.log('[ONBOARDING_PROFILE_FOUND] Perfil do usuário carregado com sucesso do cache local (offline).');
            if (parsedLocal.onboarding_completed) {
              console.log('[ONBOARDING_ALREADY_COMPLETED] Onboarding verificado como concluído offline no cache local!');
            }
            setProfile(parsedLocal);
            setDbStatus('fallback');
            return;
          }
        } catch (e) {
          console.warn('Erro ao recuperar perfil local em modo offline:', e);
        }
      }

      setDbStatus('fallback');
      loadLocalDemoSession();
    }
  };

  // Auth Listener and Initial Check
  useEffect(() => {
    const initSession = async () => {
      setLoading(true);
      try {
        if (!isSupabaseConfigured()) {
          loadLocalDemoSession();
          return;
        }

        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) throw error;

        if (session) {
          setUser(session.user);
          await fetchProfileAndData(session.user.id, session.user.email || '');
          setDbStatus('connected');
        } else {
          loadLocalDemoSession();
        }
      } catch (err: any) {
        console.error('Database connection failed on init. Falling back to local demonstration rules:', err);
        loadLocalDemoSession();
      } finally {
        setLoading(false);
      }
    };

    initSession();

    // Setup listener
    if (isSupabaseConfigured()) {
      const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
        if (session) {
          setLoading(true);
          try {
            setUser(session.user);
            await fetchProfileAndData(session.user.id, session.user.email || '');
            setDbStatus('connected');
          } catch (e) {
            console.error('Error in auth state change profile fetch:', e);
          } finally {
            setLoading(false);
          }
        } else {
          setUser(null);
          setProfile(null);
          const localProfileStr = localStorage.getItem(`${STORAGE_PREFIX}profile`);
          if (!localProfileStr) {
            setUser(null);
            setProfile(null);
          }
        }
      });

      return () => {
        subscription.unsubscribe();
      };
    }
  }, []);

  const loginWithGoogle = async () => {
    setErrorMessage(null);
    try {
      await authService.loginWithGoogle();
    } catch (err: any) {
      setErrorMessage(err.message || 'Error executing Google authentication');
      throw err;
    }
  };

  const loginWithEmailAndPassword = async (email: string, password: string) => {
    setErrorMessage(null);
    try {
      const data = await authService.loginWithEmailAndPassword(email, password);
      if (data.user) {
        setUser(data.user);
        await fetchProfileAndData(data.user.id, data.user.email || '');
        auditLogger.logAuthAction('login', email);
      }
    } catch (err: any) {
      const reason = err.message || 'Invalid email or password';
      setErrorMessage(reason);
      auditLogger.logAuthAction('login_failed', email, reason);
      throw err;
    }
  };

  const localDemoLogin = (role: UserRole) => {
    setErrorMessage(null);
    setDbStatus('fallback');
    const mockId = role === 'admin' ? 'demo-admin-uuid-1234' : 'demo-driver-uuid-5678';
    const mockEmail = role === 'admin' ? 'admin@driverdash.com' : 'motorista@driverdash.com';
    const mockName = role === 'admin' ? 'Administrador Roxou' : 'Motorista Roxou';
    
    const mockUserObj = {
      id: mockId,
      email: mockEmail,
      user_metadata: { full_name: mockName },
    };

    const mockProfileObj: Profile = {
      id: mockId,
      name: mockName,
      email: mockEmail,
      avatar_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=200',
      role: role,
      plan: role === 'admin' ? 'pro_plus' : 'free',
      beta_tester: true, // Auto enable for demo testers
      created_at: new Date().toISOString(),
    };

    localStorage.setItem(`${STORAGE_PREFIX}user`, JSON.stringify(mockUserObj));
    localStorage.setItem(`${STORAGE_PREFIX}profile`, JSON.stringify(mockProfileObj));

    setUser(mockUserObj);
    setProfile(mockProfileObj);
    auditLogger.logAuthAction('login', mockEmail);
  };

  const logout = async () => {
    const userEmail = profile?.email || 'unknown';
    try {
      await authService.logout();
    } catch (e) {
      console.warn('Supabase logout error:', e);
    }
    localStorage.removeItem(`${STORAGE_PREFIX}user`);
    localStorage.removeItem(`${STORAGE_PREFIX}profile`);
    setUser(null);
    setProfile(null);
    auditLogger.logAuthAction('logout', userEmail);
  };

  const completeOnboarding = async () => {
    if (!profile) return;
    try {
      await authService.completeOnboarding(profile.id);
    } catch (e) {
      console.error(e);
    }
    const updatedProfile = { ...profile, onboarding_completed: true };
    setProfile(updatedProfile);
    localStorage.setItem(`${STORAGE_PREFIX}profile`, JSON.stringify(updatedProfile));
  };

  const setProfileState = (prof: Profile | null | ((prev: Profile | null) => Profile | null)) => {
    setProfile(prof);
  };

  const updateProfilePlanLocal = (userId: string, plan: UserPlan) => {
    if (profile && profile.id === userId) {
      const updated = { ...profile, plan };
      setProfile(updated);
      localStorage.setItem(`${STORAGE_PREFIX}profile`, JSON.stringify(updated));
    }
  };

  const updateProfileRoleLocal = (userId: string, role: UserRole) => {
    if (profile && profile.id === userId) {
      const updated = { ...profile, role };
      setProfile(updated);
      localStorage.setItem(`${STORAGE_PREFIX}profile`, JSON.stringify(updated));
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        dbStatus,
        errorMessage,
        loginWithGoogle,
        loginWithEmailAndPassword,
        localDemoLogin,
        logout,
        completeOnboarding,
        setProfileState,
        updateProfilePlanLocal,
        updateProfileRoleLocal,
        setDbStatusState: setDbStatus,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used inside an AuthProvider');
  }
  return context;
};
export { authService };
export type { UserPlan, UserRole };
