import { useMemo } from 'react';
import { useApp } from '../../../context/AppContext';
import { MaintenanceService } from '../../../services/ai/MaintenanceService';
import { driverProfileService } from '../../copilot-intelligence/driverProfile.service';

export function useMaintenanceAlerts() {
  const { vehicle, earnings, vehicleCostSettings } = useApp();

  const maintenanceList = useMemo(() => {
    const totalKmTracked = earnings.reduce((sum, e) => sum + Number(e.total_km), 0) || 45800;
    const baseList = MaintenanceService.getMaintenanceOutlook(vehicle, totalKmTracked);

    // Load active ride logs to factor into calculations
    const rideLogsRaw = localStorage.getItem('driverdash_calibrated_rides');
    const rideLogs = rideLogsRaw ? JSON.parse(rideLogsRaw) : [];

    const smartStatus = driverProfileService.calculateSmartMaintenance(
      rideLogs,
      vehicle,
      vehicleCostSettings,
      totalKmTracked
    );

    const mapStatus = (type: 'info' | 'warning' | 'critical'): 'good' | 'warning' | 'critical' => {
      return type === 'info' ? 'good' : type;
    };

    // Map the dynamic status to the rendered list
    return baseList.map(item => {
      const nameLower = item.name.toLowerCase();
      if (nameLower.includes('óleo') || nameLower.includes('oleo')) {
        return {
          ...item,
          remainingKm: Math.round(smartStatus.oil.remainingKm),
          status: mapStatus(smartStatus.oil.alertType),
          description: smartStatus.oil.message
        };
      }
      if (nameLower.includes('pastilha') || nameLower.includes('freio')) {
        return {
          ...item,
          remainingKm: Math.max(100, Math.round((1 - (smartStatus.brakes.wearPercent / 100)) * item.intervalKm)),
          status: mapStatus(smartStatus.brakes.alertType),
          description: `${smartStatus.brakes.message} (Status: ${smartStatus.brakes.wearLevel})`
        };
      }
      if (nameLower.includes('pneu')) {
        return {
          ...item,
          remainingKm: Math.max(100, Math.round((1 - (smartStatus.tires.wearPercent / 100)) * item.intervalKm)),
          status: mapStatus(smartStatus.tires.alertType),
          description: `${smartStatus.tires.message} Alertas: ${smartStatus.tires.reminders.join(', ')}.`
        };
      }
      return item;
    });
  }, [vehicle, earnings, vehicleCostSettings]);

  return { maintenanceList };
}
