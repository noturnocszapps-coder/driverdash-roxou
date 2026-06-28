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
  AlertTriangle, Milestone, Activity, Compass, Flame, Info
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

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
    gpsError
  } = useApp();

  const [elapsedTime, setElapsedTime] = useState<string>('00:00:00');
  const [wakeLockActive, setWakeLockActive] = useState(false);
  const [wakeLockObj, setWakeLockObj] = useState<any | null>(null);

  // Active session helper
  const activeSession = useMemo(() => {
    return driverSessions.find(s => s.status === 'active');
  }, [driverSessions]);

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
  const totalKmToday = useMemo(() => {
    let distance = 0;
    for (let i = 1; i < currentSessionPoints.length; i++) {
      const p1 = currentSessionPoints[i - 1];
      const p2 = currentSessionPoints[i];
      distance += calculateHaversineDistance(p1.latitude, p1.longitude, p2.latitude, p2.longitude);
    }
    return Number(distance.toFixed(2));
  }, [currentSessionPoints]);

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
                        <p className="text-[10px] text-slate-500 font-mono">ID: {activeSession.id}</p>
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
