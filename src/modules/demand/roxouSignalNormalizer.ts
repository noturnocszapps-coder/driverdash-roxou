/**
 * Roxou Signal Normalizer - FASE 5.1
 * Location: src/modules/demand/roxouSignalNormalizer.ts
 * Description: Normalizes and scales complex Roxou signal contracts into standard system DemandSignals.
 */

import { DemandSignal } from '../../types';
import { RoxouEventSignal, RoxouGameSignal, RoxouPartnerSignal } from './roxouIntegration.types';

/**
 * Normalizes a Roxou Event Signal into a standard system DemandSignal
 */
export const normalizeRoxouEventToDemandSignal = (
  event: RoxouEventSignal,
  currentTime = new Date()
): DemandSignal => {
  let baseWeight = 1.0;

  // Expected audience multiplier
  switch (event.expected_audience_level) {
    case 'extreme':
      baseWeight += 1.2;
      break;
    case 'high':
      baseWeight += 0.8;
      break;
    case 'medium':
      baseWeight += 0.4;
      break;
    case 'low':
    default:
      baseWeight += 0.1;
      break;
  }

  // CATEGORY BOOST: categorias show, party, academic têm peso maior (+0.4)
  const cat = event.category.toLowerCase().trim();
  if (cat === 'show' || cat === 'party' || cat === 'academic') {
    baseWeight += 0.4;
  }

  // DATE TIERS & TIMING:
  const eventStart = new Date(event.starts_at);
  const eventEnd = new Date(event.ends_at);
  const diffMs = eventStart.getTime() - currentTime.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);

  // 1. Eventos acontecendo hoje têm peso maior (+0.3)
  const isToday = eventStart.toDateString() === currentTime.toDateString();
  if (isToday) {
    baseWeight += 0.3;
  }

  // 2. Eventos começando em até 2h têm peso maior (+0.5)
  if (diffHours > 0 && diffHours <= 2) {
    baseWeight += 0.5;
  }

  // 3. Eventos terminando agora geram demanda de saída (+0.6)
  // Considers ending either in the next 1h or ended up to 30 mins ago
  const cleanEndMs = eventEnd.getTime() - currentTime.getTime();
  const cleanEndHours = cleanEndMs / (1000 * 60 * 60);
  if (cleanEndHours >= -0.5 && cleanEndHours <= 1) {
    baseWeight += 0.6;
  }

  // Clamp weight to a maximum of 3.0 and minimum of 0.5 rules
  const finalWeight = parseFloat(Math.min(3.0, Math.max(0.5, baseWeight)).toFixed(2));

  // Determine an active tag
  const isCurrentlyActive = currentTime >= eventStart && currentTime <= eventEnd;

  return {
    id: `roxou-evt-${event.id}`,
    title: `[Roxou Event] ${event.title} @ ${event.venue_name}`,
    region: event.region,
    latitude: event.latitude,
    longitude: event.longitude,
    signal_type: `event_${event.category}`,
    weight: finalWeight,
    start_at: event.starts_at,
    end_at: event.ends_at,
    is_active: isCurrentlyActive || (diffHours >= -1 && diffHours <= 4) // active window
  };
};

/**
 * Normalizes a Roxou Game Signal into a standard system DemandSignal
 */
export const normalizeRoxouGameToDemandSignal = (
  game: RoxouGameSignal,
  currentTime = new Date()
): DemandSignal => {
  let baseWeight = 1.0;

  // Importance levels mapping
  switch (game.importance_level) {
    case 'extreme':
      baseWeight += 1.0;
      break;
    case 'high':
      baseWeight += 0.7;
      break;
    case 'medium':
      baseWeight += 0.4;
      break;
    case 'low':
    default:
      baseWeight += 0.1;
      break;
  }

  // 1. Jogos do Brasil têm peso maior (+0.6)
  const titleLower = game.title.toLowerCase();
  const compLower = game.competition.toLowerCase();
  if (titleLower.includes('brasil') || titleLower.includes('seleção') || compLower.includes('copa')) {
    baseWeight += 0.6;
  }

  // 2. Jogos com bares cadastrados têm peso médio (+0.3)
  // For Prudente matches, assume bars are present
  if (game.venue_name.toLowerCase().includes('bar') || game.venue_name.toLowerCase().includes('arena')) {
    baseWeight += 0.3;
  } else {
    // standard bar boost mock coverage
    baseWeight += 0.2;
  }

  // 3. Finais e semi finais têm peso maior (+0.5)
  if (
    titleLower.includes('final') || 
    titleLower.includes('decisão') || 
    titleLower.includes('semifinal') ||
    compLower.includes('final') ||
    compLower.includes('semi')
  ) {
    baseWeight += 0.5;
  }

  const gameStart = new Date(game.starts_at);
  const diffMs = gameStart.getTime() - currentTime.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);

  // Active game window lasts 3 hours from starts_at
  const gameDurationMs = 3 * 60 * 60 * 1000;
  const isCurrentlyPlaying = currentTime.getTime() >= gameStart.getTime() && 
                             currentTime.getTime() <= (gameStart.getTime() + gameDurationMs);

  const finalWeight = parseFloat(Math.min(3.0, Math.max(0.5, baseWeight)).toFixed(2));

  return {
    id: `roxou-gam-${game.id}`,
    title: `[Roxou Match] ${game.title} (${game.competition})`,
    region: game.region,
    latitude: game.latitude,
    longitude: game.longitude,
    signal_type: 'game_match',
    weight: finalWeight,
    start_at: game.starts_at,
    end_at: new Date(gameStart.getTime() + gameDurationMs).toISOString(),
    is_active: isCurrentlyPlaying || (diffHours >= -1 && diffHours <= 3)
  };
};

/**
 * Normalizes a Roxou Partner Venue Signal into a standard system DemandSignal
 */
export const normalizeRoxouPartnerToDemandSignal = (
  partner: RoxouPartnerSignal,
  currentTime = new Date()
): DemandSignal => {
  let baseWeight = 0.8;

  // Average movement level setup
  switch (partner.average_movement_level) {
    case 'extreme':
      baseWeight += 0.9;
      break;
    case 'high':
      baseWeight += 0.6;
      break;
    case 'medium':
      baseWeight += 0.3;
      break;
    case 'low':
    default:
      baseWeight += 0.1;
      break;
  }

  // Parsing current hour for timezone check
  const currentHour = currentTime.getHours();

  // 1. Bares e Baladas têm peso maior à noite (18h00 às 03h00) (+0.5)
  const isNightTime = currentHour >= 18 || currentHour <= 3;
  const typeLower = partner.type.toLowerCase().trim();
  if ((typeLower === 'bar' || typeLower === 'club' || typeLower === 'balada') && isNightTime) {
    baseWeight += 0.5;
  }

  // 2. Restaurantes têm peso maior no Almoço (11h30 - 14h00) ou Jantar (19h30 - 22h00) (+0.4)
  const isLunchTime = currentHour >= 11 && currentHour < 14;
  const isDinnerTime = currentHour >= 19 && currentHour < 22;
  if (typeLower === 'restaurant' || typeLower === 'restaurante') {
    if (isLunchTime || isDinnerTime) {
      baseWeight += 0.4;
    }
  }

  // 3. supports_sports aumenta peso em horário de jogo (+0.4)
  // Assume generic soccer matches trigger this (e.g. Wednesday nights 19h00-23h00, Saturday/Sunday afternoons 15h00-19h00)
  const isMatchDayWindow = 
    (currentTime.getDay() === 3 && currentHour >= 19 && currentHour <= 23) || // Quarta Futebol
    (currentTime.getDay() === 6 && currentHour >= 15 && currentHour <= 19) || // Sábado
    (currentTime.getDay() === 0 && currentHour >= 15 && currentHour <= 19);  // Domingo

  if (partner.supports_sports && isMatchDayWindow) {
    baseWeight += 0.4;
  }

  const finalWeight = parseFloat(Math.min(3.0, Math.max(0.5, baseWeight)).toFixed(2));

  // Partner stores are static points, always active
  return {
    id: `roxou-part-${partner.id}`,
    title: `[Parceiro Roxou] ${partner.name} (${partner.type})`,
    region: partner.region,
    latitude: partner.latitude,
    longitude: partner.longitude,
    signal_type: `partner_${partner.type}`,
    weight: finalWeight,
    is_active: true
  };
};
