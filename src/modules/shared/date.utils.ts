/**
 * Date utility functions
 * Module: Shared
 * When to edit: When adding or changing date parsing, formatting, or time calculations.
 */

/**
 * Securely parses a date string into a Date object at noon, preventing time zone distortion.
 */
export const parseDateSecure = (dateStr: string): Date => {
  const parts = dateStr.split('-');
  if (parts.length !== 3) return new Date(dateStr);
  return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]), 12, 0, 0);
};

/**
 * Returns Monday at midnight of the current calendar week for a given date.
 */
export const getStartOfWeek = (date: Date): Date => {
  const dayOfWeek = date.getDay();
  const diff = date.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
  const monday = new Date(date.getFullYear(), date.getMonth(), diff);
  monday.setHours(0, 0, 0, 0);
  return monday;
};

/**
 * Returns a string formatted as YYYY-MM-DD for a given date.
 */
export const formatDateString = (date: Date): string => {
  return date.toISOString().split('T')[0];
};
