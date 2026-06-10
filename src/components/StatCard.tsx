import React from 'react';
import { motion } from 'motion/react';
import * as Icons from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  iconName: keyof typeof Icons;
  description?: string;
  trend?: {
    value: string | number;
    isPositive: boolean;
  };
  glowColor?: string;
}

export const StatCard: React.FC<StatCardProps> = ({ 
  title, 
  value, 
  iconName, 
  description, 
  trend,
  glowColor = 'group-hover:border-purple-500/50'
}) => {
  // Dynamically resolve lucide icon
  const IconComponent = Icons[iconName] as React.ComponentType<{ className?: string }>;

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4, scale: 1.01 }}
      className={`group relative bg-[#0d0921]/60 backdrop-blur-xl border border-purple-950/40 rounded-2xl p-6 transition-all duration-300 shadow-[0_4px_30px_rgba(0,0,0,0.4)] hover:shadow-[0_12px_40px_rgba(147,51,234,0.1)]`}
    >
      {/* Decorative gradient light corner */}
      <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/5 rounded-full blur-2xl pointer-events-none transition-opacity duration-300 opacity-60 group-hover:opacity-100"></div>

      <div className="flex justify-between items-start">
        <div className="space-y-1">
          <p className="text-xs text-purple-300/60 font-medium tracking-wide uppercase">{title}</p>
          <h3 className="text-3xl font-bold text-white tracking-tight">{value}</h3>
        </div>
        
        <div className="p-3 bg-purple-950/30 rounded-xl border border-purple-900/40 text-purple-400 group-hover:text-purple-300 group-hover:bg-purple-900/40 transition-colors duration-300">
          {IconComponent && <IconComponent className="w-5 h-5" />}
        </div>
      </div>

      {(description || trend) && (
        <div className="mt-4 flex items-center justify-between border-t border-purple-950/20 pt-3">
          {description && (
            <span className="text-xs text-purple-300/40 font-mono tracking-wide">{description}</span>
          )}
          {trend && (
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
              trend.isPositive 
                ? 'bg-emerald-950/40 text-emerald-400 border border-emerald-900/30' 
                : 'bg-rose-950/40 text-rose-400 border border-rose-900/30'
            }`}>
              {trend.value}
            </span>
          )}
        </div>
      )}
    </motion.div>
  );
};
