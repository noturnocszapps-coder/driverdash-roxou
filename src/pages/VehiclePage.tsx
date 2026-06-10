import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { Car, Fuel, Milestone, CreditCard, Sparkles, CheckCircle2, ShieldAlert } from 'lucide-react';
import { motion } from 'motion/react';
import { OwnershipType } from '../types';

export const VehiclePage: React.FC = () => {
  const { vehicle, upsertVehicle } = useApp();

  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [year, setYear] = useState('');
  const [plate, setPlate] = useState('');
  const [fuelType, setFuelType] = useState('flex');
  const [kmPerLiter, setKmPerLiter] = useState('');
  const [ownershipType, setOwnershipType] = useState<OwnershipType>('own');
  const [weeklyKmLimit, setWeeklyKmLimit] = useState('');
  const [monthlyKmLimit, setMonthlyKmLimit] = useState('');
  
  // Fixed costs states
  const [fixedRent, setFixedRent] = useState('');
  const [fixedInsurance, setFixedInsurance] = useState('');
  const [fixedMaintenance, setFixedMaintenance] = useState('');

  const [success, setSuccess] = useState(false);

  // Sync state if vehicle already exists
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
    }
  }, [vehicle]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!brand || !model || !year || !kmPerLiter) {
      alert('Preencha ao menos marca, modelo, ano e consumo!');
      return;
    }

    try {
      await upsertVehicle({
        brand,
        model,
        year: Number(year),
        plate_optional: plate,
        fuel_type: fuelType,
        km_per_liter: Number(kmPerLiter),
        ownership_type: ownershipType,
        weekly_km_limit: weeklyKmLimit ? Number(weeklyKmLimit) : undefined,
        monthly_km_limit: monthlyKmLimit ? Number(monthlyKmLimit) : undefined
      });
      
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Visual title bar */}
      <div className="border-b border-purple-950/20 pb-4">
        <h2 className="text-xl font-bold text-white tracking-wide">Módulo do Veículo</h2>
        <p className="text-xs text-purple-300/50 mt-1">Configure o veículo ativo para o cálculo preciso do consumo por litro, estimativas fiscais e alertas de limites de km.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* EDIT MOTOR FLIGHT FORM CONTAINER */}
        <motion.div 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="lg:col-span-2 bg-[#0b0720]/85 border border-purple-950/45 rounded-2xl p-6 shadow-xl"
        >
          <div className="flex items-center gap-2 border-b border-purple-950/20 pb-3 mb-6">
            <Car className="w-5 h-5 text-purple-400" />
            <h3 className="text-md font-bold text-white">Especificações do Carro Ativo</h3>
          </div>

          {success && (
            <div className="mb-6 p-4 bg-emerald-950/60 border border-emerald-900/40 text-emerald-400 text-xs rounded-xl flex items-center gap-2 font-medium">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Dados do carro salvos e atualizados com sucesso!</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-slate-400 mb-1.5 font-sans">Marca / Fabricante</label>
                <input 
                  type="text" 
                  value={brand} 
                  onChange={(e) => setBrand(e.target.value)}
                  placeholder="Ex: Chevrolet, Fiat, Toyota"
                  className="w-full bg-[#04010a] border border-purple-950/50 rounded-xl p-3 text-slate-100 focus:outline-none focus:border-purple-600 transition-colors"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1.5 font-sans">Modelo</label>
                <input 
                  type="text" 
                  value={model} 
                  onChange={(e) => setModel(e.target.value)}
                  placeholder="Ex: Onix Plus, Cronos, Corolla"
                  className="w-full bg-[#04010a] border border-purple-950/50 rounded-xl p-3 text-slate-100 focus:outline-none focus:border-purple-600 transition-colors"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-slate-400 mb-1.5 font-sans">Ano de Fabricação</label>
                <input 
                  type="number" 
                  value={year} 
                  onChange={(e) => setYear(e.target.value)}
                  placeholder="Ex: 2022"
                  className="w-full bg-[#04010a] border border-purple-950/50 rounded-xl p-3 text-slate-100 pr-3 focus:outline-none focus:border-purple-600 font-mono"
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
                <label className="block text-slate-400 mb-1.5 font-sans">Tipo Combustível</label>
                <select
                  value={fuelType}
                  onChange={(e) => setFuelType(e.target.value)}
                  className="w-full bg-[#04010a] border border-purple-950/50 rounded-xl p-3 text-slate-100 focus:outline-none focus:border-purple-600 cursor-pointer"
                >
                  <option value="flex">Flex (Alcool/Gasolina)</option>
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
              <div>
                <label className="block text-purple-300 font-semibold mb-1.5 font-sans">Consumo Médio (KM por Litro)</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-3 flex items-center text-purple-400">
                    <Fuel className="w-4 h-4" />
                  </span>
                  <input 
                    type="number" 
                    step="0.1"
                    value={kmPerLiter} 
                    onChange={(e) => setKmPerLiter(e.target.value)}
                    placeholder="Ex: 11.5"
                    className="w-full bg-[#04010a] border border-purple-950/50 rounded-xl py-3 pl-10 pr-4 text-slate-100 font-bold focus:outline-none focus:border-purple-600 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1.5 font-sans">Tipo de Posse / Contrato</label>
                <select
                  value={ownershipType}
                  onChange={(e) => setOwnershipType(e.target.value as OwnershipType)}
                  className="w-full bg-[#04010a] border border-purple-950/50 rounded-xl p-3 text-slate-100 focus:outline-none focus:border-purple-600 cursor-pointer"
                >
                  <option value="own">Próprio</option>
                  <option value="rented">Alugado (Locadora)</option>
                  <option value="financed">Financiado</option>
                </select>
              </div>
            </div>

            {/* CONDITIONAL RENTED VEHICLE SECTION (Item 7 Limits) */}
            {ownershipType === 'rented' && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="bg-purple-950/10 border border-purple-950/40 rounded-xl p-4 space-y-4"
              >
                <h4 className="text-xs font-bold text-purple-400 font-mono uppercase tracking-wider flex items-center gap-1.5">
                  <Milestone className="w-4 h-4" /> Restrições de Franquia de KM (Contrato)
                </h4>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Limite Semanal de KM (Franquia)</label>
                    <input 
                      type="number" 
                      value={weeklyKmLimit} 
                      onChange={(e) => setWeeklyKmLimit(e.target.value)}
                      placeholder="Deixe em branco se for ilimitado"
                      className="w-full bg-[#04010a] border border-purple-950/50 rounded-xl p-2.5 text-slate-100 focus:outline-none focus:border-purple-600 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Limite Mensal de KM (Franquia)</label>
                    <input 
                      type="number" 
                      value={monthlyKmLimit} 
                      onChange={(e) => setMonthlyKmLimit(e.target.value)}
                      placeholder="Ex: 5000"
                      className="w-full bg-[#04010a] border border-purple-950/50 rounded-xl p-2.5 text-slate-100 focus:outline-none focus:border-purple-600 font-mono"
                    />
                  </div>
                </div>
              </motion.div>
            )}

            <button
              type="submit"
              className="w-full bg-gradient-to-r from-purple-700 to-indigo-600 hover:from-purple-600 hover:to-indigo-500 text-white font-semibold py-3 px-4 rounded-xl text-xs transition-all shadow-[0_4px_15px_rgba(147,51,234,0.3)] cursor-pointer"
            >
              Salvar Configuração do Veículo
            </button>
          </form>
        </motion.div>

        {/* CUSTOS FIXOS ESTIMADOS (Item 7 Costs) */}
        <div className="bg-[#0a061b] border border-purple-950/40 rounded-2xl p-6 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center gap-2 border-b border-purple-950/20 pb-3">
              <CreditCard className="w-4 h-4 text-indigo-400" />
              <h3 className="text-xs font-bold text-white uppercase tracking-wider font-mono text-indigo-400">Custos Fixos Estimados</h3>
            </div>

            <p className="text-[11px] text-purple-300/60 leading-relaxed font-sans">
              Insira seus custos fixos mensais para nos auxiliar a projetar o amortecimento real de lucros no fechamento consolidado.
            </p>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">Parcela Financiamento / Mensalidade Aluguel</label>
                <input 
                  type="number" 
                  value={fixedRent}
                  onChange={(e) => setFixedRent(e.target.value)}
                  placeholder="R$ 0,00"
                  className="w-full bg-[#04010a] border border-purple-950/50 rounded-lg p-2 text-slate-100 focus:outline-none focus:border-purple-600 font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Seguro Mensal Estimado</label>
                <input 
                  type="number" 
                  value={fixedInsurance}
                  onChange={(e) => setFixedInsurance(e.target.value)}
                  placeholder="R$ 0,00"
                  className="w-full bg-[#04010a] border border-purple-950/50 rounded-lg p-2 text-slate-100 focus:outline-none focus:border-purple-600 font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Provisão de Manutenção Preventiva</label>
                <input 
                  type="number" 
                  value={fixedMaintenance}
                  onChange={(e) => setFixedMaintenance(e.target.value)}
                  placeholder="R$ 0,00"
                  className="w-full bg-[#04010a] border border-purple-950/50 rounded-lg p-2 text-slate-100 focus:outline-none focus:border-purple-600 font-mono"
                />
              </div>
            </div>
          </div>

          <div className="border-t border-purple-950/20 pt-4 mt-6">
            <span className="text-[10px] text-indigo-400/50 block font-mono">SUPORTE DE ROTAS E HEATMAP</span>
            <p className="text-[11px] text-purple-300/30 leading-snug mt-1">Este veículo servirá de âncora para os cálculos de rotas, consumo otimizado, heatmap e o Índice Roxou de Demanda nas próximas etapas.</p>
          </div>
        </div>

      </div>

    </div>
  );
};
