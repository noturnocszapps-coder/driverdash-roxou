import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { useNavigate } from 'react-router-dom';
import { Chrome, Sparkles, Database } from 'lucide-react';
import { motion } from 'motion/react';

export const LoginPage: React.FC = () => {
  const { 
    loginWithGoogle, 
    localDemoLogin, 
    dbStatus, 
    user, 
    profile, 
    loading 
  } = useApp();
  const navigate = useNavigate();
  
  const [loadingState, setLoadingState] = useState<'idle' | 'google' | 'demo'>('idle');
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
    } catch (err: any) {
      console.error('Google login error:', err);
      setErrorLocal(err.message || 'Erro ao conectar com Google. Verifique se o Supabase está configurado corretamente.');
    } finally {
      setLoadingState('idle');
    }
  };

  return (
    <div className="min-h-screen bg-[#04010e] flex flex-col items-center justify-center p-4 relative overflow-hidden" id="login-container">
      
      {/* Visual background ambient planets */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-900/10 rounded-full blur-[140px] pointer-events-none"></div>
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-indigo-900/10 rounded-full blur-[140px] pointer-events-none"></div>

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        className="w-full max-w-md bg-[#0a061b]/90 border border-purple-950/45 rounded-3xl p-8 relative z-10 shadow-[0_10px_50px_rgba(0,0,0,0.8)] backdrop-blur-xl"
        id="login-card"
      >
        {/* Brand Glow indicator */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-[2px] bg-gradient-to-r from-transparent via-purple-500 to-transparent shadow-[0_0_12px_#a855f7]"></div>

        {/* Logo and Greeting */}
        <div className="text-center mb-8">
          <div className="mx-auto w-12 h-12 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-500 shadow-[0_0_20px_rgba(168,85,247,0.5)] flex items-center justify-center font-bold text-white text-2xl font-mono mb-4">
            R
          </div>
          <h2 className="text-2xl font-bold text-white tracking-tight" id="login-title">DriverDash Roxou</h2>
          <p className="text-xs text-purple-400 font-mono tracking-widest uppercase font-semibold mt-1" id="login-subtitle">
            Sua central inteligente de ganhos para motoristas
          </p>
        </div>

        {errorLocal && (
          <div className="mb-4 p-3.5 bg-rose-950/45 border border-rose-900/40 text-rose-300 text-xs rounded-xl font-medium leading-relaxed">
            {errorLocal}
          </div>
        )}

        {/* DRIVER GOOGLE LOGIN FORM */}
        <div className="space-y-4">
          <p className="text-xs text-slate-300 text-center leading-relaxed" id="login-instruction">
            Entre com sua conta Google para acessar seu painel.
          </p>
          
          <button
            onClick={handleGoogleLogin}
            disabled={loadingState !== 'idle'}
            className="w-full flex items-center justify-center gap-3 bg-white text-slate-900 hover:bg-slate-100 py-3.5 px-4 rounded-xl font-semibold text-sm transition-all shadow-[0_4px_20px_rgba(255,255,255,0.05)] cursor-pointer disabled:opacity-50"
            id="google-login-button"
          >
            <Chrome className="w-5 h-5 text-indigo-600" />
            {loadingState === 'google' ? 'Conectando...' : 'Entrar com Google'}
          </button>
        </div>
      </motion.div>

      {/* Supabase connection hint */}
      <div className="mt-6 text-center text-[11px] text-purple-400/40 font-mono flex items-center gap-1.5" id="supabase-status">
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
