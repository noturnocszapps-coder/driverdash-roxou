import React from 'react';
import { CostFrequency } from '../vehicleCost.calculations';

export interface CostInputWithFrequencyProps {
  label: string;
  amount: number;
  frequency: CostFrequency;
  onAmountChange: (val: number) => void;
  onFrequencyChange: (freq: CostFrequency) => void;
  id?: string;
  disabled?: boolean;
}

export const CostInputWithFrequency: React.FC<CostInputWithFrequencyProps> = ({
  label,
  amount,
  frequency,
  onAmountChange,
  onFrequencyChange,
  id,
  disabled = false
}) => {
  return (
    <div className="space-y-1.5" id={id || `cost-freq-${label.toLowerCase().replace(/\s+/g, '-')}`}>
      <label className="block text-xs font-bold text-slate-400 font-display uppercase tracking-wider">
        {label}
      </label>
      <div className="grid grid-cols-12 rounded-xl overflow-hidden border border-purple-950/20 bg-slate-950/40 focus-within:border-purple-500/50 transition-colors">
        {/* Amount Field */}
        <div className="col-span-7 relative flex items-center border-r border-purple-950/20">
          <span className="absolute left-4 text-purple-400 font-bold text-xs select-none">R$</span>
          <input
            type="number"
            min="0"
            step="0.01"
            value={amount === 0 ? '' : amount}
            onChange={(e) => onAmountChange(parseFloat(e.target.value) || 0)}
            disabled={disabled}
            placeholder="0,00"
            className="w-full py-3.5 pl-10 pr-3 bg-transparent text-sm text-slate-100 font-extrabold focus:outline-none placeholder:text-slate-600 font-sans tracking-wide"
          />
        </div>

        {/* Frequency Dropdown */}
        <div className="col-span-5 bg-slate-900/20">
          <select
            value={frequency}
            onChange={(e) => onFrequencyChange(e.target.value as CostFrequency)}
            disabled={disabled}
            className="w-full h-full py-3.5 px-3 bg-transparent text-xs text-slate-300 font-semibold focus:outline-none cursor-pointer"
          >
            <option value="daily" className="bg-[#0b0821]">Diário</option>
            <option value="weekly" className="bg-[#0b0821]">Semanal</option>
            <option value="monthly" className="bg-[#0b0821]">Mensal</option>
            <option value="anual" className="bg-[#0b0821]">Anual</option>
            <option value="km" className="bg-[#0b0821]">Por KM</option>
          </select>
        </div>
      </div>
    </div>
  );
};
