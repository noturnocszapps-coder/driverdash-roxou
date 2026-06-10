/**
 * Subscription Plans Authorization & Access Permissions Control
 * Module: Subscriptions (subscriptions)
 * When to edit: When altering premium eligibility rules, adding feature gates, or changing tier thresholds.
 */

import { Profile, UserPlan } from '../../types';

/**
 * Checks if the user is an administrator.
 */
export const isAdmin = (profile: Profile | null): boolean => {
  return profile?.role === 'admin';
};

/**
 * Checks if the user has access to premium telemetry, GPS trackings, and heatmap projections.
 */
export const hasPremiumAccess = (profile: Profile | null): boolean => {
  if (!profile) return false;
  return profile.plan === 'pro' || profile.plan === 'pro_plus' || profile.role === 'admin';
};

/**
 * Checks if the user has active unlimited history logs (more than 90 days).
 */
export const hasUnlimitedHistory = (profile: Profile | null): boolean => {
  if (!profile) return false;
  return profile.plan === 'pro' || profile.plan === 'pro_plus' || profile.role === 'admin';
};

/**
 * Checks if the user can use multi-vehicle profiles (Pro Plus tier).
 */
export const hasMultiVehicleAccess = (profile: Profile | null): boolean => {
  if (!profile) return false;
  return profile.plan === 'pro_plus' || profile.role === 'admin';
};
