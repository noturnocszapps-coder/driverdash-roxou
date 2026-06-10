/**
 * Observability Type Declarations - FASE 5.2
 * Location: src/modules/observability/observability.types.ts
 */

export type LogLevel = 'info' | 'warn' | 'error' | 'critical';

export type LogCategory = 
  | 'auth' 
  | 'gps' 
  | 'sync' 
  | 'supabase' 
  | 'admin' 
  | 'payment' 
  | 'demand' 
  | 'system';

export interface AppLog {
  id: string;
  user_id: string | null;
  level: LogLevel;
  category: LogCategory;
  message: string;
  metadata: Record<string, any> | null;
  created_at: string;
}

export interface AuditLog {
  id: string;
  actor_user_id: string;
  target_user_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  metadata: Record<string, any> | null;
  created_at: string;
}

export interface SystemHealthSnapshot {
  id: string;
  database_ok: boolean;
  auth_ok: boolean;
  gps_ok: boolean;
  sync_ok: boolean;
  demand_ok: boolean;
  alerts_ok: boolean;
  version: string;
  metadata: Record<string, any> | null;
  created_at: string;
}
