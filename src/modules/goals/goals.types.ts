/**
 * Financial Goals Type Definitions
 * Module: Goals (goals)
 * When to edit: When altering financial target fields or goals calculations structures.
 */

import { FinancialGoal } from '../../types';

export type { FinancialGoal };

export interface GoalsContextType {
  financialGoal: FinancialGoal | null;
  upsertFinancialGoal: (goalData: Omit<FinancialGoal, 'user_id' | 'id'>) => Promise<void>;
}
