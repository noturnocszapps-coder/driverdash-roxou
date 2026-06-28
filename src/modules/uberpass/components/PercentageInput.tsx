import React from 'react';

export interface PercentageInputProps {
  label: string;
  value: number;
  onChange: (val: number) => void;
  placeholder?: string;
  id?: string;
  min?: number;
  max?: number;
  disabled?: boolean;
}

export const PercentageInput: React.FC<PercentageInputProps> = ({
  label,
  value,
  onChange,
  placeholder = '0',
  id,
  min = 0,
  max = 100,
  disabled = false
}) => {
  return (
    <div className="space-y-1.5" id={id || `percentage-input-${label.toLowerCase().replace(/\s+/g, '-')}`}>
      <label className="block text-xs font-bold text-slate-400 font-display uppercase tracking-wider">
        {label}
      </label>
      <div className="relative rounded-xl overflow-hidden shadow-inner border border-purple-950/20 bg-slate-950/40 focus-within:border-purple-500/50 transition-colors">
        <input
          type="number"
          min={min}
          max={max}
          value={value === 0 ? '' : value}
          onChange={(e) => {
            let val = parseFloat(e.target.value) || 0;
            if (val < min) val = min;
            if (val > max) val = max;
            onChange(val);
          }}
          placeholder={placeholder}
          disabled={disabled}
          className="block w-full py-3.5 pl-4 pr-11 bg-transparent text-sm text-slate-100 font-extrabold focus:outline-none focus:ring-0 placeholder:text-slate-600 font-sans tracking-wide"
        />
        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-4">
          <span className="text-purple-400 font-bold text-sm">%</span>
        </div>
      </div>
    </div>
  );
};
