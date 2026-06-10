/**
 * Roxou Smart Alerts Service Routines
 * Module: Alerts (alerts)
 * When to edit: When altering database queries or syncing alerts lists with specific tables.
 */

import { supabase } from '../shared/supabase.helpers';
import { SmartAlert } from './alerts.types';

export const alertsService = {
  /**
   * Fetches active driver smart alerts.
   */
  async fetchSmartAlerts(userId: string): Promise<SmartAlert[]> {
    const { data, error } = await supabase
      .from('smart_alerts')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  /**
   * Records a custom system generated smart alert.
   */
  async insertSmartAlert(userId: string, alert: Omit<SmartAlert, 'id' | 'created_at'>): Promise<SmartAlert> {
    const item = {
      user_id: userId,
      type: alert.type,
      title: alert.title,
      description: alert.description,
      severity: alert.severity,
      created_at: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from('smart_alerts')
      .insert([item])
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Dismisses/deletes an active smart alert.
   */
  async deleteSmartAlert(alertId: string): Promise<void> {
    const { error } = await supabase
      .from('smart_alerts')
      .delete()
      .eq('id', alertId);

    if (error) throw error;
  }
};
