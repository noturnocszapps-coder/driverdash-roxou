/**
 * Driver Finance Intelligence V1 Engine Service
 * Module: Finance (finance)
 * Purpose: Centralizes advanced operational and financial analytics, including custom cost apportionments,
 * period-specific metrics (Hoje, Ontem, Semana, Mês, Ano), financial forecasts, AI copilot feedback, and simulators.
 */

import { supabase } from '../shared/supabase.helpers';
import { Earning, Expense, DriverCustomCost, FinancialGoal, VehicleCostSettings } from '../../types';
import { parseDateSecure } from '../shared/date.utils';

// Helper for formatting currency
export function formatCurrency(val: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
}

// Periods defined for financial dashboard
export type FinancePeriod = 'today' | 'yesterday' | 'week' | 'month' | 'year' | 'all';

export interface ExtendedFinancialMetrics {
  grossRevenue: number;         // Receita Bruta
  realExpenses: number;         // Despesas Reais (lançadas manualmente)
  apportionedCosts: number;     // Custos Operacionais Rateados (combustível, pneus, etc.)
  totalExpenses: number;        // Despesas Totais = Reais + Rateados
  netProfit: number;            // Lucro Líquido
  operatingCost: number;        // Custo Operacional Total
  roi: number;                  // Retorno sobre Investimento (%)
  netMargin: number;            // Margem Líquida (%)
  profitPerHour: number;        // Lucro por Hora
  profitPerKm: number;          // Lucro por KM
  revenuePerKm: number;         // Receita por KM
  revenuePerHour: number;       // Receita por Hora
  totalKm: number;
  totalHours: number;
  ridesCount: number;
}

export interface FinancialForecast {
  projectedRevenue: number;
  projectedExpenses: number;
  projectedProfit: number;
  dailyGoal: number;
  weeklyGoal: number;
  monthlyGoal: number;
  yearlyGoal: number;
  cashFlowState: 'positive' | 'neutral' | 'negative';
}

export interface CopilotRecommendation {
  id: string;
  type: 'success' | 'warning' | 'info' | 'danger';
  title: string;
  text: string;
}

export interface FinanceIntelligenceResult {
  metrics: Record<FinancePeriod, ExtendedFinancialMetrics>;
  forecast: FinancialForecast;
  recommendations: CopilotRecommendation[];
  score: number; // Copiloto Financeiro Score (0-100)
  maintenanceAlerts: { id: string; title: string; category: string; description: string; urgency: 'high' | 'medium' | 'low' }[];
}

export const financeIntelligenceService = {
  /**
   * Fetches custom costs from remote DB safely.
   */
  async fetchCustomCosts(userId: string): Promise<DriverCustomCost[]> {
    const { data, error } = await supabase
      .from('driver_custom_costs')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('[FinanceIntelligence] Custom costs table query failed, utilizing fallback defaults.');
      return this.getFallbackCustomCosts(userId);
    }
    
    // If the table exists but is empty, pre-populate default costs
    if (!data || data.length === 0) {
      const defaults = this.getFallbackCustomCosts(userId);
      // Try to bulk insert defaults to make the app fully ready
      try {
        await supabase.from('driver_custom_costs').insert(defaults);
      } catch (e) {
        console.error('[FinanceIntelligence] Failed to auto-insert default custom costs:', e);
      }
      return defaults;
    }

    return data.map(item => ({
      ...item,
      amount: Number(item.amount),
      apportionment_km: Number(item.apportionment_km),
      apportionment_hour: Number(item.apportionment_hour),
      apportionment_day: Number(item.apportionment_day)
    }));
  },

  /**
   * Remote insert of custom apportioned cost
   */
  async addCustomCost(cost: Omit<DriverCustomCost, 'id'>): Promise<DriverCustomCost> {
    const { data, error } = await supabase
      .from('driver_custom_costs')
      .insert([cost])
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Remote deletion of custom cost
   */
  async deleteCustomCost(id: string): Promise<void> {
    const { error } = await supabase
      .from('driver_custom_costs')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },

  /**
   * Safe defaults for pre-populating cost settings (Combustível, Seguro, Manutenção, etc.)
   */
  getFallbackCustomCosts(userId: string): DriverCustomCost[] {
    return [
      {
        user_id: userId,
        name: 'Combustível (Gasolina)',
        category: 'fuel',
        amount: 5.69,
        periodicity: 'per_km',
        apportionment_km: 0.42, // R$ 0.42 por KM rodado
        apportionment_hour: 0.0,
        apportionment_day: 0.0
      },
      {
        user_id: userId,
        name: 'Seguro Veicular Uber/99',
        category: 'insurance',
        amount: 250.0,
        periodicity: 'monthly',
        apportionment_km: 0.0,
        apportionment_hour: 0.0,
        apportionment_day: 8.33 // R$ 8.33 rateados por dia
      },
      {
        user_id: userId,
        name: 'Depreciação de Ativo',
        category: 'depreciaction' as any, // Depreciação
        amount: 400.0,
        periodicity: 'monthly',
        apportionment_km: 0.05, // R$ 0.05 por KM
        apportionment_hour: 0.0,
        apportionment_day: 0.0
      },
      {
        user_id: userId,
        name: 'Troca de Óleo e Filtros',
        category: 'oil',
        amount: 220.0,
        periodicity: 'monthly',
        apportionment_km: 0.02, // R$ 0.02 por KM
        apportionment_hour: 0.0,
        apportionment_day: 0.0
      },
      {
        user_id: userId,
        name: 'Lavagem Semanal',
        category: 'washing',
        amount: 40.0,
        periodicity: 'per_day',
        apportionment_km: 0.0,
        apportionment_hour: 0.0,
        apportionment_day: 5.71 // R$ 5.71 por dia
      },
      {
        user_id: userId,
        name: 'Pastilhas de Freio',
        category: 'brakes',
        amount: 180.0,
        periodicity: 'yearly',
        apportionment_km: 0.01,
        apportionment_hour: 0.0,
        apportionment_day: 0.0
      }
    ];
  },

  /**
   * Filter tools to break down array elements into Brazilian Local periods (Hoje, Ontem, etc.)
   */
  filterByPeriod<T extends { date: string }>(items: T[], period: FinancePeriod): T[] {
    // Current date in Brazil/São_Paulo timezone (approx offset)
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    // Yesterday
    const yesterday = new Date();
    yesterday.setDate(now.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    // Start of week (Monday)
    const currentDay = now.getDay();
    const distanceToMonday = currentDay === 0 ? -6 : 1 - currentDay;
    const monday = new Date();
    monday.setDate(now.getDate() + distanceToMonday);
    monday.setHours(0,0,0,0);

    // Start of month
    const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);

    // Start of year
    const firstOfYear = new Date(now.getFullYear(), 0, 1, 0, 0, 0);

    return items.filter(item => {
      const itemDateStr = item.date;
      const itemDate = new Date(itemDateStr + 'T12:00:00'); // secure local parse

      switch (period) {
        case 'today':
          return itemDateStr === todayStr;
        case 'yesterday':
          return itemDateStr === yesterdayStr;
        case 'week':
          return itemDate >= monday && itemDate <= now;
        case 'month':
          return itemDate >= firstOfMonth && itemDate <= now;
        case 'year':
          return itemDate >= firstOfYear && itemDate <= now;
        case 'all':
        default:
          return true;
      }
    });
  },

  /**
   * Central math engine evaluating costs, rates, and margins.
   */
  calculatePeriodMetrics(
    earnings: Earning[],
    expenses: Expense[],
    customCosts: DriverCustomCost[],
    period: FinancePeriod
  ): ExtendedFinancialMetrics {
    const pEarnings = this.filterByPeriod(earnings, period);
    const pExpenses = this.filterByPeriod(expenses, period);

    const grossRevenue = pEarnings.reduce((sum, e) => sum + Number(e.gross_amount), 0);
    const realExpenses = pExpenses.reduce((sum, exp) => sum + Number(exp.amount), 0);
    const totalKm = pEarnings.reduce((sum, e) => sum + Number(e.total_km), 0);
    const totalHours = pEarnings.reduce((sum, e) => sum + Number(e.online_minutes || 0) / 60, 0);
    const ridesCount = pEarnings.reduce((sum, e) => sum + Number(e.rides_count || 0), 0);

    // Calculate dynamic apportioned costs
    // These represent calculated depreciation, fuel burn per KM, insurance daily rateio, etc.
    let apportionedCosts = 0;
    
    // We figure out the unique number of active days in the period
    const uniqueDays = new Set(pEarnings.map(e => e.date)).size || (period === 'today' || period === 'yesterday' ? 1 : 0);

    for (const cost of customCosts) {
      // 1. KM apportionment
      if (cost.apportionment_km > 0) {
        apportionedCosts += totalKm * cost.apportionment_km;
      }
      // 2. Hour apportionment
      if (cost.apportionment_hour > 0) {
        apportionedCosts += totalHours * cost.apportionment_hour;
      }
      // 3. Day apportionment
      if (cost.apportionment_day > 0) {
        apportionedCosts += uniqueDays * cost.apportionment_day;
      }

      // If they don't have custom apportionment rates but have fixed monthly/yearly values, we apportion them dynamically
      if (cost.apportionment_km === 0 && cost.apportionment_hour === 0 && cost.apportionment_day === 0) {
        if (cost.periodicity === 'monthly') {
          // approx R$ per day
          const dailyRate = cost.amount / 30;
          apportionedCosts += uniqueDays * dailyRate;
        } else if (cost.periodicity === 'yearly') {
          const dailyRate = cost.amount / 365;
          apportionedCosts += uniqueDays * dailyRate;
        } else if (cost.periodicity === 'per_km') {
          // Assume average car does 10km per liter
          const kmRate = cost.category === 'fuel' ? (cost.amount / 10) : 0.05;
          apportionedCosts += totalKm * kmRate;
        } else if (cost.periodicity === 'per_day') {
          apportionedCosts += uniqueDays * cost.amount;
        }
      }
    }

    const totalExpenses = realExpenses + apportionedCosts;
    const netProfit = grossRevenue - totalExpenses;
    const operatingCost = totalExpenses;

    const roi = totalExpenses > 0 ? (netProfit / totalExpenses) * 100 : 0;
    const netMargin = grossRevenue > 0 ? (netProfit / grossRevenue) * 100 : 0;

    const profitPerHour = totalHours > 0 ? netProfit / totalHours : 0;
    const profitPerKm = totalKm > 0 ? netProfit / totalKm : 0;
    const revenuePerKm = totalKm > 0 ? grossRevenue / totalKm : 0;
    const revenuePerHour = totalHours > 0 ? grossRevenue / totalHours : 0;

    return {
      grossRevenue,
      realExpenses,
      apportionedCosts,
      totalExpenses,
      netProfit,
      operatingCost,
      roi,
      netMargin,
      profitPerHour,
      profitPerKm,
      revenuePerKm,
      revenuePerHour,
      totalKm,
      totalHours,
      ridesCount
    };
  },

  /**
   * Produces predictive forecast models, target milestones and cash flow.
   */
  calculateForecasts(
    earnings: Earning[],
    customCosts: DriverCustomCost[],
    goal: FinancialGoal | null
  ): FinancialForecast {
    // Get daily goal
    const dailyGoal = goal?.daily_goal || 250;
    const weeklyGoal = goal?.weekly_goal || 1500;
    const monthlyGoal = goal?.monthly_goal || 6000;
    const yearlyGoal = goal?.monthly_goal ? goal.monthly_goal * 12 : 72000;

    // Calculate historical daily averages from last 30 active days
    const uniqueDates = Array.from(new Set(earnings.map(e => e.date))).sort();
    const last30Dates = uniqueDates.slice(-30);

    let totalRecentGross = 0;
    let totalRecentKm = 0;
    let totalRecentHours = 0;

    const recentEarnings = earnings.filter(e => last30Dates.includes(e.date));
    for (const e of recentEarnings) {
      totalRecentGross += Number(e.gross_amount);
      totalRecentKm += Number(e.total_km);
      totalRecentHours += Number(e.online_minutes || 0) / 60;
    }

    const activeDaysCount = last30Dates.length || 1;
    const avgGrossPerDay = totalRecentGross / activeDaysCount;
    const avgKmPerDay = totalRecentKm / activeDaysCount;
    const avgHoursPerDay = totalRecentHours / activeDaysCount;

    // Daily apportioned expenses
    let dailyCost = 0;
    for (const cost of customCosts) {
      if (cost.apportionment_km > 0) dailyCost += avgKmPerDay * cost.apportionment_km;
      if (cost.apportionment_hour > 0) dailyCost += avgHoursPerDay * cost.apportionment_hour;
      if (cost.apportionment_day > 0) dailyCost += cost.apportionment_day;
      if (cost.apportionment_km === 0 && cost.apportionment_hour === 0 && cost.apportionment_day === 0) {
        if (cost.periodicity === 'monthly') dailyCost += cost.amount / 30;
        else if (cost.periodicity === 'yearly') dailyCost += cost.amount / 365;
        else if (cost.periodicity === 'per_day') dailyCost += cost.amount;
      }
    }

    // Projections
    const projectedRevenue = avgGrossPerDay;
    const projectedExpenses = dailyCost;
    const projectedProfit = projectedRevenue - projectedExpenses;

    const cashFlowState = projectedProfit > 50 ? 'positive' : projectedProfit > 0 ? 'neutral' : 'negative';

    return {
      projectedRevenue,
      projectedExpenses,
      projectedProfit,
      dailyGoal,
      weeklyGoal,
      monthlyGoal,
      yearlyGoal,
      cashFlowState
    };
  },

  /**
   * Evaluates alerts and preventative updates needed.
   */
  generateMaintenanceAlerts(
    earnings: Earning[],
    expenses: Expense[],
    settings: VehicleCostSettings | null
  ): { id: string; title: string; category: string; description: string; urgency: 'high' | 'medium' | 'low' }[] {
    const alerts: any[] = [];
    
    // Sum total distance recorded
    const totalKm = earnings.reduce((sum, e) => sum + Number(e.total_km), 0);

    // Get last oil change expense
    const oilExpenses = expenses.filter(e => e.type === 'oil');
    const lastOilChangeKm = oilExpenses.length > 0 ? totalKm - 4500 : 0; // fallback proxy

    const oilInterval = settings?.oil_change_interval_km || 10000;
    const oilDistancePassed = totalKm - lastOilChangeKm;

    if (oilDistancePassed >= oilInterval - 1000) {
      alerts.push({
        id: 'oil_change_alert',
        title: 'Revisão: Troca de Óleo Próxima 🛢️',
        category: 'oil',
        description: `Já se passaram ${oilDistancePassed.toFixed(0)} km desde o último registro. O recomendado é trocar a cada ${oilInterval} km.`,
        urgency: oilDistancePassed >= oilInterval ? 'high' : 'medium'
      });
    }

    // Tire wear check
    const tireExpenses = expenses.filter(e => e.type === 'tires');
    const lastTireKm = tireExpenses.length > 0 ? totalKm - 15000 : 0;
    const tireLifespan = settings?.tire_lifespan_km || 40000;
    const tireDistancePassed = totalKm - lastTireKm;

    if (tireDistancePassed >= tireLifespan - 5000) {
      alerts.push({
        id: 'tires_alert',
        title: 'Inspeção: Desgaste de Pneus 🚗',
        category: 'tires',
        description: `Seus pneus estão com estimativa de rodagem de ${tireDistancePassed.toFixed(0)} km. Agende uma inspeção de sulco.`,
        urgency: tireDistancePassed >= tireLifespan ? 'high' : 'medium'
      });
    }

    // IPVA, Licensing alerts (Static warning based on calendar month)
    const currentMonth = new Date().getMonth() + 1;
    if (currentMonth === 1 || currentMonth === 2) {
      alerts.push({
        id: 'ipva_alert',
        title: 'Vencimento de IPVA e Taxas 📅',
        category: 'ipva',
        description: 'Primeiro trimestre fiscal. Certifique-se de regularizar as cotas do IPVA para evitar juros.',
        urgency: 'medium'
      });
    }

    return alerts;
  },

  /**
   * Core AI Copilot Engine producing precise advisory recommendation text and an overall operational score.
   */
  generateCopilotFeedback(
    metrics: Record<FinancePeriod, ExtendedFinancialMetrics>,
    forecast: FinancialForecast
  ): { recommendations: CopilotRecommendation[]; score: number } {
    const recommendations: CopilotRecommendation[] = [];
    let score = 90; // Default baseline score high

    const today = metrics.today;
    const yesterday = metrics.yesterday;
    const week = metrics.week;

    // 1. Goal achievements
    if (today.grossRevenue >= forecast.dailyGoal) {
      recommendations.push({
        id: 'goal_reached',
        type: 'success',
        title: 'Meta Batida! 🎉',
        text: `Parabéns! Você atingiu sua meta diária de ${formatCurrency(forecast.dailyGoal)}. O faturamento líquido acumulado é de ${formatCurrency(today.netProfit)}.`
      });
      score += 5;
    } else if (today.grossRevenue > 0) {
      const remaining = forecast.dailyGoal - today.grossRevenue;
      recommendations.push({
        id: 'goal_pending',
        type: 'info',
        title: 'Ainda faltam faturar',
        text: `Faltam apenas ${formatCurrency(remaining)} para bater sua meta diária de ${formatCurrency(forecast.dailyGoal)}. Mantenha o foco!`
      });
      score -= 2;
    }

    // 2. Performance comparison (Hoje vs Ontem)
    if (today.grossRevenue > 0 && yesterday.grossRevenue > 0) {
      if (today.profitPerHour > yesterday.profitPerHour) {
        recommendations.push({
          id: 'perf_better_today',
          type: 'success',
          title: 'Melhora no Rendimento Horário 📈',
          text: `Excelente! Hoje seu lucro líquido por hora está em ${formatCurrency(today.profitPerHour)}/h, superando os ${formatCurrency(yesterday.profitPerHour)}/h de ontem.`
        });
        score += 3;
      } else {
        recommendations.push({
          id: 'perf_lower_today',
          type: 'warning',
          title: 'Lucro Horário abaixo de ontem ⏱️',
          text: `Seu lucro de hoje (${formatCurrency(today.profitPerHour)}/h) está inferior ao rendimento de ontem (${formatCurrency(yesterday.profitPerHour)}/h). Avalie mudar de região.`
        });
        score -= 5;
      }
    }

    // 3. Operational costs and margins
    if (week.grossRevenue > 0) {
      if (week.netMargin < 55) {
        recommendations.push({
          id: 'margin_warning',
          type: 'danger',
          title: 'Margem de Lucro Estreita ⚠️',
          text: `Atenção: Sua margem líquida semanal caiu para ${week.netMargin.toFixed(1)}%. Seu custo por KM (${formatCurrency(week.totalExpenses / (week.totalKm || 1))}/km) está elevado.`
        });
        score -= 15;
      } else if (week.netMargin > 70) {
        recommendations.push({
          id: 'margin_high',
          type: 'success',
          title: 'Excelente Margem de Lucro ✨',
          text: `Sua margem líquida semanal está espetacular (${week.netMargin.toFixed(1)}%). Continue utilizando a classificação de telemetria inteligente.`
        });
        score += 4;
      }
    }

    // 4. Worth working advisory
    if (forecast.projectedProfit < 15 && forecast.projectedRevenue > 0) {
      recommendations.push({
        id: 'worth_working_danger',
        type: 'danger',
        title: 'Risco Operacional: Alto custo por hora',
        text: `Com os custos atuais rateados, o lucro estimado por hora de trabalho está marginal. Considere rodar em horários de pico dinâmico.`
      });
      score -= 10;
    } else if (today.grossRevenue === 0) {
      recommendations.push({
        id: 'not_started',
        type: 'info',
        title: 'Copiloto de Prontidão 🤖',
        text: 'Inicie sua jornada inteligente para que eu possa avaliar sua taxa de lucro e custos de rateio realistas.'
      });
    }

    // Boundaries
    score = Math.max(10, Math.min(100, score));

    return { recommendations, score };
  },

  /**
   * Comprehensive aggregate of all intelligence modules. Executes in background with useMemo in frontend.
   */
  computeFinanceIntelligence(
    earnings: Earning[],
    expenses: Expense[],
    customCosts: DriverCustomCost[],
    goal: FinancialGoal | null,
    settings: VehicleCostSettings | null
  ): FinanceIntelligenceResult {
    // 1. Calculate metric snapshots for each period
    const metrics: Record<FinancePeriod, ExtendedFinancialMetrics> = {
      today: this.calculatePeriodMetrics(earnings, expenses, customCosts, 'today'),
      yesterday: this.calculatePeriodMetrics(earnings, expenses, customCosts, 'yesterday'),
      week: this.calculatePeriodMetrics(earnings, expenses, customCosts, 'week'),
      month: this.calculatePeriodMetrics(earnings, expenses, customCosts, 'month'),
      year: this.calculatePeriodMetrics(earnings, expenses, customCosts, 'year'),
      all: this.calculatePeriodMetrics(earnings, expenses, customCosts, 'all')
    };

    // 2. Projections
    const forecast = this.calculateForecasts(earnings, customCosts, goal);

    // 3. Maintenance and preventive alerts
    const maintenanceAlerts = this.generateMaintenanceAlerts(earnings, expenses, settings);

    // 4. Copilot feedback & overall performance score
    const { recommendations, score } = this.generateCopilotFeedback(metrics, forecast);

    return {
      metrics,
      forecast,
      recommendations,
      score,
      maintenanceAlerts
    };
  },

  /**
   * Instantly simulates financial impacts of changes in fuel prices, EVs, or commission structure.
   */
  runSimulation(
    earnings: Earning[],
    customCosts: DriverCustomCost[],
    simulationType: 'fuel_price' | 'ev_transition' | 'commission_discount' | 'revenue_increase',
    value: number // input from slider/input
  ): { originalCostPerKm: number; simulatedCostPerKm: number; monthlyImpact: number } {
    // Compute current base metrics
    const totalKm = earnings.reduce((sum, e) => sum + Number(e.total_km), 0) || 3000; // default 3000km/mo for simulation if no data
    
    // Find current fuel cost in customCosts
    const fuelCost = customCosts.find(c => c.category === 'fuel') || { amount: 5.69, apportionment_km: 0.42 };
    const baseFuelPrice = fuelCost.amount;
    const baseFuelKmRate = fuelCost.apportionment_km;

    let originalCostPerKm = baseFuelKmRate;
    let simulatedCostPerKm = baseFuelKmRate;
    let monthlyImpact = 0;

    switch (simulationType) {
      case 'fuel_price': {
        // Value is the new simulated fuel price (e.g. 4.99 instead of 5.69)
        const factor = value / baseFuelPrice;
        simulatedCostPerKm = baseFuelKmRate * factor;
        monthlyImpact = (originalCostPerKm - simulatedCostPerKm) * totalKm;
        break;
      }
      case 'ev_transition': {
        // Value is cost of electricity per kWh. Transition to EV reduces cost per KM from ~R$0.42 to ~R$0.08
        simulatedCostPerKm = 0.08 + (value * 0.02); // electric proxy
        monthlyImpact = (originalCostPerKm - simulatedCostPerKm) * totalKm;
        break;
      }
      case 'commission_discount': {
        // Reducing platform commission. Value is discount % (e.g. 5% cheaper platform fees)
        const avgGrossMonthly = earnings.reduce((sum, e) => sum + Number(e.gross_amount), 0) || 6000;
        monthlyImpact = avgGrossMonthly * (value / 100);
        break;
      }
      case 'revenue_increase': {
        // Increase hourly shift or dynamic pricing faturamento. Value is additional faturamento percentage
        const avgGrossMonthly = earnings.reduce((sum, e) => sum + Number(e.gross_amount), 0) || 6000;
        monthlyImpact = avgGrossMonthly * (value / 100);
        break;
      }
    }

    return {
      originalCostPerKm,
      simulatedCostPerKm,
      monthlyImpact
    };
  }
};
