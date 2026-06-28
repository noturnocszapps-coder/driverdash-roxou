import { useMemo } from 'react';
import { useApp } from '../../../context/AppContext';
import { DriverInsightsService } from '../../../services/ai/DriverInsightsService';
import { DriverDailyDiagnostic } from '../../../services/ai/base.types';

export function useDailyOutlook() {
  const { earnings, expenses, vehicle, vehicleCostSettings, financialGoal } = useApp();

  const currentCostPerKm = useMemo(() => {
    return vehicleCostSettings?.fuel_price 
      ? (vehicleCostSettings.fuel_price / (vehicle?.km_per_liter || 11.5)) + 0.18
      : 0.74;
  }, [vehicleCostSettings, vehicle]);

  const dailyOutlook = useMemo(() => {
    return DriverInsightsService.analyzeDailyOutlook(
      earnings,
      expenses,
      vehicle,
      currentCostPerKm,
      financialGoal
    );
  }, [earnings, expenses, vehicle, currentCostPerKm, financialGoal]);

  return { dailyOutlook, currentCostPerKm };
}
