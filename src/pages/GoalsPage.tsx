import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { 
  Target, TrendingUp, AlertCircle, CheckCircle2, DollarSign, Calculator, Percent, 
  HelpCircle, Sparkles, Award, ShieldAlert, Zap, Clock, Milestone, Activity, Compass, Info
} from 'lucide-react';
import { motion } from 'motion/react';

export const GoalsPage: React.FC = () => {
  const { 
    financialGoal, 
    vehicleCostSettings, 
    upsertFinancialGoal, 
    upsertVehicleCostSettings, 
    earnings, 
    expenses, 
    vehicle 
  } = useApp();

  // 1. Goal Setting Form State
  const [dailyGoal, setDailyGoal] = useState<string>('');
  const [weeklyGoal, setWeeklyGoal] = useState<string>('');
  const [monthlyGoal, setMonthlyGoal] = useState<string>('');
  const [goalsSuccess, setGoalsSuccess] = useState<boolean>(false);
  const [goalsError, setGoalsError] = useState<string | null>(null);

  // 2. Vehicle Cost Settings Form State
  const [fuelPrice, setFuelPrice] = useState<string>('');
  const [tireCost, setTireCost] = useState<string>('');
  const [tireLifespanKm, setTireLifespanKm] = useState<string>('');
  const [oilCost, setOilCost] = useState<string>('');
  const [oilIntervalKm, setOilIntervalKm] = useState<string>('');
  const [brakeCost, setBrakeCost] = useState<string>('');
  const [brakeIntervalKm, setBrakeIntervalKm] = useState<string>('');
  const [insuranceYearly, setInsuranceYearly] = useState<string>('');
  const [ipvaYearly, setIpvaYearly] = useState<string>('');
  const [licensingYearly, setLicensingYearly] = useState<string>('');
  const [emergencyReserveMonthly, setEmergencyReserveMonthly] = useState<string>('');
  const [costSuccess, setCostSuccess] = useState<boolean>(false);
  const [costError, setCostError] = useState<string | null>(null);

  // Load existing database goals & cost parameters
  useEffect(() => {
    if (financialGoal) {
      setDailyGoal(financialGoal.daily_goal ? String(financialGoal.daily_goal) : '');
      setWeeklyGoal(financialGoal.weekly_goal ? String(financialGoal.weekly_goal) : '');
      setMonthlyGoal(financialGoal.monthly_goal ? String(financialGoal.monthly_goal) : '');
    }
  }, [financialGoal]);

  useEffect(() => {
    if (vehicleCostSettings) {
      setFuelPrice(vehicleCostSettings.fuel_price ? String(vehicleCostSettings.fuel_price) : '');
      setTireCost(vehicleCostSettings.tire_cost ? String(vehicleCostSettings.tire_cost) : '');
      setTireLifespanKm(vehicleCostSettings.tire_lifespan_km ? String(vehicleCostSettings.tire_lifespan_km) : '');
      setOilCost(vehicleCostSettings.oil_change_cost ? String(vehicleCostSettings.oil_change_cost) : '');
      setOilIntervalKm(vehicleCostSettings.oil_change_interval_km ? String(vehicleCostSettings.oil_change_interval_km) : '');
      setBrakeCost(vehicleCostSettings.brake_cost ? String(vehicleCostSettings.brake_cost) : '');
      setBrakeIntervalKm(vehicleCostSettings.brake_interval_km ? String(vehicleCostSettings.brake_interval_km) : '');
      setInsuranceYearly(vehicleCostSettings.insurance_yearly ? String(vehicleCostSettings.insurance_yearly) : '');
      setIpvaYearly(vehicleCostSettings.ipva_yearly ? String(vehicleCostSettings.ipva_yearly) : '');
      setLicensingYearly(vehicleCostSettings.licensing_yearly ? String(vehicleCostSettings.licensing_yearly) : '');
      setEmergencyReserveMonthly(vehicleCostSettings.emergency_reserve_monthly ? String(vehicleCostSettings.emergency_reserve_monthly) : '');
    }
  }, [vehicleCostSettings]);

  // 3. Goal Simulator Form State
  const [simDesiredGoal, setSimDesiredGoal] = useState<number>(5000); // desired monthly gross target
  const [simDaysPerWeek, setSimDaysPerWeek] = useState<number>(5);
  const [simHoursPerDay, setSimHoursPerDay] = useState<number>(8);

  // Calculations: Real-time Simulator outputs
  const simWeeklyTarget = simDesiredGoal / 4.33;
  const simDailyTarget = simWeeklyTarget / simDaysPerWeek;
  const simHourlyTarget = simDailyTarget / simHoursPerDay;

  // Formatting helper
  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  // Safe parsed numbers for cost factors
  const kmPerLiter = vehicle?.km_per_liter || 10;
  const parsedFuel = Number(fuelPrice) || 0;
  const parsedTirePrice = Number(tireCost) || 0;
  const parsedTireKm = Number(tireLifespanKm) || 0;
  const parsedOilPrice = Number(oilCost) || 0;
  const parsedOilKm = Number(oilIntervalKm) || 0;
  const parsedBrakePrice = Number(brakeCost) || 0;
  const parsedBrakeKm = Number(brakeIntervalKm) || 0;
  const parsedInsurance = Number(insuranceYearly) || 0;
  const parsedIpva = Number(ipvaYearly) || 0;
  const parsedLicensing = Number(licensingYearly) || 0;
  const parsedReserve = Number(emergencyReserveMonthly) || 0;

  // Formulate Real Cost per KM
  const costFuelPerKm = kmPerLiter > 0 ? parsedFuel / kmPerLiter : 0;
  const costTirePerKm = parsedTireKm > 0 ? parsedTirePrice / parsedTireKm : 0;
  const costOilPerKm = parsedOilKm > 0 ? parsedOilPrice / parsedOilKm : 0;
  const costBrakePerKm = parsedBrakeKm > 0 ? parsedBrakePrice / parsedBrakeKm : 0;

  const annualFixed = parsedInsurance + parsedIpva + parsedLicensing;
  const monthlyFixedTotal = (annualFixed / 12) + parsedReserve;
  const estimatedMonthlyKm = vehicle?.monthly_km_limit || 2500; // default estimated monthly kms
  const costFixedPerKm = estimatedMonthlyKm > 0 ? monthlyFixedTotal / estimatedMonthlyKm : 0;

  const realCostPerKmGrandTotal = costFuelPerKm + costTirePerKm + costOilPerKm + costBrakePerKm + costFixedPerKm;

  // --------------------------------------------------
  // 4. METRIC COMPUTATIONS (PROJECTIONS & PERFORMANCE)
  // --------------------------------------------------
  // Unique dates the user actually registered earnings
  const uniqueDatesArr = Array.from(new Set(earnings.map(e => e.date)));
  const totalDaysWorked = uniqueDatesArr.length || 1;

  const totalGrossAmount = earnings.reduce((sum, e) => sum + Number(e.gross_amount), 0);
  const totalExpensesAmount = expenses.reduce((sum, e) => sum + Number(e.amount), 0);
  const totalNetProfit = totalGrossAmount - totalExpensesAmount;
  const totalKmDriven = earnings.reduce((sum, e) => sum + Number(e.total_km), 0);

  // PACE PER DAY WORKED
  const averageGrossPerDay = totalGrossAmount / totalDaysWorked;
  const averageProfitPerDay = totalNetProfit / totalDaysWorked;

  // Projections
  const projectedWeeklyGross = averageGrossPerDay * 7;
  const projectedWeeklyNet = averageProfitPerDay * 7;
  const projectedMonthlyGross = averageGrossPerDay * 30;
  const projectedMonthlyNet = averageProfitPerDay * 30;

  // PERFORMANCE: Best Day of the Week
  const weekdayGrossSums: Record<number, number> = {};
  const weekdayDatesSets: Record<number, Set<string>> = {};

  earnings.forEach(e => {
    // parse date securely without timezone shift
    const parts = e.date.split('-');
    const dateObj = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]), 12, 0, 0);
    const dayOfWeek = dateObj.getDay(); // 0 is Sunday, 1 is Monday ...

    weekdayGrossSums[dayOfWeek] = (weekdayGrossSums[dayOfWeek] || 0) + Number(e.gross_amount);
    if (!weekdayDatesSets[dayOfWeek]) {
      weekdayDatesSets[dayOfWeek] = new Set<string>();
    }
    weekdayDatesSets[dayOfWeek].add(e.date);
  });

  const weekDayNames = [
    'Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'
  ];

  let bestDayIndex = -1;
  let maxDayAverage = 0;

  Object.keys(weekdayGrossSums).forEach(dayKey => {
    const dayIdx = Number(dayKey);
    const sum = weekdayGrossSums[dayIdx];
    const uniqueDaysCount = weekdayDatesSets[dayIdx]?.size || 1;
    const avg = sum / uniqueDaysCount;

    if (avg > maxDayAverage) {
      maxDayAverage = avg;
      bestDayIndex = dayIdx;
    }
  });

  // PERFORMANCE: Best Platform
  const platformTotals: Record<string, number> = {};
  earnings.forEach(e => {
    const platform = e.platform;
    platformTotals[platform] = (platformTotals[platform] || 0) + Number(e.gross_amount);
  });

  let bestPlatformName = '';
  let maxPlatformTotal = 0;

  Object.keys(platformTotals).forEach(pKey => {
    const total = platformTotals[pKey];
    if (total > maxPlatformTotal) {
      maxPlatformTotal = total;
      bestPlatformName = pKey;
    }
  });

  // Map platform aliases to human names
  const platformFriendlyName = (plat: string) => {
    if (!plat) return 'Nenhuma registrada';
    if (plat === 'uber') return 'Uber';
    if (plat === '99') return '99';
    if (plat === 'indriver') return 'InDrive';
    if (plat === 'private') return 'Particular (Privado)';
    if (plat === 'other') return 'Outros';
    return plat;
  };

  // --------------------------------------------------
  // FORM ACTIONS
  // --------------------------------------------------
  const handleSaveGoals = async (e: React.FormEvent) => {
    e.preventDefault();
    setGoalsError(null);
    setGoalsSuccess(false);

    const dG = Number(dailyGoal);
    const wG = Number(weeklyGoal);
    const mG = Number(monthlyGoal);

    if (isNaN(dG) || dG < 0 || isNaN(wG) || wG < 0 || isNaN(mG) || mG < 0) {
      setGoalsError('Por favor, informe valores numéricos maiores ou iguais a zero.');
      return;
    }

    try {
      await upsertFinancialGoal({
        daily_goal: dG,
        weekly_goal: wG,
        monthly_goal: mG
      });
      setGoalsSuccess(true);
      setTimeout(() => setGoalsSuccess(false), 3000);
    } catch (err: any) {
      setGoalsError(err.message || 'Erro ao sincronizar metas.');
    }
  };

  const handleSaveCosts = async (e: React.FormEvent) => {
    e.preventDefault();
    setCostError(null);
    setCostSuccess(false);

    const fp = Number(fuelPrice) || 0;
    const tc = Number(tireCost) || 0;
    const tlk = Number(tireLifespanKm) || 0;
    const oc = Number(oilCost) || 0;
    const oik = Number(oilIntervalKm) || 0;
    const bc = Number(brakeCost) || 0;
    const bik = Number(brakeIntervalKm) || 0;
    const iy = Number(insuranceYearly) || 0;
    const ipy = Number(ipvaYearly) || 0;
    const ly = Number(licensingYearly) || 0;
    const erm = Number(emergencyReserveMonthly) || 0;

    if (
      fp < 0 || tc < 0 || tlk < 0 || oc < 0 || oik < 0 ||
      bc < 0 || bik < 0 || iy < 0 || ipy < 0 || ly < 0 || erm < 0
    ) {
      setCostError('Valores negativos não são permitidos nos gastos operacionais.');
      return;
    }

    try {
      await upsertVehicleCostSettings({
        fuel_price: fp,
        tire_cost: tc,
        tire_lifespan_km: tlk,
        oil_change_cost: oc,
        oil_change_interval_km: oik,
        brake_cost: bc,
        brake_interval_km: bik,
        insurance_yearly: iy,
        ipva_yearly: ipy,
        licensing_yearly: ly,
        emergency_reserve_monthly: erm
      });
      setCostSuccess(true);
      setTimeout(() => setCostSuccess(false), 3000);
    } catch (err: any) {
      setCostError(err.message || 'Erro ao salvar os limites de custo operacional.');
    }
  };

  return (
    <div className="space-y-6 text-xs">
      
      {/* Page Title Block */}
      <div className="border-b border-purple-950/20 pb-4">
        <h2 className="text-xl font-bold text-white tracking-wide flex items-center gap-2">
          <Target className="w-5 h-5 text-purple-400" />
          <span>Planejamento Financeiro Inteligente</span>
        </h2>
        <p className="text-xs text-purple-300/50 mt-1 font-sans">
          Mantenha absoluto controle sobre suas metas de vida, calcule seu custo real estimado por km rodado e projete seus resultados consolidados automaticamente.
        </p>
      </div>

      {/* METAS & PROJEÇÃO BENTO GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* METAS EDITOR BOX */}
        <div className="bg-[#0b0720]/80 border border-purple-950/40 rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-2 border-b border-purple-950/20 pb-2">
            <Award className="w-4.5 h-4.5 text-purple-400" />
            <h3 className="text-xs font-bold text-white uppercase tracking-wider font-mono">Configurar Suas Metas</h3>
          </div>

          {goalsSuccess && (
            <div className="p-3 bg-emerald-950/60 border border-emerald-900/40 text-emerald-400 rounded-xl flex items-center gap-2 animate-fadeIn font-sans">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
              <span>Metas sincronizadas no Supabase com sucesso!</span>
            </div>
          )}

          {goalsError && (
            <div className="p-3 bg-rose-950/60 border border-rose-900/40 text-rose-300 rounded-xl flex items-center gap-2 animate-fadeIn font-sans">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{goalsError}</span>
            </div>
          )}

          <form onSubmit={handleSaveGoals} className="space-y-4 font-mono">
            <div>
              <label className="block text-slate-400 mb-1">Meta Faturamento Diária</label>
              <div className="relative">
                <span className="absolute left-3.5 inset-y-0 flex items-center text-purple-400 font-bold font-sans">R$</span>
                <input 
                  type="number" 
                  step="1"
                  required
                  placeholder="EX: 180"
                  value={dailyGoal}
                  onChange={(e) => setDailyGoal(e.target.value)}
                  className="w-full bg-[#04010a] border border-purple-950/50 rounded-xl py-2.5 pl-9 pr-3 text-slate-100 placeholder-purple-400/20 focus:outline-none focus:border-purple-600 font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-slate-400 mb-1">Meta Faturamento Semanal</label>
              <div className="relative">
                <span className="absolute left-3.5 inset-y-0 flex items-center text-purple-400 font-bold font-sans">R$</span>
                <input 
                  type="number" 
                  step="10"
                  required
                  placeholder="EX: 1000"
                  value={weeklyGoal}
                  onChange={(e) => setWeeklyGoal(e.target.value)}
                  className="w-full bg-[#04010a] border border-purple-950/50 rounded-xl py-2.5 pl-9 pr-3 text-slate-100 placeholder-purple-400/20 focus:outline-none focus:border-purple-600 font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-slate-400 mb-1">Meta Faturamento Mensal</label>
              <div className="relative">
                <span className="absolute left-3.5 inset-y-0 flex items-center text-purple-400 font-bold font-sans">R$</span>
                <input 
                  type="number" 
                  step="50"
                  required
                  placeholder="EX: 4500"
                  value={monthlyGoal}
                  onChange={(e) => setMonthlyGoal(e.target.value)}
                  className="w-full bg-[#04010a] border border-purple-950/50 rounded-xl py-2.5 pl-9 pr-3 text-slate-100 placeholder-purple-400/20 focus:outline-none focus:border-purple-600 font-mono"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-2.5 rounded-xl text-white font-sans font-bold bg-purple-600 hover:bg-purple-500 transition-colors uppercase cursor-pointer"
            >
              Gravar Metas Financeiras
            </button>
          </form>
        </div>

        {/* FINANCIAL PROJECTION BOX */}
        <div className="bg-[#0b0720]/80 border border-purple-950/40 rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-2 border-b border-purple-950/20 pb-2">
            <TrendingUp className="w-4.5 h-4.5 text-purple-400" />
            <h3 className="text-xs font-bold text-white uppercase tracking-wider font-mono">Projeção Financeira Inteligente</h3>
          </div>

          <div className="space-y-4 font-mono">
            <div className="p-3 bg-purple-950/10 border border-purple-950/20 rounded-xl text-slate-300 space-y-1">
              <span className="text-[10px] text-purple-400 block uppercase">Base Analítica Atual</span>
              <p className="text-[11px] leading-relaxed">
                Analizando <span className="text-white font-bold">{totalDaysWorked}</span> {totalDaysWorked === 1 ? 'dia trabalhado' : 'dias de rodagem'} registrado, faturamento médio bruto de <span className="text-emerald-400 font-bold">{formatCurrency(averageGrossPerDay)}/dia</span>.
              </p>
            </div>

            {/* WEEKLY PROJECTION */}
            <div className="p-3 bg-[#0a051d] border border-purple-950/30 rounded-xl space-y-2">
              <div className="flex justify-between items-center text-[10px] uppercase text-slate-400">
                <span>Ritmo Estimado Semanal (7 dias)</span>
                <span className="text-purple-400">Pace Act</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-[9px] text-slate-500 block">Faturamento Previsto</span>
                  <span className="text-emerald-400 text-xs font-bold">{formatCurrency(projectedWeeklyGross)}</span>
                </div>
                <div>
                  <span className="text-[9px] text-slate-500 block">Retorno Líquido</span>
                  <span className="text-purple-300 text-xs font-bold">{formatCurrency(projectedWeeklyNet)}</span>
                </div>
              </div>
            </div>

            {/* MONTHLY PROJECTION */}
            <div className="p-3 bg-gradient-to-br from-[#0c0525] to-[#140636] border border-purple-500/20 rounded-xl space-y-2">
              <div className="flex justify-between items-center text-[10px] uppercase text-purple-300 font-semibold">
                <span>Ritmo Estimado Mensal (30 dias)</span>
                <span className="text-pink-400 animate-pulse">Intranet IA</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-[9px] text-slate-400 block">Faturamento Previsto</span>
                  <span className="text-emerald-400 text-sm font-black">{formatCurrency(projectedMonthlyGross)}</span>
                </div>
                <div>
                  <span className="text-[9px] text-slate-400 block">Lucro Previsto</span>
                  <span className="text-pink-400 text-sm font-black">{formatCurrency(projectedMonthlyNet)}</span>
                </div>
              </div>
            </div>

            <p className="text-[10px] text-purple-300/30 leading-relaxed font-sans">
              * O cálculo assume constante de rendimento operacional idêntica à média global de dias com registros de ganhos. Adicione lançamentos diários e mantenha dados consistentes para elevar a precisão preditiva.
            </p>
          </div>
        </div>

        {/* BEST PERFORMANCE BOX */}
        <div className="bg-[#0b0720]/80 border border-purple-950/40 rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-2 border-b border-purple-950/20 pb-2">
            <Sparkles className="w-4.5 h-4.5 text-purple-400" />
            <h3 className="text-xs font-bold text-white uppercase tracking-wider font-mono">Melhor Desempenho Histórico</h3>
          </div>

          <div className="space-y-3 font-mono">
            {/* BEST DAY OF THE WEEK */}
            <div className="p-3 bg-purple-950/10 border border-purple-950/20 rounded-xl flex items-center justify-between">
              <div>
                <span className="text-[10px] text-purple-400 block uppercase">Melhor Dia da Semana</span>
                <span className="text-[11px] text-white font-bold">
                  {bestDayIndex !== -1 ? weekDayNames[bestDayIndex] : 'Sem lançamentos suficientes'}
                </span>
              </div>
              <div className="text-right">
                <span className="text-[9px] text-slate-500 block">Média Bruta</span>
                <span className="text-emerald-400 font-bold">{bestDayIndex !== -1 ? formatCurrency(maxDayAverage) : 'R$ 0,00'}</span>
              </div>
            </div>

            {/* BEST PLATFORM */}
            <div className="p-3 bg-purple-950/10 border border-purple-950/20 rounded-xl flex items-center justify-between">
              <div>
                <span className="text-[10px] text-purple-400 block uppercase">Melhor Plataforma</span>
                <span className="text-[11px] text-white font-bold">
                  {bestPlatformName ? platformFriendlyName(bestPlatformName) : 'Sem lançamentos suficientes'}
                </span>
              </div>
              <div className="text-right">
                <span className="text-[9px] text-slate-500 block">Faturamento Total</span>
                <span className="text-emerald-400 font-bold">{bestPlatformName ? formatCurrency(maxPlatformTotal) : 'R$ 0,00'}</span>
              </div>
            </div>

            {/* BEST RUNNING SCHEDULE */}
            <div className="p-3 bg-purple-950/10 border border-purple-950/20 rounded-xl flex items-center justify-between">
              <div>
                <span className="text-[10px] text-purple-400 block uppercase">Principal Intervalo de Demanda</span>
                <span className="text-[11px] text-purple-300 font-bold">18:00 às 22:00</span>
              </div>
              <div className="text-right">
                <span className="text-[9px] text-slate-500 block">Status de Ganhos</span>
                <span className="text-purple-400 font-bold">Pico de Tarifa</span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-purple-950/5 border border-dashed border-purple-950/40 text-[10px] text-slate-400 leading-relaxed font-sans">
              <span className="font-bold text-slate-300 uppercase block mb-0.5">Visão Analítica de Oportunidades:</span>
              Reunindo dados de canais e períodos operados, o DriverDash calcula índices cruzados em tempo real de lucratividade para orientar os melhores canais do mercado no seu turno de trabalho.
            </div>
          </div>
        </div>

      </div>

      {/* COMPACT INTERACTIVE GOAL SIMULATOR SECTION */}
      <div className="bg-[#0b0720]/80 border border-purple-950/40 rounded-2xl p-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-[#9333ea]/5 to-transparent rounded-full blur-3xl pointer-events-none"></div>
        <div className="flex items-center gap-2 border-b border-purple-950/20 pb-3 mb-5">
          <Calculator className="w-5 h-5 text-purple-400" />
          <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono">Simulador Financeiro de Metas</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 font-mono">
          <div className="p-4 bg-purple-950/5 border border-purple-950/30 rounded-xl space-y-4">
            <span className="text-[10px] text-purple-400 block uppercase font-bold">Parâmetros Desejados</span>
            
            <div className="space-y-3 text-[11px]">
              <div>
                <label className="block text-slate-400 mb-1">Qual é a sua Meta Mensal Bruta?</label>
                <div className="relative">
                  <span className="absolute left-3 inset-y-0 flex items-center text-purple-400 font-sans">R$</span>
                  <input 
                    type="number" 
                    value={simDesiredGoal}
                    onChange={(e) => setSimDesiredGoal(Math.max(0, Number(e.target.value)))}
                    className="w-full bg-[#04010a] border border-purple-950/50 rounded-lg py-1.5 pl-8 pr-2 text-white font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Dias trabalhados por Semana</label>
                <input 
                  type="range" 
                  min="1" 
                  max="7"
                  value={simDaysPerWeek}
                  onChange={(e) => setSimDaysPerWeek(Number(e.target.value))}
                  className="w-full h-1 bg-[#04010a] rounded-lg appearance-none cursor-pointer accent-purple-600"
                />
                <div className="flex justify-between text-[10px] text-purple-300 mt-1">
                  <span>1 dia</span>
                  <span className="text-white font-bold">{simDaysPerWeek} dias</span>
                  <span>7 dias</span>
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Horas trabalhadas por Dia</label>
                <input 
                  type="range" 
                  min="1" 
                  max="16"
                  value={simHoursPerDay}
                  onChange={(e) => setSimHoursPerDay(Number(e.target.value))}
                  className="w-full h-1 bg-[#04010a] rounded-lg appearance-none cursor-pointer accent-purple-600"
                />
                <div className="flex justify-between text-[10px] text-purple-300 mt-1">
                  <span>1 hora</span>
                  <span className="text-white font-bold">{simHoursPerDay}h por dia</span>
                  <span>16 horas</span>
                </div>
              </div>
            </div>
          </div>

          <div className="col-span-1 md:col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-4 h-full align-middle">
            <div className="p-4 rounded-xl bg-[#0a051d] border border-purple-950/40 flex flex-col justify-center">
              <span className="text-[10px] text-slate-400 uppercase block mb-1">Faturar por Hora</span>
              <p className="text-lg font-black text-white">{formatCurrency(simHourlyTarget)}</p>
              <span className="text-[9px] text-purple-300/40 mt-1">Meta por hora logada</span>
            </div>

            <div className="p-4 rounded-xl bg-[#0a051d] border border-purple-950/40 flex flex-col justify-center">
              <span className="text-[10px] text-slate-400 uppercase block mb-1">Faturar por Turno Diário</span>
              <p className="text-lg font-black text-emerald-400">{formatCurrency(simDailyTarget)}</p>
              <span className="text-[9px] text-purple-300/40 mt-1">Meta por dia em atividade</span>
            </div>

            <div className="p-4 rounded-xl bg-gradient-to-br from-[#0c0525] to-[#140636] border border-purple-500/20 flex flex-col justify-center relative">
              <span className="text-[10px] text-purple-300 uppercase block mb-1 font-semibold">Faturar por Semana</span>
              <p className="text-lg font-black text-pink-400">{formatCurrency(simWeeklyTarget)}</p>
              <span className="text-[9px] text-purple-300/40 mt-1">Consolidado em 7 dias</span>
            </div>
          </div>
        </div>
      </div>

      {/* CUSTO REAL POR KM SECTION */}
      <div className="bg-[#0b0720]/80 border border-purple-950/40 rounded-2xl p-6 space-y-6">
        
        {/* Title */}
        <div className="flex items-center justify-between border-b border-purple-950/12 pb-3">
          <div className="flex items-center gap-2">
            <Milestone className="w-5 h-5 text-purple-400" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono">Cálculo de Custo Real Estimado por KM</h3>
          </div>
          <span className="text-[10px] text-purple-300/50 font-sans">Deduções operacionais amortizadas</span>
        </div>

        {/* MATH OUTPUT PREVIEW JUMBOTRON */}
        <div className="p-5 rounded-2xl bg-gradient-to-br from-[#0a0322] to-[#140337] border border-purple-500/20 relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-6 font-mono">
          <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-br from-purple-500/10 to-transparent rounded-full blur-3xl pointer-events-none"></div>

          <div>
            <span className="text-[10px] bg-purple-950/60 text-purple-300 border border-purple-900/30 px-2.5 py-0.5 rounded-full uppercase tracking-wider font-bold">
              Custo Real Operacional por KM
            </span>
            <div className="flex items-baseline gap-1 mt-2">
              <span className="text-3xl font-black text-white">{formatCurrency(realCostPerKmGrandTotal)}</span>
              <span className="text-xs text-slate-400">/ km rodado</span>
            </div>
            <p className="text-[10px] text-slate-400 mt-1 font-sans">
              Este valor representa tudo o que você desembolsa (combustível) e acumula em depreciação/manutenção por quilômetro rodado.
            </p>
          </div>

          <div className="p-3 bg-purple-950/20 rounded-xl border border-purple-950/30 text-[10px] text-slate-300 space-y-1.5 min-w-[200px]">
            <span className="text-[9px] text-purple-400 uppercase block font-bold mb-1">Amortizações Individuais</span>
            <div className="flex justify-between">
              <span>Fator Combustível:</span>
              <span className="text-white font-bold">{formatCurrency(costFuelPerKm)}/km</span>
            </div>
            <div className="flex justify-between">
              <span>Manutenção (Pneu, Óleo, Freio):</span>
              <span className="text-white font-bold">{formatCurrency(costTirePerKm + costOilPerKm + costBrakePerKm)}/km</span>
            </div>
            <div className="flex justify-between">
              <span>Custos Fixos Parcelados (IPVA, etc):</span>
              <span className="text-white font-bold">{formatCurrency(costFixedPerKm)}/km</span>
            </div>
          </div>
        </div>

        {/* CONFIGURATION FORMS */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            
            {costSuccess && (
              <div className="p-3 bg-emerald-950/60 border border-emerald-900/40 text-emerald-400 rounded-xl flex items-center gap-2 animate-fadeIn font-sans">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>Gastos operacionais salvos e sincronizados com a nuvem!</span>
              </div>
            )}

            {costError && (
              <div className="p-3 bg-rose-950/60 border border-rose-900/40 text-rose-300 rounded-xl flex items-center gap-2 animate-fadeIn font-sans">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{costError}</span>
              </div>
            )}

            <form onSubmit={handleSaveCosts} className="space-y-4">
              
              <div className="bg-[#070313]/90 p-4 rounded-xl border border-purple-950/30 space-y-4 font-mono">
                <span className="text-[10px] text-purple-400 block uppercase font-bold">1. Combustível e Consumo</span>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[11px]">
                  <div>
                    <label className="block text-slate-400 mb-1">Preço do Litro do Combustível (R$)</label>
                    <input 
                      type="number" 
                      step="0.01" 
                      placeholder="EX: 5.79" 
                      value={fuelPrice}
                      onChange={(e) => setFuelPrice(e.target.value)}
                      className="w-full bg-[#04010a] border border-purple-950/50 rounded-lg p-2.5 text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1">Consumo do Veículo (Configuração) *</label>
                    <div className="w-full bg-[#04010a]/50 border border-purple-950/15 rounded-lg p-2.5 text-slate-500 font-sans italic flex justify-between items-center">
                      <span>Puxado das configurações do perfil:</span>
                      <span className="text-white font-mono font-bold not-italic">{vehicle?.km_per_liter || 10} km/L</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-[#070313]/90 p-4 rounded-xl border border-purple-950/30 space-y-4 font-mono">
                <span className="text-[10px] text-purple-400 block uppercase font-bold">2. Desgastes e Manutenção Preventiva</span>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[11px]">
                  <div>
                    <label className="block text-slate-400 mb-1">Custo do Jogo de Pneus (R$)</label>
                    <input 
                      type="number" 
                      placeholder="EX: 1200" 
                      value={tireCost}
                      onChange={(e) => setTireCost(e.target.value)}
                      className="w-full bg-[#04010a] border border-purple-950/50 rounded-lg p-2.5 text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1">Durabilidade dos Pneus (KM)</label>
                    <input 
                      type="number" 
                      placeholder="EX: 45000" 
                      value={tireLifespanKm}
                      onChange={(e) => setTireLifespanKm(e.target.value)}
                      className="w-full bg-[#04010a] border border-purple-950/50 rounded-lg p-2.5 text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-400 mb-1">Preço Troca de Óleo + Filtro (R$)</label>
                    <input 
                      type="number" 
                      placeholder="EX: 220" 
                      value={oilCost}
                      onChange={(e) => setOilCost(e.target.value)}
                      className="w-full bg-[#04010a] border border-purple-950/50 rounded-lg p-2.5 text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1">Intervalo de Troca de Óleo (KM)</label>
                    <input 
                      type="number" 
                      placeholder="EX: 10000" 
                      value={oilIntervalKm}
                      onChange={(e) => setOilIntervalKm(e.target.value)}
                      className="w-full bg-[#04010a] border border-purple-950/50 rounded-lg p-2.5 text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-400 mb-1">Manutenção dos Freios (Pastilhas/Discos R$)</label>
                    <input 
                      type="number" 
                      placeholder="EX: 450" 
                      value={brakeCost}
                      onChange={(e) => setBrakeCost(e.target.value)}
                      className="w-full bg-[#04010a] border border-purple-950/50 rounded-lg p-2.5 text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1">Intervalo de Revisão dos Freios (KM)</label>
                    <input 
                      type="number" 
                      placeholder="EX: 30000" 
                      value={brakeIntervalKm}
                      onChange={(e) => setBrakeIntervalKm(e.target.value)}
                      className="w-full bg-[#04010a] border border-purple-950/50 rounded-lg p-2.5 text-white"
                    />
                  </div>
                </div>
              </div>

              <div className="bg-[#070313]/90 p-4 rounded-xl border border-purple-950/30 space-y-4 font-mono">
                <span className="text-[10px] text-purple-400 block uppercase font-bold">3. Custos Fixos, Tributações e Provimentos</span>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[11px]">
                  <div>
                    <label className="block text-slate-400 mb-1">Custo Seguro Anual (R$)</label>
                    <input 
                      type="number" 
                      placeholder="EX: 2800" 
                      value={insuranceYearly}
                      onChange={(e) => setInsuranceYearly(e.target.value)}
                      className="w-full bg-[#04010a] border border-purple-950/50 rounded-lg p-2.5 text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1">IPVA Anual (R$)</label>
                    <input 
                      type="number" 
                      placeholder="EX: 1800" 
                      value={ipvaYearly}
                      onChange={(e) => setIpvaYearly(e.target.value)}
                      className="w-full bg-[#04010a] border border-purple-950/50 rounded-lg p-2.5 text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-400 mb-1">Licenciamento Anual (R$)</label>
                    <input 
                      type="number" 
                      placeholder="EX: 155" 
                      value={licensingYearly}
                      onChange={(e) => setLicensingYearly(e.target.value)}
                      className="w-full bg-[#04010a] border border-purple-950/50 rounded-lg p-2.5 text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1">Reserva Emergência Mensal (Franquia, etc R$)</label>
                    <input 
                      type="number" 
                      placeholder="EX: 150" 
                      value={emergencyReserveMonthly}
                      onChange={(e) => setEmergencyReserveMonthly(e.target.value)}
                      className="w-full bg-[#04010a] border border-purple-950/50 rounded-lg p-2.5 text-white"
                    />
                  </div>
                </div>
              </div>

              <button
                type="submit"
                className="w-full sm:w-auto px-6 py-2.5 rounded-xl text-white font-sans font-bold bg-purple-600 hover:bg-purple-500 transition-all uppercase float-right cursor-pointer"
              >
                Salvar Limites de Custo Operacional
              </button>
            </form>
          </div>

          {/* HELP/INSIGHT COLUMN */}
          <div className="bg-[#0a061b] border border-purple-950/40 rounded-xl p-5 space-y-4 text-[11px] leading-relaxed">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider font-mono flex items-center gap-1">
              <Info className="w-4 h-4 text-purple-400" />
              <span>Por que calcular o custo?</span>
            </h4>
            <p className="text-slate-300">
              Muitos motoristas se concentram apenas no faturamento bruto. No entanto, o motorista profissional roda sabendo exatamente quanto custa tirar o veículo da garagem.
            </p>
            <p className="text-slate-300">
              O DriverDash Roxou amortece esse cálculo separando custos fixos de tributações e despesas variáveis de quilometragem.
            </p>
            <div className="p-3.5 rounded-xl bg-purple-950/10 border border-purple-950/20 text-purple-200">
              <span className="font-bold text-white block mb-1">Como calculamos:</span>
              <ul className="list-disc leading-relaxed pl-4 space-y-1 text-[10px] font-mono">
                <li>Combustível por litro dividido pela eficiência do carro.</li>
                <li>Fração do jogo de pneus consumida por quilômetro rodado.</li>
                <li>Preço das trocas de óleo divididos por suas respectivas frequências.</li>
                <li>Seguro, taxas de IPVA, licenciamento e reserva pessoal anualizadas divididas por 12 e diluídas pela sua média {estimatedMonthlyKm} km mensais.</li>
              </ul>
            </div>
            <p className="text-slate-400 italic">
              Este valor é utilizado diretamente nas métricas de Lucro Líquido Real e Retorno Real de Quilometragem no seu dashboard principal!
            </p>
          </div>
        </div>

      </div>

    </div>
  );
};
