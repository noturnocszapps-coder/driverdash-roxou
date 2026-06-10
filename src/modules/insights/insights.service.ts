/**
 * Insights Service Routines
 * Module: Insights (insights)
 * When to edit: When modifying DB queries for peak rules or passenger feedback structures.
 */

import { supabase } from '../shared/supabase.helpers';
import { AdminPeakRule, PassengerReport } from './insights.types';

export const insightsService = {
  /**
   * Fetches all peaks rules.
   */
  async fetchPeakRules(): Promise<AdminPeakRule[]> {
    const { data, error } = await supabase
      .from('admin_peak_rules')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  /**
   * Fetches passenger threat reports.
   */
  async fetchPassengerReports(): Promise<PassengerReport[]> {
    const { data, error } = await supabase
      .from('passenger_reports')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  /**
   * Inserts an admin peak rule.
   */
  async addPeakRule(rule: AdminPeakRule): Promise<AdminPeakRule> {
    const { data, error } = await supabase
      .from('admin_peak_rules')
      .insert([rule])
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Updates state of active peak rules.
   */
  async updatePeakRuleStatus(id: string, is_active: boolean): Promise<void> {
    const { error } = await supabase
      .from('admin_peak_rules')
      .update({ is_active })
      .eq('id', id);

    if (error) throw error;
  },

  /**
   * Inserts a safety/passenger report.
   */
  async addPassengerReport(report: PassengerReport): Promise<PassengerReport> {
    const { data, error } = await supabase
      .from('passenger_reports')
      .insert([report])
      .select()
      .single();

    if (error) throw error;
    return data;
  }
};
