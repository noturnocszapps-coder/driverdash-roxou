/**
 * Tracking Hub Offline Buffer & Synchronization Engine
 * Module: Tracking (tracking)
 * Responsibility: Delegates local telemetry cache and synchronization to telemetrySyncService.
 */

import { RoutePoint } from '../../types';
import { telemetrySyncService } from '../journey/telemetrySync.service';

export const trackingSync = {
  /**
   * Retrieves points stored locally that failed to sync immediately.
   */
  getUnsyncedPoints(): Array<Omit<RoutePoint, 'id'> & { idLocal: string; recorded_at: string }> {
    const points = telemetrySyncService.getPoints();
    return points
      .filter(p => p.status !== 'synced')
      .map(p => ({
        idLocal: p.idLocal,
        session_id: p.session_id,
        latitude: p.latitude,
        longitude: p.longitude,
        speed_kmh: p.speed_kmh,
        recorded_at: p.recorded_at
      }));
  },

  /**
   * Appends a telemetry point to the unsynced local queue.
   */
  queuePoint(point: Omit<RoutePoint, 'id' | 'recorded_at'> & { id?: string; recorded_at?: string }) {
    telemetrySyncService.queuePoint({
      session_id: point.session_id,
      latitude: point.latitude,
      longitude: point.longitude,
      speed_kmh: point.speed_kmh || 0,
      recorded_at: point.recorded_at
    });
  },

  /**
   * Purges successfully synchronized points from local memory.
   */
  clearUnsyncedPoints() {
    // Keep compatible
    const points = telemetrySyncService.getPoints().filter(p => p.status !== 'synced');
    points.forEach(p => {
      p.status = 'synced';
    });
    // This is safe since they are marked as synced
    localStorage.setItem('unsynced_route_points', JSON.stringify([]));
  },

  /**
   * Flushes all unsynced coordinates to Supabase.
   * Returns number of successfully synced points.
   */
  async flushUnsyncedPoints(isDbConnected: boolean): Promise<number> {
    if (!isDbConnected) {
      return 0;
    }
    return await telemetrySyncService.sync();
  }
};

