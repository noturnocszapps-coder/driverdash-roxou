/**
 * Goals Service Routines
 * Module: Goals (goals)
 * When to edit: When connecting goals structures to different relational frameworks.
 */

import { supabase } from '../shared/supabase.helpers';
import { FinancialGoal } from './goals.types';

export const goalsService = {
  /**
   * Fetches the driver's financial goals.
   */
  async fetchFinancialGoal(userId: string): Promise<FinancialGoal | null> {
    const { data, error } = await supabase
      .from('financial_goals')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) throw error;
    return data;
  },

  /**
   * Upserts the driver's financial goals.
   */
  async upsertFinancialGoal(goal: FinancialGoal): Promise<FinancialGoal> {
    const { data, error } = await supabase
      .from('financial_goals')
      .upsert([goal], { onConflict: 'user_id' })
      .select()
      .single();

    if (error) throw error;
    return data;
  }
};
