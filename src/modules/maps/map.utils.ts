/**
 * Map Coordinate Centroid & Viewport Utilities
 * Module: Maps (maps)
 * When to edit: When updating map centering math or bounding box formulas.
 */

import { LatLng } from './map.types';

/**
 * Calculates the bounding box average center coordinates from a list of points.
 */
export const calculateCoordinatesCentroid = (points: { latitude: number; longitude: number }[]): LatLng => {
  if (points.length === 0) {
    return { lat: -23.55052, lng: -46.633308 }; // Default: São Paulo City center coordinate
  }

  const sumLat = points.reduce((sum, p) => sum + p.latitude, 0);
  const sumLng = points.reduce((sum, p) => sum + p.longitude, 0);

  return {
    lat: sumLat / points.length,
    lng: sumLng / points.length
  };
};

/**
 * Gets distance threshold in km.
 */
export const getProximityKm = (p1: LatLng, p2: LatLng): number => {
  const R = 6371; // Earth ratio
  const dLat = ((p2.lat - p1.lat) * Math.PI) / 180;
  const dLng = ((p2.lng - p1.lng) * Math.PI) / 180;
  
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((p1.lat * Math.PI) / 180) *
      Math.cos((p2.lat * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
      
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};
