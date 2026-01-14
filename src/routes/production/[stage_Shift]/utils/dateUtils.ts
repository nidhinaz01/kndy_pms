/**
 * Centralized date parsing utility
 * Normalizes date strings to YYYY-MM-DD format consistently across the application
 */

/**
 * Parse and normalize a date to YYYY-MM-DD format
 * Handles string dates, Date objects, and other formats
 */
export function normalizeDate(date: string | Date | null | undefined): string {
  if (!date) {
    return '';
  }
  
  if (typeof date === 'string') {
    // Extract YYYY-MM-DD from string (handles ISO strings with time component)
    return date.split('T')[0];
  }
  
  if (date && typeof date === 'object' && 'toISOString' in date) {
    // Date object
    return (date as Date).toISOString().split('T')[0];
  }
  
  // Fallback: convert to string and extract date part
  return String(date).split('T')[0];
}

/**
 * Check if a date string is valid (YYYY-MM-DD format)
 */
export function isValidDateString(dateStr: string): boolean {
  if (!dateStr) return false;
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  return dateRegex.test(dateStr);
}
