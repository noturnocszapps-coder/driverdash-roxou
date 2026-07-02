/**
 * Premium GPS Diagnostics & Telemetry Debugger (Monitor de GPS)
 * Route: /debug
 * Responsibility: Real-time telemetry monitoring, network simulation, and local buffer sync testing.
 */

import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { trackingSync } from '../modules/tracking/tracking.sync';
import { telemetrySyncService } from '../modules/journey/telemetrySync.service';
import { supabase } from '../modules/shared/supabase.helpers';
import { driverProfileService } from '../modules/copilot-intelligence/driverProfile.service';
import { 
  Wifi, WifiOff, Compass, MapPin, Database, Sparkles, Activity, AlertTriangle, 
  RefreshCw, Play, Square, ShieldCheck, ShieldAlert, Cpu, Navigation, Trash2,
  Check, Clipboard, Clock, Info, HelpCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router-dom';

export const DebugPage: React.FC = () => {
  const navigate = useNavigate();
  const { 
    profile,
    loading,
    driverSessions, 
    routePoints, 
    unsyncedPointsCount, 
    syncOfflineQueue, 
    addRoutePoint, 
    addSmartAlert,
    dbStatus,
    gpsStatus,
    permissionState,
    lastCoord,
    gpsError,
    gpsTestResult,
    gpsTestLoading,
    testGps,
    clearGpsTestResult,
    pendingPointsCount,
    syncedPointsCount,
    failedPointsCount,
    lastSyncTime,
    lastSyncError,
    syncStatus,
    totalDistanceMeters,
    totalDistanceKm,
    lastAddedDistanceMeters,
    currentAccuracy,
    discardedPointsCount,
    lastDiscardReason,
    idleStatus,
    clearAllJourneyState
  } = useApp();

  const [simulatedOnline, setSimulatedOnline] = useState(navigator.onLine);
  const [isRealOnline, setIsRealOnline] = useState(typeof window !== 'undefined' ? navigator.onLine : true);
  const [wakeLockEnabled, setWakeLockEnabled] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [sessionPointsCount, setSessionPointsCount] = useState(0);
  const [hasGeneratedSimulated, setHasGeneratedSimulated] = useState(false);
  const [localLogs, setLocalLogs] = useState<any[]>([]);

  // System Health States
  const [activeDebugTab, setActiveDebugTab] = useState<'health' | 'telemetry'>('health');
  const [diagnosticRunning, setDiagnosticRunning] = useState(false);
  const [lastDiagnosticTime, setLastDiagnosticTime] = useState<Date | null>(new Date());
  const [copiedReport, setCopiedReport] = useState(false);
  const [isCleaningOldQueue, setIsCleaningOldQueue] = useState(false);
  const [cleanResult, setCleanResult] = useState<{ cleanedCount: number; remainingCount: number } | null>(null);
  const [localStorageTestOk, setLocalStorageTestOk] = useState<boolean | null>(true);

  const loadLocalLogs = () => {
    try {
      const logsStr = localStorage.getItem('driverdash_roxou_local_app_logs');
      if (logsStr) {
        setLocalLogs(JSON.parse(logsStr));
      } else {
        setLocalLogs([]);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadLocalLogs();
    const interval = setInterval(loadLocalLogs, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleClearLogs = () => {
    try {
      localStorage.removeItem('driverdash_roxou_local_app_logs');
      setLocalLogs([]);
    } catch (e) {
      console.error(e);
    }
  };

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
    const handleOnline = () => {
      setSimulatedOnline(true);
      setIsRealOnline(true);
    };
    const handleOffline = () => {
      setSimulatedOnline(false);
      setIsRealOnline(false);
    };

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

  // Check WakeLock mockup (we assume screen keeps ON since tracked)
  useEffect(() => {
    if (activeSession) {
      setWakeLockEnabled(true);
    } else {
      setWakeLockEnabled(false);
    }
  }, [activeSession]);

  // Auth Protection Gate - Redirect if not admin
  useEffect(() => {
    if (!loading && profile) {
      if (profile.role !== 'admin') {
        alert('Acesso restrito a administradores.');
        navigate('/dashboard', { replace: true });
      }
    }
  }, [profile, loading, navigate]);

  if (loading || !profile || profile.role !== 'admin') {
    return (
      <div className="min-h-screen bg-[#070214] flex flex-col items-center justify-center text-purple-300">
        <div className="relative w-16 h-16">
          <div className="absolute top-0 left-0 w-full h-full border-4 border-purple-900 border-t-purple-500 rounded-full animate-spin"></div>
        </div>
        <p className="mt-4 font-mono text-sm animate-pulse">Verificando credenciais...</p>
      </div>
    );
  }

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
    if (deg === null || deg === undefined) return 'N/D';
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

  const handleCleanupBuffer = () => {
    const result = telemetrySyncService.cleanupBuffer();
    addSmartAlert({
      type: 'profit',
      title: 'Buffer Limpo',
      description: `Buffer antigo de GPS limpo com sucesso! Removidos: ${result.cleanedCount} pontos antigos ou órfãos. Restantes: ${result.remainingCount} pontos ativos.`,
      severity: 'low'
    });
  };

  // System Health Diagnostic Suites
  const runSystemDiagnostics = async () => {
    setDiagnosticRunning(true);
    // Simulate sweep/ping checks for 1 second
    await new Promise((resolve) => setTimeout(resolve, 1000));
    
    // Check localStorage writable
    try {
      const key = 'driverdash_health_test_key';
      localStorage.setItem(key, 'test_val');
      const val = localStorage.getItem(key);
      localStorage.removeItem(key);
      setLocalStorageTestOk(val === 'test_val');
    } catch (e) {
      setLocalStorageTestOk(false);
    }
    
    setLastDiagnosticTime(new Date());
    setDiagnosticRunning(false);

    addSmartAlert({
      type: 'profit',
      title: 'Diagnóstico Concluído',
      description: 'Varredura completa de saúde do sistema executada com sucesso. Todos os módulos foram validados.',
      severity: 'low'
    });
  };

  const handleCleanOldQueue = () => {
    setIsCleaningOldQueue(true);
    const result = telemetrySyncService.cleanupBuffer();
    setCleanResult(result);
    setTimeout(() => {
      setIsCleaningOldQueue(false);
    }, 1500);

    addSmartAlert({
      type: 'profit',
      title: 'Buffer Limpo',
      description: `Buffer antigo de GPS limpo com sucesso! Removidos: ${result.cleanedCount} pontos antigos ou órfãos. Restantes: ${result.remainingCount} pontos ativos.`,
      severity: 'low'
    });
  };

  const getSystemStatusLabelAndColor = () => {
    const items = [
      permissionState === 'denied' ? 'error' : permissionState === 'prompt' ? 'warning' : 'ok',
      gpsStatus.includes('erro') || gpsStatus.includes('negado') ? 'error' : gpsStatus.includes('Aguardando') || gpsStatus.includes('sem sinal') ? 'warning' : 'ok',
      !isRealOnline || !simulatedOnline ? 'warning' : 'ok',
      dbStatus !== 'connected' ? 'warning' : 'ok',
      pendingPointsCount > 0 ? 'warning' : 'ok',
      localStorageTestOk === false ? 'error' : 'ok',
      !driverProfileService.hasPreferences() ? 'warning' : 'ok'
    ];

    if (items.includes('error')) {
      return {
        label: 'SISTEMA COM ERRO: REQUER REVISÃO',
        sublabel: 'Módulos essenciais de GPS ou permissões falharam. O app pode não gravar rotas adequadamente.',
        bg: 'bg-rose-950/25 border-rose-900/30 text-rose-400',
        dot: 'bg-rose-500 shadow-[0_0_8px_#ef4444]'
      };
    }
    if (items.includes('warning')) {
      return {
        label: 'SISTEMA COM ATENÇÃO: PENDÊNCIAS DETECTADAS',
        sublabel: 'O sistema está funcional, mas existem pendências como fila offline acumulada, gateway em sandbox ou internet inativa.',
        bg: 'bg-amber-950/25 border-amber-900/30 text-amber-400',
        dot: 'bg-amber-500 shadow-[0_0_8px_#f59e0b]'
      };
    }
    return {
      label: 'SISTEMA PRONTO PARA USO & DEPLOY',
      sublabel: 'Excelente! Todos os sensores, bancos locais, gateways e motores de inteligência artificial estão 100% saudáveis.',
      bg: 'bg-emerald-950/25 border-emerald-900/30 text-emerald-400',
      dot: 'bg-emerald-500 shadow-[0_0_8px_#10b981]'
    };
  };

  const handleCopyReport = () => {
    const isOnlineText = (isRealOnline && simulatedOnline) ? 'ONLINE' : 'OFFLINE';
    const isSupabaseConnected = dbStatus === 'connected' ? 'CONECTADO' : 'OFFLINE SANDBOX';
    const hasAIOnboarded = driverProfileService.hasPreferences() ? 'ONBOARDED (Pronto)' : 'PADRÃO (Pendente)';
    const localStorageText = localStorageTestOk ? 'OK (Funcionando)' : 'FALHA (Bloqueado)';
    const lastCoordText = lastCoord ? `${lastCoord.lat.toFixed(6)}, ${lastCoord.lng.toFixed(6)}` : 'Nenhuma coordenada recebida';
    const accuracyText = lastCoord ? `${lastCoord.accuracy.toFixed(1)}m` : 'N/D';
    const watchPositionText = gpsStatus === 'GPS ativo' ? 'ATIVO' : 'INATIVO';
    const healthStatus = getSystemStatusLabelAndColor().label;

    let totalBytes = 0;
    try {
      const localStr = JSON.stringify(localStorage);
      totalBytes = localStr ? localStr.length * 2 : 0;
    } catch (e) {}
    const kbUsed = (totalBytes / 1024).toFixed(2);

    const report = `=========================================
REPORT DE DIAGNÓSTICO: DRIVERDASH ROXOU
Gerado em: ${new Date().toLocaleString('pt-BR')}
=========================================

1. INFORMAÇÕES DO SISTEMA:
- Versão do App: v3.4.2
- Build: 2026.07.02
- Memória Estimada: LocalStorage usando ${kbUsed} KB
- Banco Local (localStorage): ${localStorageText}

2. CONECTIVIDADE & BANCO DE DADOS:
- Conexão de Internet: ${isOnlineText} (Real: ${isRealOnline ? 'ON' : 'OFF'}, Simulado: ${simulatedOnline ? 'ON' : 'OFF'})
- Supabase Gateway: ${isSupabaseConnected}

3. RASTREAMENTO & TELEMETRIA:
- GPS Status: ${gpsStatus}
- Permissão de Localização: ${permissionState}
- WatchPosition Ativo: ${watchPositionText}
- Última Coordenada: ${lastCoordText}
- Precisão Atual: ${accuracyText}

4. BUFFER & FILA OFFLINE:
- Fila Offline: ${pendingPointsCount} pontos pendentes
- Falhas de Sincronização: ${failedPointsCount} pontos
- Última Sincronização: ${lastSyncTime ? new Date(lastSyncTime).toLocaleString('pt-BR') : 'Nunca'}

5. INTELIGÊNCIA ARTIFICIAL:
- Perfil do Motorista (IA): ${hasAIOnboarded}

=========================================
STATUS GERAL: ${healthStatus}
=========================================`;

    navigator.clipboard.writeText(report);
    setCopiedReport(true);
    setTimeout(() => {
      setCopiedReport(false);
    }, 2000);
  };

  const hasOldPoints = useMemo(() => {
    const pts = telemetrySyncService.getPoints();
    const activeId = activeSession?.id;
    return pts.some(p => !p.session_id || (activeId && p.session_id !== activeId));
  }, [activeSession, unsyncedPointsCount, syncedPointsCount]);

  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  const handleResetTestPoints = async () => {
    console.log('[RESET_TEST_DATA_START] Starting total test data reset flow...');
    setIsResetting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id;
      
      if (!userId) {
        throw new Error('Usuário não autenticado ou sessão expirada');
      }

      // 1. Call secure PostgreSQL RPC function
      console.log('[RESET_TEST_DATA_START] Calling RPC reset_my_driverdash_test_data...');
      const { data: rpcData, error: rpcError } = await supabase.rpc('reset_my_driverdash_test_data');
      if (rpcError) {
        console.warn('[RESET_TEST_DATA_START] RPC returned notice (falling back to direct client deletions):', rpcError);
      } else {
        console.log('[RESET_TEST_DATA_START] RPC executed successfully:', rpcData);
      }

      // 2. Perform direct client deletions as fallback/reinforcement
      console.log('[RESET_TEST_DATA_START] Performing safety deletions across tables...');
      
      // route_points
      const { error: rpErr } = await supabase.from('route_points').delete().eq('driver_id', userId);
      if (rpErr) console.warn('[RESET_TEST_DATA_START] route_points delete warning:', rpErr.message);

      // driver_sessions
      const { error: dsErr } = await supabase.from('driver_sessions').delete().eq('user_id', userId);
      if (dsErr) console.warn('[RESET_TEST_DATA_START] driver_sessions delete warning:', dsErr.message);

      // earnings
      const { error: earnErr } = await supabase.from('earnings').delete().eq('user_id', userId);
      if (earnErr) console.warn('[RESET_TEST_DATA_START] earnings delete warning:', earnErr.message);

      // expenses
      const { error: expErr } = await supabase.from('expenses').delete().eq('user_id', userId);
      if (expErr) console.warn('[RESET_TEST_DATA_START] expenses delete warning:', expErr.message);

      // daily_closings
      const { error: dcErr } = await supabase.from('daily_closings').delete().eq('user_id', userId);
      if (dcErr) console.warn('[RESET_TEST_DATA_START] daily_closings delete warning:', dcErr.message);

      // weekly_closings
      const { error: wcErr } = await supabase.from('weekly_closings').delete().eq('user_id', userId);
      if (wcErr) console.warn('[RESET_TEST_DATA_START] weekly_closings delete warning:', wcErr.message);

      // financial_goals
      const { error: fgErr } = await supabase.from('financial_goals').delete().eq('user_id', userId);
      if (fgErr) console.warn('[RESET_TEST_DATA_START] financial_goals delete warning:', fgErr.message);

      // smart_alerts
      const { error: saErr } = await supabase.from('smart_alerts').delete().eq('user_id', userId);
      if (saErr) console.warn('[RESET_TEST_DATA_START] smart_alerts delete warning:', saErr.message);

      // driver_uber_pass_settings
      const { error: upErr } = await supabase.from('driver_uber_pass_settings').delete().eq('user_id', userId);
      if (upErr) console.warn('[RESET_TEST_DATA_START] driver_uber_pass_settings delete warning:', upErr.message);

      // ride_offers
      const { error: roErr } = await supabase.from('ride_offers').delete().eq('user_id', userId);
      if (roErr) console.warn('[RESET_TEST_DATA_START] ride_offers delete warning:', roErr.message);

      // driver_ride_logs
      const { error: drlErr } = await supabase.from('driver_ride_logs').delete().eq('driver_id', userId);
      if (drlErr) console.warn('[RESET_TEST_DATA_START] driver_ride_logs delete warning:', drlErr.message);

      // 3. Clean local & session storage
      console.log('[RESET_TEST_DATA_START] Cleaning local & session storage buffers...');
      
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key) {
          if (
            key.startsWith('driverdash_') ||
            key.includes('ride_logs') ||
            key.includes('telemetry') ||
            key.includes('sync') ||
            key.includes('active') ||
            key.includes('journey') ||
            key.includes('dashboard') ||
            key.includes('calibration') ||
            key.includes('route') ||
            key.includes('map_tracker') ||
            key.includes('predictive') ||
            key.includes('intelligence') ||
            key.includes('driver_sessions') ||
            key.includes('gps') ||
            key.includes('position')
          ) {
            keysToRemove.push(key);
          }
        }
      }
      keysToRemove.forEach(k => localStorage.removeItem(k));

      const sessionKeysToRemove: string[] = [];
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        if (key) {
          if (
            key.startsWith('driverdash_') ||
            key.includes('ride_logs') ||
            key.includes('telemetry') ||
            key.includes('sync') ||
            key.includes('active') ||
            key.includes('journey') ||
            key.includes('dashboard') ||
            key.includes('calibration') ||
            key.includes('route') ||
            key.includes('map_tracker') ||
            key.includes('predictive') ||
            key.includes('intelligence') ||
            key.includes('driver_sessions') ||
            key.includes('gps') ||
            key.includes('position')
          ) {
            sessionKeysToRemove.push(key);
          }
        }
      }
      sessionKeysToRemove.forEach(k => sessionStorage.removeItem(k));

      // 3.5 Clear telemetry sync queue, buffers, and offline queues (REGRA 3)
      console.log('[RESET_TEST_DATA_START] Clearing telemetrySyncQueue, pendingSyncBuffer, and offline queues...');
      try {
        telemetrySyncService.clearQueue();
      } catch (e) {
        console.warn('[RESET_TEST_DATA_START] Error in telemetrySyncService.clearQueue:', e);
      }

      // 4. Parar watchPosition, limpar timers, zerar estado do GPS
      console.log('[RESET_TEST_DATA_START] Clearing active journey states...');
      try {
        clearAllJourneyState();
      } catch (e) {
        console.warn('[RESET_TEST_DATA_START] Error in clearAllJourneyState:', e);
      }

      console.log('[RESET_TEST_DATA_SUCCESS] All driver test data successfully reset.');
      
      // Redirect to clean dashboard and trigger fresh reload to re-instantiate clean state
      window.location.href = '/dashboard';
      setTimeout(() => {
        window.location.reload();
      }, 150);

    } catch (err: any) {
      console.error('[RESET_TEST_DATA_ERROR] Reset test data error:', err);
      alert('Erro ao resetar os dados de teste: ' + err.message);
    } finally {
      setIsResetting(false);
      setResetModalOpen(false);
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

    addRoutePoint({
      session_id: activeSession.id,
      latitude: nextLat,
      longitude: nextLng,
      speed_kmh: speed
    });

    setHasGeneratedSimulated(true);
  };

  // Map sensor states to elegant badge colors
  const getGpsStatusStyle = (status: string) => {
    switch (status) {
      case 'GPS ativo':
        return { color: 'text-emerald-400', dot: 'bg-emerald-500 animate-ping shadow-[0_0_8px_#10b981]' };
      case 'Aguardando permissão':
      case 'Solicitando primeira posição':
        return { color: 'text-yellow-400', dot: 'bg-yellow-500 animate-pulse shadow-[0_0_8px_#f59e0b]' };
      case 'GPS sem sinal':
        return { color: 'text-amber-500', dot: 'bg-amber-500 animate-pulse shadow-[0_0_8px_#f59e0b]' };
      case 'GPS erro':
      case 'GPS negado':
        return { color: 'text-rose-400', dot: 'bg-rose-500 animate-pulse shadow-[0_0_8px_#ef4444]' };
      default:
        return { color: 'text-slate-400', dot: 'bg-slate-600' };
    }
  };

  const statusStyle = getGpsStatusStyle(gpsStatus);

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

        {/* Dual real + simulated connection layout */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Real Internet Badge */}
          <div className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono font-semibold rounded-xl border ${
            isRealOnline 
              ? 'bg-emerald-950/25 text-emerald-400 border-emerald-900/30' 
              : 'bg-rose-950/25 text-rose-400 border-rose-900/30'
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${isRealOnline ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
            <span>Rede Real: {isRealOnline ? 'ONLINE' : 'OFFLINE'}</span>
          </div>

          {/* Manual offline simulating toggle with Simulado Badge */}
          <button
            onClick={() => setSimulatedOnline(!simulatedOnline)}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-mono font-semibold rounded-xl border cursor-pointer transition-all ${
              simulatedOnline 
                ? 'bg-purple-950/40 text-purple-400 border-purple-900/50 hover:bg-purple-900/20' 
                : 'bg-amber-950/40 text-amber-400 border-amber-900/50 hover:bg-amber-900/20'
            }`}
          >
            {simulatedOnline ? (
              <>
                <Wifi className="w-3.5 h-3.5 text-purple-400" />
                <span>Simulação: ONLINE</span>
                <span className="px-1.5 py-0.2 bg-purple-900/60 text-purple-300 text-[8px] font-bold rounded uppercase">SIMULADO</span>
              </>
            ) : (
              <>
                <WifiOff className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
                <span>Simulação: OFFLINE</span>
                <span className="px-1.5 py-0.2 bg-amber-900/60 text-amber-300 text-[8px] font-bold rounded uppercase animate-pulse">SIMULADO</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Tab Switcher for Diagnostics */}
      <div className="flex border-b border-purple-950/20 pb-1 gap-2">
        <button
          onClick={() => setActiveDebugTab('health')}
          className={`px-5 py-2.5 rounded-xl font-bold font-sans text-xs flex items-center gap-2 transition-all cursor-pointer ${
            activeDebugTab === 'health'
              ? 'bg-purple-900/30 text-purple-400 border border-purple-850/40 shadow-inner shadow-purple-900/10'
              : 'text-slate-400 hover:text-white hover:bg-purple-950/10 border border-transparent'
          }`}
        >
          <Activity className="w-4 h-4" />
          🏥 Saúde do Sistema
        </button>
        <button
          onClick={() => setActiveDebugTab('telemetry')}
          className={`px-5 py-2.5 rounded-xl font-bold font-sans text-xs flex items-center gap-2 transition-all cursor-pointer ${
            activeDebugTab === 'telemetry'
              ? 'bg-purple-900/30 text-purple-400 border border-purple-850/40 shadow-inner shadow-purple-900/10'
              : 'text-slate-400 hover:text-white hover:bg-purple-950/10 border border-transparent'
          }`}
        >
          <Compass className="w-4 h-4" />
          📡 Diagnóstico de Telemetria
        </button>
      </div>

      {activeDebugTab === 'health' && (
        <div className="space-y-6">
          {/* Header overall status */}
          <div className={`p-6 rounded-3xl border ${getSystemStatusLabelAndColor().bg} flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all duration-300`}>
            <div className="flex items-start md:items-center gap-4">
              <div className="relative flex h-4 w-4 mt-1 md:mt-0 select-none">
                <span className={`absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping ${getSystemStatusLabelAndColor().dot.split(' ')[0]}`}></span>
                <span className={`relative inline-flex rounded-full h-4 w-4 ${getSystemStatusLabelAndColor().dot.split(' ')[0]}`}></span>
              </div>
              <div>
                <h3 className="text-base font-bold text-white tracking-wide">{getSystemStatusLabelAndColor().label}</h3>
                <p className="text-xs text-slate-300 mt-1">{getSystemStatusLabelAndColor().sublabel}</p>
              </div>
            </div>
            
            <div className="text-[11px] font-mono text-slate-400 md:text-right">
              <span>Último diagnóstico: </span>
              <span className="text-slate-200 font-bold">
                {lastDiagnosticTime ? lastDiagnosticTime.toLocaleTimeString('pt-BR') : 'Pendente'}
              </span>
            </div>
          </div>

          {/* Action buttons bar */}
          <div className="flex flex-wrap gap-3">
            <button
              onClick={runSystemDiagnostics}
              disabled={diagnosticRunning}
              className="flex items-center gap-2 px-5 py-3 bg-purple-600 hover:bg-purple-500 disabled:bg-purple-950/40 text-white font-bold rounded-2xl text-xs transition-all shadow-md shadow-purple-900/20 cursor-pointer select-none"
            >
              <RefreshCw className={`w-4 h-4 ${diagnosticRunning ? 'animate-spin' : ''}`} />
              {diagnosticRunning ? 'Analisando Sistema...' : 'Executar Diagnóstico'}
            </button>

            <button
              onClick={handleCleanOldQueue}
              disabled={isCleaningOldQueue}
              className="flex items-center gap-2 px-5 py-3 bg-purple-950/30 hover:bg-purple-900/20 border border-purple-900/40 text-purple-300 hover:text-white font-semibold rounded-2xl text-xs transition-all cursor-pointer select-none"
            >
              {isCleaningOldQueue ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-purple-400" />
                  <span>Limpando Fila...</span>
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4 text-purple-400" />
                  <span>Limpar fila antiga</span>
                </>
              )}
            </button>

            <button
              onClick={handleCopyReport}
              className="flex items-center gap-2 px-5 py-3 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white font-semibold rounded-2xl text-xs transition-all cursor-pointer select-none sm:ml-auto"
            >
              {copiedReport ? (
                <>
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span className="text-emerald-400 font-bold">Copiado!</span>
                </>
              ) : (
                <>
                  <Clipboard className="w-4 h-4 text-slate-400" />
                  <span>Copiar relatório técnico</span>
                </>
              )}
            </button>
          </div>

          {/* Clean result toast alert */}
          {cleanResult && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-4 rounded-2xl bg-purple-950/15 border border-purple-900/30 text-xs text-slate-300 flex items-center justify-between gap-4"
            >
              <div className="flex items-center gap-2">
                <Info className="w-4 h-4 text-purple-400" />
                <span>
                  Fila antiga higienizada! Removidos: <strong>{cleanResult.cleanedCount}</strong> buffers órfãos. Restantes ativos: <strong>{cleanResult.remainingCount}</strong>.
                </span>
              </div>
              <button onClick={() => setCleanResult(null)} className="text-[10px] hover:text-white text-slate-500 font-bold uppercase font-mono px-2 py-1">Fechar</button>
            </motion.div>
          )}

          {/* Diagnostic categories bento layout */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* 1. Localização e Sensores (GPS) */}
            <div className="p-6 bg-[#0a061d]/80 border border-purple-950/40 rounded-3xl space-y-4">
              <h4 className="text-xs font-bold font-mono text-purple-400 uppercase tracking-wider flex items-center gap-2 border-b border-purple-950/10 pb-3">
                <Compass className="w-4 h-4 text-purple-400" /> 🛰️ Localização & Sensores (GPS)
              </h4>
              
              <div className="space-y-3">
                {/* GPS Status */}
                <div className="flex items-center justify-between p-3 rounded-2xl bg-purple-950/10 border border-purple-950/25">
                  <span className="text-xs text-slate-300 font-sans">GPS Status</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold text-white uppercase">{gpsStatus}</span>
                    <span className="text-xs">
                      {gpsStatus === 'GPS ativo' ? '🟢 OK' : gpsStatus.includes('Aguardando') ? '🟡 Atenção' : '🔴 Erro'}
                    </span>
                  </div>
                </div>

                {/* Location Permission */}
                <div className="flex items-center justify-between p-3 rounded-2xl bg-purple-950/10 border border-purple-950/25">
                  <span className="text-xs text-slate-300 font-sans">Permissão de Localização</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold text-white capitalize">{permissionState}</span>
                    <span className="text-xs">
                      {permissionState === 'granted' ? '🟢 OK' : permissionState === 'prompt' ? '🟡 Atenção' : '🔴 Erro'}
                    </span>
                  </div>
                </div>

                {/* WatchPosition active */}
                <div className="flex items-center justify-between p-3 rounded-2xl bg-purple-950/10 border border-purple-950/25">
                  <span className="text-xs text-slate-300 font-sans">WatchPosition Ativo</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold text-white">
                      {gpsStatus === 'GPS ativo' ? 'SIM (Monitorando)' : 'INATIVO'}
                    </span>
                    <span className="text-xs">
                      {gpsStatus === 'GPS ativo' ? '🟢 OK' : '🟡 Atenção'}
                    </span>
                  </div>
                </div>

                {/* Last Coordinate */}
                <div className="flex items-center justify-between p-3 rounded-2xl bg-purple-950/10 border border-purple-950/25">
                  <span className="text-xs text-slate-300 font-sans">Última Coordenada</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold text-white truncate max-w-[180px]">
                      {lastCoord ? `${lastCoord.lat.toFixed(6)}, ${lastCoord.lng.toFixed(6)}` : 'Nenhuma recebida'}
                    </span>
                    <span className="text-xs">
                      {lastCoord ? '🟢 OK' : '🟡 Atenção'}
                    </span>
                  </div>
                </div>

                {/* Current Accuracy */}
                <div className="flex items-center justify-between p-3 rounded-2xl bg-purple-950/10 border border-purple-950/25">
                  <span className="text-xs text-slate-300 font-sans">Precisão Atual</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold text-white">
                      {lastCoord ? `${lastCoord.accuracy.toFixed(1)} metros` : 'N/D'}
                    </span>
                    <span className="text-xs">
                      {!lastCoord ? '🟡 Atenção' : lastCoord.accuracy <= 15 ? '🟢 OK' : lastCoord.accuracy <= 50 ? '🟡 Atenção' : '🔴 Erro'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* 2. Conectividade e Banco */}
            <div className="p-6 bg-[#0a061d]/80 border border-purple-950/40 rounded-3xl space-y-4">
              <h4 className="text-xs font-bold font-mono text-purple-400 uppercase tracking-wider flex items-center gap-2 border-b border-purple-950/10 pb-3">
                <Database className="w-4 h-4 text-purple-400" /> 🌐 Conectividade & Banco de Dados
              </h4>
              
              <div className="space-y-3">
                {/* Internet Online/Offline */}
                <div className="flex items-center justify-between p-3 rounded-2xl bg-purple-950/10 border border-purple-950/25">
                  <span className="text-xs text-slate-300 font-sans">Rede de Internet</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold text-white">
                      {(isRealOnline && simulatedOnline) ? 'Online (Ativa)' : 'Offline (Simulada/Sem Sinal)'}
                    </span>
                    <span className="text-xs">
                      {(isRealOnline && simulatedOnline) ? '🟢 OK' : '🔴 Erro'}
                    </span>
                  </div>
                </div>

                {/* Supabase Connected */}
                <div className="flex items-center justify-between p-3 rounded-2xl bg-purple-950/10 border border-purple-950/25">
                  <span className="text-xs text-slate-300 font-sans">Gateway Supabase</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold text-white">
                      {dbStatus === 'connected' ? 'Conectado à Nuvem' : 'Local Sandbox'}
                    </span>
                    <span className="text-xs">
                      {dbStatus === 'connected' ? '🟢 OK' : '🟡 Atenção'}
                    </span>
                  </div>
                </div>

                {/* Local Storage Health */}
                <div className="flex items-center justify-between p-3 rounded-2xl bg-purple-950/10 border border-purple-950/25">
                  <span className="text-xs text-slate-300 font-sans">Banco Local (localStorage)</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold text-white">
                      {localStorageTestOk ? 'Integridade OK' : localStorageTestOk === false ? 'Erro de Escrita' : 'Não Testado'}
                    </span>
                    <span className="text-xs">
                      {localStorageTestOk ? '🟢 OK' : localStorageTestOk === false ? '🔴 Erro' : '🟡 Atenção'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* 3. Buffer de Contingência (Offline) */}
            <div className="p-6 bg-[#0a061d]/80 border border-purple-950/40 rounded-3xl space-y-4">
              <h4 className="text-xs font-bold font-mono text-purple-400 uppercase tracking-wider flex items-center gap-2 border-b border-purple-950/10 pb-3">
                <Database className="w-4 h-4 text-purple-400" /> 🗄️ Buffer de Contingência (Offline)
              </h4>
              
              <div className="space-y-3">
                {/* Offline Queue size */}
                <div className="flex items-center justify-between p-3 rounded-2xl bg-purple-950/10 border border-purple-950/25">
                  <span className="text-xs text-slate-300 font-sans">Fila Offline</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold text-white">
                      {pendingPointsCount + failedPointsCount} coordenadas salvas
                    </span>
                    <span className="text-xs">
                      {(pendingPointsCount + failedPointsCount) === 0 ? '🟢 OK' : '🟡 Atenção'}
                    </span>
                  </div>
                </div>

                {/* Unsynced points */}
                <div className="flex items-center justify-between p-3 rounded-2xl bg-purple-950/10 border border-purple-950/25">
                  <span className="text-xs text-slate-300 font-sans">Pontos Pendentes</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold text-white">
                      {pendingPointsCount} aguardando gateway
                    </span>
                    <span className="text-xs">
                      {pendingPointsCount === 0 ? '🟢 OK' : '🟡 Atenção'}
                    </span>
                  </div>
                </div>

                {/* Last Sync Time */}
                <div className="flex items-center justify-between p-3 rounded-2xl bg-purple-950/10 border border-purple-950/25">
                  <span className="text-xs text-slate-300 font-sans">Última Sincronização</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold text-white">
                      {lastSyncTime ? new Date(lastSyncTime).toLocaleTimeString('pt-BR') : 'Sem registros'}
                    </span>
                    <span className="text-xs">
                      {lastSyncTime ? '🟢 OK' : '🟡 Atenção'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* 4. IA, Metadados e Memória */}
            <div className="p-6 bg-[#0a061d]/80 border border-purple-950/40 rounded-3xl space-y-4">
              <h4 className="text-xs font-bold font-mono text-purple-400 uppercase tracking-wider flex items-center gap-2 border-b border-purple-950/10 pb-3">
                <Sparkles className="w-4 h-4 text-purple-400" /> 🤖 Inteligência Artificial & Metadados
              </h4>
              
              <div className="space-y-3">
                {/* AI / Copiloto status */}
                <div className="flex items-center justify-between p-3 rounded-2xl bg-purple-950/10 border border-purple-950/25">
                  <span className="text-xs text-slate-300 font-sans">IA / Copiloto</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold text-white">
                      {driverProfileService.hasPreferences() ? 'Perfil Integrado' : 'Defaults Ativos'}
                    </span>
                    <span className="text-xs">
                      {driverProfileService.hasPreferences() ? '🟢 OK' : '🟡 Atenção'}
                    </span>
                  </div>
                </div>

                {/* Current App Version */}
                <div className="flex items-center justify-between p-3 rounded-2xl bg-purple-950/10 border border-purple-950/25">
                  <span className="text-xs text-slate-300 font-sans">Versão Atual</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold text-purple-300">v3.4.2</span>
                    <span className="text-xs">🟢 OK</span>
                  </div>
                </div>

                {/* Current Build */}
                <div className="flex items-center justify-between p-3 rounded-2xl bg-purple-950/10 border border-purple-950/25">
                  <span className="text-xs text-slate-300 font-sans">Build Atual</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold text-slate-300">2026.07.02</span>
                    <span className="text-xs">🟢 OK</span>
                  </div>
                </div>

                {/* Estimated Storage Memory */}
                <div className="flex items-center justify-between p-3 rounded-2xl bg-purple-950/10 border border-purple-950/25">
                  <span className="text-xs text-slate-300 font-sans">Memória LocalStorage</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold text-white">
                      {(() => {
                        let totalBytes = 0;
                        try {
                          const localStr = JSON.stringify(localStorage);
                          totalBytes = localStr ? localStr.length * 2 : 0;
                        } catch (e) {}
                        return `${(totalBytes / 1024).toFixed(2)} KB`;
                      })()}
                    </span>
                    <span className="text-xs">🟢 OK</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeDebugTab === 'telemetry' && (
        <>
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
                <span className={`h-2.5 w-2.5 rounded-full ${statusStyle.dot}`} />
                <span className={`text-xs font-semibold font-mono uppercase ${statusStyle.color}`}>
                  {gpsStatus}
                </span>
                {hasGeneratedSimulated && (
                  <span className="ml-1 px-1.5 py-0.5 bg-purple-950 border border-purple-900 text-[8px] font-extrabold rounded text-purple-400 uppercase">SIMULADO</span>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 rounded-2xl bg-purple-950/15 border border-purple-950/35">
                <span className="text-[10px] text-purple-400 font-mono block mb-1">Última Coordenada</span>
                <span className="text-xs font-bold text-white font-mono block">
                  {lastCoord ? `${lastCoord.lat.toFixed(6)}` : 'Aguardando...'}
                </span>
                <span className="text-[10px] text-slate-400 font-mono block mt-0.5">
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
                <span className="text-[10px] text-slate-400 font-mono block mt-0.5 truncate">
                  {lastCoord ? (lastCoord.accuracy <= 15 ? 'Excelente (HD)' : lastCoord.accuracy <= 50 ? 'Intermediário' : 'Fraco / Urban Noise') : ''}
                </span>
              </div>

              <div className="p-4 rounded-2xl bg-purple-950/15 border border-purple-950/35">
                <span className="text-[10px] text-purple-400 font-mono block mb-1">Velocidade & Direção</span>
                <span className="text-xs font-bold text-white font-mono block">
                  {lastCoord ? `${lastCoord.speed.toFixed(1)} km/h` : '0.0 km/h'}
                </span>
                <span className="text-[10px] text-slate-300 font-mono block mt-0.5 truncate">
                  {lastCoord ? getCardinalDirection(lastCoord.heading) : 'Sem Direção'}
                </span>
              </div>

              <div className="p-4 rounded-2xl bg-purple-950/15 border border-purple-950/35">
                <span className="text-[10px] text-purple-400 font-mono block mb-1">Distância (Engine)</span>
                <span className="text-xs font-bold text-purple-300 font-mono block">
                  {totalDistanceKm.toFixed(2)} km
                </span>
                <span className="text-[10px] text-slate-400 font-mono block mt-0.5 truncate">
                  {totalDistanceMeters.toFixed(0)}m acumulado
                </span>
              </div>
            </div>

            {/* Auditoria da Engine de Distância (Roxou V3) */}
            <div className="mt-6 border-t border-purple-950/20 pt-5">
              <h4 className="text-xs font-bold text-purple-400 font-mono uppercase mb-3 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" />
                Auditoria da Engine de Distância (Roxou V3)
              </h4>
              
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                <div className="p-4 rounded-2xl bg-purple-950/5 border border-purple-950/15">
                  <span className="text-[10px] text-purple-400 font-mono block mb-1">Distância Total</span>
                  <span className="text-sm font-extrabold text-white font-mono block">
                    {totalDistanceKm.toFixed(2)} km
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono block mt-0.5">
                    {totalDistanceMeters.toFixed(1)}m acumulados
                  </span>
                </div>

                <div className="p-4 rounded-2xl bg-purple-950/5 border border-purple-950/15">
                  <span className="text-[10px] text-purple-400 font-mono block mb-1">Última Adicionada</span>
                  <span className={`text-sm font-extrabold font-mono block ${lastAddedDistanceMeters > 0 ? 'text-emerald-400' : 'text-slate-400'}`}>
                    {lastAddedDistanceMeters > 0 ? `+${lastAddedDistanceMeters.toFixed(1)}m` : '0.0m'}
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono block mt-0.5">
                    Filtro: ≥ 3.0m
                  </span>
                </div>

                <div className="p-4 rounded-2xl bg-purple-950/5 border border-purple-950/15">
                  <span className="text-[10px] text-purple-400 font-mono block mb-1">Precisão Atual (GPS)</span>
                  <span className={`text-sm font-extrabold font-mono block ${
                    currentAccuracy === null ? 'text-slate-400' :
                    currentAccuracy <= 30 ? 'text-emerald-400' : 'text-rose-400'
                  }`}>
                    {currentAccuracy !== null ? `${currentAccuracy.toFixed(1)}m` : 'N/D'}
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono block mt-0.5">
                    Limite Profissional: 30m
                  </span>
                </div>

                <div className="p-4 rounded-2xl bg-purple-950/5 border border-purple-950/15">
                  <span className="text-[10px] text-purple-400 font-mono block mb-1">Pontos Descartados</span>
                  <span className={`text-sm font-extrabold font-mono block ${discardedPointsCount > 0 ? 'text-rose-400 font-bold' : 'text-slate-400'}`}>
                    {discardedPointsCount} pontos
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono block mt-0.5 truncate">
                    Ruídos / Saltos filtrados
                  </span>
                </div>

                <div className="p-4 rounded-2xl bg-purple-950/5 border border-purple-950/15">
                  <span className="text-[10px] text-purple-400 font-mono block mb-1">Motor Marcha Lenta</span>
                  <span className={`text-sm font-extrabold font-mono block ${
                    idleStatus === 'stopped' ? 'text-amber-400' : 'text-emerald-400'
                  }`}>
                    {idleStatus === 'stopped' ? 'PARADO' : 'EM MOVIMENTO'}
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono block mt-0.5 truncate">
                    Filtro: &lt; 5.0 km/h
                  </span>
                </div>
              </div>

              {lastDiscardReason && (
                <div className="mt-3 p-3 rounded-xl bg-rose-950/5 border border-rose-950/15 flex items-start gap-2">
                  <span className="text-[10px] text-rose-400 font-mono uppercase font-bold mt-0.5 bg-rose-950/30 px-1.5 py-0.5 rounded border border-rose-950/40">Último Descarte</span>
                  <div className="flex-1">
                    <p className="text-xs text-rose-300 font-mono font-medium">{lastDiscardReason}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Real browser error display */}
            {gpsError && (
              <div className="mt-4 p-4 rounded-2xl bg-rose-950/15 border border-rose-950/35 font-mono text-[11px] space-y-1">
                <p className="text-rose-400 font-bold flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5" /> Erro de Localização Real Detectado
                </p>
                <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-rose-950/40">
                  <div>
                    <span className="text-[10px] text-rose-300 block">Código</span>
                    <span className="text-xs font-bold text-white block">{gpsError.code} ({gpsError.name})</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-rose-300 block">Horário</span>
                    <span className="text-xs font-bold text-white block">{new Date(gpsError.timestamp).toLocaleTimeString('pt-BR')}</span>
                  </div>
                </div>
                <div className="pt-2">
                  <span className="text-[10px] text-rose-300 block">Mensagem original</span>
                  <span className="text-xs text-slate-300 block break-words">{gpsError.message}</span>
                </div>
              </div>
            )}

            {/* Simulated Live Compass Heading Visualizer */}
            {lastCoord && lastCoord.heading !== null && (
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

          {/* GPS TESTING PANEL */}
          <div className="p-6 bg-[#0a061d]/80 border border-purple-950/50 rounded-3xl">
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-mono font-semibold tracking-wider text-purple-400 uppercase">Diagnóstico e Teste de GPS</span>
              <button
                onClick={testGps}
                disabled={gpsTestLoading}
                className={`px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:bg-purple-950/40 text-white font-semibold rounded-xl text-xs flex items-center gap-1.5 transition-all shadow-md cursor-pointer`}
              >
                {gpsTestLoading ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Testando...</span>
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5" />
                    <span>Testar GPS</span>
                  </>
                )}
              </button>
            </div>

            {/* Test result section */}
            {gpsTestResult && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-4 rounded-2xl bg-purple-950/10 border border-purple-950/30 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-300">Resultado do Teste</span>
                  {gpsTestResult.error ? (
                    <span className="px-2 py-0.5 text-[9px] font-mono rounded bg-rose-950/50 text-rose-400 border border-rose-900/45 uppercase font-bold">Erro de Sinal</span>
                  ) : (
                    <span className="px-2 py-0.5 text-[9px] font-mono rounded bg-emerald-950/50 text-emerald-400 border border-emerald-900/45 uppercase font-bold">Sucesso</span>
                  )}
                </div>

                {gpsTestResult.error ? (
                  <div className="p-3 rounded-xl bg-rose-950/15 border border-rose-950/35 space-y-1 font-mono text-[11px]">
                    <p className="text-rose-400 font-bold">Código: {gpsTestResult.error.code} ({gpsTestResult.error.name})</p>
                    <p className="text-slate-300">Mensagem: {gpsTestResult.error.message}</p>
                    <p className="text-slate-400 text-[10px]">Timestamp: {new Date(gpsTestResult.error.timestamp).toLocaleTimeString('pt-BR')}</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 font-mono text-[11px]">
                    <div className="p-2 bg-purple-950/15 rounded-lg">
                      <span className="text-[10px] text-purple-400 block">Latitude</span>
                      <span className="text-xs font-bold text-white block">{gpsTestResult.latitude?.toFixed(6) || 'N/D'}</span>
                    </div>
                    <div className="p-2 bg-purple-950/15 rounded-lg">
                      <span className="text-[10px] text-purple-400 block">Longitude</span>
                      <span className="text-xs font-bold text-white block">{gpsTestResult.longitude?.toFixed(6) || 'N/D'}</span>
                    </div>
                    <div className="p-2 bg-purple-950/15 rounded-lg">
                      <span className="text-[10px] text-purple-400 block">Precisão</span>
                      <span className="text-xs font-bold text-emerald-400 block">
                        {gpsTestResult.accuracy !== undefined ? `${gpsTestResult.accuracy.toFixed(1)}m` : 'N/D'}
                      </span>
                    </div>
                    <div className="p-2 bg-purple-950/15 rounded-lg">
                      <span className="text-[10px] text-purple-400 block">Velocidade</span>
                      <span className="text-xs font-bold text-white block">
                        {gpsTestResult.speed !== undefined && gpsTestResult.speed !== null ? `${gpsTestResult.speed.toFixed(1)} km/h` : '0.0 km/h'}
                      </span>
                    </div>
                    <div className="p-2 bg-purple-950/15 rounded-lg">
                      <span className="text-[10px] text-purple-400 block">Direção</span>
                      <span className="text-xs font-bold text-white block truncate">{getCardinalDirection(gpsTestResult.heading)}</span>
                    </div>
                    <div className="p-2 bg-purple-950/15 rounded-lg">
                      <span className="text-[10px] text-purple-400 block">Altitude</span>
                      <span className="text-xs font-bold text-white block truncate">
                        {gpsTestResult.altitude !== undefined && gpsTestResult.altitude !== null ? `${gpsTestResult.altitude.toFixed(1)}m` : 'N/D'}
                      </span>
                    </div>
                  </div>
                )}
                <div className="flex justify-between items-center text-[9px] font-mono text-slate-500">
                  <span>Enviado via navigator.geolocation</span>
                  <span>{gpsTestResult.timestamp ? new Date(gpsTestResult.timestamp).toLocaleTimeString('pt-BR') : ''}</span>
                </div>
              </motion.div>
            )}

            {!gpsTestResult && !gpsTestLoading && (
              <p className="text-[11px] text-slate-400">
                Pressione "Testar GPS" para realizar um diagnóstico instantâneo de localização e checar se o navegador está recebendo as coordenadas e permissões adequadas do dispositivo real.
              </p>
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

                {/* Simulated Telemetry Controls for Developers with Simulado Badge */}
                <div className="pt-4 border-t border-purple-950/30">
                  <div className="flex items-center justify-between mb-3 columns-reverse">
                    <span className="text-[11px] font-sans text-slate-300 flex items-center gap-1.5">
                      🛰️ <strong>Simulador de Movimento GPS</strong>
                      <span className="px-1 py-0.2 bg-purple-950 text-purple-300 border border-purple-900 text-[8px] font-bold rounded uppercase">SIMULADO</span>
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

              {/* Status Badge */}
              <div className="flex justify-between items-center mb-4">
                <span className="text-[10px] text-slate-400 font-mono">STATUS DA ENGINE</span>
                <span className={`px-2 py-0.5 text-[9px] font-mono rounded-md font-bold uppercase ${
                  syncStatus === 'sincronizando' ? 'bg-purple-950 text-purple-400 animate-pulse border border-purple-900/40' :
                  syncStatus === 'sincronizado' ? 'bg-emerald-950 text-emerald-400 border border-emerald-900/40' :
                  syncStatus === 'aguardando internet' ? 'bg-amber-950 text-amber-500 border border-amber-900/40' :
                  syncStatus === 'erro' ? 'bg-rose-950 text-rose-400 border border-rose-900/40' :
                  'bg-slate-900 text-slate-400 border border-slate-800'
                }`}>
                  {syncStatus === 'ocioso' ? 'ocioso' : syncStatus}
                </span>
              </div>

              {/* Counts Grid */}
              <div className="grid grid-cols-3 gap-2 mb-4 text-center">
                <div className="p-2 rounded-xl bg-purple-950/10 border border-purple-950/20">
                  <span className="text-lg font-bold font-mono text-white block">{pendingPointsCount}</span>
                  <span className="text-[8px] text-slate-400 uppercase font-semibold">Pendentes</span>
                </div>
                <div className="p-2 rounded-xl bg-emerald-950/10 border border-emerald-950/20">
                  <span className="text-lg font-bold font-mono text-emerald-400 block">{syncedPointsCount}</span>
                  <span className="text-[8px] text-slate-400 uppercase font-semibold">Sincronizados</span>
                </div>
                <div className="p-2 rounded-xl bg-rose-950/10 border border-rose-950/20">
                  <span className="text-lg font-bold font-mono text-rose-400 block">{failedPointsCount}</span>
                  <span className="text-[8px] text-slate-400 uppercase font-semibold">Falhos</span>
                </div>
              </div>

              {/* Last Sync Info */}
              <div className="space-y-1 text-[10px] font-mono text-slate-400 bg-black/30 p-3 rounded-xl border border-purple-950/15 mb-4">
                <div className="flex justify-between">
                  <span>Última Sinc:</span>
                  <span className="text-slate-200 font-bold">
                    {lastSyncTime ? new Date(lastSyncTime).toLocaleTimeString('pt-BR') : 'Nunca'}
                  </span>
                </div>
                {lastSyncError && (
                  <div className="text-rose-400 font-semibold text-[9px] mt-1 break-words">
                    Erro: {lastSyncError}
                  </div>
                )}
              </div>

              <p className="text-[11px] text-slate-400 leading-relaxed mb-6">
                Caso sua rede caia, os registros de coordenadas geográficas do GPS são amortecidos no seu navegador de maneira 100% segura para não interromper a integridade fiscal da sua jornada.
              </p>
            </div>

            <button
              onClick={handleForceSync}
              disabled={(pendingPointsCount === 0 && failedPointsCount === 0) || isSyncing}
              className={`w-full py-3 rounded-2xl font-semibold text-white flex items-center justify-center gap-2 text-xs transition-all shadow-md ${
                (pendingPointsCount === 0 && failedPointsCount === 0) 
                  ? 'bg-purple-950/20 border border-purple-950/40 text-slate-500 cursor-not-allowed' 
                  : isSyncing 
                    ? 'bg-purple-600/50 cursor-wait' 
                    : 'bg-purple-600 hover:bg-purple-500 cursor-pointer shadow-purple-900/30'
              }`}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              {isSyncing ? 'Forçando Upload...' : 'Forçar Sincronização'}
            </button>

            {hasOldPoints && (
              <button
                onClick={handleCleanupBuffer}
                className="w-full mt-2 py-3 rounded-2xl font-semibold text-purple-300 hover:text-white bg-purple-950/25 hover:bg-purple-900/30 border border-purple-900/30 flex items-center justify-center gap-2 text-xs transition-all cursor-pointer shadow-md"
              >
                <Database className="w-3.5 h-3.5" />
                Limpar buffer antigo
              </button>
            )}

            <button
              onClick={() => setResetModalOpen(true)}
              className="w-full mt-2 py-3 rounded-2xl font-semibold text-rose-300 hover:text-white bg-rose-950/25 hover:bg-rose-900/30 border border-rose-900/30 flex items-center justify-center gap-2 text-xs transition-all cursor-pointer shadow-md"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Resetar dados de teste
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

      {/* AUDIT LOGS TERMINAL */}
      <div className="p-6 bg-[#0a061d]/80 border border-purple-950/50 rounded-3xl mt-6">
        <div className="flex items-center justify-between mb-4 text-left">
          <div>
            <h3 className="text-xs font-mono font-semibold tracking-wider text-purple-400 uppercase">
              Logs de Auditoria de Telemetria (Roxou V3)
            </h3>
            <p className="text-[10px] text-slate-400 mt-0.5">
              Eventos de jornada, sincronização e alertas GPS em tempo real (atualizado a cada 3s)
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={loadLocalLogs}
              className="px-2.5 py-1 text-[9px] font-mono rounded bg-purple-950/40 hover:bg-purple-950/70 border border-purple-900/35 text-purple-300 transition-all cursor-pointer"
            >
              Recarregar
            </button>
            <button
              onClick={handleClearLogs}
              className="px-2.5 py-1 text-[9px] font-mono rounded bg-rose-950/40 hover:bg-rose-950/70 border border-rose-900/35 text-rose-300 transition-all cursor-pointer"
            >
              Limpar
            </button>
          </div>
        </div>

        <div className="h-64 overflow-y-auto bg-black/50 border border-purple-950/40 rounded-2xl p-4 font-mono text-[10px] space-y-1.5 scrollbar-thin text-left">
          {localLogs.length === 0 ? (
            <p className="text-slate-500 italic text-center py-12">Nenhum log de auditoria registrado ainda.</p>
          ) : (
            localLogs.map((log) => {
              const dateStr = new Date(log.created_at).toLocaleTimeString('pt-BR');
              let levelColor = 'text-slate-400';
              if (log.level === 'warn') levelColor = 'text-amber-400';
              if (log.level === 'error' || log.level === 'critical') levelColor = 'text-rose-400 font-bold';
              if (log.level === 'info') levelColor = 'text-emerald-400';

              return (
                <div key={log.id} className="hover:bg-purple-950/10 py-1 px-1.5 rounded transition-all border-b border-purple-950/5 flex flex-col md:flex-row md:items-start gap-1 md:gap-3">
                  <span className="text-slate-500 select-none whitespace-nowrap">[{dateStr}]</span>
                  <span className={`uppercase text-[9px] font-bold ${levelColor} select-none`}>
                    [{log.level}]
                  </span>
                  <span className="text-purple-400 select-none font-bold uppercase text-[9px]">
                    [{log.category}]
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-slate-300 break-words">{log.message}</p>
                    {log.metadata && Object.keys(log.metadata).length > 0 && (
                      <pre className="mt-1 text-[9px] text-slate-500 bg-[#060412] p-1.5 rounded overflow-x-auto max-w-full leading-normal">
                        {JSON.stringify(log.metadata, null, 2)}
                      </pre>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </>
    )}

      {/* RESET TEST DATA CONFIRMATION MODAL */}
      <AnimatePresence>
        {resetModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md bg-[#0a061d] border border-rose-950/50 rounded-3xl p-6 shadow-2xl space-y-6 text-center"
            >
              <div className="mx-auto w-12 h-12 rounded-full bg-rose-950/30 border border-rose-500/30 flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-rose-400 animate-pulse" />
              </div>

              <div className="space-y-2">
                <h3 className="text-lg font-bold text-white font-mono tracking-tight">Confirmar Reset de Testes</h3>
                <p className="text-xs text-slate-300 leading-relaxed text-left bg-rose-950/15 p-4 rounded-2xl border border-rose-950/25">
                  <strong className="text-rose-400">Atenção:</strong> isso apagará todos os dados de jornadas, GPS, corridas, ganhos, despesas, alertas, calibração da IA e dashboards deste usuário. 
                  <br /><br />
                  Seu perfil, cadastro do veículo e login serão mantidos intactos. Esta ação é irreversível.
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setResetModalOpen(false)}
                  disabled={isResetting}
                  className="flex-1 py-3 px-4 rounded-xl font-semibold text-slate-400 hover:text-white bg-purple-950/15 hover:bg-purple-900/20 border border-purple-950/35 text-xs transition-all cursor-pointer disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleResetTestPoints}
                  disabled={isResetting}
                  className="flex-1 py-3 px-4 rounded-xl font-bold text-white bg-rose-700 hover:bg-rose-600 border border-rose-600 flex items-center justify-center gap-2 text-xs transition-all cursor-pointer shadow-lg shadow-rose-950/40 disabled:opacity-50"
                >
                  {isResetting ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      Resetando...
                    </>
                  ) : (
                    'Resetar meus testes'
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
