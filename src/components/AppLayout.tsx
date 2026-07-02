import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { supabase } from '../modules/shared/supabase.helpers';
import { 
  LayoutDashboard, DollarSign, Car, AlertTriangle, Users, 
  LogOut, Menu, X, Database, ShieldAlert, Award, Copy, Check, TrendingUp, Sparkles, Bell, MapPin, Map,
  Ticket, Settings
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../modules/auth/auth.hooks';
import { STORAGE_PREFIX } from '../modules/shared/constants';

export const AppLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, profile, logout, dbStatus, driverSessions, routePoints, endSession } = useApp();
  const { setProfileState } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showSqlPopup, setShowSqlPopup] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showSessionRecovery, setShowSessionRecovery] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const handleResetOnboarding = async () => {
    if (!profile) return;
    
    const confirmReset = window.confirm(
      "Deseja realmente refazer o onboarding? Seu veículo e suas preferências atuais serão mantidos como ponto de partida."
    );
    
    if (!confirmReset) return;

    try {
      // 1. Set onboarding_completed: false locally and in Supabase
      const updatedProfile = { ...profile, onboarding_completed: false, onboarding_step: 1 };
      
      if (dbStatus === 'connected' && user?.id) {
        try {
          await supabase
            .from('profiles')
            .update({ 
              onboarding_completed: false, 
              onboarding_step: 1 
            })
            .eq('id', user.id);
        } catch (e) {
          console.error("Failed to reset onboarding on Supabase:", e);
        }
      }

      // Update auth context state and localStorage
      setProfileState(updatedProfile);
      localStorage.setItem(`${STORAGE_PREFIX}profile`, JSON.stringify(updatedProfile));

      // Update onboarding progress table locally to start from step 1
      const localProgress = localStorage.getItem(`${STORAGE_PREFIX}onboarding_v2_progress`);
      if (localProgress) {
        try {
          const parsed = JSON.parse(localProgress);
          const updatedProgress = { ...parsed, onboarding_completed: false, current_step: 1 };
          localStorage.setItem(`${STORAGE_PREFIX}onboarding_v2_progress`, JSON.stringify(updatedProgress));
        } catch (e) {
          console.warn('Failed to reset local progress step:', e);
        }
      }

      console.log('[ONBOARDING] Reset');
      
      // Close configurations modal and redirect to dashboard to open wizard
      setIsSettingsOpen(false);
      navigate('/dashboard');
    } catch (e) {
      console.error('Failed to reset onboarding:', e);
    }
  };

  const activeSessionRef = driverSessions?.find(s => s.status === 'active' && !s.end_time && !(s as any).ended_at);
  const isJornadaPage = location.pathname === '/jornada';

  useEffect(() => {
    if (!isJornadaPage) {
      setShowSessionRecovery(false);
      return;
    }

    if (!user) {
      setShowSessionRecovery(false);
      return;
    }

    const checkActiveSessionInSupabase = async () => {
      if (dbStatus === 'connected') {
        try {
          const { data: activeSessions, error } = await supabase
            .from('driver_sessions')
            .select('*')
            .eq('user_id', user.id)
            .eq('status', 'active');

          if (error) throw error;

          const activeSess = activeSessions && activeSessions.find(s => s.status === 'active' && !s.end_time && !s.ended_at);
          if (activeSess) {
            const alreadyChecked = sessionStorage.getItem(`recovery_checked_${activeSess.id}`);
            if (!alreadyChecked) {
              setShowSessionRecovery(true);
            } else {
              setShowSessionRecovery(false);
            }
          } else {
            setShowSessionRecovery(false);
          }
        } catch (e) {
          console.error("[JourneyEnd] Error checking active session in Supabase:", e);
          setShowSessionRecovery(false);
        }
      } else {
        // Local mode fallback
        const activeSess = driverSessions?.find(s => s.status === 'active' && !s.end_time && !(s as any).ended_at);
        if (activeSess) {
          const alreadyChecked = sessionStorage.getItem(`recovery_checked_${activeSess.id}`);
          if (!alreadyChecked) {
            setShowSessionRecovery(true);
          } else {
            setShowSessionRecovery(false);
          }
        } else {
          setShowSessionRecovery(false);
        }
      }
    };

    checkActiveSessionInSupabase();
  }, [isJornadaPage, user, dbStatus, driverSessions]);

  const handleContinueSession = () => {
    if (activeSessionRef) {
      sessionStorage.setItem(`recovery_checked_${activeSessionRef.id}`, 'true');
    }
    setShowSessionRecovery(false);
    navigate('/jornada');
  };

  const handleEndSession = async () => {
    console.log("[JourneyEnd] modal end clicked");
    
    let sessionToClose = activeSessionRef;
    if (!sessionToClose && dbStatus === 'connected' && user?.id) {
      try {
        const { data: activeSessions } = await supabase
          .from('driver_sessions')
          .select('*')
          .eq('user_id', user.id)
          .eq('status', 'active');
        const realActiveSessions = activeSessions ? activeSessions.filter(s => !s.end_time && !s.ended_at) : [];
        if (realActiveSessions.length > 0) {
          sessionToClose = {
            id: realActiveSessions[0].id,
            user_id: realActiveSessions[0].user_id,
            start_time: realActiveSessions[0].start_time,
            status: 'active',
            created_at: realActiveSessions[0].created_at || realActiveSessions[0].start_time
          };
        }
      } catch (e) {
        console.error("Failed to query active session for end session:", e);
      }
    }

    if (!sessionToClose) {
      console.log("[JourneyEnd] no active session found to end");
      setShowSessionRecovery(false);
      return;
    }
    
    // Calculate distance
    const currentPoints = routePoints
      .filter(p => p.session_id === sessionToClose.id)
      .sort((a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime());
    
    let distance = 0;
    for (let i = 1; i < currentPoints.length; i++) {
      const p1 = currentPoints[i - 1];
      const p2 = currentPoints[i];
      const lat1 = p1.latitude;
      const lon1 = p1.longitude;
      const lat2 = p2.latitude;
      const lon2 = p2.longitude;
      
      const R = 6371; // Earth's radius in km
      const dLat = (lat2 - lat1) * Math.PI / 180;
      const dLon = (lon2 - lon1) * Math.PI / 180;
      const a = 
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      distance += R * c;
    }
    
    const runningTimeMinutes = Math.max(1, Math.round(
      (new Date().getTime() - new Date(sessionToClose.start_time).getTime()) / 60000
    ));
    
    await endSession(sessionToClose.id, Number(distance.toFixed(2)), runningTimeMinutes);
    sessionStorage.setItem(`recovery_checked_${sessionToClose.id}`, 'true');
    
    console.log("[JourneyEnd] verifying remaining active sessions");
    if (dbStatus === 'connected' && user?.id) {
      try {
        const { data: activeSessions, error: checkError } = await supabase
          .from('driver_sessions')
          .select('id, status, end_time, ended_at')
          .eq('user_id', user.id)
          .eq('status', 'active');
        
        if (checkError) throw checkError;
        
        const realActiveSessions = activeSessions ? activeSessions.filter(s => !s.end_time && !s.ended_at) : [];
        const hasActive = realActiveSessions.length > 0;
        
        if (hasActive) {
          console.log("[JourneyEnd] active session still exists");
          const activeIds = realActiveSessions.map(s => s.id).join(', ');
          alert(`Erro técnico: Ainda existem jornadas ativas no Supabase. ID(s): ${activeIds}`);
        } else {
          console.log("[JourneyEnd] no active sessions found");
          setShowSessionRecovery(false);
        }
      } catch (checkErr) {
        console.error("Failed verification:", checkErr);
        setShowSessionRecovery(false);
      }
    } else {
      console.log("[JourneyEnd] no active sessions found");
      setShowSessionRecovery(false);
    }
  };

  const navigations = [
    { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard, role: 'driver' },
    { name: 'Jornada Inteligente', path: '/jornada', icon: MapPin, role: 'driver' },
    { name: 'Demanda Roxou', path: '/demanda', icon: Map, role: 'driver' },
    { name: 'Financeiro', path: '/financeiro', icon: DollarSign, role: 'driver' },
    { name: 'Metas Inteligentes', path: '/metas', icon: Award, role: 'driver' },
    { name: 'Inteligência', path: '/insights', icon: TrendingUp, role: 'driver' },
    { name: 'Central de Alertas', path: '/alertas', icon: Bell, role: 'driver' },
    { name: 'Meu Veículo', path: '/veiculo', icon: Car, role: 'driver' },
    { name: 'Passe Uber', path: '/uber-pass', icon: Ticket, role: 'driver' },
    { name: 'Relatos de Passageiro', path: '/relatorios', icon: AlertTriangle, role: 'driver' },
    { name: 'Planos & Assinatura', path: '/planos', icon: Sparkles, role: 'driver' },
    { name: 'Admin Roxou', path: '/admin', icon: Users, role: 'admin' },
  ];

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const copySqlToClipboard = () => {
    const rawSql = `-- DriverDash Roxou - SQL Database Setup
ALTER TABLE IF EXISTS public.profiles ENABLE ROW LEVEL SECURITY;
-- (ver full sql em supabase_schema.sql no editor de código)`;
    
    // In production, the schema is in the supabase_schema.sql, let's copy a helper or hint:
    navigator.clipboard.writeText(`-- Visite o arquivo supabase_schema.sql na raiz do seu projeto local!`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Filter based on user role
  const allowedNavigations = navigations.filter(nav => {
    if (nav.role === 'admin') {
      return profile?.role === 'admin';
    }
    return true;
  });

  return (
    <div className="min-h-screen bg-[#060312] text-slate-100 flex flex-col md:flex-row font-sans">
      
      {/* Background Ambient Glow */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-[#4c1d95]/15 rounded-full blur-[120px]"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-[#6366f1]/10 rounded-full blur-[120px]"></div>
      </div>

      {/* Sidebar - Desktop */}
      <aside className="hidden md:flex flex-col w-64 bg-[#0a061b] border-r border-purple-950/30 p-6 z-10 shrink-0">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-500 shadow-[0_0_15px_rgba(168,85,247,0.5)] flex items-center justify-center font-bold text-white text-lg font-mono">
            R
          </div>
          <div>
            <h1 className="text-md font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-100 to-purple-400 leading-tight">
              DriverDash
            </h1>
            <p className="text-[10px] text-purple-400 font-mono tracking-widest font-semibold uppercase">
              Roxou Edition
            </p>
          </div>
        </div>

        {/* Database Sync Indicator */}
        <div className="mb-6 p-4 rounded-xl bg-[#0e0924]/60 border border-purple-950/40">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] text-purple-400 font-semibold tracking-wider font-mono">Conexão Supabase</span>
            {dbStatus === 'connected' ? (
              <span className="inline-block w-2 bg-emerald-500 rounded-full h-2 animate-pulse shadow-[0_0_8px_#10b981]"></span>
            ) : dbStatus === 'checking' ? (
              <span className="inline-block w-2 bg-yellow-400 rounded-full h-2 animate-bounce"></span>
            ) : (
              <span className="inline-block w-2 bg-amber-500 rounded-full h-2 animate-pulse shadow-[0_0_8px_#f59e0b]"></span>
            )}
          </div>
          <div className="text-xs text-slate-300 font-medium">
            {dbStatus === 'connected' ? (
              <span className="text-emerald-400 flex items-center gap-1.5 font-mono text-[11px]">
                <Database className="w-3.5 h-3.5" /> Conectado Real
              </span>
            ) : dbStatus === 'checking' ? (
              <span className="text-yellow-400 animate-pulse text-[11px]">Verificando...</span>
            ) : (
              <div>
                <span className="text-amber-400 flex items-center gap-1.5 font-mono text-[11px] mb-1">
                  <ShieldAlert className="w-3.5 h-3.5" /> Armazenamento Local
                </span>
                <button 
                  onClick={() => setShowSqlPopup(true)}
                  className="text-[10px] text-purple-300 hover:text-white underline block transition-colors mt-1 font-mono cursor-pointer"
                >
                  Ver Esquema SQL Db
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Navigation Lines */}
        <nav className="flex-1 space-y-1">
          {allowedNavigations.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 group ${
                    isActive
                      ? 'bg-purple-950/40 text-purple-200 border-l-4 border-purple-500 shadow-[inset_1px_0_0_0_rgba(168,85,247,0.2)]'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-purple-950/15'
                  }`
                }
              >
                <Icon className={`w-4 h-4 transition-transform group-hover:scale-110 ${isActive ? 'text-purple-400' : 'text-slate-400 group-hover:text-purple-400'}`} />
                {item.name}
              </NavLink>
            );
          })}
        </nav>

        {/* Footer Area */}
        <div className="border-t border-purple-950/30 pt-4 mt-auto">
          {profile && (
            <div className="flex items-center gap-3 mb-4 p-2.5 rounded-lg bg-purple-950/10 border border-purple-950/20">
              <img 
                src={profile.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=120'} 
                alt="Profile avatar" 
                className="w-9 h-9 rounded-full ring-2 ring-purple-600 object-cover"
                referrerPolicy="no-referrer"
              />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-white truncate">{profile.name}</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="text-[9px] bg-purple-950/60 text-purple-300 font-mono font-medium px-1.5 py-0.2 rounded border border-purple-900/30">
                    {profile.role === 'admin' ? 'ADMIN' : 'MOTORISTA'}
                  </span>
                  <span className="text-[9px] bg-emerald-950 text-emerald-400 font-mono font-bold px-1.5 py-0.2 rounded">
                    {profile.plan.toUpperCase()}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setIsSettingsOpen(true)}
                title="Configurações"
                className="text-purple-400 hover:text-white p-1 rounded-lg hover:bg-purple-900/20 transition-all cursor-pointer shrink-0"
              >
                <Settings className="w-4 h-4" />
              </button>
            </div>
          )}

          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-medium text-purple-400 hover:text-rose-400 hover:bg-rose-950/10 border border-purple-950/25 hover:border-rose-900/40 transition-all duration-200 cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sair do App
          </button>
        </div>
      </aside>

      {/* Top Header & Header - Mobile */}
      <header className="md:hidden flex items-center justify-between bg-[#0a061b] border-b border-purple-950/30 px-6 h-16 z-20 shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-purple-600 to-indigo-500 shadow-[0_0_10px_rgba(168,85,247,0.4)] flex items-center justify-center font-bold text-white text-md font-mono">
            R
          </div>
          <div>
            <h1 className="text-sm font-bold text-white whitespace-nowrap">DriverDash</h1>
            <p className="text-[8px] text-purple-400 font-mono tracking-wider font-semibold uppercase">Roxou</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Mobile dbStatus Indicator */}
          {dbStatus === 'connected' ? (
            <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_6px_#10b981]" />
          ) : (
            <button 
              onClick={() => setShowSqlPopup(true)} 
              className="text-[10px] bg-amber-950/40 text-amber-400 font-mono px-2 py-0.5 rounded border border-amber-900/30 flex items-center gap-1 active:scale-95"
            >
              Armazenamento Local
            </button>
          )}
          
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="p-2 text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </header>

      {/* Mobile Menu Drawer */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="md:hidden fixed top-16 bottom-0 left-0 right-0 w-full h-[calc(100dvh-64px)] bg-[#0a061b]/95 backdrop-blur-xl border-b border-purple-950/40 p-6 z-20 flex flex-col min-h-0 overflow-y-auto overscroll-contain shadow-2xl pb-[calc(1.5rem+env(safe-area-inset-bottom))]"
          >
            <nav className="space-y-1 mb-6 flex-1 overflow-y-auto pr-1 min-h-0">
              {allowedNavigations.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path;
                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-slate-300 hover:text-white hover:bg-purple-950/20"
                  >
                    <Icon className={`w-4 h-4 ${isActive ? 'text-purple-400' : 'text-slate-400'}`} />
                    {item.name}
                  </NavLink>
                );
              })}
            </nav>

            <div className="border-t border-purple-950/30 pt-4 mt-auto flex items-center justify-between shrink-0 sticky bottom-0 bg-[#0a061b]/95 backdrop-blur-md pb-2">
              {profile && (
                <div className="flex items-center gap-2">
                  <img 
                    src={profile.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=120'} 
                    alt="User core avatar" 
                    className="w-8 h-8 rounded-full ring-1 ring-purple-600 object-cover"
                  />
                  <div>
                    <p className="text-xs font-semibold text-white">{profile.name}</p>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[8px] bg-purple-950 text-purple-300 font-mono px-1 py-0.2 rounded font-medium">
                        {(profile.role || 'driver').toUpperCase()}
                      </span>
                      <button
                        onClick={() => {
                          setIsMobileMenuOpen(false);
                          setIsSettingsOpen(true);
                        }}
                        title="Configurações"
                        className="text-purple-400 hover:text-white p-0.5 rounded transition-all cursor-pointer"
                      >
                        <Settings className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <button
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  handleLogout();
                }}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium text-rose-400 hover:bg-rose-950/20 border border-rose-900/30"
              >
                <LogOut className="w-3.5 h-3.5" /> Sair
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content Pane */}
      <main className="flex-1 overflow-y-auto p-4 md:p-8 z-10 relative">
        {children}
      </main>

      {/* SQL Script Popup Modal */}
      <AnimatePresence>
        {showSqlPopup && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#0b0821] border border-purple-900/60 rounded-2xl max-w-lg w-full p-6 shadow-2xl relative"
            >
              <button 
                onClick={() => setShowSqlPopup(false)}
                className="absolute top-4 right-4 text-purple-400 hover:text-white p-1 rounded-full hover:bg-purple-950/30 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
              
              <div className="flex items-center gap-3 mb-4 text-purple-400">
                <Database className="w-5 h-5 text-purple-400" />
                <h3 className="text-lg font-bold text-white font-sans">Configuração de Banco de Dados</h3>
              </div>

              <p className="text-xs text-slate-300 mb-4 leading-relaxed font-sans">
                Para ligar este painel ao seu bando de dados real do Supabase, você só precisa copiar e executar o script SQL de configuração contido no arquivo <code className="text-purple-400 text-xs font-bold bg-purple-950/40 px-1 py-0.5 rounded font-mono">/supabase_schema.sql</code> no seu console do Supabase (SQL Editor).
              </p>

              <div className="bg-[#04010a] rounded-xl border border-purple-950/60 p-4 font-mono text-xs text-purple-300/80 max-h-52 overflow-y-auto mb-5 text-[11px] leading-relaxed">
                <p className="text-purple-400">-- 1. Visite o arquivo supabase_schema.sql na raiz.</p>
                <p>-- 2. Ele configura automaticamente as tabelas:</p>
                <p className="pl-4 text-purple-100/70">- profiles (roles, planos)</p>
                <p className="pl-4 text-purple-100/70">- vehicles (combustível, km/litro)</p>
                <p className="pl-4 text-purple-100/70">- earnings (platfom, km e faturamento)</p>
                <p className="pl-4 text-purple-100/70">- expenses (despesas categorizadas)</p>
                <p className="pl-4 text-purple-100/70">- daily_closings / weekly_closings</p>
                <p className="pl-4 text-purple-100/70">- admin_peak_rules</p>
                <p className="pl-4 text-purple-100/70">- passenger_reports</p>
                <p className="text-purple-400 mt-2">-- 3. Ativa triggers de autoperfil de novos registros.</p>
              </div>

              <div className="flex items-center gap-2 justify-end">
                <span className="text-[10px] text-purple-400/60 font-mono mr-auto">Estabilizado localmente por padrão</span>
                <button
                  onClick={() => setShowSqlPopup(false)}
                  className="px-4 py-2 text-xs font-semibold bg-purple-600 hover:bg-purple-500 rounded-xl text-white transition-colors inline-flex items-center gap-1.5 cursor-pointer"
                >
                  Entendi
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Session Recovery Prompt Modal */}
      <AnimatePresence>
        {showSessionRecovery && activeSessionRef && (
          <div className="fixed inset-0 bg-black/85 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#0b0821] border border-purple-800/60 rounded-3xl max-w-md w-full p-6 md:p-8 shadow-2xl relative text-center"
            >
              <div className="mx-auto w-16 h-16 rounded-2xl bg-purple-950/60 border border-purple-800/40 flex items-center justify-center text-purple-400 mb-6 shadow-[0_0_20px_rgba(168,85,247,0.2)] animate-pulse">
                <MapPin className="w-8 h-8 rotate-45 animate-bounce" />
              </div>

              <h3 className="text-xl font-bold text-white mb-2 font-sans">Jornada em Andamento</h3>
              <p className="text-xs text-slate-300 leading-relaxed font-sans mb-6">
                Detectamos que existe uma jornada iniciada anteriormente ({new Date(activeSessionRef.start_time).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}) que ainda está ativa. Deseja continuar o rastreamento ou encerrá-la agora?
              </p>

              <div className="flex flex-col gap-3">
                <button
                  onClick={handleContinueSession}
                  className="w-full py-3.5 px-4 rounded-2xl font-semibold bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-lg cursor-pointer transition-all flex items-center justify-center gap-2 text-xs"
                >
                  Continuar Jornada
                </button>
                <button
                  onClick={handleEndSession}
                  className="w-full py-3.5 px-4 rounded-2xl font-semibold bg-rose-950/25 hover:bg-[#1a0e10] border border-rose-900/40 text-rose-300 hover:text-rose-200 cursor-pointer transition-all flex items-center justify-center gap-2 text-xs"
                >
                  Encerrar Jornada Ativa
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* App Configurations Settings Modal */}
      <AnimatePresence>
        {isSettingsOpen && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#0b0821] border border-purple-900/50 rounded-3xl max-w-md w-full p-6 md:p-8 shadow-2xl relative"
            >
              <button 
                onClick={() => setIsSettingsOpen(false)}
                className="absolute top-4 right-4 text-purple-400 hover:text-white p-1.5 rounded-full hover:bg-purple-950/30 cursor-pointer transition-all"
              >
                <X className="w-4 h-4" />
              </button>
              
              <div className="flex items-center gap-3 mb-5 text-purple-400">
                <Settings className="w-5 h-5 text-purple-400" />
                <h3 className="text-lg font-bold text-white font-sans">Configurações do DriverDash</h3>
              </div>

              <div className="space-y-6">
                <div className="p-4 bg-purple-950/15 border border-purple-950/30 rounded-2xl">
                  <div className="flex items-center gap-2 text-white font-semibold text-xs mb-1.5">
                    <Car className="w-4 h-4 text-purple-400" />
                    <span>Configuração de Perfil & Onboarding</span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed mb-4">
                    Ao reexecutar o onboarding, você poderá reconfigurar seu veículo atual, combustíveis preferidos, plataformas operadas, dias e horários pretendidos e metas operacionais.
                  </p>
                  
                  <button
                    onClick={handleResetOnboarding}
                    className="w-full py-2.5 px-4 rounded-xl font-bold bg-purple-600 hover:bg-purple-500 text-white text-xs cursor-pointer transition-all duration-200 shadow-[0_0_15px_rgba(147,51,234,0.3)] flex items-center justify-center gap-2"
                  >
                    <Settings className="w-3.5 h-3.5 text-purple-200 animate-spin-slow" />
                    Executar Onboarding novamente
                  </button>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    onClick={() => setIsSettingsOpen(false)}
                    className="px-4 py-2 text-xs font-semibold bg-purple-950/40 hover:bg-purple-950/60 border border-purple-900/30 rounded-xl text-slate-300 hover:text-white transition-all cursor-pointer"
                  >
                    Fechar
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
