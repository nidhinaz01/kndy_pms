import { calculateBreakTimeInMinutes } from '$lib/utils/breakTimeUtils';
import { formatTimeVerbose } from '$lib/utils/timeFormatUtils';

/**
 * Calculate break time in a time range
 */
export function calculateBreakTimeInRange(
  fromTime: string, 
  toTime: string, 
  shiftBreakTimes: Array<{ start_time: string; end_time: string }>
): number {
  return calculateBreakTimeInMinutes(fromTime, toTime, shiftBreakTimes);
}

/**
 * Calculate planned hours from time range (subtracting break time)
 */
export function calculatePlannedHoursFromTimes(
  fromTime: string, 
  toTime: string, 
  shiftBreakTimes: Array<{ start_time: string; end_time: string }>
): string {
  if (!fromTime || !toTime) return 'N/A';
  
  try {
    const from = new Date(`2000-01-01T${fromTime}`);
    const to = new Date(`2000-01-01T${toTime}`);
    
    if (to < from) {
      to.setDate(to.getDate() + 1);
    }
    
    const diffMs = to.getTime() - from.getTime();
    const breakMinutes = calculateBreakTimeInRange(fromTime, toTime, shiftBreakTimes);
    const breakHours = breakMinutes / 60;
    const totalHours = diffMs / (1000 * 60 * 60);
    const plannedHours = totalHours - breakHours;
    
    return `${Math.max(0, plannedHours).toFixed(1)}h`;
  } catch (error) {
    console.error('Error calculating planned hours from times:', error);
    return 'N/A';
  }
}

/**
 * Format time using verbose format
 */
export const formatTime = formatTimeVerbose;

/**
 * Convert 24-hour format to 12-hour format with AM/PM
 */
export function to12HourTime(time24: string): string {
  if (!time24 || !time24.includes(':')) return time24 || 'N/A';
  
  const timeParts = time24.split(':');
  const hours = parseInt(timeParts[0], 10);
  const minutes = timeParts[1] || '00';
  const seconds = timeParts[2] || '00';
  
  if (isNaN(hours)) return time24;
  
  const hour12 = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
  const ampm = hours < 12 ? 'AM' : 'PM';
  
  return `${hour12.toString().padStart(2, '0')}:${minutes}:${seconds} ${ampm}`;
}

/**
 * Format lost time details for display
 */
export function formatLostTimeDetails(ltDetails: any[] | null): string {
  if (!ltDetails || !Array.isArray(ltDetails) || ltDetails.length === 0) {
    return '';
  }
  
  return ltDetails.map((lt: any, index: number) => {
    const ltNumber = index + 1;
    const minutes = lt.lt_minutes || 0;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    const timeStr = `${hours} Hr ${mins} Min`;
    const payableStr = lt.is_lt_payable ? 'P' : 'NP';
    const reason = lt.lt_reason || lt.reason || 'N/A';
    
    return `LT${ltNumber}: ${timeStr} (${payableStr}-${reason})`;
  }).join('; ');
}

