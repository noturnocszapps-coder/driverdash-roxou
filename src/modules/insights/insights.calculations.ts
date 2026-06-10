/**
 * Pure Mathematical Insights and Peak Rules Calculations
 * Module: Insights (insights)
 * When to edit: When modifying algorithms that compute current peak hours matching or region heat indexes.
 */

import { AdminPeakRule, PassengerReport } from './insights.types';

/**
 * Checks if a peak rule matches the current day and time.
 */
export const isPeakActiveNow = (rule: AdminPeakRule, now: Date = new Date()): boolean => {
  if (!rule.is_active) return false;

  // Day check
  const dayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const currentDayLabel = dayLabels[now.getDay()];
  const currentDayNumStr = now.getDay().toString();

  const dayMatches = rule.days_of_week.includes(currentDayLabel) || rule.days_of_week.includes(currentDayNumStr);
  if (!dayMatches) return false;

  // Time check
  const nowHours = now.getHours();
  const nowMins = now.getMinutes();
  const nowMinutesTotal = nowHours * 60 + nowMins;

  const [startH, startM] = rule.start_time.split(':').map(Number);
  const [endH, endM] = rule.end_time.split(':').map(Number);

  const startMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;

  if (startMinutes <= endMinutes) {
    return nowMinutesTotal >= startMinutes && nowMinutesTotal <= endMinutes;
  } else {
    // Overlap midnight (e.g. 22:00 to 04:00)
    return nowMinutesTotal >= startMinutes || nowMinutesTotal <= endMinutes;
  }
};

/**
 * Aggregates passenger report dangers by severity levels.
 */
export const countReportsBySeverity = (reports: PassengerReport[]): { low: number; medium: number; high: number } => {
  return reports.reduce(
    (count, r) => {
      if (r.severity === 'low') count.low++;
      else if (r.severity === 'medium') count.medium++;
      else if (r.severity === 'high') count.high++;
      return count;
    },
    { low: 0, medium: 0, high: 0 }
  );
};
