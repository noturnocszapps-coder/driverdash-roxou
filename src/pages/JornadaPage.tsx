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
  Bot, Sparkles, ThumbsUp, ThumbsDown, Gauge, TrendingUp, Terminal, Check, X,
  ChevronRight, ChevronDown, Signal
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
import { calculateCostPerKmEstimate } from '../modules/vehicle/vehicle.calculations';

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
    totalDistanceKm,
    vehicle,
    vehicleCostSettings,
    earnings,
    profile
  } = useApp();

  const [elapsedTime, setElapsedTime] = useState<string>('00:00:00');
  const [wakeLockActive, setWakeLockActive] = useState(false);
  const [wakeLockObj, setWakeLockObj] = useState<any | null>(null);

  const [isInstructionsOpen, setIsInstructionsOpen] = useState(false);

  // Hidden title click developer toggler
  const [clickCount, setClickCount] = useState(0);
  const [debugMode, setDebugMode] = useState(() => localStorage.getItem('driverdash_debug_mode') === 'true');

  const handleTitleClick = () => {
    setClickCount(prev => {
      const next = prev + 1;
      if (next >= 5) {
        const nextMode = !debugMode;
        setDebugMode(nextMode);
        localStorage.setItem('driverdash_debug_mode', nextMode ? 'true' : 'false');
        addSmartAlert?.({
          title: nextMode ? 'Modo Diagnóstico Ativado 🛠️' : 'Modo Diagnóstico Desativado 🤫',
          description: nextMode 
            ? 'Você agora pode ver as telemetrias e logs em tempo real da IA.'
            : 'Os logs e indicadores técnicos foram ocultados.',
          type: 'profit',
          severity: 'low'
        });
        return 0;
      }
      return next;
    });
  };

  const isAdmin = profile?.role === 'admin' || debugMode;

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

  // Status Label logic conforming to requested commercial states: Offline, Online aguardando corrida, Em deslocamento, Em corrida, Pausado
  const currentStatusLabel = useMemo(() => {
    if (!activeSession) return 'Offline';
    if (isRideActive) {
      return 'Em corrida';
    }
    const isStopped = lastCoord ? lastCoord.speed === 0 : true;
    if (isStopped) {
      return 'Online aguardando corrida';
    }
    return 'Em deslocamento';
  }, [activeSession, isRideActive, lastCoord]);

  // GPS signal quality computation
  const gpsAccuracy = lastCoord?.accuracy;
  const gpsSignalQuality = useMemo(() => {
    if (gpsStatus === 'GPS erro' || gpsStatus === 'GPS negado' || gpsError) {
      return { label: 'Sem sinal', color: 'text-rose-500', bg: 'bg-rose-950/30 border border-rose-900/30' };
    }
    if (!gpsAccuracy) {
      return { label: 'Sem sinal', color: 'text-slate-500', bg: 'bg-slate-900/30 border border-slate-800/40' };
    }
    if (gpsAccuracy <= 15) {
      return { label: 'Excelente', color: 'text-emerald-400', bg: 'bg-emerald-950/30 border border-emerald-800/30' };
    }
    if (gpsAccuracy <= 30) {
      return { label: 'Boa', color: 'text-green-400', bg: 'bg-green-950/30 border border-green-800/30' };
    }
    if (gpsAccuracy <= 60) {
      return { label: 'Fraca', color: 'text-amber-400', bg: 'bg-amber-950/30 border border-amber-800/30' };
    }
    return { label: 'Sem sinal', color: 'text-rose-500', bg: 'bg-rose-950/30 border border-rose-900/30' };
  }, [gpsAccuracy, gpsStatus, gpsError]);

  // Active session indicators calculation (Tempo online, KM rodados, Corridas realizadas, Ganhos informados, Custo estimado, Lucro estimado)
  const activeMetrics = useMemo(() => {
    if (!activeSession) return null;
    const activeSessionDateStr = new Date(activeSession.start_time).toISOString().substring(0, 10);
    const dayEarnings = (earnings || []).filter(e => e.date === activeSessionDateStr);
    const totalEarningsVal = dayEarnings.reduce((acc, curr) => acc + Number(curr.gross_amount || 0), 0);

    const costPerKm = calculateCostPerKmEstimate(vehicle, vehicleCostSettings) || 0.45;
    const totalCostVal = totalDistanceKm * costPerKm;
    const netProfitVal = totalEarningsVal - totalCostVal;

    return {
      tempoOnline: elapsedTime,
      kmRodados: `${totalDistanceKm.toFixed(1)} km`,
      corridasRealizadas: `${aiStats.totalRideCount} ${aiStats.totalRideCount === 1 ? 'corrida' : 'corridas'}`,
      ganhosVal: totalEarningsVal,
      custoVal: totalCostVal,
      lucroVal: netProfitVal,
      hasEarnings: totalEarningsVal > 0
    };
  }, [activeSession, earnings, vehicle, vehicleCostSettings, totalDistanceKm, elapsedTime, aiStats]);

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
        <div className="text-left">
          <h1 
            onClick={handleTitleClick}
            className="text-2xl font-bold tracking-tight text-white flex items-center gap-2 cursor-pointer select-none active:scale-95 transition-transform"
          >
            <Navigation className="w-6 h-6 text-purple-400 rotate-45" /> Assistente Inteligente
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
          {isAdmin && (
            <button
              onClick={() => navigate('/debug')}
              className="px-3.5 py-1.5 md:py-2 text-xs font-semibold bg-[#0d0926] border border-purple-950/45 text-purple-300 hover:text-white rounded-xl transition-all cursor-pointer flex items-center gap-1.5 select-none"
            >
              Diagnóstico GPS
            </button>
          )}
        </div>
      </div>

      {/* Top Indicators / Active Metrics Grid */}
      {activeSession && activeMetrics && (
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
          <div className="bg-[#0c0827] border border-purple-950/40 p-3.5 rounded-2xl text-left">
            <span className="text-[9px] text-slate-500 font-bold block uppercase tracking-wider">Tempo online</span>
            <span className="text-sm font-extrabold text-white font-mono block mt-1">{activeMetrics.tempoOnline}</span>
          </div>
          <div className="bg-[#0c0827] border border-purple-950/40 p-3.5 rounded-2xl text-left">
            <span className="text-[9px] text-slate-500 font-bold block uppercase tracking-wider">KM rodados</span>
            <span className="text-sm font-extrabold text-purple-400 font-mono block mt-1">{activeMetrics.kmRodados}</span>
          </div>
          <div className="bg-[#0c0827] border border-purple-950/40 p-3.5 rounded-2xl text-left">
            <span className="text-[9px] text-slate-500 font-bold block uppercase tracking-wider">Corridas</span>
            <span className="text-sm font-extrabold text-indigo-400 font-mono block mt-1">{activeMetrics.corridasRealizadas}</span>
          </div>
          <div className="bg-[#0c0827] border border-purple-950/40 p-3.5 rounded-2xl text-left">
            <span className="text-[9px] text-slate-500 font-bold block uppercase tracking-wider">Ganhos informados</span>
            <span className="text-sm font-extrabold text-emerald-400 font-mono block mt-1">
              {activeMetrics.hasEarnings ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(activeMetrics.ganhosVal) : 'R$ 0,00'}
            </span>
          </div>
          <div className="bg-[#0c0827] border border-purple-950/40 p-3.5 rounded-2xl text-left">
            <span className="text-[9px] text-slate-500 font-bold block uppercase tracking-wider">Custo estimado</span>
            <span className="text-sm font-extrabold text-rose-400 font-mono block mt-1">
              {activeMetrics.custoVal > 0 ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(activeMetrics.custoVal) : 'R$ 0,00'}
            </span>
          </div>
          <div className="bg-[#0c0827] border border-purple-950/40 p-3.5 rounded-2xl text-left">
            <span className="text-[9px] text-slate-500 font-bold block uppercase tracking-wider">Lucro estimado</span>
            <span className={`text-sm font-extrabold font-mono block mt-1 ${activeMetrics.hasEarnings ? (activeMetrics.lucroVal >= 0 ? 'text-emerald-400' : 'text-rose-400') : 'text-slate-500'}`}>
              {activeMetrics.hasEarnings ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(activeMetrics.lucroVal) : '—'}
            </span>
          </div>
        </div>
      )}

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
                      Inicie sua jornada operacional para computar distâncias percorridas de forma passiva através de rastreamento inteligente e automatizado por GPS real.
                    </p>
                  </div>

                  <button
                    onClick={handleStartTracking}
                    className="w-full py-4 rounded-2xl font-semibold bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-[0_4px_20px_rgba(147,51,234,0.3)] hover:shadow-[0_4px_30px_rgba(147,51,234,0.4)] transition-all cursor-pointer flex items-center justify-center gap-2 select-none"
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
                  className="space-y-6 w-full max-w-xl"
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
                            currentStatusLabel === 'Em corrida' 
                              ? 'text-emerald-400 font-bold animate-pulse'
                              : currentStatusLabel === 'Online aguardando corrida'
                                ? 'text-amber-400 font-bold'
                                : 'text-slate-300 font-bold'
                          }>{currentStatusLabel}</span>
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Active Timer and Metrics */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
                    <div className="space-y-1 text-left">
                      <span className="text-[10px] tracking-widest font-mono uppercase text-slate-500">Tempo de Corrida</span>
                      <div className="text-5xl font-mono font-semibold tracking-tight text-white">
                        {elapsedTime}
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-[#08051a] p-4 rounded-2xl border border-purple-950/20 text-center">
                        <span className="text-[10px] text-slate-500 block mb-1 font-mono uppercase select-none">Distância</span>
                        <span className="text-2xl font-bold font-mono text-purple-400">{totalDistanceKm.toFixed(1)} km</span>
                      </div>
                      <div className="bg-[#08051a] p-4 rounded-2xl border border-purple-950/20 text-center">
                        <span className="text-[10px] text-slate-500 block mb-1 font-mono uppercase select-none">Minutos Parado</span>
                        <span className="text-lg font-bold font-mono text-amber-500">{formattedStoppedTime}</span>
                      </div>
                    </div>
                  </div>

                  {/* Geolocation status and GPS Signal Quality */}
                  <div className="p-4 rounded-2xl bg-[#09051d] border border-purple-950/30 flex flex-col sm:flex-row sm:items-center justify-between text-left gap-3">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-xl ${gpsUi.isError ? 'bg-rose-950/40 text-rose-400' : 'bg-purple-950/60 text-purple-400'} flex items-center justify-center`}>
                        <Compass className={`w-5 h-5 ${gpsStatus === 'GPS ativo' ? 'animate-spin' : ''}`} style={{ animationDuration: '4s' }} />
                      </div>
                      <div>
                        <p className={`text-xs font-bold ${gpsUi.isError ? 'text-rose-400' : 'text-[#e1e1e6]'}`}>{gpsUi.title}</p>
                        <p className="text-[10px] text-slate-400 font-mono mt-0.5">{gpsUi.desc}</p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`text-[10px] font-mono font-semibold px-2.5 py-1 rounded-md flex items-center gap-1 ${gpsSignalQuality.bg} ${gpsSignalQuality.color}`}>
                        <Signal className="w-3 h-3" /> Sinal: {gpsSignalQuality.label} {gpsAccuracy ? `(±${gpsAccuracy.toFixed(0)}m)` : ''}
                      </span>
                      <span className="text-[10px] font-mono font-semibold text-slate-400 bg-purple-950/10 px-2.5 py-1 rounded">
                        {currentSessionPoints.length} Posições
                      </span>
                    </div>
                  </div>

                  {/* Pending AI Feedback Card */}
                  {pendingFeedbackEventId && (
                    <motion.div 
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-4 bg-gradient-to-r from-purple-950/85 to-indigo-950/85 border border-purple-500/40 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3 text-left shadow-[0_4px_15px_rgba(147,51,234,0.15)]"
                    >
                      <div className="flex items-center gap-2.5">
                        <Bot className="w-5 h-5 text-purple-400 animate-pulse" />
                        <div>
                          <h4 className="text-xs font-bold text-white">Viagem Detectada</h4>
                          <p className="text-[10px] text-slate-300">
                            O Assistente de Corridas identificou o início de uma viagem operacional. Confirmar início?
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
                    <div className="p-3 bg-[#0c0827] border border-purple-950/20 rounded-2xl flex items-center justify-between text-left gap-2">
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-amber-400" />
                        <span className="text-[10px] font-semibold text-slate-300 font-sans">
                          Modo manual ativo. O Assistente respeitará suas ações.
                        </span>
                      </div>
                      <button
                        onClick={handleResetOverride}
                        className="px-2.5 py-1 bg-purple-950/30 hover:bg-purple-950/60 text-purple-300 text-[9px] font-bold rounded-lg border border-purple-900/30 cursor-pointer select-none transition-all shrink-0"
                      >
                        Ativar Modo Automático
                      </button>
                    </div>
                  )}

                  {/* Button Flow: Iniciar, Aceitar Corrida/Finalizar Corrida, Encerrar Jornada */}
                  <div className="flex flex-col sm:flex-row gap-3 w-full pt-2">
                    {!isRideActive ? (
                      <button
                        onClick={handleAcceptRide}
                        className="flex-1 py-4 rounded-2xl font-semibold bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white shadow-[0_4px_15px_rgba(16,185,129,0.25)] hover:shadow-[0_4px_25px_rgba(16,185,129,0.35)] transition-all cursor-pointer flex items-center justify-center gap-2 select-none"
                      >
                        <Play className="w-4 h-4 fill-current" /> Aceitar Corrida
                      </button>
                    ) : (
                      <button
                        onClick={handleFinishRide}
                        className="flex-1 py-4 rounded-2xl font-semibold bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white shadow-[0_4px_15px_rgba(245,158,11,0.25)] hover:shadow-[0_4px_25px_rgba(245,158,11,0.35)] transition-all cursor-pointer flex items-center justify-center gap-2 select-none"
                      >
                        <Square className="w-4 h-4 fill-current" /> Finalizar Corrida
                      </button>
                    )}

                    <button
                      onClick={handleStopTracking}
                      className="py-4 px-6 rounded-2xl font-semibold bg-rose-950/20 hover:bg-rose-900/30 text-rose-400 hover:text-rose-300 border border-rose-950/40 transition-all cursor-pointer flex items-center justify-center gap-2 select-none"
                    >
                      <X className="w-4 h-4" /> Encerrar Jornada
                    </button>
                  </div>

                  {/* AI Ride Accuracy Dashboard */}
                  {aiStats.totalRideCount === 0 ? (
                    <div className="p-5 bg-[#09051d]/60 border border-purple-950/25 rounded-2xl text-left space-y-2">
                      <h4 className="text-xs font-bold uppercase font-mono tracking-wider text-purple-400 flex items-center gap-2 select-none">
                        <Bot className="w-4 h-4 text-purple-400" /> Assistente de Corridas
                      </h4>
                      <p className="text-xs text-slate-300 leading-relaxed">
                        Ainda estamos aprendendo seus padrões de direção. As estatísticas aparecerão após algumas jornadas reais.
                      </p>
                    </div>
                  ) : (
                    <div className="p-5 bg-[#09051d]/60 border border-purple-950/25 rounded-2xl space-y-4 text-left">
                      <h4 className="text-xs font-bold uppercase font-mono tracking-wider text-purple-400 flex items-center gap-2 select-none">
                        <Gauge className="w-4 h-4 text-purple-400" /> Precisão e Performance da IA
                      </h4>
                      
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div className="bg-[#050310] p-3 rounded-xl border border-purple-950/10 text-center">
                          <span className="text-[9px] text-slate-500 block font-mono uppercase select-none">Confiança IA</span>
                          <span className="text-base font-bold font-mono text-emerald-400">{aiStats.accuracyRate}%</span>
                        </div>
                        <div className="bg-[#050310] p-3 rounded-xl border border-purple-950/10 text-center">
                          <span className="text-[9px] text-slate-500 block font-mono uppercase select-none">Automáticas</span>
                          <span className="text-base font-bold font-mono text-purple-400">{aiStats.autoDetectedCount}</span>
                        </div>
                        <div className="bg-[#050310] p-3 rounded-xl border border-purple-950/10 text-center">
                          <span className="text-[9px] text-slate-500 block font-mono uppercase select-none font-semibold">Confirmadas</span>
                          <span className="text-base font-bold font-mono text-indigo-400">{aiStats.manuallyConfirmedCount}</span>
                        </div>
                        <div className="bg-[#050310] p-3 rounded-xl border border-purple-950/10 text-center">
                          <span className="text-[9px] text-slate-500 block font-mono uppercase select-none">Taxa Acerto</span>
                          <span className="text-base font-bold font-mono text-amber-500">
                            {aiStats.totalRideCount > 0 ? ((aiStats.autoDetectedCount / aiStats.totalRideCount) * 100).toFixed(0) : '100'}%
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* AI Real-Time Debug & Logs Panel (Only for admins/debuggers) */}
                  {isAdmin && (
                    <div className="p-5 bg-[#050310] border border-purple-950/20 rounded-2xl space-y-3 text-left font-mono text-[11px]">
                      <div className="flex items-center justify-between border-b border-purple-950/35 pb-2">
                        <span className="text-purple-400 flex items-center gap-1.5 font-bold uppercase tracking-wider text-[10px]">
                          <Terminal className="w-4 h-4 animate-pulse" /> [Debug] Diagnóstico Interno
                        </span>
                        <span className="text-[9px] text-slate-500">Filtro: [RideAI]</span>
                      </div>

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
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Info & Session History Panel (Right side) */}
        <div className="space-y-6">
          
          {/* Active Status Alerts warnings */}
          {gpsUi.isError && (
            <div className="p-5 rounded-2xl bg-rose-950/20 border border-rose-900/30 text-rose-200 flex items-start gap-3 text-left">
              <ShieldAlert className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-xs font-bold text-white">Anomalia de Telemetria</h4>
                <p className="text-[11px] text-rose-300 leading-relaxed mt-1">
                  Não foi possível obter uma leitura de sinal GPS válida. {gpsUi.desc} Ative o "Local Exato" nas configurações do Chrome se estiver no celular Android/iOS.
                </p>
              </div>
            </div>
          )}

          {/* Manter Tela Ligada Switch Card */}
          <div className="flex items-center justify-between p-4 rounded-2xl bg-[#09051d] border border-purple-950/25 text-left w-full">
            <div className="space-y-0.5">
              <span className="text-xs font-semibold text-white flex items-center gap-1.5 select-none">
                <Flame className={`w-4 h-4 ${wakeLockActive ? 'text-purple-400 animate-pulse' : 'text-slate-400'}`} />
                Manter Tela Ligada
              </span>
              <p className="text-[10px] text-slate-400 leading-normal">
                Evita que a tela apague durante a jornada.
              </p>
            </div>
            <button
              onClick={async () => {
                if (wakeLockActive) {
                  await releaseWakeLock();
                } else {
                  await requestWakeLock();
                }
              }}
              className={`w-11 h-6 rounded-full p-1 transition-colors duration-200 focus:outline-none cursor-pointer ${
                wakeLockActive ? 'bg-purple-600' : 'bg-slate-800'
              }`}
            >
              <div
                className={`bg-white w-4 h-4 rounded-full shadow-md transform duration-200 ease-in-out ${
                  wakeLockActive ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Collapsible Guidelines info card */}
          <div className="p-4 rounded-2xl bg-[#09061d] border border-purple-950/25">
            <button 
              onClick={() => setIsInstructionsOpen(!isInstructionsOpen)}
              className="w-full flex items-center justify-between text-left text-xs font-bold uppercase font-mono tracking-wider text-purple-400 focus:outline-none"
            >
              <span className="flex items-center gap-2">
                <Info className="w-4 h-4" /> Como funciona o rastreamento?
              </span>
              <motion.span
                animate={{ rotate: isInstructionsOpen ? 180 : 0 }}
                transition={{ duration: 0.2 }}
                className="text-purple-400 flex items-center"
              >
                <ChevronDown className="w-4 h-4" />
              </motion.span>
            </button>
            
            <AnimatePresence>
              {isInstructionsOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0, marginTop: 0 }}
                  animate={{ height: 'auto', opacity: 1, marginTop: 12 }}
                  exit={{ height: 0, opacity: 0, marginTop: 0 }}
                  className="overflow-hidden space-y-3 text-xs text-slate-400 leading-relaxed text-left"
                >
                  <p className="flex items-start gap-2">
                    <span className="text-purple-500 shrink-0 font-bold">•</span>
                    <span>O sistema economiza bateria capturando de forma real por rastreamento baseado em variação de deslocamento no navegador de maneira inteligente.</span>
                  </p>
                  <p className="flex items-start gap-2">
                    <span className="text-purple-500 shrink-0 font-bold">•</span>
                    <span><strong>Segurança de Tela:</strong> A opção "Manter Tela Ligada" evita o congelamento das execuções em aparelhos Android e iOS.</span>
                  </p>
                  <p className="flex items-start gap-2">
                    <span className="text-purple-500 shrink-0 font-bold">•</span>
                    <span>O cálculo de velocidade é dinâmico. Se a velocidade estiver abaixo de 5 km/h por mais de 3 minutos, calcula-se automaticamente o tempo parado de forma retroativa.</span>
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Session logs summary */}
          <div className="p-5 rounded-2xl bg-[#0d0926]/40 border border-purple-950/25 space-y-4 text-left">
            <h3 className="text-xs font-bold uppercase font-mono tracking-wider text-slate-400 flex items-center justify-between select-none">
              Como foi hoje <span className="text-[10px] text-purple-400 font-normal lowercase font-sans">Histórico recente</span>
            </h3>

            {driverSessions.length === 0 ? (
              <div className="text-center py-4 text-xs text-slate-500 select-none">
                Nenhuma jornada registrada ainda.
              </div>
            ) : (
              <div className="space-y-3 font-mono">
                {driverSessions.slice(0, 4).map((sess, idx) => {
                  const isSessionCancelled = sess.status === 'completed' && (sess.total_distance_km || 0) === 0 && (sess.total_duration_minutes || 0) < 3;
                  
                  return (
                    <div key={sess.id || idx} className="p-3 bg-[#0d0926] rounded-xl border border-purple-950/10 flex items-center justify-between gap-3 text-left">
                      <div>
                        <p className={`text-[11px] font-sans font-bold ${
                          sess.status === 'active' 
                            ? 'text-emerald-400 animate-pulse' 
                            : isSessionCancelled 
                              ? 'text-rose-400' 
                              : 'text-purple-300'
                        }`}>
                          {sess.status === 'active' 
                            ? '🟢 Em andamento' 
                            : isSessionCancelled 
                              ? '❌ Cancelada' 
                              : '🏁 Concluída'}
                        </p>
                        <span className="text-[9px] text-slate-500 block mt-0.5 select-none">
                          {new Date(sess.start_time).toLocaleDateString('pt-BR')} às {new Date(sess.start_time).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>

                      <div className="text-right">
                        <p className={`text-xs font-bold ${isSessionCancelled ? 'text-slate-500 line-through' : 'text-purple-400'}`}>
                          {sess.total_distance_km ? sess.total_distance_km.toFixed(1) : '0.0'} KM
                        </p>
                        <p className="text-[9px] text-slate-500 select-none">
                          {sess.total_duration_minutes || 0} min total
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>

      </div>

    </div>
  );
};
