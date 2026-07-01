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
  synced?: boolean; // REGRA 1: Cada ponto deve ter synced: boolean
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
      // Run automatic buffer cleanup on startup (Requirement 3)
      setTimeout(() => {
        try {
          this.cleanupBuffer();
        } catch (e) {
          console.error('[Sync] Startup automatic buffer cleanup failed:', e);
        }
      }, 2000);
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
      // REGRA: Se synced = true ou status === 'synced' → remover permanentemente da fila local.
      // Nunca salvar ou manter pontos sincronizados na fila de sincronização.
      const finalPoints = points.filter(p => p.status !== 'synced' && p.synced !== true);

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

    // Check for duplicity inside local storage to avoid duplicates (REGRA 6)
    if (points.some(p => p.idLocal === idLocal)) {
      console.log(`[SYNC_DUPLICATE_BLOCKED] Duplicate telemetry point blocked: ${idLocal}`);
      return;
    }

    // Limitar buffer local a no máximo 1000 pontos por sessão (Requirement 2)
    const sessionPointsCount = points.filter(p => p.session_id === point.session_id).length;
    console.log(`[BUFFER_SESSION_COUNT] Current session points count: ${sessionPointsCount}`);
    if (sessionPointsCount >= 1000) {
      console.log(`[GPS_POINT_REJECTED] Point ignored. Buffer limit reached: 1000 points for session ${point.session_id}`);
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
      synced: false,
      retry_count: 0,
      segment_type: segment,
      ride_event_id: activeEventId
    };

    points.push(newPoint);
    console.log('[SYNC_QUEUE_ADD]', { idLocal, session_id: point.session_id });
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
      const syncedIds: string[] = [];
      batch.forEach(bPoint => {
        const p = finalPoints.find(item => item.idLocal === bPoint.idLocal);
        if (p) {
          p.status = 'synced';
          p.synced = true;
          p.error_message = undefined;
          syncedIds.push(bPoint.idLocal);
        }
      });
      syncedCount = batch.length;
      console.log('[SYNC_BATCH_SUCCESS]', { batchSize: batch.length, ids: syncedIds });
      console.log('[SYNC_QUEUE_REMOVE]', syncedIds);
      this.savePoints(finalPoints);

      console.log(`[Sync] batch success. Uploaded ${batch.length} coordinates.`);
      this.updateStats({
        lastSyncTime: new Date().toISOString(),
        lastSyncError: null,
        syncStatus: 'sincronizado'
      });

    } catch (err: any) {
      const errorMessage = err?.message || 'Erro desconhecido na rede';
      console.error('[SYNC_BATCH_FAILED]', { error: errorMessage, ids: batch.map(b => b.idLocal) });

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
  async finalFlushBeforeEnd(sessionId?: string): Promise<{ success: boolean; pendingCount: number }> {
    console.log('[SYNC_QUEUE_FLUSH]', { sessionId });
    console.log('[Sync] [SYNC_BEFORE_END_START] final flush before journey end initiated.', { sessionId });
    
    // 1. Prune/cleanup buffer of old or orphaned points before ending journey (Requirements)
    const allPoints = this.getPoints();
    const originalCount = allPoints.length;
    
    const filteredPoints = allPoints.filter(p => {
      // Remover automaticamente pontos sem session_id
      if (!p.session_id) {
        console.log('[Sync] [BUFFER_CLEANUP] Removing point with missing session_id during pre-end flush');
        return false;
      }
      
      // Se tivermos um sessionId ativo, qualquer ponto pendente de outra sessão antiga/órfã pode ser removido/ignorado
      if (sessionId && p.session_id !== sessionId) {
        if (p.status === 'pending' || p.status === 'failed') {
          console.log(`[Sync] [BUFFER_CLEANUP] Removing old pending/failed point from another session: ${p.session_id}`);
          return false;
        }
      }
      
      return true;
    });

    if (filteredPoints.length !== originalCount) {
      console.log(`[Sync] [BUFFER_CLEANUP] Pre-end pruner removed ${originalCount - filteredPoints.length} old or orphaned points.`);
      this.savePoints(filteredPoints);
    }

    try {
      // Run sync immediately to upload coordinates of the active session
      await this.sync();
      console.log('[Sync] [SYNC_BEFORE_END_SUCCESS] pre-end synchronization completed.');
    } catch (err) {
      console.error('[Sync] [SYNC_BEFORE_END_FAILED] pre-end synchronization failed:', err);
    }
    
    const updatedPoints = this.getPoints();
    const remaining = sessionId
      ? updatedPoints.filter(p => p.session_id === sessionId && (p.status === 'pending' || p.status === 'failed'))
      : updatedPoints.filter(p => p.status === 'pending' || p.status === 'failed');

    console.log(`[Sync] [SESSION_END_SAFE] Remaining unsynced coordinates for session ${sessionId || 'all'}: ${remaining.length}`);
    
    return {
      success: remaining.length === 0,
      pendingCount: remaining.length
    };
  }

  /**
   * Flush all coordinates for a session
   */
  async flushSyncQueue(sessionId: string): Promise<{ success: boolean; pendingCount: number }> {
    return this.finalFlushBeforeEnd(sessionId);
  }

  /**
   * Reset/clear telemetry sync queue completely
   */
  clearQueue() {
    console.log('[SYNC_QUEUE_FLUSH] Clearing telemetry sync queue completely');
    try {
      localStorage.removeItem(TELEMETRY_STORAGE_KEY);
      localStorage.removeItem(SYNC_STATS_STORAGE_KEY);
      
      // Clean other related queue and buffer keys requested by requirements
      const targetKeys = [
        'telemetrySyncQueue',
        'pendingSyncBuffer',
        'rideTrackPoints',
        'offlineSyncQueue'
      ];
      targetKeys.forEach(key => {
        localStorage.removeItem(key);
        localStorage.removeItem(`${STORAGE_PREFIX}${key}`);
        sessionStorage.removeItem(key);
        sessionStorage.removeItem(`${STORAGE_PREFIX}${key}`);
      });

      // Clear any keys pattern matched (Requirements)
      const keysToClear: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (
          key.startsWith('driverdash_sync_') || 
          key.includes('telemetry_pending_') || 
          key.includes('sync_queue_')
        )) {
          keysToClear.push(key);
        }
      }
      keysToClear.forEach(key => localStorage.removeItem(key));

      const sKeysToClear: string[] = [];
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        if (key && (
          key.startsWith('driverdash_sync_') || 
          key.includes('telemetry_pending_') || 
          key.includes('sync_queue_')
        )) {
          sKeysToClear.push(key);
        }
      }
      sKeysToClear.forEach(key => sessionStorage.removeItem(key));

      this.notify();
    } catch (err) {
      console.error('[Sync] Error clearing queue:', err);
    }
  }

  /**
   * Cleans up the telemetry buffer based on criteria (Requirement 3):
   * - remove points without session_id
   * - remove points older than 7 days
   * - remove points belonging to completed/closed sessions
   * - remove points already marked as synced
   */
  cleanupBuffer(): { cleanedCount: number; remainingCount: number } {
    console.log('[Sync] [BUFFER_CLEANUP] Starting buffer cleanup...');
    const originalPoints = this.getPoints();
    const now = Date.now();
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;

    // To find completed sessions, let's scan localStorage for any driver sessions across any user
    const completedSessionIds = new Set<string>();

    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.includes('driver_sessions_')) {
          const raw = localStorage.getItem(key);
          if (raw) {
            const list = JSON.parse(raw);
            if (Array.isArray(list)) {
              list.forEach((s: any) => {
                if (s && s.id) {
                  if (s.status === 'completed' || s.status === 'finished') {
                    completedSessionIds.add(s.id);
                  }
                }
              });
            }
          }
        }
      }
    } catch (e) {
      console.warn('[Sync] [BUFFER_CLEANUP] Error parsing driver sessions from localStorage:', e);
    }

    const filteredPoints = originalPoints.filter(p => {
      // 1. Must have session_id
      if (!p.session_id) {
        console.log(`[Sync] [BUFFER_CLEANUP] Removing point with missing session_id`);
        return false;
      }

      // 2. Must not be older than 7 days
      const recordedTime = new Date(p.recorded_at).getTime();
      if (isNaN(recordedTime) || (now - recordedTime) > sevenDaysMs) {
        console.log(`[Sync] [BUFFER_CLEANUP] Removing point older than 7 days: ${p.recorded_at}`);
        return false;
      }

      // 3. Must not be already synced
      if (p.status === 'synced') {
        console.log(`[Sync] [BUFFER_CLEANUP] Removing synced point ${p.idLocal}`);
        return false;
      }

      // 4. Must not belong to a closed session
      if (completedSessionIds.has(p.session_id)) {
        console.log(`[Sync] [BUFFER_CLEANUP] Removing point belonging to completed session: ${p.session_id}`);
        return false;
      }

      return true;
    });

    const cleanedCount = originalPoints.length - filteredPoints.length;
    console.log(`[Sync] [BUFFER_CLEANUP] Cleanup finished. Removed ${cleanedCount} points. Remaining: ${filteredPoints.length}`);

    try {
      localStorage.setItem(TELEMETRY_STORAGE_KEY, JSON.stringify(filteredPoints));
      this.notify();
    } catch (err) {
      console.error('[Sync] [BUFFER_CLEANUP] Failed to write telemetry points to cache during cleanup:', err);
    }

    return {
      cleanedCount,
      remainingCount: filteredPoints.length
    };
  }
}

export const telemetrySyncService = new TelemetrySyncService();
