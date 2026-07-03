/**
 * Premium Active Journey Tracker Screen
 * Route: /jornada
 * Responsibility: Initiates tracking, displays active ride statistics, and monitors real-time GPS state.
 * 
 * STABLE CORE - NÃO ALTERAR SEM AUTORIZAÇÃO EXPLÍCITA
 */

import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { 
  Play, Square, MapPin, Navigation, Clock, ShieldAlert,
  AlertTriangle, Milestone, Activity, Compass, Flame, Info,
  Bot, Sparkles, ThumbsUp, ThumbsDown, Gauge, TrendingUp, Terminal, Check, X, RefreshCw,
  ChevronRight, ChevronDown, Signal, Edit, Calendar, BarChart3, Car, DollarSign
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
import { 
  persistCalibratedRide, 
  calculateCalibrationAnalytics, 
  CalibratedRide, 
  GpsTrackPoint, 
  validateRideData 
} from '../modules/journey/rideCalibration.service';
import { CalibrationRouteMap } from '../components/CalibrationRouteMap';
import { filterGpsNoise, snapTrackToRoads } from '../modules/journey/roadMatching.service';
import { RealTimeTrackerMap } from '../components/RealTimeTrackerMap';
import { TelemetryDebugModal } from '../components/TelemetryDebugModal';
import { DriverDetailsModal } from '../components/DriverDetailsModal';
import { CopilotCard } from '../modules/copilot-intelligence/components/CopilotCard';
import { leafletManager } from '../modules/maps/leafletManager';
import { errorTracker } from '../modules/observability/errorTracker';

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

// Helper to calculate exact vehicle consumption
export function calculateVehicleConsumption(distance: number, vehicle: any): { amount: number; unit: string } {
  if (!vehicle) return { amount: 0, unit: 'L' };
  const fuelType = vehicle.fuel_type?.toLowerCase() || '';
  const isElectric = fuelType === 'electric' || fuelType === 'elétrico' || fuelType === 'eletrico';
  if (isElectric) {
    const consumptionKwh100 = vehicle.electric_consumption_kwh_100km || 15;
    const amount = Number(((distance * consumptionKwh100) / 100).toFixed(2));
    return { amount, unit: 'kWh' };
  } else {
    const kmPerLiter = vehicle.km_per_liter || 10;
    const amount = Number((distance / kmPerLiter).toFixed(2));
    return { amount, unit: 'L' };
  }
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
    profile,
    addEarning,
    syncStatus,
    lastSyncError
  } = useApp();

  const [elapsedTime, setElapsedTime] = useState<string>('00:00:00');
  const [wakeLockActive, setWakeLockActive] = useState(false);
  const [wakeLockObj, setWakeLockObj] = useState<any | null>(null);

  const [isInstructionsOpen, setIsInstructionsOpen] = useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [currentStreetName, setCurrentStreetName] = useState<string>("Buscando localização...");
  const [activeTab, setActiveTab] = useState<'jornada' | 'desempenho' | 'copiloto'>('jornada');

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

  // Active ride state for calibration (Phase 6 individual ride workflow)
  const [activeRide, setActiveRide] = useState<any | null>(() => {
    try {
      const saved = localStorage.getItem('driverdash_active_ride_calib');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  // Ride logs for AI Calibration list and history
  const [rideLogs, setRideLogs] = useState<any[]>(() => {
    try {
      const saved = localStorage.getItem('ride_logs');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Modal control states
  const [finishModalOpen, setFinishModalOpen] = useState<boolean>(false);
  const [cancelModalOpen, setCancelModalOpen] = useState<boolean>(false);

  // Safe Journey Closure States (Requirement 4)
  const [journeyEndModalOpen, setJourneyEndModalOpen] = useState<boolean>(false);
  const [isSyncingBeforeEnd, setIsSyncingBeforeEnd] = useState<boolean>(false);
  const [syncStatusBeforeEnd, setSyncStatusBeforeEnd] = useState<'idle' | 'syncing' | 'success' | 'failed'>('idle');
  const [pendingPointsCountBeforeEnd, setPendingPointsCountBeforeEnd] = useState<number>(0);

  // Form states for active ride completion modal
  const [receivedValue, setReceivedValue] = useState<string>("15.00");
  const [platform, setPlatform] = useState<string>("Uber");
  const [tipValue, setTipValue] = useState<string>("0.00");
  const [tollValue, setTollValue] = useState<string>("0.00");
  const [observations, setObservations] = useState<string>("");
  
  // Auto-Geocoded GPS fields and fallbacks (no more manual inputs as primary)
  const [pickupAddress, setPickupAddress] = useState<string>("");
  const [pickupNeighborhood, setPickupNeighborhood] = useState<string>("");
  const [pickupCity, setPickupCity] = useState<string>("Presidente Prudente");
  
  const [destAddress, setDestAddress] = useState<string>("");
  const [destNeighborhood, setDestNeighborhood] = useState<string>("");
  const [destCity, setDestCity] = useState<string>("Presidente Prudente");

  const [isResolvingGeocode, setIsResolvingGeocode] = useState<boolean>(false);
  const [geocodeError, setGeocodeError] = useState<string | null>(null);
  const [showManualCorrection, setShowManualCorrection] = useState<boolean>(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [selectedClimate, setSelectedClimate] = useState<string>("Limpo");
  const [selectedSpecialEvent, setSelectedSpecialEvent] = useState<string>("Nenhum");

  // New Calibration States (Item 1, 6, 9)
  const [toast, setToast] = useState<{ show: boolean; message: string; type: 'success' | 'error' }>({
    show: false,
    message: '',
    type: 'success'
  });
  const [editingRide, setEditingRide] = useState<any | null>(null);
  const [editModalOpen, setEditModalOpen] = useState<boolean>(false);
  const [selectedRouteRide, setSelectedRouteRide] = useState<any | null>(null);
  const [isMapOpen, setIsMapOpen] = useState<boolean>(false);
  const [allowRealTimeMap, setAllowRealTimeMap] = useState<boolean>(true);
  const [selectedTelemetryRide, setSelectedTelemetryRide] = useState<any | null>(null);
  const [isSavingCalibration, setIsSavingCalibration] = useState<boolean>(false);
  const [showDebugDataModal, setShowDebugDataModal] = useState<boolean>(false);

  useEffect(() => {
    if (journeyEndModalOpen || finishModalOpen) {
      console.log('[MAP_BLOCKING_UI_DETECTED] Journey end or finish modal opened. Forcing map components to close and unmount.');
      setIsMapOpen(false);
      setSelectedRouteRide(null);
      leafletManager.destroyAll();
      console.log('[MAP_CLOSE]');
    }
  }, [journeyEndModalOpen, finishModalOpen]);

  useEffect(() => {
    if (toast.show) {
      const timer = setTimeout(() => {
        setToast(prev => ({ ...prev, show: false }));
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [toast.show]);

  // Automatic background synchronization of pending rides (Requirement 3)
  const syncPendingRides = async () => {
    try {
      const logsStr = localStorage.getItem('ride_logs');
      if (!logsStr) return;
      const logs = JSON.parse(logsStr);
      const pendingRides = logs.filter((r: any) => r.pending_sync === true);
      if (pendingRides.length === 0) return;

      console.log(`[SYNC_QUEUE] Encontradas ${pendingRides.length} corridas pendentes de sincronização.`);
      let updatedAny = false;

      for (const ride of pendingRides) {
        try {
          const { error: syncError } = await supabase
            .from('driver_ride_logs')
            .upsert({
              id: ride.id,
              journey_id: ride.journey_id || 'session_unknown',
              driver_id: ride.driver_id || 'driver_unknown',
              payload: { ...ride, pending_sync: false },
              created_at: new Date().toISOString()
            });

          if (!syncError) {
            console.log(`[SYNC_QUEUE] Corrida ${ride.id} sincronizada com sucesso.`);
            ride.pending_sync = false;
            updatedAny = true;
          } else {
            errorTracker.trackSupabaseError(`Sincronização de Corrida Pendente (${ride.id})`, syncError);
          }
        } catch (err) {
          console.error(`[SYNC_QUEUE] Erro ao sincronizar corrida ${ride.id}:`, err);
          errorTracker.trackSupabaseError(`Sincronização de Corrida Pendente Exception (${ride.id})`, err);
        }
      }

      if (updatedAny) {
        localStorage.setItem('ride_logs', JSON.stringify(logs));
        setRideLogs(logs);
      }
    } catch (err) {
      console.error('[SYNC_QUEUE] Erro no fluxo de sincronização automática:', err);
    }
  };

  useEffect(() => {
    // Attempt automatic sync on component mount
    syncPendingRides();

    // Re-attempt automatic sync when connectivity changes to online
    window.addEventListener('online', syncPendingRides);
    return () => {
      window.removeEventListener('online', syncPendingRides);
    };
  }, []);

  const getPreviewData = () => {
    if (!activeSession) return null;
    const valRecebido = parseFloat(receivedValue) || 15.00;
    const startLat = activeRide?.pickup_lat || activeRide?.startLocation?.lat || -22.1225;
    const startLng = activeRide?.pickup_lng || activeRide?.startLocation?.lng || -51.3883;
    const endLat = lastCoord?.lat || activeRide?.endLocation?.lat || -22.1225;
    const endLng = lastCoord?.lng || activeRide?.endLocation?.lng || -51.3883;

    const start_gps = { lat: startLat, lng: startLng };
    const end_gps = { lat: endLat, lng: endLng };

    const startOdo = activeRide ? activeRide.start_odometer : totalDistanceKm;
    const endOdo = totalDistanceKm;
    const odoDistance = Math.max(0, endOdo - startOdo);
    const haversineDist = calculateHaversineDistance(startLat, startLng, endLat, endLng);
    const distance = odoDistance > 0 ? odoDistance : haversineDist;

    const endTime = new Date().toISOString();
    const startTime = activeRide?.startTime || new Date().toISOString();
    const startMs = activeRide?.startLocation?.timestamp || new Date(startTime).getTime();
    const endMs = Date.now();
    const duration = Math.max(1, Math.round((endMs - startMs) / 1000));

    const costPerKm = calculateCostPerKmEstimate(vehicle, vehicleCostSettings) || 0.45;
    const vehicle_cost = Number((distance * costPerKm).toFixed(2));
    const profit = Number((valRecebido - vehicle_cost).toFixed(2));

    let totalIdleSec = activeRide?.totalIdleTime || 0;
    if (activeRide?.idleStartTimestamp) {
      totalIdleSec += (Date.now() - activeRide.idleStartTimestamp) / 1000;
    }
    const idle_time = Number((totalIdleSec / 60).toFixed(2));

    const consumptionObj = calculateVehicleConsumption(distance, vehicle);

    const trackPoints = activeRide?.rideTrackPoints || [];
    let maxSpeed = 0;
    let sumSpeed = 0;
    let countSpeed = 0;
    trackPoints.forEach((p: any) => {
      if (typeof p.speed === 'number' && p.speed >= 0) {
        if (p.speed > maxSpeed) maxSpeed = p.speed;
        sumSpeed += p.speed;
        countSpeed++;
      }
    });
    const finalMaxSpeedKmh = Number((maxSpeed * 3.6).toFixed(1));
    const finalAvgSpeedKmh = countSpeed > 0 ? Number(((sumSpeed / countSpeed) * 3.6).toFixed(1)) : 35.0;

    return {
      ride_id: activeRide?.id || 'ride_preview_' + Date.now(),
      origem: start_gps,
      embarque: {
        timestamp: activeRide?.pickup_timestamp || startTime,
        lat: startLat,
        lng: startLng
      },
      desembarque: {
        timestamp: endTime,
        lat: endLat,
        lng: endLng
      },
      rota_completa: trackPoints,
      distancia_real: Number(distance.toFixed(2)),
      duração: duration,
      velocidade_media: finalAvgSpeedKmh,
      velocidade_maxima: finalMaxSpeedKmh,
      tempo_parado: totalIdleSec,
      lucro: profit,
      custo: vehicle_cost,
      consumo: consumptionObj,
      pickup_neighborhood: pickupNeighborhood || activeRide?.pickup_neighborhood || 'Centro',
      destination_neighborhood: destNeighborhood || 'Centro',
      fare_value: valRecebido,
      platform,
      observations
    };
  };

  // Form states for active ride cancellation modal
  const [cancelReason, setCancelReason] = useState<string>("Passageiro");
  const [cancelObs, setCancelObs] = useState<string>("");

  const getPortugueseDayName = (date: Date): string => {
    const days = [
      'Domingo',
      'Segunda-feira',
      'Terça-feira',
      'Quarta-feira',
      'Quinta-feira',
      'Sexta-feira',
      'Sábado'
    ];
    return days[date.getDay()];
  };

  // Save ride logs to localStorage for AI learning patterns
  const saveRideToAnalytics = (ride: any) => {
    try {
      const existingLogsStr = localStorage.getItem('ride_logs');
      const existingLogs = existingLogsStr ? JSON.parse(existingLogsStr) : [];
      
      const calibratedRide = {
        ...ride,
        calibratedAt: new Date().toISOString(),
        timestamp: new Date().toISOString()
      };
      
      existingLogs.push(calibratedRide);
      localStorage.setItem('ride_logs', JSON.stringify(existingLogs));
    } catch (error) {
      console.error('Error saving ride logs to localStorage:', error);
    }
  };

  // Ride status state and handlers (Phase 6)
  const [isRideActive, setIsRideActive] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('driverdash_active_ride_calib');
      return saved ? JSON.parse(saved) !== null : false;
    } catch {
      return false;
    }
  });
  const [manualOverride, setManualOverride] = useState<boolean>(false);
  const [controlMode, setControlMode] = useState<'auto_tracking' | 'manual'>('auto_tracking');
  const journeyMode = activeSession ? 'active' : 'inactive';
  const manualMode = manualOverride;

  useEffect(() => {
    if (manualOverride) {
      setControlMode('manual');
    } else {
      setControlMode('auto_tracking');
    }
  }, [manualOverride]);

  // Controlled fallback: GPS and Telemetry continuous failure handler
  useEffect(() => {
    if (!activeSession) return;
    
    let failureTimer: any = null;
    
    const isGpsFailing = gpsStatus === 'GPS sem sinal' || gpsStatus === 'GPS erro' || gpsStatus === 'GPS negado' || !!gpsError;
    const isTelemetryFailing = syncStatus === 'erro' || !!lastSyncError;
    const isCriticalFailure = isGpsFailing || isTelemetryFailing;
    
    if (isCriticalFailure) {
      // If GPS or telemetry fails continuously for more than 45 seconds, activate manual override as a safe fallback
      failureTimer = setTimeout(() => {
        if (!manualOverride) {
          localStorage.setItem(`driverdash_ride_manual_override_${activeSession.id}`, 'true');
          setManualOverride(true);
          addAiLog(`[CRITICAL_FAILURE] Falha crítica de ${isGpsFailing ? 'GPS' : 'Telemetria'} detectada continuamente por mais de 45s. Ativando Modo Manual por segurança.`);
          if (addSmartAlert) {
            addSmartAlert({
              title: 'Modo Manual Ativado 🚨',
              description: `Falha contínua no sinal de ${isGpsFailing ? 'GPS' : 'sincronização'}. Modo Manual ativado para preservar dados locais.`,
              type: 'fuel',
              severity: 'high'
            });
          }
        }
      }, 45000); // 45 seconds continuous failure
    }
    
    return () => {
      if (failureTimer) {
        clearTimeout(failureTimer);
      }
    };
  }, [gpsStatus, gpsError, syncStatus, lastSyncError, activeSession, manualOverride, addSmartAlert]);

  // Compute stats for AI calibration dashboard
  const calibrationStats = useMemo(() => {
    const finishedRides = rideLogs.filter((r: any) => r.status === 'finished');
    const cancelledRides = rideLogs.filter((r: any) => r.status === 'cancelled');
    const totalFinished = finishedRides.length;
    
    // GPS positions collected across all tracked points + coordinates logged in active ride logs
    const gpsPointsCount = routePoints.length + (rideLogs.length * 2);
    
    // Total hours driven
    const totalDurationSeconds = finishedRides.reduce((acc: number, curr: any) => acc + (curr.duration || 0), 0);
    const totalHoursDriven = Number((totalDurationSeconds / 3600).toFixed(1));
    
    // Confidence and accuracy
    const calibrationProgress = Math.min(100, Math.round((totalFinished / 100) * 100));
    const isCalibrated = totalFinished >= 100;
    
    // Confidence levels
    let confidenceLevel = "Baixo (Calibrando...)";
    if (totalFinished >= 100) {
      confidenceLevel = "Excelente (Calibrada)";
    } else if (totalFinished >= 50) {
      confidenceLevel = "Alta (Pronta para Produção)";
    } else if (totalFinished >= 20) {
      confidenceLevel = "Média (Padrões Identificados)";
    } else if (totalFinished >= 5) {
      confidenceLevel = "Suficiente (Aprendendo...)";
    }

    const accuracyRate = totalFinished > 0 
      ? Math.min(99.8, 85 + (totalFinished * 0.4) - (cancelledRides.length * 0.2)) 
      : 95.8;

    return {
      totalFinished,
      gpsPointsCount,
      totalHoursDriven,
      accuracyRate: Number(accuracyRate.toFixed(1)),
      confidenceLevel,
      calibrationProgress,
      isCalibrated
    };
  }, [rideLogs, routePoints]);

  const calibrationAnalytics = useMemo(() => {
    return calculateCalibrationAnalytics(rideLogs);
  }, [rideLogs]);

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

  // Listener for key shortcut 'M' (only works if activeRide exists)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (activeRide && (e.key === 'm' || e.key === 'M')) {
        e.preventDefault();
        
        console.log('=== [RIDE] DIAGNÓSTICO DE CALIBRAÇÃO ATIVA ===');
        console.log('Corrida Ativa (activeRide):', activeRide);
        console.log('Status: EM ANDAMENTO');
        console.log('Tempo decorrido (segundos):', Math.round((Date.now() - new Date(activeRide.startTime).getTime()) / 1000));
        console.log('Sinal GPS (Precisão):', activeRide.gps_precision, 'm');
        console.log('Velocidade Inicial:', activeRide.velocity, 'm/s');
        console.log('KM Inicial da Jornada:', activeRide.start_odometer, 'km');
        console.log('Progresso de Calibração Geral:', `${calibrationStats.totalFinished}/100 corridas`);
        console.log('==============================================');
        
        const nextOverride = !manualOverride;
        setManualOverride(nextOverride);
        if (activeSession) {
          localStorage.setItem(`driverdash_ride_manual_override_${activeSession.id}`, nextOverride ? 'true' : 'false');
        }
        
        addAiLog(`[RideAI] [Shortcut M] Diagnóstico gerado no console. Override manual: ${nextOverride ? 'Ativo' : 'Inativo'}`);
        
        if (addSmartAlert) {
          addSmartAlert({
            title: 'Atalho M Acionado ⚡',
            description: `Modo Manual alternado para ${nextOverride ? 'ATIVADO' : 'DESATIVADO'}. Diagnóstico gerado no console.`,
            type: 'profit',
            severity: 'low'
          });
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [activeRide, manualOverride, activeSession, addSmartAlert, calibrationStats]);

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
      setIsRideActive(localStorage.getItem(`driverdash_ride_active_${activeSession.id}`) === 'true' || !!activeRide);
      setManualOverride(localStorage.getItem(`driverdash_ride_manual_override_${activeSession.id}`) === 'true');
      fetchStats();
    } else {
      setIsRideActive(false);
      setManualOverride(false);
    }
  }, [activeSession, activeRide]);

  // Main automatic detection loop
  useEffect(() => {
    if (!activeSession) return;

    const executeAiDetection = async () => {
      try {
        // Find if there is currently an active ride_started event
        const { data: activeLogs } = await supabase
          .from('driver_ride_logs')
          .select('*')
          .eq('journey_id', activeSession.id)
          .order('created_at', { ascending: false });

        const activeLog = activeLogs?.find((l: any) => l.payload?.status === 'in_progress' || l.payload?.event_type === 'ride_started');
        const activeEvents = activeLog ? [{
          id: activeLog.id,
          session_id: activeLog.journey_id,
          ...activeLog.payload
        }] : [];

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
        const hasActiveEvent = activeEvent !== null || activeRide !== null;
        setIsRideActive(hasActiveEvent);
        localStorage.setItem(`driverdash_ride_active_${activeSession.id}`, hasActiveEvent ? 'true' : 'false');

        // Check if there is an automated event that needs feedback confirmation
        if (hasActiveEvent && activeEvent && activeEvent.is_automated && !activeEvent.was_confirmed_manually) {
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
  }, [routePoints, activeSession, addSmartAlert, activeRide]);

  // Helpers for geographic fallback geocoding based on nearest distance in Presidente Prudente
  const getNearestNeighborhoodLocal = (lat: number, lng: number): { neighborhood: string, city: string } => {
    const regions = [
      { name: 'Centro', lat: -22.1225, lng: -51.3883, city: 'Presidente Prudente' },
      { name: 'Vila Industrial', lat: -22.1144, lng: -51.3811, city: 'Presidente Prudente' },
      { name: 'Jardim Bongiovani', lat: -22.1320, lng: -51.4020, city: 'Presidente Prudente' },
      { name: 'Jardim Paulista', lat: -22.1256, lng: -51.3992, city: 'Presidente Prudente' },
      { name: 'Jardim Aviação', lat: -22.1206, lng: -51.4092, city: 'Presidente Prudente' },
      { name: 'Parque do Povo', lat: -22.1264, lng: -51.4022, city: 'Presidente Prudente' },
      { name: 'Cohab', lat: -22.1180, lng: -51.4300, city: 'Presidente Prudente' },
      { name: 'Ana Jacinta', lat: -22.1642, lng: -51.4320, city: 'Presidente Prudente' },
      { name: 'Brasil Novo', lat: -22.0850, lng: -51.3950, city: 'Presidente Prudente' },
      { name: 'Montalvão', lat: -22.0650, lng: -51.4450, city: 'Presidente Prudente' },
      { name: 'Álvares Machado', lat: -22.0789, lng: -51.4719, city: 'Álvares Machado' },
      { name: 'Regente Feijó', lat: -22.2214, lng: -51.3031, city: 'Regente Feijó' },
      { name: 'Prudenshopping', lat: -22.1147, lng: -51.4068, city: 'Presidente Prudente' }
    ];

    let minDistance = Infinity;
    let nearest = regions[0];

    for (const r of regions) {
      const d = calculateHaversineDistance(lat, lng, r.lat, r.lng);
      if (d < minDistance) {
        minDistance = d;
        nearest = r;
      }
    }

    return { neighborhood: nearest.name, city: nearest.city };
  };

  const fetchAddressForCoordinates = async (lat: number, lng: number): Promise<{
    address: string,
    neighborhood: string,
    city: string,
    state: string,
    street: string,
    postalCode: string
  }> => {
    try {
      const response = await fetch(`/api/geocode?lat=${lat}&lng=${lng}`);
      if (response.ok) {
        const data = await response.json();
        const localFallback = getNearestNeighborhoodLocal(lat, lng);
        return {
          address: data.address || `${localFallback.neighborhood}, ${localFallback.city}`,
          neighborhood: data.neighborhood || localFallback.neighborhood,
          city: data.city || localFallback.city,
          state: data.state || 'SP',
          street: data.street || '',
          postalCode: data.postalCode || ''
        };
      }
    } catch (err) {
      console.error('[GEOCODE] Geocoding API failed, using local fallback:', err);
    }
    const local = getNearestNeighborhoodLocal(lat, lng);
    return {
      address: `${local.neighborhood}, ${local.city}, SP`,
      neighborhood: local.neighborhood,
      city: local.city,
      state: 'SP',
      street: '',
      postalCode: ''
    };
  };

  const saveToSupabaseRideLogs = async (rideLog: any) => {
    console.log('[SUPABASE_RIDE_LOGS] Sincronizando com banco remoto...', rideLog);
    try {
      const { data, error } = await supabase
        .from('driver_ride_logs')
        .insert([
          {
            id: rideLog.id,
            payload: rideLog,
            created_at: new Date().toISOString()
          }
        ]);
      if (error) {
        console.warn('[SUPABASE_RIDE_LOGS] Tabela opcional não disponível ou falha:', error.message);
      } else {
        console.log('[SUPABASE_RIDE_LOGS] Sincronizado com sucesso:', data);
      }
    } catch (err) {
      console.error('[SUPABASE_RIDE_LOGS] Sincronização remota falhou:', err);
    }
  };

  // Effect to record ride track points in real time (every 3 seconds or 10 meters) (Requirement 6)
  useEffect(() => {
    if (!isRideActive || !activeRide || !lastCoord) return;

    const now = Date.now();
    
    setActiveRide((prevRide: any) => {
      if (!prevRide || prevRide.status !== 'in_progress') return prevRide;
      const trackPoints = prevRide.rideTrackPoints || [];
      const lastPoint = trackPoints[trackPoints.length - 1];
      
      const elapsed = lastPoint ? (now - new Date(lastPoint.timestamp).getTime()) : 999999;
      
      // Calculate distance between previous position and current position
      const lastPos = prevRide.lastPosition || (lastPoint ? { lat: lastPoint.lat, lng: lastPoint.lng } : null);
      let distance = 0;
      if (lastPos) {
        distance = calculateHaversineDistance(lastPos.lat, lastPos.lng, lastCoord.lat, lastCoord.lng) * 1000; // in meters
      }

      // Conforms to Requirement 6: "a cada 3 segundos OU 10 metros de deslocamento"
      if (elapsed < 3000 && distance < 10) {
        return prevRide; // Avoid too frequent updates unless shifted by 10 meters
      }

      // Idle Tracking Logic
      let idleStartTimestamp = prevRide.idleStartTimestamp;
      let totalIdleTime = prevRide.totalIdleTime || 0;
      let lastMovingTimestamp = prevRide.lastMovingTimestamp || now;

      if (distance < 8) {
        if (!idleStartTimestamp) {
          idleStartTimestamp = now;
        }
      } else {
        if (idleStartTimestamp) {
          const stopDurationMs = now - idleStartTimestamp;
          totalIdleTime += stopDurationMs / 1000; // keep totalIdleTime in seconds
          idleStartTimestamp = null;
        }
        lastMovingTimestamp = now;
      }

      // Determine movementState (MOVING > 8km/h, SLOW_MOVING 1-8km/h, IDLE = parado)
      let movementState = prevRide.movementState || 'IDLE';
      const currentSpeed = typeof lastCoord.speed === 'number' ? lastCoord.speed : 0;

      const isIdleDurationReached = idleStartTimestamp && (now - idleStartTimestamp >= 30000);

      if (isIdleDurationReached || (distance < 8 && movementState === 'IDLE')) {
        movementState = 'IDLE';
      } else if (currentSpeed > 8) {
        movementState = 'MOVING';
      } else if (currentSpeed >= 1) {
        movementState = 'SLOW_MOVING';
      } else {
        movementState = distance < 8 ? 'IDLE' : 'SLOW_MOVING';
      }

      // Requirement 2: GPS PROFISSIONAL (lat, lng, accuracy, altitude, heading, speed, timestamp)
      const newPoint = {
        lat: lastCoord.lat,
        lng: lastCoord.lng,
        accuracy: lastCoord.accuracy,
        altitude: typeof lastCoord.altitude === 'number' ? lastCoord.altitude : null,
        heading: typeof lastCoord.heading === 'number' ? lastCoord.heading : null,
        speed: typeof lastCoord.speed === 'number' ? lastCoord.speed : 0,
        timestamp: new Date().toISOString()
      };
      
      const updatedTrackPoints = [...trackPoints, newPoint];

      // Requirement 3: FILTRO DE RUÍDO
      const noiseResult = filterGpsNoise(updatedTrackPoints);

      const updatedRide = {
        ...prevRide,
        rideTrackPoints: updatedTrackPoints,
        filteredTrackPoints: noiseResult.filteredPoints,
        discardedCount: noiseResult.discardedCount,
        lastPosition: { lat: lastCoord.lat, lng: lastCoord.lng },
        lastMovingTimestamp,
        idleStartTimestamp,
        totalIdleTime,
        movementState
      };
      
      localStorage.setItem('driverdash_active_ride_calib', JSON.stringify(updatedRide));

      // Requirement 4: LOGS ESTRUTURADOS
      console.log('=== [PROFESSIONAL_TRACKER] TELEMETRIA GPS CAPTURADA ===');
      console.log(`- GPS capturado: Lat: ${newPoint.lat}, Lng: ${newPoint.lng}`);
      console.log(`- Precisão do GPS: ${newPoint.accuracy}m | Altitude: ${newPoint.altitude}m | Direção: ${newPoint.heading}°`);
      console.log(`- Velocidade instantânea: ${newPoint.speed} km/h`);
      console.log(`- Bairro atual do motorista: ${prevRide.pickup_neighborhood || 'N/A'}`);
      console.log(`- Cidade atual do motorista: ${prevRide.pickup_city || 'N/A'}`);
      console.log(`- Distância calculada desde último ponto: ${distance.toFixed(1)} metros`);
      console.log(`- Pontos totais: ${updatedTrackPoints.length} | Filtrados/Smoothed: ${noiseResult.filteredPoints.length} | Descartados: ${noiseResult.discardedCount}`);
      console.log(`- Tempo parado nesta corrida: ${totalIdleTime.toFixed(1)} segundos`);
      console.log(`- Tempo em movimento nesta corrida: ${((now - new Date(prevRide.startTime).getTime()) / 1000 - totalIdleTime).toFixed(1)} segundos`);
      console.log('========================================================');

      return updatedRide;
    });
  }, [lastCoord, isRideActive]);

  const handleAcceptRideFromIdle = async () => {
    try {
      pendingAcceptRideRef.current = true;
      setAllowRealTimeMap(true);
      await startSession();
      await requestWakeLock();
    } catch (err) {
      console.error("[IDLE_ACCEPT] Erro ao aceitar corrida a partir do standby:", err);
    }
  };

  const handleAcceptRide = async () => {
    if (!activeSession) return;
    try {
      addAiLog('[RideAI] Aceitando corrida manualmente - mantendo Modo Automático ativo');

      const lat = lastCoord?.lat || -22.1225;
      const lng = lastCoord?.lng || -51.3883;
      const timestamp = Date.now();
      const accuracy = lastCoord?.accuracy || 10;

      if (!lastCoord && addSmartAlert) {
        addSmartAlert({
          title: 'Atenção 📡',
          description: 'Ative a localização para calibração precisa',
          type: 'fuel',
          severity: 'high'
        });
      }

      const localGeocode = getNearestNeighborhoodLocal(lat, lng);
      const rideId = 'ride_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
      
      const initialSpeed = lastCoord?.speed || 0;
      const initialMovementState = initialSpeed > 8 
        ? 'MOVING' 
        : (initialSpeed >= 1 ? 'SLOW_MOVING' : 'IDLE');

      const newRide: any = {
        id: rideId,
        startTime: new Date().toISOString(),
        pickup: { lat, lng },
        gps_precision: accuracy,
        velocity: initialSpeed,
        start_odometer: totalDistanceKm,
        status: 'in_progress',
        startLocation: {
          lat,
          lng,
          timestamp,
          accuracy
        },
        pickup_address: `${localGeocode.neighborhood}, ${localGeocode.city}`,
        pickup_neighborhood: localGeocode.neighborhood,
        pickup_city: localGeocode.city,
        pickup_state: 'SP',
        pickup_street: '',
        pickup_cep: '',
        rideTrackPoints: [
          {
            lat,
            lng,
            accuracy,
            altitude: lastCoord?.altitude || null,
            heading: lastCoord?.heading || null,
            speed: initialSpeed,
            timestamp: new Date().toISOString()
          }
        ],
        filteredTrackPoints: [
          {
            lat,
            lng,
            accuracy,
            altitude: lastCoord?.altitude || null,
            heading: lastCoord?.heading || null,
            speed: initialSpeed,
            timestamp: new Date().toISOString()
          }
        ],
        discardedCount: 0,
        // Idle Tracking States
        lastPosition: { lat, lng },
        lastMovingTimestamp: timestamp,
        idleStartTimestamp: initialMovementState === 'IDLE' ? timestamp : null,
        totalIdleTime: 0,
        movementState: initialMovementState
      };

      setPickupAddress(newRide.pickup_address);
      setPickupNeighborhood(newRide.pickup_neighborhood);
      setPickupCity(newRide.pickup_city);

      setActiveRide(newRide);
      localStorage.setItem('driverdash_active_ride_calib', JSON.stringify(newRide));
      window.dispatchEvent(new Event('driverdash_active_ride_change'));

      // Async fetch high-fidelity address
      fetchAddressForCoordinates(lat, lng).then((resolved) => {
        setActiveRide((prev: any) => {
          if (!prev || prev.id !== rideId) return prev;
          const updated = {
            ...prev,
            pickup_address: resolved.address,
            pickup_neighborhood: resolved.neighborhood,
            pickup_city: resolved.city,
            pickup_state: resolved.state,
            pickup_street: resolved.street,
            pickup_cep: resolved.postalCode
          };
          localStorage.setItem('driverdash_active_ride_calib', JSON.stringify(updated));
          return updated;
        });
        setPickupAddress(resolved.address);
        setPickupNeighborhood(resolved.neighborhood);
        setPickupCity(resolved.city);
      });

      console.log('[RIDE] Corrida aceita com GPS real:', newRide);

      const eventId = await startRide(activeSession.id, lat, lng);
      
      const { data: existing } = await supabase
        .from('driver_ride_logs')
        .select('payload')
        .eq('id', eventId)
        .maybeSingle();

      const currentPayload = existing?.payload || {};
      const updatedPayload = {
        ...currentPayload,
        is_automated: false,
        confidence_score: 100,
        classification_reason: 'Iniciada manualmente pelo motorista (Override)',
        was_confirmed_manually: true
      };

      await supabase
         .from('driver_ride_logs')
         .update({
           payload: updatedPayload
         })
         .eq('id', eventId);

      localStorage.setItem(`driverdash_ride_active_${activeSession.id}`, 'true');
      localStorage.setItem(`driverdash_active_event_id_${activeSession.id}`, eventId);
      setIsRideActive(true);
      
      if (addSmartAlert) {
        addSmartAlert({
          title: 'Corrida Iniciada ⚡',
          description: `Origem detectada automaticamente: ${localGeocode.neighborhood}`,
          type: 'profit',
          severity: 'low'
        });
      }

      await fetchStats();
    } catch (err) {
      console.error("Failed to start ride event:", err);
    }
  };

  const handlePassengerBoarded = () => {
    if (!activeRide) return;
    const now = new Date().toISOString();
    const lat = lastCoord?.lat || -22.1225;
    const lng = lastCoord?.lng || -51.3883;

    const updatedRide = {
      ...activeRide,
      pickup_timestamp: now,
      pickup_lat: lat,
      pickup_lng: lng
    };

    setActiveRide(updatedRide);
    localStorage.setItem('driverdash_active_ride_calib', JSON.stringify(updatedRide));

    addAiLog('[RideAI] Passageiro embarcou (Coordenadas e timestamp registrados)');

    if (addSmartAlert) {
      addSmartAlert({
        title: 'Passageiro Embarcou! 👥',
        description: 'Embarque registrado com sucesso. Tempo com passageiro sendo cronometrado.',
        type: 'profit',
        severity: 'low'
      });
    }
  };

  const handleFinishRide = async () => {
    if (!activeSession) return;

    setReceivedValue("15.00");
    setPlatform("Uber");
    setTipValue("0.00");
    setTollValue("0.00");
    setObservations("");
    setGeocodeError(null);
    setSaveError(null);
    setShowManualCorrection(false);

    const lat = lastCoord?.lat || -22.1225;
    const lng = lastCoord?.lng || -51.3883;
    const timestamp = Date.now();

    if (!lastCoord && addSmartAlert) {
      addSmartAlert({
        title: 'Atenção 📡',
        description: 'Ative a localização para calibração precisa',
        type: 'fuel',
        severity: 'high'
      });
    }

    const localGeocode = getNearestNeighborhoodLocal(lat, lng);

    const updatedRide = {
      ...activeRide,
      endLocation: {
        lat,
        lng,
        timestamp
      },
      destination_address: `${localGeocode.neighborhood}, ${localGeocode.city}`,
      destination_neighborhood: localGeocode.neighborhood,
      destination_city: localGeocode.city,
      destination_state: 'SP',
      destination_street: '',
      destination_cep: ''
    };

    setActiveRide(updatedRide);
    localStorage.setItem('driverdash_active_ride_calib', JSON.stringify(updatedRide));

    setDestAddress(updatedRide.destination_address);
    setDestNeighborhood(updatedRide.destination_neighborhood);
    setDestCity(updatedRide.destination_city);

    setPickupAddress(activeRide?.pickup_address || `${localGeocode.neighborhood}, ${localGeocode.city}`);
    setPickupNeighborhood(activeRide?.pickup_neighborhood || localGeocode.neighborhood);
    setPickupCity(activeRide?.pickup_city || localGeocode.city);

    setAllowRealTimeMap(false);
    setFinishModalOpen(true);
    setIsResolvingGeocode(true);

    try {
      const resolved = await fetchAddressForCoordinates(lat, lng);
      setDestAddress(resolved.address);
      setDestNeighborhood(resolved.neighborhood);
      setDestCity(resolved.city);
      
      setActiveRide((prev: any) => {
        if (!prev) return prev;
        const updated = {
          ...prev,
          destination_address: resolved.address,
          destination_neighborhood: resolved.neighborhood,
          destination_city: resolved.city,
          destination_state: resolved.state,
          destination_street: resolved.street,
          destination_cep: resolved.postalCode
        };
        localStorage.setItem('driverdash_active_ride_calib', JSON.stringify(updated));
        return updated;
      });
    } catch (err) {
      console.error('[GEOCODE] Error geocoding end location:', err);
      setGeocodeError('Não foi possível obter endereço real via GPS. Usando fallback local.');
    } finally {
      setIsResolvingGeocode(false);
    }
  };

  const handleConfirmFinishRide = async () => {
    if (!activeSession) return;
    setSaveError(null);
    setIsSavingCalibration(true);

    // [CALIBRATION_SAVE_START] Log indicating start of calibration save flow
    console.log('[CALIBRATION_SAVE_START] Iniciando salvamento de calibração...');

    try {
      addAiLog('[CALIBRATION_SAVE] Iniciando salvamento manual - mantendo Modo Automático ativo');

      // 1. Validar dados obrigatórios:
      // - valor recebido
      const valRecebido = parseFloat(receivedValue);
      if (isNaN(valRecebido) || valRecebido < 0) {
        throw new Error('O valor recebido é obrigatório e deve ser maior ou igual a zero.');
      }

      // - origem GPS
      const startLat = activeRide?.pickup_lat || activeRide?.startLocation?.lat;
      const startLng = activeRide?.pickup_lng || activeRide?.startLocation?.lng;
      if (!startLat || !startLng || isNaN(startLat) || isNaN(startLng) || (startLat === 0 && startLng === 0)) {
        throw new Error('A origem GPS é obrigatória e deve ser válida.');
      }
      const start_gps = { lat: startLat, lng: startLng };

      // - destino GPS
      const endLat = lastCoord?.lat || activeRide?.endLocation?.lat || -22.1225;
      const endLng = lastCoord?.lng || activeRide?.endLocation?.lng || -51.3883;
      if (!endLat || !endLng || isNaN(endLat) || isNaN(endLng) || (endLat === 0 && endLng === 0)) {
        throw new Error('O destino GPS é obrigatório e deve ser válido.');
      }
      const end_gps = { lat: endLat, lng: endLng };

      // - distância
      const startOdo = activeRide ? activeRide.start_odometer : totalDistanceKm;
      const endOdo = totalDistanceKm;
      const odoDistance = Math.max(0, endOdo - startOdo);
      const haversineDist = calculateHaversineDistance(startLat, startLng, endLat, endLng);
      const distance = odoDistance > 0 ? odoDistance : haversineDist;
      if (isNaN(distance) || distance <= 0) {
        throw new Error('A distância percorrida é obrigatória e deve ser maior que zero.');
      }

      // - tempo de corrida e cronometragem
      const endTime = new Date().toISOString();
      const startTime = activeRide?.startTime || new Date().toISOString();
      const startMs = activeRide?.startLocation?.timestamp || new Date(startTime).getTime();
      const endMs = Date.now();
      const duration = Math.max(1, Math.round((endMs - startMs) / 1000));
      if (isNaN(duration) || duration <= 0) {
        throw new Error('O tempo de corrida é obrigatório e deve ser maior que zero.');
      }

      // 2. Criar objeto ride_log completo:
      const costPerKm = calculateCostPerKmEstimate(vehicle, vehicleCostSettings) || 0.45;
      const vehicle_cost = Number((distance * costPerKm).toFixed(2));
      const profit = Number((valRecebido - vehicle_cost).toFixed(2));

      // idle_time (Minutos parado = totalIdleTime / 60)
      let totalIdleSec = activeRide?.totalIdleTime || 0;
      if (activeRide?.idleStartTimestamp) {
        totalIdleSec += (Date.now() - activeRide.idleStartTimestamp) / 1000;
      }
      const idle_time = Number((totalIdleSec / 60).toFixed(2));

      // tempo em movimento e tempo até o embarque
      const movingTimeSec = Math.max(0, duration - totalIdleSec);
      const pickupTimeMs = activeRide?.pickup_timestamp ? new Date(activeRide.pickup_timestamp).getTime() : startMs;
      const tempo_ate_embarque = Math.max(0, Math.round((pickupTimeMs - startMs) / 1000));

      // vehicle consumption
      const consumptionObj = calculateVehicleConsumption(distance, vehicle);

      // speed metrics
      const pts = activeRide?.rideTrackPoints || [];
      const filteredTrackPoints = activeRide?.filteredTrackPoints || pts;
      const discardedCount = activeRide?.discardedCount || 0;

      let maxSpeed = 0;
      let sumSpeed = 0;
      let countSpeed = 0;
      pts.forEach((p: any) => {
        if (typeof p.speed === 'number' && p.speed >= 0) {
          if (p.speed > maxSpeed) maxSpeed = p.speed;
          sumSpeed += p.speed;
          countSpeed++;
        }
      });
      const finalMaxSpeedKmh = Number((maxSpeed * 3.6).toFixed(1));
      const finalAvgSpeedKmh = countSpeed > 0 ? Number(((sumSpeed / countSpeed) * 3.6).toFixed(1)) : 35.0;

      // Call snapTrackToRoads for Google Roads API Snap-to-Road correction (Requirement 4 & 7)
      let matchedTrackPoints: any[] = [];
      let distanceSnappedKm = distance;
      let isSnapped = false;

      if (filteredTrackPoints.length >= 2) {
        addAiLog('[SNAP-TO-ROAD] Chamando Google Roads API para alinhamento profissional de rota...');
        try {
          const snapRes = await snapTrackToRoads(filteredTrackPoints);
          if (snapRes.success && snapRes.matchedPoints.length > 0) {
            matchedTrackPoints = snapRes.matchedPoints;
            isSnapped = true;
            // Calculate snapping-derived distance in km
            let snappedDistMeters = 0;
            for (let i = 1; i < matchedTrackPoints.length; i++) {
              snappedDistMeters += calculateHaversineDistance(
                matchedTrackPoints[i - 1].lat,
                matchedTrackPoints[i - 1].lng,
                matchedTrackPoints[i].lat,
                matchedTrackPoints[i].lng
              ) * 1000;
            }
            distanceSnappedKm = Number((snappedDistMeters / 1000).toFixed(2));
            addAiLog(`[SNAP-TO-ROAD] Rota corrigida com sucesso! Distância snapped: ${distanceSnappedKm.toFixed(2)} km vs real: ${distance.toFixed(2)} km`);
          } else {
            addAiLog('[SNAP-TO-ROAD] Nenhuma correspondência de via retornada. Utilizando GPS filtrado como fallback.');
          }
        } catch (snapErr: any) {
          console.error('[SNAP-TO-ROAD] Falha na chamada de alinhamento:', snapErr);
          addAiLog('[SNAP-TO-ROAD] Falha de comunicação. Utilizando GPS filtrado como fallback.');
        }
      }

      // Detailed telemetry analytics payload (Requirement 7 & 8)
      const telemetryAnalytics = {
        distancia_gps_bruto: Number(distance.toFixed(2)),
        distancia_corrigida_snapped: Number(distanceSnappedKm.toFixed(2)),
        distancia_divergencia_km: Number(Math.abs(distance - distanceSnappedKm).toFixed(2)),
        tempo_total_segundos: duration,
        tempo_parado_segundos: Math.round(totalIdleSec),
        tempo_movimento_segundos: Math.round(movingTimeSec),
        tempo_ate_embarque_segundos: tempo_ate_embarque,
        velocidade_media_kmh: finalAvgSpeedKmh,
        velocidade_maxima_kmh: finalMaxSpeedKmh,
        pontos_brutos: pts.length,
        pontos_filtrados: filteredTrackPoints.length,
        pontos_descartados: discardedCount,
        nivel_precisao_medio_metros: pts.length > 0 ? Number((pts.reduce((acc: number, p: any) => acc + (p.accuracy || 10), 0) / pts.length).toFixed(1)) : 10,
        origem_detalhes: {
          lat: startLat,
          lng: startLng,
          bairro: pickupNeighborhood || activeRide?.pickup_neighborhood || 'Centro',
          cidade: pickupCity || 'Presidente Prudente',
          estado: activeRide?.pickup_state || 'SP',
          logradouro: activeRide?.pickup_street || '',
          cep: activeRide?.pickup_cep || ''
        },
        destino_detalhes: {
          lat: endLat,
          lng: endLng,
          bairro: destNeighborhood || activeRide?.destination_neighborhood || 'Centro',
          cidade: destCity || 'Presidente Prudente',
          estado: activeRide?.destination_state || 'SP',
          logradouro: activeRide?.destination_street || '',
          cep: activeRide?.destination_cep || ''
        }
      };

      const ride_log = {
        ride_id: activeRide?.id || 'ride_' + Date.now(),
        start_gps,
        end_gps,
        pickup_neighborhood: pickupNeighborhood || activeRide?.pickup_neighborhood || 'Centro',
        destination_neighborhood: destNeighborhood || 'Centro',
        fare_value: valRecebido,
        distance: Number(distanceSnappedKm.toFixed(2)), // Use corrected distance as primary
        duration,
        idle_time,
        vehicle_cost,
        profit,
        timestamp: startTime,
        // Detailed calibration metrics (Requirement 6)
        origem: start_gps,
        embarque: {
          timestamp: activeRide?.pickup_timestamp || startTime,
          lat: startLat,
          lng: startLng
        },
        desembarque: {
          timestamp: endTime,
          lat: endLat,
          lng: endLng
        },
        rota_completa: pts,
        matchedTrackPoints: matchedTrackPoints,
        filteredTrackPoints: filteredTrackPoints,
        telemetryAnalytics: telemetryAnalytics,
        distancia_real: Number(distance.toFixed(2)),
        distancia_corrigida: Number(distanceSnappedKm.toFixed(2)),
        velocidade_media: finalAvgSpeedKmh,
        velocidade_maxima: finalMaxSpeedKmh,
        tempo_parado: totalIdleSec,
        lucro: profit,
        custo: vehicle_cost,
        consumo: consumptionObj
      };

      const rawRide: Partial<CalibratedRide> = {
        id: activeRide?.id || 'ride_' + Date.now(),
        journey_id: activeSession.id,
        driver_id: profile?.id || 'driver_unknown',
        status: 'finished',

        // Addresses & Locations
        bairroOrigem: ride_log.pickup_neighborhood,
        bairroDestino: ride_log.destination_neighborhood,
        cidadeOrigem: pickupCity || 'Presidente Prudente',
        cidadeDestino: destCity || 'Presidente Prudente',
        pickup_address: pickupAddress || '',
        destination_address: destAddress || '',

        // Time constraints
        startTime,
        endTime,
        pickup_timestamp: activeRide?.pickup_timestamp || startTime,
        pickup_lat: startLat,
        pickup_lng: startLng,
        dropoff_timestamp: endTime,
        dropoff_lat: endLat,
        dropoff_lng: endLng,

        // Financials
        platform,
        receivedValue: valRecebido,
        tipValue: parseFloat(tipValue) || 0,
        tollValue: parseFloat(tollValue) || 0,
        clima: selectedClimate || "Limpo",
        evento: selectedSpecialEvent || "Nenhum",
        observations,

        // Coordinates & Odometer
        rideTrackPoints: pts,
        matchedTrackPoints: matchedTrackPoints,
        filteredTrackPoints: filteredTrackPoints,
        start_odometer: startOdo,
        end_odometer: endOdo,

        // Embed the actual ride_log object
        ...ride_log,
        ride_log
      } as any;

      // Structured logging (Requirement 4)
      console.log('[STRUCTURED_LOG] GPS_CAPTURED:', { start_gps, end_gps });
      console.log('[STRUCTURED_LOG] BAIRRO_IDENTIFICADO:', { origem: ride_log.pickup_neighborhood, destino: ride_log.destination_neighborhood });
      console.log('[STRUCTURED_LOG] CIDADE_IDENTIFICADA:', { origem: rawRide.cidadeOrigem, destino: rawRide.cidadeDestino });
      console.log('[STRUCTURED_LOG] DISTANCIA_CALCULADA:', { odoDistance, haversineDist, distance });
      console.log('[STRUCTURED_LOG] TEMPO_PARADO:', totalIdleSec);
      console.log('[STRUCTURED_LOG] TEMPO_EM_MOVIMENTO:', movingTimeSec);
      console.log('[STRUCTURED_LOG] TEMPO_ATE_EMBARQUE:', tempo_ate_embarque);
      console.log('[STRUCTURED_LOG] TEMPO_DA_VIAGEM:', duration);
      console.log('[STRUCTURED_LOG] RESULTADO_REVERSE_GEOCODING:', { pickupAddress, destAddress });

      addAiLog(`[GPS_CAPTURED] Lat: ${startLat.toFixed(5)}, Lng: ${startLng.toFixed(5)} -> Lat: ${endLat.toFixed(5)}, Lng: ${endLng.toFixed(5)}`);
      addAiLog(`[BAIRRO_IDENTIFICADO] Origem: ${ride_log.pickup_neighborhood} | Destino: ${ride_log.destination_neighborhood}`);
      addAiLog(`[CIDADE_IDENTIFICADA] Origem: ${rawRide.cidadeOrigem} | Destino: ${rawRide.cidadeDestino}`);
      addAiLog(`[DISTANCIA_CALCULADA] Haversine: ${haversineDist.toFixed(2)} km | Odo: ${odoDistance.toFixed(2)} km | Final: ${distance.toFixed(2)} km`);
      addAiLog(`[TEMPO_PARADO] ${idle_time} min`);
      addAiLog(`[TEMPO_EM_MOVIMENTO] ${(movingTimeSec / 60).toFixed(2)} min`);
      addAiLog(`[TEMPO_ATE_EMBARQUE] ${(tempo_ate_embarque / 60).toFixed(2)} min`);
      addAiLog(`[TEMPO_DA_VIAGEM] ${(duration / 60).toFixed(2)} min`);
      addAiLog(`[RESULTADO_REVERSE_GEOCODING] Pickup: ${pickupAddress} | Dropoff: ${destAddress}`);

      console.log('[CALIBRATION_SAVE] Chamando persistCalibratedRide...', rawRide);
      const res = await persistCalibratedRide(rawRide);

      console.log('[STRUCTURED_LOG] RESULTADO_SALVAMENTO:', res);
      addAiLog(`[RESULTADO_SALVAMENTO] Sucesso: ${res.success}. Pendente de Sincronização: ${!!(res.ride as any)?.pending_sync}`);

      // STRICT PERSISTENCE VERIFICATION (Requirement 1)
      const verifiedLogsStr = localStorage.getItem('ride_logs');
      const verifiedLogs = verifiedLogsStr ? JSON.parse(verifiedLogsStr) : [];
      const isSavedLocal = verifiedLogs.some((l: any) => l.id === rawRide.id);
      if (!isSavedLocal) {
        throw new Error('Confirmação de salvamento falhou: O registro não foi encontrado no localStorage após a persistência.');
      }
      console.log('[CALIBRATION_SAVE_SUCCESS] Confirmação local bem-sucedida!');

      // Add earning to standard finance flow so upper cards update immediately (Requirement 8)
      try {
        const activeSessionDateStr = new Date(activeSession.start_time).toISOString().substring(0, 10);
        await addEarning({
          date: activeSessionDateStr,
          platform: platform as any,
          gross_amount: valRecebido,
          total_km: Number(distance.toFixed(2)),
          passenger_km: Number(distance.toFixed(2)),
          empty_km: 0,
          online_minutes: Math.ceil(duration / 60),
          waiting_minutes: Math.ceil(idle_time),
          rides_count: 1,
          notes: `Corrida calibrada salva - ID: ${rawRide.id}`,
          entry_mode: 'single_ride' as any,
          shift_period: 'morning' as any
        });
        console.log('[FINANCE_SYNC] Ganhos e custos sincronizados para os cards superiores.');
      } catch (earnErr) {
        console.error('[FINANCE_SYNC_ERROR] Falha ao adicionar ganho nas finanças:', earnErr);
      }

      if (!res.success) {
        if (res.ride?.pending_sync) {
          setToast({
            show: true,
            message: 'Aviso: Banco remoto offline. Corrida salva localmente para re-sync automático.',
            type: 'error'
          });

          // Update local logs state immediately using verified logs
          setRideLogs(verifiedLogs);

          setActiveRide(null);
          localStorage.removeItem('driverdash_active_ride_calib');

          // Stop GPS tracking since ride has finished
          window.dispatchEvent(new Event('driverdash_active_ride_change'));

          try {
            await finishRide(activeSession.id, res.ride.dropoff_lat || endLat, res.ride.dropoff_lng || endLng);
          } catch (err) {
            console.warn('[OFFLINE] Falha ao encerrar evento remoto, continuará offline.');
          }

          localStorage.setItem(`driverdash_ride_active_${activeSession.id}`, 'false');
          setIsRideActive(false);
          setFinishModalOpen(false);
          setAllowRealTimeMap(true);

          if (addSmartAlert) {
            addSmartAlert({
              title: 'Corrida Salva Localmente (Offline) ⚠️',
              description: `Conexão com Supabase falhou. R$ ${valRecebido.toFixed(2)} guardados localmente. Sincronização pendente.`,
              type: 'profit',
              severity: 'medium'
            });
          }

          await fetchStats();
          return;
        } else {
          throw new Error(res.error || 'Erro na validação da qualidade dos dados.');
        }
      }

      setToast({
        show: true,
        message: 'Corrida salva e sincronizada com o Supabase!',
        type: 'success'
      });

      // Update local logs state immediately using verified logs
      setRideLogs(verifiedLogs);

      setActiveRide(null);
      localStorage.removeItem('driverdash_active_ride_calib');

      // Stop GPS tracking since ride has finished
      window.dispatchEvent(new Event('driverdash_active_ride_change'));

      try {
        await finishRide(activeSession.id, res.ride.dropoff_lat || endLat, res.ride.dropoff_lng || endLng);
      } catch (err) {
        console.warn('Falha ao registrar encerramento da jornada no Supabase:', err);
      }

      localStorage.setItem(`driverdash_ride_active_${activeSession.id}`, 'false');
      setIsRideActive(false);
      setFinishModalOpen(false);
      setAllowRealTimeMap(true);

      if (addSmartAlert) {
        addSmartAlert({
          title: 'Corrida Calibrada com Sucesso! 🎯',
          description: `R$ ${valRecebido.toFixed(2)} salvos. Distância real: ${res.ride.distancia_hodometro || Number(distance.toFixed(2))} km (${pts.length} pontos GPS).`,
          type: 'profit',
          severity: 'low'
        });
      }

      await fetchStats();
    } catch (err: any) {
      // [CALIBRATION_SAVE_ERROR] Log indicating error in calibration save flow
      console.error("[CALIBRATION_SAVE_ERROR] Erro ao salvar calibração:", err);
      setSaveError(err?.message || 'Falha ao salvar dados de calibração. Verifique os campos.');
    } finally {
      setIsSavingCalibration(false);
    }
  };

  const handleCancelRide = () => {
    if (!activeSession) return;
    setCancelReason("Passageiro");
    setCancelObs("");
    setSaveError(null);
    setAllowRealTimeMap(false);
    setCancelModalOpen(true);
  };

  const handleCloseCancelRide = () => {
    setCancelModalOpen(false);
    setAllowRealTimeMap(true);
  };

  const handleCancelFinishRide = () => {
    setFinishModalOpen(false);
    setAllowRealTimeMap(true);
  };

  const handleConfirmCancelRide = async () => {
    if (!activeSession) return;
    setSaveError(null);
    setIsSavingCalibration(true);

    try {
      addAiLog('[CALIBRATION_CANCEL] Cancelando corrida ativa - mantendo Modo Automático ativo');

      const endTime = new Date().toISOString();
      const startTime = activeRide?.startTime || new Date().toISOString();
      const pts = activeRide?.rideTrackPoints || [];

      const rawRide: Partial<CalibratedRide> = {
        id: activeRide?.id || 'ride_' + Date.now(),
        journey_id: activeSession.id,
        driver_id: profile?.id || 'driver_unknown',
        status: 'cancelled',

        bairroOrigem: pickupNeighborhood || '',
        bairroDestino: destNeighborhood || '',
        cidadeOrigem: pickupCity || 'Presidente Prudente',
        cidadeDestino: destCity || 'Presidente Prudente',
        pickup_address: pickupAddress || '',
        destination_address: destAddress || '',

        startTime,
        endTime,
        platform: activeRide?.platform || "Uber",
        receivedValue: 0,
        tipValue: 0,
        tollValue: 0,
        clima: selectedClimate || "Limpo",
        evento: selectedSpecialEvent || "Nenhum",
        observations: cancelObs || `Cancelamento: ${cancelReason}`,

        rideTrackPoints: pts,
        start_odometer: activeRide ? activeRide.start_odometer : totalDistanceKm,
        end_odometer: totalDistanceKm
      };

      const res = await persistCalibratedRide(rawRide);
      let isOffline = false;
      if (!res.success) {
        if (res.ride?.pending_sync) {
          isOffline = true;
          setToast({
            show: true,
            message: 'Aviso: Banco remoto offline. Cancelamento salvo localmente.',
            type: 'error'
          });
        } else {
          throw new Error(res.error || 'Erro na validação do cancelamento.');
        }
      }

      if (!isOffline) {
        setToast({
          show: true,
          message: 'Corrida cancelada e salva para calibração da IA.',
          type: 'success'
        });
      }

      const updatedLogsStr = localStorage.getItem('ride_logs');
      const updatedLogs = updatedLogsStr ? JSON.parse(updatedLogsStr) : [];
      setRideLogs(updatedLogs);

      setActiveRide(null);
      localStorage.removeItem('driverdash_active_ride_calib');

      // Stop GPS tracking since ride has finished
      window.dispatchEvent(new Event('driverdash_active_ride_change'));

      try {
        await finishRide(activeSession.id, lastCoord?.lat || -22.1225, lastCoord?.lng || -51.3883);
      } catch (err) {
        console.warn('[OFFLINE] Falha ao encerrar evento remoto, continuará offline.');
      }

      localStorage.setItem(`driverdash_ride_active_${activeSession.id}`, 'false');
      setIsRideActive(false);
      setCancelModalOpen(false);
      setAllowRealTimeMap(true);

      if (addSmartAlert) {
        addSmartAlert({
          title: 'Corrida Cancelada ⚠️',
          description: `Cancelamento registrado para calibração. Motivo: ${cancelReason}.`,
          type: 'fuel',
          severity: 'low'
        });
      }

      await fetchStats();
    } catch (err: any) {
      console.error("[CALIBRATION_CANCEL] Erro salvando cancelamento:", err);
      setSaveError(err?.message || 'Falha ao salvar dados de calibração.');
    } finally {
      setIsSavingCalibration(false);
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

  const handleEditRide = (ride: any) => {
    setEditingRide(ride);
    setReceivedValue(ride.receivedValue?.toString() || "0.00");
    setPlatform(ride.platform || "Uber");
    setTipValue(ride.tipValue?.toString() || "0.00");
    setTollValue(ride.tollValue?.toString() || "0.00");
    setObservations(ride.observations || "");
    setPickupNeighborhood(ride.bairroOrigem || "");
    setDestNeighborhood(ride.bairroDestino || "");
    setPickupCity(ride.cidadeOrigem || "Presidente Prudente");
    setDestCity(ride.cidadeDestino || "Presidente Prudente");
    setSelectedClimate(ride.clima || "Limpo");
    setSelectedSpecialEvent(ride.evento || "Nenhum");
    setEditModalOpen(true);
    setSaveError(null);
  };

  const handleConfirmEditRide = async () => {
    if (!editingRide) return;
    setSaveError(null);
    try {
      const valRecebido = parseFloat(receivedValue);
      if (isNaN(valRecebido) || valRecebido < 0) {
        throw new Error('O valor recebido não pode ser negativo.');
      }
      const gorjeta = parseFloat(tipValue) || 0;
      const pedagio = parseFloat(tollValue) || 0;

      const updatedRide: Partial<CalibratedRide> = {
        ...editingRide,
        receivedValue: valRecebido,
        platform,
        tipValue: gorjeta,
        tollValue: pedagio,
        observations,
        bairroOrigem: pickupNeighborhood,
        bairroDestino: destNeighborhood,
        cidadeOrigem: pickupCity,
        cidadeDestino: destCity,
        clima: selectedClimate,
        evento: selectedSpecialEvent
      };

      console.log('[CALIBRATION_EDIT] Salvando edição de corrida...', updatedRide);

      const res = await persistCalibratedRide(updatedRide);
      const updatedLogsStr = localStorage.getItem('ride_logs');
      const updatedLogs = updatedLogsStr ? JSON.parse(updatedLogsStr) : [];

      if (!res.success) {
        if (res.ride?.pending_sync) {
          setToast({
            show: true,
            message: 'Aviso: Banco remoto offline. Edição salva localmente para re-sync automático.',
            type: 'error'
          });

          setRideLogs(updatedLogs);
          setEditModalOpen(false);
          setEditingRide(null);
          await fetchStats();
          return;
        } else {
          throw new Error(res.error || 'Erro na validação do salvamento.');
        }
      }

      setToast({
        show: true,
        message: 'Corrida editada e sincronizada com o Supabase!',
        type: 'success'
      });

      setRideLogs(updatedLogs);

      setEditModalOpen(false);
      setEditingRide(null);
      await fetchStats();
    } catch (err: any) {
      console.error("[CALIBRATION_EDIT] Erro ao editar:", err);
      setSaveError(err.message || 'Falha ao editar a corrida.');
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

  // System State Computation (Requirement 8)
  const systemState = useMemo(() => {
    if (isSyncingBeforeEnd || syncStatusBeforeEnd === 'syncing') {
      return 'STATE_SYNCING';
    }
    if (journeyEndModalOpen || finishModalOpen) {
      return 'STATE_JOURNEY_ENDING';
    }
    if (activeSession) {
      if (activeRide) {
        return 'STATE_JOURNEY_ACTIVE';
      }
      return 'STATE_TRACKING';
    }
    return 'STATE_IDLE';
  }, [isSyncingBeforeEnd, syncStatusBeforeEnd, journeyEndModalOpen, finishModalOpen, activeSession, activeRide]);

  const metrics = useMemo(() => {
    const totalKm = activeSession ? totalDistanceKm : 0;
    
    const activeSessionDateStr = activeSession 
      ? new Date(activeSession.start_time).toISOString().substring(0, 10)
      : new Date().toISOString().substring(0, 10);

    const dayEarnings = (earnings || []).filter(e => e.date === activeSessionDateStr);
    const revenue = dayEarnings.reduce((acc, curr) => acc + Number(curr.gross_amount || 0), 0);

    const costPerKm = calculateCostPerKmEstimate(vehicle, vehicleCostSettings) || 0.45;
    const cost = totalKm * costPerKm;
    
    // Fallback inteligente
    const kmRate = totalKm > 0 ? (revenue > 0 ? revenue / totalKm : 2.0) : 2.0;
    const lucro = revenue - (cost ?? 0);

    return {
      tempoOnline: activeSession ? elapsedTime : "00:00:00",
      kmRodados: `${totalKm.toFixed(1)} km`,
      status: systemState,
      revenue,
      cost,
      lucro,
      kmRate
    };
  }, [activeSession, earnings, vehicle, vehicleCostSettings, totalDistanceKm, elapsedTime, systemState]);

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

  // Fallback to the latest point from currentSessionPoints if lastCoord is null/unaligned (Requirement 5)
  const lastValidCoord = useMemo(() => {
    if (!activeSession) return null;
    
    // Check if we have lastCoord from context
    if (lastCoord) {
      return lastCoord;
    }
    
    // Fallback to latest coordinate in this active session
    if (currentSessionPoints.length > 0) {
      const lastPoint = currentSessionPoints[currentSessionPoints.length - 1];
      return {
        lat: lastPoint.latitude,
        lng: lastPoint.longitude,
        accuracy: lastPoint.accuracy || 10,
        speed: lastPoint.speed_kmh / 3.6,
        heading: lastPoint.heading,
        altitude: lastPoint.altitude,
        timestamp: new Date(lastPoint.recorded_at).getTime()
      };
    }
    
    return null;
  }, [lastCoord, currentSessionPoints, activeSession]);

  const lastGeocodeFetchTimeRef = React.useRef<number>(0);

  useEffect(() => {
    if (!lastValidCoord) return;
    const now = Date.now();
    // Update every 12 seconds to prevent excessive API calls and follow strict debounce
    if (now - lastGeocodeFetchTimeRef.current > 12000) {
      lastGeocodeFetchTimeRef.current = now;
      fetchAddressForCoordinates(lastValidCoord.lat, lastValidCoord.lng).then((res) => {
        const street = res.street ? `${res.street}, ${res.neighborhood}` : `${res.neighborhood}, ${res.city}`;
        setCurrentStreetName(street);
      }).catch(err => {
        console.error("Error fetching current street name:", err);
      });
    }
  }, [lastValidCoord]);

  const pendingAcceptRideRef = React.useRef<boolean>(false);

  useEffect(() => {
    if (activeSession && pendingAcceptRideRef.current) {
      pendingAcceptRideRef.current = false;
      handleAcceptRide();
    }
  }, [activeSession]);

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
  // "Considerar parado when: velocidade estimada < 5 km/h ou sem deslocamento"
  const totalStoppedDurationMs = useMemo(() => {
    if (!activeSession) return 0;

    let totalDuration = 0;
    const sortedPoints = [...currentSessionPoints].sort((a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime());
    const startTimeMs = new Date(activeSession.start_time).getTime();
    const endTimeMs = Date.now();

    if (sortedPoints.length === 0) {
      return Math.max(0, endTimeMs - startTimeMs);
    }

    // 1. Check period from startTimeMs to first point
    const firstPointTime = new Date(sortedPoints[0].recorded_at).getTime();
    if (firstPointTime > startTimeMs) {
      totalDuration += (firstPointTime - startTimeMs);
    }

    // 2. Sum intervals where speed is < 5 km/h or distance is 0
    for (let i = 1; i < sortedPoints.length; i++) {
      const p1 = sortedPoints[i - 1];
      const p2 = sortedPoints[i];

      const t1 = new Date(p1.recorded_at).getTime();
      const t2 = new Date(p2.recorded_at).getTime();
      const dtMs = t2 - t1;

      if (dtMs <= 0) continue;

      const dist = calculateHaversineDistance(p1.latitude, p1.longitude, p2.latitude, p2.longitude) * 1000; // in meters
      const speedKmh = (dist / (dtMs / 1000)) * 3.6;

      if (speedKmh < 5 || dist === 0) {
        totalDuration += dtMs;
      }
    }

    // 3. Check period from last point to endTimeMs
    const lastPointTime = new Date(sortedPoints[sortedPoints.length - 1].recorded_at).getTime();
    if (endTimeMs > lastPointTime) {
      const lastPoint = sortedPoints[sortedPoints.length - 1];
      const isGpsPaused = gpsStatus === 'GPS sem sinal' || gpsStatus === 'GPS erro' || gpsStatus === 'GPS negado' || (endTimeMs - lastPointTime > 15000);
      
      if (lastPoint.speed_kmh < 5 || isGpsPaused) {
        totalDuration += (endTimeMs - lastPointTime);
      }
    }

    return totalDuration;
  }, [currentSessionPoints, activeSession, elapsedTime, gpsStatus]);

  // Convert stopped duration ms to readable format (Xh Ym)
  const formattedStoppedTime = useMemo(() => {
    if (activeRide) {
      let totalSeconds = activeRide.totalIdleTime || 0;
      if (activeRide.idleStartTimestamp) {
        totalSeconds += (Date.now() - activeRide.idleStartTimestamp) / 1000;
      }
      const mins = Math.floor(totalSeconds / 60);
      const secs = Math.round(totalSeconds % 60);
      return `${mins} min ${secs}s`;
    }

    const mins = Math.floor(totalStoppedDurationMs / (60 * 1000));
    const hrs = Math.floor(mins / 60);
    const remMins = mins % 60;

    if (hrs > 0) {
      return `${hrs}h ${remMins}min`;
    }
    return `${mins} min`;
  }, [totalStoppedDurationMs, activeRide, elapsedTime]);

  const handleStartTracking = async () => {
    setAllowRealTimeMap(true);
    await startSession();
    await requestWakeLock();
  };

  const handleStopTracking = async () => {
    if (!activeSession) return;
    
    // 1. Fechar mapa e desativar qualquer visualização de mapa imediatamente
    console.log('[MAP_CLOSE] Stopping tracking initiated. Forcing map components to unmount first.');
    setIsMapOpen(false);
    setSelectedRouteRide(null);
    setAllowRealTimeMap(false);
    
    // 2. Aguardar o cleanup completo (ex: 350ms para desmontagem segura e remoção do DOM)
    await new Promise(resolve => setTimeout(resolve, 350));
    
    // 3. Somente depois abrir o modal de encerramento seguro
    setIsSyncingBeforeEnd(true);
    setSyncStatusBeforeEnd('syncing');
    setJourneyEndModalOpen(true);
    
    try {
      // 1. Tenta sincronizar somente os pontos da sessão atual (Requirement 1 & 4)
      const result = await telemetrySyncService.finalFlushBeforeEnd(activeSession.id);
      setPendingPointsCountBeforeEnd(result.pendingCount);
      if (result.success) {
        setSyncStatusBeforeEnd('success');
      } else {
        setSyncStatusBeforeEnd('failed');
      }
    } catch (err) {
      console.error('[Sync] Pre-end sync error:', err);
      setSyncStatusBeforeEnd('failed');
    } finally {
      setIsSyncingBeforeEnd(false);
    }
  };

  const handleForceSyncBeforeEnd = async () => {
    if (!activeSession) return;
    setIsSyncingBeforeEnd(true);
    setSyncStatusBeforeEnd('syncing');
    try {
      const result = await telemetrySyncService.finalFlushBeforeEnd(activeSession.id);
      setPendingPointsCountBeforeEnd(result.pendingCount);
      if (result.success) {
        setSyncStatusBeforeEnd('success');
      } else {
        setSyncStatusBeforeEnd('failed');
      }
    } catch (err) {
      console.error('[Sync] Manual retry pre-end sync error:', err);
      setSyncStatusBeforeEnd('failed');
    } finally {
      setIsSyncingBeforeEnd(false);
    }
  };

  const handleConfirmEndJourney = async (forceClose: boolean) => {
    if (!activeSession) return;
    setIsSyncingBeforeEnd(true);
    
    try {
      // Stop active tracking immediately and clear ride state
      localStorage.removeItem('driverdash_active_ride_calib');
      setActiveRide(null);

      // Estimate total minutes
      const runningTimeMinutes = Math.max(1, Math.round(
        (new Date().getTime() - new Date(activeSession.start_time).getTime()) / 60000
      ));

      console.log('[SESSION_END_SAFE]', {
        sessionId: activeSession.id,
        totalKm: totalKmToday,
        durationMinutes: runningTimeMinutes,
        forced: forceClose,
        pendingCount: pendingPointsCountBeforeEnd
      });

      await endSession(activeSession.id, totalKmToday, runningTimeMinutes);
      releaseWakeLock();
      
      setJourneyEndModalOpen(false);
      setSyncStatusBeforeEnd('idle');
    } catch (err: any) {
      console.error('[Session End Error]', err);
      setToast({
        show: true,
        message: 'Erro ao encerrar jornada: ' + (err?.message || 'Erro desconhecido'),
        type: 'error'
      });
    } finally {
      setIsSyncingBeforeEnd(false);
    }
  };

  const handleCancelJourneyEnd = () => {
    setJourneyEndModalOpen(false);
    setAllowRealTimeMap(true);
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

  const parseTimeToMinutes = (timeStr: string): number => {
    if (!timeStr) return 0;
    const parts = timeStr.split(':').map(Number);
    if (parts.some(isNaN)) return 0;
    const [h, m, s] = parts;
    return (h || 0) * 60 + (m || 0) + (s || 0) / 60;
  };

  return (
    <div className="space-y-6">
      {/* Title Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="text-left">
          <h1 
            onClick={handleTitleClick}
            className="text-2xl font-bold tracking-tight text-white flex items-center gap-2 cursor-pointer select-none active:scale-95 transition-transform"
          >
            <Navigation className="w-6 h-6 text-purple-400 rotate-45" /> DriverDash Roxou
          </h1>
          <p className="text-xs text-slate-400">
            Painel Minimalista de Direção & Inteligência Financeira
          </p>
        </div>

        {/* Top bar indicators */}
        <div className="flex items-center gap-3">
          {/* Signal indicator */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-950/20 border border-purple-900/35 select-none text-[11px] font-mono">
            <Signal className={`w-3.5 h-3.5 ${gpsSignalQuality.color} ${gpsSignalQuality.label === 'Sem sinal' ? 'animate-pulse font-bold' : ''}`} />
            <span className="text-slate-300">GPS:</span>
            <span className={`font-bold ${gpsSignalQuality.color}`}>
              {gpsSignalQuality.label.toUpperCase()}
            </span>
          </div>

          {/* Quick Details button to open our complete reports modal */}
          <button
            onClick={() => setIsDetailsModalOpen(true)}
            className="px-3.5 py-1.5 rounded-xl bg-purple-900/40 hover:bg-purple-900/60 border border-purple-700/40 hover:border-purple-600/50 text-purple-300 hover:text-white font-semibold transition-all select-none cursor-pointer flex items-center gap-1.5 text-xs shadow-[0_2px_10px_rgba(147,51,234,0.15)]"
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span>Relatórios & IA</span>
          </button>
        </div>
      </div>

      {/* Barra Superior Compacta Fixa */}
      <div className="bg-[#0c0827] border border-purple-950/40 p-4 rounded-2xl shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3 sticky top-0 z-30 backdrop-blur-md bg-opacity-95">
        <div className="flex flex-wrap items-center gap-2 text-xs md:text-sm font-semibold text-[#e1e1e6]">
          <span className="relative flex h-2 w-2">
            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${activeSession ? 'bg-emerald-400' : 'bg-slate-400'}`}></span>
            <span className={`relative inline-flex rounded-full h-2 w-2 ${activeSession ? 'bg-emerald-500' : 'bg-slate-500'}`}></span>
          </span>
          <span className="font-mono text-white">{metrics.tempoOnline} online</span>
          <span className="text-slate-600 font-bold">·</span>
          <span className="font-mono text-purple-400">{metrics.kmRodados}</span>
          <span className="text-slate-600 font-bold">·</span>
          <span className="font-mono text-amber-400">{lastValidCoord?.speed ? (lastValidCoord.speed * 3.6).toFixed(0) : '0'} km/h</span>
          <span className="text-slate-600 font-bold">·</span>
          <span className={`font-mono text-xs font-bold flex items-center gap-1 ${gpsSignalQuality.color}`}>
            <Signal className="w-3.5 h-3.5" />
            {gpsSignalQuality.label === 'Sem sinal' ? 'SEM SINAL' : 'GPS OK'}
          </span>
        </div>

        <div className="text-[10px] text-slate-400 font-mono flex items-center gap-2">
          <span>Rua:</span>
          <span className="truncate max-w-[200px] text-purple-300 font-sans font-bold">{currentStreetName || "Buscando localização..."}</span>
        </div>
      </div>

      {/* Abas de Navegação Visual */}
      <div className="grid grid-cols-3 gap-1.5 bg-[#09051d] p-1.5 rounded-2xl border border-purple-950/40">
        <button
          onClick={() => setActiveTab('jornada')}
          className={`py-3 px-2 rounded-xl text-xs md:text-sm font-bold transition-all flex items-center justify-center gap-2 cursor-pointer select-none ${
            activeTab === 'jornada'
              ? 'bg-gradient-to-r from-purple-700 to-indigo-700 text-white shadow-md font-extrabold'
              : 'text-slate-400 hover:text-white hover:bg-purple-950/20'
          }`}
        >
          <Navigation className="w-4 h-4" />
          <span>JORNADA</span>
        </button>
        <button
          onClick={() => setActiveTab('desempenho')}
          className={`py-3 px-2 rounded-xl text-xs md:text-sm font-bold transition-all flex items-center justify-center gap-2 cursor-pointer select-none ${
            activeTab === 'desempenho'
              ? 'bg-gradient-to-r from-purple-700 to-indigo-700 text-white shadow-md font-extrabold'
              : 'text-slate-400 hover:text-white hover:bg-purple-950/20'
          }`}
        >
          <DollarSign className="w-4 h-4" />
          <span>DESEMPENHO</span>
        </button>
        <button
          onClick={() => setActiveTab('copiloto')}
          className={`py-3 px-2 rounded-xl text-xs md:text-sm font-bold transition-all flex items-center justify-center gap-2 cursor-pointer select-none ${
            activeTab === 'copiloto'
              ? 'bg-gradient-to-r from-purple-700 to-indigo-700 text-white shadow-md font-extrabold'
              : 'text-slate-400 hover:text-white hover:bg-purple-950/20'
          }`}
        >
          <Bot className="w-4 h-4" />
          <span>COPILOTO</span>
        </button>
      </div>

      {/* Tab Area Container */}
      <div>
        {activeTab === 'jornada' && (
          <div className="space-y-6">
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
                  <div className="p-4 rounded-2xl bg-[#09051d] border border-purple-930/35 flex flex-col sm:flex-row sm:items-center justify-between text-left gap-3">
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

                  {/* Real-time professional tracker Leaflet map card */}
                  {allowRealTimeMap && !isMapOpen && !journeyEndModalOpen && !finishModalOpen && !cancelModalOpen && !editModalOpen ? (
                    <RealTimeTrackerMap 
                      lastCoord={lastValidCoord} 
                      activeRide={activeRide} 
                      gpsStatus={gpsStatus} 
                    />
                  ) : (
                    <div className="p-8 text-center rounded-2xl bg-purple-950/5 border border-purple-950/25 text-purple-400 text-xs font-mono">
                      [MAPA_SUSPENDIDO_SEGURANCA]
                    </div>
                  )}

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

                  {/* Manual Override Status Banner - Only shown if there is a real/critical GPS or Telemetry error */}
                  {manualOverride && (gpsStatus === 'GPS sem sinal' || gpsStatus === 'GPS erro' || gpsStatus === 'GPS negado' || !!gpsError || syncStatus === 'erro' || !!lastSyncError) && (
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
                  <div className="flex flex-col gap-3 w-full pt-2">
                    <div className="flex flex-col sm:flex-row gap-3 w-full">
                      {!activeRide ? (
                        <button
                          onClick={handleAcceptRide}
                          className="flex-1 py-4 rounded-2xl font-semibold bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white shadow-[0_4px_15px_rgba(16,185,129,0.25)] hover:shadow-[0_4px_25px_rgba(16,185,129,0.35)] transition-all cursor-pointer flex items-center justify-center gap-2 select-none"
                        >
                          <Play className="w-4 h-4 fill-current" /> Aceitar Corrida
                        </button>
                      ) : (
                        <div className="flex flex-col gap-3 w-full">
                          {!activeRide.pickup_timestamp ? (
                            <button
                              onClick={handlePassengerBoarded}
                              className="w-full py-4 rounded-2xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white shadow-[0_4px_15px_rgba(99,102,241,0.25)] hover:shadow-[0_4px_25px_rgba(99,102,241,0.35)] transition-all cursor-pointer flex items-center justify-center gap-2 select-none"
                            >
                              <Check className="w-4 h-4" /> Passageiro Embarcou
                            </button>
                          ) : (
                            <div className="w-full p-3 bg-purple-950/25 border border-purple-900/35 rounded-xl flex items-center justify-center gap-2 text-purple-300 font-sans text-[11px] select-none">
                              <Check className="w-4 h-4 text-emerald-400" />
                              <span>Passageiro a bordo desde as <strong>{new Date(activeRide.pickup_timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</strong></span>
                            </div>
                          )}

                          <div className="flex flex-col sm:flex-row gap-3 w-full">
                            <button
                              onClick={handleFinishRide}
                              className="flex-1 py-4 rounded-2xl font-semibold bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white shadow-[0_4px_15px_rgba(245,158,11,0.25)] hover:shadow-[0_4px_25px_rgba(245,158,11,0.35)] transition-all cursor-pointer flex items-center justify-center gap-2 select-none"
                            >
                              <Square className="w-4 h-4 fill-current" /> Finalizar Corrida
                            </button>
                            <button
                              onClick={handleCancelRide}
                              className="flex-1 py-4 rounded-2xl font-semibold bg-gradient-to-r from-rose-700 to-red-600 hover:from-rose-600 hover:to-red-500 text-white shadow-[0_4px_15px_rgba(225,29,72,0.25)] hover:shadow-[0_4px_25px_rgba(225,29,72,0.35)] transition-all cursor-pointer flex items-center justify-center gap-2 select-none"
                            >
                              <X className="w-4 h-4" /> Cancelar Corrida
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    <button
                      onClick={handleStopTracking}
                      className="w-full py-3.5 rounded-2xl font-semibold bg-rose-950/20 hover:bg-rose-900/30 text-rose-400 hover:text-rose-300 border border-rose-950/40 transition-all cursor-pointer flex items-center justify-center gap-2 select-none"
                    >
                      <X className="w-4 h-4" /> Encerrar Jornada
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      )}

      {/* ABA: DESEMPENHO */}
      {activeTab === 'desempenho' && (
        <div className="space-y-6">
          {/* NÍVEL 2: MÉTRICAS FINANCEIRAS (FINANCEIRO REAL-TIME) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-[#0c0827] border border-purple-950/40 p-5 rounded-2xl text-left flex items-center justify-between shadow-lg">
              <div>
                <span className="text-[10px] text-emerald-400 font-bold block uppercase tracking-wider">💰 Receita Operacional</span>
                <span className="text-xl font-extrabold text-emerald-400 font-mono block mt-1">
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(metrics.revenue)}
                </span>
                <span className="text-[9px] text-slate-500 font-mono mt-0.5 block">
                  Taxa média: R$ {metrics.kmRate.toFixed(2)}/km
                </span>
              </div>
            </div>
            <div className="bg-[#0c0827] border border-purple-950/40 p-5 rounded-2xl text-left flex items-center justify-between shadow-lg">
              <div>
                <span className="text-[10px] text-rose-400 font-bold block uppercase tracking-wider">⛽ Custo Estimado</span>
                <span className="text-xl font-extrabold text-rose-400 font-mono block mt-1">
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(metrics.cost)}
                </span>
                <span className="text-[9px] text-slate-500 font-mono mt-0.5 block">
                  Combustível & Desgaste
                </span>
              </div>
            </div>
            <div className="bg-[#0c0827] border border-purple-950/40 p-5 rounded-2xl text-left flex items-center justify-between shadow-lg">
              <div>
                <span className="text-[10px] text-purple-300 font-bold block uppercase tracking-wider">📈 Lucro Líquido</span>
                <span className={`text-xl font-extrabold font-mono block mt-1 ${metrics.lucro >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(metrics.lucro)}
                </span>
                <span className="text-[9px] text-slate-500 font-mono mt-0.5 block">
                  Retorno Real do Motorista
                </span>
              </div>
            </div>
          </div>

          {/* Operational Averages Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-[#0c0827] border border-purple-950/25 p-4 rounded-xl text-center shadow-md">
              <span className="text-[9px] text-slate-500 block uppercase font-mono mb-1">Média R$/KM</span>
              <span className="text-lg font-bold font-mono text-emerald-400">
                R$ {metrics.kmRate.toFixed(2)}
              </span>
            </div>
            <div className="bg-[#0c0827] border border-purple-950/25 p-4 rounded-xl text-center shadow-md">
              <span className="text-[9px] text-slate-500 block uppercase font-mono mb-1">Média R$/Hora</span>
              <span className="text-lg font-bold font-mono text-purple-300">
                R$ {(() => {
                  const activeTimeStr = activeMetrics?.tempoOnline ?? metrics.tempoOnline;
                  const mins = parseTimeToMinutes(activeTimeStr);
                  return mins > 0 && activeMetrics?.hasEarnings ? (metrics.revenue / (mins / 60)).toFixed(2) : '0.00';
                })()}
              </span>
            </div>
            <div className="bg-[#0c0827] border border-purple-950/25 p-4 rounded-xl text-center shadow-md">
              <span className="text-[9px] text-slate-500 block uppercase font-mono mb-1">Corridas Concluídas</span>
              <span className="text-lg font-bold font-mono text-indigo-400">
                {rideLogs.filter((r: any) => r.status === 'finished').length}
              </span>
            </div>
            <div className="bg-[#0c0827] border border-purple-950/25 p-4 rounded-xl text-center shadow-md">
              <span className="text-[9px] text-slate-500 block uppercase font-mono mb-1">Total de Horas</span>
              <span className="text-lg font-bold font-mono text-amber-500">
                {(parseTimeToMinutes(activeMetrics?.tempoOnline ?? metrics.tempoOnline) / 60).toFixed(1)}h
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ABA: COPILOTO */}
      {activeTab === 'copiloto' && (
        <div className="space-y-6">
          {/* Inteligência Copiloto do Motorista */}
          <CopilotCard 
            currentBairro={pickupNeighborhood || activeRide?.bairroOrigem || ''}
            currentLat={activeRide?.lastPosition?.lat || lastCoord?.lat}
            currentLng={activeRide?.lastPosition?.lng || lastCoord?.lng}
            currentSpeed={lastCoord?.speed ? lastCoord.speed * 3.6 : 0}
            isJourneyActive={!!activeSession}
            activeSession={activeSession}
            totalDistanceKm={totalDistanceKm}
            elapsedTime={elapsedTime}
            rideLogs={rideLogs}
            vehicle={vehicle}
            vehicleCostSettings={vehicleCostSettings}
          />

          {/* Calibração da Inteligência Operacional */}
          <div className="p-5 bg-[#09051d]/60 border border-purple-950/25 rounded-2xl text-left space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase font-mono tracking-wider text-purple-400 flex items-center gap-2 select-none">
                <Bot className="w-4 h-4 text-purple-400" /> Calibração da Inteligência
              </h4>
              <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase font-mono ${
                calibrationStats.isCalibrated 
                  ? 'bg-emerald-950/50 text-emerald-400 border border-emerald-900/45' 
                  : 'bg-amber-950/50 text-amber-400 border border-amber-900/45 animate-pulse'
              }`}>
                {calibrationStats.isCalibrated ? '● IA Calibrada' : '● IA Aprendendo...'}
              </span>
            </div>

            <p className="text-[11px] text-slate-300 leading-relaxed font-sans">
              O modelo preditivo de demanda e oportunidades está sendo calibrado com base na sua rotina real de condução. 
              Atualmente, a IA precisa de 100 corridas individuais para atingir calibração ótima de mercado.
            </p>

            <div className="space-y-1.5">
              <div className="flex justify-between text-[10px] font-mono select-none">
                <span className="text-slate-400">Progresso de Calibração:</span>
                <span className="font-bold text-[#e1e1e6]">
                  {calibrationStats.totalFinished} de 100 corridas necessárias ({calibrationStats.calibrationProgress}%)
                </span>
              </div>
              <div className="h-2 w-full bg-[#050310] rounded-full overflow-hidden border border-purple-950/20">
                <div 
                  className="h-full bg-gradient-to-r from-purple-600 via-indigo-600 to-emerald-500 rounded-full transition-all duration-500"
                  style={{ width: `${calibrationStats.calibrationProgress}%` }}
                ></div>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-[#050310] p-3 rounded-xl border border-purple-950/10 text-center space-y-0.5">
                <span className="text-[8.5px] text-slate-500 block font-mono uppercase select-none">Corridas Aprendidas</span>
                <span className="text-sm font-bold font-mono text-emerald-400">{calibrationStats.totalFinished}</span>
              </div>
              <div className="bg-[#050310] p-3 rounded-xl border border-purple-950/10 text-center space-y-0.5">
                <span className="text-[8.5px] text-slate-500 block font-mono uppercase select-none">GPS Coletados</span>
                <span className="text-sm font-bold font-mono text-purple-400">{calibrationStats.gpsPointsCount}</span>
              </div>
              <div className="bg-[#050310] p-3 rounded-xl border border-purple-950/10 text-center space-y-0.5">
                <span className="text-[8.5px] text-slate-500 block font-mono uppercase select-none">Horas Dirigidas</span>
                <span className="text-sm font-bold font-mono text-[#e1e1e6]">{calibrationStats.totalHoursDriven}h</span>
              </div>
              <div className="bg-[#050310] p-3 rounded-xl border border-purple-950/10 text-center space-y-0.5 col-span-1">
                <span className="text-[8.5px] text-slate-500 block font-mono uppercase select-none">Precisão Atual IA</span>
                <span className="text-sm font-bold font-mono text-indigo-400">{calibrationStats.accuracyRate}%</span>
              </div>
            </div>

            <div className="bg-[#050310]/50 p-2.5 rounded-xl border border-purple-950/15 text-[10.5px] font-mono flex items-center justify-between text-slate-400">
              <span>Nível de Confiança IA:</span>
              <span className={`font-bold ${calibrationStats.isCalibrated ? 'text-emerald-400' : 'text-amber-400'}`}>
                {calibrationStats.confidenceLevel}
              </span>
            </div>
          </div>

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
        </div>
      )}

      {activeTab === 'desempenho' && (
        <div className="space-y-6">
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
      )}

      {activeTab === 'copiloto' && (
        <div className="space-y-6">
          {/* PAINEL DE ANALYTICS DA CALIBRAÇÃO DA IA */}
          <div className="p-5 rounded-2xl bg-[#0d0926]/40 border border-purple-950/25 space-y-4 text-left">
            <h3 className="text-xs font-bold uppercase font-mono tracking-wider text-purple-400 flex items-center justify-between select-none">
              Métricas e Estatísticas da IA <span className="text-[10px] text-slate-500 font-normal lowercase font-sans">Padrões calibrados</span>
            </h3>

            {rideLogs.length === 0 ? (
              <div className="text-center py-4 text-xs text-slate-500 select-none">
                Estatísticas serão geradas assim que houver corridas calibradas.
              </div>
            ) : (
              <div className="space-y-4">
                {/* Bento Grid Principal */}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <div className="bg-[#050310]/80 p-3 rounded-xl border border-purple-950/10 space-y-1">
                    <span className="text-[8px] text-slate-500 font-mono uppercase select-none block">Tempo Médio p/ Embarque</span>
                    <span className="text-xs font-bold text-indigo-400 font-mono">
                      {calibrationAnalytics.tempoMedioEmbarqueSec > 0 
                        ? `${Math.floor(calibrationAnalytics.tempoMedioEmbarqueSec / 60)}m ${Math.round(calibrationAnalytics.tempoMedioEmbarqueSec % 60)}s`
                        : "0s"}
                    </span>
                  </div>

                  <div className="bg-[#050310]/80 p-3 rounded-xl border border-purple-950/10 space-y-1">
                    <span className="text-[8px] text-slate-500 font-mono uppercase select-none block">Tempo Médio de Corrida</span>
                    <span className="text-xs font-bold text-purple-400 font-mono">
                      {calibrationAnalytics.tempoMedioCorridaSec > 0 
                        ? `${Math.floor(calibrationAnalytics.tempoMedioCorridaSec / 60)} min`
                        : "0 min"}
                    </span>
                  </div>

                  <div className="bg-[#050310]/80 p-3 rounded-xl border border-purple-950/10 space-y-1">
                    <span className="text-[8px] text-slate-500 font-mono uppercase select-none block">Média de KM por Corrida</span>
                    <span className="text-xs font-bold text-[#e1e1e6] font-mono">
                      {calibrationAnalytics.kmMedios.toFixed(1)} km
                    </span>
                  </div>

                  <div className="bg-[#050310]/80 p-3 rounded-xl border border-purple-950/10 space-y-1">
                    <span className="text-[8px] text-slate-500 font-mono uppercase select-none block">Lucro Médio Estimado</span>
                    <span className="text-xs font-bold text-emerald-400 font-mono">
                      R$ {calibrationAnalytics.lucroMedio.toFixed(2)}
                    </span>
                  </div>

                  <div className="bg-[#050310]/80 p-3 rounded-xl border border-purple-950/10 space-y-1">
                    <span className="text-[8px] text-slate-500 font-mono uppercase select-none block">R$/KM Geral</span>
                    <span className="text-xs font-bold text-emerald-400 font-mono">
                      R$ {calibrationAnalytics.rPerKm.toFixed(2)}/km
                    </span>
                  </div>

                  <div className="bg-[#050310]/80 p-3 rounded-xl border border-purple-950/10 space-y-1">
                    <span className="text-[8px] text-slate-500 font-mono uppercase select-none block">R$/Hora Geral</span>
                    <span className="text-xs font-bold text-emerald-400 font-mono">
                      R$ {calibrationAnalytics.rPerHour.toFixed(2)}/h
                    </span>
                  </div>
                </div>

                {/* Sub-grelha para Bairros e Plataformas mais frequentes */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                  {/* Bairros de Origem */}
                  <div className="bg-[#050310]/50 p-3 rounded-xl border border-purple-950/10 text-[10.5px] space-y-2">
                    <span className="text-[8.5px] text-purple-400 font-mono uppercase select-none font-bold block">📍 Origens mais frequentes</span>
                    <div className="space-y-1 max-h-[72px] overflow-y-auto custom-scrollbar">
                      {calibrationAnalytics.bairrosOrigemFreq.length === 0 ? (
                        <p className="text-slate-600 font-sans italic text-[10px]">Nenhum bairro registrado</p>
                      ) : (
                        calibrationAnalytics.bairrosOrigemFreq.slice(0, 3).map((b, i) => (
                          <div key={i} className="flex justify-between text-slate-300 font-sans">
                            <span className="truncate pr-1">{b.name}</span>
                            <span className="text-slate-500 font-mono font-bold">{b.count}x</span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Destinos */}
                  <div className="bg-[#050310]/50 p-3 rounded-xl border border-purple-950/10 text-[10.5px] space-y-2">
                    <span className="text-[8.5px] text-purple-400 font-mono uppercase select-none font-bold block">🎯 Destinos mais frequentes</span>
                    <div className="space-y-1 max-h-[72px] overflow-y-auto custom-scrollbar">
                      {calibrationAnalytics.bairrosDestinoFreq.length === 0 ? (
                        <p className="text-slate-600 font-sans italic text-[10px]">Nenhum destino registrado</p>
                      ) : (
                        calibrationAnalytics.bairrosDestinoFreq.slice(0, 3).map((b, i) => (
                          <div key={i} className="flex justify-between text-slate-300 font-sans">
                            <span className="truncate pr-1">{b.name}</span>
                            <span className="text-slate-500 font-mono font-bold">{b.count}x</span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Plataformas */}
                  <div className="bg-[#050310]/50 p-3 rounded-xl border border-purple-950/10 text-[10.5px] space-y-2">
                    <span className="text-[8.5px] text-purple-400 font-mono uppercase select-none font-bold block">📱 Plataformas preferidas</span>
                    <div className="space-y-1 max-h-[72px] overflow-y-auto custom-scrollbar">
                      {calibrationAnalytics.plataformasFreq.length === 0 ? (
                        <p className="text-slate-600 font-sans italic text-[10px]">Nenhuma plataforma registrada</p>
                      ) : (
                        calibrationAnalytics.plataformasFreq.slice(0, 3).map((p, i) => (
                          <div key={i} className="flex justify-between text-slate-300 font-sans">
                            <span className="truncate pr-1">{p.name}</span>
                            <span className="text-slate-500 font-mono font-bold">{p.count}x</span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'desempenho' && (
        <div className="space-y-6">
          {/* Histórico de Corridas de Calibração */}
          <div className="p-5 rounded-2xl bg-[#0d0926]/40 border border-purple-950/25 space-y-4 text-left">
            <h3 className="text-xs font-bold uppercase font-mono tracking-wider text-purple-400 flex items-center justify-between select-none">
              Histórico de Calibração <span className="text-[10px] text-slate-500 font-normal lowercase font-sans">Corridas individuais</span>
            </h3>

            {rideLogs.length === 0 ? (
              <div className="text-center py-6 text-xs text-slate-500 select-none">
                Nenhuma corrida calibrada ainda. Aceite e finalize corridas para registrar os dados de IA.
              </div>
            ) : (
              <div className="space-y-3 max-h-[360px] overflow-y-auto pr-1 custom-scrollbar font-mono text-xs">
                {rideLogs.slice().reverse().map((ride: any, idx: number) => {
                  const isFinished = ride.status === 'finished';
                  const isCancelled = ride.status === 'cancelled';
                  
                  return (
                    <div key={ride.id || idx} className="p-3 bg-[#070417] rounded-xl border border-purple-950/20 space-y-2 text-left">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            isFinished 
                              ? 'bg-emerald-950/40 text-emerald-400 border border-emerald-900/25' 
                              : isCancelled 
                                ? 'bg-rose-950/40 text-rose-400 border border-rose-900/25' 
                                : 'bg-amber-950/40 text-amber-400 border border-amber-900/25 animate-pulse'
                          }`}>
                            {isFinished ? '🏁 Concluída' : isCancelled ? '❌ Cancelada' : '🟡 Em andamento'}
                          </span>

                          {(ride.is_pending_calibration_details || !ride.bairroOrigem || !ride.bairroDestino) && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20 animate-pulse flex items-center gap-1">
                              ⚠️ Pendente
                            </span>
                          )}
                        </div>
                        
                        {ride.platform && (
                          <span className="text-[10px] bg-purple-950/40 border border-purple-900/20 text-purple-300 px-1.5 py-0.5 rounded font-sans">
                            {ride.platform}
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-[10.5px] border-b border-purple-950/10 pb-2 text-slate-300">
                        <div>
                          <p className="text-slate-500 select-none text-[9px] uppercase font-sans">Origem</p>
                          <p className="truncate font-semibold font-sans">{ride.bairroOrigem || 'Ponto de GPS'}</p>
                        </div>
                        <div>
                          <p className="text-slate-500 select-none text-[9px] uppercase font-sans">Destino</p>
                          <p className="truncate font-semibold font-sans">{ride.bairroDestino || 'Ponto de GPS'}</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-2 pt-1 font-mono">
                        <div>
                          <span className="text-[8.5px] text-slate-500 block uppercase select-none font-sans">KM</span>
                          <span className="font-bold text-[#e1e1e6]">{ride.distancia_hodometro ? ride.distancia_hodometro.toFixed(1) : (ride.distance ? ride.distance.toFixed(1) : '0.0')} km</span>
                        </div>
                        <div>
                          <span className="text-[8.5px] text-slate-500 block uppercase select-none font-sans">Tempo</span>
                          <span className="font-bold text-[#e1e1e6]">{ride.duration ? Math.round(ride.duration / 60) : 0} min</span>
                        </div>
                        <div>
                          <span className="text-[8.5px] text-slate-500 block uppercase select-none font-sans">Valor</span>
                          <span className={`font-bold ${isCancelled ? 'text-slate-500 line-through' : 'text-emerald-400'}`}>
                            {isCancelled ? 'R$ 0' : `R$ ${(ride.receivedValue || ride.value || 0).toFixed(2)}`}
                          </span>
                        </div>
                      </div>

                      {isFinished && (
                        <div className="grid grid-cols-2 gap-2 pt-1.5 border-t border-purple-950/10 text-[10px] text-slate-400">
                          <div>
                            <span className="text-[8px] text-slate-500 block uppercase select-none font-sans">Lucro Líquido</span>
                            <span className="font-bold text-emerald-400 font-mono">R$ {(ride.netProfit || ride.profit || 0).toFixed(2)}</span>
                          </div>
                          <div>
                            <span className="text-[8px] text-slate-500 block uppercase select-none font-sans">Consumo</span>
                            <span className="font-bold text-indigo-400 font-mono">{ride.energySpent || '0 L'}</span>
                          </div>
                        </div>
                      )}

                      {isFinished && (
                        <div className="grid grid-cols-2 gap-2 pt-1 text-[9.5px] text-slate-500 font-mono border-t border-purple-950/5">
                          <div>R$/KM: <span className="text-emerald-400 font-bold">R$ {(ride.rPerKm || ride.km_rate || 0).toFixed(2)}</span></div>
                          <div>R$/Hora: <span className="text-emerald-400 font-bold">R$ {(ride.rPerHour || ride.hour_rate || 0).toFixed(2)}</span></div>
                        </div>
                      )}

                      {isCancelled && ride.cancelReason && (
                        <div className="text-[10px] text-rose-400 pt-1 border-t border-purple-950/10 leading-normal font-sans">
                          Motivo: <span className="font-bold">{ride.cancelReason}</span>
                          {ride.cancelObs && <span className="text-slate-500 block mt-0.5">Obs: "{ride.cancelObs}"</span>}
                        </div>
                      )}

                      <div className="flex justify-between items-center pt-2 text-[9px] text-slate-500 border-t border-purple-950/5 select-none font-sans gap-2">
                        <div className="flex items-center gap-1">
                          <span>{ride.diaSemana || 'Dia de semana'}</span>
                          <span>•</span>
                          <span>{ride.hora || '00:00'}</span>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {ride.rideTrackPoints && ride.rideTrackPoints.length > 0 && (
                            <>
                              <button
                                onClick={() => {
                                  console.log('[MAP_OPEN]');
                                  setSelectedRouteRide(ride);
                                  setIsMapOpen(true);
                                }}
                                className="px-2 py-0.5 rounded bg-purple-950/40 hover:bg-purple-950/70 border border-purple-900/35 text-purple-300 font-bold select-none cursor-pointer transition-all hover:text-purple-100 flex items-center gap-1 text-[9px]"
                              >
                                <Navigation className="w-2.5 h-2.5" /> Ver rota
                              </button>
                              <button
                                onClick={() => setSelectedTelemetryRide(ride)}
                                className="px-2 py-0.5 rounded bg-purple-950/40 hover:bg-purple-950/70 border border-purple-900/35 text-indigo-300 font-bold select-none cursor-pointer transition-all hover:text-indigo-100 flex items-center gap-1 text-[9px]"
                              >
                                📊 Telemetria
                              </button>
                            </>
                          )}
                          <button
                            onClick={() => handleEditRide(ride)}
                            className="px-2 py-0.5 rounded bg-slate-950/40 hover:bg-slate-950/70 border border-slate-900/35 text-slate-400 font-bold select-none cursor-pointer transition-all hover:text-slate-200 flex items-center gap-1 text-[9px]"
                          >
                            <Edit className="w-2.5 h-2.5" /> Editar
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      </div>

      {/* MODAL: FINALIZAR CORRIDA */}
      <AnimatePresence>
        {finishModalOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="journey-modal fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-[#050310]/85 backdrop-blur-md"
          >
            <motion.div 
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 15 }}
              className="bg-[#0d0926] border border-purple-950/40 rounded-3xl w-full max-w-lg overflow-hidden shadow-[0_10px_50px_rgba(76,29,149,0.3)] text-left flex flex-col max-h-[90vh]"
            >
              <div className="p-5 border-b border-purple-950/20 bg-purple-950/10 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white uppercase font-mono tracking-wider flex items-center gap-2">
                    🏁 Finalizar & Calibrar Corrida
                  </h3>
                  <p className="text-[10px] text-purple-300 mt-0.5">
                    Preencha os dados reais para alimentar o aprendizado da IA.
                  </p>
                </div>
                <button 
                  type="button"
                  onClick={handleCancelFinishRide}
                  className="p-1 rounded-lg bg-purple-950/20 hover:bg-purple-950/40 text-purple-400 cursor-pointer select-none"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-5 space-y-4 overflow-y-auto custom-scrollbar flex-1 text-xs">
                {/* Grid Financeiro */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-slate-400 font-bold block select-none">Valor Recebido (R$)*</label>
                    <input 
                      type="number" 
                      step="0.01"
                      value={receivedValue}
                      onChange={(e) => setReceivedValue(e.target.value)}
                      className="w-full p-2.5 bg-[#050310] rounded-xl border border-purple-950/25 text-[#e1e1e6] focus:border-purple-500 focus:outline-none font-mono"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-slate-400 font-bold block select-none">Plataforma*</label>
                    <select 
                      value={platform}
                      onChange={(e) => setPlatform(e.target.value)}
                      className="w-full p-2.5 bg-[#050310] rounded-xl border border-purple-950/25 text-[#e1e1e6] focus:border-purple-500 focus:outline-none"
                    >
                      <option value="Uber">Uber</option>
                      <option value="99">99</option>
                      <option value="InDrive">InDrive</option>
                      <option value="Particular">Particular</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-slate-400 font-semibold block select-none">Gorjeta (R$ - Opcional)</label>
                    <input 
                      type="number" 
                      step="0.01"
                      value={tipValue}
                      onChange={(e) => setTipValue(e.target.value)}
                      className="w-full p-2.5 bg-[#050310] rounded-xl border border-purple-950/25 text-[#e1e1e6] focus:border-purple-500 focus:outline-none font-mono"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-slate-400 font-semibold block select-none">Pedágio (R$ - Opcional)</label>
                    <input 
                      type="number" 
                      step="0.01"
                      value={tollValue}
                      onChange={(e) => setTollValue(e.target.value)}
                      className="w-full p-2.5 bg-[#050310] rounded-xl border border-purple-950/25 text-[#e1e1e6] focus:border-purple-500 focus:outline-none font-mono"
                    />
                  </div>
                </div>

                {/* Calibração Geográfica por GPS Real */}
                <div className="p-4 bg-purple-950/15 rounded-2xl border border-purple-950/20 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-purple-400 uppercase tracking-wide text-[10px] select-none flex items-center gap-1.5">
                      <Bot className="w-3.5 h-3.5 animate-pulse" /> Detecção Geográfica por GPS Real
                    </h4>
                    {isResolvingGeocode && (
                      <span className="flex items-center gap-1 text-[9px] text-purple-300 font-mono">
                        <span className="h-1.5 w-1.5 rounded-full bg-purple-400 animate-ping" />
                        Detectando...
                      </span>
                    )}
                  </div>

                  <div className="space-y-2.5">
                    <div className="flex gap-2.5 items-start p-2.5 bg-[#050310]/70 rounded-xl border border-purple-950/10">
                      <div className="w-5 h-5 rounded-lg bg-emerald-950/40 flex items-center justify-center text-emerald-400 mt-0.5 shrink-0">
                        <MapPin className="w-3 h-3" />
                      </div>
                      <div className="space-y-0.5 min-w-0">
                        <span className="text-[8.5px] uppercase font-mono text-slate-500 font-bold tracking-wider">Origem do GPS</span>
                        <p className="text-[11px] font-medium text-slate-200 leading-normal truncate">{pickupAddress || "Buscando coordenadas..."}</p>
                        <p className="text-[9px] font-mono text-slate-400">{pickupNeighborhood}, {pickupCity}</p>
                      </div>
                    </div>

                    <div className="flex gap-2.5 items-start p-2.5 bg-[#050310]/70 rounded-xl border border-purple-950/10">
                      <div className="w-5 h-5 rounded-lg bg-rose-950/40 flex items-center justify-center text-rose-400 mt-0.5 shrink-0">
                        <Navigation className="w-3 h-3" />
                      </div>
                      <div className="space-y-0.5 min-w-0">
                        <span className="text-[8.5px] uppercase font-mono text-slate-500 font-bold tracking-wider">Destino do GPS</span>
                        <p className="text-[11px] font-medium text-slate-200 leading-normal truncate">{destAddress || "Buscando coordenadas..."}</p>
                        <p className="text-[9px] font-mono text-slate-400">{destNeighborhood}, {destCity}</p>
                      </div>
                    </div>
                  </div>

                  {geocodeError && (
                    <p className="text-[9px] text-amber-400 font-mono italic">{geocodeError}</p>
                  )}

                  <div className="pt-1 flex justify-end">
                    <button
                      type="button"
                      onClick={() => setShowManualCorrection(!showManualCorrection)}
                      className="text-[9.5px] text-purple-300 hover:text-purple-200 underline cursor-pointer font-semibold select-none flex items-center gap-1 transition-all"
                    >
                      {showManualCorrection ? "Ocultar Correção Manual (Debug)" : "⚙️ Corrigir manualmente (Debug)"}
                    </button>
                  </div>

                  {showManualCorrection && (
                    <div className="pt-3 border-t border-purple-950/10 space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-slate-400 font-bold block select-none">Bairro Origem*</label>
                          <select 
                            value={pickupNeighborhood}
                            onChange={(e) => {
                              setPickupNeighborhood(e.target.value);
                              setPickupAddress(`${e.target.value}, ${pickupCity}`);
                            }}
                            className="w-full p-2 bg-[#050310] rounded-lg border border-purple-950/20 text-[#e1e1e6] focus:border-purple-500 focus:outline-none text-[10.5px]"
                          >
                            <option value="">Selecione...</option>
                            <option value="Centro">Centro</option>
                            <option value="Parque do Povo">Parque do Povo</option>
                            <option value="Prudenshopping">Prudenshopping</option>
                            <option value="Jardim Bongiovani">Jardim Bongiovani</option>
                            <option value="Jardim Aviação">Jardim Aviação</option>
                            <option value="Vila Industrial">Vila Industrial</option>
                            <option value="Cidade Universitária">Cidade Universitária</option>
                            <option value="Ana Jacinta">Ana Jacinta</option>
                            <option value="Brasil Novo">Brasil Novo</option>
                            <option value="Cohab">Cohab</option>
                            <option value="Montalvão">Montalvão</option>
                            <option value="Álvares Machado">Álvares Machado</option>
                            <option value="Regente Feijó">Regente Feijó</option>
                          </select>
                        </div>

                        <div className="space-y-1">
                          <label className="text-slate-400 font-bold block select-none">Bairro Destino*</label>
                          <select 
                            value={destNeighborhood}
                            onChange={(e) => {
                              setDestNeighborhood(e.target.value);
                              setDestAddress(`${e.target.value}, ${destCity}`);
                            }}
                            className="w-full p-2 bg-[#050310] rounded-lg border border-purple-950/20 text-[#e1e1e6] focus:border-purple-500 focus:outline-none text-[10.5px]"
                          >
                            <option value="">Selecione...</option>
                            <option value="Centro">Centro</option>
                            <option value="Parque do Povo">Parque do Povo</option>
                            <option value="Prudenshopping">Prudenshopping</option>
                            <option value="Jardim Bongiovani">Jardim Bongiovani</option>
                            <option value="Jardim Aviação">Jardim Aviação</option>
                            <option value="Vila Industrial">Vila Industrial</option>
                            <option value="Cidade Universitária">Cidade Universitária</option>
                            <option value="Ana Jacinta">Ana Jacinta</option>
                            <option value="Brasil Novo">Brasil Novo</option>
                            <option value="Cohab">Cohab</option>
                            <option value="Montalvão">Montalvão</option>
                            <option value="Álvares Machado">Álvares Machado</option>
                            <option value="Regente Feijó">Regente Feijó</option>
                          </select>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-slate-400 font-semibold block select-none">Cidade Origem</label>
                          <input 
                            type="text" 
                            value={pickupCity}
                            onChange={(e) => {
                              setPickupCity(e.target.value);
                              setPickupAddress(`${pickupNeighborhood}, ${e.target.value}`);
                            }}
                            className="w-full p-2 bg-[#050310] rounded-lg border border-purple-950/20 text-[#e1e1e6] focus:border-purple-500 focus:outline-none text-[10.5px]"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-slate-400 font-semibold block select-none">Cidade Destino</label>
                          <input 
                            type="text" 
                            value={destCity}
                            onChange={(e) => {
                              setDestCity(e.target.value);
                              setDestAddress(`${destNeighborhood}, ${e.target.value}`);
                            }}
                            className="w-full p-2 bg-[#050310] rounded-lg border border-purple-950/20 text-[#e1e1e6] focus:border-purple-500 focus:outline-none text-[10.5px]"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Calibração Contextual */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-slate-400 font-semibold block select-none">Condições de Clima</label>
                    <select 
                      value={selectedClimate}
                      onChange={(e) => setSelectedClimate(e.target.value)}
                      className="w-full p-2.5 bg-[#050310] rounded-xl border border-purple-950/25 text-[#e1e1e6] focus:border-purple-500 focus:outline-none"
                    >
                      <option value="Limpo">Limpo / Ensolarado</option>
                      <option value="Chuvoso">Chuvoso</option>
                      <option value="Nublado">Nublado</option>
                      <option value="Calor Extremo">Calor Extremo</option>
                      <option value="Frio">Frio</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-slate-400 font-semibold block select-none">Eventos Ativos na Região</label>
                    <select 
                      value={selectedSpecialEvent}
                      onChange={(e) => setSelectedSpecialEvent(e.target.value)}
                      className="w-full p-2.5 bg-[#050310] rounded-xl border border-purple-950/25 text-[#e1e1e6] focus:border-purple-500 focus:outline-none"
                    >
                      <option value="Nenhum">Nenhum evento especial</option>
                      <option value="Show / Concerto">Show / Concerto de Música</option>
                      <option value="Jogo de Futebol">Jogo de Futebol</option>
                      <option value="Feriado">Feriado Municipal</option>
                      <option value="Greve / Evento Especial">Greve / Interrupção de Ônibus</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-slate-400 font-semibold block select-none">Observações da Viagem (Opcional)</label>
                  <textarea 
                    value={observations}
                    onChange={(e) => setObservations(e.target.value)}
                    className="w-full p-2.5 bg-[#050310] rounded-xl border border-purple-950/25 text-[#e1e1e6] focus:border-purple-500 focus:outline-none min-h-[50px] leading-relaxed resize-none"
                    placeholder="Ex: Trânsito intenso perto do shopping, passageiro super simpático..."
                  />
                </div>
              </div>

              {saveError && (
                <div className="mx-5 mb-2 p-3 bg-rose-950/30 border border-rose-900/40 text-rose-400 text-xs rounded-xl font-mono">
                  ⚠️ Erro ao Salvar: {saveError}
                </div>
              )}

              <div className="p-5 border-t border-purple-950/20 bg-purple-950/10 flex items-center justify-between gap-3 shrink-0 modal-actions-container">
                <button 
                  type="button"
                  onClick={() => setShowDebugDataModal(true)}
                  disabled={isSavingCalibration}
                  className="px-4 py-2.5 rounded-xl border border-dashed border-purple-600/40 hover:bg-purple-950/25 text-purple-300 font-mono text-xs select-none cursor-pointer transition-all flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Terminal className="w-3.5 h-3.5" /> Ver dados capturados
                </button>

                <div className="flex items-center gap-2 modal-btn-group">
                  <button 
                    type="button"
                    onClick={handleCancelFinishRide}
                    disabled={isSavingCalibration}
                    className="px-4 py-2.5 rounded-xl border border-purple-950/45 hover:bg-purple-950/20 text-purple-400 font-semibold select-none cursor-pointer transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Voltar
                  </button>
                  <button 
                    type="button"
                    onClick={handleConfirmFinishRide}
                    disabled={isSavingCalibration}
                    className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white font-bold select-none cursor-pointer transition-all shadow-[0_2px_10px_rgba(16,185,129,0.15)] flex items-center gap-1.5 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {isSavingCalibration ? (
                      <>
                        <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        Salvando...
                      </>
                    ) : (
                      'Confirmar & Salvar para IA'
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* MODAL: VER DADOS CAPTURADOS (Requirement 7) */}
      <AnimatePresence>
        {showDebugDataModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-[#050310]/95 backdrop-blur-md"
          >
            <motion.div
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 15 }}
              className="w-full max-w-2xl max-h-[90vh] rounded-2xl bg-[#0b081e] border border-purple-950/45 shadow-2xl flex flex-col overflow-hidden text-left"
            >
              <div className="p-5 border-b border-purple-950/20 bg-purple-950/10 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Terminal className="w-5 h-5 text-purple-400" />
                  <h3 className="text-[#f1f1f6] text-lg font-bold">Dados Capturados para IA (Debug)</h3>
                </div>
                <button
                  onClick={() => setShowDebugDataModal(false)}
                  className="p-1 rounded-lg hover:bg-purple-950/40 text-slate-400 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-5 overflow-y-auto space-y-4 font-mono text-xs text-[#c9c9d4] leading-relaxed">
                <p className="text-slate-400 mb-2">Estes são os metadados de alta fidelidade que serão persistidos no banco de dados para calibração dos modelos de IA:</p>
                
                {(() => {
                  const preview = getPreviewData();
                  if (!preview) return <p className="text-rose-400">Nenhum dado ativo de corrida encontrado.</p>;
                  return (
                    <div className="space-y-3 text-left">
                      <div className="bg-[#050310] p-4 rounded-xl border border-purple-950/20 space-y-2">
                        <div className="text-emerald-400 font-bold border-b border-purple-950/15 pb-1 mb-2">📍 ROTA E LOCALIZAÇÃO</div>
                        <div><span className="text-purple-400">Origem Bairro:</span> {preview.pickup_neighborhood}</div>
                        <div><span className="text-purple-400">Origem GPS:</span> Lat: {preview.origem?.lat?.toFixed(6)}, Lng: {preview.origem?.lng?.toFixed(6)}</div>
                        <div><span className="text-purple-400">Destino Bairro:</span> {preview.destination_neighborhood}</div>
                        <div><span className="text-purple-400">Destino GPS:</span> Lat: {preview.desembarque?.lat?.toFixed(6)}, Lng: {preview.desembarque?.lng?.toFixed(6)}</div>
                        <div><span className="text-purple-400">Rota Completa:</span> {preview.rota_completa?.length || 0} pontos capturados</div>
                      </div>

                      <div className="bg-[#050310] p-4 rounded-xl border border-purple-950/20 space-y-2">
                        <div className="text-sky-400 font-bold border-b border-purple-950/15 pb-1 mb-2">⏱️ CRONOMETRAGEM & TELEMETRIA</div>
                        <div><span className="text-purple-400">Duração Total:</span> {Math.floor(preview.duração / 60)}m {preview.duração % 60}s ({preview.duração} segundos)</div>
                        <div><span className="text-purple-400">Tempo Parado (Idle):</span> {(preview.tempo_parado / 60).toFixed(2)} minutos ({preview.tempo_parado?.toFixed(0)} segundos)</div>
                        <div><span className="text-purple-400">Velocidade Média:</span> {preview.velocidade_media} km/h</div>
                        <div><span className="text-purple-400">Velocidade Máxima:</span> {preview.velocidade_maxima} km/h</div>
                      </div>

                      <div className="bg-[#050310] p-4 rounded-xl border border-purple-950/20 space-y-2">
                        <div className="text-amber-400 font-bold border-b border-purple-950/15 pb-1 mb-2">💸 FINANÇAS & CONSUMO</div>
                        <div><span className="text-purple-400">Valor Recebido:</span> R$ {preview.fare_value.toFixed(2)}</div>
                        <div><span className="text-purple-400">Distância Real:</span> {preview.distancia_real} km</div>
                        <div><span className="text-purple-400">Custo de Operação:</span> R$ {preview.custo?.toFixed(2)}</div>
                        <div><span className="text-purple-400">Lucro Líquido:</span> R$ {preview.lucro?.toFixed(2)}</div>
                        <div><span className="text-purple-400">Consumo Calculado:</span> {preview.consumo?.amount} {preview.consumo?.unit}</div>
                      </div>

                      <div className="bg-[#050310] p-3 rounded-xl border border-purple-950/20">
                        <div className="text-purple-400 font-bold mb-1">JSON RAW DE TELEMETRIA:</div>
                        <pre className="p-2.5 bg-black/40 rounded-lg overflow-x-auto text-[10px] text-slate-300 max-h-48">
                          {JSON.stringify(preview, null, 2)}
                        </pre>
                      </div>
                    </div>
                  );
                })()}
              </div>

              <div className="p-5 border-t border-purple-950/20 bg-purple-950/10 flex items-center justify-end">
                <button
                  onClick={() => setShowDebugDataModal(false)}
                  className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold cursor-pointer select-none transition-all"
                >
                  Fechar Visualização
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* MODAL: CANCELAR CORRIDA */}
      <AnimatePresence>
        {cancelModalOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-[#050310]/85 backdrop-blur-md"
          >
            <motion.div 
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 15 }}
              className="bg-[#0d0926] border border-purple-950/40 rounded-3xl w-full max-w-md overflow-hidden shadow-[0_10px_50px_rgba(244,63,94,0.15)] text-left flex flex-col"
            >
              <div className="p-5 border-b border-purple-950/20 bg-purple-950/10 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white uppercase font-mono tracking-wider flex items-center gap-2">
                    ❌ Cancelar Corrida Ativa
                  </h3>
                  <p className="text-[10px] text-rose-300 mt-0.5">
                    O cancelamento ensina as restrições da IA do DriverDash.
                  </p>
                </div>
                <button 
                  type="button"
                  onClick={handleCloseCancelRide}
                  disabled={isSavingCalibration}
                  className="p-1 rounded-lg bg-purple-950/20 hover:bg-purple-950/40 text-purple-400 cursor-pointer select-none disabled:opacity-50"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-5 space-y-4 text-xs">
                <div className="space-y-1">
                  <label className="text-slate-400 font-bold block select-none">Motivo do Cancelamento*</label>
                  <select 
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                    disabled={isSavingCalibration}
                    className="w-full p-2.5 bg-[#050310] rounded-xl border border-purple-950/25 text-[#e1e1e6] focus:border-purple-500 focus:outline-none disabled:opacity-50"
                  >
                    <option value="Passageiro">Passageiro não apareceu / desistiu</option>
                    <option value="Motorista">Inviável por questões de segurança (Motorista)</option>
                    <option value="App">Problema de conexão / Erro no App parceiro</option>
                    <option value="Trânsito">Trânsito intransitável / Acidente</option>
                    <option value="Outro">Outro motivo</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-slate-400 font-semibold block select-none">Observações do Cancelamento (Opcional)</label>
                  <textarea 
                    value={cancelObs}
                    onChange={(e) => setCancelObs(e.target.value)}
                    disabled={isSavingCalibration}
                    className="w-full p-2.5 bg-[#050310] rounded-xl border border-purple-950/25 text-[#e1e1e6] focus:border-purple-500 focus:outline-none min-h-[60px] leading-relaxed resize-none disabled:opacity-50"
                    placeholder="Descreva o motivo opcional..."
                  />
                </div>
              </div>

              {saveError && (
                <div className="mx-5 mb-2 p-3 bg-rose-950/30 border border-rose-900/40 text-rose-400 text-xs rounded-xl font-mono">
                  ⚠️ Erro ao Cancelar: {saveError}
                </div>
              )}

              <div className="p-5 border-t border-purple-950/20 bg-purple-950/10 flex items-center justify-end gap-3 shrink-0">
                <button 
                  type="button"
                  onClick={handleCloseCancelRide}
                  disabled={isSavingCalibration}
                  className="px-4 py-2.5 rounded-xl border border-purple-950/45 hover:bg-purple-950/20 text-purple-400 font-semibold select-none cursor-pointer transition-all disabled:opacity-50"
                >
                  Voltar
                </button>
                <button 
                  type="button"
                  onClick={handleConfirmCancelRide}
                  disabled={isSavingCalibration}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-rose-700 to-red-600 hover:from-rose-600 hover:to-red-500 text-white font-bold select-none cursor-pointer transition-all shadow-[0_2px_10px_rgba(225,29,72,0.15)] disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
                >
                  {isSavingCalibration ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Salvando...</span>
                    </>
                  ) : (
                    <span>Confirmar Cancelamento</span>
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* MODAL: EDITAR CORRIDA CALIBRADA */}
      <AnimatePresence>
        {editModalOpen && editingRide && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-[#050310]/85 backdrop-blur-md"
          >
            <motion.div 
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 15 }}
              className="bg-[#0d0926] border border-purple-950/40 rounded-3xl w-full max-w-lg overflow-hidden shadow-[0_10px_50px_rgba(76,29,149,0.3)] text-left flex flex-col max-h-[90vh]"
            >
              <div className="p-5 border-b border-purple-950/20 bg-purple-950/10 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white uppercase font-mono tracking-wider flex items-center gap-2">
                    ⚙️ Editar Dados de Calibração
                  </h3>
                  <p className="text-[10px] text-purple-300 mt-0.5">
                    Modifique dados reais ou corrija pendências de IA.
                  </p>
                </div>
                <button 
                  type="button"
                  onClick={() => setEditModalOpen(false)}
                  className="p-1 rounded-lg bg-purple-950/20 hover:bg-purple-950/40 text-purple-400 cursor-pointer select-none"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-5 space-y-4 overflow-y-auto custom-scrollbar flex-1 text-xs">
                {/* Financeiro */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-slate-400 font-bold block select-none">Valor Recebido (R$)*</label>
                    <input 
                      type="number" 
                      step="0.01"
                      value={receivedValue}
                      onChange={(e) => setReceivedValue(e.target.value)}
                      className="w-full p-2.5 bg-[#050310] rounded-xl border border-purple-950/25 text-[#e1e1e6] focus:border-purple-500 focus:outline-none font-mono"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-slate-400 font-bold block select-none">Plataforma*</label>
                    <select 
                      value={platform}
                      onChange={(e) => setPlatform(e.target.value)}
                      className="w-full p-2.5 bg-[#050310] rounded-xl border border-purple-950/25 text-[#e1e1e6] focus:border-purple-500 focus:outline-none"
                    >
                      <option value="Uber">Uber</option>
                      <option value="99">99</option>
                      <option value="InDrive">InDrive</option>
                      <option value="Particular">Particular</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-slate-400 font-semibold block select-none">Gorjeta (R$ - Opcional)</label>
                    <input 
                      type="number" 
                      step="0.01"
                      value={tipValue}
                      onChange={(e) => setTipValue(e.target.value)}
                      className="w-full p-2.5 bg-[#050310] rounded-xl border border-purple-950/25 text-[#e1e1e6] focus:border-purple-500 focus:outline-none font-mono"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-slate-400 font-semibold block select-none">Pedágio (R$ - Opcional)</label>
                    <input 
                      type="number" 
                      step="0.01"
                      value={tollValue}
                      onChange={(e) => setTollValue(e.target.value)}
                      className="w-full p-2.5 bg-[#050310] rounded-xl border border-purple-950/25 text-[#e1e1e6] focus:border-purple-500 focus:outline-none font-mono"
                    />
                  </div>
                </div>

                {/* Localização */}
                <div className="p-4 bg-purple-950/15 rounded-2xl border border-purple-950/20 space-y-3">
                  <h4 className="font-bold text-purple-400 uppercase tracking-wide text-[10px] select-none flex items-center gap-1.5">
                    ⚙️ Correção de Localidades
                  </h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-slate-400 font-bold block select-none">Bairro Origem*</label>
                      <input 
                        type="text"
                        value={pickupNeighborhood}
                        onChange={(e) => setPickupNeighborhood(e.target.value)}
                        placeholder="Ex: Centro"
                        className="w-full p-2 bg-[#050310] rounded-lg border border-purple-950/20 text-[#e1e1e6] focus:border-purple-500 focus:outline-none text-[10.5px]"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-slate-400 font-bold block select-none">Bairro Destino*</label>
                      <input 
                        type="text"
                        value={destNeighborhood}
                        onChange={(e) => setDestNeighborhood(e.target.value)}
                        placeholder="Ex: Bongiovani"
                        className="w-full p-2 bg-[#050310] rounded-lg border border-purple-950/20 text-[#e1e1e6] focus:border-purple-500 focus:outline-none text-[10.5px]"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-slate-400 font-semibold block select-none">Cidade Origem</label>
                      <input 
                        type="text"
                        value={pickupCity}
                        onChange={(e) => setPickupCity(e.target.value)}
                        className="w-full p-2 bg-[#050310] rounded-lg border border-purple-950/20 text-[#e1e1e6] focus:border-purple-500 focus:outline-none text-[10.5px]"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-slate-400 font-semibold block select-none">Cidade Destino</label>
                      <input 
                        type="text"
                        value={destCity}
                        onChange={(e) => setDestCity(e.target.value)}
                        className="w-full p-2 bg-[#050310] rounded-lg border border-purple-950/20 text-[#e1e1e6] focus:border-purple-500 focus:outline-none text-[10.5px]"
                      />
                    </div>
                  </div>
                </div>

                {/* Contextuais */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-slate-400 font-semibold block select-none">Condições de Clima</label>
                    <select 
                      value={selectedClimate}
                      onChange={(e) => setSelectedClimate(e.target.value)}
                      className="w-full p-2.5 bg-[#050310] rounded-xl border border-purple-950/25 text-[#e1e1e6] focus:border-purple-500 focus:outline-none"
                    >
                      <option value="Limpo">Limpo / Ensolarado</option>
                      <option value="Chuvoso">Chuvoso</option>
                      <option value="Nublado">Nublado</option>
                      <option value="Calor Extremo">Calor Extremo</option>
                      <option value="Frio">Frio</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-slate-400 font-semibold block select-none">Eventos Ativos na Região</label>
                    <select 
                      value={selectedSpecialEvent}
                      onChange={(e) => setSelectedSpecialEvent(e.target.value)}
                      className="w-full p-2.5 bg-[#050310] rounded-xl border border-purple-950/25 text-[#e1e1e6] focus:border-purple-500 focus:outline-none"
                    >
                      <option value="Nenhum">Nenhum evento especial</option>
                      <option value="Show / Concerto">Show / Concerto de Música</option>
                      <option value="Jogo de Futebol">Jogo de Futebol</option>
                      <option value="Feriado">Feriado Municipal</option>
                      <option value="Greve / Evento Especial">Greve / Interrupção de Ônibus</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-slate-400 font-semibold block select-none">Observações da Viagem (Opcional)</label>
                  <textarea 
                    value={observations}
                    onChange={(e) => setObservations(e.target.value)}
                    className="w-full p-2.5 bg-[#050310] rounded-xl border border-purple-950/25 text-[#e1e1e6] focus:border-purple-500 focus:outline-none min-h-[50px] leading-relaxed resize-none"
                    placeholder="Ex: Trânsito intenso..."
                  />
                </div>
              </div>

              {saveError && (
                <div className="mx-5 mb-2 p-3 bg-rose-950/30 border border-rose-900/40 text-rose-400 text-xs rounded-xl font-mono">
                  ⚠️ Erro ao Salvar: {saveError}
                </div>
              )}

              <div className="p-5 border-t border-purple-950/20 bg-purple-950/10 flex items-center justify-end gap-3 shrink-0">
                <button 
                  type="button"
                  onClick={() => setEditModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-purple-950/45 hover:bg-purple-950/20 text-purple-400 font-semibold select-none cursor-pointer transition-all"
                >
                  Voltar
                </button>
                <button 
                  type="button"
                  onClick={handleConfirmEditRide}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white font-bold select-none cursor-pointer transition-all shadow-[0_2px_10px_rgba(16,185,129,0.15)]"
                >
                  Confirmar & Salvar para IA
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* MODAL: MAPA DA ROTA */}
      <AnimatePresence>
        {isMapOpen && selectedRouteRide && (
          <CalibrationRouteMap 
            routePoints={selectedRouteRide.rideTrackPoints || []}
            startLocation={selectedRouteRide.pickup_lat && selectedRouteRide.pickup_lng ? { lat: selectedRouteRide.pickup_lat, lng: selectedRouteRide.pickup_lng } : null}
            endLocation={selectedRouteRide.dropoff_lat && selectedRouteRide.dropoff_lng ? { lat: selectedRouteRide.dropoff_lat, lng: selectedRouteRide.dropoff_lng } : null}
            bairroOrigem={selectedRouteRide.bairroOrigem}
            bairroDestino={selectedRouteRide.bairroDestino}
            onClose={() => {
              console.log('[MAP_CLOSE]');
              setSelectedRouteRide(null);
              setIsMapOpen(false);
            }} 
          />
        )}
      </AnimatePresence>

      {/* MODAL: DIAGNÓSTICO DE TELEMETRIA */}
      <AnimatePresence>
        {selectedTelemetryRide && (
          <TelemetryDebugModal 
            ride={selectedTelemetryRide}
            onClose={() => setSelectedTelemetryRide(null)}
          />
        )}
      </AnimatePresence>

      {/* MODAL: ENCERRAMENTO SEGURO DA JORNADA */}
      <AnimatePresence>
        {journeyEndModalOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="journey-modal fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-[#050310]/90 backdrop-blur-md"
          >
            <motion.div 
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 15 }}
              className="bg-[#0d0926] border border-purple-950/40 rounded-3xl w-full max-w-md overflow-hidden shadow-[0_10px_50px_rgba(147,51,234,0.2)] text-left flex flex-col"
            >
              <div className="p-5 border-b border-purple-950/20 bg-purple-950/10 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white uppercase font-mono tracking-wider flex items-center gap-2">
                    🛑 Encerramento de Jornada
                  </h3>
                  <p className="text-[10px] text-purple-300 mt-0.5">
                    Salvando com segurança o progresso de sua jornada.
                  </p>
                </div>
                <button 
                  type="button"
                  onClick={handleCancelJourneyEnd}
                  disabled={isSyncingBeforeEnd}
                  className="p-1 rounded-lg bg-purple-950/20 hover:bg-purple-950/40 text-purple-400 cursor-pointer select-none disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-5 space-y-4 text-xs">
                {/* Sync Status Banner */}
                <div className="p-4 rounded-2xl bg-purple-950/15 border border-purple-950/30 flex flex-col items-center justify-center text-center space-y-3">
                  {syncStatusBeforeEnd === 'syncing' ? (
                    <>
                      <RefreshCw className="w-8 h-8 text-purple-400 animate-spin" />
                      <div>
                        <p className="font-bold text-slate-200">Sincronizando dados...</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">Por favor, aguarde alguns instantes.</p>
                      </div>
                    </>
                  ) : syncStatusBeforeEnd === 'success' || pendingPointsCountBeforeEnd === 0 ? (
                    <>
                      <div className="h-10 w-10 rounded-full bg-emerald-950/60 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                        <Check className="w-6 h-6" />
                      </div>
                      <div>
                        <p className="font-bold text-emerald-400">Sincronização concluída!</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">Seus dados foram salvos com sucesso.</p>
                      </div>
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="w-8 h-8 text-yellow-500 animate-pulse" />
                      <div>
                        <p className="font-bold text-yellow-500">Sincronização em andamento</p>
                        <p className="text-[10px] text-slate-400 mt-1">
                          Estamos salvando seus dados de forma segura.
                        </p>
                      </div>
                    </>
                  )}
                </div>

                {/* Bloco de Alerta Simplificado */}
                <div className="p-4 rounded-xl bg-[#050310] border border-purple-950/20 space-y-1.5">
                  {pendingPointsCountBeforeEnd > 0 && syncStatusBeforeEnd !== 'success' ? (
                    <>
                      <p className="font-bold text-yellow-500 text-xs">
                        {pendingPointsCountBeforeEnd} pontos aguardando sincronização
                      </p>
                      <p className="text-[10.5px] text-slate-400 leading-normal">
                        Esses dados serão enviados quando houver conexão.
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="font-bold text-emerald-400 text-xs">
                        Tudo pronto para encerrar!
                      </p>
                      <p className="text-[10.5px] text-slate-400 leading-normal">
                        Sua jornada foi salva e está pronta para encerramento.
                      </p>
                    </>
                  )}
                </div>
              </div>

              {/* Ações (Simplificadas e Hierárquicas) */}
              <div className="p-5 border-t border-purple-950/20 bg-purple-950/10 flex flex-col gap-2.5 shrink-0">
                {pendingPointsCountBeforeEnd > 0 && syncStatusBeforeEnd !== 'success' && (
                  <button 
                    type="button"
                    onClick={handleForceSyncBeforeEnd}
                    disabled={isSyncingBeforeEnd}
                    className="w-full px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold select-none cursor-pointer transition-all text-center flex items-center justify-center gap-1.5 shadow-[0_2px_10px_rgba(59,130,246,0.15)] disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isSyncingBeforeEnd ? 'animate-spin' : ''}`} />
                    <span>{isSyncingBeforeEnd ? 'Sincronizando...' : 'Tentar Sincronizar'}</span>
                  </button>
                )}

                <button 
                  type="button"
                  onClick={() => handleConfirmEndJourney(syncStatusBeforeEnd !== 'success' && pendingPointsCountBeforeEnd > 0)}
                  disabled={isSyncingBeforeEnd}
                  className={`w-full px-5 py-2.5 rounded-xl text-white font-bold select-none cursor-pointer transition-all text-center flex items-center justify-center gap-1.5 ${
                    syncStatusBeforeEnd === 'success' || pendingPointsCountBeforeEnd === 0
                      ? 'bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 shadow-[0_2px_10px_rgba(16,185,129,0.15)]'
                      : 'bg-purple-900/40 hover:bg-purple-900/60 border border-purple-700/50 hover:border-purple-600/60 text-purple-200'
                  }`}
                >
                  <span>Encerrar com Segurança</span>
                </button>

                <button 
                  type="button"
                  onClick={handleCancelJourneyEnd}
                  disabled={isSyncingBeforeEnd}
                  className="w-full px-4 py-2.5 rounded-xl border border-purple-950/45 hover:bg-purple-950/20 text-purple-400 font-semibold select-none cursor-pointer transition-all disabled:opacity-40 text-center"
                >
                  Cancelar
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* COMPONENT: TOAST NOTIFICATION PREMIUM */}
      <AnimatePresence>
        {toast.show && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-6 right-6 z-50 p-4 bg-emerald-950 border border-emerald-500/30 text-emerald-300 rounded-2xl flex items-center gap-3 shadow-[0_10px_40px_rgba(16,185,129,0.25)] w-full max-w-sm"
          >
            <div className="h-8 w-8 rounded-full bg-emerald-900/50 flex items-center justify-center text-emerald-400 shrink-0">
              <Check className="w-5 h-5" />
            </div>
            <div className="text-left font-sans text-xs">
              <p className="font-bold text-white leading-normal">Sucesso</p>
              <p className="text-[11px] text-emerald-400">{toast.message}</p>
            </div>
            <button
              onClick={() => setToast(prev => ({ ...prev, show: false }))}
              className="ml-auto p-1 text-emerald-400 hover:text-emerald-200 cursor-pointer select-none"
            >
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
};
