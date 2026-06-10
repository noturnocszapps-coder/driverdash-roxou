import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { 
  AlertTriangle, Plus, ShieldCheck, MapPin, Calendar, Users, Eye,
  Coins, Landmark, TrendingUp, Milestone, Percent, Hourglass, Layers, ShieldAlert, BadgeInfo
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export const ReportsPage: React.FC = () => {
  const { 
    passengerReports, addPassengerReport, profile, 
    dailyClosings, weeklyClosings, earnings, expenses 
  } = useApp();

  const [activeTab, setActiveTab] = useState<'finance' | 'security'>('finance');

  // Passenger Report Form States
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [region, setRegion] = useState('');
  const [severity, setSeverity] = useState<'low' | 'medium' | 'high'>('medium');
  const [success, setSuccess] = useState(false);

  // Date constants & helper labels
  const today = new Date();
  const monthNames = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
  ];
  const activeMonthLabel = `${monthNames[today.getMonth()]} de ${today.getFullYear()}`;
  const currentYearMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;

  // Calculate current month statistics dynamically
  const monthEarnings = earnings.filter(e => e.date.startsWith(currentYearMonth));
  const monthExpenses = expenses.filter(e => e.date.startsWith(currentYearMonth));

  const monthGross = monthEarnings.reduce((sum, e) => sum + Number(e.gross_amount), 0);
  const monthCost = monthExpenses.reduce((sum, exp) => sum + Number(exp.amount), 0);
  const monthNet = monthGross - monthCost;
  const monthTotalKm = monthEarnings.reduce((sum, e) => sum + Number(e.total_km), 0);
  const monthRides = monthEarnings.reduce((sum, e) => sum + Number(e.rides_count), 0);
  const monthOnlineMin = monthEarnings.reduce((sum, e) => sum + Number(e.online_minutes), 0);

  const monthCostPerKm = monthTotalKm > 0 ? monthCost / monthTotalKm : 0;
  const monthProfitPerKm = monthTotalKm > 0 ? monthNet / monthTotalKm : 0;
  const monthHoursOnline = monthOnlineMin / 60;
  const monthEarningPerHour = monthHoursOnline > 0 ? monthGross / monthHoursOnline : 0;

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  const formatDistance = (val: number) => {
    return `${val.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} km`;
  };

  const handleSecuritySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !description || !region) {
      alert('Por favor, preencha o título, a região e o relato!');
      return;
    }

    try {
      await addPassengerReport({
        title,
        description,
        region,
        severity
      });

      setTitle('');
      setDescription('');
      setRegion('');
      setSeverity('medium');
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Title block */}
      <div className="border-b border-purple-950/20 pb-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white tracking-wide">Relatórios & Central de Insights</h2>
          <p className="text-xs text-purple-300/50 mt-1">
            Analise seus fechamentos financeiros consolidados ou consulte alertas de segurança da comunidade de motoristas.
          </p>
        </div>

        {/* Dynamic Tab Toggle Button */}
        <div className="flex bg-[#04010a] border border-purple-950/40 p-1 rounded-xl w-fit">
          <button
            onClick={() => setActiveTab('finance')}
            className={`px-4 py-1.5 rounded-lg text-xs font-mono font-bold tracking-wider uppercase transition-all cursor-pointer ${
              activeTab === 'finance'
                ? 'bg-purple-600 text-white shadow-sm'
                : 'text-purple-300/40 hover:text-purple-200'
            }`}
          >
            Insights Financeiros
          </button>
          <button
            onClick={() => setActiveTab('security')}
            className={`px-4 py-1.5 rounded-lg text-xs font-mono font-bold tracking-wider uppercase transition-all cursor-pointer ${
              activeTab === 'security'
                ? 'bg-rose-900 text-white shadow-sm'
                : 'text-purple-300/40 hover:text-purple-200'
            }`}
          >
            Alertas de Segurança ({passengerReports.length})
          </button>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'finance' ? (
          <motion.div
            key="finance-tab"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-8"
          >
            
            {/* 1. MONTHLY OVERVIEW */}
            <div className="bg-[#0b0720]/80 border border-purple-950/40 rounded-2xl p-6 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-44 h-44 bg-gradient-to-br from-purple-500/5 to-transparent rounded-full blur-3xl pointer-events-none"></div>
              
              <div className="flex items-center justify-between border-b border-purple-950/20 pb-3 mb-5">
                <div className="flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-purple-400" />
                  <h3 className="text-sm font-semibold text-white uppercase tracking-wider font-mono text-purple-400">
                    Resumo Consolidado do Mês Atual ({activeMonthLabel})
                  </h3>
                </div>
                <span className="text-[10px] text-purple-300/40 font-mono">Cálculo dinâmico automatizado</span>
              </div>

              {/* Monthly Stats Bento Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                <div className="p-4 rounded-xl bg-purple-950/10 border border-purple-950/20">
                  <span className="text-[10px] text-purple-400 font-mono block mb-1 uppercase">Faturamento Bruto</span>
                  <p className="text-lg font-bold text-emerald-400 font-mono">{formatCurrency(monthGross)}</p>
                  <span className="text-[9px] text-purple-300/40 font-mono block mt-1">{monthEarnings.length} corridas listadas</span>
                </div>

                <div className="p-4 rounded-xl bg-purple-950/10 border border-purple-950/20">
                  <span className="text-[10px] text-purple-400 font-mono block mb-1 uppercase">Gastos Totais</span>
                  <p className="text-lg font-bold text-rose-400 font-mono">{formatCurrency(monthCost)}</p>
                  <span className="text-[9px] text-purple-300/40 font-mono block mt-1">{monthExpenses.length} despesas listadas</span>
                </div>

                <div className="p-4 rounded-xl bg-gradient-to-br from-purple-950/30 to-indigo-950/20 border border-purple-500/20">
                  <span className="text-[10px] text-purple-200 font-mono block mb-1 uppercase font-bold">Lucro Líquido</span>
                  <p className={`text-lg font-bold font-mono ${monthNet >= 0 ? 'text-purple-300' : 'text-rose-500'}`}>
                    {formatCurrency(monthNet)}
                  </p>
                  <span className="text-[9px] text-purple-300/40 font-mono block mt-1">Margem real em mãos</span>
                </div>

                <div className="p-4 rounded-xl bg-purple-950/10 border border-purple-950/20">
                  <span className="text-[10px] text-purple-400 font-mono block mb-1 uppercase">Km Rodado Útil</span>
                  <p className="text-lg font-bold text-white font-mono">{formatDistance(monthTotalKm)}</p>
                  <span className="text-[9px] text-purple-300/40 font-mono block mt-1">{monthRides} viagens totais</span>
                </div>

                <div className="p-4 rounded-xl bg-purple-950/10 border border-purple-950/20 col-span-2 md:col-span-1">
                  <span className="text-[10px] text-purple-400 font-mono block mb-1 uppercase">Faturamento por Hora</span>
                  <p className="text-lg font-bold text-indigo-400 font-mono">{formatCurrency(monthEarningPerHour)}/h</p>
                  <span className="text-[9px] text-purple-300/40 font-mono block mt-1">Base: {monthHoursOnline.toFixed(1)}h online</span>
                </div>
              </div>

              {/* Supporting indicators */}
              <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-purple-950/10 text-[11px] text-slate-400 font-mono">
                <div className="flex justify-between p-2 rounded-lg bg-[#04010a]/40 border border-purple-950/10">
                  <span>Custo médio de combustível por Km:</span>
                  <span className="text-white font-bold">{formatCurrency(monthCostPerKm)}/km</span>
                </div>
                <div className="flex justify-between p-2 rounded-lg bg-[#04010a]/40 border border-purple-950/10">
                  <span>Retorno líquido médio por Km útil:</span>
                  <span className="text-purple-400 font-bold">{formatCurrency(monthProfitPerKm)}/km</span>
                </div>
              </div>
            </div>

            {/* 2. SPLIT SECTION: CLOSINGS HISTORIC */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              
              {/* DAILY CLOSINGS COLUMN */}
              <div className="bg-[#0b0720]/80 border border-purple-950/40 rounded-2xl p-6 space-y-4">
                <div className="flex items-center gap-2 border-b border-purple-950/20 pb-3">
                  <Calendar className="w-5 h-5 text-purple-400" />
                  <h3 className="text-sm font-semibold text-white uppercase tracking-wider font-mono text-purple-400">Fechamentos Diários</h3>
                </div>

                {dailyClosings.length > 0 ? (
                  <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
                    {dailyClosings.map((closing) => {
                      const closingDate = new Date(closing.date + 'T00:00:00');
                      return (
                        <div 
                          key={closing.id || closing.date}
                          className="p-4 rounded-xl bg-[#0a061b] border border-purple-950/40 hover:border-purple-800/50 transition-colors space-y-2.5"
                        >
                          <div className="flex items-center justify-between border-b border-purple-950/10 pb-1.5">
                            <span className="text-xs font-bold text-white font-mono">
                              {closingDate.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'short' })}
                            </span>
                            <span className="text-[10px] bg-purple-950/50 text-purple-300 font-mono px-2 py-0.5 rounded border border-purple-900/30">
                              Diário
                            </span>
                          </div>

                          <div className="grid grid-cols-3 gap-2 text-[11px] font-mono">
                            <div>
                              <span className="text-purple-300/40 block">Bruto:</span>
                              <span className="text-emerald-400 font-bold">{formatCurrency(closing.gross_amount)}</span>
                            </div>
                            <div>
                              <span className="text-purple-300/40 block">Líquido:</span>
                              <span className="text-purple-300 font-bold">{formatCurrency(closing.net_profit)}</span>
                            </div>
                            <div>
                              <span className="text-purple-300/40 block">Gasto:</span>
                              <span className="text-rose-400 font-bold">{formatCurrency(closing.total_expenses)}</span>
                            </div>
                          </div>

                          <div className="pt-2 border-t border-purple-950/5 flex justify-between text-[10px] text-slate-500 font-mono">
                            <span>Distância rodada: {closing.total_km} km</span>
                            <span>Cuto/Km: {formatCurrency(closing.cost_per_km)}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 text-center border border-dashed border-purple-950/40 rounded-xl bg-purple-950/5">
                    <div className="w-10 h-10 rounded-full bg-purple-950/20 text-purple-400 flex items-center justify-center mb-3">
                      <BadgeInfo className="w-5 h-5 text-purple-400" />
                    </div>
                    <h4 className="text-xs font-semibold text-white">Sem Fechamentos Diários</h4>
                    <p className="text-[11px] text-purple-300/40 px-6 mt-1 leading-relaxed">
                      Gerencie seu fluxo de caixa na aba Financeiro e clique em **Efetuar Fechamento Diário** para guardar históricos diários aqui.
                    </p>
                  </div>
                )}
              </div>

              {/* WEEKLY CLOSINGS COLUMN */}
              <div className="bg-[#0b0720]/80 border border-purple-950/40 rounded-2xl p-6 space-y-4">
                <div className="flex items-center gap-2 border-b border-purple-950/20 pb-3">
                  <Layers className="w-5 h-5 text-indigo-400" />
                  <h3 className="text-sm font-semibold text-white uppercase tracking-wider font-mono text-indigo-400">Fechamentos Semanais</h3>
                </div>

                {weeklyClosings.length > 0 ? (
                  <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
                    {weeklyClosings.map((closing) => {
                      const startDay = new Date(closing.week_start + 'T00:00:00');
                      const endDay = new Date(closing.week_end + 'T00:00:00');
                      return (
                        <div 
                          key={closing.id || closing.week_start}
                          className="p-4 rounded-xl bg-[#0a061b] border border-purple-950/40 hover:border-indigo-800/50 transition-colors space-y-2.5"
                        >
                          <div className="flex items-center justify-between border-b border-purple-950/10 pb-1.5">
                            <span className="text-xs font-bold text-white font-mono flex items-center gap-1">
                              Semana: {startDay.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })} - {endDay.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })}
                            </span>
                            <span className="text-[10px] bg-indigo-950/50 text-indigo-300 font-mono px-2 py-0.5 rounded border border-indigo-900/30 animate-pulse">
                              Semanal
                            </span>
                          </div>

                          <div className="grid grid-cols-3 gap-2 text-[11px] font-mono">
                            <div>
                              <span className="text-purple-300/40 block">Bruto:</span>
                              <span className="text-emerald-400 font-bold">{formatCurrency(closing.gross_amount)}</span>
                            </div>
                            <div>
                              <span className="text-purple-300/40 block">Margem Líq.:</span>
                              <span className="text-indigo-300 font-bold">{formatCurrency(closing.net_profit)}</span>
                            </div>
                            <div>
                              <span className="text-purple-300/40 block">Despesas:</span>
                              <span className="text-rose-400 font-bold">{formatCurrency(closing.total_expenses)}</span>
                            </div>
                          </div>

                          <div className="pt-2 border-t border-purple-950/5 flex justify-between text-[10px] text-slate-500 font-mono">
                            <span>Quilometragem: {closing.total_km} km</span>
                            <span>Retorno/Km: {formatCurrency(closing.profit_per_km)}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 text-center border border-dashed border-purple-950/40 rounded-xl bg-purple-950/5">
                    <div className="w-10 h-10 rounded-full bg-purple-950/20 text-indigo-400 flex items-center justify-center mb-3">
                      <BadgeInfo className="w-5 h-5 text-indigo-400" />
                    </div>
                    <h4 className="text-xs font-semibold text-white">Sem Fechamentos Semanais</h4>
                    <p className="text-[11px] text-purple-300/40 px-6 mt-1 leading-relaxed">
                      Gerencie seu fluxo de caixa na aba Financeiro e clique em **Efetuar Fechamento Semanal** para gerar resumos de Segunda a Domingo aqui.
                    </p>
                  </div>
                )}
              </div>

            </div>

          </motion.div>
        ) : (
          <motion.div
            key="security-tab"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="grid grid-cols-1 lg:grid-cols-3 gap-8 text-xs font-sans"
          >
            
            {/* NEW INCIDENT REPORT FORM */}
            <div className="bg-[#0b0720]/80 border border-purple-950/40 rounded-2xl p-6 h-fit">
              <div className="flex items-center gap-2 border-b border-purple-950/20 pb-3 mb-5">
                <AlertTriangle className="w-5 h-5 text-rose-500" />
                <h3 className="text-md font-bold text-white">Lançar Alerta de Segurança</h3>
              </div>

              {success && (
                <div className="mb-4 p-3 bg-emerald-950/60 border border-emerald-950/40 text-emerald-400 text-xs rounded-xl flex items-center gap-2 animate-fadeIn">
                  <ShieldCheck className="w-4 h-4 shrink-0" />
                  <span>Alerta comunitário enviado e arquivado!</span>
                </div>
              )}

              <form onSubmit={handleSecuritySubmit} className="space-y-4">
                <div>
                  <label className="block text-slate-400 mb-1.5">Título do Ocorrido / Alerta</label>
                  <input 
                    type="text" 
                    value={title} 
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Ex: Passageiro cancelou no meio da corrida"
                    className="w-full bg-[#04010a] border border-purple-950/50 rounded-xl p-3 text-slate-100 focus:outline-none focus:border-purple-600 transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 mb-1.5">Região / Bairro / Cidade</label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-3 flex items-center text-purple-400">
                      <MapPin className="w-4 h-4" />
                    </span>
                    <input 
                      type="text" 
                      value={region} 
                      onChange={(e) => setRegion(e.target.value)}
                      placeholder="Ex: Pinheiros (São Paulo)"
                      className="w-full bg-[#04010a] border border-purple-950/50 rounded-xl py-3 pl-10 pr-4 text-slate-100 focus:outline-none focus:border-purple-600 transition-colors font-mono text-[11px]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-400 mb-1.5">Nível de Gravidade / Risco</label>
                  <div className="flex bg-purple-950/20 border border-purple-950/45 p-1 rounded-xl">
                    <button
                      type="button"
                      onClick={() => setSeverity('low')}
                      className={`flex-1 py-1.5 text-[10px] font-bold rounded-lg transition-all cursor-pointer ${
                        severity === 'low' 
                          ? 'bg-emerald-950 text-emerald-400 border border-emerald-900/30' 
                          : 'text-purple-300/40 hover:text-white'
                      }`}
                    >
                      Baixo
                    </button>
                    <button
                      type="button"
                      onClick={() => setSeverity('medium')}
                      className={`flex-1 py-1.5 text-[10px] font-bold rounded-lg transition-all cursor-pointer ${
                        severity === 'medium' 
                          ? 'bg-amber-950 text-amber-500 border border-amber-900/30' 
                          : 'text-purple-300/40 hover:text-white'
                      }`}
                    >
                      Médio
                    </button>
                    <button
                      type="button"
                      onClick={() => setSeverity('high')}
                      className={`flex-1 py-1.5 text-[10px] font-bold rounded-lg transition-all cursor-pointer ${
                        severity === 'high' 
                          ? 'bg-rose-950 text-rose-500 border border-rose-900/40 shadow-sm' 
                          : 'text-purple-300/40 hover:text-white'
                      }`}
                    >
                      Alto Risco
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-slate-400 mb-1.5">Descrição Detalhada do Fato</label>
                  <textarea 
                    rows={4}
                    value={description} 
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Descreva o passageiro, o veículo utilizado ou detalhes da zona para que outros motoristas fiquem cientes..."
                    className="w-full bg-[#04010a] border border-purple-950/50 rounded-xl p-3 text-slate-100 focus:outline-none focus:border-purple-600 resize-none"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full bg-gradient-to-r from-rose-700 to-red-600 hover:from-rose-600 hover:to-red-500 text-white font-semibold py-3 px-4 rounded-xl transition-all shadow-[0_4px_15px_rgba(220,38,38,0.25)] cursor-pointer"
                >
                  Publicar Alerta Comunitário
                </button>
              </form>
            </div>

            {/* FEED / TIME LINE OF ALERTS */}
            <div className="lg:col-span-2 bg-[#0a061b] border border-purple-950/40 rounded-2xl p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-purple-950/20 pb-3">
                <div className="flex items-center gap-2">
                  <Eye className="w-5 h-5 text-purple-400" />
                  <h3 className="text-sm font-semibold text-white uppercase tracking-wider font-mono text-purple-400">
                    Feed Ativo de Segurança Comunitária
                  </h3>
                </div>
                <span className="text-[10px] bg-purple-950/60 text-purple-300 font-mono px-2 py-0.5 rounded border border-purple-900/30">
                  {passengerReports.length} ativos
                </span>
              </div>

              {passengerReports.length > 0 ? (
                <div className="space-y-4 max-h-[500px] overflow-y-auto pr-1">
                  {passengerReports.map((report, idx) => (
                    <div
                      key={report.id || idx}
                      className={`p-5 rounded-xl border relative overflow-hidden transition-all duration-300 hover:scale-[1.01] ${
                        report.severity === 'high'
                          ? 'bg-rose-950/10 border-rose-900/45 shadow-[0_4px_20px_rgba(220,38,38,0.05)]'
                          : report.severity === 'medium'
                          ? 'bg-amber-950/10 border-amber-900/40'
                          : 'bg-[#0d0922] border-purple-950/50'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className={`text-[9px] font-bold px-2 py-0.5 rounded uppercase font-mono ${
                              report.severity === 'high'
                                ? 'bg-red-950 text-red-400 border border-red-900/40'
                                : report.severity === 'medium'
                                ? 'bg-amber-900/20 text-amber-400 border border-amber-900/30'
                                : 'bg-emerald-950 text-emerald-400 border border-emerald-900/30'
                            }`}>
                              RISCO {report.severity === 'high' ? 'ALTO' : report.severity === 'medium' ? 'MÉDIO' : 'BAIXO'}
                            </span>
                            
                            <span className="text-[10px] text-purple-300 font-mono flex items-center gap-1">
                              <MapPin className="w-3 h-3 text-purple-400" /> {report.region}
                            </span>
                          </div>

                          <h4 className="text-md font-bold text-white mt-2 leading-tight">{report.title}</h4>
                          <p className="text-xs text-slate-300 mt-2 leading-relaxed whitespace-pre-wrap">{report.description}</p>
                        </div>
                      </div>

                      <div className="mt-4 border-t border-purple-950/10 pt-3 flex items-center justify-between text-[10px] text-slate-500 font-mono">
                        <span className="flex items-center gap-1">
                          <Users className="w-3.5 h-3.5 text-purple-400" /> Enviado por motorista DriverDash
                        </span>
                        <span>{report.created_at ? new Date(report.created_at).toLocaleDateString('pt-BR') : 'Agora'}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center border border-dashed border-purple-950/40 rounded-xl bg-[#090518]/25">
                  <div className="w-10 h-10 rounded-full bg-purple-950/20 text-purple-500 flex items-center justify-center mb-3">
                    <ShieldCheck className="w-5 h-5 text-emerald-500" />
                  </div>
                  <h4 className="text-xs font-semibold text-white">Nenhum Alerta Ativo de Segurança</h4>
                  <p className="text-[11px] text-purple-300/45 px-2 mt-1">
                    Ótimas notícias! O feed comunitário está seguro no momento. Adicione incidentes se necessário.
                  </p>
                </div>
              )}

              <div className="p-4 rounded-xl bg-purple-950/10 border border-purple-950/20 text-xs text-purple-300/70 leading-relaxed font-sans">
                <span className="font-bold text-white block mb-0.5 uppercase tracking-wider text-[10px] text-purple-400 font-mono">
                  Segurança em Primeiro Lugar:
                </span>
                O DriverDash Roxou consolida o mapeamento cooperativo de ocorrências para resguardar a integridade dos motoristas contra fraudidores ou golpes recorrentes em zonas remotas.
              </div>
            </div>

          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
};
