/**
 * Roxou Demand Index Service
 * Module: Demand (demand)
 * When to edit: When connecting demand readings to real-time maps, external API, or system rules.
 */

import { RoxouDemandStatus } from './demand.types';
import { calculateHourlyEarningsEstimate, getDemandRecommendationText, scoreToDemandLevel } from './demand.calculations';

export const demandService = {
  /**
   * Calculates dynamic scores for active city sectors.
   */
  async fetchDemandSectors(): Promise<RoxouDemandStatus[]> {
    // Simulated active city regions with high-fidelity indices
    const sectors = [
      { region: 'Avenida Paulista Corridor', latitude: -23.5616, longitude: -46.6560, score: 87, surge: 1.8 },
      { region: 'Faria Lima & Itaim Corporate Zone', latitude: -23.5855, longitude: -46.6815, score: 92, surge: 2.1 },
      { region: 'Congonhas Airport Arrival Gate', latitude: -23.6273, longitude: -46.6561, score: 78, surge: 1.5 },
      { region: 'Pinheiros Bar District (Nightlife)', latitude: -23.5615, longitude: -46.6905, score: 65, surge: 1.35 },
      { region: 'Guarulhos Cumbica Terminals', latitude: -23.4356, longitude: -46.4731, score: 94, surge: 2.3 },
      { region: 'Vila Madalena Artistic Hub', latitude: -23.5539, longitude: -46.6918, score: 48, surge: 1.15 },
      { region: 'Ibirapuera Park Entrances', latitude: -23.5874, longitude: -46.6576, score: 28, surge: 1.0 },
      { region: 'Tietê Bus Terminal Surroundings', latitude: -23.5162, longitude: -46.6234, score: 55, surge: 1.25 }
    ];

    return sectors.map(sec => {
      const level = scoreToDemandLevel(sec.score);
      return {
        region: sec.region,
        latitude: sec.latitude,
        longitude: sec.longitude,
        demandIndex: sec.score,
        level,
        hourlyEarningsEstimate: calculateHourlyEarningsEstimate(sec.score, sec.surge),
        surgeMultiplier: sec.surge,
        recommendation: getDemandRecommendationText(level)
      };
    });
  }
};
