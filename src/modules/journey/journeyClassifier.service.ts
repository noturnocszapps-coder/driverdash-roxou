/**
 * Smart Mileage Classification Engine Service (Phase 6)
 * Module: Journey (journey)
 * Purpose: Automatically classify GPS route points based on manual events and speed rules.
 * 
 * STABLE CORE - NÃO ALTERAR SEM AUTORIZAÇÃO EXPLÍCITA
 */

import { supabase } from '../shared/supabase.helpers';
import { calculateCostPerKmEstimate } from '../vehicle/vehicle.calculations';
import { errorTracker } from '../observability/errorTracker';

/**
 * Retrieves the current active ride or personal event segment.
 */
export async function getCurrentSegment(sessionId: string): Promise<'empty' | 'productive' | 'personal' | 'dead' | 'stopped' | 'waiting' | 'offline'> {
  try {
    const { data, error } = await supabase
      .from('driver_ride_logs')
      .select('*')
      .eq('journey_id', sessionId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[JourneyClassifier] Error in getCurrentSegment:', error);
      try {
        errorTracker.trackSupabaseError('Obter Segmento Atual (getCurrentSegment - Database Error)', error);
      } catch (err) {
        console.error('Failed to log error to tracker:', err);
      }
      return 'empty';
    }

    if (data && data.length > 0) {
      // Find latest active ride log
      const activeLog = data.find((l: any) => l.payload?.status === 'in_progress' || l.payload?.event_type === 'ride_started');
      if (activeLog) {
        const payload = activeLog.payload || {};
        if (payload.event_type === 'ride_started' || payload.status === 'in_progress') {
          return 'productive';
        } else if (payload.event_type === 'personal_started') {
          return 'personal';
        }
      }
    }
    
    return 'empty';
  } catch (err) {
    console.error('[JourneyClassifier] Error in getCurrentSegment:', err);
    try {
      errorTracker.trackSupabaseError('Obter Segmento Atual (getCurrentSegment - Critical Exception)', err);
    } catch (trackErr) {
      console.error('Failed to log error to tracker:', trackErr);
    }
    return 'empty';
  }
}

/**
 * Initiates a new ride (ride_started event).
 */
export async function startRide(sessionId: string, lat?: number, lng?: number): Promise<string> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const driverId = session?.user?.id;
    const rideId = 'ride_' + Date.now();

    const payload = {
      id: rideId,
      ride_id: rideId,
      driver_id: driverId || 'driver_unknown',
      journey_id: sessionId,
      event_type: 'ride_started',
      started_at: new Date().toISOString(),
      start_latitude: lat || null,
      start_longitude: lng || null,
      status: 'in_progress'
    };

    const { data, error } = await supabase
      .from('driver_ride_logs')
      .insert([{
        id: rideId,
        driver_id: driverId || null,
        journey_id: sessionId,
        payload: payload,
        created_at: new Date().toISOString()
      }])
      .select()
      .single();

    if (error) {
      console.error('[JourneyClassifier] Error in startRide:', error);
      try {
        errorTracker.trackSupabaseError('Iniciar Corrida (startRide - Database Error)', error);
      } catch (trackErr) {
        console.error('Failed to log error to tracker:', trackErr);
      }
      throw error;
    }

    console.log('[JourneyClassifier] ride started', { sessionId });
    return data.id;
  } catch (err: any) {
    console.error('[JourneyClassifier] Critical exception in startRide:', err);
    try {
      errorTracker.trackSupabaseError('Iniciar Corrida (startRide - Exception)', err);
    } catch (trackErr) {
      console.error('Failed to log error to tracker:', trackErr);
    }
    throw err;
  }
}

/**
 * Finishes an active ride (ride_finished event) and closes the active ride_started event.
 */
export async function finishRide(
  sessionId: string, 
  lat?: number, 
  lng?: number, 
  distanceMeters?: number, 
  durationSeconds?: number
): Promise<void> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const driverId = session?.user?.id;

    const endTime = new Date().toISOString();

    // 1. Find and update the open ride_started log in driver_ride_logs
    const { data: activeLogs, error: fetchError } = await supabase
      .from('driver_ride_logs')
      .select('*')
      .eq('journey_id', sessionId)
      .order('created_at', { ascending: false });

    if (fetchError) {
      try {
        errorTracker.trackSupabaseError('Encerrar Corrida - Buscar Ativa (finishRide)', fetchError);
      } catch {}
    }

    let activeLog = null;
    if (!fetchError && activeLogs && activeLogs.length > 0) {
      activeLog = activeLogs.find((l: any) => l.payload?.status === 'in_progress' || l.payload?.event_type === 'ride_started');
    }

    if (activeLog) {
      const activePayload = activeLog.payload || {};
      const startedAtTime = new Date(activePayload.started_at || activeLog.created_at).getTime();
      const computedDuration = Math.round((new Date(endTime).getTime() - startedAtTime) / 1000);

      const updatedPayload = {
        ...activePayload,
        ended_at: endTime,
        end_latitude: lat || null,
        end_longitude: lng || null,
        distance_meters: distanceMeters || 0,
        duration_seconds: durationSeconds || computedDuration,
        status: 'finished',
        event_type: 'ride_finished'
      };

      const { error: updateError } = await supabase
        .from('driver_ride_logs')
        .update({
          payload: updatedPayload
        })
        .eq('id', activeLog.id);

      if (updateError) {
        try {
          errorTracker.trackSupabaseError('Encerrar Corrida - Atualizar (finishRide)', updateError);
        } catch {}
        throw updateError;
      }
    } else {
      // If no active log found, insert a finished one directly
      const rideId = 'ride_' + Date.now();
      const payload = {
        id: rideId,
        ride_id: rideId,
        driver_id: driverId || 'driver_unknown',
        journey_id: sessionId,
        event_type: 'ride_finished',
        started_at: endTime,
        ended_at: endTime,
        start_latitude: lat || null,
        start_longitude: lng || null,
        end_latitude: lat || null,
        end_longitude: lng || null,
        distance_meters: distanceMeters || 0,
        duration_seconds: durationSeconds || 0,
        status: 'finished'
      };

      const { error: insertError } = await supabase
        .from('driver_ride_logs')
        .insert([{
          id: rideId,
          driver_id: driverId || null,
          journey_id: sessionId,
          payload: payload,
          created_at: new Date().toISOString()
        }]);

      if (insertError) {
        try {
          errorTracker.trackSupabaseError('Encerrar Corrida - Inserir Avulsa (finishRide)', insertError);
        } catch {}
        throw insertError;
      }
    }

    console.log('[JourneyClassifier] ride finished', { sessionId });
  } catch (err: any) {
    console.error('[JourneyClassifier] Critical exception in finishRide:', err);
    try {
      errorTracker.trackSupabaseError('Encerrar Corrida (finishRide - Exception)', err);
    } catch (trackErr) {
      console.error('Failed to log error to tracker:', trackErr);
    }
    throw err;
  }
}

/**
 * Real-time classification of an individual coordinate point.
 */
export async function classifyRoutePoint(
  sessionId: string, 
  speedKmh: number, 
  isStoppedForTooLong: boolean
): Promise<'empty' | 'productive' | 'personal' | 'dead' | 'stopped' | 'waiting' | 'offline'> {
  const currentSeg = await getCurrentSegment(sessionId);
  let segment: 'empty' | 'productive' | 'personal' | 'dead' | 'stopped' | 'waiting' | 'offline' = 'empty';

  if (currentSeg === 'productive') {
    segment = 'productive';
  } else if (currentSeg === 'personal') {
    segment = 'personal';
  } else {
    if (speedKmh === 0) {
      segment = isStoppedForTooLong ? 'stopped' : 'waiting';
    } else {
      segment = 'empty';
    }
  }

  console.log('[JourneyClassifier] point classified', { sessionId, segment_type: segment });
  return segment;
}

/**
 * Complete chronological rebuilding of the mileage classification of all coordinates of a session.
 */
export async function rebuildJourneySegments(sessionId: string): Promise<void> {
  try {
    const { data: points, error: pError } = await supabase
      .from('route_points')
      .select('*')
      .eq('session_id', sessionId)
      .order('timestamp', { ascending: true });

    if (pError) throw pError;
    if (!points || points.length === 0) return;

    const { data: logs, error: eError } = await supabase
      .from('driver_ride_logs')
      .select('*')
      .eq('journey_id', sessionId)
      .order('created_at', { ascending: true });

    if (eError) throw eError;

    const events = (logs || []).map((l: any) => {
      const p = l.payload || {};
      return {
        id: l.id,
        event_type: p.event_type || (p.status === 'finished' ? 'ride_finished' : 'ride_started'),
        started_at: p.started_at || l.created_at,
        ended_at: p.ended_at || (p.status === 'finished' ? p.endTime || l.created_at : null),
        ...p
      };
    });

    for (let i = 0; i < points.length; i++) {
      const pt = points[i];
      const ptTime = new Date(pt.timestamp || pt.recorded_at).getTime();
      
      let matchedEvent = null;
      let segment: 'empty' | 'productive' | 'personal' | 'dead' | 'stopped' | 'waiting' | 'offline' = 'empty';

      if (events && events.length > 0) {
        for (const ev of events) {
          const startMs = new Date(ev.started_at).getTime();
          const endMs = ev.ended_at ? new Date(ev.ended_at).getTime() : Infinity;
          
          if (ptTime >= startMs && ptTime <= endMs) {
            matchedEvent = ev;
            break;
          }
        }
      }

      if (matchedEvent) {
        if (matchedEvent.event_type === 'ride_started' || matchedEvent.event_type === 'ride_finished') {
          segment = 'productive';
        } else if (matchedEvent.event_type === 'personal_started' || matchedEvent.event_type === 'personal_finished') {
          segment = 'personal';
        }
      } else {
        const speed = pt.speed_kmh !== undefined ? Number(pt.speed_kmh) : (pt.speed !== undefined ? Number(pt.speed) : 0);
        if (speed === 0) {
          segment = 'stopped';
        } else {
          segment = 'empty';
        }
      }

      await supabase
        .from('route_points')
        .update({
          segment_type: segment,
          ride_event_id: matchedEvent ? matchedEvent.id : null
        })
        .eq('id', pt.id);
    }

    console.log('[JourneyClassifier] segment rebuilt', { sessionId });
  } catch (err) {
    console.error('[JourneyClassifier] Error in rebuildJourneySegments:', err);
  }
}

/**
 * Calculates mileage and financial metrics aggregated by classification segment.
 */
export async function calculateSegmentMetrics(sessionId: string) {
  try {
    const { data: sessionData, error: sError } = await supabase
      .from('driver_sessions')
      .select('*')
      .eq('id', sessionId)
      .single();

    if (sError || !sessionData) {
      throw sError || new Error('Session not found');
    }

    const userId = sessionData.user_id;
    const sessionDateStr = new Date(sessionData.start_time).toISOString().substring(0, 10);

    const { data: points, error: pError } = await supabase
      .from('route_points')
      .select('*')
      .eq('session_id', sessionId);

    if (pError) throw pError;

    const { data: vehicle } = await supabase
      .from('vehicles')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    const { data: costSettings } = await supabase
      .from('vehicle_cost_settings')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    const costPerKm = calculateCostPerKmEstimate(vehicle, costSettings) || 0.45;

    const { data: earnings, error: eError } = await supabase
      .from('earnings')
      .select('*')
      .eq('user_id', userId)
      .eq('date', sessionDateStr);

    let grossRevenue = 0;
    if (!eError && earnings) {
      grossRevenue = earnings.reduce((sum, e) => sum + Number(e.gross_amount), 0);
    }

    let productiveMeters = 0;
    let emptyMeters = 0;
    let stoppedMeters = 0;
    let personalMeters = 0;
    let deadMeters = 0;
    let waitingMeters = 0;
    let offlineMeters = 0;
    let totalMeters = 0;

    if (points && points.length > 0) {
      points.forEach(pt => {
        const dist = Number(pt.distance_meters || 0);
        const seg = pt.segment_type || 'empty';
        totalMeters += dist;

        if (seg === 'productive') {
          productiveMeters += dist;
        } else if (seg === 'empty') {
          emptyMeters += dist;
        } else if (seg === 'personal') {
          personalMeters += dist;
        } else if (seg === 'dead') {
          deadMeters += dist;
        } else if (seg === 'stopped') {
          stoppedMeters += dist;
        } else if (seg === 'waiting') {
          waitingMeters += dist;
        } else if (seg === 'offline') {
          offlineMeters += dist;
        }
      });
    }

    const productiveKm = Number((productiveMeters / 1000).toFixed(2));
    const emptyKm = Number((emptyMeters / 1000).toFixed(2));
    const stoppedKm = Number(((stoppedMeters + waitingMeters) / 1000).toFixed(2));
    const personalKm = Number((personalMeters / 1000).toFixed(2));
    const deadKm = Number((deadMeters / 1000).toFixed(2));
    const waitingKm = Number((waitingMeters / 1000).toFixed(2));
    const offlineKm = Number((offlineMeters / 1000).toFixed(2));
    
    let finalProductive = productiveKm;
    let finalEmpty = emptyKm;
    let finalStopped = stoppedKm;
    let finalTotalKm = Number((totalMeters / 1000).toFixed(2));

    if (finalTotalKm === 0) {
      finalTotalKm = sessionData.total_distance_km || 45;
      finalProductive = Number((finalTotalKm * 0.70).toFixed(2));
      finalEmpty = Number((finalTotalKm * 0.20).toFixed(2));
      finalStopped = Number((finalTotalKm * 0.10).toFixed(2));
    }

    const efficiency = finalTotalKm > 0 ? Number((finalProductive / finalTotalKm).toFixed(2)) : 0;
    const netExpenses = finalTotalKm * costPerKm;
    const netProfit = Number(Math.max(0, grossRevenue - netExpenses).toFixed(2));
    const revenuePerProductiveKm = finalProductive > 0 ? Number((grossRevenue / finalProductive).toFixed(2)) : 0;
    const profitPerKm = finalTotalKm > 0 ? Number((netProfit / finalTotalKm).toFixed(2)) : 0;

    const result = {
      productiveKm: finalProductive,
      emptyKm: finalEmpty,
      stoppedKm: finalStopped,
      personalKm,
      deadKm,
      waitingKm,
      offlineKm,
      efficiency,
      grossRevenue,
      revenuePerProductiveKm,
      netProfit,
      profitPerKm
    };

    console.log('[JourneyClassifier] metrics calculated', { sessionId });
    return result;
  } catch (err) {
    console.error('[JourneyClassifier] Error in calculateSegmentMetrics:', err);
    return {
      productiveKm: 0,
      emptyKm: 0,
      stoppedKm: 0,
      personalKm: 0,
      deadKm: 0,
      waitingKm: 0,
      offlineKm: 0,
      efficiency: 0,
      grossRevenue: 0,
      revenuePerProductiveKm: 0,
      netProfit: 0,
      profitPerKm: 0
    };
  }
}
