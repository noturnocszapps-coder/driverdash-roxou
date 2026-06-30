import { useState, useEffect, useCallback, useMemo } from 'react';
import { UberPassSettings } from '../../../types';
import { uberPassService } from '../uberpass.service';
import { STORAGE_PREFIX } from '../../shared/constants';
import { isDbConnected } from '../../shared/supabase.helpers';

export interface UberPassModalityConfig {
  pass_type: string;
  pass_price: number;
  earnings_limit: number;
  old_fee_percent: number;
  target_profit_per_hour: number;
  target_daily_revenue: number;
  planned_hours: number;
  average_ticket: number;
  estimated_km: number;
}

export const DEFAULT_MODALITIES_CONFIGS: Record<string, UberPassModalityConfig> = {
  '24 horas': {
    pass_type: '24 horas',
    pass_price: 15,
    earnings_limit: 250,
    old_fee_percent: 20,
    target_profit_per_hour: 30,
    target_daily_revenue: 250,
    planned_hours: 8,
    average_ticket: 15,
    estimated_km: 150,
  },
  '72 horas': {
    pass_type: '72 horas',
    pass_price: 38,
    earnings_limit: 600,
    old_fee_percent: 20,
    target_profit_per_hour: 35,
    target_daily_revenue: 300,
    planned_hours: 10,
    average_ticket: 18,
    estimated_km: 180,
  },
  'Por ganhos': {
    pass_type: 'Por ganhos',
    pass_type_capitalized: 'Por Ganhos',
    pass_price: 80,
    earnings_limit: 1400,
    old_fee_percent: 20,
    target_profit_per_hour: 40,
    target_daily_revenue: 400,
    planned_hours: 12,
    average_ticket: 20,
    estimated_km: 200,
  } as any,
};

export function useUberPassSettings(userId: string | undefined, activeVehicleConfig?: any) {
  const [activeType, setActiveType] = useState<string>('24 horas');
  const [configs, setConfigs] = useState<Record<string, UberPassModalityConfig>>(DEFAULT_MODALITIES_CONFIGS);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);

  // Storage key helpers
  const getLocalStorageKey = useCallback((type: string) => {
    return `${STORAGE_PREFIX}uberpass_${userId}_${type.replace(/\s+/g, '_')}`;
  }, [userId]);

  const activeConfigKey = useMemo(() => `${STORAGE_PREFIX}uberpass_active_type_${userId}`, [userId]);

  // Load configuration from local storage & DB
  useEffect(() => {
    if (!userId) return;

    const loadSettings = async () => {
      try {
        setLoading(true);

        // 1. Load active pass type selection from LocalStorage
        const savedActiveType = localStorage.getItem(activeConfigKey);
        const initialActiveType = savedActiveType || '24 horas';
        setActiveType(initialActiveType);

        // 2. Load modalities from LocalStorage (fast-responsive fallback)
        const localConfigs = { ...DEFAULT_MODALITIES_CONFIGS };
        ['24 horas', '72 horas', 'Por ganhos'].forEach((type) => {
          const stored = localStorage.getItem(getLocalStorageKey(type));
          if (stored) {
            try {
              localConfigs[type] = {
                ...DEFAULT_MODALITIES_CONFIGS[type],
                ...JSON.parse(stored),
              };
            } catch (e) {
              console.warn('Error parsing local config for', type, e);
            }
          }
        });
        setConfigs(localConfigs);

        // 3. Load from remote DB
        if (isDbConnected()) {
          const remoteSettings = await uberPassService.fetchUberPassSettings(userId);
          if (remoteSettings) {
            console.log('[UberPass] Parâmetros carregados do banco de dados remoto:', remoteSettings);
            
            let updatedConfigs = { ...localConfigs };

            // If the DB has independent configs nested inside detailed_vehicle_config
            if (remoteSettings.detailed_vehicle_config?.all_pass_configs) {
              updatedConfigs = {
                ...updatedConfigs,
                ...remoteSettings.detailed_vehicle_config.all_pass_configs,
              };
            } else {
              // Populate loaded single settings into whichever pass type is saved as active
              const dbType = remoteSettings.pass_type || initialActiveType;
              updatedConfigs[dbType] = {
                ...updatedConfigs[dbType],
                pass_price: Number(remoteSettings.pass_price) || updatedConfigs[dbType].pass_price,
                earnings_limit: Number(remoteSettings.earnings_limit) || updatedConfigs[dbType].earnings_limit,
                old_fee_percent: Number(remoteSettings.old_fee_percent) || updatedConfigs[dbType].old_fee_percent,
                target_profit_per_hour: Number(remoteSettings.target_profit_per_hour) || updatedConfigs[dbType].target_profit_per_hour,
                target_daily_revenue: Number(remoteSettings.target_daily_revenue) || updatedConfigs[dbType].target_daily_revenue,
                planned_hours: Number(remoteSettings.planned_hours) || updatedConfigs[dbType].planned_hours,
                average_ticket: Number(remoteSettings.average_ticket) || updatedConfigs[dbType].average_ticket,
                estimated_km: Number(remoteSettings.estimated_km) || updatedConfigs[dbType].estimated_km,
              };
            }

            setConfigs(updatedConfigs);

            // Save back to LocalStorage to sync
            Object.keys(updatedConfigs).forEach((type) => {
              localStorage.setItem(getLocalStorageKey(type), JSON.stringify(updatedConfigs[type]));
            });

            if (remoteSettings.pass_type && ['24 horas', '72 horas', 'Por ganhos'].includes(remoteSettings.pass_type)) {
              setActiveType(remoteSettings.pass_type);
              localStorage.setItem(activeConfigKey, remoteSettings.pass_type);
            }
          }
        }
      } catch (err) {
        console.error('[UberPass] Erro ao carregar configurações do banco:', err);
      } finally {
        setLoading(false);
      }
    };

    loadSettings();
  }, [userId, getLocalStorageKey, activeConfigKey]);

  // Save all states to DB (and active config)
  const saveToDatabase = useCallback(async (
    targetActiveType: string,
    currentConfigs: Record<string, UberPassModalityConfig>
  ) => {
    if (!userId) return;
    if (!isDbConnected()) {
      console.log('[UberPass] Banco de dados não conectado. Ignorando sincronização remota.');
      return;
    }
    setSaving(true);
    try {
      const activeData = currentConfigs[targetActiveType];
      
      const payload: Omit<UberPassSettings, 'id' | 'created_at' | 'updated_at'> = {
        user_id: userId,
        pass_type: targetActiveType,
        pass_price: activeData.pass_price,
        earnings_limit: targetActiveType === 'Por ganhos' ? activeData.earnings_limit : undefined,
        old_fee_percent: activeData.old_fee_percent,
        target_profit_per_hour: activeData.target_profit_per_hour,
        target_daily_revenue: activeData.target_daily_revenue,
        planned_hours: activeData.planned_hours,
        average_ticket: activeData.average_ticket,
        cost_per_km: 0, // derived dynamically
        estimated_km: activeData.estimated_km,
        detailed_vehicle_config: {
          ...(activeVehicleConfig || {}),
          all_pass_configs: currentConfigs,
        },
      };

      await uberPassService.upsertUberPassSettings(payload);
      console.log(`[UberPass] Sincronizado com sucesso! Tipo: ${targetActiveType}, Preço: R$${activeData.pass_price}`);
    } catch (err) {
      console.error('[UberPass] Falha ao salvar no banco:', err);
    } finally {
      setSaving(false);
    }
  }, [userId, activeVehicleConfig]);

  // Switch pass type dynamically
  const changePassType = useCallback((newType: string) => {
    if (!['24 horas', '72 horas', 'Por ganhos'].includes(newType)) return;
    
    console.log(`[UberPass] Tipo alterado: ${activeType} ➔ ${newType}`);
    
    setActiveType(newType);
    localStorage.setItem(activeConfigKey, newType);

    const loadedConfig = configs[newType];
    console.log('[UberPass] Parâmetros carregados:', loadedConfig);
    
    // Auto-save active selection immediately
    saveToDatabase(newType, configs);
  }, [activeType, configs, activeConfigKey, saveToDatabase]);

  // Update a field for a specific pass type
  const updateField = useCallback((
    type: string,
    field: keyof UberPassModalityConfig,
    value: number | string
  ) => {
    setConfigs((prev) => {
      const updatedConfig = {
        ...prev[type],
        [field]: value,
      };
      
      const nextConfigs = {
        ...prev,
        [type]: updatedConfig,
      };

      // Sync to LocalStorage immediately
      localStorage.setItem(getLocalStorageKey(type), JSON.stringify(updatedConfig));

      // Asynchronously sync to database
      saveToDatabase(type === activeType ? activeType : type, nextConfigs);

      return nextConfigs;
    });
  }, [activeType, getLocalStorageKey, saveToDatabase]);

  const activeConfig = useMemo(() => {
    return configs[activeType] || DEFAULT_MODALITIES_CONFIGS[activeType];
  }, [configs, activeType]);

  return {
    activeType,
    configs,
    activeConfig,
    loading,
    saving,
    changePassType,
    updateField,
    saveAll: () => saveToDatabase(activeType, configs),
  };
}
