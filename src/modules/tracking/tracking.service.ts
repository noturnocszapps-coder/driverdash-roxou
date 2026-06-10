/**
 * Active Tracking Storage Service
 * Module: Tracking (tracking)
 * When to edit: When modifying local storage keys or caching active journey runtimes.
 */

import { STORAGE_PREFIX } from '../shared/constants';
import { TrackingSessionStats } from './tracking.types';

const LIVE_SESSION_KEY = `${STORAGE_PREFIX}live_tracking_session`;

export const trackingService = {
  /**
   * Retrieves any active tracking parameters from local storage.
   */
  getActiveTracking(): TrackingSessionStats | null {
    const data = localStorage.getItem(LIVE_SESSION_KEY);
    return data ? JSON.parse(data) : null;
  },

  /**
   * Caches the active tracking statistics in local storage.
   */
  saveActiveTracking(stats: TrackingSessionStats): void {
    localStorage.setItem(LIVE_SESSION_KEY, JSON.stringify(stats));
  },

  /**
   * Clears the cached tracking session.
   */
  clearActiveTracking(): void {
    localStorage.removeItem(LIVE_SESSION_KEY);
  }
};
