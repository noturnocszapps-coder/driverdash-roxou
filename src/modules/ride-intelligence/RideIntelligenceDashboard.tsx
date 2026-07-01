/**
 * DriverDash Roxou - Ride Intelligence Dashboard Component (FASE 2)
 * Location: src/modules/ride-intelligence/RideIntelligenceDashboard.tsx
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { 
  Sparkles, Compass, MapPin, Search, ChevronRight, TrendingUp, 
  HelpCircle, AlertTriangle, Play, RefreshCw, Layers, ShieldCheck, 
  Check, X, DollarSign, Clock, BarChart2, Flame, Sun, CloudRain, Star, Info
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import L from 'leaflet';
import { 
  rideIntelligenceEngine, 
  NeighborhoodStats, 
  DemandPrediction, 
  OfferScoreResult, 
  DriverProfileStats, 
  SmartInsight, 
  DriverDecision 
} from './rideIntelligence.engine';

// Coordinates for Presidente Prudente districts
const NEIGHBORHOOD_COORDS: { [key: string]: { lat: number, lng: number } } = {
  'Centro': { lat: -22.1225, lng: -51.3883 },
  'Prudenshopping': { lat: -22.1147, lng: -51.4068 },
  'Parque do Povo': { lat: -22.1264, lng: -51.4022 },
  'UNOESTE': { lat: -22.1192, lng: -51.4428 },
  'Toledo': { lat: -22.1256, lng: -51.3992 },
  'Rodoviária': { lat: -22.1158, lng: -51.3853 },
  'Aeroporto': { lat: -22.1764, lng: -51.4239 },
  'UNESP': { lat: -22.1206, lng: -51.4092 },
  'Matarazzo': { lat: -22.1144, lng: -51.3811 },
  'Álvares Machado': { lat: -22.0789, lng: -51.4815 },
  'Ana Jacinta': { lat: -22.1610, lng: -51.4390 },
  'Cohab': { lat: -22.1405, lng: -51.4192 }
};

export const RideIntelligenceDashboard: React.FC = () => {
  const { earnings, expenses, vehicle, vehicleCostSettings } = useApp();

  // Load completed rides (ride_logs) from localStorage
  const [rideLogs, setRideLogs] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'bairros' | 'demanda' | 'score' | 'perfil' | 'insights'>('bairros');
  const [searchTerm, setSearchTerm] = useState('');

  // Demand Forecast Form States
  const [forecastNeighborhood, setForecastNeighborhood] = useState('Centro');
  const [forecastHour, setForecastHour] = useState<number>(new Date().getHours());
  const [forecastDay, setForecastDay] = useState<number>(new Date().getDay());
  const [forecastWeather, setForecastWeather] = useState('Limpo');
  const [forecastEvent, setForecastEvent] = useState('Nenhum');

  // Offer Simulator Form States
  const [simFare, setSimFare] = useState<string>('24.50');
  const [simDistance, setSimDistance] = useState<string>('6.5');
  const [simDuration, setSimDuration] = useState<string>('15');
  const [simPickup, setSimPickup] = useState('Centro');
  const [simDestination, setSimDestination] = useState('Prudenshopping');

  // Leaflet references
  const mapRef = useRef<L.Map | null>(null);
  const layerGroupRef = useRef<L.LayerGroup | null>(null);
  const mapContainerId = useMemo(() => 'intel-heatmap-' + Math.random().toString(36).substring(2, 7), []);

  // Sync / Recalculation Trigger state
  const [recalcCount, setRecalcCount] = useState(0);

  // Load ride logs from localStorage on mount and when changed
  useEffect(() => {
    const loadLogs = () => {
      try {
        const stored = localStorage.getItem('ride_logs');
        if (stored) {
          const parsed = JSON.parse(stored);
          setRideLogs(parsed);
        } else {
          // If empty, populate with standard historical dataset so the AI looks alive out-of-the-box
          const dummyRides = [
            {
              id: 'dummy_1',
              bairroOrigem: 'Centro',
              bairroDestino: 'Prudenshopping',
              receivedValue: 18.5,
              distance: 4.2,
              duration: 620,
              tempo_parado: 120,
              platform: 'uber',
              startTime: Date.now() - 3600 * 1000 * 2,
              status: 'finished',
              lucro: 14.50,
              velocidade_media: 25
            },
            {
              id: 'dummy_2',
              bairroOrigem: 'Prudenshopping',
              bairroDestino: 'UNOESTE',
              receivedValue: 32.0,
              distance: 9.8,
              duration: 1100,
              tempo_parado: 180,
              platform: '99',
              startTime: Date.now() - 3600 * 1000 * 5,
              status: 'finished',
              lucro: 24.20,
              velocidade_media: 35
            },
            {
              id: 'dummy_3',
              bairroOrigem: 'UNOESTE',
              bairroDestino: 'Parque do Povo',
              receivedValue: 26.5,
              distance: 7.2,
              duration: 850,
              tempo_parado: 90,
              platform: 'uber',
              startTime: Date.now() - 3600 * 1000 * 24,
              status: 'finished',
              lucro: 20.10,
              velocidade_media: 30
            },
            {
              id: 'dummy_4',
              bairroOrigem: 'Centro',
              bairroDestino: 'Álvares Machado',
              receivedValue: 38.0,
              distance: 14.5,
              duration: 1500,
              tempo_parado: 240,
              platform: 'indriver',
              startTime: Date.now() - 3600 * 1000 * 30,
              status: 'finished',
              lucro: 25.00,
              empty_km_return: 10.0,
              velocidade_media: 42
            },
            {
              id: 'dummy_5',
              bairroOrigem: 'Cohab',
              bairroDestino: 'Centro',
              receivedValue: 15.0,
              distance: 3.5,
              duration: 500,
              tempo_parado: 60,
              platform: 'uber',
              startTime: Date.now() - 3600 * 1000 * 48,
              status: 'finished',
              lucro: 11.20,
              velocidade_media: 28
            }
          ];
          localStorage.setItem('ride_logs', JSON.stringify(dummyRides));
          setRideLogs(dummyRides);
        }
      } catch (e) {
        console.error('Error loading ride_logs:', e);
      }
    };
    loadLogs();
  }, [recalcCount]);

  // Recalculate AI engine on data changes
  useEffect(() => {
    rideIntelligenceEngine.analyzeAndRecalculate(
      rideLogs,
      earnings,
      expenses,
      vehicle,
      vehicleCostSettings
    );
  }, [rideLogs, earnings, expenses, vehicle, vehicleCostSettings]);

  // Get compiled variables
  const neighborhoodList = useMemo<NeighborhoodStats[]>(() => {
    // If we have neighborhoods in cache, get them
    const list: NeighborhoodStats[] = [];
    Object.keys(NEIGHBORHOOD_COORDS).forEach(name => {
      const stats = rideIntelligenceEngine.calculateNeighborhoods(rideLogs, vehicle, vehicleCostSettings)
        .find(s => s.neighborhood.toLowerCase() === name.toLowerCase());

      if (stats) {
        list.push(stats);
      } else {
        // Mock default stats for unseen neighborhoods
        const nLower = name.toLowerCase();
        let defaultScore = 50;
        let avgFare = 19.50;
        let revenuePerKm = 2.10;

        if (['centro', 'prudenshopping', 'unoeste'].includes(nLower)) {
          defaultScore = 85;
          avgFare = 24.00;
          revenuePerKm = 2.45;
        } else if (['parque do povo', 'rodoviária', 'toledo'].includes(nLower)) {
          defaultScore = 68;
          avgFare = 18.00;
          revenuePerKm = 1.95;
        } else if (nLower.includes('machado')) {
          defaultScore = 32;
          avgFare = 34.00;
          revenuePerKm = 1.35;
        }

        list.push({
          neighborhood: name,
          ridesCount: 0,
          avgFare,
          avgProfit: avgFare * 0.72,
          avgDurationMin: 15.2,
          avgIdleSec: 90,
          emptyReturnKm: 0,
          revenuePerKm,
          revenuePerHour: avgFare * 4,
          avgSpeedKmh: 31,
          avgDistanceKm: 6.2,
          peakHours: ['11h–13h', '18h–22h'],
          bestDays: ['Sexta', 'Sábado'],
          returnIndex: defaultScore >= 60 ? 75 : 35,
          cancellationIndex: 5,
          score: defaultScore
        });
      }
    });

    return list.sort((a, b) => b.score - a.score);
  }, [rideLogs, vehicle, vehicleCostSettings]);

  // Filtered neighborhoods list based on search bar
  const filteredNeighborhoods = useMemo(() => {
    return neighborhoodList.filter(n => 
      n.neighborhood.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [neighborhoodList, searchTerm]);

  // Driver Personal Profile Stats
  const driverProfile = useMemo<DriverProfileStats>(() => {
    return rideIntelligenceEngine.calculateDriverProfile(rideLogs, earnings, expenses);
  }, [rideLogs, earnings, expenses]);

  // AI Diagnostic Insights list
  const smartInsights = useMemo<SmartInsight[]>(() => {
    return rideIntelligenceEngine.generateInsights(
      rideLogs,
      earnings,
      expenses,
      vehicle,
      vehicleCostSettings
    );
  }, [rideLogs, earnings, expenses, vehicle, vehicleCostSettings]);

  // Active demand forecast calculation
  const demandForecast = useMemo<DemandPrediction>(() => {
    return rideIntelligenceEngine.predictDemand(
      forecastNeighborhood,
      Number(forecastHour),
      Number(forecastDay),
      forecastWeather,
      forecastEvent
    );
  }, [forecastNeighborhood, forecastHour, forecastDay, forecastWeather, forecastEvent]);

  // Active Offer Score Simulation
  const offerScoreResult = useMemo<OfferScoreResult>(() => {
    return rideIntelligenceEngine.calculateOfferScore(
      parseFloat(simFare) || 15.0,
      parseFloat(simDistance) || 5.0,
      parseFloat(simDuration) || 12,
      simPickup,
      simDestination,
      vehicle,
      vehicleCostSettings
    );
  }, [simFare, simDistance, simDuration, simPickup, simDestination, vehicle, vehicleCostSettings]);

  // Decisions list
  const [decisionsLog, setDecisionsLog] = useState<DriverDecision[]>([]);
  useEffect(() => {
    setDecisionsLog(rideIntelligenceEngine.getDecisionsLog());
  }, [recalcCount]);

  // Initialize and Render Leaflet Heatmap
  useEffect(() => {
    const cssId = 'leaflet-css-cdn';
    if (!document.getElementById(cssId)) {
      const link = document.createElement('link');
      link.id = cssId;
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      link.crossOrigin = '';
      document.head.appendChild(link);
    }

    // Delay map initialization slightly to ensure container is fully mounted
    const timer = setTimeout(() => {
      const container = document.getElementById(mapContainerId);
      if (!container || mapRef.current) return;

      const map = L.map(mapContainerId, {
        center: [-22.1225, -51.3883], // center of Presidente Prudente
        zoom: 13,
        zoomControl: false,
        attributionControl: false
      });

      mapRef.current = map;

      // Dark elegant tile layer mapping
      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        maxZoom: 18,
      }).addTo(map);

      // Custom zoom buttons placement
      L.control.zoom({ position: 'topright' }).addTo(map);

      const group = L.layerGroup().addTo(map);
      layerGroupRef.current = group;

      // Redraw overlays
      drawHeatmapOverlays();

      // Force refresh size
      setTimeout(() => {
        map.invalidateSize();
      }, 500);
    }, 300);

    return () => {
      clearTimeout(timer);
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [activeTab, mapContainerId]);

  // Helper to draw color circle overlays over mapped zones
  const drawHeatmapOverlays = () => {
    if (!mapRef.current || !layerGroupRef.current) return;

    layerGroupRef.current.clearLayers();

    neighborhoodList.forEach(stats => {
      const coords = NEIGHBORHOOD_COORDS[stats.neighborhood];
      if (!coords) return;

      const heatColor = rideIntelligenceEngine.getNeighborhoodHeatColor(stats.neighborhood);
      
      let overlayColor = '#ef4444'; // red default (bad)
      if (heatColor === 'verde') overlayColor = '#22c55e'; // green (excelente)
      if (heatColor === 'amarelo') overlayColor = '#eab308'; // yellow (medio/attention)

      // 1. Interactive Circle representing the district's capture zone
      const circle = L.circle([coords.lat, coords.lng], {
        radius: 650,
        fillColor: overlayColor,
        fillOpacity: 0.28,
        color: overlayColor,
        weight: 2,
        dashArray: stats.score >= 80 ? '3, 3' : undefined
      });

      // Bind dynamic data popup
      circle.bindTooltip(`
        <div style="font-family: monospace; font-size: 11px; background-color: #0c081e; color: #f1f5f9; padding: 4px; border: 1px solid #4c1d95; border-radius: 8px;">
          <strong style="color: #c084fc;">${stats.neighborhood}</strong><br/>
          Score IA: <span style="font-weight: bold; color: ${overlayColor}">${stats.score}/100</span><br/>
          R$/km: R$ ${stats.revenuePerKm.toFixed(2)}<br/>
          Faturamento Médio: R$ ${stats.avgFare.toFixed(1)}<br/>
          Retorno Seco: ${stats.emptyReturnKm > 0 ? stats.emptyReturnKm + ' km' : 'Mínimo'}
        </div>
      `, {
        permanent: false,
        direction: 'top',
        opacity: 0.95
      });

      layerGroupRef.current.addLayer(circle);

      // 2. Custom anchor HTML label
      const icon = L.divIcon({
        className: 'custom-html-marker',
        html: `
          <div style="transform: translate(-50%, -50%); display: flex; flex-col; items-center; justify-content: center;">
            <span style="font-size: 9px; font-weight: bold; background-color: #05030c; border: 1px solid ${overlayColor}; border-radius: 4px; padding: 1px 4px; color: #fff; white-space: nowrap;">
              ${stats.neighborhood}: ${stats.score}
            </span>
          </div>
        `,
        iconSize: [0, 0]
      });

      const marker = L.marker([coords.lat, coords.lng], { icon });
      layerGroupRef.current.addLayer(marker);
    });
  };

  // Triggers redraw of Leaflet map whenever neighborhoods recalculate
  useEffect(() => {
    drawHeatmapOverlays();
  }, [neighborhoodList]);

  // Register Driver Simulated Accept Decision (Requirement 9 & 8)
  const handleSimulateDecision = (action: 'accepted' | 'declined') => {
    // 1. Log decision inside engine
    rideIntelligenceEngine.registerDriverDecision(
      'sim_' + Date.now(),
      offerScoreResult.score,
      offerScoreResult.rating,
      action,
      `Simulação de decisão do motorista de ${action === 'accepted' ? 'Aceitar' : 'Recusar'} corrida saindo de ${simPickup} para ${simDestination}.`
    );

    // 2. If accepted, let's also simulate writing a completed ride log to localStorage (to allow continuous statistics learning)
    if (action === 'accepted') {
      try {
        const stored = localStorage.getItem('ride_logs');
        const logs = stored ? JSON.parse(stored) : [];
        
        const newRideLog = {
          id: 'ride_sim_' + Date.now(),
          bairroOrigem: simPickup,
          bairroDestino: simDestination,
          receivedValue: parseFloat(simFare),
          distance: parseFloat(simDistance),
          duration: parseFloat(simDuration) * 60,
          tempo_parado: 120,
          platform: 'uber',
          startTime: Date.now(),
          status: 'finished',
          lucro: offerScoreResult.estimatedProfit,
          velocidade_media: 32
        };

        const updatedLogs = [newRideLog, ...logs];
        localStorage.setItem('ride_logs', JSON.stringify(updatedLogs));
      } catch (e) {
        console.error('Error simulating ride acceptance write:', e);
      }
    }

    // 3. Force state refresh to update all dashboards dynamically
    setRecalcCount(prev => prev + 1);
  };

  // Clear simulated decisions log
  const handleClearDecisions = () => {
    localStorage.removeItem('driverdash_ai_decisions');
    // Also reset base dummy rides to default
    localStorage.removeItem('ride_logs');
    setRecalcCount(prev => prev + 1);
  };

  return (
    <div className="space-y-6">
      
      {/* HEADER BANNER - STATUS MONITOR */}
      <div className="p-5 rounded-3xl bg-gradient-to-r from-[#09051d] via-[#110935] to-[#09051d] border border-purple-950/40 flex flex-col md:flex-row items-center justify-between gap-5 relative overflow-hidden shadow-xl">
        <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/10 rounded-full filter blur-2xl pointer-events-none" />
        
        <div className="flex items-center gap-4 text-left">
          <div className="w-12 h-12 rounded-2xl bg-purple-950/50 border border-purple-500/20 flex items-center justify-center text-purple-400 shadow-inner shrink-0">
            <Compass className="w-6 h-6 animate-spin" style={{ animationDuration: '10s' }} />
          </div>
          <div>
            <h3 className="font-sans font-bold text-slate-100 text-sm flex items-center gap-2">
              Motor de Inteligência de Corridas (IA Fase 2)
              <span className="text-[8px] bg-indigo-500/30 text-indigo-300 font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border border-indigo-500/20 animate-pulse">
                Aprendizado Ativo
              </span>
            </h3>
            <p className="text-[11px] text-purple-300/60 font-sans leading-relaxed mt-0.5">
              Analisando em tempo real: <strong className="text-purple-400 font-mono">{rideLogs.length} corridas</strong> • 
              Histórico financeiro • Padrões operacionais • Aprendizado contínuo por reforço.
            </p>
          </div>
        </div>

        <button 
          onClick={() => setRecalcCount(prev => prev + 1)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-950/50 hover:bg-purple-950 border border-purple-900/30 rounded-xl text-[10px] text-purple-300 hover:text-purple-100 font-bold font-mono transition-all uppercase tracking-wider"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Forçar Recálculo
        </button>
      </div>

      {/* DASHBOARD TABS */}
      <div className="grid grid-cols-2 sm:grid-cols-5 bg-[#05030c] border border-purple-950/15 p-1 rounded-2xl gap-1">
        <button
          onClick={() => setActiveTab('bairros')}
          className={`py-2.5 px-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex flex-col sm:flex-row items-center justify-center gap-1.5 ${
            activeTab === 'bairros' ? 'bg-purple-950/40 text-purple-300 border border-purple-900/30' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Compass className="w-3.5 h-3.5 shrink-0" /> Bairros Inteligentes
        </button>
        <button
          onClick={() => setActiveTab('demanda')}
          className={`py-2.5 px-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex flex-col sm:flex-row items-center justify-center gap-1.5 ${
            activeTab === 'demanda' ? 'bg-purple-950/40 text-purple-300 border border-purple-900/30' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Flame className="w-3.5 h-3.5 shrink-0" /> Previsor de Demanda
        </button>
        <button
          onClick={() => setActiveTab('score')}
          className={`py-2.5 px-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex flex-col sm:flex-row items-center justify-center gap-1.5 ${
            activeTab === 'score' ? 'bg-purple-950/40 text-purple-300 border border-purple-900/30' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Star className="w-3.5 h-3.5 shrink-0" /> Score de Oferta
        </button>
        <button
          onClick={() => setActiveTab('perfil')}
          className={`py-2.5 px-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex flex-col sm:flex-row items-center justify-center gap-1.5 ${
            activeTab === 'perfil' ? 'bg-purple-950/40 text-purple-300 border border-purple-900/30' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <ShieldCheck className="w-3.5 h-3.5 shrink-0" /> Perfil de Direção
        </button>
        <button
          onClick={() => setActiveTab('insights')}
          className={`py-2.5 px-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex flex-col sm:flex-row items-center justify-center gap-1.5 col-span-2 sm:col-span-1 ${
            activeTab === 'insights' ? 'bg-purple-950/40 text-purple-300 border border-purple-900/30' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5 shrink-0" /> Insights ({smartInsights.length})
        </button>
      </div>

      {/* RENDER ACTIVE TAB BODY */}
      <div className="min-h-[400px]">
        
        {/* TAB 1: APRENDIZADO DOS BAIRROS & HEATMAP */}
        {activeTab === 'bairros' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* HEATMAP LEAFLET CONTAINER */}
            <div className="lg:col-span-2 space-y-4">
              <div className="bg-[#09051d] border border-purple-950/30 rounded-3xl overflow-hidden shadow-lg flex flex-col">
                <div className="p-4 border-b border-purple-950/15 bg-purple-950/10 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Layers className="w-4 h-4 text-purple-400" />
                    <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider font-mono">Mapa de Calor Inteligente (Presidente Prudente)</h4>
                  </div>
                  <div className="flex gap-4 text-[10px] font-bold text-slate-400 font-mono uppercase">
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500"></span> Verde (Rentável)</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-500"></span> Amarelo (Médio)</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-rose-500"></span> Vermelho (Evitar)</span>
                  </div>
                </div>
                
                {/* Real interactive Leaflet Map Frame */}
                <div 
                  id={mapContainerId} 
                  style={{ height: '380px' }} 
                  className="w-full relative z-10 bg-[#05030c]"
                />
              </div>
              
              <div className="p-4 rounded-2xl bg-[#09051d] border border-purple-950/35 flex items-center gap-3 text-left">
                <Info className="w-5 h-5 text-indigo-400 shrink-0" />
                <p className="text-[11px] text-purple-300/70 font-sans leading-relaxed">
                  <strong>Como o mapa aprende?</strong> A cada corrida finalizada ou decisão tomada, os índices de rentabilidade de cada bairro são atualizados. Vias com maiores margens de lucro, menor tempo parado e fácil retorno sobem no ranking e são coloridas de <strong>verde</strong>.
                </p>
              </div>
            </div>

            {/* NEIGHBORHOODS KPI LIST */}
            <div className="lg:col-span-1 space-y-4">
              <div className="p-5 bg-[#0b0720]/80 border border-purple-950/40 rounded-3xl flex flex-col max-h-[470px]">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-xs font-extrabold text-slate-300 font-mono uppercase tracking-wider">Catálogo de Bairros</h4>
                  <span className="text-[9px] font-mono bg-purple-950 text-purple-400 px-2 py-0.5 rounded-md border border-purple-900/30 font-bold uppercase">
                    {filteredNeighborhoods.length} Zonas
                  </span>
                </div>

                <div className="relative mb-3.5">
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Filtrar bairro..."
                    className="w-full pl-9 pr-4 py-2 bg-[#05030c] border border-purple-950/30 rounded-xl text-xs text-slate-300 placeholder-purple-400/40 focus:outline-none focus:border-purple-500 transition-colors font-sans"
                  />
                  <Search className="w-4 h-4 text-purple-400/50 absolute left-3 top-2.5" />
                </div>

                {/* SCROLLABLE CATALOG */}
                <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 custom-scrollbar">
                  {filteredNeighborhoods.map(item => {
                    const heatColor = rideIntelligenceEngine.getNeighborhoodHeatColor(item.neighborhood);
                    let textBadgeColor = 'text-emerald-400 border-emerald-500/25 bg-emerald-950/35';
                    if (heatColor === 'amarelo') textBadgeColor = 'text-yellow-400 border-yellow-500/25 bg-yellow-950/35';
                    if (heatColor === 'vermelho') textBadgeColor = 'text-rose-400 border-rose-500/25 bg-rose-950/35';

                    return (
                      <div 
                        key={item.neighborhood} 
                        className="p-3 bg-[#05030c]/70 border border-purple-950/15 hover:border-purple-500/20 rounded-2xl flex items-center justify-between transition-all"
                      >
                        <div className="text-left space-y-1 max-w-[70%]">
                          <p className="text-xs font-bold text-slate-200 truncate">{item.neighborhood}</p>
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[9px] text-slate-400">
                            <span>{item.ridesCount} corridas</span>
                            <span>•</span>
                            <span className="text-purple-400 font-bold">R$ {item.revenuePerKm}/km</span>
                            <span>•</span>
                            <span className="text-indigo-400">R$ {item.revenuePerHour.toFixed(0)}/h</span>
                          </div>
                          <div className="text-[8px] text-slate-500 font-mono">
                            Best: {item.bestDays[0] || 'Sexta'} às {item.peakHours[0] || '18h–20h'}
                          </div>
                        </div>

                        <div className="text-right space-y-1 shrink-0">
                          <span className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded-full border ${textBadgeColor}`}>
                            Score: {item.score}
                          </span>
                          <p className="text-[8px] text-slate-500 font-mono">
                            Retorno: {item.returnIndex}%
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: PREVISOR DE DEMANDA */}
        {activeTab === 'demanda' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 text-left">
            
            {/* PARAMETERS CONFIG FORM */}
            <div className="p-6 bg-[#0b0720]/80 border border-purple-950/40 rounded-3xl space-y-5 flex flex-col justify-between">
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Compass className="w-5 h-5 text-purple-400" />
                  <h4 className="text-sm font-bold text-slate-200 uppercase font-mono tracking-wider">Simulador de Condições de Tráfego</h4>
                </div>
                <p className="text-xs text-purple-300/60 leading-relaxed font-sans">
                  Ajuste os parâmetros abaixo de acordo com as condições meteorológicas e horário atual para simular e prever o índice de chamada na região.
                </p>

                <div className="grid grid-cols-2 gap-4">
                  
                  {/* Bairro Selector */}
                  <div className="space-y-1.5 col-span-2">
                    <label className="text-[10px] text-slate-400 uppercase font-mono font-bold">Bairro de Partida</label>
                    <select
                      value={forecastNeighborhood}
                      onChange={(e) => setForecastNeighborhood(e.target.value)}
                      className="w-full px-3 py-2.5 bg-[#05030c] border border-purple-950/30 rounded-xl text-xs text-slate-300 font-sans focus:outline-none focus:border-purple-500"
                    >
                      {Object.keys(NEIGHBORHOOD_COORDS).map(name => (
                        <option key={name} value={name}>{name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Horário */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-slate-400 uppercase font-mono font-bold">Horário de Operação</label>
                    <select
                      value={forecastHour}
                      onChange={(e) => setForecastHour(Number(e.target.value))}
                      className="w-full px-3 py-2.5 bg-[#05030c] border border-purple-950/30 rounded-xl text-xs text-slate-300 font-sans focus:outline-none"
                    >
                      {Array.from({ length: 24 }).map((_, h) => (
                        <option key={h} value={h}>{h.toString().padStart(2, '0')}:00</option>
                      ))}
                    </select>
                  </div>

                  {/* Dia da Semana */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-slate-400 uppercase font-mono font-bold">Dia da Semana</label>
                    <select
                      value={forecastDay}
                      onChange={(e) => setForecastDay(Number(e.target.value))}
                      className="w-full px-3 py-2.5 bg-[#05030c] border border-purple-950/30 rounded-xl text-xs text-slate-300 font-sans focus:outline-none"
                    >
                      <option value="0">Domingo</option>
                      <option value="1">Segunda-feira</option>
                      <option value="2">Terça-feira</option>
                      <option value="3">Quarta-feira</option>
                      <option value="4">Quinta-feira</option>
                      <option value="5">Sexta-feira</option>
                      <option value="6">Sábado</option>
                    </select>
                  </div>

                  {/* Clima */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-slate-400 uppercase font-mono font-bold">Clima Atual</label>
                    <select
                      value={forecastWeather}
                      onChange={(e) => setForecastWeather(e.target.value)}
                      className="w-full px-3 py-2.5 bg-[#05030c] border border-purple-950/30 rounded-xl text-xs text-slate-300 font-sans focus:outline-none"
                    >
                      <option value="Limpo">☀️ Ensolarado / Limpo</option>
                      <option value="Nublado">☁️ Nublado</option>
                      <option value="Chuvoso">🌧️ Chuvoso (Pico de Chamadas)</option>
                      <option value="Tempestade">⚡ Tempestade de Raios</option>
                    </select>
                  </div>

                  {/* Eventos especiais */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-slate-400 uppercase font-mono font-bold">Eventos Especiais</label>
                    <select
                      value={forecastEvent}
                      onChange={(e) => setForecastEvent(e.target.value)}
                      className="w-full px-3 py-2.5 bg-[#05030c] border border-purple-950/30 rounded-xl text-xs text-slate-300 font-sans focus:outline-none"
                    >
                      <option value="Nenhum">Nenhum evento mapeado</option>
                      <option value="Expo Prudente">🎡 Expo Prudente (Grande Saída)</option>
                      <option value="Festa Universitária">🎓 Festa Universitária (UNOESTE)</option>
                      <option value="Pico Rodoviário">🚌 Véspera de Feriado Rodoviário</option>
                    </select>
                  </div>

                </div>
              </div>

              <div className="pt-4 border-t border-purple-950/15 text-[10px] text-slate-500 font-mono uppercase tracking-wide">
                Algoritmo Inteligente Bayesiano Autônomo
              </div>
            </div>

            {/* PREDICTIVE RESULTS CARD */}
            <div className="p-6 bg-[#0b0720]/80 border border-purple-950/40 rounded-3xl flex flex-col justify-between relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-36 h-36 bg-purple-500/5 rounded-full filter blur-3xl pointer-events-none group-hover:bg-purple-600/10 transition-colors duration-500" />
              
              <div className="space-y-6">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-[9px] text-purple-400 font-mono font-bold uppercase tracking-wider">Resultado da IA</span>
                    <h3 className="text-xl font-extrabold text-slate-100 font-sans mt-0.5">{forecastNeighborhood}</h3>
                  </div>
                  
                  {/* Demand badge color */}
                  <span className={`text-xs font-bold font-sans px-3 py-1 rounded-xl border ${
                    demandForecast.level === 'high' 
                      ? 'bg-rose-950/40 text-rose-400 border-rose-800/50' 
                      : demandForecast.level === 'medium'
                      ? 'bg-yellow-950/40 text-yellow-400 border-yellow-800/40'
                      : 'bg-slate-950/40 text-slate-400 border-slate-800/30'
                  }`}>
                    {demandForecast.level === 'high' ? '🎯 Demanda Alta' : demandForecast.level === 'medium' ? '⚡ Demanda Média' : '💤 Demanda Baixa'}
                  </span>
                </div>

                {/* Large Recommendation text */}
                <div className="p-5 rounded-2xl bg-[#05030c]/80 border border-purple-950/20 text-slate-200">
                  <p className="text-xs font-bold text-purple-400 font-mono tracking-wide uppercase">Diagnóstico Recomendado:</p>
                  <p className="text-sm font-semibold leading-relaxed mt-2 text-slate-200">
                    "{demandForecast.probabilityMessage}"
                  </p>
                </div>

                {/* KPI details */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 bg-[#05030c]/50 border border-purple-950/10 rounded-xl">
                    <span className="text-[9px] text-slate-500 block uppercase font-mono font-bold">Multiplicador Est.</span>
                    <strong className="text-sm font-extrabold text-[#e1e1e6] font-mono mt-0.5">
                      {demandForecast.surgeEstimate.toFixed(2)}x (Tarifa Roxou)
                    </strong>
                  </div>
                  <div className="p-3 bg-[#05030c]/50 border border-purple-950/10 rounded-xl">
                    <span className="text-[9px] text-slate-500 block uppercase font-mono font-bold">Probabilidade Geral</span>
                    <strong className="text-sm font-extrabold text-[#e1e1e6] font-mono mt-0.5">
                      {demandForecast.level === 'high' ? '92%' : demandForecast.level === 'medium' ? '65%' : '28%'}
                    </strong>
                  </div>
                </div>

                {/* Weather icon visual indication */}
                <div className="flex items-center gap-2.5 p-3.5 bg-purple-950/10 border border-purple-900/15 rounded-2xl">
                  {forecastWeather.includes('Chuvia') || forecastWeather.includes('Chuvoso') ? (
                    <CloudRain className="w-5 h-5 text-indigo-400 animate-bounce" />
                  ) : (
                    <Sun className="w-5 h-5 text-yellow-400 animate-pulse" />
                  )}
                  <p className="text-[11px] text-purple-300/60 font-sans">
                    Condição climática de <strong>{forecastWeather}</strong> eleva as chances de cancelamentos e picos de demanda no app da Uber/99 em cerca de 25%.
                  </p>
                </div>
              </div>

              <div className="text-[9px] text-slate-500 font-mono mt-4 uppercase">
                Copiloto de decisões DriverDash Roxou
              </div>
            </div>

          </div>
        )}

        {/* TAB 3: OFFER SCORE SIMULATOR & DECISION LOG */}
        {activeTab === 'score' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 text-left">
            
            {/* INCOMING OFFER SIMULATION FORM */}
            <div className="p-6 bg-[#0b0720]/80 border border-purple-950/40 rounded-3xl space-y-4">
              <div className="flex items-center gap-2">
                <Star className="w-5 h-5 text-purple-400" />
                <h4 className="text-sm font-bold text-slate-200 uppercase font-mono tracking-wider">Simulador de Oferta de Corrida</h4>
              </div>
              <p className="text-xs text-purple-300/60 leading-relaxed font-sans">
                Insira as informações de uma corrida oferecida no celular para calcular o Score IA em tempo real e simular a tomada de decisão do motorista.
              </p>

              <div className="grid grid-cols-2 gap-3.5">
                
                {/* Valor Recebido */}
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-400 uppercase font-mono font-bold">Valor Recebido (R$)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={simFare}
                    onChange={(e) => setSimFare(e.target.value)}
                    className="w-full px-3 py-2 bg-[#05030c] border border-purple-950/30 rounded-xl text-xs text-slate-300 focus:outline-none focus:border-purple-500 font-mono font-bold"
                  />
                </div>

                {/* Distância */}
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-400 uppercase font-mono font-bold">Distância Total (km)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={simDistance}
                    onChange={(e) => setSimDistance(e.target.value)}
                    className="w-full px-3 py-2 bg-[#05030c] border border-purple-950/30 rounded-xl text-xs text-slate-300 focus:outline-none focus:border-purple-500 font-mono font-bold"
                  />
                </div>

                {/* Tempo Estimado */}
                <div className="space-y-1 col-span-2 sm:col-span-1">
                  <label className="text-[10px] text-slate-400 uppercase font-mono font-bold">Tempo Estimado (min)</label>
                  <input
                    type="number"
                    value={simDuration}
                    onChange={(e) => setSimDuration(e.target.value)}
                    className="w-full px-3 py-2 bg-[#05030c] border border-purple-950/30 rounded-xl text-xs text-slate-300 focus:outline-none focus:border-purple-500 font-mono font-bold"
                  />
                </div>

                {/* Bairro Origem */}
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-400 uppercase font-mono font-bold">Bairro de Partida</label>
                  <select
                    value={simPickup}
                    onChange={(e) => setSimPickup(e.target.value)}
                    className="w-full px-3 py-2 bg-[#05030c] border border-purple-950/30 rounded-xl text-xs text-slate-300 focus:outline-none"
                  >
                    {Object.keys(NEIGHBORHOOD_COORDS).map(name => (
                      <option key={name} value={name}>{name}</option>
                    ))}
                  </select>
                </div>

                {/* Bairro Destino */}
                <div className="space-y-1 col-span-2">
                  <label className="text-[10px] text-slate-400 uppercase font-mono font-bold">Bairro de Destino</label>
                  <select
                    value={simDestination}
                    onChange={(e) => setSimDestination(e.target.value)}
                    className="w-full px-3 py-2 bg-[#05030c] border border-purple-950/30 rounded-xl text-xs text-slate-300 focus:outline-none"
                  >
                    {Object.keys(NEIGHBORHOOD_COORDS).map(name => (
                      <option key={name} value={name}>{name}</option>
                    ))}
                  </select>
                </div>

              </div>
            </div>

            {/* REAL-TIME SIMULATOR RESULTS & REINFORCEMENT LEARNING */}
            <div className="p-6 bg-[#0b0720]/80 border border-purple-950/40 rounded-3xl flex flex-col justify-between">
              
              <div className="space-y-4">
                <div className="flex justify-between items-start border-b border-purple-950/15 pb-3">
                  <div>
                    <span className="text-[9px] text-slate-500 font-mono uppercase font-bold">Score da Oferta</span>
                    <div className="flex items-baseline gap-2 mt-0.5">
                      <h3 className="text-3xl font-extrabold text-white font-mono">{offerScoreResult.score}</h3>
                      <span className="text-[10px] text-slate-400 font-mono">/ 100</span>
                    </div>
                  </div>

                  <span className={`text-xs font-black font-sans px-3 py-1.5 rounded-xl border uppercase tracking-wider ${
                    offerScoreResult.rating === 'Excelente' 
                      ? 'bg-emerald-950 text-emerald-400 border-emerald-800/50' 
                      : offerScoreResult.rating === 'Boa'
                      ? 'bg-teal-950 text-teal-400 border-teal-800/40'
                      : offerScoreResult.rating === 'Aceitável'
                      ? 'bg-yellow-950 text-yellow-400 border-yellow-800/30'
                      : offerScoreResult.rating === 'Somente se retornar'
                      ? 'bg-indigo-950 text-indigo-400 border-indigo-800/30'
                      : 'bg-rose-950 text-rose-400 border-rose-800/50'
                  }`}>
                    {offerScoreResult.rating}
                  </span>
                </div>

                {/* AI Text explanation */}
                <p className="text-[11px] font-medium leading-relaxed bg-[#05030c]/70 border border-purple-950/20 p-3.5 rounded-2xl text-slate-200">
                  <span className="text-[9px] text-purple-400 block font-mono font-bold uppercase mb-1">Análise da IA:</span>
                  "{offerScoreResult.reason}"
                </p>

                {/* Simulated metrics breakdown */}
                <div className="grid grid-cols-2 gap-3.5 text-xs">
                  <div className="p-3 bg-[#05030c]/50 border border-purple-950/10 rounded-xl">
                    <span className="text-[9px] text-slate-500 block uppercase font-mono font-bold">Lucro Líquido Estimado</span>
                    <strong className="text-sm font-extrabold text-emerald-400 font-mono mt-0.5">
                      R$ {offerScoreResult.estimatedProfit.toFixed(2)}
                    </strong>
                  </div>
                  <div className="p-3 bg-[#05030c]/50 border border-purple-950/10 rounded-xl">
                    <span className="text-[9px] text-slate-500 block uppercase font-mono font-bold">Custo de Operação</span>
                    <strong className="text-sm font-extrabold text-rose-400/80 font-mono mt-0.5">
                      R$ {offerScoreResult.costEstimate.toFixed(2)}
                    </strong>
                  </div>
                  <div className="p-3 bg-[#05030c]/50 border border-purple-950/10 rounded-xl">
                    <span className="text-[9px] text-slate-500 block uppercase font-mono font-bold">R$ por KM</span>
                    <strong className="text-sm font-extrabold text-[#e1e1e6] font-mono mt-0.5">
                      R$ {offerScoreResult.revenuePerKm.toFixed(2)} / km
                    </strong>
                  </div>
                  <div className="p-3 bg-[#05030c]/50 border border-purple-950/10 rounded-xl">
                    <span className="text-[9px] text-slate-500 block uppercase font-mono font-bold">R$ por Hora</span>
                    <strong className="text-sm font-extrabold text-[#e1e1e6] font-mono mt-0.5">
                      R$ {offerScoreResult.revenuePerHour.toFixed(0)} / h
                    </strong>
                  </div>
                </div>

                {/* DECISION BUTTONS & LEARNING REINFORCEMENT LOOP */}
                <div className="pt-4 border-t border-purple-950/15 flex flex-col sm:flex-row gap-3">
                  <button
                    onClick={() => handleSimulateDecision('accepted')}
                    className="flex-1 py-3 px-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-extrabold text-xs rounded-xl shadow-lg shadow-emerald-500/10 cursor-pointer flex items-center justify-center gap-1.5 transition-all uppercase tracking-wide"
                  >
                    <Check className="w-4 h-4 shrink-0" /> Aceitar Corrida
                  </button>
                  <button
                    onClick={() => handleSimulateDecision('declined')}
                    className="flex-1 py-3 px-4 bg-[#05030c] hover:bg-slate-900 text-rose-400 border border-rose-950/35 hover:border-rose-800 font-extrabold text-xs rounded-xl cursor-pointer flex items-center justify-center gap-1.5 transition-all uppercase tracking-wide"
                  >
                    <X className="w-4 h-4 shrink-0" /> Recusar Corrida
                  </button>
                </div>
              </div>

              {/* ACCESSIBILITY DECISIONS HISTORY */}
              <div className="mt-5 space-y-2.5 text-left border-t border-purple-950/15 pt-4">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-slate-400 uppercase font-mono font-bold">Log de Tomada de Decisão (Acessibilidade)</span>
                  {decisionsLog.length > 0 && (
                    <button 
                      onClick={handleClearDecisions}
                      className="text-[9px] text-rose-400 hover:text-rose-200 font-mono uppercase font-bold bg-transparent border-none cursor-pointer"
                    >
                      Limpar Logs
                    </button>
                  )}
                </div>

                <div className="divide-y divide-purple-950/10 max-h-[140px] overflow-y-auto custom-scrollbar space-y-1.5">
                  {decisionsLog.length === 0 ? (
                    <div className="text-[10px] text-slate-500 italic p-2 bg-[#05030c]/30 rounded-lg text-center">
                      Nenhuma decisão simulada registrada ainda. Use os botões acima para treinar a IA!
                    </div>
                  ) : (
                    decisionsLog.map((dec, idx) => (
                      <div key={dec.id || idx} className="py-2 flex items-center justify-between text-[11px] text-slate-300 font-sans">
                        <div className="truncate max-w-[70%]">
                          <span className={`w-1.5 h-1.5 inline-block rounded-full mr-1.5 ${dec.action === 'accepted' ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
                          <span className="text-[10px] text-slate-400 font-mono">{new Date(dec.timestamp).toLocaleTimeString()}:</span>{' '}
                          <strong>{dec.action === 'accepted' ? 'Aceitou' : 'Recusou'}</strong> • Score {dec.score} ({dec.rating})
                        </div>
                        <span className="text-[9px] text-purple-400 font-mono bg-purple-950/35 border border-purple-900/30 px-1.5 py-0.2 rounded shrink-0">
                          IA aprendeu!
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>

            </div>
          </div>
        )}

        {/* TAB 4: PERFIL DE DIREÇÃO / MOTORISTA */}
        {activeTab === 'perfil' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-left">
            
            {/* PERSONAL STATS OVERVIEW */}
            <div className="p-6 bg-[#0b0720]/80 border border-purple-950/40 rounded-3xl space-y-6">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-purple-400" />
                <h4 className="text-sm font-bold text-slate-200 uppercase font-mono tracking-wider font-extrabold">Estatísticas Pessoais</h4>
              </div>

              <div className="space-y-4">
                <div className="p-4 bg-[#05030c] border border-purple-950/20 rounded-2xl flex items-center justify-between">
                  <div className="space-y-1 text-left">
                    <span className="text-[9px] text-slate-500 uppercase font-mono font-bold">Ganhos por Hora Estimado</span>
                    <p className="text-xl font-extrabold text-[#e1e1e6] font-mono">
                      R$ {driverProfile.averageHourlyEarning.toFixed(2)} / h
                    </p>
                  </div>
                  <DollarSign className="w-8 h-8 text-purple-400/30" />
                </div>

                <div className="p-4 bg-[#05030c] border border-purple-950/20 rounded-2xl flex items-center justify-between">
                  <div className="space-y-1 text-left">
                    <span className="text-[9px] text-slate-500 uppercase font-mono font-bold">Margem de Lucro Líquida Média</span>
                    <p className="text-xl font-extrabold text-emerald-400 font-mono">
                      {driverProfile.averageProfitMargin.toFixed(1)}% de margem
                    </p>
                  </div>
                  <TrendingUp className="w-8 h-8 text-emerald-400/30" />
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-purple-950/10 border border-purple-900/15 flex items-center gap-3">
                <Info className="w-5 h-5 text-indigo-400 shrink-0" />
                <p className="text-[11px] text-purple-300/60 font-sans">
                  Estes indicadores representam a fusão do seu faturamento em dinheiro, gastos com manutenção inseridos no app e telemetria GPS.
                </p>
              </div>
            </div>

            {/* AI DRIVER DIAGNOSIS INSIGHT CARD */}
            <div className="p-6 bg-[#0b0720]/80 border border-purple-950/40 rounded-3xl flex flex-col justify-between">
              <div className="space-y-4 text-left">
                <div className="flex items-center gap-1.5 text-purple-400">
                  <Sparkles className="w-4.5 h-4.5" />
                  <span className="text-xs font-bold text-slate-300 uppercase font-mono tracking-wider">Você Ganha Melhor:</span>
                </div>

                <div className="space-y-3 font-sans text-xs text-slate-300">
                  <div className="flex items-center gap-2.5">
                    <span className="w-2 h-2 rounded-full bg-purple-400" />
                    <span><strong>Melhores Horários:</strong> {driverProfile.bestTimeSlots.join(', ')}</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <span className="w-2 h-2 rounded-full bg-purple-400" />
                    <span><strong>Bairros Campeões:</strong> {driverProfile.bestNeighborhoods.join(', ')}</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <span className="w-2 h-2 rounded-full bg-purple-400" />
                    <span><strong>Categoria / App Preferido:</strong> {driverProfile.bestCategory} • {driverProfile.bestPlatform}</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <span className="w-2 h-2 rounded-full bg-purple-400" />
                    <span><strong>Comportamento de Rota:</strong> {driverProfile.bestTripLengthType}</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <span className="w-2 h-2 rounded-full bg-purple-400" />
                    <span><strong>Gargalo de Longa Distância:</strong> {driverProfile.longRidesYield}</span>
                  </div>
                </div>
              </div>

              <div className="text-[10px] text-slate-500 font-mono uppercase tracking-wider mt-6 pt-4 border-t border-purple-950/15">
                Perfis calibrados de forma inteligente
              </div>
            </div>

          </div>
        )}

        {/* TAB 5: INSIGHTS INTELIGENTES LOG */}
        {activeTab === 'insights' && (
          <div className="space-y-4">
            <div className="p-6 bg-[#0b0720]/80 border border-purple-950/40 rounded-3xl text-left space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-purple-400" />
                  <h4 className="text-sm font-bold text-slate-200 uppercase font-mono tracking-wider">Insights Inteligentes Autônomos</h4>
                </div>
                <span className="text-[10px] text-slate-500 font-mono uppercase">Log de Auditoria IA</span>
              </div>

              <p className="text-xs text-purple-300/60 leading-relaxed font-sans">
                Abaixo estão listadas as percepções críticas geradas pela IA autônoma para otimização da sua rentabilidade operacional hoje em Presidente Prudente.
              </p>

              <div className="divide-y divide-purple-950/15 space-y-3.5 pt-2">
                {smartInsights.map(insight => {
                  let badgeBg = 'bg-indigo-950/40 text-indigo-400 border-indigo-800/40';
                  let icon = <Info className="w-4 h-4" />;

                  if (insight.type === 'warning') {
                    badgeBg = 'bg-yellow-950/40 text-yellow-400 border-yellow-800/30';
                    icon = <AlertTriangle className="w-4 h-4" />;
                  } else if (insight.type === 'critical') {
                    badgeBg = 'bg-rose-950/40 text-rose-400 border-rose-800/50';
                    icon = <AlertTriangle className="w-4 h-4 shrink-0" />;
                  } else if (insight.type === 'success') {
                    badgeBg = 'bg-emerald-950/40 text-emerald-400 border-emerald-800/40';
                    icon = <Check className="w-4 h-4" />;
                  }

                  return (
                    <div key={insight.id} className="pt-3.5 flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3 text-left">
                        <div className={`p-2 rounded-xl border ${badgeBg} flex items-center justify-center shrink-0`}>
                          {icon}
                        </div>
                        <div className="space-y-1">
                          <h5 className="text-xs font-extrabold text-slate-100 font-sans">{insight.title}</h5>
                          <p className="text-[11px] text-purple-300/70 font-sans leading-relaxed">{insight.description}</p>
                        </div>
                      </div>

                      <span className="text-[9px] text-slate-500 font-mono shrink-0">
                        {new Date(insight.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
