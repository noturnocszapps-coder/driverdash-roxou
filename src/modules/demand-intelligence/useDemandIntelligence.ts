import { useState, useEffect } from 'react';
import { RegionDemandData, DemandRecommendation, UpcomingEvent } from './demand.types';
import { demandIntelligenceService } from './demand.service';
import { resolveKnownNeighborhood } from '../ride-offers/locationResolver.service';

export interface UseDemandIntelligenceResult {
  regions: RegionDemandData[];
  recommendation: DemandRecommendation;
  upcomingEvents: UpcomingEvent[];
  currentLocationName: string | null;
  currentHour: number;
  isPeakTime: boolean;
  gpsStatus: 'loading' | 'success' | 'denied' | 'unsupported';
  isNearGoodArea: boolean;
  distanceToBestText: string | null;
}

export function useDemandIntelligence(): UseDemandIntelligenceResult {
  const [regions, setRegions] = useState<RegionDemandData[]>([]);
  const [recommendation, setRecommendation] = useState<DemandRecommendation>({
    bestRegion: 'Centro',
    score: 80,
    reason: '',
    practicalTip: ''
  });
  const [upcomingEvents, setUpcomingEvents] = useState<UpcomingEvent[]>([]);
  const [currentLocationName, setCurrentLocationName] = useState<string | null>(null);
  const [gpsStatus, setGpsStatus] = useState<'loading' | 'success' | 'denied' | 'unsupported'>('loading');

  // Use the system's actual local hour or standard 18h if in simulation peak
  const now = new Date();
  const currentHour = now.getHours();
  const isPeakTime = currentHour >= 17 && currentHour <= 20;

  useEffect(() => {
    // 1. Calculate Demand and Recommendations
    const calculatedRegions = demandIntelligenceService.getRegionsDemand(currentHour);
    const calculatedRec = demandIntelligenceService.getBestRecommendation(currentHour);
    const events = demandIntelligenceService.getUpcomingEvents();

    setRegions(calculatedRegions);
    setRecommendation(calculatedRec);
    setUpcomingEvents(events);

    // 2. Resolve Geolocation
    if (!navigator.geolocation) {
      setGpsStatus('unsupported');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGpsStatus('success');
        // Because reversing coordinates requires heavy external APIs, we can simulate Prudente geofencing:
        // Lat/lon bounding boxes for President Prudente is roughly -22.12, -51.38.
        // Let's approximate the neighborhood names depending on position or fallback nicely.
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;

        // Simple mock resolver to return high-fidelity local neighborhood for President Prudente
        let detectedNeighborhood = 'Centro';
        if (lat > -22.12 && lng < -51.38) {
          detectedNeighborhood = 'Parque do Povo';
        } else if (lat < -22.13 && lng > -51.39) {
          detectedNeighborhood = 'Jardim Bongiovani';
        } else if (lat < -22.15) {
          detectedNeighborhood = 'Ana Jacinta';
        } else {
          detectedNeighborhood = 'Centro';
        }

        const resolved = resolveKnownNeighborhood(detectedNeighborhood);
        setCurrentLocationName(resolved.name);
      },
      (err) => {
        console.warn('GPS access denied or failed, defaulting to simulation:', err);
        setGpsStatus(err.code === 1 ? 'denied' : 'unsupported');
        // Let's default to Centro for testing
        setCurrentLocationName('Centro');
      },
      { timeout: 8000 }
    );
  }, [currentHour]);

  // Is user currently close to a highly profitable region (score >= 80)?
  const userRegionData = regions.find(r => r.name.toLowerCase() === (currentLocationName || '').toLowerCase());
  const isNearGoodArea = userRegionData ? userRegionData.score >= 80 : false;

  // Practical distance/advice comparison
  let distanceToBestText = null;
  if (currentLocationName && regions.length > 0) {
    const bestReg = regions[0];
    if (bestReg.name.toLowerCase() !== currentLocationName.toLowerCase()) {
      distanceToBestText = `Você está no bairro ${currentLocationName}. A melhor região no momento é o ${bestReg.name} (Nota ${bestReg.score}/100), ideal para aumentar faturamento agora.`;
    } else {
      distanceToBestText = `Excelente posicionamento! Você já está no ${currentLocationName}, que é atualmente uma das áreas mais quentes de Presidente Prudente (Nota ${bestReg.score}/100).`;
    }
  }

  return {
    regions,
    recommendation,
    upcomingEvents,
    currentLocationName,
    currentHour,
    isPeakTime,
    gpsStatus,
    isNearGoodArea,
    distanceToBestText
  };
}
