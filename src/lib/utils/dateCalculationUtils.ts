/**
 * Date calculation utilities for working with holidays and weekends
 */

/**
 * Check if a date string is a holiday
 */
export function isHoliday(dateStr: string, holidays: any[]): boolean {
  return holidays.some(holiday => holiday.dt_value === dateStr);
}

/**
 * Calculate a date after a certain number of working days (skipping holidays)
 */
export function calculateDateAfter(startDate: string, daysAfter: number, holidays: any[]): string {
  const date = new Date(startDate);
  let daysAdded = 0;
  let currentDate = new Date(date);

  while (daysAdded < daysAfter) {
    currentDate.setDate(currentDate.getDate() + 1);
    
    // Skip holidays
    if (!isHoliday(currentDate.toISOString().split('T')[0], holidays)) {
      daysAdded++;
    }
  }

  return currentDate.toISOString().split('T')[0];
}

/**
 * Calculate a date before a certain number of working days (skipping holidays)
 */
export function calculateDateBefore(startDate: string, daysBefore: number, holidays: any[]): string {
  const date = new Date(startDate);
  let daysAdded = 0;
  let currentDate = new Date(date);

  while (daysAdded < daysBefore) {
    currentDate.setDate(currentDate.getDate() - 1);
    
    // Skip holidays
    if (!isHoliday(currentDate.toISOString().split('T')[0], holidays)) {
      daysAdded++;
    }
  }

  return currentDate.toISOString().split('T')[0];
}

