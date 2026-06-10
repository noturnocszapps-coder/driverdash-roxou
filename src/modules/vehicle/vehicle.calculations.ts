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
  const yearlyFixed = (costSettings.insurance_yearly || 0) + (costSettings.ipva_yearly || 0) + (costSettings.licensing_yearly || 0);
  const fixedCostPerKm = yearlyFixed > 0 ? (yearlyFixed / 52) / 1000 : 0;

  return fuelCostPerKm + tireCostPerKm + oilCostPerKm + brakeCostPerKm + fixedCostPerKm;
};
