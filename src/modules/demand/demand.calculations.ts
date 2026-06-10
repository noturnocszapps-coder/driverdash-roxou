/**
 * Pure Mathematical Roxou demand index calculations
 * Module: Demand (demand)
 * When to edit: When altering dynamic recommendation texts or dynamic hourly earnings estimates.
 */

import { RoxouDemandLevel } from './demand.types';
import { AdminPeakRule, DemandSignal } from '../../types';
import { HeatmapRegionMetrics } from '../heatmap/heatmap.types';

/**
 * Maps a demand index score (0-100) to demand level based on the strict requirements:
 * 0-30 = Baixa (low)
 * 31-60 = Média (medium)
 * 61-80 = Alta (high)
 * 81+ = Extrema (extreme)
 */
export const scoreToDemandLevel = (score: number): RoxouDemandLevel => {
  if (score >= 81) return 'extreme';
  if (score >= 61) return 'high';
  if (score >= 31) return 'medium';
  return 'low';
};

/**
 * Maps a demand level to helper text recommendation.
 */
export const getDemandRecommendationText = (level: RoxouDemandLevel): string => {
  switch (level) {
    case 'extreme':
      return 'Fogo no mapa! Demanda absurdamente alta. Vá até lá e aproveite os maiores dinâmicos!';
    case 'high':
      return 'Muito boa probabilidade de taxas dinâmicas. Direcione-se para a região.';
    case 'medium':
      return 'Demanda estável. Bom momento para fazer corridas intermediárias e manter o fluxo.';
    case 'low':
    default:
      return 'Movimentação fria. Prefira aguardar em bolsões ou economizar combustível.';
  }
};

/**
 * Calculates estimated dynamic yield hourly BRL.
 */
export const calculateHourlyEarningsEstimate = (score: number, surgeMultiplier: number): number => {
  const baseRate = 22.5; // standard basic hourly gross
  return baseRate * (1 + score / 100) * surgeMultiplier;
};

/**
 * Calculates the final Demand Score for a zone based on:
 * - base heatmap zone metrics
 * - active demand signals
 * - active admin peak rules
 */
export const calculateDemandScoreForZone = (
  zone: HeatmapRegionMetrics,
  signals: DemandSignal[],
  peakRules: AdminPeakRule[]
): { score: number; surgeMultiplier: number } => {
  // 1. Initial base score is the passenger density of the heatmap zone (0 to 100)
  let baseScore = zone.passengerDensity;

  // 2. Add boosts from active demand signals matching this zone
  let signalBoost = 0;
  const activeSignals = signals.filter(
    s => s.is_active && s.region.toLowerCase().trim() === zone.regionName.toLowerCase().trim()
  );

  activeSignals.forEach(s => {
    // Each signal's weight contributes directly to the boost (e.g. weight * 15)
    signalBoost += Math.round(Number(s.weight) * 15);
  });

  // 3. Add boosts from active peak rules matching this zone
  let peakBoost = 0;
  const activePeaks = peakRules.filter(
    p => p.is_active && p.region.toLowerCase().trim() === zone.regionName.toLowerCase().trim()
  );

  activePeaks.forEach(p => {
    if (p.demand_level === 'low') {
      peakBoost += 5;
    } else if (p.demand_level === 'medium') {
      peakBoost += 15;
    } else if (p.demand_level === 'high') {
      peakBoost += 25;
    } else if (p.demand_level === 'extreme') {
      peakBoost += 35;
    }
  });

  // 4. Combine and clamp between 0 and 100
  const finalScore = Math.min(100, Math.max(0, Math.round(baseScore + signalBoost + peakBoost)));

  // Calculate dynamic surge multiplier relative to the consolidated score
  let surgeMultiplier = 1.0;
  if (finalScore >= 81) {
    surgeMultiplier = 2.4; // Extreme multiplier
  } else if (finalScore >= 61) {
    surgeMultiplier = 1.8; // High multiplier
  } else if (finalScore >= 31) {
    surgeMultiplier = 1.35; // Medium multiplier
  } else {
    surgeMultiplier = 1.0; // Standard fare
  }

  return {
    score: finalScore,
    surgeMultiplier
  };
};

