/**
 * Premium Geolocation & Telemetry Synchronization Engine
 * Module: Journey (journey)
 * Responsibility: Handles robust batch uploads, deduplication, retry queues with backoff,
 *                 and offline synchronization states.
 */

import { STORAGE_PREFIX } from '../shared/constants';
import { supabase } from '../shared/supabase.helpers';

const TELEMETRY_STORAGE_KEY = `${STORAGE_PREFIX}unsynced_route_points`;
const SYNC_STATS_STORAGE_KEY = `${STORAGE_PREFIX}telemetry_sync_stats`;

export interface LocalTelemetryPoint {
  idLocal: string; // Unique ID (usually generated from session_id + timestamp + lat + lng)
  session_id: string;
  driver_id?: string;
  latitude: number;
  longitude: number;
  speed_kmh: number;
  accuracy: number;
  heading: number | null;
  altitude: number | null;
  distance_meters: number;
  recorded_at: string;
  status: 'pending' | 'syncing' | 'synced' | 'failed';
  retry_count: number;
  last_retry_at?: string;
  error_message?: string;
  segment_type?: 'empty' | 'productive' | 'personal' | 'dead' | 'stopped' | 'waiting' | 'offline';
  ride_event_id?: string | null;
}

export interface TelemetrySyncStats {
  lastSyncTime: string | null;
  lastSyncError: string | null;
  syncStatus: 'sincronizando' | 'sincronizado' | 'aguardando internet' | 'erro' | 'ocioso';
}

type SyncListener = () => void;

class TelemetrySyncService {
  private listeners: Set<SyncListener> = new Set();
  private isSyncingLock = false;

  constructor() {
    // Listen to network changes to automatically sync
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        console.log('[Sync] Browser reported back online. Triggering automatic synchronization...');
        this.sync();
      });
    }
  }

  /**
   * Subscribe to state changes (for UI reactivity)
   */
  subscribe(listener: SyncListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    this.listeners.forEach((listener) => {
      try {
        listener();
      } catch (err) {
        console.error('[Sync] Error in sync listener notification:', err);
      }
    });
  }

  /**
   * Load all telemetry points from local cache
   */
  getPoints(): LocalTelemetryPoint[] {
    try {
      const raw = localStorage.getItem(TELEMETRY_STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (err) {
      console.error('[Sync] Failed to read cached telemetry points:', err);
      return [];
    }
  }

  /**
   * Save telemetry points to local cache
   */
  private savePoints(points: LocalTelemetryPoint[]) {
    try {
      // Keep only up to 500 synced points to avoid exceeding localStorage limits
      const synced = points.filter(p => p.status === 'synced');
      const nonSynced = points.filter(p => p.status !== 'synced');
      
      const prunedSynced = synced.slice(-200); // Keep last 200 for visualization history
      const finalPoints = [...nonSynced, ...prunedSynced];

      localStorage.setItem(TELEMETRY_STORAGE_KEY, JSON.stringify(finalPoints));
      this.notify();
    } catch (err) {
      console.error('[Sync] Failed to write telemetry points to cache:', err);
    }
  }

  /**
   * Retrieve current sync metrics / state
   */
  getStats(): TelemetrySyncStats {
    try {
      const raw = localStorage.getItem(SYNC_STATS_STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch (err) {
      console.error('[Sync] Failed to read sync statistics:', err);
    }

    return {
      lastSyncTime: null,
      lastSyncError: null,
      syncStatus: 'ocioso'
    };
  }

  /**
   * Update current sync metrics / state
   */
  private updateStats(updates: Partial<TelemetrySyncStats>) {
    const current = this.getStats();
    const next = { ...current, ...updates };
    try {
      localStorage.setItem(SYNC_STATS_STORAGE_KEY, JSON.stringify(next));
      this.notify();
    } catch (err) {
      console.error('[Sync] Failed to update sync statistics:', err);
    }
  }

  /**
   * Generates a deterministic client side unique ID to avoid duplicities.
   */
  generateClientId(sessionId: string, timestamp: string, lat: number, lng: number): string {
    const formattedLat = Number(lat).toFixed(6);
    const formattedLng = Number(lng).toFixed(6);
    return `telemetry_${sessionId}_${timestamp}_${formattedLat}_${formattedLng}`;
  }

  /**
   * Append a telemetry point to local memory.
   */
  queuePoint(point: {
    session_id: string;
    driver_id?: string;
    latitude: number;
    longitude: number;
    speed_kmh: number;
    accuracy?: number;
    heading?: number | null;
    altitude?: number | null;
    distance_meters?: number;
    recorded_at?: string;
  }) {
    const timestamp = point.recorded_at || new Date().toISOString();
    const idLocal = this.generateClientId(point.session_id, timestamp, point.latitude, point.longitude);
    
    const points = this.getPoints();

    // Check for duplicity inside local storage to avoid duplicates
    if (points.some(p => p.idLocal === idLocal)) {
      console.log(`[Sync] Duplicate telemetry point ignored: ${idLocal}`);
      return;
    }

    // Automatic Real-Time Classification based on manual event states and speed rules (Phase 6)
    const storagePrefix = 'driverdash_';
    const isRideActive = localStorage.getItem(`${storagePrefix}ride_active_${point.session_id}`) === 'true';
    const isPersonalActive = localStorage.getItem(`${storagePrefix}personal_active_${point.session_id}`) === 'true';
    const activeEventId = localStorage.getItem(`${storagePrefix}active_event_id_${point.session_id}`) || null;

    let segment: 'empty' | 'productive' | 'personal' | 'dead' | 'stopped' | 'waiting' | 'offline' = 'empty';
    if (isRideActive) {
      segment = 'productive';
    } else if (isPersonalActive) {
      segment = 'personal';
    } else if (point.speed_kmh === 0) {
      // If consecutive 0-speed points exist in our recent queue, classify as stopped, otherwise waiting
      const sessionPoints = points.filter(p => p.session_id === point.session_id);
      const lastPoint = sessionPoints[sessionPoints.length - 1];
      if (lastPoint && lastPoint.speed_kmh === 0) {
        segment = 'stopped';
      } else {
        segment = 'waiting';
      }
    } else {
      segment = 'empty';
    }

    console.log('[JourneyClassifier] point classified', { sessionId: point.session_id, segment_type: segment });

    const newPoint: LocalTelemetryPoint = {
      idLocal,
      session_id: point.session_id,
      driver_id: point.driver_id,
      latitude: point.latitude,
      longitude: point.longitude,
      speed_kmh: point.speed_kmh,
      accuracy: point.accuracy ?? 0,
      heading: point.heading !== undefined ? point.heading : null,
      altitude: point.altitude !== undefined ? point.altitude : null,
      distance_meters: point.distance_meters ?? 0,
      recorded_at: timestamp,
      status: 'pending',
      retry_count: 0,
      segment_type: segment,
      ride_event_id: activeEventId
    };

    points.push(newPoint);
    console.log(`[Sync] pending count incremented. Total queue: ${points.length}`);
    this.savePoints(points);

    // Automatically trigger background sync upon queuing a new point
    this.sync();
  }

  /**
   * Calculates the retry cooldown based on backoff logic:
   * 5s, 15s, 30s, 60s
   */
  private isCoolingDown(point: LocalTelemetryPoint): boolean {
    if (point.status !== 'failed' || !point.last_retry_at) {
      return false;
    }

    const lastRetry = new Date(point.last_retry_at).getTime();
    const now = Date.now();
    const diffSeconds = (now - lastRetry) / 1000;

    let delayRequired = 5;
    if (point.retry_count === 2) delayRequired = 15;
    else if (point.retry_count === 3) delayRequired = 30;
    else if (point.retry_count >= 4) delayRequired = 60;

    return diffSeconds < delayRequired;
  }

  /**
   * Main synchronization routing logic
   * Implements batches, retry backoffs, deduplication & locks
   */
  async sync(): Promise<number> {
    if (this.isSyncingLock) {
      console.log('[Sync] Sync execution is already locked/running. Skipping concurrency.');
      return 0;
    }

    const points = this.getPoints();
    const pendingPoints = points.filter(p => p.status === 'pending' || p.status === 'failed');

    if (pendingPoints.length === 0) {
      this.updateStats({ syncStatus: 'sincronizado' });
      return 0;
    }

    if (!navigator.onLine) {
      console.log('[Sync] Browser is currently OFFLINE. Postponing synchronization.');
      this.updateStats({ syncStatus: 'aguardando internet' });
      return 0;
    }

    this.isSyncingLock = true;
    this.updateStats({ syncStatus: 'sincronizando' });

    console.log(`[Sync] pending count: ${pendingPoints.length}. Preparing batch...`);

    // Filter points that are cooling down due to backoff
    const syncablePoints = pendingPoints.filter(p => !this.isCoolingDown(p));

    if (syncablePoints.length === 0) {
      console.log('[Sync] All failed points are cooling down. Retry scheduled on backoff.');
      this.isSyncingLock = false;
      this.updateStats({ syncStatus: 'ocioso' });
      return 0;
    }

    // Process in batches of 30 records
    const BATCH_SIZE = 30;
    const batch = syncablePoints.slice(0, BATCH_SIZE);
    
    // Mark batch points as 'syncing' locally first
    const updatedPoints = this.getPoints();
    batch.forEach(bPoint => {
      const p = updatedPoints.find(item => item.idLocal === bPoint.idLocal);
      if (p) {
        p.status = 'syncing';
        p.last_retry_at = new Date().toISOString();
      }
    });
    this.savePoints(updatedPoints);

    console.log(`[TelemetrySync] batch start with size: ${batch.length}`);

    let syncedCount = 0;
    
    try {
      // Fetch authenticated user id dynamically if not populated in the local point
      const { data: { session } } = await supabase.auth.getSession();
      const currentUserId = session?.user?.id;

      // Perform batch insert into Supabase
      const payload = batch.map(pt => {
        const uId = pt.driver_id || currentUserId;
        const item: any = {
          session_id: pt.session_id,
          latitude: pt.latitude,
          longitude: pt.longitude,
          speed: pt.speed_kmh,
          accuracy: pt.accuracy ?? 0,
          heading: pt.heading ?? 0,
          altitude: pt.altitude ?? 0,
          distance_meters: pt.distance_meters ?? 0,
          timestamp: pt.recorded_at,
          segment_type: pt.segment_type || 'empty',
          ride_event_id: pt.ride_event_id || null
        };
        if (uId) {
          item.driver_id = uId;
        }
        return item;
      });

      const { error } = await supabase
        .from('route_points')
        .insert(payload);

      if (error) {
        throw error;
      }

      // Success! Update local points status to 'synced'
      const finalPoints = this.getPoints();
      batch.forEach(bPoint => {
        const p = finalPoints.find(item => item.idLocal === bPoint.idLocal);
        if (p) {
          p.status = 'synced';
          p.error_message = undefined;
        }
      });
      syncedCount = batch.length;
      this.savePoints(finalPoints);

      console.log(`[Sync] batch success. Uploaded ${batch.length} coordinates.`);
      this.updateStats({
        lastSyncTime: new Date().toISOString(),
        lastSyncError: null,
        syncStatus: 'sincronizado'
      });

    } catch (err: any) {
      console.error('[Sync] batch error during uploading:', err);
      const errorMessage = err?.message || 'Erro desconhecido na rede';

      // Rollback to failed status with retry increment
      const finalPoints = this.getPoints();
      batch.forEach(bPoint => {
        const p = finalPoints.find(item => item.idLocal === bPoint.idLocal);
        if (p) {
          p.status = 'failed';
          p.retry_count += 1;
          p.error_message = errorMessage;
        }
      });
      this.savePoints(finalPoints);

      console.log(`[Sync] retry scheduled. Local error cached.`);
      this.updateStats({
        lastSyncError: errorMessage,
        syncStatus: 'erro'
      });
    } finally {
      this.isSyncingLock = false;
      this.notify();
    }

    // If there are more pending points remaining, trigger next batch sync recursively (non-blocking)
    const remainingCount = this.getPoints().filter(p => p.status === 'pending' || p.status === 'failed').length;
    if (remainingCount > 0 && navigator.onLine && syncedCount > 0) {
      setTimeout(() => {
        this.sync();
      }, 100);
    }

    return syncedCount;
  }

  /**
   * Final flush of all remaining points before ending the journey.
   * If some points remain unsynced, let the user know.
   */
  async finalFlushBeforeEnd(): Promise<{ success: boolean; pendingCount: number }> {
    console.log('[Sync] final flush before journey end initiated.');
    // Run sync immediately
    await this.sync();
    
    const remaining = this.getPoints().filter(p => p.status === 'pending' || p.status === 'failed');
    console.log(`[Sync] cache cleaned validation. Remaining unsynced: ${remaining.length}`);
    
    return {
      success: remaining.length === 0,
      pendingCount: remaining.length
    };
  }
}

export const telemetrySyncService = new TelemetrySyncService();
