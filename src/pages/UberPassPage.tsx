import React, { useState, useEffect, useMemo } from 'react';
import { 
  Ticket, DollarSign, Calculator, Percent, Sparkles, TrendingUp, AlertTriangle, Save, CheckCircle2, HelpCircle, 
  Milestone, Clock, Activity, Coins, ShieldCheck, Car, Settings, FileText, ArrowRight, Info, Zap, RefreshCw, BarChart2, PieChart as PieIcon, Compass
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useApp } from '../context/AppContext';
import { uberPassService } from '../modules/uberpass/uberpass.service';
import { 
  DetailedVehicleConfig, 
  DEFAULT_DETAILED_CONFIG,
  CostFrequency
} from '../modules/uberpass/vehicleCost.calculations';

// Reusable Components
import { MetricCard } from '../modules/uberpass/components/MetricCard';
import { ProgressInsight } from '../modules/uberpass/components/ProgressInsight';
import { VehicleCostWizard } from '../modules/uberpass/components/VehicleCostWizard';
import { FinancialComparisonChart } from '../modules/uberpass/components/FinancialComparisonChart';
import { CostBreakdownChart } from '../modules/uberpass/components/CostBreakdownChart';
import { DiagnosticBanner } from '../modules/uberpass/components/DiagnosticBanner';
import { CurrencyInput } from '../modules/uberpass/components/CurrencyInput';
import { PercentageInput } from '../modules/uberpass/components/PercentageInput';

// Custom Hooks
import { useVehicleCostCalculator } from '../modules/uberpass/hooks/useVehicleCostCalculator';
import { useUberPassSimulation } from '../modules/uberpass/hooks/useUberPassSimulation';
import { useFinancialDiagnosis } from '../modules/uberpass/hooks/useFinancialDiagnosis';

import { DEFAULT_MODALITIES_CONFIGS } from '../modules/uberpass/hooks/useUberPassSettings';

export const UberPassPage: React.FC = () => {
  const { 
    user, 
    vehicle,
    uberPassSettings,
    uberPassActiveType,
    uberPassConfigs,
    changeUberPassType,
    updateUberPassField,
    saveUberPassSettings,
    dbStatus
  } = useApp();

  // Active configuration section/tab ('dashboard' | 'pass' | 'vehicle_form' | 'vehicle_wizard')
  const [activeTab, setActiveTab] = useState<'dashboard' | 'pass' | 'vehicle_form' | 'vehicle_wizard'>('dashboard');

  // Map settings dynamically from AppContext
  const passType = uberPassActiveType;
  const activeConfig = uberPassConfigs[uberPassActiveType] || DEFAULT_MODALITIES_CONFIGS[uberPassActiveType];

  const passPrice = activeConfig.pass_price;
  const earningsLimit = activeConfig.earnings_limit || 200;
  const oldFeePercent = activeConfig.old_fee_percent;
  const targetProfitPerHour = activeConfig.target_profit_per_hour;
  const targetDailyRevenue = activeConfig.target_daily_revenue;
  const plannedHours = activeConfig.planned_hours;
  const averageTicket = activeConfig.average_ticket;
  const estimatedKm = activeConfig.estimated_km;

  // Detailed Vehicle Cost State
  const [vehicleConfig, setVehicleConfig] = useState<DetailedVehicleConfig>(DEFAULT_DETAILED_CONFIG);

  // Real-time interactive faturamento slider
  const [estimatedRevenue, setEstimatedRevenue] = useState<number>(300);

  // Feedback states
  const [loading, setLoading] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Update local slider whenever targetDailyRevenue changes
  useEffect(() => {
    setEstimatedRevenue(targetDailyRevenue);
  }, [targetDailyRevenue, passType]);

  // Load from database on startup for detailed vehicle config
  useEffect(() => {
    if (!user) return;

    const fetchVehicleConfig = async () => {
      // Fast responsive local storage loading
      const localSaved = localStorage.getItem(`uberpass_detailed_vehicle_config_${user.id}`);
      if (localSaved) {
        try {
          const parsed = JSON.parse(localSaved);
          setVehicleConfig({
            ...DEFAULT_DETAILED_CONFIG,
            ...parsed,
            ownership_type: parsed.ownership_type || vehicle?.ownership_type || 'own'
          });
          if (dbStatus !== 'connected') return;
        } catch (e) {
          console.warn('Error parsing local vehicle config:', e);
        }
      }

      if (dbStatus !== 'connected') {
        if (!localSaved) {
          setVehicleConfig({
            ...DEFAULT_DETAILED_CONFIG,
            ownership_type: vehicle?.ownership_type || 'own'
          });
        }
        return;
      }

      try {
        const settings = await uberPassService.fetchUberPassSettings(user.id);
        if (settings) {
          if (settings.detailed_vehicle_config && typeof settings.detailed_vehicle_config === 'object') {
            const remoteConfig = settings.detailed_vehicle_config;
            setVehicleConfig({
              ...DEFAULT_DETAILED_CONFIG,
              ...remoteConfig,
              ownership_type: (remoteConfig as any).ownership_type || vehicle?.ownership_type || 'own'
            });
            localStorage.setItem(`uberpass_detailed_vehicle_config_${user.id}`, JSON.stringify(remoteConfig));
          } else if (!localSaved) {
            setVehicleConfig({
              ...DEFAULT_DETAILED_CONFIG,
              ownership_type: vehicle?.ownership_type || 'own'
            });
          }
        } else if (!localSaved) {
          setVehicleConfig({
            ...DEFAULT_DETAILED_CONFIG,
            ownership_type: vehicle?.ownership_type || 'own'
          });
        }
      } catch (err) {
        console.error('Erro ao buscar configurações:', err);
      }
    };

    fetchVehicleConfig();
  }, [user, vehicle, dbStatus]);

  // Save Settings to database
  const handleSaveSettings = async (customConfig?: DetailedVehicleConfig) => {
    if (!user) return;
    setSaving(true);
    setSuccessMsg(null);
    setErrorMsg(null);

    const configToSave = customConfig || vehicleConfig;

    try {
      // 1. Save global parameters
      await saveUberPassSettings();
      
      // 2. We can also save detailed_vehicle_config via our Service
      if (dbStatus === 'connected') {
        await uberPassService.upsertUberPassSettings({
          user_id: user.id,
          pass_type: passType,
          pass_price: passPrice,
          earnings_limit: passType === 'Por ganhos' ? earningsLimit : undefined,
          old_fee_percent: oldFeePercent,
          target_profit_per_hour: targetProfitPerHour,
          target_daily_revenue: targetDailyRevenue,
          planned_hours: plannedHours,
          average_ticket: averageTicket,
          cost_per_km: 0,
          estimated_km: estimatedKm,
          detailed_vehicle_config: {
            ...configToSave,
            all_pass_configs: uberPassConfigs
          },
        });
      } else {
        localStorage.setItem(`uberpass_detailed_vehicle_config_${user.id}`, JSON.stringify(configToSave));
      }

      setSuccessMsg('Configurações e Inteligência de Custos salvas com sucesso!');
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err) {
      console.error('Erro ao salvar:', err);
      setErrorMsg('Não foi possível sincronizar suas configurações.');
    } finally {
      setSaving(false);
    }
  };

  // Dynamic cost calculation via hook
  const costBreakdown = useVehicleCostCalculator(vehicleConfig, estimatedKm);

  // Simulation parameters via hook
  const simulation = useUberPassSimulation({
    passPrice,
    oldFeePercent,
    estimatedRevenue,
    averageTicket,
    costPerKm: costBreakdown.totalPerKm,
    estimatedKm,
    plannedHours,
    targetProfitPerHour
  });

  // Diagnostic state via hook
  const diagnosis = useFinancialDiagnosis({
    estimatedRevenue,
    breakEvenRevenue: simulation.breakEvenRevenue,
    netProfitPerHour: simulation.netProfitPerHour,
    targetProfitPerHour,
    estimatedSavings: simulation.estimatedSavings
  });

  // Format helper
  const formatBRL = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  // Helper for updating fields directly in standard form
  const updateConfigField = <K extends keyof DetailedVehicleConfig>(key: K, value: DetailedVehicleConfig[K]) => {
    setVehicleConfig(prev => ({
      ...prev,
      [key]: value
    }));
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-16 font-sans select-none" id="uber-pass-intelligence-container">
      
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-purple-950/20 pb-6">
        <div>
          <span className="text-[11px] font-bold tracking-widest text-purple-400 font-display uppercase block mb-1">
            Uber Pass Intelligence
          </span>
          <h1 className="text-[30px] md:text-[34px] lg:text-[40px] font-extrabold text-white tracking-tight font-display leading-tight">
            Uber Pass <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-indigo-300">Intelligence</span>
          </h1>
          <p className="text-slate-400 text-sm md:text-base leading-relaxed mt-2 max-w-3xl">
            Simulador de alta precisão que calcula o custo real do seu veículo por km e analisa a viabilidade matemática de ativar o Passe de Ganhos da Uber.
          </p>
        </div>

        <button
          onClick={() => handleSaveSettings()}
          disabled={saving || loading}
          className="px-6 py-3.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:from-purple-950/40 text-white font-semibold text-[15px] flex items-center justify-center gap-2.5 transition-all duration-200 shadow-[0_4px_20px_rgba(124,58,237,0.25)] hover:shadow-[0_4px_25px_rgba(124,58,237,0.4)] active:scale-95 cursor-pointer"
        >
          {saving ? (
            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <Save className="w-4.5 h-4.5" />
          )}
          Salvar Configurações
        </button>
      </div>

      {/* Messages banner */}
      <AnimatePresence>
        {successMsg && (
          <motion.div 
            initial={{ opacity: 0, height: 0, y: -20 }}
            animate={{ opacity: 1, height: 'auto', y: 0 }}
            exit={{ opacity: 0, height: 0, y: -20 }}
            className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-950/20 text-emerald-300 text-sm font-medium flex items-center gap-3 overflow-hidden"
          >
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            {successMsg}
          </motion.div>
        )}
        {errorMsg && (
          <motion.div 
            initial={{ opacity: 0, height: 0, y: -20 }}
            animate={{ opacity: 1, height: 'auto', y: 0 }}
            exit={{ opacity: 0, height: 0, y: -20 }}
            className="p-4 rounded-xl border border-rose-500/30 bg-rose-950/20 text-rose-300 text-sm font-medium flex items-center gap-3 overflow-hidden"
          >
            <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
            {errorMsg}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Diagnostic Alert Banner */}
      <DiagnosticBanner 
        status={diagnosis.status}
        label={diagnosis.label}
        description={diagnosis.description}
        backgroundColor={diagnosis.backgroundColor}
        borderColor={diagnosis.borderColor}
        textColor={diagnosis.textColor}
        dotColor={diagnosis.dotColor}
        breakEvenRevenue={simulation.breakEvenRevenue}
        estimatedRevenue={estimatedRevenue}
        estimatedSavings={simulation.estimatedSavings}
        monthlySavings={simulation.monthlySavings}
        annualSavings={simulation.annualSavings}
      />

      {/* Navigation Tabs - Stripe Styled */}
      <div className="flex border-b border-purple-950/20 gap-1 select-none overflow-x-auto whitespace-nowrap">
        {[
          { id: 'dashboard', label: 'Dashboard Financeiro', icon: BarChart2 },
          { id: 'pass', label: 'Parâmetros do Passe', icon: Ticket },
          { id: 'vehicle_wizard', label: 'Assistente do Veículo', icon: Compass },
          { id: 'vehicle_form', label: 'Custo do Veículo (Manual)', icon: Car }
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 py-3 px-5 text-sm font-medium border-b-2 transition-all relative cursor-pointer ${
                isActive 
                  ? 'border-purple-500 text-purple-300 font-semibold' 
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-purple-400' : 'text-slate-400'}`} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Main Content Areas */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Side: Forms (Pass Settings or Manual Vehicle Form) */}
        <div className={`lg:col-span-5 ${activeTab === 'dashboard' ? 'hidden lg:block' : 'block'}`}>
          
          {/* TAB: VEHICLE WIZARD (Intelligent Assistant) */}
          {activeTab === 'vehicle_wizard' && (
            <VehicleCostWizard 
              initialConfig={vehicleConfig}
              estimatedKm={estimatedKm}
              onSave={(newConfig) => {
                setVehicleConfig(newConfig);
                handleSaveSettings(newConfig);
                setActiveTab('dashboard');
              }}
              onClose={() => setActiveTab('dashboard')}
            />
          )}

          {/* TAB: UBER PASS PARAMETERS */}
          {activeTab === 'pass' && (
            <div className="bg-[#0b0821]/80 border border-purple-950/30 rounded-2xl p-6 md:p-8 space-y-6 shadow-xl backdrop-blur-md">
              <div className="flex items-center gap-3 border-b border-purple-950/20 pb-4">
                <div className="p-2 bg-purple-950/40 rounded-xl border border-purple-900/30">
                  <Ticket className="w-5 h-5 text-purple-400" />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-white font-display">Parâmetros do Passe Uber</h3>
                  <p className="text-xs text-slate-400 font-sans">Ajuste os valores contratados no seu app Uber.</p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-slate-300 font-semibold text-xs mb-1.5">Tipo de Passe *</label>
                  <div className="grid grid-cols-3 gap-2">
                    {['24 horas', '72 horas', 'Por ganhos'].map((type) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => changeUberPassType(type)}
                        className={`py-2.5 px-1.5 rounded-xl text-xs font-bold border transition-all text-center cursor-pointer ${
                          passType === type 
                            ? 'bg-purple-900/40 border-purple-500 text-purple-200 shadow-lg scale-[1.02]' 
                            : 'bg-[#04010a]/50 border-purple-950/40 text-slate-400 hover:border-purple-900/30'
                        }`}
                      >
                        {type === 'Por ganhos' ? 'Por Ganhos' : type === '24 horas' ? '24 Horas' : '72 Horas'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Intelligent Interface & Live Specs Card based on Selected Pass Type (ETAPA 4) */}
                <AnimatePresence mode="wait">
                  <motion.div
                    key={passType}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                    className="p-5 rounded-2xl bg-gradient-to-r from-purple-950/20 to-indigo-950/10 border border-purple-500/10 space-y-3.5"
                  >
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-bold font-mono tracking-wider text-purple-400 uppercase">
                        Especificações Ativas do Passe
                      </span>
                      <span className="text-[10px] bg-purple-950/80 text-purple-200 px-2.5 py-1 rounded-full font-bold font-mono uppercase tracking-wider">
                        Validade: {passType === '24 horas' ? '24 Horas' : passType === '72 horas' ? '72 Horas' : 'Até Limite'}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-1">
                      {passType === '24 horas' && (
                        <>
                          <div className="bg-[#04010a]/40 p-3 rounded-xl border border-purple-950/30">
                            <span className="text-[9px] text-slate-500 font-mono block">LUCRO DIÁRIO PROJETADO</span>
                            <span className="text-sm font-bold text-emerald-400 font-mono">{formatBRL(simulation.estimatedNetProfit)}</span>
                          </div>
                          <div className="bg-[#04010a]/40 p-3 rounded-xl border border-purple-950/30">
                            <span className="text-[9px] text-slate-500 font-mono block">CUSTO DO PASSE (DIA)</span>
                            <span className="text-sm font-bold text-purple-300 font-mono">{formatBRL(passPrice)}</span>
                          </div>
                          <div className="bg-[#04010a]/40 p-3 rounded-xl border border-purple-950/30 col-span-2 sm:col-span-1">
                            <span className="text-[9px] text-slate-500 font-mono block">CUSTO POR HORA</span>
                            <span className="text-sm font-bold text-slate-300 font-mono">{formatBRL(simulation.totalDayCost / (plannedHours || 1))}/h</span>
                          </div>
                        </>
                      )}

                      {passType === '72 horas' && (
                        <>
                          <div className="bg-[#04010a]/40 p-3 rounded-xl border border-purple-950/30">
                            <span className="text-[9px] text-slate-500 font-mono block">LUCRO ESPERADO (3 DIAS)</span>
                            <span className="text-sm font-bold text-emerald-400 font-mono">{formatBRL(simulation.estimatedNetProfit * 3)}</span>
                          </div>
                          <div className="bg-[#04010a]/40 p-3 rounded-xl border border-purple-950/30">
                            <span className="text-[9px] text-slate-500 font-mono block">META ACUMULADA (3 DIAS)</span>
                            <span className="text-sm font-bold text-purple-300 font-mono">{formatBRL(targetDailyRevenue * 3)}</span>
                          </div>
                          <div className="bg-[#04010a]/40 p-3 rounded-xl border border-purple-950/30 col-span-2 sm:col-span-1">
                            <span className="text-[9px] text-slate-500 font-mono block">PROJEÇÃO SEMANAL</span>
                            <span className="text-sm font-bold text-slate-300 font-mono">{formatBRL(simulation.monthlyRevenue / 4)}</span>
                          </div>
                        </>
                      )}

                      {passType === 'Por ganhos' && (
                        <>
                          <div className="bg-[#04010a]/40 p-3 rounded-xl border border-purple-950/30">
                            <span className="text-[9px] text-slate-500 font-mono block">LIMITE DE CONTRATO</span>
                            <span className="text-sm font-bold text-purple-300 font-mono">{formatBRL(earningsLimit)}</span>
                          </div>
                          <div className="bg-[#04010a]/40 p-3 rounded-xl border border-purple-950/30">
                            <span className="text-[9px] text-slate-500 font-mono block">GANHOS RESTANTES</span>
                            <span className="text-sm font-bold text-emerald-400 font-mono">{formatBRL(Math.max(0, earningsLimit - estimatedRevenue))}</span>
                          </div>
                          <div className="bg-[#04010a]/40 p-3 rounded-xl border border-purple-950/30 col-span-2 sm:col-span-1">
                            <span className="text-[9px] text-slate-500 font-mono block">ECONOMIA PREVISTA (DIA)</span>
                            <span className="text-sm font-bold text-indigo-400 font-mono">{formatBRL(simulation.estimatedSavings)}</span>
                          </div>
                        </>
                      )}
                    </div>
                  </motion.div>
                </AnimatePresence>

                {/* Form Inputs with Independent Mapping (ETAPA 2, 4) */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <CurrencyInput 
                    label="Preço do Passe"
                    value={passPrice}
                    onChange={(v) => updateUberPassField(passType, 'pass_price', v)}
                  />

                  {passType === 'Por ganhos' ? (
                    <CurrencyInput 
                      label="Limite de Ganhos Contratado"
                      value={earningsLimit}
                      onChange={(v) => updateUberPassField(passType, 'earnings_limit', v)}
                    />
                  ) : (
                    <div className="p-4 bg-[#04010a]/30 border border-purple-950/20 rounded-xl flex items-center justify-between">
                      <div>
                        <span className="text-xs text-slate-400 block font-semibold">Sem limite de ganhos</span>
                        <span className="text-[10px] text-slate-500">Ilimitado até expirar o prazo</span>
                      </div>
                      <ShieldCheck className="w-5 h-5 text-purple-500/60" />
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-purple-950/10 pt-4">
                  <PercentageInput 
                    label="Taxa Uber Clássica"
                    value={oldFeePercent}
                    onChange={(v) => updateUberPassField(passType, 'old_fee_percent', v)}
                  />

                  <CurrencyInput 
                    label="Meta de Lucro / Hora"
                    value={targetProfitPerHour}
                    onChange={(v) => updateUberPassField(passType, 'target_profit_per_hour', v)}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <CurrencyInput 
                    label={passType === '72 horas' ? 'Meta Diária Média (R$)' : 'Meta Faturamento Diário'}
                    value={targetDailyRevenue}
                    onChange={(v) => updateUberPassField(passType, 'target_daily_revenue', v)}
                  />

                  <div className="space-y-1.5">
                    <label className="block text-slate-400 text-xs mb-1 font-display font-semibold uppercase tracking-wider">Horas Planejadas (Dia)</label>
                    <input 
                      type="number" 
                      value={plannedHours} 
                      onChange={(e) => updateUberPassField(passType, 'planned_hours', Number(e.target.value) || 0)}
                      className="w-full bg-[#04010a] border border-purple-950/40 rounded-xl py-3 px-4 text-sm text-slate-200 font-bold"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-purple-950/10 pt-4">
                  <CurrencyInput 
                    label="Ticket Médio Corrida"
                    value={averageTicket}
                    onChange={(v) => updateUberPassField(passType, 'average_ticket', v)}
                  />

                  <div className="space-y-1.5">
                    <label className="block text-slate-400 text-xs mb-1 font-display font-semibold uppercase tracking-wider">KM Rodado Estimado (Dia)</label>
                    <input 
                      type="number" 
                      value={estimatedKm} 
                      onChange={(e) => updateUberPassField(passType, 'estimated_km', Number(e.target.value) || 0)}
                      className="w-full bg-[#04010a] border border-purple-950/40 rounded-xl py-3 px-4 text-sm text-slate-200 font-bold"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB: MANUAL VEHICLE FORM */}
          {activeTab === 'vehicle_form' && (
            <div className="bg-[#0b0821]/80 border border-purple-950/30 rounded-2xl p-6 md:p-8 space-y-6 shadow-xl backdrop-blur-md">
              <div className="flex items-center justify-between border-b border-purple-950/20 pb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-purple-950/40 rounded-xl border border-purple-900/30">
                    <Car className="w-5 h-5 text-purple-400" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg text-white font-display">Custos de Veículo Manual</h3>
                    <p className="text-xs text-slate-400 font-sans">Ajustes diretos e avançados de despesas.</p>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="block text-slate-400 text-xs mb-1 font-display font-semibold uppercase tracking-wider">Categoria de Posse</label>
                  <select
                    value={vehicleConfig.ownership_type || 'own'}
                    onChange={(e) => updateConfigField('ownership_type', e.target.value as any)}
                    className="w-full bg-[#04010a] border border-purple-950/40 rounded-xl py-3 px-4 text-sm text-slate-200 font-bold cursor-pointer"
                  >
                    <option value="own">Veículo Próprio</option>
                    <option value="financed">Veículo Financiado</option>
                    <option value="rented">Veículo Alugado</option>
                  </select>
                </div>

                {vehicleConfig.ownership_type === 'rented' ? (
                  <>
                    <div className="p-4 rounded-xl bg-purple-950/20 border border-purple-900/30 text-purple-300 text-xs my-2">
                      <p className="font-semibold text-purple-400 mb-1">Custos Embutidos na Locação</p>
                      <p>Em veículo alugado, estes custos normalmente ficam embutidos no valor da locação.</p>
                    </div>

                    <div className="grid grid-cols-1 gap-4">
                      <CurrencyInput 
                        label="Aluguel do Veículo (Mensal)"
                        value={vehicleConfig.rentCost}
                        onChange={(v) => updateConfigField('rentCost', v)}
                      />
                    </div>
                  </>
                ) : (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <CurrencyInput 
                        label="Seguro (Mensal)"
                        value={vehicleConfig.insuranceCost}
                        onChange={(v) => updateConfigField('insuranceCost', v)}
                      />
                      <CurrencyInput 
                        label="IPVA (Anual)"
                        value={vehicleConfig.ipvaCost}
                        onChange={(v) => updateConfigField('ipvaCost', v)}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <CurrencyInput 
                        label="Licenciamento (Anual)"
                        value={vehicleConfig.licensingCost}
                        onChange={(v) => updateConfigField('licensingCost', v)}
                      />
                      {vehicleConfig.ownership_type === 'financed' ? (
                        <CurrencyInput 
                          label="Parcela Financiamento (Mensal)"
                          value={vehicleConfig.rentCost}
                          onChange={(v) => updateConfigField('rentCost', v)}
                        />
                      ) : (
                        <div />
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <CurrencyInput 
                        label="Manutenção (Anual Estim.)"
                        value={vehicleConfig.brakeCost}
                        onChange={(v) => updateConfigField('brakeCost', v)}
                      />
                      <div className="space-y-1.5">
                        <label className="block text-slate-400 text-xs mb-1 font-display font-semibold uppercase tracking-wider">Depreciação (R$/Km)</label>
                        <input 
                          type="number" 
                          step="0.01"
                          value={vehicleConfig.depreciationCost}
                          onChange={(e) => updateConfigField('depreciationCost', Number(e.target.value) || 0)}
                          className="w-full bg-[#04010a] border border-purple-950/40 rounded-xl py-3 px-4 text-sm text-slate-200 font-bold"
                        />
                      </div>
                    </div>
                  </>
                )}

                <div className="p-3 bg-purple-950/10 border border-purple-500/10 rounded-xl text-[11px] text-slate-400 italic">
                  Para uma configuração mais dinâmica e intuitiva incluindo consumo elétrico/híbrido e marcas, utilize a aba <strong>Assistente do Veículo</strong>.
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Right Side: The Premium Financial Dashboard & Intel Cards */}
        <div className={`lg:col-span-7 ${activeTab !== 'dashboard' ? 'hidden lg:block' : 'col-span-1 lg:col-span-12'}`}>
          
          <div className="space-y-6">
            
            {/* Real-time Interactive Simulator Slider - Stripe Styled */}
            <div className="bg-[#0b0821]/80 border border-purple-950/30 rounded-2xl p-6 shadow-xl backdrop-blur-md flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-purple-400 font-display">
                  <Activity className="w-4 h-4 text-purple-400" />
                  <span className="text-xs font-bold uppercase tracking-wider">Simulador de Faturamento Ativo</span>
                </div>
                <h4 className="text-base font-bold text-white leading-snug">
                  Quanto você pretende faturar hoje?
                </h4>
                <p className="text-xs text-slate-400">Arraste a barra para recalcular os resultados em tempo real.</p>
              </div>

              <div className="flex-1 max-w-md space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[15px] font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-indigo-300 font-mono tracking-tight select-all">
                    {formatBRL(estimatedRevenue)}
                  </span>
                  <span className="text-[11px] font-semibold text-purple-400 bg-purple-950/30 border border-purple-900/30 rounded-full px-2 py-0.5">
                    Faturamento Diário
                  </span>
                </div>
                
                <input 
                  type="range" 
                  min="50" 
                  max="1200" 
                  step="10"
                  value={estimatedRevenue} 
                  onChange={(e) => setEstimatedRevenue(Number(e.target.value) || 0)}
                  className="w-full h-1.5 bg-purple-950/50 rounded-lg appearance-none cursor-pointer accent-purple-500"
                />

                <div className="relative">
                  <span className="absolute inset-y-0 left-3 flex items-center text-slate-500 text-xs">R$</span>
                  <input 
                    type="number" 
                    value={estimatedRevenue} 
                    onChange={(e) => setEstimatedRevenue(Number(e.target.value) || 0)}
                    className="w-full bg-[#04010a] border border-purple-950/40 rounded-xl py-2 pl-8 pr-4 text-xs font-semibold text-slate-200"
                  />
                </div>
              </div>
            </div>

            {/* Dashboard Visual Metric Cards (10 requested metrics) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              
              {/* 1. Custo Real por Km */}
              <MetricCard 
                title="Custo Real por Km"
                value={formatBRL(costBreakdown.totalPerKm)}
                subtitle="Custo total de posse amortizado"
                icon={<Car className="w-5 h-5 text-purple-400" />}
                tooltip="Soma proporcional de todas as despesas por cada km rodado."
              />

              {/* 2. Lucro Líquido por Hora */}
              <MetricCard 
                title="Lucro Líq. por Hora"
                value={formatBRL(simulation.netProfitPerHour)}
                subtitle={`Meta pessoal: ${formatBRL(targetProfitPerHour)}/h`}
                icon={<Clock className="w-5 h-5 text-indigo-400" />}
                trend={{
                  value: `${simulation.netProfitPerHour >= targetProfitPerHour ? 'Dentro da meta' : 'Abaixo da meta'}`,
                  isPositive: simulation.netProfitPerHour >= targetProfitPerHour
                }}
                tooltip="Seu lucro líquido (faturamento menos custos) dividido pelas horas trabalhadas estimadas."
              />

              {/* 3. Lucro Líquido por Km */}
              <MetricCard 
                title="Lucro Líq. por Km"
                value={formatBRL(simulation.netProfitPerKm)}
                subtitle="Retorno limpo por distância"
                icon={<Milestone className="w-5 h-5 text-emerald-400" />}
                tooltip="Lucro real gerado a cada quilômetro que seu carro roda."
              />

              {/* 4. Economia Diária com Passe */}
              <MetricCard 
                title="Economia Diária"
                value={formatBRL(simulation.estimatedSavings)}
                subtitle="Ganhos extras com o Passe"
                icon={<Coins className="w-5 h-5 text-amber-400" />}
                trend={{
                  value: simulation.estimatedSavings >= 0 ? 'Viável' : 'Inviável',
                  isPositive: simulation.estimatedSavings >= 0
                }}
                tooltip="Economia diária líquida com o Passe comparada com a taxa de comissão padrão."
              />

              {/* 5. Economia Mensal Estimada */}
              <MetricCard 
                title="Economia Mensal"
                value={formatBRL(simulation.monthlySavings)}
                subtitle="Estimado em 26 dias úteis"
                icon={<TrendingUp className="w-5 h-5 text-teal-400" />}
                tooltip="Economia acumulada estimada para um mês operacional típico."
              />

              {/* 6. Economia Anual Estimada */}
              <MetricCard 
                title="Economia Anual"
                value={formatBRL(simulation.annualSavings)}
                subtitle="Estimado em 312 dias úteis"
                icon={<Sparkles className="w-5 h-5 text-emerald-300 animate-pulse" />}
                tooltip="Acúmulo de economia líquida operacional durante o ano inteiro."
              />

              {/* 7. Corridas Mínimas para Compensar */}
              <MetricCard 
                title="Corridas Mínimas"
                value={`${Math.ceil(simulation.breakEvenRides)} corridas`}
                subtitle={`Ticket médio: ${formatBRL(averageTicket)}`}
                icon={<Ticket className="w-5 h-5 text-rose-400" />}
                tooltip="Número de corridas diárias necessárias para amortizar o custo do Passe."
              />

              {/* 8. Faturamento Mínimo (Break-Even) */}
              <MetricCard 
                title="Faturamento Mínimo"
                value={formatBRL(simulation.breakEvenRevenue)}
                subtitle="Ponto de Equilíbrio do Passe"
                icon={<DollarSign className="w-5 h-5 text-slate-300" />}
                tooltip="O faturamento exato onde o custo do Passe se iguala à taxa tradicional da Uber."
              />

              {/* 9. Margem Líquida */}
              <MetricCard 
                title="Margem Líquida"
                value={`${simulation.netMargin.toFixed(1)}%`}
                subtitle="Eficiência operacional líquida"
                icon={<Percent className="w-5 h-5 text-sky-400" />}
                tooltip="Percentual do faturamento bruto que vira lucro líquido de verdade."
              />

              {/* 10. ROI do Passe */}
              <MetricCard 
                title="ROI do Passe"
                value={`${simulation.dailyROI.toFixed(1)}%`}
                subtitle="Retorno sobre despesas totais"
                icon={<Zap className="w-5 h-5 text-purple-300" />}
                tooltip="Índice de retorno financeiro sobre o custo total de rodagem."
              />

            </div>

            {/* Progress Bars (Break-Even, Daily Target, Profit Target) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <ProgressInsight 
                title="Progresso até o Break-Even"
                currentValue={estimatedRevenue}
                targetValue={simulation.breakEvenRevenue}
                formatValue={formatBRL}
                description="O ponto exato onde o faturamento cobre o valor da assinatura do Passe."
                colorClass="from-rose-500 to-indigo-500"
              />

              <ProgressInsight 
                title="Progresso até Meta Diária"
                currentValue={estimatedRevenue}
                targetValue={targetDailyRevenue}
                formatValue={formatBRL}
                description="Seu objetivo de faturamento bruto diário configurado."
                colorClass="from-purple-500 to-emerald-500"
              />

              <ProgressInsight 
                title="Meta de Lucro / Hora"
                currentValue={simulation.netProfitPerHour}
                targetValue={targetProfitPerHour}
                formatValue={formatBRL}
                description="Meta pessoal de rentabilidade limpa a cada hora de trabalho."
                colorClass="from-indigo-500 to-teal-500"
              />
            </div>

            {/* Premium Interactive Charts Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <FinancialComparisonChart 
                passPrice={passPrice}
                oldFeePercent={oldFeePercent}
                breakEvenRevenue={simulation.breakEvenRevenue}
              />

              <CostBreakdownChart 
                costBreakdown={costBreakdown}
                estimatedKm={estimatedKm}
              />
            </div>

            {/* Projections Table */}
            <div className="bg-[#0b0821]/80 border border-purple-950/30 rounded-2xl p-6 shadow-md overflow-hidden">
              <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider font-display mb-4 flex items-center gap-1.5 border-b border-purple-950/10 pb-3">
                <FileText className="w-4 h-4 text-purple-400" />
                Demonstrativo de Custos Operacionais Detalhado
              </h4>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-purple-950/30 text-slate-400">
                      <th className="pb-3 font-semibold font-display">Categoria</th>
                      <th className="pb-3 text-right font-semibold font-display">Por KM</th>
                      <th className="pb-3 text-right font-semibold font-display">Diário</th>
                      <th className="pb-3 text-right font-semibold font-display">Mensal (26d)</th>
                      <th className="pb-3 text-right font-semibold font-display">Anual (312d)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-purple-950/10">
                    <tr>
                      <td className="py-3 font-medium text-slate-200">Energia / Combustível</td>
                      <td className="py-3 text-right font-mono font-bold text-purple-300">{formatBRL(costBreakdown.fuelOrEnergy)}</td>
                      <td className="py-3 text-right font-mono text-slate-300">{formatBRL(costBreakdown.fuelOrEnergy * estimatedKm)}</td>
                      <td className="py-3 text-right font-mono text-slate-300">{formatBRL(costBreakdown.fuelOrEnergy * estimatedKm * 26)}</td>
                      <td className="py-3 text-right font-mono text-slate-300">{formatBRL(costBreakdown.fuelOrEnergy * estimatedKm * 312)}</td>
                    </tr>
                    <tr>
                      <td className="py-3 font-medium text-slate-200">Manutenção & Desgaste</td>
                      <td className="py-3 text-right font-mono font-bold text-purple-300">{formatBRL(costBreakdown.maintenance)}</td>
                      <td className="py-3 text-right font-mono text-slate-300">{formatBRL(costBreakdown.maintenance * estimatedKm)}</td>
                      <td className="py-3 text-right font-mono text-slate-300">{formatBRL(costBreakdown.maintenance * estimatedKm * 26)}</td>
                      <td className="py-3 text-right font-mono text-slate-300">{formatBRL(costBreakdown.maintenance * estimatedKm * 312)}</td>
                    </tr>
                    <tr>
                      <td className="py-3 font-medium text-slate-200">Custos Fixos amortizados</td>
                      <td className="py-3 text-right font-mono font-bold text-purple-300">{formatBRL(costBreakdown.fixed)}</td>
                      <td className="py-3 text-right font-mono text-slate-300">{formatBRL(costBreakdown.fixed * estimatedKm)}</td>
                      <td className="py-3 text-right font-mono text-slate-300">{formatBRL(costBreakdown.fixed * estimatedKm * 26)}</td>
                      <td className="py-3 text-right font-mono text-slate-300">{formatBRL(costBreakdown.fixed * estimatedKm * 312)}</td>
                    </tr>
                    <tr>
                      <td className="py-3 font-medium text-slate-200">Depreciação de Ativo</td>
                      <td className="py-3 text-right font-mono font-bold text-purple-300">{formatBRL(costBreakdown.depreciation)}</td>
                      <td className="py-3 text-right font-mono text-slate-300">{formatBRL(costBreakdown.depreciation * estimatedKm)}</td>
                      <td className="py-3 text-right font-mono text-slate-300">{formatBRL(costBreakdown.depreciation * estimatedKm * 26)}</td>
                      <td className="py-3 text-right font-mono text-slate-300">{formatBRL(costBreakdown.depreciation * estimatedKm * 312)}</td>
                    </tr>
                    <tr className="font-bold border-t border-purple-950/30 text-white bg-purple-950/20">
                      <td className="py-3 px-2 font-display">TOTAL CUSTO REAL</td>
                      <td className="py-3 text-right font-mono text-purple-400">{formatBRL(costBreakdown.totalPerKm)}</td>
                      <td className="py-3 text-right font-mono">{formatBRL(simulation.dailyVehicleCostOnly)}</td>
                      <td className="py-3 text-right font-mono">{formatBRL(simulation.monthlyVehicleCostOnly)}</td>
                      <td className="py-3 text-right font-mono">{formatBRL(simulation.annualVehicleCostOnly)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

          </div>

        </div>

      </div>

    </div>
  );
};
