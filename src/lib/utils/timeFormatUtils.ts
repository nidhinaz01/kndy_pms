/**
 * Time formatting utilities
 * Consolidated from multiple files to reduce duplication
 */

/**
 * Format hours to "Xh Ym" format
 */
export function formatTime(hours: number): string {
  if (!hours) return '0h 0m';
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return `${h}h ${m}m`;
}

/**
 * Format minutes to "Xh Ym" format
 */
export function formatTimeFromMinutes(minutes: number): string {
  if (!minutes) return '0h 0m';
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours}h ${mins}m`;
}

/**
 * Format minutes to "Xh Ym" or "Ym" format (omits hours if 0)
 */
export function formatMinutes(minutes: number): string {
  if (!minutes) return '0m';
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

/**
 * Format hours to verbose "X Hr Y Min" format
 */
export function formatTimeVerbose(hours: number): string {
  if (!hours) return '0 Hr 0 Min';
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return `${h} Hr ${m} Min`;
}

