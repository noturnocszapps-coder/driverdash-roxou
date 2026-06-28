import { describe, test, expect, vi } from 'vitest';
import { DriverInsightsService } from '../DriverInsightsService';
import { ScoreCalculationService } from '../ScoreCalculationService';
import { DemandPredictionService } from '../DemandPredictionService';
import { MaintenanceService } from '../MaintenanceService';
import { FuelRecommendationService } from '../FuelRecommendationService';
import { PlatformComparisonService } from '../PlatformComparisonService';
import { SmartGoalsService } from '../SmartGoalsService';

import { Earning, Expense, Vehicle, FinancialGoal } from '../../../types';

describe('DriverDash Roxou V3 Core Services Tests', () => {

  // ==========================================
  // 1. DRIVER INSIGHTS SERVICE
  // ==========================================
  describe('DriverInsightsService', () => {
    const mockVehicle: Vehicle = {
      user_id: 'user1',
      brand: 'Chevrolet',
      model: 'Onix',
      year: 2021,
      fuel_type: 'Flex',
      km_per_liter: 11.5,
      ownership_type: 'rented',
      rental_amount: 560
    };

    const mockGoal: FinancialGoal = {
      user_id: 'user1',
      monthly_goal: 3000,
      weekly_goal: 750,
      daily_goal: 150
    };

    test('normal scenario diagnostic returns expected structure', () => {
      const result = DriverInsightsService.analyzeDailyOutlook([], [], mockVehicle, 0.74, mockGoal);
      expect(result).toHaveProperty('shouldWorkToday');
      expect(result).toHaveProperty('shouldWorkReason');
      expect(result).toHaveProperty('shouldActivatePass');
      expect(result).toHaveProperty('passTypeRecommendation');
      expect(result).toHaveProperty('passReason');
      expect(result).toHaveProperty('bestHourToStart');
      expect(result).toHaveProperty('bestHourToStop');
      expect(result).toHaveProperty('bestRegionToWork');
      expect(result).toHaveProperty('expectedNetProfit');
      expect(result.expectedNetProfit).toBeGreaterThanOrEqual(0);
    });

    test('handles negative/zero costPerKm and invalid vehicle rental values safely', () => {
      const badVehicle: Vehicle = {
        ...mockVehicle,
        rental_amount: -100 // negative rental cost
      };

      const resultWithNegative = DriverInsightsService.analyzeDailyOutlook([], [], badVehicle, -0.5, null);
      expect(resultWithNegative.expectedNetProfit).toBeGreaterThanOrEqual(0);

      const resultWithZero = DriverInsightsService.analyzeDailyOutlook([], [], null, 0, null);
      expect(resultWithZero.expectedNetProfit).toBeGreaterThanOrEqual(0);
    });
  });

  // ==========================================
  // 2. SCORE CALCULATION SERVICE
  // ==========================================
  describe('ScoreCalculationService', () => {
    const mockEarnings: Earning[] = [
      {
        user_id: 'u1',
        date: '2026-06-25',
        platform: 'uber',
        gross_amount: 350,
        total_km: 150,
        passenger_km: 120,
        empty_km: 30,
        online_minutes: 480,
        waiting_minutes: 45,
        rides_count: 15
      }
    ];

    test('normal score calculation returns consistent report', () => {
      const result = ScoreCalculationService.calculateDriverScore(mockEarnings, [], 0.74);
      expect(result.score).toBeGreaterThanOrEqual(15);
      expect(result.score).toBeLessThanOrEqual(100);
      expect(typeof result.level).toBe('string');
      expect(result.recommendations.length).toBeGreaterThan(0);
      expect(result.breakdown.profitPerHour).toBeCloseTo(43.75, 1);
    });

    test('empty earnings fallback triggers expected defaults and does not divide by zero', () => {
      const result = ScoreCalculationService.calculateDriverScore([], [], 0.74);
      expect(result.score).toBeDefined();
      expect(result.breakdown.profitPerHour).toBe(32.5);
      expect(result.breakdown.profitPerKm).toBe(2.10);
      expect(result.breakdown.emptyKmPercent).toBe(18);
    });

    test('handles anomalous negative data inputs safely', () => {
      const negativeEarnings: Earning[] = [
        {
          user_id: 'u1',
          date: '2026-06-25',
          platform: 'uber',
          gross_amount: -350, // negative gross
          total_km: -100, // negative km
          passenger_km: -80,
          empty_km: -20,
          online_minutes: -300,
          waiting_minutes: -10,
          rides_count: -5
        }
      ];
      const result = ScoreCalculationService.calculateDriverScore(negativeEarnings, [], -0.5);
      expect(result.score).toBeGreaterThanOrEqual(15);
      expect(result.breakdown.profitPerHour).toBeGreaterThanOrEqual(0);
      expect(result.breakdown.profitPerKm).toBeGreaterThanOrEqual(0);
    });
  });

  // ==========================================
  // 3. DEMAND PREDICTION SERVICE
  // ==========================================
  describe('DemandPredictionService', () => {
    test('retrieves weekly schedule with all required properties', () => {
      const schedule = DemandPredictionService.getWeeklySchedule(0.74);
      expect(schedule.length).toBe(7);
      schedule.forEach(day => {
        expect(day).toHaveProperty('dayName');
        expect(day).toHaveProperty('demandProbability');
        expect(day).toHaveProperty('expectedProfit');
        expect(day).toHaveProperty('bestHours');
        expect(day).toHaveProperty('shouldUsePass');
        expect(day).toHaveProperty('recommendedHours');
      });
    });

    test('retrieves SP demand hotspots safely', () => {
      const hotspots = DemandPredictionService.getDemandHotspots();
      expect(hotspots.length).toBeGreaterThan(0);
      hotspots.forEach(hs => {
        expect(hs).toHaveProperty('id');
        expect(hs).toHaveProperty('name');
        expect(hs).toHaveProperty('latitude');
        expect(hs).toHaveProperty('longitude');
        expect(hs).toHaveProperty('weight');
        expect(hs).toHaveProperty('type');
        expect(hs).toHaveProperty('avgTicket');
      });
    });

    test('handles negative costPerKm parameter gracefully', () => {
      const schedule = DemandPredictionService.getWeeklySchedule(-1.5);
      expect(schedule).toBeInstanceOf(Array);
      expect(schedule.length).toBe(7);
    });
  });

  // ==========================================
  // 4. MAINTENANCE SERVICE
  // ==========================================
  describe('MaintenanceService', () => {
    const flexVehicle: Vehicle = {
      user_id: 'u1',
      brand: 'Fiat',
      model: 'Argo',
      year: 2022,
      fuel_type: 'Flex',
      km_per_liter: 12,
      ownership_type: 'own'
    };

    const electricVehicle: Vehicle = {
      user_id: 'u1',
      brand: 'BYD',
      model: 'Dolphin',
      year: 2023,
      fuel_type: 'Elétrico',
      km_per_liter: 0,
      ownership_type: 'own'
    };

    test('correctly maps combustion vehicle maintenance items', () => {
      const items = MaintenanceService.getMaintenanceOutlook(flexVehicle, 35000);
      expect(items.length).toBe(5);
      expect(items.find(i => i.name.includes('Óleo'))).toBeDefined();
    });

    test('correctly maps electric vehicle maintenance items', () => {
      const items = MaintenanceService.getMaintenanceOutlook(electricVehicle, 35000);
      expect(items.length).toBe(4);
      expect(items.find(i => i.name.includes('Pneus'))).toBeDefined();
    });

    test('safely falls back for zero, null or negative odomenter readings', () => {
      const fallbackItems = MaintenanceService.getMaintenanceOutlook(null, -5000);
      expect(fallbackItems.length).toBe(5);
      expect(fallbackItems[0].currentKm).toBeGreaterThanOrEqual(0);
    });
  });

  // ==========================================
  // 5. FUEL RECOMMENDATION SERVICE
  // ==========================================
  describe('FuelRecommendationService', () => {
    test('prefers ETANOL when below 70% cost threshold', () => {
      const result = FuelRecommendationService.calculateFlexCost(3.50, 5.50); // 3.50 / 5.50 = ~63.6%
      expect(result.bestOption).toBe('ETANOL');
      expect(result.savingPerLiterPercent).toBeGreaterThan(0);
    });

    test('prefers GASOLINA when above 70% cost threshold', () => {
      const result = FuelRecommendationService.calculateFlexCost(4.50, 5.50); // 4.50 / 5.50 = ~81.8%
      expect(result.bestOption).toBe('GASOLINA');
    });

    test('handles division by zero and negative inputs safely', () => {
      const zeroResult = FuelRecommendationService.calculateFlexCost(3.50, 0);
      expect(zeroResult.bestOption).toBe('GASOLINA');
      expect(zeroResult.ratio).toBe(0);

      const negativeResult = FuelRecommendationService.calculateFlexCost(-3.50, -5.50);
      expect(negativeResult.ratio).toBeGreaterThanOrEqual(0);
    });

    test('calculates electric vehicle plans consistently', () => {
      const mockEV: Vehicle = {
        user_id: 'u1',
        brand: 'BYD',
        model: 'Dolphin',
        year: 2024,
        fuel_type: 'Elétrico',
        km_per_liter: 0,
        ownership_type: 'own',
        electric_consumption_kwh_100km: 15,
        home_electricity_price_kwh: 0.70,
        public_electricity_price_kwh: 2.00
      };

      const plan = FuelRecommendationService.getElectricChargingPlan(mockEV);
      expect(plan.comparison.residential.costPer100km).toBe(10.5); // 15 * 0.70
      expect(plan).toHaveProperty('bestTimeSlot');
    });
  });

  // ==========================================
  // 6. PLATFORM COMPARISON SERVICE
  // ==========================================
  describe('PlatformComparisonService', () => {
    test('calculates platform breakdown metrics with valid structures', () => {
      const metrics = PlatformComparisonService.calculatePlatformMetrics(8, 160, 0.74);
      expect(metrics.length).toBe(5);
      expect(metrics[0]).toHaveProperty('name');
      expect(metrics[0]).toHaveProperty('gross');
      expect(metrics[0]).toHaveProperty('net');
      expect(metrics[0]).toHaveProperty('kmCost');
      expect(metrics[0]).toHaveProperty('roi');
    });

    test('guards against division by zero with zero hours/kms', () => {
      const zeroMetrics = PlatformComparisonService.calculatePlatformMetrics(0, 0, 0.74);
      expect(zeroMetrics.length).toBe(5);
      zeroMetrics.forEach(m => {
        expect(m.profitPerHour).toBeDefined();
        expect(m.profitPerKm).toBeDefined();
        expect(isFinite(m.profitPerHour)).toBe(true);
        expect(isFinite(m.profitPerKm)).toBe(true);
      });
    });

    test('guards against negative inputs', () => {
      const negMetrics = PlatformComparisonService.calculatePlatformMetrics(-8, -150, -0.74);
      expect(negMetrics.length).toBe(5);
      negMetrics.forEach(m => {
        expect(m.gross).toBeGreaterThanOrEqual(0);
        expect(m.net).toBeDefined();
      });
    });
  });

  // ==========================================
  // 7. SMART GOALS SERVICE
  // ==========================================
  describe('SmartGoalsService', () => {
    test('projects reverse budget targets correctly', () => {
      const result = SmartGoalsService.calculateGoalsProjection(3000, 'month', 0.74);
      expect(result.netMonth).toBe(3000);
      expect(result.grossDay).toBeGreaterThan(0);
      expect(result.hours).toBeGreaterThan(0);
      expect(result.rides).toBeGreaterThan(0);
      expect(result.profitPerHour).toBeGreaterThan(0);
    });

    test('handles zero, extreme or negative goals defensively', () => {
      const resultZero = SmartGoalsService.calculateGoalsProjection(0, 'day', 0.74);
      expect(resultZero.netDay).toBe(0);
      expect(resultZero.hours).toBeGreaterThanOrEqual(0);

      const resultNeg = SmartGoalsService.calculateGoalsProjection(-500, 'week', -0.5);
      expect(resultNeg.netWeek).toBeGreaterThanOrEqual(0);
      expect(resultNeg.hours).toBeGreaterThanOrEqual(0);
    });
  });

});
