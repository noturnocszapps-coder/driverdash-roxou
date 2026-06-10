/**
 * Journey and GPS Telemetry Type Definitions
 * Module: Journey (journey)
 * When to edit: When altering drivers sessions, tracking point schemas, or raw coordinates.
 */

import { DriverSession, RoutePoint } from '../../types';

export type { DriverSession, RoutePoint };

export interface JourneyContextType {
  driverSessions: DriverSession[];
  routePoints: RoutePoint[];
  startSession: () => Promise<void>;
  endSession: (sessionId: string, totalDistanceKm: number, totalDurationMinutes: number) => Promise<void>;
  addRoutePoint: (point: Omit<RoutePoint, 'id' | 'recorded_at'>) => Promise<void>;
  unsyncedPointsCount: number;
  syncOfflineQueue: () => Promise<number>;
}
