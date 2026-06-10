/**
 * Advanced Leaflet Map Visualizer Component
 * Module: Maps (maps)
 * Responsibility: Replaces mock maps with fully operational Leaflet mapping, plotting color-coded speeds & routes.
 */

import React, { useEffect, useState, useRef } from 'react';
import { Compass, MapPin, Navigation, ShieldCheck } from 'lucide-react';
import L from 'leaflet';
import { LatLng, MapMarker } from './map.types';
import { calculateCoordinatesCentroid } from './map.utils';

interface TrackingMapProps {
  markers?: MapMarker[];
  routePoints?: { latitude: number; longitude: number; speed_kmh?: number }[];
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
  const mapRef = useRef<L.Map | null>(null);
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

  // Injetar Leaflet CSS dinamicamente se não estiver presente
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

    // Adiciona camada do OpenStreetMap
    const tileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
    }).addTo(map);

    // Zoom buttons customizados
    L.control.zoom({ position: 'topright' }).addTo(map);

    // Desenhar caminhos coloridos
    /**
     * Regra de colorização do Trajeto:
     * - Azul (#3b82f6) para Corrida com Passageiros (Speed > 30 km/h)
     * - Cinza (#64748b) para Deslocamento Vazio (5 < Speed <= 30)
     * - Amarelo (#eab308) para Espera / Tempo ocioso (Speed <= 5)
     */
    if (routePoints && routePoints.length > 1) {
      for (let i = 1; i < routePoints.length; i++) {
        const p1 = routePoints[i - 1];
        const p2 = routePoints[i];
        
        const avgSpeed = ((p1.speed_kmh || 0) + (p2.speed_kmh || 0)) / 2;
        let segmentColor = '#eab308'; // Amarelo (Espera)
        let segmentLabel = 'Aguardando';

        if (avgSpeed > 30) {
          segmentColor = '#3b82f6'; // Azul (Passenger / Produtivo)
          segmentLabel = 'Com Passageiro';
        } else if (avgSpeed > 5) {
          segmentColor = '#64748b'; // Cinza (Deslocamento / Vazio)
          segmentLabel = 'Deslocamento Vazio';
        }

        const pathCoords: [number, number][] = [
          [p1.latitude, p1.longitude],
          [p2.latitude, p2.longitude]
        ];

        L.polyline(pathCoords, {
          color: segmentColor,
          weight: 5,
          opacity: 0.9,
          lineJoin: 'round',
          lineCap: 'round',
        }).addTo(map).bindPopup(
          `<div class="text-xs font-sans text-slate-800">
             <span class="font-bold block">${segmentLabel}</span>
             Velocidade Média: ${avgSpeed.toFixed(1)} km/h
           </div>`
        );
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
        .bindPopup('<strong class="text-xs font-sans text-emerald-600 font-bold">Início da Jornada</strong>');

      L.marker([endP.latitude, endP.longitude], { icon: endIcon })
        .addTo(map)
        .bindPopup('<strong class="text-xs font-sans text-rose-600 font-bold">Término da Jornada</strong>');

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
          <div class="text-xs font-sans text-slate-800">
            <h4 class="font-bold select-none text-purple-700">${m.title}</h4>
            <p>${m.description || ''}</p>
          </div>
        `);
    });

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [routePoints, markers, mapId, calculatedCenter, computedZoom]);

  // Inject sleek dark map filters with full CSS styles
  return (
    <div 
      className="relative rounded-3xl overflow-hidden border border-purple-950/20 bg-[#060412] flex flex-col justify-between shadow-[0_4px_30px_rgba(0,0,0,0.4)]"
      style={{ height }}
      ref={containerRef}
    >
      {/* Sleek Custom Leaflet Dark Mode Inversion Styles */}
      <style>{`
        .leaflet-tile-container {
          filter: invert(100%) hue-rotate(185deg) brightness(85%) contrast(100%);
        }
        .leaflet-container {
          background-color: #060412 !important;
        }
        .leaflet-popup-content-wrapper {
          background: #0d0a27 !important;
          color: #f1f5f9 !important;
          border: 1px solid rgba(139, 92, 246, 0.3) !important;
          border-radius: 12px !important;
        }
        .leaflet-popup-tip {
          background: #0d0a27 !important;
        }
      `}</style>

      {/* Actual Map Target Container */}
      <div id={mapId} className="w-full h-full z-0 absolute inset-0"></div>
      
      {/* Map Control Overlay */}
      <div className="absolute top-4 left-4 z-10 flex flex-col gap-2 pointer-events-none">
        <div className="bg-[#09051d]/90 backdrop-blur-md px-3 py-1.5 rounded-xl border border-purple-950/30 text-[10px] font-mono text-purple-300 font-bold flex items-center gap-1.5 shadow-lg select-none">
          <Compass className="w-3.5 h-3.5 animate-spin" style={{ animationDuration: '8s' }} />
          <span>ROXOU REAL GPS (LEAFLET ACTIVE)</span>
        </div>
      </div>

      {/* Quick Active Road Information Layer */}
      {routePoints.length > 0 && (
        <div className="absolute bottom-4 left-4 z-10 pointer-events-auto bg-[#0a051d]/95 text-[10px] font-mono px-3 py-2 rounded-2xl border border-purple-950/30 text-purple-300 flex items-center gap-2 select-none">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span>Rastro ativo: {routePoints.length} posições gravadas.</span>
        </div>
      )}

      {/* Color Legend Helper Overlay */}
      <div className="absolute bottom-4 right-4 z-10 bg-[#0a051d]/95 text-[9px] font-mono px-2.5 py-1.5 rounded-xl border border-purple-950/30 text-slate-300 flex flex-col gap-1 select-none">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-1 rounded-full bg-blue-500 inline-block"></span>
          <span>Com Corrida (&gt;30 km/h)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-1 rounded-full bg-slate-500 inline-block"></span>
          <span>Deslocamento (5-30 km/h)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-1 rounded-full bg-yellow-500 inline-block"></span>
          <span>Aguardando (&le;5 km/h)</span>
        </div>
      </div>
    </div>
  );
};
