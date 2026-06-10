/**
 * Roxou Future Integration Service - FASE 5.1
 * Location: src/modules/demand/roxouIntegration.service.ts
 * Description: Manages integration state, previewing, and synchronization pipelines.
 */

import { STORAGE_PREFIX } from '../shared/constants';
import { defaultRoxouIntegrationConfig, RoxouIntegrationConfig } from './roxouIntegration.config';
import { DemandSignalAdapterResult } from './roxouIntegration.types';
import { RoxouEventsAdapter } from './adapters/roxouEventsAdapter';
import { RoxouGamesAdapter } from './adapters/roxouGamesAdapter';
import { RoxouPartnersAdapter } from './adapters/roxouPartnersAdapter';
import { supabase } from '../shared/supabase.helpers';

const CONFIG_CACHE_KEY = `${STORAGE_PREFIX}roxou_integration_config`;
const LOGS_CACHE_KEY = `${STORAGE_PREFIX}roxou_integration_logs`;

export interface RoxouIntegrationStatus {
  enabled: boolean;
  mode: 'mock' | 'supabase' | 'api';
  source: 'disabled' | 'roxou_supabase' | 'roxou_api';
  last_sync: string | null;
  error_count: number;
  mock_signals_count: number;
  recent_errors: string[];
}

export const roxouIntegrationService = {
  /**
   * Reads current integration settings (from localStorage cache or code defaults)
   */
  getIntegrationConfig(): RoxouIntegrationConfig {
    const cached = localStorage.getItem(CONFIG_CACHE_KEY);
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch (e) {
        console.warn('Config parsing error, using default', e);
      }
    }
    return defaultRoxouIntegrationConfig;
  },

  /**
   * Save settings locally to trigger reactive changes
   */
  saveIntegrationConfig(config: RoxouIntegrationConfig): void {
    localStorage.setItem(CONFIG_CACHE_KEY, JSON.stringify(config));
  },

  /**
   * Retrieves dashboard status metrics
   */
  getIntegrationStatus(): RoxouIntegrationStatus {
    const config = this.getIntegrationConfig();
    
    // Count active mock signals from mock adapters
    const mockEvents = RoxouEventsAdapter.fetchMock().length;
    const mockGames = RoxouGamesAdapter.fetchMock().length;
    const mockPartners = RoxouPartnersAdapter.fetchMock().length;
    const totalMocks = mockEvents + mockGames + mockPartners;

    // Last sync timestamp checking
    const lastSync = localStorage.getItem(`${STORAGE_PREFIX}roxou_last_sync_timestamp`);

    // Simulated error tracking
    const recentErrors: string[] = [];
    if (!config.enabled && config.mode !== 'mock') {
      recentErrors.push('Roxou integration is current disabled in settings.');
    }

    return {
      enabled: config.enabled,
      mode: config.mode,
      source: config.source,
      last_sync: lastSync || null,
      error_count: recentErrors.length,
      mock_signals_count: totalMocks,
      recent_errors: recentErrors
    };
  },

  /**
   * Simulates/executes normalized preview of signals from mock adapters,
   * without affecting live lists.
   */
  previewRoxouSignals(): DemandSignalAdapterResult {
    const events = RoxouEventsAdapter.fetchMock();
    const games = RoxouGamesAdapter.fetchMock();
    const partners = RoxouPartnersAdapter.fetchMock();

    const normalizedEvents = RoxouEventsAdapter.normalizeToDemandSignals(events);
    const normalizedGames = RoxouGamesAdapter.normalizeToDemandSignals(games);
    const normalizedPartners = RoxouPartnersAdapter.normalizeToDemandSignals(partners);

    const mergedSignals = [
      ...normalizedEvents,
      ...normalizedGames,
      ...normalizedPartners
    ];

    return {
      signals: mergedSignals,
      errors: [],
      source: 'mock',
      synced_at: new Date().toISOString()
    };
  },

  /**
   * Triggers the active live signal synchronization
   */
  async syncRoxouSignals(): Promise<DemandSignalAdapterResult> {
    const config = this.getIntegrationConfig();
    const syncedAt = new Date().toISOString();

    // 1. If disabled, log & return error controlled output
    if (!config.enabled) {
      await this.logEvent('sync', config.mode, 'error', 'Attempted signals sync but Roxou integration is disabled.');
      return {
        signals: [],
        errors: ['Roxou integration disabled'],
        source: 'disabled',
        synced_at: syncedAt
      };
    }

    // 2. Mock mode triggers normal adapter pipeline
    let signals: any[] = [];
    let errors: string[] = [];

    if (config.mode === 'mock') {
      const preview = this.previewRoxouSignals();
      signals = preview.signals;
      
      // Save sync timestamp
      localStorage.setItem(`${STORAGE_PREFIX}roxou_last_sync_timestamp`, syncedAt);
      
      // Cache processed signals list
      localStorage.setItem(
        `${STORAGE_PREFIX}roxou_synchronized_signals`,
        JSON.stringify(signals)
      );

      await this.logEvent(
        'sync',
        'mock',
        'success',
        `Successfully synchronized ${signals.length} high-fidelity mock signals.`,
        signals
      );

      return {
        signals,
        errors: [],
        source: 'mock',
        synced_at: syncedAt
      };
    } else {
      // Future DB/API Sync placeholder
      errors.push('Direct production API / DB sync remains in development draft mode.');
      await this.logEvent('sync', config.mode, 'error', 'Production synchronization restricted.');
      
      return {
        signals: [],
        errors,
        source: config.source === 'roxou_supabase' ? 'roxou_supabase' : 'roxou_api',
        synced_at: syncedAt
      };
    }
  },

  /**
   * Action: Disables integration completely
   */
  disableRoxouIntegration(): void {
    const current = this.getIntegrationConfig();
    const updated: RoxouIntegrationConfig = {
      ...current,
      enabled: false,
      source: 'disabled'
    };
    this.saveIntegrationConfig(updated);
    this.logEvent('toggle', updated.mode, 'info', 'Roxou Integration switched to DISABLED state.');
  },

  /**
   * Action: Enables mock integration mode
   */
  enableMockIntegration(): void {
    const current = this.getIntegrationConfig();
    const updated: RoxouIntegrationConfig = {
      ...current,
      enabled: true,
      mode: 'mock',
      source: 'disabled' // mock mode is internal
    };
    this.saveIntegrationConfig(updated);
    this.logEvent('toggle', 'mock', 'info', 'Roxou Integration successfully ENABLED in Mock mode.');
  },

  /**
   * Local & Supabase database log auxiliary method
   */
  async logEvent(
    action: string,
    mode: string,
    status: 'success' | 'error' | 'info',
    message: string,
    payload?: any
  ): Promise<void> {
    const logItem = {
      id: 'log-' + Math.random().toString(36).substring(2, 9),
      source: action,
      mode: mode,
      status: status,
      message: message,
      payload_preview: payload ? JSON.stringify(payload).substring(0, 300) : null,
      created_at: new Date().toISOString()
    };

    // 1. Save to local storage log array
    const localLogsStr = localStorage.getItem(LOGS_CACHE_KEY);
    const logs = localLogsStr ? JSON.parse(localLogsStr) : [];
    logs.unshift(logItem);
    localStorage.setItem(LOGS_CACHE_KEY, JSON.stringify(logs.slice(0, 40)));

    // 2. Optional: Try inserting to remote Supabase DB logs table securely (with error catcher)
    try {
      const { data: dbCheck, error: dbCheckErr } = await supabase
        .from('profiles')
        .select('role')
        .limit(1);

      if (!dbCheckErr) {
        // Safe to attempt logging if tables exist (non-essential, background task)
        await supabase
          .from('roxou_integration_logs')
          .insert([{
            source: logItem.source,
            mode: logItem.mode,
            status: logItem.status,
            message: logItem.message,
            payload_preview: logItem.payload_preview
          }])
          .select();
      }
    } catch (e) {
      // Fail silently without breaking driver UI
    }
  }
};
