/**
 * Map Visualizing Type Definitions
 * Module: Maps (maps)
 * When to edit: When updating map marker formats, region centroids, bounding coordinates, or zooms.
 */

export interface LatLng {
  lat: number;
  lng: number;
}

export interface MapMarker {
  id: string;
  position: LatLng;
  title: string;
  description?: string;
  type: 'driver' | 'peak' | 'hazard' | 'default';
}

export interface HeatmapPoint extends LatLng {
  intensity: number; // 0.0 to 1.0 multiplier
}
