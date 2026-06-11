import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { 
  Plus, Trash2, Calendar, Coins, ArrowUpRight, ArrowDownRight, 
  Layers, Clock, HelpCircle, FileCheck, CheckCircle2, AlertCircle, Info, TrendingUp
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { PlatformType, ExpenseType } from '../types';

export const FinancePage: React.FC = () => {
  const { 
    earnings, expenses, dailyClosings, weeklyClosings,
    addEarning, addExpense, deleteEarning, deleteExpense,
    createDailyClosing, createWeeklyClosing, metrics
  } = useApp();

  const [activeTab, setActiveTab] = useState<'record' | 'history' | 'closing'>('record');

  // Form errors
  const [earnError, setEarnError] = useState<string | null>(null);
  const [expError, setExpError] = useState<string | null>(null);

  // Earning form state
  const [earnDate, setEarnDate] = useState(new Date().toISOString().split('T')[0]);
  const [earnPlatform, setEarnPlatform] = useState<PlatformType>('uber');
  const [earnGross, setEarnGross] = useState('');
  const [earnTotalKm, setEarnTotalKm] = useState('');
  const [earnPassengerKm, setEarnPassengerKm] = useState('');
  const [earnEmptyKm, setEarnEmptyKm] = useState('');
  const [earnOnlineMin, setEarnOnlineMin] = useState('');
  const [earnWaitingMin, setEarnWaitingMin] = useState('');
  const [earnRides, setEarnRides] = useState('');
  const [earnNotes, setEarnNotes] = useState('');
  const [earnEntryMode, setEarnEntryMode] = useState<'single_ride' | 'shift_close'>('single_ride');
  const [earnShiftPeriod, setEarnShiftPeriod] = useState<'morning' | 'afternoon' | 'night' | 'dawn' | 'full_day' | null>('full_day');
  const [earnSuccess, setEarnSuccess] = useState(false);

  // Expense form state
  const [expDate, setExpDate] = useState(new Date().toISOString().split('T')[0]);
  const [expType, setExpType] = useState<ExpenseType>('fuel');
  const [expAmount, setExpAmount] = useState('');
  const [expDescription, setExpDescription] = useState('');
  const [expSuccess, setExpSuccess] = useState(false);

  // Closing tool states
  const [closeDailyDate, setCloseDailyDate] = useState(new Date().toISOString().split('T')[0]);
  const [weeklyRefDate, setWeeklyRefDate] = useState(new Date().toISOString().split('T')[0]);
  const [closeWeeklyStart, setCloseWeeklyStart] = useState('');
  const [closeWeeklyEnd, setCloseWeeklyEnd] = useState('');
  
  const [closingFeedback, setClosingFeedback] = useState<{message: string, isError: boolean} | null>(null);

  const calculateWeekBounds = (dateStr: string) => {
    if (!dateStr) return;
    const parts = dateStr.split('-');
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);
    
    const refDate = new Date(year, month, day, 12, 0, 0);
    const dayOfWeek = refDate.getDay();
    const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    
    const mondayDate = new Date(refDate);
    mondayDate.setDate(refDate.getDate() + diffToMonday);
    
    const sundayDate = new Date(mondayDate);
    sundayDate.setDate(mondayDate.getDate() + 6);
    
    const formatYMD = (d: Date) => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const rDay = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${rDay}`;
    };

    setCloseWeeklyStart(formatYMD(mondayDate));
    setCloseWeeklyEnd(formatYMD(sundayDate));
  };

  React.useEffect(() => {
    calculateWeekBounds(weeklyRefDate);
  }, [weeklyRefDate]);

  const handleRefDateChange = (val: string) => {
    setWeeklyRefDate(val);
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  const reconciliationData = React.useMemo(() => {
    if (earnEntryMode !== 'shift_close') return null;

    const gross = Number(earnGross) || 0;
    const matchPeriod = (!earnShiftPeriod || earnShiftPeriod === 'full_day') ? 'full_day' : earnShiftPeriod;
    
    const singleRides = earnings.filter(e => {
      if (e.date !== earnDate || e.platform !== earnPlatform) return false;
      
      const mode = e.entry_mode || 'single_ride';
      if (mode !== 'single_ride') return false;
      
      const itemPeriod = (!e.shift_period || e.shift_period === 'full_day') ? 'full_day' : e.shift_period;
      return itemPeriod === matchPeriod;
    });

    const individualTotal = singleRides.reduce((sum, e) => sum + Number(e.gross_amount), 0);
    const netClosureAmount = gross - individualTotal;

    return {
      gross,
      individualTotal,
      netClosureAmount,
      hasIndividualRides: individualTotal > 0
    };
  }, [earnEntryMode, earnGross, earnDate, earnPlatform, earnShiftPeriod, earnings]);

  const handleAddEarning = async (e: React.FormEvent) => {
    e.preventDefault();
    setEarnError(null);
    setEarnSuccess(false);

    const gross = Number(earnGross);
    const rides = Number(earnRides);
    const pKm = Number(earnPassengerKm) || 0;
    const eKm = Number(earnEmptyKm) || 0;
    let tKm = Number(earnTotalKm);

    // Validations
    if (!earnGross || gross <= 0) {
      setEarnError('O valor bruto recebido deve ser maior que zero!');
      return;
    }
    if (!earnRides || rides < 1) {
      setEarnError('A quantidade de corridas concluídas deve ser pelo menos 1!');
      return;
    }
    if (rides % 1 !== 0) {
      setEarnError('A quantidade de corridas deve ser um número inteiro!');
      return;
    }
    if (gross < 0 || rides < 0 || pKm < 0 || eKm < 0 || tKm < 0) {
      setEarnError('Valores negativos não são permitidos!');
      return;
    }

    // Auto-calculate total KM if empty or 0
    if (!earnTotalKm || tKm === 0) {
      if (pKm === 0 && eKm === 0) {
        setEarnError('Por favor, informe a quilometragem total ou preencha os KMs de passageiro e vazio!');
        return;
      }
      tKm = pKm + eKm;
    }

    // Validation for passenger + empty > total
    if (pKm + eKm > tKm) {
      setEarnError('Erro: A soma de KM com passageiro e KM vazio não pode exceder o KM total!');
      return;
    }

    const onlineMin = Number(earnOnlineMin) || 0;
    const waitingMin = Number(earnWaitingMin) || 0;

    if (onlineMin < 0 || waitingMin < 0) {
      setEarnError('O tempo online ou parado não pode ser negativo!');
      return;
    }

    // Shift close deduction and validation calculations
    let finalGross = gross;
    let closureReportedGross = 0;
    let closureDeductedSingleRides = 0;

    if (earnEntryMode === 'shift_close') {
      const matchPeriod = (!earnShiftPeriod || earnShiftPeriod === 'full_day') ? 'full_day' : earnShiftPeriod;
      
      const singleRides = earnings.filter(e => {
        if (e.date !== earnDate || e.platform !== earnPlatform) return false;
        
        const mode = e.entry_mode || 'single_ride';
        if (mode !== 'single_ride') return false;
        
        const itemPeriod = (!e.shift_period || e.shift_period === 'full_day') ? 'full_day' : e.shift_period;
        return itemPeriod === matchPeriod;
      });

      const individualTotal = singleRides.reduce((sum, e) => sum + Number(e.gross_amount), 0);
      const netClosureAmount = gross - individualTotal;

      if (netClosureAmount < 0) {
        setEarnError('O total das corridas individuais já lançadas é maior que o valor informado no fechamento.');
        return;
      }

      finalGross = netClosureAmount;
      closureReportedGross = gross;
      closureDeductedSingleRides = individualTotal;
    }

    try {
      await addEarning({
        date: earnDate,
        platform: earnPlatform,
        gross_amount: finalGross,
        total_km: tKm,
        passenger_km: pKm,
        empty_km: eKm,
        online_minutes: onlineMin,
        waiting_minutes: waitingMin,
        rides_count: rides,
        notes: earnNotes,
        entry_mode: earnEntryMode,
        shift_period: earnShiftPeriod,
        closure_reported_gross_amount: closureReportedGross,
        closure_deducted_single_rides_amount: closureDeductedSingleRides
      });

      // Clear Form Fields
      setEarnGross('');
      setEarnTotalKm('');
      setEarnPassengerKm('');
      setEarnEmptyKm('');
      setEarnOnlineMin('');
      setEarnWaitingMin('');
      setEarnRides('');
      setEarnNotes('');
      setEarnEntryMode('single_ride');
      setEarnShiftPeriod('full_day');
      
      setEarnSuccess(true);
      setTimeout(() => setEarnSuccess(false), 3000);
    } catch (err: any) {
      setEarnError(err.message || 'Erro ao salvar ganho.');
    }
  };

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    setExpError(null);
    setExpSuccess(false);

    const amount = Number(expAmount);
    if (!expAmount || amount <= 0) {
      setExpError('O valor do gasto deve ser maior que zero!');
      return;
    }

    try {
      await addExpense({
        date: expDate,
        type: expType,
        amount: amount,
        description: expDescription
      });

      setExpAmount('');
      setExpDescription('');

      setExpSuccess(true);
      setTimeout(() => setExpSuccess(false), 3000);
    } catch (err: any) {
      setExpError(err.message || 'Erro ao registrar despesa.');
    }
  };

  const handleCreateDailyClosing = async (e: React.FormEvent) => {
    e.preventDefault();
    setClosingFeedback(null);
    try {
      const res = await createDailyClosing(closeDailyDate);
      setClosingFeedback({
        message: `Sucesso: Fechamento Diário consolidado para o dia ${new Date(closeDailyDate + 'T00:00:00').toLocaleDateString('pt-BR')}! Faturamento: ${formatCurrency(res.gross_amount)} | Lucro Líquido: ${formatCurrency(res.net_profit)} | Distância: ${res.total_km} km.`,
        isError: false
      });
    } catch (err: any) {
      setClosingFeedback({
        message: err.message || 'Erro ao realizar fechamento diário.',
        isError: true
      });
    }
  };

  const handleCreateWeeklyClosing = async (e: React.FormEvent) => {
    e.preventDefault();
    setClosingFeedback(null);
    if (!closeWeeklyStart || !closeWeeklyEnd) {
      setClosingFeedback({
        message: 'Por favor, defina a semana do fechamento!',
        isError: true
      });
      return;
    }

    try {
      const res = await createWeeklyClosing(closeWeeklyStart, closeWeeklyEnd);
      setClosingFeedback({
        message: `Sucesso: Fechamento Semanal consolidado de ${new Date(closeWeeklyStart + 'T00:00:00').toLocaleDateString('pt-BR')} a ${new Date(closeWeeklyEnd + 'T00:00:00').toLocaleDateString('pt-BR')}! Lucro Líquido: ${formatCurrency(res.net_profit)} | Total Km: ${res.total_km} km.`,
        isError: false
      });
    } catch (err: any) {
      setClosingFeedback({
        message: err.message || 'Erro ao realizar fechamento semanal.',
        isError: true
      });
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Visual Title Header */}
      <div className="border-b border-purple-950/20 pb-4">
        <h2 className="text-xl font-bold text-white tracking-wide">Módulo Financeiro</h2>
        <p className="text-xs text-purple-300/50 mt-1">Gerencie seus lançamentos de ganhos operacionais, despesas rodoviárias e efetue fechamentos periódicos.</p>
      </div>

      {/* Navigation tab bar */}
      <div className="flex border-b border-purple-950/20 gap-2">
        <button
          onClick={() => setActiveTab('record')}
          className={`px-4 py-2 text-xs font-mono font-semibold tracking-wider uppercase border-b-2 transition-colors cursor-pointer ${
            activeTab === 'record'
              ? 'text-purple-400 border-purple-500'
              : 'text-purple-300/40 border-transparent hover:text-purple-300'
          }`}
        >
          Lançar Atividade
        </button>
        <button
          onClick={() => setActiveTab('closing')}
          className={`px-4 py-2 text-xs font-mono font-semibold tracking-wider uppercase border-b-2 transition-colors cursor-pointer ${
            activeTab === 'closing'
              ? 'text-purple-400 border-purple-500'
              : 'text-purple-300/40 border-transparent hover:text-purple-300'
          }`}
        >
          Fechamento Diário / Semanal
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`px-4 py-2 text-xs font-mono font-semibold tracking-wider uppercase border-b-2 transition-colors cursor-pointer ${
            activeTab === 'history'
              ? 'text-purple-400 border-purple-500'
              : 'text-purple-300/40 border-transparent hover:text-purple-300'
          }`}
        >
          Extrato Completo ({earnings.length + expenses.length})
        </button>
      </div>

      {/* TAB CONTENTS CONTAINER */}
      <div className="mt-6">
        
        {/* TAB 1: RECORD GAINS & EXPENSES */}
        {activeTab === 'record' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            
            {/* COLUMN 1: NEW GAIN RECORD */}
            <motion.div 
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="bg-[#0b0720]/80 border border-purple-950/40 rounded-2xl p-6 space-y-4"
            >
              <div className="flex items-center gap-2 border-b border-purple-950/20 pb-3">
                <Coins className="w-5 h-5 text-emerald-400" />
                <h3 className="text-md font-bold text-white">Lançar Ganhos por Corrida (Faturamento)</h3>
              </div>

              {earnSuccess && (
                <div className="p-3 bg-emerald-950/60 border border-emerald-900/40 text-emerald-400 text-xs rounded-xl flex items-center gap-2 animate-fadeIn">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>Ganho incluído com sucesso! Verifique no dashboard.</span>
                </div>
              )}

              {earnError && (
                <div className="p-3 bg-rose-950/60 border border-rose-900/40 text-rose-300 text-xs rounded-xl flex items-center gap-2 animate-fadeIn">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                  <span>{earnError}</span>
                </div>
              )}

              <form onSubmit={handleAddEarning} className="space-y-4 text-xs">
                <div className="grid grid-cols-2 gap-3 pb-2 border-b border-purple-950/20">
                  <div>
                    <label className="block text-slate-400 mb-1">Modo de Lançamento</label>
                    <select
                      value={earnEntryMode}
                      onChange={(e) => setEarnEntryMode(e.target.value as 'single_ride' | 'shift_close')}
                      className="w-full bg-[#04010a] border border-purple-950/50 rounded-xl p-2.5 text-slate-100 focus:outline-none focus:border-purple-600 cursor-pointer"
                    >
                      <option value="single_ride">Corrida Individual</option>
                      <option value="shift_close">Fechamento de Turno/Dia</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1">Período / Turno</label>
                    <select
                      value={earnShiftPeriod || 'full_day'}
                      onChange={(e) => setEarnShiftPeriod(e.target.value === 'full_day' ? 'full_day' : e.target.value as any)}
                      className="w-full bg-[#04010a] border border-purple-950/50 rounded-xl p-2.5 text-slate-100 focus:outline-none focus:border-purple-600 cursor-pointer"
                    >
                      <option value="full_day">Dia Inteiro / Geral</option>
                      <option value="morning">Manhã</option>
                      <option value="afternoon">Tarde</option>
                      <option value="night">Noite</option>
                      <option value="dawn">Madrugada</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-400 mb-1">Data</label>
                    <input 
                      type="date" 
                      value={earnDate} 
                      onChange={(e) => setEarnDate(e.target.value)}
                      className="w-full bg-[#04010a] border border-purple-950/50 rounded-xl p-2.5 text-slate-100 focus:outline-none focus:border-purple-600 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1">Plataforma</label>
                    <select
                      value={earnPlatform}
                      onChange={(e) => setEarnPlatform(e.target.value as PlatformType)}
                      className="w-full bg-[#04010a] border border-purple-950/50 rounded-xl p-2.5 text-slate-100 focus:outline-none focus:border-purple-600 capitalize cursor-pointer"
                    >
                      <option value="uber">Uber</option>
                      <option value="99">99 </option>
                      <option value="indriver">InDrive</option>
                      <option value="private">Particular (Privado)</option>
                      <option value="other">Outros</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-emerald-400 font-semibold mb-1">Valor Bruto Recebido (R$)</label>
                    <input 
                      type="number" 
                      step="0.01"
                      required
                      placeholder="0,00"
                      value={earnGross} 
                      onChange={(e) => setEarnGross(e.target.value)}
                      className="w-full bg-[#04010a] border border-purple-950/50 rounded-xl p-2.5 text-slate-100 font-semibold focus:outline-none focus:border-purple-600 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1">Corridas Concluídas</label>
                    <input 
                      type="number" 
                      required
                      placeholder="Qtd de viagens"
                      value={earnRides} 
                      onChange={(e) => setEarnRides(e.target.value)}
                      className="w-full bg-[#04010a] border border-purple-950/50 rounded-xl p-2.5 text-slate-100 focus:outline-none focus:border-purple-600 font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-slate-400 mb-1">Total Km Rodado</label>
                    <input 
                      type="number" 
                      step="0.1"
                      placeholder="Auto (Pass + Vaz)"
                      value={earnTotalKm} 
                      onChange={(e) => setEarnTotalKm(e.target.value)}
                      className="w-full bg-[#04010a] border border-purple-950/50 rounded-xl p-2.5 text-slate-100 focus:outline-none focus:border-purple-600 font-mono placeholder-slate-600"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-300/65 mb-1">Km Passageiro</label>
                    <input 
                      type="number" 
                      step="0.1"
                      placeholder="KM Útil"
                      value={earnPassengerKm} 
                      onChange={(e) => setEarnPassengerKm(e.target.value)}
                      className="w-full bg-[#04010a] border border-purple-950/50 rounded-xl p-2.5 text-[11px] text-slate-100 placeholder-purple-400/20 focus:outline-none focus:border-purple-600 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-300/65 mb-1">Km Vazio</label>
                    <input 
                      type="number" 
                      step="0.1"
                      placeholder="KM Desloc."
                      value={earnEmptyKm} 
                      onChange={(e) => setEarnEmptyKm(e.target.value)}
                      className="w-full bg-[#04010a] border border-purple-950/50 rounded-xl p-2.5 text-[11px] text-slate-100 placeholder-purple-400/20 focus:outline-none focus:border-purple-600 font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-300/65 mb-1">Tempo Online (Minutos)</label>
                    <input 
                      type="number" 
                      placeholder="Minutos"
                      value={earnOnlineMin} 
                      onChange={(e) => setEarnOnlineMin(e.target.value)}
                      className="w-full bg-[#04010a] border border-purple-950/50 rounded-xl p-2.5 text-slate-100 placeholder-purple-400/20 focus:outline-none focus:border-purple-600 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-300/65 mb-1">Tempo Parado (Minutos)</label>
                    <input 
                      type="number" 
                      placeholder="Minutos"
                      value={earnWaitingMin} 
                      onChange={(e) => setEarnWaitingMin(e.target.value)}
                      className="w-full bg-[#04010a] border border-purple-950/50 rounded-xl p-2.5 text-slate-100 placeholder-purple-400/20 focus:outline-none focus:border-purple-600 font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-400 mb-1">Notas / Observações</label>
                  <textarea 
                    rows={2}
                    placeholder="Ex: Chuva forte, evento esportivo, trânsito lento..."
                    value={earnNotes} 
                    onChange={(e) => setEarnNotes(e.target.value)}
                    className="w-full bg-[#04010a] border border-purple-950/50 rounded-xl p-2.5 text-slate-100 focus:outline-none focus:border-purple-600 resize-none font-sans"
                  />
                </div>

                {reconciliationData && (
                  <div className="p-4 bg-purple-950/20 border border-purple-900/30 rounded-xl space-y-3 animate-fadeIn text-xs">
                    <div className="flex items-center gap-2 text-purple-300 font-bold border-b border-purple-900/10 pb-2">
                      <Layers className="w-4 h-4 text-purple-400" />
                      <span>Resumo do Fechamento</span>
                    </div>

                    <div className="space-y-1.5 font-mono text-slate-300">
                      <div className="flex justify-between">
                        <span>Valor informado pelo motorista:</span>
                        <span className="font-semibold text-white">{formatCurrency(reconciliationData.gross)}</span>
                      </div>
                      <div className="flex justify-between text-yellow-400/95">
                        <span>Corridas avulsas neste período:</span>
                        <span>-{formatCurrency(reconciliationData.individualTotal)}</span>
                      </div>
                      <div className="flex justify-between border-t border-purple-950/30 pt-1.5 text-emerald-400 font-semibold">
                        <span>Valor registrado no fechamento:</span>
                        <span>{formatCurrency(Math.max(0, reconciliationData.netClosureAmount))}</span>
                      </div>
                      <div className="flex justify-between text-indigo-300 text-[10px] pt-1">
                        <span>Total final do período:</span>
                        <span className="font-semibold">{formatCurrency(reconciliationData.gross)}</span>
                      </div>
                    </div>

                    {reconciliationData.hasIndividualRides && (
                      <p className="text-[10px] text-purple-300/60 leading-relaxed bg-[#05020c] p-2 rounded-lg border border-purple-950/40">
                        "Detectamos corridas individuais já lançadas para este mesmo aplicativo, data e período. Para evitar duplicidade, vamos descontar esses valores do fechamento."
                      </p>
                    )}

                    {reconciliationData.netClosureAmount < 0 && (
                      <div className="p-2.5 bg-rose-950/60 border border-rose-900/40 text-rose-300 font-semibold text-[10px] rounded-lg">
                        ⚠️ O total das corridas individuais já lançadas é maior que o valor informado no fechamento.
                      </div>
                    )}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={reconciliationData !== null && reconciliationData.netClosureAmount < 0}
                  className={`w-full font-semibold py-3 px-4 rounded-xl transition-all cursor-pointer shadow-[0_4px_15px_rgba(16,185,129,0.25)] ${
                    reconciliationData !== null && reconciliationData.netClosureAmount < 0
                      ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700 shadow-none'
                      : 'bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white'
                  }`}
                >
                  Confirmar Ganho
                </button>
              </form>
            </motion.div>

            {/* COLUMN 2: NEW EXPENSE RECORD */}
            <motion.div 
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              className="bg-[#0b0720]/80 border border-purple-950/40 rounded-2xl p-6 space-y-4 h-full"
            >
              <div className="flex items-center gap-2 border-b border-purple-950/20 pb-3">
                <HelpCircle className="w-5 h-5 text-rose-400" />
                <h3 className="text-md font-bold text-white">Lançar Despesa Operacional</h3>
              </div>

              {expSuccess && (
                <div className="p-3 bg-rose-950/60 border border-rose-900/40 text-rose-300 text-xs rounded-xl flex items-center gap-2 animate-fadeIn">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>Despesa debitada com sucesso!</span>
                </div>
              )}

              {expError && (
                <div className="p-3 bg-rose-950/60 border border-rose-900/40 text-rose-300 text-xs rounded-xl flex items-center gap-2 animate-fadeIn">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                  <span>{expError}</span>
                </div>
              )}

              <form onSubmit={handleAddExpense} className="space-y-4 text-xs">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-400 mb-1">Data da Despesa</label>
                    <input 
                      type="date" 
                      value={expDate} 
                      onChange={(e) => setExpDate(e.target.value)}
                      className="w-full bg-[#04010a] border border-purple-950/50 rounded-xl p-2.5 text-slate-100 focus:outline-none focus:border-purple-600 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1">Categoria</label>
                    <select
                      value={expType}
                      onChange={(e) => setExpType(e.target.value as ExpenseType)}
                      className="w-full bg-[#04010a] border border-purple-950/50 rounded-xl p-2.5 text-slate-100 focus:outline-none focus:border-purple-600 capitalize cursor-pointer"
                    >
                      <option value="fuel">Combustível</option>
                      <option value="food">Alimentação</option>
                      <option value="maintenance">Manutenção Mecânica</option>
                      <option value="rent">Aluguel do Carro</option>
                      <option value="financing">Financiamento</option>
                      <option value="ipva">IPVA / DPVAT</option>
                      <option value="license">Licenciamento</option>
                      <option value="insurance">Seguro do Veículo</option>
                      <option value="cleaning">Lava-Jato / Limpeza</option>
                      <option value="tires">Pneus</option>
                      <option value="oil">Troca de Óleo</option>
                      <option value="brakes">Freios</option>
                      <option value="other">Outros Gastos</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-rose-400 font-semibold mb-1">Valor do Gasto (R$)</label>
                  <input 
                    type="number" 
                    step="0.01"
                    required
                    placeholder="0,00"
                    value={expAmount} 
                    onChange={(e) => setExpAmount(e.target.value)}
                    className="w-full bg-[#04010a] border border-purple-950/50 rounded-xl p-2.5 text-slate-100 font-semibold focus:outline-none focus:border-purple-600 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 mb-1">Descrição / Notas</label>
                  <textarea 
                    rows={4}
                    placeholder="Ex: Abastecimento de Etanol no Posto Shell, Troca das pastilhas de freio traseiras, etc."
                    value={expDescription} 
                    onChange={(e) => setExpDescription(e.target.value)}
                    className="w-full bg-[#04010a] border border-purple-950/50 rounded-xl p-2.5 text-slate-100 focus:outline-none focus:border-purple-600 resize-none font-sans"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full font-semibold py-3 px-4 bg-gradient-to-r from-rose-600 to-orange-500 hover:from-rose-500 hover:to-orange-400 text-white rounded-xl transition-all cursor-pointer shadow-[0_4px_15px_rgba(239,68,68,0.25)]"
                >
                  Confirmar Despesa
                </button>
              </form>
            </motion.div>

          </div>
        )}

        {/* TAB 2: DAILY & WEEKLY CLOSING ACTIONS */}
        {activeTab === 'closing' && (
          <div className="space-y-6">
            
            <div className="bg-[#0b0720]/80 border border-purple-950/40 rounded-2xl p-6">
              <h3 className="text-sm font-semibold text-white mb-2 uppercase tracking-lighter font-mono text-indigo-400">Como funcionam os Fechamentos?</h3>
              <p className="text-xs text-slate-300 leading-relaxed max-w-3xl">
                O DriverDash Roxou consolida todas as corridas, distâncias e gastos dentro de um dia específico ou período semanal correspondente. Ele calcula e insere uma linha no banco de dados contendo o custo líquido por quilômetro e a taxa de retorno operacional para as auditorias de desempenho.
              </p>
            </div>

            {closingFeedback && (
              <div className={`p-4 rounded-xl border text-xs leading-relaxed font-semibold ${
                closingFeedback.isError 
                  ? 'bg-rose-950/40 border-rose-900/40 text-rose-300' 
                  : 'bg-indigo-950/40 border-indigo-900/40 text-purple-300 shadow-[0_0_15px_rgba(99,102,241,0.15)]'
              }`}>
                {closingFeedback.message}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              
              {/* Daily Closing Trigger Form */}
              <div className="bg-[#0d0922] border border-purple-950/50 rounded-xl p-6 space-y-4">
                <div className="flex items-center gap-2 border-b border-purple-950/20 pb-3 text-purple-400">
                  <Calendar className="w-5 h-5" />
                  <h4 className="text-sm font-bold text-white">Efetuar Fechamento Diário</h4>
                </div>

                <form onSubmit={handleCreateDailyClosing} className="space-y-4 text-xs font-sans">
                  <div>
                    <label className="block text-slate-400 mb-1">Selecione o Dia para Fechar</label>
                    <input 
                      type="date"
                      required
                      value={closeDailyDate}
                      onChange={(e) => setCloseDailyDate(e.target.value)}
                      className="w-full bg-[#04010a] border border-purple-950/50 rounded-xl p-2.5 text-slate-100 focus:outline-none focus:border-purple-600 font-mono"
                    />
                  </div>

                  <p className="text-[11px] text-purple-300/40 leading-relaxed font-mono">
                    * Consolida KMs, despesas e faturamento da data.
                  </p>

                  <button
                    type="submit"
                    className="w-full py-2.5 bg-purple-600 hover:bg-purple-500 rounded-xl font-semibold text-white transition-all cursor-pointer"
                  >
                    Gerar Fechamento Diário
                  </button>
                </form>
              </div>

              {/* Weekly Closing Trigger Form */}
              <div className="bg-[#0d0922] border border-purple-950/50 rounded-xl p-6 space-y-4">
                <div className="flex items-center gap-2 border-b border-purple-950/20 pb-3 text-indigo-400">
                  <Layers className="w-5 h-5" />
                  <h4 className="text-sm font-bold text-white">Efetuar Fechamento Semanal</h4>
                </div>

                <form onSubmit={handleCreateWeeklyClosing} className="space-y-4 text-xs font-sans">
                  <div>
                    <label className="block text-slate-400 mb-1">Escolha um Dia de Referência</label>
                    <input 
                      type="date"
                      required
                      value={weeklyRefDate}
                      onChange={(e) => handleRefDateChange(e.target.value)}
                      className="w-full bg-[#04010a] border border-purple-950/50 rounded-xl p-2.5 text-slate-100 focus:outline-none focus:border-purple-600 font-mono"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3 bg-purple-950/10 p-3 rounded-xl border border-purple-950/30">
                    <div>
                      <span className="block text-purple-300 font-mono text-[10px] uppercase">Segunda (Início)</span>
                      <span className="text-xs text-white font-bold font-mono">{closeWeeklyStart ? new Date(closeWeeklyStart + 'T00:00:00').toLocaleDateString('pt-BR') : '-'}</span>
                    </div>
                    <div>
                      <span className="block text-purple-300 font-mono text-[10px] uppercase font-semibold">Domingo (Fim)</span>
                      <span className="text-xs text-white font-bold font-mono">{closeWeeklyEnd ? new Date(closeWeeklyEnd + 'T00:00:00').toLocaleDateString('pt-BR') : '-'}</span>
                    </div>
                  </div>

                  <p className="text-[11px] text-purple-300/40 leading-relaxed font-mono">
                    * Reúne todas as viagens e despesas acontecidas de Segunda-feira a Domingo.
                  </p>

                  <button
                    type="submit"
                    className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 rounded-xl font-semibold text-white transition-all cursor-pointer"
                  >
                    Gerar Fechamento Semanal
                  </button>
                </form>
              </div>

            </div>

            {/* List of registered closings */}
            <div className="bg-[#0b0720]/80 border border-purple-950/40 rounded-2xl p-6 mt-8">
              <h3 className="text-sm font-semibold text-white mb-4 font-mono text-purple-400 uppercase tracking-widest">Fechamentos Concluídos</h3>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                
                {/* Daily Closes List */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-indigo-300 uppercase tracking-wider">Histórico Diário</h4>
                  {dailyClosings.length > 0 ? (
                    <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
                      {dailyClosings.map((c, idx) => (
                        <div key={c.id || idx} className="p-3 rounded-xl bg-purple-950/5 border border-purple-950/40 flex justify-between items-center text-xs">
                          <div>
                            <span className="font-mono font-semibold text-white">{new Date(c.date + 'T00:00:00').toLocaleDateString('pt-BR')}</span>
                            <div className="flex gap-2 text-[10px] text-purple-300/50 font-mono mt-0.5">
                              <span>Km: {c.total_km}km</span>
                              <span>•</span>
                              <span>Gastos: {formatCurrency(c.total_expenses)}</span>
                            </div>
                          </div>
                          <div className="text-right">
                            <span className="font-bold text-emerald-400 block">{formatCurrency(c.net_profit)}</span>
                            <span className="text-[9px] text-purple-400/60 font-mono block">Custo/KM: {formatCurrency(c.cost_per_km)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-purple-300/30 italic">Nenhum fechamento diário consolidado.</p>
                  )}
                </div>

                {/* Weekly Closes List */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-indigo-300 uppercase tracking-wider">Histórico Semanal</h4>
                  {weeklyClosings.length > 0 ? (
                    <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
                      {weeklyClosings.map((c, idx) => (
                        <div key={c.id || idx} className="p-3 rounded-xl bg-indigo-950/5 border border-indigo-950/40 flex justify-between items-center text-xs">
                          <div>
                            <span className="font-mono font-semibold text-white">
                              {new Date(c.week_start + 'T00:00:00').toLocaleDateString('pt-BR')} - {new Date(c.week_end + 'T00:00:00').toLocaleDateString('pt-BR')}
                            </span>
                            <div className="flex gap-2 text-[10px] text-indigo-300/50 font-mono mt-0.5">
                              <span>Km: {c.total_km}km</span>
                              <span>•</span>
                              <span>Gastos: {formatCurrency(c.total_expenses)}</span>
                            </div>
                          </div>
                          <div className="text-right">
                            <span className="font-bold text-emerald-400 block">{formatCurrency(c.net_profit)}</span>
                            <span className="text-[9px] text-purple-400/60 font-mono block">Lucro/KM: {formatCurrency(c.profit_per_km)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-purple-300/30 italic">Nenhum fechamento semanal consolidado.</p>
                  )}
                </div>

              </div>
            </div>

          </div>
        )}

        {/* TAB 3: EXTRACT LISTINGS */}
        {activeTab === 'history' && (
          <div className="space-y-6">
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-emerald-950/15 border border-emerald-950/40 rounded-xl flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase font-semibold text-emerald-500 font-mono block">Faturamento Total do Extrato</span>
                  <p className="text-lg font-bold text-white mt-1">{formatCurrency(metrics.totalRevenue)}</p>
                </div>
                <ArrowUpRight className="w-8 h-8 text-emerald-500" />
              </div>

              <div className="p-4 bg-rose-950/15 border border-rose-950/40 rounded-xl flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase font-semibold text-rose-500 font-mono block">Total de Despesas do Extrato</span>
                  <p className="text-lg font-bold text-white mt-1">{formatCurrency(metrics.totalExpenses)}</p>
                </div>
                <ArrowDownRight className="w-8 h-8 text-rose-500" />
              </div>
            </div>

            <div className="bg-[#0b0720]/80 border border-purple-950/40 rounded-2xl p-6">
              <h3 className="text-sm font-semibold text-white mb-4 font-mono text-purple-400 uppercase tracking-widest">Histórico de Lançamentos Recentes</h3>
              
              <div className="space-y-6">
                
                {/* Earnings List */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-white flex items-center gap-1">
                    <span className="inline-block w-2 h-2 rounded-full bg-emerald-500"></span> Ganhos Registrados ({earnings.length})
                  </h4>
                  {earnings.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="border-b border-purple-950/30 text-purple-400/70 uppercase text-[10px] font-mono">
                            <th className="py-3 px-2">Data</th>
                            <th className="py-3 px-2">Plataforma</th>
                            <th className="py-3 px-2">Valor</th>
                            <th className="py-3 px-2">Distância</th>
                            <th className="py-3 px-2">Corridas</th>
                            <th className="py-3 px-2 text-right">Ação</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-purple-950/10">
                          {earnings.map((e, idx) => (
                            <tr key={e.id || idx} className="hover:bg-purple-950/5">
                              <td className="py-3 px-2 font-mono text-white">{new Date(e.date + 'T00:00:00').toLocaleDateString('pt-BR')}</td>
                              <td className="py-3 px-2 capitalize font-semibold text-purple-300">
                                <div>{e.platform}</div>
                                {e.entry_mode === 'shift_close' ? (
                                  <span className="text-[9px] text-yellow-400/90 font-mono">
                                    Fechamento ({e.shift_period === 'morning' ? 'Manhã' : e.shift_period === 'afternoon' ? 'Tarde' : e.shift_period === 'night' ? 'Noite' : e.shift_period === 'dawn' ? 'Madrugada' : 'Dia Inteiro'})
                                  </span>
                                ) : (
                                  <span className="text-[9px] text-slate-500 font-mono">
                                    Corrida Individual {e.shift_period && e.shift_period !== 'full_day' && `(${e.shift_period === 'morning' ? 'Manhã' : e.shift_period === 'afternoon' ? 'Tarde' : e.shift_period === 'night' ? 'Noite' : e.shift_period === 'dawn' ? 'Madrugada' : 'Dia Inteiro'})`}
                                  </span>
                                )}
                              </td>
                              <td className="py-3 px-2 text-emerald-400 font-bold">
                                <div>{formatCurrency(e.gross_amount)}</div>
                                {e.entry_mode === 'shift_close' && e.closure_reported_gross_amount && Number(e.closure_reported_gross_amount) > 0 ? (
                                  <div className="text-[9px] text-slate-400 font-normal mt-0.5 space-y-px leading-tight">
                                    <div>Fechamento informado: {formatCurrency(Number(e.closure_reported_gross_amount))}</div>
                                    {Number(e.closure_deducted_single_rides_amount) > 0 && (
                                      <div className="text-amber-400/80">Corridas avulsas abatidas: -{formatCurrency(Number(e.closure_deducted_single_rides_amount))}</div>
                                    )}
                                    <div className="text-emerald-500/80 font-semibold">Registrado no fechamento: {formatCurrency(e.gross_amount)}</div>
                                  </div>
                                ) : null}
                              </td>
                              <td className="py-3 px-2 font-mono text-slate-300">{e.total_km} km</td>
                              <td className="py-3 px-2 font-mono text-slate-300">{e.rides_count}</td>
                              <td className="py-3 px-2 text-right">
                                <button
                                  onClick={() => {
                                    if(confirm('Deseja excluir este lançamento?')) {
                                      deleteEarning(e.id, idx);
                                    }
                                  }}
                                  className="p-1 text-slate-500 hover:text-rose-400 rounded transition-colors cursor-pointer"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-xs text-purple-300/30 italic pl-3">Nenhum faturamento lançado.</p>
                  )}
                </div>

                {/* Expenses List */}
                <div className="space-y-3 pt-4 border-t border-purple-950/20">
                  <h4 className="text-xs font-bold text-white flex items-center gap-1">
                    <span className="inline-block w-2 h-2 rounded-full bg-rose-500"></span> Despesas Registradas ({expenses.length})
                  </h4>
                  {expenses.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="border-b border-purple-950/30 text-purple-400/70 uppercase text-[10px] font-mono">
                            <th className="py-3 px-2">Data</th>
                            <th className="py-3 px-2">Tipo</th>
                            <th className="py-3 px-2">Valor</th>
                            <th className="py-3 px-2 col-span-2">Descrição</th>
                            <th className="py-3 px-2 text-right">Ação</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-purple-950/10">
                          {expenses.map((exp, idx) => (
                            <tr key={exp.id || idx} className="hover:bg-purple-950/5">
                              <td className="py-3 px-2 font-mono text-white">{new Date(exp.date + 'T00:00:00').toLocaleDateString('pt-BR')}</td>
                              <td className="py-3 px-2 capitalize font-semibold text-rose-300">{exp.type}</td>
                              <td className="py-3 px-2 text-rose-400 font-bold">{formatCurrency(exp.amount)}</td>
                              <td className="py-3 px-2 text-slate-400 break-words max-w-xs">{exp.description || '-'}</td>
                              <td className="py-3 px-2 text-right">
                                <button
                                  onClick={() => {
                                    if(confirm('Deseja excluir esta despesa?')) {
                                      deleteExpense(exp.id, idx);
                                    }
                                  }}
                                  className="p-1 text-slate-500 hover:text-rose-400 rounded transition-colors cursor-pointer"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-xs text-purple-300/30 italic pl-3">Nenhuma despesa lançada.</p>
                  )}
                </div>

              </div>

            </div>

          </div>
        )}

      </div>

    </div>
  );
};
