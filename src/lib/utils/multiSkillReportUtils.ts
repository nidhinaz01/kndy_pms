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

/**
 * Net worked hours for a reporting row: clock span minus overlapping shift breaks.
 * Persist as {@code prdn_work_reporting.hours_worked_today}.
 */
export function netHoursWorkedForReportingRow(
  eff: { fromDate: string; toDate: string; fromTime: string; toTime: string },
  shiftBreakTimes?: Array<{ start_time: string; end_time: string }>
): number {
  const minutes = calculateActualTime(
    eff.fromDate,
    eff.fromTime,
    eff.toDate,
    eff.toTime,
    shiftBreakTimes
  );
  return Math.max(0, minutes / 60);
}

// Re-export standard function
export const calculateBreakTimeInPeriod = calculateBreakTimeInMinutes;

/**
 * @param timeWorkedTillDateMinutes Optional. Cumulative time already spent on this work before today (minutes). When provided, total time = till date + actual today is compared to standard.
 */
export function calculateLostTime(
  standardTimeMinutes: number,
  actualTimeMinutes: number,
  timeWorkedTillDateMinutes: number = 0
): number {
  const totalTimeMinutes = timeWorkedTillDateMinutes + actualTimeMinutes;
  return totalTimeMinutes > standardTimeMinutes
    ? Math.max(0, totalTimeMinutes - standardTimeMinutes)
    : 0;
}

