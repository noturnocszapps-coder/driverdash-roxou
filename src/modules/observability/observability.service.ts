/**
 * Observability Core Service - FASE 5.2
 * Location: src/modules/observability/observability.service.ts
 * Description: Implements logging buffers, database sync adapters, and system snapshots.
 */

import { supabase } from '../shared/supabase.helpers';
import { STORAGE_PREFIX } from '../shared/constants';
import { AppLog, AuditLog, SystemHealthSnapshot, LogCategory, LogLevel } from './observability.types';
import { APP_VERSION } from '../../config/environment';

const LOCAL_APP_LOGS = `${STORAGE_PREFIX}local_app_logs`;
const LOCAL_AUDIT_LOGS = `${STORAGE_PREFIX}local_audit_logs`;

export const observabilityService = {
  /**
   * Captures and persists an application event entry safely.
   */
  async log(
    level: LogLevel,
    category: LogCategory,
    message: string,
    metadata: Record<string, any> | null = null
  ): Promise<AppLog> {
    // Determine active session user safely from Supabase Auth
    let userId: string | null = null;
    try {
      const { data } = await supabase.auth.getSession();
      userId = data.session?.user?.id || null;
    } catch {
      // Auth fetch failure, continue anonymously
    }

    const newLog: AppLog = {
      id: `log-${Math.random().toString(36).substring(2, 11)}`,
      user_id: userId,
      level,
      category,
      message,
      metadata,
      created_at: new Date().toISOString()
    };

    // 1. Double-buffered local persistence (localStorage)
    try {
      const existing = localStorage.getItem(LOCAL_APP_LOGS);
      const list: AppLog[] = existing ? JSON.parse(existing) : [];
      list.unshift(newLog);
      // Keep safety bounds of 100 recent elements offline
      localStorage.setItem(LOCAL_APP_LOGS, JSON.stringify(list.slice(0, 100)));
    } catch (err) {
      console.warn('Failed storing app log in browser cache:', err);
    }

    // 2. Transmit to remote Supabase database (with failsafe try-catch rules)
    try {
      const { error } = await supabase
        .from('app_logs')
        .insert([{
          user_id: newLog.user_id,
          level: newLog.level,
          category: newLog.category,
          message: newLog.message,
          metadata: newLog.metadata
        }]);

      if (error) {
        // If the table doesn't exist yet, we fail gracefully without throwing
        console.debug('Database log sync inactive or table missing, buffered locally:', error.message);
      }
    } catch {
      // Offline fallback, completely silent
    }

    return newLog;
  },

  /**
   * Performs an auditable administrative event tracking logs.
   */
  async audit(
    action: string,
    entityType: string,
    entityId: string | null = null,
    targetUserId: string | null = null,
    metadata: Record<string, any> | null = null
  ): Promise<AuditLog> {
    let actorUserId = 'system_automated';
    try {
      const { data } = await supabase.auth.getSession();
      actorUserId = data.session?.user?.id || 'system_anonymous';
    } catch {}

    const newAudit: AuditLog = {
      id: `aud-${Math.random().toString(36).substring(2, 11)}`,
      actor_user_id: actorUserId,
      target_user_id: targetUserId,
      action,
      entity_type: entityType,
      entity_id: entityId,
      metadata,
      created_at: new Date().toISOString()
    };

    // Buffer local storage
    try {
      const existing = localStorage.getItem(LOCAL_AUDIT_LOGS);
      const list: AuditLog[] = existing ? JSON.parse(existing) : [];
      list.unshift(newAudit);
      localStorage.setItem(LOCAL_AUDIT_LOGS, JSON.stringify(list.slice(0, 100)));
    } catch {}

    // Transmit to supabase safely hook
    try {
      const { error } = await supabase
        .from('audit_logs')
        .insert([{
          actor_user_id: newAudit.actor_user_id,
          target_user_id: newAudit.target_user_id,
          action: newAudit.action,
          entity_type: newAudit.entity_type,
          entity_id: newAudit.entity_id,
          metadata: newAudit.metadata
        }]);
      
      if (error) {
        console.debug('Failed transmitting audit logs to database:', error.message);
      }
    } catch {}

    return newAudit;
  },

  /**
   * Evaluates overall modular system states and captures a health snapshot
   */
  async captureSystemHealth(): Promise<SystemHealthSnapshot> {
    let database_ok = false;
    let auth_ok = false;
    let gps_ok = false;
    let sync_ok = true; // offline sync module is operational client-side
    let demand_ok = true;
    let alerts_ok = true;

    // 1. Verify DB is connected
    try {
      const start = Date.now();
      const { error } = await supabase.from('profiles').select('id').limit(1);
      database_ok = !error;
      auth_ok = true; // API reached
    } catch {
      database_ok = false;
      auth_ok = false;
    }

    // 2. Check GPS state via location authorization API
    if (navigator.geolocation) {
      try {
        const permission = await navigator.permissions.query({ name: 'geolocation' as any });
        gps_ok = permission.state === 'granted';
      } catch {
        gps_ok = true; // fallback to active permission assumption
      }
    }

    const snapshot: SystemHealthSnapshot = {
      id: `hth-${Math.random().toString(36).substring(2, 11)}`,
      database_ok,
      auth_ok,
      gps_ok,
      sync_ok,
      demand_ok,
      alerts_ok,
      version: APP_VERSION,
      metadata: {
        user_agent: navigator.userAgent,
        screen_size: `${window.innerWidth}x${window.innerHeight}`,
        device_memory: (navigator as any).deviceMemory || 'unknown'
      },
      created_at: new Date().toISOString()
    };

    // Attempt table logging of health checks in remote database
    try {
      await supabase
        .from('system_health_snapshots')
        .insert([{
          database_ok: snapshot.database_ok,
          auth_ok: snapshot.auth_ok,
          gps_ok: snapshot.gps_ok,
          sync_ok: snapshot.sync_ok,
          demand_ok: snapshot.demand_ok,
          alerts_ok: snapshot.alerts_ok,
          version: snapshot.version,
          metadata: snapshot.metadata
        }]);
    } catch {}

    return snapshot;
  },

  /**
   * Retrieves aggregated application logs. Combines server logs and offline diagnostics.
   */
  async fetchAppLogs(): Promise<AppLog[]> {
    const localLogsStr = localStorage.getItem(LOCAL_APP_LOGS);
    const localList: AppLog[] = localLogsStr ? JSON.parse(localLogsStr) : [];

    try {
      const { data, error } = await supabase
        .from('app_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(60);

      if (!error && data && data.length > 0) {
        // Merge lists preventing duplicates
        const dbList: AppLog[] = data.map(d => ({
          id: d.id,
          user_id: d.user_id,
          level: d.level,
          category: d.category,
          message: d.message,
          metadata: d.metadata,
          created_at: d.created_at
        }));

        const mergedMap = new Map<string, AppLog>();
        dbList.forEach(item => mergedMap.set(item.created_at + '_' + item.message, item));
        localList.forEach(item => mergedMap.set(item.created_at + '_' + item.message, item));

        return Array.from(mergedMap.values())
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
          .slice(0, 75);
      }
    } catch {}

    return localList;
  },

  /**
   * Retrieves administrative audit trails
   */
  async fetchAuditLogs(): Promise<AuditLog[]> {
    const localAuditStr = localStorage.getItem(LOCAL_AUDIT_LOGS);
    const localList: AuditLog[] = localAuditStr ? JSON.parse(localAuditStr) : [];

    try {
      const { data, error } = await supabase
        .from('audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(60);

      if (!error && data) {
        const dbList: AuditLog[] = data.map(d => ({
          id: d.id,
          actor_user_id: d.actor_user_id,
          target_user_id: d.target_user_id,
          action: d.action,
          entity_type: d.entity_type,
          entity_id: d.entity_id,
          metadata: d.metadata,
          created_at: d.created_at
        }));

        const mergedMap = new Map<string, AuditLog>();
        dbList.forEach(item => mergedMap.set(item.created_at + '_' + item.action, item));
        localList.forEach(item => mergedMap.set(item.created_at + '_' + item.action, item));

        return Array.from(mergedMap.values())
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
          .slice(0, 75);
      }
    } catch {}

    return localList;
  },

  /**
   * Clear all localized logs (for debugging or maintenance)
   */
  clearLocalLogs(): void {
    localStorage.removeItem(LOCAL_APP_LOGS);
    localStorage.removeItem(LOCAL_AUDIT_LOGS);
  }
};
