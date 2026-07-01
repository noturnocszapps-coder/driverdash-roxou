/**
 * DriverDash Roxou - Predictive Intelligence Types (FASE 3)
 * Location: src/modules/predictive-intelligence/predictive.types.ts
 */

export interface NeighborhoodReturnIndex {
  neighborhood: string;
  emptyReturnChance: number; // 0% to 100% chance of returning empty
  avgTimeToNextRideMin: number; // Average idle time in minutes before getting next ride
  returnScore: number; // 0 to 100 rating
}

export interface NextRidePrediction {
  chanceNext15Min: number; // 0% to 100%
  bestNearbyRegion: string; // recommended next zone
  confidenceLevel: 'Alta' | 'Média' | 'Baixa';
  justification: string;
}

export interface DailyForecast {
  predictedGross: number; // R$
  predictedNetProfit: number; // R$
  predictedKm: number;
  predictedRidesCount: number;
  hoursToReachGoal: number; // hours estimated to hit daily goal
  confidenceScore: number; // 0 to 100
}

export interface HistoricalComparisonItem {
  label: string; // "Hoje x Ontem", "Hoje x Últimos 7 dias", etc.
  currentValue: number;
  comparisonValue: number;
  percentageDiff: number; // positive or negative
  status: 'better' | 'worse' | 'neutral';
}

export interface PredictiveOfferInput {
  fare: number;
  distanceKm: number;
  durationMin: number;
  pickupNeighborhood: string;
  destinationNeighborhood: string;
  platform?: string;
  category?: string;
}

export interface PredictiveOfferScoreResult {
  score: number; // 0 to 100
  rating: 'Excelente' | 'Boa' | 'Aceitável' | 'Somente se retornar' | 'Ruim';
  mainReason: string;
  positiveFactors: string[];
  negativeFactors: string[];
  confidenceLevel: number; // 0% to 100%
  estimatedNetProfit: number;
  costPerKm: number;
}
