/**
 * Premium Active Journey Tracker Screen
 * Route: /jornada
 * Responsibility: Initiates tracking, displays active ride statistics, and monitors real-time GPS state.
 */

import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { 
  Play, Square, MapPin, Navigation, Clock, ShieldAlert,
  AlertTriangle, Milestone, Activity, Compass, Flame, Info,
  Bot, Sparkles, ThumbsUp, ThumbsDown, Gauge, TrendingUp, Terminal, Check, X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { telemetrySyncService } from '../modules/journey/telemetrySync.service';
import { startRide, finishRide } from '../modules/journey/journeyClassifier.service';
import { supabase } from '../modules/shared/supabase.helpers';
import { 
  analyzeTelemetryForRide, 
  submitAIConfirmationFeedback, 
  getSmartRideStats, 
  AIDetectionState, 
  AIRideStats 
} from '../modules/journey/smartRideDetection.service';

// Haversine Formula helper
export function calculateHaversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Kilometers
}

export const JornadaPage: React.FC = () => {
  const navigate = useNavigate();
  const { 
    driverSessions, 
    routePoints, 
    startSession, 
    endSession, 
    addSmartAlert,
    smartAlerts,
    gpsStatus,
    permissionState,
    lastCoord,
    gpsError,
    totalDistanceKm
  } = useApp();

  const [elapsedTime, setElapsedTime] = useState<string>('00:00:00');
  const [wakeLockActive, setWakeLockActive] = useState(false);
  const [wakeLockObj, setWakeLockObj] = useState<any | null>(null);

  // Active session helper
  const activeSession = useMemo(() => {
    return driverSessions.find(s => s.status === 'active');
  }, [driverSessions]);

  // Ride status state and handlers (Phase 6)
  const [isRideActive, setIsRideActive] = useState<boolean>(false);
  const [manualOverride, setManualOverride] = useState<boolean>(false);

  // AI-powered states (Smart Ride Detection)
  const [aiState, setAiState] = useState<AIDetectionState | null>(null);
  const [aiStats, setAiStats] = useState<AIRideStats>({
    accuracyRate: 95.8,
    autoDetectedCount: 0,
    manuallyConfirmedCount: 0,
    totalRideCount: 0
  });
  const [pendingFeedbackEventId, setPendingFeedbackEventId] = useState<string | null>(null);
  const [aiLogs, setAiLogs] = useState<string[]>([]);

  // Function to load stats
  const fetchStats = async () => {
    if (activeSession) {
      const stats = await getSmartRideStats(activeSession.id);
      setAiStats(stats);
    } else {
      const stats = await getSmartRideStats();
      setAiStats(stats);
    }
  };

  // Keep a running log list from console logs and predictions
  const addAiLog = (msg: string) => {
    setAiLogs(prev => {
      const updated = [...prev, `[${new Date().toLocaleTimeString('pt-BR')}] ${msg}`];
      if (updated.length > 50) updated.shift();
      return updated;
    });
  };

  useEffect(() => {
    if (activeSession) {
      setIsRideActive(localStorage.getItem(`driverdash_ride_active_${activeSession.id}`) === 'true');
      setManualOverride(localStorage.getItem(`driverdash_ride_manual_override_${activeSession.id}`) === 'true');
      fetchStats();
    } else {
      setIsRideActive(false);
      setManualOverride(false);
    }
  }, [activeSession]);

  // Main automatic detection loop
  useEffect(() => {
    if (!activeSession) return;

    const executeAiDetection = async () => {
      try {
        // Find if there is currently an active ride_started event
        const { data: activeEvents } = await supabase
          .from('driver_ride_events')
          .select('*')
          .eq('session_id', activeSession.id)
          .eq('event_type', 'ride_started')
          .is('ended_at', null)
          .limit(1);

        const activeEvent = activeEvents && activeEvents.length > 0 ? activeEvents[0] : null;

        // Current points for this active session
        const sessionPts = routePoints.filter(p => p.session_id === activeSession.id);

        addAiLog(`[RideAI] Analisando telemetria: ${sessionPts.length} pontos, status ativo: ${activeEvent ? 'Em corrida' : 'Vazio'}`);

        const result = await analyzeTelemetryForRide(
          activeSession.id,
          sessionPts,
          activeEvent,
          addSmartAlert
        );

        setAiState(result);
        addAiLog(`[RideAI] ride confidence: ${result.confidenceScore}% | State: ${result.currentAutoState}`);

        // Update active ride status
        const hasActiveEvent = activeEvent !== null;
        setIsRideActive(hasActiveEvent);
        localStorage.setItem(`driverdash_ride_active_${activeSession.id}`, hasActiveEvent ? 'true' : 'false');

        // Check if there is an automated event that needs feedback confirmation
        if (hasActiveEvent && activeEvent.is_automated && !activeEvent.was_confirmed_manually) {
          setPendingFeedbackEventId(activeEvent.id);
        } else {
          setPendingFeedbackEventId(null);
        }

        // Fetch refreshed stats
        await fetchStats();
      } catch (err) {
        console.error('[RideAI] Error in automated loop:', err);
      }
    };

    executeAiDetection();
  }, [routePoints, activeSession, addSmartAlert]);

  const handleAcceptRide = async () => {
    if (!activeSession) return;
    try {
      // Prioridade total para evento manual (Manual Override)
      localStorage.setItem(`driverdash_ride_manual_override_${activeSession.id}`, 'true');
      setManualOverride(true);
      addAiLog('[RideAI] manual override: Aceitando corrida manualmente');

      const eventId = await startRide(activeSession.id, lastCoord?.lat, lastCoord?.lng);
      
      // Update event with manual details
      await supabase
        .from('driver_ride_events')
        .update({
          is_automated: false,
          confidence_score: 100,
          classification_reason: 'Iniciada manualmente pelo motorista (Override)',
          was_confirmed_manually: true
        })
        .eq('id', eventId);

      localStorage.setItem(`driverdash_ride_active_${activeSession.id}`, 'true');
      localStorage.setItem(`driverdash_active_event_id_${activeSession.id}`, eventId);
      setIsRideActive(true);
      
      if (addSmartAlert) {
        addSmartAlert({
          title: 'Corrida Iniciada',
          description: 'A telemetria passará a gravar seus pontos como KM Produtivo (Override manual ativo).',
          type: 'profit',
          severity: 'low'
        });
      }

      await fetchStats();
    } catch (err) {
      console.error("Failed to start ride event:", err);
    }
  };

  const handleFinishRide = async () => {
    if (!activeSession) return;
    try {
      // Prioridade total para evento manual (Manual Override)
      localStorage.setItem(`driverdash_ride_manual_override_${activeSession.id}`, 'true');
      setManualOverride(true);
      addAiLog('[RideAI] manual override: Finalizando corrida manualmente');

      await finishRide(activeSession.id, lastCoord?.lat, lastCoord?.lng);
      
      // Update finished events with manual override status
      const { data: latestEvents } = await supabase
        .from('driver_ride_events')
        .select('*')
        .eq('session_id', activeSession.id)
        .eq('event_type', 'ride_finished')
        .order('started_at', { ascending: false })
        .limit(1);

      if (latestEvents && latestEvents.length > 0) {
        await supabase
          .from('driver_ride_events')
          .update({
            is_automated: false,
            confidence_score: 100,
            classification_reason: 'Finalizada manualmente pelo motorista (Override)',
            was_confirmed_manually: true
          })
          .eq('id', latestEvents[0].id);
      }

      localStorage.setItem(`driverdash_ride_active_${activeSession.id}`, 'false');
      localStorage.removeItem(`driverdash_active_event_id_${activeSession.id}`);
      setIsRideActive(false);
      setPendingFeedbackEventId(null);
      
      if (addSmartAlert) {
        addSmartAlert({
          title: 'Corrida Finalizada',
          description: 'Voltou à classificação padrão (KM Vazio). Override manual respeitado.',
          type: 'profit',
          severity: 'low'
        });
      }

      await fetchStats();
    } catch (err) {
      console.error("Failed to finish ride event:", err);
    }
  };

  // Handles training feedback
  const handleAIFeedback = async (isConfirmed: boolean) => {
    if (!activeSession || !pendingFeedbackEventId) return;
    try {
      await submitAIConfirmationFeedback(activeSession.id, pendingFeedbackEventId, isConfirmed);
      addAiLog(`[RideAI] ${isConfirmed ? 'ride confirmed' : 'ride rejected'} by driver feedback`);
      
      if (isConfirmed) {
        addSmartAlert?.({
          title: 'Aprendizado IA Confirmado! 🎯',
          description: 'Obrigado! A heurística de detecção automática foi calibrada com o seu padrão de direção.',
          type: 'profit',
          severity: 'low'
        });
      } else {
        // Revert event if rejected by user
        addSmartAlert?.({
          title: 'Rejeitado / Calibrando 🛠️',
          description: 'Classificação revertida. A IA está reajustando os filtros de aceleração e velocidade.',
          type: 'fuel',
          severity: 'low'
        });
        
        // Revert active ride manually
        await finishRide(activeSession.id, lastCoord?.lat, lastCoord?.lng);
        localStorage.setItem(`driverdash_ride_active_${activeSession.id}`, 'false');
        setIsRideActive(false);
      }
      
      setPendingFeedbackEventId(null);
      await fetchStats();
    } catch (err) {
      console.error('[RideAI] Error handling feedback:', err);
    }
  };

  const handleResetOverride = () => {
    if (!activeSession) return;
    localStorage.removeItem(`driverdash_ride_manual_override_${activeSession.id}`);
    setManualOverride(false);
    addAiLog('[RideAI] manual override resetado - retornando ao modo automático padrão');
    addSmartAlert?.({
      title: 'Modo Automático Reativado 🤖',
      description: 'A IA voltou a monitorar passivamente os inícios e fins de corrida pela telemetria.',
      type: 'profit',
      severity: 'low'
    });
  };

  // Status Label logic: Sem corrida ativa: "Rodando vazio", Corrida ativa: "Corrida em andamento", Parado: "Parado/Esperando"
  const currentStatusLabel = useMemo(() => {
    if (!activeSession) return '';
    if (isRideActive) {
      return 'Corrida em andamento';
    }
    const isStopped = lastCoord ? lastCoord.speed === 0 : true;
    if (isStopped) {
      return 'Parado/Esperando';
    }
    return 'Rodando vazio';
  }, [activeSession, isRideActive, lastCoord]);

  // Track points specifically belonging to the active session (sorted by time)
  const currentSessionPoints = useMemo(() => {
    if (!activeSession) return [];
    return routePoints
      .filter(p => p.session_id === activeSession.id)
      .sort((a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime());
  }, [routePoints, activeSession]);

  // Elapsed time tracking logic
  useEffect(() => {
    if (!activeSession) {
      setElapsedTime('00:00:00');
      return;
    }

    const interval = setInterval(() => {
      const start = new Date(activeSession.start_time).getTime();
      const now = new Date().getTime();
      const diffMs = now - start;

      const hours = Math.floor(diffMs / (3600 * 1000));
      const mins = Math.floor((diffMs % (3600 * 1000)) / (60 * 1000));
      const secs = Math.floor((diffMs % (60 * 1000)) / 1000);

      const fHours = hours.toString().padStart(2, '0');
      const fMins = mins.toString().padStart(2, '0');
      const fSecs = secs.toString().padStart(2, '0');

      setElapsedTime(`${fHours}:${fMins}:${fSecs}`);
    }, 1000);

    return () => clearInterval(interval);
  }, [activeSession]);

  // Request Wake Lock for Mobile Screen-on
  const requestWakeLock = async () => {
    if ('wakeLock' in navigator) {
      try {
        const lock = await (navigator as any).wakeLock.request('screen');
        setWakeLockObj(lock);
        setWakeLockActive(true);
      } catch (err) {
        console.warn("Wake lock request failed:", err);
      }
    }
  };

  const releaseWakeLock = () => {
    if (wakeLockObj) {
      wakeLockObj.release();
      setWakeLockObj(null);
    }
    setWakeLockActive(false);
  };

  // Turn off wake lock when session finishes or component unmounts
  useEffect(() => {
    if (!activeSession && wakeLockActive) {
      releaseWakeLock();
    }
  }, [activeSession]);

  useEffect(() => {
    return () => {
      if (wakeLockObj) {
        wakeLockObj.release();
      }
    };
  }, [wakeLockObj]);

  // Haversine KM Calculation
  const totalKmToday = totalDistanceKm;

  // Mathematical "Tempo Parado Hoje" speed calculation
  // "Considerar parado when: velocidade estimada < 5 km/h for more than 3 minutes"
  const totalStoppedDurationMs = useMemo(() => {
    if (currentSessionPoints.length < 2) return 0;

    let totalDuration = 0;
    let runStart: number | null = null;
    let runEnd: number | null = null;

    for (let i = 1; i < currentSessionPoints.length; i++) {
      const p1 = currentSessionPoints[i - 1];
      const p2 = currentSessionPoints[i];

      const t1 = new Date(p1.recorded_at).getTime();
      const t2 = new Date(p2.recorded_at).getTime();
      const dtMs = t2 - t1;

      if (dtMs <= 0) continue;

      const dist = calculateHaversineDistance(p1.latitude, p1.longitude, p2.latitude, p2.longitude);
      const dtHours = dtMs / 3600000;
      const speedKmh = dist / dtHours;

      if (speedKmh < 5) {
        // We are stopped. Manage run sequence:
        if (runStart === null) {
          runStart = t1;
          runEnd = t2;
        } else {
          runEnd = t2;
        }
      } else {
        // We are moving. End current potential run and add if > 3 mins:
        if (runStart !== null && runEnd !== null) {
          const runLength = runEnd - runStart;
          if (runLength >= 3 * 60 * 1000) {
            totalDuration += runLength;
          }
        }
        runStart = null;
        runEnd = null;
      }
    }

    // Checking final open run
    if (runStart !== null && runEnd !== null) {
      const runLength = runEnd - runStart;
      if (runLength >= 3 * 60 * 1000) {
        totalDuration += runLength;
      }
    }

    return totalDuration;
  }, [currentSessionPoints]);

  // Convert stopped duration ms to readable format (Xh Ym)
  const formattedStoppedTime = useMemo(() => {
    const mins = Math.floor(totalStoppedDurationMs / (60 * 1000));
    const hrs = Math.floor(mins / 60);
    const remMins = mins % 60;

    if (hrs > 0) {
      return `${hrs}h ${remMins}min`;
    }
    return `${mins} min`;
  }, [totalStoppedDurationMs]);

  const handleStartTracking = async () => {
    await startSession();
    await requestWakeLock();
  };

  const handleStopTracking = async () => {
    if (!activeSession) return;
    
    // Tenta sincronizar todos os pontos pendentes
    const result = await telemetrySyncService.finalFlushBeforeEnd();
    if (result.pendingCount > 0) {
      const confirmEnd = window.confirm(
        `Ainda existem ${result.pendingCount} pontos aguardando sincronização. Deseja encerrar mesmo assim?`
      );
      if (!confirmEnd) {
        return; // Mantém a jornada e não finaliza
      }
    }

    // Estimate total minutes
    const runningTimeMinutes = Math.max(1, Math.round(
      (new Date().getTime() - new Date(activeSession.start_time).getTime()) / 60000
    ));

    await endSession(activeSession.id, totalKmToday, runningTimeMinutes);
    releaseWakeLock();
  };

  // Map sensor states to elegant ui descriptions
  const getGpsUiState = () => {
    switch (gpsStatus) {
      case 'GPS ativo':
        return {
          title: 'Sinal de Rastreamento Ativo',
          desc: 'Transmitindo coordenadas GPS reais em tempo real...',
          color: 'text-emerald-400',
          badgeBg: 'bg-emerald-950/40 text-emerald-400',
          dot: 'bg-emerald-500 animate-ping shadow-[0_0_8px_#10b981]',
          isError: false
        };
      case 'Aguardando permissão':
      case 'Solicitando primeira posição':
        return {
          title: 'Iniciando Rastreamento...',
          desc: 'Aguardando permissões ou primeira resposta do sensor...',
          color: 'text-yellow-400',
          badgeBg: 'bg-yellow-950/40 text-yellow-400',
          dot: 'bg-yellow-500 animate-pulse shadow-[0_0_8px_#f59e0b]',
          isError: false
        };
      case 'GPS sem sinal':
        return {
          title: 'Sinal de GPS Fraco ou Inativo',
          desc: 'Sem conexão com satélites ou sinal de dados temporariamente indisponível.',
          color: 'text-amber-500',
          badgeBg: 'bg-amber-950/40 text-amber-500',
          dot: 'bg-amber-500 animate-pulse shadow-[0_0_8px_#f59e0b]',
          isError: true
        };
      case 'GPS erro':
      case 'GPS negado':
        return {
          title: 'Problemas na Detecção (Erro)',
          desc: gpsError ? `Falha: ${gpsError.message}` : 'Verifique se a permissão de GPS está concedida no Chrome.',
          color: 'text-rose-400',
          badgeBg: 'bg-rose-950/40 text-rose-400',
          dot: 'bg-rose-500 animate-pulse shadow-[0_0_8px_#ef4444]',
          isError: true
        };
      default:
        return {
          title: 'Rastreamento em Espera',
          desc: 'Inicie a jornada para ativar a telemetria do GPS.',
          color: 'text-slate-400',
          badgeBg: 'bg-slate-950/40 text-slate-400',
          dot: 'bg-slate-600',
          isError: false
        };
    }
  };

  const gpsUi = getGpsUiState();

  return (
    <div className="space-y-6">
      {/* Title Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <Navigation className="w-6 h-6 text-purple-400 rotate-45" /> Jornada Inteligente
          </h1>
          <p className="text-xs text-slate-400">
            Rastreie o seu tempo ativo operacional, distância e tempo parado para otimizar seus custos em tempo real.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('/jornadas')}
            className="px-3.5 py-1.5 md:py-2 text-xs font-semibold bg-[#0d0926] border border-purple-950/45 text-purple-300 hover:text-white rounded-xl transition-all cursor-pointer flex items-center gap-1.5 select-none"
          >
            Ver Histórico
          </button>
          <button
            onClick={() => navigate('/debug')}
            className="px-3.5 py-1.5 md:py-2 text-xs font-semibold bg-[#0d0926] border border-purple-950/45 text-purple-300 hover:text-white rounded-xl transition-all cursor-pointer flex items-center gap-1.5 select-none"
          >
            Diagnóstico GPS
          </button>
        </div>
      </div>

      {/* Main Layout Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Tracker Panel (Left side / Large area) */}
        <div className="lg:col-span-2 space-y-6">
          <div className="p-6 md:p-8 rounded-3xl bg-[#0d0926]/90 border border-purple-950/30 shadow-[0_0_40px_rgba(76,29,149,0.1)] relative overflow-hidden flex flex-col items-center justify-center text-center min-h-[380px]">
            {/* Pulse effect if active */}
            {activeSession && (
              <div className="absolute inset-0 bg-radial-gradient from-purple-500/5 to-transparent pointer-events-none animate-pulse"></div>
            )}

            <AnimatePresence mode="wait">
              {!activeSession ? (
                // Standby mode UI
                <motion.div 
                  key="standby"
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  className="space-y-6 max-w-md w-full"
                >
                  <div className="mx-auto w-16 h-16 rounded-2xl bg-purple-950/40 border border-purple-800/40 flex items-center justify-center text-purple-400 shadow-[0_0_20px_rgba(168,85,247,0.15)]">
                    <Activity className="w-8 h-8" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-white mb-2">Pronto para rodar?</h2>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      Inicie sua jornada operacional para computar distâncias percorridas de forma passiva através de telemetria inteligente e automatizada por GPS real.
                    </p>
                  </div>

                  <button
                    onClick={handleStartTracking}
                    className="w-full py-4 rounded-2xl font-semibold bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-[0_4px_20px_rgba(147,51,234,0.3)] hover:shadow-[0_4px_30px_rgba(147,51,234,0.4)] transition-all cursor-pointer flex items-center justify-center gap-2"
                  >
                    <Play className="w-5 h-5 fill-current" /> Iniciar Jornada
                  </button>
                </motion.div>
              ) : (
                // Active mode UI
                <motion.div 
                  key="tracking-active"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="space-y-8 w-full max-w-xl"
                >
                  <div className="flex items-center justify-between border-b border-purple-950/40 pb-4">
                    <div className="flex items-center gap-3 text-left">
                      <span className="relative flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                      </span>
                      <div>
                        <h3 className="text-sm font-bold text-emerald-400 font-mono uppercase tracking-wider">Jornada Ativa</h3>
                        <p className="text-[11px] font-semibold text-purple-300 font-sans mt-0.5">
                          Status: <span className={
                            currentStatusLabel === 'Corrida em andamento' 
                              ? 'text-emerald-400 font-bold animate-pulse'
                              : currentStatusLabel === 'Parado/Esperando'
                                ? 'text-amber-400 font-bold'
                                : 'text-slate-300 font-bold'
                          }>{currentStatusLabel}</span>
                        </p>
                        <p className="text-[10px] text-slate-500 font-mono mt-0.5">ID: {activeSession.id}</p>
                      </div>
                    </div>

                    {wakeLockActive && (
                      <span className="text-[10px] bg-purple-950/80 text-purple-300 font-mono font-medium px-2 py-1 rounded-md border border-purple-900/30 flex items-center gap-1.5">
                        <Flame className="w-3.5 h-3.5 text-purple-400" /> Manter Tela Ligada
                      </span>
                    )}
                  </div>

                  {/* Active Timer and Metrics */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
                    <div className="space-y-1">
                      <span className="text-[10px] tracking-widest font-mono uppercase text-slate-500">Tempo de Corrida</span>
                      <div className="text-5xl font-mono font-semibold tracking-tight text-white bg-clip-text">
                        {elapsedTime}
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-[#08051a] p-4 rounded-2xl border border-purple-950/20 text-center">
                        <span className="text-[10px] text-slate-500 block mb-1 font-mono uppercase">Distância</span>
                        <span className="text-2xl font-bold font-mono text-purple-400">{totalKmToday} km</span>
                      </div>
                      <div className="bg-[#08051a] p-4 rounded-2xl border border-purple-950/20 text-center">
                        <span className="text-[10px] text-slate-500 block mb-1 font-mono uppercase">Minutos Parado</span>
                        <span className="text-lg font-bold font-mono text-amber-500">{formattedStoppedTime}</span>
                      </div>
                    </div>
                  </div>

                  {/* Geolocation Telemetry status pill */}
                  <div className="p-4 rounded-2xl bg-[#09051d] border border-purple-950/30 flex items-center justify-between text-left">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-xl ${gpsUi.isError ? 'bg-rose-950/40 text-rose-400' : 'bg-purple-950/60 text-purple-400'} flex items-center justify-center`}>
                        <Compass className={`w-5 h-5 ${gpsStatus === 'GPS ativo' ? 'animate-spin' : ''}`} style={{ animationDuration: '4s' }} />
                      </div>
                      <div>
                        <p className={`text-xs font-bold ${gpsUi.isError ? 'text-rose-400' : 'text-[#e1e1e6]'}`}>{gpsUi.title}</p>
                        <p className="text-[10px] text-slate-400 font-mono mt-0.5">{gpsUi.desc}</p>
                      </div>
                    </div>

                    <span className="text-[10px] font-mono font-semibold text-slate-500 bg-purple-950/10 px-2.5 py-1 rounded">
                      {currentSessionPoints.length} Posições
                    </span>
                  </div>

                  {/* Pending AI Feedback Card */}
                  {pendingFeedbackEventId && (
                    <motion.div 
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-4 bg-gradient-to-r from-purple-950/85 to-indigo-950/85 border border-purple-500/40 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3 text-left shadow-[0_4px_15px_rgba(147,51,234,0.15)] animate-pulse"
                    >
                      <div className="flex items-center gap-2.5">
                        <Bot className="w-5 h-5 text-purple-400" />
                        <div>
                          <h4 className="text-xs font-bold text-white">Corrida Iniciada Automaticamente</h4>
                          <p className="text-[10px] text-slate-300">
                            A IA detectou uma corrida com {aiState?.confidenceScore || 96}% de precisão. Está correto?
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 w-full sm:w-auto shrink-0 justify-end">
                        <button
                          onClick={() => handleAIFeedback(true)}
                          className="flex-1 sm:flex-initial px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-[10px] flex items-center justify-center gap-1 select-none cursor-pointer transition-all"
                        >
                          <Check className="w-3 h-3" /> Sim, confirmar
                        </button>
                        <button
                          onClick={() => handleAIFeedback(false)}
                          className="flex-1 sm:flex-initial px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-semibold text-[10px] flex items-center justify-center gap-1 select-none cursor-pointer transition-all"
                        >
                          <X className="w-3 h-3" /> Não, redefinir
                        </button>
                      </div>
                    </motion.div>
                  )}

                  {/* Manual Override Status Banner */}
                  {manualOverride && (
                    <div className="p-3 bg-slate-900/40 border border-slate-800 rounded-2xl flex items-center justify-between text-left">
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-amber-400 animate-spin" style={{ animationDuration: '3s' }} />
                        <span className="text-[10px] font-semibold text-slate-300 font-sans">
                          Override manual ativo. A IA respeitará suas ações.
                        </span>
                      </div>
                      <button
                        onClick={handleResetOverride}
                        className="px-2 py-1 bg-purple-950/30 hover:bg-purple-950/60 text-purple-300 text-[9px] font-bold rounded-lg border border-purple-900/30 cursor-pointer select-none transition-all"
                      >
                        Ativar Modo Automático
                      </button>
                    </div>
                  )}

                  {/* Active Ride/Mileage Classification Buttons (Phase 6) */}
                  <div className="grid grid-cols-2 gap-4 bg-[#08051a] p-4 rounded-2xl border border-purple-950/20">
                    <button
                      onClick={handleAcceptRide}
                      disabled={isRideActive}
                      className={`py-3 px-4 rounded-xl font-bold text-xs transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                        isRideActive 
                          ? 'bg-slate-900/50 border border-slate-800 text-slate-600 cursor-not-allowed opacity-50'
                          : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-[0_2px_10px_rgba(16,185,129,0.25)]'
                      }`}
                    >
                      Aceitei corrida
                    </button>
                    <button
                      onClick={handleFinishRide}
                      disabled={!isRideActive}
                      className={`py-3 px-4 rounded-xl font-bold text-xs transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                        !isRideActive 
                          ? 'bg-slate-900/50 border border-slate-800 text-slate-600 cursor-not-allowed opacity-50'
                          : 'bg-amber-600 hover:bg-amber-500 text-white shadow-[0_2px_10px_rgba(245,158,11,0.25)]'
                      }`}
                    >
                      Finalizar corrida
                    </button>
                  </div>

                  {/* AI Prediction Confidence Badge and classification explanation inside active tracker */}
                  {aiState && (
                    <div className="p-4 rounded-2xl bg-[#09051d] border border-purple-950/30 text-left space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] tracking-widest font-mono uppercase text-slate-500 flex items-center gap-1.5">
                          <Bot className="w-3.5 h-3.5 text-purple-400" /> Smart Ride Detection
                        </span>
                        
                        <span className={`text-[9px] font-bold font-mono px-2.5 py-0.5 rounded-full ${
                          aiState.confidenceScore >= 95 
                            ? 'bg-emerald-950/40 text-emerald-400 border border-emerald-800/40 shadow-[0_0_8px_rgba(16,185,129,0.15)]'
                            : aiState.confidenceScore >= 70
                              ? 'bg-amber-950/40 text-amber-400 border border-amber-800/40 shadow-[0_0_8px_rgba(245,158,11,0.15)]'
                              : aiState.confidenceScore >= 50
                                ? 'bg-blue-950/40 text-blue-400 border border-blue-800/40'
                                : 'bg-slate-950/40 text-slate-400 border border-slate-800/40'
                        }`}>
                          {aiState.confidenceScore}% - {
                            aiState.confidenceScore >= 95 
                              ? 'Detectado automaticamente' 
                              : aiState.confidenceScore >= 70
                                ? 'Provável corrida'
                                : aiState.confidenceScore >= 50
                                  ? 'Sugestão'
                                  : 'Não classificar'
                          }
                        </span>
                      </div>
                      <div className="p-3 bg-[#060315] rounded-xl border border-purple-950/15">
                        <p className="text-[11px] text-purple-300 font-sans font-medium">Motivo:</p>
                        <p className="text-xs text-slate-300 mt-0.5 leading-relaxed">{aiState.reason}</p>
                      </div>
                    </div>
                  )}

                  {/* AI Ride Accuracy Dashboard */}
                  <div className="p-5 bg-gradient-to-br from-[#0b0821] to-[#0d092b] border border-purple-950/25 rounded-2xl space-y-4 text-left">
                    <h4 className="text-xs font-bold uppercase font-mono tracking-wider text-purple-400 flex items-center gap-2">
                      <Gauge className="w-4 h-4 text-purple-400" /> Precisão e Performance da IA
                    </h4>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="bg-[#050310] p-3 rounded-xl border border-purple-950/10 text-center">
                        <span className="text-[9px] text-slate-500 block font-mono uppercase">Precisão IA</span>
                        <span className="text-base font-bold font-mono text-emerald-400">{aiStats.accuracyRate}%</span>
                      </div>
                      <div className="bg-[#050310] p-3 rounded-xl border border-purple-950/10 text-center">
                        <span className="text-[9px] text-slate-500 block font-mono uppercase">Automáticas</span>
                        <span className="text-base font-bold font-mono text-purple-400">{aiStats.autoDetectedCount}</span>
                      </div>
                      <div className="bg-[#050310] p-3 rounded-xl border border-purple-950/10 text-center">
                        <span className="text-[9px] text-slate-500 block font-mono uppercase">Confirmadas</span>
                        <span className="text-base font-bold font-mono text-indigo-400">{aiStats.manuallyConfirmedCount}</span>
                      </div>
                      <div className="bg-[#050310] p-3 rounded-xl border border-purple-950/10 text-center">
                        <span className="text-[9px] text-slate-500 block font-mono uppercase font-semibold">Taxa de Acerto</span>
                        <span className="text-base font-bold font-mono text-amber-500">
                          {aiStats.totalRideCount > 0 ? ((aiStats.autoDetectedCount / aiStats.totalRideCount) * 100).toFixed(0) : '100'}%
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* AI Real-Time Debug & Logs Panel */}
                  <div className="p-5 bg-[#050310] border border-purple-950/20 rounded-2xl space-y-3 text-left font-mono text-[11px]">
                    <div className="flex items-center justify-between border-b border-purple-950/35 pb-2">
                      <span className="text-purple-400 flex items-center gap-1.5 font-bold uppercase tracking-wider text-[10px]">
                        <Terminal className="w-4 h-4 animate-pulse" /> [Debug] Smart Ride Logs
                      </span>
                      <span className="text-[9px] text-slate-500">Filtro: [RideAI]</span>
                    </div>

                    {/* Features checklist */}
                    {aiState && (
                      <div className="grid grid-cols-2 gap-2 text-[10px] text-slate-400 pb-2 border-b border-purple-950/20">
                        <div>
                          <p className="text-slate-500 font-bold">Eventos Detectados:</p>
                          <ul className="list-disc pl-3 mt-1 space-y-0.5">
                            {aiState.detectedEvents.length === 0 ? (
                              <li>Aguardando evento...</li>
                            ) : (
                              aiState.detectedEvents.map((ev, i) => (
                                <li key={i} className="text-emerald-400">{ev}</li>
                              ))
                            )}
                          </ul>
                        </div>
                        <div>
                          <p className="text-slate-500 font-bold font-mono">Eventos Manuais:</p>
                          <ul className="list-disc pl-3 mt-1 space-y-0.5">
                            {aiState.manualEvents.length === 0 ? (
                              <li>Nenhuma ação</li>
                            ) : (
                              aiState.manualEvents.map((ev, i) => (
                                <li key={i} className="text-purple-400">{ev}</li>
                              ))
                            )}
                          </ul>
                        </div>
                      </div>
                    )}

                    {/* Console log outputs */}
                    <div className="max-h-[120px] overflow-y-auto space-y-1 pr-1 custom-scrollbar text-[10px]">
                      {aiLogs.length === 0 ? (
                        <p className="text-slate-600">Aguardando telemetria inicial do GPS...</p>
                      ) : (
                        aiLogs.slice().reverse().map((log, i) => (
                          <div key={i} className="leading-relaxed border-l-2 border-purple-900 pl-1.5 py-0.5 text-slate-300 text-left">
                            {log}
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  <button
                    onClick={handleStopTracking}
                    className="w-full py-4 rounded-2xl font-semibold bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 text-white shadow-[0_4px_2px_rgba(225,29,72,0.1)] transition-all cursor-pointer flex items-center justify-center gap-2"
                  >
                    <Square className="w-4 h-4 fill-current" /> Finalizar Jornada Monetizada
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Info & Session History Panel (Right side) */}
        <div className="space-y-6">
          
          {/* Active Status Alerts warnings */}
          {gpsUi.isError && (
            <div className="p-5 rounded-2xl bg-rose-950/20 border border-rose-900/30 text-rose-200 flex items-start gap-3">
              <ShieldAlert className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-xs font-bold text-white">Anomalia de Telemetria</h4>
                <p className="text-[11px] text-rose-300 leading-relaxed mt-1">
                  Não foi possível obter uma leitura de sinal GPS válida. {gpsUi.desc} Ative o "Local Exato" nas configurações do Chrome se estiver no celular Android/iOS.
                </p>
              </div>
            </div>
          )}

          {/* Guidelines info card */}
          <div className="p-5 rounded-2xl bg-[#09061d] border border-purple-950/25 space-y-4">
            <h3 className="text-xs font-bold uppercase font-mono tracking-wider text-purple-400 flex items-center gap-2">
              <Info className="w-4 h-4" /> Instruções de Uso
            </h3>
            
            <ul className="space-y-3 text-xs text-slate-400 leading-relaxed list-none pl-0">
              <li className="flex items-start gap-2">
                <span className="text-purple-500 shrink-0 font-bold">•</span>
                <span>O sistema economiza bateria capturando de forma real por telemetria baseada em variação de deslocamento no navegador de maneira inteligente.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-purple-500 shrink-0 font-bold">•</span>
                <span><strong>Segurança de Tela:</strong> A opção "Manter Tela Ligada" evita o congelamento das execuções em aparelhos Android e iOS.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-purple-500 shrink-0 font-bold">•</span>
                <span>O cálculo de velocidade é dinâmico. Se a velocidade estiver abaixo de 5 km/h por mais de 3 minutos, calcula-se automaticamente o tempo parado de forma retroativa.</span>
              </li>
            </ul>
          </div>

          {/* Session logs summary */}
          <div className="p-5 rounded-2xl bg-[#0d0926]/40 border border-purple-950/25 space-y-4">
            <h3 className="text-xs font-bold uppercase font-mono tracking-wider text-slate-400 flex items-center justify-between">
              Como foi hoje <span>Últimos logs</span>
            </h3>

            {driverSessions.length === 0 ? (
              <div className="text-center py-4 text-xs text-slate-500">
                Nenhuma corrida ou jornada registrada ainda.
              </div>
            ) : (
              <div className="space-y-3 font-mono">
                {driverSessions.slice(0, 4).map((sess, idx) => (
                  <div key={sess.id || idx} className="p-3 bg-[#0d0926] rounded-xl border border-purple-950/10 flex items-center justify-between">
                    <div>
                      <p className="text-[11px] text-white font-sans font-bold">
                        {sess.status === 'active' ? '🟢 Rodando...' : '🏁 Concluída'}
                      </p>
                      <span className="text-[9px] text-slate-500">
                        {new Date(sess.start_time).toLocaleDateString('pt-BR')} às {new Date(sess.start_time).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    <div className="text-right">
                      <p className="text-xs font-bold text-purple-400">
                        {sess.total_distance_km ? sess.total_distance_km.toFixed(1) : '0.0'} KM
                      </p>
                      <p className="text-[9px] text-slate-500">
                        {sess.total_duration_minutes || 0} min total
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

      </div>

    </div>
  );
};
