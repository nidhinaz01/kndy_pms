import type { LostTimeChunk } from '$lib/types/reportWork';
import { formatTime, formatMinutes } from './timeFormatUtils';

// Re-export for backward compatibility
export { formatTime, formatMinutes };

/**
 * Calculate actual time between two times (same day or overnight)
 * This is a simpler version that doesn't require dates
 * For date-aware calculations with break times, use calculateActualTime from multiSkillReportUtils
 */
export function calculateActualTime(
  fromDate: string,
  fromTime: string,
  toDate: string,
  toTime: string
): number {
  if (!fromDate || !fromTime || !toDate || !toTime) {
    return 0;
  }

  try {
    const from = new Date(`2000-01-01T${fromTime}`);
    let to = new Date(`2000-01-01T${toTime}`);
    
    if (to < from) {
      to = new Date(`2000-01-02T${toTime}`);
    }
    
    const diffMs = to.getTime() - from.getTime();
    const diffMinutes = diffMs / (1000 * 60);
    
    return Math.max(0, diffMinutes);
  } catch (error) {
    console.error('Error calculating actual time:', error);
    return 0;
  }
}

export function calculateHoursWorkedToday(actualTimeMinutes: number): number {
  return actualTimeMinutes / 60;
}

export function calculateLostTime(
  standardTimeMinutes: number,
  actualTimeMinutes: number,
  completionStatus: 'C' | 'NC'
): number {
  if (completionStatus === 'C') {
    // For completed work, lost time = actual - standard (if actual > standard)
    return Math.max(0, actualTimeMinutes - standardTimeMinutes);
  } else {
    // For not completed work, lost time = actual (all time is lost)
    return actualTimeMinutes;
  }
}

export function calculateChunkCost(
  minutes: number,
  isPayable: boolean,
  employeeSalary: number
): number {
  if (!isPayable || minutes <= 0 || employeeSalary <= 0) {
    return 0;
  }

  try {
    const currentDate = new Date();
    const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
    const salaryPerMinute = employeeSalary / daysInMonth / 480;
    const cost = minutes * salaryPerMinute;
    return Math.round(cost * 100) / 100; // Round to 2 decimal places
  } catch (error) {
    console.error('Error calculating chunk cost:', error);
    return 0;
  }
}

export function calculateRemainingMinutes(
  totalLostTimeMinutes: number,
  lostTimeChunks: LostTimeChunk[]
): number {
  const allocatedMinutes = lostTimeChunks.reduce((sum, chunk) => sum + chunk.minutes, 0);
  return totalLostTimeMinutes - allocatedMinutes;
}

