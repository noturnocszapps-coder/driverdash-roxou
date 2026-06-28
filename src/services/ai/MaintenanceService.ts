import { Vehicle } from '../../types';
import { MaintenanceItem } from './base.types';
import { safeNumber, normalizePositiveNumber } from '../../utils/number';
import { Logger } from '../logger';

const logger = new Logger('MaintenanceService');

export class MaintenanceService {
  /**
   * Módulo 8 — IA de Manutenção
   */
  public static getMaintenanceOutlook(
    vehicle: Vehicle | null,
    totalKmTracked: number
  ): MaintenanceItem[] {
    logger.debug('Calculating vehicle maintenance outlook');

    if (totalKmTracked < 0) {
      logger.warn('Received negative totalKmTracked. Normalizing to positive value.', { totalKmTracked });
    }

    const isElectric = !!(vehicle?.fuel_type?.toLowerCase().includes('elétr') || vehicle?.fuel_type?.toLowerCase().includes('elet'));
    
    // Simulate typical distances based on tracked Km or fallback
    const currentOdometer = normalizePositiveNumber(totalKmTracked, 45000);
    if (totalKmTracked === undefined || totalKmTracked === null) {
      logger.info('totalKmTracked is missing. Using fallback odometer of 45000 km.');
    }

    if (isElectric) {
      return [
        {
          id: 'm-el-1',
          name: 'Pastilhas de Freio (Regenerativo)',
          currentKm: currentOdometer % 80000,
          intervalKm: 80000,
          remainingKm: Math.max(100, 80000 - (currentOdometer % 80000)),
          remainingDays: Math.max(5, Math.ceil((80000 - (currentOdometer % 80000)) / 150)),
          estimatedCost: 350,
          status: (80000 - (currentOdometer % 80000)) < 5000 ? 'critical' : (80000 - (currentOdometer % 80000)) < 15000 ? 'warning' : 'good',
          description: 'Desgaste reduzido graças à frenagem regenerativa do motor elétrico.'
        },
        {
          id: 'm-el-2',
          name: 'Jogo de Pneus Dianteiros',
          currentKm: currentOdometer % 40000,
          intervalKm: 40000,
          remainingKm: Math.max(100, 40000 - (currentOdometer % 40000)),
          remainingDays: Math.max(2, Math.ceil((40000 - (currentOdometer % 40000)) / 150)),
          estimatedCost: 1200,
          status: (40000 - (currentOdometer % 40000)) < 3000 ? 'critical' : (40000 - (currentOdometer % 40000)) < 8000 ? 'warning' : 'good',
          description: 'O torque instantâneo do motor elétrico acelera o desgaste dos pneus dianteiros.'
        },
        {
          id: 'm-el-3',
          name: 'Líquido de Arrefecimento da Bateria',
          currentKm: currentOdometer % 100000,
          intervalKm: 100000,
          remainingKm: Math.max(500, 100000 - (currentOdometer % 100000)),
          remainingDays: Math.ceil((100000 - (currentOdometer % 100000)) / 150),
          estimatedCost: 600,
          status: 'good',
          description: 'Crucial para manter a eficiência térmica do pack de baterias.'
        },
        {
          id: 'm-el-4',
          name: 'Filtro de Cabine (Ar Condicionado)',
          currentKm: currentOdometer % 15000,
          intervalKm: 15000,
          remainingKm: Math.max(200, 15000 - (currentOdometer % 15000)),
          remainingDays: Math.ceil((15000 - (currentOdometer % 15000)) / 150),
          estimatedCost: 90,
          status: (15000 - (currentOdometer % 15000)) < 1500 ? 'warning' : 'good',
          description: 'Mantém a qualidade do ar no habitáculo livre de alérgenos.'
        }
      ];
    } else {
      // Flex/Combustion Vehicle items
      return [
        {
          id: 'm-flex-1',
          name: 'Troca de Óleo do Motor & Filtro',
          currentKm: currentOdometer % 10000,
          intervalKm: 10000,
          remainingKm: Math.max(100, 10000 - (currentOdometer % 10000)),
          remainingDays: Math.max(1, Math.ceil((10000 - (currentOdometer % 10000)) / 150)),
          estimatedCost: 280,
          status: (10000 - (currentOdometer % 10000)) < 1000 ? 'critical' : (10000 - (currentOdometer % 10000)) < 2500 ? 'warning' : 'good',
          description: 'Lubrificação vital do motor. Mantenha em dia para evitar borra e perda de potência.'
        },
        {
          id: 'm-flex-2',
          name: 'Jogo de Velas de Ignição',
          currentKm: currentOdometer % 40000,
          intervalKm: 40000,
          remainingKm: Math.max(200, 40000 - (currentOdometer % 40000)),
          remainingDays: Math.ceil((40000 - (currentOdometer % 40000)) / 150),
          estimatedCost: 320,
          status: (40000 - (currentOdometer % 40000)) < 4000 ? 'warning' : 'good',
          description: 'Velas gastas aumentam o consumo de combustível em até 15%.'
        },
        {
          id: 'm-flex-3',
          name: 'Pastilhas de Freio Dianteiras',
          currentKm: currentOdometer % 30000,
          intervalKm: 30000,
          remainingKm: Math.max(100, 30000 - (currentOdometer % 30000)),
          remainingDays: Math.max(1, Math.ceil((30000 - (currentOdometer % 30000)) / 150)),
          estimatedCost: 240,
          status: (30000 - (currentOdometer % 30000)) < 2000 ? 'critical' : (30000 - (currentOdometer % 30000)) < 6000 ? 'warning' : 'good',
          description: 'Segurança em primeiro lugar. Substitua antes de danificar o disco de freio.'
        },
        {
          id: 'm-flex-4',
          name: 'Correia Dentada (Sincronismo)',
          currentKm: currentOdometer % 60000,
          intervalKm: 60000,
          remainingKm: Math.max(500, 60000 - (currentOdometer % 60000)),
          remainingDays: Math.ceil((60000 - (currentOdometer % 60000)) / 150),
          estimatedCost: 650,
          status: (60000 - (currentOdometer % 60000)) < 6000 ? 'warning' : 'good',
          description: 'A quebra da correia causa sérios danos nas válvulas e cabeçote do motor.'
        },
        {
          id: 'm-flex-5',
          name: 'Substituição de Filtro de Combustível',
          currentKm: currentOdometer % 15000,
          intervalKm: 15000,
          remainingKm: Math.max(100, 15000 - (currentOdometer % 15000)),
          remainingDays: Math.ceil((15000 - (currentOdometer % 15000)) / 150),
          estimatedCost: 85,
          status: (15000 - (currentOdometer % 15000)) < 2000 ? 'warning' : 'good',
          description: 'Evita a entrada de impurezas do tanque nos bicos injetores de combustível.'
        }
      ];
    }
  }
}

// Re-export for system-wide compatibility with old imports
export class MaintenancePredictionService extends MaintenanceService {}
