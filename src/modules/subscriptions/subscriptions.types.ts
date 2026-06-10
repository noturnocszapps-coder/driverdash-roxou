/**
 * Subscriptions and Commercial Management Type Definitions
 * Module: Subscriptions (subscriptions)
 * When to edit: When updating subscription periods, payment status keys, or system plan lists.
 */

import React from 'react';
import { Subscription, Payment, UserPlan } from '../../types';

export type { Subscription, Payment, UserPlan };

export interface SubscriptionsContextType {
  subscriptions: Subscription[];
  payments: Payment[];
  requestUpgrade: (plan: UserPlan) => Promise<void>;
  approvePayment: (paymentId: string) => Promise<void>;
  rejectPayment: (paymentId: string) => Promise<void>;
  updateSubscriptionStatus: (userId: string, plan: UserPlan, status: 'active' | 'inactive' | 'pending') => Promise<void>;
  setPaymentsState: React.Dispatch<React.SetStateAction<Payment[]>>;
  setSubscriptionsState: React.Dispatch<React.SetStateAction<Subscription[]>>;
}
