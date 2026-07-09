import React, { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { Lock, LogOut, Send, Clock, AlertCircle, RefreshCw } from 'lucide-react';
import { supabase } from '../modules/shared/supabase.helpers';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRole?: 'driver' | 'admin';
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, allowedRole }) => {
  const { user, profile, loading, submitAccessRequest } = useApp();
  const [myRequest, setMyRequest] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // CLOSED BETA RESTRICTION GATE
  const isBetaAuthorized = 
    profile?.role === 'admin' || 
    profile?.beta_tester === true || 
    (profile?.plan && profile.plan !== 'free');

  useEffect(() => {
    if (user && !isBetaAuthorized) {
      const loadMyRequest = async () => {
        try {
          const { data, error } = await supabase
            .from('access_requests')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false });
          if (!error && data && data.length > 0) {
            setMyRequest(data[0]);
            localStorage.setItem(`roxou_my_access_request_${user.id}`, JSON.stringify(data[0]));
            return;
          }
        } catch (e) {
          console.warn('Could not load request from Supabase:', e);
        }

        // Fallback to local storage
        const stored = localStorage.getItem(`roxou_my_access_request_${user.id}`);
        if (stored) {
          setMyRequest(JSON.parse(stored));
        }
      };
      loadMyRequest();
    }
  }, [user, isBetaAuthorized]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#070214] flex flex-col items-center justify-center text-purple-300">
        <div className="relative w-16 h-16">
          <div className="absolute top-0 left-0 w-full h-full border-4 border-purple-900 border-t-purple-500 rounded-full animate-spin"></div>
        </div>
        <p className="mt-4 font-mono text-sm animate-pulse">Sincronizando DriverDash Roxou...</p>
      </div>
    );
  }

  // If no user is logged in, redirect to login page
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Intercept blocked user and display clean suspension overlay
  if (profile?.is_blocked) {
    return (
      <div className="min-h-screen bg-[#070214] flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full bg-[#0a051d]/90 border border-red-950/40 rounded-3xl p-8 text-center shadow-[0_10px_30px_rgba(239,68,68,0.1)]">
          <div className="mx-auto w-16 h-16 bg-red-950/40 border border-red-900/60 rounded-2xl flex items-center justify-center text-red-500 mb-6 font-semibold animate-pulse">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-white tracking-wide">Acesso Suspenso</h2>
          <p className="text-xs text-slate-300 mt-3 leading-relaxed">
            Sua conta de motorista no <span className="text-purple-400 font-semibold uppercase">DriverDash Roxou</span> foi temporariamente bloqueada pela administração do sistema devido a pendências comerciais de assinatura ou por decisão administrativa.
          </p>
          <div className="mt-6 p-4 rounded-xl bg-purple-950/10 border border-purple-900/20 text-left">
            <p className="text-[10px] uppercase font-mono font-bold tracking-widest text-purple-400 mb-1">Informações de Contato</p>
            <p className="text-xs text-slate-400">E-mail: <a href="mailto:noturnocszapps@gmail.com" className="text-purple-300 underline font-mono">noturnocszapps@gmail.com</a></p>
            <p className="text-xs text-slate-400 mt-1">Status do Bloqueio: <span className="text-rose-400 font-semibold">Ativo</span></p>
          </div>
          <div className="grid grid-cols-2 gap-3 mt-8">
            <button
              onClick={() => {
                window.location.href = `mailto:noturnocszapps@gmail.com?subject=Suporte DriverDash Roxou - Solicitação de Desbloqueio (${profile?.email || 'N/A'})`;
              }}
              className="bg-purple-700 hover:bg-purple-600 active:scale-95 text-white text-xs font-bold py-3 px-4 rounded-xl transition-all cursor-pointer shadow-lg shadow-purple-900/25"
            >
              Suporte Técnico
            </button>
            <button
              onClick={() => {
                localStorage.clear();
                window.location.href = '/login';
              }}
              className="bg-[#0b061c] border border-purple-950/60 hover:bg-purple-950/20 active:scale-95 text-slate-400 hover:text-white text-xs font-bold py-3 px-4 rounded-xl transition-all cursor-pointer"
            >
              Sair da Conta
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!isBetaAuthorized) {
    const handleRequestAccess = async () => {
      if (!user || !profile) return;
      setSubmitting(true);
      setMessage(null);
      try {
        const name = profile.name || user.email?.split('@')[0] || 'Motorista';
        const email = profile.email || user.email || '';
        
        await submitAccessRequest(name, email);
        
        const newRequest = {
          id: Math.random().toString(36).substring(2),
          user_id: user.id,
          name,
          email,
          status: 'pending',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        
        setMyRequest(newRequest);
        localStorage.setItem(`roxou_my_access_request_${user.id}`, JSON.stringify(newRequest));
        setMessage('Solicitação enviada com sucesso!');
      } catch (e: any) {
        console.error(e);
        setMessage('Falha ao enviar solicitação.');
      } finally {
        setSubmitting(false);
      }
    };

    return (
      <div className="min-h-screen bg-[#070214] flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full bg-[#0a051d]/90 border border-purple-950/40 rounded-3xl p-8 text-center shadow-[0_10px_35px_rgba(168,85,247,0.07)]">
          <div className="mx-auto w-16 h-16 bg-purple-950/40 border border-purple-800/40 rounded-2xl flex items-center justify-center text-purple-400 mb-6 font-semibold shadow-inner">
            {myRequest?.status === 'pending' ? (
              <Clock className="w-8 h-8 animate-pulse text-amber-400" />
            ) : myRequest?.status === 'rejected' ? (
              <AlertCircle className="w-8 h-8 text-rose-500" />
            ) : (
              <Lock className="w-8 h-8" />
            )}
          </div>
          
          <h2 className="text-xl font-bold text-white tracking-wide">
            {myRequest?.status === 'pending' ? 'Aguardando Homologação' : myRequest?.status === 'rejected' ? 'Acesso Recusado' : 'Acesso Restrito'}
          </h2>
          
          <p className="text-xs text-slate-300 mt-3 leading-relaxed">
            {myRequest?.status === 'pending' ? (
              <span>Sua solicitação de homologação de cadastro está sob análise ativa da moderação. Fique atento, o prazo médio para liberação imediata é de 5 minutos!</span>
            ) : myRequest?.status === 'rejected' ? (
              <span>Sua solicitação de acesso não pôde ser aprovada neste momento. Entre em contato com a equipe em <span className="text-purple-400 font-semibold font-mono">noturnocszapps@gmail.com</span> para resolver pendências.</span>
            ) : (
              <span>O <span className="text-purple-400 font-semibold uppercase">DriverDash Roxou</span> está em período de adesão exclusiva para motoristas parceiros homologados.</span>
            )}
          </p>

          {myRequest?.status === 'pending' && (
            <div className="mt-4 p-3 bg-amber-950/20 border border-amber-900/30 rounded-xl flex items-center justify-center gap-2">
              <RefreshCw className="w-4 h-4 text-amber-500 animate-spin" />
              <span className="text-[11px] font-semibold text-amber-400 font-mono">Fila de análise prioritária ativa</span>
            </div>
          )}

          <p className="text-[11px] text-purple-300/60 mt-4 leading-relaxed">
            Para obter liberação imediata, sua conta precisa ter o acesso homologado ativo ou possuir uma assinatura ativa no sistema.
          </p>

          <div className="mt-6 p-4 rounded-xl bg-purple-950/10 border border-purple-900/20 text-left font-mono text-[11px]">
            <span className="text-purple-400 block font-bold uppercase mb-1">📋 Detalhes da Conta</span>
            <div className="text-slate-400 space-y-1">
              <p>ID: <span className="text-slate-300 text-[10px]">{profile?.id}</span></p>
              <p>Plano Atual: <span className="text-purple-300 uppercase font-semibold">{profile?.plan}</span></p>
              <p>Email: <span className="text-slate-300">{profile?.email}</span></p>
              {myRequest?.status && (
                <p>Status da Fila: <span className={`uppercase font-bold ${myRequest.status === 'pending' ? 'text-amber-400' : 'text-rose-500'}`}>{myRequest.status}</span></p>
              )}
            </div>
          </div>

          {message && (
            <div className="mt-4 p-3 rounded-xl bg-purple-950/30 text-purple-300 border border-purple-900/40 text-center font-semibold text-[11px]">
              {message}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 mt-8">
            {!myRequest ? (
              <button
                onClick={handleRequestAccess}
                disabled={submitting}
                className="bg-purple-700 hover:bg-purple-600 active:scale-95 disabled:opacity-50 disabled:pointer-events-none text-white text-xs font-bold py-3 px-4 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-md shadow-purple-900/30"
              >
                {submitting ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                {submitting ? 'Processando...' : 'Solicitar acesso'}
              </button>
            ) : (
              <button
                onClick={() => {
                  window.location.reload();
                }}
                className="bg-amber-600 hover:bg-amber-500 active:scale-95 text-white text-xs font-bold py-3 px-4 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-md"
              >
                <RefreshCw className="w-4 h-4" /> Atualizar Status
              </button>
            )}
            <button
              onClick={() => {
                localStorage.clear();
                window.location.href = '/login';
              }}
              className="bg-[#0b061c] border border-purple-950/60 hover:bg-purple-950/20 active:scale-95 text-slate-400 hover:text-white text-xs font-bold py-3 px-4 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5"
            >
              <LogOut className="w-4 h-4" /> Sair
            </button>
          </div>
        </div>
      </div>
    );
  }

  // If role does not match, redirect to driver dashboard or admin page depending on what they actually are
  if (allowedRole && profile && profile.role !== allowedRole) {
    if (profile.role === 'admin') {
      return <Navigate to="/admin" replace />;
    } else {
      return <Navigate to="/dashboard" replace />;
    }
  }

  return <>{children}</>;
};
