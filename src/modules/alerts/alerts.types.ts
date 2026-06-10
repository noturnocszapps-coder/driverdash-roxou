/**
 * Roxou Smart Alerts and Notifications Type Definitions
 * Module: Alerts (alerts)
 * When to edit: When altering alert severity tiers, category tags, or auto-generation payloads.
 */

import { SmartAlert } from '../../types';

export type { SmartAlert };

export interface AlertsContextType {
  smartAlerts: SmartAlert[];
  addSmartAlert: (alert: Omit<SmartAlert, 'id' | 'created_at'>) => Promise<void>;
  dismissAlert: (alertId: string) => Promise<void>;
}
