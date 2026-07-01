/**
 * DriverDash Roxou - Predictive AI Dashboard (FASE 3)
 * Location: src/modules/predictive-intelligence/PredictiveDashboard.tsx
 */

import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { 
  Sparkles, Compass, Clock, MapPin, TrendingUp, AlertTriangle, 
  DollarSign, Check, X, ShieldAlert, Zap, ArrowRight, BarChart3, HelpCircle, RefreshCw
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  predictiveIntelligenceEngine, 
  predictRideOfferScore 
} from './predictiveIntelligence.engine';
import { 
  NeighborhoodReturnIndex, 
  NextRidePrediction, 
  DailyForecast, 
  HistoricalComparisonItem, 
  PredictiveOfferScoreResult 
} from './predictive.types';

export const PredictiveDashboard: React.FC = () => {
  const { earnings, expenses, vehicle, vehicleCostSettings } = useApp();

  // Ride logs from localStorage
  const [rideLogs, setRideLogs] = useState<any[]>([]);
  const [currentLocation, setCurrentLocation] = useState<string>('Centro');
  const [recalcCount, setRecalcCount] = useState<number>(0);

  // Offer Simulator inputs
  const [simFare, setSimFare] = useState<string>('28.50');
  const [simDistance, setSimDistance] = useState<string>('7.2');
  const [simDuration, setSimDuration] = useState<string>('18');
  const [simPickup, setSimPickup] = useState<string>('Centro');
  const [simDestination, setSimDestination] = useState<string>('Álvares Machado');

  // Load completed rides on change
  useEffect(() => {
    const loadLogs = () => {
      try {
        const stored = localStorage.getItem('ride_logs');
        if (stored) {
          setRideLogs(JSON.parse(stored));
        }
      } catch (e) {
        console.error('Failed to load ride logs:', e);
      }
    };
    loadLogs();
  }, [recalcCount]);

  // Check if data meets minimum requirements
  const isReady = useMemo(() => {
    return predictiveIntelligenceEngine.hasEnoughData(rideLogs);
  }, [rideLogs]);

  // Method to inject high-fidelity initial dataset to make the system active
  const handleLoadSampleDataset = () => {
    const sampleRides = [
      {
        id: 'pred_dummy_1',
        bairroOrigem: 'Centro',
        bairroDestino: 'Prudenshopping',
        receivedValue: 22.0,
        distance: 5.1,
        duration: 720,
        tempo_parado: 120,
        platform: 'uber',
        startTime: Date.now() - 3600 * 1000 * 4,
        status: 'finished',
        lucro: 17.50
      },
      {
        id: 'pred_dummy_2',
        bairroOrigem: 'Prudenshopping',
        bairroDestino: 'UNOESTE',
        receivedValue: 34.0,
        distance: 10.2,
        duration: 1200,
        tempo_parado: 180,
        platform: '99',
        startTime: Date.now() - 3600 * 1000 * 12,
        status: 'finished',
        lucro: 26.10
      },
      {
        id: 'pred_dummy_3',
        bairroOrigem: 'UNOESTE',
        bairroDestino: 'Parque do Povo',
        receivedValue: 28.5,
        distance: 7.5,
        duration: 900,
        tempo_parado: 110,
        platform: 'uber',
        startTime: Date.now() - 3600 * 1000 * 24,
        status: 'finished',
        lucro: 22.30
      },
      {
        id: 'pred_dummy_4',
        bairroOrigem: 'Centro',
        bairroDestino: 'Álvares Machado',
        receivedValue: 45.0,
        distance: 15.2,
        duration: 1650,
        tempo_parado: 260,
        platform: 'indriver',
        startTime: Date.now() - 3600 * 1000 * 36,
        status: 'finished',
        lucro: 28.50,
        empty_km_return: 11.5
      },
      {
        id: 'pred_dummy_5',
        bairroOrigem: 'Cohab',
        bairroDestino: 'Centro',
        receivedValue: 16.5,
        distance: 3.8,
        duration: 540,
        tempo_parado: 80,
        platform: 'uber',
        startTime: Date.now() - 3600 * 1000 * 48,
        status: 'finished',
        lucro: 12.80
      }
    ];
    try {
      localStorage.setItem('ride_logs', JSON.stringify(sampleRides));
      setRideLogs(sampleRides);
      setRecalcCount(prev => prev + 1);
    } catch (e) {
      console.error(e);
    }
  };

  // 1. Return indexes calculations
  const returnIndexes = useMemo<NeighborhoodReturnIndex[]>(() => {
    return predictiveIntelligenceEngine.calculateReturnIndexes(rideLogs);
  }, [rideLogs]);

  // 2. Next ride prediction
  const nextRidePred = useMemo<NextRidePrediction>(() => {
    return predictiveIntelligenceEngine.predictNextRide(rideLogs, currentLocation);
  }, [rideLogs, currentLocation]);

  // 3. Daily earnings forecast
  const dailyForecast = useMemo<DailyForecast>(() => {
    return predictiveIntelligenceEngine.predictDailyForecast(rideLogs, earnings, vehicle, vehicleCostSettings);
  }, [rideLogs, earnings, vehicle, vehicleCostSettings]);

  // 4. Historical comparison
  const comparisons = useMemo<HistoricalComparisonItem[]>(() => {
    return predictiveIntelligenceEngine.getHistoricalComparisons(rideLogs);
  }, [rideLogs]);

  // 5. Simulated predictive offer score
  const predictedScore = useMemo<PredictiveOfferScoreResult>(() => {
    return predictRideOfferScore({
      fare: parseFloat(simFare) || 10.0,
      distanceKm: parseFloat(simDistance) || 3.0,
      durationMin: parseFloat(simDuration) || 10,
      pickupNeighborhood: simPickup,
      destinationNeighborhood: simDestination
    });
  }, [simFare, simDistance, simDuration, simPickup, simDestination]);

  // Simulated accept trigger for reinforcement loop
  const handleApplyDecision = (action: 'accepted' | 'declined') => {
    // Inject custom log as a finished ride to update training state dynamically
    if (action === 'accepted') {
      try {
        const stored = localStorage.getItem('ride_logs');
        const logs = stored ? JSON.parse(stored) : [];
        const newRide = {
          id: 'p_acc_' + Date.now(),
          bairroOrigem: simPickup,
          bairroDestino: simDestination,
          receivedValue: parseFloat(simFare),
          distance: parseFloat(simDistance),
          duration: parseFloat(simDuration) * 60,
          tempo_parado: 120,
          platform: 'uber',
          startTime: Date.now(),
          status: 'finished',
          lucro: predictedScore.estimatedNetProfit
        };
        const updated = [newRide, ...logs];
        localStorage.setItem('ride_logs', JSON.stringify(updated));
        setRideLogs(updated);
        setRecalcCount(prev => prev + 1);
      } catch (e) {
        console.error(e);
      }
    }
  };

  return (
    <div className="space-y-6 text-left">
      
      {/* HEADER HERO */}
      <div className="p-6 rounded-3xl bg-gradient-to-r from-[#11072a] via-[#1a0c3f] to-[#11072a] border border-purple-900/30 flex flex-col md:flex-row items-center justify-between gap-6 relative overflow-hidden shadow-xl">
        <div className="absolute top-0 right-0 w-44 h-44 bg-purple-500/10 rounded-full filter blur-3xl pointer-events-none" />
        
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-purple-950/50 border border-purple-500/20 flex items-center justify-center text-purple-400 shrink-0">
            <Sparkles className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <h3 className="font-sans font-extrabold text-slate-100 text-sm flex items-center gap-2">
              IA Preditiva • Inteligência de Decisão (Fase 3)
              <span className="text-[8px] bg-emerald-500/20 text-emerald-300 font-mono font-bold uppercase tracking-widest px-2.5 py-0.5 rounded-full border border-emerald-500/20">
                Padrões Ativos
              </span>
            </h3>
            <p className="text-[11px] text-purple-300/60 font-sans leading-relaxed mt-0.5">
              Utilizando modelos de aprendizado estatístico para projetar faturamentos diários, prever riscos de retorno vazio e avaliar ofertas em tempo real.
            </p>
          </div>
        </div>

        <button 
          onClick={() => setRecalcCount(prev => prev + 1)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-[#05030c] hover:bg-[#11072a] border border-purple-900/30 rounded-xl text-[10px] text-purple-300 font-bold font-mono transition-all uppercase tracking-wider"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Forçar Recálculo
        </button>
      </div>

      {/* NOT ENOUGH DATA FALLBACK (REQUIREMENT 7) */}
      <AnimatePresence>
        {!isReady && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-6 rounded-3xl bg-[#09051d] border border-yellow-900/30 flex flex-col items-center text-center gap-4"
          >
            <div className="w-12 h-12 rounded-2xl bg-yellow-950/40 border border-yellow-500/20 flex items-center justify-center text-yellow-500">
              <ShieldAlert className="w-6 h-6 animate-bounce" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-200">
                IA preditiva em aprendizado. Continue registrando corridas para melhorar as previsões.
              </p>
              <p className="text-xs text-purple-300/50 mt-1 max-w-lg mx-auto">
                Para desbloquear as previsões em tempo real, o motor requer um histórico de pelo menos 5 corridas salvas no banco local.
              </p>
            </div>
            <button
              onClick={handleLoadSampleDataset}
              className="px-4 py-2 bg-purple-950/60 hover:bg-purple-900 border border-purple-500/20 rounded-xl text-xs text-purple-200 font-bold transition-all cursor-pointer shadow-md"
            >
              📥 Alimentar IA com Banco de Amostras
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ACTIVE METRICS BOARD */}
      {isReady && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

          {/* CARD 1: PREVISÃO DE HOJE */}
          <div className="p-5 bg-[#0b0720]/80 border border-purple-950/40 rounded-3xl flex flex-col justify-between space-y-4">
            <div className="flex items-center justify-between border-b border-purple-950/15 pb-3">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-purple-400" />
                <h4 className="text-xs font-extrabold text-slate-300 uppercase font-mono tracking-wider">Previsão de Hoje</h4>
              </div>
              <span className="text-[9px] font-mono bg-purple-950 text-purple-400 border border-purple-900/20 px-2 py-0.5 rounded-md font-bold">
                Confiança: {dailyForecast.confidenceScore}%
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3.5 text-xs font-sans">
              <div className="p-3 bg-[#05030c]/50 border border-purple-950/10 rounded-xl text-left">
                <span className="text-[9px] text-slate-500 block uppercase font-mono font-bold">Bruto Previsto</span>
                <strong className="text-base font-extrabold text-[#f1f5f9] font-mono block mt-0.5">
                  R$ {dailyForecast.predictedGross.toFixed(2)}
                </strong>
              </div>
              <div className="p-3 bg-[#05030c]/50 border border-purple-950/10 rounded-xl text-left">
                <span className="text-[9px] text-slate-500 block uppercase font-mono font-bold">Lucro Líquido</span>
                <strong className="text-base font-extrabold text-emerald-400 font-mono block mt-0.5">
                  R$ {dailyForecast.predictedNetProfit.toFixed(2)}
                </strong>
              </div>
              <div className="p-3 bg-[#05030c]/50 border border-purple-950/10 rounded-xl text-left">
                <span className="text-[9px] text-slate-500 block uppercase font-mono font-bold">Km Previsto</span>
                <strong className="text-base font-extrabold text-slate-300 font-mono block mt-0.5">
                  {dailyForecast.predictedKm} km
                </strong>
              </div>
              <div className="p-3 bg-[#05030c]/50 border border-purple-950/10 rounded-xl text-left">
                <span className="text-[9px] text-slate-500 block uppercase font-mono font-bold">Corridas Previstas</span>
                <strong className="text-base font-extrabold text-[#c084fc] font-mono block mt-0.5">
                  {dailyForecast.predictedRidesCount} chamadas
                </strong>
              </div>
            </div>

            <div className="p-3 bg-purple-950/10 border border-purple-900/15 rounded-xl text-[11px] text-purple-300/70 leading-relaxed text-left flex items-center gap-2">
              <Clock className="w-4 h-4 text-purple-400 shrink-0" />
              <span>
                Faltam aprox. <strong className="text-purple-300 font-mono">{dailyForecast.hoursToReachGoal} horas</strong> de direção contínua para bater as metas líquidas estimadas de hoje.
              </span>
            </div>
          </div>

          {/* CARD 2: CHANCE DE PRÓXIMA CORRIDA */}
          <div className="p-5 bg-[#0b0720]/80 border border-purple-950/40 rounded-3xl flex flex-col justify-between space-y-4">
            <div className="flex items-center justify-between border-b border-purple-950/15 pb-3">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-purple-400" />
                <h4 className="text-xs font-extrabold text-slate-300 uppercase font-mono tracking-wider">Chance Próxima Corrida</h4>
              </div>
              <span className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded-md border ${
                nextRidePred.confidenceLevel === 'Alta' 
                  ? 'bg-emerald-950/30 text-emerald-400 border-emerald-900/30' 
                  : 'bg-yellow-950/30 text-yellow-400 border-yellow-900/20'
              }`}>
                Confiança: {nextRidePred.confidenceLevel}
              </span>
            </div>

            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full border-4 border-purple-500/20 flex items-center justify-center shrink-0">
                <span className="text-lg font-black text-purple-300 font-mono">{nextRidePred.chanceNext15Min}%</span>
              </div>
              <div className="text-left space-y-1">
                <span className="text-[10px] text-slate-500 font-mono font-bold uppercase">Probabilidade (15 min)</span>
                <p className="text-xs text-slate-200 leading-relaxed font-semibold">
                  {nextRidePred.chanceNext15Min >= 70 ? 'Altas chances de chamada iminente!' : 'Chance regular de solicitação.'}
                </p>
              </div>
            </div>

            {/* Location anchor selector */}
            <div className="space-y-1 text-left">
              <label className="text-[9px] text-slate-500 font-mono font-bold uppercase">Sua Localização de Teste</label>
              <select
                value={currentLocation}
                onChange={(e) => setCurrentLocation(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-[#05030c] border border-purple-950/30 rounded-lg text-xs text-slate-300 focus:outline-none"
              >
                <option value="Centro">Centro</option>
                <option value="Prudenshopping">Prudenshopping</option>
                <option value="UNOESTE">UNOESTE</option>
                <option value="Álvares Machado">Álvares Machado</option>
                <option value="Aeroporto">Aeroporto</option>
              </select>
            </div>

            <p className="text-[10px] text-purple-300/50 italic leading-normal text-left pt-1 border-t border-purple-950/10">
              "{nextRidePred.justification}"
            </p>
          </div>

          {/* CARD 3: RISCO DE RETORNO VAZIO */}
          <div className="p-5 bg-[#0b0720]/80 border border-purple-950/40 rounded-3xl flex flex-col justify-between space-y-4">
            <div className="flex items-center justify-between border-b border-purple-950/15 pb-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-purple-400" />
                <h4 className="text-xs font-extrabold text-slate-300 uppercase font-mono tracking-wider">Risco de Retorno Vazio</h4>
              </div>
              <span className="text-[9px] font-mono bg-purple-950 text-purple-400 border border-purple-900/20 px-2 py-0.5 rounded-md font-bold">
                Análise de Destinos
              </span>
            </div>

            <div className="space-y-2.5 max-h-[160px] overflow-y-auto custom-scrollbar pr-1">
              {returnIndexes.slice(0, 4).map((item, idx) => {
                let badgeColor = 'text-emerald-400 bg-emerald-950/20 border-emerald-900/30';
                if (item.emptyReturnChance >= 40) badgeColor = 'text-rose-400 bg-rose-950/20 border-rose-900/30';
                else if (item.emptyReturnChance >= 20) badgeColor = 'text-yellow-400 bg-yellow-950/20 border-yellow-900/20';

                return (
                  <div key={item.neighborhood || idx} className="p-2 bg-[#05030c]/50 rounded-xl border border-purple-950/10 flex items-center justify-between text-left">
                    <div className="max-w-[70%] truncate">
                      <strong className="text-xs text-slate-200 block truncate">{item.neighborhood}</strong>
                      <span className="text-[9px] text-slate-400 font-mono">Próxima chamada em ~{item.avgTimeToNextRideMin} min</span>
                    </div>
                    <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border shrink-0 ${badgeColor}`}>
                      {item.emptyReturnChance}% risco
                    </span>
                  </div>
                );
              })}
            </div>

            <p className="text-[9px] text-slate-500 font-mono leading-relaxed text-left border-t border-purple-950/10 pt-2">
              Risco alto (Vermelho) indica baixa densidade local. Recomendamos adicionar retorno vazio estimado na tarifa oferecida.
            </p>
          </div>

          {/* CARD 4: MELHORES REGIÕES AGORA */}
          <div className="p-5 bg-[#0b0720]/80 border border-purple-950/40 rounded-3xl flex flex-col justify-between space-y-4">
            <div className="flex items-center justify-between border-b border-purple-950/15 pb-3">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-purple-400" />
                <h4 className="text-xs font-extrabold text-slate-300 uppercase font-mono tracking-wider">Melhores Regiões Agora</h4>
              </div>
              <span className="text-[8px] font-mono bg-indigo-950 text-indigo-400 border border-indigo-900/30 px-2 py-0.5 rounded-md font-bold uppercase">
                Hotspots
              </span>
            </div>

            <div className="space-y-2 max-h-[160px] overflow-y-auto custom-scrollbar pr-1 text-left">
              {returnIndexes.slice(0, 3).map((item, idx) => (
                <div key={item.neighborhood || idx} className="p-2.5 bg-purple-950/10 border border-purple-900/10 hover:border-purple-500/20 rounded-xl flex items-center justify-between transition-all">
                  <div className="flex items-center gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-purple-950 text-purple-400 font-mono text-[10px] font-bold flex items-center justify-center">
                      #{idx + 1}
                    </span>
                    <div>
                      <strong className="text-xs text-slate-200 block">{item.neighborhood}</strong>
                      <span className="text-[9px] text-slate-500 font-mono">Retorno Seguro: {item.returnScore}/100</span>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono text-emerald-400 font-bold bg-emerald-950/20 px-2 py-0.5 rounded-md border border-emerald-900/20">
                    Forte
                  </span>
                </div>
              ))}
            </div>

            <p className="text-[10px] text-purple-300/40 italic text-left pt-2 border-t border-purple-950/10 leading-normal">
              Zonas classificadas por probabilidade de chamadas contínuas sem necessidade de rodar vazio.
            </p>
          </div>

          {/* CARD 5: COMPARAÇÃO HISTÓRICA */}
          <div className="p-5 bg-[#0b0720]/80 border border-purple-950/40 rounded-3xl flex flex-col justify-between space-y-4">
            <div className="flex items-center justify-between border-b border-purple-950/15 pb-3">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-purple-400" />
                <h4 className="text-xs font-extrabold text-slate-300 uppercase font-mono tracking-wider">Comparação Histórica</h4>
              </div>
              <span className="text-[9px] font-mono bg-purple-950 text-purple-400 border border-purple-900/20 px-2 py-0.5 rounded-md font-bold">
                Performance
              </span>
            </div>

            <div className="space-y-2 text-left text-xs font-sans">
              {comparisons.map((c, idx) => {
                let badgeStyle = 'text-slate-400 bg-slate-950/20 border-slate-900/25';
                if (c.status === 'better') badgeStyle = 'text-emerald-400 bg-emerald-950/20 border-emerald-900/20';
                else if (c.status === 'worse') badgeStyle = 'text-rose-400 bg-rose-950/20 border-rose-900/25';

                return (
                  <div key={idx} className="p-2 bg-[#05030c]/50 rounded-xl border border-purple-950/10 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-slate-400 block font-semibold">{c.label}</span>
                      <span className="text-[9px] text-slate-500 font-mono">Par: R$ {c.comparisonValue.toFixed(0)}</span>
                    </div>
                    <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border shrink-0 ${badgeStyle}`}>
                      {c.percentageDiff > 0 ? `+${c.percentageDiff}%` : `${c.percentageDiff}%`}
                    </span>
                  </div>
                );
              })}
            </div>

            <p className="text-[10px] text-slate-500 font-mono text-left pt-2 border-t border-purple-950/10">
              Cálculo baseado em recebidos acumulados e médias móveis.
            </p>
          </div>

          {/* CARD 6: PREDICTIVE RIDE OFFER SCORE SIMULATOR */}
          <div className="p-5 bg-[#0b0720]/80 border border-purple-950/40 rounded-3xl flex flex-col justify-between space-y-4 lg:col-span-1">
            <div className="flex items-center justify-between border-b border-purple-950/15 pb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-purple-400 animate-pulse" />
                <h4 className="text-xs font-extrabold text-slate-300 uppercase font-mono tracking-wider">Score Preditivo de Oferta</h4>
              </div>
              <span className="text-[9px] font-mono bg-purple-950 text-purple-400 border border-purple-900/20 px-2 py-0.5 rounded-md font-bold">
                Confiança: {predictedScore.confidenceLevel}%
              </span>
            </div>

            {/* Inputs Simulator */}
            <div className="grid grid-cols-3 gap-2 text-[10px] text-left">
              <div className="space-y-0.5">
                <label className="text-[8px] text-slate-500 font-mono font-bold uppercase">Tarifa (R$)</label>
                <input
                  type="number"
                  value={simFare}
                  onChange={(e) => setSimFare(e.target.value)}
                  className="w-full px-2 py-1 bg-[#05030c] border border-purple-950/30 rounded text-xs text-slate-300 font-mono font-bold focus:outline-none"
                />
              </div>
              <div className="space-y-0.5">
                <label className="text-[8px] text-slate-500 font-mono font-bold uppercase">Distância (km)</label>
                <input
                  type="number"
                  value={simDistance}
                  onChange={(e) => setSimDistance(e.target.value)}
                  className="w-full px-2 py-1 bg-[#05030c] border border-purple-950/30 rounded text-xs text-slate-300 font-mono font-bold focus:outline-none"
                />
              </div>
              <div className="space-y-0.5">
                <label className="text-[8px] text-slate-500 font-mono font-bold uppercase">Tempo (min)</label>
                <input
                  type="number"
                  value={simDuration}
                  onChange={(e) => setSimDuration(e.target.value)}
                  className="w-full px-2 py-1 bg-[#05030c] border border-purple-950/30 rounded text-xs text-slate-300 font-mono font-bold focus:outline-none"
                />
              </div>
            </div>

            {/* Simulated Score Output */}
            <div className="p-3 bg-[#05030c]/90 border border-purple-950/30 rounded-xl space-y-1.5 text-left">
              <div className="flex items-center justify-between">
                <span className="text-[9px] text-purple-400 font-mono font-bold uppercase">Classificação IA:</span>
                <span className={`text-[9px] font-black font-sans px-1.5 py-0.2 rounded border uppercase tracking-wide ${
                  predictedScore.rating === 'Excelente' 
                    ? 'bg-emerald-950 text-emerald-400 border-emerald-900/40' 
                    : predictedScore.rating === 'Boa'
                    ? 'bg-teal-950 text-teal-400 border-teal-900/30'
                    : predictedScore.rating === 'Aceitável'
                    ? 'bg-yellow-950 text-yellow-400 border-yellow-900/20'
                    : 'bg-rose-950 text-rose-400 border-rose-900/30'
                }`}>
                  {predictedScore.rating} ({predictedScore.score}/100)
                </span>
              </div>
              <p className="text-[10px] text-slate-300 font-sans italic leading-tight">
                "{predictedScore.mainReason}"
              </p>
            </div>

            {/* Decision Loop Test */}
            <div className="flex gap-2.5 pt-1">
              <button
                onClick={() => handleApplyDecision('accepted')}
                className="flex-1 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-[10px] rounded-lg cursor-pointer flex items-center justify-center gap-1 uppercase transition-colors"
              >
                <Check className="w-3 h-3" /> Aceitar (Alimenta IA)
              </button>
              <button
                onClick={() => handleApplyDecision('declined')}
                className="flex-1 py-1.5 bg-[#05030c] text-rose-400 border border-rose-950/40 font-extrabold text-[10px] rounded-lg cursor-pointer flex items-center justify-center gap-1 uppercase transition-colors"
              >
                <X className="w-3 h-3" /> Recusar
              </button>
            </div>
          </div>

        </div>
      )}

    </div>
  );
};
