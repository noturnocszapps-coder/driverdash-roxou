/**
 * Financial Management Type Definitions
 * Module: Finance (finance)
 * When to edit: When altering financial models, transaction models, or metrics schemas.
 */

import { Earning, Expense, DailyClosing, WeeklyClosing, PlatformType, ExpenseType, DriverCustomCost } from '../../types';

export type { Earning, Expense, DailyClosing, WeeklyClosing, PlatformType, ExpenseType, DriverCustomCost };

export interface FinancialMetrics {
  totalRevenue: number;
  totalExpenses: number;
  netProfit: number;
  totalKm: number;
  costPerKm: number;
  profitPerKm: number;
  ridesCount: number;
  onlineMinutes: number;
  waitingMinutes: number;
}

export interface FinanceContextType {
  earnings: Earning[];
  expenses: Expense[];
  dailyClosings: DailyClosing[];
  weeklyClosings: WeeklyClosing[];
  customCosts: DriverCustomCost[];
  metrics: FinancialMetrics;
  addEarning: (earningData: Omit<Earning, 'user_id' | 'id'>) => Promise<void>;
  addExpense: (expenseData: Omit<Expense, 'user_id' | 'id'>) => Promise<void>;
  deleteEarning: (id: string | undefined, indexLocal: number) => Promise<void>;
  deleteExpense: (id: string | undefined, indexLocal: number) => Promise<void>;
  createDailyClosing: (date: string) => Promise<DailyClosing>;
  createWeeklyClosing: (start: string, end: string) => Promise<WeeklyClosing>;
  addCustomCost: (costData: Omit<DriverCustomCost, 'user_id' | 'id'>) => Promise<void>;
  deleteCustomCost: (id: string | undefined, indexLocal: number) => Promise<void>;
}
