/**
 * Subscriptions Hook and Context Provider
 * Module: Subscriptions (subscriptions)
 * When to edit: When altering checkout intents, local caching schemas, or billing states.
 */

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from '../auth/auth.hooks';
import { STORAGE_PREFIX } from '../shared/constants';
import { Subscription, Payment, UserPlan, SubscriptionsContextType } from './subscriptions.types';
import { subscriptionsService } from './subscriptions.service';

export const SubscriptionsContext = createContext<SubscriptionsContextType | undefined>(undefined);

export const SubscriptionsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, profile, dbStatus, updateProfilePlanLocal } = useAuth();
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);

  useEffect(() => {
    const loadLocal = () => {
      const lSubscriptions = localStorage.getItem(`${STORAGE_PREFIX}subscriptions`);
      const lPayments = localStorage.getItem(`${STORAGE_PREFIX}payments`);
      setSubscriptions(lSubscriptions ? JSON.parse(lSubscriptions) : []);
      setPayments(lPayments ? JSON.parse(lPayments) : []);
    };

    if (dbStatus === 'connected') {
      const fetchData = async () => {
        try {
          const subs = await subscriptionsService.fetchAllSubscriptions();
          const pays = await subscriptionsService.fetchAllPayments();
          setSubscriptions(subs);
          setPayments(pays);
          localStorage.setItem(`${STORAGE_PREFIX}subscriptions`, JSON.stringify(subs));
          localStorage.setItem(`${STORAGE_PREFIX}payments`, JSON.stringify(pays));
        } catch (e) {
          console.warn('Subscriptions API failed; fallback to local lists:', e);
          loadLocal();
        }
      };
      fetchData();
    } else {
      loadLocal();
    }
  }, [user, dbStatus]);

  const updateSubscriptionStatus = async (userId: string, plan: UserPlan, status: 'active' | 'inactive' | 'pending') => {
    const existingIndex = subscriptions.findIndex(s => s.user_id === userId);
    let updatedSubs = [...subscriptions];

    if (dbStatus === 'connected') {
      try {
        const savedSub = await subscriptionsService.upsertSubscription(userId, plan, status);
        if (existingIndex !== -1) {
          updatedSubs[existingIndex] = savedSub;
        } else {
          updatedSubs.push(savedSub);
        }
      } catch (e) {
        console.error("Supabase error during updateSubscriptionStatus:", e);
      }
    } else {
      const id = existingIndex !== -1 ? subscriptions[existingIndex].id : 'sub-' + Math.random().toString(36).substring(2, 9);
      const subItem: Subscription = {
        id,
        user_id: userId,
        plan,
        status,
        created_at: existingIndex !== -1 ? subscriptions[existingIndex].created_at : new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      if (existingIndex !== -1) {
        updatedSubs[existingIndex] = subItem;
      } else {
        updatedSubs.push(subItem);
      }
    }

    setSubscriptions(updatedSubs);
    localStorage.setItem(`${STORAGE_PREFIX}subscriptions`, JSON.stringify(updatedSubs));

    const finalPlan = status === 'active' ? plan : 'free';
    if (dbStatus === 'connected') {
      try {
        await subscriptionsService.updateUserPlan(userId, finalPlan);
      } catch (e) {
        console.error(e);
      }
    }
    updateProfilePlanLocal(userId, finalPlan);
  };

  const requestUpgrade = async (plan: UserPlan) => {
    if (!profile) return;
    const amount = plan === 'pro_plus' ? 49.90 : 29.90;

    const newPayment: Payment = {
      id: 'pay-' + Math.random().toString(36).substring(2, 9),
      user_id: profile.id,
      amount,
      status: 'pending',
      plan,
      payment_method: 'mercado_pago_manual',
      created_at: new Date().toISOString()
    };

    if (dbStatus === 'connected') {
      try {
        await subscriptionsService.insertPayment(newPayment);
      } catch (e) {
        console.error("Supabase error during payment request:", e);
      }
    }

    const updatedPayments = [newPayment, ...payments];
    setPayments(updatedPayments);
    localStorage.setItem(`${STORAGE_PREFIX}payments`, JSON.stringify(updatedPayments));

    await updateSubscriptionStatus(profile.id, plan, 'pending');
  };

  const approvePayment = async (paymentId: string) => {
    const payment = payments.find(p => p.id === paymentId);
    if (!payment) return;

    if (dbStatus === 'connected') {
      try {
        await subscriptionsService.approvePayment(paymentId);
      } catch (e) {
        console.error("Supabase error during payment approval:", e);
      }
    }

    const updatedPayments = payments.map(p => 
      p.id === paymentId ? { ...p, status: 'approved' as const, approved_at: new Date().toISOString() } : p
    );
    setPayments(updatedPayments);
    localStorage.setItem(`${STORAGE_PREFIX}payments`, JSON.stringify(updatedPayments));

    await updateSubscriptionStatus(payment.user_id, payment.plan, 'active');
  };

  const rejectPayment = async (paymentId: string) => {
    const payment = payments.find(p => p.id === paymentId);
    if (!payment) return;

    if (dbStatus === 'connected') {
      try {
        await subscriptionsService.rejectPayment(paymentId);
      } catch (e) {
        console.error("Supabase error during payment rejection:", e);
      }
    }

    const updatedPayments = payments.map(p => 
      p.id === paymentId ? { ...p, status: 'rejected' as const } : p
    );
    setPayments(updatedPayments);
    localStorage.setItem(`${STORAGE_PREFIX}payments`, JSON.stringify(updatedPayments));

    await updateSubscriptionStatus(payment.user_id, payment.plan, 'inactive');
  };

  const setPaymentsState = (val: Payment[] | ((prev: Payment[]) => Payment[])) => {
    setPayments(val);
  };

  const setSubscriptionsState = (val: Subscription[] | ((prev: Subscription[]) => Subscription[])) => {
    setSubscriptions(val);
  };

  return (
    <SubscriptionsContext.Provider
      value={{
        subscriptions,
        payments,
        requestUpgrade,
        approvePayment,
        rejectPayment,
        updateSubscriptionStatus,
        setPaymentsState,
        setSubscriptionsState
      }}
    >
      {children}
    </SubscriptionsContext.Provider>
  );
};

export const useSubscriptions = () => {
  const context = useContext(SubscriptionsContext);
  if (context === undefined) {
    throw new Error('useSubscriptions must be used inside a SubscriptionsProvider');
  }
  return context;
};
export { subscriptionsService };
