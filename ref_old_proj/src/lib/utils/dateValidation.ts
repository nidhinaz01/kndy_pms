/**
 * Validates that a date is not in the future
 * @param dateString - Date string in YYYY-MM-DD format
 * @returns true if date is valid (not future), false otherwise
 */
export function isValidDate(dateString: string): boolean {
  if (!dateString) return false;
  
  const today = new Date();
  today.setHours(23, 59, 59, 999); // End of today
  
  const inputDate = new Date(dateString);
  
  return inputDate <= today;
}

/**
 * Gets today's date in YYYY-MM-DD format for max attribute in date inputs
 * @returns Today's date string
 */
export function getTodayString(): string {
  const today = new Date();
  return today.toISOString().split('T')[0];
} 