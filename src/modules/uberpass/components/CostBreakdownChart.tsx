import React, { useMemo } from 'react';
import { 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell, 
  Tooltip,
  Legend
} from 'recharts';
import { CostBreakdown } from '../vehicleCost.calculations';

export interface CostBreakdownChartProps {
  costBreakdown: CostBreakdown;
  estimatedKm: number;
}

export const CostBreakdownChart: React.FC<CostBreakdownChartProps> = ({
  costBreakdown,
  estimatedKm
}) => {
  const chartData = useMemo(() => {
    return [
      { name: 'Combustível / Energia', value: parseFloat((costBreakdown.fuelOrEnergy * estimatedKm).toFixed(2)), color: '#a78bfa' }, // Light purple
      { name: 'Manutenção / Pneus', value: parseFloat((costBreakdown.maintenance * estimatedKm).toFixed(2)), color: '#60a5fa' },     // Blue
      { name: 'Custos Fixos / Aluguel', value: parseFloat((costBreakdown.fixed * estimatedKm).toFixed(2)), color: '#f59e0b' },     // Amber
      { name: 'Depreciação', value: parseFloat((costBreakdown.depreciation * estimatedKm).toFixed(2)), color: '#ec4899' },            // Pink
      { name: 'Outros Custos Variáveis', value: parseFloat((costBreakdown.variableOther * estimatedKm).toFixed(2)), color: '#14b8a6' }, // Teal
    ].filter(item => item.value > 0);
  }, [costBreakdown, estimatedKm]);

  const totalValue = useMemo(() => {
    return chartData.reduce((acc, curr) => acc + curr.value, 0);
  }, [chartData]);

  const formatBRL = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  return (
    <div className="bg-[#0b0821]/50 border border-purple-950/20 rounded-2xl p-6 space-y-4 shadow-lg backdrop-blur-md" id="cost-breakdown-chart-container">
      <div className="border-b border-purple-950/10 pb-4">
        <h4 className="font-extrabold text-white text-base font-display">Composição Diária de Custos</h4>
        <p className="text-xs text-slate-400 font-sans">Visualização proporcional de onde vão seus custos com base em rodagem diária de {estimatedKm} km.</p>
      </div>

      {chartData.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
          <div className="h-[220px] md:col-span-5 relative flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip 
                  formatter={(value: number) => [formatBRL(value), 'Custo Diário']}
                  contentStyle={{ backgroundColor: '#0b0821', borderColor: '#3b0764', borderRadius: '12px', color: '#f1f5f9' }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none select-none">
              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 font-display">Total Diário</span>
              <span className="text-lg font-black text-white font-display tabular-nums">{formatBRL(totalValue)}</span>
            </div>
          </div>

          <div className="md:col-span-7 space-y-3 font-sans">
            {chartData.map((item, index) => {
              const pct = totalValue > 0 ? (item.value / totalValue) * 100 : 0;
              return (
                <div key={index} className="flex items-center justify-between p-2 rounded-xl bg-slate-950/20 border border-purple-950/5 hover:border-purple-500/10 transition-colors">
                  <div className="flex items-center gap-2.5">
                    <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                    <span className="text-xs font-semibold text-slate-300">{item.name}</span>
                  </div>
                  <div className="flex items-baseline gap-2 font-display">
                    <span className="text-xs font-bold text-white tabular-nums">{formatBRL(item.value)}</span>
                    <span className="text-[10px] font-bold text-slate-500 tabular-nums">({pct.toFixed(1)}%)</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="h-[220px] flex items-center justify-center text-slate-500 text-sm italic font-sans">
          Nenhum custo registrado para o veículo.
        </div>
      )}
    </div>
  );
};
