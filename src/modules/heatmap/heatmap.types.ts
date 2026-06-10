/**
 * Heatmap Hotspot Type Definitions
 * Module: Heatmap (heatmap)
 * When to edit: When altering heatmap projection points, color weights, or region metrics.
 */

import { HeatmapPoint } from '../maps/map.types';

export type { HeatmapPoint };

export interface HeatmapRegionMetrics {
  id: string;
  regionName: string;
  latitude: number;
  longitude: number;
  intensity: number; // 0.0 to 1.0 multiplier
  passengerDensity: number; // raw value
  averageFareMultiplier: number; // dynamic surge value (e.g. 1.4x)
  status: 'cold' | 'normal' | 'warm' | 'hot' | 'extreme';
}
