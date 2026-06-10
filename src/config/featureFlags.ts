/**
 * Feature Flags Configuration - FASE 5.2
 * Location: src/config/featureFlags.ts
 * Description: Manages application-wide feature flags with persistent runtime overrides.
 */

import { STORAGE_PREFIX } from '../modules/shared/constants';

export interface FeatureFlags {
  ENABLE_GPS: boolean;
  ENABLE_HEATMAP: boolean;
  ENABLE_DEMAND: boolean;
  ENABLE_ROXOU_INTEGRATION: boolean;
  ENABLE_DEBUG: boolean;
  ENABLE_OBSERVABILITY: boolean;
  ENABLE_BETA_MODE: boolean;
}

// Default values for standard setup
const DEFAULT_FLAGS: FeatureFlags = {
  ENABLE_GPS: true,
  ENABLE_HEATMAP: true,
  ENABLE_DEMAND: true,
  ENABLE_ROXOU_INTEGRATION: true, // Let we enable the UI area but with functional adapters in mock/disabled state
  ENABLE_DEBUG: true,
  ENABLE_OBSERVABILITY: true,
  ENABLE_BETA_MODE: true, // We activate this to test the restricted beta gate
};

const CACHE_KEY = `${STORAGE_PREFIX}feature_flags`;

export const featureFlagsManager = {
  /**
   * Retrieves all feature flags, merging factory defaults with localized overrides.
   */
  getAll(): FeatureFlags {
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      try {
        return { ...DEFAULT_FLAGS, ...JSON.parse(cached) };
      } catch (e) {
        console.warn('Error fetching custom feature flags, falling back', e);
      }
    }
    return DEFAULT_FLAGS;
  },

  /**
   * Reads a single feature flag
   */
  get(key: keyof FeatureFlags): boolean {
    return this.getAll()[key];
  },

  /**
   * Toggles or updates a single feature flag
   */
  set(key: keyof FeatureFlags, value: boolean): void {
    const current = this.getAll();
    current[key] = value;
    localStorage.setItem(CACHE_KEY, JSON.stringify(current));
  },

  /**
   * Resets all feature flags to defaults
   */
  resetAll(): void {
    localStorage.removeItem(CACHE_KEY);
  }
};
