import { Vehicle } from '../../types';
import { FlexCalculation, ElectricChargePlan } from './base.types';
import { safeNumber, safeDivide, clamp, normalizePositiveNumber } from '../../utils/number';
import { Logger } from '../logger';

const logger = new Logger('FuelRecommendationService');

export class FuelRecommendationService {
  /**
   * Módulo 7 — IA de Combustível Flex
   */
  public static calculateFlexCost(ethanolPrice: number, gasolinePrice: number): FlexCalculation {
    logger.debug('Calculating Flex Fuel financial recommendation');

    const safeEthanol = normalizePositiveNumber(ethanolPrice, 0);
    const safeGasoline = normalizePositiveNumber(gasolinePrice, 0);

    if (ethanolPrice < 0 || gasolinePrice < 0) {
      logger.warn('Received negative values for ethanol or gasoline prices. Normalized to absolute value.', { ethanolPrice, gasolinePrice });
    }

    const ratio = safeDivide(safeEthanol, safeGasoline, 0);
    // Classic 70% rule (or 73% in modern cars)
    const bestOption = ratio > 0 && ratio < 0.70 ? 'ETANOL' : 'GASOLINA';
    
    const savingPercent = bestOption === 'ETANOL' 
      ? (1 - safeDivide(ratio, 0.70, 0)) * 100 
      : (safeDivide(ratio, 0.70, 0) - 1) * 100;

    const ratioPercent = ratio * 100;
    const reason = bestOption === 'ETANOL'
      ? `O preço do Etanol está a ${ratioPercent.toFixed(1)}% do preço da Gasolina (abaixo dos 70%). Atualmente o Etanol é financeiramente mais vantajoso.`
      : `O preço do Etanol está a ${ratioPercent.toFixed(1)}% da Gasolina (acima da barreira de eficiência de 70%). Prefira abastecer com Gasolina para maior autonomia por real gasto.`;

    return {
      ethanolPrice: safeEthanol,
      gasolinePrice: safeGasoline,
      ratio,
      bestOption,
      savingPerLiterPercent: clamp(savingPercent, 0, 30),
      reason
    };
  }

  /**
   * Módulo 7 — IA de Recarga para Elétricos
   */
  public static getElectricChargingPlan(vehicle: Vehicle | null): ElectricChargePlan {
    logger.debug('Generating electric vehicle charging plan');

    let rawConsumption = vehicle?.electric_consumption_kwh_100km;
    let rawResPrice = vehicle?.home_electricity_price_kwh;
    let rawPubPrice = vehicle?.public_electricity_price_kwh;

    if (rawConsumption !== undefined && Number(rawConsumption) < 0) {
      logger.warn('Received negative electric consumption. Using absolute value.', { rawConsumption });
    }
    if (rawResPrice !== undefined && Number(rawResPrice) < 0) {
      logger.warn('Received negative home electricity price. Using absolute value.', { rawResPrice });
    }
    if (rawPubPrice !== undefined && Number(rawPubPrice) < 0) {
      logger.warn('Received negative public electricity price. Using absolute value.', { rawPubPrice });
    }

    const consumptionKwh = normalizePositiveNumber(rawConsumption, 16); // kWh per 100km
    const resPrice = normalizePositiveNumber(rawResPrice, 0.75);
    const pubPrice = normalizePositiveNumber(rawPubPrice, 1.95);

    const costRes = consumptionKwh * resPrice;
    const costPubSlow = consumptionKwh * (pubPrice * 0.8); // 20% discount for slow/off-peak public
    const costPubFast = consumptionKwh * pubPrice;

    return {
      bestTimeSlot: '00:00 às 05:00 (Tarifa Branca Residencial reduzida)',
      comparison: {
        residential: {
          costPer100km: costRes,
          chargeTimeHours: 8,
          description: 'Recarga lenta ideal para fazer em casa durante a noite.'
        },
        publicSlow: {
          costPer100km: costPubSlow,
          chargeTimeHours: 4,
          description: 'Recarga AC pública de conveniência. Boa relação custo-benefício.'
        },
        publicFast: {
          costPer100km: costPubFast,
          chargeTimeHours: 0.7,
          description: 'Recarga ultra-rápida DC de rodovia ou hub. Use apenas para emergências devido à degradação da bateria.'
        }
      },
      recommendation: `Carregue majoritariamente em casa (Residencial) das 00:00 às 05:00. Isso reduz o custo a cada 100 km rodados para apenas R$ ${costRes.toFixed(2)}, economizando mais de 60% em relação a carregadores rápidos públicos.`
    };
  }
}
