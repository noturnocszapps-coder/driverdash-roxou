import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { 
  LayoutDashboard, TrendingUp, Award, Car, AlertTriangle, Check, Plus, Coins,
  DollarSign, Sparkles, Clock, Milestone, Percent, Shield, Info, CheckCircle, 
  Crosshair, Activity, Bell, ArrowRight, Gauge, Zap, Flame, Map, Calendar, 
  Wrench, Layers, Fuel, Battery, Search, MessageSquare, Settings, AlertCircle, HelpCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Link, useNavigate } from 'react-router-dom';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from 'recharts';

// New Modular Services & Hooks
import { FuelRecommendationService } from '../services/ai/FuelRecommendationService';
import { useDailyOutlook } from '../modules/driver-ai/hooks/useDailyOutlook';
import { useDriverScore } from '../modules/driver-score/hooks/useDriverScore';
import { useSmartGoalsCalculator } from '../modules/smart-goals/hooks/useSmartGoalsCalculator';
import { useDemandPrediction } from '../modules/demand-map/hooks/useDemandPrediction';
import { useMaintenanceAlerts } from '../modules/maintenance-ai/hooks/useMaintenanceAlerts';
import { usePlatformComparator } from '../modules/platform-comparison/hooks/usePlatformComparator';

// New UI Components
import { DataSourceBadge } from '../components/DataSourceBadge';
import { DiagnosticCards } from '../modules/driver-ai/components/DiagnosticCards';
import { ScoreMeter } from '../modules/driver-score/components/ScoreMeter';
import { RecommendationsList } from '../modules/driver-score/components/RecommendationsList';
import { GoalInputForm } from '../modules/smart-goals/components/GoalInputForm';
import { PerformanceTracker } from '../modules/smart-goals/components/PerformanceTracker';
import { DemandHeatMap } from '../modules/demand-map/components/DemandHeatMap';
import { HotspotDetailsModal } from '../modules/demand-map/components/HotspotDetailsModal';
import { MaintenanceGrid } from '../modules/maintenance-ai/components/MaintenanceGrid';
import { ComparisonTable } from '../modules/platform-comparison/components/ComparisonTable';

export const DashboardPage: React.FC = () => {
  const { 
    metrics, 
    profile, 
    earnings, 
    expenses, 
    vehicle, 
    financialGoal, 
    vehicleCostSettings, 
    smartAlerts,
    markAlertAsRead,
    completeOnboarding,
    driverSessions,
    routePoints
  } = useApp();

  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'home' | 'driver-ai' | 'score' | 'goals' | 'pass' | 'weekly' | 'demand' | 'fuel' | 'maintenance' | 'compare'>('home');

  // Interactive local states for simulators
  const [targetNetInput, setTargetNetInput] = useState<number>(3000); // R$ 3000/month net
  const [targetPeriod, setTargetPeriod] = useState<'day' | 'week' | 'month'>('month');
  const [flexGasPrice, setFlexGasPrice] = useState<number>(5.89);
  const [flexEthPrice, setFlexEthPrice] = useState<number>(3.89);
  
  // Custom manual interactive simulation slider for dashboard
  const [customDailyRevenue, setCustomDailyRevenue] = useState<number>(350);

  // Platform performance comparator slider weights
  const [platformKmInput, setPlatformKmInput] = useState<number>(180);
  const [platformHoursInput, setPlatformHoursInput] = useState<number>(8);

  const [selectedHotspot, setSelectedHotspot] = useState<any | null>(null);

  // Invoke Custom Hooks to centralize all calculations
  const { dailyOutlook, currentCostPerKm } = useDailyOutlook();
  const { scoreReport } = useDriverScore();
  const { calculatedGoals } = useSmartGoalsCalculator(targetNetInput, targetPeriod);
  const { weeklyPlan, hotspots } = useDemandPrediction();
  const { maintenanceList } = useMaintenanceAlerts();
  const { platformComparison } = usePlatformComparator(platformHoursInput, platformKmInput);

  // Core calculations for Home panel
  const todayStr = new Date().toISOString().split('T')[0];
  const todayEarnings = earnings.filter(e => e.date === todayStr);
  const todayGross = todayEarnings.reduce((sum, e) => sum + Number(e.gross_amount), 0) || customDailyRevenue;
  
  const todayExpensesList = expenses.filter(ex => ex.date === todayStr);
  const todayExpensesSum = todayExpensesList.reduce((sum, e) => sum + Number(e.amount), 0) || (todayGross * 0.24); // fallback 24% expenses
  const todayNet = todayGross - todayExpensesSum;

  const dailyGoalVal = financialGoal?.daily_goal || 250;
  const dailyPercent = dailyGoalVal > 0 ? Math.min(100, (todayGross / dailyGoalVal) * 100) : 0;

  // Onboarding
  const hasVehicle = vehicle !== null;
  const hasCosts = vehicleCostSettings !== null;
  const hasGoals = financialGoal !== null;
  const hasEarning = earnings.length > 0;
  const hasCompletedSetup = profile?.onboarding_completed === true;

  let onboardingProgress = 0;
  if (hasVehicle) onboardingProgress += 20;
  if (hasCosts) onboardingProgress += 20;
  if (hasGoals) onboardingProgress += 20;
  if (hasEarning) onboardingProgress += 20;
  if (hasCompletedSetup) onboardingProgress += 20;

  // GPS / Online sessions tracking
  const activeSessionDef = (driverSessions || []).find(s => s.status === 'active');
  const todaySessionsList = (driverSessions || []).filter(s => s.start_time.split('T')[0] === todayStr);

  const activeSessMinutes = activeSessionDef
    ? Math.max(0, (new Date().getTime() - new Date(activeSessionDef.start_time).getTime()) / 60000)
    : 0;

  const todayCompletedSessMinutes = todaySessionsList.reduce((sum, s) => {
    if (s.status === 'active') return sum;
    return sum + (s.total_duration_minutes || 0);
  }, 0);

  const todayTotalOnlineMinutes = (todayCompletedSessMinutes + activeSessMinutes) || (8 * 60); // fallback 8h if 0
  const todayKm = todayEarnings.reduce((sum, e) => sum + Number(e.total_km), 0) || 160; // fallback 160km if 0
  const todayEmptyKm = todayEarnings.reduce((sum, e) => sum + Number(e.empty_km), 0) || (todayKm * 0.22); // fallback 22% empty km
  const todayEmptyKmPercent = todayKm > 0 ? (todayEmptyKm / todayKm) * 100 : 22;

  // Active online & idle times
  const todayTotalStoppedMinutes = todaySessionsList.reduce((sum, s) => {
    return sum + 12; // average 12 min stopped per session
  }, 0) || 45; // fallback 45 minutes idle today

  // Metrics calculations
  const todayROI = todayExpensesSum > 0 ? ((todayGross / todayExpensesSum) * 100) : 135;
  const todayMargin = todayGross > 0 ? (todayNet / todayGross) * 100 : 76;
  const todayProfitPerHour = todayTotalOnlineMinutes > 0 ? (todayNet / (todayTotalOnlineMinutes / 60)) : 32.5;
  const todayProfitPerKm = todayKm > 0 ? (todayNet / todayKm) : 2.10;

  const flexCalc = useMemo(() => {
    return FuelRecommendationService.calculateFlexCost(flexEthPrice, flexGasPrice);
  }, [flexEthPrice, flexGasPrice]);

  const electricPlan = useMemo(() => {
    return FuelRecommendationService.getElectricChargingPlan(vehicle);
  }, [vehicle]);

  // AI recommendations list (Módulo 11)
  const aiRecommendations = useMemo(() => {
    const items = [
      { text: "Hoje espere até 17:00 para ativar o Passe, aproveitando o pico de retorno do trabalho.", type: "pass" },
      { text: `Você está rodando ${(todayEmptyKmPercent).toFixed(0)}% de KM vazios. Evite circular sem rumo; estacione na Av. Paulista ou Itaim Bibi.`, type: "efficiency" },
      { text: `Análise de Flex: Troque para GASOLINA. O Etanol está custando ${(flexCalc.ratio * 100).toFixed(1)}% do preço da gasolina, acima dos 70%.`, type: "fuel" },
      { text: "Alerta de Demanda: Hoje há grande show corporativo no Allianz Parque. Desloque-se para a Pompeia às 22h.", type: "demand" },
      { text: "Filtro de Óleo próximo do vencimento (KM restante curto). Agende troca preventiva.", type: "maintenance" },
      { text: `Sua meta diária de faturamento (${profile?.plan === 'free' ? 'PRO' : 'Roxou'}) pode ser atingida em apenas 2.5 horas adicionais de jornada.`, type: "goal" }
    ];

    // Customize based on actual values
    if (todayEmptyKmPercent <= 18) {
      items[1] = { text: "Excelente posicionamento! Seu índice de KM vazio está em excelentes 14%. Continue mantendo a eficiência.", type: "efficiency" };
    }
    if (flexCalc.bestOption === 'ETANOL') {
      items[2] = { text: `Abasteça com ETANOL. Relação de preço atual está em ${(flexCalc.ratio * 100).toFixed(1)}%, economizando cerca de R$ 0.45 por litro rodado.`, type: "fuel" };
    }

    return items;
  }, [todayEmptyKmPercent, flexCalc, profile]);

  const activeAlerts = smartAlerts.filter(a => !a.is_read && !a.is_archived);

  // Formatting helpers
  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  const formatDistance = (val: number) => {
    return `${val.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} km`;
  };

  return (
    <div className="space-y-8 font-sans pb-16" id="driver-intelligence-hub">
      
      {/* Top Welcome Header - Premium Tesla/Apple Style */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 border-b border-purple-950/20 pb-6">
        <div>
          <span className="text-[10px] font-bold tracking-widest text-purple-400 font-mono uppercase block mb-1">
            SISTEMA INTEGRADO DE MOBILIDADE V3
          </span>
          <h1 className="text-3xl font-extrabold text-white tracking-tight leading-tight">
            Painel Geral <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-indigo-300">Roxou Premium</span>
          </h1>
          <p className="text-slate-400 text-sm mt-1 max-w-2xl">
            Bem-vindo de volta, <span className="text-slate-100 font-semibold">{profile?.name || 'Copiloto'}</span>. Sua central inteligente está online e sincronizada.
          </p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          <span className="px-3 py-1.5 rounded-xl bg-purple-950/25 border border-purple-900/30 text-purple-300 text-xs font-semibold font-mono flex items-center gap-2 uppercase">
            <span className="w-2 bg-emerald-500 rounded-full h-2 animate-pulse shadow-[0_0_8px_#10b981]"></span>
            Plano {profile?.plan === 'pro_plus' ? 'Elite PRO+' : profile?.plan === 'pro' ? 'Roxou PRO' : 'Grátis'}
          </span>

          <button 
            onClick={() => {
              console.log('Sincronizando telemetria...');
            }}
            className="p-2.5 rounded-xl bg-[#0b0821] border border-purple-950/40 text-purple-400 hover:text-purple-300 transition-colors"
            title="Sincronizar Telemetria"
            id="sync-btn-telemetry"
          >
            <Zap className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Navigation Tabs - Modern Stripe Navigation Bar */}
      <div className="flex border-b border-purple-950/20 gap-1 overflow-x-auto whitespace-nowrap pb-1 scrollbar-none select-none" id="tabs-menu-selector">
        {[
          { id: 'home', label: 'Painel Geral', icon: LayoutDashboard },
          { id: 'driver-ai', label: 'Driver AI', icon: Sparkles },
          { id: 'score', label: 'DriverScore', icon: Gauge },
          { id: 'goals', label: 'Metas Inteligentes', icon: Award },
          { id: 'pass', label: 'IA do Passe', icon: Percent },
          { id: 'weekly', label: 'Planejador', icon: Calendar },
          { id: 'demand', label: 'Mapa de Demanda', icon: Map },
          { id: 'fuel', label: 'IA Combustível', icon: Fuel },
          { id: 'maintenance', label: 'Manutenção', icon: Wrench },
          { id: 'compare', label: 'Plataformas', icon: Layers }
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              id={`tab-btn-${tab.id}`}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 py-3 px-5 text-xs font-semibold border-b-2 transition-all relative cursor-pointer ${
                isActive 
                  ? 'border-purple-500 text-purple-300 bg-purple-950/10' 
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-purple-400' : 'text-slate-400'}`} />
              {tab.label}
              {tab.id === 'driver-ai' && (
                <span className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-pulse absolute top-2 right-2"></span>
              )}
            </button>
          );
        })}
      </div>

      {/* TAB CONTENT AREA */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -15 }}
          transition={{ duration: 0.2 }}
        >
          
          {/* =========================================================================
              MÓDULO 10 & HOME TAB: DASHBOARD EXECUTIVO
              ========================================================================= */}
          {activeTab === 'home' && (
            <div className="space-y-8" id="home-dashboard-main-view">
              
              {/* Onboarding checklist */}
              {!hasCompletedSetup && (
                <div className="p-6 rounded-2xl bg-gradient-to-br from-[#120935]/60 via-[#0a0521]/90 to-[#04010a] border border-purple-900/30 relative overflow-hidden shadow-xl" id="onboarding-block">
                  <div className="flex flex-col lg:flex-row justify-between gap-6 relative z-10">
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <span className="p-1 px-2.5 bg-purple-950 text-purple-400 font-mono text-xs font-bold rounded-lg border border-purple-900/40">
                          Onboarding {onboardingProgress}%
                        </span>
                        <h2 className="text-md font-bold text-white flex items-center gap-2 font-display">
                          Calibração Operacional <Sparkles className="w-4 h-4 text-purple-400 animate-pulse" />
                        </h2>
                      </div>
                      <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
                        Complete os requisitos para que o copiloto calcule automaticamente o seu faturamento real, ROI operacional, economia com o passe e desgaste de peças.
                      </p>
                      
                      {/* Bar */}
                      <div className="h-2 bg-[#090518] rounded-full overflow-hidden border border-purple-950/50 max-w-md">
                        <div className="h-full bg-gradient-to-r from-purple-500 to-indigo-500 rounded-full" style={{ width: `${onboardingProgress}%` }}></div>
                      </div>
                    </div>

                    {onboardingProgress === 80 && (
                      <button
                        onClick={completeOnboarding}
                        className="lg:self-center px-5 py-3 bg-gradient-to-r from-purple-600 to-indigo-500 hover:from-purple-500 hover:to-indigo-400 text-white font-bold rounded-xl text-xs flex items-center gap-2 shadow-[0_0_20px_rgba(147,51,234,0.35)] transition-all cursor-pointer active:scale-95"
                      >
                        <CheckCircle className="w-4 h-4" /> Ativar Conta Operacional
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Bento Grid layout with exactly 14 requested cards */}
              <div id="bento-dashboard-home">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-xs font-bold font-mono tracking-wider text-purple-400 uppercase">
                    Bento Dashboard Executivo V3
                  </h3>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-slate-400">Simulação Faturamento Diário:</span>
                    <input 
                      type="range" 
                      min="100" 
                      max="1000" 
                      step="25"
                      value={customDailyRevenue}
                      onChange={(e) => setCustomDailyRevenue(Number(e.target.value))}
                      className="w-24 accent-purple-500 h-1.5 cursor-pointer rounded-lg bg-purple-950"
                    />
                    <span className="text-xs font-mono font-bold text-slate-200">{formatCurrency(customDailyRevenue)}</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  
                  {/* Card 1: Receita Hoje */}
                  <div className="p-5 rounded-2xl bg-[#0b0821]/80 border border-purple-950/30 hover:border-purple-800/40 hover:shadow-[0_4px_20px_rgba(124,58,237,0.08)] transition-all flex flex-col justify-between h-[125px]">
                    <div className="flex justify-between items-center text-slate-400">
                      <span className="text-[11px] font-bold uppercase tracking-wider">Receita Hoje</span>
                      <DollarSign className="w-4.5 h-4.5 text-purple-400" />
                    </div>
                    <div>
                      <h3 className="text-2xl font-bold text-white tracking-tight font-mono">{formatCurrency(todayGross)}</h3>
                      <p className="text-[10px] text-slate-400 truncate mt-0.5">Faturamento bruto do dia</p>
                    </div>
                  </div>

                  {/* Card 2: Lucro Hoje */}
                  <div className="p-5 rounded-2xl bg-[#0b0821]/80 border border-purple-950/30 hover:border-purple-800/40 hover:shadow-[0_4px_20px_rgba(124,58,237,0.08)] transition-all flex flex-col justify-between h-[125px]">
                    <div className="flex justify-between items-center text-slate-400">
                      <span className="text-[11px] font-bold uppercase tracking-wider">Lucro Hoje</span>
                      <Coins className="w-4.5 h-4.5 text-indigo-400" />
                    </div>
                    <div>
                      <h3 className="text-2xl font-bold text-emerald-400 tracking-tight font-mono">{formatCurrency(todayNet)}</h3>
                      <p className="text-[10px] text-slate-400 truncate mt-0.5">Faturamento líquido de custos</p>
                    </div>
                  </div>

                  {/* Card 3: Meta Diária */}
                  <div className="p-5 rounded-2xl bg-[#0b0821]/80 border border-purple-950/30 hover:border-purple-800/40 hover:shadow-[0_4px_20px_rgba(124,58,237,0.08)] transition-all flex flex-col justify-between h-[125px]">
                    <div className="flex justify-between items-center text-slate-400">
                      <span className="text-[11px] font-bold uppercase tracking-wider">Meta Diária</span>
                      <Crosshair className="w-4.5 h-4.5 text-fuchsia-400" />
                    </div>
                    <div>
                      <div className="flex justify-between items-baseline">
                        <h3 className="text-2xl font-bold text-white tracking-tight font-mono">{dailyPercent.toFixed(0)}%</h3>
                        <span className="text-[10px] font-mono text-slate-400">Meta: {formatCurrency(dailyGoalVal)}</span>
                      </div>
                      <div className="w-full bg-slate-950 h-1.5 rounded-full overflow-hidden mt-1.5">
                        <div className="h-full bg-gradient-to-r from-purple-500 to-indigo-500 rounded-full" style={{ width: `${dailyPercent}%` }}></div>
                      </div>
                    </div>
                  </div>

                  {/* Card 4: DriverScore */}
                  <div className="p-5 rounded-2xl bg-[#0b0821]/80 border border-purple-950/30 hover:border-purple-800/40 hover:shadow-[0_4px_20px_rgba(124,58,237,0.08)] transition-all flex flex-col justify-between h-[125px]">
                    <div className="flex justify-between items-center text-slate-400">
                      <span className="text-[11px] font-bold uppercase tracking-wider">DriverScore</span>
                      <Gauge className="w-4.5 h-4.5 text-amber-400" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-2xl font-bold text-white tracking-tight font-mono">{scoreReport.score}</h3>
                        <span className="text-[9px] bg-amber-950/40 text-amber-400 border border-amber-900/40 px-1.5 py-0.5 rounded font-black uppercase font-mono tracking-wider">
                          {scoreReport.level}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-400 truncate mt-0.5">Rating geral de eficiência</p>
                    </div>
                  </div>

                  {/* Card 5: Economia do Passe */}
                  <div className="p-5 rounded-2xl bg-[#0b0821]/80 border border-purple-950/30 hover:border-purple-800/40 hover:shadow-[0_4px_20px_rgba(124,58,237,0.08)] transition-all flex flex-col justify-between h-[125px]">
                    <div className="flex justify-between items-center text-slate-400">
                      <span className="text-[11px] font-bold uppercase tracking-wider">Retorno do Passe</span>
                      <Percent className="w-4.5 h-4.5 text-emerald-400" />
                    </div>
                    <div>
                      <h3 className="text-2xl font-bold text-white tracking-tight font-mono">{scoreReport.breakdown.passSavings > 0 ? 'R$ 120,00' : 'R$ 0,00'}</h3>
                      <p className="text-[10px] text-slate-400 truncate mt-0.5">Comissão poupada com o Passe</p>
                    </div>
                  </div>

                  {/* Card 6: Amortização de Custos */}
                  <div className="p-5 rounded-2xl bg-[#0b0821]/80 border border-purple-950/30 hover:border-purple-800/40 hover:shadow-[0_4px_20px_rgba(124,58,237,0.08)] transition-all flex flex-col justify-between h-[125px]">
                    <div className="flex justify-between items-center text-slate-400">
                      <span className="text-[11px] font-bold uppercase tracking-wider">Custos Operacionais</span>
                      <Activity className="w-4.5 h-4.5 text-rose-400" />
                    </div>
                    <div>
                      <h3 className="text-2xl font-bold text-rose-400 tracking-tight font-mono">{formatCurrency(todayExpensesSum)}</h3>
                      <p className="text-[10px] text-slate-400 truncate mt-0.5">Combustível + depreciação hoje</p>
                    </div>
                  </div>

                  {/* Card 7: ROI do Dia */}
                  <div className="p-5 rounded-2xl bg-[#0b0821]/80 border border-purple-950/30 hover:border-purple-800/40 hover:shadow-[0_4px_20px_rgba(124,58,237,0.08)] transition-all flex flex-col justify-between h-[125px]">
                    <div className="flex justify-between items-center text-slate-400">
                      <span className="text-[11px] font-bold uppercase tracking-wider">ROI do Dia</span>
                      <TrendingUp className="w-4.5 h-4.5 text-blue-400" />
                    </div>
                    <div>
                      <h3 className="text-2xl font-bold text-white tracking-tight font-mono">{todayROI.toFixed(0)}%</h3>
                      <p className="text-[10px] text-slate-400 truncate mt-0.5">Retorno sobre cada real gasto</p>
                    </div>
                  </div>

                  {/* Card 8: Margem Líquida */}
                  <div className="p-5 rounded-2xl bg-[#0b0821]/80 border border-purple-950/30 hover:border-purple-800/40 hover:shadow-[0_4px_20px_rgba(124,58,237,0.08)] transition-all flex flex-col justify-between h-[125px]">
                    <div className="flex justify-between items-center text-slate-400">
                      <span className="text-[11px] font-bold uppercase tracking-wider">Margem Líquida</span>
                      <Layers className="w-4.5 h-4.5 text-cyan-400" />
                    </div>
                    <div>
                      <h3 className="text-2xl font-bold text-emerald-400 tracking-tight font-mono">{todayMargin.toFixed(1)}%</h3>
                      <p className="text-[10px] text-slate-400 truncate mt-0.5">Porcentagem faturada que vira lucro</p>
                    </div>
                  </div>

                  {/* Card 9: Lucro por Hora */}
                  <div className="p-5 rounded-2xl bg-[#0b0821]/80 border border-purple-950/30 hover:border-purple-800/40 hover:shadow-[0_4px_20px_rgba(124,58,237,0.08)] transition-all flex flex-col justify-between h-[125px]">
                    <div className="flex justify-between items-center text-slate-400">
                      <span className="text-[11px] font-bold uppercase tracking-wider">Lucro / Hora</span>
                      <Clock className="w-4.5 h-4.5 text-purple-400" />
                    </div>
                    <div>
                      <h3 className="text-2xl font-bold text-white tracking-tight font-mono">{formatCurrency(todayProfitPerHour)}/h</h3>
                      <p className="text-[10px] text-slate-400 truncate mt-0.5">Lucro líquido por hora ativa</p>
                    </div>
                  </div>

                  {/* Card 10: Lucro por KM */}
                  <div className="p-5 rounded-2xl bg-[#0b0821]/80 border border-purple-950/30 hover:border-purple-800/40 hover:shadow-[0_4px_20px_rgba(124,58,237,0.08)] transition-all flex flex-col justify-between h-[125px]">
                    <div className="flex justify-between items-center text-slate-400">
                      <span className="text-[11px] font-bold uppercase tracking-wider">Lucro / KM</span>
                      <Milestone className="w-4.5 h-4.5 text-pink-400" />
                    </div>
                    <div>
                      <h3 className="text-2xl font-bold text-white tracking-tight font-mono">{formatCurrency(todayProfitPerKm)}/km</h3>
                      <p className="text-[10px] text-slate-400 truncate mt-0.5">Lucro líquido por quilômetro rodado</p>
                    </div>
                  </div>

                  {/* Card 11: KM Rodados Diários */}
                  <div className="p-5 rounded-2xl bg-[#0b0821]/80 border border-purple-950/30 hover:border-purple-800/40 hover:shadow-[0_4px_20px_rgba(124,58,237,0.08)] transition-all flex flex-col justify-between h-[125px]">
                    <div className="flex justify-between items-center text-slate-400">
                      <span className="text-[11px] font-bold uppercase tracking-wider">Km Rodados</span>
                      <Car className="w-4.5 h-4.5 text-indigo-400" />
                    </div>
                    <div>
                      <h3 className="text-2xl font-bold text-white tracking-tight font-mono">{formatDistance(todayKm)}</h3>
                      <p className="text-[10px] text-slate-400 truncate mt-0.5">Distância total percorrida hoje</p>
                    </div>
                  </div>

                  {/* Card 12: KM Vazio Rodado */}
                  <div className="p-5 rounded-2xl bg-[#0b0821]/80 border border-purple-950/30 hover:border-purple-800/40 hover:shadow-[0_4px_20px_rgba(124,58,237,0.08)] transition-all flex flex-col justify-between h-[125px]">
                    <div className="flex justify-between items-center text-slate-400">
                      <span className="text-[11px] font-bold uppercase tracking-wider">KM Vazio (%)</span>
                      <AlertTriangle className="w-4.5 h-4.5 text-amber-500" />
                    </div>
                    <div>
                      <h3 className="text-2xl font-bold text-slate-200 tracking-tight font-mono">{todayEmptyKmPercent.toFixed(0)}%</h3>
                      <p className="text-[10px] text-slate-400 truncate mt-0.5">Quilômetros rodados sem passageiro</p>
                    </div>
                  </div>

                  {/* Card 13: Tempo Ocioso */}
                  <div className="p-5 rounded-2xl bg-[#0b0821]/80 border border-purple-950/30 hover:border-purple-800/40 hover:shadow-[0_4px_20px_rgba(124,58,237,0.08)] transition-all flex flex-col justify-between h-[125px]">
                    <div className="flex justify-between items-center text-slate-400">
                      <span className="text-[11px] font-bold uppercase tracking-wider">Tempo Ocioso</span>
                      <Clock className="w-4.5 h-4.5 text-slate-400" />
                    </div>
                    <div>
                      <h3 className="text-2xl font-bold text-slate-300 tracking-tight font-mono">{todayTotalStoppedMinutes} min</h3>
                      <p className="text-[10px] text-slate-400 truncate mt-0.5">Tempo logado parado aguardando chamadas</p>
                    </div>
                  </div>

                  {/* Card 14: Custo de Depreciação real */}
                  <div className="p-5 rounded-2xl bg-[#0b0821]/80 border border-purple-950/30 hover:border-purple-800/40 hover:shadow-[0_4px_20px_rgba(124,58,237,0.08)] transition-all flex flex-col justify-between h-[125px]">
                    <div className="flex justify-between items-center text-slate-400">
                      <span className="text-[11px] font-bold uppercase tracking-wider">Depreciação Real</span>
                      <Wrench className="w-4.5 h-4.5 text-rose-400" />
                    </div>
                    <div>
                      <h3 className="text-2xl font-bold text-rose-400 tracking-tight font-mono">R$ {(todayKm * 0.18).toFixed(2)}</h3>
                      <p className="text-[10px] text-slate-400 truncate mt-0.5">Desgaste mecânico e perda de valor</p>
                    </div>
                  </div>

                </div>
              </div>

              {/* Dynamic comparative Area & Bar charts for financial history */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8" id="financial-charts-home">
                {/* Area Chart: Profit vs Costs */}
                <div className="bg-[#0b0821]/80 border border-purple-950/30 p-6 rounded-2xl shadow-xl space-y-4">
                  <div className="flex justify-between items-center border-b border-purple-950/10 pb-3">
                    <h4 className="text-sm font-bold text-white font-display">Histórico de Performance Líquida</h4>
                    <span className="text-[10px] text-slate-400">Últimos 7 dias</span>
                  </div>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={earnings.slice(-7).map(e => ({
                        date: new Date(e.date).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' }),
                        Faturamento: Number(e.gross_amount),
                        Custos: Number(e.empty_km || 0) * currentCostPerKm + (Number(e.total_km) - Number(e.empty_km || 0)) * currentCostPerKm,
                        Lucro: Number(e.gross_amount) - (Number(e.total_km) * currentCostPerKm)
                      }))}>
                        <defs>
                          <linearGradient id="colorGross" x1="0" y1="0" x2="0" y2="1" >
                            <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.2} />
                            <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                          </linearGradient>
                          <linearGradient id="colorNet" x1="0" y1="0" x2="0" y2="1" >
                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                            <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1d1045" />
                        <XAxis dataKey="date" stroke="#94a3b8" fontSize={10} />
                        <YAxis stroke="#94a3b8" fontSize={10} />
                        <Tooltip contentStyle={{ backgroundColor: '#0b0821', borderColor: '#3b0764' }} />
                        <Area type="monotone" dataKey="Faturamento" stroke="#8b5cf6" fillOpacity={1} fill="url(#colorGross)" />
                        <Area type="monotone" dataKey="Lucro" stroke="#10b981" fillOpacity={1} fill="url(#colorNet)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Bar Chart: Empty vs Passenger KM */}
                <div className="bg-[#0b0821]/80 border border-purple-950/30 p-6 rounded-2xl shadow-xl space-y-4">
                  <div className="flex justify-between items-center border-b border-purple-950/10 pb-3">
                    <h4 className="text-sm font-bold text-white font-display">Rodagem Produtiva vs KM Vazio</h4>
                    <span className="text-[10px] text-slate-400">Eficiência de km rodado</span>
                  </div>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={earnings.slice(-7).map(e => {
                        const total = Number(e.total_km);
                        const empty = Number(e.empty_km || (total * 0.20));
                        return {
                          date: new Date(e.date).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' }),
                          Passageiro: total - empty,
                          Vazio: empty
                        };
                      })}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1d1045" />
                        <XAxis dataKey="date" stroke="#94a3b8" fontSize={10} />
                        <YAxis stroke="#94a3b8" fontSize={10} />
                        <Tooltip contentStyle={{ backgroundColor: '#0b0821', borderColor: '#3b0764' }} />
                        <Legend wrapperStyle={{ fontSize: '10px' }} />
                        <Bar dataKey="Passageiro" stackId="a" fill="#3b82f6" name="Com Passageiro" />
                        <Bar dataKey="Vazio" stackId="a" fill="#f59e0b" name="Km Vazio" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

            </div>
          )}

          {/* =========================================================================
              MÓDULO 1: DRIVER AI
              ========================================================================= */}
          {activeTab === 'driver-ai' && (
            <div className="space-y-8" id="driver-ai-main-view">
              <div className="bg-gradient-to-r from-purple-950/30 to-indigo-950/30 border border-purple-900/30 rounded-2xl p-6 md:p-8 flex items-center gap-6 shadow-xl">
                <div className="p-4 bg-purple-900/40 rounded-2xl border border-purple-700/30 text-purple-300">
                  <Sparkles className="w-8 h-8" />
                </div>
                <div>
                  <span className="text-[10px] font-bold tracking-widest text-purple-400 font-mono uppercase">CO-PILOTO DE INTELIGÊNCIA EM MOBILIDADE</span>
                  <h3 className="text-xl font-bold text-white font-display">Driver AI Co-Pilot</h3>
                  <p className="text-xs text-slate-400 max-w-2xl mt-1 leading-relaxed">
                    Nossa inteligência de dados cruza sua localização com o consumo real do veículo, tabelas de passes ativos e picos históricos da Uber e 99 para responder de forma imediata e sem atrito.
                  </p>
                </div>
              </div>

              {/* Answers Panel */}
              <DiagnosticCards 
                dailyOutlook={dailyOutlook} 
                todayKm={todayKm} 
                todayGross={todayGross} 
                currentCostPerKm={currentCostPerKm} 
              />

              {/* Actionable Suggestions */}
              <div className="bg-[#0b0821]/80 border border-purple-950/30 p-6 rounded-2xl shadow-xl">
                <div className="flex items-center gap-2 border-b border-purple-950/10 pb-4 mb-4">
                  <MessageSquare className="w-5 h-5 text-purple-400" />
                  <div>
                    <h4 className="text-sm font-bold text-white font-display">Painel de Recomendações Inteligentes</h4>
                    <p className="text-xs text-slate-400">Sugestões táticas geradas em tempo real pelo Driver AI.</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {aiRecommendations.map((rec, i) => (
                    <div key={i} className="p-4 rounded-xl bg-purple-950/10 border border-purple-900/20 flex gap-3 items-start">
                      <Info className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
                      <span className="text-xs text-slate-200 leading-relaxed font-sans">{rec.text}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* =========================================================================
              MÓDULO 2: SCORE DO MOTORISTA
              ========================================================================= */}
          {activeTab === 'score' && (
            <div className="space-y-8" id="driver-score-main-view">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Score Gauge Circular SVG */}
                <div className="lg:col-span-5">
                  <ScoreMeter scoreReport={scoreReport} />
                </div>

                {/* Performance Breakdown Table */}
                <div className="lg:col-span-7 bg-[#0b0821]/80 border border-purple-950/30 p-6 md:p-8 rounded-2xl shadow-xl space-y-6">
                  <div>
                    <h4 className="text-xs font-bold font-mono text-purple-400 uppercase tracking-wider border-b border-purple-950/10 pb-3 flex justify-between items-center">
                      <span>Análise Detalhada de Eficiência</span>
                      <DataSourceBadge type="simulated" />
                    </h4>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    {/* Profit per Hour */}
                    <div className="p-4 bg-[#04010a] border border-purple-950/40 rounded-xl space-y-1">
                      <span className="text-[10px] text-slate-500 uppercase font-mono font-bold block">Faturamento por hora ativa</span>
                      <div className="flex justify-between items-baseline">
                        <span className="text-lg font-mono font-bold text-white">{formatCurrency(scoreReport.breakdown.profitPerHour)}/h</span>
                        <span className="text-[10px] text-emerald-400 font-mono font-bold">Excelente</span>
                      </div>
                    </div>

                    {/* Profit per KM */}
                    <div className="p-4 bg-[#04010a] border border-purple-950/40 rounded-xl space-y-1">
                      <span className="text-[10px] text-slate-500 uppercase font-mono font-bold block">Faturamento líquido por km</span>
                      <div className="flex justify-between items-baseline">
                        <span className="text-lg font-mono font-bold text-white">{formatCurrency(scoreReport.breakdown.profitPerKm)}/km</span>
                        <span className="text-[10px] text-emerald-400 font-mono font-bold">Otimizado</span>
                      </div>
                    </div>

                    {/* Empty KM % */}
                    <div className="p-4 bg-[#04010a] border border-purple-950/40 rounded-xl space-y-1">
                      <span className="text-[10px] text-slate-500 uppercase font-mono font-bold block">KM ocioso (Vazio)</span>
                      <div className="flex justify-between items-baseline">
                        <span className="text-lg font-mono font-bold text-white">{scoreReport.breakdown.emptyKmPercent.toFixed(1)}%</span>
                        <span className={`text-[10px] font-mono font-bold ${scoreReport.breakdown.emptyKmPercent > 20 ? 'text-rose-400' : 'text-emerald-400'}`}>
                          {scoreReport.breakdown.emptyKmPercent > 20 ? 'Atenção' : 'Excelente'}
                        </span>
                      </div>
                    </div>

                    {/* Acceptance / Cancellation */}
                    <div className="p-4 bg-[#04010a] border border-purple-950/40 rounded-xl space-y-1">
                      <span className="text-[10px] text-slate-500 uppercase font-mono font-bold block">Taxas Uber / 99</span>
                      <div className="flex justify-between text-xs font-mono text-slate-300 pt-1">
                        <span>Aceitação: <strong className="text-emerald-400">{scoreReport.breakdown.acceptanceRate}%</strong></span>
                        <span>Cancelam.: <strong className="text-emerald-400">{scoreReport.breakdown.cancellationRate}%</strong></span>
                      </div>
                    </div>
                  </div>

                  {/* Recommendations */}
                  <RecommendationsList scoreReport={scoreReport} />
                </div>
              </div>
            </div>
          )}

          {/* =========================================================================
              MÓDULO 3: METAS INTELIGENTES
              ========================================================================= */}
          {activeTab === 'goals' && (
            <div className="space-y-8" id="smart-goals-main-view">
              <div className="bg-gradient-to-r from-purple-950/30 to-indigo-950/30 border border-purple-900/30 rounded-2xl p-6 md:p-8 flex items-center gap-6 shadow-xl">
                <div className="p-4 bg-purple-900/40 rounded-2xl border border-purple-700/30 text-purple-300">
                  <Award className="w-8 h-8" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold tracking-widest text-purple-400 font-mono uppercase">PLANEJADOR ORÇAMENTÁRIO REVERSO</span>
                  </div>
                  <h3 className="text-xl font-bold text-white font-display">Calculador de Metas Inteligentes</h3>
                  <p className="text-xs text-slate-400 max-w-2xl mt-1 leading-relaxed">
                    Insira quanto deseja lucrar líquido e a IA calculará reversamente o seu faturamento bruto necessário, horas estimadas de expediente e distância média diária a rodar.
                  </p>
                </div>
              </div>

              {/* Toggle switch day/week/month */}
              <div className="flex bg-[#0b0821] p-1 border border-purple-950/40 rounded-xl max-w-xs select-none">
                {['day', 'week', 'month'].map((p) => (
                  <button
                    key={p}
                    onClick={() => {
                      setTargetPeriod(p as any);
                      setTargetNetInput(p === 'day' ? 150 : p === 'week' ? 900 : 3000);
                    }}
                    className={`flex-1 py-2 px-3 text-xs font-bold rounded-lg transition-all capitalize cursor-pointer ${
                      targetPeriod === p ? 'bg-purple-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {p === 'day' ? 'Diário' : p === 'week' ? 'Semanal' : 'Mensal'}
                  </button>
                ))}
              </div>

              {/* Goal Input slider panel */}
              <GoalInputForm 
                targetNetInput={targetNetInput} 
                setTargetNetInput={setTargetNetInput} 
                targetPeriod={targetPeriod} 
                calculatedGoals={calculatedGoals} 
              />

              {/* Performance Projections list */}
              <PerformanceTracker calculatedGoals={calculatedGoals} />
            </div>
          )}

          {/* =========================================================================
              MÓDULO 4: RECOMENDAÇÃO DO PASSE ROXOU
              ========================================================================= */}
          {activeTab === 'pass' && (
            <div className="space-y-8" id="pass-recommendation-main-view">
              <div className="bg-gradient-to-r from-purple-950/30 to-indigo-950/30 border border-purple-900/30 rounded-2xl p-6 md:p-8 flex items-center gap-6 shadow-xl">
                <div className="p-4 bg-purple-900/40 rounded-2xl border border-purple-700/30 text-purple-300">
                  <Percent className="w-8 h-8" />
                </div>
                <div>
                  <span className="text-[10px] font-bold tracking-widest text-purple-400 font-mono uppercase">ISENÇÃO DE TAXAS DA CORRIDA</span>
                  <h3 className="text-xl font-bold text-white font-display">Calculadora Inteligente do Passe Roxou</h3>
                  <p className="text-xs text-slate-400 max-w-2xl mt-1 leading-relaxed">
                    O Passe Roxou reduz a zero a taxa cobrada pela plataforma em troca de uma tarifa fixa. Nossa IA projeta se o seu volume de rodagem cobrirá o break-even e economizará dinheiro hoje.
                  </p>
                </div>
              </div>

              {/* Pass simulation feedback card */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                
                {/* Rule engine stats card */}
                <div className="p-6 md:p-8 rounded-2xl bg-[#0b0821]/80 border border-purple-950/30 shadow-xl space-y-5">
                  <div className="flex justify-between items-start border-b border-purple-950/10 pb-3">
                    <h4 className="text-xs font-bold font-mono text-purple-400 uppercase tracking-wider">Metas e Amortização de Taxa do Passe</h4>
                    <DataSourceBadge type="simulated" />
                  </div>

                  <div className="space-y-4">
                    <div>
                      <span className="text-[10px] text-slate-500 uppercase block font-mono">Faturamento estimado de hoje</span>
                      <h3 className="text-2xl font-bold text-white font-mono">{formatCurrency(todayGross)}</h3>
                    </div>

                    <div className="p-4 bg-[#04010a] border border-purple-500/10 rounded-xl space-y-1">
                      <span className="text-[10px] text-slate-400 font-bold font-mono">Análise de Ativação do Passe:</span>
                      <p className="text-xs text-slate-200 mt-1 leading-relaxed font-sans">
                        {dailyOutlook.shouldActivatePass ? (
                          <>
                            <strong className="text-emerald-400 font-semibold">RECOMENDADO!</strong> O faturamento projetado de {formatCurrency(todayGross)} supera confortavelmente a linha de break-even de R$ 180,00. 
                          </>
                        ) : (
                          <>
                            <strong className="text-amber-400 font-semibold">NÃO ATIVAR.</strong> Seu faturamento hoje pode não cobrir a taxa fixa do passe. Prefira o modo padrão de comissão percentual.
                          </>
                        )}
                      </p>
                    </div>

                    <div className="pt-2 flex justify-between items-center text-xs font-mono text-slate-400">
                      <span>Economia estimada hoje:</span>
                      <strong className="text-emerald-400 text-sm">
                        {dailyOutlook.shouldActivatePass ? 'R$ 48,00' : 'R$ 0,00'}
                      </strong>
                    </div>
                  </div>
                </div>

                {/* Comparative visualization list of Passes available */}
                <div className="p-6 md:p-8 rounded-2xl bg-[#0b0821]/80 border border-purple-950/30 shadow-xl space-y-4">
                  <h4 className="text-xs font-bold font-mono text-purple-400 uppercase tracking-wider border-b border-purple-950/10 pb-3">
                    Modelos de passes disponíveis na região
                  </h4>

                  <div className="space-y-3.5">
                    {[
                      { name: 'Passe Roxou 24 Horas', rate: 'R$ 15,00', limit: 'Isenção total até R$ 250 em comissões', rec: 'Ideal para fins de semana avulsos.' },
                      { name: 'Passe Roxou 72 Horas', rate: 'R$ 38,00', limit: 'Isenção total até R$ 600 em comissões', rec: 'Perfeito para o eixo de sexta a domingo.' },
                      { name: 'Passe Roxou Semanal', rate: 'R$ 80,00', limit: 'Isenção total até R$ 1400 em comissões', rec: 'Recomendado para motoristas corporativos de 45h/semana.' },
                    ].map((pass, i) => (
                      <div key={i} className="p-3 bg-[#04010a] border border-purple-950/35 rounded-xl flex justify-between items-center">
                        <div>
                          <h5 className="text-xs font-bold text-slate-100">{pass.name}</h5>
                          <p className="text-[10px] text-slate-400 mt-0.5">{pass.limit}</p>
                        </div>
                        <div className="text-right">
                          <span className="text-xs font-mono font-bold text-purple-400">{pass.rate}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

              </div>
            </div>
          )}

          {/* =========================================================================
              MÓDULO 5: PLANEJADOR SEMANAL DE INTELIGÊNCIA
              ========================================================================= */}
          {activeTab === 'weekly' && (
            <div className="space-y-8" id="weekly-planner-main-view">
              <div className="bg-gradient-to-r from-purple-950/30 to-indigo-950/30 border border-purple-900/30 rounded-2xl p-6 md:p-8 flex items-center gap-6 shadow-xl">
                <div className="p-4 bg-purple-900/40 rounded-2xl border border-purple-700/30 text-purple-300">
                  <Calendar className="w-8 h-8" />
                </div>
                <div>
                  <span className="text-[10px] font-bold tracking-widest text-purple-400 font-mono uppercase">CRONOGRAMA DE HORAS EXTREMAS</span>
                  <h3 className="text-xl font-bold text-white font-display">Planejador Semanal Co-Pilot</h3>
                  <p className="text-xs text-slate-400 max-w-2xl mt-1 leading-relaxed">
                    Cronograma analítico da probabilidade de demanda e retorno líquido hora a hora por dia da semana. Planeje sua folga e maximize seu ROI nos momentos ótimos de tráfego.
                  </p>
                </div>
              </div>

              {/* Weekly calendar items grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {weeklyPlan.map((day, idx) => (
                  <div key={idx} className="p-5 rounded-2xl bg-[#0b0821]/80 border border-purple-950/30 shadow-lg flex flex-col justify-between h-[190px]">
                    <div className="space-y-3">
                      <div className="flex justify-between items-start">
                        <span className="text-xs font-bold text-slate-100">{day.dayName}</span>
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded font-mono border ${
                          day.demandProbability >= 90 
                            ? 'bg-emerald-950 text-emerald-400 border-emerald-900/30' 
                            : day.demandProbability >= 75 
                            ? 'bg-indigo-950 text-indigo-400 border-indigo-900/30' 
                            : 'bg-slate-950 text-slate-400 border-slate-900/30'
                        }`}>
                          {day.demandProbability}% Demanda
                        </span>
                      </div>

                      <div className="space-y-1">
                        <span className="text-[9px] text-slate-500 block uppercase font-mono">Janela Ideal</span>
                        <p className="text-[10px] text-slate-200 line-clamp-2 leading-relaxed">{day.bestHours}</p>
                      </div>
                    </div>

                    <div className="border-t border-purple-950/10 pt-3 flex justify-between items-center">
                      <div>
                        <span className="text-[9px] text-slate-500 uppercase block font-mono">Meta Diária</span>
                        <span className="text-xs font-mono font-bold text-emerald-400">{formatCurrency(day.expectedProfit)}</span>
                      </div>
                      <span className={`text-[10px] font-mono font-bold ${day.shouldUsePass ? 'text-indigo-400' : 'text-slate-400'}`}>
                        {day.shouldUsePass ? 'Passe Indicado' : 'Modo Comum'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* =========================================================================
              MÓDULO 6: MAPA DE DEMANDA GEOLOCALIZADO
              ========================================================================= */}
          {activeTab === 'demand' && (
            <div className="space-y-8" id="demand-map-main-view">
              <div className="bg-gradient-to-r from-purple-950/30 to-indigo-950/30 border border-purple-900/30 rounded-2xl p-6 md:p-8 flex items-center gap-6 shadow-xl">
                <div className="p-4 bg-purple-900/40 rounded-2xl border border-purple-700/30 text-purple-300">
                  <Map className="w-8 h-8" />
                </div>
                <div>
                  <span className="text-[10px] font-bold tracking-widest text-purple-400 font-mono uppercase">INTELIGÊNCIA GEOCONDICIONAL</span>
                  <h3 className="text-xl font-bold text-white font-display">Eixos Quentes e Hubs de Passageiros</h3>
                  <p className="text-xs text-slate-400 max-w-2xl mt-1 leading-relaxed">
                    Análise espacial de picos e eixos geolocalizados com maior probabilidade de dinâmicas elevadas. Toque em qualquer hotspot para abrir as coordenadas do Google Maps e rotas ótimas.
                  </p>
                </div>
              </div>

              {/* Demand Hotspots Interactive Grid */}
              <DemandHeatMap hotspots={hotspots} onSelectHotspot={(hs) => setSelectedHotspot(hs)} />

              {/* Selected Hotspot Details Modal */}
              {selectedHotspot && (
                <HotspotDetailsModal hotspot={selectedHotspot} onClose={() => setSelectedHotspot(null)} />
              )}
            </div>
          )}

          {/* =========================================================================
              MÓDULO 7: IA DE COMBUSTÍVEL FLEX & ELÉTRICO
              ========================================================================= */}
          {activeTab === 'fuel' && (
            <div className="space-y-8" id="fuel-management-main-view">
              <div className="bg-gradient-to-r from-purple-950/30 to-indigo-950/30 border border-purple-900/30 rounded-2xl p-6 md:p-8 flex items-center gap-6 shadow-xl">
                <div className="p-4 bg-purple-900/40 rounded-2xl border border-purple-700/30 text-purple-300">
                  <Fuel className="w-8 h-8" />
                </div>
                <div>
                  <span className="text-[10px] font-bold tracking-widest text-purple-400 font-mono uppercase">GERENCIADOR TÉRMICO OPERACIONAL</span>
                  <h3 className="text-xl font-bold text-white font-display">Inteligência de Combustível</h3>
                  <p className="text-xs text-slate-400 max-w-2xl mt-1 leading-relaxed">
                    Calculadora flex de paridade térmica ou carregador inteligente para elétricos. Insira os valores locais da bomba e veja instantaneamente o combustível com melhor autonomia financeira por real.
                  </p>
                </div>
              </div>

              {/* Fuel Flex panel for Ethanol vs Gasoline combustion cars */}
              {(vehicle?.fuel_type?.toLowerCase().includes('flex') || vehicle?.fuel_type?.toLowerCase().includes('combust') || !vehicle) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  
                  {/* flex form card */}
                  <div className="p-6 md:p-8 rounded-2xl bg-[#0b0821]/80 border border-purple-950/30 shadow-xl space-y-6">
                    <h4 className="text-xs font-bold font-mono text-purple-400 uppercase tracking-wider border-b border-purple-950/10 pb-3 flex items-center gap-1.5">
                      <Fuel className="w-4.5 h-4.5 text-purple-400" />
                      Calculador de Paridade Térmica (Flex)
                    </h4>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="block text-xs font-bold text-slate-400 uppercase font-mono">Preço Gasolina (R$/L)</label>
                        <input 
                          type="number" 
                          step="0.01" 
                          value={flexGasPrice} 
                          onChange={(e) => setFlexGasPrice(Number(e.target.value) || 0)}
                          className="w-full bg-[#04010a] border border-purple-950/40 rounded-xl py-3 px-4 text-sm font-bold text-slate-100 font-mono"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="block text-xs font-bold text-slate-400 uppercase font-mono">Preço Etanol (R$/L)</label>
                        <input 
                          type="number" 
                          step="0.01" 
                          value={flexEthPrice} 
                          onChange={(e) => setFlexEthPrice(Number(e.target.value) || 0)}
                          className="w-full bg-[#04010a] border border-purple-950/40 rounded-xl py-3 px-4 text-sm font-bold text-slate-100 font-mono"
                        />
                      </div>
                    </div>

                    <div className="p-4 bg-[#04010a] border border-purple-950/40 rounded-xl space-y-2">
                      <span className="text-[10px] text-slate-500 font-mono uppercase font-bold">Relação Álcool/Gasolina</span>
                      <div className="flex justify-between items-baseline">
                        <h4 className="text-xl font-bold text-white font-mono">{(flexCalc.ratio * 100).toFixed(1)} %</h4>
                        <span className={`text-[10px] font-bold font-mono ${flexCalc.ratio < 0.70 ? 'text-emerald-400' : 'text-amber-400'}`}>
                          {flexCalc.ratio < 0.70 ? 'Vantagem Álcool (Abaixo de 70%)' : 'Vantagem Gasolina (Acima de 70%)'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* flex feedback card */}
                  <div className="p-6 md:p-8 rounded-2xl bg-[#0b0821]/80 border border-purple-950/30 shadow-xl flex flex-col justify-between h-full">
                    <div className="space-y-4">
                      <h4 className="text-xs font-bold font-mono text-purple-400 uppercase tracking-wider border-b border-purple-950/10 pb-3">
                        Relatório do Diagnóstico de Combustível
                      </h4>
                      <p className="text-xs text-slate-200 leading-relaxed font-sans">{flexCalc.reason}</p>
                      <p className="text-xs text-slate-300 leading-relaxed font-sans">
                        Ao rodar com a opção ideal, você reduz seu custo unitário proporcional em aproximadamente <strong className="text-emerald-400 font-mono">{flexCalc.savingPerLiterPercent.toFixed(1)}%</strong> por cada litro de combustível abastecido.
                      </p>
                    </div>

                    <div className="pt-4 border-t border-purple-950/10">
                      <span className="text-[10px] text-slate-400">Padrão de Consumo Médio configurado: <strong className="text-purple-300">{vehicle?.km_per_liter || 11.5} km/L</strong></span>
                    </div>
                  </div>
                </div>
              )}

              {/* Electric charge planner card */}
              {(vehicle?.fuel_type?.toLowerCase().includes('elétr') || vehicle?.fuel_type?.toLowerCase().includes('elet') || !vehicle) && (
                <div className="p-6 md:p-8 rounded-2xl bg-[#0b0821]/80 border border-purple-950/30 shadow-xl space-y-6">
                  <h4 className="text-xs font-bold font-mono text-purple-400 uppercase tracking-wider border-b border-purple-950/10 pb-3 flex items-center gap-2">
                    <Battery className="w-4.5 h-4.5 text-purple-400" />
                    Gerenciamento de Recarga Inteligente (Veículos Elétricos)
                  </h4>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Residential charging cost */}
                    <div className="p-4 bg-[#04010a] border border-purple-950/40 rounded-xl space-y-2">
                      <span className="text-[10px] font-bold text-slate-500 font-mono uppercase block">Recarga Residencial</span>
                      <h3 className="text-lg font-bold text-white font-mono">R$ {electricPlan.comparison.residential.costPer100km.toFixed(2)}</h3>
                      <p className="text-[10px] text-slate-400">Custo por cada 100km rodados</p>
                    </div>

                    {/* Public Slow charging cost */}
                    <div className="p-4 bg-[#04010a] border border-purple-950/40 rounded-xl space-y-2">
                      <span className="text-[10px] font-bold text-slate-500 font-mono uppercase block">Recarga AC Pública</span>
                      <h3 className="text-lg font-bold text-white font-mono">R$ {electricPlan.comparison.publicSlow.costPer100km.toFixed(2)}</h3>
                      <p className="text-[10px] text-slate-400">Custo por cada 100km rodados</p>
                    </div>

                    {/* Public Fast charging cost */}
                    <div className="p-4 bg-[#04010a] border border-purple-950/40 rounded-xl space-y-2">
                      <span className="text-[10px] font-bold text-slate-500 font-mono uppercase block">Recarga DC Rápida</span>
                      <h3 className="text-lg font-bold text-white font-mono">R$ {electricPlan.comparison.publicFast.costPer100km.toFixed(2)}</h3>
                      <p className="text-[10px] text-slate-400">Custo por cada 100km rodados</p>
                    </div>
                  </div>

                  <div className="p-4 bg-[#04010a] border border-purple-500/10 rounded-xl flex items-start gap-3">
                    <Info className="w-4.5 h-4.5 text-purple-400 shrink-0 mt-0.5" />
                    <div>
                      <h5 className="text-xs font-bold text-white font-display">Cronograma Recomendado de Recarga</h5>
                      <p className="text-xs text-slate-300 leading-relaxed mt-1">{electricPlan.recommendation}</p>
                    </div>
                  </div>
                </div>
              )}

            </div>
          )}

          {/* =========================================================================
              MÓDULO 8: IA DA MANUTENÇÃO
              ========================================================================= */}
          {activeTab === 'maintenance' && (
            <div className="space-y-8" id="maintenance-alerts-main-view">
              <div className="bg-gradient-to-r from-purple-950/30 to-indigo-950/30 border border-purple-900/30 rounded-2xl p-6 md:p-8 flex items-center gap-6 shadow-xl">
                <div className="p-4 bg-purple-900/40 rounded-2xl border border-purple-700/30 text-purple-300">
                  <Wrench className="w-8 h-8" />
                </div>
                <div>
                  <span className="text-[10px] font-bold tracking-widest text-purple-400 font-mono uppercase">RASTREAMENTO DE DEPRECIAÇÃO</span>
                  <h3 className="text-xl font-bold text-white font-display">Monitoramento Preventivo de Ativo</h3>
                  <p className="text-xs text-slate-400 max-w-2xl mt-1 leading-relaxed">
                    Auditoria automatizada do desgaste de pneus dianteiros, pastilhas de freio, filtros de cabine e óleo do motor com base nos seus quilômetros totais faturados nas plataformas.
                  </p>
                </div>
              </div>

              {/* Maintenance items progress lists */}
              <MaintenanceGrid maintenanceList={maintenanceList} />
            </div>
          )}

          {/* =========================================================================
              MÓDULO 9: COMPARAÇÃO DE PLATAFORMAS
              ========================================================================= */}
          {activeTab === 'compare' && (
            <div className="space-y-8" id="platform-comparator-main-view">
              <div className="bg-gradient-to-r from-purple-950/30 to-indigo-950/30 border border-purple-900/30 rounded-2xl p-6 md:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-xl">
                <div className="space-y-1">
                  <span className="text-[10px] font-bold tracking-widest text-purple-400 font-mono uppercase">COMPARAÇÃO CROSS-PLATFORM</span>
                  <h3 className="text-xl font-bold text-white font-display">Comparador de Plataformas</h3>
                  <p className="text-xs text-slate-400 max-w-2xl mt-1 leading-relaxed">
                    Compare os retornos reais das principais plataformas atuantes na região. Modifique as horas trabalhadas e km estimados para ver as margens líquidas oscilando dinamicamente.
                  </p>
                </div>

                <div className="flex bg-[#04010a] p-1 border border-purple-950/40 rounded-xl select-none shrink-0 gap-4">
                  <div className="space-y-1 p-2">
                    <span className="text-[9px] text-slate-500 font-mono uppercase font-bold">KM Rodado</span>
                    <input 
                      type="number" 
                      value={platformKmInput} 
                      onChange={(e) => setPlatformKmInput(Number(e.target.value) || 0)}
                      className="w-16 bg-[#04010a] border-b border-purple-950 text-xs text-slate-200 font-bold text-center"
                    />
                  </div>
                  <div className="space-y-1 p-2">
                    <span className="text-[9px] text-slate-500 font-mono uppercase font-bold">Horas Sift</span>
                    <input 
                      type="number" 
                      value={platformHoursInput} 
                      onChange={(e) => setPlatformHoursInput(Number(e.target.value) || 0)}
                      className="w-12 bg-[#04010a] border-b border-purple-950 text-xs text-slate-200 font-bold text-center"
                    />
                  </div>
                </div>
              </div>

              {/* Platform performance comparator cards list */}
              <ComparisonTable platformComparison={platformComparison} />
            </div>
          )}

        </motion.div>
      </AnimatePresence>

    </div>
  );
};
