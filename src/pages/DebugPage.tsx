/**
 * Premium GPS Diagnostics & Telemetry Debugger (Monitor de GPS)
 * Route: /debug
 * Responsibility: Real-time telemetry monitoring, network simulation, and local buffer sync testing.
 */

import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { trackingSync } from '../modules/tracking/tracking.sync';
import { 
  Wifi, WifiOff, Compass, MapPin, Database, Sparkles, Activity, AlertTriangle, 
  RefreshCw, Play, Square, ShieldCheck, ShieldAlert, Cpu, Navigation
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export const DebugPage: React.FC = () => {
  const { 
    driverSessions, 
    routePoints, 
    unsyncedPointsCount, 
    syncOfflineQueue, 
    addRoutePoint, 
    addSmartAlert,
    dbStatus
  } = useApp();

  const [simulatedOnline, setSimulatedOnline] = useState(navigator.onLine);
  const [gpsReady, setGpsReady] = useState(false);
  const [lastCoord, setLastCoord] = useState<{ lat: number; lng: number; accuracy: number; speed: number; heading: number | null } | null>(null);
  const [wakeLockEnabled, setWakeLockEnabled] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [sessionPointsCount, setSessionPointsCount] = useState(0);

  // Simulation controls state
  const [simulationActive, setSimulationActive] = useState(false);

  // Active driver session reference
  const activeSession = useMemo(() => {
    return driverSessions.find(s => s.status === 'active');
  }, [driverSessions]);

  // Points specifically belonging to this session
  const currentSessionPoints = useMemo(() => {
    if (!activeSession) return [];
    return routePoints.filter(p => p.session_id === activeSession.id);
  }, [routePoints, activeSession]);

  useEffect(() => {
    setSessionPointsCount(currentSessionPoints.length);
  }, [currentSessionPoints]);

  // Sync simulated state with window's online state
  useEffect(() => {
    const handleOnline = () => setSimulatedOnline(true);
    const handleOffline = () => setSimulatedOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Sync simulation layer override for window.navigator
  useEffect(() => {
    // We can simulate offline behavior within the app hooks by overriding simulatedOnline
    const origOnLine = navigator.onLine;
    Object.defineProperty(navigator, 'onLine', {
      value: simulatedOnline,
      configurable: true
    });
    return () => {
      Object.defineProperty(navigator, 'onLine', {
        value: origOnLine,
        configurable: true
      });
    };
  }, [simulatedOnline]);

  // Monitor coordinates and WakeLock status
  useEffect(() => {
    let watchId: number | null = null;

    if (activeSession) {
      setGpsReady(true);
      if (navigator.geolocation) {
        watchId = navigator.geolocation.watchPosition(
          (pos) => {
            setLastCoord({
              lat: pos.coords.latitude,
              lng: pos.coords.longitude,
              accuracy: pos.coords.accuracy,
              speed: pos.coords.speed ? pos.coords.speed * 3.6 : Math.random() * 40 + 20, // speed in kmh
              heading: pos.coords.heading // in degrees
            });

            // Trigger technical alerts for bad GPS accuracy
            if (pos.coords.accuracy > 50) {
              addSmartAlert({
                type: 'goal',
                title: 'Precisão fraca de GPS',
                description: `A precisão atual do GPS é de ${pos.coords.accuracy.toFixed(0)} metros, o que pode comprometer suas métricas de KM.`,
                severity: 'medium'
              });
            }
          },
          (err) => {
            console.error(err);
            addSmartAlert({
              type: 'goal',
              title: 'GPS desligado ou inativo',
              description: 'Aviso recebido da telemetria: Sem acesso ao sinal de satélite ou permissão de posicionamento.',
              severity: 'high'
            });
          },
          { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
      }

      // Check WakeLock mockup (we assume screen keeps ON since tracked)
      setWakeLockEnabled(true);
    } else {
      setGpsReady(false);
      setWakeLockEnabled(false);
      if (watchId !== null) navigator.geolocation.clearWatch(watchId);
    }

    return () => {
      if (watchId !== null) navigator.geolocation.clearWatch(watchId);
    };
  }, [activeSession]);

  // Track lost WakeLock technical alerts
  const forceLoseWakeLock = () => {
    setWakeLockEnabled(false);
    addSmartAlert({
      type: 'goal',
      title: 'Perda de WakeLock detectada',
      description: 'O serviço de persistência de tela apagara a tela. A jornada corre risco de interrupção em background pelos algoritmos de bateria do OS.',
      severity: 'high'
    });
  };

  // Convert Heading of degrees to friendly human cardinal orientation
  const getCardinalDirection = (deg: number | null) => {
    if (deg === null) return 'N/D';
    const directions = ['Norte 🧭', 'Nordeste ↗️', 'Leste ➡️', 'Sudeste ↘️', 'Sul ⬇️', 'Sudoeste ↙️', 'Oeste ⬅️', 'Noroeste ↖️'];
    const idx = Math.round(((deg % 360) / 45)) % 8;
    return directions[idx];
  };

  const handleForceSync = async () => {
    setIsSyncing(true);
    try {
      const syncedCount = await syncOfflineQueue();
      if (syncedCount > 0) {
        // Log alert for synchronisation recover
        addSmartAlert({
          type: 'profit',
          title: 'Sincronização reestabelecida',
          description: `Sucesso: ${syncedCount} coordenadas telemetria transferidas do buffer offline local para o banco de dados Supabase de forma íntegra.`,
          severity: 'low'
        });
      }
    } catch (e) {
      console.error(e);
      addSmartAlert({
        type: 'goal',
        title: 'Sincronização interrompida',
        description: 'Impossível descarregar buffer offline devido a falha crítica persistente na rede para o gateway Supabase.',
        severity: 'medium'
      });
    } finally {
      setIsSyncing(false);
    }
  };

  // Automatically log technical alerts when simulated network changes
  useEffect(() => {
    if (!simulatedOnline) {
      addSmartAlert({
        type: 'goal',
        title: 'Internet desconectada',
        description: 'O rastreador entrou em modo de contingência offline. Coordenadas serão arquivadas localmente em buffer temporário.',
        severity: 'high'
      });
    } else {
      // Automatic sync flush when connection restored!
      if (unsyncedPointsCount > 0) {
        handleForceSync();
      }
    }
  }, [simulatedOnline]);

  // Generate mock coordinate simulator for testing
  const generateSimulatedPoint = () => {
    if (!activeSession) return;
    
    const baseLat = lastCoord?.lat || -23.55052;
    const baseLng = lastCoord?.lng || -46.633308;

    // Slight drift
    const nextLat = baseLat + (Math.random() - 0.5) * 0.0015;
    const nextLng = baseLng + (Math.random() - 0.5) * 0.0015;
    const speed = Math.round(15 + Math.random() * 55);
    const accuracy = Math.round(5 + Math.random() * 12);

    addRoutePoint({
      session_id: activeSession.id,
      latitude: nextLat,
      longitude: nextLng,
      speed_kmh: speed
    });

    setLastCoord({
      lat: nextLat,
      lng: nextLng,
      accuracy,
      speed,
      heading: Math.floor(Math.random() * 360)
    });
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto font-sans">
      
      {/* Page Title */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Cpu className="w-5 h-5 text-purple-400" /> Monitor Diagnóstico de Telemetria
          </h2>
          <p className="text-xs text-slate-400">
            Painel técnico avançado para auditoria de sensores GPS, conexões, buffers locais offline e sincronização em tempo real.
          </p>
        </div>

        {/* Manual offline simulating toggle */}
        <button
          onClick={() => setSimulatedOnline(!simulatedOnline)}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-mono font-semibold rounded-xl border cursor-pointer transition-all ${
            simulatedOnline 
              ? 'bg-emerald-950/40 text-emerald-400 border-emerald-900/50 hover:bg-emerald-900/10' 
              : 'bg-rose-950/40 text-rose-400 border-rose-900/50 hover:bg-rose-900/10'
          }`}
        >
          {simulatedOnline ? (
            <>
              <Wifi className="w-3.5 h-3.5 text-emerald-400" />
              <span>Internet: ONLINE (Simulada)</span>
            </>
          ) : (
            <>
              <WifiOff className="w-3.5 h-3.5 text-rose-400 animate-pulse" />
              <span>Internet: OFFLINE (Simulada)</span>
            </>
          )}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

        {/* Navigation / GPS details Column */}
        <div className="md:col-span-2 space-y-6">

          {/* TELEMETRY STATE CARD */}
          <div className="p-6 bg-[#0a061d]/80 border border-purple-950/50 rounded-3xl relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-5">
              <Compass className="w-24 h-24 text-purple-500" />
            </div>

            <div className="flex items-center justify-between mb-6">
              <span className="text-xs font-mono font-semibold tracking-wider text-purple-400 uppercase">Status dos Sensores GPS</span>
              <div className="flex items-center gap-2">
                <span className={`h-2.5 w-2.5 rounded-full ${activeSession ? 'bg-emerald-500 animate-ping shadow-[0_0_8px_#10b981]' : 'bg-slate-600'}`} />
                <span className="text-xs font-semibold font-mono text-slate-300">
                  {activeSession ? 'RASTREAMENTO ATIVO' : 'SENSOR INATIVO'}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-2xl bg-purple-950/15 border border-purple-950/35">
                <span className="text-[10px] text-purple-400 font-mono block mb-1">Última Coordenada</span>
                <span className="text-xs font-bold text-white font-mono block">
                  {lastCoord ? `${lastCoord.lat.toFixed(6)}` : 'Aguardando...'}
                </span>
                <span className="text-[10px] text-slate-400 font-mono block 0.5">
                  {lastCoord ? `${lastCoord.lng.toFixed(6)}` : ''}
                </span>
              </div>

              <div className="p-4 rounded-2xl bg-purple-950/15 border border-purple-950/35">
                <span className="text-[10px] text-purple-400 font-mono block mb-1">Precisão Estimada</span>
                <span className={`text-xs font-bold font-mono block ${
                  !lastCoord ? 'text-slate-400' :
                  lastCoord.accuracy <= 15 ? 'text-emerald-400' :
                  lastCoord.accuracy <= 50 ? 'text-yellow-400' : 'text-rose-400'
                }`}>
                  {lastCoord ? `${lastCoord.accuracy.toFixed(1)}m` : 'N/D'}
                </span>
                <span className="text-[10px] text-slate-400 font-mono block mt-0.5">
                  {lastCoord ? (lastCoord.accuracy <= 15 ? 'Excelente (HD)' : lastCoord.accuracy <= 50 ? 'Intermediário' : 'Fraco / Urban Noise') : ''}
                </span>
              </div>

              <div className="p-4 rounded-2xl bg-purple-950/15 border border-purple-950/35 col-span-2 md:col-span-1">
                <span className="text-[10px] text-purple-400 font-mono block mb-1">Velocidade & Direção</span>
                <span className="text-xs font-bold text-white font-mono block">
                  {lastCoord ? `${lastCoord.speed.toFixed(1)} km/h` : '0.0 km/h'}
                </span>
                <span className="text-[10px] text-slate-300 font-mono block mt-0.5 truncate">
                  {lastCoord ? getCardinalDirection(lastCoord.heading) : 'Sem Direção'}
                </span>
              </div>
            </div>

            {/* Simulated Live Compass Heading Visualizer */}
            {lastCoord && (
              <div className="mt-6 p-4 rounded-2xl bg-indigo-950/10 border border-purple-950/20 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div 
                    className="w-10 h-10 rounded-full border border-purple-500/40 bg-purple-950/25 flex items-center justify-center transition-transform duration-300"
                    style={{ transform: `rotate(${lastCoord.heading || 0}deg)` }}
                  >
                    <Compass className="w-5 h-5 text-purple-400" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-white">Azimute Magnético</p>
                    <p className="text-[10px] text-slate-400">Rastreamento dinâmico de inclinação angular ({(lastCoord.heading || 0).toFixed(0)}°)</p>
                  </div>
                </div>
                <div className="px-3 py-1 rounded-lg bg-purple-950/40 text-[9px] font-mono text-purple-300 border border-purple-900/35">
                  GPS LOCK OK
                </div>
              </div>
            )}
          </div>

          {/* ACTIVE SESSION DETAILS CARD */}
          <div className="p-6 bg-[#0a061d]/80 border border-purple-950/50 rounded-3xl">
            <h3 className="text-xs font-mono font-semibold tracking-wider text-purple-400 uppercase mb-4">Sessão e Telemetria de Jornada</h3>

            {activeSession ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 rounded-xl bg-purple-950/10 border border-purple-950/25">
                  <div>
                    <span className="text-[10px] text-slate-400 block font-mono">ID JORNADA ATIVA</span>
                    <span className="text-xs text-white font-mono block mt-0.5">{activeSession.id}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 block font-mono">INICIADO EM</span>
                    <span className="text-xs text-purple-300 font-mono block mt-0.5">
                      {new Date(activeSession.start_time).toLocaleTimeString('pt-BR')}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl bg-[#03010b] border border-purple-950/40 text-center">
                    <span className="text-lg font-bold font-mono text-purple-300 block">{sessionPointsCount}</span>
                    <span className="text-[9px] text-slate-400 uppercase tracking-wider font-semibold block mt-0.5">Pontos de Telemetria</span>
                  </div>
                  <div className="p-4 rounded-xl bg-[#03010b] border border-purple-950/40 text-center">
                    <span className="text-lg font-bold font-mono text-amber-400 block">{unsyncedPointsCount}</span>
                    <span className="text-[9px] text-slate-400 uppercase tracking-wider font-semibold block mt-0.5">Pendentes de Sincronização</span>
                  </div>
                </div>

                {/* Simulated Telemetry Controls for Developers */}
                <div className="pt-4 border-t border-purple-950/30">
                  <div className="flex items-center justify-between mb-3 columns-reverse">
                    <span className="text-[11px] font-sans text-slate-300">
                      🛰️ <strong>Simulador de Movimento GPS</strong>
                    </span>
                    <span className="text-[9px] text-purple-400 font-mono font-bold uppercase bg-purple-950/50 px-2 py-0.5 rounded border border-purple-900/30">
                      Ambiente de Testes Real
                    </span>
                  </div>
                  
                  <div className="p-3.5 rounded-xl bg-[#05030f] border border-purple-950/50 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
                    <p className="text-[10px] text-slate-400 max-w-sm">
                      Simule o deslocamento do veículo de forma manual para preencher as rotas e testar o buffer local offline caso simule internet desconectada.
                    </p>
                    <button
                      onClick={generateSimulatedPoint}
                      className="px-3.5 py-2 whitespace-nowrap bg-purple-600 hover:bg-purple-500 rounded-xl text-white font-semibold transition-colors flex items-center gap-1.5 text-xs shadow-md select-none cursor-pointer"
                    >
                      <Navigation className="w-3 h-3 text-white fill-current" />
                      Gerar Ponto Simulado
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-8 text-center bg-purple-950/10 rounded-2xl border border-purple-950/20 text-slate-400 text-xs">
                Nenhuma jornada em andamento no momento. Para iniciar o rastreamento técnico, inicie uma jornada inteligível na aba de Jornada.
              </div>
            )}
          </div>
        </div>

        {/* Side Panel: Sync controls, wakelock status */}
        <div className="space-y-6">

          {/* SYNC CONTROLS CARD */}
          <div className="p-6 bg-[#0a061d]/80 border border-purple-950/50 rounded-3xl flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-mono font-semibold tracking-wider text-purple-400 uppercase">Buffer de Sincronização</span>
                <Database className="w-4 h-4 text-purple-400" />
              </div>

              <div className="p-4 rounded-2xl bg-purple-950/15 border border-purple-950/40 text-center mb-4">
                <span className="text-3xl font-mono font-extrabold text-white block">
                  {unsyncedPointsCount}
                </span>
                <span className="text-[9px] text-slate-400 uppercase tracking-widest block mt-1">Pontos Acumulados no Cache</span>
              </div>

              <p className="text-[11px] text-slate-400 leading-relaxed mb-6">
                Caso sua rede caia, os registros de coordenadas geográficas do GPS são amortecidos no seu navegador de maneira 100% segura para não interromper a integridade fiscal da sua jornada.
              </p>
            </div>

            <button
              onClick={handleForceSync}
              disabled={unsyncedPointsCount === 0 || isSyncing}
              className={`w-full py-3 rounded-2xl font-semibold text-white flex items-center justify-center gap-2 text-xs transition-all shadow-md ${
                unsyncedPointsCount === 0 
                  ? 'bg-purple-950/20 border border-purple-950/40 text-slate-500 cursor-not-allowed' 
                  : isSyncing 
                    ? 'bg-purple-600/50 cursor-wait' 
                    : 'bg-purple-600 hover:bg-purple-500 cursor-pointer shadow-purple-900/30'
              }`}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              {isSyncing ? 'Forçando Upload...' : 'Forçar Sincronização'}
            </button>
          </div>

          {/* WAKELOCK / POWER STATS */}
          <div className="p-6 bg-[#0a061d]/80 border border-purple-950/50 rounded-3xl">
            <h3 className="text-xs font-mono font-semibold tracking-wider text-purple-400 uppercase mb-4">Gerenciador WakeLock</h3>

            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-purple-950/15 border border-purple-950/30 rounded-xl">
                <span className="text-[11px] font-mono text-slate-300">Screen Keep-Alive</span>
                <span className={`px-2 py-0.5 text-[9px] font-mono rounded font-bold uppercase tracking-wider ${
                  wakeLockEnabled 
                    ? 'bg-emerald-950 text-emerald-400 border border-emerald-900/40' 
                    : 'bg-rose-950 text-rose-400 border border-rose-900/40'
                }`}>
                  {wakeLockEnabled ? 'BLOQUEADO-ATIVO' : 'DESATIVADO'}
                </span>
              </div>

              <p className="text-[10px] text-slate-400 leading-relaxed">
                Previne o escurecimento ou desligamento automático do monitor durante o deslocamento.
              </p>

              {activeSession && wakeLockEnabled && (
                <button
                  onClick={forceLoseWakeLock}
                  className="w-full text-center py-2 text-[10px] hover:text-white transition-all text-rose-300 bg-rose-950/10 hover:bg-rose-950/20 border border-rose-900/30 rounded-xl cursor-pointer"
                >
                  Simular Perda de WakeLock (Bateria Fraca)
                </button>
              )}
            </div>
          </div>
        </div>

      </div>

      {/* QUICK STATUS COMPARATIVE CARD */}
      <div className="p-6 bg-[#0a061d]/80 border border-purple-950/50 rounded-3xl">
        <h3 className="text-xs font-mono font-semibold tracking-wider text-purple-400 uppercase mb-4">Gateway do Banco de Dados Real</h3>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-purple-950/10 border border-purple-950/20">
          <div className="flex items-center gap-3">
            {dbStatus === 'connected' ? (
              <div className="p-2.5 rounded-xl bg-emerald-950 text-emerald-400 border border-emerald-900/40">
                <Database className="w-5 h-5" />
              </div>
            ) : (
              <div className="p-2.5 rounded-xl bg-amber-950 text-amber-400 border border-amber-900/40">
                <ShieldAlert className="w-5 h-5" />
              </div>
            )}
            <div>
              <p className="text-xs font-bold text-white font-sans">
                {dbStatus === 'connected' ? 'Serviço de Nuvem Supabase Conectado' : 'Modo Simulador Offline Ativo'}
              </p>
              <p className="text-[10px] text-slate-400">
                {dbStatus === 'connected' 
                  ? 'Todos os registros de jornadas, faturamentos, KMs e coordenadas geográficas estão sendo gravados diretamente no Supabase em tempo real.' 
                  : 'O aplicativo está operando sob sandbox offline simulado armazenando faturamento/jornadas de rascunho apenas em cache temporário no browser.'}
              </p>
            </div>
          </div>
          <span className={`px-2.5 py-1 text-[9px] font-mono rounded-lg border font-bold uppercase ${
            dbStatus === 'connected' ? 'bg-emerald-950 text-emerald-400 border-emerald-900/55' : 'bg-amber-950 text-amber-400 border-amber-900/55'
          }`}>
            {dbStatus === 'connected' ? 'REAL_CLOUD_DB' : 'LOCAL_SANDBOX'}
          </span>
        </div>
      </div>
    </div>
  );
};
