import React from 'react';
import { MaintenanceItem } from '../../../services/ai/base.types';
import { DataSourceBadge } from '../../../components/DataSourceBadge';

interface MaintenanceGridProps {
  maintenanceList: MaintenanceItem[];
}

export const MaintenanceGrid: React.FC<MaintenanceGridProps> = ({ maintenanceList }) => {
  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  return (
    <div className="space-y-4" id="maintenance-grid-container">
      <div className="flex justify-between items-center">
        <span className="text-[10px] font-bold tracking-widest text-purple-400 font-mono uppercase">CRONOGRAMA ATIVO</span>
        <DataSourceBadge type="simulated" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {maintenanceList.map((item, idx) => (
          <div key={idx} className="p-5 rounded-2xl bg-[#0b0821]/80 border border-purple-950/30 shadow-lg flex flex-col justify-between h-[190px]">
            <div className="space-y-3">
              <div className="flex justify-between items-start">
                <div>
                  <h4 className="text-sm font-bold text-slate-100">{item.name}</h4>
                  <p className="text-[10px] text-slate-400 leading-relaxed font-sans mt-0.5">{item.description}</p>
                </div>
                <span className={`text-[9px] px-2 py-0.5 rounded font-bold uppercase font-mono border ${
                  item.status === 'critical' 
                    ? 'bg-rose-950 text-rose-400 border-rose-900/30' 
                    : item.status === 'warning' 
                    ? 'bg-amber-950 text-amber-400 border-amber-900/30' 
                    : 'bg-emerald-950 text-emerald-400 border-emerald-900/30'
                }`}>
                  {item.status}
                </span>
              </div>

              {/* Progress Bar */}
              <div className="space-y-1">
                <div className="flex justify-between text-[10px] font-mono text-slate-400">
                  <span>Falta: {item.remainingKm} km</span>
                  <span>Prazo: {item.remainingDays} dias</span>
                </div>
                <div className="h-2 bg-[#04010a] rounded-full overflow-hidden border border-purple-950/40">
                  <div 
                    className={`h-full rounded-full ${
                      item.status === 'critical' ? 'bg-rose-500' : item.status === 'warning' ? 'bg-amber-500' : 'bg-emerald-500'
                    }`}
                    style={{ width: `${Math.max(10, (item.remainingKm / item.intervalKm) * 100)}%` }}
                  ></div>
                </div>
              </div>
            </div>

            <div className="flex justify-between items-center border-t border-purple-950/10 pt-3">
              <span className="text-[10px] text-slate-400 font-mono">Intervalo recomendado: {item.intervalKm} km</span>
              <span className="text-xs font-mono font-bold text-white">Previsão: {formatCurrency(item.estimatedCost)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
