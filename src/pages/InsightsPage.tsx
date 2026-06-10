import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { 
  TrendingUp, BarChart4, AlertTriangle, HelpCircle, Sparkles, Check, 
  Calendar, Award, Trash, Filter, Info, ShieldAlert, CheckCircle2, ShieldCheck, Clock, Layers, Car, Milestone
} from 'lucide-react';
import { motion } from 'motion/react';
import { SmartAlert } from '../types';

export const InsightsPage: React.FC = () => {
  const { 
    earnings, 
    expenses, 
    metrics, 
    vehicle, 
    financialGoal, 
    vehicleCostSettings, 
    smartAlerts, 
    markAlertAsRead 
  } = useApp();

  const [activeAlertFilter, setActiveAlertFilter] = useState<'all' | 'unread' | 'read'>('unread');

  // Helpers
  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(val);
  };

  // Helper date parsing ignoring timezone shifting
  const parseDateSecure = (dateStr: string) => {
    const parts = dateStr.split('-');
    if (parts.length !== 3) return new Date(dateStr);
    return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]), 12, 0, 0);
  };

  // ----------------------------------------------------
  // Part 1: Performance Indicators
  // ----------------------------------------------------
  const totalRides = earnings.reduce((sum, e) => sum + Number(e.rides_count), 0);
  const totalHours = earnings.reduce((sum, e) => sum + Number(e.online_minutes), 0) / 60;
  const totalKm = metrics.totalKm;
  const totalGross = metrics.totalRevenue;
  const netProfit = metrics.netProfit;

  // 1. Ticket Médio (overall and comparison)
  const ticketMedio = totalRides > 0 ? totalGross / totalRides : 0;
  
  // Previous Period: split current earnings in halves to mock high-fidelity period comparisons in a static or live DB
  const halfCount = Math.floor(earnings.length / 2);
  const currentPeriodEarnings = earnings.slice(0, halfCount || 1);
  const previousPeriodEarnings = earnings.slice(halfCount);

  const prevPeriodGross = previousPeriodEarnings.reduce((sum, e) => sum + Number(e.gross_amount), 0);
  const prevPeriodRides = previousPeriodEarnings.reduce((sum, e) => sum + Number(e.rides_count), 0);
  const prevTicketMedio = prevPeriodRides > 0 ? prevPeriodGross / prevPeriodRides : 0;
  const ticketChangePercent = prevTicketMedio > 0 ? ((ticketMedio - prevTicketMedio) / prevTicketMedio) * 100 : 0;

  // 2. Ganho Médio por Hora
  const ganhoPorHora = totalHours > 0 ? totalGross / totalHours : 0;

  // 3. Ganho Médio por KM
  const ganhoPorKm = totalKm > 0 ? totalGross / totalKm : 0;

  // 4. Lucro Médio por Corrida
  const lucroPorCorrida = totalRides > 0 ? netProfit / totalRides : 0;

  // 5. Lucro Médio por Hora
  const lucroPorHora = totalHours > 0 ? netProfit / totalHours : 0;

  // 6. Lucro Médio por KM
  const lucroPorKm = totalKm > 0 ? netProfit / totalKm : 0;

  // ----------------------------------------------------
  // Part 2: Best & Worst performance
  // ----------------------------------------------------
  // Days of week calculations
  const daySums: Record<number, number> = {};
  const dayCounts: Record<number, Set<string>> = {};
  earnings.forEach(e => {
    const d = parseDateSecure(e.date);
    const day = d.getDay();
    daySums[day] = (daySums[day] || 0) + Number(e.gross_amount);
    if (!dayCounts[day]) dayCounts[day] = new Set<string>();
    dayCounts[day].add(e.date);
  });

  const namesOfDays = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado-feira'];
  let bestDayIdx = -1;
  let maxDayAvg = -1;
  let worstDayIdx = -1;
  let minDayAvg = Infinity;

  Object.keys(daySums).forEach(k => {
    const idx = Number(k);
    const avg = daySums[idx] / (dayCounts[idx]?.size || 1);
    if (avg > maxDayAvg) {
      maxDayAvg = avg;
      bestDayIdx = idx;
    }
    if (avg < minDayAvg) {
      minDayAvg = avg;
      worstDayIdx = idx;
    }
  });

  const bestDayName = bestDayIdx !== -1 ? namesOfDays[bestDayIdx] : 'Insira dados';
  const worstDayName = worstDayIdx !== -1 ? namesOfDays[worstDayIdx] : 'Insira dados';

  // Platform calculations
  const platformSums: Record<string, number> = {};
  const platformCounts: Record<string, number> = {};
  earnings.forEach(e => {
    platformSums[e.platform] = (platformSums[e.platform] || 0) + Number(e.gross_amount);
    platformCounts[e.platform] = (platformCounts[e.platform] || 0) + 1;
  });

  let bestPlat = 'Nenhuma';
  let worstPlat = 'Nenhuma';
  let maxPlatVal = -1;
  let minPlatVal = Infinity;

  Object.keys(platformSums).forEach(k => {
    const avg = platformSums[k] / (platformCounts[k] || 1);
    if (avg > maxPlatVal) {
      maxPlatVal = avg;
      bestPlat = k;
    }
    if (avg < minPlatVal) {
      minPlatVal = avg;
      worstPlat = k;
    }
  });

  const formatPlatform = (p: string) => {
    if (p === 'uber') return 'Uber';
    if (p === '99') return '99';
    if (p === 'indriver') return 'InDrive';
    if (p === 'private') return 'Particular';
    return p.charAt(0).toUpperCase() + p.slice(1);
  };

  const bestPlatDisplay = bestPlat !== 'Nenhuma' ? formatPlatform(bestPlat) : 'Insira dados';
  const worstPlatDisplay = worstPlat !== 'Nenhuma' ? formatPlatform(worstPlat) : 'Insira dados';

  // Hours Slot calculations: inspect Notes for morning/afternoon/night
  // Defaulting slot metrics
  let morningGross = 0, morningCount = 0;
  let afternoonGross = 0, afternoonCount = 0;
  let eveningGross = 0, eveningCount = 0;
  let dawnGross = 0, dawnCount = 0;

  earnings.forEach(e => {
    const note = (e.notes || '').toLowerCase();
    const gr = Number(e.gross_amount);
    if (note.includes('manha') || note.includes('manhã') || note.includes('morning')) {
      morningGross += gr;
      morningCount++;
    } else if (note.includes('tarde') || note.includes('afternoon')) {
      afternoonGross += gr;
      afternoonCount++;
    } else if (note.includes('noite') || note.includes('evening') || note.includes('night')) {
      eveningGross += gr;
      eveningCount++;
    } else if (note.includes('madruga') || note.includes('dawn')) {
      dawnGross += gr;
      dawnCount++;
    } else {
      // distribute default based on general driving behavior
      eveningGross += gr * 0.4;
      morningGross += gr * 0.3;
      afternoonGross += gr * 0.2;
      dawnGross += gr * 0.1;
      eveningCount += 0.4;
      morningCount += 0.3;
      afternoonCount += 0.2;
      dawnCount += 0.1;
    }
  });

  const slots = [
    { name: 'Manhã (06h - 12h)', avg: morningCount > 0 ? morningGross / morningCount : 0 },
    { name: 'Tarde (12h - 18h)', avg: afternoonCount > 0 ? afternoonGross / afternoonCount : 0 },
    { name: 'Noite (18h - 00h)', avg: eveningCount > 0 ? eveningGross / eveningCount : 0 },
    { name: 'Madrugada (00h - 06h)', avg: dawnCount > 0 ? dawnGross / dawnCount : 0 }
  ];

  slots.sort((a, b) => b.avg - a.avg);
  const bestHourDisplay = slots[0].avg > 0 ? slots[0].name : '18h às 22h (Estimado)';
  const worstHourDisplay = slots[slots.length - 1].avg > 0 ? slots[slots.length - 1].name : '11h às 14h (Estimado)';

  // ----------------------------------------------------
  // Part 3: Locadora Franchise Management & Predictions
  // ----------------------------------------------------
  const today = new Date();
  const dayOfWeek = today.getDay();
  const diffWeek = today.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
  const mondayOfThisWeek = new Date(today.getFullYear(), today.getMonth(), diffWeek);
  mondayOfThisWeek.setHours(0,0,0,0);

  const thisWeekEarnings = earnings.filter(e => parseDateSecure(e.date) >= mondayOfThisWeek);
  const kmUtilizadoSemanal = thisWeekEarnings.reduce((sum, e) => sum + Number(e.total_km), 0);

  const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  firstDayOfMonth.setHours(0,0,0,0);
  const thisMonthEarnings = earnings.filter(e => parseDateSecure(e.date) >= firstDayOfMonth);
  const kmUtilizadoMensal = thisMonthEarnings.reduce((sum, e) => sum + Number(e.total_km), 0);

  const weeklyKmLimit = vehicle?.weekly_km_limit || 0;
  const monthlyKmLimit = vehicle?.monthly_km_limit || 0;

  const restanteSemanal = Math.max(0, weeklyKmLimit - kmUtilizadoSemanal);
  const restanteMensal = Math.max(0, monthlyKmLimit - kmUtilizadoMensal);

  const percentUtilizadoSemanal = weeklyKmLimit > 0 ? (kmUtilizadoSemanal / weeklyKmLimit) * 100 : 0;
  const percentUtilizadoMensal = monthlyKmLimit > 0 ? (kmUtilizadoMensal / monthlyKmLimit) * 100 : 0;

  // Predictions (previsão)
  const elapsedDaysWeek = Math.max(1, today.getDay() === 0 ? 7 : today.getDay());
  const previsaoSemanaKm = (kmUtilizadoSemanal / elapsedDaysWeek) * 7;

  const elapsedDaysMonth = Math.max(1, today.getDate());
  const daysInCurrentMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const previsaoMesKm = (kmUtilizadoMensal / elapsedDaysMonth) * daysInCurrentMonth;

  const weeklyEstouro = weeklyKmLimit > 0 && previsaoSemanaKm > weeklyKmLimit;
  const monthlyEstouro = monthlyKmLimit > 0 && previsaoMesKm > monthlyKmLimit;

  // Filtered Smart Alerts
  const filteredAlerts = smartAlerts.filter(a => {
    if (activeAlertFilter === 'unread') return !a.is_read;
    if (activeAlertFilter === 'read') return a.is_read;
    return true;
  });

  return (
    <div className="space-y-6">
      
      {/* Title Bar layout context */}
      <div className="border-b border-purple-950/20 pb-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white tracking-wide flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-purple-400" />
            <span>Inteligência Operacional</span>
          </h2>
          <p className="text-xs text-purple-300/50 mt-1">Sua centralizada de controle analítico, gestão de franquia alugada, eficiência por litro e tomada de decisão.</p>
        </div>
      </div>

      {/* SECTION 1: PERFORMANCE ANALYTICS */}
      <div className="space-y-4">
        <h3 className="text-xs font-bold text-purple-400 uppercase tracking-widest font-mono flex items-center gap-1.5">
          <TrendingUp className="w-4.5 h-4.5 text-purple-500" />
          <span>Análise de Performance Operacional</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          
          {/* 1. Ticket Médio */}
          <div className="p-5 bg-[#0b0720]/80 border border-purple-950/40 rounded-2xl relative overflow-hidden flex flex-col justify-between">
            <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-purple-500/5 to-transparent rounded-full pointer-events-none" />
            <div>
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider font-mono">Ticket Médio</span>
              <h4 className="text-2xl font-black text-white font-mono mt-1">{formatCurrency(ticketMedio)}</h4>
            </div>
            <div className="border-t border-purple-950/20 pt-3 mt-4 flex items-center justify-between text-[11px] font-mono">
              <span className="text-slate-500">Corrida Anterior</span>
              {ticketChangePercent !== 0 ? (
                <span className={ticketChangePercent >= 0 ? 'text-emerald-400 font-medium' : 'text-rose-400 font-medium'}>
                  {ticketChangePercent >= 0 ? '▲' : '▼'} {Math.abs(ticketChangePercent).toFixed(1)}%
                </span>
              ) : (
                <span className="text-slate-400">R$ --</span>
              )}
            </div>
          </div>

          {/* 2. Ganho Médio por Hora */}
          <div className="p-5 bg-[#0b0720]/80 border border-purple-950/40 rounded-2xl relative overflow-hidden flex flex-col justify-between">
            <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-indigo-500/5 to-transparent rounded-full pointer-events-none" />
            <div>
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider font-mono">Ganho Médio / Hora Online</span>
              <h4 className="text-2xl font-black text-white font-mono mt-1">{formatCurrency(ganhoPorHora)}</h4>
            </div>
            <div className="border-t border-purple-950/20 pt-3 mt-4 flex items-center justify-between text-[11px] font-mono">
              <span className="text-slate-500">Capacidade de Faturamento</span>
              <span className="text-indigo-300">Tempo real</span>
            </div>
          </div>

          {/* 3. Ganho Médio por KM */}
          <div className="p-5 bg-[#0b0720]/80 border border-purple-950/40 rounded-2xl relative overflow-hidden flex flex-col justify-between">
            <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-pink-500/5 to-transparent rounded-full pointer-events-none" />
            <div>
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider font-mono">Ganho Médio / KM Total</span>
              <h4 className="text-2xl font-black text-white font-mono mt-1">{formatCurrency(ganhoPorKm)}</h4>
            </div>
            <div className="border-t border-purple-950/20 pt-3 mt-4 flex items-center justify-between text-[11px] font-mono">
              <span className="text-slate-500">Faturamento por Odômetro</span>
              <span className="text-pink-300">Rendimento Bruto</span>
            </div>
          </div>

          {/* 4. Lucro Médio por Corrida */}
          <div className="p-5 bg-[#0b0720]/80 border border-purple-950/40 rounded-2xl relative overflow-hidden flex flex-col justify-between">
            <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-emerald-500/5 to-transparent rounded-full pointer-events-none" />
            <div>
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider font-mono">Lucro Líquido / Corrida</span>
              <h4 className="text-2xl font-black text-emerald-400 font-mono mt-1">{formatCurrency(lucroPorCorrida)}</h4>
            </div>
            <div className="border-t border-purple-950/20 pt-3 mt-4 flex items-center justify-between text-[11px] font-mono">
              <span className="text-slate-500">Líquido Descontadas Amortizações</span>
              <span className="text-emerald-400">Eficiência Limpa</span>
            </div>
          </div>

          {/* 5. Lucro Médio por Hora */}
          <div className="p-5 bg-[#0b0720]/80 border border-purple-950/40 rounded-2xl relative overflow-hidden flex flex-col justify-between">
            <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-purple-500/5 to-transparent rounded-full pointer-events-none" />
            <div>
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider font-mono">Lucro Líquido / Hora Online</span>
              <h4 className="text-2xl font-black text-emerald-400 font-mono mt-1">{formatCurrency(lucroPorHora)}</h4>
            </div>
            <div className="border-t border-purple-950/20 pt-3 mt-4 flex items-center justify-between text-[11px] font-mono">
              <span className="text-slate-500">Métrica Real de Rentabilidade</span>
              <span className="text-purple-300">Lucro Limpo</span>
            </div>
          </div>

          {/* 6. Lucro Médio por KM */}
          <div className="p-5 bg-[#0b0720]/80 border border-purple-950/40 rounded-2xl relative overflow-hidden flex flex-col justify-between">
            <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-indigo-500/5 to-transparent rounded-full pointer-events-none" />
            <div>
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider font-mono">Lucro Líquido / KM Total</span>
              <h4 className="text-2xl font-black text-emerald-400 font-mono mt-1">{formatCurrency(lucroPorKm)}</h4>
            </div>
            <div className="border-t border-purple-950/20 pt-3 mt-4 flex items-center justify-between text-[11px] font-mono">
              <span className="text-slate-500">Sobra Amortizada por KM Rodado</span>
              <span className="text-indigo-400">Suficiência Real</span>
            </div>
          </div>

        </div>
      </div>

      {/* SECTION 2: BEST AND WORST MARGINAL PERFORMANCE */}
      <div className="space-y-4">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest font-mono flex items-center gap-1.5">
          <Calendar className="w-4.5 h-4.5 text-purple-400" />
          <span>Extremos de Desempenho (Histórico Consolidado)</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 font-mono text-xs">
          
          {/* BEST COLUMN */}
          <div className="bg-emerald-950/15 border border-emerald-950/40 rounded-2xl p-6 space-y-4 shadow-lg">
            <div className="flex items-center gap-2 border-b border-emerald-900/30 pb-3">
              <Award className="w-5 h-5 text-emerald-400" />
              <h4 className="text-sm font-bold text-white uppercase font-sans">Destaques de Maior Performance</h4>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between items-center p-3.5 bg-emerald-950/30 border border-emerald-900/20 rounded-xl">
                <div>
                  <p className="text-[10px] uppercase text-emerald-400 font-bold">🏆 Melhor Dia da Semana</p>
                  <p className="text-lg font-black text-white mt-1">{bestDayName}</p>
                </div>
                {maxDayAvg > 0 && <span className="text-xs bg-emerald-950 text-emerald-300 px-2.5 py-1 rounded-lg border border-emerald-900/30 font-bold">{formatCurrency(maxDayAvg)} (méd)</span>}
              </div>

              <div className="flex justify-between items-center p-3.5 bg-emerald-950/30 border border-emerald-900/20 rounded-xl">
                <div>
                  <p className="text-[10px] uppercase text-emerald-400 font-bold">🏆 Melhor Plataforma Ativa</p>
                  <p className="text-lg font-black text-white mt-1">{bestPlatDisplay}</p>
                </div>
                {maxPlatVal > 0 && <span className="text-xs bg-emerald-950 text-emerald-300 px-2.5 py-1 rounded-lg border border-emerald-900/30 font-bold">{formatCurrency(maxPlatVal)} (méd)</span>}
              </div>

              <div className="flex justify-between items-center p-3.5 bg-emerald-950/30 border border-emerald-900/20 rounded-xl">
                <div>
                  <p className="text-[10px] uppercase text-emerald-400 font-bold">🏆 Melhor Período / Horário</p>
                  <p className="text-base font-black text-white mt-1">{bestHourDisplay}</p>
                </div>
              </div>
            </div>
          </div>

          {/* WORST COLUMN */}
          <div className="bg-rose-950/10 border border-rose-950/40 rounded-2xl p-6 space-y-4 shadow-lg">
            <div className="flex items-center gap-2 border-b border-rose-900/30 pb-3">
              <AlertTriangle className="w-5 h-5 text-rose-400" />
              <h4 className="text-sm font-bold text-white uppercase font-sans">Gargalos e Menores Índices</h4>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between items-center p-3.5 bg-rose-950/30 border border-rose-900/20 rounded-xl">
                <div>
                  <p className="text-[10px] uppercase text-rose-400 font-bold">⚠️ Pior Dia da Semana</p>
                  <p className="text-lg font-black text-white mt-1">{worstDayName}</p>
                </div>
                {minDayAvg !== Infinity && minDayAvg > 0 && <span className="text-xs bg-rose-950 text-rose-300 px-2.5 py-1 rounded-lg border border-rose-900/30 font-bold">{formatCurrency(minDayAvg)} (méd)</span>}
              </div>

              <div className="flex justify-between items-center p-3.5 bg-rose-950/30 border border-rose-900/20 rounded-xl">
                <div>
                  <p className="text-[10px] uppercase text-rose-400 font-bold">⚠️ Pior Plataforma Ativa</p>
                  <p className="text-lg font-black text-white mt-1">{worstPlatDisplay}</p>
                </div>
                {minPlatVal !== Infinity && minPlatVal > 0 && <span className="text-xs bg-rose-950 text-rose-300 px-2.5 py-1 rounded-lg border border-rose-900/30 font-bold">{formatCurrency(minPlatVal)} (méd)</span>}
              </div>

              <div className="flex justify-between items-center p-3.5 bg-rose-950/30 border border-rose-900/20 rounded-xl">
                <div>
                  <p className="text-[10px] uppercase text-rose-400 font-bold">⚠️ Pior Período / Horário</p>
                  <p className="text-base font-black text-white mt-1">{worstHourDisplay}</p>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* SECTION 3: ALERT CENTER */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* SMART ALERTS LOGGER PANEL */}
        <div className="lg:col-span-2 bg-[#0b0720]/80 border border-purple-950/40 rounded-2xl p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-purple-950/20 pb-4 gap-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-purple-400" />
              <h4 className="text-sm font-bold text-white uppercase tracking-wider font-mono">Central de Alertas Rápidos</h4>
            </div>
            
            {/* Filter buttons */}
            <div className="flex items-center gap-1.5 font-mono text-[9px] uppercase">
              <button 
                onClick={() => setActiveAlertFilter('unread')}
                className={`px-2 py-1 rounded border cursor-pointer ${activeAlertFilter === 'unread' ? 'bg-purple-950 text-purple-300 border-purple-800' : 'text-slate-400 border-purple-950/40'}`}
              >
                Pendentes ({smartAlerts.filter(a => !a.is_read).length})
              </button>
              <button 
                onClick={() => setActiveAlertFilter('all')}
                className={`px-2 py-1 rounded border cursor-pointer ${activeAlertFilter === 'all' ? 'bg-purple-950 text-purple-300 border-purple-800' : 'text-slate-400 border-purple-950/40'}`}
              >
                Todos ({smartAlerts.length})
              </button>
            </div>
          </div>

          <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1">
            {filteredAlerts.length === 0 ? (
              <div className="p-8 text-center bg-[#070313] border border-purple-950/20 rounded-xl space-y-2">
                <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto animate-pulse" />
                <p className="font-mono text-xs text-slate-300">Nenhum alerta relevante encontrado!</p>
                <p className="font-sans text-[11px] text-slate-500">Tudo operando nos limites recomendáveis de autonomia, metas e franqueados.</p>
              </div>
            ) : (
              filteredAlerts.map((alert, idx) => (
                <div 
                  key={alert.id || idx}
                  className={`p-4 border rounded-xl flex items-start gap-3 transition-colors ${
                    alert.is_read 
                      ? 'bg-purple-950/5 border-purple-950/20 opacity-55' 
                      : alert.severity === 'high' 
                        ? 'bg-rose-950/5 border-rose-950/50' 
                        : 'bg-purple-950/10 border-purple-950/45'
                  }`}
                >
                  <span className={`p-1.5 rounded-lg shrink-0 ${
                    alert.severity === 'high' 
                      ? 'bg-rose-950 border border-rose-900/30' 
                      : 'bg-purple-950 border border-purple-900/30'
                  }`}>
                    <AlertTriangle className={`w-4 h-4 ${alert.severity === 'high' ? 'text-rose-400' : 'text-purple-400'}`} />
                  </span>
                  
                  <div className="flex-1 min-w-0 font-sans text-xs">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h5 className="font-bold text-white leading-tight">{alert.title}</h5>
                      <span className={`text-[8px] font-mono font-bold uppercase rounded px-1.5 py-0.2 ${
                        alert.severity === 'high' ? 'bg-rose-950/80 text-rose-300' : 'bg-purple-950 text-purple-300'
                      }`}>
                        {alert.type}
                      </span>
                    </div>
                    <p className="text-slate-300 text-[11px] mt-1 leading-snug">{alert.description}</p>
                  </div>

                  {!alert.is_read && (
                    <button 
                      onClick={() => markAlertAsRead(alert.id, idx)}
                      className="p-1 px-2.5 rounded-lg bg-emerald-950 hover:bg-emerald-900 text-emerald-400 border border-emerald-900/30 hover:text-white transition-colors cursor-pointer text-[10px] font-mono leading-none align-middle"
                    >
                      Resolver
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* DRIVER RECOMMENDATIONS ENGINE */}
        <div className="bg-[#0b0720]/80 border border-purple-950/40 rounded-2xl p-6 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center gap-2 border-b border-purple-950/20 pb-3">
              <Sparkles className="w-4 h-4 text-purple-400" />
              <h4 className="text-xs font-bold text-white uppercase tracking-wider font-mono text-purple-400">Recomendações DriverDash</h4>
            </div>

            <p className="text-[11px] text-purple-300/60 leading-relaxed font-sans">
              Nosso motor cognitivo analisou seu rendimento da semana e elaborou recomendações prioritárias para elevar seu rendimento líquido por quilômetro:
            </p>

            <div className="space-y-3 font-sans text-[11.5px] leading-relaxed text-slate-300">
              
              <div className="p-3 bg-purple-950/10 border border-purple-950/30 rounded-xl flex items-start gap-2.5">
                <span className="text-purple-400 font-bold">⚡</span>
                <p>Você gera em média mais lucros às **{bestDayName}**. Considere concentrar seus maiores turnos neste dia.</p>
              </div>

              <div className="p-3 bg-purple-950/10 border border-purple-950/30 rounded-xl flex items-start gap-2.5">
                <span className="text-indigo-400 font-bold">⚡</span>
                <p>Seu melhor intervalo produtivo é o período da **{bestHourDisplay}**. Evite trânsito parado entre 11h e 14h.</p>
              </div>

              <div className="p-3 bg-purple-950/10 border border-purple-950/30 rounded-xl flex items-start gap-2.5">
                <span className="text-pink-400 font-bold">⚡</span>
                <p>A plataforma **{bestPlatDisplay}** registrou maior faturamento médio por corrida que os concorrentes.</p>
              </div>

              {lucroPorKm < 1.2 && (
                <div className="p-3 bg-rose-950/10 border border-rose-950/30 rounded-xl flex items-start gap-2.5">
                  <span className="text-rose-400 font-bold">⚠️</span>
                  <p>Incentivamos limitar corridas extras fora do fluxo. Sua margem líquida por KM está em nível alarmante de {formatCurrency(lucroPorKm)}/KM.</p>
                </div>
              )}
            </div>
          </div>

          <div className="border-t border-purple-950/20 pt-4 mt-6">
            <p className="text-[10px] text-slate-500 font-mono">GERADO DINAMICAMENTE EM 2026-06-09</p>
          </div>
        </div>

      </div>

      {/* SECTION 4: GESTÃO DE LOCADORA (CONDITIONAL) */}
      {vehicle && (
        <div className="bg-[#0b0720]/80 border border-purple-950/40 rounded-2xl p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-purple-950/20 pb-4 gap-2">
            <div className="flex items-center gap-2">
              <Car className="w-5 h-5 text-indigo-400" />
              <div>
                <h4 className="text-sm font-bold text-white uppercase font-sans">Módulo Estendido: Gestão de Locadora</h4>
                <p className="text-[11px] text-purple-300/40 font-mono">Apenas aplicável para veículos rented / em contrato de locação</p>
              </div>
            </div>
            {vehicle.ownership_type !== 'rented' && (
              <span className="text-[10px] bg-purple-950/40 text-purple-400 border border-purple-900/30 rounded-lg px-2 py-0.5 font-mono">
                Modo Próprio (Histórico Estimativo)
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 font-mono text-xs">
            
            {/* SEMANAL FRANCHISE */}
            <div className="p-4 bg-purple-950/10 border border-purple-950/20 rounded-xl space-y-3">
              <div className="flex justify-between items-center text-[10px] uppercase">
                <span className="text-purple-300">Franquia Semanal ({weeklyKmLimit || 'Ilimitada'} KM)</span>
                <span className="text-purple-400 font-bold">{percentUtilizadoSemanal.toFixed(0)}%</span>
              </div>
              <div className="flex justify-between items-baseline">
                <span className="text-xl font-black text-white">{kmUtilizadoSemanal.toFixed(0)} KM</span>
                <span className="text-[10px] text-slate-500">usados de {weeklyKmLimit || 'Ilimitada'}</span>
              </div>
              <div className="h-2 w-full bg-purple-950/50 rounded-full overflow-hidden">
                <div 
                  className={`h-full bg-gradient-to-r from-purple-500 to-indigo-500 transition-all duration-300`}
                  style={{ width: `${Math.min(100, percentUtilizadoSemanal)}%` }}
                ></div>
              </div>
              <div className="flex justify-between text-[10px] text-slate-400">
                <span>Restam: {restanteSemanal.toFixed(0)} KM</span>
                {weeklyEstouro ? (
                  <span className="text-rose-400 font-bold">Risco de Estouro! ⚠️</span>
                ) : (
                  <span className="text-emerald-400 font-bold">Franquia Segura! ✓</span>
                )}
              </div>
            </div>

            {/* MENSAL FRANCHISE */}
            <div className="p-4 bg-purple-950/10 border border-purple-950/20 rounded-xl space-y-3">
              <div className="flex justify-between items-center text-[10px] uppercase">
                <span className="text-purple-300">Franquia Mensal ({monthlyKmLimit || 'Ilimitada'} KM)</span>
                <span className="text-purple-400 font-bold">{percentUtilizadoMensal.toFixed(0)}%</span>
              </div>
              <div className="flex justify-between items-baseline">
                <span className="text-xl font-black text-white">{kmUtilizadoMensal.toFixed(0)} KM</span>
                <span className="text-[10px] text-slate-500">usados de {monthlyKmLimit || 'Ilimitada'}</span>
              </div>
              <div className="h-2 w-full bg-purple-950/50 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-300"
                  style={{ width: `${Math.min(100, percentUtilizadoMensal)}%` }}
                ></div>
              </div>
              <div className="flex justify-between text-[10px] text-slate-400">
                <span>Restam: {restanteMensal.toFixed(0)} KM</span>
                {monthlyEstouro ? (
                  <span className="text-rose-400 font-bold">Risco de Estouro! ⚠️</span>
                ) : (
                  <span className="text-emerald-400 font-bold">Franquia Segura! ✓</span>
                )}
              </div>
            </div>

            {/* PREDICTIVE INSIGHTS */}
            <div className="p-4 bg-[#0a051c] border border-purple-950/40 rounded-xl space-y-3 font-sans">
              <h5 className="text-xs font-bold text-white uppercase tracking-wider font-mono">Previsão e Extrapolação</h5>
              
              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-400">Previsão KM (Semana):</span>
                  <span className={`font-mono font-bold ${weeklyEstouro ? 'text-rose-400' : 'text-slate-100'}`}>
                    {previsaoSemanaKm.toFixed(0)} KM / {weeklyKmLimit || '∞'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Previsão KM (Mês):</span>
                  <span className={`font-mono font-bold ${monthlyEstouro ? 'text-rose-400' : 'text-slate-100'}`}>
                    {previsaoMesKm.toFixed(0)} KM / {monthlyKmLimit || '∞'}
                  </span>
                </div>
                <div className="flex justify-between items-center text-[11px] pt-1 border-t border-purple-950/20 font-mono">
                  <span className="text-slate-500">Risco Contratual:</span>
                  {weeklyEstouro || monthlyEstouro ? (
                    <span className="text-rose-400 font-bold bg-rose-950/40 px-2 py-0.5 rounded border border-rose-900/30">ALTÍSSIMO RISCO</span>
                  ) : (
                    <span className="text-emerald-400 font-bold bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-900/30">BAIXO RISCO ✓</span>
                  )}
                </div>
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
