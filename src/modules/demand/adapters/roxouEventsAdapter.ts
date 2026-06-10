/**
 * Roxou Events Adapter - FASE 5.1
 * Location: src/modules/demand/adapters/roxouEventsAdapter.ts
 * Description: Retrieves municipal, concert, and corporate events from Roxou and adapts them.
 */

import { DemandSignal } from '../../../types';
import { defaultRoxouIntegrationConfig } from '../roxouIntegration.config';
import { RoxouEventSignal } from '../roxouIntegration.types';
import { normalizeRoxouEventToDemandSignal } from '../roxouSignalNormalizer';

export class RoxouEventsAdapter {
  /**
   * Fetches mock data adhering to the RoxouEventSignal contract
   */
  public static fetchMock(): RoxouEventSignal[] {
    const today = new Date();
    
    const ev1StartingSoon = new Date(today.getTime() + 1.2 * 60 * 60 * 1000).toISOString(); // 1.2 hrs from now
    const ev1EndingLater = new Date(today.getTime() + 4 * 60 * 60 * 1000).toISOString();

    const ev2EndingNow = new Date(today.getTime() - 15 * 60 * 1000).toISOString(); // ended 15 mins ago
    const ev2StartedEarlier = new Date(today.getTime() - 3 * 60 * 60 * 1000).toISOString();

    return [
      {
        id: 'evt-pr-1',
        title: 'Calourada Universitária UNOESTE',
        slug: 'calourada-unoeste',
        venue_name: 'Campus II UNOESTE',
        region: 'UNOESTE',
        latitude: -22.1192,
        longitude: -51.4428,
        starts_at: ev1StartingSoon,
        ends_at: ev1EndingLater,
        category: 'academic',
        sub_category: 'college_party',
        expected_audience_level: 'extreme',
        source: 'mock'
      },
      {
        id: 'evt-pr-2',
        title: 'Festival Gastronômico da Alta Paulista',
        slug: 'festival-gastronomico',
        venue_name: 'Centro Cultural Matarazzo',
        region: 'Matarazzo',
        latitude: -22.1144,
        longitude: -51.3811,
        starts_at: ev2StartedEarlier,
        ends_at: ev2EndingNow,
        category: 'show',
        sub_category: 'food_trucks',
        expected_audience_level: 'high',
        source: 'mock'
      },
      {
        id: 'evt-pr-3',
        title: 'Expo Prudente Expositores',
        slug: 'expo-prudente-agro',
        venue_name: 'Recinto de Exposições',
        region: 'Expo Prudente',
        latitude: -22.1642,
        longitude: -51.3482,
        starts_at: new Date(today.getTime() - 6 * 60 * 60 * 1000).toISOString(),
        ends_at: new Date(today.getTime() + 6 * 60 * 60 * 1000).toISOString(),
        category: 'conference',
        sub_category: 'business',
        expected_audience_level: 'medium',
        source: 'mock'
      }
    ];
  }

  /**
   * Fetches from Supabase (Dry run/Error control)
   */
  public static async fetchFromSupabase(): Promise<{ data: RoxouEventSignal[]; error: string | null }> {
    if (!defaultRoxouIntegrationConfig.enabled) {
      return { data: [], error: 'Roxou integration disabled' };
    }
    // Reserved for future schema connection
    return { data: [], error: 'Roxou integration not active in production' };
  }

  /**
   * Fetches from REST API (Dry run/Error control)
   */
  public static async fetchFromApi(): Promise<{ data: RoxouEventSignal[]; error: string | null }> {
    if (!defaultRoxouIntegrationConfig.enabled) {
      return { data: [], error: 'Roxou integration disabled' };
    }
    // Reserved for future fetch calls
    return { data: [], error: 'Roxou API connectivity draft placeholder' };
  }

  /**
   * Normalizes arrays of raw event signals into DriverDash standard signals
   */
  public static normalizeToDemandSignals(rawEvents: RoxouEventSignal[]): DemandSignal[] {
    return rawEvents.map(evt => normalizeRoxouEventToDemandSignal(evt));
  }
}
