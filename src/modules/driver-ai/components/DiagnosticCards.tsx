import React from 'react';
import { HelpCircle } from 'lucide-react';
import { DriverDailyDiagnostic } from '../../../services/ai/base.types';
import { DataSourceBadge } from '../../../components/DataSourceBadge';

interface DiagnosticCardsProps {
  dailyOutlook: DriverDailyDiagnostic;
  todayKm: number;
  todayGross: number;
  currentCostPerKm: number;
}

export const DiagnosticCards: React.FC<DiagnosticCardsProps> = ({
  dailyOutlook,
  todayKm,
  todayGross,
  currentCostPerKm
}) => {
  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" id="diagnostic-cards-container">
      {/* Q1: Hoje vale a pena trabalhar? */}
      <div className="p-6 rounded-2xl bg-[#0b0821]/80 border border-purple-950/30 flex flex-col justify-between h-[220px] shadow-lg relative overflow-hidden">
        <div className="space-y-3">
          <div className="flex justify-between items-start">
            <HelpCircle className="w-5 h-5 text-purple-400" />
            <div className="flex gap-1.5 items-center">
              <DataSourceBadge type="simulated" />
              <span className="text-[10px] bg-emerald-950 text-emerald-400 border border-emerald-900/30 px-2 py-0.5 rounded font-bold uppercase font-mono">
                DIAGNÓSTICO
              </span>
            </div>
          </div>
          <h4 className="text-sm font-bold text-white">Hoje vale a pena trabalhar?</h4>
          <p className="text-xs text-slate-300 leading-relaxed line-clamp-4">
            {dailyOutlook.shouldWorkToday ? (
              <>
                <span className="text-emerald-400 font-bold">Sim, vale a pena!</span> {dailyOutlook.shouldWorkReason}
              </>
            ) : (
              <>
                <span className="text-rose-400 font-bold">Não recomendado.</span> {dailyOutlook.shouldWorkReason}
              </>
            )}
          </p>
        </div>
        <div className="border-t border-purple-950/10 pt-3 flex justify-between items-center">
          <span className="text-[10px] text-slate-400">Previsão Demanda: <strong className="text-purple-300">Alta</strong></span>
        </div>
      </div>

      {/* Q2: Devo ativar o passe de ganhos hoje? */}
      <div className="p-6 rounded-2xl bg-[#0b0821]/80 border border-purple-950/30 flex flex-col justify-between h-[220px] shadow-lg relative overflow-hidden">
        <div className="space-y-3">
          <div className="flex justify-between items-start">
            <HelpCircle className="w-5 h-5 text-indigo-400" />
            <div className="flex gap-1.5 items-center">
              <DataSourceBadge type="configuration" />
              <span className="text-[10px] bg-indigo-950/40 text-indigo-400 border border-indigo-900/40 px-2 py-0.5 rounded font-bold uppercase font-mono">
                OTIMIZAÇÃO
              </span>
            </div>
          </div>
          <h4 className="text-sm font-bold text-white">Devo ativar o passe de ganhos hoje?</h4>
          <p className="text-xs text-slate-300 leading-relaxed line-clamp-4">
            {dailyOutlook.shouldActivatePass ? (
              <>
                <span className="text-emerald-400 font-bold">Recomendado!</span> {dailyOutlook.passReason}
              </>
            ) : (
              <>
                <span className="text-amber-400 font-bold">Não ativar hoje.</span> {dailyOutlook.passReason}
              </>
            )}
          </p>
        </div>
        <div className="border-t border-purple-950/10 pt-3 flex justify-between items-center">
          <span className="text-[10px] text-slate-400">Tipo Recomendado: <strong className="text-indigo-300">{dailyOutlook.passTypeRecommendation}</strong></span>
        </div>
      </div>

      {/* Q3: Qual melhor horário para trabalhar? */}
      <div className="p-6 rounded-2xl bg-[#0b0821]/80 border border-purple-950/30 flex flex-col justify-between h-[220px] shadow-lg relative overflow-hidden">
        <div className="space-y-3">
          <div className="flex justify-between items-start">
            <HelpCircle className="w-5 h-5 text-fuchsia-400" />
            <div className="flex gap-1.5 items-center">
              <DataSourceBadge type="historical" />
              <span className="text-[10px] bg-fuchsia-950/40 text-fuchsia-400 border border-fuchsia-900/40 px-2 py-0.5 rounded font-bold uppercase font-mono">
                CRONOGRAMA
              </span>
            </div>
          </div>
          <h4 className="text-sm font-bold text-white">Qual o melhor horário para trabalhar hoje?</h4>
          <p className="text-xs text-slate-300 leading-relaxed">
            Sair às <strong className="text-fuchsia-300">{dailyOutlook.bestHourToStart}</strong> para capturar as melhores corridas da manhã, e parar às <strong className="text-fuchsia-300">{dailyOutlook.bestHourToStop}</strong> maximizando a taxa horária de retorno líquido.
          </p>
        </div>
        <div className="border-t border-purple-950/10 pt-3 flex justify-between items-center">
          <span className="text-[10px] text-slate-400">Total recomendado: <strong className="text-fuchsia-300">8 Horas</strong></span>
        </div>
      </div>

      {/* Q4: Qual região pagar melhor? */}
      <div className="p-6 rounded-2xl bg-[#0b0821]/80 border border-purple-950/30 flex flex-col justify-between h-[220px] shadow-lg relative overflow-hidden">
        <div className="space-y-3">
          <div className="flex justify-between items-start">
            <HelpCircle className="w-5 h-5 text-sky-400" />
            <div className="flex gap-1.5 items-center">
              <DataSourceBadge type="historical" />
              <span className="text-[10px] bg-sky-950/40 text-sky-400 border border-sky-900/40 px-2 py-0.5 rounded font-bold uppercase font-mono">
                GEOLOCALIZAÇÃO
              </span>
            </div>
          </div>
          <h4 className="text-sm font-bold text-white">Qual região tende a pagar melhor?</h4>
          <p className="text-xs text-slate-300 leading-relaxed">
            Eixo de maior tarifa dinâmica estimado em <strong className="text-sky-300">{dailyOutlook.bestRegionToWork}</strong> devido ao fluxo comercial local e conexões aeroportuárias ativas.
          </p>
        </div>
        <div className="border-t border-purple-950/10 pt-3 flex justify-between items-center">
          <span className="text-[10px] text-slate-400">Multiplicador Dinâmico: <strong className="text-sky-300">1.8x - 2.4x</strong></span>
        </div>
      </div>

      {/* Q5: Qual lucro esperado hoje? */}
      <div className="p-6 rounded-2xl bg-[#0b0821]/80 border border-purple-950/30 flex flex-col justify-between h-[220px] shadow-lg relative overflow-hidden">
        <div className="space-y-3">
          <div className="flex justify-between items-start">
            <HelpCircle className="w-5 h-5 text-emerald-400" />
            <div className="flex gap-1.5 items-center">
              <DataSourceBadge type="simulated" />
              <span className="text-[10px] bg-emerald-950 text-emerald-400 border border-emerald-900/30 px-2 py-0.5 rounded font-bold uppercase font-mono">
                PROJEÇÃO LÍQUIDA
              </span>
            </div>
          </div>
          <h4 className="text-sm font-bold text-white">Qual lucro líquido esperado hoje?</h4>
          <p className="text-xs text-slate-300 leading-relaxed">
            Baseando-se em uma meta média, seu lucro líquido final projetado é de <strong className="text-emerald-400 font-mono">{formatCurrency(dailyOutlook.expectedNetProfit)}</strong> (apois deduzir R$ {((todayKm * currentCostPerKm)).toFixed(0)} de amortização de custos).
          </p>
        </div>
        <div className="border-t border-purple-950/10 pt-3 flex justify-between items-center">
          <span className="text-[10px] text-slate-400">Faturamento Bruto Necessário: <strong className="text-emerald-300">{formatCurrency(todayGross)}</strong></span>
        </div>
      </div>
    </div>
  );
};
