/**
 * Environment Configuration - FASE 5.2
 * Location: src/config/environment.ts
 * Description: Detects and presents runtime application environment information & release versions.
 */

export const APP_VERSION = "0.9.0-beta";

// Simple location/host checks or env properties to identify the environment context
const getAppEnv = (): "development" | "staging" | "production" => {
  const host = window.location.hostname;
  
  if (host.includes('localhost') || host.includes('127.0.0.1') || host.includes('.local')) {
    return 'development';
  }
  
  if (host.includes('-dev.') || host.includes('-pre.') || host.includes('staging')) {
    return 'staging';
  }
  
  return 'production';
};

export const APP_ENV = getAppEnv();

export const IS_PRODUCTION = APP_ENV === 'production';
export const IS_DEVELOPMENT = APP_ENV === 'development';
export const IS_STAGING = APP_ENV === 'staging';
