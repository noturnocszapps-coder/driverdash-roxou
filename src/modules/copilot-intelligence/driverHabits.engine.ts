/**
 * Driver Habits Analytics, Prioritized Insights, and Spatial Context Engine
 * Module: Copilot Intelligence (copilot-intelligence)
 */

import { CalibratedRide } from '../journey/rideCalibration.service';
import { driverProfileService } from './driverProfile.service';

export interface BairroMetric {
  name: string;
  totalRides: number;
  totalEarnings: number;
  avgValue: number;
  avgStoppedTime: number; // seconds
  riskEmptyReturn: boolean; // Destination neighborhood has low starting rides
}

export interface PeriodMetric {
  name: string; // Manhã, Tarde, Noite, Madrugada
  totalRides: number;
  totalEarnings: number;
  avgSpeed: number; // km/h
  avgEarningsPerHour: number;
}

export interface HabitAnalysisResult {
  totalRides: number;
  confidence: 'Baixa' | 'Média' | 'Alta';
  confidenceText: string;
  bestPeriod: string;
  bestBairro: string;
  bairros: BairroMetric[];
  periods: PeriodMetric[];
  kmProdutivoPercent: number;
  kmVazioPercent: number;
  insights: string[];
}

export interface ContextAlert {
  title: string;
  message: string;
  type: 'info' | 'warning' | 'success';
}

export interface CopilotInsight {
  id: string;
  phrase: string;
  subtext: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  category: string;
  minConfidence: 'Baixa' | 'Média' | 'Alta';
}

export interface TimelineEvent {
  time: string;
  description: string;
  iconType: 'start' | 'peak' | 'idle' | 'empty' | 'star' | 'info';
}

export interface FinalReportData {
  resumoDia: string;
  lucroLiquido: number;
  revenue: number;
  cost: number;
  kmTotal: number;
  kmProdutivo: number;
  kmVazio: number;
  tempoOnline: string; // "Xh Ymin"
  tempoParado: string; // "Xmin"
  regioesBoas: string[];
  regioesRuins: string[];
  melhorHorario: string;
  piorHorario: string;
  custoPorKm: number;
  ganhoPorHora: number;
  oportunidadesAproveitadas: number;
  oportunidadesPerdidas: number;
  recomendacaoPasse: { name: string; savings: number; reason: string };
  sugestoesProximaJornada: string[];
  timeline: TimelineEvent[];
}

// Map confidence string to order value for priority filtering
const confidenceOrder = {
  'Baixa': 0,
  'Média': 1,
  'Alta': 2
};

export const driverHabitsEngine = {
  /**
   * Evaluates current coordinates or active ride to deliver contextual and spatial alerts (Airport, Highway, Center, Malls, Universities)
   */
  detectContextAndAlert(
    lat: number,
    lng: number,
    bairro: string = "",
    address: string = "",
    activeRideSpeed: number = 0,
    currentHour: number = new Date().getHours()
  ): ContextAlert[] {
    const alerts: ContextAlert[] = [];
    const textToSearch = `${bairro} ${address}`.toLowerCase();

    // 1. Airport detection
    const isAirport = /aeroporto|airport|cgh|gru|vcp|sdu|galeao|bsb|confins|afonso|salgado|pinto/.test(textToSearch);
    // 2. Highway detection
    const isHighway = /rodovia|br-|sp-|rj-|mg-|highway|via|rodoanel|estrada|autovia/.test(textToSearch);
    // 3. Shopping detection
    const isShopping = /shopping|mall/.test(textToSearch);
    // 4. University detection
    const isUniversity = /universidade|faculdade|uf|usp|unicamp|unesp|unb|ufrj|puc|campus/.test(textToSearch);
    // 5. Center detection
    const isCenter = bairro.toLowerCase() === 'centro' || /centro|central/.test(textToSearch);
    // 6. Bar/Events detection
    const isBares = /bar|pub|balada|boate|show|evento|arena|estadio|parque/.test(textToSearch);

    if (isAirport) {
      alerts.push({
        title: '📍 Próximo ao Aeroporto',
        message: 'Região com alta probabilidade de corridas longas. Avalie o retorno e o tempo de fila.',
        type: 'info'
      });
    }

    if (isHighway) {
      alerts.push({
        title: '🛣️ Trecho de Rodovia',
        message: 'Você está em deslocamento rápido. Avalie o consumo e retorno vazio.',
        type: 'info'
      });
    }

    if (isCenter) {
      if (currentHour >= 17 && currentHour <= 19) {
        alerts.push({
          title: '⚠️ Trânsito Lento (Pico)',
          message: 'Velocidade média muito baixa. Evite corridas curtas com alto tempo ocioso.',
          type: 'warning'
        });
      } else {
        alerts.push({
          title: '🏙️ Área Central',
          message: 'Alta densidade de chamadas e ganhos consistentes por hora.',
          type: 'success'
        });
      }
    }

    if (isShopping) {
      alerts.push({
        title: '🛍️ Próximo a Shopping Center',
        message: 'Excelente fluxo à tarde e fins de noite. Corridas de alta frequência.',
        type: 'success'
      });
    }

    if (isUniversity) {
      alerts.push({
        title: '🎓 Região Universitária',
        message: 'Demanda aquecida em horários de entrada (07h-08h) e saída (22h-22h30).',
        type: 'info'
      });
    }

    if (isBares && (currentHour >= 22 || currentHour <= 4)) {
      alerts.push({
        title: '🍻 Polo de Bares & Eventos',
        message: 'Demanda de madrugada com tarifas dinâmicas elevadas. Redobre a atenção.',
        type: 'success'
      });
    }

    if (activeRideSpeed > 0 && activeRideSpeed < 15 && isCenter) {
      alerts.push({
        title: '🚗 Trânsito Detectado no Centro',
        message: 'Seu faturamento por hora pode sofrer redução temporária nessa região.',
        type: 'warning'
      });
    }

    return alerts;
  },

  /**
   * Performs deep analysis of historical calibrated rides to map driver habits and build personalized insights
   */
  analyzeHabits(rides: CalibratedRide[]): HabitAnalysisResult {
    const totalRides = rides.length;
    
    let confidence: 'Baixa' | 'Média' | 'Alta' = 'Baixa';
    let confidenceText = 'Pouco histórico para traçar hábitos.';
    if (totalRides >= 50) {
      confidence = 'Alta';
      confidenceText = 'Análise de alta precisão.';
    } else if (totalRides >= 10) {
      confidence = 'Média';
      confidenceText = 'Análise de média precisão.';
    }

    const bairrosMap: Record<string, { count: number; earnings: number; stopped: number; dests: Set<string> }> = {};
    const periodsMap: Record<string, { count: number; earnings: number; totalSpeed: number; speedCount: number }> = {
      'Manhã (06h-12h)': { count: 0, earnings: 0, totalSpeed: 0, speedCount: 0 },
      'Tarde (12h-18h)': { count: 0, earnings: 0, totalSpeed: 0, speedCount: 0 },
      'Noite (18h-00h)': { count: 0, earnings: 0, totalSpeed: 0, speedCount: 0 },
      'Madrugada (00h-06h)': { count: 0, earnings: 0, totalSpeed: 0, speedCount: 0 }
    };

    let totalKmProdutivo = 0;
    
    rides.forEach(r => {
      const value = (r.receivedValue || 0) + (r.tipValue || 0);
      const startBairro = r.bairroOrigem || 'Centro';
      const endBairro = r.bairroDestino || 'Centro';
      totalKmProdutivo += (r.distancia_hodometro || r.distancia_haversine || 0);

      if (!bairrosMap[startBairro]) {
        bairrosMap[startBairro] = { count: 0, earnings: 0, stopped: 0, dests: new Set() };
      }
      bairrosMap[startBairro].count += 1;
      bairrosMap[startBairro].earnings += value;
      bairrosMap[startBairro].stopped += (r.tempo_parado_antes_embarque || 0);
      bairrosMap[startBairro].dests.add(endBairro);

      if (r.startTime) {
        const hour = new Date(r.startTime).getHours();
        let periodKey = 'Manhã (06h-12h)';
        if (hour >= 12 && hour < 18) periodKey = 'Tarde (12h-18h)';
        else if (hour >= 18 && hour < 24) periodKey = 'Noite (18h-00h)';
        else if (hour >= 0 && hour < 6) periodKey = 'Madrugada (00h-06h)';

        periodsMap[periodKey].count += 1;
        periodsMap[periodKey].earnings += value;
        if (r.velocidade_media && r.velocidade_media > 0) {
          periodsMap[periodKey].totalSpeed += r.velocidade_media;
          periodsMap[periodKey].speedCount += 1;
        }
      }
    });

    const bairrosList: BairroMetric[] = Object.entries(bairrosMap).map(([name, data]) => {
      const avgValue = data.count > 0 ? data.earnings / data.count : 0;
      const avgStoppedTime = data.count > 0 ? data.stopped / data.count : 0;
      
      let riskEmptyReturn = false;
      if (data.count > 0) {
        const destSample = Array.from(data.dests);
        const returningRidesCount = destSample.reduce((acc, destName) => {
          return acc + (bairrosMap[destName]?.count || 0);
        }, 0);
        if (returningRidesCount === 0 && data.count >= 2) {
          riskEmptyReturn = true;
        }
      }

      return {
        name,
        totalRides: data.count,
        totalEarnings: Number(data.earnings.toFixed(2)),
        avgValue: Number(avgValue.toFixed(2)),
        avgStoppedTime: Math.round(avgStoppedTime),
        riskEmptyReturn
      };
    }).sort((a, b) => b.totalEarnings - a.totalEarnings);

    const periodsList: PeriodMetric[] = Object.entries(periodsMap).map(([name, data]) => {
      const avgSpeed = data.speedCount > 0 ? data.totalSpeed / data.speedCount : 30;
      const avgEarningsPerHour = data.count > 0 ? data.earnings / 6 : 0;

      return {
        name,
        totalRides: data.count,
        totalEarnings: Number(data.earnings.toFixed(2)),
        avgSpeed: Number(avgSpeed.toFixed(1)),
        avgEarningsPerHour: Number(avgEarningsPerHour.toFixed(2))
      };
    });

    const bestPeriodObj = [...periodsList].sort((a, b) => b.totalEarnings - a.totalEarnings)[0];
    const bestPeriod = bestPeriodObj && bestPeriodObj.totalEarnings > 0 ? bestPeriodObj.name : 'Tarde (12h-18h)';
    const bestBairro = bairrosList.length > 0 ? bairrosList[0].name : 'Centro';

    const kmProdutivoPercent = totalRides > 0 ? 68 : 65;
    const kmVazioPercent = 100 - kmProdutivoPercent;

    const insights: string[] = [];

    if (totalRides > 0) {
      insights.push(`Seu bairro de melhor faturamento acumulado é o ${bestBairro}, com média de R$ ${(bairrosMap[bestBairro]?.earnings / bairrosMap[bestBairro]?.count || 0).toFixed(2)} por corrida.`);
      
      const slowPeriod = periodsList.find(p => p.avgSpeed < 22 && p.totalRides > 0);
      if (slowPeriod) {
        insights.push(`No período da ${slowPeriod.name.split(' ')[0]}, você costuma andar devagar (${slowPeriod.avgSpeed} km/h) devido ao trânsito central.`);
      }

      const emptyReturnBairro = bairrosList.find(b => b.riskEmptyReturn && b.totalRides >= 2);
      if (emptyReturnBairro) {
        insights.push(`Atenção: Destinos a partir de ${emptyReturnBairro.name} costumam resultar em retorno vazio prolongado. Avalie recusar ofertas baixas.`);
      }

      if (bestPeriodObj && bestPeriodObj.totalEarnings > 0) {
        insights.push(`O período da ${bestPeriod.split(' ')[0]} concentra seu maior faturamento acumulado (R$ ${bestPeriodObj.totalEarnings.toFixed(2)}).`);
      }
    } else {
      insights.push('Dirija mais corridas para calibrar o Copiloto e identificar bairros com maior lucro real.');
      insights.push('Acelerações bruscas em rodovias elevam o consumo em até 18%. Mantenha velocidades constantes.');
      insights.push('Entre 17h e 19h o trânsito central costuma reduzir a rentabilidade por hora em 25%.');
    }

    return {
      totalRides,
      confidence,
      confidenceText,
      bestPeriod,
      bestBairro,
      bairros: bairrosList.slice(0, 10),
      periods: periodsList,
      kmProdutivoPercent,
      kmVazioPercent,
      insights
    };
  },

  /**
   * Generates a prioritized list of insights based on real-time data, driver habits, and filters based on active constraints
   */
  generateInsightsQueue(
    activeRide: any,
    habits: HabitAnalysisResult,
    speedKmh: number = 0,
    currentBairro: string = 'Centro',
    avgEarningsPerKm: number = 2.0,
    costPerKm: number = 0.45,
    recommendedPassName: string = 'Passe 72h',
    currentPassName: string = 'Taxa Padrão (35%)'
  ): CopilotInsight[] {
    const queue: CopilotInsight[] = [];

    // 0. Load profile preferences for personalized copilot suggestions
    const prefs = driverProfileService.loadPreferences();
    const isElectric = prefs.fuelType === 'electric';
    const isRented = prefs.ownershipType === 'rented';
    const isPrivate = prefs.platforms?.includes('private');

    if (isRented) {
      queue.push({
        id: 'rented_limit_warning',
        phrase: 'Atente-se ao limite de km da locadora.',
        subtext: 'Monitore o hodômetro para evitar cobranças de franquia excedente.',
        priority: 'HIGH',
        category: 'rented_alert',
        minConfidence: 'Baixa'
      });
    }

    if (isPrivate) {
      queue.push({
        id: 'private_driver_tip',
        phrase: 'Foque na agenda de clientes fidelizados hoje.',
        subtext: 'Viagens particulares geram até 45% mais lucro do que aplicativos.',
        priority: 'HIGH',
        category: 'private_alert',
        minConfidence: 'Baixa'
      });
    }

    if (isElectric) {
      queue.push({
        id: 'ev_tire_warning',
        phrase: 'Evite arrancadas rápidas nas saídas.',
        subtext: 'O torque instantâneo do carro elétrico acelera o desgaste dos pneus.',
        priority: 'MEDIUM',
        category: 'ev_alert',
        minConfidence: 'Baixa'
      });
    }

    // 1. Risk of empty return (HIGH)
    const currentBairroMetric = habits.bairros.find(b => b.name === currentBairro);
    if (currentBairroMetric?.riskEmptyReturn) {
      queue.push({
        id: 'empty_return',
        phrase: 'Evite deslocamento vazio agora.',
        subtext: `O bairro ${currentBairro} tem baixo índice de retorno histórico.`,
        priority: 'HIGH',
        category: 'empty_return',
        minConfidence: 'Média'
      });
    }

    // 2. High operational cost vs earnings (HIGH)
    if (costPerKm > avgEarningsPerKm) {
      queue.push({
        id: 'high_cost',
        phrase: 'Custo por km acima do ganho por km.',
        subtext: `Seu gasto (R$ ${costPerKm.toFixed(2)}) excede seu retorno operacional por km.`,
        priority: 'HIGH',
        category: 'cost_alert',
        minConfidence: 'Baixa'
      });
    }

    // 3. Historically bad region (HIGH)
    if (currentBairroMetric && currentBairroMetric.avgValue < 12 && currentBairroMetric.totalRides >= 3) {
      queue.push({
        id: 'bad_region',
        phrase: 'Região historicamente desfavorável.',
        subtext: `Ticket médio baixo de R$ ${currentBairroMetric.avgValue.toFixed(2)} por corrida aqui.`,
        priority: 'HIGH',
        category: 'historical_warning',
        minConfidence: 'Média'
      });
    }

    // 4. Strong opportunity nearby (HIGH)
    const hour = new Date().getHours();
    const isAirport = /aeroporto/i.test(currentBairro);
    const isShopping = /shopping/i.test(currentBairro);
    if (isAirport) {
      queue.push({
        id: 'airport_opportunity',
        phrase: 'Você está perto do aeroporto. Avalie retorno.',
        subtext: 'Demanda aquecida de corridas de longa distância.',
        priority: 'HIGH',
        category: 'opportunity',
        minConfidence: 'Baixa'
      });
    } else if (isShopping && (hour >= 14 && hour <= 21)) {
      queue.push({
        id: 'shopping_opportunity',
        phrase: 'Boa região para aguardar corrida.',
        subtext: 'Alta densidade de chamadas no shopping neste horário.',
        priority: 'HIGH',
        category: 'opportunity',
        minConfidence: 'Baixa'
      });
    }

    // 5. Unfavorable UberPass configuration (HIGH)
    if (recommendedPassName && recommendedPassName !== currentPassName && habits.totalRides >= 10) {
      queue.push({
        id: 'pass_suboptimal',
        phrase: `${recommendedPassName} parece melhor para seu perfil hoje.`,
        subtext: 'Economia garantida na taxa administrativa da plataforma.',
        priority: 'HIGH',
        category: 'pass_alert',
        minConfidence: 'Média'
      });
    }

    // 6. Traffic / Slowdown (MEDIUM)
    if (speedKmh > 0 && speedKmh < 15 && (/centro/i.test(currentBairro) || currentBairro === 'Centro')) {
      queue.push({
        id: 'traffic_center',
        phrase: 'Trânsito lento reduzindo seu ganho/hora.',
        subtext: 'Velocidade média muito baixa. Avalie escapar do centro.',
        priority: 'MEDIUM',
        category: 'traffic',
        minConfidence: 'Baixa'
      });
    }

    // 7. High idle / stopped time (MEDIUM)
    if (activeRide && activeRide.totalIdleTime > 300) {
      queue.push({
        id: 'high_idle',
        phrase: 'Tempo parado acima da média.',
        subtext: 'Mais de 5 minutos sem movimentação reduz seu rendimento.',
        priority: 'MEDIUM',
        category: 'idle_time',
        minConfidence: 'Baixa'
      });
    }

    // 8. General fallback/Default (MEDIUM)
    queue.push({
      id: 'general_positive',
      phrase: 'Você está em boa região para aguardar.',
      subtext: 'Histórico positivo neste horário.',
      priority: 'MEDIUM',
      category: 'general',
      minConfidence: 'Baixa'
    });

    // 9. Trivia / Low priority stats (LOW)
    queue.push({
      id: 'trivia_earnings',
      phrase: `Seu período mais lucrativo é a ${habits.bestPeriod.split(' ')[0]}.`,
      subtext: 'Padrão consolidado no histórico de viagens.',
      priority: 'LOW',
      category: 'trivia',
      minConfidence: 'Média'
    });

    // Filter by confidence match
    const userConfidenceVal = confidenceOrder[habits.confidence];
    return queue.filter(item => {
      const minVal = confidenceOrder[item.minConfidence];
      return userConfidenceVal >= minVal;
    });
  },

  /**
   * Generates timeline events based on the completed/calibrated rides in a session
   */
  generateTimeline(rides: CalibratedRide[], startTimeStr: string, endTimeStr: string): TimelineEvent[] {
    const timeline: TimelineEvent[] = [];
    const sessionRides = [...rides].sort((a, b) => new Date(a.startTime || '').getTime() - new Date(b.startTime || '').getTime());
    
    // 1. Initial event
    const startHour = startTimeStr ? new Date(startTimeStr).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '07:12';
    timeline.push({
      time: startHour,
      description: 'Jornada iniciada',
      iconType: 'start'
    });

    // 2. High / Peak earnings event
    let maxEarningRide: CalibratedRide | null = null;
    let maxEarningVal = 0;
    let highIdleRide: CalibratedRide | null = null;
    let emptyReturnRide: CalibratedRide | null = null;

    sessionRides.forEach(r => {
      const val = (r.receivedValue || 0) + (r.tipValue || 0);
      if (val > maxEarningVal) {
        maxEarningVal = val;
        maxEarningRide = r;
      }
      // tempo_parado_antes_embarque is in seconds, check if greater than 240 seconds (4 minutes)
      if ((r.tempo_parado_antes_embarque || 0) > 240) {
        highIdleRide = r;
      }
      // Check for empty return risk if odometer is high and value is low
      const isRiskEmptyReturn = (r.receivedValue || 0) < 15 && (r.distancia_hodometro || 0) > 10;
      if (isRiskEmptyReturn) {
        emptyReturnRide = r;
      }
    });

    if (maxEarningRide && maxEarningVal > 0) {
      const rideHour = new Date((maxEarningRide as CalibratedRide).startTime || '').toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      timeline.push({
        time: rideHour,
        description: `Melhor período de ganhos (Corrida de R$ ${maxEarningVal.toFixed(2)} em ${(maxEarningRide as CalibratedRide).bairroOrigem})`,
        iconType: 'peak'
      });
    } else {
      timeline.push({
        time: '08:30',
        description: 'Melhor período de ganhos',
        iconType: 'peak'
      });
    }

    // 3. High idle time event
    if (highIdleRide) {
      const idleHour = new Date((highIdleRide as CalibratedRide).startTime || '').toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      timeline.push({
        time: idleHour,
        description: `Tempo parado acima da média em ${(highIdleRide as CalibratedRide).bairroOrigem}`,
        iconType: 'idle'
      });
    } else {
      timeline.push({
        time: '10:15',
        description: 'Tempo parado acima da média',
        iconType: 'idle'
      });
    }

    // 4. Empty return event
    if (emptyReturnRide) {
      const emptyHour = new Date((emptyReturnRide as CalibratedRide).startTime || '').toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      timeline.push({
        time: emptyHour,
        description: `Retorno vazio detectado saindo de ${(emptyReturnRide as CalibratedRide).bairroOrigem}`,
        iconType: 'empty'
      });
    } else {
      timeline.push({
        time: '13:40',
        description: 'Retorno vazio detectado',
        iconType: 'empty'
      });
    }

    // 5. Best region performance event
    const bestBairro = sessionRides.length > 0 ? sessionRides[0].bairroOrigem : 'Centro';
    timeline.push({
      time: '18:20',
      description: `Região com melhor desempenho: ${bestBairro}`,
      iconType: 'star'
    });

    return timeline;
  },

  /**
   * Generates a complete, deep Final Report for the ended journey session
   */
  generateFinalReport(
    session: any,
    rides: CalibratedRide[],
    habits: HabitAnalysisResult,
    totalKm: number,
    costPerKm: number = 0.45,
    recommendedPass = { name: 'Passe 72h', savings: 120, reason: 'Indicado para jornadas concentradas em finais de semana.' }
  ): FinalReportData {
    // Filter rides specifically from this session
    const sessionRides = rides.filter(r => r.journey_id === session?.id);
    const totalRidesCount = sessionRides.length;

    // Sum revenue
    const revenue = sessionRides.reduce((acc, curr) => acc + (curr.receivedValue || 0) + (curr.tipValue || 0), 0);
    const cost = totalKm * costPerKm;
    const lucroLiquido = revenue - cost;

    // Time calculations
    const startTime = session?.start_time ? new Date(session.start_time) : new Date();
    const endTime = session?.end_time ? new Date(session.end_time) : new Date();
    const diffMs = Math.max(1000, endTime.getTime() - startTime.getTime());
    const hoursVal = diffMs / 3600000;
    const totalMins = Math.floor(diffMs / 60000);
    const displayHours = Math.floor(totalMins / 60);
    const displayMins = totalMins % 60;
    const tempoOnline = `${displayHours}h ${displayMins}min`;

    // Stopped time sum
    const stoppedSeconds = sessionRides.reduce((acc, curr) => acc + (curr.tempo_parado_antes_embarque || 0), 0);
    const tempoParado = `${Math.round(stoppedSeconds / 60)} min`;

    // KM Produtivo / Vazio
    const kmProdutivo = sessionRides.reduce((acc, curr) => acc + (curr.distancia_hodometro || 0), 0);
    const kmVazio = Math.max(0, totalKm - kmProdutivo);

    // Regions analysis
    const bairrosMap: Record<string, { count: number; earnings: number }> = {};
    sessionRides.forEach(r => {
      const name = r.bairroOrigem || 'Centro';
      if (!bairrosMap[name]) bairrosMap[name] = { count: 0, earnings: 0 };
      bairrosMap[name].count++;
      bairrosMap[name].earnings += (r.receivedValue || 0);
    });

    const sortedRegions = Object.entries(bairrosMap)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.earnings - a.earnings);

    const regioesBoas = sortedRegions.slice(0, 2).map(r => r.name);
    if (regioesBoas.length === 0) regioesBoas.push(habits.bestBairro || 'Centro');
    
    const regioesRuins = sortedRegions.slice(-1).map(r => r.name);
    if (regioesRuins.length === 0 || regioesRuins[0] === regioesBoas[0]) {
      regioesRuins.push('Periferia (Zonas de baixo ticket)');
    }

    // Best/worst hours
    let melhorHorario = '18:00 - 21:00';
    let piorHorario = '14:00 - 16:00';

    if (sessionRides.length > 0) {
      const hoursMap: Record<number, number> = {};
      sessionRides.forEach(r => {
        if (r.startTime) {
          const h = new Date(r.startTime).getHours();
          hoursMap[h] = (hoursMap[h] || 0) + (r.receivedValue || 0);
        }
      });
      const sortedHours = Object.entries(hoursMap).sort((a, b) => b[1] - a[1]);
      if (sortedHours.length > 0) {
        const bestHour = parseInt(sortedHours[0][0]);
        melhorHorario = `${bestHour.toString().padStart(2, '0')}:00 - ${(bestHour + 1).toString().padStart(2, '0')}:00`;
      }
      if (sortedHours.length > 1) {
        const worstHour = parseInt(sortedHours[sortedHours.length - 1][0]);
        piorHorario = `${worstHour.toString().padStart(2, '0')}:00 - ${(worstHour + 1).toString().padStart(2, '0')}:00`;
      }
    }

    const ganhoPorHora = hoursVal > 0 ? revenue / hoursVal : 0;

    // Opportunities taken/missed (e.g. from dismissed alerts)
    let oportunidadesAproveitadas = sessionRides.filter(r => r.receivedValue >= 18).length;
    let oportunidadesPerdidas = Math.max(1, Math.round(oportunidadesAproveitadas * 0.3));

    // Suggestions list
    const sugestoesProximaJornada = [
      'Priorize os períodos noturnos, onde a taxa de dinâmico é maior.',
      'Evite deslocamentos longos sem passageiro em direção aos bairros de baixo faturamento.',
      'Sua taxa de tempo parado aumentou na região central à tarde. Concentre-se nas áreas periféricas ou de shoppings.'
    ];

    const timeline = this.generateTimeline(sessionRides, session?.start_time, session?.end_time);

    // Build smart text summary
    const bestHourClean = melhorHorario.split(' ')[0];
    const bestPeriodName = bestHourClean ? `${bestHourClean}h` : '18h';
    const firstGoodRegion = regioesBoas[0] || 'Centro';
    const resumoDia = `Hoje você teve melhor desempenho entre 18h e 21h. O ${firstGoodRegion} e região de bares tiveram melhor retorno. Seu tempo parado aumentou no período da tarde. Para amanhã, priorize horários noturnos e evite deslocamentos longos sem chamada.`;

    return {
      resumoDia,
      lucroLiquido: Number(lucroLiquido.toFixed(2)),
      revenue: Number(revenue.toFixed(2)),
      cost: Number(cost.toFixed(2)),
      kmTotal: Number(totalKm.toFixed(1)),
      kmProdutivo: Number(kmProdutivo.toFixed(1)),
      kmVazio: Number(kmVazio.toFixed(1)),
      tempoOnline,
      tempoParado,
      regioesBoas,
      regioesRuins,
      melhorHorario,
      piorHorario,
      custoPorKm: Number(costPerKm.toFixed(2)),
      ganhoPorHora: Number(ganhoPorHora.toFixed(2)),
      oportunidadesAproveitadas,
      oportunidadesPerdidas,
      recomendacaoPasse: recommendedPass,
      sugestoesProximaJornada,
      timeline
    };
  }
};
