import React, { useState, useEffect, useRef } from 'react';
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
import { onboardingService, OnboardingProgress } from '../modules/onboarding/onboarding.service';

interface OnboardingWizardProps {
  onComplete?: () => void;
}

export const OnboardingWizard: React.FC<OnboardingWizardProps> = ({ onComplete }) => {
  const { user, dbStatus, upsertVehicle, upsertVehicleCostSettings, completeOnboarding } = useApp();
  const [step, setStep] = useState(1);
  const [isLoadingProgress, setIsLoadingProgress] = useState(true);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  
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

  // Step 1 additions: Ownership costs
  const [rentalAmount, setRentalAmount] = useState<string>('550');
  const [weeklyKmLimit, setWeeklyKmLimit] = useState<string>('1000');
  const [operatingCosts, setOperatingCosts] = useState<string>('150');
  const [ipva, setIpva] = useState<string>('1200');
  const [insurance, setInsurance] = useState<string>('2400');
  const [maintenance, setMaintenance] = useState<string>('300');
  const [depreciation, setDepreciation] = useState<string>('500');

  // Step 2 additions: Fuel metrics
  const [kmPerLiter, setKmPerLiter] = useState<string>('10');
  const [fuelPrice, setFuelPrice] = useState<string>('5.80');
  const [kwhPer100km, setKwhPer100km] = useState<string>('16');
  const [electricityPrice, setElectricityPrice] = useState<string>('0.85');

  const isLoadedRef = useRef(false);
  const finishedRef = useRef(false);
  const isRecoveringRef = useRef(true);

  // 1. Dynamic priority state recovery (Supabase -> localStorage -> defaults)
  useEffect(() => {
    if (!user) return;
    
    const loadSavedProgress = async () => {
      setIsLoadingProgress(true);
      isRecoveringRef.current = true;
      try {
        const progress = await onboardingService.loadProgress(user.id, dbStatus === 'connected');
        
        // If progress is already completed, trigger completion on React Context and bypass mounting
        if (progress.onboarding_completed) {
          console.log('[ONBOARDING_ALREADY_COMPLETED] Onboarding já concluído detectado ao carregar progresso. Sincronizando estado...');
          finishedRef.current = true;
          await completeOnboarding();
          if (onComplete) {
            onComplete();
          }
          return;
        }

        // Recover values gracefully if they are valid
        if (progress.current_step) setStep(progress.current_step);
        if (progress.ownershipType) setOwnership(progress.ownershipType);
        if (progress.fuelType) setFuel(progress.fuelType);
        if (progress.platforms && progress.platforms.length > 0) setPlatforms(progress.platforms);
        if (progress.daysPerWeek) setDays(progress.daysPerWeek);
        if (progress.hoursPerDay) setHours(progress.hoursPerDay);
        if (progress.objective) setGoal(progress.objective);
        if (progress.brand) setBrand(progress.brand);
        if (progress.model) setModel(progress.model);
        if (progress.year) setYear(progress.year);

        // Recover additions
        if (progress.rentalAmount !== undefined) setRentalAmount(String(progress.rentalAmount));
        if (progress.weeklyKmLimit !== undefined) setWeeklyKmLimit(String(progress.weeklyKmLimit));
        if (progress.operatingCosts !== undefined) setOperatingCosts(String(progress.operatingCosts));
        if (progress.ipva !== undefined) setIpva(String(progress.ipva));
        if (progress.insurance !== undefined) setInsurance(String(progress.insurance));
        if (progress.maintenance !== undefined) setMaintenance(String(progress.maintenance));
        if (progress.depreciation !== undefined) setDepreciation(String(progress.depreciation));
        if (progress.kmPerLiter !== undefined) setKmPerLiter(String(progress.kmPerLiter));
        if (progress.fuelPrice !== undefined) setFuelPrice(String(progress.fuelPrice));
        if (progress.kwhPer100km !== undefined) setKwhPer100km(String(progress.kwhPer100km));
        if (progress.electricityPrice !== undefined) setElectricityPrice(String(progress.electricityPrice));
        
        if (progress.current_step && progress.current_step > 1) {
          console.log('[ONBOARDING] Recovery', progress.current_step);
        }
      } catch (err) {
        console.error('Error recovering onboarding progress:', err);
      } finally {
        setIsLoadingProgress(false);
        setTimeout(() => {
          isRecoveringRef.current = false;
          isLoadedRef.current = true;
        }, 150);
      }
    };
    
    loadSavedProgress();
  }, [user, dbStatus]);

  // 2. Debounced auto-saving for all fields
  useEffect(() => {
    if (isLoadingProgress || !user || !isLoadedRef.current || isRecoveringRef.current || finishedRef.current) return;

    setSaveStatus('saving');

    const progressPayload: OnboardingProgress = {
      ownershipType: ownership,
      fuelType: fuel,
      platforms,
      daysPerWeek: days,
      hoursPerDay: hours,
      objective: goal,
      brand,
      model,
      year,
      current_step: step,
      onboarding_completed: false,
      rentalAmount,
      weeklyKmLimit,
      operatingCosts,
      ipva,
      insurance,
      maintenance,
      depreciation,
      kmPerLiter,
      fuelPrice,
      kwhPer100km,
      electricityPrice
    };

    const timer = setTimeout(async () => {
      if (finishedRef.current) {
        console.log('[ONBOARDING] Skipping debounced auto-save as onboarding is completed');
        return;
      }
      const isDbConnected = dbStatus === 'connected';
      
      // Auto-save progress to both LocalStorage and Supabase
      const synced = await onboardingService.saveProgress(user.id, progressPayload, isDbConnected);
      
      // Incrementally update vehicle table if Step 1 details are valid
      const yearNum = Number(year);
      if (brand.trim() !== '' && model.trim() !== '' && !isNaN(yearNum) && yearNum >= 1980 && yearNum <= 2027) {
        try {
          const isElectric = fuel === 'electric';
          const isHybrid = fuel === 'hybrid';
          const vehiclePayload = {
            brand: brand,
            model: model,
            year: yearNum,
            plate_optional: '',
            fuel_type: fuel,
            km_per_liter: isElectric ? 0 : Number(kmPerLiter) || 10,
            ownership_type: ownership,
            weekly_km_limit: ownership === 'rented' ? Number(weeklyKmLimit) || 1000 : undefined,
            monthly_km_limit: ownership === 'rented' ? (Number(weeklyKmLimit) || 1000) * 4 : undefined,
            rental_amount: ownership === 'rented' ? Number(rentalAmount) || 550 : 0,
            rental_period: 'weekly' as const,
            rental_food_daily: 0,
            rental_damage_monthly: 0,
            rental_cleaning_monthly: 0,
            electric_consumption_kwh_100km: (isElectric || isHybrid) ? Number(kwhPer100km) || 16 : undefined,
            electricity_price_kwh: (isElectric || isHybrid) ? Number(electricityPrice) || 0.85 : undefined,
            charging_type: (isElectric || isHybrid) ? 'residential' as const : null
          };
          await upsertVehicle(vehiclePayload);

          // Also save to VehicleCostSettings
          const costPayload = {
            fuel_price: Number(fuelPrice) || 5.80,
            tire_cost: 600,
            tire_lifespan_km: 40000,
            oil_change_cost: 180,
            oil_change_interval_km: 10000,
            brake_cost: 250,
            brake_interval_km: 20000,
            insurance_yearly: ownership === 'own' ? Number(insurance) || 2400 : 0,
            ipva_yearly: ownership === 'own' ? Number(ipva) || 1200 : 0,
            licensing_yearly: ownership === 'own' ? 150 : 0,
            emergency_reserve_monthly: 100,
            financing_monthly: 0,
            maintenance_monthly: ownership === 'own' ? Number(maintenance) || 300 : 0,
          };
          await upsertVehicleCostSettings(costPayload);
        } catch (e) {
          console.warn('Incremental vehicle upsert missed:', e);
        }
      }

      if (synced) {
        setSaveStatus('saved');
      } else {
        setSaveStatus('error');
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [ownership, fuel, platforms, days, hours, goal, brand, model, year, step, isLoadingProgress, user, dbStatus, rentalAmount, weeklyKmLimit, operatingCosts, ipva, insurance, maintenance, depreciation, kmPerLiter, fuelPrice, kwhPer100km, electricityPrice]);

  // Clear "Configuração salva" feedback after 2 seconds
  useEffect(() => {
    if (saveStatus === 'saved') {
      const timer = setTimeout(() => {
        setSaveStatus('idle');
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [saveStatus]);

  // 3. Background/offline sync retry listener
  useEffect(() => {
    if (!user) return;

    const attemptSync = async () => {
      const isDbConnected = dbStatus === 'connected';
      if (isDbConnected) {
        const synced = await onboardingService.syncPendingProgress(user.id, isDbConnected);
        if (synced) {
          setSaveStatus('saved');
        }
      }
    };

    window.addEventListener('online', attemptSync);
    const interval = setInterval(attemptSync, 15000); // retry every 15 seconds

    return () => {
      window.removeEventListener('online', attemptSync);
      clearInterval(interval);
    };
  }, [user, dbStatus]);

  // 4. Validations
  const getAutoProfile = () => {
    if (hours >= 10) return "Alta Intensidade";
    if (days >= 6) return "Full Time";
    const isMulti = platforms.includes('uber') && platforms.includes('99') && platforms.includes('indriver');
    if (isMulti) return "Multi Plataforma";
    return "Padrão / Moderado";
  };

  const isFormValid = () => {
    if (step === 1) {
      const yearNum = Number(year);
      const isVehicleDetailsValid = (
        year !== '' &&
        year.length === 4 &&
        !isNaN(yearNum) &&
        yearNum >= 1980 &&
        yearNum <= 2027 &&
        brand?.trim().length > 1 &&
        model?.trim().length > 1
      );

      if (!isVehicleDetailsValid) return false;

      if (ownership === 'rented') {
        const rental = Number(rentalAmount);
        const limit = Number(weeklyKmLimit);
        return !isNaN(rental) && rental > 0 && !isNaN(limit) && limit > 0;
      } else {
        const ipvaNum = Number(ipva);
        const insNum = Number(insurance);
        const maintNum = Number(maintenance);
        const depNum = Number(depreciation);
        return !isNaN(ipvaNum) && ipvaNum >= 0 &&
               !isNaN(insNum) && insNum >= 0 &&
               !isNaN(maintNum) && maintNum >= 0 &&
               !isNaN(depNum) && depNum >= 0;
      }
    }
    if (step === 2) {
      if (fuel === 'electric') {
        const kwh = Number(kwhPer100km);
        const price = Number(electricityPrice);
        return !isNaN(kwh) && kwh > 0 && !isNaN(price) && price > 0;
      } else if (fuel === 'hybrid') {
        const kml = Number(kmPerLiter);
        const fprice = Number(fuelPrice);
        const kwh = Number(kwhPer100km);
        const price = Number(electricityPrice);
        return !isNaN(kml) && kml > 0 && !isNaN(fprice) && fprice > 0 &&
               !isNaN(kwh) && kwh > 0 && !isNaN(price) && price > 0;
      } else {
        const kml = Number(kmPerLiter);
        const fprice = Number(fuelPrice);
        return !isNaN(kml) && kml > 0 && !isNaN(fprice) && fprice > 0;
      }
    }
    if (step === 3) {
      return platforms.length > 0;
    }
    return true;
  };

  // Get estimated remaining time
  const getEstimatedTime = () => {
    switch (step) {
      case 1: return '≈ 50 segundos restantes';
      case 2: return '≈ 40 segundos restantes';
      case 3: return '≈ 30 segundos restantes';
      case 4: return '≈ 20 segundos restantes';
      case 5: return '≈ 10 segundos restantes';
      case 6: return '≈ 5 segundos restantes';
      default: return '≈ 30 segundos restantes';
    }
  };

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
    if (!isFormValid()) return;
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
      if (!user) return;
      finishedRef.current = true; // Set instantly to block any pending auto-saves

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

      // 5. Update final completed progress payload
      const progressPayload: OnboardingProgress = {
        ownershipType: ownership,
        fuelType: fuel,
        platforms,
        daysPerWeek: days,
        hoursPerDay: hours,
        objective: goal,
        brand,
        model,
        year,
        current_step: step,
        onboarding_completed: true
      };

      await onboardingService.saveProgress(user.id, progressPayload, dbStatus === 'connected');

      // 6. Set completed status in DB and Context
      await completeOnboarding();

      console.log('[ONBOARDING_SAVE_COMPLETED] Onboarding concluído com sucesso!');

      if (onComplete) {
        onComplete();
      }
    } catch (e) {
      console.error('Failed to complete onboarding wizard:', e);
    }
  };

  const percentComplete = Math.round((step / 6) * 100);

  return (
    <div 
      className="fixed inset-0 z-50 bg-[#04010a]/95 backdrop-blur-md flex flex-col items-center justify-start md:justify-center overflow-hidden"
      style={{
        height: '100dvh',
        minHeight: '100dvh',
        paddingTop: 'env(safe-area-inset-top, 0px)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        paddingLeft: 'env(safe-area-inset-left, 0px)',
        paddingRight: 'env(safe-area-inset-right, 0px)',
      }}
    >
      <div className="w-full max-w-xl h-full md:h-auto md:max-h-[90vh] bg-gradient-to-b from-[#110729] to-[#04010b] border-0 md:border md:border-purple-500/30 rounded-none md:rounded-3xl shadow-[0_0_50px_rgba(147,51,234,0.15)] relative overflow-hidden flex flex-col onboarding-card">
        {/* Glowing background elements */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-purple-600/10 rounded-full filter blur-2xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-indigo-600/10 rounded-full filter blur-2xl pointer-events-none" />

        {/* Header - Fixed top */}
        <div className="p-4 sm:p-6 pb-3 border-b border-purple-950/30 shrink-0 relative z-10">
          <div className="flex items-center justify-between gap-2 text-[10px] font-mono font-bold tracking-wider select-none">
            <div className="flex items-center gap-1.5 text-purple-400 uppercase truncate">
              <span>Passo {step}/6</span>
              <span className="text-purple-600">•</span>
              <span className="text-slate-400 font-normal lowercase">{getEstimatedTime()} restando</span>
            </div>
            
            <div className="flex items-center gap-1.5 shrink-0">
              {saveStatus === 'saving' && (
                <span className="text-[8px] font-medium text-amber-400 animate-pulse bg-amber-950/30 px-1.5 py-0.5 rounded border border-amber-900/40 truncate">✔ Salvando</span>
              )}
              {saveStatus === 'saved' && (
                <span className="text-[8px] font-medium text-emerald-400 bg-emerald-950/30 px-1.5 py-0.5 rounded border border-emerald-900/40 truncate">✔ Salvo</span>
              )}
              {saveStatus === 'error' && (
                <span className="text-[8px] font-medium text-yellow-500 bg-yellow-950/30 px-1.5 py-0.5 rounded border border-yellow-900/40 truncate">✔ Offline</span>
              )}
              <span className="text-purple-300">
                {percentComplete}%
              </span>
            </div>
          </div>

          <div className="h-1.5 w-full bg-[#070311] rounded-full overflow-hidden border border-purple-950/45 mt-2.5">
            <motion.div 
              className="h-full bg-gradient-to-r from-purple-500 to-indigo-500 rounded-full"
              initial={{ width: '0%' }}
              animate={{ width: `${percentComplete}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
        </div>

        {/* Scrollable Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 relative z-10">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 15 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -15 }}
              transition={{ duration: 0.2 }}
              className="space-y-4"
            >
              {/* STEP 1: VEHICLE TYPE */}
              {step === 1 && (
                <div className="space-y-4">
                  <div className="space-y-1">
                    <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                      <Car className="w-5 h-5 text-purple-400" /> Qual veículo você utiliza?
                    </h3>
                    <p className="text-xs text-slate-400 leading-normal">
                      Iremos personalizar as opções de depreciação, taxas e alertas com base nessa escolha.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    <button
                      onClick={() => setOwnership('own')}
                      className={`p-4 sm:p-5 rounded-2xl border-2 text-left transition-all ${
                        ownership === 'own'
                          ? 'border-purple-500 bg-purple-950/30'
                          : 'border-purple-950/40 bg-purple-950/5 hover:border-purple-900/50'
                      }`}
                    >
                      <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-purple-500/20 flex items-center justify-center text-purple-400 mb-2 sm:mb-3">
                        <Gem className="w-4 h-4 sm:w-5 sm:h-5" />
                      </div>
                      <span className="font-bold text-xs sm:text-sm text-white block">Veículo Próprio / Financiado</span>
                      <span className="text-[10px] sm:text-[11px] text-slate-400 mt-1 block leading-normal sm:leading-relaxed">
                        IPVA, seguro, depreciação, manutenção e revenda sob seu controle.
                      </span>
                    </button>

                    <button
                      onClick={() => setOwnership('rented')}
                      className={`p-4 sm:p-5 rounded-2xl border-2 text-left transition-all ${
                        ownership === 'rented'
                          ? 'border-purple-500 bg-purple-950/30'
                          : 'border-purple-950/40 bg-purple-950/5 hover:border-purple-900/50'
                      }`}
                    >
                      <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-indigo-500/20 flex items-center justify-center text-indigo-400 mb-2 sm:mb-3">
                        <Car className="w-4 h-4 sm:w-5 sm:h-5" />
                      </div>
                      <span className="font-bold text-xs sm:text-sm text-white block">Veículo Alugado</span>
                      <span className="text-[10px] sm:text-[11px] text-slate-400 mt-1 block leading-normal sm:leading-relaxed">
                        Ignore IPVA e desvalorização. Foco em limites de quilometragem e valor de aluguel.
                      </span>
                    </button>
                  </div>

                  <div className="pt-2">
                    <label className="block text-[10px] text-slate-400 uppercase tracking-wider mb-2">Dados Obrigatórios do Veículo</label>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="space-y-1 text-left">
                        <input 
                          type="text" 
                          placeholder="Marca" 
                          value={brand} 
                          onChange={e => setBrand(e.target.value)}
                          className={`bg-[#030107] border rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-purple-600 w-full ${
                            brand && brand.trim().length <= 1
                              ? 'border-red-500/50 focus:border-red-500'
                              : 'border-purple-950/50'
                          }`}
                        />
                        {brand && brand.trim().length <= 1 && (
                          <span className="text-[9px] text-red-400 block px-1">Mínimo 2 letras</span>
                        )}
                      </div>

                      <div className="space-y-1 text-left">
                        <input 
                          type="text" 
                          placeholder="Modelo" 
                          value={model} 
                          onChange={e => setModel(e.target.value)}
                          className={`bg-[#030107] border rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-purple-600 w-full ${
                            model && model.trim().length <= 1
                              ? 'border-red-500/50 focus:border-red-500'
                              : 'border-purple-950/50'
                          }`}
                        />
                        {model && model.trim().length <= 1 && (
                          <span className="text-[9px] text-red-400 block px-1">Mínimo 2 letras</span>
                        )}
                      </div>

                      <div className="space-y-1 text-left">
                        <input 
                          type="text" 
                          placeholder="Ano" 
                          value={year} 
                          onChange={e => {
                            const sanitized = e.target.value.replace(/\D/g, '').slice(0, 4);
                            setYear(sanitized);
                          }}
                          className={`bg-[#030107] border rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-purple-600 w-full ${
                            year && (year.length !== 4 || Number(year) < 1980 || Number(year) > 2027)
                              ? 'border-red-500/50 focus:border-red-500'
                              : 'border-purple-950/50'
                          }`}
                        />
                        {year && (year.length !== 4 || Number(year) < 1980 || Number(year) > 2027) && (
                          <span className="text-[9px] text-red-400 block px-1">Ano inválido (1980-2027)</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Dynamic Cost Settings - Intelligent Adaptation */}
                  <div className="border-t border-purple-950/40 pt-3 mt-1 space-y-3">
                    {ownership === 'rented' ? (
                      <div className="space-y-3">
                        <span className="block text-[10px] text-slate-400 uppercase tracking-wider font-bold">Custos do Aluguel (Auto-adaptado)</span>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1 text-left">
                            <label className="block text-[10px] text-slate-400">Aluguel Semanal (R$)</label>
                            <input 
                              type="text" 
                              placeholder="ex: 550" 
                              value={rentalAmount} 
                              onChange={e => setRentalAmount(e.target.value.replace(/[^0-9.]/g, ''))}
                              className={`bg-[#030107] border rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-purple-600 w-full ${
                                rentalAmount && (isNaN(Number(rentalAmount)) || Number(rentalAmount) <= 0) ? 'border-red-500/50' : 'border-purple-950/50'
                              }`}
                            />
                            {rentalAmount && (isNaN(Number(rentalAmount)) || Number(rentalAmount) <= 0) && (
                              <span className="text-[9px] text-red-400 block">Insira um valor válido</span>
                            )}
                          </div>

                          <div className="space-y-1 text-left">
                            <div className="flex justify-between items-center">
                              <label className="block text-[10px] text-slate-400">Aluguel Mensal (R$)</label>
                              <span className="text-[8px] text-slate-500 italic">calculado automaticamente</span>
                            </div>
                            <input 
                              type="text" 
                              readOnly
                              value={rentalAmount ? `R$ ${(Number(rentalAmount) * 4).toFixed(0)}` : 'R$ 0'}
                              className="bg-[#05020c] border border-dashed border-slate-700/50 rounded-xl p-2.5 text-xs text-purple-300 font-bold font-mono focus:outline-none w-full select-none cursor-default"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1 text-left">
                            <label className="block text-[10px] text-slate-400">Franquia KM Semanal</label>
                            <input 
                              type="text" 
                              placeholder="ex: 1000" 
                              value={weeklyKmLimit} 
                              onChange={e => setWeeklyKmLimit(e.target.value.replace(/[^0-9.]/g, ''))}
                              className={`bg-[#030107] border rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-purple-600 w-full ${
                                weeklyKmLimit && (isNaN(Number(weeklyKmLimit)) || Number(weeklyKmLimit) <= 0) ? 'border-red-500/50' : 'border-purple-950/50'
                              }`}
                            />
                            {weeklyKmLimit && (isNaN(Number(weeklyKmLimit)) || Number(weeklyKmLimit) <= 0) && (
                              <span className="text-[9px] text-red-400 block">Insira uma franquia válida</span>
                            )}
                          </div>

                          <div className="space-y-1 text-left">
                            <div className="flex justify-between items-center">
                              <label className="block text-[10px] text-slate-400">Projeção KM Mensal</label>
                              <span className="text-[8px] text-slate-500 italic">calculado automaticamente</span>
                            </div>
                            <input 
                              type="text" 
                              readOnly
                              value={weeklyKmLimit ? `${Number(weeklyKmLimit) * 4} km` : '0 km'}
                              className="bg-[#05020c] border border-dashed border-slate-700/50 rounded-xl p-2.5 text-xs text-purple-300 font-bold font-mono focus:outline-none w-full select-none cursor-default"
                            />
                          </div>
                        </div>

                        <div className="space-y-1 text-left">
                          <label className="block text-[10px] text-slate-400">Custos Operacionais Mensais (Lavagem, Internet, etc)</label>
                          <input 
                            type="text" 
                            placeholder="ex: 150" 
                            value={operatingCosts} 
                            onChange={e => setOperatingCosts(e.target.value.replace(/[^0-9.]/g, ''))}
                            className="bg-[#030107] border border-purple-950/50 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-purple-600 w-full"
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <span className="block text-[10px] text-slate-400 uppercase tracking-wider font-bold">Custos Fixos do Veículo Próprio (Auto-adaptado)</span>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1 text-left">
                            <label className="block text-[10px] text-slate-400">IPVA Anual (R$)</label>
                            <input 
                              type="text" 
                              placeholder="ex: 1200" 
                              value={ipva} 
                              onChange={e => setIpva(e.target.value.replace(/[^0-9.]/g, ''))}
                              className="bg-[#030107] border border-purple-950/50 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-purple-600 w-full"
                            />
                          </div>

                          <div className="space-y-1 text-left">
                            <label className="block text-[10px] text-slate-400">Seguro Anual (R$)</label>
                            <input 
                              type="text" 
                              placeholder="ex: 2400" 
                              value={insurance} 
                              onChange={e => setInsurance(e.target.value.replace(/[^0-9.]/g, ''))}
                              className="bg-[#030107] border border-purple-950/50 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-purple-600 w-full"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1 text-left">
                            <label className="block text-[10px] text-slate-400">Manutenção Mensal (R$)</label>
                            <input 
                              type="text" 
                              placeholder="ex: 300" 
                              value={maintenance} 
                              onChange={e => setMaintenance(e.target.value.replace(/[^0-9.]/g, ''))}
                              className="bg-[#030107] border border-purple-950/50 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-purple-600 w-full"
                            />
                          </div>

                          <div className="space-y-1 text-left">
                            <label className="block text-[10px] text-slate-400">Depreciação Mensal (R$)</label>
                            <input 
                              type="text" 
                              placeholder="ex: 500" 
                              value={depreciation} 
                              onChange={e => setDepreciation(e.target.value.replace(/[^0-9.]/g, ''))}
                              className="bg-[#030107] border border-purple-950/50 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-purple-600 w-full"
                            />
                          </div>
                        </div>

                        <div className="space-y-1 text-left bg-[#05020c] border border-dashed border-purple-950/50 rounded-xl p-3">
                          <div className="flex justify-between items-center">
                            <span className="text-[10px] text-slate-400 font-medium">Custo Fixo Mensal Estimado</span>
                            <span className="text-[8px] text-slate-500 italic">calculado automaticamente</span>
                          </div>
                          <div className="text-sm font-bold text-purple-300 font-mono mt-1">
                            R$ {((Number(ipva) || 0) / 12 + (Number(insurance) || 0) / 12 + (Number(maintenance) || 0) + (Number(depreciation) || 0)).toFixed(2)} / mês
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* STEP 2: FUEL TYPE */}
              {step === 2 && (
                <div className="space-y-4">
                  <div className="space-y-1">
                    <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                      <Flame className="w-5 h-5 text-purple-400" /> Qual combustível você utiliza?
                    </h3>
                    <p className="text-xs text-slate-400 leading-normal">
                      Caso escolha elétrico, a interface omitirá consumo de litros e ativará monitoramento de custo em kWh.
                    </p>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3 pt-1">
                    {[
                      { id: 'gasolina', name: 'Gasolina', icon: '⛽' },
                      { id: 'etanol', name: 'Etanol', icon: '🌱' },
                      { id: 'flex', name: 'Flex', icon: '🔄' },
                      { id: 'diesel', name: 'Diesel', icon: '🚛' },
                      { id: 'hybrid', name: 'Híbrido', icon: '🔋' },
                      { id: 'electric', name: 'Elétrico', icon: '🔌' },
                    ].map(f => (
                      <button
                        key={f.id}
                        onClick={() => setFuel(f.id as any)}
                        className={`p-3 sm:p-4 rounded-xl border text-center transition-all ${
                          fuel === f.id
                            ? 'border-purple-500 bg-purple-950/20 text-white shadow-lg shadow-purple-500/10'
                            : 'border-purple-950/40 bg-purple-950/5 text-slate-400 hover:border-purple-900/50'
                        }`}
                      >
                        <span className="text-lg sm:text-xl block mb-1">{f.icon}</span>
                        <span className="font-bold text-xs block">{f.name}</span>
                      </button>
                    ))}
                  </div>

                  {/* Dynamic Fuel Metric Cost Inputs - Auto Adaptation */}
                  <div className="border-t border-purple-950/40 pt-3 mt-1 space-y-3">
                    {fuel === 'electric' ? (
                      <div className="space-y-3">
                        <span className="block text-[10px] text-slate-400 uppercase tracking-wider font-bold text-left">Métricas de Energia Elétrica (Auto-adaptado)</span>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1 text-left">
                            <label className="block text-[10px] text-slate-400">Consumo (kWh/100km)</label>
                            <input 
                              type="text" 
                              placeholder="ex: 16" 
                              value={kwhPer100km} 
                              onChange={e => setKwhPer100km(e.target.value.replace(/[^0-9.]/g, ''))}
                              className={`bg-[#030107] border rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-purple-600 w-full ${
                                kwhPer100km && (isNaN(Number(kwhPer100km)) || Number(kwhPer100km) <= 0) ? 'border-red-500/50' : 'border-purple-950/50'
                              }`}
                            />
                            {kwhPer100km && (isNaN(Number(kwhPer100km)) || Number(kwhPer100km) <= 0) && (
                              <span className="text-[9px] text-red-400 block">Insira um valor válido</span>
                            )}
                          </div>

                          <div className="space-y-1 text-left">
                            <label className="block text-[10px] text-slate-400">Preço do kWh (R$)</label>
                            <input 
                              type="text" 
                              placeholder="ex: 0.85" 
                              value={electricityPrice} 
                              onChange={e => setElectricityPrice(e.target.value.replace(/[^0-9.]/g, ''))}
                              className={`bg-[#030107] border rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-purple-600 w-full ${
                                electricityPrice && (isNaN(Number(electricityPrice)) || Number(electricityPrice) <= 0) ? 'border-red-500/50' : 'border-purple-950/50'
                              }`}
                            />
                            {electricityPrice && (isNaN(Number(electricityPrice)) || Number(electricityPrice) <= 0) && (
                              <span className="text-[9px] text-red-400 block">Insira um preço válido</span>
                            )}
                          </div>
                        </div>

                        <div className="space-y-1 text-left bg-[#05020c] border border-dashed border-purple-950/50 rounded-xl p-3">
                          <div className="flex justify-between items-center">
                            <span className="text-[10px] text-slate-400 font-medium">Custo por KM Estimado</span>
                            <span className="text-[8px] text-slate-500 italic">calculado automaticamente</span>
                          </div>
                          <div className="text-sm font-bold text-purple-300 font-mono mt-1">
                            R$ {(((Number(kwhPer100km) || 0) / 100) * (Number(electricityPrice) || 0)).toFixed(2)} / km
                          </div>
                        </div>
                      </div>
                    ) : fuel === 'hybrid' ? (
                      <div className="space-y-3">
                        <span className="block text-[10px] text-slate-400 uppercase tracking-wider font-bold text-left">Métricas Híbridas (Auto-adaptado)</span>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1 text-left">
                            <label className="block text-[10px] text-slate-400">Consumo de Combustível (km/L)</label>
                            <input 
                              type="text" 
                              placeholder="ex: 18" 
                              value={kmPerLiter} 
                              onChange={e => setKmPerLiter(e.target.value.replace(/[^0-9.]/g, ''))}
                              className="bg-[#030107] border border-purple-950/50 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-purple-600 w-full"
                            />
                          </div>

                          <div className="space-y-1 text-left">
                            <label className="block text-[10px] text-slate-400">Preço do Combustível (R$/L)</label>
                            <input 
                              type="text" 
                              placeholder="ex: 5.80" 
                              value={fuelPrice} 
                              onChange={e => setFuelPrice(e.target.value.replace(/[^0-9.]/g, ''))}
                              className="bg-[#030107] border border-purple-950/50 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-purple-600 w-full"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1 text-left">
                            <label className="block text-[10px] text-slate-400">Consumo Elétrico (kWh/100km)</label>
                            <input 
                              type="text" 
                              placeholder="ex: 12" 
                              value={kwhPer100km} 
                              onChange={e => setKwhPer100km(e.target.value.replace(/[^0-9.]/g, ''))}
                              className="bg-[#030107] border border-purple-950/50 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-purple-600 w-full"
                            />
                          </div>

                          <div className="space-y-1 text-left">
                            <label className="block text-[10px] text-slate-400">Preço do kWh (R$)</label>
                            <input 
                              type="text" 
                              placeholder="ex: 0.85" 
                              value={electricityPrice} 
                              onChange={e => setElectricityPrice(e.target.value.replace(/[^0-9.]/g, ''))}
                              className="bg-[#030107] border border-purple-950/50 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-purple-600 w-full"
                            />
                          </div>
                        </div>

                        <div className="space-y-1 text-left bg-[#05020c] border border-dashed border-purple-950/50 rounded-xl p-3">
                          <div className="flex justify-between items-center">
                            <span className="text-[10px] text-slate-400 font-medium">Custo por KM Estimado (50% Combustível / 50% Elétrico)</span>
                            <span className="text-[8px] text-slate-500 italic">calculado automaticamente</span>
                          </div>
                          <div className="text-sm font-bold text-purple-300 font-mono mt-1">
                            R$ {(((Number(fuelPrice) || 0) / (Number(kmPerLiter) || 12)) * 0.5 + (((Number(kwhPer100km) || 0) / 100) * (Number(electricityPrice) || 0)) * 0.5).toFixed(2)} / km
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <span className="block text-[10px] text-slate-400 uppercase tracking-wider font-bold text-left">Métricas de Consumo (Auto-adaptado)</span>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1 text-left">
                            <label className="block text-[10px] text-slate-400">Consumo (km/L)</label>
                            <input 
                              type="text" 
                              placeholder="ex: 10" 
                              value={kmPerLiter} 
                              onChange={e => setKmPerLiter(e.target.value.replace(/[^0-9.]/g, ''))}
                              className={`bg-[#030107] border rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-purple-600 w-full ${
                                kmPerLiter && (isNaN(Number(kmPerLiter)) || Number(kmPerLiter) <= 0) ? 'border-red-500/50' : 'border-purple-950/50'
                              }`}
                            />
                            {kmPerLiter && (isNaN(Number(kmPerLiter)) || Number(kmPerLiter) <= 0) && (
                              <span className="text-[9px] text-red-400 block">Insira um valor de consumo válido</span>
                            )}
                          </div>

                          <div className="space-y-1 text-left">
                            <label className="block text-[10px] text-slate-400">Preço do Litro (R$)</label>
                            <input 
                              type="text" 
                              placeholder="ex: 5.80" 
                              value={fuelPrice} 
                              onChange={e => setFuelPrice(e.target.value.replace(/[^0-9.]/g, ''))}
                              className={`bg-[#030107] border rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-purple-600 w-full ${
                                fuelPrice && (isNaN(Number(fuelPrice)) || Number(fuelPrice) <= 0) ? 'border-red-500/50' : 'border-purple-950/50'
                              }`}
                            />
                            {fuelPrice && (isNaN(Number(fuelPrice)) || Number(fuelPrice) <= 0) && (
                              <span className="text-[9px] text-red-400 block">Insira um preço válido</span>
                            )}
                          </div>
                        </div>

                        <div className="space-y-1 text-left bg-[#05020c] border border-dashed border-purple-950/50 rounded-xl p-3">
                          <div className="flex justify-between items-center">
                            <span className="text-[10px] text-slate-400 font-medium">Custo por KM Estimado</span>
                            <span className="text-[8px] text-slate-500 italic">calculado automaticamente</span>
                          </div>
                          <div className="text-sm font-bold text-purple-300 font-mono mt-1">
                            R$ {((Number(fuelPrice) || 0) / (Number(kmPerLiter) || 10)).toFixed(2)} / km
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* STEP 3: PLATFORMS */}
              {step === 3 && (
                <div className="space-y-4">
                  <div className="space-y-1">
                    <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                      <Network className="w-5 h-5 text-purple-400" /> Qual plataforma você utiliza?
                    </h3>
                    <p className="text-xs text-slate-400 leading-normal">
                      Selecione todas as que costuma trabalhar. O DriverDash adaptará os ganhos e taxas médias.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 pt-1">
                    {[
                      { id: 'uber', name: 'Uber', desc: 'Passageiros, Comfort e Black' },
                      { id: '99', name: '99 App', desc: 'Pop, Comfort e Black' },
                      { id: 'indriver', name: 'InDrive', desc: 'Preço negociado diretamente' },
                      { id: 'private', name: 'Particular / Privado', desc: 'Clientes fixos e agendados' },
                    ].map(p => {
                      const isSelected = platforms.includes(p.id);
                      return (
                        <button
                          key={p.id}
                          onClick={() => togglePlatform(p.id)}
                          className={`p-3 sm:p-4 rounded-xl border text-left flex items-center justify-between transition-all ${
                            isSelected
                              ? 'border-purple-500 bg-purple-950/20 text-white'
                              : 'border-purple-950/40 bg-purple-950/5 text-slate-400 hover:border-purple-900/50'
                          }`}
                        >
                          <div>
                            <span className="font-bold text-xs text-white block">{p.name}</span>
                            <span className="text-[10px] text-slate-400 mt-0.5 block">{p.desc}</span>
                          </div>
                          <div className={`w-5 h-5 rounded-md border flex items-center justify-center transition-all shrink-0 ${
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
                    <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                      <Calendar className="w-5 h-5 text-purple-400" /> Quantos dias trabalha por semana?
                    </h3>
                    <p className="text-xs text-slate-400 leading-normal">
                      Usado para calcular projeções de ganho ideal, custo fixo por dia e metas operacionais.
                    </p>
                  </div>

                  <div className="grid grid-cols-7 sm:flex sm:flex-wrap justify-center gap-1.5 sm:gap-2 pt-2">
                    {[1, 2, 3, 4, 5, 6, 7].map(d => (
                      <button
                        key={d}
                        onClick={() => setDays(d)}
                        className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl border font-bold text-xs sm:text-sm transition-all flex items-center justify-center ${
                          days === d
                            ? 'border-purple-500 bg-purple-950/40 text-white shadow-lg shadow-purple-500/20'
                            : 'border-purple-950/40 bg-purple-950/5 text-slate-400 hover:border-purple-900/50'
                        }`}
                      >
                        {d}
                      </button>
                    ))}
                  </div>

                  <div className="pt-2 space-y-2">
                    <div className="bg-[#030107]/50 border border-dashed border-purple-950/40 rounded-xl p-3 text-center">
                      <span className="block text-[10px] text-slate-500 uppercase tracking-wider mb-1">calculado automaticamente</span>
                      <span className="text-xs sm:text-sm font-bold text-purple-300 font-mono">
                        {days * 4} dias de trabalho por mês
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 5: HOURS PER DAY */}
              {step === 5 && (
                <div className="space-y-4">
                  <div className="space-y-1">
                    <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                      <Clock className="w-5 h-5 text-purple-400" /> Quantas horas trabalha por dia?
                    </h3>
                    <p className="text-xs text-slate-400 leading-normal">
                      Crucial para estimarmos sua rentabilidade por hora trabalhada em cada turno.
                    </p>
                  </div>

                  <div className="grid grid-cols-5 sm:flex sm:flex-wrap justify-center gap-1.5 sm:gap-2 pt-2">
                    {[4, 5, 6, 7, 8, 9, 10, 11, 12].map(h => (
                      <button
                        key={h}
                        onClick={() => setHours(h)}
                        className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl border font-bold text-xs sm:text-sm transition-all flex items-center justify-center ${
                          hours === h
                            ? 'border-purple-500 bg-purple-950/40 text-white shadow-lg shadow-purple-500/20'
                            : 'border-purple-950/40 bg-purple-950/5 text-slate-400 hover:border-purple-900/50'
                        }`}
                      >
                        {h}h
                      </button>
                    ))}
                  </div>

                  <div className="pt-2 space-y-3">
                    <div className="grid grid-cols-2 gap-2">
                      <div className="bg-[#030107]/50 border border-dashed border-purple-950/40 rounded-xl p-3 text-center">
                        <span className="block text-[9px] text-slate-500 uppercase tracking-wider mb-1">Carga semanal</span>
                        <span className="text-xs sm:text-sm font-bold text-purple-300 font-mono">
                          {days * hours}h por semana
                        </span>
                      </div>
                      <div className="bg-[#030107]/50 border border-dashed border-purple-950/40 rounded-xl p-3 text-center">
                        <span className="block text-[9px] text-slate-500 uppercase tracking-wider mb-1">Carga mensal</span>
                        <span className="text-xs sm:text-sm font-bold text-indigo-300 font-mono">
                          {days * 4 * hours}h por mês
                        </span>
                      </div>
                    </div>

                    <div className="bg-[#030107]/60 border border-purple-950/40 rounded-xl p-3 flex items-center justify-between">
                      <div className="text-left">
                        <span className="block text-[9px] text-slate-500 uppercase tracking-wider">Perfil de Uso Estimado</span>
                        <span className="text-xs sm:text-sm font-bold text-white mt-1 block">
                          💡 {getAutoProfile()}
                        </span>
                      </div>
                      <span className="px-2 py-0.5 bg-purple-950/50 border border-purple-500/20 text-purple-300 font-mono text-[9px] font-bold rounded-full uppercase tracking-wider shrink-0 ml-2">
                        auto-calculado
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 6: OBJECTIVE / GOAL */}
              {step === 6 && (
                <div className="space-y-4">
                  <div className="space-y-1">
                    <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                      <Target className="w-5 h-5 text-purple-400" /> Qual o seu principal objetivo?
                    </h3>
                    <p className="text-xs text-slate-400 leading-normal">
                      O DriverDash Roxou irá sugerir estratégias e ocultar métricas secundárias com foco em sua meta.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 gap-1.5 sm:gap-2 pt-1">
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
                        className={`p-2.5 sm:p-3 px-3 sm:px-4 rounded-xl border text-left flex items-center gap-2.5 sm:gap-3 transition-all ${
                          goal === g.id
                            ? 'border-purple-500 bg-purple-950/25 text-white shadow-md'
                            : 'border-purple-950/40 bg-purple-950/5 text-slate-400 hover:border-purple-900/50'
                        }`}
                      >
                        <span className="text-lg sm:text-xl shrink-0">{g.icon}</span>
                        <div>
                          <span className="font-bold text-xs text-white block">{g.name}</span>
                          <span className="text-[10px] text-slate-400 mt-0.5 block leading-tight">{g.desc}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Validation Warning banner - Scrolls with content */}
              {!isFormValid() && (
                <div className="text-[11px] text-amber-400 bg-amber-950/20 border border-amber-900/30 rounded-xl p-3 flex items-start gap-2.5 select-none">
                  <ShieldAlert className="w-4 h-4 shrink-0 text-amber-500 animate-pulse mt-0.5" />
                  <div className="flex-1 leading-normal">
                    {step === 1 && (
                      <p>Por favor, preencha a marca, modelo, ano de fabricação (1980-2027) e garanta que todos os custos sejam valores numéricos maiores que zero.</p>
                    )}
                    {step === 2 && (
                      <p>Por favor, garanta que todos os parâmetros de consumo e preço de energia ou combustível sejam preenchidos com valores válidos maiores que zero.</p>
                    )}
                    {step === 3 && (
                      <p>Selecione pelo menos uma plataforma de aplicativo para prosseguir.</p>
                    )}
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Footer Actions - Fixed Bottom with safe area padding */}
        <div 
          className="p-4 sm:p-6 border-t border-purple-950/60 shrink-0 bg-[#04010b]/90 backdrop-blur-md flex items-center justify-between gap-4 z-20"
          style={{
            paddingBottom: 'calc(1rem + env(safe-area-inset-bottom, 0px))'
          }}
        >
          <button
            onClick={handleBack}
            disabled={step === 1}
            className="px-4 py-2 text-xs font-bold text-slate-400 hover:text-white transition-all disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-1 cursor-pointer select-none"
          >
            <ArrowLeft className="w-4 h-4" /> Voltar
          </button>

          <button
            onClick={handleNext}
            disabled={!isFormValid()}
            className="px-5 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-500 hover:from-purple-500 hover:to-indigo-400 text-white font-bold rounded-xl text-xs flex items-center gap-2 shadow-[0_0_20px_rgba(147,51,234,0.3)] transition-all cursor-pointer active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none disabled:from-purple-950/50 disabled:to-indigo-950/50 disabled:text-slate-500 disabled:shadow-none select-none"
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

