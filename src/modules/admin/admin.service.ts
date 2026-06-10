/**
 * Admin Service Routines
 * Module: Admin (admin)
 * When to edit: When expanding admin screens capability, batch processing profiles, or clearing telemetries.
 */

import { supabase } from '../shared/supabase.helpers';

export const adminService = {
  /**
   * Fetches all registered system profiles (Admin authorization restricted).
   */
  async fetchAllSystemProfiles() {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  /**
   * Resets or deletes old route points in bulk (Maintenances).
   */
  async purgeHistoricRoutePoints(sessionId: string): Promise<void> {
    const { error } = await supabase
      .from('route_points')
      .delete()
      .eq('session_id', sessionId);

    if (error) throw error;
  }
};
