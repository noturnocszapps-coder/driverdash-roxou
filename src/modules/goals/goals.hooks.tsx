/**
 * Goals Hooks and Context Provider
 * Module: Goals (goals)
 * When to edit: When altering goal synchronization state or localStorage patterns.
 */

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from '../auth/auth.hooks';
import { STORAGE_PREFIX } from '../shared/constants';
import { FinancialGoal, GoalsContextType } from './goals.types';
import { goalsService } from './goals.service';

export const GoalsContext = createContext<GoalsContextType | undefined>(undefined);

export const GoalsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, dbStatus } = useAuth();
  const [financialGoal, setFinancialGoal] = useState<FinancialGoal | null>(null);

  useEffect(() => {
    if (!user) {
      setFinancialGoal(null);
      return;
    }

    const loadLocal = () => {
      const lGoals = localStorage.getItem(`${STORAGE_PREFIX}goals_${user.id}`);
      setFinancialGoal(lGoals ? JSON.parse(lGoals) : null);
    };

    if (dbStatus === 'connected') {
      const fetchData = async () => {
        try {
          const goalData = await goalsService.fetchFinancialGoal(user.id);
          setFinancialGoal(goalData);
          if (goalData) {
            localStorage.setItem(`${STORAGE_PREFIX}goals_${user.id}`, JSON.stringify(goalData));
          }
        } catch (e) {
          console.warn('Goals fetch error, charging local backups:', e);
          loadLocal();
        }
      };
      fetchData();
    } else {
      loadLocal();
    }
  }, [user, dbStatus]);

  const upsertFinancialGoal = async (goalData: Omit<FinancialGoal, 'user_id' | 'id'>) => {
    if (!user) return;
    const item: FinancialGoal = {
      ...goalData,
      user_id: user.id,
      updated_at: new Date().toISOString()
    };
    if (financialGoal?.id) {
      item.id = financialGoal.id;
    }

    if (dbStatus === 'connected') {
      try {
        const saved = await goalsService.upsertFinancialGoal(item);
        setFinancialGoal(saved);
        localStorage.setItem(`${STORAGE_PREFIX}goals_${user.id}`, JSON.stringify(saved));
        return;
      } catch (err) {
        console.error('Remote save goals missed. Saving locally.', err);
      }
    }

    setFinancialGoal(item);
    localStorage.setItem(`${STORAGE_PREFIX}goals_${user.id}`, JSON.stringify(item));
  };

  return (
    <GoalsContext.Provider
      value={{
        financialGoal,
        upsertFinancialGoal
      }}
    >
      {children}
    </GoalsContext.Provider>
  );
};

export const useGoals = () => {
  const context = useContext(GoalsContext);
  if (context === undefined) {
    throw new Error('useGoals must be used inside a GoalsProvider');
  }
  return context;
};
export { goalsService };
