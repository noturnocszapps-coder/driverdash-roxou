/**
 * Basic Performance Tracker - FASE 5.2
 * Location: src/modules/observability/performanceTracker.ts
 */

import { observabilityService } from './observability.service';
import { LogCategory } from './observability.types';

const activeTimers = new Map<string, number>();

export const performanceTracker = {
  /**
   * Starts a basic timing segment
   */
  startTimer(timerName: string): void {
    if (typeof window !== 'undefined' && window.performance) {
      activeTimers.set(timerName, window.performance.now());
    } else {
      activeTimers.set(timerName, Date.now());
    }
  },

  /**
   * Concludes a timing segment and records it to logs if it exceeds warnings
   */
  stopAndTrack(timerName: string, category: LogCategory, warningThresholdMs = 450): number {
    const startTime = activeTimers.get(timerName);
    if (!startTime) return 0;
    
    const endTime = typeof window !== 'undefined' && window.performance ? window.performance.now() : Date.now();
    const elapsedMs = Math.round(endTime - startTime);
    
    activeTimers.delete(timerName);

    if (elapsedMs >= warningThresholdMs) {
      observabilityService.log(
        'warn',
        category,
        `Performance Degradation: Task '${timerName}' took ${elapsedMs}ms (Threshold: ${warningThresholdMs}ms).`,
        { timerName, elapsedMs, threshold: warningThresholdMs }
      );
    } else {
      console.debug(`[Perf] '${timerName}' completed in ${elapsedMs}ms`);
    }

    return elapsedMs;
  }
};
