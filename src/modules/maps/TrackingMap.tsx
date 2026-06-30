/**
 * Advanced Leaflet Map Visualizer Component
 * Module: Maps (maps)
 * Responsibility: Replaces mock maps with fully operational Leaflet mapping, plotting color-coded speeds & routes.
 */

import React, { useEffect, useState, useRef } from 'react';
import { Compass, ShieldCheck } from 'lucide-react';
import L from 'leaflet';
import { LatLng, MapMarker } from './map.types';
import { calculateCoordinatesCentroid } from './map.utils';

interface TrackingMapProps {
  markers?: MapMarker[];
  routePoints?: { latitude: number; longitude: number; speed_kmh?: number; recorded_at?: string; segment_type?: string }[];
  center?: LatLng;
  height?: string;
  zoom?: number;
}

export const TrackingMap: React.FC<TrackingMapProps> = ({
  markers = [],
  routePoints = [],
  center,
  height = '380px',
  zoom,
}) => {
  const [mapId] = useState(() => 'map-' + Math.random().toString(36).substring(2, 9));
  const [mapType, setMapType] = useState<'google' | 'satellite' | 'dark'>(() => {
    return (localStorage.getItem('roxou_map_type') as any) || 'google';
  });
  const mapRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Computed map center and zoom
  const calculatedCenter = React.useMemo(() => {
    if (center) return center;
    if (routePoints && routePoints.length > 0) {
      const centroid = calculateCoordinatesCentroid(routePoints);
      return centroid;
    }
    return { lat: -23.55052, lng: -46.633308 }; // Default: São Paulo
  }, [center, routePoints]);

  const computedZoom = zoom || (routePoints && routePoints.length > 0 ? 15 : 13);

  // Inject Leaflet CSS dynamically if not present
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
  }, []);

  // Handler to swap tile layers in real-time
  const handleMapTypeChange = (newType: 'google' | 'satellite' | 'dark') => {
    setMapType(newType);
    localStorage.setItem('roxou_map_type', newType);
    
    if (!mapRef.current) return;
    const map = mapRef.current;

    // Remove old tile layer
    if (tileLayerRef.current) {
      map.removeLayer(tileLayerRef.current);
    }

    let url = 'https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}'; // Google road map
    let maxZoom = 20;

    if (newType === 'satellite') {
      url = 'https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}'; // Google satellite hybrid
    } else if (newType === 'dark') {
      url = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'; // OpenStreetMap (inverted in CSS)
      maxZoom = 19;
    }

    const newLayer = L.tileLayer(url, {
      maxZoom,
      attribution: newType.includes('google') || newType === 'satellite' ? '© Google' : '© OpenStreetMap contributors',
    }).addTo(map);

    tileLayerRef.current = newLayer;

    // Trigger map container class updates
    const container = containerRef.current;
    if (container) {
      if (newType === 'dark') {
        container.classList.add('map-dark-inverted');
      } else {
        container.classList.remove('map-dark-inverted');
      }
    }
  };

  // Initialize and update Map instance
  useEffect(() => {
    if (!containerRef.current) return;

    // Se já existe um mapa, limpa e reconstrói para evitar conflito
    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
    }

    const { lat, lng } = calculatedCenter;
    const map = L.map(mapId, {
      center: [lat, lng],
      zoom: computedZoom,
      zoomControl: false, // Tirar zoom padrão para colocar customizado polido
      attributionControl: false // Tirar marca d'água enorme
    });

    mapRef.current = map;

    // Choose base tile url based on persisted mapType
    let url = 'https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}';
    let maxZoom = 20;

    if (mapType === 'satellite') {
      url = 'https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}';
    } else if (mapType === 'dark') {
      url = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
      maxZoom = 19;
    }

    const tileLayer = L.tileLayer(url, {
      maxZoom,
      attribution: mapType.includes('google') || mapType === 'satellite' ? '© Google' : '© OpenStreetMap contributors',
    }).addTo(map);

    tileLayerRef.current = tileLayer;

    // Trigger map container class updates initially
    const container = containerRef.current;
    if (container) {
      if (mapType === 'dark') {
        container.classList.add('map-dark-inverted');
      } else {
        container.classList.remove('map-dark-inverted');
      }
    }

    // Zoom buttons customizados
    L.control.zoom({ position: 'topright' }).addTo(map);

    // Desenhar caminhos coloridos
    /**
     * Regra de colorização do Trajeto:
     * Com segment_type (Engine de Classificação):
     * - Verde (#10b981) = Corrida Produtiva
     * - Amarelo (#f59e0b) = KM Vazio
     * - Cinza (#6b7280) = Parado/Esperando
     * - Azul (#3b82f6) = Particular
     * - Vermelho (#ef4444) = KM Morto
     *
     * Sem segment_type (Velocidade Fallback):
     * - Azul (#3b82f6) para Corrida com Passageiros (Speed > 30 km/h)
     * - Roxo (#a855f7) para Deslocamento Vazio (5 < Speed <= 30)
     * - Amarelo (#eab308) para Espera / Tempo ocioso (Speed <= 5)
     */
    if (routePoints && routePoints.length > 1) {
      const hasClassifiedPoints = routePoints.some(p => p.segment_type !== undefined && p.segment_type !== null);

      for (let i = 1; i < routePoints.length; i++) {
        const p1 = routePoints[i - 1];
        const p2 = routePoints[i];
        
        const avgSpeed = ((p1.speed_kmh || 0) + (p2.speed_kmh || 0)) / 2;
        let segmentColor = '#eab308'; // Amarelo (Espera)
        let segmentLabel = 'Aguardando';

        if (hasClassifiedPoints) {
          const segType = p2.segment_type || p1.segment_type || 'empty';
          if (segType === 'productive') {
            segmentColor = '#10b981'; // Verde
            segmentLabel = 'Corrida Produtiva';
          } else if (segType === 'empty') {
            segmentColor = '#f59e0b'; // Amarelo/Laranja
            segmentLabel = 'KM Vazio';
          } else if (segType === 'personal') {
            segmentColor = '#3b82f6'; // Azul
            segmentLabel = 'Particular';
          } else if (segType === 'dead') {
            segmentColor = '#ef4444'; // Vermelho
            segmentLabel = 'KM Morto';
          } else {
            segmentColor = '#6b7280'; // Cinza (stopped, waiting, offline)
            segmentLabel = 'Parado/Esperando';
          }
        } else {
          if (avgSpeed > 30) {
            segmentColor = '#3b82f6'; // Azul (Passenger / Produtivo)
            segmentLabel = 'Com Passageiro';
          } else if (avgSpeed > 5) {
            segmentColor = '#a855f7'; // Purple Accent (Deslocamento / Vazio)
            segmentLabel = 'Deslocamento Vazio';
          }
        }

        const pathCoords: [number, number][] = [
          [p1.latitude, p1.longitude],
          [p2.latitude, p2.longitude]
        ];

        L.polyline(pathCoords, {
          color: segmentColor,
          weight: 6,
          opacity: 0.9,
          lineJoin: 'round',
          lineCap: 'round',
        }).addTo(map).bindPopup(
          `<div class="text-xs font-sans text-slate-100">
             <span class="font-bold block text-purple-400">${segmentLabel}</span>
             Velocidade Média: ${avgSpeed.toFixed(1)} km/h
             ${p1.recorded_at ? `<br/><span class="text-[9px] text-slate-400">Tempo: ${new Date(p1.recorded_at).toLocaleTimeString('pt-BR')}</span>` : ''}
           </div>`
        );
      }

      // Identify stops/paradas and highlight them (Fase 2: "Paradas destacadas")
      let stopStartIndex = -1;
      for (let i = 0; i < routePoints.length; i++) {
        const p = routePoints[i];
        if ((p.speed_kmh || 0) <= 5) {
          if (stopStartIndex === -1) {
            stopStartIndex = i;
          }
        } else {
          if (stopStartIndex !== -1) {
            const stopEndIndex = i - 1;
            const durationMs = stopEndIndex > stopStartIndex && routePoints[stopEndIndex].recorded_at && routePoints[stopStartIndex].recorded_at
              ? new Date(routePoints[stopEndIndex].recorded_at!).getTime() - new Date(routePoints[stopStartIndex].recorded_at!).getTime()
              : 0;
            
            const durationMinutes = Math.round(durationMs / 60000);
            if (durationMinutes >= 2 || stopStartIndex === stopEndIndex) {
              const stopPoint = routePoints[stopStartIndex];
              // Render stop marker
              const stopIcon = L.divIcon({
                className: 'custom-stop-icon',
                html: `<div class="w-6 h-6 rounded-full bg-amber-500 border-2 border-white flex items-center justify-center text-[10px] font-bold text-white shadow-lg animate-bounce" style="animation-duration: 3s">⏸</div>`,
                iconSize: [24, 24],
                iconAnchor: [12, 12]
              });

              L.marker([stopPoint.latitude, stopPoint.longitude], { icon: stopIcon })
                .addTo(map)
                .bindPopup(`
                  <div class="text-xs font-sans text-slate-100">
                    <strong class="text-amber-400 font-bold">Parada Registrada</strong>
                    <p class="text-[10px] text-slate-300 mt-0.5">Duração aproximada: ${durationMinutes > 0 ? `${durationMinutes} min` : 'Poucos segundos'}</p>
                    ${stopPoint.recorded_at ? `<p class="text-[9px] text-slate-400 font-mono">Horário: ${new Date(stopPoint.recorded_at).toLocaleTimeString('pt-BR')}</p>` : ''}
                  </div>
                `);
            }
            stopStartIndex = -1;
          }
        }
      }

      // Marcar Início (Verde) e Fim (Vermelho) do trajeto nos pontos reais
      const startP = routePoints[0];
      const endP = routePoints[routePoints.length - 1];

      // Custom Start Icon
      const startIcon = L.divIcon({
        className: 'custom-map-icon',
        html: `<div class="w-6 h-6 rounded-full bg-emerald-500 border-2 border-white flex items-center justify-center text-[10px] font-bold text-white shadow-lg animate-pulse">✓</div>`,
        iconSize: [24, 24],
        iconAnchor: [12, 12]
      });

      // Custom End Icon
      const endIcon = L.divIcon({
        className: 'custom-map-icon',
        html: `<div class="w-6 h-6 rounded-full bg-rose-500 border-2 border-white flex items-center justify-center text-[10px] font-bold text-white shadow-lg">🏁</div>`,
        iconSize: [24, 24],
        iconAnchor: [12, 12]
      });

      L.marker([startP.latitude, startP.longitude], { icon: startIcon })
        .addTo(map)
        .bindPopup('<strong class="text-xs font-sans text-emerald-400 font-bold">Início da Jornada</strong>');

      L.marker([endP.latitude, endP.longitude], { icon: endIcon })
        .addTo(map)
        .bindPopup('<strong class="text-xs font-sans text-rose-400 font-bold">Término da Jornada</strong>');

      // Autofit bounds to encompass the route
      const bounds = L.latLngBounds(routePoints.map(p => [p.latitude, p.longitude]));
      map.fitBounds(bounds, { padding: [30, 30] });
    }

    // Adicionar pin de outros marcadores do sistema (ex: postos, chamados)
    markers.forEach(m => {
      const pinColor = m.type === 'hazard' ? '#f43f5e' : m.type === 'peak' ? '#f59e0b' : '#8b5cf6';
      const mIcon = L.divIcon({
        className: 'custom-sys-marker',
        html: `<div class="w-7 h-7 rounded-xl bg-[#09051d]/90 border-2 border-purple-500 flex items-center justify-center text-xs shadow-lg" style="color: ${pinColor}">📍</div>`,
        iconSize: [28, 28],
        iconAnchor: [14, 14]
      });

      L.marker([m.position.lat, m.position.lng], { icon: mIcon })
        .addTo(map)
        .bindPopup(`
          <div class="text-xs font-sans text-slate-100">
            <h4 class="font-bold select-none text-purple-400">${m.title}</h4>
            <p class="text-slate-300 mt-1">${m.description || ''}</p>
          </div>
        `);
    });

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [routePoints, markers, mapId, calculatedCenter, computedZoom, mapType]);

  // Inject sleek dark map filters with full CSS styles
  return (
    <div 
      className="relative rounded-3xl overflow-hidden border border-purple-950/20 bg-[#060412] flex flex-col justify-between shadow-[0_4px_30px_rgba(0,0,0,0.4)]"
      style={{ height }}
      ref={containerRef}
    >
      {/* Sleek Custom Leaflet Dark Mode Inversion Styles */}
      <style>{`
        .map-dark-inverted .leaflet-tile-container {
          filter: invert(100%) hue-rotate(185deg) brightness(85%) contrast(100%);
        }
        .leaflet-container {
          background-color: #060412 !important;
        }
        .leaflet-popup-content-wrapper {
          background: #09051d !important;
          color: #f1f5f9 !important;
          border: 1px solid rgba(139, 92, 246, 0.3) !important;
          border-radius: 12px !important;
        }
        .leaflet-popup-tip {
          background: #09051d !important;
        }
      `}</style>

      {/* Actual Map Target Container */}
      <div id={mapId} className="w-full h-full z-0 absolute inset-0"></div>
      
      {/* Map Control Overlay */}
      <div className="absolute top-4 left-4 z-10 flex flex-col gap-2 pointer-events-none">
        <div className="bg-[#09051d]/90 backdrop-blur-md px-3 py-1.5 rounded-xl border border-purple-950/30 text-[10px] font-mono text-purple-300 font-bold flex items-center gap-1.5 shadow-lg select-none">
          <Compass className="w-3.5 h-3.5 animate-spin" style={{ animationDuration: '8s' }} />
          <span>ROXOU GPS : MAPA {mapType.toUpperCase()}</span>
        </div>
      </div>

      {/* Map Layer Selector Controls (Fase 2 / Map Layer) */}
      <div className="absolute top-4 right-14 z-10 flex gap-1 pointer-events-auto bg-[#09051d]/95 p-1 rounded-xl border border-purple-950/40 shadow-xl">
        <button
          onClick={() => handleMapTypeChange('google')}
          className={`px-2 py-1 rounded-lg text-[9px] font-mono font-semibold transition-all cursor-pointer ${
            mapType === 'google' ? 'bg-purple-600 text-white font-bold' : 'text-slate-400 hover:text-white'
          }`}
          title="Google Maps"
        >
          Google Map
        </button>
        <button
          onClick={() => handleMapTypeChange('satellite')}
          className={`px-2 py-1 rounded-lg text-[9px] font-mono font-semibold transition-all cursor-pointer ${
            mapType === 'satellite' ? 'bg-purple-600 text-white font-bold' : 'text-slate-400 hover:text-white'
          }`}
          title="Google Satellite"
        >
          Satélite
        </button>
        <button
          onClick={() => handleMapTypeChange('dark')}
          className={`px-2 py-1 rounded-lg text-[9px] font-mono font-semibold transition-all cursor-pointer ${
            mapType === 'dark' ? 'bg-purple-600 text-white font-bold' : 'text-slate-400 hover:text-white'
          }`}
          title="Dark OSM Map"
        >
          Dark Mode
        </button>
      </div>

      {/* Quick Active Road Information Layer */}
      {routePoints.length > 0 && (
        <div className="absolute bottom-4 left-4 z-10 pointer-events-auto bg-[#0a051d]/95 text-[10px] font-mono px-3 py-2 rounded-2xl border border-purple-950/30 text-purple-300 flex items-center gap-2 select-none">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span>{routePoints.length} Posições de GPS • {routePoints.length > 1 ? `${Math.round((new Date(routePoints[routePoints.length-1].recorded_at!).getTime() - new Date(routePoints[0].recorded_at!).getTime()) / 60000)} min` : ''}</span>
        </div>
      )}

      {/* Color Legend Helper Overlay */}
      <div className="absolute bottom-4 right-4 z-10 bg-[#0a051d]/95 text-[9px] font-mono px-2.5 py-1.5 rounded-xl border border-purple-950/30 text-slate-300 flex flex-col gap-1 select-none">
        {routePoints.some(p => p.segment_type !== undefined && p.segment_type !== null) ? (
          <>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-1 rounded-full bg-[#10b981] inline-block"></span>
              <span>KM Produtivo (Verde)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-1 rounded-full bg-[#f59e0b] inline-block"></span>
              <span>KM Vazio (Amarelo)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-1 rounded-full bg-[#6b7280] inline-block"></span>
              <span>Parado/Espera (Cinza)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-1 rounded-full bg-[#3b82f6] inline-block"></span>
              <span>Particular (Azul)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-1 rounded-full bg-[#ef4444] inline-block"></span>
              <span>KM Morto (Vermelho)</span>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-1 rounded-full bg-blue-500 inline-block"></span>
              <span>KM Produtivo (&gt;30 km/h)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-1 rounded-full bg-[#a855f7] inline-block"></span>
              <span>KM Vazio (5-30 km/h)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-1 rounded-full bg-yellow-500 inline-block"></span>
              <span>Tempo Parado (&le;5 km/h)</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
