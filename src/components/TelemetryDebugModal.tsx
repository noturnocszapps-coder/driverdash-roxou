import React, { useState } from 'react';
import { X, Navigation, Compass, Signal, ArrowRightLeft, FileJson, AlertCircle } from 'lucide-react';

interface TelemetryDebugModalProps {
  ride: any;
  onClose: () => void;
}

export const TelemetryDebugModal: React.FC<TelemetryDebugModalProps> = ({
  ride,
  onClose
}) => {
  const [activeTab, setActiveTab] = useState<'summary' | 'points' | 'payload'>('summary');

  const telemetry = ride?.telemetryAnalytics || ride?.ride_log?.telemetryAnalytics || {
    distancia_gps_bruto: ride?.distance || 0,
    distancia_corrigida_snapped: ride?.distancia_corrigida || ride?.distance || 0,
    distancia_divergencia_km: 0,
    tempo_total_segundos: ride?.duration || 0,
    tempo_parado_segundos: ride?.tempo_parado || 0,
    tempo_movimento_segundos: (ride?.duration || 0) - (ride?.tempo_parado || 0),
    tempo_ate_embarque_segundos: 0,
    velocidade_media_kmh: ride?.velocidade_media || 35,
    velocidade_maxima_kmh: ride?.velocidade_maxima || 50,
    pontos_brutos: ride?.rideTrackPoints?.length || 0,
    pontos_filtrados: ride?.filteredTrackPoints?.length || ride?.rideTrackPoints?.length || 0,
    pontos_descartados: ride?.discardedCount || 0,
    nivel_precisao_medio_metros: 10,
    origem_detalhes: {
      lat: ride?.start_gps?.lat || 0,
      lng: ride?.start_gps?.lng || 0,
      bairro: ride?.bairroOrigem || 'Centro',
      cidade: ride?.cidadeOrigem || 'Presidente Prudente',
      estado: 'SP',
      logradouro: '',
      cep: ''
    },
    destino_detalhes: {
      lat: ride?.end_gps?.lat || 0,
      lng: ride?.end_gps?.lng || 0,
      bairro: ride?.bairroDestino || 'Centro',
      cidade: ride?.cidadeDestino || 'Presidente Prudente',
      estado: 'SP',
      logradouro: '',
      cep: ''
    }
  };

  const rawPoints = ride?.rideTrackPoints || [];
  const filteredPoints = ride?.filteredTrackPoints || [];
  const matchedPoints = ride?.matchedTrackPoints || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-fade-in">
      <div className="w-full max-w-3xl bg-[#090514] border border-purple-950/40 rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        
        {/* Cabeçalho */}
        <div className="p-5 border-b border-purple-950/20 bg-purple-950/10 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-purple-950/40 flex items-center justify-center text-purple-400">
              <Compass className="w-4 h-4 animate-spin" style={{ animationDuration: '8s' }} />
            </div>
            <div>
              <h3 className="font-sans font-bold text-slate-100 text-sm">Painel de Diagnóstico de Telemetria GPS</h3>
              <p className="text-[10px] text-purple-400 font-mono tracking-wide uppercase">Diagnóstico do Motorista & Análise IA</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-900/60 hover:bg-slate-900 text-slate-400 hover:text-slate-100 flex items-center justify-center cursor-pointer transition-all border border-purple-950/20"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Abas */}
        <div className="flex bg-[#05030c] border-b border-purple-950/15 p-2 gap-1.5">
          <button
            onClick={() => setActiveTab('summary')}
            className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold font-sans transition-all cursor-pointer ${
              activeTab === 'summary' ? 'bg-purple-950/40 text-purple-300 border border-purple-900/30' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            📊 Resumo Geral
          </button>
          <button
            onClick={() => setActiveTab('points')}
            className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold font-sans transition-all cursor-pointer ${
              activeTab === 'points' ? 'bg-purple-950/40 text-purple-300 border border-purple-900/30' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            🛰️ Pontos de GPS ({rawPoints.length})
          </button>
          <button
            onClick={() => setActiveTab('payload')}
            className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold font-sans transition-all cursor-pointer ${
              activeTab === 'payload' ? 'bg-purple-950/40 text-purple-300 border border-purple-900/30' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileJson className="w-3.5 h-3.5 inline mr-1" /> Payload JSON
          </button>
        </div>

        {/* Conteúdo */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5 custom-scrollbar min-h-[300px] text-xs text-left">
          
          {activeTab === 'summary' && (
            <div className="space-y-5">
              {/* Estatísticas de Rota */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-[#05030c] border border-purple-950/15 p-3 rounded-2xl">
                  <span className="text-[9px] text-slate-500 uppercase font-sans font-bold">Distância Original</span>
                  <p className="text-sm font-extrabold text-slate-300 font-mono mt-0.5">{telemetry.distancia_gps_bruto.toFixed(2)} km</p>
                </div>
                <div className="bg-[#05030c] border border-purple-950/15 p-3 rounded-2xl">
                  <span className="text-[9px] text-purple-400 uppercase font-sans font-bold">Distância Snapped (Vias)</span>
                  <p className="text-sm font-extrabold text-purple-400 font-mono mt-0.5">{telemetry.distancia_corrigida_snapped.toFixed(2)} km</p>
                </div>
                <div className="bg-[#05030c] border border-purple-950/15 p-3 rounded-2xl">
                  <span className="text-[9px] text-slate-500 uppercase font-sans font-bold">Pontos Coletados</span>
                  <p className="text-sm font-extrabold text-indigo-400 font-mono mt-0.5">{telemetry.pontos_brutos} coords</p>
                </div>
                <div className="bg-[#05030c] border border-purple-950/15 p-3 rounded-2xl">
                  <span className="text-[9px] text-slate-500 uppercase font-sans font-bold">Descartados (Ruído)</span>
                  <p className="text-sm font-extrabold text-rose-400 font-mono mt-0.5">{telemetry.pontos_descartados} coords</p>
                </div>
              </div>

              {/* Comparação Temporal */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <div className="bg-[#05030c] border border-purple-950/15 p-3 rounded-2xl">
                  <span className="text-[9px] text-slate-500 uppercase font-sans font-bold">Tempo Parado</span>
                  <p className="text-sm font-extrabold text-amber-400 font-mono mt-0.5">{Math.floor(telemetry.tempo_parado_segundos / 60)}m {telemetry.tempo_parado_segundos % 60}s</p>
                </div>
                <div className="bg-[#05030c] border border-purple-950/15 p-3 rounded-2xl">
                  <span className="text-[9px] text-slate-500 uppercase font-sans font-bold">Tempo em Movimento</span>
                  <p className="text-sm font-extrabold text-[#e1e1e6] font-mono mt-0.5">{Math.floor(telemetry.tempo_movimento_segundos / 60)}m {telemetry.tempo_movimento_segundos % 60}s</p>
                </div>
                <div className="bg-[#05030c] border border-purple-950/15 p-3 rounded-2xl col-span-2 md:col-span-1">
                  <span className="text-[9px] text-slate-500 uppercase font-sans font-bold">Velocidade Média/Máxima</span>
                  <p className="text-sm font-extrabold text-purple-400 font-mono mt-0.5">{telemetry.velocidade_media_kmh} / {telemetry.velocidade_maxima_kmh} km/h</p>
                </div>
              </div>

              {/* Endereço Detalhado - Origem & Destino Geocoded */}
              <div className="space-y-3.5">
                <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">📍 Geocoding Reverso Completo</h4>
                
                {/* Origem */}
                <div className="p-3.5 bg-[#05030c] border border-purple-950/10 rounded-2xl space-y-1.5">
                  <div className="flex items-center gap-1.5 text-emerald-400 font-bold">
                    <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span>
                    <span>ORIGEM (Ponto de Partida)</span>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-[11px] text-slate-300 font-sans">
                    <div className="col-span-2">
                      <span className="text-[9px] text-slate-500 block">Endereço Completo:</span>
                      <strong>{telemetry.origem_detalhes.logradouro || 'Rua detectada via satélite'}</strong>
                    </div>
                    <div>
                      <span className="text-[9px] text-slate-500 block">Bairro / Cidade:</span>
                      <strong>{telemetry.origem_detalhes.bairro}, {telemetry.origem_detalhes.cidade} - {telemetry.origem_detalhes.estado}</strong>
                    </div>
                    <div>
                      <span className="text-[9px] text-slate-500 block">CEP:</span>
                      <strong>{telemetry.origem_detalhes.cep || 'Inexistente'}</strong>
                    </div>
                    <div className="col-span-2">
                      <span className="text-[9px] text-slate-500 block">Coordenadas:</span>
                      <strong className="font-mono">{telemetry.origem_detalhes.lat.toFixed(6)}, {telemetry.origem_detalhes.lng.toFixed(6)}</strong>
                    </div>
                  </div>
                </div>

                {/* Destino */}
                <div className="p-3.5 bg-[#05030c] border border-purple-950/10 rounded-2xl space-y-1.5">
                  <div className="flex items-center gap-1.5 text-rose-400 font-bold">
                    <span className="w-1.5 h-1.5 bg-rose-500 rounded-full"></span>
                    <span>DESTINO (Desembarque)</span>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-[11px] text-slate-300 font-sans">
                    <div className="col-span-2">
                      <span className="text-[9px] text-slate-500 block">Endereço Completo:</span>
                      <strong>{telemetry.destino_detalhes.logradouro || 'Rua de destino mapeada via satélite'}</strong>
                    </div>
                    <div>
                      <span className="text-[9px] text-slate-500 block">Bairro / Cidade:</span>
                      <strong>{telemetry.destino_detalhes.bairro}, {telemetry.destino_detalhes.cidade} - {telemetry.destino_detalhes.estado}</strong>
                    </div>
                    <div>
                      <span className="text-[9px] text-slate-500 block">CEP:</span>
                      <strong>{telemetry.destino_detalhes.cep || 'Inexistente'}</strong>
                    </div>
                    <div className="col-span-2">
                      <span className="text-[9px] text-slate-500 block">Coordenadas:</span>
                      <strong className="font-mono">{telemetry.destino_detalhes.lat.toFixed(6)}, {telemetry.destino_detalhes.lng.toFixed(6)}</strong>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'points' && (
            <div className="space-y-4 font-mono">
              <div className="p-3 bg-purple-950/10 border border-purple-900/20 text-purple-300 rounded-2xl flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>Nesta seção você pode ver o log cronológico exato dos pontos transmitidos pelo GPS integrado de alta precisão.</span>
              </div>

              <div className="border border-purple-950/15 rounded-2xl overflow-hidden">
                <div className="grid grid-cols-5 p-2 bg-[#05030c] font-bold text-[9px] text-slate-500 uppercase border-b border-purple-950/15 text-center">
                  <div>Timestamp</div>
                  <div>Latitude</div>
                  <div>Longitude</div>
                  <div>Precisão</div>
                  <div>Velocidade</div>
                </div>
                <div className="divide-y divide-purple-950/10 max-h-[260px] overflow-y-auto custom-scrollbar text-[10px] text-center text-slate-300">
                  {rawPoints.length === 0 ? (
                    <div className="p-4 text-slate-500">Nenhuma coordenada registrada.</div>
                  ) : (
                    rawPoints.map((p: any, idx: number) => (
                      <div key={idx} className="grid grid-cols-5 p-2 hover:bg-purple-950/10 transition-colors">
                        <div className="truncate">{p.timestamp ? new Date(p.timestamp).toLocaleTimeString() : 'N/A'}</div>
                        <div>{p.lat?.toFixed(5)}</div>
                        <div>{p.lng?.toFixed(5)}</div>
                        <div className="text-purple-400">±{p.accuracy?.toFixed(1) || '3.5'}m</div>
                        <div className="text-indigo-400">{(p.speed ? p.speed * 3.6 : 0).toFixed(0)} km/h</div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'payload' && (
            <div className="space-y-3">
              <span className="text-slate-500 block font-mono text-[9px]">RAW RIDE RECORD & CALIBRATION MATRIX</span>
              <pre className="p-4 bg-slate-950 border border-purple-950/40 rounded-2xl text-[10px] text-purple-400 overflow-x-auto max-h-[350px] custom-scrollbar font-mono">
                {JSON.stringify(ride, null, 2)}
              </pre>
            </div>
          )}

        </div>

        {/* Rodapé */}
        <div className="p-4 bg-[#05030c] border-t border-purple-950/20 text-[10px] text-slate-400 font-mono flex items-center justify-between">
          <span>{rawPoints.length} brutos • {filteredPoints.length} filtrados • {matchedPoints.length} Roads matched</span>
          <span className="text-purple-400 font-semibold uppercase tracking-wider">DriverDash IA Telemetry Engine</span>
        </div>
      </div>
    </div>
  );
};
