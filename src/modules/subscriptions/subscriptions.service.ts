/**
 * Subscriptions & Payments Service Routines
 * Module: Subscriptions (subscriptions)
 * When to edit: When connecting payment verification hooks, changing billing platforms, or adjusting remote schemas.
 */

import { supabase } from '../shared/supabase.helpers';
import { Subscription, Payment, UserPlan } from './subscriptions.types';

export const subscriptionsService = {
  /**
   * Fetches all registered system profiles.
   */
  async fetchAllProfiles() {
    const { data, error } = await supabase.from('profiles').select('*');
    if (error) throw error;
    return data || [];
  },

  /**
   * Fetches all active billing subscriptions.
   */
  async fetchAllSubscriptions(): Promise<Subscription[]> {
    const { data, error } = await supabase.from('subscriptions').select('*');
    if (error) throw error;
    return data || [];
  },

  /**
   * Fetches all support payment tickets.
   */
  async fetchAllPayments(): Promise<Payment[]> {
    const { data, error } = await supabase.from('payments').select('*');
    if (error) throw error;
    return data || [];
  },

  /**
   * Updates user profile tier directly.
   */
  async updateUserPlan(userId: string, plan: UserPlan): Promise<void> {
    const { error } = await supabase
      .from('profiles')
      .update({ plan })
      .eq('id', userId);

    if (error) throw error;
  },

  /**
   * Upserts subscription status records.
   */
  async upsertSubscription(userId: string, plan: UserPlan, status: 'active' | 'inactive' | 'pending'): Promise<Subscription> {
    const { data: existing } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    const payload = {
      plan,
      status,
      updated_at: new Date().toISOString()
    };

    if (existing) {
      const { data, error } = await supabase
        .from('subscriptions')
        .update(payload)
        .eq('user_id', userId)
        .select()
        .single();
      if (error) throw error;
      return data;
    } else {
      const newSub = {
        id: 'sub-' + Math.random().toString(36).substring(2, 9),
        user_id: userId,
        ...payload,
        created_at: new Date().toISOString()
      };
      const { data, error } = await supabase
        .from('subscriptions')
        .insert([newSub])
        .select()
        .single();
      if (error) throw error;
      return data;
    }
  },

  /**
   * Inserts upgrade payment record.
   */
  async insertPayment(payment: Payment): Promise<Payment> {
    const { data, error } = await supabase
      .from('payments')
      .insert([payment])
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Approves a specific pending payment transaction.
   */
  async approvePayment(paymentId: string): Promise<void> {
    const { error } = await supabase
      .from('payments')
      .update({ status: 'approved', approved_at: new Date().toISOString() })
      .eq('id', paymentId);

    if (error) throw error;
  },

  /**
   * Rejects a specific pending payment transaction.
   */
  async rejectPayment(paymentId: string): Promise<void> {
    const { error } = await supabase
      .from('payments')
      .update({ status: 'rejected' })
      .eq('id', paymentId);

    if (error) throw error;
  }
};
