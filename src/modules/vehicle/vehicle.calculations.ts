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

export interface VehicleCostBreakdown {
  ownershipType: 'own' | 'financed' | 'rented';
  isElectric: boolean;
  fuelPerKm: number;
  tirePerKm: number;
  oilPerKm: number;
  brakePerKm: number;
  insurancePerKm: number;
  ipvaPerKm: number;
  licensingPerKm: number;
  depreciationPerKm: number;
  maintenanceReservePerKm: number;
  financingPerKm: number;
  rentalPerKm: number;
  
  // rented specific or general operational
  washPerKm: number;
  cleaningPerKm: number;
  damagePerKm: number;
  tollPerKm: number;
  foodPerKm: number;
  otherOperationalPerKm: number;
  
  totalCostPerKm: number;
}

/**
 * Centrally calculates the exact costs based strictly on the vehicle's ownership_type.
 * This is the SINGLE SOURCE OF TRUTH for the entire application.
 */
export const calculateCostBreakdown = (
  vehicle: Vehicle | null,
  costSettings: VehicleCostSettings | null,
  estimatedMonthlyKmInput?: number
): VehicleCostBreakdown => {
  const ownershipType = vehicle?.ownership_type || 'own';
  const isElectric = isElectricVehicle(vehicle);
  
  const estimatedMonthlyKm = estimatedMonthlyKmInput || vehicle?.monthly_km_limit || 2500;
  // If estimatedMonthlyKm is 0 or negative, default to 2500 to avoid division by zero
  const monthlyKm = estimatedMonthlyKm > 0 ? estimatedMonthlyKm : 2500;
  const weeklyKm = monthlyKm / 4.33;
  const dailyKm = monthlyKm / 26; // assume 26 active driving days per month

  let fuelPerKm = 0;
  if (isElectric) {
    const consumptionKwh100 = vehicle?.electric_consumption_kwh_100km || 0;
    const priceKwh = calculateElectricityPriceKwh(vehicle);
    fuelPerKm = (consumptionKwh100 * priceKwh) / 100;
  } else {
    const kmPerLiter = vehicle?.km_per_liter || 10;
    const fuelPrice = costSettings?.fuel_price || 0;
    fuelPerKm = kmPerLiter > 0 ? fuelPrice / kmPerLiter : 0;
  }

  // Initialize all to 0
  let tirePerKm = 0;
  let oilPerKm = 0;
  let brakePerKm = 0;
  let insurancePerKm = 0;
  let ipvaPerKm = 0;
  let licensingPerKm = 0;
  let depreciationPerKm = 0;
  let maintenanceReservePerKm = 0;
  let financingPerKm = 0;
  let rentalPerKm = 0;
  
  let washPerKm = 0;
  let cleaningPerKm = 0;
  let damagePerKm = 0;
  let tollPerKm = 0;
  let foodPerKm = 0;
  let otherOperationalPerKm = 0;

  if (ownershipType === 'own' || ownershipType === 'financed') {
    // 1. Own & Financed Calculations
    if (costSettings) {
      tirePerKm = costSettings.tire_lifespan_km > 0 ? (costSettings.tire_cost / costSettings.tire_lifespan_km) : 0;
      
      if (!isElectric) {
        oilPerKm = costSettings.oil_change_interval_km > 0 ? (costSettings.oil_change_cost / costSettings.oil_change_interval_km) : 0;
      }
      
      brakePerKm = costSettings.brake_interval_km > 0 ? (costSettings.brake_cost / costSettings.brake_interval_km) : 0;
      
      insurancePerKm = monthlyKm > 0 ? ((costSettings.insurance_yearly || 0) / 12) / monthlyKm : 0;
      ipvaPerKm = monthlyKm > 0 ? ((costSettings.ipva_yearly || 0) / 12) / monthlyKm : 0;
      licensingPerKm = monthlyKm > 0 ? ((costSettings.licensing_yearly || 0) / 12) / monthlyKm : 0;
      
      const reserve = costSettings.emergency_reserve_monthly || 0;
      const maintenance = costSettings.maintenance_monthly || 0;
      maintenanceReservePerKm = monthlyKm > 0 ? (reserve + maintenance) / monthlyKm : 0;

      depreciationPerKm = 0.16; // constant R$ 0.16 depreciation per km driven
    } else {
      // safe defaults if costSettings is missing
      tirePerKm = 0.03;
      if (!isElectric) oilPerKm = 0.03;
      brakePerKm = 0.02;
      insurancePerKm = 0.10;
      ipvaPerKm = 0.06;
      licensingPerKm = 0.01;
      maintenanceReservePerKm = 0.08;
      depreciationPerKm = 0.16;
    }

    if (ownershipType === 'financed') {
      const financingMonthly = costSettings?.financing_monthly || 0;
      financingPerKm = monthlyKm > 0 ? financingMonthly / monthlyKm : 0;
    }
  } else if (ownershipType === 'rented') {
    // 2. Rented Calculations
    // Tires, oil, brakes, insurance, ipva, licensing, depreciation, and reserve are STRICTLY 0.
    
    // Valor do aluguel & periodicidade
    const rentalAmount = vehicle?.rental_amount || 0;
    const rentalPeriod = vehicle?.rental_period || 'weekly';
    const rentalMonthly = rentalPeriod === 'weekly' ? rentalAmount * 4.33 : rentalAmount;
    rentalPerKm = monthlyKm > 0 ? rentalMonthly / monthlyKm : 0;

    // Rented specific variable costs per km
    // Franquia/Avarias (rental_damage_monthly)
    const damageMonthly = vehicle?.rental_damage_monthly || 0;
    damagePerKm = monthlyKm > 0 ? damageMonthly / monthlyKm : 0;

    // Limpeza (rental_cleaning_monthly)
    const cleaningMonthly = vehicle?.rental_cleaning_monthly || 0;
    cleaningPerKm = monthlyKm > 0 ? cleaningMonthly / monthlyKm : 0;

    // Alimentação (rental_food_daily) - 26 working days
    const foodDaily = vehicle?.rental_food_daily || 0;
    foodPerKm = dailyKm > 0 ? foodDaily / dailyKm : 0;

    // Toll, wash, and other operational
    washPerKm = 0.015; // standard proportional wash
    tollPerKm = 0.01;  // standard toll apportioned
    otherOperationalPerKm = 0.005; // other oper
  }

  const totalCostPerKm = 
    fuelPerKm + 
    tirePerKm + 
    oilPerKm + 
    brakePerKm + 
    insurancePerKm + 
    ipvaPerKm + 
    licensingPerKm + 
    depreciationPerKm + 
    maintenanceReservePerKm + 
    financingPerKm + 
    rentalPerKm +
    washPerKm +
    cleaningPerKm +
    damagePerKm +
    tollPerKm +
    foodPerKm +
    otherOperationalPerKm;

  return {
    ownershipType,
    isElectric,
    fuelPerKm,
    tirePerKm,
    oilPerKm,
    brakePerKm,
    insurancePerKm,
    ipvaPerKm,
    licensingPerKm,
    depreciationPerKm,
    maintenanceReservePerKm,
    financingPerKm,
    rentalPerKm,
    washPerKm,
    cleaningPerKm,
    damagePerKm,
    tollPerKm,
    foodPerKm,
    otherOperationalPerKm,
    totalCostPerKm
  };
};

/**
 * Calculates the exact dynamic maintenance + fuel cost per km.
 */
export const calculateCostPerKmEstimate = (
  vehicle: Vehicle | null,
  costSettings: VehicleCostSettings | null
): number => {
  if (!vehicle) return 0;
  return calculateCostBreakdown(vehicle, costSettings).totalCostPerKm;
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
