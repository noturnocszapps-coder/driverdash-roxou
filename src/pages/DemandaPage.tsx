/**
 * Previsão de Demanda Roxou - FASE 5.0
 * Location: src/pages/DemandaPage.tsx
 * Responsibility: Fully interactive client interface displaying Leaflet demand overlays,
 * live ranking of peak zones, predictive lists for future hours, and intelligent driver travel suggestions.
 */

import React, { useState, useMemo } from 'react';
import { useDemand } from '../modules/demand/demand.hooks';
import { DemandMap } from '../modules/maps/DemandMap';
import { scoreToDemandLevel } from '../modules/demand/demand.calculations';
import { 
  Compass, MapPin, Loader2, Sparkles, Navigation, 
  Map, Calendar, Clock, ChevronRight, AlertCircle, Info, Zap, 
  ArrowRight, HeartHandshake, TrendingUp
} from 'lucide-react';
import { motion } from 'motion/react';
import { RoxouDemandLevel } from '../modules/demand/demand.types';

// Driver Current Location - Mock center for Presidente Prudente distance calculations
const DRIVER_CURRENT_POS = { lat: -22.1285, lng: -51.4050 };

export const DemandaPage: React.FC = () => {
  const { demandStatus, demandSignals, globalDemandScore, loadingDemand, refetchDemand } = useDemand();
  const [selectedRegionName, setSelectedRegionName] = useState<string>('Prudenshopping');

  // Calculates Haversine distance from driver center
  const calculateDistanceKm = (targetLat: number, targetLng: number) => {
    const R = 6371; // Earth radius in km
    const dLat = (targetLat - DRIVER_CURRENT_POS.lat) * Math.PI / 180;
    const dLon = (targetLng - DRIVER_CURRENT_POS.lng) * Math.PI / 180;
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(DRIVER_CURRENT_POS.lat * Math.PI / 180) * Math.cos(targetLat * Math.PI / 180) * 
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Number((R * c).toFixed(1));
  };

  // Calculates typical ETA based on distance in km (average 22 km/h city driving)
  const calculateETAMinutes = (distanceKm: number) => {
    const minutes = Math.round((distanceKm / 22) * 60);
    return Math.max(2, minutes);
  };

  // 1. Selector for selected active region details
  const activeRegionDetail = useMemo(() => {
    if (demandStatus.length === 0) return null;
    return demandStatus.find(d => d.region.toLowerCase() === selectedRegionName.toLowerCase()) || demandStatus[0];
  }, [demandStatus, selectedRegionName]);

  // Handle click on map or list to select a region
  const handleSelectRegion = (regionName: string) => {
    setSelectedRegionName(regionName);
  };

  // 2. Recommendations logic ("DriverDash recomenda")
  const activeRecommendations = useMemo(() => {
    if (demandStatus.length === 0) return [];
    
    // Select top 3 regions with High or Extreme scores
    return demandStatus
      .filter(item => item.demandIndex >= 61)
      .map(item => {
        const dist = calculateDistanceKm(item.latitude, item.longitude);
        const eta = calculateETAMinutes(dist);

        // Figure out customized motivate tag
        let motive = 'Movimentação densa de passageiros mapeada na área.';
        const matchedSignal = demandSignals.find(s => s.is_active && s.region === item.region);
        if (matchedSignal) {
          motive = `Alerta ativo: "${matchedSignal.title}" na região.`;
        } else if (item.demandIndex >= 81) {
          motive = 'Região em estado Roxou Extremo com picos intensos de tarifas!';
        } else if (item.region === 'UNOESTE' || item.region === 'Toledo' || item.region === 'UNESP') {
          motive = 'Alta saída estudantil acadêmica e fluxo universitário agora.';
        } else if (item.region === 'Centro' || item.region === 'Prudenshopping') {
          motive = 'Pico de fluxo comercial e movimentação lojista intensa.';
        }

        return {
          region: item.region,
          motive,
          score: item.demandIndex,
          level: item.level,
          distance: `${dist} km`,
          timeEstimated: `${eta} min`,
          surge: item.surgeMultiplier
        };
      })
      .slice(0, 3);
  }, [demandStatus, demandSignals]);

  // 3. Top 5 Right Now (Top 5 regiões agora)
  const topRegioesAgora = useMemo(() => {
    return demandStatus.slice(0, 5);
  }, [demandStatus]);

  // 4. Top 5 Next Hours (Top 5 próximas horas - Projeção de Demanda futura)
  const topRegioesProximasHoras = useMemo(() => {
    if (demandStatus.length === 0) return [];

    // Simulate predictive list by adding a custom time-of-day offset shift for universities and shopping
    return demandStatus.map(item => {
      let predictedShift = 0;
      let label = 'Estável';
      
      if (item.region === 'UNOESTE') {
        predictedShift = 12; // massive rush hour at night
        label = 'Aumento de 15% às 19:30';
      } else if (item.region === 'Matarazzo') {
        predictedShift = 25; // event coming up
        label = 'Multiplicador x1.8 às 20h00';
      } else if (item.region === 'Aeroporto') {
        predictedShift = -10; // airport late night drops
        label = 'Estabilidade esperada';
      } else if (item.region === 'Prudenshopping') {
        predictedShift = 8;
        label = 'Alta fluxo às 18:30';
      } else if (item.region === 'Centro') {
        predictedShift = -15; // downtown gets colder after business hours
        label = 'Fluxo dispersando às 18:00';
      } else {
        predictedShift = Math.sin(item.latitude * 100) * 10;
        label = 'Projeção regular';
      }

      const predictedScore = Math.min(100, Math.max(10, Math.round(item.demandIndex + predictedShift)));
      const predictedLevel = scoreToDemandLevel(predictedScore);

      return {
        ...item,
        predictedScore,
        predictedLevel,
        label
      };
    }).sort((a, b) => b.predictedScore - a.predictedScore).slice(0, 5);
  }, [demandStatus]);

  const getDemandBadgeColor = (level: RoxouDemandLevel) => {
    switch (level) {
      case 'extreme':
        return 'bg-rose-950 text-rose-400 border border-rose-800/50';
      case 'high':
        return 'bg-orange-950 text-orange-400 border border-orange-800/40';
      case 'medium':
        return 'bg-yellow-950 text-yellow-400 border border-yellow-800/30';
      case 'low':
      default:
        return 'bg-slate-950 text-slate-400 border border-slate-800/20';
    }
  };

  const getDemandText = (level: RoxouDemandLevel) => {
    switch (level) {
      case 'extreme': return 'Demanda Extrema';
      case 'high': return 'Demanda Alta';
      case 'medium': return 'Demanda Média';
      case 'low':
      default:
        return 'Demanda Baixa';
    }
  };

  if (loadingDemand && demandStatus.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-24 text-purple-300">
        <Loader2 className="w-10 h-10 animate-spin text-purple-500 mb-4" />
        <p className="text-sm font-mono tracking-widest text-purple-300/45 animate-pulse">Sincronizando Motor de Demanda Roxou...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      
      {/* Dynamic Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-purple-950/20 pb-4">
        <div>
          <span className="text-[10px] bg-purple-950 text-fuchsia-400 font-bold px-2 py-0.5 rounded border border-purple-900/40 font-mono uppercase tracking-widest">
            Roxou Engine v5.0 Live
          </span>
          <h2 className="text-xl font-bold text-white tracking-wide mt-1">Previsão e Monitoramento de Demanda</h2>
          <p className="text-xs text-purple-300/55">
            Geometrias e prognóstico em tempo real para os 10 principais pólos de Presidente Prudente.
          </p>
        </div>

        {/* Aggregate City Demand Indicator */}
        <div className="px-5 py-3 bg-[#0a051d] border border-purple-950/30 rounded-2xl flex items-center gap-3 shrink-0">
          <TrendingUp className="w-5 h-5 text-fuchsia-500" />
          <div className="font-mono">
            <span className="text-[9px] text-purple-300/45 uppercase block">Mapeamento Global</span>
            <div className="flex items-center gap-1.5">
              <span className="text-xl font-extrabold text-white">{globalDemandScore} pts</span>
              <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded-md ${getDemandBadgeColor(scoreToDemandLevel(globalDemandScore))}`}>
                {getDemandText(scoreToDemandLevel(globalDemandScore))}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Grid: Map + Details Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Col: Leaflet Map */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-[#060212]/70 border border-purple-950/25 rounded-3xl p-4">
            <div className="flex items-center justify-between mb-3 text-xs">
              <span className="text-slate-300 font-semibold flex items-center gap-1.5 font-mono">
                <Map className="w-3.5 h-3.5 text-purple-400" /> Mapa de Picos e Saturação Térmica
              </span>
              <button 
                onClick={refetchDemand} 
                className="text-[10px] text-purple-400 hover:text-purple-200 cursor-pointer font-bold uppercase tracking-wider font-mono bg-[#140b2efb] px-3 py-1.5 rounded-lg border border-purple-900/30"
              >
                Atualizar Sinalização
              </button>
            </div>
            
            <DemandMap 
              demandStatus={demandStatus} 
              demandSignals={demandSignals} 
              selectedRegionName={selectedRegionName} 
              onSelectRegion={handleSelectRegion} 
              height="450px"
            />
            
            <div className="flex flex-wrap gap-4 justify-center text-[10px] font-mono text-slate-400 mt-2">
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-slate-500"></span> Baixa Score (0-30)</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-yellow-500"></span> Média Score (31-60)</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-orange-500"></span> Alta Score (61-80)</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-red-600"></span> Extrema Score (81+)</span>
            </div>
          </div>
        </div>

        {/* Right Col: Selected Region Insights */}
        <div className="space-y-4">
          
          {/* Active Detail Profile Card */}
          {activeRegionDetail && (
            <div className="bg-[#0b0520] border border-purple-950/40 rounded-3xl p-5 relative overflow-hidden shadow-xl">
              <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/5 rounded-full blur-2xl"></div>

              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-purple-400" />
                  <span className="text-xs font-bold text-white uppercase tracking-wider font-mono">Ficha Operacional</span>
                </div>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg border ${getDemandBadgeColor(activeRegionDetail.level)}`}>
                  {activeRegionDetail.demandIndex} pts
                </span>
              </div>

              <div>
                <h3 className="text-xl font-black text-white tracking-wide">{activeRegionDetail.region}</h3>
                <span className="text-[10px] text-slate-400/80 font-mono">Presidente Prudente, SP</span>
              </div>

              {/* Core Calculations Block */}
              <div className="grid grid-cols-2 gap-3 mt-5 font-mono">
                <div className="bg-slate-950/40 p-3 rounded-2xl border border-purple-950/20">
                  <span className="text-[8.5px] text-purple-300/40 uppercase block">Dinâmico Estimado</span>
                  <span className="text-lg font-black text-white mt-0.5 block flex items-center gap-1">
                    <Zap className="w-3.5 h-3.5 text-yellow-500 shadow-sm" />
                    {activeRegionDetail.surgeMultiplier.toFixed(2)}x
                  </span>
                </div>
                <div className="bg-slate-950/40 p-3 rounded-2xl border border-purple-950/20">
                  <span className="text-[8.5px] text-purple-300/40 uppercase block">Rendimento / Hora</span>
                  <span className="text-lg font-black text-teal-400 mt-0.5 block">
                    R$ {activeRegionDetail.hourlyEarningsEstimate.toFixed(1)}/h
                  </span>
                </div>
              </div>

              {/* Recommendation message */}
              <div className="bg-indigo-950/10 border border-indigo-900/30 rounded-2xl p-4 mt-5 space-y-1.5">
                <div className="flex items-start gap-2">
                  <Info className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                  <p className="text-xs text-slate-300 leading-relaxed font-sans">{activeRegionDetail.recommendation}</p>
                </div>
              </div>

              {/* Telemetry distances */}
              <div className="flex justify-between items-center bg-slate-950/10 p-3.5 rounded-2xl border border-purple-950/10 mt-5 font-mono text-[10.5px]">
                <span className="text-slate-400 text-left">Sua Distância (Mock):</span>
                <span className="text-slate-200 text-right font-bold">
                  {calculateDistanceKm(activeRegionDetail.latitude, activeRegionDetail.longitude)} km ({calculateETAMinutes(calculateDistanceKm(activeRegionDetail.latitude, activeRegionDetail.longitude))} min)
                </span>
              </div>
            </div>
          )}

          {/* Quick Informative Banner */}
          <div className="p-4 bg-gradient-to-br from-[#0c1c24] to-[#01080a] border border-teal-950/40 rounded-3xl flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-teal-400 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <span className="text-xs font-bold text-teal-300 font-mono uppercase tracking-wider block">Inteligência Roxou Ativa</span>
              <p className="text-[10.5px] text-slate-450 leading-relaxed text-slate-300">
                O score consolida leituras de densidade térmica coletivas, regras de feriados inseridas pela Roxou Admin e fatores climáticos.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Grid: Driver Recommendations & Forecast rankings */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Recommendation Column: "DriverDash recomenda" */}
        <div className="lg:col-span-1 bg-[#09051d] border border-purple-950/20 rounded-3xl p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-purple-950/20 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <Compass className="w-5 h-5 text-teal-400" />
                <h3 className="text-xs font-bold uppercase tracking-wider font-mono text-white">DriverDash Recomenda</h3>
              </div>
              <span className="text-[9px] bg-teal-950 text-teal-400 font-mono px-2 py-0.5 rounded border border-teal-900/30">
                {activeRecommendations.length} Regiões
              </span>
            </div>

            {activeRecommendations.length > 0 ? (
              <div className="space-y-4">
                {activeRecommendations.map((rec, idx) => (
                  <div 
                    key={idx}
                    onClick={() => handleSelectRegion(rec.region)}
                    className="p-4 bg-[#04010e] hover:bg-[#11082d] border border-purple-950/30 hover:border-purple-800/40 rounded-2xl cursor-pointer transition-all space-y-2 group"
                  >
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-white font-bold group-hover:text-purple-300 transition-colors flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-purple-400" /> {rec.region}
                      </span>
                      <span className={`text-[9.5px] font-mono px-1.5 py-0.2 rounded font-bold ${getDemandBadgeColor(rec.level)}`}>
                        {rec.surge.toFixed(2)}x
                      </span>
                    </div>

                    <p className="text-[11px] text-slate-450 text-slate-400 leading-normal">{rec.motive}</p>

                    <div className="flex justify-between items-center text-[10px] text-purple-300 font-mono pt-1">
                      <span>Distância: <strong className="text-white">{rec.distance}</strong></span>
                      <span className="flex items-center gap-0.5 text-teal-400">ETA: <strong className="font-extrabold">{rec.timeEstimated}</strong></span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-purple-300/30 italic text-center py-8">
                Nenhuma sugestão com alta prioridade no momento. Aguarde atualizações climáticas ou picos.
              </p>
            )}
          </div>

          <div className="mt-5 text-[10px] text-purple-300/30 font-mono text-center flex items-center justify-center gap-1.5 border-t border-purple-950/10 pt-4">
            <HeartHandshake className="w-3.5 h-3.5" /> Foco na rentabilidade das suas corridas.
          </div>
        </div>

        {/* Card: Top 5 regiões AGORA */}
        <div className="bg-[#09051d] border border-purple-950/20 rounded-3xl p-6">
          <div className="flex items-center justify-between border-b border-purple-950/20 pb-3 mb-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-purple-400" />
              <h3 className="text-xs font-bold uppercase tracking-wider font-mono text-white">Top 5 Regiões Agora</h3>
            </div>
            <span className="text-[9px] bg-purple-950 text-purple-300 font-mono px-2.5 py-0.5 rounded border border-purple-900/30">
              Live Ranking
            </span>
          </div>

          <div className="space-y-3 font-mono">
            {topRegioesAgora.map((region, index) => {
              const isSelected = selectedRegionName.toLowerCase() === region.region.toLowerCase();
              return (
                <div 
                  key={region.region}
                  onClick={() => handleSelectRegion(region.region)}
                  className={`p-3.5 rounded-2xl flex items-center justify-between gap-4 cursor-pointer transition-all border ${
                    isSelected 
                      ? 'bg-[#150a29] border-purple-800' 
                      : 'bg-[#04010a] border-purple-950/30 hover:bg-[#0c051f]'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-bold text-purple-450 text-purple-400 w-4 font-black">#{index + 1}</span>
                    <div>
                      <span className="text-xs text-white font-bold block">{region.region}</span>
                      <span className="text-[9px] text-fuchsia-400">{region.surgeMultiplier.toFixed(2)}x Dynamic Surge</span>
                    </div>
                  </div>

                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded font-bold ${getDemandBadgeColor(region.level)}`}>
                    {region.demandIndex} pts
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Card: Top 5 regiões PRÓXIMAS HORAS (Previsão) */}
        <div className="bg-[#09051d] border border-purple-950/20 rounded-3xl p-6">
          <div className="flex items-center justify-between border-b border-purple-950/20 pb-3 mb-4">
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-indigo-400" />
              <h3 className="text-xs font-bold uppercase tracking-wider font-mono text-white">Top 5 Próximas Horas</h3>
            </div>
            <span className="text-[10px] uppercase text-indigo-400 font-bold font-mono">Prognóstico</span>
          </div>

          <div className="space-y-3 font-mono">
            {topRegioesProximasHoras.map((region, index) => {
              return (
                <div 
                  key={region.region}
                  onClick={() => handleSelectRegion(region.region)}
                  className="p-3.5 bg-[#04010a] hover:bg-[#0a0520]/60 border border-purple-950/30 hover:border-purple-800/40 rounded-2xl cursor-pointer transition-all flex items-center justify-between gap-4"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <span className="text-xs text-indigo-500/80 w-4 font-black">+{index + 1}h</span>
                    <div className="min-w-0 flex-1">
                      <span className="text-xs text-white font-bold block truncate">{region.region}</span>
                      <span className="text-[9px] text-slate-400/80 leading-none truncate block mt-0.5">{region.label}</span>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded block text-center ${getDemandBadgeColor(region.predictedLevel)}`}>
                      {region.predictedScore} pts
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>

    </div>
  );
};
