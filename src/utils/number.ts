/**
 * Utility functions for safe numerical calculations, preventing
 * division by zero, NaN, Infinity, and handling edge cases gracefully.
 */

/**
 * Safely parses any value into a valid number.
 * Returns fallback (default 0) if the value is invalid or NaN.
 */
export function safeNumber(val: any, fallback: number = 0): number {
  if (val === null || val === undefined) return fallback;
  const num = typeof val === 'number' ? val : Number(val);
  return isNaN(num) ? fallback : num;
}

/**
 * Safely divides two numbers. Prevents division by zero, NaN, or Infinity.
 * Returns the fallback (default 0) in edge cases.
 */
export function safeDivide(num: number, den: number, fallback: number = 0): number {
  const safeNum = safeNumber(num, 0);
  const safeDen = safeNumber(den, 0);
  if (safeDen === 0) return fallback;
  const result = safeNum / safeDen;
  return isFinite(result) ? result : fallback;
}

/**
 * Clamps a number within a specific range [min, max].
 */
export function clamp(val: number, min: number, max: number): number {
  const parsed = safeNumber(val, min);
  return Math.max(min, Math.min(max, parsed));
}

/**
 * Rounds a number to a standard currency format (2 decimal places).
 */
export function roundCurrency(val: number): number {
  const parsed = safeNumber(val, 0);
  return Math.round((parsed + Number.EPSILON) * 100) / 100;
}

/**
 * Safely calculates a percentage (part / total * 100).
 */
export function percent(part: number, total: number, fallback: number = 0): number {
  return safeDivide(part * 100, total, fallback);
}

/**
 * Safely parses any value into a non-negative number (>= 0).
 */
export function normalizePositiveNumber(val: any, fallback: number = 0): number {
  const num = safeNumber(val, fallback);
  return num < 0 ? Math.abs(num) : num;
}
