/**
 * Feature Flags Configuration for DriverDash Roxou V3.
 * Configurable via Vite environment variables (e.g. VITE_ENABLE_DRIVER_AI).
 * Defaults to true if the variable is not set.
 */

// Helper to safely parse a boolean string from env
const getEnvFlag = (key: string, defaultValue: boolean = true): boolean => {
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    const val = import.meta.env[key];
    if (val !== undefined) {
      return val === 'true' || val === true;
    }
  }
  return defaultValue;
};

export const FEATURE_FLAGS = {
  ENABLE_DRIVER_AI: getEnvFlag('VITE_ENABLE_DRIVER_AI', true),
  ENABLE_DRIVER_SCORE: getEnvFlag('VITE_ENABLE_DRIVER_SCORE', true),
  ENABLE_SMART_GOALS: getEnvFlag('VITE_ENABLE_SMART_GOALS', true),
  ENABLE_DEMAND_MAP: getEnvFlag('VITE_ENABLE_DEMAND_MAP', true),
  ENABLE_MAINTENANCE_AI: getEnvFlag('VITE_ENABLE_MAINTENANCE_AI', true),
  ENABLE_PLATFORM_COMPARISON: getEnvFlag('VITE_ENABLE_PLATFORM_COMPARISON', true),
  ENABLE_UBER_PASS_AI: getEnvFlag('VITE_ENABLE_UBER_PASS_AI', true),
  ENABLE_DATA_SOURCE_BADGES: getEnvFlag('VITE_ENABLE_DATA_SOURCE_BADGES', true),
};

export type FeatureFlagName = keyof typeof FEATURE_FLAGS;

/**
 * Checks if a specific feature flag is enabled.
 */
export function isFeatureEnabled(flag: FeatureFlagName): boolean {
  return FEATURE_FLAGS[flag] === true;
}
