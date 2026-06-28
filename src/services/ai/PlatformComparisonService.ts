import { PlatformMetrics } from './base.types';
import { safeNumber, safeDivide, normalizePositiveNumber } from '../../utils/number';
import { Logger } from '../logger';

const logger = new Logger('PlatformComparisonService');

export class PlatformComparisonService {
  /**
   * Módulo 9 — Comparador de Plataformas
   */
  public static calculatePlatformMetrics(
    hoursWorked: number,
    kmDriven: number,
    costPerKm: number
  ): PlatformMetrics[] {
    logger.debug('Running comparative analytics across transportation platforms');

    if (hoursWorked < 0 || kmDriven < 0 || costPerKm < 0) {
      logger.warn('Received negative arguments for platform metrics comparison. Normalizing.', { hoursWorked, kmDriven, costPerKm });
    }

    const safeHours = normalizePositiveNumber(hoursWorked, 8);
    const safeKm = normalizePositiveNumber(kmDriven, 150);
    const safeCost = normalizePositiveNumber(costPerKm, 0.74);

    const platforms = [
      { name: 'Uber Premium', comission: 0.18, bonusRate: 1.10, avgKm: 1.0, activePass: true },
      { name: '99 Pop', comission: 0.22, bonusRate: 1.0, avgKm: 0.95, activePass: false },
      { name: 'InDrive', comission: 0.09, bonusRate: 0.90, avgKm: 1.15, activePass: false },
      { name: 'Particular / Executivo', comission: 0.00, bonusRate: 1.45, avgKm: 1.4, activePass: false },
      { name: 'Reserva Roxou VIP', comission: 0.05, bonusRate: 1.60, avgKm: 1.6, activePass: false }
    ];

    const baseGrossRate = 42; // R$/hour base
    const totalGrossEarnings = baseGrossRate * safeHours;

    return platforms.map(p => {
      const gross = totalGrossEarnings * p.bonusRate;
      const comissionPaid = gross * p.comission;
      const vehicleCost = safeKm * safeCost;
      const net = gross - comissionPaid - vehicleCost;
      
      const profitPerHourVal = safeDivide(net, safeHours, 0);
      const profitPerKmVal = safeDivide(net, safeKm, 0);
      const roiVal = vehicleCost > 0 ? safeDivide(gross * 100, vehicleCost, 150) : 150;

      return {
        name: p.name,
        gross,
        net,
        kmCost: vehicleCost,
        roi: roiVal,
        profitPerHour: profitPerHourVal,
        profitPerKm: profitPerKmVal
      };
    });
  }
}
