/**
 * Copilot Intelligence Panel Component
 * Module: Copilot Intelligence (copilot-intelligence)
 * Modes: MODO DIREÇÃO (Driving Mode) & RELATÓRIO FINAL (Final Report)
 */

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Brain, 
  Sparkles, 
  TrendingUp, 
  Coins, 
  AlertTriangle, 
  Clock, 
  ChevronDown, 
  ChevronUp, 
  MapPin, 
  Gauge, 
  EyeOff, 
  Clock3, 
  CheckCircle2, 
  XCircle, 
  Compass, 
  Flame,
  Info
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell 
} from 'recharts';
import { uberPassAdvisorService, AdvisorAnalysis } from '../../uberpass/uberPassAdvisor.service';
import { driverHabitsEngine, HabitAnalysisResult, CopilotInsight, FinalReportData, TimelineEvent } from '../driverHabits.engine';

interface CopilotCardProps {
  currentLat?: number;
  currentLng?: number;
  currentBairro?: string;
  currentSpeed?: number; // Speed in km/h
  isJourneyActive?: boolean;
  activeSession?: any;
  totalDistanceKm?: number;
  elapsedTime?: string;
  rideLogs?: any[];
  vehicle?: any;
  vehicleCostSettings?: any;
}

export const CopilotCard: React.FC<CopilotCardProps> = ({
  currentLat,
  currentLng,
  currentBairro = 'Centro',
  currentSpeed = 0,
  isJourneyActive = false,
  activeSession = null,
  totalDistanceKm = 0,
  elapsedTime = '00:00:00',
  rideLogs = [],
  vehicle = null,
  vehicleCostSettings = null
}) => {
  const [analysis, setAnalysis] = useState<AdvisorAnalysis | null>(null);
  const [habits, setHabits] = useState<HabitAnalysisResult | null>(null);
  const [isSimulatorOpen, setIsSimulatorOpen] = useState(false);
  const [isOcultado, setIsOcultado] = useState(false);
  
  // Driving Mode active insight state
  const [activeInsight, setActiveInsight] = useState<CopilotInsight | null>(null);
  const [lastInsightUpdateTime, setLastInsightUpdateTime] = useState<number>(0);
  const [deferredInsightIds, setDeferredInsightIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('driverdash_copilot_deferred_insights');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Track shown insights to support anti-spam rule (no repeat in 15 mins)
  const [shownInsightsHistory, setShownInsightsHistory] = useState<Record<string, number>>(() => {
    try {
      const saved = localStorage.getItem('driverdash_copilot_shown_history');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  // Fetch basic UberPass and habits analysis
  useEffect(() => {
    const fetchStats = () => {
      const advData = uberPassAdvisorService.getAnalysis();
      setAnalysis(advData);

      const habData = driverHabitsEngine.analyzeHabits(rideLogs);
      setHabits(habData);
    };

    fetchStats();
    window.addEventListener('storage', fetchStats);
    return () => window.removeEventListener('storage', fetchStats);
  }, [rideLogs]);

  // Update active insight following strict driving mode rules
  useEffect(() => {
    if (!isJourneyActive || !habits || !analysis) return;

    const now = Date.now();
    const currentPass = 'Taxa Padrão (35%)';
    const recommendedPass = analysis.simulations.find(s => s.isRecommended)?.option.name || 'Passe 72h';

    // 1. Generate candidate insights from queue
    const candidates = driverHabitsEngine.generateInsightsQueue(
      null, // activeRide placeholder
      habits,
      currentSpeed,
      currentBairro,
      2.0, // average earnings per km
      0.45, // cost per km
      recommendedPass,
      currentPass
    );

    // Filter out:
    // - Insights in deferred list (Ver depois)
    // - Insights shown in the last 15 minutes (900000ms) to prevent spam
    const validCandidates = candidates.filter(item => {
      if (deferredInsightIds.includes(item.id)) return false;
      const lastShown = shownInsightsHistory[item.id] || 0;
      if (now - lastShown < 900000) return false;
      return true;
    });

    if (validCandidates.length === 0) {
      // Fallback if all are filtered out
      const fallback = candidates.find(c => c.id === 'general_positive') || candidates[0];
      if (fallback) {
        setActiveInsight(fallback);
      }
      return;
    }

    // Sort valid candidates by priority (HIGH > MEDIUM > LOW)
    const sortedCandidates = [...validCandidates].sort((a, b) => {
      const prioVal = { HIGH: 3, MEDIUM: 2, LOW: 1 };
      return prioVal[b.priority] - prioVal[a.priority];
    });

    const bestCandidate = sortedCandidates[0];

    // Throttle rule: do not update insight within 3-5 minutes (180000ms) unless it's a higher priority override
    const timeSinceLastUpdate = now - lastInsightUpdateTime;
    const isPrioOverride = activeInsight 
      ? (bestCandidate.priority === 'HIGH' && activeInsight.priority !== 'HIGH')
      : true;

    if (timeSinceLastUpdate >= 180000 || isPrioOverride || !activeInsight) {
      setActiveInsight(bestCandidate);
      setLastInsightUpdateTime(now);
      
      // Save to shown history to avoid repeating for 15 minutes
      const updatedHistory = { ...shownInsightsHistory, [bestCandidate.id]: now };
      setShownInsightsHistory(updatedHistory);
      localStorage.setItem('driverdash_copilot_shown_history', JSON.stringify(updatedHistory));
    }
  }, [isJourneyActive, currentBairro, currentSpeed, habits, analysis, deferredInsightIds]);

  // Handle Ver Depois button
  const handleVerDepois = () => {
    if (!activeInsight) return;
    const updated = [...deferredInsightIds, activeInsight.id];
    setDeferredInsightIds(updated);
    localStorage.setItem('driverdash_copilot_deferred_insights', JSON.stringify(updated));
    
    // Switch insight immediately
    setActiveInsight(null);
    setLastInsightUpdateTime(0);
  };

  // Generate Final Report Data
  const finalReport = useMemo<FinalReportData | null>(() => {
    if (isJourneyActive || !habits || !analysis) return null;

    // Use current activeSession if it just ended, or mock/fallback to the latest session in database
    const endedSession = activeSession || { id: 'last_completed', start_time: new Date(Date.now() - 4 * 3600000).toISOString(), end_time: new Date().toISOString() };
    const costPerKm = 0.45;
    
    const recPass = analysis.simulations.find(s => s.isRecommended);
    const recommendedPassObj = recPass ? {
      name: recPass.option.name,
      savings: recPass.estimatedSavings,
      reason: recPass.reason
    } : { name: 'Passe 72h', savings: 120, reason: 'Passe de final de semana mais eficiente.' };

    const report = driverHabitsEngine.generateFinalReport(
      endedSession,
      rideLogs,
      habits,
      totalDistanceKm || 84.5,
      costPerKm,
      recommendedPassObj
    );

    // Override opportunities missed count based on deferred insights
    report.oportunidadesPerdidas = deferredInsightIds.length || report.oportunidadesPerdidas;

    return report;
  }, [isJourneyActive, activeSession, rideLogs, habits, analysis, totalDistanceKm, deferredInsightIds]);

  // Render high-speed warning to prioritize safety
  const isHighSpeed = currentSpeed > 60;

  // ------------------------------------------------------------------
  // VIEW: MODO DIREÇÃO (Driving Mode)
  // ------------------------------------------------------------------
  if (isJourneyActive) {
    return (
      <AnimatePresence>
        {!isOcultado && (
          <motion.div 
            id="copilot_driving_card"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-[#0b0720] border-2 border-purple-500/80 rounded-2xl p-4 shadow-2xl relative overflow-hidden text-left"
          >
            {/* Absolute visual glowing indicator for driving active */}
            <div className="absolute top-3 right-3 flex items-center gap-1.5 bg-purple-950/40 border border-purple-800/40 px-2 py-0.5 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-ping" />
              <span className="text-[9px] font-bold text-purple-300 font-mono tracking-wider uppercase">Copiloto</span>
            </div>

            {/* Core Card Heading */}
            <div className="flex items-center gap-2 mb-2">
              <Brain className="w-4 h-4 text-purple-400 animate-pulse" />
              <span className="text-xs font-bold text-slate-300 tracking-wider uppercase">Copiloto Ativo</span>
            </div>

            {/* Content Switch: High Speed safety warning vs critical insights */}
            {isHighSpeed ? (
              <div className="py-2">
                <p className="text-sm font-bold text-amber-400">
                  Foco total na via
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  Velocidade elevada detectada. Priorize sua segurança ao dirigir.
                </p>
              </div>
            ) : activeInsight ? (
              <div className="py-2">
                <p className="text-sm font-bold text-white leading-tight">
                  "{activeInsight.phrase}"
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  {activeInsight.subtext}
                </p>
              </div>
            ) : (
              <div className="py-2">
                <p className="text-sm font-bold text-slate-300">
                  Monitorando telemetria...
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  Aguardando dados geográficos relevantes.
                </p>
              </div>
            )}

            {/* Compact Actions Area */}
            <div className="flex items-center justify-between gap-3 border-t border-purple-950/50 pt-3 mt-3">
              <span className="text-[9px] font-mono text-slate-500 uppercase">
                Prioridade: {isHighSpeed ? 'MÁXIMA' : (activeInsight?.priority || 'MEDIUM')}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsOcultado(true)}
                  className="px-2.5 py-1 text-[10px] font-bold text-slate-400 hover:text-white hover:bg-slate-900 rounded-lg border border-slate-800 transition-all select-none cursor-pointer"
                >
                  Ocultar
                </button>
                <button
                  disabled={isHighSpeed || !activeInsight}
                  onClick={handleVerDepois}
                  className="px-2.5 py-1 text-[10px] font-bold bg-purple-900/40 border border-purple-700/50 hover:bg-purple-800 text-purple-300 hover:text-white rounded-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed select-none cursor-pointer"
                >
                  Ver depois
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {isOcultado && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex justify-end"
          >
            <button
              onClick={() => setIsOcultado(false)}
              className="px-3 py-1.5 rounded-full bg-purple-950/60 hover:bg-purple-900/80 border border-purple-800 text-[10px] font-bold text-purple-300 hover:text-white flex items-center gap-1.5 transition-all select-none cursor-pointer"
            >
              <Brain className="w-3.5 h-3.5 animate-pulse" /> Reativar Copiloto
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    );
  }

  // ------------------------------------------------------------------
  // VIEW: RELATÓRIO FINAL DA JORNADA (Completed Journey View)
  // ------------------------------------------------------------------
  if (!finalReport) return null;

  // Recharts period metrics parser
  const periodChartData = habits.periods.map(p => ({
    name: p.name.split(' ')[0],
    earnings: p.totalEarnings,
    speed: p.avgSpeed
  }));

  // Pie chart data for KM distribution
  const kmPieData = [
    { name: 'KM Produtivo', value: finalReport.kmProdutivo, color: '#a855f7' },
    { name: 'KM Vazio', value: finalReport.kmVazio, color: '#334155' }
  ];

  return (
    <div id="copilot_final_report_section" className="bg-[#070417] border border-purple-950/60 rounded-3xl p-6 shadow-xl text-left overflow-hidden relative">
      <div className="absolute top-0 right-0 w-48 h-48 bg-purple-600/10 rounded-full filter blur-3xl pointer-events-none" />

      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-purple-950/55 pb-5 mb-5">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-purple-900/35 border border-purple-700/40 text-purple-400">
            <Sparkles className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
              Relatório Final da Jornada <span className="text-[9px] font-mono text-purple-400 bg-purple-950/50 px-2 py-0.5 rounded border border-purple-900/30">CONCLUÍDA</span>
            </h3>
            <p className="text-[11px] text-slate-400">Consolidado inteligente de telemetria, custos e eficiência</p>
          </div>
        </div>
        <div className="px-3 py-1 bg-emerald-950/40 border border-emerald-800 text-emerald-400 rounded-full text-[10px] font-bold tracking-wider uppercase font-mono">
          Sucesso: {habits.confidenceText}
        </div>
      </div>

      {/* Core financial impact (Lucro Líquido highlighted) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="p-5 rounded-2xl bg-emerald-950/15 border border-emerald-900/40 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-600/5 rounded-full filter blur-xl pointer-events-none" />
          <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider block mb-1">Lucro Líquido Real</span>
          <p className="text-3xl font-extrabold text-emerald-400 font-mono">
            R$ {finalReport.lucroLiquido.toFixed(2)}
          </p>
          <div className="flex items-center gap-1.5 mt-2 text-[10px] text-emerald-500 font-medium font-mono">
            <span>Faturamento R$ {finalReport.revenue.toFixed(2)} - Custo R$ {finalReport.cost.toFixed(2)}</span>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-purple-950/10 border border-purple-900/20">
          <span className="text-[10px] text-purple-400 font-bold uppercase tracking-wider block mb-1">Produtividade de Distância</span>
          <p className="text-3xl font-extrabold text-white font-mono">
            {finalReport.kmTotal.toFixed(1)} <span className="text-xs font-semibold text-slate-400">km total</span>
          </p>
          <div className="flex items-center justify-between text-[10px] text-slate-400 mt-2 font-mono">
            <span>KM Produtivo: {finalReport.kmProdutivo} km</span>
            <span>KM Vazio: {finalReport.kmVazio} km</span>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-[#09051b] border border-purple-950/35">
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-1">Tempo e Produtividade</span>
          <p className="text-3xl font-extrabold text-white font-mono">
            {finalReport.tempoOnline}
          </p>
          <div className="flex items-center justify-between text-[10px] text-slate-400 mt-2 font-mono">
            <span>Online: {finalReport.tempoOnline}</span>
            <span>Parado: {finalReport.tempoParado}</span>
          </div>
        </div>
      </div>

      {/* Intelligent Textual Summary Block */}
      <div className="p-4 rounded-2xl bg-purple-950/15 border border-purple-900/35 mb-6">
        <span className="text-[10px] text-purple-300 font-bold uppercase tracking-wider block mb-1.5">Resumo Inteligente da IA</span>
        <p className="text-xs text-slate-200 leading-relaxed font-sans font-medium">
          {finalReport.resumoDia}
        </p>
      </div>

      {/* Visual Analytics Tab Area: Charts, Timeline, Rankings, and Suggestions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Left Column: Charts and Visuals */}
        <div className="space-y-6">
          {/* Chart 1: Earnings per period of day */}
          <div className="p-5 rounded-2xl bg-[#080415] border border-purple-950/40">
            <span className="text-xs font-bold text-white block mb-3 uppercase tracking-wider">Histórico de Ganhos por Turno</span>
            <div className="h-48 w-full mt-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={periodChartData} margin={{ top: 5, right: 5, left: -25, bottom: 5 }}>
                  <XAxis dataKey="name" stroke="#64748b" fontSize={11} />
                  <YAxis stroke="#64748b" fontSize={11} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#0f0c29', borderColor: '#4c1d95', borderRadius: '12px' }}
                    labelStyle={{ color: '#fff', fontWeight: 'bold' }}
                    itemStyle={{ color: '#a855f7' }}
                  />
                  <Bar dataKey="earnings" name="Ganhos (R$)" fill="#9333ea" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Chart 2: KM distribution (Pie Chart) */}
          <div className="p-5 rounded-2xl bg-[#080415] border border-purple-950/40 flex flex-col sm:flex-row items-center gap-4">
            <div className="flex-1 text-left">
              <span className="text-xs font-bold text-white block mb-1 uppercase tracking-wider">Eficiência de KM</span>
              <p className="text-[11px] text-slate-400 leading-relaxed mt-1">
                A proporção ideal de KM vazio deve se manter abaixo de 35% para proteger seu faturamento líquido contra o desgaste mecânico.
              </p>
              <div className="space-y-1.5 mt-3 text-xs font-mono">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded bg-purple-500 inline-block" />
                  <span className="text-slate-300">KM Produtivo: {finalReport.kmProdutivo} km ({Math.round(finalReport.kmProdutivo / (finalReport.kmTotal || 1) * 100)}%)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded bg-slate-700 inline-block" />
                  <span className="text-slate-500">KM Vazio: {finalReport.kmVazio} km ({Math.round(finalReport.kmVazio / (finalReport.kmTotal || 1) * 100)}%)</span>
                </div>
              </div>
            </div>
            <div className="w-28 h-28 shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={kmPieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={25}
                    outerRadius={40}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {kmPieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Right Column: Intelligent Timeline & Spatial rankings */}
        <div className="space-y-6">
          {/* Intelligent Timeline (ONLY on final report) */}
          <div className="p-5 rounded-2xl bg-[#080415] border border-purple-950/40">
            <span className="text-xs font-bold text-white block mb-4 uppercase tracking-wider flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-purple-400" /> Linha do Tempo Inteligente
            </span>
            <div className="relative pl-5 border-l-2 border-purple-950 space-y-5">
              {finalReport.timeline.map((event, idx) => {
                let dotColor = 'bg-purple-600 border-purple-500';
                if (event.iconType === 'start') dotColor = 'bg-blue-600 border-blue-400';
                else if (event.iconType === 'peak') dotColor = 'bg-emerald-600 border-emerald-400 animate-pulse';
                else if (event.iconType === 'idle') dotColor = 'bg-amber-600 border-amber-400';
                else if (event.iconType === 'empty') dotColor = 'bg-rose-600 border-rose-400';

                return (
                  <div key={idx} className="relative text-xs">
                    <span className={`absolute -left-[27px] top-1 w-3.5 h-3.5 rounded-full border-2 ${dotColor}`} />
                    <span className="font-mono text-[10px] text-purple-400 font-bold block">{event.time}</span>
                    <p className="text-slate-300 font-medium mt-0.5">{event.description}</p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Spatial Performance and Opportunities */}
          <div className="p-5 rounded-2xl bg-[#080415] border border-purple-950/40 space-y-4">
            <div>
              <span className="text-xs font-bold text-white block uppercase tracking-wider">Zonas de Desempenho</span>
              <div className="grid grid-cols-2 gap-3 mt-2.5">
                <div className="p-3 rounded-xl bg-emerald-950/10 border border-emerald-900/30">
                  <span className="text-[9px] text-emerald-400 font-bold uppercase tracking-wider">Regiões Prósperas</span>
                  <p className="text-xs font-bold text-white mt-1 flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-emerald-400" />
                    {finalReport.regioesBoas.join(', ')}
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-rose-950/10 border border-rose-900/30">
                  <span className="text-[9px] text-rose-400 font-bold uppercase tracking-wider">Regiões Críticas</span>
                  <p className="text-xs font-bold text-white mt-1 flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-rose-400" />
                    {finalReport.regioesRuins.join(', ')}
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-1 text-xs">
              <div>
                <span className="text-[10px] text-slate-500 block">Melhor Horário:</span>
                <span className="font-bold text-white flex items-center gap-1 mt-0.5">
                  <Clock className="w-3.5 h-3.5 text-purple-400" />
                  {finalReport.melhorHorario}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 block">Pior Horário:</span>
                <span className="font-bold text-white flex items-center gap-1 mt-0.5">
                  <Clock className="w-3.5 h-3.5 text-slate-600" />
                  {finalReport.piorHorario}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-1 text-xs">
              <div>
                <span className="text-[10px] text-slate-500 block">Ganho por Hora:</span>
                <span className="font-bold text-white block font-mono mt-0.5">R$ {finalReport.ganhoPorHora.toFixed(2)}/h</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 block">Custo por KM:</span>
                <span className="font-bold text-white block font-mono mt-0.5">R$ {finalReport.custoPorKm.toFixed(2)}/km</span>
              </div>
            </div>

            <div className="pt-3 border-t border-purple-950/45 text-xs">
              <span className="text-[10px] text-purple-300 font-bold block uppercase tracking-wider mb-2">Sucesso de Recomendações</span>
              <div className="flex items-center justify-between font-mono">
                <span className="text-slate-400">Oportunidades Aproveitadas:</span>
                <span className="font-bold text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> {finalReport.oportunidadesAproveitadas}
                </span>
              </div>
              <div className="flex items-center justify-between font-mono mt-1.5">
                <span className="text-slate-400">Oportunidades Ignoradas / Salvas depois:</span>
                <span className="font-bold text-amber-400 flex items-center gap-1">
                  <XCircle className="w-3.5 h-3.5" /> {finalReport.oportunidadesPerdidas}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Strategic actionable recommendations based on profile and simulation */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 border-t border-purple-950/50 pt-5">
        <div className="p-5 rounded-2xl bg-purple-950/10 border border-purple-900/20 text-left">
          <span className="text-xs font-bold text-purple-300 block mb-3 uppercase tracking-wider flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-purple-400" /> Recomendações para Próxima Jornada
          </span>
          <ul className="space-y-2 text-xs text-slate-300">
            {finalReport.sugestoesProximaJornada.map((sug, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="text-purple-400 font-bold shrink-0">•</span>
                <span>{sug}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* UberPass Simulator Details */}
        <div className="p-5 rounded-2xl bg-gradient-to-br from-purple-950/15 to-[#0b0720] border-2 border-purple-500/50 relative overflow-hidden">
          <span className="absolute top-3 right-3 px-2 py-0.5 rounded-full bg-purple-500 text-white text-[8px] font-bold tracking-wider uppercase font-mono">
            Economia UberPass
          </span>
          <span className="text-xs font-bold text-white block mb-2 uppercase tracking-wider">
            Conselho UberPass Ativo
          </span>
          <p className="text-xs text-slate-200 font-semibold leading-relaxed">
            Sua recomendação ideal: <span className="text-purple-400 font-extrabold">{finalReport.recomendacaoPasse.name}</span>.
          </p>
          <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
            {finalReport.recomendacaoPasse.reason}
          </p>
          <div className="mt-3 text-[11px] font-bold text-emerald-400 font-mono flex items-center gap-1">
            <TrendingUp className="w-3.5 h-3.5" /> Economia estimada de até R$ {finalReport.recomendacaoPasse.savings.toFixed(0)}/mês!
          </div>
        </div>
      </div>

      {/* Accordion Simulation table button */}
      <div className="mt-6 pt-5 border-t border-purple-950/40">
        <button
          onClick={() => setIsSimulatorOpen(!isSimulatorOpen)}
          className="w-full py-2.5 px-4 rounded-xl bg-purple-900/35 hover:bg-purple-900/50 border border-purple-700/30 hover:border-purple-600/40 text-xs font-bold text-white flex items-center justify-between transition-all select-none cursor-pointer"
        >
          <div className="flex items-center gap-1.5">
            <Coins className="w-4 h-4 text-purple-400" />
            <span>Simulador de Economia UberPass Completo</span>
          </div>
          {isSimulatorOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>

        {/* Expandable simulated list */}
        <AnimatePresence>
          {isSimulatorOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: 'easeInOut' }}
              className="overflow-hidden"
            >
              <div className="grid grid-cols-1 gap-3 mt-4">
                {analysis.simulations.map((sim, index) => {
                  const borderStyle = sim.isRecommended 
                    ? 'border-purple-500 bg-purple-950/20' 
                    : 'border-purple-950/40 bg-purple-950/5';

                  return (
                    <div key={index} className={`p-4 rounded-xl border ${borderStyle} text-left`}>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-white">{sim.option.name}</span>
                        <span className="text-[11px] text-purple-400 font-mono font-bold">Preço: R$ {sim.option.price.toFixed(0)}</span>
                      </div>
                      <p className="text-[11px] text-slate-300 mt-1 leading-relaxed">
                        {sim.reason}
                      </p>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2 pt-2 border-t border-purple-950/20 text-[9px] font-mono text-slate-500">
                        <div>
                          <span>Custo p/ Hora:</span>
                          <strong className="block text-white">R$ {sim.costPerHour.toFixed(2)}/h</strong>
                        </div>
                        <div>
                          <span>Custo p/ Dia:</span>
                          <strong className="block text-white">R$ {sim.costPerDay.toFixed(2)}/dia</strong>
                        </div>
                        <div>
                          <span>Custo p/ Mês:</span>
                          <strong className="block text-white">R$ {sim.costPerMonth.toFixed(2)}/mês</strong>
                        </div>
                        <div>
                          <span>Economia:</span>
                          <strong className="block text-emerald-400">+ R$ {sim.estimatedSavings.toFixed(0)}</strong>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
