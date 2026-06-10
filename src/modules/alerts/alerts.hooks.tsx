/**
 * Roxou Smart Alerts Hooks and Context Provider
 * Module: Alerts (alerts)
 * When to edit: When updating alert dismissal rules or caching states.
 */

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from '../auth/auth.hooks';
import { STORAGE_PREFIX } from '../shared/constants';
import { SmartAlert, AlertsContextType } from './alerts.types';
import { alertsService } from './alerts.service';

export const AlertsContext = createContext<AlertsContextType | undefined>(undefined);

export const AlertsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, dbStatus } = useAuth();
  const [smartAlerts, setSmartAlerts] = useState<SmartAlert[]>([]);

  useEffect(() => {
    if (!user) {
      setSmartAlerts([]);
      return;
    }

    const loadLocal = () => {
      const lAlerts = localStorage.getItem(`${STORAGE_PREFIX}smart_alerts_${user.id}`);
      setSmartAlerts(lAlerts ? JSON.parse(lAlerts) : []);
    };

    if (dbStatus === 'connected') {
      const fetchData = async () => {
        try {
          const data = await alertsService.fetchSmartAlerts(user.id);
          setSmartAlerts(data);
          localStorage.setItem(`${STORAGE_PREFIX}smart_alerts_${user.id}`, JSON.stringify(data));
        } catch (e) {
          console.warn('Smart alerts database read failed, loading fallback index cache:', e);
          loadLocal();
        }
      };
      fetchData();
    } else {
      loadLocal();
    }
  }, [user, dbStatus]);

  const addSmartAlert = async (alert: Omit<SmartAlert, 'id' | 'created_at'>) => {
    if (!user) return;
    const userId = user.id;

    const item: SmartAlert = {
      id: 'alrt-' + Math.random().toString(36).substring(2, 9),
      type: alert.type,
      title: alert.title,
      description: alert.description,
      severity: alert.severity,
      is_read: false,
      created_at: new Date().toISOString()
    };

    if (dbStatus === 'connected') {
      try {
        const saved = await alertsService.insertSmartAlert(userId, alert);
        const updated = [saved, ...smartAlerts];
        setSmartAlerts(updated);
        localStorage.setItem(`${STORAGE_PREFIX}smart_alerts_${userId}`, JSON.stringify(updated));
        return;
      } catch (err) {
        console.error("Failed to insert alert in DB, saving to local cache.", err);
      }
    }

    const updated = [item, ...smartAlerts];
    setSmartAlerts(updated);
    localStorage.setItem(`${STORAGE_PREFIX}smart_alerts_${userId}`, JSON.stringify(updated));
  };

  const dismissAlert = async (alertId: string) => {
    if (!user) return;
    const userId = user.id;

    if (dbStatus === 'connected' && !alertId.startsWith('alrt-')) {
      try {
        await alertsService.deleteSmartAlert(alertId);
      } catch (e) {
        console.error("Failed to delete alert in Supabase:", e);
      }
    }

    const updated = smartAlerts.filter(a => a.id !== alertId);
    setSmartAlerts(updated);
    localStorage.setItem(`${STORAGE_PREFIX}smart_alerts_${userId}`, JSON.stringify(updated));
  };

  return (
    <AlertsContext.Provider
      value={{
        smartAlerts,
        addSmartAlert,
        dismissAlert
      }}
    >
      {children}
    </AlertsContext.Provider>
  );
};

export const useAlerts = () => {
  const context = useContext(AlertsContext);
  if (context === undefined) {
    throw new Error('useAlerts must be used inside an AlertsProvider');
  }
  return context;
};
export { alertsService };
export type { SmartAlert };
