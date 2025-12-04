import { formatTime, formatMinutes } from './timeFormatUtils';
import { calculateBreakTimeInMinutes } from './breakTimeUtils';

// Re-export for backward compatibility
export { formatTime, formatMinutes };

export function calculateActualTime(
  fromDate: string,
  fromTime: string,
  toDate: string,
  toTime: string,
  breakTimes?: any[]
): number {
  if (!fromDate || !fromTime || !toDate || !toTime) {
    return 0;
  }

  try {
    const fromDateTime = new Date(`${fromDate}T${fromTime}`);
    const toDateTime = new Date(`${toDate}T${toTime}`);
    
    if (toDateTime <= fromDateTime) {
      return 0;
    }

    const diffMs = toDateTime.getTime() - fromDateTime.getTime();
    let totalMinutes = Math.round(diffMs / (1000 * 60));
    
    // Subtract break time if available
    if (breakTimes && Array.isArray(breakTimes) && breakTimes.length > 0) {
      const breakMinutes = calculateBreakTimeInMinutes(fromTime, toTime, breakTimes);
      totalMinutes = Math.max(0, totalMinutes - breakMinutes);
    }
    
    return totalMinutes;
  } catch (error) {
    console.error('Error calculating actual time:', error);
    return 0;
  }
}

// Re-export standard function
export const calculateBreakTimeInPeriod = calculateBreakTimeInMinutes;

export function calculateLostTime(
  standardTimeMinutes: number,
  actualTimeMinutes: number
): number {
  return actualTimeMinutes > standardTimeMinutes
    ? Math.max(0, actualTimeMinutes - standardTimeMinutes)
    : 0;
}

