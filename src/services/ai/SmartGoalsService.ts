import { GoalProjection } from './base.types';
import { safeNumber, safeDivide, normalizePositiveNumber } from '../../utils/number';
import { Logger } from '../logger';

const logger = new Logger('SmartGoalsService');

export class SmartGoalsService {
  /**
   * Módulo 3 — Metas Inteligentes
   */
  public static calculateGoalsProjection(
    targetNetInput: number,
    targetPeriod: 'day' | 'week' | 'month',
    currentCostPerKm: number
  ): GoalProjection {
    logger.debug('Calculating reverse budget target projections');

    if (targetNetInput < 0 || currentCostPerKm < 0) {
      logger.warn('Received negative targets/costs for goals calculation. Normalizing.', { targetNetInput, currentCostPerKm });
    }

    const safeTargetNet = normalizePositiveNumber(targetNetInput, 3000);
    const safeCost = normalizePositiveNumber(currentCostPerKm, 0.74);

    // Standard periods converter to daily equivalent net target
    let dailyNetEquivalent = 100;
    if (targetPeriod === 'day') {
      dailyNetEquivalent = safeTargetNet;
    } else if (targetPeriod === 'week') {
      dailyNetEquivalent = safeDivide(safeTargetNet, 6, 100);
    } else if (targetPeriod === 'month') {
      dailyNetEquivalent = safeDivide(safeTargetNet, 26, 100);
    }

    const typicalWorkingDaysYear = 312;
    const standardCommissionPercent = 0.20; // 20%
    
    // Revenue required daily: Net Goal + Expenses (Vehicle cost per km * expected daily km)
    const expectedDailyKm = 150;
    const dailyExpenses = expectedDailyKm * safeCost;
    const divisor = 1 - standardCommissionPercent;
    
    const requiredRevenueDaily = safeDivide(dailyNetEquivalent + dailyExpenses, divisor, 0);
    const requiredHours = safeDivide(requiredRevenueDaily, 45, 0); // average R$45 gross per hour
    const expectedRides = safeDivide(requiredRevenueDaily, 18, 0); // average R$18 ticket per ride

    return {
      netDay: dailyNetEquivalent,
      netWeek: dailyNetEquivalent * 6,
      netMonth: dailyNetEquivalent * 26,
      netYear: dailyNetEquivalent * typicalWorkingDaysYear,
      
      grossDay: requiredRevenueDaily,
      grossWeek: requiredRevenueDaily * 6,
      grossMonth: requiredRevenueDaily * 26,
      grossYear: requiredRevenueDaily * typicalWorkingDaysYear,
      
      hours: requiredHours,
      km: expectedDailyKm,
      rides: expectedRides,
      profitPerHour: safeDivide(dailyNetEquivalent, requiredHours, 0)
    };
  }
}
