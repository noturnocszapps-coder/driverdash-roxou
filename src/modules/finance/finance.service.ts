/**
 * Financial Service Routines
 * Module: Finance (finance)
 * When to edit: When altering database schemas, transactions insertion endpoints, or remote deletion flows.
 */

import { supabase } from '../shared/supabase.helpers';
import { Earning, Expense, DailyClosing, WeeklyClosing } from './finance.types';

export const financeService = {
  /**
   * Fetches earnings from remote DB.
   */
  async fetchEarnings(userId: string): Promise<Earning[]> {
    const { data, error } = await supabase
      .from('earnings')
      .select('*')
      .eq('user_id', userId)
      .order('date', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  /**
   * Fetches expenses from remote DB.
   */
  async fetchExpenses(userId: string): Promise<Expense[]> {
    const { data, error } = await supabase
      .from('expenses')
      .select('*')
      .eq('user_id', userId)
      .order('date', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  /**
   * Fetches daily closings.
   */
  async fetchDailyClosings(userId: string): Promise<DailyClosing[]> {
    const { data, error } = await supabase
      .from('daily_closings')
      .select('*')
      .eq('user_id', userId)
      .order('date', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  /**
   * Fetches weekly closings.
   */
  async fetchWeeklyClosings(userId: string): Promise<WeeklyClosing[]> {
    const { data, error } = await supabase
      .from('weekly_closings')
      .select('*')
      .eq('user_id', userId)
      .order('week_start', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  /**
   * Remote insert of new Earning.
   */
  async addEarning(earning: Earning): Promise<Earning> {
    const { data, error } = await supabase
      .from('earnings')
      .insert([earning])
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Remote delete Earning.
   */
  async deleteEarning(id: string): Promise<void> {
    const { error } = await supabase
      .from('earnings')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },

  /**
   * Remote insert of new Expense.
   */
  async addExpense(expense: Expense): Promise<Expense> {
    const { data, error } = await supabase
      .from('expenses')
      .insert([expense])
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Remote delete Expense.
   */
  async deleteExpense(id: string): Promise<void> {
    const { error } = await supabase
      .from('expenses')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },

  /**
   * Remote insert Daily Closing entry.
   */
  async createDailyClosing(daily: DailyClosing): Promise<DailyClosing> {
    const { data, error } = await supabase
      .from('daily_closings')
      .insert([daily])
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Remote insert Weekly Closing entry.
   */
  async createWeeklyClosing(weekly: WeeklyClosing): Promise<WeeklyClosing> {
    const { data, error } = await supabase
      .from('weekly_closings')
      .insert([weekly])
      .select()
      .single();

    if (error) throw error;
    return data;
  }
};
