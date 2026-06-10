/**
 * Geolocation / Watchers Browser Core Interfaces
 * Module: Journey (journey)
 * When to edit: When altering browser geolocation settings, high accuracy requirements, or track intervals.
 */

export interface GPSTrackingCoords {
  latitude: number;
  longitude: number;
  speed: number | null;
  timestamp: string;
}

export const gpsTracker = {
  /**
   * Request permission or check if geolocation is available.
   */
  checkPermission(): Promise<boolean> {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        resolve(false);
        return;
      }
      navigator.permissions?.query({ name: 'geolocation' as PermissionName })
        .then((result) => {
          resolve(result.state === 'granted' || result.state === 'prompt');
        })
        .catch(() => {
          resolve(true); // default option if permission api is not full supporting
        });
    });
  },

  /**
   * Starts a watchPosition query.
   */
  watchPosition(
    onSuccess: (coords: GPSTrackingCoords) => void,
    onError: (err: GeolocationPositionError) => void
  ): number {
    if (!navigator.geolocation) {
      throw new Error("Geolocation is not supported by your browser environment.");
    }

    return navigator.geolocation.watchPosition(
      (pos) => {
        onSuccess({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          speed: pos.coords.speed !== null && pos.coords.speed >= 0 ? pos.coords.speed * 3.6 : 0, // Convert m/s -> km/h
          timestamp: new Date().toISOString()
        });
      },
      onError,
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );
  },

  /**
   * Clears an active position watch.
   */
  clearWatch(watchId: number): void {
    if (navigator.geolocation && watchId) {
      navigator.geolocation.clearWatch(watchId);
    }
  }
};
