/**
 * Pure Mathematical Vehicle Costs & Lifespans Calculations
 * Module: Vehicle (vehicle)
 * When to edit: When altering depreciation patterns, cost-per-km formulations, or component wear forecasting equations.
 */

import { Vehicle, VehicleCostSettings } from './vehicle.types';

export const isElectricVehicle = (vehicle: Vehicle | null): boolean => {
  if (!vehicle) return false;
  const ft = vehicle.fuel_type?.toLowerCase() || '';
  return ft === 'electric' || ft === 'elétrico' || ft === 'eletrico';
};

export const calculateElectricityPriceKwh = (vehicle: Vehicle | null): number => {
  if (!vehicle) return 0;
  if (vehicle.charging_type === 'mixed') {
    const priceHome = vehicle.home_electricity_price_kwh || 0;
    const percentHome = vehicle.home_charging_percent ?? 100;
    const pricePublic = vehicle.public_electricity_price_kwh || 0;
    const percentPublic = vehicle.public_charging_percent ?? 0;
    return (priceHome * percentHome / 100) + (pricePublic * percentPublic / 100);
  } else if (vehicle.charging_type === 'public') {
    return vehicle.public_electricity_price_kwh || vehicle.electricity_price_kwh || 0;
  } else {
    return vehicle.home_electricity_price_kwh || vehicle.electricity_price_kwh || 0;
  }
};

/**
 * Calculates the exact dynamic maintenance + fuel cost per km.
 */
export const calculateCostPerKmEstimate = (
  vehicle: Vehicle | null,
  costSettings: VehicleCostSettings | null
): number => {
  if (!vehicle) return 0;

  const ownership = vehicle.ownership_type || 'own';
  console.log(`[VehicleCost] ownership detected: ${ownership}`);
  if (ownership === 'rented') {
    console.log('[VehicleCost] rental cost rules applied');
  } else if (ownership === 'own') {
    console.log('[VehicleCost] own vehicle rules applied');
  } else if (ownership === 'financed') {
    console.log('[VehicleCost] financed vehicle rules applied');
  }

  // Handle Electric Vehicles
  if (isElectricVehicle(vehicle)) {
    const consumptionKwh100 = vehicle.electric_consumption_kwh_100km || 0;
    const priceKwh = calculateElectricityPriceKwh(vehicle);
    const energyCostPerKm = (consumptionKwh100 * priceKwh) / 100;

    if (ownership === 'rented') {
      const monthlyFixed = calculateMonthlyFixedCost(vehicle, costSettings);
      const kmsMensais = vehicle.monthly_km_limit 
        || (vehicle.weekly_km_limit ? vehicle.weekly_km_limit * 4.33 : 4330);
      const fixedCostPerKm = kmsMensais > 0 ? monthlyFixed / kmsMensais : 0;
      return energyCostPerKm + fixedCostPerKm;
    }

    if (!costSettings) return energyCostPerKm;

    const tireCostPerKm = costSettings.tire_lifespan_km > 0 ? costSettings.tire_cost / costSettings.tire_lifespan_km : 0;
    const brakeCostPerKm = costSettings.brake_interval_km > 0 ? costSettings.brake_cost / costSettings.brake_interval_km : 0;
    
    const batteryCostPerKm = (vehicle.battery_life_km && vehicle.battery_life_km > 0) 
      ? (vehicle.battery_replacement_cost || 0) / vehicle.battery_life_km 
      : 0;

    const monthlyFixed = calculateMonthlyFixedCost(vehicle, costSettings);
    const fixedCostPerKm = monthlyFixed > 0 ? (monthlyFixed / 4.33) / 1000 : 0;

    return energyCostPerKm + tireCostPerKm + brakeCostPerKm + batteryCostPerKm + fixedCostPerKm;
  }

  // 1. Fuel cost per KM (Combustion Engines)
  const kmPerLiter = vehicle.km_per_liter || 10;
  const fuelPrice = costSettings?.fuel_price || 0;
  const fuelCostPerKm = kmPerLiter > 0 ? fuelPrice / kmPerLiter : 0;

  // If vehicle is rented, preventive maintenance (tires, oil, brakes) is not included
  if (ownership === 'rented') {
    const monthlyFixed = calculateMonthlyFixedCost(vehicle, costSettings);
    const fixedCostPerKm = monthlyFixed > 0 ? (monthlyFixed / 4.33) / 1000 : 0;
    return fuelCostPerKm + fixedCostPerKm;
  }

  if (!costSettings) return fuelCostPerKm;

  // 2. Amortization and components per KM (for non-rented)
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

  const ownership = vehicle.ownership_type || 'own';
  console.log(`[VehicleCost] ownership detected: ${ownership}`);
  if (ownership === 'rented') {
    console.log('[VehicleCost] rental cost rules applied');
  } else if (ownership === 'own') {
    console.log('[VehicleCost] own vehicle rules applied');
  } else if (ownership === 'financed') {
    console.log('[VehicleCost] financed vehicle rules applied');
  }

  if (ownership === 'rented') {
    const amount = vehicle.rental_amount || 0;
    const period = vehicle.rental_period || 'weekly';
    const baseRentalMonthly = period === 'weekly' ? amount * 4.33 : amount;

    const foodMonthly = (vehicle.rental_food_daily || 0) * 30;
    const damageMonthly = vehicle.rental_damage_monthly || 0;
    const cleaningMonthly = vehicle.rental_cleaning_monthly || 0;

    return baseRentalMonthly + foodMonthly + damageMonthly + cleaningMonthly;
  }

  const insuranceMonthly = costSettings ? (costSettings.insurance_yearly || 0) / 12 : 0;
  const ipvaMonthly = costSettings ? (costSettings.ipva_yearly || 0) / 12 : 0;
  const licensingMonthly = costSettings ? (costSettings.licensing_yearly || 0) / 12 : 0;
  const reserveMonthly = costSettings ? (costSettings.emergency_reserve_monthly || 0) : 0;
  const maintenanceMonthly = costSettings ? (costSettings.maintenance_monthly || 0) : 0;

  if (ownership === 'own') {
    return insuranceMonthly + ipvaMonthly + licensingMonthly + reserveMonthly + maintenanceMonthly;
  }

  if (ownership === 'financed') {
    const financingMonthly = costSettings ? (costSettings.financing_monthly || 0) : 0;
    return financingMonthly + insuranceMonthly + ipvaMonthly + licensingMonthly + reserveMonthly + maintenanceMonthly;
  }

  return 0;
};
