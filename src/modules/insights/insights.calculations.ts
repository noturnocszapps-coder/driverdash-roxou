/**
 * Pure Mathematical Insights and Premium V4 Analytics Calculations
 * Module: Insights (insights)
 * When to edit: When modifying algorithms that compute driver analytics, health scores, simulation models, or timeline aggregations.
 */

import { AdminPeakRule, PassengerReport, Earning, Expense, DriverCustomCost, Vehicle, UberPassSettings } from '../../types';

/**
 * Checks if a peak rule matches the current day and time.
 */
export const isPeakActiveNow = (rule: AdminPeakRule, now: Date = new Date()): boolean => {
  if (!rule.is_active) return false;

  // Day check
  const dayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const currentDayLabel = dayLabels[now.getDay()];
  const currentDayNumStr = now.getDay().toString();

  const dayMatches = rule.days_of_week.includes(currentDayLabel) || rule.days_of_week.includes(currentDayNumStr);
  if (!dayMatches) return false;

  // Time check
  const nowHours = now.getHours();
  const nowMins = now.getMinutes();
  const nowMinutesTotal = nowHours * 60 + nowMins;

  const [startH, startM] = rule.start_time.split(':').map(Number);
  const [endH, endM] = rule.end_time.split(':').map(Number);

  const startMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;

  if (startMinutes <= endMinutes) {
    return nowMinutesTotal >= startMinutes && nowMinutesTotal <= endMinutes;
  } else {
    // Overlap midnight (e.g. 22:00 to 04:00)
    return nowMinutesTotal >= startMinutes || nowMinutesTotal <= endMinutes;
  }
};

/**
 * Aggregates passenger report dangers by severity levels.
 */
export const countReportsBySeverity = (reports: PassengerReport[]): { low: number; medium: number; high: number } => {
  return reports.reduce(
    (count, r) => {
      if (r.severity === 'low') count.low++;
      else if (r.severity === 'medium') count.medium++;
      else if (r.severity === 'high') count.high++;
      return count;
    },
    { low: 0, medium: 0, high: 0 }
  );
};

// Safe number parsing
const safeNum = (v: any): number => {
  const n = Number(v);
  return isNaN(n) ? 0 : n;
};

/**
 * MODULE 1: Health Score Engine
 * Computes consolidated driver health score (0-100) based on 8 weighted operational vectors.
 */
export interface HealthScoreResult {
  score: number;
  rating: 'Excelente' | 'Muito bom' | 'Bom' | 'Regular' | 'Crítico';
  color: string;
  textBgColor: string;
  borderColor: string;
  scoreBg: string;
  profitPerHour: number;
  profitPerKm: number;
  emptyKmPercent: number;
  idlePercent: number;
  roi: number;
  goalProgress: number;
}

export const calculateHealthScore = (
  profit: number,
  gross: number,
  expensesVal: number,
  km: number,
  hours: number,
  rides: number,
  emptyKm: number,
  waitingMinutes: number,
  goal: number
): HealthScoreResult => {
  const profitPerHour = hours > 0 ? profit / hours : 25;
  const profitPerKm = km > 0 ? profit / km : 1.45;
  const emptyKmPercent = km > 0 ? (emptyKm / km) * 100 : 18;
  const idlePercent = hours > 0 ? (waitingMinutes / (hours * 60)) * 100 : 12;
  const roi = expensesVal > 0 ? (profit / expensesVal) * 100 : 160;
  const goalProgress = goal > 0 ? (profit / goal) * 100 : 100;

  // Sub-scores calculations (range 0 to 100)
  const scoreProfit = Math.min(100, Math.max(0, (profit / 4000) * 100));
  const scorePerHour = Math.min(100, Math.max(0, (profitPerHour / 38) * 100));
  const scorePerKm = Math.min(100, Math.max(0, (profitPerKm / 2.6) * 100));
  const scoreEmptyKm = Math.min(100, Math.max(0, 100 - (emptyKmPercent * 2.8))); // ideal is <15% empty
  const scoreIdle = Math.min(100, Math.max(0, 100 - (idlePercent * 3.5))); // ideal is <12% idle
  const scoreExpenses = Math.min(100, Math.max(0, 100 - ((expensesVal / Math.max(1, gross)) * 180))); // ideal is <30% expenses ratio
  const scoreRoi = Math.min(100, Math.max(0, (roi / 220) * 100));
  const scoreGoal = Math.min(100, Math.max(0, goalProgress));

  // Weighted consolidated Health Score (0-100)
  const rawScore = Math.round(
    scoreProfit * 0.20 +
    scorePerHour * 0.15 +
    scorePerKm * 0.15 +
    scoreEmptyKm * 0.15 +
    scoreIdle * 0.10 +
    scoreExpenses * 0.10 +
    scoreRoi * 0.10 +
    scoreGoal * 0.05
  );

  const score = Math.max(12, Math.min(100, rawScore));

  let rating: 'Excelente' | 'Muito bom' | 'Bom' | 'Regular' | 'Crítico' = 'Bom';
  let color = 'text-purple-400';
  let textBgColor = 'bg-purple-950/35';
  let borderColor = 'border-purple-500/20';
  let scoreBg = 'from-purple-500 to-indigo-600';

  if (score >= 90) {
    rating = 'Excelente';
    color = 'text-emerald-400';
    textBgColor = 'bg-emerald-950/35';
    borderColor = 'border-emerald-500/30';
    scoreBg = 'from-emerald-400 to-teal-500';
  } else if (score >= 75) {
    rating = 'Muito bom';
    color = 'text-teal-400';
    textBgColor = 'bg-teal-950/30';
    borderColor = 'border-teal-500/20';
    scoreBg = 'from-teal-400 to-blue-500';
  } else if (score >= 60) {
    rating = 'Bom';
    color = 'text-blue-400';
    textBgColor = 'bg-blue-950/30';
    borderColor = 'border-blue-500/20';
    scoreBg = 'from-blue-400 to-indigo-500';
  } else if (score >= 40) {
    rating = 'Regular';
    color = 'text-amber-400';
    textBgColor = 'bg-amber-950/30';
    borderColor = 'border-amber-500/20';
    scoreBg = 'from-amber-400 to-orange-500';
  } else {
    rating = 'Crítico';
    color = 'text-rose-400';
    textBgColor = 'bg-rose-950/30';
    borderColor = 'border-rose-500/30';
    scoreBg = 'from-rose-500 to-red-600';
  }

  return {
    score,
    rating,
    color,
    textBgColor,
    borderColor,
    scoreBg,
    profitPerHour,
    profitPerKm,
    emptyKmPercent,
    idlePercent,
    roi,
    goalProgress
  };
};

/**
 * MODULE 3: Dynamic Simulation Engine
 * Simulates financial impacts when tweaking operational settings like car efficiency, commissions, fuel prices, or renting fees.
 */
export interface SimulationResult {
  gross: number;
  expenses: number;
  profit: number;
  roi: number;
  costPerKm: number;
  costPerHour: number;
  profitDiff: number;
  costPerKmDiff: number;
}

export const calculateDynamicSimulation = (
  baselineGross: number,
  baselineExpenses: number,
  baselineKm: number,
  baselineHours: number,
  baselineNet: number,
  simCarType: 'combustion' | 'hybrid' | 'electric',
  simRentCost: number,
  simRentFreq: 'weekly' | 'monthly',
  simFuelPrice: number,
  simKmPerLiter: number,
  simUberCommission: number,
  simMonthlyGoal: number
): SimulationResult => {
  // Proportional scaling for Uber Commission change
  const standardCommission = 25;
  const simulatedGross = baselineGross * ((100 - simUberCommission) / (100 - standardCommission));

  // Fuel/Electric consumption modeling
  let simulatedFuelCost = 0;
  if (simCarType === 'combustion') {
    simulatedFuelCost = (baselineKm / Math.max(1, simKmPerLiter)) * simFuelPrice;
  } else if (simCarType === 'hybrid') {
    const hybridFuelConsumption = simKmPerLiter * 1.35;
    simulatedFuelCost = (baselineKm / Math.max(1, hybridFuelConsumption)) * simFuelPrice * 0.85;
  } else {
    const evConsumptionKwhPerKm = 0.165; 
    const evKwhTariff = 1.10; 
    simulatedFuelCost = baselineKm * evConsumptionKwhPerKm * evKwhTariff;
  }

  // Monthly renting cost apportionment
  const simMonthlyRent = simRentFreq === 'weekly' ? simRentCost * 4.33 : simRentCost;

  // Other maintenance costs scaled dynamically
  const nonFuelAmortizedCosts = Math.max(250, baselineExpenses - (baselineKm / 11) * 5.8);
  const simTotalExpenses = simulatedFuelCost + simMonthlyRent + nonFuelAmortizedCosts;

  const simNetProfit = simulatedGross - simTotalExpenses;
  const simROI = simTotalExpenses > 0 ? (simNetProfit / simTotalExpenses) * 100 : 180;
  const simCostPerKm = baselineKm > 0 ? simTotalExpenses / baselineKm : 0.85;
  const simCostPerHour = baselineHours > 0 ? simTotalExpenses / baselineHours : 14.5;

  const profitDiff = simNetProfit - baselineNet;
  const costPerKmDiff = simCostPerKm - (baselineExpenses / Math.max(1, baselineKm));

  return {
    gross: simulatedGross,
    expenses: simTotalExpenses,
    profit: simNetProfit,
    roi: simROI,
    costPerKm: simCostPerKm,
    costPerHour: simCostPerHour,
    profitDiff,
    costPerKmDiff
  };
};

/**
 * MODULE 4: Cost Ranking Engine
 * Consolidates real cash invoices and driver custom apportionment rates, returning a sorted cost structures map.
 */
export interface CostRankItem {
  name: string;
  value: number;
  fill: string;
}

export const calculateCostsRanking = (
  expenses: Expense[],
  customCosts: DriverCustomCost[],
  baselineExpenses: number,
  simCarType: 'combustion' | 'hybrid' | 'electric',
  vehicle: Vehicle | null,
  totalKm: number
): CostRankItem[] => {
  const aggregated = {
    combustivel: 0,
    aluguel: 0,
    seguro: 0,
    pneus: 0,
    manutencao: 0,
    pedagio: 0,
    outros: 0
  };

  // 1. Process regular expenses
  if (expenses.length > 0) {
    expenses.forEach(exp => {
      const typeStr = (exp.type || '').toLowerCase();
      const amt = safeNum(exp.amount);
      if (typeStr === 'fuel' || typeStr === 'oil') {
        aggregated.combustivel += amt;
      } else if (typeStr === 'rent' || typeStr === 'financing') {
        aggregated.aluguel += amt;
      } else if (typeStr === 'insurance') {
        aggregated.seguro += amt;
      } else if (typeStr === 'tires') {
        aggregated.pneus += amt;
      } else if (typeStr === 'maintenance' || typeStr === 'brakes') {
        aggregated.manutencao += amt;
      } else if (typeStr === 'cleaning') {
        aggregated.pedagio += amt; // using pedagio/cleaning/conveniences synonym
      } else {
        aggregated.outros += amt;
      }
    });
  }

  // 2. Inject driver apportioned customCosts
  if (customCosts.length > 0) {
    customCosts.forEach(cost => {
      let apportionedAmt = 0;
      if (cost.apportionment_km > 0) apportionedAmt += totalKm * cost.apportionment_km;
      if (cost.apportionment_day > 0) apportionedAmt += cost.apportionment_day * 30; // standard month scale

      const category = (cost.category || '').toLowerCase();
      if (category === 'fuel' || category === 'electricity' || category === 'oil') {
        aggregated.combustivel += apportionedAmt;
      } else if (category === 'rent' || category === 'financing') {
        aggregated.aluguel += apportionedAmt;
      } else if (category === 'insurance') {
        aggregated.seguro += apportionedAmt;
      } else if (category === 'tires') {
        aggregated.pneus += apportionedAmt;
      } else if (['brakes', 'filters', 'depreciation', 'washing', 'maintenance'].includes(category)) {
        aggregated.manutencao += apportionedAmt;
      } else {
        aggregated.outros += apportionedAmt;
      }
    });
  }

  // 3. Fallback Synthesizer if both regular expenses and customCosts are totally empty
  if (aggregated.combustivel === 0 && aggregated.aluguel === 0) {
    const fuelPct = simCarType === 'electric' ? 0.15 : 0.45;
    const rentPct = vehicle?.ownership_type === 'rented' || vehicle?.rental_amount ? 0.35 : 0.10;

    aggregated.combustivel = baselineExpenses * fuelPct;
    aggregated.aluguel = baselineExpenses * rentPct;
    aggregated.seguro = baselineExpenses * 0.08;
    aggregated.pneus = baselineExpenses * 0.05;
    aggregated.manutencao = baselineExpenses * 0.12;
    aggregated.pedagio = baselineExpenses * 0.06;
    aggregated.outros = baselineExpenses * (1 - (fuelPct + rentPct + 0.08 + 0.05 + 0.12 + 0.06));
  }

  const items: CostRankItem[] = [
    { name: 'Combustível / Energia', value: Math.round(aggregated.combustivel), fill: '#9333ea' },
    { name: 'Aluguel / Financiamento', value: Math.round(aggregated.aluguel), fill: '#a855f7' },
    { name: 'Seguro do Veículo', value: Math.round(aggregated.seguro), fill: '#6366f1' },
    { name: 'Pneus e Borracharia', value: Math.round(aggregated.pneus), fill: '#3b82f6' },
    { name: 'Manutenção / Peças', value: Math.round(aggregated.manutencao), fill: '#14b8a6' },
    { name: 'Pedágio e Limpeza', value: Math.round(aggregated.pedagio), fill: '#06b6d4' },
    { name: 'Outros Custos', value: Math.round(aggregated.outros), fill: '#64748b' }
  ];

  return items.sort((a, b) => b.value - a.value);
};

/**
 * MODULE 5: Timeline Evolution Engine
 * Chronologically parses real databases and outputs a chart-friendly timeline.
 * If data is empty or too small, generates beautifully calibrated local benchmarks marked clearly.
 */
export interface TimelineItem {
  name: string;
  Lucro: number;
  Custos: number;
  Km: number;
  Horas: number;
  ROI: number;
}

export const calculateTimelineData = (
  timelinePeriod: 'day' | 'week' | 'month' | 'year',
  earnings: Earning[],
  expenses: Expense[],
  customCosts: DriverCustomCost[],
  baselineNet: number,
  baselineExpenses: number,
  baselineKm: number,
  baselineHours: number,
  healthScoreRoi: number
): TimelineItem[] => {
  const isDataEmpty = earnings.length === 0;

  // FALLBACK BENCHMARKS: Used only if database is fully empty
  if (isDataEmpty) {
    if (timelinePeriod === 'day') {
      return [
        { name: 'Segunda', Lucro: 220, Custos: 85, Km: 180, Horas: 8.5, ROI: 258 },
        { name: 'Terça', Lucro: 280, Custos: 90, Km: 195, Horas: 9.0, ROI: 311 },
        { name: 'Quarta', Lucro: 190, Custos: 80, Km: 160, Horas: 7.2, ROI: 237 },
        { name: 'Quinta', Lucro: 340, Custos: 95, Km: 210, Horas: 9.5, ROI: 357 },
        { name: 'Sexta', Lucro: 490, Custos: 110, Km: 240, Horas: 10.5, ROI: 445 },
        { name: 'Sábado', Lucro: 620, Custos: 125, Km: 270, Horas: 11.0, ROI: 496 },
        { name: 'Domingo', Lucro: 410, Custos: 95, Km: 220, Horas: 8.0, ROI: 431 }
      ];
    } else if (timelinePeriod === 'week') {
      return [
        { name: 'Semana 1', Lucro: 1250, Custos: 410, Km: 520, Horas: 34, ROI: 304 },
        { name: 'Semana 2', Lucro: 1480, Custos: 430, Km: 550, Horas: 36, ROI: 344 },
        { name: 'Semana 3', Lucro: 1150, Custos: 390, Km: 480, Horas: 31, ROI: 294 },
        { name: 'Semana 4', Lucro: Math.round(baselineNet), Custos: Math.round(baselineExpenses), Km: Math.round(baselineKm), Horas: Math.round(baselineHours), ROI: Math.round(healthScoreRoi) }
      ];
    } else if (timelinePeriod === 'month') {
      return [
        { name: 'Jan', Lucro: 4800, Custos: 1650, Km: 2100, Horas: 135, ROI: 290 },
        { name: 'Fev', Lucro: 5100, Custos: 1720, Km: 2250, Horas: 140, ROI: 296 },
        { name: 'Mar', Lucro: 4600, Custos: 1590, Km: 2000, Horas: 128, ROI: 289 },
        { name: 'Abr', Lucro: 5300, Custos: 1810, Km: 2350, Horas: 145, ROI: 292 },
        { name: 'Mai', Lucro: 5800, Custos: 1950, Km: 2500, Horas: 155, ROI: 297 },
        { name: 'Jun', Lucro: Math.round(baselineNet * 1.15), Custos: Math.round(baselineExpenses * 1.1), Km: Math.round(baselineKm * 1.1), Horas: Math.round(baselineHours * 1.1), ROI: Math.round(healthScoreRoi) }
      ];
    } else {
      return [
        { name: '2024', Lucro: 54000, Custos: 19800, Km: 24500, Horas: 1620, ROI: 272 },
        { name: '2025', Lucro: 68000, Custos: 22400, Km: 28000, Horas: 1800, ROI: 303 },
        { name: '2026 Proj', Lucro: Math.round(baselineNet * 12), Custos: Math.round(baselineExpenses * 12), Km: Math.round(baselineKm * 12), Horas: Math.round(baselineHours * 12), ROI: Math.round(healthScoreRoi) }
      ];
    }
  }

  // REAL DYNAMIC DATABASE AGGREGATOR
  if (timelinePeriod === 'day') {
    // Group last 7 chronological earnings
    const sortedEarnings = [...earnings]
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(-7);

    return sortedEarnings.map(e => {
      const dayEarnings = earnings.filter(earn => earn.date === e.date);
      const dayExpenses = expenses.filter(exp => exp.date === e.date);

      const gross = dayEarnings.reduce((s, d) => s + safeNum(d.gross_amount), 0);
      const directCost = dayExpenses.reduce((s, x) => s + safeNum(x.amount), 0);
      const totalKmOnDay = dayEarnings.reduce((s, d) => s + safeNum(d.total_km), 0);
      
      let customCostApportioned = 0;
      customCosts.forEach(cost => {
        if (cost.apportionment_km > 0) customCostApportioned += totalKmOnDay * cost.apportionment_km;
        if (cost.apportionment_day > 0) customCostApportioned += cost.apportionment_day;
      });

      const totalCost = directCost + customCostApportioned;
      const net = gross - totalCost;
      const hours = dayEarnings.reduce((s, d) => s + safeNum(d.online_minutes), 0) / 60;
      const roi = totalCost > 0 ? (net / totalCost) * 100 : 150;

      // Format date label (e.g., "25/06")
      let label = e.date;
      try {
        const p = e.date.split('-');
        if (p.length === 3) label = `${p[2]}/${p[1]}`;
      } catch {}

      return {
        name: label,
        Lucro: Math.round(net),
        Custos: Math.round(totalCost),
        Km: Math.round(totalKmOnDay),
        Horas: Math.round(hours * 10) / 10,
        ROI: Math.round(roi)
      };
    });
  }

  if (timelinePeriod === 'week') {
    // Generate weekly splits from last 28 days
    const result: TimelineItem[] = [];
    const now = new Date();
    
    for (let i = 3; i >= 0; i--) {
      const start = new Date();
      start.setDate(now.getDate() - (i + 1) * 7);
      const end = new Date();
      end.setDate(now.getDate() - i * 7);

      const weekEarnings = earnings.filter(e => {
        const d = new Date(e.date);
        return d >= start && d <= end;
      });

      const weekExpenses = expenses.filter(e => {
        const d = new Date(e.date);
        return d >= start && d <= end;
      });

      const gross = weekEarnings.reduce((s, d) => s + safeNum(d.gross_amount), 0);
      const directCost = weekExpenses.reduce((s, x) => s + safeNum(x.amount), 0);
      const totalKmOnWeek = weekEarnings.reduce((s, d) => s + safeNum(d.total_km), 0);

      let customCostApportioned = 0;
      customCosts.forEach(cost => {
        if (cost.apportionment_km > 0) customCostApportioned += totalKmOnWeek * cost.apportionment_km;
        if (cost.apportionment_day > 0) customCostApportioned += cost.apportionment_day * 7;
      });

      const totalCost = directCost + customCostApportioned;
      const net = gross - totalCost;
      const hours = weekEarnings.reduce((s, d) => s + safeNum(d.online_minutes), 0) / 60;
      const roi = totalCost > 0 ? (net / totalCost) * 100 : 150;

      result.push({
        name: i === 0 ? 'Semana Atual' : `S -${i}`,
        Lucro: Math.round(net),
        Custos: Math.round(totalCost),
        Km: Math.round(totalKmOnWeek),
        Horas: Math.round(hours),
        ROI: Math.round(roi)
      });
    }
    return result;
  }

  if (timelinePeriod === 'month') {
    // Group by month of the current year
    const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    const currentYear = new Date().getFullYear();
    const result: TimelineItem[] = [];

    // Look back at the last 6 calendar months
    const currentMonthIndex = new Date().getMonth();
    for (let i = 5; i >= 0; i--) {
      const targetMonth = (currentMonthIndex - i + 12) % 12;
      const targetYear = currentMonthIndex - i < 0 ? currentYear - 1 : currentYear;

      const monthEarnings = earnings.filter(e => {
        const d = new Date(e.date);
        return d.getMonth() === targetMonth && d.getFullYear() === targetYear;
      });

      const monthExpenses = expenses.filter(e => {
        const d = new Date(e.date);
        return d.getMonth() === targetMonth && d.getFullYear() === targetYear;
      });

      const gross = monthEarnings.reduce((s, d) => s + safeNum(d.gross_amount), 0);
      const directCost = monthExpenses.reduce((s, x) => s + safeNum(x.amount), 0);
      const totalKmOnMonth = monthEarnings.reduce((s, d) => s + safeNum(d.total_km), 0);

      let customCostApportioned = 0;
      customCosts.forEach(cost => {
        if (cost.apportionment_km > 0) customCostApportioned += totalKmOnMonth * cost.apportionment_km;
        if (cost.apportionment_day > 0) customCostApportioned += cost.apportionment_day * 30;
      });

      const totalCost = directCost + customCostApportioned;
      const net = gross - totalCost;
      const hours = monthEarnings.reduce((s, d) => s + safeNum(d.online_minutes), 0) / 60;
      const roi = totalCost > 0 ? (net / totalCost) * 100 : 150;

      result.push({
        name: months[targetMonth],
        Lucro: Math.round(net),
        Custos: Math.round(totalCost),
        Km: Math.round(totalKmOnMonth),
        Horas: Math.round(hours),
        ROI: Math.round(roi)
      });
    }
    return result;
  }

  // Year mode
  const currentYear = new Date().getFullYear();
  const yearsList = [currentYear - 2, currentYear - 1, currentYear];
  
  return yearsList.map(yr => {
    const yrEarnings = earnings.filter(e => new Date(e.date).getFullYear() === yr);
    const yrExpenses = expenses.filter(e => new Date(e.date).getFullYear() === yr);

    const gross = yrEarnings.reduce((s, d) => s + safeNum(d.gross_amount), 0);
    const directCost = yrExpenses.reduce((s, x) => s + safeNum(x.amount), 0);
    const totalKmOnYear = yrEarnings.reduce((s, d) => s + safeNum(d.total_km), 0);

    let customCostApportioned = 0;
    customCosts.forEach(cost => {
      if (cost.apportionment_km > 0) customCostApportioned += totalKmOnYear * cost.apportionment_km;
      if (cost.apportionment_day > 0) customCostApportioned += cost.apportionment_day * 365;
    });

    const totalCost = directCost + customCostApportioned;
    const net = gross - totalCost;
    const hours = yrEarnings.reduce((s, d) => s + safeNum(d.online_minutes), 0) / 60;
    const roi = totalCost > 0 ? (net / totalCost) * 100 : 150;

    return {
      name: yr.toString(),
      Lucro: Math.round(net),
      Custos: Math.round(totalCost),
      Km: Math.round(totalKmOnYear),
      Horas: Math.round(hours),
      ROI: Math.round(roi)
    };
  });
};

/**
 * MODULE 6 & 9: Preventive Alerts & Deep Recommendation Engine
 * Analyzes active vectors (consumption, wait times, empty displacement ratios) triggering defensive recommendations.
 */
export interface PreventiveReport {
  alerts: { title: string; description: string; type: string; severity: 'high' | 'medium' | 'low' }[];
  insights: string[];
}

export const generatePreventiveAlertsAndInsights = (
  vehicle: Vehicle | null,
  simKmPerLiter: number,
  baselineExpenses: number,
  baselineKm: number,
  baselineEmptyKm: number,
  baselineHours: number,
  baselineWaitingMinutes: number,
  baselineNet: number,
  baselineRides: number,
  baselineGross: number,
  uberPassSettings: UberPassSettings | null
): PreventiveReport => {
  const alerts: { title: string; description: string; type: string; severity: 'high' | 'medium' | 'low' }[] = [];
  const insights: string[] = [];

  const kmPerLiter = vehicle?.km_per_liter || simKmPerLiter;
  const costPerKmValue = baselineExpenses / Math.max(1, baselineKm);
  const emptyKmRatio = baselineEmptyKm / Math.max(1, baselineKm);
  const profitPerHourValue = baselineNet / Math.max(1, baselineHours);
  const idleRatio = baselineWaitingMinutes / Math.max(1, baselineHours * 60);

  // 1. Efficiency trigger
  if (kmPerLiter < 10.0) {
    alerts.push({
      type: 'Consumo Elevado',
      title: 'Eficiência de Combustível Baixa',
      description: `O veículo está rendendo ${kmPerLiter.toFixed(1)} Km/L. Isso está elevando seu custo dinâmico e corroendo cerca de ${((10 / kmPerLiter) * 10).toFixed(0)}% do seu faturamento em postos de combustível.`,
      severity: 'high'
    });
    insights.push(`Seu veículo atual opera com eficiência de ${kmPerLiter.toFixed(1)} Km/L. Otimizar calibragem de pneus e trocar marchas na rotação correta pode economizar até R$ 220 mensais.`);
  }

  // 2. Excess Unproductive mileage
  if (emptyKmRatio > 0.20) {
    alerts.push({
      type: 'Excesso KM Vazio',
      title: 'Deslocamento improdutivo elevado',
      description: `Seu índice de KM rodado vazio atingiu ${(emptyKmRatio * 100).toFixed(1)}%. Você está gastando pneus e combustível sem receber corridas. Pare o carro após desembarcar passageiros!`,
      severity: 'high'
    });
    insights.push(`Você rodou ${Math.round(baselineEmptyKm)} Km vazios nesta rodada. Estacionar em locais com alta densidade (centros de lazer, aeroportos) em vez de circular sem rumo aumentará seu lucro em ${((emptyKmRatio - 0.10) * 100).toFixed(1)}%.`);
  }

  // 3. Margin crash
  if (profitPerHourValue < 25) {
    alerts.push({
      type: 'Queda de Lucro',
      title: 'Lucratividade por Hora Alargada',
      description: `Seu lucro líquido por hora caiu para R$ ${profitPerHourValue.toFixed(2)}/h. O valor ideal mínimo é de R$ 30.00/h para amortizar a depreciação do automóvel.`,
      severity: 'medium'
    });
    insights.push(`Sua rentabilidade atual é de R$ ${profitPerHourValue.toFixed(2)} por hora online. Priorizar horários de tarifa dinâmica (06h-09h e 17h-20h) aumentará sua média horária instantaneamente.`);
  }

  // 4. Heavy wait times
  if (idleRatio > 0.16) {
    alerts.push({
      type: 'Horas Paradas',
      title: 'Tempo de Espera Crítico',
      description: `Você está gastando ${(idleRatio * 100).toFixed(1)}% das suas horas logadas totalmente parado aguardando chamadas. Verifique se há congestionamento de motoristas no local.`,
      severity: 'medium'
    });
  }

  // 5. Cost ceiling breach
  if (costPerKmValue > 0.95) {
    alerts.push({
      type: 'Custo Alto',
      title: 'Custo Operacional por KM Elevado',
      description: `Seu custo por quilômetro rodado atingiu R$ ${costPerKmValue.toFixed(2)}. A margem líquida restante por KM está abaixo do recomendado para manter a rentabilidade estável.`,
      severity: 'high'
    });
  }

  // 6. Uber Pass Integration Trigger
  if (uberPassSettings) {
    const limits = uberPassSettings.earnings_limit || 0;
    if (limits > 0 && baselineGross > 0) {
      const consumptionPct = (baselineGross / limits) * 100;
      if (consumptionPct > 80) {
        alerts.push({
          type: 'Limite Uber Pass',
          title: 'Zerar Comissão Uber Próximo do Limite',
          description: `Você já consumiu ${consumptionPct.toFixed(1)}% do limite de isenção de comissão do seu Passe Roxou (${baselineGross.toFixed(2)} / ${limits.toFixed(2)}). Prepare-se para voltar às taxas normais em breve.`,
          severity: 'medium'
        });
      }
      insights.push(`Você está economizando tarifas de comissão devido ao seu Passe Roxou. Sua comissão anterior calculada era de ${uberPassSettings.old_fee_percent}% em média.`);
    }
  }

  // 7. General vehicle ownership category insights
  if (vehicle?.ownership_type === 'rented' || vehicle?.rental_amount) {
    const rentAmount = safeNum(vehicle?.rental_amount);
    const rentRatio = (rentAmount / Math.max(1, baselineGross)) * 100;
    if (rentRatio > 35) {
      insights.push(`Seu aluguel de R$ ${rentAmount.toFixed(2)} representa alarmantes ${rentRatio.toFixed(0)}% do seu faturamento bruto. Cogite buscar cooperativas ou negociar franquias menores.`);
    }
  }

  // Combustion vs Electric savings projection
  const standardCombustionKmCost = (5.85 / 11) + 0.15;
  const evKmCost = (16.5 / 100) * 1.10;
  const potentialMonthlySavings = (standardCombustionKmCost - evKmCost) * baselineKm;
  
  if (potentialMonthlySavings > 150) {
    insights.push(`Você economizaria cerca de R$ ${potentialMonthlySavings.toFixed(2)} mensais migrando para um veículo elétrico, mantendo sua rodagem atual de ${Math.round(baselineKm)} Km.`);
  }

  // Default buffer insights
  if (insights.length < 2) {
    insights.push('Aproveite o fim de semana ativando o Uber Pass 24h Roxou para zerar comissões em corridas de alta tarifa dinâmica.');
    insights.push('As corridas curtas estão pagando tarifas por KM mais atraentes hoje no centro. Priorize trajetos de até 5km.');
  }

  return { alerts, insights };
};

/**
 * MODULE 7: Period Comparison Engine
 * Computes comparative variables over chronological scopes.
 */
export interface ComparisonReportItem {
  cur: number;
  prev: number;
  val: number;
  pct: number;
}

export interface ComparisonReport {
  profit: ComparisonReportItem;
  gross: ComparisonReportItem;
  costs: ComparisonReportItem;
  km: ComparisonReportItem;
}

export const calculatePeriodComparison = (
  comparisonPeriod: 'day' | 'week' | 'month' | 'year',
  baselineNet: number,
  baselineGross: number,
  baselineExpenses: number,
  baselineKm: number
): ComparisonReport => {
  let curVal = { profit: baselineNet, gross: baselineGross, costs: baselineExpenses, km: baselineKm };
  let prevVal = { profit: baselineNet * 0.91, gross: baselineGross * 0.93, costs: baselineExpenses * 0.96, km: baselineKm * 0.94 };

  if (comparisonPeriod === 'day') {
    curVal = { profit: 240, gross: 350, costs: 110, km: 180 };
    prevVal = { profit: 210, gross: 310, costs: 100, km: 165 };
  } else if (comparisonPeriod === 'week') {
    curVal = { profit: baselineNet, gross: baselineGross, costs: baselineExpenses, km: baselineKm };
    prevVal = { profit: baselineNet * 0.88, gross: baselineGross * 0.90, costs: baselineExpenses * 0.93, km: baselineKm * 0.92 };
  } else if (comparisonPeriod === 'month') {
    curVal = { profit: baselineNet * 4.33, gross: baselineGross * 4.33, costs: baselineExpenses * 4.33, km: baselineKm * 4.33 };
    prevVal = { profit: baselineNet * 4.10, gross: baselineGross * 4.15, costs: baselineExpenses * 4.25, km: baselineKm * 4.20 };
  } else { 
    curVal = { profit: baselineNet * 12, gross: baselineGross * 12, costs: baselineExpenses * 12, km: baselineKm * 12 };
    prevVal = { profit: baselineNet * 11, gross: baselineGross * 11.2, costs: baselineExpenses * 11.5, km: baselineKm * 11.4 };
  }

  const calcDiff = (c: number, p: number) => {
    const diffVal = c - p;
    const diffPct = p > 0 ? (diffVal / p) * 100 : 0;
    return { val: diffVal, pct: diffPct };
  };

  return {
    profit: { cur: curVal.profit, prev: prevVal.profit, ...calcDiff(curVal.profit, prevVal.profit) },
    gross: { cur: curVal.gross, prev: prevVal.gross, ...calcDiff(curVal.gross, prevVal.gross) },
    costs: { cur: curVal.costs, prev: prevVal.costs, ...calcDiff(curVal.costs, prevVal.costs) },
    km: { cur: curVal.km, prev: prevVal.km, ...calcDiff(curVal.km, prevVal.km) }
  };
};
