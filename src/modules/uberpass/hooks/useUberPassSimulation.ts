import { useMemo } from 'react';

export interface UberPassSimulationInput {
  passPrice: number;
  oldFeePercent: number;
  estimatedRevenue: number;
  averageTicket: number;
  costPerKm: number;
  estimatedKm: number;
  plannedHours: number;
  targetProfitPerHour: number;
}

export interface UberPassSimulationOutput {
  breakEvenRevenue: number;
  breakEvenRides: number;
  dailyVehicleCostOnly: number;
  totalDayCost: number;
  estimatedNetProfit: number;
  netProfitPerHour: number;
  revenuePerHour: number;
  revenuePerKm: number;
  estimatedSavings: number;
  
  // Working days averages (26 for month, 312 for year)
  workingDaysMonth: number;
  workingDaysYear: number;
  
  monthlyRevenue: number;
  monthlyVehicleCostOnly: number;
  monthlyPassCost: number;
  monthlyTotalCostWithPass: number;
  monthlyNetProfitWithPass: number;
  monthlyFeeOldCost: number;
  monthlyNetProfitWithOldFee: number;
  monthlySavings: number;
  
  annualRevenue: number;
  annualVehicleCostOnly: number;
  annualPassCost: number;
  annualTotalCostWithPass: number;
  annualNetProfitWithPass: number;
  annualFeeOldCost: number;
  annualSavings: number;
  
  dailyROI: number;
  monthlyROI: number;
  annualROI: number;
  netMargin: number;
  operationalMargin: number;
  netProfitPerKm: number;
  netProfitPerRide: number;
}

export function useUberPassSimulation(input: UberPassSimulationInput): UberPassSimulationOutput {
  return useMemo(() => {
    const {
      passPrice,
      oldFeePercent,
      estimatedRevenue,
      averageTicket,
      costPerKm,
      estimatedKm,
      plannedHours,
    } = input;

    const WORKING_DAYS_MONTH = 26;
    const WORKING_DAYS_YEAR = 312;

    const breakEvenRevenue = oldFeePercent > 0 ? passPrice / (oldFeePercent / 100) : 0;
    const breakEvenRides = (averageTicket > 0 && oldFeePercent > 0) ? passPrice / (averageTicket * oldFeePercent / 100) : 0;
    
    // Total costs
    const dailyVehicleCostOnly = costPerKm * estimatedKm;
    const totalDayCost = passPrice + dailyVehicleCostOnly;
    
    // Profits & Rates
    const estimatedNetProfit = estimatedRevenue - totalDayCost;
    const netProfitPerHour = plannedHours > 0 ? estimatedNetProfit / plannedHours : 0;
    const revenuePerHour = plannedHours > 0 ? estimatedRevenue / plannedHours : 0;
    const revenuePerKm = estimatedKm > 0 ? estimatedRevenue / estimatedKm : 0;
    const estimatedSavings = (estimatedRevenue * oldFeePercent / 100) - passPrice;

    // Monthly values
    const monthlyRevenue = estimatedRevenue * WORKING_DAYS_MONTH;
    const monthlyVehicleCostOnly = dailyVehicleCostOnly * WORKING_DAYS_MONTH;
    const monthlyPassCost = passPrice * WORKING_DAYS_MONTH;
    const monthlyTotalCostWithPass = monthlyPassCost + monthlyVehicleCostOnly;
    const monthlyNetProfitWithPass = monthlyRevenue - monthlyTotalCostWithPass;
    const monthlyFeeOldCost = monthlyRevenue * (oldFeePercent / 100);
    const monthlyNetProfitWithOldFee = monthlyRevenue - monthlyFeeOldCost - monthlyVehicleCostOnly;
    const monthlySavings = monthlyFeeOldCost - monthlyPassCost;

    // Annual values
    const annualRevenue = estimatedRevenue * WORKING_DAYS_YEAR;
    const annualVehicleCostOnly = dailyVehicleCostOnly * WORKING_DAYS_YEAR;
    const annualPassCost = passPrice * WORKING_DAYS_YEAR;
    const annualTotalCostWithPass = annualPassCost + annualVehicleCostOnly;
    const annualNetProfitWithPass = annualRevenue - annualTotalCostWithPass;
    const annualFeeOldCost = annualRevenue * (oldFeePercent / 100);
    const annualSavings = annualFeeOldCost - annualPassCost;

    // ROI & Margins
    const dailyROI = totalDayCost > 0 ? (estimatedNetProfit / totalDayCost) * 100 : 0;
    const monthlyROI = monthlyTotalCostWithPass > 0 ? (monthlyNetProfitWithPass / monthlyTotalCostWithPass) * 100 : 0;
    const annualROI = annualTotalCostWithPass > 0 ? (annualNetProfitWithPass / annualTotalCostWithPass) * 100 : 0;
    
    const netMargin = estimatedRevenue > 0 ? (estimatedNetProfit / estimatedRevenue) * 100 : 0;
    
    // Operational Cost calculation: total km costs excluding fixed/depreciation, let's keep it simple
    // or just make it netMargin. Let's use standard profit per km.
    const operationalMargin = estimatedRevenue > 0 ? ((estimatedRevenue - dailyVehicleCostOnly) / estimatedRevenue) * 100 : 0;
    
    const netProfitPerKm = estimatedKm > 0 ? estimatedNetProfit / estimatedKm : 0;
    const netProfitPerRide = averageTicket > 0 ? estimatedNetProfit / (estimatedRevenue / averageTicket) : 0;

    return {
      breakEvenRevenue,
      breakEvenRides,
      dailyVehicleCostOnly,
      totalDayCost,
      estimatedNetProfit,
      netProfitPerHour,
      revenuePerHour,
      revenuePerKm,
      estimatedSavings,
      workingDaysMonth: WORKING_DAYS_MONTH,
      workingDaysYear: WORKING_DAYS_YEAR,
      monthlyRevenue,
      monthlyVehicleCostOnly,
      monthlyPassCost,
      monthlyTotalCostWithPass,
      monthlyNetProfitWithPass,
      monthlyFeeOldCost,
      monthlyNetProfitWithOldFee,
      monthlySavings,
      annualRevenue,
      annualVehicleCostOnly,
      annualPassCost,
      annualTotalCostWithPass,
      annualNetProfitWithPass,
      annualFeeOldCost,
      annualSavings,
      dailyROI,
      monthlyROI,
      annualROI,
      netMargin,
      operationalMargin,
      netProfitPerKm,
      netProfitPerRide,
    };
  }, [input]);
}
