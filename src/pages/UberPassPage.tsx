import React, { useState, useEffect } from 'react';
import { 
  Ticket, DollarSign, Calculator, Percent, Sparkles, TrendingUp, AlertTriangle, Save, CheckCircle2, HelpCircle, Milestone, Clock, Activity, Coins, ShieldCheck
} from 'lucide-react';
import { motion } from 'motion/react';
import { useApp } from '../context/AppContext';
import { uberPassService } from '../modules/uberpass/uberpass.service';
import { calculateCostPerKmEstimate } from '../modules/vehicle/vehicle.calculations';

export const UberPassPage: React.FC = () => {
  const { user, dbStatus, vehicle, vehicleCostSettings } = useApp();

  // Settings states
  const [passType, setPassType] = useState<string>('24 horas');
  const [passPrice, setPassPrice] = useState<string>('30');
  const [earningsLimit, setEarningsLimit] = useState<string>('200');
  const [oldFeePercent, setOldFeePercent] = useState<string>('20');
  const [targetProfitPerHour, setTargetProfitPerHour] = useState<string>('30');
  const [targetDailyRevenue, setTargetDailyRevenue] = useState<string>('250');
  const [plannedHours, setPlannedHours] = useState<string>('8');
  const [averageTicket, setAverageTicket] = useState<string>('15');
  const [costPerKm, setCostPerKm] = useState<string>('1.20');
  const [estimatedKm, setEstimatedKm] = useState<string>('150');

  // Simulator state
  const [estimatedRevenue, setEstimatedRevenue] = useState<string>('300');

  // Feedback states
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Load default vehicle cost if available
  const vehicleCostEstimate = vehicle ? calculateCostPerKmEstimate(vehicle, vehicleCostSettings) : 0;

  // Format BRL function
  const formatBRL = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  // Fetch settings from Supabase or load defaults
  useEffect(() => {
    if (!user) return;

    const fetchSettings = async () => {
      try {
        setLoading(true);
        const settings = await uberPassService.fetchUberPassSettings(user.id);
        if (settings) {
          setPassType(settings.pass_type || '24 horas');
          setPassPrice(settings.pass_price?.toString() || '30');
          setEarningsLimit(settings.earnings_limit?.toString() || '200');
          setOldFeePercent(settings.old_fee_percent?.toString() || '20');
          setTargetProfitPerHour(settings.target_profit_per_hour?.toString() || '30');
          setTargetDailyRevenue(settings.target_daily_revenue?.toString() || '250');
          setPlannedHours(settings.planned_hours?.toString() || '8');
          setAverageTicket(settings.average_ticket?.toString() || '15');
          setCostPerKm(settings.cost_per_km?.toString() || '1.20');
          setEstimatedKm(settings.estimated_km?.toString() || '150');
          
          // Set simulator revenue based on daily target or a fallback
          setEstimatedRevenue(settings.target_daily_revenue?.toString() || '300');
        } else {
          // If no settings exist but we have a vehicle, pre-fill the cost per km
          if (vehicleCostEstimate > 0) {
            setCostPerKm(vehicleCostEstimate.toFixed(2));
          }
        }
      } catch (err) {
        console.error('Erro ao buscar configurações do Uber Pass:', err);
        setErrorMsg('Não foi possível carregar as configurações salvas. Usando valores padrões.');
      } finally {
        setLoading(false);
      }
    };

    fetchSettings();
  }, [user, vehicleCostEstimate]);

  // Save settings to Supabase
  const handleSaveSettings = async () => {
    if (!user) return;
    setSaving(true);
    setSuccessMsg(null);
    setErrorMsg(null);

    try {
      await uberPassService.upsertUberPassSettings({
        user_id: user.id,
        pass_type: passType,
        pass_price: Number(passPrice) || 0,
        earnings_limit: passType === 'Por ganhos' ? (Number(earningsLimit) || 0) : undefined,
        old_fee_percent: Number(oldFeePercent) || 20,
        target_profit_per_hour: Number(targetProfitPerHour) || 0,
        target_daily_revenue: Number(targetDailyRevenue) || 0,
        planned_hours: Number(plannedHours) || 8,
        average_ticket: Number(averageTicket) || 0,
        cost_per_km: Number(costPerKm) || 0,
        estimated_km: Number(estimatedKm) || 0,
      });

      setSuccessMsg('Configurações do Uber Pass salvas com sucesso!');
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err) {
      console.error('Erro ao salvar configurações do Uber Pass:', err);
      setErrorMsg('Ocorreu um erro ao salvar as configurações.');
    } finally {
      setSaving(false);
    }
  };

  // Convert inputs to numeric values safely
  const pPrice = Number(passPrice) || 0;
  const pEarningsLimit = Number(earningsLimit) || 0;
  const oldFee = Number(oldFeePercent) || 20;
  const tProfitPerHour = Number(targetProfitPerHour) || 0;
  const tDailyRevenue = Number(targetDailyRevenue) || 0;
  const pHours = Number(plannedHours) || 8;
  const avgTicket = Number(averageTicket) || 15;
  const cPerKm = Number(costPerKm) || 0;
  const estKm = Number(estimatedKm) || 0;
  const estRevenue = Number(estimatedRevenue) || 0;

  // Core Calculations
  const breakEvenRevenue = oldFee > 0 ? pPrice / (oldFee / 100) : 0;
  const breakEvenRides = (avgTicket > 0 && oldFee > 0) ? pPrice / (avgTicket * oldFee / 100) : 0;
  const totalDayCost = pPrice + (estKm * cPerKm);
  const estimatedNetProfit = estRevenue - totalDayCost;
  const netProfitPerHour = pHours > 0 ? estimatedNetProfit / pHours : 0;
  const revenuePerHour = pHours > 0 ? estRevenue / pHours : 0;
  const revenuePerKm = estKm > 0 ? estRevenue / estKm : 0;
  const estimatedSavings = (estRevenue * oldFee / 100) - pPrice;

  // Intelligent Diagnosis Status
  let diagnosisStatus: 'not_worth' | 'worth' | 'excellent' = 'not_worth';
  let diagnosisLabel = 'Não vale ativar ainda';
  let diagnosisDesc = 'O faturamento estimado é menor que a receita necessária para pagar o passe.';
  let diagnosisColor = 'border-amber-500/30 bg-amber-950/10 text-amber-300';
  let diagnosisDot = 'bg-amber-500';

  if (estRevenue >= breakEvenRevenue) {
    if (estimatedSavings > 0 && netProfitPerHour > tProfitPerHour) {
      diagnosisStatus = 'excellent';
      diagnosisLabel = 'Excelente oportunidade';
      diagnosisDesc = 'O passe se paga com folga, gera economia real e supera sua meta de lucro por hora!';
      diagnosisColor = 'border-emerald-500/40 bg-emerald-950/20 text-emerald-300 shadow-[0_0_15px_rgba(16,185,129,0.15)]';
      diagnosisDot = 'bg-emerald-400';
    } else {
      diagnosisStatus = 'worth';
      diagnosisLabel = 'Vale a pena';
      diagnosisDesc = 'O faturamento cobre o custo do passe. Você terá lucro comparado ao modelo de taxa antiga.';
      diagnosisColor = 'border-indigo-500/30 bg-indigo-950/10 text-indigo-300';
      diagnosisDot = 'bg-indigo-400';
    }
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6 z-10" id="uber-pass-intelligence-container">
      
      {/* Title Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 select-none">
        <div>
          <h2 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-100 to-indigo-200 flex items-center gap-2">
            <Ticket className="w-6 h-6 text-purple-400" />
            Uber Pass Intelligence
          </h2>
          <p className="text-xs text-purple-300/60 font-sans mt-1">
            Compare o modelo de assinatura fixa com a taxa percentual padrão e maximize seus lucros.
          </p>
        </div>

        {/* Sync Status Button */}
        <button
          onClick={handleSaveSettings}
          disabled={saving || loading}
          className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:bg-purple-950/50 text-white font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-[0_0_12px_rgba(147,51,234,0.3)] hover:shadow-[0_0_15px_rgba(147,51,234,0.5)] active:scale-[0.98]"
        >
          {saving ? (
            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          Salvar Configurações
        </button>
      </div>

      {/* Messages */}
      {successMsg && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-950/25 text-emerald-300 text-xs font-semibold flex items-center gap-2.5"
        >
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          {successMsg}
        </motion.div>
      )}

      {errorMsg && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 rounded-xl border border-rose-500/30 bg-rose-950/25 text-rose-300 text-xs font-semibold flex items-center gap-2.5"
        >
          <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
          {errorMsg}
        </motion.div>
      )}

      {/* Diagnostic & Simulator Main Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Diagnostic Card */}
        <div className={`col-span-1 lg:col-span-2 border rounded-2xl p-6 ${diagnosisColor} transition-all duration-300 flex flex-col justify-between space-y-4`}>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full ${diagnosisDot} animate-pulse`} />
              <span className="text-[10px] font-bold uppercase tracking-wider font-mono opacity-80">
                Diagnóstico Uber Pass
              </span>
            </div>
            
            <h3 className="text-2xl font-black tracking-tight">{diagnosisLabel}</h3>
            <p className="text-xs leading-relaxed opacity-90">{diagnosisDesc}</p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 pt-4 border-t border-purple-950/10">
            <div>
              <span className="text-[10px] opacity-70 block">Break-even Receita</span>
              <span className="text-base font-bold font-mono">{formatBRL(breakEvenRevenue)}</span>
            </div>
            <div>
              <span className="text-[10px] opacity-70 block">Mínimo Corridas</span>
              <span className="text-base font-bold font-mono">{Math.ceil(breakEvenRides)} corridas</span>
            </div>
            <div className="col-span-2 md:col-span-1">
              <span className="text-[10px] opacity-70 block">Economia Simulada</span>
              <span className={`text-base font-extrabold font-mono ${estimatedSavings >= 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
                {formatBRL(estimatedSavings)}
              </span>
            </div>
          </div>
        </div>

        {/* Real-time Interactive Simulator */}
        <div className="bg-[#0b0721] border border-purple-950/40 rounded-2xl p-6 space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 text-purple-400 select-none">
              <Activity className="w-4 h-4" />
              <h4 className="text-xs font-bold font-mono uppercase tracking-wider">Simulador de Faturamento</h4>
            </div>
            <p className="text-[11px] text-purple-300/50 mt-1">
              Altere os ganhos brutos planejados para ver a viabilidade do passe em tempo real:
            </p>
          </div>

          <div className="space-y-3">
            <div className="flex items-baseline justify-between select-none">
              <span className="text-xs text-slate-400 font-sans">Faturamento Estimado</span>
              <span className="text-xl font-bold font-mono text-purple-300">{formatBRL(estRevenue)}</span>
            </div>

            <input 
              type="range" 
              min="50" 
              max="1000" 
              step="10"
              value={estimatedRevenue} 
              onChange={(e) => setEstimatedRevenue(e.target.value)}
              className="w-full h-1.5 bg-purple-950/50 rounded-lg appearance-none cursor-pointer accent-purple-500"
            />
            
            <div className="relative">
              <span className="absolute inset-y-0 left-3 flex items-center text-slate-500 text-xs font-mono">R$</span>
              <input 
                type="number" 
                value={estimatedRevenue} 
                onChange={(e) => setEstimatedRevenue(e.target.value)}
                className="w-full bg-[#04010a] border border-purple-950/40 rounded-xl py-2.5 pl-8 pr-4 text-sm text-slate-100 font-bold font-mono"
              />
            </div>
          </div>

          <div className="text-[10px] text-purple-300/40 leading-relaxed font-sans bg-[#05020e] p-2 border border-purple-950/20 rounded-lg">
            * Dica: Ajuste para o valor que você projeta fazer no dia de acordo com sua jornada padrão.
          </div>
        </div>

      </div>

      {/* Main Grid: Form Setup vs Performance Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Configuration Column */}
        <div className="lg:col-span-5 bg-[#09051c] border border-purple-950/30 rounded-2xl p-6 space-y-6">
          <div className="flex items-center gap-2 border-b border-purple-950/20 pb-3 select-none">
            <Coins className="w-5 h-5 text-purple-400" />
            <h3 className="font-bold text-sm text-slate-100">Configuração do Passe & Metas</h3>
          </div>

          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center gap-2">
              <div className="w-8 h-8 border-4 border-purple-600 border-t-transparent rounded-full animate-spin" />
              <p className="text-xs text-purple-300/50 font-sans">Carregando configurações...</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Pass Type Selection */}
              <div>
                <label className="block text-purple-300 font-semibold text-xs mb-1.5 font-sans">Tipo de Passe *</label>
                <div className="grid grid-cols-3 gap-2">
                  {['24 horas', '72 horas', 'Por ganhos'].map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setPassType(type)}
                      className={`py-2 px-1 rounded-xl text-[11px] font-bold border transition-all text-center leading-snug cursor-pointer ${
                        passType === type 
                          ? 'bg-purple-900/30 border-purple-500 text-purple-200' 
                          : 'bg-[#04010a] border-purple-950/40 text-slate-400 hover:border-purple-900/60'
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Pass Price */}
                <div>
                  <label className="block text-slate-400 text-xs mb-1 font-sans">Valor do Passe (R$)</label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-2.5 flex items-center text-slate-500 text-xs font-mono">R$</span>
                    <input 
                      type="number" 
                      step="0.01"
                      value={passPrice} 
                      onChange={(e) => setPassPrice(e.target.value)}
                      className="w-full bg-[#04010a] border border-purple-950/40 rounded-xl py-2 pl-7 pr-3 text-xs text-slate-200 font-mono font-bold"
                    />
                  </div>
                </div>

                {/* Earnings Limit - only displayed if passType is 'Por ganhos' */}
                <div>
                  <label className="block text-slate-400 text-xs mb-1 font-sans">
                    Limite Ganhos Passe
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-2.5 flex items-center text-slate-500 text-xs font-mono">R$</span>
                    <input 
                      type="number" 
                      disabled={passType !== 'Por ganhos'}
                      value={passType === 'Por ganhos' ? earningsLimit : ''} 
                      onChange={(e) => setEarningsLimit(e.target.value)}
                      placeholder={passType !== 'Por ganhos' ? 'Não aplicável' : 'Ex: 200'}
                      className="w-full bg-[#04010a] border border-purple-950/40 disabled:opacity-40 rounded-xl py-2 pl-7 pr-3 text-xs text-slate-200 font-mono font-bold"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 border-t border-purple-950/10 pt-3">
                {/* Old Fee % */}
                <div>
                  <label className="block text-slate-400 text-xs mb-1 font-sans">Taxa Antiga (%) *</label>
                  <div className="relative">
                    <span className="absolute inset-y-0 right-3 flex items-center text-slate-500 text-xs font-mono">%</span>
                    <input 
                      type="number" 
                      value={oldFeePercent} 
                      onChange={(e) => setOldFeePercent(e.target.value)}
                      className="w-full bg-[#04010a] border border-purple-950/40 rounded-xl py-2 pl-3 pr-8 text-xs text-slate-200 font-mono font-bold"
                    />
                  </div>
                </div>

                {/* Target Profit/Hour */}
                <div>
                  <label className="block text-slate-400 text-xs mb-1 font-sans">Meta Lucro/Hora (R$)</label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-2.5 flex items-center text-slate-500 text-xs font-mono">R$</span>
                    <input 
                      type="number" 
                      value={targetProfitPerHour} 
                      onChange={(e) => setTargetProfitPerHour(e.target.value)}
                      className="w-full bg-[#04010a] border border-purple-950/40 rounded-xl py-2 pl-7 pr-3 text-xs text-slate-200 font-mono font-bold"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Target Daily Revenue */}
                <div>
                  <label className="block text-slate-400 text-xs mb-1 font-sans">Meta Faturam. Diário</label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-2.5 flex items-center text-slate-500 text-xs font-mono">R$</span>
                    <input 
                      type="number" 
                      value={targetDailyRevenue} 
                      onChange={(e) => setTargetDailyRevenue(e.target.value)}
                      className="w-full bg-[#04010a] border border-purple-950/40 rounded-xl py-2 pl-7 pr-3 text-xs text-slate-200 font-mono font-bold"
                    />
                  </div>
                </div>

                {/* Planned Hours */}
                <div>
                  <label className="block text-slate-400 text-xs mb-1 font-sans">Horas Planejadas</label>
                  <div className="relative">
                    <span className="absolute inset-y-0 right-3 flex items-center text-slate-500 text-xs font-sans">hrs</span>
                    <input 
                      type="number" 
                      value={plannedHours} 
                      onChange={(e) => setPlannedHours(e.target.value)}
                      className="w-full bg-[#04010a] border border-purple-950/40 rounded-xl py-2 pl-3 pr-8 text-xs text-slate-200 font-mono font-bold"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 border-t border-purple-950/10 pt-3">
                {/* Avg Ticket per Ride */}
                <div>
                  <label className="block text-slate-400 text-xs mb-1 font-sans">Ticket Médio/Corrida</label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-2.5 flex items-center text-slate-500 text-xs font-mono">R$</span>
                    <input 
                      type="number" 
                      value={averageTicket} 
                      onChange={(e) => setAverageTicket(e.target.value)}
                      className="w-full bg-[#04010a] border border-purple-950/40 rounded-xl py-2 pl-7 pr-3 text-xs text-slate-200 font-mono font-bold"
                    />
                  </div>
                </div>

                {/* Cost per KM */}
                <div>
                  <label className="block text-slate-400 text-xs mb-1 font-sans flex items-center justify-between">
                    <span>Custo por KM</span>
                    {vehicleCostEstimate > 0 && (
                      <button 
                        type="button"
                        onClick={() => setCostPerKm(vehicleCostEstimate.toFixed(2))}
                        className="text-[9px] text-purple-400 underline hover:text-purple-300 font-semibold uppercase"
                        title="Usar valor real calculado das suas configurações de veículo"
                      >
                        Auto-fill
                      </button>
                    )}
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-2.5 flex items-center text-slate-500 text-xs font-mono">R$</span>
                    <input 
                      type="number" 
                      step="0.01"
                      value={costPerKm} 
                      onChange={(e) => setCostPerKm(e.target.value)}
                      className="w-full bg-[#04010a] border border-purple-950/40 rounded-xl py-2 pl-7 pr-3 text-xs text-slate-200 font-mono font-bold"
                    />
                  </div>
                </div>
              </div>

              {/* Estimated KM */}
              <div>
                <label className="block text-slate-400 text-xs mb-1.5 font-sans">KM Estimado no Dia</label>
                <div className="relative">
                  <span className="absolute inset-y-0 right-3 flex items-center text-slate-500 text-xs font-sans">km</span>
                  <input 
                    type="number" 
                    value={estimatedKm} 
                    onChange={(e) => setEstimatedKm(e.target.value)}
                    className="w-full bg-[#04010a] border border-purple-950/40 rounded-xl py-2.5 pl-3 pr-8 text-xs text-slate-200 font-mono font-bold"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Intelligence Cards Column */}
        <div className="lg:col-span-7 space-y-6">
          <div className="flex items-center gap-2 select-none">
            <Calculator className="w-5 h-5 text-indigo-400" />
            <h3 className="font-bold text-sm text-slate-100">Indicadores Chave & Métricas de Viabilidade</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* Card 1: Vale ativar o passe? */}
            <div className={`p-4 rounded-xl border ${diagnosisColor} transition-all`}>
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold opacity-75 font-sans">Vale ativar o passe?</span>
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div className="text-xl font-black mt-2 font-sans tracking-tight">
                {diagnosisLabel}
              </div>
              <p className="text-[10px] leading-tight opacity-70 mt-1">
                Faturamento Atual: {formatBRL(estRevenue)} (Break-even: {formatBRL(breakEvenRevenue)})
              </p>
            </div>

            {/* Card 2: Receita Mínima break-even */}
            <div className="p-4 rounded-xl border border-purple-950/30 bg-[#07041a] flex flex-col justify-between">
              <div>
                <span className="text-[11px] text-slate-400 font-medium font-sans">Receita mínima para compensar</span>
                <div className="text-2xl font-black font-mono text-white mt-1">
                  {formatBRL(breakEvenRevenue)}
                </div>
              </div>
              <p className="text-[9px] text-slate-550 leading-tight mt-2 font-mono">
                Abaixo deste faturamento diário, você perderá dinheiro ao ativar o passe.
              </p>
            </div>

            {/* Card 3: Corridas mínimas */}
            <div className="p-4 rounded-xl border border-purple-950/30 bg-[#07041a] flex flex-col justify-between">
              <div>
                <span className="text-[11px] text-slate-400 font-medium font-sans">Corridas mínimas para compensar</span>
                <div className="text-2xl font-black font-mono text-white mt-1">
                  {Math.ceil(breakEvenRides)} <span className="text-xs font-normal text-slate-400">corridas</span>
                </div>
              </div>
              <p className="text-[9px] text-slate-550 leading-tight mt-2">
                Baseado em um ticket médio de {formatBRL(avgTicket)} por corrida no modelo antigo.
              </p>
            </div>

            {/* Card 4: Lucro Líquido Estimado */}
            <div className="p-4 rounded-xl border border-purple-950/30 bg-[#07041a] flex flex-col justify-between">
              <div>
                <span className="text-[11px] text-slate-400 font-medium font-sans">Lucro Líquido Estimado</span>
                <div className={`text-2xl font-black font-mono mt-1 ${estimatedNetProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {formatBRL(estimatedNetProfit)}
                </div>
              </div>
              <p className="text-[9px] text-slate-550 leading-tight mt-2">
                Faturamento simulado de {formatBRL(estRevenue)} deduzido de todos os custos.
              </p>
            </div>

            {/* Card 5: Lucro Líquido por hora */}
            <div className="p-4 rounded-xl border border-purple-950/30 bg-[#07041a] flex flex-col justify-between">
              <div>
                <span className="text-[11px] text-slate-400 font-medium font-sans">Lucro Líquido por Hora</span>
                <div className={`text-2xl font-black font-mono mt-1 ${netProfitPerHour >= tProfitPerHour ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {formatBRL(netProfitPerHour)}<span className="text-xs font-normal text-slate-400">/hr</span>
                </div>
              </div>
              <p className="text-[9px] text-slate-550 leading-tight mt-2">
                Meta do motorista: {formatBRL(tProfitPerHour)}/hr. Diferença: {formatBRL(netProfitPerHour - tProfitPerHour)}/hr
              </p>
            </div>

            {/* Card 6: Economia Estimada */}
            <div className="p-4 rounded-xl border border-purple-950/30 bg-[#07041a] flex flex-col justify-between">
              <div>
                <span className="text-[11px] text-slate-400 font-medium font-sans">Economia Líquida com Passe</span>
                <div className={`text-2xl font-black font-mono mt-1 ${estimatedSavings > 0 ? 'text-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.2)]' : 'text-amber-400'}`}>
                  {formatBRL(estimatedSavings)}
                </div>
              </div>
              <p className="text-[9px] text-slate-550 leading-tight mt-2">
                Comparativo direto com a taxa antiga de {oldFee}% descontada do faturamento.
              </p>
            </div>

            {/* Card 7: Receita por KM */}
            <div className="p-4 rounded-xl border border-purple-950/30 bg-[#07041a] flex flex-col justify-between">
              <div>
                <span className="text-[11px] text-slate-400 font-medium font-sans">Faturamento Bruto por KM</span>
                <div className="text-2xl font-black font-mono text-white mt-1">
                  {formatBRL(revenuePerKm)}<span className="text-xs font-normal text-slate-400">/km</span>
                </div>
              </div>
              <p className="text-[9px] text-slate-550 leading-tight mt-2">
                Relação de faturamento por quilômetro rodado estimado diário.
              </p>
            </div>

            {/* Card 8: Custo total do dia */}
            <div className="p-4 rounded-xl border border-purple-950/30 bg-[#07041a] flex flex-col justify-between">
              <div>
                <span className="text-[11px] text-slate-400 font-medium font-sans">Custo Total Real do Dia</span>
                <div className="text-2xl font-black font-mono text-rose-300 mt-1">
                  {formatBRL(totalDayCost)}
                </div>
              </div>
              <p className="text-[9px] text-slate-550 leading-tight mt-2 font-mono">
                Assinatura ({formatBRL(pPrice)}) + Rodagem {estKm}km ({formatBRL(estKm * cPerKm)})
              </p>
            </div>

          </div>

          {/* Quick Informational / Helper Box */}
          <div className="bg-[#0e0924]/60 border border-purple-950/30 rounded-2xl p-4 space-y-2 select-none">
            <h4 className="text-xs font-bold font-sans text-purple-300 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-purple-400" />
              Como funciona o Passe da Uber?
            </h4>
            <p className="text-[11px] text-purple-300/60 leading-relaxed font-sans">
              O Passe para Motoristas é um modelo em que você paga uma assinatura antecipada por um período (ex: 24 horas ou 72 horas) ou por limite de ganhos. Em troca, as corridas realizadas durante esse período são repassadas sem o desconto da taxa percentual clássica da Uber, cobrando apenas uma pequena taxa fixa por corrida. Esse simulador ajuda você a descobrir o ponto exato de faturamento onde a economia do passe supera o valor de sua compra.
            </p>
          </div>
        </div>

      </div>

    </div>
  );
};
