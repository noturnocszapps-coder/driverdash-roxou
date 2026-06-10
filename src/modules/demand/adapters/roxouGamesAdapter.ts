/**
 * Roxou Games Adapter - FASE 5.1
 * Location: src/modules/demand/adapters/roxouGamesAdapter.ts
 * Description: Retrieves sports matches and derby game events and adapts them.
 */

import { DemandSignal } from '../../../types';
import { defaultRoxouIntegrationConfig } from '../roxouIntegration.config';
import { RoxouGameSignal } from '../roxouIntegration.types';
import { normalizeRoxouGameToDemandSignal } from '../roxouSignalNormalizer';

export class RoxouGamesAdapter {
  /**
   * Fetches mock data adhering to the RoxouGameSignal contract
   */
  public static fetchMock(): RoxouGameSignal[] {
    const today = new Date();
    
    // Game starting in 1 hour
    const gameStart = new Date(today.getTime() + 1.0 * 60 * 60 * 1000).toISOString();
    
    return [
      {
        id: 'gam-pr-1',
        title: 'Brasil vs Chile - Eliminatórias da Copa',
        competition: 'Copa do Mundo',
        starts_at: gameStart,
        venue_name: 'Parque do Povo Sports Bar',
        region: 'Parque do Povo',
        latitude: -22.1264,
        longitude: -51.4022,
        importance_level: 'extreme',
        source: 'mock'
      },
      {
        id: 'gam-pr-2',
        title: 'Palmeiras vs Corinthians - Decisão Semifinal',
        competition: 'Campeonato Paulista',
        starts_at: new Date(today.getTime() - 1 * 60 * 60 * 1000).toISOString(), // Ongoing (started 1 hr ago)
        venue_name: 'Rodoviária Arena Chopp',
        region: 'Rodoviária',
        latitude: -22.1158,
        longitude: -51.3853,
        importance_level: 'high',
        source: 'mock'
      }
    ];
  }

  /**
   * Fetches from Supabase (Dry run/Error control)
   */
  public static async fetchFromSupabase(): Promise<{ data: RoxouGameSignal[]; error: string | null }> {
    if (!defaultRoxouIntegrationConfig.enabled) {
      return { data: [], error: 'Roxou integration disabled' };
    }
    return { data: [], error: 'Roxou integration not active in production' };
  }

  /**
   * Fetches from REST API (Dry run/Error control)
   */
  public static async fetchFromApi(): Promise<{ data: RoxouGameSignal[]; error: string | null }> {
    if (!defaultRoxouIntegrationConfig.enabled) {
      return { data: [], error: 'Roxou integration disabled' };
    }
    return { data: [], error: 'Roxou API connectivity draft placeholder' };
  }

  /**
   * Normalizes arrays of raw game signals into DriverDash standard signals
   */
  public static normalizeToDemandSignals(rawGames: RoxouGameSignal[]): DemandSignal[] {
    return rawGames.map(game => normalizeRoxouGameToDemandSignal(game));
  }
}
