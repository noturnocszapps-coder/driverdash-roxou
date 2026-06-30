import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Car, Compass, Fuel, CheckCircle2, AlertCircle, ArrowLeft, ArrowRight, Save, 
  HelpCircle, Settings, ClipboardList, Info, Sparkles, AlertTriangle
} from 'lucide-react';
import { 
  DetailedVehicleConfig, 
  MotorizationType, 
  CostFrequency, 
  EvConsumptionUnit,
  calculateDetailedVehicleCost
} from '../vehicleCost.calculations';
import { CurrencyInput } from './CurrencyInput';
import { PercentageInput } from './PercentageInput';
import { CostInputWithFrequency } from './CostInputWithFrequency';

export interface VehicleCostWizardProps {
  initialConfig: DetailedVehicleConfig;
  estimatedKm: number;
  onSave: (config: DetailedVehicleConfig) => void;
  onClose?: () => void;
  id?: string;
}

export const VehicleCostWizard: React.FC<VehicleCostWizardProps> = ({
  initialConfig,
  estimatedKm,
  onSave,
  onClose,
  id
}) => {
  const [step, setStep] = useState<number>(1);
  const [config, setConfig] = useState<DetailedVehicleConfig>({ ...initialConfig });

  // Additional Wizard metadata fields (Brand, Model, Year, MotorizationName)
  // Let's store these inside the detailed_vehicle_config JSON object!
  const [brand, setBrand] = useState<string>((initialConfig as any).brand || '');
  const [model, setModel] = useState<string>((initialConfig as any).model || '');
  const [year, setYear] = useState<number>((initialConfig as any).year || 2022);
  const [motorizationName, setMotorizationName] = useState<string>((initialConfig as any).motorizationName || '1.0');
  const [estimatedMonthlyKm, setEstimatedMonthlyKm] = useState<number>(estimatedKm * 26);

  // Suggested values warnings states
  const [showSugWarning, setShowSugWarning] = useState<boolean>(false);

  const totalSteps = config.ownership_type === 'rented' ? 5 : 9;

  useEffect(() => {
    if (step > totalSteps) {
      setStep(totalSteps);
    }
  }, [totalSteps, step]);

  const getWizardStepId = (s: number): number => {
    if (config.ownership_type !== 'rented') return s;
    switch (s) {
      case 1: return 1;    // Propulsion & Ownership
      case 2: return 2345; // Combined Identification
      case 3: return 7;    // Rendimento & Consumo
      case 4: return 801;  // Rental Cost & Included Checkboxes
      case 5: return 9;    // Final Revision
      default: return 1;
    }
  };

  const activeStepId = getWizardStepId(step);

  const getStepTitleDynamic = (s: number): string => {
    if (config.ownership_type !== 'rented') {
      switch (s) {
        case 1: return 'Tipo de Veículo & Posse';
        case 2: return 'Marca';
        case 3: return 'Modelo';
        case 4: return 'Ano';
        case 5: return 'Motorização';
        case 6: return 'Tipo de Combustível';
        case 7: return 'Consumo';
        case 8: return 'Custos Adicionais';
        case 9: return 'Revisão Final';
        default: return '';
      }
    } else {
      switch (s) {
        case 1: return 'Tipo de Veículo & Posse';
        case 2: return 'Identificação do Carro';
        case 3: return 'Rendimento & Consumo';
        case 4: return 'Custos de Locação & Inclusões';
        case 5: return 'Revisão Final';
        default: return '';
      }
    }
  };

  // Smart suggestions helper
  const applySmartSuggestions = () => {
    const isElectric = config.motorizationType === 'electric';
    const monthlyKm = estimatedMonthlyKm || 3000;

    // maintenance padrão: R$ 0,12/km para combustão, R$ 0,06/km para elétrico
    const suggestedMaintPerKm = isElectric ? 0.06 : 0.12;
    // Tires standard: R$ 0.05/km
    const suggestedTirePerKm = 0.05;

    setConfig(prev => ({
      ...prev,
      // Apply standard values directly
      tireCost: 2000,
      tireIntervalKm: 40000, // 2000 / 40000 = 0.05 per KM
      brakeCost: 400,
      brakeIntervalKm: 20000, // 400 / 20000 = 0.02 per KM
      oilCost: isElectric ? 0 : 250,
      oilIntervalKm: isElectric ? 0 : 10000, // 250 / 10000 = 0.025 per KM
      filterCost: isElectric ? 0 : 75,
      filterIntervalKm: isElectric ? 0 : 10000,
      alignmentCost: 100,
      alignmentIntervalKm: 10000,
      balancingCost: 100,
      balancingIntervalKm: 10000,
      depreciationCost: isElectric ? 0.10 : 0.15, // standard depreciation
      insuranceCost: 250, // standard R$ 250/month
      insuranceFreq: 'monthly',
      ipvaCost: 1500, // standard R$ 1500/year
      ipvaFreq: 'anual',
      licensingCost: 160,
      licensingFreq: 'anual',
      washCost: 50,
      washFreq: 'monthly',
      rentCost: prev.rentCost || 1200,
      rentFreq: 'monthly',
      rental_food_daily: prev.rental_food_daily || 0,
      rental_damage_monthly: prev.rental_damage_monthly || 0,
      rental_cleaning_monthly: prev.rental_cleaning_monthly || 0,
      includedSeguro: prev.includedSeguro !== undefined ? prev.includedSeguro : true,
      includedPneus: prev.includedPneus !== undefined ? prev.includedPneus : true,
      includedManutencao: prev.includedManutencao !== undefined ? prev.includedManutencao : true,
      includedIpva: prev.includedIpva !== undefined ? prev.includedIpva : true,
      includedLicenciamento: prev.includedLicenciamento !== undefined ? prev.includedLicenciamento : true,
      includedCarroReserva: prev.includedCarroReserva !== undefined ? prev.includedCarroReserva : true,
      includedGuincho: prev.includedGuincho !== undefined ? prev.includedGuincho : true,
      includedRevisoes: prev.includedRevisoes !== undefined ? prev.includedRevisoes : true,
    }));
    setShowSugWarning(true);
  };

  const updateField = <K extends keyof DetailedVehicleConfig>(key: K, value: DetailedVehicleConfig[K]) => {
    setConfig(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const handleNext = () => {
    if (step < totalSteps) {
      setStep(prev => prev + 1);
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(prev => prev - 1);
    }
  };

  const handleSaveConfig = () => {
    // Pack metadata fields back into the vehicle config
    const finalConfig = {
      ...config,
      brand,
      model,
      year,
      motorizationName,
      estimatedMonthlyKm
    };
    onSave(finalConfig);
  };

  // Calculations for step 9
  const result = calculateDetailedVehicleCost(config, estimatedKm);

  return (
    <div id={id || "vehicle-cost-wizard-container"} className="bg-[#09061c] border border-purple-950/40 rounded-3xl p-6 md:p-8 space-y-6 shadow-2xl relative overflow-hidden backdrop-blur-xl">
      <div className="absolute top-0 left-0 w-full h-1 bg-purple-950/40">
        <motion.div 
          className="h-full bg-gradient-to-r from-purple-500 to-indigo-500"
          initial={{ width: '0%' }}
          animate={{ width: `${(step / totalSteps) * 100}%` }}
          transition={{ duration: 0.3 }}
        />
      </div>

      {/* Header */}
      <div className="flex items-center justify-between border-b border-purple-950/10 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-purple-950/40 rounded-xl border border-purple-500/15 text-purple-400">
            <Compass className="w-5 h-5 animate-spin-slow" />
          </div>
          <div>
            <h3 className="font-extrabold text-base md:text-lg text-white font-display">Assistente de Configuração</h3>
            <p className="text-xs text-slate-400 font-sans">Etapa {step} de {totalSteps}: {getStepTitleDynamic(step)}</p>
          </div>
        </div>

        <button 
          onClick={applySmartSuggestions}
          className="px-3 py-1.5 rounded-lg bg-purple-950/40 border border-purple-500/20 text-[11px] font-bold text-purple-300 hover:bg-purple-900/30 flex items-center gap-1.5 transition-colors cursor-pointer"
        >
          <Sparkles className="w-3.5 h-3.5 text-purple-400" />
          Preencher Sugestões
        </button>
      </div>

      {/* Sugestões Warning banner */}
      {showSugWarning && (
        <div className="p-3 bg-purple-950/20 border border-purple-500/10 text-purple-300 rounded-xl text-xs flex items-center gap-2">
          <Info className="w-4 h-4 text-purple-400 shrink-0" />
          <span>Valores de despesas sugeridos aplicados! Ajuste conforme sua realidade.</span>
        </div>
      )}

      {/* Step Contents */}
      <div className="min-h-[220px] py-4">
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 15 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -15 }}
            transition={{ duration: 0.2 }}
            className="space-y-4"
          >
            {/* STEP 1: Tipo de veículo & Posse */}
            {activeStepId === 1 && (
              <div className="space-y-6">
                <div className="space-y-3">
                  <p className="text-sm text-slate-300 font-semibold">Qual o tipo de propulsão do veículo utilizado?</p>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {[
                      { id: 'gasoline', label: 'Combustão (Gasolina)', desc: 'Carros movidos estritamente a gasolina.' },
                      { id: 'flex', label: 'Flex (Flexfuel)', desc: 'Carros que aceitam Gasolina ou Etanol.' },
                      { id: 'diesel', label: 'Diesel', desc: 'Carros utilitários ou de passeio a diesel.' },
                      { id: 'hybrid', label: 'Híbrido', desc: 'Combinação de motor elétrico e combustão.' },
                      { id: 'electric', label: 'Elétrico (EV)', desc: 'Propulsão 100% elétrica a bateria.' }
                    ].map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          updateField('motorizationType', item.id as MotorizationType);
                          if (item.id === 'flex') updateField('flexMode', 'auto');
                        }}
                        className={`p-4 rounded-xl border text-left flex flex-col justify-between h-32 transition-all cursor-pointer ${
                          config.motorizationType === item.id 
                            ? 'bg-purple-950/30 border-purple-500 text-purple-100 shadow-[0_4px_20px_rgba(168,85,247,0.15)]' 
                            : 'bg-slate-950/40 border-purple-950/40 text-slate-400 hover:border-purple-900/40 hover:text-slate-200'
                        }`}
                      >
                        <span className="font-bold text-xs font-display">{item.label}</span>
                        <span className="text-[10px] text-slate-500 leading-tight mt-1">{item.desc}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-3 border-t border-purple-950/15 pt-5">
                  <p className="text-sm text-slate-300 font-semibold">Qual a relação de posse do veículo?</p>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { id: 'own', label: 'Próprio', desc: 'Sem parcelas de financiamento.' },
                      { id: 'financed', label: 'Financiado', desc: 'Parcelas de financiamento.' },
                      { id: 'rented', label: 'Alugado', desc: 'Locadora ou aplicativos.' }
                    ].map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => updateField('ownership_type', item.id as any)}
                        className={`p-4 rounded-xl border text-left flex flex-col justify-between h-32 transition-all cursor-pointer ${
                          (config.ownership_type || 'own') === item.id 
                            ? 'bg-purple-950/30 border-purple-500 text-purple-100 shadow-[0_4px_20px_rgba(168,85,247,0.15)]' 
                            : 'bg-slate-950/40 border-purple-950/40 text-slate-400 hover:border-purple-900/40 hover:text-slate-200'
                        }`}
                      >
                        <span className="font-bold text-xs font-display">{item.label}</span>
                        <span className="text-[10px] text-slate-500 leading-tight mt-1">{item.desc}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* STEP 2345: Combined Identification for Rented Vehicle (Fast Flow) */}
            {activeStepId === 2345 && (
              <div className="space-y-4">
                <p className="text-sm text-slate-300">Insira os detalhes do carro alugado para identificação rápida:</p>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-400 font-display">MARCA</label>
                    <input
                      type="text"
                      placeholder="Ex: Chevrolet, Fiat..."
                      value={brand}
                      onChange={(e) => setBrand(e.target.value)}
                      className="w-full bg-slate-950/50 border border-purple-950/40 rounded-xl p-3 text-slate-100 font-bold focus:outline-none focus:border-purple-500"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-400 font-display">MODELO</label>
                    <input
                      type="text"
                      placeholder="Ex: Onix, Argo..."
                      value={model}
                      onChange={(e) => setModel(e.target.value)}
                      className="w-full bg-slate-950/50 border border-purple-950/40 rounded-xl p-3 text-slate-100 font-bold focus:outline-none focus:border-purple-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-400 font-display">ANO</label>
                    <input
                      type="number"
                      min="2000"
                      max="2027"
                      value={year}
                      onChange={(e) => setYear(parseInt(e.target.value) || 2022)}
                      className="w-full bg-slate-950/50 border border-purple-950/40 rounded-xl p-3 text-slate-100 font-bold focus:outline-none focus:border-purple-500"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-400 font-display">MOTOR / ESPECIFICAÇÃO</label>
                    <input
                      type="text"
                      placeholder="Ex: 1.0 Flex..."
                      value={motorizationName}
                      onChange={(e) => setMotorizationName(e.target.value)}
                      className="w-full bg-slate-950/50 border border-purple-950/40 rounded-xl p-3 text-slate-100 font-bold focus:outline-none focus:border-purple-500"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* STEP 2: Marca */}
            {activeStepId === 2 && (
              <div className="space-y-3">
                <p className="text-sm text-slate-300">Qual a fabricante/marca do veículo?</p>
                <input
                  type="text"
                  placeholder="Ex: Chevrolet, Fiat, Toyota, Renault..."
                  value={brand}
                  onChange={(e) => setBrand(e.target.value)}
                  className="w-full bg-slate-950/50 border border-purple-950/40 rounded-xl p-4 text-slate-100 font-bold font-sans focus:outline-none focus:border-purple-500"
                />
                <div className="grid grid-cols-4 gap-2">
                  {['Chevrolet', 'Fiat', 'Volkswagen', 'Renault', 'Toyota', 'Hyundai', 'Ford', 'Honda'].map((b) => (
                    <button
                      key={b}
                      type="button"
                      onClick={() => setBrand(b)}
                      className={`py-2 px-3 rounded-xl text-xs font-semibold border transition-colors cursor-pointer ${
                        brand === b 
                          ? 'bg-purple-950/40 border-purple-500 text-purple-200' 
                          : 'bg-slate-950/20 border-purple-950/40 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {b}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* STEP 3: Modelo */}
            {activeStepId === 3 && (
              <div className="space-y-3">
                <p className="text-sm text-slate-300 font-sans">Qual o modelo comercial do veículo?</p>
                <input
                  type="text"
                  placeholder="Ex: Onix, Argo, Gol, Kwid, Corolla..."
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  className="w-full bg-slate-950/50 border border-purple-950/40 rounded-xl p-4 text-slate-100 font-bold focus:outline-none focus:border-purple-500"
                />
              </div>
            )}

            {/* STEP 4: Ano */}
            {activeStepId === 4 && (
              <div className="space-y-3">
                <p className="text-sm text-slate-300 font-sans">Qual o ano de fabricação/modelo?</p>
                <input
                  type="number"
                  min="2000"
                  max="2027"
                  value={year}
                  onChange={(e) => setYear(parseInt(e.target.value) || 2022)}
                  className="w-full bg-slate-950/50 border border-purple-950/40 rounded-xl p-4 text-slate-100 font-bold focus:outline-none focus:border-purple-500"
                />
              </div>
            )}

            {/* STEP 5: Motorização */}
            {activeStepId === 5 && (
              <div className="space-y-3">
                <p className="text-sm text-slate-300 font-sans">Qual a especificação do motor?</p>
                <input
                  type="text"
                  placeholder="Ex: 1.0 Flex, 1.6 16v, 2.0 Turbo, Elétrico 150cv..."
                  value={motorizationName}
                  onChange={(e) => setMotorizationName(e.target.value)}
                  className="w-full bg-slate-950/50 border border-purple-950/40 rounded-xl p-4 text-slate-100 font-bold focus:outline-none focus:border-purple-500"
                />
              </div>
            )}

            {/* STEP 6: Tipo de energia/combustível */}
            {activeStepId === 6 && (
              <div className="space-y-3">
                <p className="text-sm text-slate-300 font-sans">Selecione o tipo de energia/combustível primário:</p>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {[
                    { id: 'gasoline', label: 'Gasolina', disabled: config.motorizationType === 'electric' },
                    { id: 'ethanol', label: 'Etanol', disabled: config.motorizationType === 'electric' || config.motorizationType === 'diesel' },
                    { id: 'diesel', label: 'Diesel', disabled: config.motorizationType !== 'diesel' && config.motorizationType !== 'flex' },
                    { id: 'electric', label: 'Eletricidade (Bateria)', disabled: config.motorizationType !== 'electric' && config.motorizationType !== 'hybrid' },
                    { id: 'hybrid', label: 'Híbrido (Misto)', disabled: config.motorizationType !== 'hybrid' }
                  ].map((mode) => (
                    <button
                      key={mode.id}
                      type="button"
                      disabled={mode.disabled}
                      onClick={() => {
                        if (config.motorizationType === 'flex') {
                          updateField('flexMode', mode.id === 'gasoline' ? 'gasoline' : mode.id === 'ethanol' ? 'ethanol' : 'auto');
                        }
                      }}
                      className={`p-4 rounded-xl border text-center font-bold text-xs flex flex-col justify-center items-center h-20 transition-all cursor-pointer ${
                        mode.disabled 
                          ? 'opacity-30 cursor-not-allowed border-purple-950/10'
                          : (config.motorizationType === 'flex' && config.flexMode === mode.id) || (config.motorizationType !== 'flex' && config.motorizationType === mode.id)
                            ? 'bg-purple-950/40 border-purple-500 text-purple-200 shadow-md' 
                            : 'bg-slate-950/20 border-purple-950/40 text-slate-400'
                      }`}
                    >
                      {mode.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* STEP 7: Consumo */}
            {activeStepId === 7 && (
              <div className="space-y-4">
                <p className="text-sm text-slate-300 font-sans">Informe os parâmetros de rendimento do veículo:</p>

                {/* Combustion & Diesel */}
                {(config.motorizationType === 'gasoline' || config.motorizationType === 'ethanol' || config.motorizationType === 'diesel') && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <CurrencyInput 
                      label="Preço do combustível (R$/Litro)"
                      value={config.fuelPrice}
                      onChange={(v) => updateField('fuelPrice', v)}
                    />
                    <div className="space-y-1.5">
                      <label className="block text-xs font-bold text-slate-400 font-display">CONSUMO MÉDIO (Km/L)</label>
                      <input 
                        type="number"
                        step="0.1"
                        value={config.fuelConsumption}
                        onChange={(e) => updateField('fuelConsumption', parseFloat(e.target.value) || 0)}
                        className="w-full bg-slate-950/40 border border-purple-950/40 rounded-xl p-3.5 text-slate-100 font-bold"
                      />
                    </div>
                  </div>
                )}

                {/* Flex */}
                {config.motorizationType === 'flex' && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <CurrencyInput 
                        label="Preço Gasolina (R$/L)"
                        value={config.fuelPrice}
                        onChange={(v) => updateField('fuelPrice', v)}
                      />
                      <div className="space-y-1.5">
                        <label className="block text-xs font-bold text-slate-400 font-display">Km/L Gasolina</label>
                        <input 
                          type="number"
                          step="0.1"
                          value={config.fuelConsumption}
                          onChange={(e) => updateField('fuelConsumption', parseFloat(e.target.value) || 0)}
                          className="w-full bg-slate-950/40 border border-purple-950/40 rounded-xl p-3.5 text-slate-100 font-bold"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <CurrencyInput 
                        label="Preço Etanol (R$/L)"
                        value={config.ethanolPrice}
                        onChange={(v) => updateField('ethanolPrice', v)}
                      />
                      <div className="space-y-1.5">
                        <label className="block text-xs font-bold text-slate-400 font-display">Km/L Etanol</label>
                        <input 
                          type="number"
                          step="0.1"
                          value={config.ethanolConsumption}
                          onChange={(e) => updateField('ethanolConsumption', parseFloat(e.target.value) || 0)}
                          className="w-full bg-slate-950/40 border border-purple-950/40 rounded-xl p-3.5 text-slate-100 font-bold"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Electric EV or Hybrid EV details */}
                {(config.motorizationType === 'electric' || config.motorizationType === 'hybrid') && (
                  <div className="space-y-4">
                    {config.motorizationType === 'hybrid' && (
                      <div className="grid grid-cols-2 gap-4 border-b border-purple-950/10 pb-4">
                        <CurrencyInput 
                          label="Preço Gasolina (R$/L)"
                          value={config.fuelPrice}
                          onChange={(v) => updateField('fuelPrice', v)}
                        />
                        <div className="space-y-1.5">
                          <label className="block text-xs font-bold text-slate-400 font-display">Km/L Gasolina</label>
                          <input 
                            type="number"
                            step="0.1"
                            value={config.hybridGasConsumption || config.fuelConsumption}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value) || 0;
                              updateField('hybridGasConsumption', val);
                              updateField('fuelConsumption', val);
                            }}
                            className="w-full bg-slate-950/40 border border-purple-950/40 rounded-xl p-3.5 text-slate-100 font-bold"
                          />
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="block text-xs font-bold text-slate-400 font-display">CONSUMO ELÉTRICO (kWh/100km)</label>
                        <input 
                          type="number"
                          step="0.1"
                          value={config.evConsumption || 16.5}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value) || 0;
                            updateField('evConsumption', val);
                          }}
                          className="w-full bg-slate-950/40 border border-purple-950/40 rounded-xl p-3.5 text-slate-100 font-bold"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="block text-xs font-bold text-slate-400 font-display">TEMPO MÉDIO DE RECARGA (Minutos)</label>
                        <input 
                          type="number"
                          value={config.avgChargeTime || 40}
                          onChange={(e) => updateField('avgChargeTime', parseInt(e.target.value) || 0)}
                          className="w-full bg-slate-950/40 border border-purple-950/40 rounded-xl p-3.5 text-slate-100 font-bold"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <CurrencyInput 
                        label="Tarifa Recarga Caseira (R$/kWh)"
                        value={config.homeKwhPrice || config.kwhPrice || 0.85}
                        onChange={(v) => {
                          updateField('homeKwhPrice', v);
                          updateField('kwhPrice', v);
                        }}
                      />
                      <CurrencyInput 
                        label="Tarifa Recarga Pública (R$/kWh)"
                        value={config.publicKwhPrice || 1.95}
                        onChange={(v) => updateField('publicKwhPrice', v)}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <PercentageInput 
                        label="% Recarga Residencial"
                        value={config.homeChargingPercent || 70}
                        onChange={(v) => {
                          updateField('homeChargingPercent', v);
                          updateField('publicChargingPercent', 100 - v);
                        }}
                      />
                      <PercentageInput 
                        label="% Recarga Pública"
                        value={config.publicChargingPercent || 30}
                        onChange={(v) => {
                          updateField('publicChargingPercent', v);
                          updateField('homeChargingPercent', 100 - v);
                        }}
                      />
                    </div>

                    {/* Dynamic Savings Card */}
                    {(() => {
                      const consumption = config.evConsumption || 16.5;
                      const homePrice = config.homeKwhPrice || config.kwhPrice || 0.85;
                      const publicPrice = config.publicKwhPrice || 1.95;
                      const homePct = (config.homeChargingPercent !== undefined) ? config.homeChargingPercent : 70;
                      const publicPct = 100 - homePct;

                      const weightedTariff = (homePrice * (homePct / 100)) + (publicPrice * (publicPct / 100));
                      const costPerKm = (consumption / 100) * weightedTariff;
                      const costPer100Km = costPerKm * 100;
                      // Gas comparison: 10km/L @ 5.80/L = 0.58/km
                      const gasCostPerKm = 0.58;
                      const savingsPerKm = Math.max(0, gasCostPerKm - costPerKm);

                      return (
                        <div className="p-4 bg-purple-950/20 border border-purple-500/15 rounded-2xl space-y-2">
                          <h5 className="text-xs font-bold text-purple-300 font-display flex items-center gap-1.5">
                            <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                            Previsão de Eficiência Elétrica
                          </h5>
                          <div className="grid grid-cols-3 gap-2 text-center">
                            <div className="p-2 bg-slate-950/40 rounded-xl">
                              <span className="block text-[9px] text-slate-400 font-bold uppercase">Custo R$/Km</span>
                              <span className="text-xs font-bold text-white tabular-nums">{costPerKm.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                            </div>
                            <div className="p-2 bg-slate-950/40 rounded-xl">
                              <span className="block text-[9px] text-slate-400 font-bold uppercase">Custo / 100Km</span>
                              <span className="text-xs font-bold text-white tabular-nums">{costPer100Km.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                            </div>
                            <div className="p-2 bg-emerald-950/30 rounded-xl border border-emerald-500/10">
                              <span className="block text-[9px] text-emerald-400 font-bold uppercase">Economia/100Km</span>
                              <span className="text-xs font-bold text-emerald-400 tabular-nums">{(savingsPerKm * 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>
            )}

            {/* STEP 8: Custos do veículo próprio/financiado */}
            {activeStepId === 8 && (
              <div className="space-y-4 max-h-[420px] overflow-y-auto pr-2">
                <div className="p-3 bg-purple-950/10 border border-purple-500/10 text-slate-300 rounded-xl text-xs flex items-center justify-between">
                  <span>Deixe campos em branco para aplicar valores sugeridos.</span>
                  <div className="flex items-center gap-1 font-bold text-purple-400">
                    <Sparkles className="w-4 h-4 animate-bounce" />
                    <span>Inteligente</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <CostInputWithFrequency 
                    label="Seguro"
                    amount={config.insuranceCost}
                    frequency={config.insuranceFreq}
                    onAmountChange={(v) => updateField('insuranceCost', v)}
                    onFrequencyChange={(f) => updateField('insuranceFreq', f)}
                  />

                  <CostInputWithFrequency 
                    label="IPVA"
                    amount={config.ipvaCost}
                    frequency={config.ipvaFreq}
                    onAmountChange={(v) => updateField('ipvaCost', v)}
                    onFrequencyChange={(f) => updateField('ipvaFreq', f)}
                  />

                  <CostInputWithFrequency 
                    label="Licenciamento"
                    amount={config.licensingCost}
                    frequency={config.licensingFreq}
                    onAmountChange={(v) => updateField('licensingCost', v)}
                    onFrequencyChange={(f) => updateField('licensingFreq', f)}
                  />

                  {config.ownership_type === 'financed' && (
                    <CostInputWithFrequency 
                      label="Parcela do Financiamento"
                      amount={config.rentCost}
                      frequency={config.rentFreq}
                      onAmountChange={(v) => updateField('rentCost', v)}
                      onFrequencyChange={(f) => updateField('rentFreq', f)}
                    />
                  )}

                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-400 font-display">Pneus (R$ Jogo Completo)</label>
                    <input 
                      type="number"
                      value={config.tireCost}
                      onChange={(e) => updateField('tireCost', parseFloat(e.target.value) || 0)}
                      className="w-full bg-slate-950/40 border border-purple-950/40 rounded-xl p-3 text-slate-100 font-bold"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-400 font-display">Intervalo Troca de Pneus (KM)</label>
                    <input 
                      type="number"
                      value={config.tireIntervalKm}
                      onChange={(e) => updateField('tireIntervalKm', parseInt(e.target.value) || 0)}
                      className="w-full bg-slate-950/40 border border-purple-950/40 rounded-xl p-3 text-slate-100 font-bold"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-400 font-display">Manutenção Geral (R$ anual estim.)</label>
                    <input 
                      type="number"
                      value={config.brakeCost}
                      onChange={(e) => updateField('brakeCost', parseFloat(e.target.value) || 0)}
                      className="w-full bg-slate-950/40 border border-purple-950/40 rounded-xl p-3 text-slate-100 font-bold"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-400 font-display">Depreciação Real (R$/Km)</label>
                    <input 
                      type="number"
                      step="0.01"
                      placeholder="Ex: 0.15"
                      value={config.depreciationCost}
                      onChange={(e) => updateField('depreciationCost', parseFloat(e.target.value) || 0)}
                      className="w-full bg-slate-950/40 border border-purple-950/40 rounded-xl p-3 text-slate-100 font-bold"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* STEP 801: Locação & Custos Inclusos (Premium Rental Step) */}
            {activeStepId === 801 && (
              <div className="space-y-4 max-h-[420px] overflow-y-auto pr-2">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <CostInputWithFrequency 
                    label="Valor do Aluguel/Assinatura"
                    amount={config.rentCost}
                    frequency={config.rentFreq}
                    onAmountChange={(v) => updateField('rentCost', v)}
                    onFrequencyChange={(f) => updateField('rentFreq', f)}
                  />

                  <CostInputWithFrequency 
                    label="Lavagem"
                    amount={config.washCost}
                    frequency={config.washFreq}
                    onAmountChange={(v) => updateField('washCost', v)}
                    onFrequencyChange={(f) => updateField('washFreq', f)}
                  />

                  <CurrencyInput 
                    label="Alimentação Diária"
                    value={config.rental_food_daily || 0}
                    onChange={(v) => updateField('rental_food_daily', v)}
                  />

                  <CurrencyInput 
                    label="Franquia/Avarias (Previsão Mensal)"
                    value={config.rental_damage_monthly || 0}
                    onChange={(v) => updateField('rental_damage_monthly', v)}
                  />

                  <CurrencyInput 
                    label="Taxa de Limpeza Adicional (Mensal)"
                    value={config.rental_cleaning_monthly || 0}
                    onChange={(v) => updateField('rental_cleaning_monthly', v)}
                  />
                </div>

                <div className="border border-purple-950/40 rounded-2xl p-4 bg-slate-950/30 space-y-3">
                  <h4 className="text-xs font-bold text-purple-400 font-display">CUSTOS INCLUSOS NO CONTRATO DE LOCAÇÃO</h4>
                  <p className="text-[11px] text-slate-400">Desmarque os itens que NÃO estão inclusos no seu contrato para somar de volta ao seu custo por Km:</p>
                  
                  <div className="grid grid-cols-2 gap-3 pt-2">
                    {[
                      { key: 'includedSeguro', label: 'Seguro do Carro' },
                      { key: 'includedPneus', label: 'Troca de Pneus' },
                      { key: 'includedManutencao', label: 'Manut. Mecânica' },
                      { key: 'includedIpva', label: 'IPVA Pago' },
                      { key: 'includedLicenciamento', label: 'Licenciamento' },
                      { key: 'includedCarroReserva', label: 'Carro Reserva' },
                      { key: 'includedGuincho', label: 'Reboque / Assistência' },
                      { key: 'includedRevisoes', label: 'Revisões Periódicas' },
                    ].map((item) => (
                      <label key={item.key} className="flex items-center gap-2.5 p-2.5 rounded-lg bg-slate-950/50 hover:bg-purple-950/10 cursor-pointer border border-purple-950/10 transition-colors">
                        <input 
                          type="checkbox"
                          checked={config[item.key as keyof DetailedVehicleConfig] !== false}
                          onChange={(e) => updateField(item.key as any, e.target.checked)}
                          className="rounded border-purple-500 text-purple-600 focus:ring-purple-500/50 bg-[#09061c]"
                        />
                        <span className="text-xs text-slate-300 font-medium">{item.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Se algum item não estiver incluso, mostrar inputs adicionais */}
                {(config.includedSeguro === false || config.includedPneus === false || config.includedManutencao === false || config.includedIpva === false || config.includedLicenciamento === false) && (
                  <div className="border border-red-500/10 rounded-2xl p-4 bg-red-950/5 space-y-4">
                    <h4 className="text-xs font-bold text-red-400 flex items-center gap-1.5 font-display">
                      <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
                      CUSTOS NÃO COBERTOS PELA LOCADORA (A SEU CARGO)
                    </h4>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                      {config.includedSeguro === false && (
                        <CostInputWithFrequency 
                          label="Seguro (A seu cargo)"
                          amount={config.insuranceCost}
                          frequency={config.insuranceFreq}
                          onAmountChange={(v) => updateField('insuranceCost', v)}
                          onFrequencyChange={(f) => updateField('insuranceFreq', f)}
                        />
                      )}

                      {config.includedIpva === false && (
                        <CostInputWithFrequency 
                          label="IPVA (A seu cargo)"
                          amount={config.ipvaCost}
                          frequency={config.ipvaFreq}
                          onAmountChange={(v) => updateField('ipvaCost', v)}
                          onFrequencyChange={(f) => updateField('ipvaFreq', f)}
                        />
                      )}

                      {config.includedLicenciamento === false && (
                        <CostInputWithFrequency 
                          label="Licenciamento (A seu cargo)"
                          amount={config.licensingCost}
                          frequency={config.licensingFreq}
                          onAmountChange={(v) => updateField('licensingCost', v)}
                          onFrequencyChange={(f) => updateField('licensingFreq', f)}
                        />
                      )}

                      {config.includedPneus === false && (
                        <div className="space-y-1.5">
                          <label className="block text-xs font-bold text-slate-400 font-display">Custo de Pneus (Jogo Completo)</label>
                          <input 
                            type="number"
                            value={config.tireCost}
                            onChange={(e) => updateField('tireCost', parseFloat(e.target.value) || 0)}
                            className="w-full bg-slate-950/40 border border-purple-950/40 rounded-xl p-3 text-slate-100 font-bold"
                          />
                        </div>
                      )}

                      {config.includedManutencao === false && (
                        <div className="space-y-1.5">
                          <label className="block text-xs font-bold text-slate-400 font-display">Manutenção Adicional Anual (Est.)</label>
                          <input 
                            type="number"
                            value={config.brakeCost}
                            onChange={(e) => updateField('brakeCost', parseFloat(e.target.value) || 0)}
                            className="w-full bg-slate-950/40 border border-purple-950/40 rounded-xl p-3 text-slate-100 font-bold"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* STEP 9: Revisão final */}
            {activeStepId === 9 && (
              <div className="space-y-6">
                <p className="text-sm text-slate-300 font-sans">
                  Configuração finalizada com sucesso! Abaixo está o demonstrativo do seu custo por km calculado:
                </p>

                <div className="bg-slate-950/50 rounded-2xl p-6 border border-purple-950/20 space-y-4">
                  <div className="flex items-center justify-between border-b border-purple-950/10 pb-3">
                    <span className="text-sm text-slate-400 font-medium font-sans">Custo de Combustível / Energia</span>
                    <span className="text-base font-extrabold text-white font-display tabular-nums">
                      {result.fuelOrEnergy.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}/km
                    </span>
                  </div>

                  <div className="flex items-center justify-between border-b border-purple-950/10 pb-3">
                    <span className="text-sm text-slate-400 font-medium font-sans">Custo de Manutenção / Desgaste</span>
                    <span className="text-base font-extrabold text-white font-display tabular-nums">
                      {result.maintenance.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}/km
                    </span>
                  </div>

                  <div className="flex items-center justify-between border-b border-purple-950/10 pb-3">
                    <span className="text-sm text-slate-400 font-medium font-sans">Custos Fixos / Aluguel / Contrato</span>
                    <span className="text-base font-extrabold text-white font-display tabular-nums">
                      {result.fixed.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}/km
                    </span>
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <span className="text-base font-bold text-purple-400 font-display">Custo Real Total por Km</span>
                    <span className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-indigo-300 font-display tabular-nums">
                      {result.totalPerKm.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}/km
                    </span>
                  </div>
                </div>

                <div className="p-4 bg-purple-950/10 border border-purple-500/10 rounded-xl text-xs text-slate-400 font-sans italic leading-relaxed flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
                  <span>Esse valor é dinâmico e impacta diretamente no seu break-even e margem de lucro calculada no seu Dashboard de Decisão.</span>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Nav Controls */}
      <div className="flex items-center justify-between pt-4 border-t border-purple-950/10 select-none">
        <button
          onClick={handleBack}
          disabled={step === 1}
          className="px-5 py-3 rounded-xl border border-purple-950/40 text-slate-400 hover:text-slate-200 disabled:opacity-20 flex items-center gap-1.5 text-xs font-bold transition-all cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar
        </button>

        {step < totalSteps ? (
          <button
            onClick={handleNext}
            className="px-6 py-3.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer"
          >
            Avançar
            <ArrowRight className="w-4 h-4" />
          </button>
        ) : (
          <button
            onClick={handleSaveConfig}
            className="px-6 py-3.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-[0_4px_20px_rgba(16,185,129,0.2)]"
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-100" />
            Salvar e Aplicar
          </button>
        )}
      </div>
    </div>
  );
};

function getStepTitle(s: number): string {
  switch (s) {
    case 1: return 'Tipo de Veículo';
    case 2: return 'Marca';
    case 3: return 'Modelo';
    case 4: return 'Ano';
    case 5: return 'Motorização';
    case 6: return 'Tipo de Combustível';
    case 7: return 'Consumo';
    case 8: return 'Custos Adicionais';
    case 9: return 'Revisão Final';
    default: return '';
  }
}
