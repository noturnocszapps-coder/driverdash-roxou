import { useMemo } from 'react';
import { useApp } from '../../../context/AppContext';
import { PlatformComparisonService } from '../../../services/ai/PlatformComparisonService';

export function usePlatformComparator(platformHoursInput: number, platformKmInput: number) {
  const { vehicle, vehicleCostSettings } = useApp();

  const currentCostPerKm = useMemo(() => {
    return vehicleCostSettings?.fuel_price 
      ? (vehicleCostSettings.fuel_price / (vehicle?.km_per_liter || 11.5)) + 0.18
      : 0.74;
  }, [vehicleCostSettings, vehicle]);

  const platformComparison = useMemo(() => {
    return PlatformComparisonService.calculatePlatformMetrics(
      platformHoursInput,
      platformKmInput,
      currentCostPerKm
    );
  }, [platformHoursInput, platformKmInput, currentCostPerKm]);

  return { platformComparison, currentCostPerKm };
}
