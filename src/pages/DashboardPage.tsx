import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { StatCard } from '../components/StatCard';
import { 
  Plus, Calendar, Milestone, Clock, AlertTriangle, Coins,
  DollarSign, Sparkles, TrendingUp, Car, Percent, Check, 
  Archive, ArrowRight, Award, Bell, Shield, Info, CheckCircle, Crosshair, Activity
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Link, useNavigate } from 'react-router-dom';

export const DashboardPage: React.FC = () => {
  const { 
    metrics, 
    profile, 
    earnings, 
    expenses, 
    vehicle, 
    financialGoal, 
    vehicleCostSettings, 
    smartAlerts,
    markAlertAsRead,
    archiveAlert,
    completeOnboarding,
    driverSessions,
    routePoints
  } = useApp();

  const navigate = useNavigate();

  // Helper format filters
  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  const formatDistance = (val: number) => {
    return `${val.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} km`;
  };

  // Onboarding Checklist Computations
  const hasVehicle = vehicle !== null;
  const hasCosts = vehicleCostSettings !== null;
  const hasGoals = financialGoal !== null;
  const hasEarning = earnings.length > 0;
  const hasCompletedSetup = profile?.onboarding_completed === true;

  let onboardingProgress = 0;
  if (hasVehicle) onboardingProgress += 20;
  if (hasCosts) onboardingProgress += 20;
  if (hasGoals) onboardingProgress += 20;
  if (hasEarning) onboardingProgress += 20;
  if (hasCompletedSetup) onboardingProgress += 20;

  // Real-time calculations
  const todayStr = new Date().toISOString().split('T')[0];
  const todayEarnings = earnings.filter(e => e.date === todayStr);
  const todayGross = todayEarnings.reduce((sum, e) => sum + Number(e.gross_amount), 0);
  
  const todayExpensesList = expenses.filter(ex => ex.date === todayStr);
  const todayExpensesSum = todayExpensesList.reduce((sum, e) => sum + Number(e.amount), 0);
  const todayNet = todayGross - todayExpensesSum;

  const dailyGoalVal = financialGoal?.daily_goal || 0;
  const dailyPercent = dailyGoalVal > 0 ? Math.min(100, (todayGross / dailyGoalVal) * 100) : 0;
  const dailyRemaining = Math.max(0, dailyGoalVal - todayGross);

  // Monthly Projection
  const uniqueDatesArr = Array.from(new Set(earnings.map(e => e.date)));
  const totalDaysWorked = uniqueDatesArr.length || 1;
  const averageGrossPerDay = metrics.totalRevenue / totalDaysWorked;
  const projectedMonthlyGross = averageGrossPerDay * 30;

  // Geolocation & Session metrics for "Hoje"
  const activeSessionDef = (driverSessions || []).find(s => s.status === 'active');
  const todaySessionsList = (driverSessions || []).filter(s => s.start_time.split('T')[0] === todayStr);

  const computeHaversine = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const activePts = activeSessionDef
    ? (routePoints || [])
        .filter(p => p.session_id === activeSessionDef.id)
        .sort((a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime())
    : [];

  const activeSessKm = React.useMemo(() => {
    let d = 0;
    for (let i = 1; i < activePts.length; i++) {
      d += computeHaversine(activePts[i-1].latitude, activePts[i-1].longitude, activePts[i].latitude, activePts[i].longitude);
    }
    return d;
  }, [activePts]);

  const todayCompletedSessionsKm = todaySessionsList.reduce((sum, s) => {
    if (s.status === 'active') return sum;
    return sum + (s.total_distance_km || 0);
  }, 0);

  const todayTotalJornadaKm = todayCompletedSessionsKm + activeSessKm;

  const activeSessMinutes = activeSessionDef
    ? Math.max(0, (new Date().getTime() - new Date(activeSessionDef.start_time).getTime()) / 60000)
    : 0;

  const todayCompletedSessMinutes = todaySessionsList.reduce((sum, s) => {
    if (s.status === 'active') return sum;
    return sum + (s.total_duration_minutes || 0);
  }, 0);

  const todayTotalOnlineMinutes = todayCompletedSessMinutes + activeSessMinutes;

  const calcPtsStoppedMs = (pts: any[]): number => {
    if (pts.length < 2) return 0;
    let totMs = 0;
    let rStart: number | null = null;
    let rEnd: number | null = null;
    const sorted = [...pts].sort((a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime());
    for (let i = 1; i < sorted.length; i++) {
      const t1 = new Date(sorted[i-1].recorded_at).getTime();
      const t2 = new Date(sorted[i].recorded_at).getTime();
      const dt = t2 - t1;
      if (dt <= 0) continue;
      const d = computeHaversine(sorted[i-1].latitude, sorted[i-1].longitude, sorted[i].latitude, sorted[i].longitude);
      const spd = d / (dt / 3600000);
      if (spd < 5) {
        if (rStart === null) {
          rStart = t1;
          rEnd = t2;
        } else {
          rEnd = t2;
        }
      } else {
        if (rStart !== null && rEnd !== null && (rEnd - rStart) >= 180000) {
          totMs += (rEnd - rStart);
        }
        rStart = null;
        rEnd = null;
      }
    }
    if (rStart !== null && rEnd !== null && (rEnd - rStart) >= 180000) {
      totMs += (rEnd - rStart);
    }
    return totMs;
  };

  const todayTotalStoppedMinutes = React.useMemo(() => {
    let sumMs = 0;
    todaySessionsList.forEach(s => {
      const ptsOfS = (routePoints || []).filter(p => p.session_id === s.id);
      sumMs += calcPtsStoppedMs(ptsOfS);
    });
    return Math.floor(sumMs / 60000);
  }, [todaySessionsList, routePoints]);

  // Alertas ativos
  const activeAlerts = smartAlerts.filter(a => !a.is_read && !a.is_archived);

  // Pendências Check list
  const pendencias: { id: string; label: string; action: () => void }[] = [];
  if (!hasVehicle) {
    pendencias.push({
      id: 'vehicle',
      label: 'Cadastrar seu veículo de trabalho',
      action: () => navigate('/veiculo')
    });
  }
  if (!hasCosts) {
    pendencias.push({
      id: 'costs',
      label: 'Configurar custos estruturais/combustível',
      action: () => navigate('/veiculo')
    });
  }
  if (!hasGoals) {
    pendencias.push({
      id: 'goals',
      label: 'Definir suas metas inteligentes',
      action: () => navigate('/metas')
    });
  }
  if (!hasEarning) {
    pendencias.push({
      id: 'earning',
      label: 'Registrar sua primeira corrida de faturamento',
      action: () => navigate('/financeiro')
    });
  }
  if (!hasCompletedSetup && onboardingProgress === 80) {
    pendencias.push({
      id: 'setup',
      label: 'Onboarding 80% concluído! Clique para ativar conta',
      action: async () => {
        await completeOnboarding();
      }
    });
  }

  return (
    <div className="space-y-8 font-sans">
      
      {/* Top Welcome Title */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-purple-950/25 pb-6">
        <div>
          <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-100 via-purple-300 to-indigo-200">
            Painel Executivo
          </h1>
          <p className="text-xs text-purple-300/60 mt-1">
            Olá, <span className="text-purple-300 font-semibold">{profile?.name || 'Motorista'}</span>. Acompanhe em tempo real a saúde financeira do seu negócio.
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="px-3.5 py-1.5 rounded-xl bg-purple-950/20 border border-purple-900/30 text-purple-300 text-xs font-semibold font-mono flex items-center gap-1.5 uppercase">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            Plano {profile?.plan || 'Free'}
          </div>
          {profile?.role === 'admin' && (
            <Link 
              to="/admin" 
              className="px-3.5 py-1.5 rounded-xl bg-[#c084fc] hover:bg-purple-400 text-purple-950 text-xs font-bold transition-all shadow-[0_0_15px_rgba(192,132,252,0.4)]"
            >
              Menu Admin
            </Link>
          )}
        </div>
      </div>

      {/* ONBOARDING DIALOG / CARD BLOCK */}
      {!hasCompletedSetup && (
        <motion.div 
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="p-6 rounded-2xl bg-gradient-to-br from-[#120935]/80 via-[#0a0521] to-[#04010a] border border-purple-800/40 relative overflow-hidden"
        >
          {/* Subtle cosmic styling inside onboarding wrapper */}
          <div className="absolute top-0 right-0 w-48 h-48 bg-purple-500/10 rounded-full blur-3xl pointer-events-none"></div>
          
          <div className="flex flex-col lg:flex-row justify-between gap-6 relative z-10">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="p-1 px-2.5 bg-purple-950 text-purple-400 font-mono text-xs font-bold rounded-lg border border-purple-900/30">
                  {onboardingProgress}% Concluído
                </span>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  Guia de Integração Operacional <Sparkles className="w-4 h-4 text-purple-400 animate-pulse" />
                </h2>
              </div>
              <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
                Complete as 5 etapas cruciais para que o DriverDash ative os cálculos reais de lucro líquido, depreciação de pneus e manutenção preventiva de forma automática:
              </p>

              {/* Progress Bar */}
              <div className="h-2.5 bg-[#090518] rounded-full overflow-hidden border border-purple-950/50 max-w-md">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${onboardingProgress}%` }}
                  className="h-full bg-gradient-to-r from-purple-600 to-indigo-500 rounded-full"
                ></motion.div>
              </div>
            </div>

            {onboardingProgress === 80 && (
              <button
                onClick={async () => {
                  await completeOnboarding();
                }}
                className="lg:self-center px-5 py-3 bg-gradient-to-r from-purple-600 to-indigo-500 hover:from-purple-500 hover:to-indigo-400 text-white font-bold rounded-xl text-xs flex items-center gap-2 shadow-[0_0_20px_rgba(147,51,234,0.35)] transition-all cursor-pointer active:scale-95"
              >
                <CheckCircle className="w-4 h-4" /> Concluir Setup & Ativar Conta
              </button>
            )}
          </div>

          {/* Interactive Steps List Grid */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3.5 mt-6 border-t border-purple-950/20 pt-4">
            <div className={`p-4 rounded-xl border flex flex-col justify-between h-28 transition-all ${hasVehicle ? 'bg-[#06180e]/40 border-emerald-950/50' : 'bg-[#0f092e]/45 border-purple-950/30'}`}>
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-bold font-mono tracking-wider text-purple-300/50 uppercase">Passo 1</span>
                {hasVehicle ? (
                  <Check className="w-4 h-4 text-emerald-400 bg-emerald-950/70 p-0.5 rounded-full" />
                ) : (
                  <div className="w-1.5 h-1.5 bg-yellow-400 rounded-full animate-ping" />
                )}
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-100">Veículo</p>
                {!hasVehicle ? (
                  <Link to="/veiculo" className="text-[10px] text-purple-400 font-bold hover:underline tracking-wide mt-1 inline-flex items-center gap-0.5">Cadastrar →</Link>
                ) : (
                  <span className="text-[10px] text-emerald-400 font-mono font-medium">Cadastrado</span>
                )}
              </div>
            </div>

            <div className={`p-4 rounded-xl border flex flex-col justify-between h-28 transition-all ${hasCosts ? 'bg-[#06180e]/40 border-emerald-950/50' : 'bg-[#0f092e]/45 border-purple-950/30'}`}>
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-bold font-mono tracking-wider text-purple-300/50 uppercase">Passo 2</span>
                {hasCosts ? (
                  <Check className="w-4 h-4 text-emerald-400 bg-emerald-950/70 p-0.5 rounded-full" />
                ) : (
                  <div className="w-1.5 h-1.5 bg-purple-950 rounded-full" />
                )}
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-100">Custos</p>
                {!hasCosts ? (
                  <Link to="/veiculo" className="text-[10px] text-purple-400 font-bold hover:underline tracking-wide mt-1 inline-flex items-center gap-0.5">Definir Tabela →</Link>
                ) : (
                  <span className="text-[10px] text-emerald-400 font-mono font-medium">Configurado</span>
                )}
              </div>
            </div>

            <div className={`p-4 rounded-xl border flex flex-col justify-between h-28 transition-all ${hasGoals ? 'bg-[#06180e]/40 border-emerald-950/50' : 'bg-[#0f092e]/45 border-purple-950/30'}`}>
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-bold font-mono tracking-wider text-purple-300/50 uppercase">Passo 3</span>
                {hasGoals ? (
                  <Check className="w-4 h-4 text-emerald-400 bg-emerald-950/70 p-0.5 rounded-full" />
                ) : (
                  <div className="w-1.5 h-1.5 bg-purple-950 rounded-full" />
                )}
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-100">Metas</p>
                {!hasGoals ? (
                  <Link to="/metas" className="text-[10px] text-purple-400 font-bold hover:underline tracking-wide mt-1 inline-flex items-center gap-0.5">Criar Metas →</Link>
                ) : (
                  <span className="text-[10px] text-emerald-400 font-mono font-medium">Definidas</span>
                )}
              </div>
            </div>

            <div className={`p-4 rounded-xl border flex flex-col justify-between h-28 transition-all ${hasEarning ? 'bg-[#06180e]/40 border-emerald-950/50' : 'bg-[#0f092e]/45 border-purple-950/30'}`}>
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-bold font-mono tracking-wider text-purple-300/50 uppercase">Passo 4</span>
                {hasEarning ? (
                  <Check className="w-4 h-4 text-emerald-400 bg-emerald-950/70 p-0.5 rounded-full" />
                ) : (
                  <div className="w-1.5 h-1.5 bg-purple-950 rounded-full" />
                )}
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-100">Ganho</p>
                {!hasEarning ? (
                  <Link to="/financeiro" className="text-[10px] text-purple-400 font-bold hover:underline tracking-wide mt-1 inline-flex items-center gap-0.5">Lançar Ganho →</Link>
                ) : (
                  <span className="text-[10px] text-emerald-400 font-mono font-medium">Lançado</span>
                )}
              </div>
            </div>

            <div className={`p-4 rounded-xl border flex flex-col justify-between h-28 transition-all ${hasCompletedSetup ? 'bg-[#06180e]/40 border-emerald-950/50' : 'bg-[#0f092e]/45 border-purple-950/30'}`}>
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-bold font-mono tracking-wider text-purple-300/50 uppercase">Passo 5</span>
                {hasCompletedSetup ? (
                  <Check className="w-4 h-4 text-emerald-400 bg-emerald-950/70 p-0.5 rounded-full" />
                ) : (
                  <div className="w-1.5 h-1.5 bg-purple-950 rounded-full" />
                )}
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-100">Conclusão</p>
                {hasCompletedSetup ? (
                  <span className="text-[10px] text-emerald-400 font-mono font-medium">Concluído</span>
                ) : onboardingProgress === 80 ? (
                  <button onClick={completeOnboarding} className="text-[10px] text-purple-400 font-bold hover:underline text-left mt-1">Concluir Agora →</button>
                ) : (
                  <span className="text-[10px] text-purple-300/40 font-mono">Etapas pendentes</span>
                )}
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* BLOCK 1: TOPO KEY INDICATORS GRID */}
      <div>
        <h3 className="text-xs font-bold font-mono tracking-wider text-purple-400 uppercase mb-3.5">Faturamento & Resultados de Hoje</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard 
            title="Faturamento Hoje"
            value={formatCurrency(todayGross)}
            iconName="DollarSign"
            description="Total bruto arrecadado hoje"
            glowColor="border-purple-500/30"
          />
          <StatCard 
            title="Lucro Hoje"
            value={formatCurrency(todayNet)}
            iconName="Coins"
            description="Faturamento líquido de custos"
            glowColor="border-indigo-500/30"
            trend={todayNet > 0 ? { value: 'Positivo', isPositive: true } : undefined}
          />
          <StatCard 
            title="Meta do Dia"
            value={formatCurrency(dailyGoalVal)}
            iconName="Crosshair"
            description={`${dailyPercent.toFixed(0)}% da meta batida`}
            glowColor="border-fuchsia-500/30"
            trend={dailyGoalVal > 0 ? { value: `Falta R$ ${dailyRemaining.toFixed(0)}`, isPositive: todayGross >= dailyGoalVal } : undefined}
          />
          
          {/* Projeção do Mês - Block / Blur for FREE users */}
          <motion.div
            className="group relative bg-[#0d0921]/60 backdrop-blur-xl border border-purple-950/40 rounded-2xl p-6 transition-all duration-300 shadow-[0_4px_30px_rgba(0,0,0,0.4)]"
            whileHover={{ y: -4, scale: 1.01 }}
          >
            <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/5 rounded-full blur-2xl pointer-events-none transition-opacity duration-300 opacity-60 group-hover:opacity-100"></div>

            <div className="flex justify-between items-start">
              <div className="space-y-1">
                <p className="text-xs text-purple-300/60 font-medium tracking-wide uppercase">Projeção do Mês</p>
                {profile?.plan === 'free' ? (
                  <div className="relative">
                    <h3 className="text-2xl font-bold text-white/20 select-none blur-sm tracking-tight">R$ 12.450,00</h3>
                    <div className="absolute inset-0 flex items-center justify-start">
                      <Link to="/planos" className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-purple-950 text-purple-300 text-[10px] font-bold rounded-lg border border-purple-800/40 hover:bg-purple-900 transition-colors">
                        <Shield className="w-3 h-3 text-purple-400" /> Destravar PRO
                      </Link>
                    </div>
                  </div>
                ) : (
                  <h3 className="text-3xl font-bold text-white tracking-tight">{formatCurrency(projectedMonthlyGross || 0)}</h3>
                )}
              </div>
              <div className="p-3 bg-purple-950/30 rounded-xl border border-purple-900/40 text-purple-400 group-hover:text-purple-300 group-hover:bg-purple-900/40 transition-colors duration-300">
                <TrendingUp className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between border-t border-purple-950/20 pt-3">
              <span className="text-[10px] text-purple-300/40 font-mono tracking-wide">Baseado nos últimos 30 dias</span>
              {profile?.plan !== 'free' && (
                <span className="text-[10px] bg-emerald-950 text-emerald-400 px-2 py-0.5 rounded-full font-semibold border border-emerald-900/30 font-mono">Ativo</span>
              )}
            </div>
          </motion.div>
        </div>
      </div>

      {/* OPERATIONAL TRACKING BLOCK */}
      <div>
        <h3 className="text-xs font-bold font-mono tracking-wider text-purple-400 uppercase mb-3.5 flex items-center justify-between">
          <span>Rastreamento Operacional & Jornada (Hoje)</span>
          <Link to="/jornada" className="text-[10px] text-purple-300 hover:text-white underline font-mono font-medium">Ir para Central de Rastreamento &rarr;</Link>
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard 
            title="Jornada Ativa"
            value={activeSessionDef ? "SIM (Rodando)" : "NÃO (Standby)"}
            iconName="Activity"
            description={activeSessionDef ? "Via sinal GPS de 30s" : "Trabalho pausado"}
            glowColor={activeSessionDef ? "border-emerald-500/40" : "border-purple-950/30"}
          />
          <StatCard 
            title="Tempo Online Hoje"
            value={todayTotalOnlineMinutes > 60 
              ? `${Math.floor(todayTotalOnlineMinutes / 60)}h ${Math.round(todayTotalOnlineMinutes % 60)}m`
              : `${Math.round(todayTotalOnlineMinutes)} min`
            }
            iconName="Clock"
            description="Total acumulado em jornada"
            glowColor="border-purple-500/30"
          />
          <StatCard 
            title="KM Hoje"
            value={`${todayTotalJornadaKm.toFixed(1)} km`}
            iconName="Milestone"
            description="Distância calculada via GPS"
            glowColor="border-indigo-500/30"
          />
          <StatCard 
            title="Tempo Parado Hoje"
            value={todayTotalStoppedMinutes > 60
              ? `${Math.floor(todayTotalStoppedMinutes / 60)}h ${todayTotalStoppedMinutes % 60}m`
              : `${todayTotalStoppedMinutes} min`
            }
            iconName="AlertTriangle"
            description="Tempo ocioso (Velocidade < 5km/h)"
            glowColor="border-amber-500/30"
          />
        </div>
      </div>

      {/* BLOCK 2: SEGUNDO BLOCO OPERACIONAL GRID (Alertas, Pendências, Próximas ações) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Sub-block 1: Alertas */}
        <div className="p-6 rounded-2xl bg-[#0a061b]/60 border border-purple-950/40 flex flex-col h-[320px] justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-purple-950/25 pb-3">
              <div className="flex items-center gap-1.5">
                <Bell className="w-4.5 h-4.5 text-purple-400" />
                <h4 className="text-sm font-bold text-white tracking-wide">Alertas Ativos</h4>
              </div>
              <Link to="/alertas" className="text-[10px] text-purple-300 hover:text-white underline font-mono">Ver todos ({smartAlerts.filter(a => !a.is_archived).length})</Link>
            </div>

            <div className="mt-4 space-y-2.5 overflow-y-auto max-h-[170px] pr-1">
              {activeAlerts.length > 0 ? (
                activeAlerts.slice(0, 3).map((a, idx) => {
                  const realIdx = smartAlerts.findIndex(item => item.id === a.id);
                  return (
                    <div key={a.id || idx} className="p-2.5 rounded-xl bg-purple-950/15 border border-purple-950/30 flex items-start justify-between gap-1">
                      <div className="flex gap-2">
                        <AlertTriangle className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${a.severity === 'high' ? 'text-rose-400' : 'text-purple-400'}`} />
                        <div>
                          <p className="text-xs font-semibold text-white leading-tight">{a.title}</p>
                          <p className="text-[10px] text-slate-400 line-clamp-1 mt-0.5">{a.description}</p>
                        </div>
                      </div>
                      <button 
                        onClick={() => markAlertAsRead(a.id, realIdx)}
                        className="p-1 hover:bg-purple-900/30 rounded text-slate-400 hover:text-emerald-400 shrink-0 cursor-pointer"
                        title="Marcar como Lido"
                      >
                        <Check className="w-3 h-3" />
                      </button>
                    </div>
                  );
                })
              ) : (
                <div className="py-8 text-center text-slate-500 text-xs flex flex-col items-center justify-center">
                  <div className="w-8 h-8 rounded-full bg-purple-950/20 border border-purple-900/20 flex items-center justify-center text-purple-400/50 mb-2">
                    <Check className="w-4 h-4" />
                  </div>
                  Nenhum alerta ativo!
                </div>
              )}
            </div>
          </div>

          <div className="pt-2 bg-gradient-to-t from-[#0a061b] to-transparent">
            <Link to="/alertas" className="w-full py-2 bg-purple-950/30 hover:bg-purple-900/20 border border-purple-905 border-purple-900/20 rounded-xl text-xs font-semibold text-purple-300 hover:text-white flex items-center justify-center gap-1.5 transition-colors">
              Ir para Central de Alertas <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        {/* Sub-block 2: Pendências */}
        <div className="p-6 rounded-2xl bg-[#0a061b]/60 border border-purple-950/40 flex flex-col h-[320px] justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-purple-950/25 pb-3">
              <div className="flex items-center gap-1.5">
                <Shield className="w-4.5 h-4.5 text-purple-400" />
                <h4 className="text-sm font-bold text-white tracking-wide">Pendências Operacionais</h4>
              </div>
              <span className="text-[9px] font-mono bg-purple-950 text-purple-300 px-2 py-0.5 rounded font-black">{pendencias.length} AVISOS</span>
            </div>

            <div className="mt-4 space-y-2.5 overflow-y-auto max-h-[170px] pr-1">
              {pendencias.length > 0 ? (
                pendencias.map((item) => (
                  <button 
                    key={item.id}
                    onClick={item.action}
                    className="w-full text-left p-2.5 rounded-xl bg-amber-950/10 border border-amber-900/20 hover:border-amber-800/40 hover:bg-amber-950/15 flex items-start gap-2.5 transition-all group cursor-pointer"
                  >
                    <Info className="w-3.5 h-3.5 text-amber-500 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs font-medium text-slate-200 leading-tight group-hover:text-amber-300 transition-colors">{item.label}</p>
                      <p className="text-[10px] text-purple-400 font-bold hover:underline mt-0.5">Resolver pendência &rarr;</p>
                    </div>
                  </button>
                ))
              ) : (
                <div className="py-8 text-center text-slate-500 text-xs flex flex-col items-center justify-center">
                  <div className="w-8 h-8 rounded-full bg-emerald-950/20 border border-emerald-900/25 flex items-center justify-center text-emerald-400/70 mb-2">
                    <Check className="w-4 h-4" />
                  </div>
                  Conta operacional 100% calibrada!
                </div>
              )}
            </div>
          </div>

          <p className="text-[10px] text-purple-400/50 font-mono text-center tracking-wide leading-relaxed">
            Mantenha suas calibragens ativas para reter a precisão máxima de auditoria preventiva.
          </p>
        </div>

        {/* Sub-block 3: Próximas Ações */}
        <div className="p-6 rounded-2xl bg-[#0a061b]/60 border border-purple-950/40 flex flex-col h-[320px] justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-purple-950/25 pb-3">
              <div className="flex items-center gap-1.5">
                <Crosshair className="w-4.5 h-4.5 text-purple-400" />
                <h4 className="text-sm font-bold text-white tracking-wide font-sans">Próximas Ações</h4>
              </div>
            </div>

            <div className="mt-4 space-y-2">
              <button 
                onClick={() => navigate('/financeiro')}
                className="w-full p-2 text-left rounded-xl hover:bg-purple-950/20 text-slate-300 text-xs font-semibold flex items-center justify-between group transition-colors cursor-pointer"
              >
                <span>Lançar faturamento de hoje</span>
                <Plus className="w-3.5 h-3.5 text-purple-400 group-hover:translate-x-0.5 transition-transform" />
              </button>
              <button 
                onClick={() => navigate('/veiculo')}
                className="w-full p-2 text-left rounded-xl hover:bg-purple-950/20 text-slate-300 text-xs font-semibold flex items-center justify-between group transition-colors cursor-pointer"
              >
                <span>Verificar manutenções preventivas</span>
                <Car className="w-3.5 h-3.5 text-purple-400 group-hover:translate-x-0.5 transition-transform" />
              </button>
              <button 
                onClick={() => navigate('/metas')}
                className="w-full p-2 text-left rounded-xl hover:bg-purple-950/20 text-slate-300 text-xs font-semibold flex items-center justify-between group transition-colors cursor-pointer"
              >
                <span>Análise de metas inteligentes</span>
                <Award className="w-3.5 h-3.5 text-purple-400 group-hover:translate-x-0.5 transition-transform" />
              </button>
              <button 
                onClick={() => navigate('/insights')}
                className="w-full p-2 text-left rounded-xl hover:bg-purple-950/20 text-slate-300 text-xs font-semibold flex items-center justify-between group transition-colors cursor-pointer"
              >
                <span>Auditar tendências e ticket médio</span>
                <TrendingUp className="w-3.5 h-3.5 text-purple-400 group-hover:translate-x-0.5 transition-transform" />
              </button>
            </div>
          </div>

          <div className="border-t border-purple-950/20 pt-3">
            <span className="text-[9.5px] text-purple-300/40 block text-center font-mono font-medium">AUDITORIA DE PLATAFORMA ATIVA</span>
          </div>
        </div>

      </div>

      {/* BLOCK 3: TERCEIRO BLOCO - ATALHOS RÁPIDOS */}
      <div>
        <h3 className="text-xs font-bold font-mono tracking-wider text-purple-400 uppercase mb-3.5">Atalhos Rápidos Operacionais</h3>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
          <button
            onClick={() => navigate('/financeiro')}
            className="p-4 bg-[#0a061b] hover:bg-[#0f092b] border border-purple-950/30 hover:border-purple-800/40 rounded-xl transition-all flex items-center gap-3.5 group cursor-pointer text-left shadow-sm"
          >
            <div className="p-2.5 bg-purple-950/40 rounded-lg text-purple-400 group-hover:bg-purple-900/30 transition-colors">
              <Plus className="w-4.5 h-4.5" />
            </div>
            <div>
              <p className="text-xs font-bold text-white font-sans leading-tight">Lançar Ganho</p>
              <p className="text-[10px] text-purple-300/40 mt-0.5 font-mono">Entrada faturamento</p>
            </div>
          </button>

          <button
            onClick={() => navigate('/financeiro')}
            className="p-4 bg-[#0a061b] hover:bg-[#0f092b] border border-purple-950/30 hover:border-purple-800/40 rounded-xl transition-all flex items-center gap-3.5 group cursor-pointer text-left shadow-sm"
          >
            <div className="p-2.5 bg-rose-950/30 rounded-lg text-rose-400 group-hover:bg-rose-900/20 transition-colors">
              <Coins className="w-4.5 h-4.5" />
            </div>
            <div>
              <p className="text-xs font-bold text-white font-sans leading-tight">Lançar Despesa</p>
              <p className="text-[10px] text-purple-300/40 mt-0.5 font-mono">Gasolina / taxas</p>
            </div>
          </button>

          <button
            onClick={() => navigate('/insights')}
            className="p-4 bg-[#0a061b] hover:bg-[#0f092b] border border-purple-950/30 hover:border-purple-800/40 rounded-xl transition-all flex items-center gap-3.5 group cursor-pointer text-left shadow-sm"
          >
            <div className="p-2.5 bg-purple-950/40 rounded-lg text-purple-400 group-hover:bg-purple-900/30 transition-colors">
              <TrendingUp className="w-4.5 h-4.5" />
            </div>
            <div>
              <p className="text-xs font-bold text-white font-sans leading-tight">Abrir Insights</p>
              <p className="text-[10px] text-purple-300/40 mt-0.5 font-mono">Auditar ticket médio</p>
            </div>
          </button>

          <button
            onClick={() => navigate('/metas')}
            className="p-4 bg-[#0a061b] hover:bg-[#0f092b] border border-purple-950/30 hover:border-purple-800/40 rounded-xl transition-all flex items-center gap-3.5 group cursor-pointer text-left shadow-sm"
          >
            <div className="p-2.5 bg-purple-950/40 rounded-lg text-purple-400 group-hover:bg-purple-900/30 transition-colors">
              <Award className="w-4.5 h-4.5" />
            </div>
            <div>
              <p className="text-xs font-bold text-white font-sans leading-tight">Abrir Metas</p>
              <p className="text-[10px] text-purple-300/40 mt-0.5 font-mono">Objetivos diários</p>
            </div>
          </button>
        </div>
      </div>

    </div>
  );
};
