/**
 * Pure Mathematical Vehicle Costs & Lifespans Calculations
 * Module: Vehicle (vehicle)
 * When to edit: When altering depreciation patterns, cost-per-km formulations, or component wear forecasting equations.
 */

import { Vehicle, VehicleCostSettings } from './vehicle.types';

/**
 * Calculates the exact dynamic maintenance + fuel cost per km.
 */
export const calculateCostPerKmEstimate = (
  vehicle: Vehicle | null,
  costSettings: VehicleCostSettings | null
): number => {
  if (!vehicle) return 0;

  // 1. Fuel cost per KM
  const kmPerLiter = vehicle.km_per_liter || 10;
  const fuelPrice = costSettings?.fuel_price || 0;
  const fuelCostPerKm = kmPerLiter > 0 ? fuelPrice / kmPerLiter : 0;

  if (!costSettings) return fuelCostPerKm;

  // 2. Amortization and components per KM
  const tireCostPerKm = costSettings.tire_lifespan_km > 0 ? costSettings.tire_cost / costSettings.tire_lifespan_km : 0;
  const oilCostPerKm = costSettings.oil_change_interval_km > 0 ? costSettings.oil_change_cost / costSettings.oil_change_interval_km : 0;
  const brakeCostPerKm = costSettings.brake_interval_km > 0 ? costSettings.brake_cost / costSettings.brake_interval_km : 0;

  // 3. Fixed costs divided by approximate weekly averages (e.g. 1000 KM per week usually)
  const monthlyFixed = calculateMonthlyFixedCost(vehicle, costSettings);
  const fixedCostPerKm = monthlyFixed > 0 ? (monthlyFixed / 4.33) / 1000 : 0;

  return fuelCostPerKm + tireCostPerKm + oilCostPerKm + brakeCostPerKm + fixedCostPerKm;
};

/**
 * Calculates the exact fixed monthly cost based on ownership type.
 */
export const calculateMonthlyFixedCost = (
  vehicle: Vehicle | null,
  costSettings: VehicleCostSettings | null
): number => {
  if (!vehicle) return 0;

  if (vehicle.ownership_type === 'rented') {
    const amount = vehicle.rental_amount || 0;
    const period = vehicle.rental_period || 'weekly';
    return period === 'weekly' ? amount * 4.33 : amount;
  }

  const insuranceMonthly = costSettings ? (costSettings.insurance_yearly || 0) / 12 : 0;
  const ipvaMonthly = costSettings ? (costSettings.ipva_yearly || 0) / 12 : 0;
  const licensingMonthly = costSettings ? (costSettings.licensing_yearly || 0) / 12 : 0;
  const reserveMonthly = costSettings ? (costSettings.emergency_reserve_monthly || 0) : 0;
  const maintenanceMonthly = costSettings ? (costSettings.maintenance_monthly || 0) : 0;

  if (vehicle.ownership_type === 'own') {
    return insuranceMonthly + ipvaMonthly + licensingMonthly + reserveMonthly + maintenanceMonthly;
  }

  if (vehicle.ownership_type === 'financed') {
    const financingMonthly = costSettings ? (costSettings.financing_monthly || 0) : 0;
    return financingMonthly + insuranceMonthly + ipvaMonthly + licensingMonthly + reserveMonthly + maintenanceMonthly;
  }

  return 0;
};
