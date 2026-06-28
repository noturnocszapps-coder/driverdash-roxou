import { useMemo } from 'react';
import { 
  DetailedVehicleConfig, 
  calculateDetailedVehicleCost, 
  CostBreakdown 
} from '../vehicleCost.calculations';

export function useVehicleCostCalculator(
  config: DetailedVehicleConfig, 
  estimatedKm: number
): CostBreakdown {
  return useMemo(() => {
    return calculateDetailedVehicleCost(config, estimatedKm);
  }, [config, estimatedKm]);
}
