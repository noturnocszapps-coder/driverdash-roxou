/**
 * Exception and Error Tracker - FASE 5.2
 * Location: src/modules/observability/errorTracker.ts
 * Description: Captures JS errors, GPS errors, network drops, and logs them.
 */

import { observabilityService } from './observability.service';
import { LogCategory } from './observability.types';

export const errorTracker = {
  /**
   * Logs a standard typescript exception with severity levels.
   */
  trackException(
    category: LogCategory,
    message: string,
    error: any,
    additionalMetadata: Record<string, any> = {}
  ): void {
    const errorDetails = {
      errorMessage: error instanceof Error ? error.message : String(error),
      errorStack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString(),
      ...additionalMetadata
    };

    console.error(`[ErrorTracker] Exception [${category}]: ${message}`, error);

    observabilityService.log(
      'error',
      category,
      `${message} (Details: ${errorDetails.errorMessage})`,
      errorDetails
    );
  },

  /**
   * Specific helper for logging location and telemetry failures
   */
  trackGPSError(reason: string, permissionState?: string): void {
    observabilityService.log(
      'critical',
      'gps',
      `GPS Telemetry Error: ${reason}`,
      { permissionState, timestamp: new Date().toISOString() }
    );
  },

  /**
   * Tracks sync degradation or replication conflicts
   */
  trackSyncError(moduleName: string, error: any): void {
    this.trackException('sync', `Synchronization failed in active module: ${moduleName}`, error);
  },

  /**
   * Tracks database connection lost or RLS rejections
   */
  trackSupabaseError(action: string, error: any): void {
    this.trackException('supabase', `Database repository failure: ${action}`, error);
  }
};
