/**
 * Active Tracking Calculations
 * Module: Tracking (tracking)
 * When to edit: When modifying formulas to calculate average speeds, pace ratios, or live session progress.
 */

/**
 * Calculates current average speed given total distance and elapsed hours.
 */
export const calculateTrackingAverageSpeed = (distanceKm: number, durationMinutes: number): number => {
  if (durationMinutes <= 0) return 0;
  const hours = durationMinutes / 60;
  return distanceKm / hours;
};

/**
 * Normalizes live speed inputs into smoothed values.
 */
export const smoothSpeedInput = (rawSpeed: number, previousSpeed: number, smoothingFactor = 0.35): number => {
  return rawSpeed * smoothingFactor + previousSpeed * (1 - smoothingFactor);
};
