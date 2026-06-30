export type RegionSafetyRisk = 'low' | 'medium' | 'high';
export type DemandLevel = 'alta' | 'media' | 'baixa';
export type TrafficStatus = 'fluido' | 'moderado' | 'intenso';
export type OpportunityStatus = 'good' | 'attention' | 'risk';

export interface RegionDemandData {
  name: string;
  score: number; // 0 to 100
  demandLevel: DemandLevel;
  rideChance: string; // e.g., "95%"
  returnChance: string; // e.g., "80%"
  emptyRunRisk: OpportunityStatus; // 'good' = low risk, 'attention' = medium, 'risk' = high risk
  bestTime: string;
  tip: string;
  isPeripheral: boolean;
}

export interface DemandRecommendation {
  bestRegion: string;
  score: number;
  reason: string;
  practicalTip: string;
}

export interface UpcomingEvent {
  id: string;
  title: string;
  category: 'show' | 'game' | 'party' | 'flight' | 'bus' | 'weather' | 'roxou';
  location: string;
  time: string;
  expectedDemand: 'alta' | 'media';
  description: string;
}
