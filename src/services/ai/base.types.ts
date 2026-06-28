import { Earning, Expense, Vehicle, FinancialGoal } from '../../types';

export type DataSourceType = 'real' | 'historical' | 'configuration' | 'simulated';

export interface DriverDailyDiagnostic {
  shouldWorkToday: boolean;
  shouldWorkReason: string;
  shouldActivatePass: boolean;
  passTypeRecommendation: '24 horas' | '72 horas' | 'Por ganhos' | 'Não ativar';
  passReason: string;
  bestHourToStart: string;
  bestHourToStop: string;
  bestRegionToWork: string;
  expectedNetProfit: number;
}

export interface DriverScoreReport {
  score: number; // 0-100
  level: 'Bronze' | 'Prata' | 'Ouro' | 'Diamante' | 'Elite';
  breakdown: {
    profitPerHour: number;
    profitPerKm: number;
    idleTimePercent: number;
    emptyKmPercent: number;
    acceptanceRate: number;
    cancellationRate: number;
    passSavings: number;
    roi: number;
    costPerKm: number;
    rideCount: number;
  };
  recommendations: string[];
}

export interface WeeklyPlanDay {
  dayName: string;
  demandProbability: number; // 0-100
  expectedProfit: number;
  bestHours: string;
  shouldUsePass: boolean;
  recommendedHours: number;
}

export interface DemandHotspot {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  weight: number; // 1-10 intensity
  type: 'airport' | 'bar_club' | 'event' | 'restaurant' | 'hotel' | 'transit_hub';
  avgTicket: number;
  description: string;
}

export interface MaintenanceItem {
  id: string;
  name: string;
  currentKm: number;
  intervalKm: number;
  remainingKm: number;
  remainingDays: number;
  estimatedCost: number;
  status: 'critical' | 'warning' | 'good';
  description: string;
}

export interface FlexCalculation {
  ethanolPrice: number;
  gasolinePrice: number;
  ratio: number; // ethanol / gasoline
  bestOption: 'GASOLINA' | 'ETANOL';
  savingPerLiterPercent: number;
  reason: string;
}

export interface ElectricChargePlan {
  bestTimeSlot: string;
  comparison: {
    residential: { costPer100km: number; chargeTimeHours: number; description: string };
    publicSlow: { costPer100km: number; chargeTimeHours: number; description: string };
    publicFast: { costPer100km: number; chargeTimeHours: number; description: string };
  };
  recommendation: string;
}

export interface PlatformMetrics {
  name: string;
  gross: number;
  net: number;
  kmCost: number;
  roi: number;
  profitPerHour: number;
  profitPerKm: number;
}

export interface AIRecommendation {
  text: string;
  type: string;
}

export interface GoalProjection {
  netDay: number;
  netWeek: number;
  netMonth: number;
  netYear: number;
  grossDay: number;
  grossWeek: number;
  grossMonth: number;
  grossYear: number;
  hours: number;
  km: number;
  rides: number;
  profitPerHour: number;
}
