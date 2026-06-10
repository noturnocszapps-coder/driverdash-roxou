/**
 * Observability Hooks - FASE 5.2
 * Location: src/modules/observability/observability.hooks.ts
 */

import { useState, useEffect, useCallback } from 'react';
import { observabilityService } from './observability.service';
import { AppLog, AuditLog, SystemHealthSnapshot } from './observability.types';

export const useObservability = () => {
  const [logs, setLogs] = useState<AppLog[]>([]);
  const [audits, setAudits] = useState<AuditLog[]>([]);
  const [health, setHealth] = useState<SystemHealthSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorObj, setErrorObj] = useState<string | null>(null);

  const refreshLogs = useCallback(async () => {
    setLoading(true);
    setErrorObj(null);
    try {
      const fetchedLogs = await observabilityService.fetchAppLogs();
      setLogs(fetchedLogs);
    } catch (e: any) {
      setErrorObj(e.message || 'Error occurred reading app telemetry logs');
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshAudits = useCallback(async () => {
    setLoading(true);
    try {
      const fetchedAudits = await observabilityService.fetchAuditLogs();
      setAudits(fetchedAudits);
    } catch {}
    finally {
      setLoading(false);
    }
  }, []);

  const refreshHealth = useCallback(async () => {
    try {
      const h = await observabilityService.captureSystemHealth();
      setHealth(h);
    } catch {}
  }, []);

  // Initial trigger
  useEffect(() => {
    refreshHealth();
    refreshLogs();
    refreshAudits();
  }, [refreshHealth, refreshLogs, refreshAudits]);

  return {
    logs,
    audits,
    health,
    loading,
    errorObj,
    refreshLogs,
    refreshAudits,
    refreshHealth,
    clearLocalLogs: () => {
      observabilityService.clearLocalLogs();
      setLogs([]);
      setAudits([]);
    }
  };
};
