/**
 * Professional GPS Noise Filter and Snap-To-Road Service
 * Module: Journey (journey)
 * Integrates with Google Roads API via secure Express backend proxy.
 * 
 * STABLE CORE - NÃO ALTERAR SEM AUTORIZAÇÃO EXPLÍCITA
 */

export interface RawGpsPoint {
  lat: number;
  lng: number;
  accuracy: number;
  altitude?: number | null;
  heading?: number | null;
  speed?: number | null;
  timestamp: string; // ISO string or numeric timestamp
}

export interface MatchedTrackPoint {
  lat: number;
  lng: number;
  originalIndex?: number;
  placeId?: string;
}

/**
 * Calculates haversine distance in meters between two coordinates.
 */
export function calculateDistanceMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371e3; // meters
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Filters raw GPS points to eliminate noise and coordinates anomalies (Requirement 3).
 * Rules implemented:
 * 1. Ignore accuracy > 25 meters.
 * 2. Ignore invalid lat/lng values.
 * 3. Ignore duplicate points.
 * 4. Ignore points with less than 5 meters of displacement.
 * 5. Ignore impossible speeds (> 180 km/h or ~50 m/s).
 * 6. Ignore impossible jumps (unrealistic distance relative to time delta).
 */
export function filterGpsNoise(points: RawGpsPoint[]): { filteredPoints: RawGpsPoint[], discardedCount: number } {
  if (points.length === 0) return { filteredPoints: [], discardedCount: 0 };

  const filtered: RawGpsPoint[] = [];
  let discardedCount = 0;

  for (let i = 0; i < points.length; i++) {
    const pt = points[i];

    // 1. Coordinates validation
    if (
      typeof pt.lat !== 'number' || typeof pt.lng !== 'number' ||
      isNaN(pt.lat) || isNaN(pt.lng) ||
      pt.lat < -90 || pt.lat > 90 ||
      pt.lng < -180 || pt.lng > 180 ||
      (pt.lat === 0 && pt.lng === 0)
    ) {
      discardedCount++;
      continue;
    }

    // 2. High-precision threshold: accuracy > 25 meters -> discard
    if (typeof pt.accuracy === 'number' && pt.accuracy > 25) {
      discardedCount++;
      continue;
    }

    // 3. Speed verification: unrealistic speeds (> 180 km/h or negative) -> discard
    if (typeof pt.speed === 'number' && pt.speed !== null) {
      const speedKmh = pt.speed;
      if (speedKmh > 180 || speedKmh < 0) {
        discardedCount++;
        continue;
      }
    }

    if (filtered.length > 0) {
      const last = filtered[filtered.length - 1];
      const dist = calculateDistanceMeters(last.lat, last.lng, pt.lat, pt.lng);
      
      // 4. Duplicate or near-identical coordinates (< 5m change) -> discard
      if (dist < 5) {
        discardedCount++;
        continue;
      }

      // 5. Impossible jumps check
      const lastTime = new Date(last.timestamp).getTime();
      const currTime = new Date(pt.timestamp).getTime();
      const timeDeltaSec = Math.max(0.1, (currTime - lastTime) / 1000);

      // Unrealistic velocity based on distance over time (> 50 m/s, i.e., 180 km/h)
      const calculatedSpeedMs = dist / timeDeltaSec;
      if (calculatedSpeedMs > 50) {
        discardedCount++;
        continue;
      }
    }

    filtered.push(pt);
  }

  // Trajectory smoothing: simple exponential moving average filter for highly oscillating segments
  const smoothed: RawGpsPoint[] = [];
  const alpha = 0.75; // weight for current point

  for (let i = 0; i < filtered.length; i++) {
    if (i === 0) {
      smoothed.push(filtered[i]);
    } else {
      const prev = smoothed[smoothed.length - 1];
      const curr = filtered[i];
      
      const smoothedLat = alpha * curr.lat + (1 - alpha) * prev.lat;
      const smoothedLng = alpha * curr.lng + (1 - alpha) * prev.lng;
      
      smoothed.push({
        ...curr,
        lat: smoothedLat,
        lng: smoothedLng
      });
    }
  }

  return {
    filteredPoints: smoothed,
    discardedCount
  };
}

/**
 * Interface with the backend's Google Roads snapToRoads proxy endpoint (Requirement 4).
 */
export async function snapTrackToRoads(points: RawGpsPoint[]): Promise<{
  success: boolean;
  matchedPoints: MatchedTrackPoint[];
  originalResponse?: any;
  error?: string;
}> {
  if (points.length < 2) {
    return { success: false, matchedPoints: [], error: 'Insuficientes pontos para Snap-to-Road.' };
  }

  try {
    // Only send the lat/lng coordinates to keep payload lightweight
    const coordsToSend = points.map(p => ({ lat: p.lat, lng: p.lng }));
    
    const response = await fetch('/api/roads/snap', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ points: coordsToSend })
    });

    if (response.ok) {
      const data = await response.json();
      if (data && Array.isArray(data.snappedPoints)) {
        const matched = data.snappedPoints.map((sp: any) => ({
          lat: sp.location.latitude,
          lng: sp.location.longitude,
          originalIndex: sp.originalIndex,
          placeId: sp.placeId
        }));
        console.log(`[ROADS_SERVICE] Snap bem sucedido. Recebeu ${matched.length} pontos corrigidos.`);
        return {
          success: true,
          matchedPoints: matched,
          originalResponse: data
        };
      } else {
        console.warn('[ROADS_SERVICE] Resposta da API do Roads vazia ou erro:', data);
        return {
          success: false,
          matchedPoints: [],
          error: data.error || 'Nenhum ponto retornado pelo Roads API.',
          originalResponse: data
        };
      }
    } else {
      const errText = await response.text();
      console.warn('[ROADS_SERVICE] API falhou:', errText);
      return {
        success: false,
        matchedPoints: [],
        error: `Servidor retornou erro: ${errText}`
      };
    }
  } catch (err: any) {
    console.error('[ROADS_SERVICE] Erro ao sincronizar rota com Roads API:', err);
    return {
      success: false,
      matchedPoints: [],
      error: err.message || 'Falha de comunicação de rede.'
    };
  }
}
