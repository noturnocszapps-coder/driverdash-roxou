/**
 * Authentication and Profiling Type Definitions
 * Module: Authentication (auth)
 * When to edit: When updating user roles, profile fields, or authentication session contracts.
 */

import React from 'react';
import { Profile, UserRole, UserPlan } from '../../types';

export type { Profile, UserRole, UserPlan };

export interface AuthContextType {
  user: any | null;
  profile: Profile | null;
  loading: boolean;
  dbStatus: 'connected' | 'fallback' | 'checking';
  errorMessage: string | null;
  loginWithGoogle: () => Promise<void>;
  loginWithEmailAndPassword: (email: string, password: string) => Promise<void>;
  localDemoLogin: (role: UserRole) => void;
  logout: () => Promise<void>;
  completeOnboarding: () => Promise<void>;
  setProfileState: React.Dispatch<React.SetStateAction<Profile | null>>;
  updateProfilePlanLocal: (userId: string, plan: UserPlan) => void;
  updateProfileRoleLocal: (userId: string, role: UserRole) => void;
  setDbStatusState: React.Dispatch<React.SetStateAction<'connected' | 'fallback' | 'checking'>>;
}
