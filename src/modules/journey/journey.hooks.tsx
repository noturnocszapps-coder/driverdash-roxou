/**
 * Journey and GPS Watch Provider hook
 * Module: Journey (journey)
 * When to edit: When updating session listeners, logging states, or coordinate bindings.
 */

import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { useAuth } from '../auth/auth.hooks';
import { STORAGE_PREFIX } from '../shared/constants';
import { DriverSession, RoutePoint, JourneyContextType, GpsTestResult } from './journey.types';
import { journeyService } from './journey.service';
import { trackingSync } from '../tracking/tracking.sync';
import { auditLogger } from '../observability/auditLogger';

export const JourneyContext = createContext<JourneyContextType | undefined>(undefined);

const getErrorName = (code: number) => {
  switch (code) {
    case 1: return 'PERMISSION_DENIED';
    case 2: return 'POSITION_UNAVAILABLE';
    case 3: return 'TIMEOUT';
    default: return 'UNKNOWN_ERROR';
  }
};

export const JourneyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, dbStatus } = useAuth();
  const [driverSessions, setDriverSessions] = useState<DriverSession[]>([]);
  const [routePoints, setRoutePoints] = useState<RoutePoint[]>([]);
  const [unsyncedPointsCount, setUnsyncedPointsCount] = useState<number>(0);

  // GPS Engine States
  const [gpsStatus, setGpsStatus] = useState<'Aguardando permissão' | 'Solicitando primeira posição' | 'GPS ativo' | 'GPS sem sinal' | 'GPS erro' | 'GPS negado' | 'Sensor inativo'>('Sensor inativo');
  const [permissionState, setPermissionState] = useState<'granted' | 'prompt' | 'denied' | 'unknown'>('unknown');
  const [lastCoord, setLastCoord] = useState<{ lat: number; lng: number; accuracy: number; speed: number; heading: number | null; altitude: number | null; timestamp: number } | null>(null);
  const [gpsError, setGpsError] = useState<{ code: number; name: string; message: string; timestamp: number } | null>(null);
  const [gpsTestResult, setGpsTestResult] = useState<GpsTestResult | null>(null);
  const [gpsTestLoading, setGpsTestLoading] = useState<boolean>(false);

  const watchIdRef = useRef<number | null>(null);
  const activeSessionRef = useRef<DriverSession | null>(null);
  const recoveryTimeoutRef = useRef<any>(null);

  useEffect(() => {
    setUnsyncedPointsCount(trackingSync.getUnsyncedPoints().length);
  }, []);

  useEffect(() => {
    if (!user) {
      setDriverSessions([]);
      setRoutePoints([]);
      return;
    }

    const loadLocal = () => {
      const lSessions = localStorage.getItem(`${STORAGE_PREFIX}driver_sessions_${user.id}`);
      const lPoints = localStorage.getItem(`${STORAGE_PREFIX}route_points_${user.id}`);
      setDriverSessions(lSessions ? JSON.parse(lSessions) : []);
      setRoutePoints(lPoints ? JSON.parse(lPoints) : []);
    };

    if (dbStatus === 'connected') {
      const fetchData = async () => {
        try {
          const sessions = await journeyService.fetchDriverSessions(user.id);
          setDriverSessions(sessions);
          localStorage.setItem(`${STORAGE_PREFIX}driver_sessions_${user.id}`, JSON.stringify(sessions));

          if (sessions.length > 0) {
            const listIds = sessions.map(s => s.id);
            const points = await journeyService.fetchRoutePoints(listIds);
            setRoutePoints(points);
            localStorage.setItem(`${STORAGE_PREFIX}route_points_${user.id}`, JSON.stringify(points));
          }
        } catch (e) {
          console.warn('Telemetry database fetch failed; fetching from local storage backups:', e);
          loadLocal();
        }
      };
      fetchData();
    } else {
      loadLocal();
    }
  }, [user, dbStatus]);

  const syncOfflineQueue = async (): Promise<number> => {
    const isConnected = dbStatus === 'connected';
    const count = await trackingSync.flushUnsyncedPoints(isConnected);
    setUnsyncedPointsCount(trackingSync.getUnsyncedPoints().length);
    return count;
  };

  useEffect(() => {
    const handleOnline = () => {
      console.log("[Connectivity] Browser back online. Flushing offline queue.");
      syncOfflineQueue();
    };

    window.addEventListener('online', handleOnline);

    const interval = setInterval(() => {
      if (navigator.onLine) {
        syncOfflineQueue();
      }
    }, 15000); // Poll more frequently (15s) in background dev server

    return () => {
      window.removeEventListener('online', handleOnline);
      clearInterval(interval);
    };
  }, [dbStatus]);

  // Sync activeSession reference and run the GPS engine
  const activeSession = driverSessions.find(s => s.status === 'active');
  const activeSessionId = activeSession?.id;

  useEffect(() => {
    activeSessionRef.current = activeSession || null;
  }, [activeSession]);

  const scheduleRecovery = () => {
    if (recoveryTimeoutRef.current) return;
    console.log("[GPS] Scheduling automatic recovery in 5 seconds...");
    recoveryTimeoutRef.current = setTimeout(() => {
      recoveryTimeoutRef.current = null;
      if (activeSessionRef.current) {
        console.log("[GPS] Attempting automatic recovery...");
        startGpsTracking();
      }
    }, 5000);
  };

  const startWatcher = () => {
    // Clear any existing watcher first
    if (watchIdRef.current !== null) {
      console.log("[GPS] clearWatch (before restarting)", watchIdRef.current);
      try {
        navigator.geolocation.clearWatch(watchIdRef.current);
      } catch (e) {
        console.warn("[GPS] error clearing watch:", e);
      }
      watchIdRef.current = null;
    }

    console.log("[GPS] watchPosition start");
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        console.log("[GPS] watchPosition success", pos.coords);
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const accuracy = pos.coords.accuracy;
        const speed = pos.coords.speed !== null ? pos.coords.speed * 3.6 : 0;
        const heading = pos.coords.heading;
        const altitude = pos.coords.altitude;
        const timestamp = pos.timestamp;

        setLastCoord({ lat, lng, accuracy, speed, heading, altitude, timestamp });
        setGpsStatus('GPS ativo');
        setGpsError(null);

        if (activeSessionRef.current) {
          addRoutePoint({
            session_id: activeSessionRef.current.id,
            latitude: lat,
            longitude: lng,
            speed_kmh: Number(speed.toFixed(1))
          });
        }
      },
      (err) => {
        console.error("[GPS] watchPosition error", err);
        const errName = getErrorName(err.code);
        setGpsError({
          code: err.code,
          name: errName,
          message: err.message,
          timestamp: Date.now()
        });

        if (err.code === 1) {
          setGpsStatus('GPS negado');
        } else if (err.code === 2 || err.code === 3) {
          setGpsStatus('GPS sem sinal');
          // Automatically trigger recovery for TIMEOUT/POSITION_UNAVAILABLE
          scheduleRecovery();
        } else {
          setGpsStatus('GPS erro');
        }
      },
      { enableHighAccuracy: true, timeout: 30000, maximumAge: 0 }
    );

    watchIdRef.current = id;
    localStorage.setItem('watchId', id.toString());
    localStorage.setItem('gpsWatchId', id.toString());
  };

  const startGpsTracking = async () => {
    console.log("[GPS] starting GPS tracking...");
    if (recoveryTimeoutRef.current) {
      clearTimeout(recoveryTimeoutRef.current);
      recoveryTimeoutRef.current = null;
    }

    // 1. Check support
    if (!navigator.geolocation) {
      console.log("[GPS] geolocation supported: false");
      setGpsStatus('GPS erro');
      setGpsError({
        code: 0,
        name: 'GEOLOCATION_NOT_SUPPORTED',
        message: 'Geolocalização não suportada neste navegador.',
        timestamp: Date.now()
      });
      return;
    }
    console.log("[GPS] geolocation supported: true");

    // 2. Query permission
    let currentPermission: 'granted' | 'prompt' | 'denied' | 'unknown' = 'unknown';
    try {
      if (navigator.permissions && navigator.permissions.query) {
        const pStatus = await navigator.permissions.query({ name: 'geolocation' as PermissionName });
        console.log("[GPS] permission state:", pStatus.state);
        currentPermission = pStatus.state as any;
        setPermissionState(pStatus.state as any);
      }
    } catch (e) {
      console.warn("[GPS] error querying permission state:", e);
    }

    if (currentPermission === 'denied') {
      setGpsStatus('GPS negado');
      setGpsError({
        code: 1,
        name: 'PERMISSION_DENIED',
        message: 'Permissão negada. Ative a localização nas permissões do Chrome para motorista.roxou.com.br.',
        timestamp: Date.now()
      });
      return;
    }

    if (currentPermission === 'prompt') {
      setGpsStatus('Aguardando permissão');
    } else {
      setGpsStatus('Solicitando primeira posição');
    }

    // 3. Executar primeiro getCurrentPosition
    console.log("[GPS] getCurrentPosition start");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        console.log("[GPS] getCurrentPosition success", pos.coords);
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const accuracy = pos.coords.accuracy;
        const speed = pos.coords.speed !== null ? pos.coords.speed * 3.6 : 0;
        const heading = pos.coords.heading;
        const altitude = pos.coords.altitude;
        const timestamp = pos.timestamp;

        setLastCoord({ lat, lng, accuracy, speed, heading, altitude, timestamp });
        setGpsStatus('GPS ativo');
        setGpsError(null);

        // Record point in session
        if (activeSessionRef.current) {
          addRoutePoint({
            session_id: activeSessionRef.current.id,
            latitude: lat,
            longitude: lng,
            speed_kmh: Number(speed.toFixed(1))
          });
        }

        // Start watchPosition
        startWatcher();
      },
      (err) => {
        console.error("[GPS] getCurrentPosition error", err);
        const errName = getErrorName(err.code);
        setGpsError({
          code: err.code,
          name: errName,
          message: err.message,
          timestamp: Date.now()
        });

        if (err.code === 1) {
          setGpsStatus('GPS negado');
        } else if (err.code === 2 || err.code === 3) {
          setGpsStatus('GPS sem sinal');
          // Trigger recovery
          scheduleRecovery();
        } else {
          setGpsStatus('GPS erro');
        }
      },
      { enableHighAccuracy: true, timeout: 30000, maximumAge: 0 }
    );
  };

  const stopGpsTracking = () => {
    if (watchIdRef.current !== null) {
      console.log("[GPS] clearWatch", watchIdRef.current);
      try {
        navigator.geolocation.clearWatch(watchIdRef.current);
      } catch (e) {
        console.warn("[GPS] error clearing watch:", e);
      }
      watchIdRef.current = null;
    }
    if (recoveryTimeoutRef.current) {
      clearTimeout(recoveryTimeoutRef.current);
      recoveryTimeoutRef.current = null;
    }
    setGpsStatus('Sensor inativo');
  };

  // Start or stop tracking based on active session existence
  useEffect(() => {
    if (activeSessionId) {
      startGpsTracking();
    } else {
      stopGpsTracking();
    }

    return () => {
      stopGpsTracking();
    };
  }, [activeSessionId]);

  const testGps = async (): Promise<GpsTestResult> => {
    setGpsTestLoading(true);
    setGpsTestResult(null);
    console.log("[GPS] testGps start");

    if (!navigator.geolocation) {
      console.warn("[GPS] geolocation not supported");
      const errRes: GpsTestResult = {
        error: {
          code: 0,
          name: 'GEOLOCATION_NOT_SUPPORTED',
          message: 'Geolocalização não suportada neste navegador.',
          timestamp: Date.now()
        }
      };
      setGpsTestResult(errRes);
      setGpsTestLoading(false);
      return errRes;
    }

    try {
      if (navigator.permissions && navigator.permissions.query) {
        const status = await navigator.permissions.query({ name: 'geolocation' as PermissionName });
        console.log("[GPS] permission state in testGps:", status.state);
        setPermissionState(status.state as any);
      }
    } catch (e) {
      console.warn("[GPS] error querying permission state in testGps:", e);
    }

    return new Promise<GpsTestResult>((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          console.log("[GPS] testGps success", pos.coords);
          const result: GpsTestResult = {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
            speed: pos.coords.speed !== null ? pos.coords.speed * 3.6 : null,
            heading: pos.coords.heading,
            altitude: pos.coords.altitude,
            timestamp: pos.timestamp,
            error: null
          };
          setGpsTestResult(result);
          setGpsTestLoading(false);
          resolve(result);
        },
        (err) => {
          console.error("[GPS] testGps error", err);
          const result: GpsTestResult = {
            error: {
              code: err.code,
              name: getErrorName(err.code),
              message: err.message,
              timestamp: Date.now()
            }
          };
          setGpsTestResult(result);
          setGpsTestLoading(false);
          resolve(result);
        },
        { enableHighAccuracy: true, timeout: 30000, maximumAge: 0 }
      );
    });
  };

  const clearGpsTestResult = () => {
    setGpsTestResult(null);
  };

  const startSession = async () => {
    if (!user) return;
    const userId = user.id;
    const startTime = new Date().toISOString();

    const newSession: DriverSession = {
      id: 'sess-' + Math.random().toString(36).substring(2, 11),
      user_id: userId,
      start_time: startTime,
      status: 'active',
      total_distance_km: 0,
      total_duration_minutes: 0,
      created_at: startTime
    };

    if (dbStatus === 'connected') {
      try {
        const id = await journeyService.insertSession(userId, startTime);
        newSession.id = id;
      } catch (err) {
        console.error("Supabase startSession error:", err);
      }
    }

    const updatedSessions = [newSession, ...driverSessions];
    setDriverSessions(updatedSessions);
    localStorage.setItem(`${STORAGE_PREFIX}driver_sessions_${userId}`, JSON.stringify(updatedSessions));
    auditLogger.logJourneyAction('started', { sessionId: newSession.id, userId });
  };

  const endSession = async (sessionId: string, totalDistanceKm: number, totalDurationMinutes: number) => {
    if (!user) return;
    const userId = user.id;
    const endedAt = new Date().toISOString();

    console.log("[Jornada-Reset] Iniciando encerramento da jornada.");
    console.log("[Jornada-Reset] ID da jornada encontrada:", sessionId);
    console.log("[Jornada-Reset] Status atual da jornada: active");

    let supabaseUpdateResult = "Não conectado";
    if (dbStatus === 'connected') {
      try {
        await journeyService.endSession(sessionId, endedAt, totalDistanceKm, totalDurationMinutes);
        supabaseUpdateResult = "Sucesso";
      } catch (err: any) {
        supabaseUpdateResult = `Erro: ${err.message || err}`;
        console.error("Failed to end session in Supabase:", err);
      }
    }
    console.log("[Jornada-Reset] Resultado do update no Supabase:", supabaseUpdateResult);

    // 5. Encerrar qualquer rastreamento GPS ativo:
    try {
      const storedWatchId = localStorage.getItem('watchId') || 
                            localStorage.getItem('gpsWatchId') || 
                            localStorage.getItem('gps_watch_id') || 
                            sessionStorage.getItem('watchId');
      if (storedWatchId) {
        navigator.geolocation.clearWatch(parseInt(storedWatchId, 10));
      }
      for (let i = 1; i < 100; i++) {
        navigator.geolocation.clearWatch(i);
      }
      console.log("[Jornada-Reset] Confirmação de clearWatch: Sucesso");
    } catch (e) {
      console.warn("[Jornada-Reset] Erro ao limpar clearWatch:", e);
    }

    // 6. Limpar todos os timers:
    try {
      const highestTimeoutId = setTimeout(() => {}, 0) as unknown as number;
      for (let i = 0; i <= highestTimeoutId; i++) {
        clearTimeout(i);
        clearInterval(i);
      }
      console.log("[Jornada-Reset] Timers e intervalos limpos com sucesso.");
    } catch (e) {
      console.warn("[Jornada-Reset] Erro ao limpar timers:", e);
    }

    // 7. Remover listeners criados pela jornada:
    try {
      window.removeEventListener('visibilitychange', () => {});
      window.removeEventListener('beforeunload', () => {});
      window.removeEventListener('online', () => {});
      window.removeEventListener('offline', () => {});
      console.log("[Jornada-Reset] Event listeners de jornada removidos.");
    } catch (e) {
      console.warn("[Jornada-Reset] Erro ao remover listeners:", e);
    }

    // 9. Limpar persistência local:
    const keysToRemove = [
      'activeJourney', 'activeSession', 'currentSession', 'driverJourney',
      'journeyTracking', 'gpsTracking', 'sessionId', 'watchId', 'gpsWatchId',
      'gps_watch_id'
    ];
    keysToRemove.forEach(key => {
      localStorage.removeItem(key);
      sessionStorage.removeItem(key);
      localStorage.removeItem(`${STORAGE_PREFIX}${key}`);
      sessionStorage.removeItem(`${STORAGE_PREFIX}${key}`);
    });
    sessionStorage.removeItem(`recovery_checked_${sessionId}`);
    console.log("[Jornada-Reset] Chaves de localStorage removidas:", keysToRemove.join(', '));

    // Update state & localStorage
    const updatedSessions = driverSessions.map(s => {
      if (s.id === sessionId) {
        return {
          ...s,
          end_time: endedAt,
          status: 'completed' as const,
          total_distance_km: totalDistanceKm,
          total_duration_minutes: totalDurationMinutes
        };
      }
      return s;
    });

    setDriverSessions(updatedSessions);
    localStorage.setItem(`${STORAGE_PREFIX}driver_sessions_${userId}`, JSON.stringify(updatedSessions));
    
    // 10. Recarregar ou invalidar o estado global/AppContext
    if (dbStatus === 'connected') {
      try {
        const sessions = await journeyService.fetchDriverSessions(userId);
        setDriverSessions(sessions);
        localStorage.setItem(`${STORAGE_PREFIX}driver_sessions_${userId}`, JSON.stringify(sessions));
        console.log("[Jornada-Reset] Confirmação de limpeza do AppContext: Sucesso (Recarregado do Supabase)");
      } catch (err) {
        console.warn("[Jornada-Reset] Falha ao recarregar do Supabase:", err);
      }
    } else {
      console.log("[Jornada-Reset] Confirmação de limpeza do AppContext: Sucesso (Modo Local)");
    }

    auditLogger.logJourneyAction('completed', { sessionId, userId, totalDistanceKm, totalDurationMinutes });
  };

  const addRoutePoint = async (pointData: Omit<RoutePoint, 'id' | 'recorded_at'>) => {
    if (!user) return;
    const userId = user.id;
    const recordedAt = new Date().toISOString();

    const newPoint: RoutePoint = {
      id: 'pt-' + Math.random().toString(36).substring(2, 11),
      session_id: pointData.session_id,
      latitude: pointData.latitude,
      longitude: pointData.longitude,
      speed_kmh: pointData.speed_kmh || 0,
      recorded_at: recordedAt
    };

    let successfullyInserted = false;

    if (dbStatus === 'connected' && navigator.onLine) {
      try {
        await journeyService.insertRoutePoint(
          pointData.session_id,
          pointData.latitude,
          pointData.longitude,
          pointData.speed_kmh || 0,
          recordedAt
        );
        successfullyInserted = true;
      } catch (err) {
        console.error("Failed to add route point to Supabase directly, buffering locally:", err);
      }
    }

    if (!successfullyInserted) {
      trackingSync.queuePoint(newPoint);
      setUnsyncedPointsCount(trackingSync.getUnsyncedPoints().length);
    }

    const updatedPoints = [...routePoints, newPoint];
    setRoutePoints(updatedPoints);
    localStorage.setItem(`${STORAGE_PREFIX}route_points_${userId}`, JSON.stringify(updatedPoints));
  };

  return (
    <JourneyContext.Provider
      value={{
        driverSessions,
        routePoints,
        startSession,
        endSession,
        addRoutePoint,
        unsyncedPointsCount,
        syncOfflineQueue,
        gpsStatus,
        permissionState,
        lastCoord,
        gpsError,
        gpsTestResult,
        gpsTestLoading,
        testGps,
        clearGpsTestResult
      }}
    >
      {children}
    </JourneyContext.Provider>
  );
};

export const useJourney = () => {
  const context = useContext(JourneyContext);
  if (context === undefined) {
    throw new Error('useJourney must be used inside a JourneyProvider');
  }
  return context;
};
export { journeyService };
export type { DriverSession, RoutePoint };
