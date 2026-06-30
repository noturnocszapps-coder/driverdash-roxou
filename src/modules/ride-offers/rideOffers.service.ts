import { supabase, isDbConnected } from '../shared/supabase.helpers';
import { RideOffer, Vehicle, VehicleCostSettings } from '../../types';
import { calculateRideOfferDecision } from './rideOfferDecision.engine';
import { resolveKnownNeighborhood } from './locationResolver.service';

const LOCAL_STORAGE_KEY = 'driverdash_ride_offers';

// In-memory / local storage cache helper
function getLocalOffers(): RideOffer[] {
  try {
    const data = localStorage.getItem(LOCAL_STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    console.error('Error reading local ride offers:', e);
    return [];
  }
}

function saveLocalOffers(offers: RideOffer[]) {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(offers));
  } catch (e) {
    console.error('Error saving local ride offers:', e);
  }
}

export const rideOffersService = {
  /**
   * Parse raw offer notification/screen text to structured fields (mock for tests/simulations)
   */
  parseOfferTextMock(text: string): Partial<RideOffer> {
    const normalized = text.toLowerCase();
    
    // 1. Detect provider
    let provider: RideOffer['provider'] = 'other';
    if (normalized.includes('uber')) {
      provider = 'uber';
    } else if (normalized.includes('99')) {
      provider = '99';
    } else if (normalized.includes('indrive')) {
      provider = 'indrive';
    }

    // 2. Extract fare amount (e.g., R$ 24,50 or 24.50)
    let fare_amount = 15.0; // Default fallback
    const fareMatch = text.match(/R\$\s*(\d+([.,]\d{2})?)/i) || text.match(/(\d+([.,]\d{2})?)\s*R\$/i);
    if (fareMatch && fareMatch[1]) {
      fare_amount = parseFloat(fareMatch[1].replace(',', '.'));
    }

    // 3. Extract estimated distance (e.g., 8,2 km or 8.2km)
    let estimated_distance_km = 4.5; // Default fallback
    const distMatch = text.match(/(\d+([.,]\d+)?)\s*km/i);
    if (distMatch && distMatch[1]) {
      estimated_distance_km = parseFloat(distMatch[1].replace(',', '.'));
    }

    // 4. Extract estimated duration (e.g., 14 min or 14min)
    let estimated_duration_min = 12; // Default fallback
    const durMatch = text.match(/(\d+)\s*min/i);
    if (durMatch && durMatch[1]) {
      estimated_duration_min = parseInt(durMatch[1], 10);
    }

    // 5. Extract pickup & destination locations
    let pickup_text = 'Jardim Bongiovani';
    let destination_text = 'Centro';

    // Patterns like: "Embarque: Jardim Bongiovani • Destino: Centro"
    const pickupMatch = text.match(/embarque:\s*([^•\n\r\t]+)/i) || text.match(/origem:\s*([^•\n\r\t]+)/i);
    const destMatch = text.match(/destino:\s*([^•\n\r\t]+)/i) || text.match(/entrega:\s*([^•\n\r\t]+)/i);

    if (pickupMatch && pickupMatch[1]) {
      pickup_text = pickupMatch[1].trim();
    }
    if (destMatch && destMatch[1]) {
      destination_text = destMatch[1].trim();
    } else {
      // Check arrow syntax like: "Jardim Paulista -> Centro"
      const arrowSplit = text.split(/->| para | a /i);
      if (arrowSplit.length >= 2) {
        pickup_text = arrowSplit[0].trim();
        destination_text = arrowSplit[1].trim();
      }
    }

    // Resolve neighborhoods and cities
    const resolvedPickup = resolveKnownNeighborhood(pickup_text);
    const resolvedDest = resolveKnownNeighborhood(destination_text);

    return {
      provider,
      raw_text: text,
      fare_amount,
      estimated_distance_km,
      estimated_duration_min,
      pickup_text: pickup_text,
      destination_text: destination_text,
      pickup_neighborhood: resolvedPickup.name,
      pickup_city: resolvedPickup.city,
      destination_neighborhood: resolvedDest.name,
      destination_city: resolvedDest.city,
      source: 'manual',
      status: 'detected',
      confidence_score: 95.0,
      detected_at: new Date().toISOString()
    };
  },

  /**
   * Creates a ride offer, run decision analysis and stores it
   */
  async createRideOffer(
    offerData: Omit<RideOffer, 'id' | 'created_at' | 'calculated_revenue_per_km' | 'calculated_revenue_per_hour' | 'estimated_cost' | 'estimated_profit' | 'decision' | 'decision_reason'> & { id?: string },
    vehicle: Vehicle | null,
    costSettings: VehicleCostSettings | null
  ): Promise<RideOffer> {
    // 1. Analyze and calculate decisions
    const analysis = calculateRideOfferDecision(
      offerData.fare_amount,
      offerData.estimated_distance_km,
      offerData.estimated_duration_min,
      offerData.destination_neighborhood || null,
      vehicle,
      costSettings
    );

    const fullOffer: RideOffer = {
      id: offerData.id || crypto.randomUUID(),
      ...offerData,
      ...analysis,
      created_at: new Date().toISOString()
    };


    // 2. Persist
    if (isDbConnected()) {
      try {
        const { data, error } = await supabase
          .from('ride_offers')
          .insert([fullOffer])
          .select()
          .single();

        if (error) {
          console.warn('[RideOffers] Supabase insert failed, saving locally:', error);
        } else {
          // Sync local storage copy too
          const local = getLocalOffers();
          local.unshift(data);
          saveLocalOffers(local.slice(0, 100)); // limit local history
          return data;
        }
      } catch (err) {
        console.error('[RideOffers] Exception writing to Supabase, saving locally:', err);
      }
    }

    // Fallback: save locally
    const local = getLocalOffers();
    local.unshift(fullOffer);
    saveLocalOffers(local.slice(0, 100));
    return fullOffer;
  },

  /**
   * Update the status of a ride offer
   */
  async updateRideOfferStatus(id: string, status: RideOffer['status']): Promise<RideOffer | null> {
    const timestamp = new Date().toISOString();
    const updatePayload: Partial<RideOffer> = { status };
    if (status === 'accepted') {
      updatePayload.accepted_at = timestamp;
    } else if (status === 'rejected') {
      updatePayload.rejected_at = timestamp;
    }

    if (isDbConnected()) {
      try {
        const { data, error } = await supabase
          .from('ride_offers')
          .update(updatePayload)
          .eq('id', id)
          .select()
          .maybeSingle();

        if (!error && data) {
          // Sync local storage copy
          const local = getLocalOffers();
          const idx = local.findIndex(o => o.id === id);
          if (idx !== -1) {
            local[idx] = { ...local[idx], ...updatePayload };
            saveLocalOffers(local);
          }
          return data;
        }
      } catch (err) {
        console.error('[RideOffers] Exception updating offer status in Supabase:', err);
      }
    }

    // Local update
    const local = getLocalOffers();
    const idx = local.findIndex(o => o.id === id);
    if (idx !== -1) {
      local[idx] = { ...local[idx], ...updatePayload };
      saveLocalOffers(local);
      return local[idx];
    }

    return null;
  },

  /**
   * Lists the recent captured ride offers
   */
  async listRecentRideOffers(userId: string, limit: number = 30): Promise<RideOffer[]> {
    if (isDbConnected()) {
      try {
        const { data, error } = await supabase
          .from('ride_offers')
          .select('*')
          .eq('user_id', userId)
          .order('detected_at', { ascending: false })
          .limit(limit);

        if (!error && data) {
          // Update local cache
          saveLocalOffers(data);
          return data;
        }
        console.warn('[RideOffers] Supabase fetch failed, falling back to local offers:', error);
      } catch (err) {
        console.error('[RideOffers] Exception fetching from Supabase:', err);
      }
    }

    // Local fallback
    return getLocalOffers().filter(o => o.user_id === userId).slice(0, limit);
  },

  /**
   * Aggregates stats for captured ride offers
   */
  async getRideOfferStats(userId: string) {
    const offers = await this.listRecentRideOffers(userId, 200);
    
    const total = offers.length;
    const accepted = offers.filter(o => o.status === 'accepted').length;
    const rejected = offers.filter(o => o.status === 'rejected').length;
    const expired = offers.filter(o => o.status === 'expired').length;
    const ignored = offers.filter(o => o.status === 'ignored').length;

    // Calculate average profit of accepted rides
    const acceptedRides = offers.filter(o => o.status === 'accepted');
    const totalProfit = acceptedRides.reduce((sum, o) => sum + (o.estimated_profit || 0), 0);
    const avgProfit = acceptedRides.length > 0 ? totalProfit / acceptedRides.length : 0;

    // Frequency counters
    const pickupCounts: Record<string, number> = {};
    const destCounts: Record<string, number> = {};
    const decisionCounts: Record<string, number> = {};

    offers.forEach(o => {
      if (o.pickup_neighborhood) {
        pickupCounts[o.pickup_neighborhood] = (pickupCounts[o.pickup_neighborhood] || 0) + 1;
      }
      if (o.destination_neighborhood) {
        destCounts[o.destination_neighborhood] = (destCounts[o.destination_neighborhood] || 0) + 1;
      }
      if (o.decision) {
        decisionCounts[o.decision] = (decisionCounts[o.decision] || 0) + 1;
      }
    });

    const getMostFrequent = (counts: Record<string, number>): string => {
      let maxCount = 0;
      let mostFreq = 'Nenhum';
      Object.entries(counts).forEach(([name, count]) => {
        if (count > maxCount) {
          maxCount = count;
          mostFreq = name;
        }
      });
      return mostFreq;
    };

    const commonPickup = getMostFrequent(pickupCounts);
    const commonDest = getMostFrequent(destCounts);
    
    // Map decision to beautiful string
    const decisionMap: Record<string, string> = {
      excellent: 'Excelente',
      good: 'Boa',
      attention: 'Atenção',
      only_if_returning: 'Apenas se Retorno',
      bad: 'Ruim',
      Nenhum: 'Nenhum'
    };
    const commonDecision = decisionMap[getMostFrequent(decisionCounts)] || 'Nenhum';

    return {
      total,
      accepted,
      rejected,
      expired,
      ignored,
      avgProfit,
      commonPickup,
      commonDest,
      commonDecision
    };
  }
};
