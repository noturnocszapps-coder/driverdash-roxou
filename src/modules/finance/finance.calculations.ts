/**
 * Pure Mathematical Financial Calculations
 * Module: Finance (finance)
 * When to edit: When altering metrics algorithms, 90-day history filters, or averages calculations.
 */

import { Earning, Expense, FinancialMetrics } from './finance.types';
import { parseDateSecure } from '../shared/date.utils';

/**
 * Filter items to obey the 90-day history limit for free users.
 */
export const filterFreeTierHistory = <T extends { date: string }>(items: T[], isFree: boolean): T[] => {
  if (!isFree) return items;
  const limitDate = new Date();
  limitDate.setDate(limitDate.getDate() - 90);
  return items.filter(e => {
    const itemDate = parseDateSecure(e.date);
    return itemDate >= limitDate;
  });
};

/**
 * High-fidelity calculations resolving total revenue, expenses, profit, distances, and averages.
 */
export const calculateFinancialMetrics = (
  filteredEarnings: Earning[],
  filteredExpenses: Expense[]
): FinancialMetrics => {
  const totalRev = filteredEarnings.reduce((sum, e) => sum + Number(e?.gross_amount || 0), 0);
  const totalExp = filteredExpenses.reduce((sum, exp) => sum + Number(exp?.amount || 0), 0);
  const net = totalRev - totalExp;
  const totalDist = filteredEarnings.reduce((sum, e) => sum + Number(e?.total_km || 0), 0);
  const rides = filteredEarnings.reduce((sum, e) => sum + Number(e?.rides_count || 0), 0);
  const timeOnline = filteredEarnings.reduce((sum, e) => sum + Number(e?.online_minutes || 0), 0);
  const timeWaiting = filteredEarnings.reduce((sum, e) => sum + Number(e?.waiting_minutes || 0), 0);

  const costPerKm = totalDist > 0 ? totalExp / totalDist : 0;
  const profitPerKm = totalDist > 0 ? net / totalDist : 0;

  return {
    totalRevenue: totalRev,
    totalExpenses: totalExp,
    netProfit: net,
    totalKm: totalDist,
    costPerKm,
    profitPerKm,
    ridesCount: rides,
    onlineMinutes: timeOnline,
    waitingMinutes: timeWaiting,
  };
};
