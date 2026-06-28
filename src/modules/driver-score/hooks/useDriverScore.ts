import { useMemo } from 'react';
import { useApp } from '../../../context/AppContext';
import { ScoreCalculationService } from '../../../services/ai/ScoreCalculationService';

export function useDriverScore() {
  const { earnings, expenses, vehicle, vehicleCostSettings, driverSessions } = useApp();

  const currentCostPerKm = useMemo(() => {
    return vehicleCostSettings?.fuel_price 
      ? (vehicleCostSettings.fuel_price / (vehicle?.km_per_liter || 11.5)) + 0.18
      : 0.74;
  }, [vehicleCostSettings, vehicle]);

  const scoreReport = useMemo(() => {
    return ScoreCalculationService.calculateDriverScore(
      earnings,
      expenses,
      currentCostPerKm,
      driverSessions || []
    );
  }, [earnings, expenses, currentCostPerKm, driverSessions]);

  return { scoreReport, currentCostPerKm };
}
