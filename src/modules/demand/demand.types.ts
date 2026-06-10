/**
 * Roxou Smart Demand Index Type Definitions
 * Module: Demand (demand)
 * When to edit: When altering dynamic surge formulas, multiplier tiers, or demand indicators.
 */

import { DemandSignal } from '../../types';
import { HeatmapRegionMetrics } from '../heatmap/heatmap.types';

export type RoxouDemandLevel = 'low' | 'medium' | 'high' | 'extreme';

export interface RoxouDemandStatus {
  region: string;
  latitude: number;
  longitude: number;
  demandIndex: number; // Score from 0 to 100
  level: RoxouDemandLevel;
  hourlyEarningsEstimate: number; // estimated dynamic hourly yield in BRL
  recommendation: string; // e.g. "Alta probabilidade de dinâmica, ligar aplicativo!"
  surgeMultiplier: number; // e.g. 1.3
}

export interface DemandContextType {
  demandStatus: RoxouDemandStatus[];
  loadingDemand: boolean;
  refetchDemand: () => Promise<void>;
  globalDemandScore: number; // Composite aggregate score 0 - 100
  
  // FASE 5.0 LIVE MANAGEMENT
  demandSignals: DemandSignal[];
  heatmapZones: HeatmapRegionMetrics[];
  addDemandSignal: (signal: Omit<DemandSignal, 'id' | 'is_active'>) => Promise<void>;
  deleteDemandSignal: (id: string) => Promise<void>;
  toggleDemandSignal: (id: string) => Promise<void>;
  updateHeatmapZone: (id: string, passengerDensity: number, intensity: number) => Promise<void>;
}

