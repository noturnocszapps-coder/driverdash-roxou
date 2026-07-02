/**
 * UberPass Recommendation Advisor Service
 * Module: UberPass (uberpass)
 * 
 * STABLE CORE - NÃO ALTERAR SEM AUTORIZAÇÃO EXPLÍCITA
 */

import { UBER_PASS_OPTIONS, UberPassOption } from './passConfig';
import { CalibratedRide } from '../journey/rideCalibration.service';

export interface PassSimulationResult {
  option: UberPassOption;
  costPerHour: number;
  costPerDay: number;
  costPerWeek: number;
  costPerMonth: number;
  feePercentageOfEarnings: number; // How much the pass cost represents of total earnings
  estimatedSavings: number; // Estimated savings compared to standard platform fee (e.g. 35%)
  isRecommended: boolean;
  reason: string;
}

export interface AdvisorAnalysis {
  totalRides: number;
  confidence: 'Baixa' | 'Média' | 'Alta';
  confidenceText: string;
  avgHoursPerDay: number;
  activeDaysPerWeek: number;
  avgEarningsPerDay: number;
  avgEarningsPerWeek: number;
  avgEarningsPerMonth: number;
  earningsPerHour: number;
  earningsPerKm: number;
  recommendedPassId: string;
  simulations: PassSimulationResult[];
  alerts: string[];
}

export const uberPassAdvisorService = {
  /**
   * Loads completed rides from localStorage and performs complete UberPass analysis
   */
  getAnalysis(): AdvisorAnalysis {
    let rides: CalibratedRide[] = [];
    try {
      const stored = localStorage.getItem('ride_logs');
      if (stored) {
        rides = JSON.parse(stored);
      }
    } catch (e) {
      console.error('[UberPass Advisor] Error parsing ride_logs:', e);
    }

    return this.analyzeRides(rides);
  },

  /**
   * Core math engine analyzing list of calibrated rides to output recommendation and simulations
   */
  analyzeRides(rides: CalibratedRide[]): AdvisorAnalysis {
    const totalRides = rides.length;
    
    // 1. Establish Confidence Level
    let confidence: 'Baixa' | 'Média' | 'Alta' = 'Baixa';
    let confidenceText = 'Recomendação preliminar (poucos dados)';
    if (totalRides >= 50) {
      confidence = 'Alta';
      confidenceText = 'Recomendação com alta confiança';
    } else if (totalRides >= 10) {
      confidence = 'Média';
      confidenceText = 'Recomendação com média confiança';
    }

    // 2. Extract profile metrics (or use reasonable default driver profile if rides are scarce)
    let avgHoursPerDay = 6.5;
    let activeDaysPerWeek = 5;
    let avgEarningsPerDay = 180;
    let totalKm = 0;
    let totalEarnings = 0;
    let totalDurationHours = 0;

    if (totalRides > 0) {
      // Analyze actual ride timestamps and earnings
      const uniqueDays = new Set<string>();
      
      rides.forEach(r => {
        totalEarnings += (r.receivedValue || 0) + (r.tipValue || 0);
        totalKm += (r.distancia_hodometro || r.distancia_haversine || 0);
        
        const dateStr = r.startTime ? r.startTime.split('T')[0] : '';
        if (dateStr) {
          uniqueDays.add(dateStr);
        }

        // Duration of ride in hours
        if (r.startTime && r.endTime) {
          const diffMs = new Date(r.endTime).getTime() - new Date(r.startTime).getTime();
          totalDurationHours += diffMs / (1000 * 60 * 60);
        }
      });

      const dayCount = uniqueDays.size || 1;
      avgEarningsPerDay = totalEarnings / dayCount;
      
      // Calculate active days in a week based on sample length
      if (dayCount <= 7) {
        activeDaysPerWeek = Math.max(1, dayCount);
      } else {
        // Average active days in 7-day windows
        activeDaysPerWeek = Math.min(7, Math.round((dayCount / (dayCount / 7))));
      }

      // Average active hours per day (estimating active tracking time)
      // Usually, a driver is online longer than just ride times, so we add online buffer
      const rideHoursPerDay = totalDurationHours / dayCount;
      avgHoursPerDay = Math.max(4, Math.min(14, rideHoursPerDay * 2)); // multiply by 2 to account for idle/waiting time
    }

    // Financial calculations
    const avgEarningsPerWeek = avgEarningsPerDay * activeDaysPerWeek;
    const avgEarningsPerMonth = avgEarningsPerWeek * 4.35; // average weeks in a month
    
    const earningsPerHour = avgEarningsPerDay / avgHoursPerDay;
    const earningsPerKm = totalKm > 0 ? totalEarnings / totalKm : 2.10;

    // Standard platform fee estimate (35%) used as comparison baseline
    const standardFeeRate = 0.35;
    const monthlyFeeWithoutPass = avgEarningsPerMonth * standardFeeRate;

    // 3. Simulate and evaluate all 4 passes
    const simulations: PassSimulationResult[] = UBER_PASS_OPTIONS.map(opt => {
      let costPerHour = 0;
      let costPerDay = 0;
      let costPerWeek = 0;
      let costPerMonth = 0;
      let estimatedSavings = 0;

      if (opt.type === 'time') {
        // Time based passes: 24h (R$40) or 72h (R$106)
        if (opt.id === 'pass_24h') {
          // Assume user buys a 24h pass for each active day of work
          costPerDay = opt.price;
          costPerWeek = costPerDay * activeDaysPerWeek;
          costPerMonth = costPerWeek * 4.35;
          costPerHour = costPerDay / avgHoursPerDay;
        } else {
          // 72h pass covers up to 3 consecutive days. 
          // If user works activeDaysPerWeek days:
          const passesNeededPerWeek = Math.ceil(activeDaysPerWeek / 3);
          costPerWeek = passesNeededPerWeek * opt.price;
          costPerMonth = costPerWeek * 4.35;
          costPerDay = costPerWeek / activeDaysPerWeek;
          costPerHour = costPerDay / avgHoursPerDay;
        }

        // Savings = (Monthly Earnings * standardFeeRate) - Monthly Pass Cost
        estimatedSavings = monthlyFeeWithoutPass - costPerMonth;
      } else {
        // Earnings limit passes: R$104 for limit R$333, or R$291 for limit R$984
        // Calculate passes needed per month based on monthly earnings volume
        const limit = opt.earningsLimit || 333;
        const passesNeededPerMonth = avgEarningsPerMonth / limit;
        
        costPerMonth = passesNeededPerMonth * opt.price;
        costPerWeek = costPerMonth / 4.35;
        costPerDay = costPerWeek / activeDaysPerWeek;
        costPerHour = costPerDay / avgHoursPerDay;

        // Savings = (Monthly Earnings * standardFeeRate) - Monthly Pass Cost
        // For earnings limits, standard fee is saved ONLY up to the limit of passes bought
        const feesSavedPerPass = limit * standardFeeRate; // e.g. 333 * 0.35 = R$116.55
        const netSavingsPerPass = feesSavedPerPass - opt.price; // e.g. R$116.55 - R$104 = R$12.55
        estimatedSavings = passesNeededPerMonth * netSavingsPerPass;
      }

      const feePercentageOfEarnings = avgEarningsPerMonth > 0 ? (costPerMonth / avgEarningsPerMonth) * 100 : 0;

      return {
        option: opt,
        costPerHour: Number(costPerHour.toFixed(2)),
        costPerDay: Number(costPerDay.toFixed(2)),
        costPerWeek: Number(costPerWeek.toFixed(2)),
        costPerMonth: Number(costPerMonth.toFixed(2)),
        feePercentageOfEarnings: Number(feePercentageOfEarnings.toFixed(1)),
        estimatedSavings: Number(estimatedSavings.toFixed(2)),
        isRecommended: false,
        reason: ''
      };
    });

    // 4. Select Best Pass & generate rationales
    let recommendedPassId = 'pass_24h';
    
    // Sort simulations by highest estimated savings
    const sortedSavings = [...simulations].sort((a, b) => b.estimatedSavings - a.estimatedSavings);
    
    // We override recommendation based on profile rules if savings are close or to respect context:
    if (avgHoursPerDay < 5 && activeDaysPerWeek <= 2) {
      // Works few hours and few days
      recommendedPassId = 'pass_24h';
    } else if (activeDaysPerWeek === 3 || activeDaysPerWeek === 4) {
      // Works 3-4 days seguidos, 72h is typically ideal
      recommendedPassId = 'pass_72h';
    } else if (activeDaysPerWeek >= 5) {
      // Works almost every day
      if (avgEarningsPerWeek > 1000) {
        // High earner: compare high-limit earnings pass vs recurring 72h
        const pass72h = simulations.find(s => s.option.id === 'pass_72h');
        const pass984 = simulations.find(s => s.option.id === 'pass_earnings_984');
        if (pass984 && pass72h && pass984.estimatedSavings > pass72h.estimatedSavings) {
          recommendedPassId = 'pass_earnings_984';
        } else {
          recommendedPassId = 'pass_72h';
        }
      } else {
        // Medium earner
        const pass72h = simulations.find(s => s.option.id === 'pass_72h');
        const pass333 = simulations.find(s => s.option.id === 'pass_earnings_333');
        if (pass333 && pass72h && pass333.estimatedSavings > pass72h.estimatedSavings) {
          recommendedPassId = 'pass_earnings_333';
        } else {
          recommendedPassId = 'pass_72h';
        }
      }
    }

    // Set recommended flag and detailed reasons
    simulations.forEach(sim => {
      if (sim.option.id === recommendedPassId) {
        sim.isRecommended = true;
        if (sim.option.id === 'pass_24h') {
          sim.reason = 'Você trabalha poucas horas ou de forma esporádica. O passe de 24h cobre seu dia operacional com menor risco e custo inicial baixo.';
        } else if (sim.option.id === 'pass_72h') {
          sim.reason = 'Você trabalha de 3 a 5 dias por semana de forma consistente. O passe de 72h reduz drasticamente seu custo por hora e otimiza o faturamento.';
        } else if (sim.option.id === 'pass_earnings_333') {
          sim.reason = 'Seu faturamento médio semanal e consistência indicam que o Passe por Ganhos R$333 garante melhor retenção líquida de taxas por corrida realizada.';
        } else {
          sim.reason = 'Seu alto volume de faturamento mensal torna o Passe por Ganhos R$984 o mais lucrativo, maximizando a isenção tributária da plataforma.';
        }
      } else {
        // Alternative descriptions
        if (sim.option.id === 'pass_24h') {
          sim.reason = 'Recomendado apenas para dias avulsos ou jornadas curtas de final de semana.';
        } else if (sim.option.id === 'pass_72h') {
          sim.reason = 'Excelente alternativa se você agrupar suas corridas em blocos de 3 dias consecutivos.';
        } else if (sim.option.id === 'pass_earnings_333') {
          sim.reason = 'Bom para ganhos moderados e motoristas de tempo parcial.';
        } else {
          sim.reason = 'Indicado apenas para motoristas ultra-produtivos com faturamento alto e frequente.';
        }
      }
    });

    // 5. Generate intelligent alerts
    const alerts: string[] = [];
    const recommendedSim = simulations.find(s => s.isRecommended);
    
    if (recommendedSim && recommendedSim.estimatedSavings <= 0) {
      alerts.push('Atenção: Seu faturamento atual é baixo para compensar os custos fixos dos passes. Recomendamos rodar sem passe temporariamente.');
    } else {
      if (recommendedPassId !== 'pass_24h' && avgHoursPerDay < 4) {
        alerts.push('Seu custo por hora com passe está alto hoje devido à baixa carga de horas online.');
      }
      if (recommendedSim && recommendedSim.estimatedSavings > 150) {
        alerts.push(`Trocar para o ${recommendedSim.option.name} pode economizar aproximadamente R$ ${recommendedSim.estimatedSavings.toFixed(0)} este mês!`);
      }
    }

    return {
      totalRides,
      confidence,
      confidenceText,
      avgHoursPerDay: Number(avgHoursPerDay.toFixed(1)),
      activeDaysPerWeek,
      avgEarningsPerDay: Number(avgEarningsPerDay.toFixed(2)),
      avgEarningsPerWeek: Number(avgEarningsPerWeek.toFixed(2)),
      avgEarningsPerMonth: Number(avgEarningsPerMonth.toFixed(2)),
      earningsPerHour: Number(earningsPerHour.toFixed(2)),
      earningsPerKm: Number(earningsPerKm.toFixed(2)),
      recommendedPassId,
      simulations,
      alerts
    };
  }
};
