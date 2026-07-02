import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Check, ShieldCheck, Zap, Sparkles, Coins, HelpCircle, Copy, CheckCircle2, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export const PlansPage: React.FC = () => {
  const { profile, requestUpgrade, payments, dbStatus } = useApp();
  const [copied, setCopied] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<'pro' | 'pro_plus' | null>(null);
  const [requestSent, setRequestSent] = useState(false);

  // Check if there is already a pending payment for the current user-profile
  const pendingPayment = payments.find(p => p.user_id === profile?.id && p.status === 'pending');

  const plans = [
    {
      id: 'free',
      name: 'Free',
      price: 'R$ 0',
      description: 'Indicado para motoristas esporádicos que desejam controle essencial de caixa.',
      features: [
        'Dashboard de faturamento básico',
        'Registro de Ganhos e despesas diárias',
        'Cálculo automático de Km Rodado',
        'Sinalizador de plataformas com melhor rendimento'
      ],
      cta: 'Plano Atual Ativo',
      active: profile?.plan === 'free',
      color: 'border-slate-800 bg-[#0c0a21]/40'
    },
    {
      id: 'pro',
      name: 'PRO',
      price: 'R$ 29,90',
      period: '/mês',
      description: 'Ideal para motoristas profissionais focados na aceleração máxima de resultados diários.',
      features: [
        'Todos os recursos do plano Free',
        'Insights operacionais avançados',
        'Definição e acompanhamento de Metas Inteligentes',
        'Gráficos estatísticos customizados',
        'Visualizador inteligente de Turno com ticket médio'
      ],
      cta: 'Solicitar Upgrade',
      active: profile?.plan === 'pro',
      color: 'border-purple-600/60 bg-gradient-to-b from-[#150a32] to-[#0a051d]',
      badge: 'MAIS VENDIDOO',
      icon: Zap
    },
    {
      id: 'pro_plus',
      name: 'PRO+',
      price: 'R$ 49,90',
      period: '/mês',
      description: 'A versão suprema para frotistas ou motoristas de elite focados em dominar o mercado.',
      features: [
        'Todos os recursos do plano PRO',
        'Previsão inteligente de estouro de KM contratado',
        'Notificação ativa de regras de demanda de Pico das plataformas',
        'Calculadora amortizada de pneus, freios e pneus',
        'Apoio prioritário comercial via chat'
      ],
      cta: 'Solicitar PRO+',
      active: profile?.plan === 'pro_plus',
      color: 'border-teal-500/50 bg-gradient-to-b from-[#0e212b] to-[#040910]',
      badge: 'TOP PREMIUM',
      icon: Sparkles
    }
  ];

  const handleCopyPix = () => {
    navigator.clipboard.writeText('pix@roxou.com');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleOpenUpgradeModal = (planId: string) => {
    if (planId === 'free') return;
    setSelectedPlan(planId as 'pro' | 'pro_plus');
    setRequestSent(false);
  };

  const handleConfirmPixRequest = async () => {
    if (!selectedPlan) return;
    await requestUpgrade(selectedPlan);
    setRequestSent(true);
    setTimeout(() => {
      setSelectedPlan(null);
      setRequestSent(false);
    }, 4000);
  };

  const getFriendlyPlanName = (p: string) => {
    if (p === 'pro') return 'PRO';
    if (p === 'pro_plus') return 'PRO+';
    return p;
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      
      {/* Title */}
      <div className="border-b border-purple-950/20 pb-4 text-center sm:text-left">
        <h2 className="text-xl font-bold text-white tracking-wide">Planos & Assinaturas Roxou</h2>
        <p className="text-xs text-purple-300/50 mt-1">
          Aumente sua produtividade na rua, evite multas de franquias excedidas e compare as vantagens operacionais exclusivas.
        </p>
      </div>

      {pendingPayment && (
        <div className="p-4 bg-amber-950/40 border border-amber-900/50 rounded-2xl flex items-center justify-between gap-4 text-xs">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-amber-900/30 flex items-center justify-center text-amber-400 shrink-0">
              <Clock className="w-4 h-4 animate-spin" />
            </div>
            <div>
              <p className="font-bold text-white">Upgrade Pendente de Aprovação Manual</p>
              <p className="text-[11px] text-slate-300/80 mt-0.5">
                Nossa equipe está validando o Pix de R$ {pendingPayment.amount.toFixed(2)} solicitado para o plano <span className="text-amber-400 font-bold uppercase">{pendingPayment.plan}</span>.
              </p>
            </div>
          </div>
          <span className="px-2.5 py-1 bg-amber-950 text-amber-400 border border-amber-800/60 font-mono text-[10px] font-bold rounded-lg uppercase">
            Aguardando Admin
          </span>
        </div>
      )}

      {/* Grid Comparisons */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
        {plans.map((pl) => {
          const Icon = pl.icon;
          return (
            <div
              key={pl.id}
              className={`border rounded-3xl p-6 flex flex-col justify-between relative transition-all duration-300 hover:translate-y-[-4px] hover:shadow-[0_8px_30px_rgba(124,58,237,0.1)] ${pl.color}`}
            >
              {pl.badge && (
                <span className={`absolute top-4 right-4 text-[9px] font-bold uppercase tracking-widest px-2.5 py-0.5 rounded-full ${
                  pl.id === 'pro_plus' ? 'bg-teal-950 text-teal-400 border border-teal-800/40' : 'bg-purple-950 text-fuchsia-400 border border-fuchsia-800/50'
                }`}>
                  {pl.badge}
                </span>
              )}

              <div>
                <div className="flex items-center gap-2 mb-4">
                  {Icon && <Icon className={`w-5 h-5 ${pl.id === 'pro_plus' ? 'text-teal-400' : 'text-purple-400'}`} />}
                  <h3 className="text-base font-bold text-white">{pl.name}</h3>
                </div>

                <div className="flex items-baseline mb-4">
                  <span className="text-3xl font-extrabold text-white">{pl.price}</span>
                  {pl.period && <span className="text-slate-400 text-xs ml-1 font-mono">{pl.period}</span>}
                </div>

                <p className="text-slate-400 text-xs leading-relaxed mb-6 border-b border-purple-950/10 pb-4">
                  {pl.description}
                </p>

                <div className="space-y-3.5 mb-8">
                  {pl.features.map((feature, i) => (
                    <div key={i} className="flex items-start gap-2.5 text-[11px] text-slate-300">
                      <Check className={`w-4 h-4 shrink-0 mt-0.5 ${
                        pl.id === 'pro_plus' ? 'text-teal-400' : 'text-purple-400'
                      }`} />
                      <span>{feature}</span>
                    </div>
                  ))}
                </div>
              </div>

              {pl.active ? (
                <button
                  disabled
                  className="w-full py-3 bg-[#0a051d] text-purple-400 border border-purple-900/30 rounded-xl text-xs font-bold tracking-wide cursor-default flex items-center justify-center gap-1.5"
                >
                  <ShieldCheck className="w-4 h-4" /> Plano Ativo
                </button>
              ) : (
                <button
                  onClick={() => handleOpenUpgradeModal(pl.id)}
                  disabled={pl.id === 'free' || !!pendingPayment || dbStatus !== 'connected'}
                  className={`w-full py-3 rounded-xl text-xs font-bold tracking-wide cursor-pointer transition-transform active:scale-95 flex items-center justify-center ${
                    pl.id === 'free'
                      ? 'bg-purple-950/10 border border-purple-950/30 text-purple-300/40'
                      : pl.id === 'pro_plus'
                      ? 'bg-teal-500 hover:bg-teal-400 text-slate-900 font-extrabold'
                      : 'bg-purple-600 hover:bg-purple-500 text-white'
                  } disabled:opacity-40 disabled:cursor-not-allowed`}
                >
                  {dbStatus !== 'connected' ? 'Indisponível Offline' : pl.cta}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Mercado Pago pre-integration details and warnings */}
      <div className="p-5 bg-purple-950/5 border border-purple-950/20 rounded-2xl flex flex-col sm:flex-row items-center gap-4 text-xs text-slate-400 font-sans mt-8">
        <HelpCircle className="w-5 h-5 text-indigo-400 shrink-0" />
        <div>
          <span className="font-semibold text-indigo-300 block mb-0.5">Disposição para Integração Futura Mercado Pago</span>
          <p className="text-[11px] leading-relaxed text-slate-400">
            A estrutura de webhook e banco de dados comercial foi pré-configurada para receber pagamentos automáticos instantâneos via Pix e cartões de crédito. Atualmente, os processos de validação de apoio são realizados de maneira manual pelo administrador.
          </p>
        </div>
      </div>

      {/* Custom upgrade Pix interstitial modal */}
      <AnimatePresence>
        {selectedPlan && (
          <div className="fixed inset-0 z-50 bg/80 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="max-w-md w-full bg-[#0a051d] border border-purple-950/60 rounded-3xl p-6 relative font-sans shadow-2xl"
            >
              {!requestSent ? (
                <>
                  <div className="text-center mb-5">
                    <span className="text-[10px] font-mono font-bold tracking-widest text-purple-400 uppercase">Apoio de Motorista DriverDash</span>
                    <h3 className="text-base font-bold text-white mt-1">Pagamento Pix Manual</h3>
                    <p className="text-xs text-slate-300 mt-2">
                      Para solicitar upgrade ao plano <span className="text-purple-400 font-bold uppercase">{selectedPlan}</span>, realize o Pix e clique em confirmar.
                    </p>
                  </div>

                  <div className="bg-[#04010a] p-4 rounded-2xl border border-purple-950/50 space-y-4">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-400">Plano Selecionado:</span>
                      <span className="font-bold text-white uppercase">{getFriendlyPlanName(selectedPlan)}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs border-b border-purple-950/10 pb-3">
                      <span className="text-slate-400">Valor Estimado:</span>
                      <span className="font-extrabold text-teal-400 font-mono text-sm">
                        {selectedPlan === 'pro_plus' ? 'R$ 49,90' : 'R$ 29,90'}
                      </span>
                    </div>

                    {/* QR Code Mock */}
                    <div className="flex flex-col items-center py-2.5">
                      <div className="w-32 h-32 bg-white/5 border border-purple-950/50 rounded-2xl flex items-center justify-center relative">
                        <Coins className="w-12 h-12 text-purple-400 animate-pulse" />
                        <div className="absolute inset-2 border border-dashed border-purple-400/20 rounded-xl"></div>
                      </div>
                      <span className="text-[10px] text-slate-400 font-mono mt-2.5">QR Code Pix Estático Roxou</span>
                    </div>

                    {/* Copy Key Box */}
                    <div className="space-y-1">
                      <label className="text-[10px] text-slate-400 block font-mono">Chave Pix de Recebimento:</label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          readOnly
                          value="pix@roxou.com"
                          className="w-full bg-[#050210] border border-purple-950/40 rounded-xl px-3 py-2 text-xs text-white focus:outline-none text-center font-mono select-all"
                        />
                        <button
                          onClick={handleCopyPix}
                          className="p-2.5 bg-purple-950/20 border border-purple-900/30 hover:bg-purple-900/40 text-purple-300 rounded-xl cursor-pointer active:scale-95 shrink-0 transition-colors"
                        >
                          {copied ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 mt-6">
                    <button
                      onClick={() => setSelectedPlan(null)}
                      className="w-full py-3 bg-[#0d0724] hover:bg-[#150d36] text-slate-300 text-xs font-bold rounded-xl active:scale-95 cursor-pointer transition-colors"
                    >
                      Voltar
                    </button>
                    <button
                      onClick={handleConfirmPixRequest}
                      className="w-full py-3 bg-gradient-to-r from-purple-700 to-indigo-600 hover:from-purple-600 hover:to-indigo-500 text-white text-xs font-bold rounded-xl active:scale-95 cursor-pointer shadow-[0_4px_10px_rgba(124,58,237,0.3)] transition-colors"
                    >
                      Já Realizei o Pix
                    </button>
                  </div>
                </>
              ) : (
                <div className="text-center py-8">
                  <div className="w-16 h-16 bg-emerald-950/30 border border-emerald-900/50 rounded-2xl flex items-center justify-center text-emerald-400 mx-auto mb-5 animate-bounce">
                    <ShieldCheck className="w-8 h-8" />
                  </div>
                  <h3 className="text-base font-bold text-white">Solicitação Recebida!</h3>
                  <p className="text-xs text-slate-300 mt-2.5 px-3 leading-relaxed">
                    Sua solicitação de ativação do plano <span className="text-teal-400 font-bold uppercase">{selectedPlan}</span> foi enviada com sucesso no painel administrativo.
                  </p>
                  <p className="text-[11px] text-slate-400 italic mt-3 font-mono">
                    A liberação será realizada de maneira manual em poucos minutos pelo e-mail administrado.
                  </p>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
};
