import React from 'react';
import { DriverScoreReport } from '../../../services/ai/base.types';
import { DataSourceBadge } from '../../../components/DataSourceBadge';

interface ScoreMeterProps {
  scoreReport: DriverScoreReport;
}

export const ScoreMeter: React.FC<ScoreMeterProps> = ({ scoreReport }) => {
  return (
    <div className="bg-[#0b0821]/80 border border-purple-950/30 p-6 md:p-8 rounded-2xl shadow-xl flex flex-col items-center justify-between text-center min-h-[400px]" id="driver-score-meter-box">
      <div className="space-y-1">
        <span className="text-[10px] font-bold tracking-widest text-purple-400 font-mono uppercase block">SISTEMA EXCLUSIVO</span>
        <h3 className="text-lg font-bold text-white font-display mt-1">DriverScore Rating</h3>
        <p className="text-xs text-slate-400 max-w-sm mt-1">Mede a eficiência geral e rentabilidade operacional da sua jornada.</p>
        <div className="pt-1.5">
          <DataSourceBadge type="simulated" />
        </div>
      </div>

      {/* Circular Radial Gauge */}
      <div className="relative w-48 h-48 flex items-center justify-center my-6">
        <svg className="w-full h-full transform -rotate-90">
          {/* background circle */}
          <circle cx="96" cy="96" r="80" stroke="#1d1045" strokeWidth="12" fill="transparent" />
          {/* dynamic score path */}
          <circle 
            cx="96" 
            cy="96" 
            r="80" 
            stroke="url(#scoreGrad)" 
            strokeWidth="12" 
            fill="transparent" 
            strokeDasharray={502.4}
            strokeDashoffset={502.4 - (502.4 * scoreReport.score) / 100}
            strokeLinecap="round"
          />
          <defs>
            <linearGradient id="scoreGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#c084fc" />
              <stop offset="100%" stopColor="#4f46e5" />
            </linearGradient>
          </defs>
        </svg>
        <div className="absolute flex flex-col items-center">
          <span className="text-4xl font-extrabold text-white tracking-tighter font-mono">{scoreReport.score}</span>
          <span className="text-[10px] font-bold text-purple-400 uppercase tracking-widest font-mono mt-0.5">Rating</span>
        </div>
      </div>

      {/* Level Badge details */}
      <div className="space-y-1 w-full">
        <div className="inline-block px-4 py-1.5 rounded-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-black text-xs uppercase tracking-widest shadow-md">
          NÍVEL {scoreReport.level}
        </div>
        <p className="text-[10px] text-slate-400 font-mono pt-1">Próximo nível: {scoreReport.score >= 95 ? 'Elite Máxima' : scoreReport.score >= 81 ? 'Elite (95 pontos)' : 'Diamante (81 pontos)'}</p>
      </div>
    </div>
  );
};
