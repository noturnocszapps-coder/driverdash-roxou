/**
 * Active Tracking States Type Definitions
 * Module: Tracking (tracking)
 * When to edit: When altering tracking structures, live session telemetry KPIs, or tracking intervals.
 */

export interface TrackingSessionStats {
  sessionId: string;
  distanceKm: number;
  durationMinutes: number;
  averageSpeedKmh: number;
  isActive: boolean;
}

export interface TrackingContextType {
  activeTracking: TrackingSessionStats | null;
  startTracking: (sessionId: string) => void;
  updateTrackingStats: (distance: number, minutes: number, avgSpeed: number) => void;
  stopTracking: () => void;
}
