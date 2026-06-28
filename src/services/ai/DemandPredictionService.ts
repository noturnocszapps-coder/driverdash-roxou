import { WeeklyPlanDay, DemandHotspot } from './base.types';
import { Logger } from '../logger';
import { normalizePositiveNumber } from '../../utils/number';

const logger = new Logger('DemandPredictionService');

export class DemandPredictionService {
  /**
   * Módulo 5 — Planejador Semanal
   */
  public static getWeeklySchedule(costPerKm: number): WeeklyPlanDay[] {
    logger.debug('Retrieving weekly planning schedule recommendations');
    
    const safeCostPerKm = normalizePositiveNumber(costPerKm, 0.74);
    if (costPerKm < 0) {
      logger.warn('Received negative costPerKm for weekly plan. Normalizing to positive.', { costPerKm });
    }

    return [
      {
        dayName: 'Segunda-feira',
        demandProbability: 85,
        expectedProfit: 220,
        bestHours: '06:00 - 10:00 | 16:30 - 19:30',
        shouldUsePass: true,
        recommendedHours: 8
      },
      {
        dayName: 'Terça-feira',
        demandProbability: 72,
        expectedProfit: 180,
        bestHours: '07:00 - 11:00 | 17:00 - 19:30',
        shouldUsePass: false,
        recommendedHours: 7
      },
      {
        dayName: 'Quarta-feira',
        demandProbability: 78,
        expectedProfit: 200,
        bestHours: '07:00 - 11:00 | 18:00 - 22:30 (Futebol/Eventos)',
        shouldUsePass: false,
        recommendedHours: 8
      },
      {
        dayName: 'Quinta-feira',
        demandProbability: 82,
        expectedProfit: 215,
        bestHours: '07:00 - 11:00 | 16:00 - 20:00',
        shouldUsePass: true,
        recommendedHours: 8
      },
      {
        dayName: 'Sexta-feira',
        demandProbability: 98,
        expectedProfit: 350,
        bestHours: '06:00 - 10:00 | 14:00 - 01:00 (Alta Demanda Noturna)',
        shouldUsePass: true,
        recommendedHours: 10
      },
      {
        dayName: 'Sábado',
        demandProbability: 95,
        expectedProfit: 320,
        bestHours: '11:00 - 15:30 | 18:00 - 02:00',
        shouldUsePass: true,
        recommendedHours: 9
      },
      {
        dayName: 'Domingo',
        demandProbability: 68,
        expectedProfit: 160,
        bestHours: '09:00 - 17:00',
        shouldUsePass: false,
        recommendedHours: 6
      }
    ];
  }

  /**
   * Módulo 6 — Mapa de Demanda (dados simulados geolocalizados de São Paulo)
   */
  public static getDemandHotspots(): DemandHotspot[] {
    logger.debug('Retrieving geo-localized demand hotspots map markers');
    return [
      {
        id: 'hs-1',
        name: 'Aeroporto Internacional de Guarulhos (GRU)',
        latitude: -23.4356,
        longitude: -46.4731,
        weight: 10,
        type: 'airport',
        avgTicket: 85,
        description: 'Fluxo massivo de desembarques corporativos das 06:00 às 11:00 e das 18:00 às 23:00.'
      },
      {
        id: 'hs-2',
        name: 'Aeroporto de Congonhas (CGH)',
        latitude: -23.6273,
        longitude: -46.6566,
        weight: 9,
        type: 'airport',
        avgTicket: 45,
        description: 'Grande volume de voos de ponte aérea comercial. Pico forte às segundas e quintas à tarde.'
      },
      {
        id: 'hs-3',
        name: 'Vila Madalena - Polo Gastronômico & Bares',
        latitude: -23.5539,
        longitude: -46.6896,
        weight: 8,
        type: 'bar_club',
        avgTicket: 22,
        description: 'Alta concentração de bares. Movimento intenso de quinta a sábado, das 18h às 02h.'
      },
      {
        id: 'hs-4',
        name: 'Av. Paulista (Próximo ao MASP)',
        latitude: -23.5614,
        longitude: -46.6559,
        weight: 8,
        type: 'transit_hub',
        avgTicket: 18,
        description: 'Centro financeiro e cultural. Ponto estratégico para corridas curtas e médias em horários comerciais.'
      },
      {
        id: 'hs-5',
        name: 'Allianz Parque - Arena Multiuso',
        latitude: -23.5273,
        longitude: -46.6784,
        weight: 9,
        type: 'event',
        avgTicket: 35,
        description: 'Dias de jogos e shows nacionais/internacionais. Demanda extrema no encerramento.'
      },
      {
        id: 'hs-6',
        name: 'Itaim Bibi - Eixo Empresarial',
        latitude: -23.5851,
        longitude: -46.6766,
        weight: 7,
        type: 'restaurant',
        avgTicket: 28,
        description: 'Restaurantes corporativos de alto padrão e sedes de tecnologia. Pico às 12:00 e às 18:00.'
      }
    ];
  }
}
