/**
 * Roxou Integration Types - FASE 5.1
 * Location: src/modules/demand/roxouIntegration.types.ts
 * Description: Data contracts, signal objects, and adapter results for Roxou integration.
 */

import { DemandSignal } from '../../types';

export type RoxouAudienceLevel = 'low' | 'medium' | 'high' | 'extreme';
export type RoxouImportanceLevel = 'low' | 'medium' | 'high' | 'extreme';
export type RoxouMovementLevel = 'low' | 'medium' | 'high' | 'extreme';

export interface RoxouEventSignal {
  id: string;
  title: string;
  slug: string;
  venue_name: string;
  region: string;
  latitude: number;
  longitude: number;
  starts_at: string; // ISO string
  ends_at: string; // ISO string
  category: string; // e.g., 'show', 'party', 'academic', 'conference'
  sub_category?: string;
  expected_audience_level: RoxouAudienceLevel;
  source: string; // source origin (e.g., 'roxou_api', 'roxou_supabase', 'mock')
}

export interface RoxouGameSignal {
  id: string;
  title: string; // e.g., 'Corinthians x Palmeiras'
  competition: string; // e.g., 'Brasileirão', 'Paulista'
  starts_at: string; // ISO String
  venue_name: string;
  region: string;
  latitude: number;
  longitude: number;
  importance_level: RoxouImportanceLevel;
  source: string;
}

export interface RoxouPartnerSignal {
  id: string;
  name: string; // Partner Name e.g., 'Bar do Zeca'
  type: string; // e.g., 'bar', 'club', 'restaurant', 'shopping'
  region: string;
  latitude: number;
  longitude: number;
  supports_sports: boolean;
  average_movement_level: RoxouMovementLevel;
  source: string;
}

export interface DemandSignalAdapterResult {
  signals: DemandSignal[];
  errors: string[];
  source: 'disabled' | 'roxou_supabase' | 'roxou_api' | 'mock';
  synced_at: string; // ISO Timestamp
}
