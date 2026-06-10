/**
 * Roxou Partners Adapter - FASE 5.1
 * Location: src/modules/demand/adapters/roxouPartnersAdapter.ts
 * Description: Retrieves partner physical venues, restaurants, bars, and commercial networks.
 */

import { DemandSignal } from '../../../types';
import { defaultRoxouIntegrationConfig } from '../roxouIntegration.config';
import { RoxouPartnerSignal } from '../roxouIntegration.types';
import { normalizeRoxouPartnerToDemandSignal } from '../roxouSignalNormalizer';

export class RoxouPartnersAdapter {
  /**
   * Fetches mock data adhering to the RoxouPartnerSignal contract
   */
  public static fetchMock(): RoxouPartnerSignal[] {
    return [
      {
        id: 'part-pr-1',
        name: 'Gastrobar Toledo Amigos',
        type: 'bar',
        region: 'Toledo',
        latitude: -22.1256,
        longitude: -51.3992,
        supports_sports: true,
        average_movement_level: 'high',
        source: 'mock'
      },
      {
        id: 'part-pr-2',
        name: 'Pastelaria Gourmet Prudenshopping',
        type: 'restaurant',
        region: 'Prudenshopping',
        latitude: -22.1147,
        longitude: -51.4068,
        supports_sports: false,
        average_movement_level: 'extreme',
        source: 'mock'
      },
      {
        id: 'part-pr-3',
        name: 'Botequim Central de Chope',
        type: 'bar',
        region: 'Centro',
        latitude: -22.1225,
        longitude: -51.3883,
        supports_sports: true,
        average_movement_level: 'medium',
        source: 'mock'
      }
    ];
  }

  /**
   * Fetches from Supabase (Dry run/Error control)
   */
  public static async fetchFromSupabase(): Promise<{ data: RoxouPartnerSignal[]; error: string | null }> {
    if (!defaultRoxouIntegrationConfig.enabled) {
      return { data: [], error: 'Roxou integration disabled' };
    }
    return { data: [], error: 'Roxou integration not active in production' };
  }

  /**
   * Fetches from REST API (Dry run/Error control)
   */
  public static async fetchFromApi(): Promise<{ data: RoxouPartnerSignal[]; error: string | null }> {
    if (!defaultRoxouIntegrationConfig.enabled) {
      return { data: [], error: 'Roxou integration disabled' };
    }
    return { data: [], error: 'Roxou API connectivity draft placeholder' };
  }

  /**
   * Normalizes arrays of raw partner signals into DriverDash standard signals
   */
  public static normalizeToDemandSignals(rawPartners: RoxouPartnerSignal[]): DemandSignal[] {
    return rawPartners.map(partner => normalizeRoxouPartnerToDemandSignal(partner));
  }
}
