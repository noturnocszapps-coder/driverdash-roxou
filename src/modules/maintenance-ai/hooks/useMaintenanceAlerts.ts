import { useMemo } from 'react';
import { useApp } from '../../../context/AppContext';
import { MaintenanceService } from '../../../services/ai/MaintenanceService';

export function useMaintenanceAlerts() {
  const { vehicle, earnings } = useApp();

  const maintenanceList = useMemo(() => {
    const totalKmTracked = earnings.reduce((sum, e) => sum + Number(e.total_km), 0) || 45800;
    return MaintenanceService.getMaintenanceOutlook(vehicle, totalKmTracked);
  }, [vehicle, earnings]);

  return { maintenanceList };
}
