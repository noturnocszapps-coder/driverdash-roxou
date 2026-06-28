/**
 * Journey and GPS Watch Provider hook
 * Module: Journey (journey)
 * When to edit: When updating session listeners, logging states, or coordinate bindings.
 */

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from '../auth/auth.hooks';
import { STORAGE_PREFIX } from '../shared/constants';
import { DriverSession, RoutePoint, JourneyContextType } from './journey.types';
import { journeyService } from './journey.service';
import { trackingSync } from '../tracking/tracking.sync';
import { auditLogger } from '../observability/auditLogger';

export const JourneyContext = createContext<JourneyContextType | undefined>(undefined);

export const JourneyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, dbStatus } = useAuth();
  const [driverSessions, setDriverSessions] = useState<DriverSession[]>([]);
  const [routePoints, setRoutePoints] = useState<RoutePoint[]>([]);
  const [unsyncedPointsCount, setUnsyncedPointsCount] = useState<number>(0);

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
        syncOfflineQueue
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
