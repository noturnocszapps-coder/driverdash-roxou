import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { 
  Car, Fuel, Milestone, CreditCard, CheckCircle2, ShieldAlert, AlertTriangle, 
  Settings, RefreshCw, DollarSign, HelpCircle 
} from 'lucide-react';
import { motion } from 'motion/react';
import { OwnershipType, Vehicle, VehicleCostSettings } from '../types';
import { calculateMonthlyFixedCost, calculateCostPerKmEstimate, isElectricVehicle, calculateElectricityPriceKwh } from '../modules/vehicle/vehicle.calculations';
import { observabilityService } from '../modules/observability/observability.service';

export const VehiclePage: React.FC = () => {
  const { 
    vehicle, 
    vehicleCostSettings, 
    upsertVehicle, 
    upsertVehicleCostSettings 
  } = useApp();

  // Basic vehicle specifications
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [year, setYear] = useState('');
  const [plate, setPlate] = useState('');
  const [fuelType, setFuelType] = useState('flex');
  const [kmPerLiter, setKmPerLiter] = useState('');
  const [ownershipType, setOwnershipType] = useState<OwnershipType>('own');
  const [weeklyKmLimit, setWeeklyKmLimit] = useState('');
  const [monthlyKmLimit, setMonthlyKmLimit] = useState('');

  // Electric specifications states
  const [electricConsumptionKwh100, setElectricConsumptionKwh100] = useState('');
  const [electricityPriceKwh, setElectricityPriceKwh] = useState('');
  const [chargingType, setChargingType] = useState<'residential' | 'public' | 'mixed'>('residential');
  const [homeElectricityPriceKwh, setHomeElectricityPriceKwh] = useState('');
  const [publicElectricityPriceKwh, setPublicElectricityPriceKwh] = useState('');
  const [homeChargingPercent, setHomeChargingPercent] = useState('100');
  const [publicChargingPercent, setPublicChargingPercent] = useState('0');
  const [batteryReplacementCost, setBatteryReplacementCost] = useState('');
  const [batteryLifeKm, setBatteryLifeKm] = useState('');

  // Rented specific states
  const [rentalAmount, setRentalAmount] = useState('');
  const [rentalPeriod, setRentalPeriod] = useState<'weekly' | 'monthly'>('weekly');
  const [rentalFoodDaily, setRentalFoodDaily] = useState('');
  const [rentalDamageMonthly, setRentalDamageMonthly] = useState('');
  const [rentalCleaningMonthly, setRentalCleaningMonthly] = useState('');

  // Own / Financed specific states
  const [financingMonthly, setFinancingMonthly] = useState('');
  const [insuranceYearly, setInsuranceYearly] = useState('');
  const [ipvaYearly, setIpvaYearly] = useState('');
  const [licensingYearly, setLicensingYearly] = useState('');
  const [emergencyReserveMonthly, setEmergencyReserveMonthly] = useState('');
  const [maintenanceMonthly, setMaintenanceMonthly] = useState('');
  const [tireCost, setTireCost] = useState('');
  const [tireLifespanKm, setTireLifespanKm] = useState('');
  const [oilCost, setOilCost] = useState('');
  const [oilIntervalKm, setOilIntervalKm] = useState('');
  const [brakeCost, setBrakeCost] = useState('');
  const [brakeIntervalKm, setBrakeIntervalKm] = useState('');

  // Feedback states
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Sync basic vehicle states if vehicle already exists
  useEffect(() => {
    if (vehicle) {
      setBrand(vehicle.brand || '');
      setModel(vehicle.model || '');
      setYear(vehicle.year?.toString() || '');
      setPlate(vehicle.plate_optional || '');
      setFuelType(vehicle.fuel_type || 'flex');
      setKmPerLiter(vehicle.km_per_liter?.toString() || '');
      setOwnershipType(vehicle.ownership_type || 'own');
      setWeeklyKmLimit(vehicle.weekly_km_limit?.toString() || '');
      setMonthlyKmLimit(vehicle.monthly_km_limit?.toString() || '');
      setRentalAmount(vehicle.rental_amount?.toString() || '');
      setRentalPeriod(vehicle.rental_period || 'weekly');
      setRentalFoodDaily(vehicle.rental_food_daily?.toString() || '');
      setRentalDamageMonthly(vehicle.rental_damage_monthly?.toString() || '');
      setRentalCleaningMonthly(vehicle.rental_cleaning_monthly?.toString() || '');
      
      // EV states
      setElectricConsumptionKwh100(vehicle.electric_consumption_kwh_100km?.toString() || '');
      setElectricityPriceKwh(vehicle.electricity_price_kwh?.toString() || '');
      setChargingType((vehicle.charging_type as any) || 'residential');
      setHomeElectricityPriceKwh(vehicle.home_electricity_price_kwh?.toString() || '');
      setPublicElectricityPriceKwh(vehicle.public_electricity_price_kwh?.toString() || '');
      setHomeChargingPercent(vehicle.home_charging_percent?.toString() ?? '100');
      setPublicChargingPercent(vehicle.public_charging_percent?.toString() ?? '0');
      setBatteryReplacementCost(vehicle.battery_replacement_cost?.toString() || '');
      setBatteryLifeKm(vehicle.battery_life_km?.toString() || '');
    }
  }, [vehicle]);

  // Sync cost settings if they exist
  useEffect(() => {
    if (vehicleCostSettings) {
      setFinancingMonthly(vehicleCostSettings.financing_monthly?.toString() || '');
      setInsuranceYearly(vehicleCostSettings.insurance_yearly?.toString() || '');
      setIpvaYearly(vehicleCostSettings.ipva_yearly?.toString() || '');
      setLicensingYearly(vehicleCostSettings.licensing_yearly?.toString() || '');
      setEmergencyReserveMonthly(vehicleCostSettings.emergency_reserve_monthly?.toString() || '');
      setMaintenanceMonthly(vehicleCostSettings.maintenance_monthly?.toString() || '');
      setTireCost(vehicleCostSettings.tire_cost?.toString() || '');
      setTireLifespanKm(vehicleCostSettings.tire_lifespan_km?.toString() || '');
      setOilCost(vehicleCostSettings.oil_change_cost?.toString() || '');
      setOilIntervalKm(vehicleCostSettings.oil_change_interval_km?.toString() || '');
      setBrakeCost(vehicleCostSettings.brake_cost?.toString() || '');
      setBrakeIntervalKm(vehicleCostSettings.brake_interval_km?.toString() || '');
    }
  }, [vehicleCostSettings]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccess(false);

    const isElectric = fuelType === 'electric' || fuelType === 'elétrico' || fuelType === 'eletrico';

    // Basic Validations
    if (!brand || !model || !year) {
      setErrorMsg('Preencha ao menos marca, modelo e ano!');
      return;
    }

    if (!isElectric && !kmPerLiter) {
      setErrorMsg('Preencha o consumo médio (KM por Litro)!');
      return;
    }

    if (isElectric) {
      const consumption = Number(electricConsumptionKwh100);
      if (!consumption || consumption <= 0) {
        setErrorMsg('O consumo médio kWh/100km deve ser maior que 0!');
        return;
      }

      if (chargingType === 'mixed') {
        const homePrice = Number(homeElectricityPriceKwh) || 0;
        const publicPrice = Number(publicElectricityPriceKwh) || 0;
        const homePct = Number(homeChargingPercent) || 0;
        const publicPct = Number(publicChargingPercent) || 0;

        if (homePrice <= 0 && publicPrice <= 0) {
          setErrorMsg('Pelo menos um dos preços de eletricidade (residencial ou público) deve ser maior que 0!');
          return;
        }

        if (homePct + publicPct !== 100) {
          setErrorMsg('A soma do percentual de recarga residencial e pública deve ser exatamente 100%!');
          return;
        }
      } else {
        const directPrice = Number(electricityPriceKwh);
        const homePrice = Number(homeElectricityPriceKwh);
        const publicPrice = Number(publicElectricityPriceKwh);
        
        let validPrice = directPrice;
        if (chargingType === 'residential' && homePrice > 0) validPrice = homePrice;
        if (chargingType === 'public' && publicPrice > 0) validPrice = publicPrice;

        if (validPrice <= 0) {
          setErrorMsg('O preço médio do kWh deve ser maior que 0!');
          return;
        }
      }

      const batCost = Number(batteryReplacementCost) || 0;
      const batLife = Number(batteryLifeKm) || 0;
      if (batCost > 0 && batLife <= 0) {
        setErrorMsg('Se o custo de substituição da bateria for informado, a vida útil da bateria precisa ser maior que 0!');
        return;
      }
    }

    if (ownershipType === 'rented' && !rentalAmount) {
      setErrorMsg('Preencha o valor do aluguel nos dados de carro alugado!');
      return;
    }

    setLoading(true);

    try {
      // 1. Upsert Vehicle
      await upsertVehicle({
        brand,
        model,
        year: Number(year),
        plate_optional: plate,
        fuel_type: fuelType,
        km_per_liter: isElectric ? 0 : Number(kmPerLiter),
        ownership_type: ownershipType,
        weekly_km_limit: weeklyKmLimit ? Number(weeklyKmLimit) : undefined,
        monthly_km_limit: monthlyKmLimit ? Number(monthlyKmLimit) : undefined,
        rental_amount: rentalAmount ? Number(rentalAmount) : 0,
        rental_period: rentalPeriod,
        rental_food_daily: rentalFoodDaily ? Number(rentalFoodDaily) : 0,
        rental_damage_monthly: rentalDamageMonthly ? Number(rentalDamageMonthly) : 0,
        rental_cleaning_monthly: rentalCleaningMonthly ? Number(rentalCleaningMonthly) : 0,
        electric_consumption_kwh_100km: isElectric ? Number(electricConsumptionKwh100) : undefined,
        electricity_price_kwh: isElectric ? Number(electricityPriceKwh) : undefined,
        charging_type: isElectric ? chargingType : undefined,
        home_electricity_price_kwh: isElectric ? Number(homeElectricityPriceKwh) : undefined,
        public_electricity_price_kwh: isElectric ? Number(publicElectricityPriceKwh) : undefined,
        home_charging_percent: isElectric ? Number(homeChargingPercent) : undefined,
        public_charging_percent: isElectric ? Number(publicChargingPercent) : undefined,
        battery_replacement_cost: isElectric ? Number(batteryReplacementCost) : undefined,
        battery_life_km: isElectric ? Number(batteryLifeKm) : undefined,
      });

      // 2. Upsert Cost Settings
      await upsertVehicleCostSettings({
        fuel_price: isElectric ? 0 : (vehicleCostSettings?.fuel_price || 0),
        tire_cost: tireCost ? Number(tireCost) : 0,
        tire_lifespan_km: tireLifespanKm ? Number(tireLifespanKm) : 0,
        oil_change_cost: isElectric ? 0 : (oilCost ? Number(oilCost) : 0),
        oil_change_interval_km: isElectric ? 0 : (oilIntervalKm ? Number(oilIntervalKm) : 0),
        brake_cost: brakeCost ? Number(brakeCost) : 0,
        brake_interval_km: brakeIntervalKm ? Number(brakeIntervalKm) : 0,
        insurance_yearly: insuranceYearly ? Number(insuranceYearly) : 0,
        ipva_yearly: ipvaYearly ? Number(ipvaYearly) : 0,
        licensing_yearly: licensingYearly ? Number(licensingYearly) : 0,
        emergency_reserve_monthly: emergencyReserveMonthly ? Number(emergencyReserveMonthly) : 0,
        financing_monthly: financingMonthly ? Number(financingMonthly) : 0,
        maintenance_monthly: maintenanceMonthly ? Number(maintenanceMonthly) : 0
      });

      setSuccess(true);
      setTimeout(() => setSuccess(false), 5000);
    } catch (err: any) {
      console.error('Error saving vehicle config:', err);
      const errText = err?.message || err?.details || JSON.stringify(err);
      setErrorMsg(`Erro técnico ao salvar: ${errText}`);
      
      // Log to observability service
      try {
        await observabilityService.log(
          'error', 
          'system', 
          `Failure saving vehicle configurations: ${errText}`,
          { error: err }
        );
      } catch (logErr) {
        console.error('Failed to log error to observability:', logErr);
      }
    } finally {
      setLoading(false);
    }
  };

  const isElectric = fuelType === 'electric' || fuelType === 'elétrico' || fuelType === 'eletrico';

  // Build live temporary objects for real-time calculations
  const tempVehicle: Vehicle = {
    user_id: vehicle?.user_id || '',
    brand,
    model,
    year: Number(year) || 0,
    fuel_type: fuelType,
    km_per_liter: isElectric ? 0 : (Number(kmPerLiter) || 10),
    ownership_type: ownershipType,
    rental_amount: rentalAmount ? Number(rentalAmount) : 0,
    rental_period: rentalPeriod as 'weekly' | 'monthly',
    rental_food_daily: rentalFoodDaily ? Number(rentalFoodDaily) : 0,
    rental_damage_monthly: rentalDamageMonthly ? Number(rentalDamageMonthly) : 0,
    rental_cleaning_monthly: rentalCleaningMonthly ? Number(rentalCleaningMonthly) : 0,
    electric_consumption_kwh_100km: isElectric ? (Number(electricConsumptionKwh100) || 0) : undefined,
    electricity_price_kwh: isElectric ? (Number(electricityPriceKwh) || 0) : undefined,
    charging_type: isElectric ? chargingType : undefined,
    home_electricity_price_kwh: isElectric ? (Number(homeElectricityPriceKwh) || 0) : undefined,
    public_electricity_price_kwh: isElectric ? (Number(publicElectricityPriceKwh) || 0) : undefined,
    home_charging_percent: isElectric ? (Number(homeChargingPercent) || 0) : undefined,
    public_charging_percent: isElectric ? (Number(publicChargingPercent) || 0) : undefined,
    battery_replacement_cost: isElectric ? (Number(batteryReplacementCost) || 0) : undefined,
    battery_life_km: isElectric ? (Number(batteryLifeKm) || 0) : undefined
  };

  const tempCostSettings: VehicleCostSettings = {
    user_id: vehicleCostSettings?.user_id || '',
    fuel_price: isElectric ? 0 : (vehicleCostSettings?.fuel_price || 0),
    tire_cost: tireCost ? Number(tireCost) : 0,
    tire_lifespan_km: tireLifespanKm ? Number(tireLifespanKm) : 0,
    oil_change_cost: isElectric ? 0 : (oilCost ? Number(oilCost) : 0),
    oil_change_interval_km: isElectric ? 0 : (oilIntervalKm ? Number(oilIntervalKm) : 0),
    brake_cost: brakeCost ? Number(brakeCost) : 0,
    brake_interval_km: brakeIntervalKm ? Number(brakeIntervalKm) : 0,
    insurance_yearly: insuranceYearly ? Number(insuranceYearly) : 0,
    ipva_yearly: ipvaYearly ? Number(ipvaYearly) : 0,
    licensing_yearly: licensingYearly ? Number(licensingYearly) : 0,
    emergency_reserve_monthly: emergencyReserveMonthly ? Number(emergencyReserveMonthly) : 0,
    financing_monthly: financingMonthly ? Number(financingMonthly) : 0,
    maintenance_monthly: maintenanceMonthly ? Number(maintenanceMonthly) : 0
  };

  const monthlyFixedCost = calculateMonthlyFixedCost(tempVehicle, tempCostSettings);
  const costPerKm = calculateCostPerKmEstimate(tempVehicle, tempCostSettings);

  const formatBRL = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  return (
    <div className="space-y-6">
      
      {/* Visual title bar */}
      <div className="border-b border-purple-950/20 pb-4">
        <h2 className="text-xl font-bold text-white tracking-wide">Configurações do Veículo</h2>
        <p className="text-xs text-purple-300/50 mt-1">
          Configure as especificações técnicas, taxas, rotinas de amortecimento e depreciação. O cálculo exato dos custos garante mais lucro nas rotas.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* FORM CONTAINER */}
        <motion.div 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="lg:col-span-2 bg-[#0b0720]/85 border border-purple-950/45 rounded-2xl p-6 shadow-xl"
        >
          <div className="flex items-center gap-2 border-b border-purple-950/20 pb-3 mb-6">
            <Car className="w-5 h-5 text-purple-400" />
            <h3 className="text-md font-bold text-white">Especificações & Despesas</h3>
          </div>

          {success && (
            <div className="mb-6 p-4 bg-emerald-950/60 border border-emerald-900/40 text-emerald-400 text-xs rounded-xl flex items-center gap-2 font-medium">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Dados do carro e planos de despesa salvos com sucesso na nuvem!</span>
            </div>
          )}

          {errorMsg && (
            <div className="mb-6 p-4 bg-rose-950/60 border border-rose-900/40 text-rose-400 text-xs rounded-xl flex items-center gap-2 font-medium">
              <ShieldAlert className="w-4 h-4 text-rose-450 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6 text-xs">
            
            {/* Section 1: Basic Specifications */}
            <div className="space-y-4">
              <h4 className="text-purple-400 font-semibold border-b border-purple-950/15 pb-1 select-none">1. Especificações Básicas</h4>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-400 mb-1.5 font-sans">Marca / Fabricante *</label>
                  <input 
                    type="text" 
                    value={brand} 
                    onChange={(e) => setBrand(e.target.value)}
                    placeholder="Ex: Chevrolet, Fiat, Toyota"
                    className="w-full bg-[#04010a] border border-purple-950/50 rounded-xl p-3 text-slate-100 focus:outline-none focus:border-purple-600 transition-colors"
                    required
                  />
                </div>

                <div>
                  <label className="block text-slate-400 mb-1.5 font-sans">Modelo *</label>
                  <input 
                    type="text" 
                    value={model} 
                    onChange={(e) => setModel(e.target.value)}
                    placeholder="Ex: Onix, Cronos, Corolla"
                    className="w-full bg-[#04010a] border border-purple-950/50 rounded-xl p-3 text-slate-100 focus:outline-none focus:border-purple-600 transition-colors"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-slate-400 mb-1.5 font-sans">Ano de Fabricação *</label>
                  <input 
                    type="number" 
                    value={year} 
                    onChange={(e) => setYear(e.target.value)}
                    placeholder="Ex: 2026"
                    className="w-full bg-[#04010a] border border-purple-950/50 rounded-xl p-3 text-slate-100 pr-3 focus:outline-none focus:border-purple-600 font-mono"
                    required
                  />
                </div>

                <div>
                  <label className="block text-slate-400 mb-1.5 font-sans">Placa (Opcional)</label>
                  <input 
                    type="text" 
                    value={plate} 
                    onChange={(e) => setPlate(e.target.value)}
                    placeholder="Ex: BRA2E19"
                    className="w-full bg-[#04010a] border border-purple-950/50 rounded-xl p-3 text-slate-100 focus:outline-none focus:border-purple-600 font-mono uppercase"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 mb-1.5 font-sans">Tipo Combustível *</label>
                  <select
                    value={fuelType}
                    onChange={(e) => setFuelType(e.target.value)}
                    className="w-full bg-[#04010a] border border-purple-950/50 rounded-xl p-3 text-slate-100 focus:outline-none focus:border-purple-600 cursor-pointer"
                  >
                    <option value="flex">Flex (Álcool/Gasolina)</option>
                    <option value="gasoline">Gasolina</option>
                    <option value="alcohol">Etanol (Álcool)</option>
                    <option value="gnv">GNV (Gás Natural)</option>
                    <option value="diesel">Diesel</option>
                    <option value="hybrid">Híbrido</option>
                    <option value="electric">Elétrico</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {!isElectric ? (
                  <div>
                    <label className="block text-purple-300 font-semibold mb-1.5 font-sans">Consumo Médio (KM por Litro) *</label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-3 flex items-center text-purple-400">
                        <Fuel className="w-4 h-4" />
                      </span>
                      <input 
                        type="number" 
                        step="0.1"
                        value={kmPerLiter} 
                        onChange={(e) => setKmPerLiter(e.target.value)}
                        placeholder="Ex: 8.0"
                        className="w-full bg-[#04010a] border border-purple-950/50 rounded-xl py-3 pl-10 pr-4 text-slate-100 font-bold focus:outline-none focus:border-purple-600 font-mono"
                        required={!isElectric}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="sm:col-span-2">
                    <motion.div 
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="bg-indigo-950/15 border border-indigo-900/30 rounded-xl p-4 space-y-4"
                    >
                      <h4 className="text-xs font-bold text-indigo-400 font-mono uppercase tracking-wider flex items-center gap-1.5 select-none">
                        <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
                        Especificações de Energia (Veículo Elétrico)
                      </h4>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-[11px] text-slate-400 mb-1">Consumo Médio kWh/100km *</label>
                          <input 
                            type="number" 
                            step="0.1"
                            value={electricConsumptionKwh100} 
                            onChange={(e) => setElectricConsumptionKwh100(e.target.value)}
                            placeholder="Ex: 15.5"
                            className="w-full bg-[#04010a] border border-purple-950/50 rounded-xl p-2.5 text-slate-100 font-mono"
                            required={isElectric}
                          />
                          <p className="text-[9px] text-slate-500 mt-1">Consumo padrão por 100km (KWh)</p>
                        </div>

                        <div>
                          <label className="block text-[11px] text-slate-400 mb-1">Tipo de Recarga</label>
                          <select
                            value={chargingType}
                            onChange={(e) => setChargingType(e.target.value as any)}
                            className="w-full bg-[#04010a] border border-purple-950/50 rounded-xl p-2.5 text-slate-100 font-sans cursor-pointer focus:outline-none"
                          >
                            <option value="residential">Residencial</option>
                            <option value="public">Pública</option>
                            <option value="mixed">Mista (Residencial + Pública)</option>
                          </select>
                        </div>
                      </div>

                      {chargingType !== 'mixed' ? (
                        <div>
                          <label className="block text-[11px] text-slate-400 mb-1">Preço Médio do kWh (R$) *</label>
                          <div className="relative">
                            <span className="absolute inset-y-0 left-3 flex items-center text-slate-500 font-mono text-[11px]">R$</span>
                            <input 
                              type="number" 
                              step="0.01"
                              value={electricityPriceKwh} 
                              onChange={(e) => setElectricityPriceKwh(e.target.value)}
                              placeholder="Ex: 0.85"
                              className="w-full bg-[#04010a] border border-purple-950/50 rounded-xl py-2 pl-8 pr-3 text-slate-100 font-mono font-bold"
                              required={isElectric}
                            />
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-3 p-3 bg-slate-950/40 rounded-xl border border-indigo-950/30">
                          <p className="text-[10px] text-indigo-300 font-medium">Configure a proporção da sua recarga diária:</p>
                          
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                              <label className="block text-[11px] text-slate-400 mb-1">Preço kWh Residencial (R$)</label>
                              <div className="relative">
                                <span className="absolute inset-y-0 left-3 flex items-center text-slate-500 font-mono text-[11px]">R$</span>
                                <input 
                                  type="number" 
                                  step="0.01"
                                  value={homeElectricityPriceKwh} 
                                  onChange={(e) => setHomeElectricityPriceKwh(e.target.value)}
                                  placeholder="Ex: 0.70"
                                  className="w-full bg-[#04010a] border border-purple-950/50 rounded-xl py-2 pl-8 pr-3 text-slate-100 font-mono"
                                />
                              </div>
                            </div>
                            <div>
                              <label className="block text-[11px] text-slate-400 mb-1">Percentual Residencial (%)</label>
                              <input 
                                type="number" 
                                value={homeChargingPercent} 
                                onChange={(e) => {
                                  setHomeChargingPercent(e.target.value);
                                  const val = 100 - (Number(e.target.value) || 0);
                                  setPublicChargingPercent(Math.max(0, val).toString());
                                }}
                                placeholder="Ex: 70"
                                className="w-full bg-[#04010a] border border-purple-950/50 rounded-xl p-2 text-slate-100 font-bold font-mono"
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                              <label className="block text-[11px] text-slate-400 mb-1">Preço kWh Público / Rápido (R$)</label>
                              <div className="relative">
                                <span className="absolute inset-y-0 left-3 flex items-center text-slate-500 font-mono text-[11px]">R$</span>
                                <input 
                                  type="number" 
                                  step="0.01"
                                  value={publicElectricityPriceKwh} 
                                  onChange={(e) => setPublicElectricityPriceKwh(e.target.value)}
                                  placeholder="Ex: 1.90"
                                  className="w-full bg-[#04010a] border border-purple-950/50 rounded-xl py-2 pl-8 pr-3 text-slate-100 font-mono"
                                />
                              </div>
                            </div>
                            <div>
                              <label className="block text-[11px] text-slate-400 mb-1">Percentual Público (%)</label>
                              <input 
                                type="number" 
                                value={publicChargingPercent} 
                                onChange={(e) => {
                                  setPublicChargingPercent(e.target.value);
                                  const val = 100 - (Number(e.target.value) || 0);
                                  setHomeChargingPercent(Math.max(0, val).toString());
                                }}
                                placeholder="Ex: 30"
                                className="w-full bg-[#04010a] border border-purple-950/50 rounded-xl p-2 text-slate-100 font-bold font-mono"
                              />
                            </div>
                          </div>
                        </div>
                      )}

                      {ownershipType !== 'rented' && (
                        <div className="space-y-3 p-3 bg-slate-950/40 rounded-xl border border-indigo-950/30">
                          <p className="text-[10px] text-indigo-300 font-medium">Depreciação de Bateria (Opcional):</p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                              <label className="block text-[11px] text-slate-400 mb-1">Custo de Troca da Bateria (R$)</label>
                              <div className="relative">
                                <span className="absolute inset-y-0 left-3 flex items-center text-slate-500 font-mono text-[11px]">R$</span>
                                <input 
                                  type="number" 
                                  value={batteryReplacementCost} 
                                  onChange={(e) => setBatteryReplacementCost(e.target.value)}
                                  placeholder="Ex: 45000"
                                  className="w-full bg-[#04010a] border border-purple-950/50 rounded-xl py-2 pl-8 pr-3 text-slate-100 font-mono font-bold"
                                />
                              </div>
                            </div>
                            <div>
                              <label className="block text-[11px] text-slate-400 mb-1">Vida Útil Estimada (KM)</label>
                              <input 
                                type="number" 
                                value={batteryLifeKm} 
                                onChange={(e) => setBatteryLifeKm(e.target.value)}
                                placeholder="Ex: 240000"
                                className="w-full bg-[#04010a] border border-purple-950/50 rounded-xl p-2 text-slate-100 font-mono font-bold"
                              />
                            </div>
                          </div>
                          <p className="text-[9px] text-purple-300/40 font-mono">Depreciação estimada: {Number(batteryLifeKm) > 0 ? formatBRL((Number(batteryReplacementCost) || 0) / Number(batteryLifeKm)) : 'R$ 0,00'} por KM</p>
                        </div>
                      )}
                    </motion.div>
                  </div>
                )}

                <div>
                  <label className="block text-slate-400 mb-1.5 font-sans">Contrato / Tipo de Posse *</label>
                  <select
                    value={ownershipType}
                    onChange={(e) => setOwnershipType(e.target.value as OwnershipType)}
                    className="w-full bg-[#04010a] border border-purple-950/50 rounded-xl p-3 text-slate-100 focus:outline-none focus:border-purple-600 cursor-pointer"
                  >
                    <option value="own">Carro Próprio</option>
                    <option value="financed">Carro Financiado</option>
                    <option value="rented">Alugado (Locadora)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Section 2: Conditional rented elements */}
            {ownershipType === 'rented' && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="bg-purple-950/10 border border-purple-950/30 rounded-xl p-4 space-y-4"
              >
                <h4 className="text-xs font-bold text-purple-400 font-mono uppercase tracking-wider flex items-center gap-1.5 select-none">
                  <Milestone className="w-4 h-4" /> Parâmetros de Aluguel & Franquia
                </h4>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Valor do Aluguel *</label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-3 flex items-center text-slate-500 font-mono">R$</span>
                      <input 
                        type="number" 
                        value={rentalAmount} 
                        onChange={(e) => setRentalAmount(e.target.value)}
                        placeholder="Ex: 682"
                        className="w-full bg-[#04010a] border border-purple-950/50 rounded-xl py-2.5 pl-8 pr-4 text-slate-100 font-mono"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Periodicidade do Aluguel</label>
                    <select
                      value={rentalPeriod}
                      onChange={(e) => setRentalPeriod(e.target.value as 'weekly' | 'monthly')}
                      className="w-full bg-[#04010a] border border-purple-950/50 rounded-xl p-2.5 text-slate-100 font-sans cursor-pointer focus:outline-none"
                    >
                      <option value="weekly">Semanal</option>
                      <option value="monthly">Mensal</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Limite Semanal de KM (Franquia)</label>
                    <input 
                      type="number" 
                      value={weeklyKmLimit} 
                      onChange={(e) => setWeeklyKmLimit(e.target.value)}
                      placeholder="Ex: 1167"
                      className="w-full bg-[#04010a] border border-purple-950/50 rounded-xl p-2.5 text-slate-100 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Limite Mensal de KM (Franquia)</label>
                    <input 
                      type="number" 
                      value={monthlyKmLimit} 
                      onChange={(e) => setMonthlyKmLimit(e.target.value)}
                      placeholder="Ex: 4668"
                      className="w-full bg-[#04010a] border border-purple-950/50 rounded-xl p-2.5 text-slate-100 font-mono"
                    />
                  </div>
                </div>

                <div className="border-t border-purple-950/20 pt-4 mt-3">
                  <h5 className="text-[11px] font-bold text-purple-400 font-mono uppercase tracking-wider mb-3 select-none">
                    Custos Opcionais / Operacionais
                  </h5>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">Alimentação Diária</label>
                      <div className="relative">
                        <span className="absolute inset-y-0 left-3 flex items-center text-slate-500 font-mono">R$</span>
                        <input 
                          type="number" 
                          value={rentalFoodDaily} 
                          onChange={(e) => setRentalFoodDaily(e.target.value)}
                          placeholder="Ex: 35"
                          className="w-full bg-[#04010a] border border-purple-950/50 rounded-xl py-2 pl-8 pr-3 text-slate-100 font-mono text-xs"
                        />
                      </div>
                      <p className="text-[9px] text-purple-300/40 mt-1">Rateio mensal: R$ {(Number(rentalFoodDaily) || 0) * 30}</p>
                    </div>

                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">Fundo de Avarias Mensal</label>
                      <div className="relative">
                        <span className="absolute inset-y-0 left-3 flex items-center text-slate-500 font-mono">R$</span>
                        <input 
                          type="number" 
                          value={rentalDamageMonthly} 
                          onChange={(e) => setRentalDamageMonthly(e.target.value)}
                          placeholder="Ex: 150"
                          className="w-full bg-[#04010a] border border-purple-950/50 rounded-xl py-2 pl-8 pr-3 text-slate-100 font-mono text-xs"
                        />
                      </div>
                      <p className="text-[9px] text-purple-300/40 mt-1">Saldos de risco ou seguro coparticipativo</p>
                    </div>

                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">Limpeza/Lavação Mensal</label>
                      <div className="relative">
                        <span className="absolute inset-y-0 left-3 flex items-center text-slate-500 font-mono">R$</span>
                        <input 
                          type="number" 
                          value={rentalCleaningMonthly} 
                          onChange={(e) => setRentalCleaningMonthly(e.target.value)}
                          placeholder="Ex: 120"
                          className="w-full bg-[#04010a] border border-purple-950/50 rounded-xl py-2 pl-8 pr-3 text-slate-100 font-mono text-xs"
                        />
                      </div>
                      <p className="text-[9px] text-purple-300/40 mt-1">Ducha e aspiração regular</p>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Section 3: Conditional Financing section */}
            {ownershipType === 'financed' && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="bg-purple-950/10 border border-purple-950/30 rounded-xl p-4 space-y-4"
              >
                <h4 className="text-xs font-bold text-indigo-400 font-mono uppercase tracking-wider flex items-center gap-1.5 select-none">
                  <CreditCard className="w-4 h-4" /> Detalhes do Financiamento
                </h4>
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Valor da Parcela Mensal *</label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-3 flex items-center text-slate-500 font-mono">R$</span>
                    <input 
                      type="number" 
                      value={financingMonthly} 
                      onChange={(e) => setFinancingMonthly(e.target.value)}
                      placeholder="Ex: 1200"
                      className="w-full bg-[#04010a] border border-purple-950/50 rounded-xl py-2.5 pl-8 pr-4 text-slate-100 font-mono"
                      required
                    />
                  </div>
                </div>
              </motion.div>
            )}

            {/* Section 4: General Custos for Proprietary or Financed vehicle */}
            {ownershipType !== 'rented' && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="space-y-4 border-t border-purple-950/20 pt-4"
              >
                <h4 className="text-purple-400 font-semibold border-b border-purple-950/15 pb-1 select-none">2. Gastos Fixos Estimados (Anuais/Mensais)</h4>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-slate-400 mb-1">Seguro Anual Estimado</label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-3 flex items-center text-slate-500">R$</span>
                      <input 
                        type="number" 
                        value={insuranceYearly} 
                        onChange={(e) => setInsuranceYearly(e.target.value)}
                        placeholder="Ex: 2400"
                        className="w-full bg-[#04010a] border border-purple-950/50 rounded-xl py-2.5 pl-8 pr-3 text-slate-100 font-mono"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-slate-400 mb-1">Valor do IPVA Anual</label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-3 flex items-center text-slate-500">R$</span>
                      <input 
                        type="number" 
                        value={ipvaYearly} 
                        onChange={(e) => setIpvaYearly(e.target.value)}
                        placeholder="Ex: 1800"
                        className="w-full bg-[#04010a] border border-purple-950/50 rounded-xl py-2.5 pl-8 pr-3 text-slate-100 font-mono"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-slate-400 mb-1">Licenciamento Anual</label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-3 flex items-center text-slate-500">R$</span>
                      <input 
                        type="number" 
                        value={licensingYearly} 
                        onChange={(e) => setLicensingYearly(e.target.value)}
                        placeholder="Ex: 160"
                        className="w-full bg-[#04010a] border border-purple-950/50 rounded-xl py-2.5 pl-8 pr-3 text-slate-100 font-mono"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-purple-950/10 pt-3">
                  <div>
                    <label className="block text-slate-400 mb-1">Provisão Mensal de Manutenção</label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-3 flex items-center text-slate-500 font-mono">R$</span>
                      <input 
                        type="number" 
                        value={maintenanceMonthly} 
                        onChange={(e) => setMaintenanceMonthly(e.target.value)}
                        placeholder="Ex: 150 (Reservar para freios/revisões)"
                        className="w-full bg-[#04010a] border border-purple-950/50 rounded-xl py-2.5 pl-8 pr-4 text-slate-100 font-mono"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-slate-400 mb-1">Reserva Mensal de Emergência</label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-3 flex items-center text-slate-500 font-mono">R$</span>
                      <input 
                        type="number" 
                        value={emergencyReserveMonthly} 
                        onChange={(e) => setEmergencyReserveMonthly(e.target.value)}
                        placeholder="Ex: 100"
                        className="w-full bg-[#04010a] border border-purple-950/50 rounded-xl py-2.5 pl-8 pr-4 text-slate-100 font-mono"
                      />
                    </div>
                  </div>
                </div>

                <h4 className="text-purple-400 font-semibold border-b border-purple-950/15 pb-1 pt-2 select-none">3. Trocas e Vida Útil (Desgaste Variável)</h4>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <label className="block text-slate-400 font-medium">Jogo de Pneus (Custo R$)</label>
                    <input 
                      type="number" 
                      value={tireCost} 
                      onChange={(e) => setTireCost(e.target.value)}
                      placeholder="Ex: 1600"
                      className="w-full bg-[#04010a] border border-purple-950/50 rounded-xl p-2.5 text-slate-105 font-mono"
                    />
                    <label className="block text-[10px] text-slate-500">Durabilidade prevista (KM)</label>
                    <input 
                      type="number" 
                      value={tireLifespanKm} 
                      onChange={(e) => setTireLifespanKm(e.target.value)}
                      placeholder="Ex: 40000"
                      className="w-full bg-[#04010a] border border-purple-950/50 rounded-xl p-2 text-slate-105 font-mono"
                    />
                  </div>

                  {!isElectric && (
                    <div className="space-y-1.5">
                      <label className="block text-slate-400 font-medium">Troca de Óleo + Filtro (R$)</label>
                      <input 
                        type="number" 
                        value={oilCost} 
                        onChange={(e) => setOilCost(e.target.value)}
                        placeholder="Ex: 220"
                        className="w-full bg-[#04010a] border border-purple-950/50 rounded-xl p-2.5 text-slate-105 font-mono"
                      />
                      <label className="block text-[10px] text-slate-500">Intervalo de troca (KM)</label>
                      <input 
                        type="number" 
                        value={oilIntervalKm} 
                        onChange={(e) => setOilIntervalKm(e.target.value)}
                        placeholder="Ex: 10000"
                        className="w-full bg-[#04010a] border border-purple-950/50 rounded-xl p-2 text-slate-105 font-mono"
                      />
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <label className="block text-slate-400 font-medium">Pastilhas / Freios (Custo R$)</label>
                    <input 
                      type="number" 
                      value={brakeCost} 
                      onChange={(e) => setBrakeCost(e.target.value)}
                      placeholder="Ex: 350"
                      className="w-full bg-[#04010a] border border-purple-950/50 rounded-xl p-2.5 text-slate-105 font-mono"
                    />
                    <label className="block text-[10px] text-slate-500">Intervalo ideal (KM)</label>
                    <input 
                      type="number" 
                      value={brakeIntervalKm} 
                      onChange={(e) => setBrakeIntervalKm(e.target.value)}
                      placeholder="Ex: 20000"
                      className="w-full bg-[#04010a] border border-purple-950/50 rounded-xl p-2 text-slate-105 font-mono"
                    />
                  </div>
                </div>
              </motion.div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-purple-700 to-indigo-600 hover:from-purple-600 hover:to-indigo-500 text-white font-semibold py-3 px-4 rounded-xl text-xs transition-all shadow-[0_4px_15px_rgba(147,51,234,0.3)] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-white" />
                  <span>Salvando no Servidor Supabase...</span>
                </>
              ) : (
                <span>Salvar Configuração do Veículo</span>
              )}
            </button>
          </form>
        </motion.div>

        {/* STATS SUMMARY CARD */}
        <div className="space-y-6">
          
          <div className="bg-[#0a061b] border border-purple-950/40 rounded-2xl p-6 flex flex-col justify-between">
            <div className="space-y-5">
              <div className="flex items-center gap-2 border-b border-purple-950/20 pb-3">
                <Settings className="w-4 h-4 text-indigo-400" />
                <h3 className="text-xs font-bold text-white uppercase tracking-wider font-mono text-indigo-400">Resumo de Custos Fixos</h3>
              </div>

              <div className="bg-purple-950/15 border border-purple-900/10 rounded-xl p-4 text-center">
                <span className="text-[10px] text-purple-400 uppercase tracking-widest font-mono">Custo Fixo Mensal</span>
                <div className="text-2xl font-black text-white mt-1 font-mono tracking-tight">
                  {formatBRL(monthlyFixedCost)}
                </div>
                {ownershipType === 'rented' ? (
                  <p className="text-[10px] text-purple-300/40 mt-1.5 font-sans">
                    Derivado do aluguel ({rentalPeriod === 'weekly' ? 'Semanal' : 'Mensal'})
                  </p>
                ) : (
                  <p className="text-[10px] text-purple-300/40 mt-1.5 font-sans">
                    Seguro + IPVA + Licenciamento + Reserva + Manutenção.
                  </p>
                )}
              </div>

              <div className="space-y-3.5">
                <div className="flex items-center justify-between text-xs border-b border-purple-950/15 pb-2">
                  <span className="text-slate-400">Categoria de Posse:</span>
                  <span className="font-semibold text-purple-300 uppercase font-mono text-[11px]">
                    {ownershipType === 'own' && 'Próprio'}
                    {ownershipType === 'financed' && 'Financiado'}
                    {ownershipType === 'rented' && 'Alugado'}
                  </span>
                </div>

                {ownershipType === 'rented' ? (
                  <>
                    <div className="flex items-center justify-between text-xs border-b border-purple-950/15 pb-2">
                      <span className="text-slate-400">Mensalidade Equivalente:</span>
                      <span className="font-semibold text-white font-mono">{formatBRL(rentalPeriod === 'weekly' ? Number(rentalAmount) * 4.33 : Number(rentalAmount))}</span>
                    </div>
                    {Number(rentalFoodDaily) > 0 && (
                      <div className="flex items-center justify-between text-xs border-b border-purple-950/15 pb-2">
                        <span className="text-slate-400">Alimentação (Mensal):</span>
                        <span className="font-semibold text-white font-mono">{formatBRL(Number(rentalFoodDaily) * 30)}</span>
                      </div>
                    )}
                    {Number(rentalDamageMonthly) > 0 && (
                      <div className="flex items-center justify-between text-xs border-b border-purple-950/15 pb-2">
                        <span className="text-slate-400">Fundo de Avarias:</span>
                        <span className="font-semibold text-white font-mono">{formatBRL(Number(rentalDamageMonthly))}</span>
                      </div>
                    )}
                    {Number(rentalCleaningMonthly) > 0 && (
                      <div className="flex items-center justify-between text-xs border-b border-purple-950/15 pb-2">
                        <span className="text-slate-400">Limpeza e Higienização:</span>
                        <span className="font-semibold text-white font-mono">{formatBRL(Number(rentalCleaningMonthly))}</span>
                      </div>
                    )}
                    {weeklyKmLimit && (
                      <div className="flex items-center justify-between text-xs border-b border-purple-950/15 pb-2">
                        <span className="text-slate-400">Franquia Semanal:</span>
                        <span className="font-semibold text-white font-mono">{weeklyKmLimit} KM</span>
                      </div>
                    )}
                    {monthlyKmLimit && (
                      <div className="flex items-center justify-between text-xs border-b border-purple-950/15 pb-2">
                        <span className="text-slate-400">Franquia Mensal:</span>
                        <span className="font-semibold text-white font-mono">{monthlyKmLimit} KM</span>
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    {ownershipType === 'financed' && (
                      <div className="flex items-center justify-between text-xs border-b border-purple-950/15 pb-2">
                        <span className="text-slate-400">Parcela Financiamento:</span>
                        <span className="font-semibold text-white font-mono">{formatBRL(Number(financingMonthly) || 0)}</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between text-xs border-b border-purple-950/15 pb-2">
                      <span className="text-slate-400">Seguro Mensal:</span>
                      <span className="font-semibold text-white font-mono">{formatBRL((Number(insuranceYearly) || 0) / 12)}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs border-b border-purple-950/15 pb-2">
                      <span className="text-slate-400">Tributos Mensais (IPVA+Lic.):</span>
                      <span className="font-semibold text-white font-mono">{formatBRL(((Number(ipvaYearly) || 0) + (Number(licensingYearly) || 0)) / 12)}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs border-b border-purple-950/15 pb-2">
                      <span className="text-slate-400">Provisão / Reserva:</span>
                      <span className="font-semibold text-white font-mono">{formatBRL((Number(emergencyReserveMonthly) || 0) + (Number(maintenanceMonthly) || 0))}</span>
                    </div>
                  </>
                )}
              </div>

              {/* ESTIMATED VARIABLE COST */}
              <div className="border-t border-purple-950/20 pt-4 mt-2">
                <span className="text-[10px] text-indigo-400/50 block font-mono uppercase tracking-wider">Custo Otimizado por KM</span>
                <div className="text-md font-bold text-slate-100 font-mono tracking-tight mt-1 flex items-baseline gap-1.5 font-mono">
                  <span>{formatBRL(costPerKm)}</span>
                  <span className="text-[10px] text-slate-550 font-sans font-normal">por quilômetro rodado</span>
                </div>

                {isElectric ? (
                  <div className="mt-3 bg-[#05020d] border border-indigo-950/50 rounded-xl p-3 space-y-2 text-[11px] text-slate-300 font-sans">
                    <div className="flex justify-between border-b border-purple-950/10 pb-1.5 font-medium text-slate-200 select-none">
                      <span>Composição Reativa:</span>
                    </div>
                    <div className="flex justify-between font-mono text-[10px]">
                      <span className="text-slate-400">Energia por km:</span>
                      <span className="text-indigo-300">
                        {formatBRL(((Number(electricConsumptionKwh100) || 0) * calculateElectricityPriceKwh(tempVehicle)) / 100)}
                      </span>
                    </div>
                    {ownershipType !== 'rented' && (
                      <>
                        {Number(tireLifespanKm) > 0 && (
                          <div className="flex justify-between font-mono text-[10px]">
                            <span className="text-slate-400">Pneus por km:</span>
                            <span className="text-slate-300">
                              {formatBRL((Number(tireCost) || 0) / Number(tireLifespanKm))}
                            </span>
                          </div>
                        )}
                        {Number(brakeIntervalKm) > 0 && (
                          <div className="flex justify-between font-mono text-[10px]">
                            <span className="text-slate-400">Pastilhas por km:</span>
                            <span className="text-slate-300">
                              {formatBRL((Number(brakeCost) || 0) / Number(brakeIntervalKm))}
                            </span>
                          </div>
                        )}
                        {Number(batteryLifeKm) > 0 && (
                          <div className="flex justify-between font-mono text-[10px]">
                            <span className="text-slate-400">Depreciação Bateria:</span>
                            <span className="text-slate-300">
                              {formatBRL((Number(batteryReplacementCost) || 0) / Number(batteryLifeKm))}
                            </span>
                          </div>
                        )}
                      </>
                    )}
                    <div className="flex justify-between font-mono text-[10px] border-t border-purple-950/10 pt-1.5">
                      <span className="text-slate-400">Rateio Custo Fixo/km:</span>
                      <span className="text-slate-300">
                        {formatBRL(
                          ownershipType === 'rented'
                            ? (monthlyFixedCost / (Number(monthlyKmLimit) || (Number(weeklyKmLimit) ? Number(weeklyKmLimit) * 4.33 : 4330)))
                            : (monthlyFixedCost / 4330)
                        )}
                      </span>
                    </div>

                    <p className="text-[9px] text-indigo-300/40 leading-relaxed bg-indigo-950/10 p-2 border border-indigo-950/20 rounded-lg font-sans mt-2">
                      Para veículos elétricos, o DriverDash substitui combustível por energia em kWh e remove custos de óleo/filtros. O cálculo considera energia, pneus, freios, bateria quando aplicável e custos fixos.
                    </p>
                  </div>
                ) : (
                  <p className="text-[10px] text-purple-300/20 leading-snug mt-1.5 font-sans">
                    Combina consumo relativo ({tempVehicle.km_per_liter} km/l), preço do combustível, amortecimento de componentes de desgaste (pneus, óleo, freios) e rateio quilométrico de custos fixos.
                  </p>
                )}
              </div>

            </div>

            <div className="border-t border-purple-950/20 pt-4 mt-6">
              <span className="text-[10px] text-indigo-400/50 block font-mono">CONDIÇÃO OPERACIONAL</span>
              <p className="text-[11px] text-purple-300/30 leading-snug mt-1">
                Conecte seu preço de combustível do posto local na página de **Metas** para refinar as estimativas de custo real de cada corrida de forma milimétrica.
              </p>
            </div>
          </div>
          
        </div>

      </div>

    </div>
  );
};
