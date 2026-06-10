/**
 * String and number formatting functions
 * Module: Shared
 * When to edit: When altering display presentation formats like currency, distance, or percentage.
 */

/**
 * Formats a number as a Brazilian Real currency string.
 */
export const formatCurrency = (val: number): string => {
  return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

/**
 * Formats a distance in kilometers.
 */
export const formatDistance = (val: number): string => {
  return `${val.toFixed(1)} km`;
};

/**
 * Formats minutes into hours and minutes, e.g. "2h 15m".
 */
export const formatMinutesToHours = (mins: number): string => {
  if (mins > 60) {
    const hours = Math.floor(mins / 60);
    const remaining = Math.round(mins % 60);
    return `${hours}h ${remaining}m`;
  }
  return `${Math.round(mins)} min`;
};
