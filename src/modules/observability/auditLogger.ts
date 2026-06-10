/**
 * Audit Logger Middleware - FASE 5.2
 * Location: src/modules/observability/auditLogger.ts
 * Description: Logs important security and admin state events.
 */

import { observabilityService } from './observability.service';

export const auditLogger = {
  /**
   * Safe wrapper to log standard application logs
   */
  logEvent(category: any, message: string, meta?: any) {
    observabilityService.log('info', category, message, meta || null);
  },

  /**
   * Core audit logging
   */
  logAuthAction(action: 'login' | 'logout' | 'login_failed', email: string, reason?: string): void {
    const status = action === 'login_failed' ? 'error' : 'info';
    observabilityService.log(
      status,
      'auth',
      `Auth Event: User ${action} (Email: ${email})${reason ? ` - Reason: ${reason}` : ''}`,
      { email, action, reason }
    );
  },

  logJourneyAction(action: 'started' | 'paused' | 'resumed' | 'completed' | 'error_gps', details: Record<string, any> = {}): void {
    observabilityService.log(
      action === 'error_gps' ? 'error' : 'info',
      action === 'error_gps' ? 'gps' : 'system',
      `Jornada ${action.toUpperCase()}: Active driver sequence update.`,
      details
    );
  },

  logGPSEvent(event: 'permission_denied' | 'wakelock_lost' | 'timeout', details: Record<string, any> = {}): void {
    observabilityService.log(
      'critical',
      'gps',
      `GPS State: Action - ${event.toUpperCase()}`,
      details
    );
  },

  logSyncCompleted(signalsCount: number, errorCount: number): void {
    const level = errorCount > 0 ? 'warn' : 'info';
    observabilityService.log(
      level,
      'sync',
      `Offline Sincronização: Completed. Synced ${signalsCount} objects. Errors: ${errorCount}`,
      { signalsCount, errorCount }
    );
  },

  logAdminAccessControl(
    adminId: string,
    targetUserId: string,
    action: 'block' | 'unblock' | 'promote_admin' | 'demote_admin' | 'change_plan' | 'update_beta_tester',
    meta: Record<string, any> = {}
  ): void {
    observabilityService.audit(
      action,
      'profile',
      targetUserId,
      targetUserId,
      { admin_id: adminId, ...meta }
    );

    observabilityService.log(
      'warn',
      'admin',
      `Controle de Acesso: Admin ${adminId} performed '${action}' on user ${targetUserId}`,
      { adminId, targetUserId, action, ...meta }
    );
  },

  logDemandRuleChange(adminId: string, ruleId: string, action: 'create' | 'edit' | 'delete', details: any): void {
    observabilityService.audit(
      `${action}_demand_rule`,
      'demand_rule',
      ruleId,
      null,
      { admin_id: adminId, ...details }
    );

    observabilityService.log(
      'info',
      'admin',
      `Regra de Demanda: Admin updated rule ${ruleId} (${action})`,
      { adminId, ruleId, action, details }
    );
  },

  logRoxouMockToggle(enabled: boolean): void {
    observabilityService.log(
      'info',
      'admin',
      `Roxou Mock Integration ${enabled ? 'ENABLED' : 'DISABLED'}.`,
      { enabled }
    );
    observabilityService.audit(
      `toggle_roxou_mock_${enabled ? 'on' : 'off'}`,
      'roxou_integration',
      null,
      null,
      { enabled }
    );
  }
};
