import React, { ReactNode } from 'react';
import { motion } from 'motion/react';
import { HelpCircle } from 'lucide-react';

export interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: ReactNode;
  trend?: {
    value: string;
    isPositive: boolean;
  };
  tooltip?: string;
  id?: string;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  subtitle,
  icon,
  trend,
  tooltip,
  id
}) => {
  return (
    <motion.div
      id={id || `metric-card-${title.toLowerCase().replace(/\s+/g, '-')}`}
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
      className="bg-[#0b0821]/60 border border-purple-950/20 rounded-2xl p-6 flex flex-col justify-between transition-all duration-300 hover:border-purple-500/30 hover:shadow-[0_12px_30px_rgba(139,92,246,0.06)] relative overflow-hidden backdrop-blur-md"
    >
      {/* Decorative ambient background blur */}
      <div className="absolute -top-12 -right-12 w-24 h-24 bg-purple-500/5 rounded-full blur-2xl pointer-events-none" />
      
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-1.5 text-slate-400 text-xs font-semibold tracking-wider font-display uppercase">
            <span>{title}</span>
            {tooltip && (
              <div className="group relative">
                <HelpCircle className="w-3.5 h-3.5 text-slate-500 hover:text-purple-400 cursor-pointer transition-colors" />
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-slate-950/95 border border-purple-950 text-[10px] text-slate-300 rounded-lg opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50 shadow-xl leading-relaxed">
                  {tooltip}
                </div>
              </div>
            )}
          </div>
          
          <h4 className="text-[24px] md:text-[28px] font-extrabold text-white mt-2.5 font-display tracking-tight tabular-nums leading-none">
            {value}
          </h4>
        </div>

        {icon && (
          <div className="p-3 bg-purple-950/30 border border-purple-900/20 rounded-xl text-purple-300 shrink-0">
            {icon}
          </div>
        )}
      </div>

      {(subtitle || trend) && (
        <div className="mt-4 pt-4 border-t border-purple-950/10 flex items-center justify-between text-xs font-sans">
          {subtitle && <span className="text-slate-500 truncate max-w-[80%]">{subtitle}</span>}
          {trend && (
            <span className={`font-bold ${trend.isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
              {trend.value}
            </span>
          )}
        </div>
      )}
    </motion.div>
  );
};
