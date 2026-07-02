import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Car, 
  Flame, 
  Network, 
  Calendar, 
  Clock, 
  Target, 
  Sparkles, 
  ArrowRight, 
  ArrowLeft, 
  Check, 
  ChevronRight,
  ShieldAlert,
  HelpCircle,
  Gem
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { driverProfileService, DriverProfilePreferences } from '../modules/copilot-intelligence/driverProfile.service';

interface OnboardingWizardProps {
  onComplete?: () => void;
}

export const OnboardingWizard: React.FC<OnboardingWizardProps> = ({ onComplete }) => {
  const { upsertVehicle, upsertVehicleCostSettings, completeOnboarding } = useApp();
  const [step, setStep] = useState(1);
  
  // Step 1: Vehicle ownership
  const [ownership, setOwnership] = useState<'own' | 'rented'>('own');
  
  // Step 2: Fuel Type
  const [fuel, setFuel] = useState<'gasolina' | 'etanol' | 'flex' | 'diesel' | 'hybrid' | 'electric'>('flex');
  
  // Step 3: Platforms
  const [platforms, setPlatforms] = useState<string[]>(['uber']);
  
  // Step 4: Days per week
  const [days, setDays] = useState(5);
  
  // Step 5: Hours per day
  const [hours, setHours] = useState(8);
  
  // Step 6: Goal
  const [goal, setGoal] = useState<'max_profit' | 'max_revenue' | 'min_wear' | 'min_hours' | 'other'>('max_profit');

  // Basic vehicle model & brand based on choices
  const [brand, setBrand] = useState('Chevrolet');
  const [model, setModel] = useState('Onix');
  const [year, setYear] = useState('2022');

  const togglePlatform = (p: string) => {
    if (platforms.includes(p)) {
      if (platforms.length > 1) {
        setPlatforms(platforms.filter(x => x !== p));
      }
    } else {
      setPlatforms([...platforms, p]);
    }
  };

  const handleNext = () => {
    if (step < 6) {
      setStep(step + 1);
    } else {
      handleFinish();
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
    }
  };

  const handleFinish = async () => {
    try {
      // 1. Construct preferences object
      const prefs: DriverProfilePreferences = {
        ownershipType: ownership,
        fuelType: fuel,
        platforms,
        daysPerWeek: days,
        hoursPerDay: hours,
        objective: goal,
        odometerCurrent: 0
      };

      // 2. Map ownership and fuel to standard vehicle payload
      const isElectric = fuel === 'electric';
      const vehiclePayload = {
        brand: brand || 'Chevrolet',
        model: model || 'Onix',
        year: Number(year) || 2022,
        plate_optional: '',
        fuel_type: fuel,
        km_per_liter: isElectric ? 0 : 10,
        ownership_type: ownership,
        weekly_km_limit: ownership === 'rented' ? 1000 : undefined,
        monthly_km_limit: ownership === 'rented' ? 4000 : undefined,
        rental_amount: ownership === 'rented' ? 550 : 0, // sensible default
        rental_period: 'weekly' as const,
        rental_food_daily: 0,
        rental_damage_monthly: 0,
        rental_cleaning_monthly: 0,
        electric_consumption_kwh_100km: isElectric ? 16 : undefined,
        electricity_price_kwh: isElectric ? 0.85 : undefined,
        charging_type: isElectric ? 'residential' as const : null
      };

      // Save vehicle
      await upsertVehicle(vehiclePayload);

      // 3. Map to standard cost settings
      const costSettingsPayload = {
        fuel_price: isElectric ? 0 : 5.60,
        tire_cost: 1400,
        tire_lifespan_km: 40000,
        oil_change_cost: isElectric ? 0 : 250,
        oil_change_interval_km: isElectric ? 100000 : 10000,
        brake_cost: 220,
        brake_interval_km: isElectric ? 80000 : 30000,
        insurance_yearly: ownership === 'rented' ? 0 : 2400,
        ipva_yearly: ownership === 'rented' ? 0 : 1500,
        licensing_yearly: ownership === 'rented' ? 0 : 150,
        emergency_reserve_monthly: 100,
        financing_monthly: 0,
        maintenance_monthly: ownership === 'rented' ? 0 : 120
      };

      // Save cost settings
      await upsertVehicleCostSettings(costSettingsPayload);

      // 4. Save driver profile preferences to local storage
      driverProfileService.savePreferences(prefs);

      // 5. Set completed status in DB and Context
      await completeOnboarding();

      if (onComplete) {
        onComplete();
      }
    } catch (e) {
      console.error('Failed to complete onboarding wizard:', e);
    }
  };

  const percentComplete = Math.round((step / 6) * 100);

  return (
    <div className="fixed inset-0 z-50 bg-[#04010a]/95 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
      <div className="w-full max-w-xl bg-gradient-to-b from-[#110729] to-[#04010b] border border-purple-500/30 rounded-3xl p-6 sm:p-8 shadow-[0_0_50px_rgba(147,51,234,0.15)] relative overflow-hidden">
        {/* Glowing background elements */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-purple-600/10 rounded-full filter blur-2xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-indigo-600/10 rounded-full filter blur-2xl pointer-events-none" />

        {/* Progress bar */}
        <div className="mb-6 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono font-bold tracking-wider text-purple-400 uppercase">
              Onboarding Inteligente • Passo {step} de 6
            </span>
            <span className="text-[10px] font-mono font-bold text-purple-300">
              {percentComplete}%
            </span>
          </div>
          <div className="h-1.5 w-full bg-[#070311] rounded-full overflow-hidden border border-purple-950/45">
            <motion.div 
              className="h-full bg-gradient-to-r from-purple-500 to-indigo-500 rounded-full"
              initial={{ width: '0%' }}
              animate={{ width: `${percentComplete}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
        </div>

        {/* Form Container */}
        <div className="min-h-[280px] flex flex-col justify-between">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 15 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -15 }}
              transition={{ duration: 0.2 }}
              className="space-y-5"
            >
              {/* STEP 1: VEHICLE TYPE */}
              {step === 1 && (
                <div className="space-y-4">
                  <div className="space-y-1">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                      <Car className="w-5 h-5 text-purple-400" /> Qual veículo você utiliza?
                    </h3>
                    <p className="text-xs text-slate-400">
                      Iremos personalizar as opções de depreciação, taxas e alertas com base nessa escolha.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                    <button
                      onClick={() => setOwnership('own')}
                      className={`p-5 rounded-2xl border-2 text-left transition-all ${
                        ownership === 'own'
                          ? 'border-purple-500 bg-purple-950/30'
                          : 'border-purple-950/40 bg-purple-950/5 hover:border-purple-900/50'
                      }`}
                    >
                      <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center text-purple-400 mb-3">
                        <Gem className="w-5 h-5" />
                      </div>
                      <span className="font-bold text-sm text-white block">Veículo Próprio / Financiado</span>
                      <span className="text-[11px] text-slate-400 mt-1 block leading-relaxed">
                        IPVA, seguro anual, depreciação, manutenção geral e valor de revenda sob seu controle.
                      </span>
                    </button>

                    <button
                      onClick={() => setOwnership('rented')}
                      className={`p-5 rounded-2xl border-2 text-left transition-all ${
                        ownership === 'rented'
                          ? 'border-purple-500 bg-purple-950/30'
                          : 'border-purple-950/40 bg-purple-950/5 hover:border-purple-900/50'
                      }`}
                    >
                      <div className="w-10 h-10 rounded-xl bg-indigo-500/20 flex items-center justify-center text-indigo-400 mb-3">
                        <Car className="w-5 h-5" />
                      </div>
                      <span className="font-bold text-sm text-white block">Veículo Alugado</span>
                      <span className="text-[11px] text-slate-400 mt-1 block leading-relaxed">
                        Esconda IPVA, seguro, licenciamento e depreciação. Foco em manutenções rápidas e limite de franquia.
                      </span>
                    </button>
                  </div>

                  <div className="pt-2">
                    <label className="block text-[10px] text-slate-400 uppercase tracking-wider mb-2">Marca, modelo e ano (opcional)</label>
                    <div className="grid grid-cols-3 gap-2">
                      <input 
                        type="text" 
                        placeholder="Marca (ex: Chevrolet)" 
                        value={brand} 
                        onChange={e => setBrand(e.target.value)}
                        className="bg-[#030107] border border-purple-950/50 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-purple-600"
                      />
                      <input 
                        type="text" 
                        placeholder="Modelo (ex: Onix)" 
                        value={model} 
                        onChange={e => setModel(e.target.value)}
                        className="bg-[#030107] border border-purple-950/50 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-purple-600"
                      />
                      <input 
                        type="text" 
                        placeholder="Ano" 
                        value={year} 
                        onChange={e => setYear(e.target.value)}
                        className="bg-[#030107] border border-purple-950/50 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-purple-600"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 2: FUEL TYPE */}
              {step === 2 && (
                <div className="space-y-4">
                  <div className="space-y-1">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                      <Flame className="w-5 h-5 text-purple-400" /> Qual combustível você utiliza?
                    </h3>
                    <p className="text-xs text-slate-400">
                      Caso escolha elétrico, a interface omitirá consumo de litros e ativará monitoramento de custo em kWh.
                    </p>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2">
                    {[
                      { id: 'gasolina', name: 'Gasolina', icon: '⛽' },
                      { id: 'etanol', name: 'Etanol', icon: '🌱' },
                      { id: 'flex', name: 'Flex', icon: '🔄' },
                      { id: 'diesel', name: 'Diesel', icon: '🚛' },
                      { id: 'hybrid', name: 'Híbrido', icon: '⚡🔋' },
                      { id: 'electric', name: 'Elétrico', icon: '🔌' },
                    ].map(f => (
                      <button
                        key={f.id}
                        onClick={() => setFuel(f.id as any)}
                        className={`p-4 rounded-xl border text-center transition-all ${
                          fuel === f.id
                            ? 'border-purple-500 bg-purple-950/20 text-white'
                            : 'border-purple-950/40 bg-purple-950/5 text-slate-400 hover:border-purple-900/50'
                        }`}
                      >
                        <span className="text-xl block mb-1">{f.icon}</span>
                        <span className="font-bold text-xs block">{f.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* STEP 3: PLATFORMS */}
              {step === 3 && (
                <div className="space-y-4">
                  <div className="space-y-1">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                      <Network className="w-5 h-5 text-purple-400" /> Qual plataforma você utiliza?
                    </h3>
                    <p className="text-xs text-slate-400">
                      Selecione todas as que costuma trabalhar. O DriverDash adaptará os ganhos e taxas médias.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                    {[
                      { id: 'uber', name: 'Uber', desc: 'Passageiros, Comfort e Black' },
                      { id: '99', name: '99 App', desc: 'Pop, Compartilhado e Comfort' },
                      { id: 'indriver', name: 'InDrive', desc: 'Preço negociado pelo passageiro' },
                      { id: 'private', name: 'Particular / Privado', desc: 'Clientes fixos e corridas agendadas' },
                    ].map(p => {
                      const isSelected = platforms.includes(p.id);
                      return (
                        <button
                          key={p.id}
                          onClick={() => togglePlatform(p.id)}
                          className={`p-4 rounded-xl border text-left flex items-center justify-between transition-all ${
                            isSelected
                              ? 'border-purple-500 bg-purple-950/20 text-white'
                              : 'border-purple-950/40 bg-purple-950/5 text-slate-400 hover:border-purple-900/50'
                          }`}
                        >
                          <div>
                            <span className="font-bold text-xs text-white block">{p.name}</span>
                            <span className="text-[10px] text-slate-400 mt-0.5 block">{p.desc}</span>
                          </div>
                          <div className={`w-5 h-5 rounded-md border flex items-center justify-center transition-all ${
                            isSelected ? 'bg-purple-600 border-purple-500' : 'border-purple-950'
                          }`}>
                            {isSelected && <Check className="w-3.5 h-3.5 text-white" />}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* STEP 4: DAYS PER WEEK */}
              {step === 4 && (
                <div className="space-y-4">
                  <div className="space-y-1">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                      <Calendar className="w-5 h-5 text-purple-400" /> Quantos dias trabalha por semana?
                    </h3>
                    <p className="text-xs text-slate-400">
                      Usado para calcular projeções de ganho ideal, custo fixo por dia e metas operacionais.
                    </p>
                  </div>

                  <div className="flex flex-wrap justify-center gap-2 pt-4">
                    {[1, 2, 3, 4, 5, 6, 7].map(d => (
                      <button
                        key={d}
                        onClick={() => setDays(d)}
                        className={`w-12 h-12 rounded-xl border font-bold text-sm transition-all ${
                          days === d
                            ? 'border-purple-500 bg-purple-950/40 text-white shadow-lg shadow-purple-500/20'
                            : 'border-purple-950/40 bg-purple-950/5 text-slate-400 hover:border-purple-900/50'
                        }`}
                      >
                        {d}
                      </button>
                    ))}
                  </div>

                  <div className="text-center pt-2">
                    <span className="text-xs text-purple-300 font-medium">
                      Projeção: {days * 4} dias de trabalho por mês.
                    </span>
                  </div>
                </div>
              )}

              {/* STEP 5: HOURS PER DAY */}
              {step === 5 && (
                <div className="space-y-4">
                  <div className="space-y-1">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                      <Clock className="w-5 h-5 text-purple-400" /> Quantas horas trabalha por dia?
                    </h3>
                    <p className="text-xs text-slate-400">
                      Crucial para estimarmos sua rentabilidade por hora trabalhada em cada turno.
                    </p>
                  </div>

                  <div className="flex flex-wrap justify-center gap-2 pt-4">
                    {[4, 5, 6, 7, 8, 9, 10, 11, 12].map(h => (
                      <button
                        key={h}
                        onClick={() => setHours(h)}
                        className={`w-12 h-12 rounded-xl border font-bold text-sm transition-all ${
                          hours === h
                            ? 'border-purple-500 bg-purple-950/40 text-white shadow-lg shadow-purple-500/20'
                            : 'border-purple-950/40 bg-purple-950/5 text-slate-400 hover:border-purple-900/50'
                        }`}
                      >
                        {h}h
                      </button>
                    ))}
                  </div>

                  <div className="text-center pt-2">
                    <span className="text-xs text-indigo-300 font-medium">
                      Carga semanal estimada: {days * hours} horas nas ruas.
                    </span>
                  </div>
                </div>
              )}

              {/* STEP 6: OBJECTIVE / GOAL */}
              {step === 6 && (
                <div className="space-y-4">
                  <div className="space-y-1">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                      <Target className="w-5 h-5 text-purple-400" /> Qual o seu principal objetivo?
                    </h3>
                    <p className="text-xs text-slate-400">
                      O DriverDash Roxou irá sugerir estratégias e ocultar métricas secundárias com foco em sua meta.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 gap-2 pt-2">
                    {[
                      { id: 'max_profit', name: 'Maior lucro real', desc: 'Gastar o mínimo possível com combustível e quilometragem vazia.', icon: '💰' },
                      { id: 'max_revenue', name: 'Maior faturamento bruto', desc: 'Foco no volume total faturado no final do dia/semana.', icon: '📈' },
                      { id: 'min_wear', name: 'Menor desgaste do carro', desc: 'Proteger o patrimônio contra desvalorização e manutenção excessiva.', icon: '🛡️' },
                      { id: 'min_hours', name: 'Trabalhar menos horas', desc: 'Maximizar o ganho por hora e o tempo livre de lazer.', icon: '⏳' },
                      { id: 'other', name: 'Outro objetivo operacional', desc: 'Adaptar-se conforme a rotina do dia a dia.', icon: '⚙️' },
                    ].map(g => (
                      <button
                        key={g.id}
                        onClick={() => setGoal(g.id as any)}
                        className={`p-3 px-4 rounded-xl border text-left flex items-center gap-3 transition-all ${
                          goal === g.id
                            ? 'border-purple-500 bg-purple-950/25 text-white'
                            : 'border-purple-950/40 bg-purple-950/5 text-slate-400 hover:border-purple-900/50'
                        }`}
                      >
                        <span className="text-xl shrink-0">{g.icon}</span>
                        <div>
                          <span className="font-bold text-xs text-white block">{g.name}</span>
                          <span className="text-[10px] text-slate-400 mt-0.5 block leading-tight">{g.desc}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between border-t border-purple-950/60 pt-5 mt-6">
          <button
            onClick={handleBack}
            disabled={step === 1}
            className="px-4 py-2 text-xs font-bold text-slate-400 hover:text-white transition-all disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-1 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" /> Voltar
          </button>

          <button
            onClick={handleNext}
            className="px-5 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-500 hover:from-purple-500 hover:to-indigo-400 text-white font-bold rounded-xl text-xs flex items-center gap-2 shadow-[0_0_20px_rgba(147,51,234,0.3)] transition-all cursor-pointer active:scale-95"
          >
            {step === 6 ? (
              <>
                Concluir Configuração <Check className="w-4 h-4" />
              </>
            ) : (
              <>
                Avançar <ChevronRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
