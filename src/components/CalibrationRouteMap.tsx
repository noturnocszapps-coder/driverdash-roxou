import React, { useEffect, useRef, useState } from 'react';
import { X, MapPin, Navigation, Info } from 'lucide-react';
import L from 'leaflet';
import { GpsTrackPoint } from '../modules/journey/rideCalibration.service';
import { leafletManager } from '../modules/maps/leafletManager';

interface CalibrationRouteMapProps {
  routePoints: GpsTrackPoint[];
  startLocation?: { lat: number; lng: number } | null;
  endLocation?: { lat: number; lng: number } | null;
  bairroOrigem?: string;
  bairroDestino?: string;
  onClose: () => void;
}

export const CalibrationRouteMap: React.FC<CalibrationRouteMapProps> = ({
  routePoints = [],
  startLocation,
  endLocation,
  bairroOrigem = 'Origem',
  bairroDestino = 'Destino',
  onClose
}) => {
  const mapContainerId = useRef(`route-map-${Math.random().toString(36).substring(2, 9)}`);
  const mapRef = useRef<L.Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [mapError, setMapError] = useState<string | null>(null);

  // Injetar CSS do Leaflet se não estiver presente
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

  useEffect(() => {
    console.log('[MAP_OPEN]');
    return () => {
      console.log('[MAP_UNMOUNT]');
      leafletManager.unregisterMap(mapContainerId.current);
    };
  }, []);

  useEffect(() => {
    // 1. Validar as coordenadas disponíveis
    const pts = routePoints.filter(p => p && typeof p.lat === 'number' && typeof p.lng === 'number' && !isNaN(p.lat) && !isNaN(p.lng));
    
    let pickupLat = startLocation?.lat;
    let pickupLng = startLocation?.lng;
    if ((pickupLat === undefined || pickupLng === undefined) && pts.length > 0) {
      pickupLat = pts[0].lat;
      pickupLng = pts[0].lng;
    }

    let dropoffLat = endLocation?.lat;
    let dropoffLng = endLocation?.lng;
    if ((dropoffLat === undefined || dropoffLng === undefined) && pts.length > 0) {
      dropoffLat = pts[pts.length - 1].lat;
      dropoffLng = pts[pts.length - 1].lng;
    }

    if (pickupLat === undefined || pickupLng === undefined) {
      setMapError('Sem pontos de GPS suficientes para plotar a rota.');
      return;
    }

    // 2. Inicializar Mapa se o contêiner estiver pronto
    const timer = setTimeout(() => {
      const container = document.getElementById(mapContainerId.current);
      if (!container) return;

      // Clean up previous map if somehow exists
      if (mapRef.current) {
        leafletManager.unregisterMap(mapContainerId.current);
        try {
          mapRef.current.off();
          mapRef.current.remove();
        } catch {}
        mapRef.current = null;
      }

      try {
        const centerLat = pickupLat!;
        const centerLng = pickupLng!;

        const map = L.map(mapContainerId.current, {
          center: [centerLat, centerLng],
          zoom: 14,
          zoomControl: true,
          layers: []
        });

        mapRef.current = map;

        // Register to global leafletManager
        leafletManager.registerMap(mapContainerId.current, map, () => {
          console.log('[MAP_CLEANUP_EXECUTED] CalibrationRouteMap unregister cleanup callback');
        });

        // Adicionar camada escura com inversão por CSS ou camada clássica Google
        const tileUrl = 'https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}'; // Google road map
        L.tileLayer(tileUrl, {
          maxZoom: 20,
          attribution: '© Google Maps'
        }).addTo(map);

        // Criar ícone verde para o ponto de início (Origem)
        const greenIcon = L.divIcon({
          className: 'custom-gps-icon-green',
          html: `<div class="w-4 h-4 rounded-full bg-emerald-500 border-2 border-[#090514] shadow-lg shadow-emerald-500/40 animate-pulse"></div>`,
          iconSize: [16, 16],
          iconAnchor: [8, 8]
        });

        // Criar ícone vermelho para o ponto final (Destino)
        const redIcon = L.divIcon({
          className: 'custom-gps-icon-red',
          html: `<div class="w-4 h-4 rounded-full bg-rose-500 border-2 border-[#090514] shadow-lg shadow-rose-500/40"></div>`,
          iconSize: [16, 16],
          iconAnchor: [8, 8]
        });

        // Adicionar marcador de Origem
        L.marker([pickupLat!, pickupLng!], { icon: greenIcon })
          .addTo(map)
          .bindPopup(`<strong class="text-slate-900">Origem:</strong><br>${bairroOrigem}`)
          .openPopup();

        // Adicionar marcador de Destino se disponível
        if (dropoffLat !== undefined && dropoffLng !== undefined) {
          L.marker([dropoffLat, dropoffLng], { icon: redIcon })
            .addTo(map)
            .bindPopup(`<strong class="text-slate-900">Destino:</strong><br>${bairroDestino}`);
        }

        // Plotar percurso se houver pontos intermédios
        if (pts.length > 1) {
          const latlngs = pts.map(p => [p.lat, p.lng] as [number, number]);
          const polyline = L.polyline(latlngs, {
            color: '#a855f7', // Roxo neon para combinar com o layout DriverDash
            weight: 4,
            opacity: 0.85,
            lineJoin: 'round'
          }).addTo(map);

          // Ajustar zoom para conter todo o trajeto
          map.fitBounds(polyline.getBounds(), { padding: [40, 40] });
        }

        // Forçar renderização correta
        setTimeout(() => {
          if (map) map.invalidateSize();
        }, 150);

      } catch (err: any) {
        console.error('Falha ao instanciar o Leaflet:', err);
        setMapError('Não foi possível carregar a visualização gráfica do mapa.');
      }
    }, 200);

    return () => {
      clearTimeout(timer);
      if (mapRef.current) {
        console.log('[MAP_UNMOUNT]');
        try {
          mapRef.current.off();
          mapRef.current.remove();
          console.log('[MAP_CLEANUP_EXECUTED]');
        } catch (err) {
          console.error('[MAP_BLOCKING_UI_DETECTED] Error clearing map inside setup effect:', err);
        }
        mapRef.current = null;
      }
    };
  }, [routePoints, startLocation, endLocation]);

  return (
    <div 
      className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-fade-in"
      style={{ pointerEvents: 'auto' }}
    >
      <div 
        ref={containerRef}
        className="w-full max-w-3xl bg-[#090514] border border-purple-950/40 rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
      >
        {/* Cabeçalho do Modal */}
        <div className="p-5 border-b border-purple-950/20 bg-purple-950/10 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-purple-950/40 flex items-center justify-center text-purple-400">
              <Navigation className="w-4 h-4 animate-bounce" />
            </div>
            <div>
              <h3 className="font-sans font-bold text-slate-100 text-sm">Visualização de Rota da Corrida</h3>
              <p className="text-[10px] text-purple-300 font-mono tracking-wide uppercase">Calibração GPS Real</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-900/60 hover:bg-slate-900 text-slate-400 hover:text-slate-100 flex items-center justify-center cursor-pointer transition-all border border-purple-950/20"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Detalhes Rápidos dos Bairros */}
        <div className="grid grid-cols-2 gap-4 px-5 py-3 bg-[#05030c] border-b border-purple-950/10 text-xs">
          <div className="flex items-center gap-2 min-w-0">
            <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
            <div className="min-w-0">
              <span className="text-[9px] uppercase font-mono text-slate-500 font-bold">Origem</span>
              <p className="font-semibold text-slate-200 truncate">{bairroOrigem}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 min-w-0">
            <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0" />
            <div className="min-w-0">
              <span className="text-[9px] uppercase font-mono text-slate-500 font-bold">Destino</span>
              <p className="font-semibold text-slate-200 truncate">{bairroDestino}</p>
            </div>
          </div>
        </div>

        {/* Corpo do Mapa */}
        <div className="flex-1 relative min-h-[350px] md:min-h-[420px] bg-[#020104] flex items-center justify-center">
          {mapError ? (
            <div className="p-6 text-center space-y-3 max-w-sm">
              <div className="w-10 h-10 rounded-full bg-amber-950/30 text-amber-500 flex items-center justify-center mx-auto">
                <Info className="w-5 h-5" />
              </div>
              <p className="text-slate-300 font-sans text-xs">{mapError}</p>
              <div className="text-[10px] text-slate-500 font-mono">
                {routePoints.length} pontos registrados no histórico desta corrida.
              </div>
            </div>
          ) : (
            <div 
              id={mapContainerId.current} 
              className="absolute inset-0 w-full h-full"
            />
          )}
        </div>

        {/* Rodapé / Informações de Rastreabilidade */}
        <div className="p-4 bg-[#05030c]/90 border-t border-purple-950/20 text-[10px] text-slate-400 font-mono flex items-center justify-between">
          <span>{routePoints.length} coordenadas coletadas pelo GPS</span>
          <span className="text-purple-400 font-semibold uppercase tracking-wider">DriverDash Telemetria</span>
        </div>
      </div>
    </div>
  );
};
