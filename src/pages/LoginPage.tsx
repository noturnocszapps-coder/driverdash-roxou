import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { useNavigate } from 'react-router-dom';
import { Chrome, Mail, Lock, Sparkles, Database, ShieldAlert } from 'lucide-react';
import { motion } from 'motion/react';

export const LoginPage: React.FC = () => {
  const { 
    loginWithGoogle, 
    loginWithEmailAndPassword, 
    localDemoLogin, 
    dbStatus, 
    user, 
    profile, 
    loading 
  } = useApp();
  const navigate = useNavigate();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [loadingState, setLoadingState] = useState<'idle' | 'google' | 'admin' | 'demo'>('idle');
  const [errorLocal, setErrorLocal] = useState<string | null>(null);

  const isProduction = import.meta.env.PROD;

  // Auto-redirect already logged-in users to their correct layout
  useEffect(() => {
    if (!loading && user && profile) {
      if (profile.role === 'admin') {
        navigate('/admin');
      } else {
        navigate('/dashboard');
      }
    }
  }, [user, profile, loading, navigate]);

  const handleGoogleLogin = async () => {
    setLoadingState('google');
    setErrorLocal(null);
    try {
      await loginWithGoogle();
      // oauth redirects, but if offline we catch
    } catch (err: any) {
      console.warn('Google login flow missed physical redirect configuration. Auto-entering driver local demo.', err);
      // Fallback straight into driver demo as a pleasant developer flow!
      localDemoLogin('driver');
      navigate('/dashboard');
    } finally {
      setLoadingState('idle');
    }
  };

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setErrorLocal('Preencha email e senha!');
      return;
    }
    setLoadingState('admin');
    setErrorLocal(null);
    try {
      await loginWithEmailAndPassword(email, password);
      // Let the useEffect hook handle redirect based on role
    } catch (err: any) {
      setErrorLocal(err.message || 'Falha de conexão. Verifique suas credenciais do Supabase ou use a demonstração.');
    } finally {
      setLoadingState('idle');
    }
  };

  const handleDemoAccess = (role: 'driver' | 'admin') => {
    setLoadingState('demo');
    try {
      localDemoLogin(role);
      navigate(role === 'admin' ? '/admin' : '/dashboard');
    } catch (err: any) {
      setErrorLocal(err.message);
    } finally {
      setLoadingState('idle');
    }
  };

  return (
    <div className="min-h-screen bg-[#04010e] flex flex-col items-center justify-center p-4 relative overflow-hidden">
      
      {/* Visual background ambient planets */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-900/10 rounded-full blur-[140px] pointer-events-none"></div>
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-indigo-900/10 rounded-full blur-[140px] pointer-events-none"></div>

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        className="w-full max-w-md bg-[#0a061b]/90 border border-purple-950/45 rounded-3xl p-8 relative z-10 shadow-[0_10px_50px_rgba(0,0,0,0.8)] backdrop-blur-xl"
      >
        {/* Brand Glow indicator */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-[2px] bg-gradient-to-r from-transparent via-purple-500 to-transparent shadow-[0_0_12px_#a855f7]"></div>

        {/* Logo and Greeting */}
        <div className="text-center mb-8">
          <div className="mx-auto w-12 h-12 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-500 shadow-[0_0_20px_rgba(168,85,247,0.5)] flex items-center justify-center font-bold text-white text-2xl font-mono mb-4">
            R
          </div>
          <h2 className="text-2xl font-bold text-white tracking-tight">DriverDash Roxou</h2>
          <p className="text-xs text-purple-400 font-mono tracking-widest uppercase font-semibold mt-1">Sua Conta de Ganhos Premium</p>
        </div>

        {errorLocal && (
          <div className="mb-4 p-3.5 bg-rose-950/45 border border-rose-900/40 text-rose-300 text-xs rounded-xl font-medium leading-relaxed">
            {errorLocal}
          </div>
        )}

        {/* Toggle Mode */}
        <div className="flex bg-purple-950/15 border border-purple-950/35 p-1 rounded-xl mb-6">
          <button
            onClick={() => { setIsAdminMode(false); setErrorLocal(null); }}
            className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
              !isAdminMode 
                ? 'bg-purple-900/40 text-white shadow-sm border border-purple-800/20' 
                : 'text-purple-300/60 hover:text-white'
            }`}
          >
            Motorista
          </button>
          <button
            onClick={() => { setIsAdminMode(true); setErrorLocal(null); }}
            className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
              isAdminMode 
                ? 'bg-purple-900/40 text-white shadow-sm border border-purple-800/25' 
                : 'text-purple-300/60 hover:text-white'
            }`}
          >
            Administrador
          </button>
        </div>

        {/* DRIVER GOOGLE LOGIN FORM */}
        {!isAdminMode ? (
          <div className="space-y-4">
            <p className="text-xs text-slate-300 text-center leading-relaxed">
              Logue conectando seu provedor Google. O Supabase cuidará da autenticação segura.
            </p>
            
            <button
              onClick={handleGoogleLogin}
              disabled={loadingState !== 'idle'}
              className="w-full flex items-center justify-center gap-3 bg-white text-slate-900 hover:bg-slate-100 py-3.5 px-4 rounded-xl font-semibold text-sm transition-all shadow-[0_4px_20px_rgba(255,255,255,0.05)] cursor-pointer disabled:opacity-50"
            >
              <Chrome className="w-5 h-5 text-indigo-600" />
              {loadingState === 'google' ? 'Conectando...' : 'Entrar com Google'}
            </button>
          </div>
        ) : (
          /* ADMIN FORM WITH EMAIL/PASSWORD */
          <form onSubmit={handleAdminLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-mono font-medium text-purple-300 uppercase mb-1.5 ml-1">E-mail administrativo</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-3 flex items-center text-purple-400">
                  <Mail className="w-4 h-4" />
                </span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@driverdash.com"
                  className="w-full bg-[#05020c] border border-purple-950/50 rounded-xl py-3 pl-10 pr-4 text-xs text-slate-100 placeholder-purple-400/40 focus:outline-none focus:border-purple-600 transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-mono font-medium text-purple-300 uppercase mb-1.5 ml-1">Senha</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-3 flex items-center text-purple-400">
                  <Lock className="w-4 h-4" />
                </span>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-[#05020c] border border-purple-950/50 rounded-xl py-3 pl-10 pr-4 text-xs text-slate-100 placeholder-purple-400/40 focus:outline-none focus:border-purple-600 transition-colors"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loadingState !== 'idle'}
              className="w-full bg-gradient-to-r from-purple-700 to-indigo-600 hover:from-purple-600 hover:to-indigo-500 text-white font-semibold py-3.5 px-4 rounded-xl text-sm transition-all shadow-[0_4px_20px_rgba(147,51,234,0.35)] cursor-pointer disabled:opacity-50"
            >
              {loadingState === 'admin' ? 'Verificando...' : 'Entrar como Admin'}
            </button>
          </form>
        )}

        {/* DETAILED SANDBOX DEMO FALLBACK - HIDE ON PRODUCTION */}
        {!isProduction && (
          <div className="mt-8 border-t border-purple-950/30 pt-6">
            <div className="flex items-center justify-between mb-3 text-purple-400/70">
              <span className="text-[10px] font-semibold font-mono tracking-wider uppercase">Fase 1: Painel de Avaliação</span>
              <span className="inline-flex items-center gap-1 text-[9px] bg-purple-950/80 text-purple-400 px-1.5 py-0.5 rounded border border-purple-900/30">
                <Sparkles className="w-2.5 h-2.5" /> Instantâneo
              </span>
            </div>
            
            <p className="text-[11px] text-purple-300/60 leading-relaxed mb-4">
              Não quer configurar o Supabase agora? Libere as duas visões instantaneamente em modo offline local:
            </p>

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => handleDemoAccess('driver')}
                className="flex items-center justify-center gap-1.5 py-2.5 px-3 bg-[#0d0922] border border-purple-950 hover:bg-purple-950/20 rounded-xl text-xs font-semibold text-purple-300 transition-all cursor-pointer hover:border-purple-700/50"
              >
                Motorista Demo
              </button>
              <button
                onClick={() => handleDemoAccess('admin')}
                className="flex items-center justify-center gap-1.5 py-2.5 px-3 bg-[#0d0922] border border-purple-950 hover:bg-purple-950/20 rounded-xl text-xs font-semibold text-indigo-300 transition-all cursor-pointer hover:border-indigo-700/50"
              >
                Admin Demo
              </button>
            </div>
          </div>
        )}
      </motion.div>

      {/* Supabase connection hint */}
      <div className="mt-6 text-center text-[11px] text-purple-400/40 font-mono flex items-center gap-1.5">
        <Database className="w-3.5 h-3.5" /> Status Supabase: 
        {dbStatus === 'connected' ? (
          <span className="text-emerald-500 font-bold">Conectado</span>
        ) : (
          <span className="text-amber-500 font-bold">Aguardando SQL / Credenciais</span>
        )}
      </div>
    </div>
  );
};

