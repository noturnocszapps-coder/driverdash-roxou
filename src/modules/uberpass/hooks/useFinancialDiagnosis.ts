import { useMemo } from 'react';

export type FinancialDiagnosisStatus = 'prejuizo' | 'atencao' | 'vale_a_pena' | 'excelente';

export interface FinancialDiagnosisInput {
  estimatedRevenue: number;
  breakEvenRevenue: number;
  netProfitPerHour: number;
  targetProfitPerHour: number;
  estimatedSavings: number;
}

export interface FinancialDiagnosisOutput {
  status: FinancialDiagnosisStatus;
  label: string;
  description: string;
  backgroundColor: string;
  borderColor: string;
  textColor: string;
  dotColor: string;
}

export function useFinancialDiagnosis(input: FinancialDiagnosisInput): FinancialDiagnosisOutput {
  return useMemo(() => {
    const {
      estimatedRevenue,
      breakEvenRevenue,
      netProfitPerHour,
      targetProfitPerHour,
      estimatedSavings,
    } = input;

    let status: FinancialDiagnosisStatus = 'prejuizo';
    let label = 'Prejuízo / Inviável';
    let description = 'Seu faturamento estimado para hoje está abaixo do break-even. O modelo de taxa percentual padrão ainda é mais vantajoso.';
    let backgroundColor = 'bg-rose-950/20';
    let borderColor = 'border-rose-500/30';
    let textColor = 'text-rose-200';
    let dotColor = 'bg-rose-400';

    if (estimatedRevenue < breakEvenRevenue) {
      status = 'prejuizo';
      label = 'Prejuízo / Inviável';
      description = `Seu faturamento estimado (${estimatedRevenue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}) está abaixo do ponto de equilíbrio (${breakEvenRevenue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}). Não ative o Passe ainda!`;
      backgroundColor = 'bg-rose-950/25 backdrop-blur-md';
      borderColor = 'border-rose-500/30';
      textColor = 'text-rose-200';
      dotColor = 'bg-rose-500';
    } else if (estimatedSavings > 0 && netProfitPerHour < targetProfitPerHour) {
      status = 'atencao';
      label = 'Atenção';
      description = `O faturamento cobre o Passe (break-even superado), mas seu lucro líquido por hora (${netProfitPerHour.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}/h) ainda está abaixo da sua meta pessoal (${targetProfitPerHour.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}/h). Avalie aumentar as horas trabalhadas ou melhorar o faturamento.`;
      backgroundColor = 'bg-amber-950/25 backdrop-blur-md';
      borderColor = 'border-amber-500/30';
      textColor = 'text-amber-200';
      dotColor = 'bg-amber-400';
    } else if (estimatedSavings > 0 && netProfitPerHour >= targetProfitPerHour && netProfitPerHour < targetProfitPerHour * 1.25) {
      status = 'vale_a_pena';
      label = 'Vale a pena';
      description = `Excelente! O Passe já está gerando economia de ${estimatedSavings.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}/dia e seu lucro por hora (${netProfitPerHour.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}/h) atinge sua meta financeira!`;
      backgroundColor = 'bg-indigo-950/25 backdrop-blur-md';
      borderColor = 'border-indigo-500/30';
      textColor = 'text-indigo-200';
      dotColor = 'bg-indigo-400';
    } else {
      status = 'excelente';
      label = 'Excelente oportunidade';
      description = `Oportunidade de ouro! Com o Passe ativo, você economiza ${estimatedSavings.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} hoje, com margem líquida excelente e lucro de ${netProfitPerHour.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}/h, superando muito sua meta!`;
      backgroundColor = 'bg-emerald-950/35 backdrop-blur-md shadow-[0_0_25px_rgba(16,185,129,0.15)]';
      borderColor = 'border-emerald-500/40';
      textColor = 'text-emerald-100';
      dotColor = 'bg-emerald-400';
    }

    return {
      status,
      label,
      description,
      backgroundColor,
      borderColor,
      textColor,
      dotColor,
    };
  }, [input]);
}
