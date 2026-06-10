/**
 * Tracking Hub Offline Buffer & Synchronization Engine
 * Module: Tracking (tracking)
 * Responsibility: Manages local telemetry cache during outages, monitors connectivity status, and triggers automatic flushing to Supabase.
 */

import { STORAGE_PREFIX } from '../shared/constants';
import { RoutePoint } from '../../types';
import { journeyService } from '../journey/journey.service';

const UNSYNCED_POINTS_KEY = `${STORAGE_PREFIX}unsynced_route_points`;

export const trackingSync = {
  /**
   * Retrieves points stored locally that failed to sync immediately.
   */
  getUnsyncedPoints(): Array<Omit<RoutePoint, 'id'> & { idLocal: string; recorded_at: string }> {
    const raw = localStorage.getItem(UNSYNCED_POINTS_KEY);
    return raw ? JSON.parse(raw) : [];
  },

  /**
   * Appends a telemetry point to the unsynced local queue.
   */
  queuePoint(point: Omit<RoutePoint, 'id' | 'recorded_at'> & { id?: string; recorded_at?: string }) {
    const points = this.getUnsyncedPoints();
    const localId = point.id || 'local-pt-' + Math.random().toString(36).substring(2, 11);
    const ts = point.recorded_at || new Date().toISOString();

    points.push({
      idLocal: localId,
      session_id: point.session_id,
      latitude: point.latitude,
      longitude: point.longitude,
      speed_kmh: point.speed_kmh || 0,
      recorded_at: ts,
    });

    localStorage.setItem(UNSYNCED_POINTS_KEY, JSON.stringify(points));
    console.log(`[Offline Buffer] Telemetry queued. Backlog count: ${points.length}`);
  },

  /**
   * Purges successfully synchronized points from local memory.
   */
  clearUnsyncedPoints() {
    localStorage.removeItem(UNSYNCED_POINTS_KEY);
  },

  /**
   * Flushes all unsynced coordinates sequentially to Supabase.
   * Returns number of successfully synced points.
   */
  async flushUnsyncedPoints(isDbConnected: boolean): Promise<number> {
    const points = this.getUnsyncedPoints();
    if (points.length === 0) return 0;
    if (!isDbConnected || !navigator.onLine) {
      console.warn(`[Offline Buffer] Sync requested but network is currently offline. Skipping flush.`);
      return 0;
    }

    console.log(`[Offline Buffer] Syncing ${points.length} coordinates to cloud storage...`);
    let successCount = 0;
    const remainingPoints = [];

    for (const pt of points) {
      try {
        await journeyService.insertRoutePoint(
          pt.session_id,
          pt.latitude,
          pt.longitude,
          pt.speed_kmh || 0,
          pt.recorded_at
        );
        successCount++;
      } catch (err) {
        console.error(`[Offline Buffer] Failed to upload coordinate point ${pt.idLocal}:`, err);
        remainingPoints.push(pt);
      }
    }

    if (remainingPoints.length > 0) {
      localStorage.setItem(UNSYNCED_POINTS_KEY, JSON.stringify(remainingPoints));
      console.log(`[Offline Buffer] Sync completed partially. Retained ${remainingPoints.length} points.`);
    } else {
      this.clearUnsyncedPoints();
      console.log(`[Offline Buffer] Sync completed with entire queue flushed! All points uploaded.`);
    }

    return successCount;
  }
};
