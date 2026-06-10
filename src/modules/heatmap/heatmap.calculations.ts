/**
 * Pure Mathematical Heatmap & Demand Density Calculations
 * Module: Heatmap (heatmap)
 * When to edit: When altering surge categories, heat thresholds, or multiplier algorithms.
 */

import { HeatmapRegionMetrics } from './heatmap.types';

/**
 * Calculates a dynamic surge multiplier based on passenger densities.
 */
export const calculateSurgeMultiplier = (passengerDensity: number): number => {
  if (passengerDensity >= 90) return 2.2;
  if (passengerDensity >= 70) return 1.8;
  if (passengerDensity >= 50) return 1.4;
  if (passengerDensity >= 25) return 1.15;
  return 1.0; // standard fare
};

/**
 * Maps a numerical intensity index to a literal heatmap status group.
 */
export const hasHeatmapStatus = (intensity: number): HeatmapRegionMetrics['status'] => {
  if (intensity >= 0.85) return 'extreme';
  if (intensity >= 0.65) return 'hot';
  if (intensity >= 0.45) return 'warm';
  if (intensity >= 0.2) return 'normal';
  return 'cold';
};
