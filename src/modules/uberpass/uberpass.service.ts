import { supabase } from '../shared/supabase.helpers';
import { UberPassSettings } from '../../types';

export const uberPassService = {
  /**
   * Fetches the driver's Uber Pass settings.
   */
  async fetchUberPassSettings(userId: string): Promise<UberPassSettings | null> {
    const { data, error } = await supabase
      .from('driver_uber_pass_settings')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) throw error;
    return data;
  },

  /**
   * Upserts the driver's Uber Pass settings.
   */
  async upsertUberPassSettings(settings: Omit<UberPassSettings, 'id' | 'created_at' | 'updated_at'> & { id?: string }): Promise<UberPassSettings> {
    const { data, error } = await supabase
      .from('driver_uber_pass_settings')
      .upsert([settings], { onConflict: 'user_id' })
      .select()
      .single();

    if (error) throw error;
    return data;
  }
};
