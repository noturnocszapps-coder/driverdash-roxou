import React from 'react';
import { Flame, Zap, MapPin } from 'lucide-react';
import { DemandHotspot } from '../../../services/ai/base.types';
import { DataSourceBadge } from '../../../components/DataSourceBadge';

interface DemandHeatMapProps {
  hotspots: DemandHotspot[];
  onSelectHotspot: (hs: DemandHotspot) => void;
}

export const DemandHeatMap: React.FC<DemandHeatMapProps> = ({ hotspots, onSelectHotspot }) => {
  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  return (
    <div className="space-y-4" id="demand-heatmap-container">
      <div className="flex justify-between items-center">
        <h4 className="text-xs font-bold font-mono text-purple-400 uppercase tracking-wider flex items-center gap-1.5">
          <Flame className="w-4.5 h-4.5 text-purple-400" />
          Zonas Quentes Recomendadas (Eixo São Paulo)
        </h4>
        <DataSourceBadge type="historical" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {hotspots.map((hs) => (
          <div 
            key={hs.id} 
            onClick={() => onSelectHotspot(hs)}
            className="p-5 rounded-2xl bg-[#0b0821]/80 border border-purple-950/30 hover:border-purple-700/50 cursor-pointer shadow-lg transition-all group flex flex-col justify-between h-[180px]"
          >
            <div className="space-y-2.5">
              <div className="flex justify-between items-start">
                <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded border ${
                  hs.type === 'airport' 
                    ? 'bg-sky-950 text-sky-400 border-sky-900/30' 
                    : hs.type === 'event' 
                    ? 'bg-amber-950 text-amber-400 border-amber-900/30'
                    : 'bg-purple-950 text-purple-400 border-purple-900/30'
                }`}>
                  {hs.type}
                </span>

                <div className="flex items-center gap-1 text-amber-400">
                  <Zap className="w-3.5 h-3.5 fill-amber-400/20" />
                  <span className="text-[11px] font-bold font-mono">Pico: {hs.weight}/10</span>
                </div>
              </div>

              <h4 className="text-xs font-bold text-slate-100 group-hover:text-purple-300 transition-colors line-clamp-2">
                {hs.name}
              </h4>
            </div>

            <div className="flex justify-between items-center border-t border-purple-950/10 pt-3">
              <div className="flex items-center gap-1 text-slate-400 text-[10px]">
                <MapPin className="w-3.5 h-3.5" />
                <span>Ver Coordenadas</span>
              </div>
              <span className="text-xs font-mono font-bold text-emerald-400">
                Ticket Médio: {formatCurrency(hs.avgTicket)}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
