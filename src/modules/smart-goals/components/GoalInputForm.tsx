import React from 'react';
import { GoalProjection } from '../../../services/ai/base.types';
import { DataSourceBadge } from '../../../components/DataSourceBadge';

interface GoalInputFormProps {
  targetNetInput: number;
  setTargetNetInput: (val: number) => void;
  targetPeriod: 'day' | 'week' | 'month';
  calculatedGoals: GoalProjection;
}

export const GoalInputForm: React.FC<GoalInputFormProps> = ({
  targetNetInput,
  setTargetNetInput,
  targetPeriod,
  calculatedGoals
}) => {
  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  return (
    <div className="p-6 md:p-8 rounded-2xl bg-[#0b0821]/80 border border-purple-950/30 shadow-xl grid grid-cols-1 md:grid-cols-12 gap-8 items-center" id="goals-input-form-box">
      <div className="md:col-span-5 space-y-4">
        <div className="flex justify-between items-start">
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider font-mono">Lucro Líquido Desejado</label>
            <h3 className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-indigo-300 tracking-tight font-mono select-all pt-1">
              {formatCurrency(targetNetInput)}
            </h3>
          </div>
          <DataSourceBadge type="configuration" />
        </div>

        <input 
          type="range" 
          min={targetPeriod === 'day' ? 50 : targetPeriod === 'week' ? 300 : 1000} 
          max={targetPeriod === 'day' ? 500 : targetPeriod === 'week' ? 3000 : 12000} 
          step={targetPeriod === 'day' ? 10 : targetPeriod === 'week' ? 50 : 100}
          value={targetNetInput} 
          onChange={(e) => setTargetNetInput(Number(e.target.value))}
          className="w-full accent-purple-500 h-2 cursor-pointer bg-purple-950/50 rounded-lg"
        />

        <div className="relative mt-2">
          <span className="absolute inset-y-0 left-3 flex items-center text-slate-500 text-xs font-mono">R$</span>
          <input 
            type="number" 
            value={targetNetInput} 
            onChange={(e) => setTargetNetInput(Number(e.target.value) || 0)}
            className="w-full bg-[#04010a] border border-purple-950/40 rounded-xl py-2.5 pl-8 pr-4 text-xs font-semibold text-slate-200"
          />
        </div>
      </div>

      <div className="md:col-span-7 grid grid-cols-2 md:grid-cols-4 gap-4 border-l border-purple-950/20 pl-0 md:pl-8">
        {/* Revenue required */}
        <div className="space-y-1">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest font-mono">Faturamento Req.</span>
          <h4 className="text-lg font-bold text-white font-mono">{formatCurrency(calculatedGoals.grossDay)}</h4>
          <p className="text-[9px] text-slate-400">Total bruto diário</p>
        </div>

        {/* Profit per hour */}
        <div className="space-y-1">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest font-mono">Lucro / Hora</span>
          <h4 className="text-lg font-bold text-white font-mono">{formatCurrency(calculatedGoals.profitPerHour)}/h</h4>
          <p className="text-[9px] text-slate-400">Meta líquida por hora</p>
        </div>

        {/* Work hours */}
        <div className="space-y-1">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest font-mono">Horas Trab.</span>
          <h4 className="text-lg font-bold text-white font-mono">{calculatedGoals.hours.toFixed(1)} h</h4>
          <p className="text-[9px] text-slate-400">Horas diárias estimadas</p>
        </div>

        {/* Approx KM */}
        <div className="space-y-1">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest font-mono">Distância (KM)</span>
          <h4 className="text-lg font-bold text-white font-mono">{calculatedGoals.km} km</h4>
          <p className="text-[9px] text-slate-400">Rodagem diária prevista</p>
        </div>
      </div>
    </div>
  );
};
