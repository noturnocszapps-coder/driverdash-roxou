import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { 
  Bell, Check, Archive, AlertTriangle, Coins, TrendingUp, Car, Award, CheckCircle, Info, Inbox
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export const AlertsPage: React.FC = () => {
  const { smartAlerts, markAlertAsRead, archiveAlert } = useApp();
  const [filter, setFilter] = useState<'all' | 'active' | 'resolved' | 'critical' | 'financial' | 'rental' | 'goals'>('all');

  const getAlertIcon = (type: string) => {
    switch (type) {
      case 'goal':
        return <Award className="w-5 h-5 text-fuchsia-400" />;
      case 'fuel':
        return <Car className="w-5 h-5 text-amber-400" />;
      case 'profit':
        return <TrendingUp className="w-5 h-5 text-emerald-400" />;
      case 'rental':
        return <Coins className="w-5 h-5 text-cyan-400" />;
      default:
        return <AlertTriangle className="w-5 h-5 text-pink-400" />;
    }
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'high':
        return <span className="text-[9.5px] font-bold px-2 py-0.5 rounded bg-rose-950/70 text-rose-400 border border-rose-800/40 uppercase font-mono">Crítico</span>;
      case 'medium':
        return <span className="text-[9.5px] font-bold px-2 py-0.5 rounded bg-amber-950/70 text-amber-400 border border-amber-800/40 uppercase font-mono">Médio</span>;
      default:
        return <span className="text-[9.5px] font-bold px-2 py-0.5 rounded bg-purple-950/70 text-purple-300 border border-purple-800/20 uppercase font-mono">Baixo</span>;
    }
  };

  const nonArchivedAlerts = smartAlerts.filter(a => !a.is_archived);

  const filteredAlerts = nonArchivedAlerts.filter(alert => {
    if (filter === 'all') return true;
    if (filter === 'active') return !alert.is_read;
    if (filter === 'resolved') return alert.is_read;
    if (filter === 'critical') return alert.severity === 'high';
    if (filter === 'financial') return alert.type === 'profit' || alert.type === 'fuel';
    if (filter === 'rental') return alert.type === 'rental';
    if (filter === 'goals') return alert.type === 'goal';
    return true;
  });

  const activeAlertsCount = nonArchivedAlerts.filter(a => !a.is_read).length;

  return (
    <div className="space-y-6">
      <div className="border-b border-purple-950/20 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="p-2.5 bg-purple-950/40 rounded-xl border border-purple-900/30 text-purple-400">
            <Bell className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white tracking-wide">Central de Alertas Roxou</h2>
            <p className="text-xs text-purple-300/50 mt-0.5">
              Identifique furos de caixa, consumo de franquias de locadoras, perdas de margem e tendências de faturamento.
            </p>
          </div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-wrap gap-1.5 p-1 bg-[#0a051d] rounded-2xl border border-purple-950/20 max-w-fit text-xs font-mono">
        <button
          onClick={() => setFilter('all')}
          className={`px-3 py-1.5 rounded-xl font-medium transition-all cursor-pointer ${
            filter === 'all' ? 'bg-purple-900/40 text-purple-200' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Todos ({nonArchivedAlerts.length})
        </button>
        <button
          onClick={() => setFilter('active')}
          className={`px-3 py-1.5 rounded-xl font-medium transition-all cursor-pointer ${
            filter === 'active' ? 'bg-purple-900/40 text-purple-200' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Ativos ({activeAlertsCount})
        </button>
        <button
          onClick={() => setFilter('resolved')}
          className={`px-3 py-1.5 rounded-xl font-medium transition-all cursor-pointer ${
            filter === 'resolved' ? 'bg-purple-900/40 text-purple-200' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Resolvidos ({nonArchivedAlerts.filter(a => a.is_read).length})
        </button>
        <button
          onClick={() => setFilter('critical')}
          className={`px-3 py-1.5 rounded-xl font-medium transition-all cursor-pointer ${
            filter === 'critical' ? 'bg-rose-950/40 text-rose-400' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Críticos ({nonArchivedAlerts.filter(a => a.severity === 'high').length})
        </button>
        <button
          onClick={() => setFilter('financial')}
          className={`px-3 py-1.5 rounded-xl font-medium transition-all cursor-pointer ${
            filter === 'financial' ? 'bg-purple-900/40 text-purple-200' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Financeiros
        </button>
        <button
          onClick={() => setFilter('rental')}
          className={`px-3 py-1.5 rounded-xl font-medium transition-all cursor-pointer ${
            filter === 'rental' ? 'bg-purple-900/40 text-purple-200' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Locadora
        </button>
        <button
          onClick={() => setFilter('goals')}
          className={`px-3 py-1.5 rounded-xl font-medium transition-all cursor-pointer ${
            filter === 'goals' ? 'bg-purple-900/40 text-purple-200' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Metas
        </button>
      </div>

      {/* Alerts List Container */}
      <div className="space-y-3">
        <AnimatePresence mode="popLayout">
          {filteredAlerts.length > 0 ? (
            filteredAlerts.map((alert, idx) => {
              const localIndex = smartAlerts.findIndex(a => a.id === alert.id);
              return (
                <motion.div
                  key={alert.id || idx}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className={`p-5 rounded-2xl border transition-all flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 ${
                    alert.is_read 
                      ? 'bg-[#060312]/60 border-purple-950/20 opacity-75' 
                      : 'bg-gradient-to-r from-[#0c0525] to-[#04010a] border-purple-800/30 shadow-md'
                  }`}
                >
                  <div className="flex gap-4 items-start">
                    <div className="p-3 bg-[#0c0624] border border-purple-900/30 rounded-xl shrink-0 mt-0.5">
                      {getAlertIcon(alert.type)}
                    </div>
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className={`text-sm font-bold ${alert.is_read ? 'text-slate-300 line-through' : 'text-white'}`}>
                          {alert.title}
                        </h4>
                        {getSeverityBadge(alert.severity)}
                        {alert.is_read && (
                          <span className="text-[8px] bg-emerald-950 text-emerald-400 font-bold px-1.5 py-0.2 rounded border border-emerald-900/30 font-mono">RESOLVIDO</span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 leading-relaxed max-w-2xl">{alert.description}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto justify-end">
                    {!alert.is_read && (
                      <button
                        onClick={() => markAlertAsRead(alert.id, localIndex !== -1 ? localIndex : idx)}
                        className="px-3 py-2 bg-emerald-950/40 hover:bg-emerald-800 border border-emerald-800/40 text-emerald-400 hover:text-white rounded-xl text-xs font-semibold cursor-pointer transition-colors flex items-center gap-1 active:scale-95"
                        title="Marcar como Lido"
                      >
                        <Check className="w-3.5 h-3.5" /> Resolver
                      </button>
                    )}
                    <button
                      onClick={() => archiveAlert(alert.id, localIndex !== -1 ? localIndex : idx)}
                      className="p-2 bg-purple-950/35 hover:bg-purple-900/40 border border-purple-900/20 text-purple-400 hover:text-white rounded-xl text-xs font-semibold cursor-pointer transition-all active:scale-95"
                      title="Arquivar Alerta"
                    >
                      <Archive className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </motion.div>
              );
            })
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="py-16 text-center border border-dashed border-purple-950/40 rounded-3xl bg-[#090518]/20 flex flex-col items-center justify-center"
            >
              <div className="w-12 h-12 rounded-full bg-purple-950/20 border border-purple-900/20 flex items-center justify-center text-purple-400 mb-4">
                <Inbox className="w-5 h-5" />
              </div>
              <h4 className="text-sm font-semibold text-slate-200">Central de Alertas Limpa</h4>
              <p className="text-xs text-purple-300/40 mt-1 max-w-sm">
                Nenhum alerta {filter === 'all' ? '' : `com filtro "${filter}" `}encontrado no momento. Divirta-se pilotando!
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
