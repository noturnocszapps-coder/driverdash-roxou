import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Bot, Calendar, Play } from 'lucide-react';

interface DriverDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  calibrationAnalytics: any;
  calibrationStats: any;
  driverSessions: any[];
  rideLogs: any[];
  isAdmin: boolean;
  aiLogs: string[];
}

export const DriverDetailsModal: React.FC<DriverDetailsModalProps> = ({
  isOpen,
  onClose,
  calibrationAnalytics,
  calibrationStats,
  driverSessions,
  rideLogs,
  isAdmin,
  aiLogs,
}) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="journey-modal fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#050310]/90 backdrop-blur-md"
        >
          <motion.div 
            initial={{ scale: 0.95, y: 15 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.95, y: 15 }}
            className="bg-[#0d0926] border border-purple-950/40 rounded-3xl w-full max-w-2xl overflow-hidden shadow-[0_10px_50px_rgba(76,29,149,0.3)] text-left flex flex-col max-h-[85vh]"
          >
            <div className="p-5 border-b border-purple-950/20 bg-purple-950/10 flex items-center justify-between shrink-0">
              <div>
                <h3 className="text-sm font-bold text-white uppercase font-mono tracking-wider flex items-center gap-2">
                  📊 Detalhes de Desempenho & Inteligência IA
                </h3>
                <p className="text-[10px] text-purple-300 mt-0.5 font-sans">
                  Visão detalhada e calibrada com base na sua rotina de direção.
                </p>
              </div>
              <button 
                onClick={onClose}
                className="p-1 rounded-lg bg-purple-950/20 hover:bg-purple-950/40 text-purple-400 cursor-pointer select-none transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-6 overflow-y-auto custom-scrollbar flex-1 text-xs font-sans text-slate-300">
              
              {/* 1. PAINEL DE ANALYTICS DA CALIBRAÇÃO DA IA */}
              <div className="space-y-4">
                <h3 className="text-xs font-bold uppercase font-mono tracking-wider text-purple-400">
                  Métricas e Estatísticas da IA
                </h3>
                
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <div className="bg-[#050310]/80 p-3 rounded-xl border border-purple-950/10 space-y-1">
                    <span className="text-[8px] text-slate-500 font-mono uppercase block">Tempo Médio p/ Embarque</span>
                    <span className="text-xs font-bold text-indigo-400 font-mono">
                      {calibrationAnalytics.tempoMedioEmbarqueSec > 0 
                        ? `${Math.floor(calibrationAnalytics.tempoMedioEmbarqueSec / 60)}m ${Math.round(calibrationAnalytics.tempoMedioEmbarqueSec % 60)}s`
                        : "0s"}
                    </span>
                  </div>

                  <div className="bg-[#050310]/80 p-3 rounded-xl border border-purple-950/10 space-y-1">
                    <span className="text-[8px] text-slate-500 font-mono uppercase block">Tempo Médio de Corrida</span>
                    <span className="text-xs font-bold text-purple-400 font-mono">
                      {calibrationAnalytics.tempoMedioCorridaSec > 0 
                        ? `${Math.floor(calibrationAnalytics.tempoMedioCorridaSec / 60)} min`
                        : "0 min"}
                    </span>
                  </div>

                  <div className="bg-[#050310]/80 p-3 rounded-xl border border-purple-950/10 space-y-1">
                    <span className="text-[8px] text-slate-500 font-mono uppercase block">Média de KM por Corrida</span>
                    <span className="text-xs font-bold text-[#e1e1e6] font-mono">
                      {calibrationAnalytics.kmMedios.toFixed(1)} km
                    </span>
                  </div>

                  <div className="bg-[#050310]/80 p-3 rounded-xl border border-purple-950/10 space-y-1">
                    <span className="text-[8px] text-slate-500 font-mono uppercase block">Lucro Médio Estimado</span>
                    <span className="text-xs font-bold text-emerald-400 font-mono">
                      R$ {calibrationAnalytics.lucroMedio.toFixed(2)}
                    </span>
                  </div>

                  <div className="bg-[#050310]/80 p-3 rounded-xl border border-purple-950/10 space-y-1">
                    <span className="text-[8px] text-slate-500 font-mono uppercase block">R$/KM Geral</span>
                    <span className="text-xs font-bold text-emerald-400 font-mono">
                      R$ {calibrationAnalytics.rPerKm.toFixed(2)}/km
                    </span>
                  </div>

                  <div className="bg-[#050310]/80 p-3 rounded-xl border border-purple-950/10 space-y-1">
                    <span className="text-[8px] text-slate-500 font-mono uppercase block">R$/Hora Geral</span>
                    <span className="text-xs font-bold text-emerald-400 font-mono">
                      R$ {calibrationAnalytics.rPerHour.toFixed(2)}/h
                    </span>
                  </div>
                </div>

                {/* Frequências de Bairros/Plataformas */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="bg-[#050310]/50 p-3 rounded-xl border border-purple-950/10 text-[10.5px] space-y-2">
                    <span className="text-[8.5px] text-purple-400 font-mono uppercase block font-bold">Origens frequentes</span>
                    <div className="space-y-1 max-h-[72px] overflow-y-auto custom-scrollbar">
                      {calibrationAnalytics.bairrosOrigemFreq.length === 0 ? (
                        <p className="text-slate-600 font-sans italic text-[10px]">Nenhum bairro</p>
                      ) : (
                        calibrationAnalytics.bairrosOrigemFreq.slice(0, 3).map((b: any, i: number) => (
                          <div key={i} className="flex justify-between text-slate-300 font-sans">
                            <span className="truncate pr-1">{b.name}</span>
                            <span className="text-slate-500 font-mono font-bold">{b.count}x</span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  <div className="bg-[#050310]/50 p-3 rounded-xl border border-purple-950/10 text-[10.5px] space-y-2">
                    <span className="text-[8.5px] text-purple-400 font-mono uppercase block font-bold">Destinos frequentes</span>
                    <div className="space-y-1 max-h-[72px] overflow-y-auto custom-scrollbar">
                      {calibrationAnalytics.bairrosDestinoFreq.length === 0 ? (
                        <p className="text-slate-600 font-sans italic text-[10px]">Nenhum destino</p>
                      ) : (
                        calibrationAnalytics.bairrosDestinoFreq.slice(0, 3).map((b: any, i: number) => (
                          <div key={i} className="flex justify-between text-slate-300 font-sans">
                            <span className="truncate pr-1">{b.name}</span>
                            <span className="text-slate-500 font-mono font-bold">{b.count}x</span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  <div className="bg-[#050310]/50 p-3 rounded-xl border border-purple-950/10 text-[10.5px] space-y-2">
                    <span className="text-[8.5px] text-purple-400 font-mono uppercase block font-bold">Plataformas</span>
                    <div className="space-y-1 max-h-[72px] overflow-y-auto custom-scrollbar">
                      {calibrationAnalytics.plataformasFreq.length === 0 ? (
                        <p className="text-slate-600 font-sans italic text-[10px]">Nenhuma</p>
                      ) : (
                        calibrationAnalytics.plataformasFreq.slice(0, 3).map((p: any, i: number) => (
                          <div key={i} className="flex justify-between text-slate-300 font-sans">
                            <span className="truncate pr-1">{p.name}</span>
                            <span className="text-slate-500 font-mono font-bold">{p.count}x</span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* 2. CALIBRAÇÃO DA IA OPERACIONAL */}
              <div className="p-5 bg-[#050310]/60 border border-purple-950/25 rounded-2xl text-left space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase font-mono tracking-wider text-purple-400 flex items-center gap-2">
                    <Bot className="w-4 h-4 text-purple-400" /> Progresso de Calibração da Inteligência
                  </h4>
                  <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase font-mono ${
                    calibrationStats.isCalibrated 
                      ? 'bg-emerald-950/50 text-emerald-400 border border-emerald-900/45' 
                      : 'bg-amber-950/50 text-amber-400 border border-amber-900/45'
                  }`}>
                    {calibrationStats.isCalibrated ? '● IA Calibrada' : '● IA Aprendendo...'}
                  </span>
                </div>

                <p className="text-[11px] text-slate-300 leading-relaxed font-sans font-normal">
                  O modelo preditivo de demanda e oportunidades calibra a sua rotina real de condução.
                  Atualmente, são necessárias 100 corridas individuais para calibração ótima de mercado.
                </p>

                <div className="space-y-1.5">
                  <div className="flex justify-between text-[10px] font-mono">
                    <span className="text-slate-400">Progresso:</span>
                    <span className="font-bold text-[#e1e1e6]">
                      {calibrationStats.totalFinished} de 100 corridas ({calibrationStats.calibrationProgress}%)
                    </span>
                  </div>
                  <div className="h-2 w-full bg-[#050310] rounded-full overflow-hidden border border-purple-950/20">
                    <div 
                      className="h-full bg-gradient-to-r from-purple-600 via-indigo-600 to-emerald-500 rounded-full transition-all duration-500"
                      style={{ width: `${calibrationStats.calibrationProgress}%` }}
                    ></div>
                  </div>
                </div>
              </div>

              {/* 3. JORNADAS RECENTES */}
              <div className="space-y-3 font-sans">
                <h4 className="text-xs font-bold uppercase font-mono tracking-wider text-purple-400">
                  Jornadas Ativas Recentes
                </h4>
                {driverSessions.length === 0 ? (
                  <div className="text-center py-4 text-xs text-slate-500 font-mono">
                    Nenhuma jornada recente registrada.
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[150px] overflow-y-auto pr-1 custom-scrollbar">
                    {driverSessions.map((sess, idx) => (
                      <div key={sess.id || idx} className="p-3 bg-[#050310] rounded-xl border border-purple-950/10 flex items-center justify-between font-mono text-[11px]">
                        <div>
                          <p className="font-bold text-purple-300">
                            {sess.status === 'active' ? '🟢 Em andamento' : '🏁 Concluída'}
                          </p>
                          <span className="text-[9px] text-slate-500 block mt-0.5">
                            {new Date(sess.start_time).toLocaleDateString('pt-BR')} às {new Date(sess.start_time).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-purple-400">
                            {sess.total_distance_km ? sess.total_distance_km.toFixed(1) : '0.0'} KM
                          </p>
                          <p className="text-[9px] text-slate-500">
                            {sess.total_duration_minutes || 0} min total
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 4. CORRIDAS DE CALIBRAÇÃO */}
              <div className="space-y-3 font-sans">
                <h4 className="text-xs font-bold uppercase font-mono tracking-wider text-purple-400">
                  Corridas de Calibração Registradas
                </h4>
                {rideLogs.length === 0 ? (
                  <div className="text-center py-4 text-xs text-slate-500 font-mono">
                    Nenhuma corrida individual registrada.
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[200px] overflow-y-auto pr-1 custom-scrollbar font-mono text-[11px]">
                    {rideLogs.slice().reverse().map((ride: any, idx: number) => {
                      const isFinished = ride.status === 'finished';
                      const isCancelled = ride.status === 'cancelled';
                      return (
                        <div key={ride.id || idx} className="p-3 bg-[#050310]/80 rounded-xl border border-purple-950/20 space-y-1">
                          <div className="flex items-center justify-between text-[10px]">
                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                              isFinished ? 'bg-emerald-950/40 text-emerald-400' : isCancelled ? 'bg-rose-950/40 text-rose-400' : 'bg-amber-950/40 text-amber-400'
                            }`}>
                              {isFinished ? '🏁 Concluída' : isCancelled ? '❌ Cancelada' : '🟡 Em andamento'}
                            </span>
                            <span className="text-[10px] text-purple-300">
                              {ride.platform || "Uber"}
                            </span>
                          </div>
                          <div className="flex justify-between text-[10px] text-slate-400 pt-1">
                            <span>KM: {ride.distancia_hodometro ? ride.distancia_hodometro.toFixed(1) : '0.0'} km</span>
                            <span className="text-emerald-400 font-bold">R$ {(ride.receivedValue || 0).toFixed(2)}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* 5. DEBUG MODE ADM LOGGER */}
              {isAdmin && (
                <div className="p-4 bg-[#050310] border border-purple-950/20 rounded-2xl space-y-2 font-mono text-[10px]">
                  <p className="text-purple-400 font-bold uppercase">🛠️ [DEBUG MODE] Logs do Sistema de Inteligência</p>
                  <div className="max-h-[100px] overflow-y-auto space-y-1 custom-scrollbar text-slate-300">
                    {aiLogs.length === 0 ? (
                      <p className="text-slate-600">Nenhum log disponível.</p>
                    ) : (
                      aiLogs.slice().reverse().map((log, i) => <div key={i}>{log}</div>)
                    )}
                  </div>
                </div>
              )}

            </div>

            <div className="p-5 border-t border-purple-950/20 bg-purple-950/10 flex items-center justify-end shrink-0">
              <button 
                onClick={onClose}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold select-none cursor-pointer transition-all text-center text-xs"
              >
                Fechar Painel
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
