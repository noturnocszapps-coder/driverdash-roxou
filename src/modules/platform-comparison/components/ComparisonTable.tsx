import React from 'react';
import { PlatformMetrics } from '../../../services/ai/base.types';
import { DataSourceBadge } from '../../../components/DataSourceBadge';

interface ComparisonTableProps {
  platformComparison: PlatformMetrics[];
}

export const ComparisonTable: React.FC<ComparisonTableProps> = ({ platformComparison }) => {
  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  return (
    <div className="space-y-4" id="platform-comparison-grid">
      <div className="flex justify-between items-center">
        <span className="text-[10px] font-bold tracking-widest text-purple-400 font-mono uppercase">ESTIMATIVA OPERACIONAL COMPARADA</span>
        <DataSourceBadge type="configuration" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {platformComparison.map((platform, idx) => (
          <div key={idx} className="p-5 rounded-2xl bg-[#0b0821]/80 border border-purple-950/30 shadow-lg flex flex-col justify-between h-[250px] hover:border-purple-800/30 transition-all">
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-slate-100 uppercase tracking-wider">{platform.name}</h4>
              <p className="text-[9px] text-slate-400">ROI do dia: <strong className="text-slate-300 font-mono">{platform.roi.toFixed(0)}%</strong></p>
            </div>

            <div className="space-y-2.5">
              <div>
                <span className="text-[9px] text-slate-400 block uppercase">Faturamento Bruto</span>
                <span className="text-sm font-mono font-bold text-slate-300">{formatCurrency(platform.gross)}</span>
              </div>
              
              <div>
                <span className="text-[9px] text-slate-400 block uppercase">Lucro Líquido Real</span>
                <span className="text-md font-mono font-bold text-emerald-400">{formatCurrency(platform.net)}</span>
              </div>
            </div>

            <div className="border-t border-purple-950/10 pt-2.5 flex justify-between text-[10px] font-mono">
              <span className="text-slate-400">{formatCurrency(platform.profitPerHour)}/h</span>
              <span className="text-slate-400">{formatCurrency(platform.profitPerKm)}/km</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
