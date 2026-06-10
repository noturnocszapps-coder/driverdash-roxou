/**
 * Roxou Integration Configuration - FASE 5.1
 * Location: src/modules/demand/roxouIntegration.config.ts
 * Description: Prepares architecture to safely integrate DriverDash with Roxou Ecosystem.
 */

export interface RoxouIntegrationConfig {
  enabled: boolean;
  mode: 'mock' | 'supabase' | 'api';
  source: 'disabled' | 'roxou_supabase' | 'roxou_api';
  syncIntervalMinutes: number;
  allowedTables: string[];
  featureFlags: {
    useEvents: boolean;
    useGames: boolean;
    usePartners: boolean;
    useNews: boolean;
    useManualSignals: boolean;
  };
}

export const defaultRoxouIntegrationConfig: RoxouIntegrationConfig = {
  enabled: false,
  mode: 'mock',
  source: 'disabled',
  syncIntervalMinutes: 15,
  allowedTables: [
    'roxou_events',
    'roxou_games',
    'roxou_partner_venues',
    'roxou_integration_logs'
  ],
  featureFlags: {
    useEvents: true,
    useGames: true,
    usePartners: true,
    useNews: false,
    useManualSignals: true
  }
};
