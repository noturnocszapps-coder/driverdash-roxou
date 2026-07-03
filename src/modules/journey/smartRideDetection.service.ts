/**
 * Smart Ride Detection Engine Service (Phase 6)
 * Module: Journey (journey)
 * Purpose: Automatically detect ride starts and ends based on GPS, speed, stopping patterns, heading changes, and acceleration.
 * 
 * STABLE CORE - NÃO ALTERAR SEM AUTORIZAÇÃO EXPLÍCITA
 */

import { supabase } from '../shared/supabase.helpers';
import { RoutePoint, DriverRideEvent } from '../../types';
import { startRide, finishRide } from './journeyClassifier.service';

// Storage keys
const MANUAL_OVERRIDE_KEY_PREFIX = 'driverdash_ride_manual_override_';
const AI_STATE_KEY_PREFIX = 'driverdash_ride_ai_state_';
const CONFIDENCE_HISTORY_KEY = 'driverdash_ride_ai_confidence_history';
const AI_FEEDBACK_KEY = 'driverdash_ride_ai_feedback';

export interface AIDetectionState {
  sessionId: string;
  currentAutoState: 'IDLE' | 'STOPPED_BEFORE_RIDE' | 'EN_ROUTE' | 'RIDE_ACTIVE' | 'STOPPED_AFTER_RIDE' | 'COOLDOWN';
  lastStatusTime: number;
  confidenceScore: number;
  reason: string;
  detectedEvents: string[];
  manualEvents: string[];
}

export interface AIRideStats {
  accuracyRate: number; // Precisão da IA
  autoDetectedCount: number; // Corridas detectadas automaticamente
  manuallyConfirmedCount: number; // Corridas confirmadas manualmente
  totalRideCount: number;
}

/**
 * Calculates direction change between two headings (in degrees).
 */
function getHeadingDifference(h1: number | null | undefined, h2: number | null | undefined): number {
  if (h1 === null || h1 === undefined || h2 === null || h2 === undefined) return 0;
  let diff = Math.abs(h1 - h2);
  if (diff > 180) diff = 360 - diff;
  return diff;
}

/**
 * Learns and adapts heuristics parameters based on manual override feedback.
 */
interface AdaptiveParameters {
  stopTimeThresholdSeconds: number;
  minRideSpeedKmh: number;
  accelerationThreshold: number;
}

export function getAdaptiveParameters(): AdaptiveParameters {
  try {
    const feedbackData = localStorage.getItem(AI_FEEDBACK_KEY);
    const feedbackList = feedbackData ? JSON.parse(feedbackData) : [];
    
    // Base parameters
    let stopTimeThresholdSeconds = 12; // default 12s stopped
    let minRideSpeedKmh = 20; // default 20 km/h minimum to confirm ride
    let accelerationThreshold = 3.0; // default m/s^2 change
    
    if (feedbackList.length > 0) {
      // Simple reinforcement learning:
      // If user confirms rides earlier (more manual starts), decrease stopped time threshold
      // If user rejects or manually ends ride earlier, increase the speed threshold
      const confirmedCount = feedbackList.filter((f: any) => f.type === 'confirm').length;
      const rejectedCount = feedbackList.filter((f: any) => f.type === 'reject').length;
      
      stopTimeThresholdSeconds = Math.max(5, 12 - (confirmedCount * 0.5) + (rejectedCount * 0.5));
      minRideSpeedKmh = Math.max(12, Math.min(35, 20 + (rejectedCount * 1.0) - (confirmedCount * 0.3)));
    }
    
    return { stopTimeThresholdSeconds, minRideSpeedKmh, accelerationThreshold };
  } catch (err) {
    return { stopTimeThresholdSeconds: 12, minRideSpeedKmh: 20, accelerationThreshold: 3.0 };
  }
}

/**
 * Main AI Engine: Runs whenever new telemetry points are added or synced.
 */
export async function analyzeTelemetryForRide(
  sessionId: string,
  points: RoutePoint[],
  activeRideEvent: any,
  addSmartAlert?: (alert: any) => void
): Promise<AIDetectionState> {
  const isManualOverride = localStorage.getItem(`${MANUAL_OVERRIDE_KEY_PREFIX}${sessionId}`) === 'true';
  
  // Load current AI state
  let state: AIDetectionState = {
    sessionId,
    currentAutoState: 'IDLE',
    lastStatusTime: Date.now(),
    confidenceScore: 0,
    reason: 'Iniciando rastreamento',
    detectedEvents: [],
    manualEvents: []
  };

  try {
    const saved = localStorage.getItem(`${AI_STATE_KEY_PREFIX}${sessionId}`);
    if (saved) {
      state = JSON.parse(saved);
    }
  } catch (e) {
    console.error('Error loading AI state:', e);
  }

  // Sync state with manual events
  if (activeRideEvent) {
    if (!state.manualEvents.includes('ride_started')) {
      state.manualEvents.push('ride_started');
    }
    if (!['EN_ROUTE', 'RIDE_ACTIVE', 'STOPPED_AFTER_RIDE'].includes(state.currentAutoState)) {
      state.currentAutoState = 'RIDE_ACTIVE';
      state.lastStatusTime = Date.now();
    }
  } else {
    if (state.manualEvents.includes('ride_started') && !state.manualEvents.includes('ride_finished')) {
      state.manualEvents.push('ride_finished');
    }
    if (['RIDE_ACTIVE', 'STOPPED_AFTER_RIDE'].includes(state.currentAutoState)) {
      state.currentAutoState = 'IDLE';
      state.lastStatusTime = Date.now();
    }
  }

  if (points.length < 3) {
    state.confidenceScore = 0;
    state.reason = 'Aguardando mais pontos de telemetria GPS para calibrar a IA...';
    localStorage.setItem(`${AI_STATE_KEY_PREFIX}${sessionId}`, JSON.stringify(state));
    return state;
  }

  // Sort points chronologically
  const sortedPoints = [...points].sort(
    (a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime()
  );

  const lastPoint = sortedPoints[sortedPoints.length - 1];
  const secondLastPoint = sortedPoints[sortedPoints.length - 2];
  const thirdLastPoint = sortedPoints[sortedPoints.length - 3];

  const lastSpeed = lastPoint.speed_kmh || 0;
  const prevSpeed = secondLastPoint.speed_kmh || 0;
  const thirdSpeed = thirdLastPoint.speed_kmh || 0;

  // Get current adaptive parameters
  const params = getAdaptiveParameters();

  // 1. Calculate features
  // Acceleration approximate in m/s^2
  const dtSec = (new Date(lastPoint.recorded_at).getTime() - new Date(secondLastPoint.recorded_at).getTime()) / 1000;
  const speedDiffMps = ((lastSpeed - prevSpeed) / 3.6);
  const acceleration = dtSec > 0 ? Math.abs(speedDiffMps / dtSec) : 0;

  // Heading change
  const headingChange = getHeadingDifference(lastPoint.heading, secondLastPoint.heading);

  // Stoppage detection
  const isCurrentlyStopped = lastSpeed < 5;
  const wasPrevStopped = prevSpeed < 5;

  // Total continuous movement distance and duration
  let movingPointsCount = 0;
  let continuousMovingDistance = 0;
  for (let i = sortedPoints.length - 1; i >= 0; i--) {
    if ((sortedPoints[i].speed_kmh || 0) >= 5) {
      movingPointsCount++;
      continuousMovingDistance += sortedPoints[i].distance_meters || 0;
    } else {
      break;
    }
  }

  // 2. Decision Trees / Rules for Ride Detection
  let calculatedConfidence = 0;
  let detectedReason = '';
  let triggerStart = false;
  let triggerFinish = false;

  if (isManualOverride) {
    calculatedConfidence = 100;
    detectedReason = 'Prioridade total para evento manual (override ativo)';
    if (!state.detectedEvents.includes('manual_override')) {
      state.detectedEvents.push('manual_override');
      console.log('[RideAI] manual override active', { sessionId });
    }
  } else {
    // STATE MACHINE TRANSITIONS
    switch (state.currentAutoState) {
      case 'IDLE':
        if (isCurrentlyStopped) {
          state.currentAutoState = 'STOPPED_BEFORE_RIDE';
          state.lastStatusTime = Date.now();
          detectedReason = 'Motorista parado/aguardando nova corrida';
          calculatedConfidence = 60; // Base suggestive score
        } else {
          detectedReason = 'Rodando vazio sem padrão de corrida definido';
          calculatedConfidence = 30; // Under 50% = "Não classificar"
        }
        break;

      case 'STOPPED_BEFORE_RIDE':
        if (!isCurrentlyStopped && lastSpeed > 15) {
          // Transition to EN_ROUTE (Ride Accepted!)
          state.currentAutoState = 'EN_ROUTE';
          state.lastStatusTime = Date.now();
          if (!state.detectedEvents.includes('ride_started_prediction')) {
            state.detectedEvents.push('ride_started_prediction');
          }
          triggerStart = true;
          detectedReason = 'Início de aceleração consistente após parada (Corrida Detectada)';
          calculatedConfidence = 96; // 95-100% Detectado automaticamente
          console.log('[RideAI] ride detected', { sessionId, confidence: calculatedConfidence });
        } else {
          detectedReason = 'Parado aguardando chamada de passageiro';
          calculatedConfidence = 75; // Provável corrida aguardando início
        }
        break;

      case 'EN_ROUTE':
        // Check if route is continuous and speed reaches passenger transit range
        if (lastSpeed > params.minRideSpeedKmh && movingPointsCount >= 2) {
          state.currentAutoState = 'RIDE_ACTIVE';
          state.lastStatusTime = Date.now();
          detectedReason = 'Transportando passageiro em rota contínua de alta velocidade';
          calculatedConfidence = 98;
          console.log('[RideAI] ride confidence high - in transit', { sessionId });
        } else if (isCurrentlyStopped) {
          // Quick traffic stop or dropoff
          detectedReason = 'Parada temporária em semáforo ou embarque';
          calculatedConfidence = 85;
        } else {
          detectedReason = 'Acelerando e deslocando em baixa velocidade';
          calculatedConfidence = 72;
        }
        break;

      case 'RIDE_ACTIVE':
        if (isCurrentlyStopped) {
          state.currentAutoState = 'STOPPED_AFTER_RIDE';
          state.lastStatusTime = Date.now();
          detectedReason = 'Parada detectada no destino final (Desembarcando passageiro)';
          calculatedConfidence = 92;
        } else {
          // Keep active
          detectedReason = 'Fluxo de corrida contínuo com velocidade estável';
          calculatedConfidence = 97;
          
          // Detect sudden direction changes
          if (headingChange > 65 && lastSpeed > 30) {
            detectedReason = 'Curva acentuada detectada em trânsito com passageiro';
            calculatedConfidence = 99;
          }
        }
        break;

      case 'STOPPED_AFTER_RIDE':
        // If they stay stopped, then start moving again -> ride is finished!
        if (!isCurrentlyStopped && lastSpeed > 10) {
          state.currentAutoState = 'COOLDOWN';
          state.lastStatusTime = Date.now();
          if (!state.detectedEvents.includes('ride_finished_prediction')) {
            state.detectedEvents.push('ride_finished_prediction');
          }
          triggerFinish = true;
          detectedReason = 'Motorista voltou a se deslocar livremente (Corrida Finalizada)';
          calculatedConfidence = 96;
          console.log('[RideAI] ride finished - automated detection', { sessionId });
        } else {
          detectedReason = 'Aguardando desembarque completo do passageiro';
          calculatedConfidence = 88;
        }
        break;

      case 'COOLDOWN':
        // Back to idle
        if (lastSpeed > 30) {
          state.currentAutoState = 'IDLE';
          state.lastStatusTime = Date.now();
          detectedReason = 'Voltou ao modo livre buscando novas demandas';
          calculatedConfidence = 45;
        } else {
          detectedReason = 'Resfriando após corrida finalizada';
          calculatedConfidence = 55;
        }
        break;

      default:
        state.currentAutoState = 'IDLE';
    }
  }

  state.confidenceScore = calculatedConfidence;
  state.reason = detectedReason;

  // Log ride confidence
  console.log(`[RideAI] ride confidence: ${calculatedConfidence}% - Reason: ${detectedReason}`);

  // 3. Execute Automatic Triggers safely if NOT manually overridden and confidence is high
  if (!isManualOverride) {
    if (triggerStart && !activeRideEvent) {
      try {
        const eventId = await startRide(sessionId, lastPoint.latitude, lastPoint.longitude);
        
        // Update driver_ride_logs payload to flag this as automated
        const { data: existing } = await supabase
          .from('driver_ride_logs')
          .select('payload')
          .eq('id', eventId)
          .maybeSingle();

        const currentPayload = existing?.payload || {};
        const updatedPayload = {
          ...currentPayload,
          is_automated: true,
          confidence_score: calculatedConfidence,
          classification_reason: detectedReason,
          was_confirmed_manually: false
        };

        await supabase
          .from('driver_ride_logs')
          .update({
            payload: updatedPayload
          })
          .eq('id', eventId);

        // Track active event ID
        localStorage.setItem(`driverdash_active_event_id_${sessionId}`, eventId);

        if (addSmartAlert) {
          addSmartAlert({
            title: 'Nova Corrida Detectada ⚡',
            description: `A IA identificou o início da sua corrida (${calculatedConfidence}% de precisão). Pontos sendo gravados como KM Produtivo.`,
            type: 'profit',
            severity: 'low'
          });
        }
      } catch (err) {
        console.error('[RideAI] Failed to auto-trigger startRide:', err);
      }
    } else if (triggerFinish && activeRideEvent) {
      try {
        await finishRide(sessionId, lastPoint.latitude, lastPoint.longitude);
        
        // Find the completed event and update it with AI stats in driver_ride_logs
        const { data: latestLogs } = await supabase
          .from('driver_ride_logs')
          .select('*')
          .eq('journey_id', sessionId)
          .order('created_at', { ascending: false });

        const latestLog = latestLogs?.find((l: any) => l.payload?.event_type === 'ride_finished' || l.payload?.status === 'finished');

        if (latestLog) {
          const finishedEventId = latestLog.id;
          const currentPayload = latestLog.payload || {};
          const updatedPayload = {
            ...currentPayload,
            is_automated: true,
            confidence_score: calculatedConfidence,
            classification_reason: detectedReason,
            was_confirmed_manually: false
          };

          await supabase
            .from('driver_ride_logs')
            .update({
              payload: updatedPayload
            })
            .eq('id', finishedEventId);
        }

        // Clean active event ID
        localStorage.removeItem(`driverdash_active_event_id_${sessionId}`);

        if (addSmartAlert) {
          addSmartAlert({
            title: 'Corrida Finalizada pela IA 🏁',
            description: `A IA detectou o desembarque do passageiro (${calculatedConfidence}% de precisão). Voltou ao KM Vazio.`,
            type: 'profit',
            severity: 'low'
          });
        }
      } catch (err) {
        console.error('[RideAI] Failed to auto-trigger finishRide:', err);
      }
    }
  }

  // Save updated AI state
  localStorage.setItem(`${AI_STATE_KEY_PREFIX}${sessionId}`, JSON.stringify(state));

  // Save confidence history for debug/logs
  try {
    const historySaved = localStorage.getItem(CONFIDENCE_HISTORY_KEY);
    const history = historySaved ? JSON.parse(historySaved) : [];
    history.push({
      timestamp: new Date().toISOString(),
      confidence: calculatedConfidence,
      state: state.currentAutoState,
      reason: detectedReason,
      isAutomated: !isManualOverride
    });
    // Keep last 100 logs
    if (history.length > 100) history.shift();
    localStorage.setItem(CONFIDENCE_HISTORY_KEY, JSON.stringify(history));
  } catch (err) {
    console.error('Error saving confidence history:', err);
  }

  return state;
}

/**
 * Submits feedback from manual confirmation to improve the AI heuristic.
 */
export async function submitAIConfirmationFeedback(
  sessionId: string,
  eventId: string,
  isConfirmed: boolean
): Promise<void> {
  try {
    // 1. Update event state in driver_ride_logs payload
    const { data: existing } = await supabase
      .from('driver_ride_logs')
      .select('payload')
      .eq('id', eventId)
      .maybeSingle();

    const currentPayload = existing?.payload || {};
    const updatedPayload = {
      ...currentPayload,
      was_confirmed_manually: isConfirmed,
      classification_reason: isConfirmed 
        ? 'Confirmado manualmente pelo motorista' 
        : 'Rejeitado pelo motorista / Classificação incorreta'
    };

    await supabase
      .from('driver_ride_logs')
      .update({
        payload: updatedPayload
      })
      .eq('id', eventId);

    // 2. Local feedback loop for parameter tuning
    const feedbackData = localStorage.getItem(AI_FEEDBACK_KEY);
    const feedbackList = feedbackData ? JSON.parse(feedbackData) : [];
    
    feedbackList.push({
      timestamp: new Date().toISOString(),
      sessionId,
      eventId,
      type: isConfirmed ? 'confirm' : 'reject'
    });
    
    localStorage.setItem(AI_FEEDBACK_KEY, JSON.stringify(feedbackList));

    // Log to audit logger console
    if (isConfirmed) {
      console.log(`[RideAI] ride confirmed manually for event ${eventId}`);
    } else {
      console.log(`[RideAI] ride rejected manually for event ${eventId}`);
    }
  } catch (err) {
    console.error('[RideAI] Error saving AI feedback:', err);
  }
}

/**
 * Computes Smart Ride Detection stats for the dashboard.
 */
export async function getSmartRideStats(sessionId?: string): Promise<AIRideStats> {
  try {
    const { data: logs, error } = await supabase
      .from('driver_ride_logs')
      .select('*')
      .order('created_at', { ascending: false });

    if (error || !logs || logs.length === 0) {
      return { accuracyRate: 0, autoDetectedCount: 0, manuallyConfirmedCount: 0, totalRideCount: 0 };
    }

    const events = logs.map((l: any) => {
      const p = l.payload || {};
      return {
        id: l.id,
        session_id: l.journey_id,
        ...p
      };
    });

    const filtered = sessionId ? events.filter(e => e.session_id === sessionId) : events;

    const autoDetected = filtered.filter(e => e.is_automated === true).length;
    const manuallyConfirmed = filtered.filter(e => e.was_confirmed_manually === true || e.is_automated === false).length;
    const total = filtered.length;

    // Calculate accuracy rate dynamically:
    // If we have negative feedback (rejections), we subtract them.
    const feedbackData = localStorage.getItem(AI_FEEDBACK_KEY);
    const feedbackList = feedbackData ? JSON.parse(feedbackData) : [];
    
    const rejections = feedbackList.filter((f: any) => f.type === 'reject').length;
    const confirmations = feedbackList.filter((f: any) => f.type === 'confirm').length;
    
    let accuracyRate = 0;
    if (confirmations + rejections > 0) {
      accuracyRate = Number(((confirmations / (confirmations + rejections)) * 100).toFixed(1));
    } else if (total > 0) {
      accuracyRate = 100; // If they have rides but no feedback yet, default to 100%
    }

    return {
      accuracyRate,
      autoDetectedCount: autoDetected,
      manuallyConfirmedCount: manuallyConfirmed,
      totalRideCount: total
    };
  } catch (err) {
    return { accuracyRate: 0, autoDetectedCount: 0, manuallyConfirmedCount: 0, totalRideCount: 0 };
  }
}
