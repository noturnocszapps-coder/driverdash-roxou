import { supabase } from '../shared/supabase.helpers';
import { UberPassSettings } from '../../types';

export const uberPassService = {
  /**
   * Fetches the driver's Uber Pass settings.
   */
  async fetchUberPassSettings(userId: string): Promise<UberPassSettings | null> {
    try {
      const { data, error } = await supabase
        .from('driver_uber_pass_settings')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) {
        console.warn('[UberPass Service] Warning fetching settings:', error.message);
        return null;
      }
      return data;
    } catch (err: any) {
      console.warn('[UberPass Service] Exception fetching settings:', err?.message || err);
      return null;
    }
  },

  /**
   * Upserts the driver's Uber Pass settings.
   */
  async upsertUberPassSettings(settings: Omit<UberPassSettings, 'id' | 'created_at' | 'updated_at'> & { id?: string }): Promise<UberPassSettings | null> {
    try {
      const { data, error } = await supabase
        .from('driver_uber_pass_settings')
        .upsert([settings], { onConflict: 'user_id' })
        .select()
        .maybeSingle();

      if (error) {
        console.warn('[UberPass Service] Warning upserting settings:', error.message);
        return null;
      }
      return data;
    } catch (err: any) {
      console.warn('[UberPass Service] Exception upserting settings:', err?.message || err);
      return null;
    }
  }
};

