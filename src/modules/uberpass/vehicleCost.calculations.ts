export type MotorizationType = 'gasoline' | 'ethanol' | 'flex' | 'diesel' | 'hybrid' | 'electric';
export type CostFrequency = 'daily' | 'weekly' | 'monthly' | 'anual' | 'km';
export type ChargingLocation = 'residential' | 'public' | 'mixed';
export type EvConsumptionUnit = 'km_kwh' | 'kwh_100km';
export type FlexMode = 'gasoline' | 'ethanol' | 'auto';

export interface DetailedVehicleConfig {
  motorizationType: MotorizationType;
  ownership_type?: 'own' | 'financed' | 'rented';
  
  // Fuel & Energy
  fuelPrice: number; // R$/L
  fuelConsumption: number; // Km/L
  
  // Flex specific
  ethanolPrice: number; // R$/L
  ethanolConsumption: number; // Km/L
  flexMode: FlexMode;
  
  // Electric/EV specific
  kwhPrice: number; // R$/kWh
  evConsumption: number; // consumption number
  evConsumptionUnit: EvConsumptionUnit; // km_kwh or kwh_100km
  chargingLocation: ChargingLocation;
  homeChargingPercent: number; // %
  publicChargingPercent: number; // %
  homeKwhPrice: number; // R$/kWh
  publicKwhPrice: number; // R$/kWh
  avgChargeTime?: number; // hours
  
  // Hybrid specific
  hybridGasConsumption: number; // Km/L
  hybridElectricConsumption: number; // consumption number
  hybridElectricUnit: EvConsumptionUnit;
  hybridElectricShare: number; // %
  hybridGasShare: number; // %
  
  // Maintenance component costs
  oilCost: number;
  oilIntervalKm: number;
  filterCost: number;
  filterIntervalKm: number;
  brakeCost: number;
  brakeIntervalKm: number;
  tireCost: number;
  tireIntervalKm: number;
  alignmentCost: number;
  alignmentIntervalKm: number;
  balancingCost: number;
  balancingIntervalKm: number;
  
  // Fixed & Periodic Costs with frequencies
  insuranceCost: number;
  insuranceFreq: CostFrequency;
  
  ipvaCost: number;
  ipvaFreq: CostFrequency;
  
  licensingCost: number;
  licensingFreq: CostFrequency;
  
  washCost: number;
  washFreq: CostFrequency;
  
  parkingCost: number;
  parkingFreq: CostFrequency;
  
  tollCost: number;
  tollFreq: CostFrequency;
  
  depreciationCost: number; // R$ per KM
  
  rentCost: number; // Parcela ou aluguel
  rentFreq: CostFrequency;
  
  otherCost: number;
  otherFreq: CostFrequency;

  // Rental specific (Phase 1 & 2)
  rental_food_daily?: number;
  rental_damage_monthly?: number;
  rental_cleaning_monthly?: number;

  includedSeguro?: boolean;
  includedPneus?: boolean;
  includedManutencao?: boolean;
  includedIpva?: boolean;
  includedLicenciamento?: boolean;
  includedCarroReserva?: boolean;
  includedGuincho?: boolean;
  includedRevisoes?: boolean;
}

export const DEFAULT_DETAILED_CONFIG: DetailedVehicleConfig = {
  motorizationType: 'gasoline',
  ownership_type: 'own',
  fuelPrice: 5.80,
  fuelConsumption: 11.5,
  
  ethanolPrice: 3.90,
  ethanolConsumption: 8.0,
  flexMode: 'auto',
  
  kwhPrice: 0.85,
  evConsumption: 15.0,
  evConsumptionUnit: 'kwh_100km',
  chargingLocation: 'residential',
  homeChargingPercent: 70,
  publicChargingPercent: 30,
  homeKwhPrice: 0.75,
  publicKwhPrice: 1.80,
  
  hybridGasConsumption: 18.0,
  hybridElectricConsumption: 12.0,
  hybridElectricUnit: 'kwh_100km',
  hybridElectricShare: 50,
  hybridGasShare: 50,
  
  oilCost: 220,
  oilIntervalKm: 10000,
  filterCost: 80,
  filterIntervalKm: 10000,
  brakeCost: 350,
  brakeIntervalKm: 25000,
  tireCost: 1600, // 4 tires
  tireIntervalKm: 45000,
  alignmentCost: 100,
  alignmentIntervalKm: 10000,
  balancingCost: 100,
  balancingIntervalKm: 10000,
  
  insuranceCost: 250,
  insuranceFreq: 'monthly',
  
  ipvaCost: 1200,
  ipvaFreq: 'anual',
  
  licensingCost: 160,
  licensingFreq: 'anual',
  
  washCost: 60,
  washFreq: 'monthly',
  
  parkingCost: 0,
  parkingFreq: 'monthly',
  
  tollCost: 0,
  tollFreq: 'daily',
  
  depreciationCost: 0.15, // R$ 0.15 per KM
  
  rentCost: 1200,
  rentFreq: 'monthly',
  
  otherCost: 0,
  otherFreq: 'monthly',

  // Rental defaults
  rental_food_daily: 0,
  rental_damage_monthly: 0,
  rental_cleaning_monthly: 0,

  includedSeguro: true,
  includedPneus: true,
  includedManutencao: true,
  includedIpva: true,
  includedLicenciamento: true,
  includedCarroReserva: true,
  includedGuincho: true,
  includedRevisoes: true,
  avgChargeTime: 4,
};

// Standard conversion helper to convert frequency costs into cost per KM
export function convertFrequencyToCostPerKm(amount: number, freq: CostFrequency, dailyKm: number): number {
  if (amount <= 0 || dailyKm <= 0) return 0;
  
  // Professional ride-hailing driver working averages:
  // - 6 working days per week
  // - 26 working days per month
  // - 312 working days per year
  const WORKING_DAYS_WEEK = 6;
  const WORKING_DAYS_MONTH = 26;
  const WORKING_DAYS_YEAR = 312;

  switch (freq) {
    case 'km':
      return amount;
    case 'daily':
      return amount / dailyKm;
    case 'weekly':
      return amount / (dailyKm * WORKING_DAYS_WEEK);
    case 'monthly':
      return amount / (dailyKm * WORKING_DAYS_MONTH);
    case 'anual':
      return amount / (dailyKm * WORKING_DAYS_YEAR);
    default:
      return 0;
  }
}

// Convert frequency costs into monthly costs
export function convertFrequencyToMonthly(amount: number, freq: CostFrequency, dailyKm: number): number {
  if (amount <= 0) return 0;
  
  const WORKING_DAYS_WEEK = 6;
  const WORKING_DAYS_MONTH = 26;
  const WORKING_DAYS_YEAR = 312;

  switch (freq) {
    case 'km':
      return amount * dailyKm * WORKING_DAYS_MONTH;
    case 'daily':
      return amount * WORKING_DAYS_MONTH;
    case 'weekly':
      return (amount / WORKING_DAYS_WEEK) * WORKING_DAYS_MONTH;
    case 'monthly':
      return amount;
    case 'anual':
      return amount / 12;
    default:
      return 0;
  }
}

export interface CostBreakdown {
  fuelOrEnergy: number; // cost per KM
  maintenance: number;  // cost per KM
  fixed: number;        // cost per KM (IPVA, Licensing, Rent, Insurance)
  variableOther: number;// cost per KM (Wash, Parking, Tolls, Other)
  depreciation: number; // cost per KM
  tires: number;        // cost per KM
  brakes: number;       // cost per KM
  
  // Total cost sums
  totalPerKm: number;
  totalDaily: number;
  totalMonthly: number;
  totalAnual: number;
  
  // Recommendation info (e.g. for flex)
  recommendation?: string;
  activeFuelType?: 'gasoline' | 'ethanol' | 'diesel' | 'hybrid' | 'electric';
}

export function calculateDetailedVehicleCost(
  config: DetailedVehicleConfig,
  dailyKm: number
): CostBreakdown {
  const km = dailyKm > 0 ? dailyKm : 100; // avoid divide by zero, fallback to 100km

  const ownership = config.ownership_type || 'own';
  console.log(`[VehicleCost] ownership detected: ${ownership}`);
  if (ownership === 'rented') {
    console.log('[VehicleCost] rental cost rules applied');
  } else if (ownership === 'own') {
    console.log('[VehicleCost] own vehicle rules applied');
  } else if (ownership === 'financed') {
    console.log('[VehicleCost] financed vehicle rules applied');
  }

  let fuelOrEnergyPerKm = 0;
  let activeFuelType: 'gasoline' | 'ethanol' | 'diesel' | 'hybrid' | 'electric' = 'gasoline';
  let recommendation = '';

  const type = config.motorizationType;

  // 1. Calculate Fuel/Energy Cost per KM
  if (type === 'gasoline' || type === 'diesel') {
    activeFuelType = type === 'diesel' ? 'diesel' : 'gasoline';
    if (config.fuelConsumption > 0) {
      fuelOrEnergyPerKm = config.fuelPrice / config.fuelConsumption;
    }
  } else if (type === 'ethanol') {
    activeFuelType = 'ethanol';
    if (config.fuelConsumption > 0) {
      fuelOrEnergyPerKm = config.fuelPrice / config.fuelConsumption;
    }
  } else if (type === 'flex') {
    const gasCostPerKm = config.fuelConsumption > 0 ? config.fuelPrice / config.fuelConsumption : 999;
    const ethCostPerKm = config.ethanolConsumption > 0 ? config.ethanolPrice / config.ethanolConsumption : 999;
    
    if (config.flexMode === 'gasoline') {
      activeFuelType = 'gasoline';
      fuelOrEnergyPerKm = gasCostPerKm;
    } else if (config.flexMode === 'ethanol') {
      activeFuelType = 'ethanol';
      fuelOrEnergyPerKm = ethCostPerKm;
    } else {
      // Auto mode
      if (ethCostPerKm < gasCostPerKm) {
        activeFuelType = 'ethanol';
        fuelOrEnergyPerKm = ethCostPerKm;
        recommendation = `Etanol é mais vantajoso (${ethCostPerKm.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}/km vs Gasolina ${gasCostPerKm.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}/km)`;
      } else {
        activeFuelType = 'gasoline';
        fuelOrEnergyPerKm = gasCostPerKm;
        recommendation = `Gasolina é mais vantajosa (${gasCostPerKm.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}/km vs Etanol ${ethCostPerKm.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}/km)`;
      }
    }
  } else if (type === 'electric') {
    activeFuelType = 'electric';
    
    // Resolve kWh price based on charging location
    let effectiveKwhPrice = config.kwhPrice;
    if (config.chargingLocation === 'mixed') {
      const homePct = config.homeChargingPercent / 100;
      const pubPct = config.publicChargingPercent / 100;
      effectiveKwhPrice = (config.homeKwhPrice * homePct) + (config.publicKwhPrice * pubPct);
    } else if (config.chargingLocation === 'residential') {
      effectiveKwhPrice = config.homeKwhPrice || config.kwhPrice;
    } else {
      effectiveKwhPrice = config.publicKwhPrice || config.kwhPrice;
    }
    
    // Calculate based on unit
    if (config.evConsumptionUnit === 'km_kwh') {
      if (config.evConsumption > 0) {
        fuelOrEnergyPerKm = effectiveKwhPrice / config.evConsumption;
      }
    } else {
      // kWh/100km
      fuelOrEnergyPerKm = (config.evConsumption * effectiveKwhPrice) / 100;
    }
  } else if (type === 'hybrid') {
    activeFuelType = 'hybrid';
    
    // Calculate gas component
    const gasComponentCostPerKm = config.hybridGasConsumption > 0 ? config.fuelPrice / config.hybridGasConsumption : 0;
    
    // Calculate electric component
    let effectiveKwhPrice = config.kwhPrice;
    if (config.chargingLocation === 'mixed') {
      const homePct = config.homeChargingPercent / 100;
      const pubPct = config.publicChargingPercent / 100;
      effectiveKwhPrice = (config.homeKwhPrice * homePct) + (config.publicKwhPrice * pubPct);
    } else if (config.chargingLocation === 'residential') {
      effectiveKwhPrice = config.homeKwhPrice || config.kwhPrice;
    } else {
      effectiveKwhPrice = config.publicKwhPrice || config.kwhPrice;
    }
    
    let electricComponentCostPerKm = 0;
    if (config.hybridElectricUnit === 'km_kwh') {
      if (config.hybridElectricConsumption > 0) {
        electricComponentCostPerKm = effectiveKwhPrice / config.hybridElectricConsumption;
      }
    } else {
      electricComponentCostPerKm = (config.hybridElectricConsumption * effectiveKwhPrice) / 100;
    }
    
    // Weighted average
    const electricShare = config.hybridElectricShare / 100;
    const gasShare = config.hybridGasShare / 100;
    fuelOrEnergyPerKm = (electricComponentCostPerKm * electricShare) + (gasComponentCostPerKm * gasShare);
  }

  // 2. Calculate Maintenance Components (per KM)
  let tiresPerKm = 0;
  let brakesPerKm = 0;
  let oilPerKm = 0;
  let filterPerKm = 0;
  let alignmentPerKm = 0;
  let balancingPerKm = 0;
  let maintenancePerKm = 0;

  const calcPneus = ownership !== 'rented' || config.includedPneus === false;
  const calcManutencao = ownership !== 'rented' || config.includedManutencao === false;

  if (calcPneus) {
    // Tires (Pneus) cost per km
    tiresPerKm = config.tireIntervalKm > 0 ? config.tireCost / config.tireIntervalKm : 0;
  }
  
  if (calcManutencao) {
    // Brakes (Freios) cost per km
    brakesPerKm = config.brakeIntervalKm > 0 ? config.brakeCost / config.brakeIntervalKm : 0;
    
    // Oil (Troca de Óleo) and Filter are only for combustion/hybrid
    const hasEngineOil = type !== 'electric';
    oilPerKm = (hasEngineOil && config.oilIntervalKm > 0) ? config.oilCost / config.oilIntervalKm : 0;
    filterPerKm = (hasEngineOil && config.filterIntervalKm > 0) ? config.filterCost / config.filterIntervalKm : 0;
    
    // Alignment & Balancing
    alignmentPerKm = config.alignmentIntervalKm > 0 ? config.alignmentCost / config.alignmentIntervalKm : 0;
    balancingPerKm = config.balancingIntervalKm > 0 ? config.balancingCost / config.balancingIntervalKm : 0;
  }
  
  maintenancePerKm = tiresPerKm + brakesPerKm + oilPerKm + filterPerKm + alignmentPerKm + balancingPerKm;

  // 3. Calculate Fixed Costs (IPVA, Seguro, Licenciamento, Aluguel/Parcela)
  let insurancePerKm = 0;
  let ipvaPerKm = 0;
  let licensingPerKm = 0;
  let rentPerKm = 0;

  const calcSeguro = ownership !== 'rented' || config.includedSeguro === false;
  const calcIpva = ownership !== 'rented' || config.includedIpva === false;
  const calcLicensing = ownership !== 'rented' || config.includedLicenciamento === false;

  if (calcSeguro) {
    insurancePerKm = convertFrequencyToCostPerKm(config.insuranceCost, config.insuranceFreq, km);
  }
  
  if (calcIpva) {
    ipvaPerKm = convertFrequencyToCostPerKm(config.ipvaCost, config.ipvaFreq, km);
  }
  
  if (calcLicensing) {
    licensingPerKm = convertFrequencyToCostPerKm(config.licensingCost, config.licensingFreq, km);
  }

  if (ownership === 'rented') {
    rentPerKm = convertFrequencyToCostPerKm(config.rentCost, config.rentFreq, km);
  } else if (ownership === 'financed') {
    rentPerKm = convertFrequencyToCostPerKm(config.rentCost, config.rentFreq, km);
  }
  
  const fixedPerKm = insurancePerKm + ipvaPerKm + licensingPerKm + rentPerKm;

  // 4. Calculate Variable Other Costs (Wash, Parking, Tolls, Others, Food, Damage, Cleaning)
  const washPerKm = convertFrequencyToCostPerKm(config.washCost, config.washFreq, km);
  const parkingPerKm = convertFrequencyToCostPerKm(config.parkingCost, config.parkingFreq, km);
  const tollPerKm = convertFrequencyToCostPerKm(config.tollCost, config.tollFreq, km);
  const otherPerKm = convertFrequencyToCostPerKm(config.otherCost, config.otherFreq, km);
  
  // Rental specific variables
  let rentalFoodPerKm = 0;
  let rentalDamagePerKm = 0;
  let rentalCleaningPerKm = 0;

  if (ownership === 'rented') {
    rentalFoodPerKm = (config.rental_food_daily || 0) / km;
    rentalDamagePerKm = ((config.rental_damage_monthly || 0) / 26) / km;
    rentalCleaningPerKm = ((config.rental_cleaning_monthly || 0) / 26) / km;
  }

  const variableOtherPerKm = washPerKm + parkingPerKm + tollPerKm + otherPerKm + rentalFoodPerKm + rentalDamagePerKm + rentalCleaningPerKm;

  // 5. Depreciation (per KM) - never applies to rented
  const depreciationPerKm = ownership !== 'rented' ? (config.depreciationCost > 0 ? config.depreciationCost : 0) : 0;

  // 6. Aggregate Total Per KM
  const totalPerKm = fuelOrEnergyPerKm + maintenancePerKm + fixedPerKm + variableOtherPerKm + depreciationPerKm;

  // Convert to Daily, Monthly, and Annual
  // Using 26 working days in a month, 312 working days in a year for professional drivers
  const WORKING_DAYS_MONTH = 26;
  const WORKING_DAYS_YEAR = 312;
  
  const totalDaily = totalPerKm * km;
  const totalMonthly = totalDaily * WORKING_DAYS_MONTH;
  const totalAnual = totalDaily * WORKING_DAYS_YEAR;

  return {
    fuelOrEnergy: fuelOrEnergyPerKm,
    maintenance: maintenancePerKm,
    fixed: fixedPerKm,
    variableOther: variableOtherPerKm,
    depreciation: depreciationPerKm,
    tires: tiresPerKm,
    brakes: brakesPerKm,
    totalPerKm,
    totalDaily,
    totalMonthly,
    totalAnual,
    recommendation,
    activeFuelType,
  };
}
