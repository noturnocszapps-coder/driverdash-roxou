/**
 * Vehicle Hooks and Context Provider
 * Module: Vehicle (vehicle)
 * When to edit: When modifying local storage caching protocols, vehicle state loaders, or hooks.
 */

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from '../auth/auth.hooks';
import { STORAGE_PREFIX } from '../shared/constants';
import { Vehicle, VehicleCostSettings, VehicleContextType } from './vehicle.types';
import { vehicleService } from './vehicle.service';

export const VehicleContext = createContext<VehicleContextType | undefined>(undefined);

export const VehicleProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, dbStatus } = useAuth();
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [vehicleCostSettings, setVehicleCostSettings] = useState<VehicleCostSettings | null>(null);

  useEffect(() => {
    if (!user) {
      setVehicle(null);
      setVehicleCostSettings(null);
      return;
    }

    const loadLocal = () => {
      const lVehicle = localStorage.getItem(`${STORAGE_PREFIX}vehicle_${user.id}`);
      const lCosts = localStorage.getItem(`${STORAGE_PREFIX}costs_${user.id}`);
      setVehicle(lVehicle ? JSON.parse(lVehicle) : null);
      setVehicleCostSettings(lCosts ? JSON.parse(lCosts) : null);
    };

    if (dbStatus === 'connected') {
      const fetchData = async () => {
        try {
          const vehData = await vehicleService.fetchVehicle(user.id);
          const costData = await vehicleService.fetchCostSettings(user.id);

          setVehicle(vehData);
          setVehicleCostSettings(costData);

          if (vehData) localStorage.setItem(`${STORAGE_PREFIX}vehicle_${user.id}`, JSON.stringify(vehData));
          if (costData) localStorage.setItem(`${STORAGE_PREFIX}costs_${user.id}`, JSON.stringify(costData));
        } catch (e) {
          console.warn('Vehicle fetching error; loading local backup profiles:', e);
          loadLocal();
        }
      };
      fetchData();
    } else {
      loadLocal();
    }
  }, [user, dbStatus]);

  const upsertVehicle = async (vehicleData: Omit<Vehicle, 'id' | 'user_id'>) => {
    if (!user) return;
    const item: Vehicle = {
      ...vehicleData,
      user_id: user.id,
      created_at: new Date().toISOString()
    };

    if (dbStatus === 'connected') {
      try {
        await vehicleService.upsertVehicle(item);
      } catch (err) {
        console.error('Remote save vehicle missed. Storing locally.', err);
      }
    }

    setVehicle(item);
    localStorage.setItem(`${STORAGE_PREFIX}vehicle_${user.id}`, JSON.stringify(item));
  };

  const upsertVehicleCostSettings = async (costData: Omit<VehicleCostSettings, 'id' | 'user_id'>) => {
    if (!user) return;
    const item: VehicleCostSettings = {
      ...costData,
      user_id: user.id
    };
    if (vehicleCostSettings?.id) {
      item.id = vehicleCostSettings.id;
    }

    if (dbStatus === 'connected') {
      try {
        const saved = await vehicleService.upsertCostSettings(item);
        setVehicleCostSettings(saved);
        localStorage.setItem(`${STORAGE_PREFIX}costs_${user.id}`, JSON.stringify(saved));
        return;
      } catch (err) {
        console.error('Remote save cost settings missed. Storing locally.', err);
      }
    }

    setVehicleCostSettings(item);
    localStorage.setItem(`${STORAGE_PREFIX}costs_${user.id}`, JSON.stringify(item));
  };

  return (
    <VehicleContext.Provider
      value={{
        vehicle,
        vehicleCostSettings,
        upsertVehicle,
        upsertVehicleCostSettings
      }}
    >
      {children}
    </VehicleContext.Provider>
  );
};

export const useVehicle = () => {
  const context = useContext(VehicleContext);
  if (context === undefined) {
    throw new Error('useVehicle must be used inside a VehicleProvider');
  }
  return context;
};
export { vehicleService };
export type { Vehicle, VehicleCostSettings };
