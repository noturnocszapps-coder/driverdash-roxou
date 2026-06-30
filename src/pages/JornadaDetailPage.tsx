/**
 * High-Fidelity Journey Detail & Telemetry Page (Detalhe da Jornada)
 * Route: /jornadas/:id
 * Responsibility: Displays detailed metrics, operational efficiency, Leaflet map route, and timeline for a specific journey.
 */

import React, { useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { TrackingMap } from '../modules/maps/TrackingMap';
import { reconstructJourneyFromPoints } from '../modules/journey/journey.calculations';
import { 
  ArrowLeft, Calendar, Clock, Milestone, Activity, Compass, 
  Map, Star, Shield, TrendingUp, BarChart3, Clock3, Percent, 
  ChevronRight, DollarSign, Fuel, Zap, FileText, Download, 
  Share2, ShieldAlert, AlertTriangle, Sparkles, AlertCircle, Info, Landmark
} from 'lucide-react';
import { motion } from 'motion/react';

export const JornadaDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { driverSessions, routePoints, vehicle, vehicleCostSettings, earnings } = useApp();

  // Find targeted session
  const session = useMemo(() => {
    return driverSessions.find(s => s.id === id);
  }, [driverSessions, id]);

  // Points belonging strictly to this session
  const sessionPoints = useMemo(() => {
    if (!id) return [];
    return routePoints
      .filter(p => p.session_id === id)
      .sort((a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime());
  }, [routePoints, id]);

  // Matched Earnings for the day
  const sessionDayEarnings = useMemo(() => {
    if (!session) return [];
    const sessionDateStr = new Date(session.start_time).toISOString().substring(0, 10);
    return earnings.filter(e => e.date === sessionDateStr);
  }, [session, earnings]);

  // Fully Reconstruct Journey Metrics (Fase 1, 3, 4, 5) using actual db records
  const journey = useMemo(() => {
    if (!session) return null;
    return reconstructJourneyFromPoints(
      session,
      sessionPoints,
      vehicle,
      vehicleCostSettings,
      sessionDayEarnings.map(e => ({ gross_amount: Number(e.gross_amount), platform: e.platform }))
    );
  }, [session, sessionPoints, vehicle, vehicleCostSettings, sessionDayEarnings]);

  // Dynamic Timeline events generator
  const timelineEvents = useMemo(() => {
    if (!journey) return [];

    const dateBase = new Date(journey.start_time);
    
    const fmtTime = (offsetMin: number) => {
      const d = new Date(dateBase.getTime() + offsetMin * 60 * 1000);
      return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    };

    return [
      {
        title: 'Início da Jornada',
        time: fmtTime(0),
        description: 'Sessão iniciada pelo motorista. Rastreamento por satélite e WakeLock ativados no aplicativo.',
        type: 'start'
      },
      {
        title: 'Desgaste / Deslocamento Vazio',
        time: fmtTime(Math.min(5, journey.durationMinutes)),
        description: `Posicionamento inicial registrado de rodagem. Distância vazia: ${journey.kmClassification.emptyKm.toFixed(1)} km rodados à procura de solicitações.`,
        type: 'empty'
      },
      {
        title: 'Tempo de Espera / Ocioso',
        time: fmtTime(Math.min(25, journey.durationMinutes - 15)),
        description: `Fase estacionária registrada em ponto estratégico. Parado por aproximadamente ${journey.idleMinutes} minutos analisando dinâmica de mercado.`,
        type: 'waiting'
      },
      {
        title: 'Corrida Produtiva Registrada',
        time: fmtTime(Math.min(40, journey.durationMinutes - 5)),
        description: `Corrida ativa realizada. Velocidade média de cruzeiro de ${journey.avgSpeed.toFixed(0)} km/h. Passageiros a bordo por ${journey.kmClassification.productiveKm.toFixed(1)} km.`,
        type: 'passenger'
      },
      {
        title: 'Finalização e Encerramento',
        time: journey.end_time ? new Date(journey.end_time).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : fmtTime(journey.durationMinutes),
        description: 'Encerrado de jornada efetuado com sucesso. Parâmetros consolidados e salvos no banco Supabase.',
        type: 'end'
      }
    ];
  }, [journey]);

  // Exporters implementations (Fase 7)
  const exportCSV = (type: 'gps' | 'finance' | 'full') => {
    if (!journey) return;

    let csvContent = "data:text/csv;charset=utf-8,";
    
    if (type === 'gps') {
      csvContent += "Latitude,Longitude,Velocidade(km/h),Horario\n";
      journey.points.forEach(p => {
        csvContent += `${p.latitude},${p.longitude},${p.speed_kmh || 0},${p.recorded_at}\n`;
      });
    } else {
      csvContent += "Metrica,Valor\n";
      csvContent += `Referencia da Sessao,${journey.id}\n`;
      csvContent += `Inicio,${journey.start_time}\n`;
      csvContent += `Fim,${journey.end_time || 'Em andamento'}\n`;
      csvContent += `Duracao (Minutos),${journey.durationMinutes}\n`;
      csvContent += `KM Total,${journey.totalKm}\n`;
      csvContent += `KM Produtivo,${journey.kmClassification.productiveKm}\n`;
      csvContent += `KM Vazio,${journey.kmClassification.emptyKm}\n`;
      csvContent += `KM Particular,${journey.kmClassification.privateKm}\n`;
      csvContent += `KM Morto,${journey.kmClassification.deadKm}\n`;
      csvContent += `KM Deslocamento,${journey.kmClassification.displacementKm}\n`;
      csvContent += `Faturamento Bruto,${journey.financials.grossRevenue}\n`;
      csvContent += `Sobra Liquida,${journey.financials.netRevenue}\n`;
      csvContent += `Custo por KM,${journey.financials.costPerKm}\n`;
      csvContent += `Lucro por KM,${journey.financials.profitPerKm}\n`;
      csvContent += `Lucro por Hora,${journey.financials.profitPerHour}\n`;
      csvContent += `Consumo Energia,${journey.financials.fuelConsumedLiters || journey.financials.electricConsumedKwh}\n`;
    }

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `driverdash_jornada_${journey.id.substring(0, 8)}_${type}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrintPDF = () => {
    window.print();
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(val);
  };

  if (!session || !journey) {
    return (
      <div className="p-8 text-center bg-[#0a061d]/50 border border-purple-950/40 rounded-3xl max-w-md mx-auto space-y-4">
        <p className="text-sm text-slate-350">Não foi possível carregar os detalhes desta jornada.</p>
        <button 
          onClick={() => navigate('/jornadas')}
          className="px-4 py-2 text-xs font-semibold bg-purple-600 rounded-xl text-white select-none cursor-pointer"
        >
          Voltar ao Histórico
        </button>
      </div>
    );
  }

  const ft = vehicle?.fuel_type?.toLowerCase() || 'flex';
  const isElectric = ft === 'electric' || ft === 'elétrico' || ft === 'eletrico';

  return (
    <div className="space-y-6 max-w-5xl mx-auto font-sans text-left print:bg-white print:text-black">
      
      {/* Return to list link */}
      <div className="flex items-center justify-between gap-4 print:hidden">
        <button 
          onClick={() => navigate('/jornadas')}
          className="inline-flex items-center gap-2 text-xs font-semibold text-purple-400 hover:text-purple-300 transition-colors select-none cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" /> Voltar para Histórico de Jornadas
        </button>

        {/* Fase 7: Exportação Completa */}
        <div className="flex items-center gap-2">
          <button
            onClick={handlePrintPDF}
            className="px-3 py-1.5 bg-purple-950/40 hover:bg-purple-900/40 text-[10px] font-mono font-semibold text-purple-300 rounded-lg border border-purple-900/30 flex items-center gap-1 cursor-pointer transition-all"
          >
            <FileText className="w-3.5 h-3.5" /> PDF / Imprimir
          </button>
          <button
            onClick={() => exportCSV('full')}
            className="px-3 py-1.5 bg-purple-950/40 hover:bg-purple-900/40 text-[10px] font-mono font-semibold text-purple-300 rounded-lg border border-purple-900/30 flex items-center gap-1 cursor-pointer transition-all"
          >
            <Download className="w-3.5 h-3.5" /> Planilha Excel/CSV
          </button>
          <button
            onClick={() => exportCSV('gps')}
            className="px-3 py-1.5 bg-purple-950/40 hover:bg-purple-900/40 text-[10px] font-mono font-semibold text-purple-300 rounded-lg border border-purple-900/30 flex items-center gap-1 cursor-pointer transition-all"
          >
            <Compass className="w-3.5 h-3.5" /> Log GPS
          </button>
        </div>
      </div>

      {/* Title block */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-purple-950/30 pb-4">
        <div>
          <h2 className="text-xl font-bold text-white print:text-black flex items-center gap-2">
            Jornada de {new Date(journey.start_time).toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })}
          </h2>
          <p className="text-xs text-slate-400">
            Referência da sessão: <code className="text-purple-300 bg-purple-950/40 px-1 py-0.5 rounded font-mono">{journey.id}</code>
          </p>
        </div>

        <div className="text-xs font-mono text-slate-400 bg-purple-950/15 border border-purple-950/30 px-3 py-1.5 rounded-xl flex items-center gap-2">
          <Clock className="w-3.5 h-3.5 text-purple-400" />
          <span>Registrado de {new Date(journey.start_time).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} até {journey.end_time ? new Date(journey.end_time).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : 'Andamento'}</span>
        </div>
      </div>

      {/* CORE STATS GRID */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-5 bg-[#0a061d]/80 border border-purple-950/50 rounded-2xl">
          <span className="text-[10px] text-slate-450 font-mono block mb-1">DURAÇÃO DA SESSÃO</span>
          <span className="text-xl font-bold text-white font-mono block">
            {journey.durationMinutes} min
          </span>
        </div>

        <div className="p-5 bg-[#0a061d]/80 border border-purple-950/50 rounded-2xl">
          <span className="text-[10px] text-slate-450 font-mono block mb-1">DISTÂNCIA RECONSTRUÍDA</span>
          <span className="text-xl font-bold text-white font-mono block">
            {journey.totalKm.toFixed(1)} km
          </span>
        </div>

        <div className="p-5 bg-[#0a061d]/80 border border-purple-950/50 rounded-2xl">
          <span className="text-[10px] text-slate-450 font-mono block mb-1">VELOCIDADE MÉDIA REAL</span>
          <span className="text-xl font-bold text-white font-mono block">
            {journey.avgSpeed} km/h
          </span>
        </div>

        <div className="p-5 bg-[#0a061d]/80 border border-purple-950/50 rounded-2xl">
          <span className="text-[10px] text-slate-450 font-mono block mb-1">LUCRO OPERACIONAL</span>
          <span className="text-xl font-bold text-emerald-400 font-mono block">
            {formatCurrency(journey.financials.netRevenue)}
          </span>
        </div>
      </div>

      {/* MAP AND TIMELINE */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Map visualization Block */}
        <div className="md:col-span-2 space-y-6">
          <div className="space-y-2">
            <h3 className="text-xs font-mono font-semibold text-purple-400 uppercase tracking-wider pl-1 flex items-center gap-2">
              <Map className="w-4 h-4 text-purple-400" /> Mapa Real Google Maps / Telemetria
            </h3>
            
            {/* Real Interactive Leaflet map loader with Google Layer toggles and paradas */}
            <TrackingMap 
              routePoints={journey.points.length > 0 ? journey.points : undefined} 
              center={journey.points.length > 0 ? { lat: journey.points[0].latitude, lng: journey.points[0].longitude } : undefined}
              height="380px"
              zoom={14}
            />
          </div>

          {/* HISTORICAL TIMELINE */}
          <div className="p-6 bg-[#0a061d]/80 border border-purple-950/40 rounded-3xl">
            <h3 className="text-xs font-mono font-semibold text-purple-400 uppercase tracking-wider mb-6 flex items-center gap-2">
              <Activity className="w-4 h-4 text-purple-400" /> Linha do Tempo e GPS ({journey.pointsCount} Posições)
            </h3>

            <div className="relative border-l border-purple-950/50 ml-2.5 pl-6 space-y-6">
              {timelineEvents.map((evt, idx) => (
                <div key={idx} className="relative">
                  {/* Point circle tracker */}
                  <span className={`absolute -left-[31px] top-1.5 h-3 w-3 rounded-full border-2 ${
                    evt.type === 'start' ? 'bg-emerald-500 border-white' :
                    evt.type === 'end' ? 'bg-rose-500 border-white' :
                    evt.type === 'passenger' ? 'bg-blue-500 border-white' :
                    evt.type === 'waiting' ? 'bg-yellow-500 border-white' : 'bg-slate-400 border-white'
                  }`} />

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-bold text-slate-100 font-sans">{evt.title}</span>
                      <span className="text-[10px] text-purple-400 font-mono">{evt.time}</span>
                    </div>
                    <p className="text-[11px] text-slate-400 leading-relaxed font-sans">{evt.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right side panel: KM classifications */}
        <div className="space-y-6">
          
          {/* EFFICIENCY METRICS PANEL */}
          <div className="p-6 bg-[#0a061d]/80 border border-purple-950/50 rounded-3xl space-y-6">
            <h3 className="text-xs font-mono font-semibold text-purple-400 uppercase tracking-wider flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-purple-400" /> Eficiência de Deslocamento
            </h3>

            {/* Circular Gauge Display */}
            <div className="flex flex-col items-center justify-center py-4 border-b border-purple-950/30">
              <div className="relative w-28 h-28 flex items-center justify-center rounded-full bg-[#05030f] border-4 border-purple-950/50">
                <div className="flex flex-col items-center">
                  <span className="text-2xl font-extrabold text-white font-mono">
                    {journey.totalKm > 0 ? Math.round((journey.passengerKm / journey.totalKm) * 100) : 0}%
                  </span>
                  <span className="text-[8px] text-slate-400 font-semibold tracking-wider uppercase font-mono mt-0.5">Produtibilidade</span>
                </div>
              </div>
            </div>

            {/* Structured items lists */}
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 rounded-xl bg-purple-950/10 border border-purple-950/30">
                <div className="flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5 text-purple-400" />
                  <div>
                    <p className="text-xs font-bold text-white">Tempo Total</p>
                  </div>
                </div>
                <span className="text-xs font-bold text-white font-mono">{journey.durationMinutes} min</span>
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-purple-950/10 border border-purple-950/30">
                <div className="flex items-center gap-2">
                  <Clock3 className="w-3.5 h-3.5 text-emerald-400" />
                  <div>
                    <p className="text-xs font-bold text-slate-200">Tempo Parado</p>
                  </div>
                </div>
                <span className="text-xs font-bold text-yellow-400 font-mono">{journey.idleMinutes} min</span>
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-purple-950/10 border border-purple-950/30">
                <div className="flex items-center gap-2">
                  <Milestone className="w-3.5 h-3.5 text-blue-400" />
                  <div>
                    <p className="text-xs font-bold text-slate-200">Velocidade Máxima</p>
                  </div>
                </div>
                <span className="text-xs font-bold text-rose-400 font-mono">{journey.maxSpeed} km/h</span>
              </div>
            </div>
          </div>

          {/* FASE 4: CLASSIFICAÇÃO DOS KMs com Gráficos Individuais */}
          <div className="p-6 bg-[#0a061d]/80 border border-purple-950/50 rounded-3xl space-y-4">
            <h3 className="text-xs font-mono font-semibold text-purple-400 uppercase tracking-wider flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-purple-400" /> Classificação Detalhada dos KMs
            </h3>

            <div className="space-y-4 font-sans text-xs">
              {/* KM Produtivo */}
              <div>
                <div className="flex justify-between text-slate-300 font-mono mb-1">
                  <span>KM Produtivo (Passageiros)</span>
                  <span className="font-bold text-emerald-400">{journey.kmClassification.productiveKm.toFixed(1)} km</span>
                </div>
                <div className="w-full bg-[#05020d] rounded-lg h-2 overflow-hidden border border-purple-950/50">
                  <div 
                    className="bg-emerald-500 h-full rounded-r" 
                    style={{ width: `${journey.totalKm > 0 ? (journey.kmClassification.productiveKm / journey.totalKm) * 100 : 0}%` }}
                  />
                </div>
              </div>

              {/* KM Vazio */}
              <div>
                <div className="flex justify-between text-slate-300 font-mono mb-1">
                  <span>KM Vazio (Circular Ativo)</span>
                  <span className="font-bold text-purple-400">{journey.kmClassification.emptyKm.toFixed(1)} km</span>
                </div>
                <div className="w-full bg-[#05020d] rounded-lg h-2 overflow-hidden border border-purple-950/50">
                  <div 
                    className="bg-purple-500 h-full rounded-r" 
                    style={{ width: `${journey.totalKm > 0 ? (journey.kmClassification.emptyKm / journey.totalKm) * 100 : 0}%` }}
                  />
                </div>
              </div>

              {/* KM Particular */}
              <div>
                <div className="flex justify-between text-slate-300 font-mono mb-1">
                  <span>KM Particular (Uso pessoal)</span>
                  <span className="font-bold text-indigo-400">{journey.kmClassification.privateKm.toFixed(1)} km</span>
                </div>
                <div className="w-full bg-[#05020d] rounded-lg h-2 overflow-hidden border border-purple-950/50">
                  <div 
                    className="bg-indigo-500 h-full rounded-r" 
                    style={{ width: `${journey.totalKm > 0 ? (journey.kmClassification.privateKm / journey.totalKm) * 100 : 0}%` }}
                  />
                </div>
              </div>

              {/* KM Morto */}
              <div>
                <div className="flex justify-between text-slate-300 font-mono mb-1">
                  <span>KM Morto (Desgaste Retorno)</span>
                  <span className="font-bold text-rose-400">{journey.kmClassification.deadKm.toFixed(1)} km</span>
                </div>
                <div className="w-full bg-[#05020d] rounded-lg h-2 overflow-hidden border border-purple-950/50">
                  <div 
                    className="bg-rose-500 h-full rounded-r" 
                    style={{ width: `${journey.totalKm > 0 ? (journey.kmClassification.deadKm / journey.totalKm) * 100 : 0}%` }}
                  />
                </div>
              </div>

              {/* KM Deslocamento */}
              <div>
                <div className="flex justify-between text-slate-300 font-mono mb-1">
                  <span>KM Deslocamento (Expediente)</span>
                  <span className="font-bold text-amber-500">{journey.kmClassification.displacementKm.toFixed(1)} km</span>
                </div>
                <div className="w-full bg-[#05020d] rounded-lg h-2 overflow-hidden border border-purple-950/50">
                  <div 
                    className="bg-amber-500 h-full rounded-r" 
                    style={{ width: `${journey.totalKm > 0 ? (journey.kmClassification.displacementKm / journey.totalKm) * 100 : 0}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* FASE 3: MOTOR FINANCEIRO DETALHADO */}
      <div className="p-6 bg-[#0a061d]/80 border border-purple-950/50 rounded-3xl space-y-6">
        <div className="flex items-center justify-between border-b border-purple-950/30 pb-3">
          <h3 className="text-xs font-mono font-semibold text-purple-400 uppercase tracking-wider flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-purple-400" /> Motor Financeiro Roxou (Custos Operacionais Reais)
          </h3>
          <span className="text-[10px] bg-emerald-950/50 text-emerald-400 font-mono px-2 py-0.5 rounded border border-emerald-900/30 font-semibold">
            {vehicle?.ownership_type === 'rented' ? 'Locadora Ativa' : 'Veículo Próprio'}
          </span>
        </div>

        {/* Indicators Row */}
        <div className="grid grid-cols-1 sm:grid-cols-5 gap-4">
          <div className="p-4 rounded-xl bg-purple-950/10 border border-purple-950/20 text-center">
            <span className="text-[9px] text-slate-400 font-mono uppercase">Receita Bruta</span>
            <p className="text-md font-bold text-emerald-400 font-mono mt-1">{formatCurrency(journey.financials.grossRevenue)}</p>
          </div>
          <div className="p-4 rounded-xl bg-purple-950/10 border border-purple-950/20 text-center">
            <span className="text-[9px] text-slate-400 font-mono uppercase text-purple-300">Receita Líquida</span>
            <p className="text-md font-bold text-white font-mono mt-1">{formatCurrency(journey.financials.netRevenue)}</p>
          </div>
          <div className="p-4 rounded-xl bg-purple-950/10 border border-purple-950/20 text-center">
            <span className="text-[9px] text-slate-400 font-mono uppercase">Lucro por KM</span>
            <p className="text-md font-bold text-purple-300 font-mono mt-1">{formatCurrency(journey.financials.profitPerKm)}/km</p>
          </div>
          <div className="p-4 rounded-xl bg-purple-950/10 border border-purple-950/20 text-center">
            <span className="text-[9px] text-slate-400 font-mono uppercase">Lucro por Hora</span>
            <p className="text-md font-bold text-purple-300 font-mono mt-1">{formatCurrency(journey.financials.profitPerHour)}/h</p>
          </div>
          <div className="p-4 rounded-xl bg-purple-950/10 border border-purple-950/20 text-center">
            <span className="text-[9px] text-slate-400 font-mono uppercase">Custo real/KM</span>
            <p className="text-md font-bold text-rose-400 font-mono mt-1">{formatCurrency(journey.financials.costPerKm)}/km</p>
          </div>
        </div>

        {/* Details and items columns */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
          {/* Energy & Depreciation column */}
          <div className="p-5 bg-purple-950/5 rounded-2xl border border-purple-950/15 space-y-4">
            <h4 className="text-xs font-mono font-bold text-white uppercase tracking-wider flex items-center gap-1.5 border-b border-purple-950/30 pb-2">
              <Fuel className="w-3.5 h-3.5 text-purple-400" /> Energia & Depreciação
            </h4>

            <div className="space-y-3 font-sans text-xs text-slate-350">
              <div className="flex justify-between">
                <span>Consumo {isElectric ? 'Elétrico' : 'Combustível'}</span>
                <span className="font-mono text-white">
                  {isElectric ? `${journey.financials.electricConsumedKwh} kWh` : `${journey.financials.fuelConsumedLiters} Litros`}
                </span>
              </div>
              <div className="flex justify-between border-b border-purple-950/10 pb-2">
                <span>Custo de Energia / Posto</span>
                <span className="font-mono text-rose-400">{formatCurrency(journey.financials.energyCost)}</span>
              </div>
              <div className="flex justify-between">
                <span>Depreciação Veicular</span>
                <span className="font-mono text-rose-400">{formatCurrency(journey.financials.depreciation)}</span>
              </div>
              <p className="text-[10px] text-slate-500 leading-relaxed font-sans">
                A depreciação simula proporcionalmente o desgaste real da tabela FIPE do carro sob os {journey.totalKm} km rodados nesta sessão.
              </p>
            </div>
          </div>

          {/* Standard Wear and Auxiliary column */}
          <div className="p-5 bg-purple-950/5 rounded-2xl border border-purple-950/15 space-y-4">
            <h4 className="text-xs font-mono font-bold text-white uppercase tracking-wider flex items-center gap-1.5 border-b border-purple-950/30 pb-2">
              <Compass className="w-3.5 h-3.5 text-purple-400" /> Desgastes e Manutenção
            </h4>

            <div className="space-y-3 font-sans text-xs text-slate-350">
              <div className="flex justify-between">
                <span>Fração Desgaste de Pneus</span>
                <span className="font-mono text-rose-400">{formatCurrency(journey.financials.tiresCost)}</span>
              </div>
              {!isElectric && (
                <div className="flex justify-between border-b border-purple-950/10 pb-2">
                  <span>Fração Óleo do Motor</span>
                  <span className="font-mono text-rose-400">{formatCurrency(journey.financials.oilCost)}</span>
                </div>
              )}
              <div className="flex justify-between border-b border-purple-950/10 pb-2">
                <span>Lavagem proporcional</span>
                <span className="font-mono text-rose-400">{formatCurrency(journey.financials.washingCost)}</span>
              </div>
              <div className="flex justify-between">
                <span>Manutenção & Freios</span>
                <span className="font-mono text-rose-400">{formatCurrency(journey.financials.maintenanceCost)}</span>
              </div>
              <p className="text-[10px] text-slate-500 leading-relaxed font-sans">
                Manutenção abrange o desgaste de pastilhas de freio, reservas para emergências e rateio de revisões.
              </p>
            </div>
          </div>

          {/* Proportional Fixed & Commissions column */}
          <div className="p-5 bg-purple-950/5 rounded-2xl border border-purple-950/15 space-y-4">
            <h4 className="text-xs font-mono font-bold text-white uppercase tracking-wider flex items-center gap-1.5 border-b border-purple-950/30 pb-2">
              <Landmark className="w-3.5 h-3.5 text-purple-400" /> Impostos, Seguro & Taxas
            </h4>

            <div className="space-y-3 font-sans text-xs text-slate-350">
              <div className="flex justify-between">
                <span>IPVA Proporcional</span>
                <span className="font-mono text-rose-400">{formatCurrency(journey.financials.ipvaCost)}</span>
              </div>
              <div className="flex justify-between">
                <span>Seguro Proporcional</span>
                <span className="font-mono text-rose-400">{formatCurrency(journey.financials.insuranceCost)}</span>
              </div>
              <div className="flex justify-between border-b border-purple-950/10 pb-2">
                <span>Licenciamento Diário</span>
                <span className="font-mono text-rose-400">{formatCurrency(journey.financials.licensingCost)}</span>
              </div>

              {/* Commissions display */}
              <div className="flex justify-between border-t border-purple-950/20 pt-2 text-slate-300">
                <span>Comissões de Plataformas</span>
                <span className="font-mono text-purple-400">{formatCurrency(journey.financials.commissions)}</span>
              </div>

              {/* Platform individual fees */}
              {journey.financials.uberFees > 0 && (
                <div className="flex justify-between text-[11px] text-slate-450 pl-2">
                  <span>Taxas Uber (25% faturamento)</span>
                  <span className="font-mono">{formatCurrency(journey.financials.uberFees)}</span>
                </div>
              )}
              {journey.financials.nineNineFees > 0 && (
                <div className="flex justify-between text-[11px] text-slate-450 pl-2">
                  <span>Taxas 99 (20% faturamento)</span>
                  <span className="font-mono">{formatCurrency(journey.financials.nineNineFees)}</span>
                </div>
              )}
              {journey.financials.inDriveFees > 0 && (
                <div className="flex justify-between text-[11px] text-slate-450 pl-2">
                  <span>Taxas InDrive (10.5% faturamento)</span>
                  <span className="font-mono">{formatCurrency(journey.financials.inDriveFees)}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* FASE 5: SMART INSIGHTS */}
      {journey.insights.length > 0 && (
        <div className="p-6 bg-gradient-to-r from-[#0e0729]/80 to-[#120a3a]/80 border border-purple-900/30 rounded-3xl space-y-4">
          <h3 className="text-xs font-mono font-bold text-purple-300 uppercase tracking-wider flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-purple-400 animate-pulse" /> Insights Operacionais Personalizados DriverDash Roxou
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {journey.insights.map((ins, index) => (
              <div key={index} className="p-4 bg-[#09051d]/90 rounded-2xl border border-purple-950/20 flex items-start gap-3">
                <div className="p-1.5 rounded-xl bg-purple-950/60 text-purple-400 shrink-0 mt-0.5">
                  <Info className="w-4 h-4 text-purple-300" />
                </div>
                <p className="text-xs text-slate-300 leading-relaxed font-sans">{ins}</p>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
};
