/**
 * Insights Hooks and Context Provider
 * Module: Insights (insights)
 * When to edit: When updating cache structures for peak tables or passenger report states.
 */

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from '../auth/auth.hooks';
import { STORAGE_PREFIX } from '../shared/constants';
import { AdminPeakRule, PassengerReport, InsightsContextType } from './insights.types';
import { insightsService } from './insights.service';

export const InsightsContext = createContext<InsightsContextType | undefined>(undefined);

export const InsightsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, dbStatus } = useAuth();
  const [peakRules, setPeakRules] = useState<AdminPeakRule[]>([]);
  const [passengerReports, setPassengerReports] = useState<PassengerReport[]>([]);

  useEffect(() => {
    const loadLocal = () => {
      const lPeaks = localStorage.getItem(`${STORAGE_PREFIX}peaks`);
      const lReports = localStorage.getItem(`${STORAGE_PREFIX}reports`);
      setPeakRules(lPeaks ? JSON.parse(lPeaks) : []);
      setPassengerReports(lReports ? JSON.parse(lReports) : []);
    };

    if (dbStatus === 'connected') {
      const fetchData = async () => {
        try {
          const peaks = await insightsService.fetchPeakRules();
          const reports = await insightsService.fetchPassengerReports();
          setPeakRules(peaks);
          setPassengerReports(reports);
          localStorage.setItem(`${STORAGE_PREFIX}peaks`, JSON.stringify(peaks));
          localStorage.setItem(`${STORAGE_PREFIX}reports`, JSON.stringify(reports));
        } catch (e) {
          console.warn('Insights query error, loading backups:', e);
          loadLocal();
        }
      };
      fetchData();
    } else {
      loadLocal();
    }
  }, [user, dbStatus]);

  const addPeakRule = async (rule: Omit<AdminPeakRule, 'id'>) => {
    const item: AdminPeakRule = {
      ...rule,
      created_at: new Date().toISOString()
    };

    if (dbStatus === 'connected') {
      try {
        const saved = await insightsService.addPeakRule(item);
        const updated = [saved, ...peakRules];
        setPeakRules(updated);
        localStorage.setItem(`${STORAGE_PREFIX}peaks`, JSON.stringify(updated));
        return;
      } catch (err) {
        console.error('Supabase peak rule save error. Saving locally.', err);
      }
    }

    const localItem = { ...item, id: 'lcl-pkr-' + Math.random().toString(36).substring(2, 9) };
    const updated = [localItem, ...peakRules];
    setPeakRules(updated);
    localStorage.setItem(`${STORAGE_PREFIX}peaks`, JSON.stringify(updated));
  };

  const togglePeakRule = async (id: string | undefined, indexLocal: number) => {
    const currentRule = peakRules.find((p, idx) => p.id === id || idx === indexLocal);
    if (!currentRule) return;

    const toggled = !currentRule.is_active;

    if (dbStatus === 'connected' && id && !id.startsWith('lcl-')) {
      try {
        await insightsService.updatePeakRuleStatus(id, toggled);
      } catch (e) {
        console.error('Error toggling peak rule in remote DB:', e);
      }
    }

    const updated = peakRules.map((p, idx) => {
      if (p.id === id || (p.id === undefined && idx === indexLocal)) {
        return { ...p, is_active: toggled };
      }
      return p;
    });
    setPeakRules(updated);
    localStorage.setItem(`${STORAGE_PREFIX}peaks`, JSON.stringify(updated));
  };

  const addPassengerReport = async (reportData: Omit<PassengerReport, 'user_id' | 'id'>) => {
    if (!user) return;
    const item: PassengerReport = {
      ...reportData,
      user_id: user.id,
      created_at: new Date().toISOString()
    };

    if (dbStatus === 'connected') {
      try {
        const saved = await insightsService.addPassengerReport(item);
        const updated = [saved, ...passengerReports];
        setPassengerReports(updated);
        localStorage.setItem(`${STORAGE_PREFIX}reports`, JSON.stringify(updated));
        return;
      } catch (err) {
        console.error('Supabase report save error. Saving locally.', err);
      }
    }

    const localItem = { ...item, id: 'lcl-rep-' + Math.random().toString(36).substring(2, 9) };
    const updated = [localItem, ...passengerReports];
    setPassengerReports(updated);
    localStorage.setItem(`${STORAGE_PREFIX}reports`, JSON.stringify(updated));
  };

  return (
    <InsightsContext.Provider
      value={{
        peakRules,
        passengerReports,
        addPeakRule,
        togglePeakRule,
        addPassengerReport
      }}
    >
      {children}
    </InsightsContext.Provider>
  );
};

export const useInsights = () => {
  const context = useContext(InsightsContext);
  if (context === undefined) {
    throw new Error('useInsights must be used inside an InsightsProvider');
  }
  return context;
};
export { insightsService };
export type { AdminPeakRule, PassengerReport };
