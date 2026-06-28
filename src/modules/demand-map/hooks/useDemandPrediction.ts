import { useMemo } from 'react';
import { useApp } from '../../../context/AppContext';
import { DemandPredictionService } from '../../../services/ai/DemandPredictionService';

export function useDemandPrediction() {
  const { vehicle, vehicleCostSettings } = useApp();

  const currentCostPerKm = useMemo(() => {
    return vehicleCostSettings?.fuel_price 
      ? (vehicleCostSettings.fuel_price / (vehicle?.km_per_liter || 11.5)) + 0.18
      : 0.74;
  }, [vehicleCostSettings, vehicle]);

  const weeklyPlan = useMemo(() => {
    return DemandPredictionService.getWeeklySchedule(currentCostPerKm);
  }, [currentCostPerKm]);

  const hotspots = useMemo(() => {
    return DemandPredictionService.getDemandHotspots();
  }, []);

  return { weeklyPlan, hotspots, currentCostPerKm };
}
