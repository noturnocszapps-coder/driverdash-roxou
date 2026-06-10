/**
 * Geospatial and Telemetry Calculations
 * Module: Journey (journey)
 * When to edit: When altering distance formulations, average speed calculations, or duration math.
 */

import { RoutePoint } from './journey.types';

/**
 * Calculates distance in kilometers between two GPS coordinates using the Haversine formula.
 */
export const calculateDistanceBetweenPoints = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number => {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
      
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

/**
 * Calculates total route point sessions distance.
 */
export const calculateTotalSessionDistance = (points: RoutePoint[]): number => {
  if (points.length < 2) return 0;
  let total = 0;
  for (let i = 0; i < points.length - 1; i++) {
    total += calculateDistanceBetweenPoints(
      points[i].latitude,
      points[i].longitude,
      points[i + 1].latitude,
      points[i + 1].longitude
    );
  }
  return total;
};

/**
 * Computes elapsed minutes in journey from a start and end iso string.
 */
export const calculateSessionMinutes = (startStr: string, endStr?: string): number => {
  const start = new Date(startStr);
  const end = endStr ? new Date(endStr) : new Date();
  const diffMs = end.getTime() - start.getTime();
  return Math.max(0, Math.floor(diffMs / 60000));
};
