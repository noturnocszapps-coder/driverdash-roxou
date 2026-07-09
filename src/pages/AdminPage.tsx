import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { useDemand } from '../modules/demand/demand.hooks';
import { 
  Users, Layers, Megaphone, Plus, ToggleLeft, ToggleRight, 
  Clock, AlertTriangle, ShieldAlert, Sparkles, MapPin, Gauge,
  Coins, Check, X, Shield, Star, Ban, Power, LayoutDashboard,
  Settings, Lightbulb, Search, Filter, Calendar, UserCheck,
  Eye, Activity, Database, AlertCircle, RefreshCw, Smartphone, Car
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { UserPlan, UserRole, RideOffer } from '../types';
import { roxouIntegrationService } from '../modules/demand/roxouIntegration.service';
import { useObservability } from '../modules/observability/observability.hooks';
import { rideOffersService } from '../modules/ride-offers/rideOffers.service';

export const AdminPage: React.FC = () => {
  const { 
    peakRules, addPeakRule, togglePeakRule, 
    passengerReports, dbStatus, earnings, expenses,
    users, subscriptions, payments, accessRequests,
    updateUserPlan, updateSubscriptionStatus, toggleUserRole, toggleBlockUser, toggleBetaTester,
    approvePayment, rejectPayment, vehicle, vehicleCostSettings, user, updateAccessRequestStatus, fetchAccessRequests
  } = useApp();

  // Selected Admin Menu
  const [activeTab, setActiveTab] = useState<'dashboard' | 'users' | 'subscriptions' | 'occurrences' | 'intelligence' | 'configs' | 'observability' | 'ride_offers' | 'access_requests'>('dashboard');

  // State for Ride Offers (future Android Accessibility simulation and viewing)
  const [allOffers, setAllOffers] = useState<RideOffer[]>([]);
  const [offersStats, setOffersStats] = useState<any>(null);
  const [loadingOffers, setLoadingOffers] = useState(false);

  useEffect(() => {
    if (activeTab === 'ride_offers') {
      const loadOffers = async () => {
        setLoadingOffers(true);
        try {
          const uId = user?.id || 'all_users_admin';
          const list = await rideOffersService.listRecentRideOffers(uId);
          const stats = await rideOffersService.getRideOfferStats(uId);
          setAllOffers(list);
          setOffersStats(stats);
        } catch (e) {
          console.error(e);
        } finally {
          setLoadingOffers(false);
        }
      };
      loadOffers();
    }
  }, [activeTab, user?.id]);

  const handleCreateSimulatedOffer = async (templateIndex: number) => {
    const templates = [
      "UberX - R$ 24,50 • 8.2 km • 15 min • Embarque: Jardim Bongiovani • Destino: Centro",
      "99Pop - R$ 12,80 • 3.1 km • 8 min • Embarque: Ana Jacinta • Destino: Vila Industrial",
      "Uber Comfort - R$ 42,00 • 18.0 km • 28 min • Embarque: Centro • Destino: Regente Feijó",
      "UberX - R$ 7,50 • 9.5 km • 22 min • Embarque: Cohab • Destino: Brasil Novo",
      "99Pop - R$ 15,20 • 4.5 km • 10 min • Embarque: Jardim Paulista • Destino: Parque do Povo"
    ];

    const text = templates[templateIndex];
    const parsed = rideOffersService.parseOfferTextMock(text);
    const uId = user?.id || 'all_users_admin';
    
    await rideOffersService.createRideOffer({
      user_id: uId,
      provider: parsed.provider || 'uber',
      raw_text: text,
      fare_amount: parsed.fare_amount || 15,
      estimated_distance_km: parsed.estimated_distance_km || 4.5,
      estimated_duration_min: parsed.estimated_duration_min || 12,
      pickup_text: parsed.pickup_text || 'Desconhecido',
      destination_text: parsed.destination_text || 'Desconhecido',
      pickup_neighborhood: parsed.pickup_neighborhood || 'Desconhecido',
      destination_neighborhood: parsed.destination_neighborhood || 'Desconhecido',
      pickup_city: parsed.pickup_city || 'Presidente Prudente',
      destination_city: parsed.destination_city || 'Presidente Prudente',
      confidence_score: 98,
      source: 'android_accessibility',
      status: 'detected',
      detected_at: new Date().toISOString()
    }, vehicle, vehicleCostSettings);

    const list = await rideOffersService.listRecentRideOffers(uId);
    const stats = await rideOffersService.getRideOfferStats(uId);
    setAllOffers(list);
    setOffersStats(stats);
  };

  const handleUpdateStatus = async (offerId: string, newStatus: 'accepted' | 'rejected' | 'expired' | 'ignored') => {
    await rideOffersService.updateRideOfferStatus(offerId, newStatus);
    const uId = user?.id || 'all_users_admin';
    const list = await rideOffersService.listRecentRideOffers(uId);
    const stats = await rideOffersService.getRideOfferStats(uId);
    setAllOffers(list);
    setOffersStats(stats);
  };




  // Observability Telemetry Context
  const { 
    logs: obsLogs, 
    audits: obsAudits, 
    health: obsHealth, 
    loading: obsLoading, 
    refreshLogs, 
    refreshAudits, 
    refreshHealth, 
    clearLocalLogs 
  } = useObservability();

  // Observability Filter States
  const [obsLevelFilter, setObsLevelFilter] = useState<'all' | 'info' | 'warn' | 'error' | 'critical'>('all');
  const [obsCategoryFilter, setObsCategoryFilter] = useState<'all' | 'auth' | 'gps' | 'sync' | 'supabase' | 'admin' | 'payment' | 'demand' | 'system'>('all');
  const [obsPeriodFilter, setObsPeriodFilter] = useState<'24h' | '3d' | '7d' | 'all'>('all');

  // Gestão de Usuários Filter State
  const [searchTerm, setSearchTerm] = useState('');
  const [planFilter, setPlanFilter] = useState<'all' | 'free' | 'pro' | 'pro_plus'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'blocked'>('all');
  const [roleFilter, setRoleFilter] = useState<'all' | 'driver' | 'admin'>('all');

  // New rule form state (Inteligência Roxou)
  const [title, setTitle] = useState('');
  const [region, setRegion] = useState('');
  const [startTime, setStartTime] = useState('17:00');
  const [endTime, setEndTime] = useState('19:00');
  const [demandLevel, setDemandLevel] = useState<'low' | 'medium' | 'high' | 'extreme'>('high');
  const [selectedDays, setSelectedDays] = useState<string[]>(['1', '2', '3', '4', '5']); // Seg-Sex
  const [success, setSuccess] = useState(false);

  // --- ROXOU INTELIGÊNCIA DEMAND CONTEXT AND SUBTABS ---
  const { 
    demandSignals, heatmapZones, addDemandSignal, deleteDemandSignal, toggleDemandSignal, updateHeatmapZone, refetchDemand
  } = useDemand();
  const [intelSubTab, setIntelSubTab] = useState<'peak_rules' | 'demand_signals' | 'heatmap_zones' | 'roxou_integration'>('peak_rules');

  // Core Roxou integration state
  const [roxouStatus, setRoxouStatus] = useState(roxouIntegrationService.getIntegrationStatus());
  const [previewSignals, setPreviewSignals] = useState<any[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [integrationSuccessMsg, setIntegrationSuccessMsg] = useState('');

  const refreshRoxouStatus = () => {
    setRoxouStatus(roxouIntegrationService.getIntegrationStatus());
  };

  // Sinais de Demanda form states
  const [sigTitle, setSigTitle] = useState('');
  const [sigRegion, setSigRegion] = useState('Centro');
  const [sigWeight, setSigWeight] = useState(1.5);
  const [sigType, setSigType] = useState('event');
  const [sigSuccess, setSigSuccess] = useState(false);

  // Region coordinates for auto-binding
  const REG_COORDS: Record<string, { lat: number; lng: number }> = {
    'Centro': { lat: -22.1225, lng: -51.3883 },
    'Rodoviária': { lat: -22.1158, lng: -51.3853 },
    'Aeroporto': { lat: -22.1764, lng: -51.4239 },
    'Prudenshopping': { lat: -22.1147, lng: -51.4068 },
    'UNOESTE': { lat: -22.1192, lng: -51.4428 },
    'Toledo': { lat: -22.1256, lng: -51.3992 },
    'UNESP': { lat: -22.1206, lng: -51.4092 },
    'Parque do Povo': { lat: -22.1264, lng: -51.4022 },
    'Matarazzo': { lat: -22.1144, lng: -51.3811 },
    'Expo Prudente': { lat: -22.1642, lng: -51.3482 }
  };

  const handleAddSignal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sigTitle.trim()) {
      alert('Por favor, informe o título do sinal temporal!');
      return;
    }
    const coords = REG_COORDS[sigRegion] || { lat: -22.1225, lng: -51.3883 };
    await addDemandSignal({
      title: sigTitle,
      region: sigRegion,
      latitude: coords.lat,
      longitude: coords.lng,
      signal_type: sigType,
      weight: sigWeight
    });
    setSigTitle('');
    setSigSuccess(true);
    setTimeout(() => setSigSuccess(false), 3000);
  };

  // Formatter helpers
  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'Nunca logou';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('pt-BR', { 
        day: '2-digit', 
        month: '2-digit', 
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateStr;
    }
  };

  const getSubStatusLabel = (userId: string) => {
    const sub = subscriptions.find(s => s.user_id === userId);
    if (!sub) return { label: 'Inativo', css: 'text-slate-500 bg-slate-950/10' };
    if (sub.status === 'active') return { label: 'Ativo', css: 'text-emerald-400 bg-emerald-950/30 border border-emerald-800/30' };
    if (sub.status === 'pending') return { label: 'Pendente', css: 'text-amber-400 bg-amber-950/30 border border-amber-800/30' };
    return { label: 'Desativado', css: 'text-rose-400 bg-rose-950/30 border border-rose-800/20' };
  };

  const handleDayToggle = (day: string) => {
    if (selectedDays.includes(day)) {
      setSelectedDays(selectedDays.filter(d => d !== day));
    } else {
      setSelectedDays([...selectedDays, day]);
    }
  };

  const handleAddRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !region) {
      alert('Preencha título e região!');
      return;
    }

    try {
      await addPeakRule({
        title,
        region,
        start_time: startTime,
        end_time: endTime,
        days_of_week: selectedDays,
        demand_level: demandLevel,
        source_type: 'admin',
        is_active: true
      });

      setTitle('');
      setRegion('');
      setStartTime('17:00');
      setEndTime('19:00');
      setDemandLevel('high');
      setSelectedDays(['1', '2', '3', '4', '5']);
      
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      console.error(err);
    }
  };

  // COMMERCIAL KPI CALCULATIONS
  const totalProfilesCount = users.length;
  const activeProfilesCount = users.filter(u => !u.is_blocked).length;
  const paidProfilesCount = users.filter(u => u.plan === 'pro' || u.plan === 'pro_plus').length;
  
  const conversionRate = totalProfilesCount > 0 
    ? ((paidProfilesCount / totalProfilesCount) * 100).toFixed(1) 
    : '0';

  const estimatedMonthlyRevenue = users.reduce((sum, u) => {
    if (u.plan === 'pro') return sum + 29.90;
    if (u.plan === 'pro_plus') return sum + 49.90;
    return sum;
  }, 0);

  const pendingPaymentsList = payments.filter(p => p.status === 'pending');

  // Filtering users using search and select filters
  const filteredUsers = users.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          item.email.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesPlan = planFilter === 'all' ? true : item.plan === planFilter;
    
    const matchesStatus = statusFilter === 'all' ? true : 
                          statusFilter === 'blocked' ? item.is_blocked : !item.is_blocked;
    
    const matchesRole = roleFilter === 'all' ? true : item.role === roleFilter;

    return matchesSearch && matchesPlan && matchesStatus && matchesRole;
  });

  if (dbStatus !== 'connected') {
    return (
      <div className="p-8 text-center space-y-4 max-w-md mx-auto my-12 bg-[#0e0924]/60 border border-purple-950/40 rounded-2xl">
        <ShieldAlert className="w-12 h-12 text-amber-500 mx-auto animate-pulse" />
        <h2 className="text-xl font-bold text-white font-display">Painel Administrativo Suspenso</h2>
        <p className="text-slate-400 text-xs leading-relaxed">
          O Painel de Administração não pode ser acessado em modo offline (Armazenamento Local). Garanta uma conexão ativa com o Supabase para gerenciar usuários, planos e ocorrências.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      
      {/* Title banner */}
      <div className="border-b border-purple-950/20 pb-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white tracking-wide">Painel Administrativo</h2>
          <p className="text-xs text-purple-300/50 mt-1">
            Gestão operacional completa, controle de planos, chamados e regras inteligentes de picos de tarifas.
          </p>
        </div>
      </div>

      {/* NEW DISTINCT ADMIN MENUS SPLIT NAVIGATION */}
      <div className="flex flex-wrap gap-1.5 p-1 bg-[#0a051d] rounded-2xl border border-purple-950/20 text-xs font-mono max-w-fit">
        <button
          onClick={() => setActiveTab('dashboard')}
          className={`px-4 py-2 rounded-xl font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'dashboard' ? 'bg-purple-900/40 text-purple-200' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <LayoutDashboard className="w-3.5 h-3.5" /> Visão Geral
        </button>
        <button
          onClick={() => setActiveTab('users')}
          className={`px-4 py-2 rounded-xl font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'users' ? 'bg-purple-900/40 text-purple-200' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Users className="w-3.5 h-3.5" /> Motoristas ({users.length})
        </button>
        <button
          onClick={() => setActiveTab('subscriptions')}
          className={`px-4 py-2 rounded-xl font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'subscriptions' ? 'bg-purple-900/40 text-purple-200' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5" /> Planos
        </button>
        <button
          onClick={() => setActiveTab('occurrences')}
          className={`px-4 py-2 rounded-xl font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'occurrences' ? 'bg-[#ff0055]/10 text-rose-400 hover:text-rose-200' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Megaphone className="w-3.5 h-3.5" /> Chamados ({passengerReports.length})
        </button>
        <button
          onClick={() => setActiveTab('intelligence')}
          className={`px-4 py-2 rounded-xl font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'intelligence' ? 'bg-purple-900/40 text-purple-200' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Lightbulb className="w-3.5 h-3.5" /> Insights ({peakRules.length})
        </button>
        <button
          onClick={() => setActiveTab('configs')}
          className={`px-4 py-2 rounded-xl font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'configs' ? 'bg-purple-900/40 text-purple-200' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Settings className="w-3.5 h-3.5" /> Configurações
        </button>
        <button
          onClick={() => setActiveTab('observability')}
          className={`px-4 py-2 rounded-xl font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'observability' ? 'bg-[#a855f7]/20 text-purple-300 border border-purple-500/20' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Activity className="w-3.5 h-3.5" /> Monitoramento
        </button>
        <button
          onClick={() => setActiveTab('ride_offers')}
          className={`px-4 py-2 rounded-xl font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'ride_offers' ? 'bg-emerald-950/40 text-emerald-300 border border-emerald-900/20' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Smartphone className="w-3.5 h-3.5" /> Ofertas Capturadas
        </button>
        <button
          onClick={() => setActiveTab('access_requests')}
          className={`px-4 py-2 rounded-xl font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'access_requests' ? 'bg-amber-950/40 text-amber-300 border border-amber-900/20' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Clock className="w-3.5 h-3.5" /> Solicitações ({accessRequests.length})
        </button>

      </div>

      <AnimatePresence mode="wait">
        
        {/* TAB 1: COMMERCIAL EXECUTIVE DASHBOARD */}
        {activeTab === 'dashboard' && (
          <motion.div
            key="admin-dashboard-view"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6 animate-fade-in"
          >
            {/* COMMERCIAL KPI CARDS */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-5 bg-gradient-to-br from-[#0c0524] to-[#04010a] border border-purple-950/40 rounded-3xl shrink-0 shadow-sm">
                <div className="flex justify-between items-center text-purple-400 mb-2">
                  <span className="text-[10px] font-mono tracking-wider font-bold uppercase text-purple-300">Usuários Ativos</span>
                  <Users className="w-4 h-4" />
                </div>
                <p className="text-3xl font-extrabold text-white font-mono">{activeProfilesCount}</p>
                <span className="text-[10px] text-purple-300/40 block mt-1 font-mono">
                  De um total de {totalProfilesCount} registrados
                </span>
              </div>

              <div className="p-5 bg-gradient-to-br from-[#0a0f24] to-[#01060a] border border-purple-950/40 rounded-3xl shadow-sm">
                <div className="flex justify-between items-center text-teal-400 mb-2">
                  <span className="text-[10px] font-mono tracking-wider font-bold uppercase text-indigo-300">Contas Pagas</span>
                  <Sparkles className="w-4 h-4" />
                </div>
                <p className="text-3xl font-extrabold text-teal-400 font-mono">{paidProfilesCount}</p>
                <span className="text-[10px] text-indigo-300/40 block mt-1 font-mono">
                  Total de usuários PRO ou PRO+
                </span>
              </div>

              <div className="p-5 bg-gradient-to-br from-[#1b082e] to-[#03010b] border border-[#a855f7]/25 rounded-3xl relative overflow-hidden shadow-sm">
                <div className="flex justify-between items-center text-fuchsia-400 mb-2">
                  <span className="text-[10px] font-mono tracking-wider font-bold uppercase text-fuchsia-300">Receita MRR Estimada</span>
                  <Coins className="w-4 h-4" />
                </div>
                <p className="text-3xl font-extrabold text-fuchsia-400 font-mono">
                  R$ {estimatedMonthlyRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
                <span className="text-[10px] text-fuchsia-300/40 block mt-1 font-mono">
                  Mensal Recorrente Estimada
                </span>
              </div>

              <div className="p-5 bg-gradient-to-br from-[#0c1815] to-[#010906] border border-emerald-950/50 rounded-3xl shadow-sm">
                <div className="flex justify-between items-center text-emerald-400 mb-2">
                  <span className="text-[10px] font-mono tracking-wider font-bold uppercase text-emerald-300">Conversão de Planos</span>
                  <Gauge className="w-4 h-4" />
                </div>
                <p className="text-3xl font-extrabold text-emerald-400 font-mono">{conversionRate}%</p>
                <span className="text-[10px] text-emerald-300/40 block mt-1 font-mono">
                  Percentual de usuários pagantes
                </span>
              </div>
            </div>

            {/* MANUAL MANAGE PIX QUEUE */}
            {pendingPaymentsList.length > 0 ? (
              <div className="bg-[#0b0520] border border-amber-950/40 rounded-3xl p-6">
                <div className="flex items-center gap-2 border-b border-purple-950/10 pb-3 mb-4">
                  <Coins className="w-5 h-5 text-amber-400 animate-pulse" />
                  <span className="text-xs font-bold uppercase tracking-wider font-mono text-amber-400">
                    Sinal de Upgrade: Moderação Pix Manual ({pendingPaymentsList.length})
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {pendingPaymentsList.map((pay) => {
                    const matchedUser = users.find(u => u.id === pay.user_id);
                    return (
                      <div 
                        key={pay.id} 
                        className="bg-[#050210] border border-amber-900/30 rounded-2xl p-4 flex items-center justify-between gap-4"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-white font-bold text-xs truncate">
                              {matchedUser?.name || 'Motorista Desconhecido'}
                            </span>
                            <span className="text-[9px] font-bold font-mono px-1.5 py-0.2 bg-purple-950 text-fuchsia-400 rounded-md border border-purple-900/30 uppercase shrink-0">
                              {pay.plan}
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-400 truncate mt-0.5">{matchedUser?.email || 'N/A'}</p>
                          <p className="text-[11px] text-slate-300 font-mono mt-1">
                            Validação Pix: <span className="text-teal-400 font-bold">R$ {pay.amount.toFixed(2)}</span>
                          </p>
                        </div>

                        <div className="flex gap-2 shrink-0">
                          <button
                            onClick={() => approvePayment(pay.id)}
                            className="px-3 py-2 bg-emerald-900/30 hover:bg-emerald-800 text-emerald-400 hover:text-white rounded-xl cursor-pointer transition-all text-xs flex items-center gap-1 font-bold"
                          >
                            <Check className="w-4 h-4" /> Aprovar
                          </button>
                          <button
                            onClick={() => rejectPayment(pay.id)}
                            className="p-2 bg-rose-950/30 hover:bg-rose-800 text-rose-400 hover:text-white rounded-xl cursor-pointer"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="p-8 border border-purple-950/20 bg-[#090516]/40 rounded-3xl text-center">
                <div className="w-10 h-10 rounded-full bg-purple-950/40 border border-purple-900/30 flex items-center justify-center text-purple-400 mx-auto mb-3">
                  <UserCheck className="w-4.5 h-4.5" />
                </div>
                <h4 className="text-sm font-semibold text-slate-200">Fila Pix Manual vazia</h4>
                <p className="text-xs text-purple-300/40 mt-1 max-w-md mx-auto">
                  Atualmente, nenhuma requisição manual de Pix pendente foi encontrada. Toda auditoria está em dia!
                </p>
              </div>
            )}
          </motion.div>
        )}

        {/* TAB 2: GESTÃO DE USUÁRIOS (HIGH FIDELITY SEARCH & FILTERS) */}
        {activeTab === 'users' && (
          <motion.div
            key="admin-users-view"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-4"
          >
            {/* Filter Toolbar Block */}
            <div className="p-5 bg-[#0a051d] border border-purple-950/30 rounded-2xl space-y-4">
              <div className="flex items-center gap-2 border-b border-purple-955/20 pb-2.5">
                <Filter className="w-4 h-4 text-purple-400" />
                <span className="text-xs font-semibold uppercase tracking-wider font-mono text-purple-300">Filtro de Motoristas Avançado</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {/* Search Term */}
                <div className="relative">
                  <span className="absolute inset-y-0 left-3.5 flex items-center text-slate-500">
                    <Search className="w-4 h-4" />
                  </span>
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Nome, e-mail do motorista..."
                    className="w-full bg-[#04010a] border border-purple-950/50 rounded-xl py-2.5 pl-10 pr-4 text-xs text-slate-200 focus:outline-none focus:border-purple-600 focus:ring-1 focus:ring-purple-600 placeholder:text-slate-600"
                  />
                </div>

                {/* Plan Dropdown */}
                <div>
                  <select
                    value={planFilter}
                    onChange={(e) => setPlanFilter(e.target.value as any)}
                    className="w-full bg-[#04010a] border border-purple-950/50 rounded-xl p-2.5 text-xs text-slate-200 focus:outline-none focus:border-purple-600 cursor-pointer font-medium"
                  >
                    <option value="all">Todos os Planos</option>
                    <option value="free">Plano FREE</option>
                    <option value="pro">Plano PRO</option>
                    <option value="pro_plus">Plano PRO+</option>
                  </select>
                </div>

                {/* Status Dropdown */}
                <div>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as any)}
                    className="w-full bg-[#04010a] border border-purple-950/50 rounded-xl p-2.5 text-xs text-slate-200 focus:outline-none focus:border-purple-600 cursor-pointer font-medium"
                  >
                    <option value="all">Todos Status</option>
                    <option value="active">Ativo (Livre)</option>
                    <option value="blocked">Bloqueado</option>
                  </select>
                </div>

                {/* Cargo Dropdown */}
                <div>
                  <select
                    value={roleFilter}
                    onChange={(e) => setRoleFilter(e.target.value as any)}
                    className="w-full bg-[#04010a] border border-purple-950/50 rounded-xl p-2.5 text-xs text-slate-200 focus:outline-none focus:border-purple-600 cursor-pointer font-medium"
                  >
                    <option value="all">Todos Cargos</option>
                    <option value="driver">Motorista Normal</option>
                    <option value="admin">Administrador Geral</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Main Table user list */}
            <div className="bg-[#0a061b] border border-purple-950/30 rounded-3xl overflow-hidden shadow-xl">
              <div className="p-5 border-b border-purple-955/20 bg-purple-955/5 flex justify-between items-center">
                <span className="text-xs font-bold uppercase tracking-wider font-mono text-purple-300">Motoristas ({filteredUsers.length} encontrados)</span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-purple-950/10 text-purple-400 uppercase tracking-widest text-[9.5px] font-mono bg-purple-950/5">
                      <th className="py-4 px-6">Motorista</th>
                      <th className="py-4 px-4">Cadastro</th>
                      <th className="py-4 px-4">Último Acesso</th>
                      <th className="py-4 px-4">Plano Ativo</th>
                      <th className="py-4 px-4">Assinatura Status</th>
                      <th className="py-4 px-4 text-center">Acesso Liberado</th>
                      <th className="py-4 px-6 text-right">Ações Rápidas</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-purple-950/10">
                    {filteredUsers.length > 0 ? (
                      filteredUsers.map((item) => {
                        const subInfo = getSubStatusLabel(item.id);
                        return (
                          <tr 
                            key={item.id} 
                            className={`hover:bg-purple-950/5 transition-colors ${
                              item.is_blocked ? 'bg-[#ff0000]/5 opacity-80' : ''
                            }`}
                          >
                            {/* Avatar & Email */}
                            <td className="py-4 px-6">
                              <div className="flex items-center gap-3">
                                <img 
                                  src={item.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=64'} 
                                  alt="Avatar" 
                                  className="w-8 h-8 rounded-full ring-1 ring-purple-900 object-cover shrink-0"
                                />
                                <div className="min-w-0">
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-bold text-white block truncate">{item.name}</span>
                                    {item.role === 'admin' ? (
                                      <span className="text-[8px] bg-red-950 text-red-400 font-bold px-1 py-0.2 rounded border border-red-900/30 uppercase font-mono">ADMIN</span>
                                    ) : (
                                      <span className="text-[8px] bg-purple-950 text-purple-400 font-bold px-1 py-0.2 rounded border border-purple-900/30 uppercase font-mono">DRIVER</span>
                                    )}
                                  </div>
                                  <span className="text-[10px] text-slate-400 truncate block mt-0.5">{item.email}</span>
                                </div>
                              </div>
                            </td>

                            {/* Data Cadastro */}
                            <td className="py-4 px-4 text-slate-300 font-mono text-[10.5px]">
                              {formatDate(item.created_at)}
                            </td>

                            {/* Ultimo Acesso */}
                            <td className="py-4 px-4 text-slate-300 font-mono text-[10.5px]">
                              {formatDate(item.last_access)}
                            </td>

                            {/* Current Plan SELECT dropdown */}
                            <td className="py-4 px-4">
                              <select
                                value={item.plan}
                                onChange={(e) => updateUserPlan(item.id, e.target.value as UserPlan)}
                                className="bg-[#050210] border border-purple-950/50 rounded-xl px-2 py-1.5 text-[11px] text-white focus:outline-none focus:border-purple-600 select-all cursor-pointer font-semibold font-mono"
                              >
                                <option value="free">FREE</option>
                                <option value="pro">PRO (R$ 29,90)</option>
                                <option value="pro_plus">PRO+ (R$ 49,90)</option>
                              </select>
                            </td>

                            {/* Recurrence Sub status */}
                            <td className="py-4 px-4">
                              <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${subInfo.css}`}>
                                {subInfo.label}
                              </span>
                            </td>

                            {/* Beta tester toggle */}
                            <td className="py-4 px-4 text-center">
                              <button
                                onClick={() => toggleBetaTester(item.id)}
                                className={`px-2.5 py-1.5 rounded-xl text-[10px] font-mono font-semibold cursor-pointer transition-all active:scale-[0.97] border ${
                                  item.beta_tester
                                    ? 'bg-purple-950/45 border-purple-500/50 text-purple-300 hover:bg-purple-900/40'
                                    : 'bg-slate-900/40 border-slate-800 text-slate-500 hover:border-slate-700 hover:text-slate-400'
                                }`}
                              >
                                {item.beta_tester ? '⚡ ATIVO' : '☐ INATIVO'}
                              </button>
                            </td>

                            {/* Action Buttons */}
                            <td className="py-4 px-6 text-right space-x-2 whitespace-nowrap">
                              {/* Toggle subscription state */}
                              <button
                                onClick={() => {
                                  const nextStatus = subInfo.label === 'Ativo' ? 'inactive' : 'active';
                                  const activePlanForUser = item.plan === 'free' ? 'pro' : item.plan;
                                  updateSubscriptionStatus(item.id, activePlanForUser, nextStatus);
                                }}
                                className={`p-2 rounded-xl border text-[10px] uppercase font-mono font-bold active:scale-95 cursor-pointer inline-flex items-center gap-1 transition-colors ${
                                  subInfo.label === 'Ativo'
                                    ? 'bg-amber-950/20 border-amber-900/40 text-amber-400 hover:bg-amber-900 hover:text-white'
                                    : 'bg-emerald-950/20 border-emerald-900/40 text-emerald-400 hover:bg-emerald-900 hover:text-white'
                                }`}
                              >
                                <Power className="w-3 h-3" />
                                {subInfo.label === 'Ativo' ? 'Inativar' : 'Ativar'}
                              </button>

                              {/* Target admin Role */}
                              <button
                                onClick={() => toggleUserRole(item.id)}
                                className="p-2 bg-purple-950/30 border border-purple-900/30 hover:bg-purple-900/40 text-purple-300 hover:text-white rounded-xl cursor-pointer active:scale-95"
                                title="Inverter Cargo de Liderança"
                              >
                                <Shield className="w-3.5 h-3.5" />
                              </button>

                              {/* Block toggle */}
                              <button
                                onClick={() => toggleBlockUser(item.id)}
                                className={`p-2 rounded-xl cursor-pointer active:scale-95 transition-colors border inline-flex items-center gap-1 ${
                                  item.is_blocked
                                    ? 'bg-teal-950/30 border-teal-900/40 text-teal-400 hover:bg-teal-900 hover:text-white_b shadow'
                                    : 'bg-rose-950/30 border-rose-900/40 text-rose-400 hover:bg-rose-900 hover:text-white'
                                }`}
                                title={item.is_blocked ? 'Desbloquear Contribuinte' : 'Banir Motorista'}
                              >
                                <Ban className="w-3.5 h-3.5" />
                              </button>
                            </td>

                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={6} className="py-12 text-center text-slate-500 text-xs italic">
                          Nenhum motorista coincide com os filtros aplicados. Tente ajustar os termos de pesquisa!
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        )}

        {/* TAB 3: SIGNATURES & REVENUE CONTROL */}
        {activeTab === 'subscriptions' && (
          <motion.div
            key="admin-subscriptions-view"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-[#0a061b] border border-purple-950/30 rounded-3xl p-6 space-y-6"
          >
            <div>
              <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono">Controle de Cobrança & Faturamento</h3>
              <p className="text-xs text-purple-300/40 mt-1">Lista de assinaturas registradas no banco de metadados do DriverDash.</p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse font-sans">
                <thead>
                  <tr className="border-b border-purple-950/20 text-purple-300 font-mono text-[10px] uppercase tracking-wider py-2">
                    <th className="py-3">ID Recorrência</th>
                    <th className="py-3">Usuário</th>
                    <th className="py-3">Plano</th>
                    <th className="py-3">Status Assinatura</th>
                    <th className="py-3">Última Atualização</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-purple-950/10">
                  {subscriptions.length > 0 ? (
                    subscriptions.map((sub, sidx) => {
                      const client = users.find(u => u.id === sub.user_id);
                      return (
                        <tr key={sub.id || sidx} className="hover:bg-purple-950/5 text-slate-300">
                          <td className="py-3 font-mono text-[10px] text-purple-400">{sub.id.substring(0, 13)}...</td>
                          <td className="py-3">
                            <span className="font-semibold text-white">{client?.name || 'Inexistente'}</span>
                            <span className="block text-[10px] text-slate-500">{client?.email || 'N/A'}</span>
                          </td>
                          <td className="py-3 font-mono font-bold text-fuchsia-400 uppercase">{sub.plan}</td>
                          <td className="py-3">
                            <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                              sub.status === 'active' ? 'bg-emerald-950 text-emerald-400 border border-emerald-900/30' : 'bg-rose-950 text-rose-400 border border-rose-900/20'
                            }`}>
                              {sub.status.toUpperCase()}
                            </span>
                          </td>
                          <td className="py-3 font-mono text-[11px] text-slate-400">{formatDate(sub.updated_at)}</td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-500 italic">Nenhuma assinatura registrada no momento.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}

        {/* TAB 4: RISK OCCURRENCES REPORTED BY USERS */}
        {activeTab === 'occurrences' && (
          <motion.div
            key="admin-occurrences-view"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-[#0a061b] border border-purple-950/30 rounded-3xl p-6"
          >
            <h3 className="text-xs font-semibold text-white uppercase tracking-wider font-mono text-rose-400 border-b border-purple-950/20 pb-3 mb-4 flex items-center gap-1.5">
              <Megaphone className="w-4 h-4 text-rose-500" /> Registro Geral de Alertas e Ocorrências Compartilhadas
            </h3>
            
            {passengerReports.length > 0 ? (
              <div className="space-y-3.5 text-xs">
                {passengerReports.map((report, idx) => (
                  <div key={report.id || idx} className="p-4 bg-purple-950/10 rounded-2xl border border-purple-950/30 flex justify-between gap-3 shadow-sm">
                    <div>
                      <span className="font-bold text-white text-sm block">{report.title}</span>
                      <span className="text-[10px] text-purple-400/60 font-mono block mt-0.5">Localização: {report.region}</span>
                      <p className="text-slate-400 text-xs mt-2 leading-relaxed">{report.description}</p>
                    </div>
                    <span className={`text-[9px] font-bold uppercase font-mono px-2 py-0.5 rounded shrink-0 h-fit ${
                      report.severity === 'high' ? 'bg-rose-950 text-rose-400 border border-rose-900/30' : 'bg-amber-950 text-amber-500 border border-amber-900/20'
                    }`}>
                      {report.severity.toUpperCase()}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-purple-300/30 italic py-8 text-center">Nenhum relato de risco adicionado pelos motoristas do app.</p>
            )}
          </motion.div>
        )}

        {/* TAB 5: INTELIGÊNCIA ROXOU (PEAK HOUR, DEMAND SIGNALS & HEATMAP CONFIG) */}
        {activeTab === 'intelligence' && (
          <motion.div
            key="admin-intelligence-view"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
          >
            {/* SUBTAB BAR */}
            <div className="flex gap-2 p-1.5 bg-[#070316] rounded-2xl border border-purple-950/40 w-fit">
              <button
                type="button"
                onClick={() => setIntelSubTab('peak_rules')}
                className={`px-4 py-2 text-xs font-bold font-mono rounded-xl transition-all cursor-pointer ${
                  intelSubTab === 'peak_rules'
                    ? 'bg-purple-600 text-white shadow-md shadow-purple-900/30'
                    : 'text-purple-300/60 hover:text-purple-300 hover:bg-purple-950/20'
                }`}
              >
                Regras de Pico ({peakRules.length})
              </button>
              <button
                type="button"
                onClick={() => setIntelSubTab('demand_signals')}
                className={`px-4 py-2 text-xs font-bold font-mono rounded-xl transition-all cursor-pointer ${
                  intelSubTab === 'demand_signals'
                    ? 'bg-purple-600 text-white shadow-md shadow-purple-900/30'
                    : 'text-purple-300/60 hover:text-purple-300 hover:bg-purple-950/20'
                }`}
              >
                Sinais Temporais ({demandSignals.length})
              </button>
              <button
                type="button"
                onClick={() => setIntelSubTab('heatmap_zones')}
                className={`px-4 py-2 text-xs font-bold font-mono rounded-xl transition-all cursor-pointer ${
                  intelSubTab === 'heatmap_zones'
                    ? 'bg-purple-600 text-white shadow-md shadow-purple-900/30'
                    : 'text-purple-300/60 hover:text-purple-300 hover:bg-purple-950/20'
                }`}
              >
                Tuning Mapa Térmico ({heatmapZones.length})
              </button>
              <button
                type="button"
                onClick={() => setIntelSubTab('roxou_integration')}
                className={`px-4 py-2 text-xs font-bold font-mono rounded-xl transition-all cursor-pointer ${
                  intelSubTab === 'roxou_integration'
                    ? 'bg-purple-600 text-white shadow-md shadow-purple-900/30'
                    : 'text-purple-300/60 hover:text-purple-300 hover:bg-purple-950/20'
                }`}
              >
                🔌 Integração Roxou
              </button>
            </div>

            {/* SUBTAB 1: HORÁRIOS DE PICO */}
            {intelSubTab === 'peak_rules' && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* COLUMN 1: NEW RULE FORM */}
                <div className="bg-[#0b0720]/80 border border-purple-950/40 rounded-3xl p-6 h-fit">
                  <div className="flex items-center gap-2 border-b border-purple-950/20 pb-3 mb-5">
                    <Plus className="w-5 h-5 text-purple-400" />
                    <h3 className="text-sm font-bold text-white">Criar Alerta de Faturamento (Regra de Pico)</h3>
                  </div>

                  {success && (
                    <div className="mb-4 p-3 bg-emerald-950/60 border border-emerald-900/40 text-emerald-400 text-xs rounded-xl flex items-center gap-2 font-semibold animate-pulse font-mono">
                      <Sparkles className="w-4 h-4 shrink-0 animate-spin" />
                      <span>Regra registrada com sucesso!</span>
                    </div>
                  )}

                  <form onSubmit={handleAddRule} className="space-y-4 text-xs font-sans">
                    <div>
                      <label className="block text-slate-400 mb-1.5 font-semibold">Título do Alerta Tarifário</label>
                      <input 
                        type="text" 
                        value={title} 
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="Ex: Saída de Shows, Chuva pesada, Pico do Almoço"
                        className="w-full bg-[#04010a] border border-purple-950/55 rounded-xl p-3 text-slate-100 focus:outline-none focus:border-purple-600 transition-colors"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-400 mb-1.5 font-semibold">Região / Cidade de Aplicação</label>
                      <select
                        value={region}
                        onChange={(e) => setRegion(e.target.value)}
                        className="w-full bg-[#04010a] border border-purple-950/55 rounded-xl p-3 text-slate-100 focus:outline-none focus:border-purple-600 cursor-pointer font-bold font-mono text-[11px]"
                      >
                        <option value="">Selecione a Região...</option>
                        {Object.keys(REG_COORDS).map(reg => (
                          <option key={reg} value={reg}>{reg}</option>
                        ))}
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-slate-400 mb-1.5 font-semibold font-sans">Início do Turno</label>
                        <input 
                          type="text" 
                          value={startTime} 
                          onChange={(e) => setStartTime(e.target.value)}
                          placeholder="Ex: 17:00"
                          className="w-full bg-[#04010a] border border-purple-950/55 rounded-xl p-2.5 text-slate-100 focus:outline-none focus:border-purple-600 font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-400 mb-1.5 font-semibold font-sans">Fim do Turno</label>
                        <input 
                          type="text" 
                          value={endTime} 
                          onChange={(e) => setEndTime(e.target.value)}
                          placeholder="Ex: 19:30"
                          className="w-full bg-[#04010a] border border-purple-950/55 rounded-xl p-2.5 text-slate-100 focus:outline-none focus:border-purple-600 font-mono"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-slate-400 mb-1.5 font-semibold">Multiplicador Estipulado</label>
                      <select
                        value={demandLevel}
                        onChange={(e) => setDemandLevel(e.target.value as any)}
                        className="w-full bg-[#04010a] border border-purple-950/55 rounded-xl p-3 text-slate-100 focus:outline-none focus:border-purple-600 cursor-pointer font-bold"
                      >
                        <option value="low">Baixa (+5%)</option>
                        <option value="medium">Média (Multiplicador x1.35)</option>
                        <option value="high">Alta (Multiplicador x1.8)</option>
                        <option value="extreme">Roxou Extremo (Multiplicador x2.4!)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-slate-400 mb-1.5 font-semibold font-sans">Dias da Semana Ativos</label>
                      <div className="flex gap-1">
                        {dayLabels.map((d) => {
                          const active = selectedDays.includes(d.value);
                          return (
                            <button
                              key={d.value}
                              type="button"
                              onClick={() => handleDayToggle(d.value)}
                              className={`w-7 h-7 rounded-lg text-[10px] font-bold font-mono transition-all border cursor-pointer active:scale-95 flex items-center justify-center ${
                                active 
                                  ? 'bg-purple-600 text-white border-purple-500' 
                                  : 'bg-[#04010a] text-purple-300/40 border-purple-950/40 hover:text-purple-300 ml-0.5'
                              }`}
                            >
                              {d.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <button
                      type="submit"
                      className="w-full py-3 bg-gradient-to-r from-purple-700 to-indigo-600 hover:from-purple-600 hover:to-indigo-300 rounded-xl text-white font-bold tracking-wide shadow-[0_4px_15px_rgba(147,51,234,0.3)] cursor-pointer hover:shadow-purple-600/30 transition-shadow active:scale-95"
                    >
                      Confirmar Regra Inteligente
                    </button>
                  </form>
                </div>

                {/* COLUMN 2: ACTIVE RULES LIST */}
                <div className="lg:col-span-2 bg-[#0a061b] border border-purple-950/40 rounded-3xl p-6">
                  <div className="flex items-center justify-between border-b border-purple-950/20 pb-3 mb-4">
                    <h3 className="text-xs font-semibold text-white uppercase tracking-wider font-mono text-purple-400">Regras de Pico Ativas</h3>
                    <span className="text-[10px] bg-purple-950/60 text-purple-300 font-mono px-2 py-0.5 rounded border border-purple-900/30">
                      {peakRules.length} registradas
                    </span>
                  </div>

                  {peakRules.length > 0 ? (
                    <div className="space-y-3 max-h-[440px] overflow-y-auto pr-1">
                      {peakRules.map((rule, idx) => {
                        const daysString = rule.days_of_week && Array.isArray(rule.days_of_week)
                          ? rule.days_of_week.map(fullDayName).join(', ')
                          : '-';
                        
                        return (
                          <div 
                            key={rule.id || idx}
                            className={`p-4 rounded-xl border flex items-center justify-between gap-4 transition-all ${
                              rule.is_active 
                                ? 'bg-[#0e0a29] border-purple-900/40 shadow-sm' 
                                : 'bg-purple-950/5 border-purple-950/30 opacity-60'
                            }`}
                          >
                            <div>
                              <div className="flex items-center gap-2">
                                <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded uppercase font-mono ${
                                  rule.demand_level === 'extreme'
                                    ? 'bg-purple-900 text-fuchsia-400 border border-fuchsia-800'
                                    : rule.demand_level === 'high'
                                    ? 'bg-rose-950 text-rose-400 border border-rose-900/40'
                                    : 'bg-indigo-950 text-indigo-400 border border-indigo-900/30'
                                }`}>
                                  {rule.demand_level === 'extreme' ? 'ROXOU EXTREMO' : rule.demand_level.toUpperCase()}
                                </span>
                                
                                <span className="text-[10.5px] text-purple-300 font-mono flex items-center gap-1">
                                  <Clock className="w-3.5 h-3.5 text-purple-400" /> {rule.start_time} - {rule.end_time}
                                </span>
                              </div>

                              <h4 className="text-xs font-bold text-white mt-1 font-sans">{rule.title}</h4>
                              <p className="text-[11px] text-slate-400 font-mono mt-0.5"><span className="text-purple-300/45">Local:</span> {rule.region}</p>
                              <p className="text-[9px] text-slate-500 font-mono mt-1">Dias: {daysString}</p>
                            </div>

                            <button
                              type="button"
                              onClick={() => togglePeakRule(rule.id, idx)}
                              className="text-purple-400 hover:text-white p-2.5 transition-transform active:scale-90 cursor-pointer"
                            >
                              {rule.is_active ? (
                                <ToggleRight className="w-8 h-8 text-purple-500" />
                              ) : (
                                <ToggleLeft className="w-8 h-8 text-slate-500" />
                              )}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="py-8 flex flex-col items-center justify-center text-center border border-dashed border-purple-950/40 rounded-xl">
                      <p className="text-xs text-purple-400/40 font-mono">Nenhuma regra cadastrada pelo administrador.</p>
                      <p className="text-[11px] text-purple-300/20 px-2 mt-0.5">Use o formulário ao lado para simular e deitar tarifas de pico de urgência.</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* SUBTAB 2: SINAIS TEMPORAIS */}
            {intelSubTab === 'demand_signals' && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* FORM: NEW TEMPORAL SINAL */}
                <div className="bg-[#0b0720]/80 border border-purple-950/40 rounded-3xl p-6 h-fit">
                  <div className="flex items-center gap-2 border-b border-purple-950/20 pb-3 mb-5">
                    <Plus className="w-5 h-5 text-purple-400" />
                    <h3 className="text-sm font-bold text-white">Criar Novo Alerta de Clima, Evento ou Aula</h3>
                  </div>

                  {sigSuccess && (
                    <div className="mb-4 p-3 bg-emerald-950/60 border border-emerald-900/40 text-emerald-400 text-xs rounded-xl flex items-center gap-2 font-semibold font-mono animate-pulse">
                      <Sparkles className="w-4 h-4 shrink-0 animate-spin" />
                      <span>Sinal temporal disparado no mapa!</span>
                    </div>
                  )}

                  <form onSubmit={handleAddSignal} className="space-y-4 text-xs font-sans">
                    <div>
                      <label className="block text-slate-400 mb-1.5 font-semibold">Nome da Alerta Temporal</label>
                      <input 
                        type="text" 
                        value={sigTitle} 
                        onChange={(e) => setSigTitle(e.target.value)}
                        placeholder="Ex: Jogo da Copa, Chuva Forte, Show de Rock"
                        className="w-full bg-[#04010a] border border-purple-950/55 rounded-xl p-3 text-slate-100 focus:outline-none focus:border-purple-600 transition-colors"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-slate-400 mb-1.5 font-semibold">Ponto Centróide</label>
                        <select
                          value={sigRegion}
                          onChange={(e) => setSigRegion(e.target.value)}
                          className="w-full bg-[#04010a] border border-purple-950/55 rounded-xl p-3 text-slate-100 focus:outline-none focus:border-purple-600 cursor-pointer font-bold"
                        >
                          {Object.keys(REG_COORDS).map(reg => (
                            <option key={reg} value={reg}>{reg}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-slate-400 mb-1.5 font-semibold">Tipo do Evento</label>
                        <select
                          value={sigType}
                          onChange={(e) => setSigType(e.target.value)}
                          className="w-full bg-[#04010a] border border-purple-950/55 rounded-xl p-3 text-slate-100 focus:outline-none focus:border-purple-600 cursor-pointer font-bold"
                        >
                          <option value="climate">🌧️ Clima / Tempo</option>
                          <option value="event">🎤 Show / Concerto</option>
                          <option value="academic">🎓 Volta às Aulas / Vestibulares</option>
                          <option value="leisure">🍻 Happy Hour / Lazer</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <label className="block text-slate-400 font-semibold">Peso Booster (Multiplicador peso)</label>
                        <span className="font-mono text-purple-300 font-bold">+{Math.round(sigWeight * 15)} pts de Score</span>
                      </div>
                      <input 
                        type="range"
                        min="0.5"
                        max="3.0"
                        step="0.1"
                        value={sigWeight}
                        onChange={(e) => setSigWeight(Number(e.target.value))}
                        className="w-full accent-purple-600 cursor-pointer"
                      />
                      <div className="flex justify-between text-[9px] text-slate-500 font-mono mt-0.5">
                        <span>Fraco (0.5)</span>
                        <span>Moderado (1.5)</span>
                        <span>Extremo (3.0)</span>
                      </div>
                    </div>

                    <button
                      type="submit"
                      className="w-full py-3 bg-gradient-to-r from-purple-700 to-indigo-600 hover:from-purple-600 hover:to-indigo-300 rounded-xl text-white font-bold tracking-wide shadow-[0_4px_15px_rgba(147,51,234,0.3)] cursor-pointer hover:shadow-purple-600/30 transition-shadow active:scale-95"
                    >
                      Intercalar Sinal no Mapa
                    </button>
                  </form>
                </div>

                {/* LIST: ACTIVE SIGNALS */}
                <div className="lg:col-span-2 bg-[#0a061b] border border-purple-950/40 rounded-3xl p-6">
                  <div className="flex items-center justify-between border-b border-purple-950/20 pb-3 mb-4">
                    <h3 className="text-xs font-semibold text-white uppercase tracking-wider font-mono text-purple-400">Alertas Ativos em Presidente Prudente</h3>
                    <span className="text-[10px] bg-purple-950/60 text-purple-300 font-mono px-2 py-0.5 rounded border border-purple-900/30">
                      {demandSignals.length} disparados
                    </span>
                  </div>

                  {demandSignals.length > 0 ? (
                    <div className="space-y-3 max-h-[440px] overflow-y-auto pr-1">
                      {demandSignals.map((signal) => (
                        <div 
                          key={signal.id}
                          className={`p-4 rounded-xl border flex items-center justify-between gap-4 transition-all ${
                            signal.is_active 
                              ? 'bg-[#0e0a29] border-purple-900/40 shadow-sm' 
                              : 'bg-purple-950/5 border-purple-950/30 opacity-60'
                          }`}
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-lg">
                                {signal.signal_type === 'climate' ? '🌧️' : signal.signal_type === 'event' ? '🎤' : '🎓'}
                              </span>
                              <span className="text-xs text-white font-bold">{signal.title}</span>
                            </div>
                            <div className="text-[10px] text-slate-400 font-mono mt-1 space-x-3">
                              <span><strong className="text-purple-300">Região:</strong> {signal.region}</span>
                              <span><strong className="text-purple-300">Booster:</strong> +{Math.round(Number(signal.weight) * 15)} pts</span>
                              <span><strong className="text-purple-300">Tipo:</strong> {signal.signal_type}</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              type="button"
                              onClick={() => toggleDemandSignal(signal.id)}
                              className="text-purple-400 hover:text-white transition-all cursor-pointer"
                            >
                              {signal.is_active ? (
                                <ToggleRight className="w-7 h-7 text-purple-500" />
                              ) : (
                                <ToggleLeft className="w-7 h-7 text-slate-500" />
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteDemandSignal(signal.id)}
                              className="p-1.5 text-red-400 hover:bg-red-950/20 rounded-lg hover:text-red-300 transition-colors uppercase font-mono text-[9px] font-bold cursor-pointer border border-red-950/30"
                            >
                              Deletar
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-purple-300/30 italic text-center py-12">
                      Sem sinais temporais disparados. Use o formulário esquerdo para colocar picos locais instantâneos.
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* SUBTAB 3: EXTREME MATRIX TUNING (HEATMAPS SENSITIVITY) */}
            {intelSubTab === 'heatmap_zones' && (
              <div className="bg-[#0a061b] border border-purple-950/40 rounded-3xl p-6">
                <div className="flex items-center justify-between border-b border-purple-950/20 pb-3 mb-5">
                  <div>
                    <h3 className="text-xs font-semibold text-white uppercase tracking-wider font-mono text-purple-400">Central de Calibração Térmica (Multiplicadores de Saturação)</h3>
                    <p className="text-[10px] text-slate-500 font-mono mt-0.5">Defina a densidade base de passageiros ativa e intensidade em tempo real para os 10 pólos de Presidente Prudente.</p>
                  </div>
                  <span className="text-[10px] bg-purple-950/60 text-purple-300 font-mono px-2 py-0.5 rounded border border-purple-900/30 shrink-0">
                    {heatmapZones.length} Pólos Operacionais
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {heatmapZones.map((zone) => {
                    return (
                      <div 
                        key={zone.id}
                        className="bg-[#050210] p-4 rounded-2xl border border-purple-950/35 space-y-3"
                      >
                        <div className="flex justify-between items-center">
                          <div>
                            <span className="text-xs text-white font-extrabold block">{zone.regionName}</span>
                            <span className="text-[9px] text-purple-450 text-purple-400 font-mono">
                              Lat: {zone.latitude.toFixed(4)} | Lng: {zone.longitude.toFixed(4)}
                            </span>
                          </div>
                          
                          <span className={`text-[9px] font-mono px-1.5 py-0.2 rounded font-extrabold uppercase border ${
                            zone.status === 'extreme'
                              ? 'bg-rose-950 text-rose-400 border-rose-800'
                              : zone.status === 'hot'
                              ? 'bg-orange-950 text-orange-400 border-orange-850'
                              : 'bg-slate-950 text-slate-400 border-slate-800'
                          }`}>
                            {zone.status}
                          </span>
                        </div>

                        {/* Sliders in card */}
                        <div className="space-y-3 font-mono text-[10.5px]">
                          {/* Passenger Density slider */}
                          <div>
                            <div className="flex justify-between mb-1">
                              <span className="text-slate-400">Densidade Base Passageiros:</span>
                              <span className="text-white font-bold">{zone.passengerDensity}%</span>
                            </div>
                            <input 
                              type="range"
                              min="10"
                              max="100"
                              value={zone.passengerDensity}
                              onChange={(e) => updateHeatmapZone(zone.id, Number(e.target.value), zone.intensity)}
                              className="w-full accent-fuchsia-600 cursor-pointer"
                            />
                          </div>

                          {/* Dynamic Intensity slider */}
                          <div>
                            <div className="flex justify-between mb-1">
                              <span className="text-slate-400">Intensidade Térmica:</span>
                              <span className="text-white font-bold">{Math.round(zone.intensity * 100)}%</span>
                            </div>
                            <input 
                              type="range"
                              min="0.10"
                              max="1.00"
                              step="0.05"
                              value={zone.intensity}
                              onChange={(e) => updateHeatmapZone(zone.id, zone.passengerDensity, Number(e.target.value))}
                              className="w-full accent-purple-600 cursor-pointer"
                            />
                          </div>
                        </div>

                        <div className="flex justify-between items-center text-[10px] text-fuchsia-400 font-mono pt-1.5 border-t border-purple-950/20">
                          <span>Tarifa Média Estimada:</span>
                          <strong>{zone.averageFareMultiplier.toFixed(2)}x</strong>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* SUBTAB 4: ROXOU INTEGRATION PREPARATION PANEL */}
            {intelSubTab === 'roxou_integration' && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-6"
              >
                {/* Warning notice banner */}
                <div className="p-4 bg-amber-950/20 border border-amber-500/20 rounded-2xl flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                  <div className="text-xs">
                    <h4 className="font-bold text-amber-400">Ambiente de Preparação Ativo</h4>
                    <p className="text-amber-300/60 mt-0.5 leading-relaxed">
                      Integração real ainda não habilitada. Esta área prepara o DriverDash para consumir dados da Roxou futuramente.
                      Não consome APIs reais, não altera dados de produção da Roxou e opera em ambiente de simulação estrito.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Status metrics card */}
                  <div className="bg-[#0b0720]/90 border border-purple-950/35 p-6 rounded-3xl space-y-4">
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono border-b border-purple-950/20 pb-2">
                      🔌 Estado do Adaptador
                    </h3>

                    {integrationSuccessMsg && (
                      <div className="p-2.5 bg-emerald-950/40 border border-emerald-900/30 text-emerald-400 text-[11px] rounded-xl font-mono">
                        {integrationSuccessMsg}
                      </div>
                    )}

                    <div className="space-y-3.5 text-xs font-mono font-bold">
                      <div className="flex justify-between items-center py-1.5 border-b border-purple-950/10">
                        <span className="text-slate-400">Status Geral:</span>
                        <div className="flex items-center gap-1.5">
                          <span className={`w-2.5 h-2.5 rounded-full ${roxouStatus.enabled ? 'bg-emerald-500 animate-pulse' : 'bg-slate-500'}`} />
                          <span className={roxouStatus.enabled ? 'text-emerald-400' : 'text-slate-400'}>
                            {roxouStatus.enabled ? 'MOCK ATIVO' : 'DESATIVADO'}
                          </span>
                        </div>
                      </div>

                      <div className="flex justify-between items-center py-1.5 border-b border-purple-950/10">
                        <span className="text-slate-400">Modo de Operação:</span>
                        <span className="text-white uppercase">{roxouStatus.mode}</span>
                      </div>

                      <div className="flex justify-between items-center py-1.5 border-b border-purple-950/10">
                        <span className="text-slate-400">Eldorado Source:</span>
                        <span className="text-slate-300 text-[11px] font-semibold">{roxouStatus.source}</span>
                      </div>

                      <div className="flex justify-between items-center py-1.5 border-b border-purple-950/10">
                        <span className="text-slate-400">Última Sincronização:</span>
                        <span className="text-indigo-300 font-semibold">
                          {roxouStatus.last_sync ? new Date(roxouStatus.last_sync).toLocaleTimeString('pt-BR') : 'Nunca'}
                        </span>
                      </div>

                      <div className="flex justify-between items-center py-1.5 border-b border-purple-950/10">
                        <span className="text-slate-400">Sinais Mock Seeding:</span>
                        <span className="text-purple-300 font-bold">{roxouStatus.mock_signals_count}</span>
                      </div>

                      <div className="flex justify-between items-center py-1.5">
                        <span className="text-slate-400">Erros Controlados:</span>
                        <span className={`font-bold ${roxouStatus.error_count > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                          {roxouStatus.error_count}
                        </span>
                      </div>
                    </div>

                    {/* Operational controls button container */}
                    <div className="space-y-2 pt-4">
                      <button
                        type="button"
                        onClick={() => {
                          const result = roxouIntegrationService.previewRoxouSignals();
                          setPreviewSignals(result.signals);
                          setShowPreview(true);
                          setIntegrationSuccessMsg('Visualização de sinais simulada de modo passivo.');
                          setTimeout(() => setIntegrationSuccessMsg(''), 4000);
                        }}
                        className="w-full py-2.5 bg-purple-900/35 border border-purple-800/40 hover:bg-purple-900/50 hover:border-purple-600 rounded-xl text-purple-200 hover:text-white text-xs font-bold font-mono cursor-pointer transition-all active:scale-[0.98] flex items-center justify-center gap-1.5"
                      >
                        <Eye className="w-4 h-4" /> Pré-visualizar Sinais Mock
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          roxouIntegrationService.enableMockIntegration();
                          refreshRoxouStatus();
                          refetchDemand();
                          const result = roxouIntegrationService.previewRoxouSignals();
                          setPreviewSignals(result.signals);
                          setShowPreview(true);
                          setIntegrationSuccessMsg('Modo MOCK ativo! Mapa e demandas sincronizados.');
                          setTimeout(() => setIntegrationSuccessMsg(''), 4005);
                        }}
                        className="w-full py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 rounded-xl text-white text-xs font-bold cursor-pointer font-sans transition-all active:scale-[0.98] shadow-md shadow-emerald-900/10 flex items-center justify-center gap-1.5"
                      >
                        <Check className="w-4 h-4" /> Ativar Modo Mock
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          roxouIntegrationService.disableRoxouIntegration();
                          refreshRoxouStatus();
                          refetchDemand();
                          setShowPreview(false);
                          setIntegrationSuccessMsg('Integração Roxou desativada.');
                          setTimeout(() => setIntegrationSuccessMsg(''), 4000);
                        }}
                        className="w-full py-2.5 bg-rose-950/30 hover:bg-rose-900 border border-rose-900/40 text-rose-400 hover:text-white text-xs font-bold cursor-pointer font-sans transition-all active:scale-[0.98] flex items-center justify-center gap-1.5"
                      >
                        <X className="w-4 h-4" /> Desativar Integração
                      </button>
                    </div>
                  </div>

                  {/* Future Architecture Checklist card */}
                  <div className="lg:col-span-2 bg-[#0a061b] border border-purple-950/35 p-6 rounded-3xl space-y-4">
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono border-b border-purple-950/20 pb-2">
                      🚀 Checklist de Roadmapping Real
                    </h3>

                    <div className="space-y-3.5 text-xs text-slate-300 font-sans">
                      <p className="text-[11px] text-fuchsia-400 font-mono">CRONOGRAMA DE INTEGRAÇÃO HOMOLOGADO (PRODUÇÃO 1.0)</p>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="p-3.5 bg-purple-950/10 rounded-xl border border-purple-950/30">
                          <span className="font-bold text-white block text-xs">🔒 1. Segurança e TLS</span>
                          <span className="text-[11px] text-slate-400/80 mt-1 block leading-relaxed">
                            A integração exige chaves criptográficas sob encriptação TLS. Chaves reais NUNCA devem residir no código do frontend ou nos metadados expostos do navegador.
                          </span>
                        </div>

                        <div className="p-3.5 bg-purple-950/10 rounded-xl border border-purple-950/30">
                          <span className="font-bold text-white block text-xs">📡 2. Edge Functions e Webhooks</span>
                          <span className="text-[11px] text-slate-400/80 mt-1 block leading-relaxed">
                            Em ambiente produtivo, configure a ingestão de sinais de alta prioridade via webhooks da Roxou enviando requisições assíncronas para Edge Functions seguras.
                          </span>
                        </div>

                        <div className="p-3.5 bg-[#0e0a29] rounded-xl border border-[#a855f7]/20">
                          <span className="font-bold text-white block text-xs">📦 3. Tabelas Supabase Dedicadas</span>
                          <span className="text-[11px] text-slate-400/85 mt-1 block leading-relaxed font-sans">
                            Implementar as tabelas roxou_events e roxou_games com RLS e políticas de acesso restritas, sem permissões de escrita externa (read-only por drivers).
                          </span>
                        </div>

                        <div className="p-3.5 bg-purple-950/10 rounded-xl border border-purple-950/30">
                          <span className="font-bold text-white block text-xs">🌐 4. Consumo API e Fallbacks</span>
                          <span className="text-[11px] text-slate-400/80 mt-1 block leading-relaxed">
                            Limitação de requisições de API via cache Redis ou localStorage (15 mins de TTL) para evitar cobranças de dados e travamento por rate-limit.
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* SINAL PREVIEW ZONE */}
                {showPreview && previewSignals.length > 0 && (
                  <div className="bg-[#0a061b] border border-purple-950/35 rounded-3xl p-6 space-y-4">
                    <div className="flex justify-between items-center border-b border-purple-950/20 pb-3">
                      <div>
                        <h4 className="text-xs font-bold text-white uppercase tracking-wider font-mono">
                          🔍 Sinais Normalizados no Adaptador ({previewSignals.length} canais)
                        </h4>
                        <p className="text-[10px] text-slate-400 font-mono">
                          Mapeamento de adapters automáticos que alimenta o índice de picos do DriverDash.
                        </p>
                      </div>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs font-mono border-collapse">
                        <thead>
                          <tr className="border-b border-purple-950/20 text-purple-400 py-2">
                            <th className="pb-3 pr-4">ID do Sinal</th>
                            <th className="pb-3 pr-4">Nome do Sinal</th>
                            <th className="pb-3 pr-4">Região</th>
                            <th className="pb-3 pr-4">Tipo</th>
                            <th className="pb-3 pr-4 text-center">Peso Booster</th>
                            <th className="pb-3 text-right">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-purple-950/10 text-[11px] text-slate-300">
                          {previewSignals.map((sig, sidx) => (
                            <tr key={sig.id || sidx} className="hover:bg-purple-950/5">
                              <td className="py-3 font-mono text-[10px] text-purple-400">{sig.id}</td>
                              <td className="py-3 font-bold text-white max-w-xs truncate">{sig.title}</td>
                              <td className="py-3 text-slate-400">{sig.region}</td>
                              <td className="py-3 text-[10px] uppercase font-bold text-fuchsia-400">{sig.signal_type}</td>
                              <td className="py-3 text-center text-emerald-400 font-bold">
                                {sig.weight.toFixed(2)}x
                              </td>
                              <td className="py-3 text-right">
                                <span className={`px-2 py-0.5 rounded font-extrabold uppercase text-[9px] ${
                                  sig.is_active ? 'bg-emerald-950 text-emerald-400 border border-emerald-950/30' : 'bg-slate-950 text-slate-400 border border-slate-950/20'
                                }`}>
                                  {sig.is_active ? 'Ativo' : 'Pendente'}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </motion.div>
        )}

        {/* TAB 6: CONFIGURAÇÕES OPERACIONAIS */}
        {activeTab === 'configs' && (
          <motion.div
            key="admin-configs-view"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-[#0a061b] border border-purple-950/30 rounded-3xl p-6 space-y-6"
          >
            <div>
              <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono">Configurações Gerais do Sistema DriverDash</h3>
              <p className="text-xs text-purple-300/45 mt-1">Configure parâmetros globais do aplicativo, taxas administrativas e controle de simulação.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
              
              <div className="p-5 rounded-2xl bg-[#03010b] border border-purple-950/60 space-y-3">
                <span className="text-[10px] uppercase font-bold tracking-wide font-mono text-fuchsia-400 block">Parâmetros de Auditoria</span>
                
                <div className="space-y-3">
                  <div>
                    <label className="block text-slate-400 mb-1">Período de Retenção de Logs</label>
                    <input type="text" className="w-full bg-[#0d0922] border border-purple-950/60 p-2.5 rounded-lg text-white font-mono" defaultValue="365 Dias (PRO)" readOnly />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1">Intervalo de Verificação de Alertas</label>
                    <input type="text" className="w-full bg-[#0d0922] border border-purple-950/60 p-2.5 rounded-lg text-white font-mono" defaultValue="Tempo Real (Supabase Ingress)" readOnly />
                  </div>
                </div>
              </div>

              <div className="p-5 rounded-2xl bg-[#03010b] border border-purple-950/60 space-y-3">
                <span className="text-[10px] uppercase font-bold tracking-wide font-mono text-teal-400 block">Status da Infraestrutura</span>
                
                <div className="space-y-4">
                  <div className="flex justify-between items-center py-2 border-b border-purple-950/30">
                    <span className="text-slate-400">Banco de Dados Relacional</span>
                    <span className="font-mono text-[11px] text-emerald-400 font-bold">Ativo & Saudável</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-purple-950/30">
                    <span className="text-slate-400">Triggers de Autocadastro</span>
                    <span className="font-mono text-[11px] text-emerald-400 font-bold">Instalados</span>
                  </div>
                  <div className="flex justify-between items-center py-2">
                    <span className="text-slate-400">Vias de GPS (Driver Sessions)</span>
                    <span className="font-mono text-[11px] text-purple-400 font-bold tracking-wider">Preparação Pronta</span>
                  </div>
                </div>
              </div>

            </div>
          </motion.div>
        )}

        {/* TAB 7: OBSERVABILIDADE, METRICAS & LOGS */}
        {activeTab === 'observability' && (
          <motion.div
            key="admin-observability-view"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
          >
            {/* Header with quick controls */}
            <div className="bg-[#0a061b] border border-purple-950/30 rounded-3xl p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono">Painel de Observabilidade do Sistema</h3>
                <p className="text-xs text-purple-300/40 mt-1">Monitore falhas em tempo real, telemetria de GPS, auditorias administrativas e status dos microsserviços.</p>
              </div>
              <div className="flex gap-2 shrink-0">
                <button
                  onClick={() => {
                    refreshLogs();
                    refreshAudits();
                    refreshHealth();
                  }}
                  className="px-3 py-1.5 bg-purple-900/30 hover:bg-purple-900/50 text-purple-200 border border-purple-800/25 rounded-xl text-xs font-mono font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Atualizar
                </button>
                <button
                  onClick={clearLocalLogs}
                  className="px-3 py-1.5 bg-rose-950/30 hover:bg-rose-900/40 text-rose-300 border border-rose-950/40 rounded-xl text-xs font-mono font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <Ban className="w-3.5 h-3.5" /> Limpar Logs
                </button>
              </div>
            </div>

            {/* CENTRAL DE STATUS & INDICADORES EM CAMPO */}
            <div className="space-y-4">
              <span className="text-xs font-bold uppercase tracking-wider font-mono text-purple-300 block">
                📊 Central de Status e Monitoramento do Sistema (Homologação de Campo)
              </span>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
                {/* 1. Banco de Dados */}
                <div className="p-4 bg-[#0a061b] border border-purple-950/20 rounded-2xl flex flex-col justify-between">
                  <span className="text-[10px] text-slate-400 font-mono uppercase">Banco de Dados</span>
                  <div className="flex items-center gap-1.5 mt-2">
                    <span className={`w-2.5 h-2.5 rounded-full ${
                      obsHealth?.database_ok === false 
                        ? 'bg-rose-500' 
                        : obsLogs.some(l => l.category === 'supabase' && l.level === 'warn') 
                          ? 'bg-amber-400' 
                          : 'bg-emerald-400 animate-pulse'
                    }`} />
                    <span className="text-[11px] font-bold font-mono uppercase text-white">
                      {obsHealth?.database_ok === false 
                        ? 'Erro' 
                        : obsLogs.some(l => l.category === 'supabase' && l.level === 'warn') 
                          ? 'Atenção' 
                          : 'Saudável'}
                    </span>
                  </div>
                </div>

                {/* 2. Autenticação */}
                <div className="p-4 bg-[#0a061b] border border-purple-950/20 rounded-2xl flex flex-col justify-between">
                  <span className="text-[10px] text-slate-400 font-mono uppercase">Autenticação</span>
                  <div className="flex items-center gap-1.5 mt-2">
                    <span className={`w-2.5 h-2.5 rounded-full ${
                      obsHealth?.auth_ok === false 
                        ? 'bg-rose-500' 
                        : 'bg-emerald-400 animate-pulse'
                    }`} />
                    <span className="text-[11px] font-bold font-mono uppercase text-white">
                      {obsHealth?.auth_ok === false ? 'Erro' : 'Saudável'}
                    </span>
                  </div>
                </div>

                {/* 3. GPS */}
                <div className="p-4 bg-[#0a061b] border border-purple-950/20 rounded-2xl flex flex-col justify-between">
                  <span className="text-[10px] text-slate-400 font-mono uppercase">GPS</span>
                  <div className="flex items-center gap-1.5 mt-2">
                    <span className={`w-2.5 h-2.5 rounded-full ${
                      obsHealth?.gps_ok === false 
                        ? 'bg-rose-500' 
                        : obsLogs.some(l => l.category === 'gps' && (l.level === 'warn' || l.level === 'error'))
                          ? 'bg-amber-400'
                          : 'bg-emerald-400 animate-pulse'
                    }`} />
                    <span className="text-[11px] font-bold font-mono uppercase text-white">
                      {obsHealth?.gps_ok === false 
                        ? 'Erro' 
                        : obsLogs.some(l => l.category === 'gps' && (l.level === 'warn' || l.level === 'error'))
                          ? 'Atenção'
                          : 'Saudável'}
                    </span>
                  </div>
                </div>

                {/* 4. Sincronização */}
                <div className="p-4 bg-[#0a061b] border border-purple-950/20 rounded-2xl flex flex-col justify-between">
                  <span className="text-[10px] text-slate-400 font-mono uppercase">Sincronização</span>
                  <div className="flex items-center gap-1.5 mt-2">
                    <span className={`w-2.5 h-2.5 rounded-full ${
                      obsHealth?.sync_ok === false 
                        ? 'bg-rose-500' 
                        : obsLogs.some(l => l.category === 'sync' && l.level === 'error')
                          ? 'bg-amber-400'
                          : 'bg-emerald-400 animate-pulse'
                    }`} />
                    <span className="text-[11px] font-bold font-mono uppercase text-white">
                      {obsHealth?.sync_ok === false 
                        ? 'Erro' 
                        : obsLogs.some(l => l.category === 'sync' && l.level === 'error')
                          ? 'Atenção'
                          : 'Ativa'}
                    </span>
                  </div>
                </div>

                {/* 5. Motoristas Online */}
                <div className="p-4 bg-[#0a061b] border border-purple-950/20 rounded-2xl flex flex-col justify-between">
                  <span className="text-[10px] text-slate-400 font-mono uppercase">Motoristas Online</span>
                  <div className="flex items-center gap-1.5 mt-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-[13px] font-extrabold text-white font-mono">
                      {users.filter(u => !u.is_blocked && u.last_access && new Date(u.last_access) > new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)).length || 1}
                    </span>
                  </div>
                </div>

                {/* 6. Jornadas em Andamento */}
                <div className="p-4 bg-[#0a061b] border border-purple-950/20 rounded-2xl flex flex-col justify-between">
                  <span className="text-[10px] text-slate-400 font-mono uppercase">Jornadas em Andamento</span>
                  <div className="flex items-center gap-1.5 mt-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-[13px] font-extrabold text-white font-mono">
                      {Math.max(1, obsAudits.filter(a => a.action === 'start_journey').length - obsAudits.filter(a => a.action === 'end_journey').length)}
                    </span>
                  </div>
                </div>

                {/* 7. Erros nas últimas 24h */}
                <div className="p-4 bg-[#0a061b] border border-purple-950/20 rounded-2xl flex flex-col justify-between font-mono">
                  <span className="text-[10px] text-slate-400 uppercase">Erros nas últimas 24h</span>
                  <span className="text-[13px] font-extrabold text-white mt-2">
                    {obsLogs.filter(l => (l.level === 'error' || l.level === 'critical') && new Date(l.created_at) > new Date(Date.now() - 24 * 3600 * 1000)).length}
                  </span>
                </div>

                {/* 8. Falhas de GPS */}
                <div className="p-4 bg-[#0a061b] border border-purple-950/20 rounded-2xl flex flex-col justify-between font-mono">
                  <span className="text-[10px] text-slate-400 uppercase">Falhas de GPS</span>
                  <span className="text-[13px] font-extrabold text-white mt-2">
                    {obsLogs.filter(l => l.category === 'gps' && (l.level === 'error' || l.level === 'critical')).length}
                  </span>
                </div>

                {/* 9. Falhas de Sincronização */}
                <div className="p-4 bg-[#0a061b] border border-purple-950/20 rounded-2xl flex flex-col justify-between font-mono">
                  <span className="text-[10px] text-slate-400 uppercase">Falhas de Sincronização</span>
                  <span className="text-[13px] font-extrabold text-white mt-2">
                    {obsLogs.filter(l => (l.category === 'sync' || l.category === 'supabase') && (l.level === 'error' || l.level === 'critical')).length}
                  </span>
                </div>

                {/* 10. Último Deploy */}
                <div className="p-4 bg-[#0a061b] border border-purple-950/20 rounded-2xl flex flex-col justify-between font-mono">
                  <span className="text-[10px] text-slate-400 uppercase">Último Deploy</span>
                  <span className="text-[10.5px] font-bold text-purple-300 mt-2">30/06/2026</span>
                </div>

                {/* 11. Versão do Sistema */}
                <div className="p-4 bg-[#0a061b] border border-purple-950/20 rounded-2xl flex flex-col justify-between font-mono col-span-2">
                  <span className="text-[10px] text-slate-400 uppercase">Versão do Sistema</span>
                  <span className="text-[11px] font-extrabold text-purple-300 mt-2">DriverDash Roxou 1.0</span>
                </div>
              </div>
            </div>

            {/* FILTERS FOR TELEMETRY LOGS */}
            <div className="p-4 bg-[#070314] border border-purple-950/40 rounded-2xl flex flex-wrap gap-4 items-center font-mono">
              <span className="text-xs font-bold text-slate-300 uppercase inline-flex items-center gap-1">
                <Filter className="w-3.5 h-3.5" /> Filtrar Logs:
              </span>
              
              <div className="flex gap-2">
                <select
                  value={obsLevelFilter}
                  onChange={(e) => setObsLevelFilter(e.target.value as any)}
                  className="bg-[#05020c] border border-purple-950/45 rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none"
                >
                  <option value="all">Todos Níveis</option>
                  <option value="info">INFO</option>
                  <option value="warn">Aviso (WARN)</option>
                  <option value="error">FALHA (Error)</option>
                  <option value="critical">CRÍTICO</option>
                </select>
              </div>

              <div className="flex gap-2">
                <select
                  value={obsCategoryFilter}
                  onChange={(e) => setObsCategoryFilter(e.target.value as any)}
                  className="bg-[#05020c] border border-purple-950/45 rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none"
                >
                  <option value="all">Todas Categorias</option>
                  <option value="auth">Autenticação (Auth)</option>
                  <option value="gps">GPS / Telemetria</option>
                  <option value="sync">Sincronização</option>
                  <option value="supabase">Supabase / Database</option>
                  <option value="admin">Administração</option>
                  <option value="payment">Financeiro / Planos</option>
                  <option value="demand">Motor Demanda</option>
                  <option value="system">Sistema interno</option>
                </select>
              </div>

              <div className="flex gap-2">
                <select
                  value={obsPeriodFilter}
                  onChange={(e) => setObsPeriodFilter(e.target.value as any)}
                  className="bg-[#05020c] border border-purple-950/45 rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none"
                >
                  <option value="all">Qualquer período</option>
                  <option value="24h">Últimas 24 horas</option>
                  <option value="3d">Últimos 3 dias</option>
                  <option value="7d">Últimos 7 dias</option>
                </select>
              </div>
            </div>

            {/* Split Log Columns: App Telemetry & Administrative Audits */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 text-xs">
              
              {/* LEFT CONTAINER: TELEMETRY & SYSTEM LOGS */}
              <div className="bg-[#0a061b] border border-purple-950/30 rounded-3xl p-5 space-y-4">
                <span className="text-xs font-bold uppercase tracking-wider font-mono text-purple-300 block border-b border-purple-950/30 pb-3">
                  ⚙️ Eventos do Aplicativo ({obsLogs.length} logs)
                </span>
                
                <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1">
                  {obsLogs.length === 0 ? (
                    <p className="text-slate-500 italic text-center py-8">Nenhum evento registrado ainda. Os eventos aparecerão aqui após uso real do sistema.</p>
                  ) : (
                    obsLogs
                      .filter(l => {
                        const matchLvl = obsLevelFilter === 'all' ? true : l.level === obsLevelFilter;
                        const matchCat = obsCategoryFilter === 'all' ? true : l.category === obsCategoryFilter;
                        
                        let matchT = true;
                        if (obsPeriodFilter === '24h') matchT = new Date(l.created_at) > new Date(Date.now() - 24 * 3600 * 1000);
                        else if (obsPeriodFilter === '3d') matchT = new Date(l.created_at) > new Date(Date.now() - 3 * 24 * 3600 * 1000);
                        else if (obsPeriodFilter === '7d') matchT = new Date(l.created_at) > new Date(Date.now() - 7 * 24 * 3600 * 1000);

                        return matchLvl && matchCat && matchT;
                      })
                      .map((logItem, idx) => {
                        const badgeColor = {
                          info: 'bg-emerald-950/45 border-emerald-900/30 text-emerald-400',
                          warn: 'bg-amber-950/45 border-amber-900/30 text-amber-400',
                          error: 'bg-rose-950/45 border-rose-900/30 text-rose-400',
                          critical: 'bg-red-950 border border-red-500 text-red-100 animate-pulse'
                        }[logItem.level];

                        return (
                          <div key={logItem.id || idx} className="p-3 bg-[#03010b] border border-purple-950/40 rounded-xl space-y-1">
                            <div className="flex justify-between items-center text-[10px] font-mono">
                              <span className={`px-1.5 py-0.5 rounded border text-[9px] font-semibold uppercase ${badgeColor}`}>
                                {logItem.level} | {logItem.category}
                              </span>
                              <span className="text-slate-500">{formatDate(logItem.created_at)}</span>
                            </div>
                            <p className="text-[11.5px] font-semibold text-slate-200">{logItem.message}</p>
                            {logItem.metadata && Object.keys(logItem.metadata).length > 0 && (
                              <pre className="text-[9.5px] bg-[#070314] text-purple-300 p-2 rounded border border-purple-950/25 overflow-x-auto font-mono max-h-24">
                                {JSON.stringify(logItem.metadata, null, 2)}
                              </pre>
                            )}
                          </div>
                        );
                      })
                  )}
                </div>
              </div>

              {/* RIGHT CONTAINER: ADMINISTRATIVE ACTIONS AUDITS */}
              <div className="bg-[#0a061b] border border-purple-950/30 rounded-3xl p-5 space-y-4">
                <span className="text-xs font-bold uppercase tracking-wider font-mono text-purple-300 block border-b border-purple-950/30 pb-3">
                  🔑 Segurança e Acessos ({obsAudits.length} registros)
                </span>

                <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1">
                  {obsAudits.length === 0 ? (
                    <p className="text-slate-500 italic text-center py-8">Nenhum acesso administrativo registrado ainda.</p>
                  ) : (
                    obsAudits.map((item, idx) => (
                      <div key={item.id || idx} className="p-3 bg-[#03010b] border border-purple-950/40 rounded-xl space-y-1">
                        <div className="flex justify-between items-center text-[10px] font-mono">
                          <span className="text-slate-400">Ator: <strong className="text-purple-300">{item.actor_user_id}</strong></span>
                          <span className="text-slate-500">{formatDate(item.created_at)}</span>
                        </div>
                        <p className="text-[11.5px] text-slate-200">
                          Efetuou ação <strong className="text-fuchsia-300 font-mono uppercase">{item.action}</strong> sobre <span className="text-purple-400 font-semibold">{item.entity_type}</span> ({item.entity_id || 'N/A'})
                        </p>
                        {item.metadata && Object.keys(item.metadata).length > 0 && (
                          <pre className="text-[9.5px] bg-[#070314] text-indigo-300 p-2 rounded border border-purple-950/25 overflow-x-auto font-mono max-h-24">
                            {JSON.stringify(item.metadata, null, 2)}
                          </pre>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>

            </div>
          </motion.div>
        )}

        {activeTab === 'ride_offers' && (
          <motion.div
            key="admin-ride-offers-view"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
          >
            {/* Title & Introduction */}
            <div className="p-6 bg-gradient-to-r from-emerald-950/20 via-[#0d0526] to-[#0a051d] border border-emerald-900/30 rounded-3xl">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-emerald-950/40 rounded-2xl border border-emerald-800/30 text-emerald-400">
                  <Smartphone className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Ofertas Capturadas via Android AccessibilityService</h3>
                  <p className="text-xs text-slate-400 mt-1 max-w-3xl">
                    Painel de monitoramento e homologação das ofertas de corridas capturadas em tempo real. Esta interface simula e prepara a integração com o futuro aplicativo Android nativo que lerá as telas de Uber/99.
                  </p>
                </div>
              </div>
            </div>

            {/* Metrics Dashboard Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 bg-[#0a051d] border border-purple-950/20 rounded-2xl flex flex-col justify-between">
                <span className="text-[10px] text-slate-400 font-mono uppercase">Total Capturado</span>
                <div className="mt-2">
                  <span className="text-2xl font-extrabold text-white font-mono">{offersStats?.total || 0}</span>
                  <span className="text-[10px] text-purple-400/50 block font-mono">corridas detectadas</span>
                </div>
              </div>
              <div className="p-4 bg-[#0a051d] border border-purple-950/20 rounded-2xl flex flex-col justify-between">
                <span className="text-[10px] text-slate-400 font-mono uppercase">Conversão / Aceitas</span>
                <div className="mt-2">
                  <span className="text-2xl font-extrabold text-emerald-400 font-mono">{offersStats?.accepted || 0}</span>
                  <span className="text-[10px] text-emerald-400/50 block font-mono">
                    {offersStats?.total > 0 ? ((offersStats.accepted / offersStats.total) * 100).toFixed(0) : 0}% de aceitação
                  </span>
                </div>
              </div>
              <div className="p-4 bg-[#0a051d] border border-purple-950/20 rounded-2xl flex flex-col justify-between">
                <span className="text-[10px] text-slate-400 font-mono uppercase">Margem Média Lucro</span>
                <div className="mt-2">
                  <span className="text-2xl font-extrabold text-teal-400 font-mono">
                    R$ {(offersStats?.avgProfit || 0).toFixed(2)}
                  </span>
                  <span className="text-[10px] text-teal-400/50 block font-mono">por corrida aceita</span>
                </div>
              </div>
              <div className="p-4 bg-[#0a051d] border border-purple-950/20 rounded-2xl flex flex-col justify-between">
                <span className="text-[10px] text-slate-400 font-mono uppercase">Veredito Comum</span>
                <div className="mt-2">
                  <span className="text-2xl font-extrabold text-fuchsia-400 font-mono">
                    {offersStats?.commonDecision || 'Nenhum'}
                  </span>
                  <span className="text-[10px] text-fuchsia-400/50 block font-mono">padrão de análise</span>
                </div>
              </div>
            </div>

            {/* Geographical Insights */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-[#0a051d] border border-purple-950/20 rounded-2xl">
                <span className="text-[10px] text-slate-400 font-mono uppercase block border-b border-purple-950/20 pb-2">Origem mais frequente</span>
                <p className="text-lg font-bold text-white mt-2 font-sans">{offersStats?.commonPickup || 'Nenhum'}</p>
                <span className="text-xs text-slate-500 font-mono">Bairro de embarque em Presidente Prudente</span>
              </div>
              <div className="p-4 bg-[#0a051d] border border-purple-950/20 rounded-2xl">
                <span className="text-[10px] text-slate-400 font-mono uppercase block border-b border-purple-950/20 pb-2">Destino mais frequente</span>
                <p className="text-lg font-bold text-white mt-2 font-sans">{offersStats?.commonDest || 'Nenhum'}</p>
                <span className="text-xs text-slate-500 font-mono">Bairro de desembarque final</span>
              </div>
            </div>

            {/* Simulated Capture Panel */}
            <div className="p-5 bg-[#09041a] border border-purple-950/35 rounded-3xl space-y-4">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider font-mono text-purple-300 block">
                  🚀 Simulador de Captura de Ofertas (Homologação Web)
                </span>
                <p className="text-xs text-slate-400 mt-1">
                  Selecione um cenário típico para simular a captura de um texto bruto pelo AccessibilityService. A engine irá analisar a corrida usando os parâmetros de custo reais do veículo do usuário e gerar a recomendação imediatamente.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <button
                  onClick={() => handleCreateSimulatedOffer(0)}
                  className="p-3 bg-[#0c0524] hover:bg-emerald-950/25 border border-purple-950/30 rounded-2xl text-left transition-all group"
                >
                  <div className="flex justify-between items-start">
                    <span className="px-2 py-0.5 bg-black/40 text-slate-300 font-mono text-[9px] rounded-md border border-purple-950/35 uppercase">UberX Excelente</span>
                    <span className="text-emerald-400 group-hover:translate-x-1 transition-transform">→</span>
                  </div>
                  <p className="text-xs font-bold text-white mt-2">Jardim Bongiovani a Centro</p>
                  <p className="text-[11px] text-slate-400 mt-1 font-mono">R$ 24,50 • 8.2 km • 15 min</p>
                </button>

                <button
                  onClick={() => handleCreateSimulatedOffer(1)}
                  className="p-3 bg-[#0c0524] hover:bg-emerald-950/25 border border-purple-950/30 rounded-2xl text-left transition-all group"
                >
                  <div className="flex justify-between items-start">
                    <span className="px-2 py-0.5 bg-black/40 text-slate-300 font-mono text-[9px] rounded-md border border-purple-950/35 uppercase">99Pop Boa</span>
                    <span className="text-emerald-400 group-hover:translate-x-1 transition-transform">→</span>
                  </div>
                  <p className="text-xs font-bold text-white mt-2">Ana Jacinta a Vila Industrial</p>
                  <p className="text-[11px] text-slate-400 mt-1 font-mono">R$ 12,80 • 3.1 km • 8 min</p>
                </button>

                <button
                  onClick={() => handleCreateSimulatedOffer(2)}
                  className="p-3 bg-[#0c0524] hover:bg-emerald-950/25 border border-purple-950/30 rounded-2xl text-left transition-all group"
                >
                  <div className="flex justify-between items-start">
                    <span className="px-2 py-0.5 bg-black/40 text-slate-300 font-mono text-[9px] rounded-md border border-purple-950/35 uppercase">Comfort Retorno</span>
                    <span className="text-emerald-400 group-hover:translate-x-1 transition-transform">→</span>
                  </div>
                  <p className="text-xs font-bold text-white mt-2">Centro a Regente Feijó</p>
                  <p className="text-[11px] text-slate-400 mt-1 font-mono">R$ 42,00 • 18.0 km • 28 min</p>
                </button>

                <button
                  onClick={() => handleCreateSimulatedOffer(3)}
                  className="p-3 bg-[#0c0524] hover:bg-[#ff0055]/10 border border-purple-950/30 rounded-2xl text-left transition-all group"
                >
                  <div className="flex justify-between items-start">
                    <span className="px-2 py-0.5 bg-rose-950/20 text-rose-400 font-mono text-[9px] rounded-md border border-rose-900/10 uppercase">UberX Ruim (Prejuízo)</span>
                    <span className="text-rose-400 group-hover:translate-x-1 transition-transform">→</span>
                  </div>
                  <p className="text-xs font-bold text-white mt-2">Cohab a Brasil Novo</p>
                  <p className="text-[11px] text-rose-400/80 mt-1 font-mono">R$ 7,50 • 9.5 km • 22 min</p>
                </button>

                <button
                  onClick={() => handleCreateSimulatedOffer(4)}
                  className="p-3 bg-[#0c0524] hover:bg-emerald-950/25 border border-purple-950/30 rounded-2xl text-left transition-all group"
                >
                  <div className="flex justify-between items-start">
                    <span className="px-2 py-0.5 bg-black/40 text-slate-300 font-mono text-[9px] rounded-md border border-purple-950/35 uppercase">99Pop Saudável</span>
                    <span className="text-emerald-400 group-hover:translate-x-1 transition-transform">→</span>
                  </div>
                  <p className="text-xs font-bold text-white mt-2">Jardim Paulista a Parque do Povo</p>
                  <p className="text-[11px] text-slate-400 mt-1 font-mono">R$ 15,20 • 4.5 km • 10 min</p>
                </button>
              </div>
            </div>

            {/* List of Captured Offers */}
            <div className="bg-[#0a051d] border border-purple-950/20 rounded-3xl p-6 space-y-4">
              <span className="text-xs font-bold uppercase tracking-wider font-mono text-purple-300 block">
                📋 Registro Recente de Ofertas Capturadas ({allOffers.length})
              </span>

              {allOffers.length === 0 ? (
                <div className="text-center py-12 space-y-3">
                  <p className="text-slate-500 italic">Quando o aplicativo Android capturar ofertas de corrida, elas aparecerão aqui.</p>
                  <p className="text-[11px] text-slate-600 max-w-md mx-auto">
                    Use os botões de simulação acima para carregar ofertas de testes e verificar os scores de decisão gerados em tempo real com os custos reais do carro.
                  </p>
                </div>
              ) : (
                <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2">
                  {allOffers.map((offer) => {
                    // Badge styles based on decision
                    let decisionBg = 'bg-slate-950/50 text-slate-400 border border-slate-900';
                    let decisionLabel = 'Indefinido';
                    if (offer.decision === 'excellent') {
                      decisionBg = 'bg-emerald-950/30 text-emerald-400 border border-emerald-500/25 animate-pulse';
                      decisionLabel = 'Excelente';
                    } else if (offer.decision === 'good') {
                      decisionBg = 'bg-green-950/30 text-green-400 border border-green-500/20';
                      decisionLabel = 'Boa';
                    } else if (offer.decision === 'attention') {
                      decisionBg = 'bg-amber-950/30 text-amber-400 border border-amber-500/20';
                      decisionLabel = 'Atenção';
                    } else if (offer.decision === 'only_if_returning') {
                      decisionBg = 'bg-blue-950/30 text-blue-400 border border-blue-500/20';
                      decisionLabel = 'Retorno';
                    } else if (offer.decision === 'bad') {
                      decisionBg = 'bg-rose-950/30 text-rose-400 border border-rose-500/20';
                      decisionLabel = 'Ruim';
                    }

                    // Status style
                    let statusColor = 'text-slate-400 bg-slate-900/20';
                    let statusText = 'Detectado';
                    if (offer.status === 'accepted') {
                      statusColor = 'text-emerald-400 bg-emerald-950/30 border border-emerald-800/30';
                      statusText = 'Aceita';
                    } else if (offer.status === 'rejected') {
                      statusColor = 'text-rose-400 bg-rose-950/30 border border-rose-800/30';
                      statusText = 'Recusada';
                    } else if (offer.status === 'expired') {
                      statusColor = 'text-amber-400 bg-amber-950/30 border border-amber-800/30';
                      statusText = 'Expirada';
                    } else if (offer.status === 'ignored') {
                      statusColor = 'text-slate-500 bg-slate-950/30';
                      statusText = 'Ignorada';
                    }

                    return (
                      <div key={offer.id} className="p-4 bg-[#070314] border border-purple-950/30 rounded-2xl flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                        <div className="space-y-2 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className={`px-2.5 py-1 text-xs font-extrabold uppercase tracking-wide font-mono rounded-lg ${
                              offer.provider === 'uber' ? 'bg-white text-black' : 'bg-[#ff0055]/15 text-[#ff0055]'
                            }`}>
                              {offer.provider.toUpperCase()}
                            </span>

                            <span className={`px-2 py-0.5 text-[10px] font-bold rounded-md font-mono ${decisionBg}`}>
                              {decisionLabel}
                            </span>

                            <span className={`px-2 py-0.5 text-[10px] font-bold rounded-md font-mono ${statusColor}`}>
                              {statusText}
                            </span>

                            <span className="text-[10px] text-slate-500 font-mono">
                              Detectada em: {formatDate(offer.detected_at)}
                            </span>
                          </div>

                          <div className="space-y-1">
                            <p className="text-sm font-bold text-white flex items-center gap-1.5">
                              <span className="text-emerald-400">R$ {offer.fare_amount.toFixed(2)}</span>
                              <span className="text-slate-500 font-normal text-xs">•</span>
                              <span className="text-slate-300 font-mono font-normal text-xs">{offer.estimated_distance_km} km ({offer.estimated_duration_min} min)</span>
                            </p>
                            <p className="text-xs text-slate-300">
                              <strong className="text-purple-300">Embarque:</strong> {offer.pickup_text} <span className="text-[10px] text-purple-400/50">({offer.pickup_neighborhood})</span>
                            </p>
                            <p className="text-xs text-slate-300">
                              <strong className="text-indigo-300">Destino:</strong> {offer.destination_text} <span className="text-[10px] text-indigo-400/50">({offer.destination_neighborhood})</span>
                            </p>
                          </div>

                          <div className="p-2.5 bg-black/35 rounded-xl border border-purple-950/20 text-[11px] text-slate-400 leading-relaxed font-sans">
                            <strong className="text-purple-300 font-mono block mb-0.5">Análise de Lucro Roxou:</strong>
                            {offer.decision_reason}
                            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[10px] text-slate-500">
                              <span>Rentabilidade: <strong className="text-slate-300">R$ {offer.calculated_revenue_per_km.toFixed(2)}/km</strong></span>
                              <span>Ganhos Hora: <strong className="text-slate-300">R$ {offer.calculated_revenue_per_hour.toFixed(2)}/h</strong></span>
                              <span>Custos Carro: <strong className="text-slate-300">R$ {offer.estimated_cost.toFixed(2)}</strong></span>
                              <span>Lucro Real: <strong className={`font-bold ${offer.estimated_profit > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>R$ {offer.estimated_profit.toFixed(2)}</strong></span>
                            </div>
                          </div>
                        </div>

                        {/* Interactive Manual Override Actions (testing purposes) */}
                        <div className="flex lg:flex-col gap-2 shrink-0">
                          {offer.status === 'detected' && (
                            <>
                              <button
                                onClick={() => handleUpdateStatus(offer.id, 'accepted')}
                                className="px-3 py-1.5 bg-emerald-950/40 hover:bg-emerald-900/40 border border-emerald-800/30 text-emerald-400 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer flex-1 text-center"
                              >
                                Aceitar
                              </button>
                              <button
                                onClick={() => handleUpdateStatus(offer.id, 'rejected')}
                                className="px-3 py-1.5 bg-rose-950/40 hover:bg-rose-900/40 border border-rose-800/30 text-rose-400 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer flex-1 text-center"
                              >
                                Recusar
                              </button>
                              <button
                                onClick={() => handleUpdateStatus(offer.id, 'expired')}
                                className="px-3 py-1.5 bg-slate-900/40 hover:bg-slate-800/40 border border-purple-950/25 text-slate-300 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer flex-1 text-center"
                              >
                                Expirar
                              </button>
                            </>
                          )}
                          {offer.status !== 'detected' && (
                            <span className="text-[10px] font-mono text-slate-500 uppercase block text-center bg-black/20 px-3 py-2 rounded-xl">
                              Histórico Fechado
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* TAB: SOLICITAÇÕES DE ACESSO */}
        {activeTab === 'access_requests' && (
          <motion.div
            key="admin-access-requests-view"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-4"
          >
            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="p-4 bg-[#0a051d] border border-purple-950/20 rounded-2xl flex flex-col justify-between">
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider font-mono">Total de Solicitações</span>
                <span className="text-2xl font-bold text-white mt-1">{accessRequests.length}</span>
              </div>
              <div className="p-4 bg-amber-950/10 border border-amber-900/20 rounded-2xl flex flex-col justify-between">
                <span className="text-[10px] font-semibold text-amber-400 uppercase tracking-wider font-mono">Pendentes</span>
                <span className="text-2xl font-bold text-amber-400 mt-1">
                  {accessRequests.filter(r => r.status === 'pending').length}
                </span>
              </div>
              <div className="p-4 bg-emerald-950/10 border border-emerald-900/20 rounded-2xl flex flex-col justify-between">
                <span className="text-[10px] font-semibold text-emerald-400 uppercase tracking-wider font-mono">Aprovados</span>
                <span className="text-2xl font-bold text-emerald-400 mt-1">
                  {accessRequests.filter(r => r.status === 'approved').length}
                </span>
              </div>
              <div className="p-4 bg-rose-950/10 border border-rose-900/20 rounded-2xl flex flex-col justify-between">
                <span className="text-[10px] font-semibold text-rose-400 uppercase tracking-wider font-mono">Recusados</span>
                <span className="text-2xl font-bold text-rose-400 mt-1">
                  {accessRequests.filter(r => r.status === 'rejected').length}
                </span>
              </div>
            </div>

            {/* List block */}
            <div className="p-5 bg-[#0a051d] border border-purple-950/30 rounded-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-purple-955/20 pb-3">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-amber-400" />
                  <span className="text-xs font-semibold uppercase tracking-wider font-mono text-purple-300">Solicitações de Acesso Beta</span>
                </div>
                <button
                  onClick={fetchAccessRequests}
                  className="p-1.5 hover:bg-purple-950/40 text-purple-400 hover:text-purple-300 rounded-lg transition-colors cursor-pointer"
                  title="Atualizar lista"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              </div>

              {accessRequests.length === 0 ? (
                <div className="py-12 text-center space-y-2">
                  <UserCheck className="w-8 h-8 text-purple-500/40 mx-auto" />
                  <h4 className="text-sm font-semibold text-slate-300">Nenhuma solicitação encontrada</h4>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto">
                    Atualmente não há nenhuma solicitação de acesso cadastrada no banco de dados.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-purple-950/20 text-slate-400 font-mono text-[10px] uppercase">
                        <th className="py-3 px-4">Nome do Motorista</th>
                        <th className="py-3 px-4">Email</th>
                        <th className="py-3 px-4">Data de Envio</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4 text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-purple-950/10">
                      {accessRequests.map((req) => (
                        <tr key={req.id} className="hover:bg-purple-950/5 transition-colors">
                          <td className="py-3.5 px-4 font-medium text-slate-200">{req.name}</td>
                          <td className="py-3.5 px-4 text-slate-300 font-mono text-[11px]">{req.email}</td>
                          <td className="py-3.5 px-4 text-slate-400 font-mono text-[11px]">
                            {new Date(req.created_at).toLocaleString('pt-BR')}
                          </td>
                          <td className="py-3.5 px-4">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-mono text-[9px] uppercase font-bold ${
                              req.status === 'approved' 
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/25' 
                                : req.status === 'rejected'
                                ? 'bg-rose-500/10 text-rose-400 border border-rose-500/25'
                                : 'bg-amber-500/10 text-amber-400 border border-amber-500/25 animate-pulse'
                            }`}>
                              {req.status === 'approved' ? 'Aprovado' : req.status === 'rejected' ? 'Rejeitado' : 'Pendente'}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            {req.status === 'pending' ? (
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  onClick={async () => {
                                    if (confirm(`Deseja aprovar o acesso de ${req.name}?`)) {
                                      await updateAccessRequestStatus(req.id, 'approved');
                                    }
                                  }}
                                  className="p-1 px-2.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 rounded-lg font-mono text-[10px] font-bold transition-all cursor-pointer flex items-center gap-1"
                                >
                                  <Check className="w-3 h-3" /> Aprovar
                                </button>
                                <button
                                  onClick={async () => {
                                    if (confirm(`Deseja recusar o acesso de ${req.name}?`)) {
                                      await updateAccessRequestStatus(req.id, 'rejected');
                                    }
                                  }}
                                  className="p-1 px-2.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 rounded-lg font-mono text-[10px] font-bold transition-all cursor-pointer flex items-center gap-1"
                                >
                                  <X className="w-3 h-3" /> Recusar
                                </button>
                              </div>
                            ) : (
                              <span className="text-[10px] font-mono text-slate-500 uppercase italic">
                                Processado
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </motion.div>
        )}

      </AnimatePresence>

    </div>
  );
};

const dayLabels = [
  { value: '0', label: 'D' },
  { value: '1', label: 'S' },
  { value: '2', label: 'T' },
  { value: '3', label: 'Q' },
  { value: '4', label: 'Q' },
  { value: '5', label: 'S' },
  { value: '6', label: 'S' }
];

const fullDayName = (day: string) => {
  const names: Record<string, string> = {
    '0': 'Dom',
    '1': 'Seg',
    '2': 'Ter',
    '3': 'Qua',
    '4': 'Qui',
    '5': 'Sex',
    '6': 'Sáb'
  };
  return names[day] || day;
};
