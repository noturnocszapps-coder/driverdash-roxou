import { Vehicle, VehicleCostSettings } from '../../types';
import { calculateCostPerKmEstimate } from '../vehicle/vehicle.calculations';

export interface DecisionResult {
  calculated_revenue_per_km: number;
  calculated_revenue_per_hour: number;
  estimated_cost: number;
  estimated_profit: number;
  decision: 'excellent' | 'good' | 'attention' | 'only_if_returning' | 'bad';
  decision_reason: string;
}

/**
 * Calculates the decision for a ride offer based on the driver's vehicle cost settings
 */
export function calculateRideOfferDecision(
  fareAmount: number,
  distanceKm: number,
  durationMin: number,
  destinationNeighborhood: string | null,
  vehicle: Vehicle | null,
  costSettings: VehicleCostSettings | null,
  preferredReturnNeighborhoods: string[] = ['Centro']
): DecisionResult {
  // Determine cost per KM. Fallback to 0.55 R$/km if not available or 0.
  let costPerKm = calculateCostPerKmEstimate(vehicle, costSettings);
  if (!costPerKm || costPerKm <= 0) {
    costPerKm = 0.55; // Realistic default operating cost per KM in Brazil
  }

  // Basic calculations
  const distance = Math.max(distanceKm, 0.1);
  const durationHours = Math.max(durationMin, 1) / 60;

  const revPerKm = fareAmount / distance;
  const revPerHour = fareAmount / durationHours;

  // Cost estimate (Distance cost + optional buffer)
  const estCost = distance * costPerKm;
  const estProfit = fareAmount - estCost;

  let decision: 'excellent' | 'good' | 'attention' | 'only_if_returning' | 'bad' = 'good';
  let reason = '';

  const isReturnArea = destinationNeighborhood && preferredReturnNeighborhoods.some(
    pref => destinationNeighborhood.toLowerCase().includes(pref.toLowerCase())
  );

  // 1. Bad Condition (Unprofitable or extremely low rates)
  if (estProfit <= 0 || revPerKm < costPerKm) {
    decision = 'bad';
    reason = `Prejuízo financeiro estimado. Custo operacional (${costPerKm.toFixed(2)} R$/km) supera o valor pago (${revPerKm.toFixed(2)} R$/km).`;
  } else if (revPerKm < 1.20) {
    decision = 'bad';
    reason = `Valor por KM muito baixo (${revPerKm.toFixed(2)} R$/km). Não cobre depreciação de forma sustentável.`;
  } else if (revPerHour < 18) {
    decision = 'bad';
    reason = `Ganhos por hora estimados muito baixos (R$ ${revPerHour.toFixed(2)}/h), abaixo do piso ideal.`;
  }
  // 2. Excellent Condition (High revenue/km, high revenue/hour and healthy profit)
  else if (revPerKm >= 2.50 && revPerHour >= 45.0 && estProfit >= 12.0) {
    decision = 'excellent';
    reason = `Alta rentabilidade! Ótima taxa de R$ ${revPerKm.toFixed(2)}/km e excelente rendimento por hora de R$ ${revPerHour.toFixed(2)}/h.`;
  }
  // 3. Good Condition (Profitable and above averages)
  else if (revPerKm >= 1.80 && revPerHour >= 32.0 && estProfit >= 5.0) {
    decision = 'good';
    reason = `Corrida lucrativa. Taxa de R$ ${revPerKm.toFixed(2)}/km e R$ ${revPerHour.toFixed(2)}/h dentro da meta saudável.`;
  }
  // 4. Returning Check (If it would normally be 'attention' but matches return area)
  else if (isReturnArea && revPerKm >= 1.30) {
    decision = 'only_if_returning';
    reason = `Rentabilidade mediana, mas finaliza no bairro de interesse (${destinationNeighborhood}). Ideal para retornar ou encerrar o turno.`;
  }
  // 5. Attention (Low margin or high distance with marginal gains)
  else {
    decision = 'attention';
    if (distance > 15 && revPerKm < 1.60) {
      reason = `Distância longa (${distance.toFixed(1)} km) com taxa mediana (${revPerKm.toFixed(2)} R$/km). Risco de deslocamento vazio de retorno.`;
    } else {
      reason = `Margem de lucro apertada (Lucro: R$ ${estProfit.toFixed(2)}). Avalie o trânsito e destino antes de aceitar.`;
    }
  }

  return {
    calculated_revenue_per_km: Number(revPerKm.toFixed(2)),
    calculated_revenue_per_hour: Number(revPerHour.toFixed(2)),
    estimated_cost: Number(estCost.toFixed(2)),
    estimated_profit: Number(estProfit.toFixed(2)),
    decision,
    decision_reason: reason
  };
}
