/**
 * Professional Drivers Journey History (Histórico de Jornadas)
 * Route: /jornadas
 * Responsibility: Lists completed journeys with dynamic period filters (today, week, month, custom) and telemetry summaries.
 */

import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { reconstructJourneyFromPoints } from '../modules/journey/journey.calculations';
import { 
  Calendar, Clock, Milestone, ArrowRight, MapPin, Search, Filter, 
  Map, TrendingUp, AlertCircle, Sparkles, ChevronRight, Fuel, DollarSign
} from 'lucide-react';
import { motion } from 'motion/react';

export const JornadasHistoryPage: React.FC = () => {
  const { driverSessions, routePoints, vehicle, vehicleCostSettings, earnings } = useApp();
  const navigate = useNavigate();

  // Filters state
  const [filterPeriod, setFilterPeriod] = useState<'today' | 'week' | 'month' | 'custom'>('month');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  // Helper calculation for a specific session using high-fidelity reconstruction
  const calculateSessionStats = useMemo(() => {
    return (sess: any) => {
      const points = routePoints.filter(p => p.session_id === sess.id);
      const sessionDateStr = new Date(sess.start_time).toISOString().substring(0, 10);
      const dayEarnings = earnings.filter(e => e.date === sessionDateStr);
      
      const reconstructed = reconstructJourneyFromPoints(
        sess,
        points,
        vehicle,
        vehicleCostSettings,
        dayEarnings.map(e => ({ gross_amount: Number(e.gross_amount), platform: e.platform }))
      );

      return {
        totalKm: reconstructed.totalKm,
        passengerKm: reconstructed.kmClassification.productiveKm,
        emptyKm: reconstructed.kmClassification.emptyKm,
        idleMin: reconstructed.idleMinutes,
        avgSpeed: reconstructed.avgSpeed,
        pointsCount: reconstructed.pointsCount,
        netRevenue: reconstructed.financials.netRevenue
      };
    };
  }, [routePoints, vehicle, vehicleCostSettings, earnings]);

  // Filter completed sessions only
  const completedSessions = useMemo(() => {
    return driverSessions
      .filter(s => s.status === 'completed')
      .sort((a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime());
  }, [driverSessions]);

  // Apply periods filters
  const filteredSessions = useMemo(() => {
    const now = new Date();
    
    return completedSessions.filter(s => {
      const sessDate = new Date(s.start_time);
      
      if (filterPeriod === 'today') {
        return sessDate.toDateString() === now.toDateString();
      }
      
      if (filterPeriod === 'week') {
        const checkWeek = new Date();
        checkWeek.setDate(now.getDate() - 7);
        return sessDate >= checkWeek;
      }
      
      if (filterPeriod === 'month') {
        const checkMonth = new Date();
        checkMonth.setMonth(now.getMonth() - 1);
        return sessDate >= checkMonth;
      }
      
      if (filterPeriod === 'custom') {
        if (!customStart && !customEnd) return true;
        const start = customStart ? new Date(customStart + 'T00:00:00') : new Date('2020-01-01');
        const end = customEnd ? new Date(customEnd + 'T23:59:59') : new Date();
        return sessDate >= start && sessDate <= end;
      }
      
      return true;
    });
  }, [completedSessions, filterPeriod, customStart, customEnd]);

  // Translate ISO Date string to gorgeous Portuguese text
  const formatSessDate = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleDateString('pt-BR', {
      weekday: 'long',
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  const formatTimeRange = (startTime: string, endTime?: string) => {
    const start = new Date(startTime).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const end = endTime 
      ? new Date(endTime).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
      : 'Em andamento';
    return `${start} — ${end}`;
  };

  const formatMinutes = (m: number) => {
    const hrs = Math.floor(m / 60);
    const mins = m % 60;
    if (hrs > 0) {
      return `${hrs}h ${mins}m`;
    }
    return `${m} min`;
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(val);
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto font-sans text-left">
      
      {/* Page Header Headers */}
      <div>
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <Calendar className="w-5 h-5 text-purple-400" /> Histórico de Jornadas
        </h2>
        <p className="text-xs text-slate-400">
          Consulte o relatório operacional completo de suas corridas diárias, desvios e eficiências do GPS.
        </p>
      </div>

      {/* Dynamic Filter Controls Toolbar */}
      <div className="p-5 bg-[#0a061d]/80 border border-purple-950/50 rounded-3xl space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-purple-400" />
            <span className="text-xs font-semibold text-purple-300 font-mono uppercase tracking-wider">Período Operacional</span>
          </div>
          
          <div className="flex flex-wrap gap-1.5 bg-[#04010a] p-1 rounded-2xl border border-purple-950/40">
            {[
              { id: 'today', name: 'Hoje' },
              { id: 'week', name: '7 dias' },
              { id: 'month', name: 'Este Mês' },
              { id: 'custom', name: 'Customizado' },
            ].map((p) => (
              <button
                key={p.id}
                onClick={() => setFilterPeriod(p.id as any)}
                className={`px-4 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  filterPeriod === p.id
                    ? 'bg-purple-600 text-white shadow-md shadow-purple-950/30'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-purple-950/20'
                }`}
              >
                {p.name}
              </button>
            ))}
          </div>
        </div>

        {/* Custom interval date entry picker */}
        {filterPeriod === 'custom' && (
          <motion.div 
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-2 gap-4 p-4 rounded-2xl bg-purple-950/10 border border-purple-950/30 max-w-md"
          >
            <div>
              <label className="text-[10px] text-purple-300 font-mono font-semibold block mb-1">DATA INÍCIO</label>
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="w-full bg-[#05020c] border border-purple-950 text-slate-200 rounded-xl px-3 py-1.5 font-mono text-xs focus:ring-1 focus:ring-purple-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="text-[10px] text-purple-300 font-mono font-semibold block mb-1">DATA FIM</label>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="w-full bg-[#05020c] border border-purple-950 text-slate-200 rounded-xl px-3 py-1.5 font-mono text-xs focus:ring-1 focus:ring-purple-500 focus:outline-none"
              />
            </div>
          </motion.div>
        )}
      </div>

      {/* Journeys list result panel */}
      {filteredSessions.length > 0 ? (
        <div className="space-y-4">
          <p className="text-xs text-slate-400 pl-1 font-mono">
            Exibindo {filteredSessions.length} {filteredSessions.length === 1 ? 'jornada concluída' : 'jornadas concluídas'} encontrada(s):
          </p>

          <div className="grid grid-cols-1 gap-4">
            {filteredSessions.map((sess) => {
              const stats = calculateSessionStats(sess);
              
              return (
                <div 
                  key={sess.id}
                  onClick={() => navigate(`/jornadas/${sess.id}`)}
                  className="p-5 md:p-6 bg-[#0a061b]/60 border border-purple-950/40 rounded-3xl hover:border-purple-800/40 hover:bg-gradient-to-r hover:from-purple-950/15 transition-all duration-200 cursor-pointer group shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-6"
                >
                  <div className="space-y-3 flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="text-xs font-bold text-white uppercase truncate">
                        {formatSessDate(sess.start_time)}
                      </span>
                      <span className="text-[10px] font-mono text-purple-400 bg-purple-950/60 border border-purple-900/40 px-2 py-0.5 rounded-md font-semibold select-none">
                        Ref: {sess.id.substring(5, 11).toUpperCase()}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-y-1 gap-x-4 text-xs text-slate-400 font-mono">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                        {formatTimeRange(sess.start_time, sess.end_time)}
                      </span>
                      <span className="text-slate-600">|</span>
                      <span className="flex items-center gap-1">
                        <Milestone className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                        Duração: {formatMinutes(sess.total_duration_minutes || 60)}
                      </span>
                    </div>
                  </div>

                  {/* Telematics stats horizontal block */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pr-2 border-t md:border-t-0 md:border-l border-purple-950/30 pt-4 md:pt-0 md:pl-6 max-w-sm sm:max-w-xl w-full">
                    <div>
                      <span className="text-[9px] text-slate-500 font-mono font-bold block uppercase tracking-wider select-none">KM TOTAL</span>
                      <span className="text-md font-extrabold text-purple-300 font-mono block mt-0.5">
                        {stats.totalKm.toFixed(1)} km
                      </span>
                    </div>

                    <div>
                      <span className="text-[9px] text-slate-500 font-mono block uppercase tracking-wider select-none">PASSAGEIRO</span>
                      <span className="text-xs font-bold text-emerald-400 font-mono block mt-1.5">
                        {stats.passengerKm.toFixed(1)} km
                      </span>
                    </div>

                    <div>
                      <span className="text-[9px] text-slate-500 font-mono block uppercase tracking-wider select-none">LUCRO REAL</span>
                      <span className="text-xs font-bold text-emerald-400 font-mono block mt-1.5">
                        {formatCurrency(stats.netRevenue)}
                      </span>
                    </div>

                    <div className="hidden sm:block">
                      <span className="text-[9px] text-slate-500 font-mono block uppercase tracking-wider select-none">VEL. MÉDIA</span>
                      <span className="text-xs font-bold text-white font-mono block mt-1.5">
                        {stats.avgSpeed} km/h
                      </span>
                    </div>
                  </div>

                  {/* Nav direction pointer */}
                  <div className="self-end md:self-auto text-purple-400 group-hover:text-purple-300 transform group-hover:translate-x-1.5 transition-all text-xs flex items-center gap-1 shrink-0 bg-purple-950/30 p-2.5 rounded-full border border-purple-950/35">
                    <ChevronRight className="w-4 h-4" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="p-12 text-center bg-[#0a061d]/50 rounded-3xl border border-purple-950/30 text-slate-400 flex flex-col items-center justify-center max-w-lg mx-auto">
          <AlertCircle className="w-10 h-10 text-purple-500 mb-4 stroke-1 animate-bounce" />
          <h3 className="text-md font-bold text-white mb-2 font-sans">Nenhuma Jornada Encontrada</h3>
          <p className="text-xs text-slate-400 leading-relaxed mb-6 font-sans">
            Não identificamos registros de jornadas concluídas neste período selecionado no banco local ou em nuvem. Experimente alternar filtros acima.
          </p>
        </div>
      )}
    </div>
  );
};
