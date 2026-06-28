import React from 'react';
import { X, Navigation, DollarSign } from 'lucide-react';
import { DemandHotspot } from '../../../services/ai/base.types';

interface HotspotDetailsModalProps {
  hotspot: DemandHotspot;
  onClose: () => void;
}

export const HotspotDetailsModal: React.FC<HotspotDetailsModalProps> = ({ hotspot, onClose }) => {
  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  return (
    <div className="fixed inset-0 bg-[#020005]/85 backdrop-blur-md z-50 flex items-center justify-center p-4" id="hotspot-modal-backdrop">
      <div className="bg-[#0b0821] border border-purple-900/40 w-full max-w-lg rounded-2xl shadow-2xl p-6 md:p-8 space-y-6 relative overflow-hidden" id="hotspot-modal-content">
        {/* Background ambient lighting */}
        <div className="absolute -top-12 -right-12 w-32 h-32 bg-purple-500/10 rounded-full blur-2xl"></div>

        <div className="flex justify-between items-start">
          <div className="space-y-1">
            <span className="text-[10px] font-bold tracking-widest text-purple-400 font-mono uppercase block">DETALHES DA REGIÃO</span>
            <h3 className="text-lg font-bold text-white font-display mt-1">{hotspot.name}</h3>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-lg bg-[#04010a] border border-purple-950/40 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-4.5 h-4.5" />
          </button>
        </div>

        <div className="p-4 bg-[#04010a] border border-purple-950/40 rounded-xl text-xs text-slate-300 leading-relaxed font-sans">
          {hotspot.description}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 bg-[#04010a]/60 border border-purple-950/20 rounded-xl space-y-1">
            <span className="text-[9px] text-slate-500 uppercase font-mono font-bold block">Coordenadas Geográficas</span>
            <span className="text-xs font-mono font-bold text-slate-300 block">{hotspot.latitude.toFixed(4)}, {hotspot.longitude.toFixed(4)}</span>
          </div>

          <div className="p-4 bg-[#04010a]/60 border border-purple-950/20 rounded-xl space-y-1">
            <span className="text-[9px] text-slate-500 uppercase font-mono font-bold block">Intensidade de Pico</span>
            <span className="text-xs font-mono font-bold text-amber-400 block">{hotspot.weight} / 10 Pontos</span>
          </div>
        </div>

        <div className="flex justify-between items-center bg-purple-950/15 border border-purple-900/20 rounded-xl p-4">
          <div className="flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-emerald-400" />
            <div>
              <h5 className="text-xs font-bold text-white font-display">Ticket Médio Estimado</h5>
              <p className="text-[10px] text-slate-400">Faturamento aproximado por corrida</p>
            </div>
          </div>
          <span className="text-lg font-bold font-mono text-emerald-400">{formatCurrency(hotspot.avgTicket)}</span>
        </div>

        <div className="flex gap-3 pt-2">
          <button 
            onClick={onClose}
            className="flex-1 py-3 px-4 rounded-xl border border-purple-950 text-xs font-bold text-slate-400 hover:text-slate-100 hover:bg-purple-950/10 transition-all text-center"
          >
            Fechar Painel
          </button>
          <a
            href={`https://www.google.com/maps/search/?api=1&query=${hotspot.latitude},${hotspot.longitude}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 text-xs font-bold text-white shadow-lg hover:from-purple-500 hover:to-indigo-500 transition-all flex items-center justify-center gap-1.5"
          >
            <Navigation className="w-4 h-4" />
            Navegar para o Local
          </a>
        </div>
      </div>
    </div>
  );
};
