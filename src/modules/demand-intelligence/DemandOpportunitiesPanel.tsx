import React from 'react';
import { useDemandIntelligence } from './useDemandIntelligence';
import { 
  Sparkles, MapPin, Calendar, Compass, AlertTriangle, 
  TrendingUp, Clock, HelpCircle, RefreshCw, Star, Info, ChevronRight, Zap
} from 'lucide-react';
import { motion } from 'motion/react';

export const DemandOpportunitiesPanel: React.FC = () => {
  const {
    regions,
    recommendation,
    upcomingEvents,
    currentLocationName,
    currentHour,
    isPeakTime,
    gpsStatus,
    isNearGoodArea,
    distanceToBestText
  } = useDemandIntelligence();

  // Helper for scoring badge and text
  const getScoreColor = (score: number) => {
    if (score >= 85) return 'text-emerald-400 bg-emerald-950/40 border-emerald-500/25';
    if (score >= 60) return 'text-amber-400 bg-amber-950/40 border-amber-500/20';
    return 'text-rose-400 bg-rose-950/40 border-rose-500/20';
  };

  const getRiskBadge = (risk: 'good' | 'attention' | 'risk') => {
    switch (risk) {
      case 'good':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold font-mono bg-emerald-950/30 text-emerald-400 border border-emerald-900/25">
            🟢 Baixo Risco
          </span>
        );
      case 'attention':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold font-mono bg-amber-950/20 text-amber-400 border border-amber-900/20">
            🟡 Atenção
          </span>
        );
      case 'risk':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold font-mono bg-rose-950/20 text-rose-400 border border-rose-900/20 animate-pulse">
            🔴 Risco de Vazio
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      
      {/* 1. Header with Badge Estimativa */}
      <div className="p-6 bg-gradient-to-br from-[#0c0524] to-[#04010a] border border-purple-950/40 rounded-3xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-purple-600/5 rounded-full filter blur-3xl -z-10" />
        
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-purple-950/40 rounded-2xl border border-purple-900/30 text-purple-400">
              <Compass className="w-6 h-6 animate-spin-slow" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black text-white uppercase tracking-wider font-sans">Mapa de Oportunidades</h2>
                <span className="px-2 py-0.5 bg-emerald-950/40 text-emerald-400 text-[9px] font-black uppercase font-mono rounded-md border border-emerald-500/20 tracking-wider">
                  Estimativa Ativa
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Monitore demandas e previsões regionais de Presidente Prudente em tempo real para otimizar seus rendimentos.
              </p>
            </div>
          </div>
          
          <div className="text-right">
            <span className="text-[10px] font-mono text-slate-500 block uppercase">Horário de Referência</span>
            <span className="text-xs font-bold text-purple-300 font-mono bg-purple-950/20 border border-purple-950/30 px-2.5 py-1 rounded-xl inline-block mt-0.5">
              {currentHour}:00h {isPeakTime ? '🔥 Horário de Pico' : '🕒 Fluxo Moderado'}
            </span>
          </div>
        </div>
      </div>

      {/* 2. Top Recommendation: "Melhor região agora" */}
      <div className="p-5 bg-[#0b041e] border border-purple-900/35 rounded-3xl relative overflow-hidden">
        <div className="absolute -top-12 -right-12 w-32 h-32 bg-emerald-500/10 rounded-full filter blur-2xl" />
        
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="w-4 h-4 text-emerald-400" />
          <span className="text-xs font-bold uppercase tracking-wider font-mono text-emerald-400">
            Recomendação Principal de Giro
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
          <div className="md:col-span-2 space-y-2">
            <h3 className="text-2xl font-black text-white tracking-tight">
              {recommendation.bestRegion}
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed font-sans">
              {recommendation.reason}
            </p>
            <div className="p-3 bg-black/35 rounded-2xl border border-purple-950/40 flex items-start gap-2.5">
              <Star className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <p className="text-xs text-slate-400 font-medium leading-relaxed">
                <strong className="text-white">Dica Prática:</strong> {recommendation.practicalTip}
              </p>
            </div>
          </div>

          <div className="p-4 bg-gradient-to-b from-[#0e0729] to-black border border-purple-950/50 rounded-2xl text-center space-y-1">
            <span className="text-[10px] font-mono text-slate-500 uppercase block">Score de Oportunidade</span>
            <span className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-400 font-mono">
              {recommendation.score}
            </span>
            <span className="text-[10px] text-emerald-400/70 block font-mono">Excelente Rentabilidade</span>
          </div>
        </div>
      </div>

      {/* 3. GPS Position & Proximity Match */}
      {currentLocationName && (
        <div className="p-4 bg-slate-950/40 border border-purple-950/20 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-purple-950/20 rounded-xl border border-purple-900/10 text-purple-400 shrink-0">
              <MapPin className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] text-slate-500 font-mono uppercase block">Sua localização aproximada</span>
              <p className="text-sm font-bold text-white font-sans">{currentLocationName}, Presidente Prudente</p>
            </div>
          </div>

          <div className="flex-1 max-w-xl md:text-right">
            <p className="text-xs text-slate-300 leading-relaxed font-sans">
              {distanceToBestText}
            </p>
            <div className="mt-1 flex items-center justify-end gap-1.5">
              {isNearGoodArea ? (
                <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              ) : (
                <span className="inline-block w-2 h-2 rounded-full bg-amber-400 animate-ping" />
              )}
              <span className="text-[10px] font-mono text-slate-400">
                {isNearGoodArea ? 'Você está posicionado em excelente polo de chamadas' : 'Considere deslocar-se para o Centro ou Parque do Povo'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 4. Main Oppotunities Ranking & Legend */}
      <div className="bg-[#0a051d] border border-purple-950/20 rounded-3xl p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-purple-950/25 pb-3">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-purple-400" />
            <h3 className="text-sm font-black text-white uppercase tracking-wider font-mono">
              Ranking de Regiões para Faturamento ({regions.length})
            </h3>
          </div>

          {/* Legenda de Decisão */}
          <div className="flex items-center gap-3 font-mono text-[9px] text-slate-500">
            <span className="flex items-center gap-1">🟢 Alta Rentabilidade</span>
            <span className="flex items-center gap-1">🟡 Atenção</span>
            <span className="flex items-center gap-1">🔴 Risco de Vazio</span>
          </div>
        </div>

        {/* Regions Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {regions.map((reg, idx) => {
            const isTop = idx === 0;
            const cardScoreColor = getScoreColor(reg.score);
            
            return (
              <div 
                key={reg.name} 
                className={`p-4 bg-[#070314] hover:bg-[#0c0524] transition-all duration-200 border rounded-2xl flex flex-col justify-between gap-3 group relative ${
                  isTop ? 'border-emerald-800/40 bg-gradient-to-br from-[#0c0524] to-[#04010a]' : 'border-purple-950/30'
                }`}
              >
                {/* Ranking Index Pin */}
                <div className="absolute top-4 right-4 text-[9px] font-black font-mono px-1.5 py-0.5 rounded bg-black/40 text-purple-400/50 group-hover:text-purple-300">
                  #{idx + 1}
                </div>

                <div className="space-y-1">
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm font-black text-white tracking-tight">{reg.name}</p>
                    {reg.isPeripheral && (
                      <span className="text-[8px] bg-purple-950/40 text-purple-400 px-1.5 py-0.2 rounded font-mono uppercase tracking-wider border border-purple-900/10 shrink-0">
                        Periférico
                      </span>
                    )}
                  </div>
                  
                  {/* Score status indicator */}
                  <div className="flex items-center gap-2 pt-1">
                    <span className={`px-2 py-0.5 text-[10px] font-bold rounded-md font-mono border ${cardScoreColor}`}>
                      Nota {reg.score}
                    </span>
                    {getRiskBadge(reg.emptyRunRisk)}
                  </div>
                </div>

                {/* Micro indicators bar */}
                <div className="bg-black/30 p-2.5 rounded-xl border border-purple-950/15 space-y-2 text-[11px] font-sans">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Demanda Estimada:</span>
                    <span className={`font-bold capitalize ${
                      reg.demandLevel === 'alta' ? 'text-emerald-400' : reg.demandLevel === 'media' ? 'text-amber-400' : 'text-slate-400'
                    }`}>{reg.demandLevel}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Chance de Corrida:</span>
                    <span className="text-slate-300 font-mono font-bold">{reg.rideChance}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Retorno p/ Centro:</span>
                    <span className="text-slate-300 font-mono font-bold">{reg.returnChance}</span>
                  </div>
                  <div className="flex justify-between text-[10px] pt-1.5 border-t border-purple-950/20">
                    <span className="text-slate-500 flex items-center gap-1"><Clock className="w-3 h-3" /> Melhor Horário:</span>
                    <span className="text-purple-300 font-mono">{reg.bestTime}</span>
                  </div>
                </div>

                <p className="text-[10px] text-slate-400 italic leading-normal border-t border-purple-950/10 pt-2 block font-sans">
                  {reg.tip}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* 5. Prepared Future Integrations Segment */}
      <div className="p-6 bg-[#070314] border border-purple-950/25 rounded-3xl space-y-4">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider font-mono text-purple-300 block">
            📅 Fatores de Demanda e Eventos Locais (Estrutura Preparada)
          </span>
          <p className="text-xs text-slate-400 mt-1">
            Visualização prévia das fontes de dados integradas. Em breve, estas informações serão carregadas via API, climas dinâmicos, e de canais de eventos em Presidente Prudente.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {upcomingEvents.map(evt => (
            <div key={evt.id} className="p-4 bg-black/45 border border-purple-950/20 rounded-2xl space-y-2 text-left relative overflow-hidden group">
              <div className="flex items-center justify-between">
                <span className="px-2 py-0.5 bg-purple-950/30 text-purple-300 font-mono text-[9px] rounded border border-purple-900/10 uppercase">
                  {evt.category === 'show' ? '🎉 Show/Evento' : evt.category === 'weather' ? '🌧️ Clima' : '🚌 Terminal'}
                </span>
                <span className={`text-[9px] font-bold font-mono px-1.5 py-0.2 rounded ${
                  evt.expectedDemand === 'alta' ? 'bg-emerald-950/30 text-emerald-400 border border-emerald-900/10' : 'bg-slate-900 text-slate-400'
                }`}>
                  Demanda {evt.expectedDemand.toUpperCase()}
                </span>
              </div>
              <h4 className="text-xs font-bold text-white group-hover:text-purple-300 transition-colors leading-snug">{evt.title}</h4>
              <p className="text-[10px] text-slate-500 font-mono">{evt.location} ({evt.time})</p>
              <p className="text-[10px] text-slate-400 leading-normal">{evt.description}</p>
            </div>
          ))}
        </div>
      </div>

      {/* 6. Legal Disclaimer / Notice */}
      <div className="p-3 bg-slate-950/45 border border-purple-950/15 rounded-xl flex items-start gap-2.5 text-left max-w-5xl mx-auto">
        <Info className="w-4 h-4 text-purple-500 shrink-0 mt-0.5" />
        <p className="text-[10px] text-slate-500 font-sans leading-relaxed">
          <strong>Aviso Importante:</strong> Estimativa inicial baseada em padrões de horário comerciais e de entretenimento da cidade. A precisão dos scores melhora continuamente conforme o DriverDash coleta jornadas agregadas e relatórios de campo em Presidente Prudente.
        </p>
      </div>

    </div>
  );
};
