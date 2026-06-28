/**
 * Journey and GPS Telemetry Type Definitions
 * Module: Journey (journey)
 * When to edit: When altering drivers sessions, tracking point schemas, or raw coordinates.
 */

import { DriverSession, RoutePoint } from '../../types';

export type { DriverSession, RoutePoint };

export interface GpsTestResult {
  latitude?: number;
  longitude?: number;
  accuracy?: number;
  speed?: number | null;
  heading?: number | null;
  altitude?: number | null;
  timestamp?: number;
  error?: {
    code: number;
    name: string;
    message: string;
    timestamp: number;
  } | null;
}

export interface JourneyContextType {
  driverSessions: DriverSession[];
  routePoints: RoutePoint[];
  startSession: () => Promise<void>;
  endSession: (sessionId: string, totalDistanceKm: number, totalDurationMinutes: number) => Promise<void>;
  addRoutePoint: (point: Omit<RoutePoint, 'id' | 'recorded_at'> & { accuracy?: number }) => Promise<void>;
  unsyncedPointsCount: number;
  syncOfflineQueue: () => Promise<number>;
  
  // Telemetry Sync States
  pendingPointsCount: number;
  syncedPointsCount: number;
  failedPointsCount: number;
  lastSyncTime: string | null;
  lastSyncError: string | null;
  syncStatus: 'sincronizando' | 'sincronizado' | 'aguardando internet' | 'erro' | 'ocioso';
  
  // Distance Engine States
  totalDistanceMeters: number;
  totalDistanceKm: number;
  lastAddedDistanceMeters: number;
  currentAccuracy: number | null;
  discardedPointsCount: number;
  lastDiscardReason: string | null;
  
  // GPS Engine States
  gpsStatus: 'Aguardando permissão' | 'Solicitando primeira posição' | 'GPS ativo' | 'GPS sem sinal' | 'GPS erro' | 'GPS negado' | 'Sensor inativo';
  permissionState: 'granted' | 'prompt' | 'denied' | 'unknown';
  lastCoord: { lat: number; lng: number; accuracy: number; speed: number; heading: number | null; altitude: number | null; timestamp: number } | null;
  gpsError: { code: number; name: string; message: string; timestamp: number } | null;
  gpsTestResult: GpsTestResult | null;
  gpsTestLoading: boolean;
  testGps: () => Promise<GpsTestResult>;
  clearGpsTestResult: () => void;
}
