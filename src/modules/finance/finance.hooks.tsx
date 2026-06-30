/**
 * Finance Hook and Context Provider
 * Module: Finance (finance)
 * When to edit: When updating financial state workflows, local-storage formats, or syncing actions.
 */

import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { useAuth } from '../auth/auth.hooks';
import { STORAGE_PREFIX } from '../shared/constants';
import { Earning, Expense, DailyClosing, WeeklyClosing, FinancialMetrics, FinanceContextType, DriverCustomCost } from './finance.types';
import { financeService } from './finance.service';
import { financeIntelligenceService } from './financeIntelligence.service';
import { calculateFinancialMetrics, filterFreeTierHistory } from './finance.calculations';

export const FinanceContext = createContext<FinanceContextType | undefined>(undefined);

export const FinanceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, profile, dbStatus } = useAuth();
  
  const [earnings, setEarnings] = useState<Earning[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [dailyClosings, setDailyClosings] = useState<DailyClosing[]>([]);
  const [weeklyClosings, setWeeklyClosings] = useState<WeeklyClosing[]>([]);
  const [customCosts, setCustomCosts] = useState<DriverCustomCost[]>([]);

  // Local backups helper loaded directly if fallback
  useEffect(() => {
    if (!user) {
      setEarnings([]);
      setExpenses([]);
      setDailyClosings([]);
      setWeeklyClosings([]);
      setCustomCosts([]);
      return;
    }

    const loadLocal = () => {
      const lEarnings = localStorage.getItem(`${STORAGE_PREFIX}earnings_${user.id}`);
      const lExpenses = localStorage.getItem(`${STORAGE_PREFIX}expenses_${user.id}`);
      const lDaily = localStorage.getItem(`${STORAGE_PREFIX}daily_${user.id}`);
      const lWeekly = localStorage.getItem(`${STORAGE_PREFIX}weekly_${user.id}`);
      const lCustom = localStorage.getItem(`${STORAGE_PREFIX}custom_costs_${user.id}`);

      setEarnings(lEarnings ? JSON.parse(lEarnings) : []);
      setExpenses(lExpenses ? JSON.parse(lExpenses) : []);
      setDailyClosings(lDaily ? JSON.parse(lDaily) : []);
      setWeeklyClosings(lWeekly ? JSON.parse(lWeekly) : []);
      setCustomCosts(lCustom ? JSON.parse(lCustom) : []);
    };

    if (dbStatus === 'connected') {
      const fetchData = async () => {
        try {
          const earn = await financeService.fetchEarnings(user.id);
          const expResult = await financeService.fetchExpenses(user.id);
          const dailyRes = await financeService.fetchDailyClosings(user.id);
          const weeklyRes = await financeService.fetchWeeklyClosings(user.id);
          const customRes = await financeIntelligenceService.fetchCustomCosts(user.id);

          setEarnings(earn);
          setExpenses(expResult);
          setDailyClosings(dailyRes);
          setWeeklyClosings(weeklyRes);
          setCustomCosts(customRes);

          // Update backups
          localStorage.setItem(`${STORAGE_PREFIX}earnings_${user.id}`, JSON.stringify(earn));
          localStorage.setItem(`${STORAGE_PREFIX}expenses_${user.id}`, JSON.stringify(expResult));
          localStorage.setItem(`${STORAGE_PREFIX}daily_${user.id}`, JSON.stringify(dailyRes));
          localStorage.setItem(`${STORAGE_PREFIX}weekly_${user.id}`, JSON.stringify(weeklyRes));
          localStorage.setItem(`${STORAGE_PREFIX}custom_costs_${user.id}`, JSON.stringify(customRes));
        } catch (e) {
          console.warn('Finance query error; fetching from local storage backup:', e);
          loadLocal();
        }
      };
      fetchData();
    } else {
      loadLocal();
    }
  }, [user, dbStatus]);

  // Handle Free plan limit: only see 90 days of history
  const isFree = useMemo(() => {
    return !profile || profile.plan === 'free';
  }, [profile]);

  const outputEarnings = useMemo(() => {
    return filterFreeTierHistory(earnings, isFree);
  }, [earnings, isFree]);

  const outputExpenses = useMemo(() => {
    return filterFreeTierHistory(expenses, isFree);
  }, [expenses, isFree]);

  // Derived high fidelity metrics
  const metrics: FinancialMetrics = useMemo(() => {
    return calculateFinancialMetrics(outputEarnings, outputExpenses);
  }, [outputEarnings, outputExpenses]);

  const addEarning = async (earningData: Omit<Earning, 'user_id' | 'id'>) => {
    if (!user) return;
    const item: Earning = {
      ...earningData,
      user_id: user.id,
      created_at: new Date().toISOString()
    };

    if (dbStatus === 'connected') {
      try {
        const saved = await financeService.addEarning(item);
        const updated = [saved, ...earnings];
        setEarnings(updated);
        localStorage.setItem(`${STORAGE_PREFIX}earnings_${user.id}`, JSON.stringify(updated));
        return;
      } catch (err) {
        console.error('Remote save earnings missed. Storing locally instead.', err);
      }
    }

    const localItem = { ...item, id: 'lcl-ern-' + Math.random().toString(36).substring(2, 9) };
    const updated = [localItem, ...earnings];
    setEarnings(updated);
    localStorage.setItem(`${STORAGE_PREFIX}earnings_${user.id}`, JSON.stringify(updated));
  };

  const deleteEarning = async (id: string | undefined, indexLocal: number) => {
    if (!user) return;
    if (dbStatus === 'connected' && id && !id.startsWith('lcl-')) {
      try {
        await financeService.deleteEarning(id);
      } catch (e) {
        console.error('Error deleting remote earning:', e);
      }
    }
    const updated = earnings.filter((e, idx) => e.id !== id && idx !== indexLocal);
    setEarnings(updated);
    localStorage.setItem(`${STORAGE_PREFIX}earnings_${user.id}`, JSON.stringify(updated));
  };

  const addExpense = async (expenseData: Omit<Expense, 'user_id' | 'id'>) => {
    if (!user) return;
    const item: Expense = {
      ...expenseData,
      user_id: user.id,
      created_at: new Date().toISOString()
    };

    if (dbStatus === 'connected') {
      try {
        const saved = await financeService.addExpense(item);
        const updated = [saved, ...expenses];
        setExpenses(updated);
        localStorage.setItem(`${STORAGE_PREFIX}expenses_${user.id}`, JSON.stringify(updated));
        return;
      } catch (err) {
        console.error('Remote save expense settings missed. Saving locally.', err);
      }
    }

    const localItem = { ...item, id: 'lcl-exp-' + Math.random().toString(36).substring(2, 9) };
    const updated = [localItem, ...expenses];
    setExpenses(updated);
    localStorage.setItem(`${STORAGE_PREFIX}expenses_${user.id}`, JSON.stringify(updated));
  };

  const deleteExpense = async (id: string | undefined, indexLocal: number) => {
    if (!user) return;
    if (dbStatus === 'connected' && id && !id.startsWith('lcl-')) {
      try {
        await financeService.deleteExpense(id);
      } catch (e) {
        console.error('Error deleting remote expense:', e);
      }
    }
    const updated = expenses.filter((e, idx) => e.id !== id && idx !== indexLocal);
    setExpenses(updated);
    localStorage.setItem(`${STORAGE_PREFIX}expenses_${user.id}`, JSON.stringify(updated));
  };

  const createDailyClosing = async (date: string): Promise<DailyClosing> => {
    if (!user) throw new Error('Unauthenticated');
    
    const dateEarnings = earnings.filter(e => e.date === date);
    const dateExpenses = expenses.filter(e => e.date === date);

    const gross = dateEarnings.reduce((sum, e) => sum + Number(e.gross_amount), 0);
    const cost = dateExpenses.reduce((sum, exp) => sum + Number(exp.amount), 0);
    const net = gross - cost;
    const km = dateEarnings.reduce((sum, e) => sum + Number(e.total_km), 0);
    
    const costPerKm = km > 0 ? cost / km : 0;
    const profitPerKm = km > 0 ? net / km : 0;

    const closing: DailyClosing = {
      user_id: user.id,
      date,
      gross_amount: gross,
      total_expenses: cost,
      net_profit: net,
      total_km: km,
      cost_per_km: costPerKm,
      profit_per_km: profitPerKm,
      created_at: new Date().toISOString()
    };

    if (dbStatus === 'connected') {
      try {
        const saved = await financeService.createDailyClosing(closing);
        const updated = [saved, ...dailyClosings];
        setDailyClosings(updated);
        localStorage.setItem(`${STORAGE_PREFIX}daily_${user.id}`, JSON.stringify(updated));
        return saved;
      } catch (e) {
        console.error('Remote Daily Closing failed. Storing locally.', e);
      }
    }

    const localItem = { ...closing, id: 'lcl-dc-' + Math.random().toString(36).substring(2, 9) };
    const updated = [localItem, ...dailyClosings];
    setDailyClosings(updated);
    localStorage.setItem(`${STORAGE_PREFIX}daily_${user.id}`, JSON.stringify(updated));
    return localItem;
  };

  const createWeeklyClosing = async (start: string, end: string): Promise<WeeklyClosing> => {
    if (!user) throw new Error('Unauthenticated');
    
    const sDate = new Date(start);
    const eDate = new Date(end);
    
    const weekEarnings = earnings.filter(e => {
      const d = new Date(e.date);
      return d >= sDate && d <= eDate;
    });
    
    const weekExpenses = expenses.filter(e => {
      const d = new Date(e.date);
      return d >= sDate && d <= eDate;
    });

    const gross = weekEarnings.reduce((sum, e) => sum + Number(e.gross_amount), 0);
    const cost = weekExpenses.reduce((sum, exp) => sum + Number(exp.amount), 0);
    const net = gross - cost;
    const km = weekEarnings.reduce((sum, e) => sum + Number(e.total_km), 0);
    
    const costPerKm = km > 0 ? cost / km : 0;
    const profitPerKm = km > 0 ? net / km : 0;

    const closing: WeeklyClosing = {
      user_id: user.id,
      week_start: start,
      week_end: end,
      gross_amount: gross,
      total_expenses: cost,
      net_profit: net,
      total_km: km,
      cost_per_km: costPerKm,
      profit_per_km: profitPerKm,
      created_at: new Date().toISOString()
    };

    if (dbStatus === 'connected') {
      try {
        const saved = await financeService.createWeeklyClosing(closing);
        const updated = [saved, ...weeklyClosings];
        setWeeklyClosings(updated);
        localStorage.setItem(`${STORAGE_PREFIX}weekly_${user.id}`, JSON.stringify(updated));
        return saved;
      } catch (e) {
        console.error('Remote Weekly Closing failed. Storing locally.', e);
      }
    }

    const localItem = { ...closing, id: 'lcl-wc-' + Math.random().toString(36).substring(2, 9) };
    const updated = [localItem, ...weeklyClosings];
    setWeeklyClosings(updated);
    localStorage.setItem(`${STORAGE_PREFIX}weekly_${user.id}`, JSON.stringify(updated));
    return localItem;
  };

  const addCustomCost = async (costData: Omit<DriverCustomCost, 'user_id' | 'id'>) => {
    if (!user) return;
    const item: DriverCustomCost = {
      ...costData,
      user_id: user.id,
      created_at: new Date().toISOString()
    } as any;

    if (dbStatus === 'connected') {
      try {
        const saved = await financeIntelligenceService.addCustomCost(item);
        const updated = [saved, ...customCosts];
        setCustomCosts(updated);
        localStorage.setItem(`${STORAGE_PREFIX}custom_costs_${user.id}`, JSON.stringify(updated));
        return;
      } catch (err) {
        console.error('Remote custom cost save missed. Saving locally.', err);
      }
    }

    const localItem = { ...item, id: 'lcl-cst-' + Math.random().toString(36).substring(2, 9) };
    const updated = [localItem, ...customCosts];
    setCustomCosts(updated);
    localStorage.setItem(`${STORAGE_PREFIX}custom_costs_${user.id}`, JSON.stringify(updated));
  };

  const deleteCustomCost = async (id: string | undefined, indexLocal: number) => {
    if (!user) return;
    if (dbStatus === 'connected' && id && !id.startsWith('lcl-')) {
      try {
        await financeIntelligenceService.deleteCustomCost(id);
      } catch (e) {
        console.error('Error deleting remote custom cost:', e);
      }
    }
    const updated = customCosts.filter((e, idx) => e.id !== id && idx !== indexLocal);
    setCustomCosts(updated);
    localStorage.setItem(`${STORAGE_PREFIX}custom_costs_${user.id}`, JSON.stringify(updated));
  };

  return (
    <FinanceContext.Provider
      value={{
        earnings: outputEarnings,
        expenses: outputExpenses,
        dailyClosings,
        weeklyClosings,
        customCosts,
        metrics,
        addEarning,
        addExpense,
        deleteEarning,
        deleteExpense,
        createDailyClosing,
        createWeeklyClosing,
        addCustomCost,
        deleteCustomCost
      }}
    >
      {children}
    </FinanceContext.Provider>
  );
};

export const useFinance = () => {
  const context = useContext(FinanceContext);
  if (context === undefined) {
    throw new Error('useFinance must be used inside a FinanceProvider');
  }
  return context;
};
export { financeService };
