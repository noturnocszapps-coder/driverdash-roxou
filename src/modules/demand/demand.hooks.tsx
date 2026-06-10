/**
 * Roxou Demand Index Hooks and Context Provider
 * Module: Demand (demand)
 * When to edit: When updating automatic poll timers, dynamic intervals, or state properties.
 */

/**
 * Roxou Demand Index Hooks and Context Provider
 * Module: Demand (demand)
 * When to edit: When updating automatic poll timers, dynamic intervals, or state properties.
 */

import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { RoxouDemandStatus, DemandContextType, RoxouDemandLevel } from './demand.types';
import { useAuth } from '../auth/auth.hooks';
import { STORAGE_PREFIX } from '../shared/constants';
import { DemandSignal, AdminPeakRule } from '../../types';
import { HeatmapRegionMetrics } from '../heatmap/heatmap.types';
import { calculateDemandScoreForZone, calculateHourlyEarningsEstimate, getDemandRecommendationText, scoreToDemandLevel } from './demand.calculations';
import { supabase } from '../shared/supabase.helpers';
import { roxouIntegrationService } from './roxouIntegration.service';

export const DemandContext = createContext<DemandContextType | undefined>(undefined);

// Core 10 Presidente Prudente Zones Seeds
const INITIAL_HEATMAP_ZONES: HeatmapRegionMetrics[] = [
  { id: 'h-1', regionName: 'Centro', latitude: -22.1225, longitude: -51.3883, passengerDensity: 78, intensity: 0.75, status: 'hot', averageFareMultiplier: 1.8 },
  { id: 'h-2', regionName: 'Rodoviária', latitude: -22.1158, longitude: -51.3853, passengerDensity: 82, intensity: 0.85, status: 'hot', averageFareMultiplier: 1.8 },
  { id: 'h-3', regionName: 'Aeroporto', latitude: -22.1764, longitude: -51.4239, passengerDensity: 65, intensity: 0.60, status: 'warm', averageFareMultiplier: 1.4 },
  { id: 'h-4', regionName: 'Prudenshopping', latitude: -22.1147, longitude: -51.4068, passengerDensity: 92, intensity: 0.94, status: 'extreme', averageFareMultiplier: 2.2 },
  { id: 'h-5', regionName: 'UNOESTE', latitude: -22.1192, longitude: -51.4428, passengerDensity: 87, intensity: 0.88, status: 'extreme', averageFareMultiplier: 2.2 },
  { id: 'h-6', regionName: 'Toledo', latitude: -22.1256, longitude: -51.3992, passengerDensity: 55, intensity: 0.52, status: 'warm', averageFareMultiplier: 1.4 },
  { id: 'h-7', regionName: 'UNESP', latitude: -22.1206, longitude: -51.4092, passengerDensity: 48, intensity: 0.45, status: 'normal', averageFareMultiplier: 1.15 },
  { id: 'h-8', regionName: 'Parque do Povo', latitude: -22.1264, longitude: -51.4022, passengerDensity: 70, intensity: 0.72, status: 'hot', averageFareMultiplier: 1.8 },
  { id: 'h-9', regionName: 'Matarazzo', latitude: -22.1144, longitude: -51.3811, passengerDensity: 35, intensity: 0.32, status: 'normal', averageFareMultiplier: 1.15 },
  { id: 'h-10', regionName: 'Expo Prudente', latitude: -22.1642, longitude: -51.3482, passengerDensity: 94, intensity: 0.96, status: 'extreme', averageFareMultiplier: 2.2 }
];

const INITIAL_DEMAND_SIGNALS: DemandSignal[] = [
  { id: 'sig-1', title: 'Chuva Forte na Cidade', region: 'Centro', latitude: -22.1225, longitude: -51.3883, signal_type: 'climate', weight: 1.6, is_active: true },
  { id: 'sig-2', title: 'Abertura Show Cultural', region: 'Matarazzo', latitude: -22.1144, longitude: -51.3811, signal_type: 'event', weight: 1.5, is_active: true },
  { id: 'sig-3', title: 'Volta às Aulas Vestibular', region: 'UNOESTE', latitude: -22.1192, longitude: -51.4428, signal_type: 'academic', weight: 1.8, is_active: true },
  { id: 'sig-4', title: 'Happy Hour de Sexta', region: 'Parque do Povo', latitude: -22.1264, longitude: -51.4022, signal_type: 'leisure', weight: 1.3, is_active: false }
];

export const DemandProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, dbStatus } = useAuth();
  const [loadingDemand, setLoadingDemand] = useState<boolean>(true);

  // Core FASE 5.0 states
  const [demandSignals, setDemandSignals] = useState<DemandSignal[]>([]);
  const [heatmapZones, setHeatmapZones] = useState<HeatmapRegionMetrics[]>([]);
  const [peakRules, setPeakRules] = useState<AdminPeakRule[]>([]);

  // Local Storage Backups
  const loadLocalDemandData = () => {
    const cachedSignals = localStorage.getItem(`${STORAGE_PREFIX}demand_signals`);
    const cachedHotspots = localStorage.getItem(`${STORAGE_PREFIX}heatmap_zones`);
    const cachedPeaks = localStorage.getItem(`${STORAGE_PREFIX}peaks`);

    setDemandSignals(cachedSignals ? JSON.parse(cachedSignals) : INITIAL_DEMAND_SIGNALS);
    setHeatmapZones(cachedHotspots ? JSON.parse(cachedHotspots) : INITIAL_HEATMAP_ZONES);
    setPeakRules(cachedPeaks ? JSON.parse(cachedPeaks) : []);
  };

  // Sync / Load Initial Data
  const refetchDemand = async () => {
    setLoadingDemand(true);
    try {
      // 1. Fetch Heatmap Zones Local Settings
      const localHotmaps = localStorage.getItem(`${STORAGE_PREFIX}heatmap_zones`);
      const currentHotmaps = localHotmaps ? JSON.parse(localHotmaps) : INITIAL_HEATMAP_ZONES;
      setHeatmapZones(currentHotmaps);

      // 2. Fetch Peak Rules from local/remote Cache
      const cachedPeaks = localStorage.getItem(`${STORAGE_PREFIX}peaks`);
      if (cachedPeaks) {
        setPeakRules(JSON.parse(cachedPeaks));
      }

      // 3. Fetch Demand Signals
      let fetchedSignals: DemandSignal[] = [];
      if (dbStatus === 'connected') {
        const { data, error } = await supabase
          .from('demand_signals')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) throw error;
        if (data && data.length > 0) {
          fetchedSignals = data.map(d => ({
            id: d.id,
            title: d.title,
            region: d.region,
            latitude: Number(d.latitude),
            longitude: Number(d.longitude),
            signal_type: d.signal_type,
            weight: Number(d.weight),
            start_at: d.start_at,
            end_at: d.end_at,
            is_active: d.is_active
          }));
        } else {
          // Fallback to local
          const localSignals = localStorage.getItem(`${STORAGE_PREFIX}demand_signals`);
          fetchedSignals = localSignals ? JSON.parse(localSignals) : INITIAL_DEMAND_SIGNALS;
        }
      } else {
        const localSignals = localStorage.getItem(`${STORAGE_PREFIX}demand_signals`);
        fetchedSignals = localSignals ? JSON.parse(localSignals) : INITIAL_DEMAND_SIGNALS;
      }

      // Filter standard signals to exclude any old cached roxou items to avoid leftovers
      let cleanStandard = fetchedSignals.filter(s => !s.id.startsWith('roxou-'));

      // Check if Roxou Integration Mock mode is active, then merge its real-time mock signals
      const roxouConfig = roxouIntegrationService.getIntegrationConfig();
      if (roxouConfig.enabled && roxouConfig.mode === 'mock') {
        const roxouResult = roxouIntegrationService.previewRoxouSignals();
        cleanStandard = [...cleanStandard, ...roxouResult.signals];
      }

      setDemandSignals(cleanStandard);
      
      // Save standard base offline backups safely (excluding volatile roxou signals)
      localStorage.setItem(
        `${STORAGE_PREFIX}demand_signals`,
        JSON.stringify(cleanStandard.filter(s => !s.id.startsWith('roxou-')))
      );

    } catch (e) {
      console.warn('Demand modules sync error, leveraging cache:', e);
      loadLocalDemandData();
    } finally {
      setLoadingDemand(false);
    }
  };

  useEffect(() => {
    refetchDemand();

    // Auto-refresh dynamic indexes every 60 seconds
    const interval = setInterval(refetchDemand, 60000);
    return () => clearInterval(interval);
  }, [user, dbStatus]);

  // Reactive Demand Statuses Calculation
  const demandStatus = useMemo<RoxouDemandStatus[]>(() => {
    if (heatmapZones.length === 0) return [];
    
    return heatmapZones.map(zone => {
      const { score, surgeMultiplier } = calculateDemandScoreForZone(zone, demandSignals, peakRules);
      const level = scoreToDemandLevel(score);
      const rec = getDemandRecommendationText(level);
      const earnings = calculateHourlyEarningsEstimate(score, surgeMultiplier);

      return {
        region: zone.regionName,
        latitude: zone.latitude,
        longitude: zone.longitude,
        demandIndex: score,
        level,
        hourlyEarningsEstimate: earnings,
        surgeMultiplier,
        recommendation: rec
      };
    }).sort((a, b) => b.demandIndex - a.demandIndex); // Sorted high to low demand
  }, [heatmapZones, demandSignals, peakRules]);

  const globalDemandScore = useMemo(() => {
    if (demandStatus.length === 0) return 0;
    const total = demandStatus.reduce((sum, d) => sum + d.demandIndex, 0);
    return Math.round(total / demandStatus.length);
  }, [demandStatus]);

  // Actions: Add Demand Signal
  const addDemandSignal = async (signal: Omit<DemandSignal, 'id' | 'is_active'>) => {
    const item: Omit<DemandSignal, 'id'> = {
      ...signal,
      is_active: true
    };

    if (dbStatus === 'connected') {
      try {
        const { data, error } = await supabase
          .from('demand_signals')
          .insert([item])
          .select()
          .single();

        if (error) throw error;
        if (data) {
          const formatted: DemandSignal = {
            id: data.id,
            title: data.title,
            region: data.region,
            latitude: Number(data.latitude),
            longitude: Number(data.longitude),
            signal_type: data.signal_type,
            weight: Number(data.weight),
            start_at: data.start_at,
            end_at: data.end_at,
            is_active: data.is_active
          };
          const updated = [formatted, ...demandSignals];
          setDemandSignals(updated);
          localStorage.setItem(`${STORAGE_PREFIX}demand_signals`, JSON.stringify(updated));
          return;
        }
      } catch (err) {
        console.error('Supabase error addition signal, saving locally:', err);
      }
    }

    const localItem: DemandSignal = {
      ...item,
      id: 'lcl-sig-' + Math.random().toString(36).substring(2, 9)
    };
    const updated = [localItem, ...demandSignals];
    setDemandSignals(updated);
    localStorage.setItem(`${STORAGE_PREFIX}demand_signals`, JSON.stringify(updated));
  };

  // Actions: Delete Demand Signal
  const deleteDemandSignal = async (id: string) => {
    if (dbStatus === 'connected' && !id.startsWith('lcl-') && !id.startsWith('roxou-')) {
      try {
        const { error } = await supabase
          .from('demand_signals')
          .delete()
          .eq('id', id);

        if (error) throw error;
      } catch (err) {
        console.error('Supabase delete error:', err);
      }
    }

    const updated = demandSignals.filter(s => s.id !== id);
    setDemandSignals(updated);
    localStorage.setItem(`${STORAGE_PREFIX}demand_signals`, JSON.stringify(updated.filter(s => !s.id.startsWith('roxou-'))));
  };

  // Actions: Toggle Active Status for Demand Signal
  const toggleDemandSignal = async (id: string) => {
    const current = demandSignals.find(s => s.id === id);
    if (!current) return;
    const nextVal = !current.is_active;

    if (dbStatus === 'connected' && !id.startsWith('lcl-') && !id.startsWith('roxou-')) {
      try {
        const { error } = await supabase
          .from('demand_signals')
          .update({ is_active: nextVal })
          .eq('id', id);

        if (error) throw error;
      } catch (err) {
        console.error('Supabase toggle error:', err);
      }
    }

    const updated = demandSignals.map(s => s.id === id ? { ...s, is_active: nextVal } : s);
    setDemandSignals(updated);
    localStorage.setItem(`${STORAGE_PREFIX}demand_signals`, JSON.stringify(updated.filter(s => !s.id.startsWith('roxou-'))));
  };

  // Actions: Configure Hotspots settings
  const updateHeatmapZone = async (id: string, passengerDensity: number, intensity: number) => {
    let rawStatus: HeatmapRegionMetrics['status'] = 'normal';
    if (intensity >= 0.85) rawStatus = 'extreme';
    else if (intensity >= 0.65) rawStatus = 'hot';
    else if (intensity >= 0.45) rawStatus = 'warm';
    else if (intensity >= 0.2) rawStatus = 'normal';
    else rawStatus = 'cold';

    // Calculate surge multiplier relative to density
    let fareMult = 1.0;
    if (passengerDensity >= 90) fareMult = 2.2;
    else if (passengerDensity >= 70) fareMult = 1.8;
    else if (passengerDensity >= 50) fareMult = 1.4;
    else if (passengerDensity >= 25) fareMult = 1.15;

    const updated = heatmapZones.map(h => {
      if (h.id === id) {
        return {
          ...h,
          passengerDensity,
          intensity,
          status: rawStatus,
          averageFareMultiplier: fareMult
        };
      }
      return h;
    });

    setHeatmapZones(updated);
    localStorage.setItem(`${STORAGE_PREFIX}heatmap_zones`, JSON.stringify(updated));
  };

  return (
    <DemandContext.Provider
      value={{
        demandStatus,
        loadingDemand,
        refetchDemand,
        globalDemandScore,
        demandSignals,
        heatmapZones,
        addDemandSignal,
        deleteDemandSignal,
        toggleDemandSignal,
        updateHeatmapZone
      }}
    >
      {children}
    </DemandContext.Provider>
  );
};

export const useDemand = () => {
  const context = useContext(DemandContext);
  if (context === undefined) {
    throw new Error('useDemand must be used inside a DemandProvider');
  }
  return context;
};

