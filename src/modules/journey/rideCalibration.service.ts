/**
 * Isolated Ride Calibration Service for AI Training and Quality Control
 * Module: Journey (journey)
 * Responsibility: Manages individual ride state, automatic metrics calculations,
 * data quality validations, and persistence logic for both Local and Supabase storage.
 * Designed to be reusable by Android Accessibility Services in the future.
 */

import { supabase } from '../shared/supabase.helpers';
import { calculateDistanceBetweenPoints } from './journey.calculations';
import { errorTracker } from '../observability/errorTracker';

export interface GpsTrackPoint {
  lat: number;
  lng: number;
  timestamp: string;
  speed?: number;
  accuracy?: number;
}

export interface CalibratedRide {
  id: string; // ride_id
  journey_id: string; // journey_id (session_id)
  driver_id: string; // driver_id
  status: 'finished' | 'cancelled' | 'pending';
  
  // High-fidelity Geocoding & Addressing
  bairroOrigem: string;
  bairroDestino: string;
  cidadeOrigem: string;
  cidadeDestino: string;
  pickup_address?: string;
  destination_address?: string;

  // Boarding timestamps and coordinates (Item 4 & 5)
  startTime: string;
  endTime?: string;
  pickup_timestamp?: string; // Time passenger boarded
  pickup_lat?: number;
  pickup_lng?: number;
  dropoff_timestamp?: string; // Time finished
  dropoff_lat?: number;
  dropoff_lng?: number;

  // Contextual attributes
  platform: string;
  receivedValue: number;
  tipValue: number;
  tollValue: number;
  clima: string;
  evento: string;
  observations?: string;

  // Track coordinates
  rideTrackPoints: GpsTrackPoint[];

  // Automatic Metrics (Item 3)
  tempo_parado_antes_embarque: number; // Seconds spent stopped (speed = 0) before passenger boarded
  tempo_ate_embarque: number; // Total seconds until passenger boarded
  tempo_com_passageiro: number; // Total seconds with passenger
  velocidade_media: number; // km/h
  velocidade_maxima: number; // km/h
  precisao_media_gps: number; // meters
  quantidade_pontos_gps: number;
  distancia_haversine: number; // direct distance pickup -> dropoff (km)
  distancia_hodometro: number; // distance based on vehicle odometer change (km)
  diferenca_percentual_distancia: number; // percent difference between haversine and odometer

  // Technical metadata
  start_odometer?: number;
  end_odometer?: number;
  is_pending_calibration_details?: boolean; // If data was missing during saving
  calibratedAt?: string;
  pending_sync?: boolean;
}

/**
 * Validates the quality of ride data as per Item 9.
 * If data is missing (empty neighborhood, negative values, zero time, invalid coords),
 * returns validation errors and marks the ride as pending.
 */
export function validateRideData(ride: Partial<CalibratedRide>): {
  isValid: boolean;
  errors: string[];
  isPending: boolean;
} {
  const errors: string[] = [];
  let isPending = false;

  // Rule 1: Never save negative values
  if (typeof ride.receivedValue === 'number' && ride.receivedValue < 0) {
    errors.push('O valor recebido não pode ser negativo.');
  }
  if (typeof ride.tipValue === 'number' && ride.tipValue < 0) {
    errors.push('A gorjeta não pode ser negativa.');
  }
  if (typeof ride.tollValue === 'number' && ride.tollValue < 0) {
    errors.push('O pedágio não pode ser negativo.');
  }

  // Rule 2: Never save zero/negative time for finished rides (tempo zero)
  if (ride.status === 'finished') {
    const startMs = ride.startTime ? new Date(ride.startTime).getTime() : 0;
    const endMs = ride.endTime ? new Date(ride.endTime).getTime() : 0;
    const totalDuration = (endMs - startMs) / 1000;
    if (totalDuration <= 0) {
      errors.push('Tempo total de corrida não pode ser zero ou negativo.');
    }
  }

  // Check if critical elements are missing (mark as pending instead of throwing error)
  if (!ride.bairroOrigem || ride.bairroOrigem.trim() === '') {
    isPending = true;
  }
  if (!ride.bairroDestino || ride.bairroDestino.trim() === '') {
    isPending = true;
  }

  // Validate coordinates
  const validateCoord = (lat?: number, lng?: number) => {
    if (lat === undefined || lng === undefined || isNaN(lat) || isNaN(lng)) return false;
    if (lat === 0 && lng === 0) return false; // Invalid/null GPS
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return false;
    return true;
  };

  const startLat = ride.pickup_lat !== undefined ? ride.pickup_lat : ride.rideTrackPoints?.[0]?.lat;
  const startLng = ride.pickup_lng !== undefined ? ride.pickup_lng : ride.rideTrackPoints?.[0]?.lng;
  if (!validateCoord(startLat, startLng)) {
    isPending = true;
  }

  if (ride.status === 'finished') {
    const endLat = ride.dropoff_lat !== undefined ? ride.dropoff_lat : ride.rideTrackPoints?.[ride.rideTrackPoints.length - 1]?.lat;
    const endLng = ride.dropoff_lng !== undefined ? ride.dropoff_lng : ride.rideTrackPoints?.[ride.rideTrackPoints.length - 1]?.lng;
    if (!validateCoord(endLat, endLng)) {
      isPending = true;
    }
  }

  // Return validation results
  return {
    isValid: errors.length === 0,
    errors,
    isPending
  };
}

/**
 * Calculates automatic telemetry and geographic metrics for a ride as per Item 3.
 */
export function calculateAutomaticMetrics(ride: Partial<CalibratedRide>): Partial<CalibratedRide> {
  const points = ride.rideTrackPoints || [];
  const start_odometer = ride.start_odometer || 0;
  const end_odometer = ride.end_odometer || start_odometer;

  // 1. Calculate speeds
  let maxSpeed = 0;
  let totalSpeed = 0;
  let speedCount = 0;
  let totalAccuracy = 0;
  let accuracyCount = 0;

  points.forEach(p => {
    if (p.speed !== undefined && p.speed >= 0) {
      if (p.speed > maxSpeed) maxSpeed = p.speed;
      totalSpeed += p.speed;
      speedCount++;
    }
    if (p.accuracy !== undefined && p.accuracy > 0) {
      totalAccuracy += p.accuracy;
      accuracyCount++;
    }
  });

  const velocidade_maxima = Number((maxSpeed * 3.6).toFixed(1)); // Convert m/s to km/h if stored as m/s, or preserve
  const velocidade_media = speedCount > 0 ? Number(((totalSpeed / speedCount) * 3.6).toFixed(1)) : 35; // default/fallbacks
  const precisao_media_gps = accuracyCount > 0 ? Number((totalAccuracy / accuracyCount).toFixed(1)) : 10;
  const quantidade_pontos_gps = points.length;

  // 2. Calculate tempo parado antes do embarque
  // We check speed = 0 (or speed < 1 km/h / 0.3 m/s) at points before the pickup_timestamp
  let tempo_parado_antes_embarque = 0;
  const pickupTimeMs = ride.pickup_timestamp ? new Date(ride.pickup_timestamp).getTime() : 0;
  const startTimeMs = ride.startTime ? new Date(ride.startTime).getTime() : 0;

  if (pickupTimeMs > startTimeMs) {
    // Find points recorded before the pickup timestamp
    const pointsBeforeBoarding = points.filter(p => {
      const pTime = new Date(p.timestamp).getTime();
      return pTime >= startTimeMs && pTime <= pickupTimeMs;
    });

    // Calculate time differences for contiguous stop segments
    for (let i = 0; i < pointsBeforeBoarding.length - 1; i++) {
      const currentPoint = pointsBeforeBoarding[i];
      const nextPoint = pointsBeforeBoarding[i + 1];
      const isStopped = currentPoint.speed === 0 || (currentPoint.speed !== undefined && currentPoint.speed < 0.5);

      if (isStopped) {
        const diffSec = (new Date(nextPoint.timestamp).getTime() - new Date(currentPoint.timestamp).getTime()) / 1000;
        if (diffSec > 0 && diffSec < 60) { // filter anomalies
          tempo_parado_antes_embarque += diffSec;
        }
      }
    }
  }
  tempo_parado_antes_embarque = Math.round(tempo_parado_antes_embarque);

  // 3. Time segments (Item 4 & 5)
  const pickupTimestampVal = ride.pickup_timestamp || ride.startTime;
  const endTimeVal = ride.endTime || new Date().toISOString();

  const tempo_ate_embarque = Math.max(0, Math.round((new Date(pickupTimestampVal).getTime() - startTimeMs) / 1000));
  const tempo_com_passageiro = Math.max(0, Math.round((new Date(endTimeVal).getTime() - new Date(pickupTimestampVal).getTime()) / 1000));

  // 4. Distances
  const pLat = ride.pickup_lat !== undefined ? ride.pickup_lat : points[0]?.lat || -22.1225;
  const pLng = ride.pickup_lng !== undefined ? ride.pickup_lng : points[0]?.lng || -51.3883;
  const dLat = ride.dropoff_lat !== undefined ? ride.dropoff_lat : points[points.length - 1]?.lat || pLat;
  const dLng = ride.dropoff_lng !== undefined ? ride.dropoff_lng : points[points.length - 1]?.lng || pLng;

  const distancia_haversine = Number(calculateDistanceBetweenPoints(pLat, pLng, dLat, dLng).toFixed(2));
  const distancia_hodometro = Number(Math.max(0, end_odometer - start_odometer).toFixed(2));

  // 5. Percentual difference
  let diferenca_percentual_distancia = 0;
  if (distancia_haversine > 0) {
    diferenca_percentual_distancia = Number((Math.abs(distancia_hodometro - distancia_haversine) / distancia_haversine * 100).toFixed(1));
  } else if (distancia_hodometro > 0) {
    diferenca_percentual_distancia = 100;
  }

  return {
    tempo_parado_antes_embarque,
    tempo_ate_embarque,
    tempo_com_passageiro,
    velocidade_media,
    velocidade_maxima,
    precisao_media_gps,
    quantidade_pontos_gps,
    distancia_haversine,
    distancia_hodometro,
    diferenca_percentual_distancia
  };
}

/**
 * Isolated method to save/update a ride log locally and remotely (Item 1 & 2 & 8)
 * Designed to be universally invoked by any service (including Android automation wrapper).
 */
export async function persistCalibratedRide(rideData: Partial<CalibratedRide>): Promise<{
  success: boolean;
  ride: CalibratedRide;
  error?: string;
}> {
  console.log('[CALIBRATION_SAVE_START] Persistência iniciada para os dados da corrida...');
  try {
    const { isValid, errors, isPending } = validateRideData(rideData);
    if (!isValid) {
      const errMsg = errors.join(' ');
      console.error('[CALIBRATION_SAVE_ERROR] Erro na validação dos dados de calibração:', errMsg);
      return {
        success: false,
        ride: rideData as CalibratedRide,
        error: errMsg
      };
    }

    // Deep merge and compute automatic metrics
    const computedMetrics = calculateAutomaticMetrics(rideData);
    const finalRide: CalibratedRide = {
      ...(rideData as CalibratedRide),
      ...computedMetrics,
      status: isPending ? 'pending' : (rideData.status || 'finished'),
      is_pending_calibration_details: isPending,
      calibratedAt: new Date().toISOString()
    };

    // Calculate ride_log fields
    const start_gps = finalRide.pickup_lat && finalRide.pickup_lng
      ? { lat: finalRide.pickup_lat, lng: finalRide.pickup_lng }
      : (finalRide.rideTrackPoints?.[0] ? { lat: finalRide.rideTrackPoints[0].lat, lng: finalRide.rideTrackPoints[0].lng } : null);

    const end_gps = finalRide.dropoff_lat && finalRide.dropoff_lng
      ? { lat: finalRide.dropoff_lat, lng: finalRide.dropoff_lng }
      : (finalRide.rideTrackPoints?.[finalRide.rideTrackPoints.length - 1] 
          ? { lat: finalRide.rideTrackPoints[finalRide.rideTrackPoints.length - 1].lat, lng: finalRide.rideTrackPoints[finalRide.rideTrackPoints.length - 1].lng } 
          : null);

    const startMs = finalRide.startTime ? new Date(finalRide.startTime).getTime() : Date.now();
    const endMs = finalRide.endTime ? new Date(finalRide.endTime).getTime() : Date.now();
    const duration = Math.max(1, Math.round((endMs - startMs) / 1000));

    // Vehicle cost calculation fallback
    const costPerKm = 0.45;
    const distance = finalRide.distancia_hodometro || finalRide.distancia_haversine || 0;
    const vehicle_cost = Number((distance * costPerKm).toFixed(2));
    const valRecebido = finalRide.receivedValue || 0;
    const profit = Number((valRecebido - vehicle_cost).toFixed(2));

    // Idle time calculation
    let totalIdleSec = (finalRide as any).totalIdleTime || 0;
    if ((finalRide as any).idleStartTimestamp) {
      totalIdleSec += (Date.now() - (finalRide as any).idleStartTimestamp) / 1000;
    }
    const idle_time = Number((totalIdleSec / 60).toFixed(2));

    const ride_log = {
      ride_id: finalRide.id,
      start_gps,
      end_gps,
      pickup_neighborhood: finalRide.bairroOrigem || 'Centro',
      destination_neighborhood: finalRide.bairroDestino || 'Centro',
      fare_value: valRecebido,
      distance: Number(distance.toFixed(2)),
      duration,
      idle_time,
      vehicle_cost,
      profit,
      timestamp: finalRide.startTime,
      rideTrackPoints: finalRide.rideTrackPoints || []
    };

    // Embed ride_log nested
    const fullSavedRide: any = {
      ...finalRide,
      ...ride_log,
      ride_log
    };

    // 1. Sync to Supabase (attempt first to detect failure)
    let syncError: any = null;
    try {
      const { error } = await supabase
        .from('driver_ride_logs')
        .upsert({
          id: fullSavedRide.id,
          journey_id: fullSavedRide.journey_id || 'session_unknown',
          driver_id: fullSavedRide.driver_id || 'driver_unknown',
          payload: { ...fullSavedRide, pending_sync: false },
          created_at: new Date().toISOString()
        });
      syncError = error;
    } catch (err: any) {
      syncError = err;
    }

    if (syncError) {
      console.warn('[CALIBRATION_SAVE_ERROR] Supabase sync failed. Marking as pending_sync = true:', syncError.message || syncError);
      fullSavedRide.pending_sync = true;
      try {
        errorTracker.trackSupabaseError('Persistir Corrida Calibrada (Upsert)', syncError);
      } catch (err) {
        console.error('Failed to log sync error to tracker:', err);
      }
    } else {
      fullSavedRide.pending_sync = false;
    }

    // 2. Save locally to ride_logs localStorage array
    const existingLogsStr = localStorage.getItem('ride_logs');
    let existingLogs: any[] = existingLogsStr ? JSON.parse(existingLogsStr) : [];
    
    // Check if ride already exists, if so overwrite, else push
    const idx = existingLogs.findIndex(r => r.id === fullSavedRide.id || r.ride_id === fullSavedRide.ride_id);
    if (idx !== -1) {
      existingLogs[idx] = fullSavedRide;
    } else {
      existingLogs.push(fullSavedRide);
    }
    localStorage.setItem('ride_logs', JSON.stringify(existingLogs));

    if (syncError) {
      console.log('[CALIBRATION_SAVE_OFFLINE] Sincronizado localmente (offline) com sucesso.', ride_log);
      return {
        success: false,
        ride: fullSavedRide,
        error: `Falha ao salvar no banco remoto (Supabase): ${syncError.message || 'Sem resposta de rede'}. A corrida foi guardada localmente e será sincronizada automaticamente em segundo plano.`
      };
    }

    console.log('[CALIBRATION_SAVE_SUCCESS] Corrida persistida localmente e remotamente.', ride_log);
    return {
      success: true,
      ride: fullSavedRide
    };
  } catch (err: any) {
    console.error('[CALIBRATION_SAVE_ERROR] Falha crítica de persistência:', err);
    return {
      success: false,
      ride: rideData as CalibratedRide,
      error: err.message || 'Erro de persistência desconhecido.'
    };
  }
}

/**
 * Aggregates advanced automatic analytics as per Item 7.
 */
export function calculateCalibrationAnalytics(rides: CalibratedRide[]) {
  const finished = rides.filter(r => r.status === 'finished');
  
  const totalRides = finished.length;
  if (totalRides === 0) {
    return {
      tempoMedioEmbarqueSec: 0,
      tempoMedioCorridaSec: 0,
      kmMedios: 0,
      lucroMedio: 0,
      rPerKm: 0,
      rPerHour: 0,
      bairrosOrigemFreq: [] as { name: string; count: number }[],
      bairrosDestinoFreq: [] as { name: string; count: number }[],
      plataformasFreq: [] as { name: string; count: number }[]
    };
  }

  // Averages
  let totalEmbarque = 0;
  let embarqueCount = 0;
  let totalComPassageiro = 0;
  let passengerCount = 0;
  let totalKm = 0;
  let totalProfit = 0;
  let totalValue = 0;
  let totalDurationSec = 0;

  const originNeighborhoods: Record<string, number> = {};
  const destinationNeighborhoods: Record<string, number> = {};
  const platforms: Record<string, number> = {};

  finished.forEach(r => {
    // Check boarding timer
    if (r.tempo_ate_embarque !== undefined) {
      totalEmbarque += r.tempo_ate_embarque;
      embarqueCount++;
    }
    if (r.tempo_com_passageiro !== undefined && r.tempo_com_passageiro > 0) {
      totalComPassageiro += r.tempo_com_passageiro;
      passengerCount++;
    }

    const duration = r.endTime && r.startTime 
      ? (new Date(r.endTime).getTime() - new Date(r.startTime).getTime()) / 1000 
      : 300;
    
    totalDurationSec += duration;
    totalKm += r.distancia_hodometro || r.distancia_haversine || 0;
    
    const value = r.receivedValue || 0;
    totalValue += value;

    const tip = r.tipValue || 0;
    const toll = r.tollValue || 0;
    const gross = value + tip;
    const profit = gross - toll; // Net profit concept (without vehicle-cost, or with it depending on preferences, let's keep net revenue as value)
    totalProfit += profit;

    // Freq counts
    if (r.bairroOrigem) originNeighborhoods[r.bairroOrigem] = (originNeighborhoods[r.bairroOrigem] || 0) + 1;
    if (r.bairroDestino) destinationNeighborhoods[r.bairroDestino] = (destinationNeighborhoods[r.bairroDestino] || 0) + 1;
    if (r.platform) platforms[r.platform] = (platforms[r.platform] || 0) + 1;
  });

  const kmMedios = Number((totalKm / totalRides).toFixed(2));
  const lucroMedio = Number((totalValue / totalRides).toFixed(2));
  const rPerKm = totalKm > 0 ? Number((totalValue / totalKm).toFixed(2)) : 0;
  const rPerHour = totalDurationSec > 0 ? Number((totalValue / (totalDurationSec / 3600)).toFixed(2)) : 0;

  const formatFreq = (rec: Record<string, number>) => {
    return Object.entries(rec)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  };

  return {
    tempoMedioEmbarqueSec: embarqueCount > 0 ? Math.round(totalEmbarque / embarqueCount) : 0,
    tempoMedioCorridaSec: totalRides > 0 ? Math.round(totalDurationSec / totalRides) : 0,
    kmMedios,
    lucroMedio,
    rPerKm,
    rPerHour,
    bairrosOrigemFreq: formatFreq(originNeighborhoods),
    bairrosDestinoFreq: formatFreq(destinationNeighborhoods),
    plataformasFreq: formatFreq(platforms)
  };
}
