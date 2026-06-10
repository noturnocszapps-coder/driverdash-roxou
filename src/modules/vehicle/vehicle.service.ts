/**
 * Vehicle Service Routines
 * Module: Vehicle (vehicle)
 * When to edit: When altering vehicle payload properties, index mappings, or database integrations.
 */

import { supabase } from '../shared/supabase.helpers';
import { Vehicle, VehicleCostSettings } from './vehicle.types';

export const vehicleService = {
  /**
   * Fetches the user's active vehicle record.
   */
  async fetchVehicle(userId: string): Promise<Vehicle | null> {
    const { data, error } = await supabase
      .from('vehicles')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) throw error;
    return data;
  },

  /**
   * Fetches user's active maintenance and cost settings.
   */
  async fetchCostSettings(userId: string): Promise<VehicleCostSettings | null> {
    const { data, error } = await supabase
      .from('vehicle_cost_settings')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) throw error;
    return data;
  },

  /**
   * Upserts the user's active vehicle spec.
   */
  async upsertVehicle(vehicle: Vehicle): Promise<void> {
    const { error } = await supabase
      .from('vehicles')
      .upsert([vehicle], { onConflict: 'user_id' });
    if (error) throw error;
  },

  /**
   * Upserts maintenance, pricing, and reserve formulas.
   */
  async upsertCostSettings(settings: VehicleCostSettings): Promise<VehicleCostSettings> {
    const { data, error } = await supabase
      .from('vehicle_cost_settings')
      .upsert([settings], { onConflict: 'user_id' })
      .select()
      .single();

    if (error) throw error;
    return data;
  }
};
