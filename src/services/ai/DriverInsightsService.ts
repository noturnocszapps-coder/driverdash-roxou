import { Earning, Expense, Vehicle, FinancialGoal } from '../../types';
import { DriverDailyDiagnostic } from './base.types';
import { safeNumber, normalizePositiveNumber } from '../../utils/number';
import { Logger } from '../logger';

const logger = new Logger('DriverInsightsService');

export class DriverInsightsService {
  /**
   * Módulo 1 — Analisa se vale trabalhar, horários, região e lucro esperado
   */
  public static analyzeDailyOutlook(
    earnings: Earning[],
    expenses: Expense[],
    vehicle: Vehicle | null,
    costPerKm: number,
    goals: FinancialGoal | null,
    uberPassSettings?: any
  ): DriverDailyDiagnostic {
    logger.debug('Running analyzeDailyOutlook diagnostic analysis');

    // Validation & safe parsing of inputs
    if (costPerKm < 0) {
      logger.warn('Received negative costPerKm. Normalizing to positive value.', { costPerKm });
    }
    const safeCostPerKm = normalizePositiveNumber(costPerKm, 0.74);
    if (safeCostPerKm === 0) {
      logger.warn('Received zero costPerKm. Using default fallback of 0.74.');
    }

    const today = new Date();
    const dayOfWeek = today.getDay(); // 0 = Sunday, 6 = Saturday
    
    // Analytical defaults
    let demandFactor = 1.0;
    let bestRegion = 'Centro Comercial & Aeroporto';
    let bestHourToStart = '06:00';
    let bestHourToStop = '19:00';
    let shouldWorkToday = true;
    let shouldWorkReason = 'Demanda regular esperada para o dia.';
 
    // Rule engine for day of week demand
    if (dayOfWeek === 0) { // Sunday
      demandFactor = 0.85;
      bestRegion = 'Orla, Parques e Centros Gastronômicos';
      bestHourToStart = '10:00';
      bestHourToStop = '18:00';
      shouldWorkToday = true;
      shouldWorkReason = 'Domingo tem bom ticket médio devido a passeios e retorno de viagens. Foco em parques e shoppings!';
    } else if (dayOfWeek === 5 || dayOfWeek === 6) { // Friday, Saturday
      demandFactor = 1.45;
      bestRegion = 'Zonas de Bares, Eventos e Restaurantes Premium';
      bestHourToStart = '14:00';
      bestHourToStop = '02:00';
      shouldWorkToday = true;
      shouldWorkReason = 'Fim de semana com altíssima demanda devido a shows, eventos noturnos e bares. Ótimo para faturar alto!';
    } else if (dayOfWeek === 1) { // Monday
      demandFactor = 1.15;
      bestRegion = 'Terminais de Integração, Aeroporto e Eixos Empresariais';
      bestHourToStart = '05:30';
      bestHourToStop = '17:30';
      shouldWorkToday = true;
      shouldWorkReason = 'Início de semana útil. Alta procura corporativa pela manhã em áreas residenciais rumo aos centros empresariais.';
    } else { // Midweek (Tue, Wed, Thu)
      demandFactor = 0.95;
      bestRegion = 'Região Hospitalar, Shopping Centers e Hubs de Transporte';
      bestHourToStart = '07:00';
      bestHourToStop = '18:30';
      shouldWorkToday = true;
      shouldWorkReason = 'Dia útil típico de fluxo corporativo e consultas. Mantenha rotas otimizadas.';
    }

    const estimatedKm = 160;
    const grossPerHour = 42 * demandFactor;
    const hoursPlanned = 8;
    const expectedGross = grossPerHour * hoursPlanned;

    const rawRentalAmount = vehicle?.rental_amount;
    const rentalCostDaily = rawRentalAmount ? safeNumber(rawRentalAmount) / 7 : 0;
    if (rentalCostDaily < 0) {
      logger.warn('Rental amount is negative. Treating as 0 cost.');
    }

    const totalCost = (estimatedKm * safeCostPerKm) + Math.max(0, rentalCostDaily);
    const expectedNetProfit = Math.max(0, expectedGross - totalCost);

    // Pass rules
    const breakEvenThreshold = uberPassSettings 
      ? (Number(uberPassSettings.pass_price || 0) / (Number(uberPassSettings.old_fee_percent || 20) / 100))
      : 180; // Default approximate gross break-even
    
    const shouldActivatePass = expectedGross >= breakEvenThreshold;
    let passTypeRecommendation: '24 horas' | '72 horas' | 'Por ganhos' | 'Não ativar' = 'Não ativar';
    let passReason = `Faturamento estimado de R$ ${expectedGross.toFixed(2)} é baixo demais para justificar o passe (Ponto de Equilíbrio: R$ ${breakEvenThreshold.toFixed(2)}).`;

    if (shouldActivatePass) {
      if (uberPassSettings?.pass_type) {
        passTypeRecommendation = uberPassSettings.pass_type;
        passReason = `RECOMENDADO! Seu faturamento projetado de R$ ${expectedGross.toFixed(2)} superou o ponto de equilíbrio real de R$ ${breakEvenThreshold.toFixed(2)} para o passe de ${uberPassSettings.pass_type === 'Por ganhos' ? 'Por Ganhos' : uberPassSettings.pass_type === '24 horas' ? '24 Horas' : '72 Horas'}.`;
      } else {
        if (dayOfWeek === 5) { // Friday -> recommend 72h to cover entire weekend
          passTypeRecommendation = '72 horas';
          passReason = 'Final de semana começando! Ative o passe de 72h para isentar a comissão de sexta a domingo e poupar até R$ 200.';
        } else if (dayOfWeek === 6 || dayOfWeek === 0) {
          passTypeRecommendation = '24 horas';
          passReason = 'Faturamento de final de semana atinge o ponto de equilíbrio rapidamente. Ative o passe de 24h.';
        } else {
          passTypeRecommendation = 'Por ganhos';
          passReason = 'Meta diária corporativa consistente alcançada. O passe por limite de ganhos trará maior ROI.';
        }
      }
    }

    return {
      shouldWorkToday,
      shouldWorkReason,
      shouldActivatePass,
      passTypeRecommendation,
      passReason,
      bestHourToStart,
      bestHourToStop,
      bestRegionToWork: bestRegion,
      expectedNetProfit
    };
  }
}
