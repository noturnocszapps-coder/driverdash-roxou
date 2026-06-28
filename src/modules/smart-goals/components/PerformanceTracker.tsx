import React from 'react';
import { Target, ArrowRight } from 'lucide-react';
import { GoalProjection } from '../../../services/ai/base.types';
import { DataSourceBadge } from '../../../components/DataSourceBadge';

interface PerformanceTrackerProps {
  calculatedGoals: GoalProjection;
}

export const PerformanceTracker: React.FC<PerformanceTrackerProps> = ({ calculatedGoals }) => {
  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  const periodCards = [
    { label: 'Projeção Diária', net: calculatedGoals.netDay, gross: calculatedGoals.grossDay, days: 1 },
    { label: 'Projeção Semanal', net: calculatedGoals.netWeek, gross: calculatedGoals.grossWeek, days: 6 },
    { label: 'Projeção Mensal', net: calculatedGoals.netMonth, gross: calculatedGoals.grossMonth, days: 26 },
    { label: 'Projeção Anual', net: calculatedGoals.netYear, gross: calculatedGoals.grossYear, days: 312 },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6" id="goals-performance-tracker">
      {periodCards.map((p, idx) => (
        <div key={idx} className="p-5 rounded-2xl bg-[#0b0821]/80 border border-purple-950/30 shadow-lg flex flex-col justify-between h-[180px]">
          <div className="space-y-3">
            <div className="flex justify-between items-start">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">{p.label}</span>
              <div className="flex gap-1 items-center">
                <DataSourceBadge type="simulated" />
              </div>
            </div>

            <div className="space-y-0.5">
              <span className="text-[10px] text-slate-500 block uppercase font-mono">Meta Líquida</span>
              <h4 className="text-xl font-bold text-emerald-400 font-mono">{formatCurrency(p.net)}</h4>
            </div>
          </div>

          <div className="border-t border-purple-950/10 pt-3 flex justify-between items-center">
            <div>
              <span className="text-[9px] text-slate-500 uppercase block font-mono">Faturamento Bruto</span>
              <span className="text-xs font-semibold text-slate-300 font-mono">{formatCurrency(p.gross)}</span>
            </div>
            <span className="text-[9px] text-purple-400 font-mono font-bold bg-[#04010a] px-2 py-1 rounded border border-purple-950/30">
              {p.days}d de rodagem
            </span>
          </div>
        </div>
      ))}
    </div>
  );
};
