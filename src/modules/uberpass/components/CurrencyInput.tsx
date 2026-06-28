import React from 'react';

export interface CurrencyInputProps {
  label: string;
  value: number;
  onChange: (val: number) => void;
  placeholder?: string;
  id?: string;
  step?: string;
  disabled?: boolean;
}

export const CurrencyInput: React.FC<CurrencyInputProps> = ({
  label,
  value,
  onChange,
  placeholder = '0,00',
  id,
  step = '0.01',
  disabled = false
}) => {
  return (
    <div className="space-y-1.5" id={id || `currency-input-${label.toLowerCase().replace(/\s+/g, '-')}`}>
      <label className="block text-xs font-bold text-slate-400 font-display uppercase tracking-wider">
        {label}
      </label>
      <div className="relative rounded-xl overflow-hidden shadow-inner border border-purple-950/20 bg-slate-950/40 focus-within:border-purple-500/50 transition-colors">
        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
          <span className="text-purple-400 font-bold text-sm">R$</span>
        </div>
        <input
          type="number"
          step={step}
          min="0"
          value={value === 0 ? '' : value}
          onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
          placeholder={placeholder}
          disabled={disabled}
          className="block w-full py-3.5 pl-11 pr-4 bg-transparent text-sm text-slate-100 font-extrabold focus:outline-none focus:ring-0 placeholder:text-slate-600 font-sans tracking-wide"
        />
      </div>
    </div>
  );
};
