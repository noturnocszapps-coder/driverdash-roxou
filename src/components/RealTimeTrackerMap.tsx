import React, { useEffect, useRef, useState } from 'react';
import { Navigation, Compass, Eye, EyeOff, MapPin, Signal } from 'lucide-react';
import L from 'leaflet';

interface RealTimeTrackerMapProps {
  lastCoord: { lat: number; lng: number; accuracy: number; speed: number; heading: number | null; altitude: number | null; timestamp: number } | null;
  activeRide: any | null;
  gpsStatus: string;
}

export const RealTimeTrackerMap: React.FC<RealTimeTrackerMapProps> = ({
  lastCoord,
  activeRide,
  gpsStatus
}) => {
  const mapContainerId = useRef(`realtime-map-${Math.random().toString(36).substring(2, 9)}`);
  const mapRef = useRef<L.Map | null>(null);
  const [showRoute, setShowRoute] = useState(true);
  const [mapError, setMapError] = useState<string | null>(null);
  
  // Marker and Polyline references to update them without recreating the map
  const markerCurrentRef = useRef<L.Marker | null>(null);
  const markerStartRef = useRef<L.Marker | null>(null);
  const markerEndRef = useRef<L.Marker | null>(null);
  const polylineRef = useRef<L.Polyline | null>(null);

  // Load Leaflet CSS dynamically if not present
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

  // Initialize Map
  useEffect(() => {
    // We can center on Presidente Prudente by default, or the driver's current position if available
    const initialLat = lastCoord?.lat || activeRide?.pickup?.lat || -22.1225;
    const initialLng = lastCoord?.lng || activeRide?.pickup?.lng || -51.3883;

    try {
      const map = L.map(mapContainerId.current, {
        center: [initialLat, initialLng],
        zoom: 15,
        zoomControl: true,
        attributionControl: false
      });

      mapRef.current = map;

      // Add elegant map styling layer (using standard road map or beautiful dark mode tiles)
      L.tileLayer('https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
        maxZoom: 21,
        attribution: '© Google Maps'
      }).addTo(map);

      // Force proper rendering recalculation
      setTimeout(() => {
        map.invalidateSize();
      }, 300);

    } catch (err: any) {
      console.error('[REALTIME_MAP] Failed to initialize Leaflet:', err);
      setMapError('Não foi possível carregar o mapa interativo.');
    }

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        markerCurrentRef.current = null;
        markerStartRef.current = null;
        markerEndRef.current = null;
        polylineRef.current = null;
      }
    };
  }, []);

  // Sync / update markers and polylines on map whenever coordinate streams update (Requirement 10 - high performance)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // 1. Current position (Blue Marker)
    if (lastCoord) {
      const currentPos: [number, number] = [lastCoord.lat, lastCoord.lng];

      // Custom Blue Neon Dot for driver's current position
      const blueIcon = L.divIcon({
        className: 'custom-driver-icon-blue',
        html: `<div class="relative flex items-center justify-center">
                 <div class="absolute w-6 h-6 rounded-full bg-blue-500/30 animate-ping"></div>
                 <div class="w-4 h-4 rounded-full bg-blue-500 border-2 border-white shadow-lg shadow-blue-500/50"></div>
               </div>`,
        iconSize: [24, 24],
        iconAnchor: [12, 12]
      });

      if (markerCurrentRef.current) {
        markerCurrentRef.current.setLatLng(currentPos);
      } else {
        markerCurrentRef.current = L.marker(currentPos, { icon: blueIcon })
          .addTo(map)
          .bindPopup('<strong class="text-slate-800">Você está aqui</strong>');
      }
    }

    // 2. Start position (Green Marker) if ride is active
    if (activeRide && activeRide.pickup) {
      const startPos: [number, number] = [activeRide.pickup.lat, activeRide.pickup.lng];
      
      const greenIcon = L.divIcon({
        className: 'custom-gps-icon-green',
        html: `<div class="relative flex items-center justify-center">
                 <div class="absolute w-5 h-5 rounded-full bg-emerald-500/20 animate-pulse"></div>
                 <div class="w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-white shadow-lg shadow-emerald-500/40"></div>
               </div>`,
        iconSize: [20, 20],
        iconAnchor: [10, 10]
      });

      if (markerStartRef.current) {
        markerStartRef.current.setLatLng(startPos);
      } else {
        markerStartRef.current = L.marker(startPos, { icon: greenIcon })
          .addTo(map)
          .bindPopup(`<strong class="text-slate-800">Início da Corrida</strong><br>${activeRide.pickup_neighborhood || 'Origem'}`);
      }
    } else {
      if (markerStartRef.current) {
        markerStartRef.current.remove();
        markerStartRef.current = null;
      }
    }

    // 3. End position (Red Marker) if ride is completed or destination is locked
    if (activeRide && activeRide.status === 'finished' && activeRide.lastPosition) {
      const endPos: [number, number] = [activeRide.lastPosition.lat, activeRide.lastPosition.lng];

      const redIcon = L.divIcon({
        className: 'custom-gps-icon-red',
        html: `<div class="w-3.5 h-3.5 rounded-full bg-rose-500 border-2 border-white shadow-lg shadow-rose-500/40"></div>`,
        iconSize: [20, 20],
        iconAnchor: [10, 10]
      });

      if (markerEndRef.current) {
        markerEndRef.current.setLatLng(endPos);
      } else {
        markerEndRef.current = L.marker(endPos, { icon: redIcon })
          .addTo(map)
          .bindPopup(`<strong class="text-slate-800">Fim da Corrida</strong><br>${activeRide.dropoff_neighborhood || 'Destino'}`);
      }
    } else {
      if (markerEndRef.current) {
        markerEndRef.current.remove();
        markerEndRef.current = null;
      }
    }

    // 4. Polyline route drawing
    if (activeRide && showRoute) {
      // Determine which points to plot (Requirement 4: matchedTrackPoints if available, else filtered, else raw)
      const pointsSource = activeRide.matchedTrackPoints && activeRide.matchedTrackPoints.length > 0
        ? activeRide.matchedTrackPoints
        : (activeRide.filteredTrackPoints && activeRide.filteredTrackPoints.length > 0
            ? activeRide.filteredTrackPoints
            : (activeRide.rideTrackPoints || []));

      const latlngs = pointsSource
        .filter((p: any) => p && typeof p.lat === 'number' && typeof p.lng === 'number')
        .map((p: any) => [p.lat, p.lng] as [number, number]);

      if (latlngs.length > 1) {
        if (polylineRef.current) {
          polylineRef.current.setLatLngs(latlngs);
        } else {
          polylineRef.current = L.polyline(latlngs, {
            color: '#a855f7', // neon purple
            weight: 5,
            opacity: 0.85,
            lineJoin: 'round'
          }).addTo(map);
        }
      } else {
        if (polylineRef.current) {
          polylineRef.current.remove();
          polylineRef.current = null;
        }
      }
    } else {
      if (polylineRef.current) {
        polylineRef.current.remove();
        polylineRef.current = null;
      }
    }

  }, [lastCoord, activeRide, showRoute]);

  // Center Map on current position
  const handleCenterMap = () => {
    const map = mapRef.current;
    if (!map) return;

    const lat = lastCoord?.lat || activeRide?.pickup?.lat || -22.1225;
    const lng = lastCoord?.lng || activeRide?.pickup?.lng || -51.3883;

    map.setView([lat, lng], 16, { animate: true });
    
    if (markerCurrentRef.current) {
      markerCurrentRef.current.openPopup();
    }
  };

  // Determine relative precision label
  const getGpsPrecisionLabel = (accuracy: number | null) => {
    if (accuracy === null) return 'Desconhecido';
    if (accuracy <= 10) return 'Alta Precisão (GPS)';
    if (accuracy <= 25) return 'Precisão Padrão';
    return 'Precisão Baixa';
  };

  return (
    <div className="w-full bg-[#0d0926]/90 border border-purple-950/30 rounded-3xl overflow-hidden shadow-[0_0_30px_rgba(139,92,246,0.07)] flex flex-col">
      {/* Header Panel */}
      <div className="p-4 bg-purple-950/10 border-b border-purple-950/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-left">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-purple-950/40 flex items-center justify-center text-purple-400">
            <Compass className="w-4 h-4 animate-spin" style={{ animationDuration: '6s' }} />
          </div>
          <div>
            <h4 className="text-xs font-bold text-slate-200">🗺️ Rota em Tempo Real</h4>
            <p className="text-[10px] text-purple-300 font-mono tracking-wide uppercase">
              {activeRide ? 'Corrida Ativa em Rastreamento' : 'Posicionamento por Satélite'}
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleCenterMap}
            className="px-3 py-1.5 rounded-lg bg-[#050310] hover:bg-purple-950/30 text-purple-300 border border-purple-950/30 hover:text-white font-semibold text-[10px] flex items-center gap-1 cursor-pointer transition-all select-none"
          >
            <MapPin className="w-3 h-3 text-purple-400" /> Centralizar mapa
          </button>
          
          {activeRide && (
            <button
              onClick={() => setShowRoute(prev => !prev)}
              className="px-3 py-1.5 rounded-lg bg-[#050310] hover:bg-purple-950/30 text-purple-300 border border-purple-950/30 hover:text-white font-semibold text-[10px] flex items-center gap-1 cursor-pointer transition-all select-none"
            >
              {showRoute ? (
                <>
                  <EyeOff className="w-3 h-3 text-purple-400" /> Ocultar rota
                </>
              ) : (
                <>
                  <Eye className="w-3 h-3 text-purple-400" /> Mostrar rota
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Map Element Container */}
      <div className="relative w-full h-[240px] md:h-[300px] bg-[#020104]">
        {mapError ? (
          <div className="absolute inset-0 flex items-center justify-center p-6 text-center text-slate-400">
            <p className="text-xs">{mapError}</p>
          </div>
        ) : (
          <div id={mapContainerId.current} className="w-full h-full" />
        )}
      </div>

      {/* Real-time Telemetry Stats Footing (GPS status, Precision, Speed, Last Update) */}
      <div className="p-3 bg-[#050310]/80 border-t border-purple-950/20 text-[10.5px] font-mono grid grid-cols-2 md:grid-cols-4 gap-2 text-left">
        <div>
          <span className="text-slate-500 block text-[9px] uppercase font-sans">GPS</span>
          <span className="font-bold text-slate-200 flex items-center gap-1">
            <Signal className="w-3 h-3 text-emerald-400 animate-pulse" />
            {getGpsPrecisionLabel(lastCoord?.accuracy || null)}
          </span>
        </div>
        <div>
          <span className="text-slate-500 block text-[9px] uppercase font-sans">Precisão</span>
          <span className="font-bold text-purple-400">
            {lastCoord?.accuracy ? `±${lastCoord.accuracy.toFixed(1)}m` : 'Sem sinal'}
          </span>
        </div>
        <div>
          <span className="text-slate-500 block text-[9px] uppercase font-sans">Velocidade</span>
          <span className="font-bold text-indigo-400">
            {lastCoord?.speed ? `${Math.round(lastCoord.speed)} km/h` : '0 km/h'}
          </span>
        </div>
        <div>
          <span className="text-slate-500 block text-[9px] uppercase font-sans">Última Posição</span>
          <span className="font-bold text-[#e1e1e6]">
            {lastCoord?.timestamp ? new Date(lastCoord.timestamp).toLocaleTimeString('pt-BR') : 'Aguardando...'}
          </span>
        </div>
      </div>
    </div>
  );
};
