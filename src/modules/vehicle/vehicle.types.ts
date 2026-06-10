/**
 * Vehicle and Operational Cost Type Definitions
 * Module: Vehicle (vehicle)
 * When to edit: When updating vehicle characteristics, fuel targets, or cost setup elements.
 */

import { Vehicle, VehicleCostSettings } from '../../types';

export type { Vehicle, VehicleCostSettings };

export interface VehicleContextType {
  vehicle: Vehicle | null;
  vehicleCostSettings: VehicleCostSettings | null;
  upsertVehicle: (vehicleData: Omit<Vehicle, 'user_id' | 'id'>) => Promise<void>;
  upsertVehicleCostSettings: (costData: Omit<VehicleCostSettings, 'user_id' | 'id'>) => Promise<void>;
}
