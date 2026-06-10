/**
 * Peak Rules and Hazard Reports Type Definitions
 * Module: Insights (insights)
 * When to edit: When altering peak hours configurations, demand multipliers, or driver reports schemas.
 */

import { AdminPeakRule, PassengerReport } from '../../types';

export type { AdminPeakRule, PassengerReport };

export interface InsightsContextType {
  peakRules: AdminPeakRule[];
  passengerReports: PassengerReport[];
  addPeakRule: (rule: Omit<AdminPeakRule, 'id'>) => Promise<void>;
  togglePeakRule: (id: string | undefined, indexLocal: number) => Promise<void>;
  addPassengerReport: (report: Omit<PassengerReport, 'user_id' | 'id'>) => Promise<void>;
}
