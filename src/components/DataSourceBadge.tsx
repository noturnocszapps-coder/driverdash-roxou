import React from 'react';
import { DataSourceType } from '../services/ai/base.types';

export interface DataSourceBadgeProps {
  type: DataSourceType;
  className?: string;
}

export const DataSourceBadge: React.FC<DataSourceBadgeProps> = ({ type, className = '' }) => {
  const configs: Record<DataSourceType, { label: string; style: string }> = {
    real: {
      label: 'REAL',
      style: 'bg-emerald-950/45 text-emerald-400 border-emerald-500/30'
    },
    historical: {
      label: 'HISTÓRICO',
      style: 'bg-blue-950/45 text-blue-400 border-blue-500/30'
    },
    configuration: {
      label: 'CONFIGURAÇÃO',
      style: 'bg-amber-950/45 text-amber-400 border-amber-500/30'
    },
    simulated: {
      label: 'SIMULADO',
      style: 'bg-purple-950/45 text-purple-400 border-purple-500/30'
    }
  };

  const current = configs[type] || configs.simulated;

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider border font-mono ${current.style} ${className}`} id={`ds-badge-${type}`}>
      {current.label}
    </span>
  );
};
