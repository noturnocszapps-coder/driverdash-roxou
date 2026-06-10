/**
 * Goals Completion & Progress Calculations
 * Module: Goals (goals)
 * When to edit: When altering projection metrics, progress calculation styles, or thresholds.
 */

import { FinancialGoal } from './goals.types';

export interface GoalsProgress {
  dailyPercent: number;
  weeklyPercent: number;
  monthlyPercent: number;
}

/**
 * Computes progress percentages for goals based on current gross achievements.
 */
export const calculateGoalsProgress = (
  goal: FinancialGoal | null,
  todayGross: number,
  weeklyGross: number,
  monthlyGross: number
): GoalsProgress => {
  if (!goal) {
    return { dailyPercent: 0, weeklyPercent: 0, monthlyPercent: 0 };
  }

  return {
    dailyPercent: goal.daily_goal > 0 ? Math.min(100, (todayGross / goal.daily_goal) * 100) : 0,
    weeklyPercent: goal.weekly_goal > 0 ? Math.min(100, (weeklyGross / goal.weekly_goal) * 100) : 0,
    monthlyPercent: goal.monthly_goal > 0 ? Math.min(100, (monthlyGross / goal.monthly_goal) * 100) : 0,
  };
};
