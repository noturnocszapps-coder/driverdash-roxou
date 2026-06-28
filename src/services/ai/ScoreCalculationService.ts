import { Earning, Expense, DriverSession } from '../../types';
import { DriverScoreReport } from './base.types';
import { safeNumber, safeDivide, percent, clamp, normalizePositiveNumber } from '../../utils/number';
import { Logger } from '../logger';

const logger = new Logger('ScoreCalculationService');

export class ScoreCalculationService {
  /**
   * Módulo 2 — DriverScore (0 a 100)
   */
  public static calculateDriverScore(
    earnings: Earning[],
    expenses: Expense[],
    costPerKm: number,
    driverSessions: DriverSession[] = []
  ): DriverScoreReport {
    logger.debug('Calculating DriverScore based on telemetry metrics');

    // Safe parsing of costPerKm
    const safeCostPerKm = normalizePositiveNumber(costPerKm, 0.74);
    if (costPerKm < 0) {
      logger.warn('Received negative costPerKm. Normalizing to positive.', { costPerKm });
    }

    // Collect historical averages or fallback values
    const hasEarnings = earnings.length > 0;
    
    let totalGross = 0;
    let totalKm = 0;
    let totalOnlineMinutes = 0;
    let totalRides = 0;
    let totalEmptyKm = 0;

    for (const e of earnings) {
      const gross = safeNumber(e.gross_amount);
      const km = safeNumber(e.total_km);
      const onlineMin = safeNumber(e.online_minutes);
      const rides = safeNumber(e.rides_count);
      const emptyKm = safeNumber(e.empty_km || 0);

      if (gross < 0 || km < 0 || onlineMin < 0 || rides < 0 || emptyKm < 0) {
        logger.warn('Negative earning value encountered. Normalizing in accumulation.', { e });
      }

      totalGross += Math.max(0, gross);
      totalKm += Math.max(0, km);
      totalOnlineMinutes += Math.max(0, onlineMin);
      totalRides += Math.max(0, rides);
      totalEmptyKm += Math.max(0, emptyKm);
    }

    const totalHours = totalOnlineMinutes / 60;
    if (hasEarnings && totalHours <= 0) {
      logger.warn('Earnings exist but total hours is 0. Logging diagnostic anomaly.');
    }

    const profitPerHour = hasEarnings ? safeDivide(totalGross, totalHours, 32.5) : 32.5;
    const profitPerKm = hasEarnings ? safeDivide(totalGross, totalKm, 2.10) : 2.10;
    
    // Empty KM & Idle metrics
    const calculatedEmptyKmPercent = percent(totalEmptyKm, totalKm, 18);
    const emptyKmPercent = clamp(calculatedEmptyKmPercent, 0, 45);
    const idleTimePercent = 12; // Simulated average idle
    
    // Performance metrics
    const acceptanceRate = 88; // %
    const cancellationRate = 3.5; // %
    const passSavings = totalGross > 1000 ? 120 : 0;
    const roi = totalGross > 0 ? safeDivide(totalGross * 100, Math.max(1, totalGross - passSavings), 135) : 135;

    // Weight allocations
    let score = 50; // base score

    // Profit per hour contribution (Max +15)
    if (profitPerHour >= 40) score += 15;
    else if (profitPerHour >= 30) score += 10;
    else if (profitPerHour >= 20) score += 5;
    else score -= 5;

    // Profit per km contribution (Max +15)
    if (profitPerKm >= 2.5) score += 15;
    else if (profitPerKm >= 2.0) score += 10;
    else if (profitPerKm >= 1.5) score += 5;
    else score -= 5;

    // Empty KM contribution (Max +15)
    if (emptyKmPercent <= 15) score += 15;
    else if (emptyKmPercent <= 25) score += 10;
    else if (emptyKmPercent <= 35) score += 3;
    else score -= 8;

    // Acceptance rate contribution (Max +10)
    if (acceptanceRate >= 90) score += 10;
    else if (acceptanceRate >= 80) score += 7;
    else if (acceptanceRate >= 70) score += 3;
    else score -= 10;

    // Cancellation rate contribution (Max +10)
    if (cancellationRate <= 3) score += 10;
    else if (cancellationRate <= 6) score += 6;
    else score -= 8;

    // Cost per KM contribution (Max +10)
    if (costPerKm <= 0.65) score += 10;
    else if (costPerKm <= 0.85) score += 7;
    else if (costPerKm <= 1.1) score += 3;
    else score -= 5;

    // Ride volume contribution (Max +10)
    if (totalRides >= 100) score += 10;
    else if (totalRides >= 40) score += 7;
    else score += 3;

    // Clamp score
    score = Math.max(15, Math.min(100, score));

    // Determine Level
    let level: 'Bronze' | 'Prata' | 'Ouro' | 'Diamante' | 'Elite' = 'Bronze';
    if (score >= 95) level = 'Elite';
    else if (score >= 81) level = 'Diamante';
    else if (score >= 66) level = 'Ouro';
    else if (score >= 41) level = 'Prata';

    // Recommendations Engine
    const recommendations: string[] = [];
    if (emptyKmPercent > 20) {
      recommendations.push(`Seu índice de KM vazio está em ${emptyKmPercent.toFixed(1)}%. Evite rodar sem rumo após as corridas; pare em um ponto seguro de alta demanda.`);
    }
    if (profitPerHour < 35) {
      recommendations.push(`Seu lucro líquido por hora de ${profitPerHour.toFixed(2)} R$/h está abaixo do potencial. Experimente operar no horário de pico matutino (06:00 - 09:00) para elevar sua média.`);
    }
    if (costPerKm > 0.9) {
      recommendations.push(`Seu custo operacional por quilômetro está em R$ ${costPerKm.toFixed(2)}. Considere fazer manutenção preventiva ou revisar o seu gasto com combustível/aluguel para aumentar suas margens.`);
    }
    if (acceptanceRate < 85) {
      recommendations.push(`Sua taxa de aceitação está baixa (${acceptanceRate}%). Aceitar mais corridas dinâmicas sequenciais nos eixos centrais melhora seu DriverScore.`);
    }
    if (cancellationRate > 5) {
      recommendations.push(`Sua taxa de cancelamento está em ${cancellationRate}%. Evite aceitar corridas com endereços de partida excessivamente distantes.`);
    }
    if (recommendations.length === 0) {
      recommendations.push('Desempenho excelente! Continue seguindo o cronograma planejado e monitorando seus custos com o Passe Roxou.');
      recommendations.push('Dica de Elite: Ative o passe semanal em períodos com previsão de chuva ou feriados locais.');
    }

    return {
      score: Math.round(score),
      level,
      breakdown: {
        profitPerHour,
        profitPerKm,
        idleTimePercent,
        emptyKmPercent,
        acceptanceRate,
        cancellationRate,
        passSavings,
        roi,
        costPerKm,
        rideCount: totalRides
      },
      recommendations
    };
  }
}
