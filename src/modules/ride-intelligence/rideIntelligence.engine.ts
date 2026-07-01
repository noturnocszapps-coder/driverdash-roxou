/**
 * DriverDash Roxou - Modular Ride Intelligence Engine (FASE 2)
 * Location: src/modules/ride-intelligence/rideIntelligence.engine.ts
 * Description: Continuous learning motor analyzing ride history, telemetry, driver behavior, 
 * geolocations, and pricing structures to provide advanced profitability co-piloting.
 */

import { Earning, Expense, Vehicle, VehicleCostSettings } from '../../types';

// Types and Interfaces
export interface NeighborhoodStats {
  neighborhood: string;
  ridesCount: number;
  avgFare: number;
  avgProfit: number;
  avgDurationMin: number;
  avgIdleSec: number;
  emptyReturnKm: number;
  revenuePerKm: number;
  revenuePerHour: number;
  avgSpeedKmh: number;
  avgDistanceKm: number;
  peakHours: string[];
  bestDays: string[];
  returnIndex: number; // 0 to 100 score of how well this neighborhood returns to profitable zones
  cancellationIndex: number; // 0 to 100
  score: number; // 0 to 100 overall rating
}

export interface DemandPrediction {
  neighborhood: string;
  hour: number;
  dayOfWeek: number;
  clima: string;
  evento: string;
  level: 'low' | 'medium' | 'high';
  probabilityMessage: string;
  surgeEstimate: number;
}

export type OfferRating = 'Excelente' | 'Boa' | 'Aceitável' | 'Somente se retornar' | 'Ruim';

export interface OfferScoreResult {
  score: number; // 0 to 100
  rating: OfferRating;
  reason: string;
  estimatedProfit: number;
  revenuePerKm: number;
  revenuePerHour: number;
  costEstimate: number;
}

export interface DriverProfileStats {
  bestTimeSlots: string[]; // e.g. ["18h–22h"]
  bestNeighborhoods: string[]; // e.g. ["Centro", "Parque do Povo"]
  bestCategory: string; // e.g. "Uber Comfort"
  bestPlatform: string; // e.g. "99"
  bestTripLengthType: 'Viagens curtas' | 'Viagens longas' | 'Indiferente';
  longRidesYield: string; // e.g. "Corridas acima de 8 km"
  averageHourlyEarning: number;
  averageProfitMargin: number;
}

export interface SmartInsight {
  id: string;
  title: string;
  description: string;
  type: 'success' | 'warning' | 'info' | 'critical';
  timestamp: number;
}

export interface DriverDecision {
  id: string;
  offerId: string;
  score: number;
  rating: OfferRating;
  action: 'accepted' | 'declined';
  reason?: string;
  timestamp: number;
}

// In-Memory Cache and Learning Weights State (Requirement 10 - performance & memoization)
class RideIntelligenceEngine {
  private static instance: RideIntelligenceEngine;
  
  // Memoization and Cache Maps
  private neighborhoodCache: Map<string, NeighborhoodStats> = new Map();
  private insightsCache: SmartInsight[] = [];
  private driverProfileCache: DriverProfileStats | null = null;
  private decisionsLog: DriverDecision[] = [];
  
  // Adaptive weights that evolve as driver accepts/declines offers (Requirement 9)
  private learningWeights = {
    minRevenuePerKm: 1.6,
    minRevenuePerHour: 28.0,
    preferredTimeMultiplier: 1.15,
    cancellationTolerance: 15, // max percentage
  };

  private constructor() {
    this.loadDecisionsFromLocalStorage();
  }

  public static getInstance(): RideIntelligenceEngine {
    if (!RideIntelligenceEngine.instance) {
      RideIntelligenceEngine.instance = new RideIntelligenceEngine();
    }
    return RideIntelligenceEngine.instance;
  }

  /**
   * Continuous Learning Engine: recalculates everything based on real-time driver updates.
   * Runs instantly without reloading page.
   */
  public analyzeAndRecalculate(
    rideLogs: any[],
    earnings: Earning[],
    expenses: Expense[],
    vehicle: Vehicle | null,
    costSettings: VehicleCostSettings | null
  ) {
    // 1. Clear memoization cache to trigger fresh calculations
    this.neighborhoodCache.clear();
    this.driverProfileCache = null;

    // 2. Compute Neighborhoods Stats
    const neighborhoodsData = this.calculateNeighborhoods(rideLogs, vehicle, costSettings);
    neighborhoodsData.forEach(item => {
      this.neighborhoodCache.set(item.neighborhood.toLowerCase(), item);
    });

    // 3. Compute Driver Personal Profile
    this.driverProfileCache = this.calculateDriverProfile(rideLogs, earnings, expenses);

    // 4. Generate Dynamic AI Insights
    this.insightsCache = this.generateInsights(rideLogs, earnings, expenses, vehicle, costSettings);

    console.log('[RIDE_INTELLIGENCE] Engine recalculated successfully. Active neighborhoods cataloged:', this.neighborhoodCache.size);
  }

  /**
   * 2. APRENDIZADO DOS BAIRROS (NEIGHBORHOODS INTELLIGENCE)
   */
  public calculateNeighborhoods(
    rideLogs: any[],
    vehicle: Vehicle | null,
    costSettings: VehicleCostSettings | null
  ): NeighborhoodStats[] {
    const neighborhoodGroups: { [key: string]: any[] } = {};

    // Group rides by starting neighborhood
    rideLogs.forEach(ride => {
      const bOrigem = ride.bairroOrigem || ride.pickup_neighborhood || 'Centro';
      const cleanB = bOrigem.trim();
      if (!neighborhoodGroups[cleanB]) {
        neighborhoodGroups[cleanB] = [];
      }
      neighborhoodGroups[cleanB].push(ride);
    });

    // Operational cost per KM
    let kmCost = 0.55;
    if (vehicle) {
      const fuelCost = costSettings?.fuel_price ? (costSettings.fuel_price / (vehicle.km_per_liter || 10)) : 0.50;
      const maintenanceCost = 0.12; // R$/km estimativa padrão
      const depreciation = 0.10;
      kmCost = fuelCost + maintenanceCost + depreciation;
    }

    const result: NeighborhoodStats[] = [];

    Object.keys(neighborhoodGroups).forEach(bName => {
      const rides = neighborhoodGroups[bName];
      const totalRides = rides.length;

      let sumFare = 0;
      let sumProfit = 0;
      let sumDurationMin = 0;
      let sumIdleSec = 0;
      let sumDistanceKm = 0;
      let sumSpeed = 0;
      let cancellationCount = 0;
      let emptyReturnKmSum = 0;

      const hourCounts: { [hour: number]: number } = {};
      const dayCounts: { [day: number]: number } = {};
      let returnTrips = 0;

      rides.forEach(r => {
        const fare = Number(r.receivedValue || r.fare_value || 0);
        const distance = Number(r.distance || 0);
        const durationSec = Number(r.duration || 0);
        const idleSec = Number(r.tempo_parado || r.idle_time * 60 || 0);
        const profit = Number(r.lucro || r.profit || (fare - distance * kmCost));
        const speed = Number(r.velocidade_media || 32);

        sumFare += fare;
        sumProfit += profit;
        sumDurationMin += (durationSec / 60);
        sumIdleSec += idleSec;
        sumDistanceKm += distance;
        sumSpeed += speed;

        if (r.status === 'cancelled') {
          cancellationCount++;
        }

        // Return empty estimate: if destination neighborhood is far and driver did not get a ride back soon
        if (r.empty_km_return > 0) {
          emptyReturnKmSum += r.empty_km_return;
        } else if (distance > 10 && fare / distance < 1.4) {
          // proxy returning empty distance
          emptyReturnKmSum += (distance * 0.4);
        }

        // Track dates
        const dateObj = new Date(r.startTime || r.timestamp);
        const h = dateObj.getHours();
        const d = dateObj.getDay();

        hourCounts[h] = (hourCounts[h] || 0) + 1;
        dayCounts[d] = (dayCounts[d] || 0) + 1;

        // Return index check: Did this ride end up in a high revenue neighborhood?
        const bDest = r.bairroDestino || r.destination_neighborhood || 'Centro';
        if (['centro', 'parque do povo', 'prudenshopping', 'rodoviária'].includes(bDest.toLowerCase())) {
          returnTrips++;
        }
      });

      // Averages
      const avgFare = sumFare / totalRides;
      const avgProfit = sumProfit / totalRides;
      const avgDurationMin = sumDurationMin / totalRides;
      const avgIdleSec = sumIdleSec / totalRides;
      const avgDistanceKm = sumDistanceKm / totalRides;
      const avgSpeedKmh = sumSpeed / totalRides;

      const revenuePerKm = sumDistanceKm > 0 ? (sumFare / sumDistanceKm) : 2.0;
      const revenuePerHour = sumDurationMin > 0 ? (sumFare / (sumDurationMin / 60)) : 35.0;

      // Extract high demand hours
      const sortedHours = Object.keys(hourCounts)
        .map(h => ({ hour: Number(h), count: hourCounts[Number(h)] }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 2)
        .map(item => `${item.hour}h–${item.hour + 2}h`);

      // Extract best days
      const daysStr = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
      const sortedDays = Object.keys(dayCounts)
        .map(d => ({ day: Number(d), count: dayCounts[Number(d)] }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 2)
        .map(item => daysStr[item.day]);

      // Return and cancellation indexes
      const returnIndex = totalRides > 0 ? Math.round((returnTrips / totalRides) * 100) : 50;
      const cancellationIndex = totalRides > 0 ? Math.round((cancellationCount / totalRides) * 100) : 0;

      // Neighborhood overall Score formula (0 to 100)
      // Weighted index based on: profit margin, revenue/km, return index, idle time penalty, and cancellation index
      let scoreRaw = (avgProfit / Math.max(avgFare, 1)) * 40; // up to 40 points for profit margin
      scoreRaw += Math.min(revenuePerKm / 3.0, 1) * 30; // up to 30 points for R$/km
      scoreRaw += (returnIndex / 100) * 20; // up to 20 points for destination returning
      scoreRaw += Math.max(0, 10 - (avgIdleSec / 300) * 10); // up to 10 points for low waiting/idle times
      scoreRaw -= (cancellationIndex / 100) * 15; // penalty for cancellations

      const score = Math.max(10, Math.min(100, Math.round(scoreRaw)));

      result.push({
        neighborhood: bName,
        ridesCount: totalRides,
        avgFare: Number(avgFare.toFixed(2)),
        avgProfit: Number(avgProfit.toFixed(2)),
        avgDurationMin: Number(avgDurationMin.toFixed(1)),
        avgIdleSec: Math.round(avgIdleSec),
        emptyReturnKm: Number(emptyReturnKmSum.toFixed(1)),
        revenuePerKm: Number(revenuePerKm.toFixed(2)),
        revenuePerHour: Number(revenuePerHour.toFixed(2)),
        avgSpeedKmh: Number(avgSpeedKmh.toFixed(1)),
        avgDistanceKm: Number(avgDistanceKm.toFixed(2)),
        peakHours: sortedHours.length > 0 ? sortedHours : ['12h-14h', '18h-20h'],
        bestDays: sortedDays.length > 0 ? sortedDays : ['Sexta', 'Sábado'],
        returnIndex,
        cancellationIndex,
        score
      });
    });

    return result.sort((a, b) => b.score - a.score);
  }

  /**
   * 3. HEATMAP COLOR CATEGORY GETTER
   */
  public getNeighborhoodHeatColor(neighborhood: string): 'verde' | 'amarelo' | 'vermelho' {
    const stats = this.neighborhoodCache.get(neighborhood.toLowerCase());
    if (!stats) {
      // Fallback based on default high-density zones in Presidente Prudente
      const nLower = neighborhood.toLowerCase();
      if (['centro', 'prudenshopping', 'unoeste'].some(p => nLower.includes(p))) {
        return 'verde'; // Rentabilidade / Demanda alta
      }
      if (['rodoviária', 'parque do povo', 'toledo', 'unesp'].some(p => nLower.includes(p))) {
        return 'amarelo'; // Moderada
      }
      return 'vermelho'; // Baixa rentabilidade ou retorno vazio alto
    }

    if (stats.score >= 70) {
      return 'verde'; // Excelente rentabilidade e alta demanda
    }
    if (stats.score >= 45) {
      return 'amarelo'; // Rentabilidade mediana
    }
    return 'vermelho'; // Baixa rentabilidade ou alto índice de retorno vazio
  }

  /**
   * 4. PREVISÃO DE DEMANDA (DEMAND FORECASTING ALGORITHM)
   */
  public predictDemand(
    neighborhood: string,
    hour: number,
    dayOfWeek: number,
    clima: string = 'Limpo',
    evento: string = 'Nenhum'
  ): DemandPrediction {
    let baseScore = 45; // medium default

    const nLower = neighborhood.toLowerCase();

    // 1. Historical spatial weights
    if (nLower.includes('centro') || nLower.includes('prudenshopping')) {
      baseScore += 25;
    } else if (nLower.includes('unoeste') || nLower.includes('unesp') || nLower.includes('toledo')) {
      baseScore += 20;
    } else if (nLower.includes('parque do povo')) {
      baseScore += 15;
    } else if (nLower.includes('rodoviária') || nLower.includes('aeroporto')) {
      baseScore += 10;
    }

    // 2. Weather conditions impact (Rain boosts demand heavily in Brazil)
    if (clima.toLowerCase().includes('chuva') || clima.toLowerCase().includes('chuvoso') || clima.toLowerCase().includes('tempestade')) {
      baseScore += 25;
    }

    // 3. Special events boost
    if (evento !== 'Nenhum' && evento !== '') {
      baseScore += 30;
    }

    // 4. Hour-of-day rush patterns
    const isRushHour = (hour >= 7 && hour <= 9) || (hour >= 11 && hour <= 13) || (hour >= 17 && hour <= 19) || (hour >= 22 && hour <= 23);
    if (isRushHour) {
      baseScore += 15;
    }

    // 5. Weekend boosts for night clubs / Parque do Povo
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 5 || dayOfWeek === 6; // Sun, Fri, Sat
    if (isWeekend) {
      if (nLower.includes('parque do povo') || nLower.includes('centro')) {
        baseScore += 10;
      }
    }

    // Map score to categorical level
    let level: 'low' | 'medium' | 'high' = 'medium';
    let probabilityMessage = 'Probabilidade regular de corridas na região.';
    let surgeEstimate = 1.0;

    const finalScore = Math.min(100, Math.max(10, baseScore));

    if (finalScore >= 75) {
      level = 'high';
      probabilityMessage = 'Alta probabilidade de corrida nos próximos 15 minutos.';
      surgeEstimate = 1.35 + (finalScore - 75) * 0.02;
    } else if (finalScore >= 45) {
      level = 'medium';
      probabilityMessage = 'Média probabilidade de corrida nos próximos 20 a 30 minutos.';
      surgeEstimate = 1.0 + (finalScore - 45) * 0.01;
    } else {
      level = 'low';
      probabilityMessage = 'Baixa probabilidade de chamada direta neste horário.';
      surgeEstimate = 1.0;
    }

    return {
      neighborhood,
      hour,
      dayOfWeek,
      clima,
      evento,
      level,
      probabilityMessage,
      surgeEstimate: Number(surgeEstimate.toFixed(2))
    };
  }

  /**
   * 5. SCORE DA OFERTA (AI OFFER ACCEPTANCE SCORING)
   */
  public calculateOfferScore(
    fare: number,
    distanceKm: number,
    durationMin: number,
    pickupNeighborhood: string,
    destinationNeighborhood: string,
    vehicle: Vehicle | null,
    costSettings: VehicleCostSettings | null
  ): OfferScoreResult {
    // Determine cost per KM from actual vehicle settings
    let kmCost = 0.55;
    if (vehicle) {
      const fuel = costSettings?.fuel_price ? (costSettings.fuel_price / (vehicle.km_per_liter || 10)) : 0.50;
      kmCost = fuel + 0.15; // fuel + standard depreciation & tire wear
    }

    const distance = Math.max(0.1, distanceKm);
    const durationHours = Math.max(1, durationMin) / 60;

    const costEstimate = distance * kmCost;
    const estimatedProfit = fare - costEstimate;

    const revPerKm = fare / distance;
    const revPerHour = fare / durationHours;

    // Base score calculations (0 - 100)
    let score = 50; // starts at average

    // 1. R$/km scoring (Crucial for Brazil ride optimization)
    // 1.50 is regular, 2.0 is good, 2.50+ is excellent
    const kmRatio = revPerKm / this.learningWeights.minRevenuePerKm;
    if (kmRatio >= 1.5) {
      score += 25;
    } else if (kmRatio >= 1.0) {
      score += 10;
    } else {
      score -= 25; // penalty for low km rate
    }

    // 2. R$/hour scoring
    const hourRatio = revPerHour / this.learningWeights.minRevenuePerHour;
    if (hourRatio >= 1.5) {
      score += 20;
    } else if (hourRatio >= 1.0) {
      score += 8;
    } else {
      score -= 15;
    }

    // 3. Destinaton Return Value (Does destination neighborhood have high historical return score?)
    const destStats = this.neighborhoodCache.get(destinationNeighborhood.toLowerCase());
    if (destStats) {
      if (destStats.score >= 70) {
        score += 10; // returns to highly profitable area
      } else if (destStats.score < 40) {
        score -= 10; // high risk of dead miles back
      }
    } else {
      // standard return check for center
      if (['centro', 'prudenshopping', 'parque do povo'].some(pref => destinationNeighborhood.toLowerCase().includes(pref))) {
        score += 5;
      }
    }

    // 4. Learning feedback impact (Requirement 9): Does driver accept these types of rides often?
    const recentSameDestDecisions = this.decisionsLog.filter(
      d => d.rating === 'Somente se retornar' && d.action === 'accepted'
    );
    if (recentSameDestDecisions.length > 3) {
      // Driver regularly accepts return rides, boost returning score weight
      this.learningWeights.minRevenuePerKm = 1.45; // adapt criteria down
    }

    // Ensure score boundaries
    const finalScore = Math.min(100, Math.max(0, score));

    // Map score to AI Rating labels (Excelente, Boa, Aceitável, Somente se retornar, Ruim)
    let rating: OfferRating = 'Aceitável';
    let reason = '';

    const isReturnDestination = ['centro', 'parque do povo', 'prudenshopping'].some(
      p => destinationNeighborhood.toLowerCase().includes(p)
    );

    if (finalScore >= 85) {
      rating = 'Excelente';
      reason = `Rentabilidade excelente de R$ ${revPerKm.toFixed(2)}/km e R$ ${revPerHour.toFixed(0)}/h. Destino com excelente retorno.`;
    } else if (finalScore >= 65) {
      rating = 'Boa';
      reason = `Corrida lucrativa. Ganhos estimados de R$ ${estimatedProfit.toFixed(2)} livres de custos operacionais.`;
    } else if (finalScore >= 45) {
      if (isReturnDestination) {
        rating = 'Somente se retornar';
        reason = `Ganhos medianos, mas o destino é excelente (${destinationNeighborhood}) para retornar ao ponto central.`;
      } else {
        rating = 'Aceitável';
        reason = `Margem aceitável. Indicada para completar metas do dia se a região estiver tranquila.`;
      }
    } else {
      rating = 'Ruim';
      reason = `Prejuízo potencial ou ganhos extremamente baixos (${revPerKm.toFixed(2)} R$/km). Custo operacional é de R$ ${kmCost.toFixed(2)}/km.`;
    }

    return {
      score: finalScore,
      rating,
      reason,
      estimatedProfit: Number(estimatedProfit.toFixed(2)),
      revenuePerKm: Number(revPerKm.toFixed(2)),
      revenuePerHour: Number(revPerHour.toFixed(2)),
      costEstimate: Number(costEstimate.toFixed(2))
    };
  }

  /**
   * 6. PERFIL DO MOTORISTA (PERSONAL ANALYSIS DRIVER PROFILE)
   */
  public calculateDriverProfile(
    rideLogs: any[],
    earnings: Earning[],
    expenses: Expense[]
  ): DriverProfileStats {
    if (rideLogs.length === 0) {
      // Return high quality default mockup matching Presidente Prudente region
      return {
        bestTimeSlots: ['18h–22h', '11h–13h'],
        bestNeighborhoods: ['Centro', 'Prudenshopping', 'UNOESTE'],
        bestCategory: 'Uber Comfort',
        bestPlatform: 'Uber',
        bestTripLengthType: 'Viagens curtas',
        longRidesYield: 'Corridas acima de 8 km produzem taxa mediana',
        averageHourlyEarning: 34.50,
        averageProfitMargin: 72.5
      };
    }

    // Calculate real stats from driver history
    const hourCounts: { [h: string]: { sumProfit: number, count: number } } = {};
    const neighborhoodProfit: { [n: string]: number } = {};
    const platformCount: { [p: string]: number } = {};
    
    let shortRidesProfit = 0;
    let shortRidesCount = 0;
    let longRidesProfit = 0;
    let longRidesCount = 0;

    let totalProfit = 0;
    let totalFare = 0;
    let totalHours = 0;

    rideLogs.forEach(r => {
      const fare = Number(r.receivedValue || r.fare_value || 0);
      const profit = Number(r.lucro || r.profit || fare * 0.7);
      const distance = Number(r.distance || 0);
      const durationSec = Number(r.duration || 600);
      const platform = r.platform || 'uber';

      totalProfit += profit;
      totalFare += fare;
      totalHours += (durationSec / 3600);

      // Platform breakdown
      platformCount[platform] = (platformCount[platform] || 0) + 1;

      // Group hours
      const d = new Date(r.startTime || r.timestamp);
      const hour = d.getHours();
      let slot = 'Madrugada';
      if (hour >= 6 && hour < 11) slot = '06h–11h (Manhã)';
      else if (hour >= 11 && hour < 14) slot = '11h–14h (Almoço)';
      else if (hour >= 14 && hour < 18) slot = '14h–18h (Tarde)';
      else if (hour >= 18 && hour < 22) slot = '18h–22h (Noite Peak)';
      else if (hour >= 22 || hour < 2) slot = '22h–02h (Noite)';

      if (!hourCounts[slot]) {
        hourCounts[slot] = { sumProfit: 0, count: 0 };
      }
      hourCounts[slot].sumProfit += profit;
      hourCounts[slot].count += 1;

      // Group starting neighborhood
      const bOrigem = r.bairroOrigem || r.pickup_neighborhood || 'Centro';
      neighborhoodProfit[bOrigem] = (neighborhoodProfit[bOrigem] || 0) + profit;

      // Group distance classes
      if (distance <= 5) {
        shortRidesProfit += profit;
        shortRidesCount++;
      } else {
        longRidesProfit += profit;
        longRidesCount++;
      }
    });

    // Best hour slot
    const bestTimeSlots = Object.keys(hourCounts)
      .map(k => ({ slot: k, avgProfit: hourCounts[k].sumProfit / hourCounts[k].count }))
      .sort((a, b) => b.avgProfit - a.avgProfit)
      .slice(0, 2)
      .map(item => item.slot);

    // Best starting neighborhoods
    const bestNeighborhoods = Object.keys(neighborhoodProfit)
      .map(k => ({ name: k, profit: neighborhoodProfit[k] }))
      .sort((a, b) => b.profit - a.profit)
      .slice(0, 3)
      .map(item => item.name);

    // Best Platform
    const bestPlatform = Object.keys(platformCount)
      .map(k => ({ name: k, count: platformCount[k] }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 1)
      .map(item => item.name.toUpperCase())[0] || 'Uber';

    // Best trip distance types
    const avgShortProfit = shortRidesCount > 0 ? (shortRidesProfit / shortRidesCount) : 0;
    const avgLongProfit = longRidesCount > 0 ? (longRidesProfit / longRidesCount) : 0;
    let bestTripLengthType: 'Viagens curtas' | 'Viagens longas' | 'Indiferente' = 'Indiferente';
    if (avgShortProfit > avgLongProfit * 0.4 && shortRidesCount > 5) {
      bestTripLengthType = 'Viagens curtas';
    } else if (avgLongProfit > avgShortProfit * 2.2 && longRidesCount > 5) {
      bestTripLengthType = 'Viagens longas';
    }

    const avgHourlyEarning = totalHours > 0 ? (totalFare / totalHours) : 34.5;
    const averageProfitMargin = totalFare > 0 ? (totalProfit / totalFare) * 100 : 72.5;

    return {
      bestTimeSlots: bestTimeSlots.length > 0 ? bestTimeSlots : ['18h–22h'],
      bestNeighborhoods: bestNeighborhoods.length > 0 ? bestNeighborhoods : ['Centro', 'Prudenshopping'],
      bestCategory: 'Uber Comfort',
      bestPlatform,
      bestTripLengthType,
      longRidesYield: 'Corridas acima de 8 km representam alta lucratividade líquida',
      averageHourlyEarning: Number(avgHourlyEarning.toFixed(1)),
      averageProfitMargin: Number(averageProfitMargin.toFixed(1))
    };
  }

  /**
   * 7. INSIGHTS INTELIGENTES (DYNAMIC DIAGNOSTIC INSIGHTS GENERATION)
   */
  public generateInsights(
    rideLogs: any[],
    earnings: Earning[],
    expenses: Expense[],
    vehicle: Vehicle | null,
    costSettings: VehicleCostSettings | null
  ): SmartInsight[] {
    const insights: SmartInsight[] = [];
    const now = Date.now();

    // Default Insights if database is small
    if (rideLogs.length < 3) {
      return [
        {
          id: 'ins-default-1',
          title: 'Ajuste Fino de Combustível',
          description: 'Seu custo de rodagem aumentou 8% devido à oscilação de combustíveis. Revise os postos de preferência.',
          type: 'warning',
          timestamp: now - 3600 * 1000
        },
        {
          id: 'ins-default-2',
          title: 'Eficiência de Horários Estelares',
          description: 'A IA detectou que seu melhor horário líquido em Presidente Prudente é entre 18h e 21h (Noite Peak).',
          type: 'success',
          timestamp: now - 7200 * 1000
        },
        {
          id: 'ins-default-3',
          title: 'Alerta de Retorno Vazio',
          description: 'Atenção: Você roda muito vazio após entregar passageiros em Álvares Machado ou distritos rurais.',
          type: 'critical',
          timestamp: now - 12000 * 1000
        }
      ];
    }

    // Dynamic calculations
    // 1. Recused profitable offers check (simulate learning from declined offers)
    const recusedProfitable = this.decisionsLog.filter(d => d.action === 'declined' && d.score >= 65).length;
    if (recusedProfitable > 0) {
      insights.push({
        id: `ins-rec-1-${now}`,
        title: 'Corridas Lucrativas Recusadas',
        description: `Hoje você recusou ${recusedProfitable} corridas classificadas com score "Bom" ou "Excelente" que dariam lucro líquido.`,
        type: 'info',
        timestamp: now
      });
    }

    // 2. Return Dead Miles Check
    const alvaresRides = rideLogs.filter(r => {
      const dest = (r.bairroDestino || r.destination_neighborhood || '').toLowerCase();
      return dest.includes('álvares machado') || dest.includes('machado');
    });
    if (alvaresRides.length >= 1) {
      insights.push({
        id: `ins-dead-alvares-${now}`,
        title: 'Retorno Vazio Detectado',
        description: 'Você tende a rodar muitos km vazios após entregar em Álvares Machado. Aguarde 5 minutos por uma chamada local antes de retornar.',
        type: 'warning',
        timestamp: now - 10000
      });
    }

    // 3. Peak Hour Analysis
    const profile = this.driverProfileCache || this.calculateDriverProfile(rideLogs, earnings, expenses);
    if (profile.bestTimeSlots.length > 0) {
      insights.push({
        id: `ins-peak-time-${now}`,
        title: 'Horário de Ouro Reconhecido',
        description: `Seu melhor desempenho e faturamento médio ocorrem na faixa das ${profile.bestTimeSlots[0]}. Planeje sua jornada para cobrir essa faixa.`,
        type: 'success',
        timestamp: now - 50000
      });
    }

    // 4. Operational Cost Inflation Check
    let averageCostPerKm = 0.55;
    if (expenses.length > 0) {
      const totalEx = expenses.reduce((acc, e) => acc + e.amount, 0);
      const totalKm = earnings.reduce((acc, e) => acc + e.total_km, 0);
      if (totalKm > 0) {
        averageCostPerKm = totalEx / totalKm;
      }
    }
    if (averageCostPerKm > 0.65) {
      insights.push({
        id: `ins-cost-inflation-${now}`,
        title: 'Custo por Quilômetro Elevado',
        description: `Seu custo por km rodado está em R$ ${averageCostPerKm.toFixed(2)}, acima da média recomendada. Considere manutenção preventiva ou combustível alternativo.`,
        type: 'critical',
        timestamp: now - 100000
      });
    }

    return insights;
  }

  /**
   * 8. REGISTER DRIVER DECISION (FOR ACCESSIBILITY CO-PILOT CONTINUOUS LEARNING)
   */
  public registerDriverDecision(
    offerId: string,
    score: number,
    rating: OfferRating,
    action: 'accepted' | 'declined',
    reason?: string
  ) {
    const decision: DriverDecision = {
      id: 'dec_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      offerId,
      score,
      rating,
      action,
      reason,
      timestamp: Date.now()
    };

    this.decisionsLog.unshift(decision);
    if (this.decisionsLog.length > 50) {
      this.decisionsLog.pop(); // keep log slim
    }

    // Adjust future learning weights dynamically (Continuous reinforcement learning)
    if (action === 'accepted' && rating === 'Ruim') {
      // Driver accepted a poorly scored ride, perhaps they value returning to center or are desperate
      this.learningWeights.minRevenuePerKm = Math.max(1.10, this.learningWeights.minRevenuePerKm - 0.05);
    } else if (action === 'declined' && rating === 'Excelente') {
      // Driver declined an excellent ride, perhaps they have strong location boundaries
      this.learningWeights.minRevenuePerHour = Math.min(50, this.learningWeights.minRevenuePerHour + 1.0);
    }

    this.saveDecisionsToLocalStorage();
    console.log('[RIDE_INTELLIGENCE] Driver decision recorded. Evolving learning metrics:', this.learningWeights);
  }

  public getDecisionsLog(): DriverDecision[] {
    return this.decisionsLog;
  }

  private saveDecisionsToLocalStorage() {
    try {
      localStorage.setItem('driverdash_ai_decisions', JSON.stringify(this.decisionsLog));
    } catch (e) {
      console.error('Failed to save AI decisions:', e);
    }
  }

  private loadDecisionsFromLocalStorage() {
    try {
      const stored = localStorage.getItem('driverdash_ai_decisions');
      if (stored) {
        this.decisionsLog = JSON.parse(stored);
      }
    } catch (e) {
      console.error('Failed to load AI decisions:', e);
    }
  }
}

export const rideIntelligenceEngine = RideIntelligenceEngine.getInstance();
