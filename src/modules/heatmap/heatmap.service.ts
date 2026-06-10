/**
 * Heatmap Projections Service Routines
 * Module: Heatmap (heatmap)
 * When to edit: When connecting heatmap points to real traffic logs or database integrations.
 */

import { HeatmapRegionMetrics } from './heatmap.types';
import { calculateSurgeMultiplier, hasHeatmapStatus } from './heatmap.calculations';

export const heatmapService = {
  /**
   * Generates or fetches active hotspots for prime cities.
   */
  async fetchHotspots(): Promise<HeatmapRegionMetrics[]> {
    // Standard mock regions representing high density zones in the Presidente Prudente municipality
    const mockRegions = [
      { id: 'h-1', regionName: 'Centro', latitude: -22.1225, longitude: -51.3883, passengerDensity: 78, intensity: 0.75 },
      { id: 'h-2', regionName: 'Rodoviária', latitude: -22.1158, longitude: -51.3853, passengerDensity: 82, intensity: 0.85 },
      { id: 'h-3', regionName: 'Aeroporto', latitude: -22.1764, longitude: -51.4239, passengerDensity: 65, intensity: 0.60 },
      { id: 'h-4', regionName: 'Prudenshopping', latitude: -22.1147, longitude: -51.4068, passengerDensity: 92, intensity: 0.94 },
      { id: 'h-5', regionName: 'UNOESTE', latitude: -22.1192, longitude: -51.4428, passengerDensity: 87, intensity: 0.88 },
      { id: 'h-6', regionName: 'Toledo', latitude: -22.1256, longitude: -51.3992, passengerDensity: 55, intensity: 0.52 },
      { id: 'h-7', regionName: 'UNESP', latitude: -22.1206, longitude: -51.4092, passengerDensity: 48, intensity: 0.45 },
      { id: 'h-8', regionName: 'Parque do Povo', latitude: -22.1264, longitude: -51.4022, passengerDensity: 70, intensity: 0.72 },
      { id: 'h-9', regionName: 'Matarazzo', latitude: -22.1144, longitude: -51.3811, passengerDensity: 35, intensity: 0.32 },
      { id: 'h-10', regionName: 'Expo Prudente', latitude: -22.1642, longitude: -51.3482, passengerDensity: 94, intensity: 0.96 }
    ];

    return mockRegions.map(r => ({
      id: r.id,
      regionName: r.regionName,
      latitude: r.latitude,
      longitude: r.longitude,
      passengerDensity: r.passengerDensity,
      intensity: r.intensity,
      averageFareMultiplier: calculateSurgeMultiplier(r.passengerDensity),
      status: hasHeatmapStatus(r.intensity)
    }));
  }
};
