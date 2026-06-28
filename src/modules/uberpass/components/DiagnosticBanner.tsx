import React from 'react';
import { motion } from 'motion/react';
import { AlertTriangle, ShieldCheck, Sparkles, TrendingUp } from 'lucide-react';
import { FinancialDiagnosisStatus } from '../hooks/useFinancialDiagnosis';

export interface DiagnosticBannerProps {
  status: FinancialDiagnosisStatus;
  label: string;
  description: string;
  backgroundColor: string;
  borderColor: string;
  textColor: string;
  dotColor: string;
  breakEvenRevenue: number;
  estimatedRevenue: number;
  estimatedSavings: number;
  monthlySavings: number;
  annualSavings: number;
}

export const DiagnosticBanner: React.FC<DiagnosticBannerProps> = ({
  status,
  label,
  description,
  backgroundColor,
  borderColor,
  textColor,
  dotColor,
  breakEvenRevenue,
  estimatedRevenue,
  estimatedSavings,
  monthlySavings,
  annualSavings,
}) => {
  const formatBRL = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  const getIcon = () => {
    switch (status) {
      case 'prejuizo':
        return <AlertTriangle className="w-8 h-8 text-rose-400 shrink-0" />;
      case 'atencao':
        return <AlertTriangle className="w-8 h-8 text-amber-400 shrink-0 animate-bounce" />;
      case 'vale_a_pena':
        return <ShieldCheck className="w-8 h-8 text-indigo-400 shrink-0" />;
      case 'excelente':
        return <Sparkles className="w-8 h-8 text-emerald-400 shrink-0 animate-pulse" />;
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      className={`border rounded-2xl p-6 md:p-8 flex flex-col md:flex-row items-start gap-6 transition-all duration-300 ${backgroundColor} ${borderColor}`}
      id="uberpass-diagnostic-banner"
    >
      <div className="flex items-center gap-4">
        {getIcon()}
        <div>
          <div className="flex items-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full ${dotColor}`} />
            <h3 className="font-extrabold text-lg md:text-xl text-white font-display tracking-tight uppercase">
              {label}
            </h3>
          </div>
          <p className="text-slate-300 text-sm md:text-base leading-relaxed mt-2 font-sans max-w-2xl">
            {description}
          </p>
        </div>
      </div>

      <div className="w-full md:w-auto md:ml-auto self-stretch flex flex-col justify-between pt-4 md:pt-0 border-t md:border-t-0 md:border-l border-white/10 md:pl-6 gap-4 shrink-0">
        <div className="space-y-1">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider font-display">
            PONTO DE BREAK-EVEN
          </span>
          <p className="text-xl font-black text-white font-display tabular-nums">
            {formatBRL(breakEvenRevenue)}
          </p>
        </div>

        {estimatedSavings > 0 ? (
          <div className="space-y-2 bg-slate-950/40 p-4 rounded-xl border border-white/5">
            <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider font-display flex items-center gap-1">
              <TrendingUp className="w-3.5 h-3.5" /> ECONOMIA ESTIMADA COM PASSE
            </span>
            <div className="grid grid-cols-3 gap-4 font-display">
              <div>
                <span className="text-[9px] text-slate-500 block">Por Dia</span>
                <span className="text-sm font-bold text-white tabular-nums">+{formatBRL(estimatedSavings)}</span>
              </div>
              <div>
                <span className="text-[9px] text-slate-500 block">Por Mês</span>
                <span className="text-sm font-bold text-white tabular-nums">+{formatBRL(monthlySavings)}</span>
              </div>
              <div>
                <span className="text-[9px] text-slate-500 block">Por Ano</span>
                <span className="text-sm font-bold text-white tabular-nums">+{formatBRL(annualSavings)}</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-xs text-rose-400 font-semibold font-sans italic bg-rose-950/15 p-3 rounded-xl border border-rose-500/10">
            Você economizará {formatBRL(Math.abs(estimatedSavings))} a MAIS por dia ficando na taxa padrão de {estimatedRevenue > 0 ? `${((breakEvenRevenue / estimatedRevenue) * 100).toFixed(0)}%` : '20%'}.
          </div>
        )}
      </div>
    </motion.div>
  );
};
