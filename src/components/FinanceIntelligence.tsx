import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { 
  TrendingUp, TrendingDown, Coins, Calendar, Clock, Gauge, Bot, 
  Sparkles, ShieldAlert, BadgeHelp, RefreshCw, Sliders, Plus, Trash2, 
  Check, Play, ArrowUpRight, ArrowDownRight, Terminal, DollarSign, 
  HelpCircle, Car, Settings, CheckCircle, Percent, Zap, AlertTriangle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  financeIntelligenceService, 
  ExtendedFinancialMetrics, 
  FinancePeriod, 
  formatCurrency 
} from '../modules/finance/financeIntelligence.service';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { DriverCustomCost } from '../types';

export const FinanceIntelligence: React.FC = () => {
  const { 
    earnings, 
    expenses, 
    customCosts, 
    financialGoal, 
    vehicleCostSettings, 
    addCustomCost, 
    deleteCustomCost 
  } = useApp();

  // Selected period for Module 1 Resumo Financeiro
  const [selectedPeriod, setSelectedPeriod] = useState<FinancePeriod>('week');

  // Interactive custom cost form state (Module 2)
  const [isAddingCost, setIsAddingCost] = useState(false);
  const [newCostName, setNewCostName] = useState('');
  const [newCostCategory, setNewCostCategory] = useState<DriverCustomCost['category']>('fuel');
  const [newCostAmount, setNewCostAmount] = useState('');
  const [newCostPeriodicity, setNewCostPeriodicity] = useState<DriverCustomCost['periodicity']>('monthly');
  const [newCostApportionmentKm, setNewCostApportionmentKm] = useState('0');
  const [newCostApportionmentHour, setNewCostApportionmentHour] = useState('0');
  const [newCostApportionmentDay, setNewCostApportionmentDay] = useState('0');
  const [addCostError, setAddCostError] = useState<string | null>(null);

  // Simulation states (Module 5)
  const [simFuelPrice, setSimFuelPrice] = useState('5.69');
  const [simEvTransition, setSimEvTransition] = useState(false);
  const [simCommissionDiscount, setSimCommissionDiscount] = useState('0');
  const [simRevenueIncrease, setSimRevenueIncrease] = useState('0');

  // Module 9 - Background Calculation & Smart Caching (useMemo)
  const intelligenceResult = useMemo(() => {
    return financeIntelligenceService.computeFinanceIntelligence(
      earnings,
      expenses,
      customCosts,
      financialGoal,
      vehicleCostSettings
    );
  }, [earnings, expenses, customCosts, financialGoal, vehicleCostSettings]);

  const activePeriodMetrics = useMemo(() => {
    return intelligenceResult.metrics[selectedPeriod];
  }, [intelligenceResult, selectedPeriod]);

  // Run instant simulations (Module 5)
  const simulationResults = useMemo(() => {
    // 1. Fuel price simulation
    const fuelSim = financeIntelligenceService.runSimulation(
      earnings,
      customCosts,
      'fuel_price',
      Number(simFuelPrice) || 5.69
    );

    // 2. EV/Hybrid transition simulation
    const evSim = financeIntelligenceService.runSimulation(
      earnings,
      customCosts,
      'ev_transition',
      simEvTransition ? 1.0 : 0.0
    );

    // 3. Platform commission discount
    const commSim = financeIntelligenceService.runSimulation(
      earnings,
      customCosts,
      'commission_discount',
      Number(simCommissionDiscount) || 0
    );

    // 4. Revenue increase
    const revSim = financeIntelligenceService.runSimulation(
      earnings,
      customCosts,
      'revenue_increase',
      Number(simRevenueIncrease) || 0
    );

    // Combined simulated monthly impact
    const totalMonthlySavings = 
      (simEvTransition ? evSim.monthlyImpact : fuelSim.monthlyImpact) + 
      commSim.monthlyImpact + 
      revSim.monthlyImpact;

    return {
      originalCostPerKm: fuelSim.originalCostPerKm,
      simulatedFuelCostPerKm: fuelSim.simulatedCostPerKm,
      simulatedEvCostPerKm: evSim.simulatedCostPerKm,
      totalMonthlySavings
    };
  }, [earnings, customCosts, simFuelPrice, simEvTransition, simCommissionDiscount, simRevenueIncrease]);

  // Chart data preparing (Module 6)
  const chartData = useMemo(() => {
    // Take the last 15 earnings/closings or group by date
    const uniqueDates = Array.from(new Set(earnings.map(e => e.date))).sort().slice(-8);
    
    return uniqueDates.map(dateStr => {
      const dayEarnings = earnings.filter(e => e.date === dateStr);
      const dayExpenses = expenses.filter(e => e.date === dateStr);

      const gross = dayEarnings.reduce((sum, e) => sum + Number(e.gross_amount), 0);
      const realExp = dayExpenses.reduce((sum, e) => sum + Number(e.amount), 0);
      const totalKm = dayEarnings.reduce((sum, e) => sum + Number(e.total_km), 0);

      // Apportioned costs logic for the chart
      let apportioned = 0;
      for (const cost of customCosts) {
        if (cost.apportionment_km > 0) apportioned += totalKm * cost.apportionment_km;
        if (cost.apportionment_day > 0) apportioned += cost.apportionment_day;
      }
      
      const totalExp = realExp + apportioned;
      const net = gross - totalExp;

      return {
        date: new Date(dateStr + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
        Receita: Number(gross.toFixed(2)),
        Despesas: Number(totalExp.toFixed(2)),
        Lucro: Number(net.toFixed(2))
      };
    });
  }, [earnings, expenses, customCosts]);

  // Add custom cost handler
  const handleAddCustomCost = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddCostError(null);

    const amount = Number(newCostAmount);
    if (!newCostName.trim()) {
      setAddCostError('O nome do custo é obrigatório!');
      return;
    }
    if (isNaN(amount) || amount <= 0) {
      setAddCostError('O valor deve ser maior do que zero!');
      return;
    }

    try {
      await addCustomCost({
        name: newCostName,
        category: newCostCategory,
        amount,
        periodicity: newCostPeriodicity,
        apportionment_km: Number(newCostApportionmentKm) || 0,
        apportionment_hour: Number(newCostApportionmentHour) || 0,
        apportionment_day: Number(newCostApportionmentDay) || 0
      });

      // Reset form
      setNewCostName('');
      setNewCostAmount('');
      setNewCostApportionmentKm('0');
      setNewCostApportionmentHour('0');
      setNewCostApportionmentDay('0');
      setIsAddingCost(false);
    } catch (err: any) {
      setAddCostError(err.message || 'Erro ao cadastrar custo.');
    }
  };

  // Helper for translating categories
  const translateCategory = (cat: string): string => {
    switch (cat) {
      case 'fuel': return '⛽ Combustível';
      case 'electricity': return '⚡ Energia Elétrica';
      case 'oil': return '🛢️ Óleo / Lubrificante';
      case 'filters': return '⚙️ Filtros';
      case 'brakes': return '🛑 Pastilhas de Freio';
      case 'tires': return '🚗 Pneus';
      case 'insurance': return '🛡️ Seguro';
      case 'ipva': return '📅 IPVA';
      case 'license': return '💳 Licenciamento';
      case 'depreciation': return '📉 Depreciação';
      case 'washing': return '🧼 Lavagens';
      case 'financing': return '💰 Financiamento';
      case 'rent': return '🔑 Aluguel de Carro';
      case 'uber_fee': return '📱 Taxa Uber';
      case '99_fee': return '📱 Taxa 99';
      case 'indrive_fee': return '📱 Taxa InDrive';
      case 'other':
      default:
        return '📦 Outros';
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 85) return 'text-emerald-400';
    if (score >= 65) return 'text-amber-400';
    return 'text-rose-400';
  };

  return (
    <div className="space-y-8 pb-10" id="driver-finance-intelligence">
      
      {/* 1. COPILOTO FINANCEIRO IA & SCORE (Módulo 4) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Score Card */}
        <div className="bg-gradient-to-br from-[#0c082c] to-[#06041a] border border-purple-900/35 p-6 rounded-2xl flex flex-col items-center justify-center text-center shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-purple-600/10 rounded-full blur-2xl"></div>
          
          <Bot className="w-8 h-8 text-purple-400 mb-2 animate-bounce" style={{ animationDuration: '3s' }} />
          <h3 className="text-xs font-bold font-mono tracking-wider text-slate-400 uppercase">Score Financeiro IA</h3>
          <p className="text-[10px] text-slate-500 font-sans mt-0.5">Sua saúde financeira operacional hoje</p>
          
          <div className="relative w-36 h-36 flex items-center justify-center mt-4">
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
              <circle
                cx="50"
                cy="50"
                r="42"
                stroke="#120e36"
                strokeWidth="7"
                fill="transparent"
              />
              <circle
                cx="50"
                cy="50"
                r="42"
                stroke="url(#scoreGrad)"
                strokeWidth="7"
                fill="transparent"
                strokeDasharray="264"
                strokeDashoffset={264 - (264 * intelligenceResult.score) / 100}
                strokeLinecap="round"
                className="transition-all duration-1000 ease-out"
              />
              <defs>
                <linearGradient id="scoreGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#ef4444" />
                  <stop offset="50%" stopColor="#f59e0b" />
                  <stop offset="100%" stopColor="#10b981" />
                </linearGradient>
              </defs>
            </svg>
            <div className="absolute flex flex-col items-center justify-center">
              <span className={`text-3xl font-extrabold font-mono ${getScoreColor(intelligenceResult.score)}`}>
                {intelligenceResult.score}
              </span>
              <span className="text-[10px] text-slate-400 font-bold tracking-widest uppercase">
                {intelligenceResult.score >= 85 ? 'Excelente' : intelligenceResult.score >= 65 ? 'Bom' : 'Crítico'}
              </span>
            </div>
          </div>
          
          <p className="text-[11px] text-purple-300/80 leading-relaxed mt-4 font-sans px-2">
            Baseado em margens, custos por km rodado, KMs produtivos e histórico de metas.
          </p>
        </div>

        {/* Recommendations list */}
        <div className="lg:col-span-2 bg-[#090624]/80 border border-purple-950/30 p-6 rounded-2xl flex flex-col justify-between shadow-xl">
          <div className="space-y-4">
            <div className="flex items-center gap-2 border-b border-purple-950/20 pb-2">
              <Sparkles className="w-4 h-4 text-purple-400 animate-pulse" />
              <h4 className="text-xs font-bold uppercase font-mono tracking-wider text-purple-400">Recomendações do Copiloto Financeiro</h4>
            </div>

            <div className="space-y-3 max-h-[190px] overflow-y-auto pr-1 custom-scrollbar">
              {intelligenceResult.recommendations.length > 0 ? (
                intelligenceResult.recommendations.map((rec) => (
                  <motion.div 
                    key={rec.id}
                    initial={{ opacity: 0, x: -15 }}
                    animate={{ opacity: 1, x: 0 }}
                    className={`p-3 rounded-xl border text-left flex gap-3 ${
                      rec.type === 'success' 
                        ? 'bg-emerald-950/15 border-emerald-800/20 text-emerald-300' 
                        : rec.type === 'danger'
                          ? 'bg-rose-950/15 border-rose-800/20 text-rose-300'
                          : rec.type === 'warning'
                            ? 'bg-amber-950/15 border-amber-800/20 text-amber-300'
                            : 'bg-blue-950/15 border-blue-800/20 text-blue-300'
                    }`}
                  >
                    <div className="mt-0.5 shrink-0">
                      {rec.type === 'success' && <CheckCircle className="w-4 h-4 text-emerald-400" />}
                      {rec.type === 'danger' && <AlertTriangle className="w-4 h-4 text-rose-400" />}
                      {rec.type === 'warning' && <AlertTriangle className="w-4 h-4 text-amber-400" />}
                      {rec.type === 'info' && <Bot className="w-4 h-4 text-blue-400" />}
                    </div>
                    <div>
                      <h5 className="text-[11px] font-bold uppercase tracking-wide">{rec.title}</h5>
                      <p className="text-[11px] text-slate-300 mt-0.5 leading-relaxed">{rec.text}</p>
                    </div>
                  </motion.div>
                ))
              ) : (
                <p className="text-xs text-purple-300/30 italic">Aguardando novos dados para gerar conselhos do copiloto...</p>
              )}
            </div>
          </div>

          <div className="text-[10px] text-slate-500 font-mono text-right mt-4 border-t border-purple-950/10 pt-2">
            Inteligência Artificial Roxou v3 • Atualizado em tempo real
          </div>
        </div>

      </div>

      {/* 2. ALERTAS OPERACIONAIS (Módulo 7) */}
      {intelligenceResult.maintenanceAlerts.length > 0 && (
        <div className="bg-rose-950/10 border border-rose-900/30 p-4 rounded-2xl text-left space-y-3">
          <div className="flex items-center gap-2 text-rose-400 font-bold text-xs uppercase tracking-wider font-mono">
            <ShieldAlert className="w-4 h-4 animate-bounce" /> Alertas Inteligentes e Revisões Preventivas
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {intelligenceResult.maintenanceAlerts.map(alert => (
              <div 
                key={alert.id} 
                className={`p-3 rounded-xl border flex items-start gap-2.5 ${
                  alert.urgency === 'high' 
                    ? 'bg-rose-950/30 border-rose-800/40' 
                    : 'bg-amber-950/20 border-amber-800/20'
                }`}
              >
                <span className="text-base mt-0.5 shrink-0">⚠️</span>
                <div>
                  <h5 className="text-xs font-bold text-white">{alert.title}</h5>
                  <p className="text-[10px] text-slate-300 mt-0.5 leading-normal">{alert.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 3. RESUMO FINANCEIRO COMPLETO (Módulo 1) */}
      <div className="bg-[#090624]/80 border border-purple-950/30 rounded-2xl p-6 space-y-6">
        
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-purple-950/20 pb-4">
          <div className="text-left">
            <h3 className="text-sm font-bold font-mono text-purple-400 uppercase tracking-widest flex items-center gap-2">
              <Coins className="w-4 h-4 text-purple-400" /> Resumo Financeiro Inteligente
            </h3>
            <p className="text-[11px] text-slate-400">Dados recalculados com rateios de custos operacionais ativos.</p>
          </div>

          {/* Period selector */}
          <div className="flex flex-wrap bg-[#050314] p-1 rounded-xl border border-purple-950/30 gap-1">
            {(['today', 'yesterday', 'week', 'month', 'year', 'all'] as FinancePeriod[]).map((p) => (
              <button
                key={p}
                onClick={() => setSelectedPeriod(p)}
                className={`px-3 py-1 text-[9px] font-mono uppercase font-bold rounded-lg cursor-pointer transition-all ${
                  selectedPeriod === p 
                    ? 'bg-purple-600 text-white shadow-md' 
                    : 'text-purple-300/50 hover:text-purple-200 hover:bg-purple-950/15'
                }`}
              >
                {p === 'today' ? 'Hoje' : p === 'yesterday' ? 'Ontem' : p === 'week' ? 'Semana' : p === 'month' ? 'Mês' : p === 'year' ? 'Ano' : 'Geral'}
              </button>
            ))}
          </div>
        </div>

        {/* Big metrics summary grid (Module 1) */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 text-left">
          
          <div className="bg-[#050314] p-4 rounded-xl border border-purple-950/15">
            <span className="text-[9px] text-slate-500 font-mono block uppercase">Receita Bruta</span>
            <span className="text-sm font-extrabold text-white mt-1 block">{formatCurrency(activePeriodMetrics.grossRevenue)}</span>
            <div className="flex items-center gap-1 mt-1">
              <TrendingUp className="w-3 h-3 text-emerald-500" />
              <span className="text-[9px] text-emerald-400 font-mono">Faturamento</span>
            </div>
          </div>

          <div className="bg-[#050314] p-4 rounded-xl border border-purple-950/15">
            <span className="text-[9px] text-slate-500 font-mono block uppercase">Despesas Reais</span>
            <span className="text-sm font-extrabold text-rose-400 mt-1 block">{formatCurrency(activePeriodMetrics.realExpenses)}</span>
            <span className="text-[9px] text-slate-500 block mt-1 font-sans">Lançadas no extrato</span>
          </div>

          <div className="bg-[#050314] p-4 rounded-xl border border-purple-950/15">
            <span className="text-[9px] text-slate-500 font-mono block uppercase">Despesas Rateadas</span>
            <span className="text-sm font-extrabold text-orange-400 mt-1 block">{formatCurrency(activePeriodMetrics.apportionedCosts)}</span>
            <span className="text-[9px] text-slate-500 block mt-1 font-sans">Combustível + Ativos</span>
          </div>

          <div className="bg-[#050314] p-4 rounded-xl border border-purple-950/15">
            <span className="text-[9px] text-slate-500 font-mono block uppercase">Lucro Líquido</span>
            <span className="text-sm font-extrabold text-emerald-400 mt-1 block">{formatCurrency(activePeriodMetrics.netProfit)}</span>
            <div className="flex items-center gap-1 mt-1">
              <TrendingUp className="w-3 h-3 text-emerald-500" />
              <span className="text-[9px] text-emerald-400 font-mono">Resultado Líquido</span>
            </div>
          </div>

          <div className="bg-[#050314] p-4 rounded-xl border border-purple-950/15">
            <span className="text-[9px] text-slate-500 font-mono block uppercase">Custo Operacional</span>
            <span className="text-sm font-extrabold text-white mt-1 block">{formatCurrency(activePeriodMetrics.operatingCost)}</span>
            <span className="text-[9px] text-slate-400 block mt-1 font-sans">
              {(activePeriodMetrics.totalKm > 0 ? activePeriodMetrics.operatingCost / activePeriodMetrics.totalKm : 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}/km
            </span>
          </div>

          <div className="bg-[#050314] p-4 rounded-xl border border-purple-950/15">
            <span className="text-[9px] text-slate-500 font-mono block uppercase">Retorno sobre Inv. (ROI)</span>
            <span className="text-sm font-extrabold text-indigo-400 mt-1 block">{activePeriodMetrics.roi.toFixed(1)}%</span>
            <span className="text-[9px] text-slate-500 block mt-1 font-sans">Eficiência de custos</span>
          </div>

          <div className="bg-[#050314] p-4 rounded-xl border border-purple-950/15">
            <span className="text-[9px] text-slate-500 font-mono block uppercase">Margem Líquida</span>
            <span className="text-sm font-extrabold text-purple-400 mt-1 block">{activePeriodMetrics.netMargin.toFixed(1)}%</span>
            <span className="text-[9px] text-slate-500 block mt-1 font-sans">Retenção de caixa</span>
          </div>

          <div className="bg-[#050314] p-4 rounded-xl border border-purple-950/15">
            <span className="text-[9px] text-slate-500 font-mono block uppercase">Lucro por Hora</span>
            <span className="text-sm font-extrabold text-emerald-400 mt-1 block">{formatCurrency(activePeriodMetrics.profitPerHour)}/h</span>
            <span className="text-[9px] text-slate-400 block mt-1 font-sans">Líquido por hora online</span>
          </div>

          <div className="bg-[#050314] p-4 rounded-xl border border-purple-950/15">
            <span className="text-[9px] text-slate-500 font-mono block uppercase">Lucro por KM</span>
            <span className="text-sm font-extrabold text-emerald-400 mt-1 block">{formatCurrency(activePeriodMetrics.profitPerKm)}/km</span>
            <span className="text-[9px] text-slate-500 block mt-1 font-sans">Margem por km rodado</span>
          </div>

          <div className="bg-[#050314] p-4 rounded-xl border border-purple-950/15">
            <span className="text-[9px] text-slate-500 font-mono block uppercase">Receita por KM</span>
            <span className="text-sm font-extrabold text-indigo-300 mt-1 block">{formatCurrency(activePeriodMetrics.revenuePerKm)}/km</span>
            <span className="text-[9px] text-slate-500 block mt-1 font-sans">Faturamento por km</span>
          </div>

          <div className="bg-[#050314] p-4 rounded-xl border border-purple-950/15">
            <span className="text-[9px] text-slate-500 font-mono block uppercase">Receita por Hora</span>
            <span className="text-sm font-extrabold text-indigo-300 mt-1 block">{formatCurrency(activePeriodMetrics.revenuePerHour)}/h</span>
            <span className="text-[9px] text-slate-500 block mt-1 font-sans">Faturamento horário</span>
          </div>

          <div className="bg-[#050314] p-4 rounded-xl border border-purple-950/15">
            <span className="text-[9px] text-slate-500 font-mono block uppercase">Dados Operacionais</span>
            <span className="text-[11px] font-bold text-slate-300 mt-1 block">
              {activePeriodMetrics.totalKm.toFixed(0)} km | {activePeriodMetrics.totalHours.toFixed(1)}h
            </span>
            <span className="text-[9px] text-slate-500 block mt-1 font-mono uppercase">{activePeriodMetrics.ridesCount} Corridas</span>
          </div>

        </div>

      </div>

      {/* 4. MOTOR DE CUSTOS (Módulo 2) */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        
        {/* Costs Configuration Form & Settings Panel */}
        <div className="bg-[#090624]/80 border border-purple-950/30 p-6 rounded-2xl flex flex-col justify-between shadow-xl text-left">
          <div className="space-y-4">
            <div className="flex justify-between items-center border-b border-purple-950/20 pb-2">
              <h4 className="text-xs font-bold uppercase font-mono tracking-wider text-purple-400">Motor de Custos Operacionais</h4>
              <button
                onClick={() => setIsAddingCost(!isAddingCost)}
                className="p-1 rounded bg-purple-950 text-purple-300 hover:bg-purple-900 border border-purple-900/30 cursor-pointer select-none"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>

            <p className="text-[11px] text-slate-400 leading-normal">
              O motor de custos divide automaticamente cada item cadastrado em custos operacionais por hora, por dia ou por quilômetro.
            </p>

            <AnimatePresence>
              {isAddingCost && (
                <motion.form 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  onSubmit={handleAddCustomCost}
                  className="p-4 bg-[#050314] border border-purple-950/40 rounded-xl space-y-3 overflow-hidden text-xs"
                >
                  <h5 className="font-bold text-white text-[11px] uppercase tracking-wide">Novo Custo Operacional</h5>
                  
                  {addCostError && <div className="p-2 bg-rose-950/30 border border-rose-900/30 text-rose-400 rounded text-[10px]">{addCostError}</div>}

                  <div>
                    <label className="block text-[10px] uppercase text-slate-500 font-mono mb-1">Nome do custo</label>
                    <input 
                      type="text" 
                      placeholder="Ex: Aluguel Localiza, Lavagem Semanal" 
                      value={newCostName}
                      onChange={e => setNewCostName(e.target.value)}
                      className="w-full bg-[#03010b] border border-purple-950 text-white rounded px-2.5 py-1.5 focus:border-purple-500 outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] uppercase text-slate-500 font-mono mb-1">Categoria</label>
                      <select 
                        value={newCostCategory} 
                        onChange={e => setNewCostCategory(e.target.value as any)}
                        className="w-full bg-[#03010b] border border-purple-950 text-white rounded px-2.5 py-1.5 focus:border-purple-500 outline-none"
                      >
                        <option value="fuel">⛽ Combustível</option>
                        <option value="electricity">⚡ Energia</option>
                        <option value="oil">🛢️ Óleo</option>
                        <option value="filters">⚙️ Filtros</option>
                        <option value="brakes">🛑 Pastilhas</option>
                        <option value="tires">🚗 Pneus</option>
                        <option value="insurance">🛡️ Seguro</option>
                        <option value="ipva">📅 IPVA</option>
                        <option value="license">💳 Licenciamento</option>
                        <option value="depreciation">📉 Depreciação</option>
                        <option value="washing">🧼 Lavagens</option>
                        <option value="financing">💰 Financiamento</option>
                        <option value="rent">🔑 Aluguel</option>
                        <option value="other">📦 Outros</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] uppercase text-slate-500 font-mono mb-1">Valor (R$)</label>
                      <input 
                        type="number" 
                        step="0.01"
                        placeholder="0.00" 
                        value={newCostAmount}
                        onChange={e => setNewCostAmount(e.target.value)}
                        className="w-full bg-[#03010b] border border-purple-950 text-white rounded px-2.5 py-1.5 focus:border-purple-500 outline-none font-mono"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] uppercase text-slate-500 font-mono mb-1">Periodicidade</label>
                      <select 
                        value={newCostPeriodicity} 
                        onChange={e => setNewCostPeriodicity(e.target.value as any)}
                        className="w-full bg-[#03010b] border border-purple-950 text-white rounded px-2.5 py-1.5 focus:border-purple-500 outline-none"
                      >
                        <option value="per_km">Por KM</option>
                        <option value="per_hour">Por Hora</option>
                        <option value="per_day">Por Dia</option>
                        <option value="monthly">Mensal</option>
                        <option value="yearly">Anual</option>
                        <option value="per_ride">Por Corrida</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] uppercase text-slate-500 font-mono mb-1">Rateio por KM (R$)</label>
                      <input 
                        type="number" 
                        step="0.001"
                        placeholder="0.00" 
                        value={newCostApportionmentKm}
                        onChange={e => setNewCostApportionmentKm(e.target.value)}
                        className="w-full bg-[#03010b] border border-purple-950 text-white rounded px-2.5 py-1.5 focus:border-purple-500 outline-none font-mono"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] uppercase text-slate-500 font-mono mb-1">Rateio por Hora (R$)</label>
                      <input 
                        type="number" 
                        step="0.01"
                        placeholder="0.00" 
                        value={newCostApportionmentHour}
                        onChange={e => setNewCostApportionmentHour(e.target.value)}
                        className="w-full bg-[#03010b] border border-purple-950 text-white rounded px-2.5 py-1.5 focus:border-purple-500 outline-none font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] uppercase text-slate-500 font-mono mb-1">Rateio por Dia (R$)</label>
                      <input 
                        type="number" 
                        step="0.01"
                        placeholder="0.00" 
                        value={newCostApportionmentDay}
                        onChange={e => setNewCostApportionmentDay(e.target.value)}
                        className="w-full bg-[#03010b] border border-purple-950 text-white rounded px-2.5 py-1.5 focus:border-purple-500 outline-none font-mono"
                      />
                    </div>
                  </div>

                  <button 
                    type="submit"
                    className="w-full py-2 rounded bg-purple-600 hover:bg-purple-500 text-white font-semibold cursor-pointer text-center flex items-center justify-center gap-1.5"
                  >
                    <Check className="w-4 h-4" /> Confirmar Custo
                  </button>
                </motion.form>
              )}
            </AnimatePresence>
          </div>

          <div className="bg-[#050314] p-4 rounded-xl border border-purple-950/20 mt-4">
            <span className="text-[10px] font-bold text-purple-400 uppercase font-mono block">Custo Rateado Estimado</span>
            <p className="text-xs text-slate-300 mt-1.5 leading-normal">
              Sua taxa atual estimada é de <span className="text-emerald-400 font-bold">{(activePeriodMetrics.totalKm > 0 ? activePeriodMetrics.apportionedCosts / activePeriodMetrics.totalKm : 0.42).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} por KM</span> total rodado (considerando depreciação ativa).
            </p>
          </div>
        </div>

        {/* Custom Costs List (Apportionment Visualizer) */}
        <div className="xl:col-span-2 bg-[#090624]/80 border border-purple-950/30 p-6 rounded-2xl shadow-xl text-left space-y-4">
          <h4 className="text-xs font-bold uppercase font-mono tracking-wider text-purple-400">Detalhamento e Alocação dos Custos</h4>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-purple-950/30 text-purple-400/70 uppercase text-[9px] font-mono">
                  <th className="py-2.5 px-2">Custo</th>
                  <th className="py-2.5 px-2">Categoria</th>
                  <th className="py-2.5 px-2">Valor Base</th>
                  <th className="py-2.5 px-2">Alocação</th>
                  <th className="py-2.5 px-2 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-purple-950/10">
                {customCosts.length > 0 ? (
                  customCosts.map((cost, idx) => (
                    <tr key={cost.id || idx} className="hover:bg-purple-950/5">
                      <td className="py-3 px-2 font-semibold text-white">{cost.name}</td>
                      <td className="py-3 px-2 text-slate-300">{translateCategory(cost.category)}</td>
                      <td className="py-3 px-2 font-mono text-emerald-400 font-bold">
                        {formatCurrency(cost.amount)} 
                        <span className="text-[9px] text-slate-500 font-normal block lowercase">
                          {cost.periodicity === 'per_km' ? 'por km' : cost.periodicity === 'monthly' ? 'por mês' : cost.periodicity === 'yearly' ? 'por ano' : cost.periodicity === 'per_day' ? 'por dia' : 'por corrida'}
                        </span>
                      </td>
                      <td className="py-3 px-2 font-mono text-slate-300">
                        <div className="space-y-0.5 text-[10px]">
                          {cost.apportionment_km > 0 && <div className="text-amber-400/90">{formatCurrency(cost.apportionment_km)}/km</div>}
                          {cost.apportionment_hour > 0 && <div className="text-indigo-400/90">{formatCurrency(cost.apportionment_hour)}/h</div>}
                          {cost.apportionment_day > 0 && <div className="text-purple-400/90">{formatCurrency(cost.apportionment_day)}/dia</div>}
                          {cost.apportionment_km === 0 && cost.apportionment_hour === 0 && cost.apportionment_day === 0 && (
                            <span className="text-slate-500">Rateio Proporcional</span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-2 text-right">
                        <button
                          onClick={() => {
                            if (confirm(`Excluir o custo operacional "${cost.name}"?`)) {
                              deleteCustomCost(cost.id, idx);
                            }
                          }}
                          className="p-1 text-slate-500 hover:text-rose-400 rounded cursor-pointer transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-500 italic">Carregando custos de rateio padrão...</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      {/* 5. PREVISÃO FINANCEIRA & FLUXO DE CAIXA (Módulo 3) */}
      <div className="bg-[#090624]/80 border border-purple-950/30 p-6 rounded-2xl shadow-xl text-left space-y-6">
        <div className="flex justify-between items-center border-b border-purple-950/20 pb-4">
          <div>
            <h4 className="text-xs font-bold uppercase font-mono tracking-wider text-purple-400">Previsões de Margem & Metas</h4>
            <p className="text-[11px] text-slate-400 mt-0.5">Simulação de fluxo de caixa e projeções matemáticas inteligentes.</p>
          </div>
          <span className="px-3 py-1 bg-emerald-950/40 text-emerald-400 border border-emerald-800/40 text-[9px] font-mono font-bold rounded-full uppercase">
            Fluxo {intelligenceResult.forecast.cashFlowState === 'positive' ? 'Positivo' : 'Neutro'}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* Projections Card */}
          <div className="bg-[#050314] p-5 rounded-xl border border-purple-950/15 space-y-3">
            <h5 className="text-[11px] font-bold uppercase tracking-wide text-purple-400 flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5" /> Lucros Esperados
            </h5>
            <div className="space-y-2">
              <div className="flex justify-between text-xs border-b border-purple-950/10 pb-1.5">
                <span className="text-slate-400">Lucro Hoje:</span>
                <span className="font-mono font-bold text-white">{formatCurrency(intelligenceResult.forecast.projectedProfit)}</span>
              </div>
              <div className="flex justify-between text-xs border-b border-purple-950/10 pb-1.5">
                <span className="text-slate-400">Lucro Semanal:</span>
                <span className="font-mono font-bold text-emerald-400">{formatCurrency(intelligenceResult.forecast.projectedProfit * 6)}</span>
              </div>
              <div className="flex justify-between text-xs border-b border-purple-950/10 pb-1.5">
                <span className="text-slate-400">Lucro Mensal:</span>
                <span className="font-mono font-bold text-emerald-400">{formatCurrency(intelligenceResult.forecast.projectedProfit * 26)}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">Lucro Anual:</span>
                <span className="font-mono font-bold text-emerald-400">{formatCurrency(intelligenceResult.forecast.projectedProfit * 312)}</span>
              </div>
            </div>
          </div>

          {/* Cash Flow Balance Card */}
          <div className="bg-[#050314] p-5 rounded-xl border border-purple-950/15 space-y-3">
            <h5 className="text-[11px] font-bold uppercase tracking-wide text-purple-400 flex items-center gap-1.5">
              <DollarSign className="w-3.5 h-3.5" /> Fluxo Diário Projetado
            </h5>
            <div className="space-y-2">
              <div className="flex justify-between text-xs border-b border-purple-950/10 pb-1.5">
                <span className="text-slate-400">Receita Média:</span>
                <span className="font-mono font-bold text-indigo-400">{formatCurrency(intelligenceResult.forecast.projectedRevenue)}</span>
              </div>
              <div className="flex justify-between text-xs border-b border-purple-950/10 pb-1.5">
                <span className="text-slate-400">Despesas Médias:</span>
                <span className="font-mono font-bold text-rose-400">{formatCurrency(intelligenceResult.forecast.projectedExpenses)}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">Lucro Projetado:</span>
                <span className="font-mono font-bold text-emerald-400">{formatCurrency(intelligenceResult.forecast.projectedProfit)}/dia</span>
              </div>
            </div>
          </div>

          {/* Goals Dashboard Card */}
          <div className="bg-[#050314] p-5 rounded-xl border border-purple-950/15 space-y-3">
            <h5 className="text-[11px] font-bold uppercase tracking-wide text-purple-400 flex items-center gap-1.5">
              <Settings className="w-3.5 h-3.5" /> Metas de Atividade
            </h5>
            <div className="space-y-2">
              <div className="flex justify-between text-xs border-b border-purple-950/10 pb-1.5">
                <span className="text-slate-400">Meta Diária:</span>
                <span className="font-mono font-bold text-white">{formatCurrency(intelligenceResult.forecast.dailyGoal)}</span>
              </div>
              <div className="flex justify-between text-xs border-b border-purple-950/10 pb-1.5">
                <span className="text-slate-400">Meta Semanal:</span>
                <span className="font-mono font-bold text-white">{formatCurrency(intelligenceResult.forecast.weeklyGoal)}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">Meta Mensal:</span>
                <span className="font-mono font-bold text-white">{formatCurrency(intelligenceResult.forecast.monthlyGoal)}</span>
              </div>
            </div>
          </div>

        </div>

      </div>

      {/* 6. SIMULADOR INTELIGENTE (Módulo 5) */}
      <div className="bg-[#090624]/80 border border-purple-950/30 p-6 rounded-2xl shadow-xl text-left space-y-6">
        <div className="border-b border-purple-950/20 pb-4">
          <h4 className="text-xs font-bold uppercase font-mono tracking-wider text-purple-400 flex items-center gap-2">
            <Sliders className="w-4 h-4 text-purple-400" /> Simulador de Rentabilidade Roxou
          </h4>
          <p className="text-[11px] text-slate-400 mt-0.5">Arraste os sliders para ver o impacto financeiro imediato das suas escolhas operacionais.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* Interactive controls */}
          <div className="space-y-4">
            
            {/* Control 1: Gas price */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-slate-300 font-semibold">Preço Simulado do Combustível:</span>
                <span className="font-mono font-bold text-purple-400">{Number(simFuelPrice).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}/L</span>
              </div>
              <input 
                type="range" 
                min="3.00" 
                max="9.00" 
                step="0.05"
                value={simFuelPrice}
                onChange={e => {
                  setSimFuelPrice(e.target.value);
                  if (simEvTransition) setSimEvTransition(false); // EV overrides custom gas simulation
                }}
                className="w-full accent-purple-600 cursor-pointer h-1.5 bg-purple-950 rounded-lg outline-none"
              />
            </div>

            {/* Control 2: Electric Vehicle Transition */}
            <div className="p-4 bg-[#050314] rounded-xl border border-purple-950/15 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-white block">Transição para Veículo Elétrico (EV) ou Híbrido</span>
                <span className="text-[10px] text-slate-500 mt-0.5 block leading-normal">Simula recarga em casa (reduz drasticamente combustível de R$ 0.42/km para R$ 0.08/km).</span>
              </div>
              <input 
                type="checkbox" 
                checked={simEvTransition}
                onChange={e => setSimEvTransition(e.target.checked)}
                className="w-5 h-5 accent-purple-600 rounded cursor-pointer"
              />
            </div>

            {/* Control 3: Commission discounts */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-slate-300 font-semibold">Redução de Taxas / Uber Pass:</span>
                <span className="font-mono font-bold text-purple-400">{simCommissionDiscount}% de comissão recuperada</span>
              </div>
              <input 
                type="range" 
                min="0" 
                max="15" 
                step="1"
                value={simCommissionDiscount}
                onChange={e => setSimCommissionDiscount(e.target.value)}
                className="w-full accent-purple-600 cursor-pointer h-1.5 bg-purple-950 rounded-lg outline-none"
              />
            </div>

            {/* Control 4: Revenue increase */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-slate-300 font-semibold">Ganho de Faturamento (Mais Dinâmico):</span>
                <span className="font-mono font-bold text-purple-400">+{simRevenueIncrease}% de Receita Bruta</span>
              </div>
              <input 
                type="range" 
                min="0" 
                max="50" 
                step="5"
                value={simRevenueIncrease}
                onChange={e => setSimRevenueIncrease(e.target.value)}
                className="w-full accent-purple-600 cursor-pointer h-1.5 bg-purple-950 rounded-lg outline-none"
              />
            </div>

          </div>

          {/* Results display panel */}
          <div className="bg-[#050314] p-6 rounded-xl border border-purple-950/20 flex flex-col justify-between">
            <div className="space-y-4">
              <h5 className="text-xs font-bold uppercase font-mono text-purple-400 border-b border-purple-950/15 pb-2">Impacto Econômico Simulado</h5>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-[#0c082c]/40 p-3 rounded-lg border border-purple-950/10 text-center">
                  <span className="text-[10px] text-slate-500 font-mono block uppercase">Custo KM Original</span>
                  <span className="text-sm font-bold text-slate-400 font-mono">{formatCurrency(simulationResults.originalCostPerKm)}/km</span>
                </div>
                <div className="bg-[#0c082c]/40 p-3 rounded-lg border border-purple-950/10 text-center">
                  <span className="text-[10px] text-slate-500 font-mono block uppercase">Custo KM Simulado</span>
                  <span className="text-sm font-extrabold text-emerald-400 font-mono">
                    {formatCurrency(simEvTransition ? simulationResults.simulatedEvCostPerKm : simulationResults.simulatedFuelCostPerKm)}/km
                  </span>
                </div>
              </div>
            </div>

            <div className="p-4 bg-emerald-950/10 border border-emerald-900/20 rounded-lg flex items-center justify-between mt-4">
              <div className="text-left">
                <span className="text-[9px] uppercase font-bold text-emerald-400 font-mono block">Impacto Mensal Estimado</span>
                <p className="text-xs text-slate-300 mt-1 leading-normal">Economia / Ganhos líquidos adicionais com esta configuração:</p>
              </div>
              <span className="text-lg font-extrabold text-emerald-400 font-mono shrink-0 ml-2">
                +{formatCurrency(simulationResults.totalMonthlySavings)}/mês
              </span>
            </div>
          </div>

        </div>

      </div>

      {/* 7. HISTÓRICO COMPARATIVO GRÁFICO (Módulo 6) */}
      {chartData.length > 0 && (
        <div className="bg-[#090624]/80 border border-purple-950/30 p-6 rounded-2xl shadow-xl text-left space-y-4">
          <div className="flex justify-between items-center border-b border-purple-950/20 pb-2">
            <h4 className="text-xs font-bold uppercase font-mono tracking-wider text-purple-400">Evolução do Faturamento vs Custos Operacionais</h4>
            <span className="text-[10px] text-slate-400 font-sans">Últimos 8 dias com faturamento</span>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorGross" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8b5cf6" fillOpacity={0.2}/>
                    <stop offset="95%" stopColor="#8b5cf6" fillOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorNet" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" fillOpacity={0.2}/>
                    <stop offset="95%" stopColor="#10b981" fillOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#120e36" />
                <XAxis dataKey="date" stroke="#94a3b8" fontSize={9} />
                <YAxis stroke="#94a3b8" fontSize={9} />
                <Tooltip contentStyle={{ backgroundColor: '#090624', borderColor: '#3b0764' }} />
                <Legend wrapperStyle={{ fontSize: '9px' }} />
                <Area type="monotone" dataKey="Receita" stroke="#8b5cf6" fillOpacity={1} fill="url(#colorGross)" name="Faturamento (Receita Bruta)" />
                <Area type="monotone" dataKey="Lucro" stroke="#10b981" fillOpacity={1} fill="url(#colorNet)" name="Lucro Líquido Real" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

    </div>
  );
};
