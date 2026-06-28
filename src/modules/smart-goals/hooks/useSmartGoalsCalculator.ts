import { useMemo } from 'react';
import { useApp } from '../../../context/AppContext';
import { SmartGoalsService } from '../../../services/ai/SmartGoalsService';

export function useSmartGoalsCalculator(targetNetInput: number, targetPeriod: 'day' | 'week' | 'month') {
  const { vehicle, vehicleCostSettings } = useApp();

  const currentCostPerKm = useMemo(() => {
    return vehicleCostSettings?.fuel_price 
      ? (vehicleCostSettings.fuel_price / (vehicle?.km_per_liter || 11.5)) + 0.18
      : 0.74;
  }, [vehicleCostSettings, vehicle]);

  const calculatedGoals = useMemo(() => {
    return SmartGoalsService.calculateGoalsProjection(
      targetNetInput,
      targetPeriod,
      currentCostPerKm
    );
  }, [targetNetInput, targetPeriod, currentCostPerKm]);

  return { calculatedGoals, currentCostPerKm };
}
