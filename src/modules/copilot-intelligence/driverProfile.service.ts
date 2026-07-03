/**
 * Driver Profile Preferences & Intelligence Service
 * Module: Copilot Intelligence (copilot-intelligence)
 */

import { STORAGE_PREFIX } from '../shared/constants';
import { Vehicle, VehicleCostSettings } from '../vehicle/vehicle.types';

export interface DriverProfilePreferences {
  ownershipType: 'own' | 'rented';
  fuelType: 'gasolina' | 'etanol' | 'flex' | 'diesel' | 'hybrid' | 'electric';
  platforms: string[]; // ['uber', '99', 'indriver', 'private', 'multiple']
  daysPerWeek: number;
  hoursPerDay: number;
  objective: 'max_profit' | 'max_revenue' | 'min_wear' | 'min_hours' | 'other';
  odometerCurrent?: number; // Optional starting odometer value
}

export type QualitativeWear = 'Baixo desgaste' | 'Desgaste moderado' | 'Desgaste elevado' | 'Provável necessidade de inspeção';

export interface MaintenanceStatusResult {
  oil: {
    remainingKm: number;
    message: string;
    alertType: 'info' | 'warning' | 'critical';
  };
  brakes: {
    wearLevel: QualitativeWear;
    wearPercent: number; // 0 to 100
    message: string;
    alertType: 'info' | 'warning' | 'critical';
  };
  tires: {
    wearPercent: number; // 0 to 100
    reminders: string[]; // ['Rodízio', 'Alinhamento', 'Balanceamento', 'Inspeção']
    message: string;
    alertType: 'info' | 'warning' | 'critical';
  };
}

export interface LearnedDriverHabits {
  periodoTrabalho: string; // 'Noturno', 'Diurno', 'Finais de Semana', 'Misto'
  tipoVia: string; // 'Rodovia' | 'Urbana' | 'Mista'
  aeroportos: boolean;
  baresENightlife: boolean;
  rodaMuitoVazio: boolean;
  comportamentoDirecao: 'Econômico' | 'Moderado' | 'Agressivo';
  tipoCorridas: 'Curtas' | 'Longas' | 'Mistas';
}

const PREFS_KEY = `${STORAGE_PREFIX}profile_preferences`;

export const driverProfileService = {
  /**
   * Loads driver preferences from local storage
   */
  loadPreferences(): DriverProfilePreferences {
    try {
      const saved = localStorage.getItem(PREFS_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.objective) {
          return parsed;
        }
      }
    } catch (e) {
      console.error('Failed to load profile preferences:', e);
    }

    // Try fallback from onboarding v2 progress
    try {
      const onboardingSaved = localStorage.getItem(`${STORAGE_PREFIX}onboarding_v2_progress`);
      if (onboardingSaved) {
        const parsed = JSON.parse(onboardingSaved);
        if (parsed && parsed.objective) {
          const fallbackPrefs: DriverProfilePreferences = {
            ownershipType: parsed.ownershipType || 'own',
            fuelType: parsed.fuelType || 'flex',
            platforms: parsed.platforms || ['uber', '99'],
            daysPerWeek: parsed.daysPerWeek || 5,
            hoursPerDay: parsed.hoursPerDay || 8,
            objective: parsed.objective || 'max_profit',
            odometerCurrent: 0
          };
          // Save it back to cache
          localStorage.setItem(PREFS_KEY, JSON.stringify(fallbackPrefs));
          return fallbackPrefs;
        }
      }
    } catch (e) {
      console.warn('Failed to recover preferences from onboarding progress fallback:', e);
    }

    // Return standard defaults if none configured yet
    return {
      ownershipType: 'own',
      fuelType: 'flex',
      platforms: ['uber', '99'],
      daysPerWeek: 5,
      hoursPerDay: 8,
      objective: 'max_profit',
      odometerCurrent: 0
    };
  },

  /**
   * Saves driver preferences to local storage
   */
  savePreferences(prefs: DriverProfilePreferences): void {
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
      // Dispatch storage event to trigger sync in active tabs
      window.dispatchEvent(new Event('storage'));
    } catch (e) {
      console.error('Failed to save profile preferences:', e);
    }
  },

  /**
   * Check if preferences have been configured/onboarded
   */
  hasPreferences(): boolean {
    return localStorage.getItem(PREFS_KEY) !== null;
  },

  /**
   * Calculates smart maintenance status based on KM and telemetry variables
   */
  calculateSmartMaintenance(
    rideLogs: any[],
    vehicle: Vehicle | null,
    vehicleCostSettings: VehicleCostSettings | null,
    totalDistanceKm: number
  ): MaintenanceStatusResult {
    // 1. OIL STATUS (Target: 10,000 km)
    const oilInterval = vehicleCostSettings?.oil_change_interval_km || 10000;
    const currentOdometer = totalDistanceKm || 0;
    
    // Calculate remaining based on the interval
    const oilRemaining = Math.max(0, oilInterval - (currentOdometer % oilInterval));
    let oilMessage = '';
    let oilAlert: 'info' | 'warning' | 'critical' = 'info';

    const isRented = vehicle?.ownership_type === 'rented';

    if (oilRemaining <= 0 || (currentOdometer % oilInterval === 0 && currentOdometer > 0)) {
      oilMessage = isRented 
        ? 'Troca de óleo vencida! Agende com a locadora IMEDIATAMENTE.'
        : 'Troca de óleo vencida! Realize a manutenção IMEDIATAMENTE.';
      oilAlert = 'critical';
    } else if (oilRemaining <= 500) { // When reaching 10,000 (remaining <= 500 equivalent)
      oilMessage = isRented 
        ? 'Recomendamos entrar em contato com a locadora.' 
        : 'Troca de óleo extremamente próxima. Agende sua manutenção hoje.';
      oilAlert = 'critical';
    } else if (oilRemaining <= 2000) { // When reaching 8,000 km (remaining <= 2,000)
      oilMessage = `Faltam aproximadamente ${Math.round(oilRemaining)} km para a próxima troca de óleo. Agende com antecedência.`;
      oilAlert = 'warning';
    } else {
      oilMessage = `Óleo em bom estado. Faltam ${Math.round(oilRemaining)} km para a próxima troca.`;
      oilAlert = 'info';
    }

    // 2. BRAKE PADS WEAR (Pastilhas)
    // Factors: KM, speed, count of sudden brakings, urban use, highway use, idle time, heavy traffic.
    // Let's derive these factors from the ride logs.
    let totalRides = rideLogs.length || 1;
    let avgSpeedSum = 0;
    let suddenDecelsCount = 0;
    let cityRides = 0;
    let highwayRides = 0;
    let stoppedTimeSeconds = 0;

    rideLogs.forEach(r => {
      avgSpeedSum += (r.velocidade_media_kmh || 40);
      stoppedTimeSeconds += (r.tempo_parado_antes_embarque || 0);
      
      // Sudden decel: if there's aggressive driving indicator
      if (r.aggressive_driving || r.speed_limit_violations > 0 || (r.velocidade_media_kmh || 40) < 25) {
        suddenDecelsCount += 1.5;
      }
      
      if ((r.velocidade_media_kmh || 40) < 35) {
        cityRides++;
      } else {
        highwayRides++;
      }
    });

    const averageSpeed = avgSpeedSum / totalRides;
    const isUrbanHeavy = cityRides / totalRides > 0.6;
    const isHeavyTraffic = stoppedTimeSeconds / totalRides > 120; // Avg idle over 2 mins per ride

    // Base wear model: 1% wear per 300 km normally
    let wearRateFactor = 1.0;
    if (averageSpeed < 30) wearRateFactor += 0.2; // City driving has more braking
    if (isUrbanHeavy) wearRateFactor += 0.15;
    if (isHeavyTraffic) wearRateFactor += 0.15;
    if (suddenDecelsCount > totalRides * 0.3) wearRateFactor += 0.3; // Aggressive braking
    if (highwayRides > cityRides) wearRateFactor -= 0.2; // Highway uses brakes less

    // Wear percent (recycles every 30000 km interval for standard brake life)
    const brakeInterval = vehicleCostSettings?.brake_interval_km || 30000;
    const actualCycleDistance = currentOdometer % brakeInterval;
    const computedWearPercent = Math.min(100, Math.round((actualCycleDistance / brakeInterval) * 100 * wearRateFactor));

    let brakesLevel: QualitativeWear = 'Baixo desgaste';
    let brakesMsg = 'Pastilhas de freio em perfeitas condições.';
    let brakesAlert: 'info' | 'warning' | 'critical' = 'info';

    if (computedWearPercent >= 85) {
      brakesLevel = 'Provável necessidade de inspeção';
      brakesMsg = 'Pastilhas com desgaste crítico. Verifique o sistema de freios imediatamente por segurança.';
      brakesAlert = 'critical';
    } else if (computedWearPercent >= 60) {
      brakesLevel = 'Desgaste elevado';
      brakesMsg = 'Nível de pastilhas reduzido. Programe uma revisão das pastilhas dianteiras em breve.';
      brakesAlert = 'warning';
    } else if (computedWearPercent >= 30) {
      brakesLevel = 'Desgaste moderado';
      brakesMsg = 'Desgaste normal para uso urbano acumulado.';
      brakesAlert = 'info';
    } else {
      brakesLevel = 'Baixo desgaste';
      brakesMsg = 'Freios em ótimo estado de conservação.';
      brakesAlert = 'info';
    }

    // 3. TIRES WEAR (Pneus)
    // Consider: KM, speed, curves, city/highway type of use
    const tireInterval = vehicleCostSettings?.tire_lifespan_km || 40000;
    const tireCycleDistance = currentOdometer % tireInterval;
    
    let tireWearRate = 1.0;
    if (averageSpeed > 60) tireWearRate += 0.1; // High speed tire wear
    if (highwayRides > cityRides) {
      tireWearRate -= 0.1; // Less tire stress than stop & go city corners
    } else {
      tireWearRate += 0.15; // City turns, curbs and pothole wear
    }

    const tireWearPercent = Math.min(100, Math.round((tireCycleDistance / tireInterval) * 100 * tireWearRate));
    let tireAlert: 'info' | 'warning' | 'critical' = 'info';
    let tireMsg = 'Pneus em boas condições.';
    let tireReminders: string[] = ['Inspeção'];

    if (tireWearPercent >= 80) {
      tireAlert = 'critical';
      tireMsg = 'Pneus extremamente desgastados. Provável necessidade de substituição imediata!';
      tireReminders = ['Inspeção', 'Troca de pneus'];
    } else if (tireWearPercent >= 55) {
      tireAlert = 'warning';
      tireMsg = 'Pneus com desgaste moderado a alto. Alinhamento recomendado.';
      tireReminders = ['Alinhamento', 'Balanceamento', 'Inspeção'];
    } else if (tireWearPercent >= 25) {
      tireAlert = 'info';
      tireMsg = 'Pneus em meia-vida operacional. Ideal realizar o rodízio.';
      tireReminders = ['Rodízio', 'Alinhamento', 'Balanceamento'];
    } else {
      tireAlert = 'info';
      tireMsg = 'Pneus praticamente novos ou recém trocados.';
      tireReminders = ['Inspeção'];
    }

    return {
      oil: {
        remainingKm: oilRemaining,
        message: oilMessage,
        alertType: oilAlert
      },
      brakes: {
        wearLevel: brakesLevel,
        wearPercent: computedWearPercent,
        message: brakesMsg,
        alertType: brakesAlert
      },
      tires: {
        wearPercent: tireWearPercent,
        reminders: tireReminders,
        message: tireMsg,
        alertType: tireAlert
      }
    };
  },

  /**
   * Learns driver habits automatically based on rideLogs
   */
  learnDriverHabits(rideLogs: any[]): LearnedDriverHabits {
    if (!rideLogs || rideLogs.length === 0) {
      return {
        periodoTrabalho: 'Diurno',
        tipoVia: 'Urbana',
        aeroportos: false,
        baresENightlife: false,
        rodaMuitoVazio: false,
        comportamentoDirecao: 'Moderado',
        tipoCorridas: 'Mistas'
      };
    }

    let totalRides = rideLogs.length;
    let nightRides = 0;
    let weekendRides = 0;
    let speedSum = 0;
    let highSpeedCount = 0;
    let airportCount = 0;
    let nightlifeCount = 0;
    let emptyKmSum = 0;
    let totalKmSum = 0;
    let shortRides = 0;
    let longRides = 0;
    let aggressiveIndicator = 0;

    rideLogs.forEach(r => {
      const speed = r.velocidade_media_kmh || 35;
      speedSum += speed;
      
      if (speed > 60) highSpeedCount++;
      
      // Period check
      const createdHour = r.start_time ? new Date(r.start_time).getHours() : 12;
      if (createdHour >= 18 || createdHour < 5) {
        nightRides++;
        if (createdHour >= 22 || createdHour < 4) {
          nightlifeCount++;
        }
      }

      // Weekend check (Friday, Sat, Sun)
      if (r.start_time) {
        const day = new Date(r.start_time).getDay();
        if (day === 0 || day === 5 || day === 6) {
          weekendRides++;
        }
      }

      // Airport check
      const bairroOrigem = (r.bairroOrigem || '').toLowerCase();
      const bairroDestino = (r.bairroDestino || '').toLowerCase();
      if (bairroOrigem.includes('aeroporto') || bairroDestino.includes('aeroporto')) {
        airportCount++;
      }

      // Empty km
      emptyKmSum += (r.empty_km || 0);
      totalKmSum += (r.distancia_hodometro || r.total_km || 1);

      // Distance
      const dist = r.distancia_hodometro || r.total_km || 0;
      if (dist < 6) shortRides++;
      if (dist > 15) longRides++;

      // Aggressive driving
      if (r.aggressive_driving || r.speed_limit_violations > 0) {
        aggressiveIndicator++;
      }
    });

    const avgSpeed = speedSum / totalRides;
    const isNightWorker = (nightRides / totalRides) > 0.5;
    const isWeekendWorker = (weekendRides / totalRides) > 0.7;
    
    let workPeriod = 'Diurno';
    if (isNightWorker) workPeriod = 'Noturno';
    else if (isWeekendWorker) workPeriod = 'Finais de Semana';
    else if (nightRides / totalRides > 0.3) workPeriod = 'Misto';

    let roadType = 'Urbana';
    if (avgSpeed > 50) roadType = 'Rodovia';
    else if (avgSpeed > 35) roadType = 'Mista';

    let drivingBehavior: 'Econômico' | 'Moderado' | 'Agressivo' = 'Moderado';
    if (aggressiveIndicator / totalRides > 0.25 || avgSpeed > 65) {
      drivingBehavior = 'Agressivo';
    } else if (aggressiveIndicator === 0 && avgSpeed < 32) {
      drivingBehavior = 'Econômico';
    }

    let rideType: 'Curtas' | 'Longas' | 'Mistas' = 'Mistas';
    if (shortRides / totalRides > 0.6) rideType = 'Curtas';
    else if (longRides / totalRides > 0.4) rideType = 'Longas';

    return {
      periodoTrabalho: workPeriod,
      tipoVia: roadType,
      aeroportos: airportCount > 0,
      baresENightlife: nightlifeCount > 0,
      rodaMuitoVazio: (emptyKmSum / (totalKmSum || 1)) > 0.35,
      comportamentoDirecao: drivingBehavior,
      tipoCorridas: rideType
    };
  }
};
