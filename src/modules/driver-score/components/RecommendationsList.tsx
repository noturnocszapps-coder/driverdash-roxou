import React from 'react';
import { Shield } from 'lucide-react';
import { DriverScoreReport } from '../../../services/ai/base.types';

interface RecommendationsListProps {
  scoreReport: DriverScoreReport;
}

export const RecommendationsList: React.FC<RecommendationsListProps> = ({ scoreReport }) => {
  return (
    <div className="bg-[#0b0821]/80 border border-purple-950/30 p-6 rounded-2xl shadow-xl space-y-4" id="driver-score-recommendations-list">
      <h4 className="text-xs font-bold font-mono text-purple-400 uppercase tracking-wider flex items-center gap-1.5 border-b border-purple-950/10 pb-3">
        <Shield className="w-4.5 h-4.5 text-purple-400" />
        Recomendações Práticas para Elevar sua Nota
      </h4>

      <div className="space-y-2">
        {scoreReport.recommendations.map((rec, i) => (
          <div key={i} className="p-3.5 rounded-xl bg-[#04010a] border border-purple-950/40 text-xs text-slate-300 leading-relaxed flex items-start gap-3">
            <div className="p-1 bg-purple-950 text-purple-400 rounded-lg shrink-0 mt-0.5 font-mono text-[10px] font-bold">
              #{i+1}
            </div>
            <span>{rec}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
