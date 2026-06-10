/**
 * Journey and Telemetry Service Routines
 * Module: Journey (journey)
 * When to edit: When modifying driver session or coordinate point structures or DB schemas.
 */

import { supabase } from '../shared/supabase.helpers';
import { DriverSession, RoutePoint } from './journey.types';

export const journeyService = {
  /**
   * Fetches historical driver sessions.
   */
  async fetchDriverSessions(userId: string): Promise<DriverSession[]> {
    const { data, error } = await supabase
      .from('driver_sessions')
      .select('*')
      .eq('user_id', userId)
      .order('start_time', { ascending: false });

    if (error) throw error;

    return (data || []).map((s: any) => ({
      id: s.id,
      user_id: s.user_id,
      start_time: s.start_time,
      end_time: s.end_time || undefined,
      status: s.status === 'completed' || s.status === 'finished' ? 'completed' : 'active',
      total_distance_km: s.total_distance ? Number(s.total_distance) : 0,
      total_duration_minutes: s.total_minutes ? Number(s.total_minutes) : 0,
      created_at: s.created_at || s.start_time
    }));
  },

  /**
   * Fetches recorded routes coordinates in bulk for a list of sessionIds.
   */
  async fetchRoutePoints(sessionIds: string[]): Promise<RoutePoint[]> {
    if (sessionIds.length === 0) return [];

    const { data, error } = await supabase
      .from('route_points')
      .select('*')
      .in('session_id', sessionIds)
      .order('timestamp', { ascending: true });

    if (error) throw error;

    return (data || []).map((pt: any) => ({
      id: pt.id,
      session_id: pt.session_id,
      latitude: Number(pt.latitude),
      longitude: Number(pt.longitude),
      speed_kmh: pt.speed ? Number(pt.speed) : 0,
      recorded_at: pt.timestamp || pt.recorded_at || new Date().toISOString()
    }));
  },

  /**
   * Records session start event in DB.
   */
  async insertSession(userId: string, startTime: string): Promise<string> {
    const { data, error } = await supabase
      .from('driver_sessions')
      .insert([{
        user_id: userId,
        start_time: startTime,
        status: 'active',
        total_distance: 0
      }])
      .select()
      .single();

    if (error) throw error;
    return data.id;
  },

  /**
   * Records session termination parameters.
   */
  async endSession(sessionId: string, end_time: string, total_distance: number, total_minutes: number): Promise<void> {
    const { error } = await supabase
      .from('driver_sessions')
      .update({
        end_time,
        total_distance,
        total_minutes,
        status: 'completed'
      })
      .eq('id', sessionId);

    if (error) throw error;
  },

  /**
   * Inserts single coordinate record.
   */
  async insertRoutePoint(sessionId: string, latitude: number, longitude: number, speed: number, timestamp: string): Promise<string> {
    const { data, error } = await supabase
      .from('route_points')
      .insert([{
        session_id: sessionId,
        latitude,
        longitude,
        speed,
        accuracy: 0,
        timestamp
      }])
      .select()
      .single();

    if (error) throw error;
    return data.id;
  }
};
