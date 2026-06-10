/**
 * Operational Leaflet Demand Heatmap Map Component
 * Module: Maps (maps)
 * Responsibility: Renders a real-time Leaflet map showing Presidente Prudente zones, demand score buffers,
 * active traffic signals, and allows drivers to click on zones to view insights.
 */

import React, { useEffect, useState, useRef } from 'react';
import L from 'leaflet';
import { RoxouDemandStatus, RoxouDemandLevel } from '../demand/demand.types';
import { DemandSignal } from '../../types';

interface DemandMapProps {
  demandStatus: RoxouDemandStatus[];
  demandSignals: DemandSignal[];
  selectedRegionName?: string;
  onSelectRegion?: (regionName: string) => void;
  height?: string;
}

export const DemandMap: React.FC<DemandMapProps> = ({
  demandStatus,
  demandSignals,
  selectedRegionName,
  onSelectRegion,
  height = '420px',
}) => {
  const [mapId] = useState(() => 'demand-map-' + Math.random().toString(36).substring(2, 9));
  const mapRef = useRef<L.Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const layerGroupRef = useRef<L.LayerGroup | null>(null);

  // Inject Leaflet CSS dynamically if missing
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

  // Determine circle style by demand level
  const getDemandColor = (level: RoxouDemandLevel) => {
    switch (level) {
      case 'extreme':
        return '#dc2626'; // Red (Extrema)
      case 'high':
        return '#f97316'; // Orange (Alta)
      case 'medium':
        return '#eab308'; // Yellow (Média)
      case 'low':
      default:
        return '#64748b'; // Slate (Baixa)
    }
  };

  // Initialize Map Instance once
  useEffect(() => {
    if (!containerRef.current) return;

    // Center in Presidente Prudente, SP, Brazil
    const INITIAL_CENTER: [number, number] = [-22.1225, -51.3883];
    const INITIAL_ZOOM = 13;

    const map = L.map(mapId, {
      center: INITIAL_CENTER,
      zoom: INITIAL_ZOOM,
      zoomControl: false,
      attributionControl: false
    });

    mapRef.current = map;

    // Use dark mode theme tiles for a highly styled look, or default OpenStreetMap
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 19,
    }).addTo(map);

    // Zoom buttons
    L.control.zoom({ position: 'topright' }).addTo(map);

    // Layer group for dynamic circles and markers
    const group = L.layerGroup().addTo(map);
    layerGroupRef.current = group;

    // Force map size refresh
    setTimeout(() => {
      map.invalidateSize();
    }, 400);

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [mapId]);

  // Adjust view when selected region changes externally
  useEffect(() => {
    if (!mapRef.current || !selectedRegionName || demandStatus.length === 0) return;
    const target = demandStatus.find(d => d.region.toLowerCase() === selectedRegionName.toLowerCase());
    if (target) {
      mapRef.current.setView([target.latitude, target.longitude], 14, { animate: true });
    }
  }, [selectedRegionName, demandStatus]);

  // Redraw polygons & markers dynamically when status or signals change
  useEffect(() => {
    if (!mapRef.current || !layerGroupRef.current) return;

    // Clear previous shapes
    layerGroupRef.current.clearLayers();

    // 1. Draw demand zones as warm circle overlays
    demandStatus.forEach(status => {
      const radius = 550; // meters buffer
      const color = getDemandColor(status.level);
      const isSelected = selectedRegionName && status.region.toLowerCase() === selectedRegionName.toLowerCase();

      // Circle representing hotspots bounds
      const circle = L.circle([status.latitude, status.longitude], {
        radius: radius,
        fillColor: color,
        fillOpacity: isSelected ? 0.38 : 0.22,
        color: color,
        weight: isSelected ? 3 : 1.5,
        dashArray: status.level === 'extreme' ? '4, 4' : undefined,
      });

      // Simple click listener on the zone
      circle.on('click', () => {
        if (onSelectRegion) {
          onSelectRegion(status.region);
        }
      });

      // Bind customized tooltip or popup
      circle.bindTooltip(`
        <div style="font-family: monospace; font-size: 11px; padding: 2px;">
          <strong style="color: #fff;">${status.region}</strong><br/>
          Score: <span style="color: ${color}; font-weight: bold;">${status.demandIndex}</span> (${status.level.toUpperCase()})<br/>
          Ganhos/m: R$ ${status.hourlyEarningsEstimate.toFixed(1)}/h<br/>
          Dinâmico: ${status.surgeMultiplier}x
        </div>
      `, {
        permanent: false,
        direction: 'center',
        opacity: 0.9,
        className: 'custom-map-tooltip'
      });

      layerGroupRef.current?.addLayer(circle);

      // Core anchor marker with clean icon
      const textLabelIcon = L.divIcon({
        className: 'custom-html-marker',
        html: `
          <div class="flex items-center justify-center">
            <span class="flex h-3 w-3 relative">
              <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-${status.level === 'extreme' ? 'rose' : 'purple'}-400 opacity-75"></span>
              <span class="relative inline-flex rounded-full h-3 w-3 bg-${color === '#64748b' ? 'slate' : 'purple'}-500"></span>
            </span>
            <div class="ml-1.5 px-1.5 py-0.5 bg-slate-900/90 text-white border border-purple-500/30 text-[9px] rounded font-mono shrink-0 whitespace-nowrap shadow-md">
              ${status.region}: ${status.surgeMultiplier}x
            </div>
          </div>
        `,
        iconSize: [20, 20],
        iconAnchor: [10, 10]
      });

      const labelMarker = L.marker([status.latitude, status.longitude], { icon: textLabelIcon });
      labelMarker.on('click', () => {
        if (onSelectRegion) {
          onSelectRegion(status.region);
        }
      });
      layerGroupRef.current?.addLayer(labelMarker);
    });

    // 2. Draw active temporal demand signals (incident markers)
    demandSignals.forEach(signal => {
      if (!signal.is_active) return;

      const emojiIcon = L.divIcon({
        className: 'custom-signal-marker',
        html: `
          <div class="flex items-center justify-center bg-slate-950/80 p-1.5 rounded-full border border-teal-500 shadow-lg text-sm animate-bounce" style="width: 28px; height: 28px;">
            ${signal.signal_type === 'climate' ? '🌧️' : signal.signal_type === 'event' ? '🎤' : '🎓'}
          </div>
        `,
        iconSize: [28, 28],
        iconAnchor: [14, 14]
      });

      const signalMarker = L.marker([signal.latitude, signal.longitude], { icon: emojiIcon });
      signalMarker.bindPopup(`
        <div class="p-2 font-mono text-[11px] bg-slate-950 text-white rounded">
          <strong class="text-teal-400 font-bold">${signal.title}</strong><br/>
          <span class="text-slate-400">Região:</span> ${signal.region}<br/>
          <span class="text-slate-400">Tipo:</span> ${signal.signal_type}<br/>
          <span class="text-slate-400">Peso Booster:</span> +${(Number(signal.weight) * 15).toFixed(0)} pts
        </div>
      `);
      layerGroupRef.current?.addLayer(signalMarker);
    });

  }, [demandStatus, demandSignals, selectedRegionName]);

  return (
    <div className="relative rounded-3xl overflow-hidden border border-purple-950/20 shadow-inner" style={{ height }}>
      {/* Dynamic Style Injection for Leaflet tooltip overrides */}
      <style>{`
        .leaflet-container {
          background-color: #050214 !important;
        }
        .custom-map-tooltip {
          background: #09051d !important;
          border: 1px solid #4ade8050 !important;
          border-radius: 8px !important;
          color: white !important;
          box-shadow: 0 4px 10px rgba(0,0,0,0.5) !important;
        }
        .custom-html-marker {
          background: transparent !important;
          border: none !important;
          pointer-events: auto !important;
        }
        .custom-signal-marker {
          background: transparent !important;
          border: none !important;
        }
      `}</style>
      <div id={mapId} ref={containerRef} className="w-full h-full" />
    </div>
  );
};
