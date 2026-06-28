import React, { useMemo, useState } from 'react';
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  Tooltip, 
  Legend, 
  CartesianGrid 
} from 'recharts';

export interface FinancialComparisonChartProps {
  passPrice: number;
  oldFeePercent: number;
  breakEvenRevenue: number;
}

export const FinancialComparisonChart: React.FC<FinancialComparisonChartProps> = ({
  passPrice,
  oldFeePercent,
  breakEvenRevenue
}) => {
  const chartData = useMemo(() => {
    const dataPoints = [];
    const minRev = Math.max(50, Math.floor(breakEvenRevenue * 0.4));
    const maxRev = Math.ceil(breakEvenRevenue * 2.2);
    // 8 points
    const step = Math.max(20, Math.floor((maxRev - minRev) / 8));

    for (let r = minRev; r <= maxRev; r += step) {
      const oldFeeCost = r * (oldFeePercent / 100);
      const passCost = passPrice;
      dataPoints.push({
        revenue: r,
        'Taxa Uber Clássica (20%)': parseFloat(oldFeeCost.toFixed(2)),
        'Nova Assinatura Passe': parseFloat(passCost.toFixed(2)),
      });
    }
    return dataPoints;
  }, [breakEvenRevenue, oldFeePercent, passPrice]);

  const formatBRL = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(val);
  };

  return (
    <div className="bg-[#0b0821]/50 border border-purple-950/20 rounded-2xl p-6 space-y-4 shadow-lg backdrop-blur-md" id="financial-comparison-chart-container">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 border-b border-purple-950/10 pb-4">
        <div>
          <h4 className="font-extrabold text-white text-base font-display">Análise Comparativa & Break-Even</h4>
          <p className="text-xs text-slate-400 font-sans">Compare o custo acumulado da taxa da Uber tradicional vs. a taxa fixa do Passe de Ganhos.</p>
        </div>
        <div className="bg-purple-950/20 px-3 py-1.5 rounded-lg border border-purple-500/20 text-xs text-purple-300 font-display font-semibold">
          Equilíbrio aos {formatBRL(breakEvenRevenue)}
        </div>
      </div>

      <div className="h-[260px] w-full" id="comparison-recharts-container">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={chartData}
            margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
          >
            <defs>
              <linearGradient id="colorOldFee" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.25}/>
                <stop offset="95%" stopColor="#f43f5e" stopOpacity={0}/>
              </linearGradient>
              <linearGradient id="colorPass" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.25}/>
                <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e1b4b" opacity={0.3} />
            <XAxis 
              dataKey="revenue" 
              stroke="#64748b" 
              fontSize={10} 
              tickLine={false}
              tickFormatter={(v) => formatBRL(v)} 
            />
            <YAxis 
              stroke="#64748b" 
              fontSize={10} 
              tickLine={false}
              tickFormatter={(v) => formatBRL(v)} 
            />
            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  return (
                    <div className="bg-[#0b0821] border border-purple-950/80 p-4 rounded-xl shadow-2xl space-y-1.5">
                      <p className="text-xs font-bold text-slate-400 font-display">Faturamento: {formatBRL(payload[0].payload.revenue)}</p>
                      <div className="flex items-center gap-2 text-rose-400 text-xs">
                        <span className="w-2 h-2 rounded-full bg-rose-500" />
                        <span>Taxa Uber Clássica: {formatBRL(payload[0].value as number)}</span>
                      </div>
                      <div className="flex items-center gap-2 text-emerald-400 text-xs">
                        <span className="w-2 h-2 rounded-full bg-emerald-500" />
                        <span>Assinatura Passe: {formatBRL(payload[1].value as number)}</span>
                      </div>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Legend verticalAlign="top" height={36} iconType="circle" iconSize={8} />
            <Area 
              type="monotone" 
              dataKey="Taxa Uber Clássica (20%)" 
              stroke="#f43f5e" 
              strokeWidth={2}
              fillOpacity={1} 
              fill="url(#colorOldFee)" 
            />
            <Area 
              type="monotone" 
              dataKey="Nova Assinatura Passe" 
              stroke="#10b981" 
              strokeWidth={2}
              fillOpacity={1} 
              fill="url(#colorPass)" 
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
