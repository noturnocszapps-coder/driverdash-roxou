import React from 'react';
import { motion } from 'motion/react';

export interface ProgressInsightProps {
  title: string;
  currentValue: number;
  targetValue: number;
  unit?: string;
  formatValue?: (val: number) => string;
  description?: string;
  colorClass?: string;
  id?: string;
}

export const ProgressInsight: React.FC<ProgressInsightProps> = ({
  title,
  currentValue,
  targetValue,
  unit = '',
  formatValue,
  description,
  colorClass = 'from-purple-500 to-indigo-500',
  id
}) => {
  const percentage = targetValue > 0 ? Math.min(100, Math.max(0, (currentValue / targetValue) * 100)) : 0;
  
  const displayCurrent = formatValue ? formatValue(currentValue) : `${currentValue}${unit}`;
  const displayTarget = formatValue ? formatValue(targetValue) : `${targetValue}${unit}`;

  return (
    <div id={id || `progress-insight-${title.toLowerCase().replace(/\s+/g, '-')}`} className="space-y-3 bg-slate-950/30 p-5 rounded-2xl border border-purple-950/10">
      <div className="flex justify-between items-end">
        <div>
          <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider font-display">
            {title}
          </span>
          <div className="flex items-baseline gap-1 mt-1 font-display">
            <span className="text-lg font-extrabold text-white tabular-nums">{displayCurrent}</span>
            <span className="text-xs text-slate-500">de {displayTarget}</span>
          </div>
        </div>
        <span className="text-sm font-bold text-purple-400 tabular-nums">
          {percentage.toFixed(0)}%
        </span>
      </div>

      {/* Progress Track */}
      <div className="h-2 w-full bg-slate-900 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          className={`h-full rounded-full bg-gradient-to-r ${colorClass}`}
        />
      </div>

      {description && (
        <p className="text-slate-500 text-xs font-sans italic leading-relaxed">
          {description}
        </p>
      )}
    </div>
  );
};
