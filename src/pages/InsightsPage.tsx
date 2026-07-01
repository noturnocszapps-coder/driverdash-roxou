import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { 
  TrendingUp, BarChart4, AlertTriangle, HelpCircle, Sparkles, Check, 
  Calendar, Award, Trash, Filter, Info, ShieldAlert, CheckCircle2, ShieldCheck, 
  Clock, Layers, Car, Milestone, ArrowUpRight, ArrowDownRight, RefreshCw, 
  Zap, DollarSign, Percent, Play, Gauge, Eye, HelpCircle as HelpIcon, Flame, Smartphone
} from 'lucide-react';
import { motion } from 'motion/react';
import { 
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer, Legend, LineChart, Line, Cell 
} from 'recharts';
import { SmartAlert, Earning, Expense, UberPassSettings } from '../types';
import { uberPassService } from '../modules/uberpass/uberpass.service';
import {
  calculateHealthScore,
  calculateDynamicSimulation,
  calculateCostsRanking,
  calculateTimelineData,
  generatePreventiveAlertsAndInsights,
  calculatePeriodComparison
} from '../modules/insights/insights.calculations';
import { DemandOpportunitiesPanel } from '../modules/demand-intelligence/DemandOpportunitiesPanel';
import { RideIntelligenceDashboard } from '../modules/ride-intelligence/RideIntelligenceDashboard';
import { PredictiveDashboard } from '../modules/predictive-intelligence/PredictiveDashboard';

export const InsightsPage: React.FC = () => {
  const { 
    user,
    earnings, 
    expenses, 
    metrics, 
    vehicle, 
    financialGoal, 
    vehicleCostSettings, 
    smartAlerts, 
    markAlertAsRead,
    customCosts,
    dbStatus,
    uberPassSettings
  } = useApp();

  // Active filters and tab states
  const [insightsTab, setInsightsTab] = useState<'predictive' | 'intelligence' | 'copilot' | 'opportunities'>('predictive');
  const [activeAlertFilter, setActiveAlertFilter] = useState<'all' | 'unread' | 'read'>('unread');
  const [timelinePeriod, setTimelinePeriod] = useState<'day' | 'week' | 'month' | 'year'>('week');
  const [comparisonPeriod, setComparisonPeriod] = useState<'day' | 'week' | 'month' | 'year'>('week');

  // --- Dynamic Simulator State (Module 3) ---
  const [simCarType, setSimCarType] = useState<'combustion' | 'hybrid' | 'electric'>('combustion');
  const [simRentCost, setSimRentCost] = useState<number>(0);
  const [simRentFreq, setSimRentFreq] = useState<'weekly' | 'monthly'>('weekly');
  const [simFuelPrice, setSimFuelPrice] = useState<number>(5.85);
  const [simKmPerLiter, setSimKmPerLiter] = useState<number>(11.5);
  const [simUberCommission, setSimUberCommission] = useState<number>(25);
  const [simMonthlyGoal, setSimMonthlyGoal] = useState<number>(financialGoal?.monthly_goal || 4000);

  // --- STATE FOR DEMO / SIMULATED DATA ---
  const isDatabaseEmpty = earnings.length === 0 && expenses.length === 0;
  const [useSimulatedData, setUseSimulatedData] = useState<boolean>(isDatabaseEmpty);

  // Formatting helpers
  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(val);
  };

  const formatPercent = (val: number) => {
    return `${val.toFixed(1)}%`;
  };

  // Safe parsing helper
  const safeNumber = (v: any) => {
    const n = Number(v);
    return isNaN(n) ? 0 : n;
  };

  // Synchronize simulator settings with real vehicle profile and Uber Pass settings
  useEffect(() => {
    if (uberPassSettings?.old_fee_percent) {
      setSimUberCommission(uberPassSettings.old_fee_percent);
    }
  }, [uberPassSettings]);

  // Synchronize simulator settings with real vehicle profile if available
  useEffect(() => {
    if (vehicle) {
      if (vehicle.fuel_type === 'electric') {
        setSimCarType('electric');
        setSimKmPerLiter(16.5);
        setSimFuelPrice(1.10);
      } else if (vehicle.fuel_type === 'hybrid') {
        setSimCarType('hybrid');
        setSimKmPerLiter(16.5);
        setSimFuelPrice(5.85);
      } else {
        setSimCarType('combustion');
        setSimKmPerLiter(vehicle.km_per_liter || 11.5);
        setSimFuelPrice(5.85);
      }

      if (vehicle.ownership_type === 'rented' && vehicle.rental_amount) {
        setSimRentCost(vehicle.rental_amount);
        setSimRentFreq(vehicle.rental_period || 'weekly');
      } else if (vehicle.ownership_type === 'financed' && vehicleCostSettings?.financing_monthly) {
        setSimRentCost(vehicleCostSettings.financing_monthly);
        setSimRentFreq('monthly');
      } else {
        setSimRentCost(0);
      }
    }
  }, [vehicle, vehicleCostSettings]);

  // Keep simulator's monthly goal sync with database changes
  useEffect(() => {
    if (financialGoal?.monthly_goal) {
      setSimMonthlyGoal(financialGoal.monthly_goal);
    }
  }, [financialGoal]);

  // --- BASE STATISTICS ACCUMULATION & FALLBACKS ---
  const realRides = useMemo(() => earnings.reduce((sum, e) => sum + safeNumber(e.rides_count), 0), [earnings]);
  const realHours = useMemo(() => earnings.reduce((sum, e) => sum + safeNumber(e.online_minutes), 0) / 60, [earnings]);
  const realKm = useMemo(() => metrics.totalKm || earnings.reduce((sum, e) => sum + safeNumber(e.total_km), 0), [metrics.totalKm, earnings]);
  const realGross = useMemo(() => metrics.totalRevenue || earnings.reduce((sum, e) => sum + safeNumber(e.gross_amount), 0), [metrics.totalRevenue, earnings]);
  const realExpenses = useMemo(() => metrics.totalExpenses || expenses.reduce((sum, exp) => sum + safeNumber(exp.amount), 0), [metrics.totalExpenses, expenses]);
  const realEmptyKm = useMemo(() => earnings.reduce((sum, e) => sum + safeNumber(e.empty_km || 0), 0), [earnings]);
  const realWaitingMinutes = useMemo(() => earnings.reduce((sum, e) => sum + safeNumber(e.waiting_minutes), 0), [earnings]);

  // Base constants selection
  const baselineGross = useMemo(() => useSimulatedData ? 4850 : realGross, [useSimulatedData, realGross]);
  const baselineExpenses = useMemo(() => useSimulatedData ? 1720 : realExpenses, [useSimulatedData, realExpenses]);
  const baselineNet = useMemo(() => baselineGross - baselineExpenses, [baselineGross, baselineExpenses]);
  const baselineKm = useMemo(() => useSimulatedData ? 2200 : realKm, [useSimulatedData, realKm]);
  const baselineHours = useMemo(() => useSimulatedData ? 130 : realHours, [useSimulatedData, realHours]);
  const baselineRides = useMemo(() => useSimulatedData ? 210 : realRides, [useSimulatedData, realRides]);
  const baselineEmptyKm = useMemo(() => useSimulatedData ? 450 : realEmptyKm, [useSimulatedData, realEmptyKm]);
  const baselineWaitingMinutes = useMemo(() => useSimulatedData ? 520 : realWaitingMinutes, [useSimulatedData, realWaitingMinutes]);
  const baselineGoal = useMemo(() => financialGoal?.monthly_goal || 3800, [financialGoal]);

  // --- MÓDULO 1: HEALTH SCORE ENGINE ---
  const healthScoreReport = useMemo(() => {
    return calculateHealthScore(
      baselineNet,
      baselineGross,
      baselineExpenses,
      baselineKm,
      baselineHours,
      baselineRides,
      baselineEmptyKm,
      baselineWaitingMinutes,
      baselineGoal
    );
  }, [baselineNet, baselineGross, baselineExpenses, baselineKm, baselineHours, baselineRides, baselineEmptyKm, baselineWaitingMinutes, baselineGoal]);

  // --- MÓDULO 3: SIMULADOR FINANCEIRO INTERATIVO ---
  const simulationResult = useMemo(() => {
    return calculateDynamicSimulation(
      baselineGross,
      baselineExpenses,
      baselineKm,
      baselineHours,
      baselineNet,
      simCarType,
      simRentCost,
      simRentFreq,
      simFuelPrice,
      simKmPerLiter,
      simUberCommission,
      simMonthlyGoal
    );
  }, [baselineGross, baselineExpenses, baselineKm, baselineHours, baselineNet, simCarType, simRentCost, simRentFreq, simFuelPrice, simKmPerLiter, simUberCommission, simMonthlyGoal]);

  // --- MÓDULO 4: RANKING DE CUSTOS ---
  const costsRankingData = useMemo(() => {
    return calculateCostsRanking(
      expenses,
      customCosts || [],
      baselineExpenses,
      simCarType,
      vehicle,
      baselineKm
    );
  }, [expenses, customCosts, baselineExpenses, simCarType, vehicle, baselineKm]);

  // --- MÓDULO 5: LINHA DO TEMPO OPERACIONAL ---
  const timelineData = useMemo(() => {
    return calculateTimelineData(
      timelinePeriod,
      earnings,
      expenses,
      customCosts || [],
      baselineNet,
      baselineExpenses,
      baselineKm,
      baselineHours,
      healthScoreReport.roi
    );
  }, [timelinePeriod, earnings, expenses, customCosts, baselineNet, baselineExpenses, baselineKm, baselineHours, healthScoreReport.roi]);

  // --- MÓDULOS 2 & 6 & 9: IA COPILOTO, ALERTA PREVENTIVO & RECOMENDAÇÕES ---
  const preventiveAlertsAndInsights = useMemo(() => {
    return generatePreventiveAlertsAndInsights(
      vehicle,
      simKmPerLiter,
      baselineExpenses,
      baselineKm,
      baselineEmptyKm,
      baselineHours,
      baselineWaitingMinutes,
      baselineNet,
      baselineRides,
      baselineGross,
      uberPassSettings
    );
  }, [vehicle, simKmPerLiter, baselineExpenses, baselineKm, baselineEmptyKm, baselineHours, baselineWaitingMinutes, baselineNet, baselineRides, baselineGross, uberPassSettings]);

  // --- MÓDULO 7: PERIOD COMPARISONS ---
  const comparisonReport = useMemo(() => {
    return calculatePeriodComparison(
      comparisonPeriod,
      baselineNet,
      baselineGross,
      baselineExpenses,
      baselineKm
    );
  }, [comparisonPeriod, baselineNet, baselineGross, baselineExpenses, baselineKm]);

  // --- ALERTS COMPILATION ---
  const allAlerts = useMemo(() => {
    const databaseAlerts = smartAlerts || [];
    
    // Inject dynamic analytical warnings from rule engine
    const systemAlerts = preventiveAlertsAndInsights.alerts.map((al, idx) => ({
      id: `sys-alert-${idx}`,
      title: al.title,
      description: al.description,
      severity: al.severity,
      type: al.type,
      is_read: false,
      created_at: new Date().toISOString(),
      isSystem: true
    }));

    return [...systemAlerts, ...databaseAlerts];
  }, [smartAlerts, preventiveAlertsAndInsights.alerts]);

  const filteredAlerts = useMemo(() => {
    if (activeAlertFilter === 'unread') {
      return allAlerts.filter(a => !a.is_read);
    }
    if (activeAlertFilter === 'read') {
      return allAlerts.filter(a => a.is_read);
    }
    return allAlerts;
  }, [allAlerts, activeAlertFilter]);

  // Render Onboarding Empty State if database is completely empty and demo mode is turned off
  if (isDatabaseEmpty && !useSimulatedData) {
    return (
      <div className="flex items-center justify-center min-h-[70vh] px-4 py-8">
        <div className="max-w-md w-full text-center p-10 bg-[#0b0720]/85 border border-purple-950/40 rounded-3xl space-y-6 shadow-2xl">
          <div className="w-16 h-16 bg-purple-950/40 border border-purple-500/20 rounded-2xl flex items-center justify-center mx-auto shadow-inner">
            <Gauge className="w-8 h-8 text-purple-400" />
          </div>
          <div className="space-y-2">
            <h3 className="text-xl font-bold text-white tracking-wide">Seu Histórico Está Vazio</h3>
            <p className="text-xs text-purple-300/60 leading-relaxed font-sans">
              Para ativar as análises de saúde financeira, monitor de riscos operacionais e projeções do Painel Financeiro, registre seus ganhos e despesas no Centro Financeiro.
            </p>
          </div>
          <div className="flex flex-col gap-3 pt-2">
            <button 
              onClick={() => setUseSimulatedData(true)}
              className="w-full py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold rounded-xl shadow-lg shadow-purple-500/10 cursor-pointer flex items-center justify-center gap-2 font-sans text-xs transition-all"
            >
              <Sparkles className="w-4 h-4 shrink-0" />
              Explorar com Dados Simulados
            </button>
            <p className="text-[10px] text-slate-500 font-mono uppercase tracking-wider">
              Modo de Simulação / Dados de Exemplo
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      
      {/* Title Header with status bar */}
      <div className="border-b border-purple-950/20 pb-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-purple-400" />
            <h2 className="text-xl font-bold text-white tracking-wide">
              Copiloto IA & Consultoria Financeira
            </h2>
            <span className="text-[9px] font-mono font-bold bg-purple-950 text-purple-400 border border-purple-800/30 px-2 py-0.5 rounded-full uppercase">
              Premium Ativo
            </span>
          </div>
          <p className="text-xs text-purple-300/50 mt-1">
            Análises preditivas, saúde operacional, simulador em tempo real e monitor de riscos do motorista.
          </p>
        </div>

        {/* Dynamic / Simulated Mode Switcher */}
        {!isDatabaseEmpty && (
          <div className="flex items-center gap-2 bg-purple-950/10 border border-purple-900/30 p-1.5 rounded-2xl">
            <span className="text-[9px] text-slate-400 font-mono font-bold uppercase pl-2">Fonte de Dados:</span>
            <button 
              onClick={() => setUseSimulatedData(!useSimulatedData)}
              className={`px-3 py-1.5 rounded-xl border font-sans text-[11px] font-bold cursor-pointer transition-all ${
                useSimulatedData 
                  ? 'bg-purple-600 text-white border-purple-500 shadow-md shadow-purple-500/10' 
                  : 'bg-slate-950/45 text-slate-400 border-transparent'
              }`}
            >
              {useSimulatedData ? 'Simulação' : 'Histórico Real'}
            </button>
          </div>
        )}
      </div>

      {/* Sub-Tabs Section */}
      <div className="flex border-b border-purple-950/20 pb-px gap-6 mb-2 overflow-x-auto scrollbar-none">
        <button
          onClick={() => setInsightsTab('predictive')}
          className={`pb-3 text-sm font-bold tracking-wide relative cursor-pointer transition-all flex items-center gap-1.5 shrink-0 ${
            insightsTab === 'predictive' ? 'text-white font-extrabold' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          {insightsTab === 'predictive' && (
            <motion.div layoutId="insightsTabActiveLine" className="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-500" />
          )}
          <span>🔮 IA Preditiva</span>
          <span className="px-1.5 py-0.5 bg-[#1b0847] text-purple-300 font-mono text-[9px] uppercase rounded-md border border-purple-800/35 tracking-wider font-extrabold">
            Fase 3 IA
          </span>
        </button>

        <button
          onClick={() => setInsightsTab('intelligence')}
          className={`pb-3 text-sm font-bold tracking-wide relative cursor-pointer transition-all flex items-center gap-1.5 shrink-0 ${
            insightsTab === 'intelligence' ? 'text-white font-extrabold' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          {insightsTab === 'intelligence' && (
            <motion.div layoutId="insightsTabActiveLine" className="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-500" />
          )}
          <span>🧠 Inteligência de Corridas</span>
          <span className="px-1.5 py-0.5 bg-purple-950 text-purple-400 font-mono text-[9px] uppercase rounded-md border border-purple-800/30 tracking-wider">
            Fase 2 IA
          </span>
        </button>

        <button
          onClick={() => setInsightsTab('opportunities')}
          className={`pb-3 text-sm font-bold tracking-wide relative cursor-pointer transition-all flex items-center gap-2 shrink-0 ${
            insightsTab === 'opportunities' ? 'text-white font-extrabold' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          {insightsTab === 'opportunities' && (
            <motion.div layoutId="insightsTabActiveLine" className="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-500" />
          )}
          <span>🗺️ Mapa de Oportunidades</span>
          <span className="px-1.5 py-0.5 bg-emerald-950/40 text-emerald-400 font-mono text-[9px] uppercase rounded-md border border-emerald-500/20 tracking-wider">
            18h MVP
          </span>
        </button>

        <button
          onClick={() => setInsightsTab('copilot')}
          className={`pb-3 text-sm font-bold tracking-wide relative cursor-pointer transition-all flex items-center gap-1.5 shrink-0 ${
            insightsTab === 'copilot' ? 'text-white font-extrabold' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          {insightsTab === 'copilot' && (
            <motion.div layoutId="insightsTabActiveLine" className="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-500" />
          )}
          <span>📊 Copiloto Financeiro & IA</span>
        </button>
      </div>

      {insightsTab === 'predictive' ? (
        <PredictiveDashboard />
      ) : insightsTab === 'intelligence' ? (
        <RideIntelligenceDashboard />
      ) : insightsTab === 'opportunities' ? (
        <DemandOpportunitiesPanel />
      ) : (
        <>
          {/* ALERT/BANNER FOR DEMO MODE ACTIVE */}
          {useSimulatedData && (
        <div className="p-4 bg-gradient-to-r from-[#0f0a2e]/60 via-[#160f42]/60 to-[#0f0a2e]/60 border border-purple-500/25 rounded-3xl flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-900/30 border border-purple-500/20 rounded-xl flex items-center justify-center shrink-0">
              <Flame className="w-5 h-5 text-purple-400 animate-pulse" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
                Simulação Ativa
                <span className="text-[8px] bg-purple-500 text-white font-mono font-black uppercase tracking-wider px-1.5 py-0.5 rounded">SIMULADO</span>
              </h4>
              <p className="text-[11px] text-purple-300/60 font-sans mt-0.5">
                Exibindo dados operacionais fictícios e calibrados devido ao seu histórico real estar limpo ou para experimentação rápida.
              </p>
            </div>
          </div>
          {!isDatabaseEmpty && (
            <button 
              onClick={() => setUseSimulatedData(false)}
              className="px-4 py-2 bg-purple-950 text-purple-300 border border-purple-500/20 hover:bg-purple-900/40 text-xs font-bold rounded-xl font-sans cursor-pointer transition-all"
            >
              Voltar para Dados Reais
            </button>
          )}
        </div>
      )}

      {/* --- MÓDULO 8 & 1: RESUMO EXECUTIVO & HEALTH SCORE --- */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* HEALTH SCORE CARD */}
        <div className="lg:col-span-1 p-6 bg-[#0b0720]/80 border border-purple-950/40 rounded-3xl flex flex-col justify-between relative overflow-hidden group">
          <div className="absolute -right-12 -bottom-12 w-48 h-48 bg-purple-600/5 rounded-full filter blur-3xl pointer-events-none group-hover:bg-purple-600/10 transition-colors duration-500" />
          
          <div className="space-y-4">
            <div className="flex justify-between items-start">
              <div>
                <span className="text-[10px] text-purple-400/75 font-mono font-bold uppercase tracking-wider">MÓDULO 1</span>
                <h4 className="text-sm font-bold text-slate-300 font-sans flex items-center gap-1.5 mt-0.5">
                  <Gauge className="w-4 h-4 text-purple-400" />
                  Saúde Financeira
                </h4>
              </div>
              <span className={`text-[11px] font-bold px-2.5 py-1 rounded-xl border ${healthScoreReport.borderColor} ${healthScoreReport.textBgColor} ${healthScoreReport.color} shadow-sm font-sans`}>
                {healthScoreReport.rating}
              </span>
            </div>

            {/* Gauge dial representation */}
            <div className="py-4 flex flex-col items-center justify-center relative">
              <div className="relative w-36 h-36 flex items-center justify-center">
                
                {/* Gauge Background circle */}
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                  <circle
                    cx="50"
                    cy="50"
                    r="42"
                    stroke="#1e1548"
                    strokeWidth="8"
                    fill="transparent"
                    strokeDasharray="264"
                    strokeDashoffset="66" // Semi-circle/arc representation
                    strokeLinecap="round"
                  />
                  {/* Gauge Active circle */}
                  <circle
                    cx="50"
                    cy="50"
                    r="42"
                    className="transition-all duration-1000 ease-out"
                    stroke="url(#healthScoreGrad)"
                    strokeWidth="8"
                    fill="transparent"
                    strokeDasharray="264"
                    strokeDashoffset={264 - (198 * healthScoreReport.score) / 100} // Dynamic filling of arc
                    strokeLinecap="round"
                  />
                  <defs>
                    <linearGradient id="healthScoreGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#d946ef" />
                      <stop offset="100%" stopColor="#3b82f6" />
                    </linearGradient>
                  </defs>
                </svg>

                {/* Score central content */}
                <div className="absolute text-center">
                  <span className="block text-4xl font-black text-white font-mono tracking-tight">
                    {healthScoreReport.score}
                  </span>
                  <span className="text-[9px] text-slate-400 font-mono font-bold uppercase tracking-widest">
                    PONTOS
                  </span>
                </div>
              </div>

              {/* KPI metrics supporting the score */}
              <div className="w-full grid grid-cols-2 gap-2 text-center mt-3 pt-2 border-t border-purple-950/10 font-mono text-[10px]">
                <div className="p-1.5 bg-slate-950/20 rounded-xl">
                  <span className="block text-[8px] text-slate-500 uppercase">Lucro/Hora</span>
                  <span className="text-xs font-bold text-white mt-0.5 block">{formatCurrency(healthScoreReport.profitPerHour)}/h</span>
                </div>
                <div className="p-1.5 bg-slate-950/20 rounded-xl">
                  <span className="block text-[8px] text-slate-500 uppercase">Lucro/Km</span>
                  <span className="text-xs font-bold text-white mt-0.5 block">{formatCurrency(healthScoreReport.profitPerKm)}/km</span>
                </div>
              </div>
            </div>
          </div>

          <p className="text-[10px] text-slate-400/80 leading-relaxed font-sans pt-2 border-t border-purple-950/20">
            Calculado automaticamente a partir do lucro líquido, tempo ocioso, quilometragem produtiva e metas de faturamento ativo.
          </p>
        </div>

        {/* RESUMO EXECUTIVO GRID (MÓDULO 8) */}
        <div className="lg:col-span-2 p-6 bg-[#0b0720]/80 border border-purple-950/40 rounded-3xl flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex justify-between items-center border-b border-purple-950/15 pb-2">
              <div>
                <span className="text-[10px] text-purple-400/75 font-mono font-bold uppercase tracking-wider">MÓDULO 8</span>
                <h4 className="text-sm font-bold text-white font-sans flex items-center gap-1.5 mt-0.5">
                  <Layers className="w-4 h-4 text-purple-400" />
                  Painel Executivo Operacional
                </h4>
              </div>
              <span className="text-[9px] text-slate-500 font-mono font-bold">LIVE UPDATE</span>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              
              {/* Gross Revenue */}
              <div className="p-4 bg-[#050211] border border-purple-950/30 rounded-2xl">
                <span className="text-[9px] text-slate-500 font-mono font-bold uppercase tracking-wider">Receita Bruta</span>
                <p className="text-lg font-black text-white font-mono mt-1">{formatCurrency(baselineGross)}</p>
                <span className="text-[9px] text-emerald-400 font-mono font-bold block mt-1">✓ Faturado</span>
              </div>

              {/* Total Expenses */}
              <div className="p-4 bg-[#050211] border border-purple-950/30 rounded-2xl">
                <span className="text-[9px] text-slate-500 font-mono font-bold uppercase tracking-wider">Custos Totais</span>
                <p className="text-lg font-black text-rose-400 font-mono mt-1">{formatCurrency(baselineExpenses)}</p>
                <span className="text-[9px] text-slate-500 font-mono block mt-1">
                  Ratio: {((baselineExpenses / Math.max(1, baselineGross)) * 100).toFixed(0)}% faturado
                </span>
              </div>

              {/* Net Profit */}
              <div className="p-4 bg-purple-950/15 border border-purple-500/10 rounded-2xl">
                <span className="text-[9px] text-purple-400 font-mono font-bold uppercase tracking-wider">Lucro Líquido</span>
                <p className="text-lg font-black text-emerald-400 font-mono mt-1">{formatCurrency(baselineNet)}</p>
                <span className="text-[9px] text-purple-400 font-mono block mt-1">Sua sobra real</span>
              </div>

              {/* ROI */}
              <div className="p-4 bg-[#050211] border border-purple-950/30 rounded-2xl">
                <span className="text-[9px] text-slate-500 font-mono font-bold uppercase tracking-wider">Retorno (ROI)</span>
                <p className="text-lg font-black text-white font-mono mt-1">{healthScoreReport.roi.toFixed(0)}%</p>
                <span className="text-[9px] text-indigo-400 font-mono font-bold block mt-1">Eficiência limpa</span>
              </div>

            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-1">
              
              {/* Productive KM */}
              <div className="p-3.5 bg-slate-950/45 rounded-xl font-mono text-xs">
                <span className="text-slate-500 text-[9px] uppercase tracking-wider">Km Produtivo</span>
                <p className="text-sm font-bold text-slate-200 mt-1">
                  {Math.round(baselineKm - baselineEmptyKm)} Km <span className="text-[10px] text-emerald-400">({((1 - baselineEmptyKm / Math.max(1, baselineKm)) * 100).toFixed(0)}%)</span>
                </p>
              </div>

              {/* Empty KM */}
              <div className="p-3.5 bg-slate-950/45 rounded-xl font-mono text-xs">
                <span className="text-slate-500 text-[9px] uppercase tracking-wider">Km Vazio</span>
                <p className="text-sm font-bold text-rose-400 mt-1">
                  {Math.round(baselineEmptyKm)} Km <span className="text-[10px] text-rose-400">({healthScoreReport.emptyKmPercent.toFixed(0)}%)</span>
                </p>
              </div>

              {/* Total Hours */}
              <div className="p-3.5 bg-slate-950/45 rounded-xl font-mono text-xs">
                <span className="text-slate-500 text-[9px] uppercase tracking-wider">Tempo Logado</span>
                <p className="text-sm font-bold text-slate-200 mt-1">
                  {baselineHours.toFixed(1)} h
                </p>
              </div>

              {/* Cost per hour */}
              <div className="p-3.5 bg-slate-[#050211] border border-purple-950/10 rounded-xl font-mono text-xs">
                <span className="text-purple-400 text-[9px] uppercase tracking-wider">Custo de Operação/Hora</span>
                <p className="text-sm font-bold text-purple-300 mt-1">
                  {formatCurrency(baselineExpenses / Math.max(1, baselineHours))}/h
                </p>
              </div>

            </div>
          </div>

          <div className="flex items-center gap-2 text-xs text-purple-300/60 pt-4 border-t border-purple-950/20 mt-4">
            <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
            <span>Dados consolidados em tempo real a partir das suas corridas da semana.</span>
          </div>
        </div>

      </div>

      {/* --- MÓDULOS 2, 6 & 9: COPILOTO IA, IA PREVENTIVA & MOTOR DE INSIGHTS --- */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* IA COPILOTO FEED (MÓDULO 2 & 9) */}
        <div className="lg:col-span-2 p-6 bg-[#0b0720]/80 border border-purple-950/40 rounded-3xl space-y-4">
          <div className="flex justify-between items-start border-b border-purple-950/15 pb-3">
            <div>
              <span className="text-[10px] text-purple-400/75 font-mono font-bold uppercase tracking-wider">MÓDULO 2 & 9</span>
              <h4 className="text-sm font-bold text-white font-sans flex items-center gap-1.5 mt-0.5">
                <Sparkles className="w-4 h-4 text-purple-400" />
                Copiloto de IA Roxou
              </h4>
            </div>
            <span className="text-[9px] bg-purple-950/50 text-purple-400 px-2.5 py-1 rounded-lg border border-purple-900/30 font-mono font-bold">
              Cognição Ativa
            </span>
          </div>

          <p className="text-xs text-purple-300/75 leading-relaxed font-sans">
            Seu assistente cognitivo gerou as seguintes recomendações baseadas exclusivamente nos seus padrões de faturamento e quilometragem:
          </p>

          <div className="space-y-3 max-h-[310px] overflow-y-auto pr-1">
            {preventiveAlertsAndInsights.insights.map((insight, idx) => (
              <div key={idx} className="p-4 bg-purple-950/15 border border-purple-950/30 rounded-2xl flex items-start gap-3 transition-all hover:bg-purple-950/25">
                <span className="p-1 rounded-lg bg-purple-900/40 text-purple-400 mt-0.5 font-bold shrink-0">
                  ⚡
                </span>
                <p className="text-slate-200 text-xs leading-relaxed font-sans font-medium">
                  {insight}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* IA PREVENTIVA ALERT CONSOLE (MÓDULO 6) */}
        <div className="lg:col-span-1 p-6 bg-[#0b0720]/80 border border-purple-950/40 rounded-3xl flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex justify-between items-start border-b border-purple-950/15 pb-3">
              <div>
                <span className="text-[10px] text-purple-400/75 font-mono font-bold uppercase tracking-wider">MÓDULO 6</span>
                <h4 className="text-sm font-bold text-white font-sans flex items-center gap-1.5 mt-0.5">
                  <ShieldAlert className="w-4 h-4 text-rose-400" />
                  Alerta IA Preventivo
                </h4>
              </div>
              
              {/* Simple count filter tab */}
              <div className="flex items-center gap-1 font-mono text-[9px] uppercase">
                <button 
                  onClick={() => setActiveAlertFilter('unread')}
                  className={`px-2 py-0.5 rounded cursor-pointer ${activeAlertFilter === 'unread' ? 'bg-purple-950 text-purple-300' : 'text-slate-500'}`}
                >
                  Unread ({allAlerts.filter(a => !a.is_read).length})
                </button>
              </div>
            </div>

            <p className="text-[11px] text-slate-400/90 leading-relaxed font-sans">
              Monitorando desvios mecânicos e operacionais antes de impactarem suas margens de lucro líquido:
            </p>

            <div className="space-y-3 max-h-[220px] overflow-y-auto pr-1">
              {filteredAlerts.length === 0 ? (
                <div className="p-6 text-center bg-slate-950/40 border border-purple-950/10 rounded-2xl space-y-2">
                  <CheckCircle2 className="w-7 h-7 text-emerald-500 mx-auto animate-pulse" />
                  <p className="font-mono text-[11px] text-slate-300">Tudo operando normalmente!</p>
                  <p className="font-sans text-[10px] text-slate-500">Nenhum risco de prejuízo detectado.</p>
                </div>
              ) : (
                filteredAlerts.map((alert) => (
                  <div 
                    key={alert.id}
                    className={`p-3.5 border rounded-xl flex items-start gap-2.5 transition-colors ${
                      alert.is_read 
                        ? 'bg-purple-950/5 border-purple-950/20 opacity-50' 
                        : alert.severity === 'high' 
                          ? 'bg-rose-950/10 border-rose-500/20' 
                          : 'bg-purple-950/10 border-purple-500/10'
                    }`}
                  >
                    <AlertTriangle className={`w-4 h-4 mt-0.5 shrink-0 ${alert.severity === 'high' ? 'text-rose-400' : 'text-purple-400'}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1 flex-wrap">
                        <span className="text-[10px] font-bold text-slate-200">{alert.title}</span>
                        <span className="text-[7.5px] font-mono font-bold uppercase tracking-wider px-1 bg-slate-950 text-purple-400 rounded">
                          {alert.type}
                        </span>
                      </div>
                      <p className="text-[10.5px] text-slate-300 leading-normal mt-1">{alert.description}</p>
                    </div>

                    {(alert as any).isSystem && !alert.is_read && (
                      <button 
                        onClick={() => markAlertAsRead(alert.id || '', 0)}
                        className="text-[9px] font-mono text-emerald-400 cursor-pointer hover:underline self-start mt-0.5"
                      >
                        ✓
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="pt-2 border-t border-purple-950/10 mt-2 text-[9.5px] text-slate-500 font-mono flex items-center justify-between">
            <span>PREVENCÃO AUTOMÁTICA</span>
            <span>2026 ACTIVE</span>
          </div>
        </div>

      </div>

      {/* --- MÓDULO 3: SIMULADOR FINANCEIRO INTERATIVO --- */}
      <div className="p-6 bg-[#0b0720]/80 border border-purple-950/40 rounded-3xl space-y-6">
        <div className="border-b border-purple-950/15 pb-3">
          <span className="text-[10px] text-purple-400/75 font-mono font-bold uppercase tracking-wider">MÓDULO 3</span>
          <h4 className="text-base font-bold text-white font-sans flex items-center gap-2 mt-0.5">
            <RefreshCw className="w-5 h-5 text-purple-400 animate-spin-slow" />
            Simulador Operacional & Troca de Cenários
          </h4>
          <p className="text-xs text-purple-300/40 mt-1">
            Simule alterações na sua estrutura operacional (combustível, aluguel, comissão) e descubra o impacto financeiro imediatamente antes de decidir.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* SIMULATION FORM */}
          <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-5 font-sans text-xs">
            
            {/* 1. Novo Carro e Energia */}
            <div className="space-y-2">
              <label className="block text-[11px] font-bold text-slate-400 font-mono uppercase tracking-wider">
                1. Tipo de Motorização / Carro
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'combustion', label: 'Combustão', icon: '⛽' },
                  { id: 'hybrid', label: 'Híbrido', icon: '🔋' },
                  { id: 'electric', label: 'Elétrico', icon: '⚡' }
                ].map((item) => (
                  <button
                    key={item.id}
                    onClick={() => {
                      setSimCarType(item.id as any);
                      if (item.id === 'electric') {
                        setSimKmPerLiter(16.5); // electric efficiency
                        setSimFuelPrice(1.10); // rate
                      } else if (item.id === 'hybrid') {
                        setSimKmPerLiter(16.5);
                        setSimFuelPrice(5.85);
                      } else {
                        setSimKmPerLiter(11.5);
                        setSimFuelPrice(5.85);
                      }
                    }}
                    className={`p-3 rounded-2xl border text-center transition-all cursor-pointer ${
                      simCarType === item.id 
                        ? 'bg-purple-950/40 border-purple-500 text-purple-300 font-bold' 
                        : 'bg-slate-950/40 border-purple-950/40 text-slate-400 hover:bg-purple-950/10'
                    }`}
                  >
                    <span className="block text-base mb-1">{item.icon}</span>
                    <span>{item.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* 2. Novo Aluguel ou Parcela */}
            <div className="space-y-2">
              <label className="block text-[11px] font-bold text-slate-400 font-mono uppercase tracking-wider">
                2. Custo do Veículo / Aluguel
              </label>
              <div className="flex gap-2">
                <input
                  type="number"
                  value={simRentCost}
                  onChange={(e) => setSimRentCost(Math.max(0, parseFloat(e.target.value) || 0))}
                  className="flex-1 bg-slate-950/40 border border-purple-950/40 rounded-xl p-3 text-white font-bold"
                  placeholder="Valor"
                />
                <select
                  value={simRentFreq}
                  onChange={(e) => setSimRentFreq(e.target.value as any)}
                  className="bg-slate-950/40 border border-purple-950/40 rounded-xl p-3 text-slate-300 font-mono"
                >
                  <option value="weekly">Semanal</option>
                  <option value="monthly">Mensal</option>
                </select>
              </div>
            </div>

            {/* 3. Preço do combustível */}
            <div className="space-y-2">
              <div className="flex justify-between text-[11px] font-mono">
                <span className="font-bold text-slate-400 uppercase tracking-wider">
                  3. Preço {simCarType === 'electric' ? 'kWh' : 'Combustível'}
                </span>
                <span className="text-white font-bold">{formatCurrency(simFuelPrice)}/{simCarType === 'electric' ? 'kWh' : 'Litro'}</span>
              </div>
              <input
                type="range"
                min={simCarType === 'electric' ? 0.40 : 3.00}
                max={simCarType === 'electric' ? 2.80 : 8.50}
                step="0.05"
                value={simFuelPrice}
                onChange={(e) => setSimFuelPrice(parseFloat(e.target.value))}
                className="w-full accent-purple-500 h-1 bg-purple-950 rounded-lg cursor-pointer"
              />
            </div>

            {/* 4. Rendimento Km/L ou kWh/100km */}
            <div className="space-y-2">
              <div className="flex justify-between text-[11px] font-mono">
                <span className="font-bold text-slate-400 uppercase tracking-wider">
                  4. Rendimento ({simCarType === 'electric' ? 'kWh/100km' : 'Km/Litro'})
                </span>
                <span className="text-white font-bold">{simKmPerLiter.toFixed(1)} {simCarType === 'electric' ? 'kWh' : 'Km/L'}</span>
              </div>
              <input
                type="range"
                min={simCarType === 'electric' ? 10.0 : 5.0}
                max={simCarType === 'electric' ? 24.0 : 22.0}
                step="0.1"
                value={simKmPerLiter}
                onChange={(e) => setSimKmPerLiter(parseFloat(e.target.value))}
                className="w-full accent-purple-500 h-1 bg-purple-950 rounded-lg cursor-pointer"
              />
            </div>

            {/* 5. Nova Comissão Uber */}
            <div className="space-y-2">
              <div className="flex justify-between text-[11px] font-mono">
                <span className="font-bold text-slate-400 uppercase tracking-wider">
                  5. Nova Comissão Uber / App
                </span>
                <span className="text-purple-400 font-bold">{simUberCommission}%</span>
              </div>
              <input
                type="range"
                min="5"
                max="45"
                value={simUberCommission}
                onChange={(e) => setSimUberCommission(parseInt(e.target.value) || 25)}
                className="w-full accent-purple-500 h-1 bg-purple-950 rounded-lg cursor-pointer"
              />
              <p className="text-[10px] text-slate-500">Média normal cobrada pelas plataformas é de 25% a 32%.</p>
            </div>

            {/* 6. Nova Meta Mensal */}
            <div className="space-y-2">
              <label className="block text-[11px] font-bold text-slate-400 font-mono uppercase tracking-wider">
                6. Nova Meta de Lucro Líquido
              </label>
              <input
                type="number"
                value={simMonthlyGoal}
                onChange={(e) => setSimMonthlyGoal(Math.max(0, parseInt(e.target.value) || 0))}
                className="w-full bg-slate-950/40 border border-purple-950/40 rounded-xl p-3 text-white font-bold"
                placeholder="R$ Meta"
              />
            </div>

          </div>

          {/* SIMULATION REAL-TIME RESULTS PANEL */}
          <div className="lg:col-span-1 p-6 bg-purple-950/15 border border-purple-500/15 rounded-3xl flex flex-col justify-between font-mono text-xs">
            <div className="space-y-4">
              <h5 className="text-xs font-bold text-purple-400 flex items-center gap-1.5 font-sans">
                <RefreshCw className="w-4 h-4 text-purple-400 animate-spin-slow" />
                Resultado da Simulação
              </h5>

              <div className="space-y-3.5 pt-2">
                
                {/* Simulated Net Profit */}
                <div className="p-3.5 bg-slate-950/60 rounded-2xl border border-purple-500/5">
                  <span className="text-[9px] text-slate-400 uppercase">Projeção Lucro Líquido</span>
                  <p className="text-xl font-black text-emerald-400 mt-1">{formatCurrency(simulationResult.profit)}</p>
                  
                  {/* Difference Badge */}
                  <span className={`text-[10px] font-bold block mt-1.5 ${simulationResult.profitDiff >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {simulationResult.profitDiff >= 0 ? '▲ Ganho de ' : '▼ Redução de '} 
                    {formatCurrency(Math.abs(simulationResult.profitDiff))} /mês
                  </span>
                </div>

                {/* Simulated ROI */}
                <div className="flex justify-between items-center py-2 border-b border-purple-950/15">
                  <span className="text-slate-400 text-[11px]">ROI Simulado:</span>
                  <span className="font-bold text-white text-sm">{simulationResult.roi.toFixed(0)}%</span>
                </div>

                {/* Simulated Cost per KM */}
                <div className="flex justify-between items-center py-2 border-b border-purple-950/15">
                  <span className="text-slate-400 text-[11px]">Custo por Km:</span>
                  <span className={`font-bold text-sm ${simulationResult.costPerKmDiff <= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {formatCurrency(simulationResult.costPerKm)}/km
                  </span>
                </div>

                {/* Simulated Cost per hour */}
                <div className="flex justify-between items-center py-1">
                  <span className="text-slate-400 text-[11px]">Custo por Hora:</span>
                  <span className="font-bold text-white text-sm">{formatCurrency(simulationResult.costPerHour)}/h</span>
                </div>

              </div>
            </div>

            <div className="pt-4 border-t border-purple-950/20 mt-4 text-[10px] text-slate-500 leading-relaxed font-sans">
              O simulador recalcula as despesas de forma inteligente cruzando combustíveis e taxas administrativas em tempo real.
            </div>
          </div>

        </div>
      </div>

      {/* --- MÓDULO 4 & 5: RANKING DE CUSTOS & LINHA DO TEMPO --- */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* MÓDULO 4: RANKING DE CUSTOS CHART */}
        <div className="p-6 bg-[#0b0720]/80 border border-purple-950/40 rounded-3xl space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-start border-b border-purple-950/15 pb-2">
              <div>
                <span className="text-[10px] text-purple-400/75 font-mono font-bold uppercase tracking-wider">MÓDULO 4</span>
                <h4 className="text-sm font-bold text-white font-sans flex items-center gap-1.5 mt-0.5">
                  <BarChart4 className="w-4 h-4 text-purple-400" />
                  Ranking Geral de Custos Operacionais
                </h4>
              </div>
              <span className="text-[9px] text-slate-500 font-mono font-bold">DESCRESCENTE</span>
            </div>
            
            <p className="text-xs text-slate-400 leading-normal pt-2 font-sans">
              Visão consolidada e ordenada das despesas de manutenção, abastecimento e contratos fixos. Otimize os maiores blocos primeiro:
            </p>
          </div>

          {/* Recharts Horizontal Bar Chart */}
          <div className="h-64 w-full pt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={costsRankingData}
                layout="vertical"
                margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
              >
                <XAxis type="number" stroke="#64748b" fontSize={10} fontStyle="italic" tickFormatter={(v) => `R$${v}`} />
                <YAxis dataKey="name" type="category" stroke="#64748b" fontSize={10} width={100} />
                <Tooltip 
                  formatter={(value: any) => [`R$ ${value}`, 'Custo Amortizado']} 
                  contentStyle={{ backgroundColor: '#070314', borderColor: '#4c1d95', borderRadius: '12px' }}
                />
                <Bar dataKey="value" radius={[0, 8, 8, 0]}>
                  {costsRankingData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-2 gap-2 text-[10px] font-mono text-slate-400 pt-2 border-t border-purple-950/15">
            <div>
              💡 **Combustível** e **Aluguel** somam {(((costsRankingData[0]?.value || 0) + (costsRankingData[1]?.value || 0)) / Math.max(1, baselineExpenses) * 100).toFixed(0)}% de todo o seu custo.
            </div>
            <div className="text-right">
              Foco prioritário de poupança ativo.
            </div>
          </div>
        </div>

        {/* MÓDULO 5: LINHA DO TEMPO EVOLUTION */}
        <div className="p-6 bg-[#0b0720]/80 border border-purple-950/40 rounded-3xl space-y-4 flex flex-col justify-between">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-purple-950/15 pb-2 gap-2">
            <div>
              <span className="text-[10px] text-purple-400/75 font-mono font-bold uppercase tracking-wider">MÓDULO 5</span>
              <h4 className="text-sm font-bold text-white font-sans flex items-center gap-1.5 mt-0.5">
                <Clock className="w-4 h-4 text-purple-400" />
                Linha do Tempo e Evolução
              </h4>
            </div>

            {/* Time resolution filters */}
            <div className="flex items-center gap-1.5 font-mono text-[9px] uppercase">
              {[
                { id: 'day', label: 'Dia' },
                { id: 'week', label: 'Semana' },
                { id: 'month', label: 'Mês' },
                { id: 'year', label: 'Ano' }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setTimelinePeriod(tab.id as any)}
                  className={`px-2 py-1 rounded cursor-pointer transition-colors ${
                    timelinePeriod === tab.id 
                      ? 'bg-purple-950 text-purple-300 border border-purple-800/30 font-bold' 
                      : 'text-slate-400 border border-transparent'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Area Chart of Lucro vs Custos */}
          <div className="h-64 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={timelineData}
                margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="colorLucro" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.25}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorCustos" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.25}/>
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e1b4b" opacity={0.2} />
                <XAxis dataKey="name" stroke="#64748b" fontSize={9} />
                <YAxis stroke="#64748b" fontSize={9} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#070314', borderColor: '#4c1d95', borderRadius: '12px' }}
                />
                <Legend verticalAlign="top" height={36} iconSize={8} wrapperStyle={{ fontSize: '10px', fontFamily: 'monospace' }} />
                <Area type="monotone" dataKey="Lucro" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorLucro)" />
                <Area type="monotone" dataKey="Custos" stroke="#ef4444" strokeWidth={2} fillOpacity={1} fill="url(#colorCustos)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center text-[10px] font-mono pt-2 border-t border-purple-950/15">
            <div className="p-2 bg-slate-950/30 rounded-xl">
              <span className="block text-slate-500 uppercase text-[8px]">Média KM</span>
              <span className="text-white font-bold mt-0.5 block">
                {timelineData.length > 0 
                  ? Math.round(timelineData.reduce((sum, item) => sum + item.Km, 0) / timelineData.length) 
                  : 0} Km
              </span>
            </div>
            <div className="p-2 bg-slate-950/30 rounded-xl">
              <span className="block text-slate-500 uppercase text-[8px]">Média Horas</span>
              <span className="text-white font-bold mt-0.5 block">
                {timelineData.length > 0 
                  ? (timelineData.reduce((sum, item) => sum + item.Horas, 0) / timelineData.length).toFixed(1) 
                  : '0.0'} h
              </span>
            </div>
            <div className="p-2 bg-slate-950/30 rounded-xl">
              <span className="block text-slate-500 uppercase text-[8px]">Média ROI</span>
              <span className="text-white font-bold mt-0.5 block">
                {timelineData.length > 0 
                  ? Math.round(timelineData.reduce((sum, item) => sum + item.ROI, 0) / timelineData.length) 
                  : 0}%
              </span>
            </div>
          </div>
        </div>

      </div>

      {/* --- MÓDULO 7: COMPARATIVOS HISTÓRICOS --- */}
      <div className="p-6 bg-[#0b0720]/80 border border-purple-950/40 rounded-3xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-purple-950/15 pb-2 gap-2">
          <div>
            <span className="text-[10px] text-purple-400/75 font-mono font-bold uppercase tracking-wider">MÓDULO 7</span>
            <h4 className="text-sm font-bold text-white font-sans flex items-center gap-1.5 mt-0.5">
              <Layers className="w-4 h-4 text-purple-400" />
              Comparativo de Períodos de Faturamento
            </h4>
          </div>

          {/* Period choices */}
          <div className="flex items-center gap-1.5 font-mono text-[9px] uppercase">
            {[
              { id: 'day', label: 'Hoje x Ontem' },
              { id: 'week', label: 'Semana x Semana' },
              { id: 'month', label: 'Mês x Mês' },
              { id: 'year', label: 'Ano x Ano' }
            ].map((p) => (
              <button
                key={p.id}
                onClick={() => setComparisonPeriod(p.id as any)}
                className={`px-2.5 py-1 rounded cursor-pointer transition-colors ${
                  comparisonPeriod === p.id 
                    ? 'bg-purple-950 text-purple-300 border border-purple-800/30 font-bold' 
                    : 'text-slate-400 border border-transparent'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          
          {/* Comparison profit */}
          <div className="p-4 bg-slate-950/40 border border-purple-950/20 rounded-2xl flex flex-col justify-between font-mono text-xs">
            <div>
              <span className="text-slate-500 text-[9px] uppercase font-bold block">Lucro Líquido</span>
              <p className="text-base font-black text-white mt-1.5">{formatCurrency(comparisonReport.profit.cur)}</p>
              <p className="text-[10.5px] text-slate-400/75 mt-0.5">Anterior: {formatCurrency(comparisonReport.profit.prev)}</p>
            </div>
            <div className="flex items-center gap-1.5 pt-2 border-t border-purple-950/15 mt-3">
              {comparisonReport.profit.val >= 0 ? (
                <>
                  <ArrowUpRight className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span className="text-emerald-400 font-bold">+{formatPercent(comparisonReport.profit.pct)}</span>
                  <span className="text-emerald-500/80 text-[10px]">(+{formatCurrency(comparisonReport.profit.val)})</span>
                </>
              ) : (
                <>
                  <ArrowDownRight className="w-4 h-4 text-rose-400 shrink-0" />
                  <span className="text-rose-400 font-bold">{formatPercent(comparisonReport.profit.pct)}</span>
                  <span className="text-rose-500/80 text-[10px]">({formatCurrency(comparisonReport.profit.val)})</span>
                </>
              )}
            </div>
          </div>

          {/* Comparison gross */}
          <div className="p-4 bg-slate-950/40 border border-purple-950/20 rounded-2xl flex flex-col justify-between font-mono text-xs">
            <div>
              <span className="text-slate-500 text-[9px] uppercase font-bold block">Receita Bruta</span>
              <p className="text-base font-black text-white mt-1.5">{formatCurrency(comparisonReport.gross.cur)}</p>
              <p className="text-[10.5px] text-slate-400/75 mt-0.5">Anterior: {formatCurrency(comparisonReport.gross.prev)}</p>
            </div>
            <div className="flex items-center gap-1.5 pt-2 border-t border-purple-950/15 mt-3">
              {comparisonReport.gross.val >= 0 ? (
                <>
                  <ArrowUpRight className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span className="text-emerald-400 font-bold">+{formatPercent(comparisonReport.gross.pct)}</span>
                </>
              ) : (
                <>
                  <ArrowDownRight className="w-4 h-4 text-rose-400 shrink-0" />
                  <span className="text-rose-400 font-bold">{formatPercent(comparisonReport.gross.pct)}</span>
                </>
              )}
            </div>
          </div>

          {/* Comparison costs */}
          <div className="p-4 bg-slate-950/40 border border-purple-950/20 rounded-2xl flex flex-col justify-between font-mono text-xs">
            <div>
              <span className="text-slate-500 text-[9px] uppercase font-bold block">Despesas</span>
              <p className="text-base font-black text-rose-400 mt-1.5">{formatCurrency(comparisonReport.costs.cur)}</p>
              <p className="text-[10.5px] text-slate-400/75 mt-0.5">Anterior: {formatCurrency(comparisonReport.costs.prev)}</p>
            </div>
            {/* Note: Lower costs is a positive change! */}
            <div className="flex items-center gap-1.5 pt-2 border-t border-purple-950/15 mt-3">
              {comparisonReport.costs.val <= 0 ? (
                <>
                  <ArrowDownRight className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span className="text-emerald-400 font-bold">-{formatPercent(Math.abs(comparisonReport.costs.pct))}</span>
                  <span className="text-emerald-500/80 text-[10px]">(Redução)</span>
                </>
              ) : (
                <>
                  <ArrowUpRight className="w-4 h-4 text-rose-400 shrink-0" />
                  <span className="text-rose-400 font-bold">+{formatPercent(comparisonReport.costs.pct)}</span>
                  <span className="text-rose-500/80 text-[10px]">(Aumento)</span>
                </>
              )}
            </div>
          </div>

          {/* Comparison km */}
          <div className="p-4 bg-slate-950/40 border border-purple-950/20 rounded-2xl flex flex-col justify-between font-mono text-xs">
            <div>
              <span className="text-slate-500 text-[9px] uppercase font-bold block">Distância Km</span>
              <p className="text-base font-black text-white mt-1.5">{Math.round(comparisonReport.km.cur)} Km</p>
              <p className="text-[10.5px] text-slate-400/75 mt-0.5">Anterior: {Math.round(comparisonReport.km.prev)} Km</p>
            </div>
            <div className="flex items-center gap-1.5 pt-2 border-t border-purple-950/15 mt-3">
              {comparisonReport.km.val >= 0 ? (
                <>
                  <ArrowUpRight className="w-4 h-4 text-slate-400 shrink-0" />
                  <span className="text-slate-200 font-bold">+{formatPercent(comparisonReport.km.pct)}</span>
                </>
              ) : (
                <>
                  <ArrowDownRight className="w-4 h-4 text-slate-400 shrink-0" />
                  <span className="text-slate-400 font-bold">{formatPercent(comparisonReport.km.pct)}</span>
                </>
              )}
            </div>
          </div>

        </div>
      </div>
      </>
      )}

      {/* SEÇÃO DISCRETA PREPARATÓRIA: ANÁLISE DE OFERTAS EM TEMPO REAL */}
      <div className="p-6 bg-gradient-to-br from-[#0c0524] to-[#04010a] border border-purple-950/40 rounded-3xl space-y-4">
        <div className="flex items-center gap-3 border-b border-purple-950/25 pb-3">
          <div className="p-2 bg-purple-950/40 rounded-xl text-purple-400">
            <Smartphone className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono">Análise de Ofertas (Android Integrado)</h3>
            <p className="text-[11px] text-slate-400 mt-0.5">Suporte nativo para leitura de tela via Serviço de Acessibilidade</p>
          </div>
        </div>

        <div className="p-5 bg-purple-950/10 border border-purple-950/40 rounded-2xl text-center space-y-2">
          <p className="text-xs text-purple-300 font-semibold leading-relaxed">
            Em breve, o DriverDash poderá analisar ofertas de corrida em tempo real no Android.
          </p>
          <p className="text-[10px] text-slate-500 font-sans max-w-lg mx-auto">
            Esta funcionalidade requer a instalação do aplicativo nativo DriverDash Roxou no Android e a ativação do Serviço de Acessibilidade. A análise em tempo real não é suportada diretamente no navegador ou via PWA.
          </p>
        </div>
      </div>

    </div>
  );
};

