import { loadShiftInfo } from '$lib/services/multiSkillReportService';
import { timeToMinutes } from './planWorkUtils';
import { isHoliday } from './dateCalculationUtils';
import { calculateBreakTimeForWorkPeriod } from './breakTimeUtils';

/**
 * Cache for shift info by date and stage
 */
const shiftInfoCache: Map<string, any> = new Map();

/**
 * Get shift info for a specific date and stage code
 */
export async function getShiftInfoForDate(dateStr: string, stageCode: string): Promise<any> {
  const cacheKey = `${dateStr}_${stageCode}`;
  if (shiftInfoCache.has(cacheKey)) {
    return shiftInfoCache.get(cacheKey);
  }

  try {
    const shiftInfo = await loadShiftInfo(stageCode, dateStr);
    if (shiftInfo) {
      shiftInfoCache.set(cacheKey, shiftInfo);
    }
    return shiftInfo;
  } catch (error) {
    console.error(`Error loading shift info for ${dateStr} stage ${stageCode}:`, error);
    return null;
  }
}

/**
 * Clear the shift info cache
 */
export function clearShiftInfoCache(): void {
  shiftInfoCache.clear();
}

/**
 * Calculate exit time for a stage considering shift schedules, breaks, weekends, and holidays
 */
export async function calculateExitTimeWithShifts(
  entryDateTime: Date,
  leadTimeHours: number,
  stageCode: string,
  holidays: any[]
): Promise<Date> {
  let currentDateTime = new Date(entryDateTime);
  let minutesRemaining = leadTimeHours * 60; // Convert to minutes for precision

  while (minutesRemaining > 0) {
    const currentDateStr = currentDateTime.toISOString().split('T')[0];
    
    // Skip holidays (weekends should be in the holiday list if they're non-working days)
    if (isHoliday(currentDateStr, holidays)) {
      currentDateTime.setDate(currentDateTime.getDate() + 1);
      // Get shift start time for next working day
      const shiftInfo = await getShiftInfoForDate(currentDateStr, stageCode);
      if (shiftInfo && shiftInfo.hr_shift_master) {
        const [startHour, startMin] = shiftInfo.hr_shift_master.start_time.split(':').map(Number);
        currentDateTime.setHours(startHour, startMin, 0, 0);
      } else {
        currentDateTime.setHours(8, 0, 0, 0); // Fallback to 8 AM
      }
      continue;
    }

    // Get shift info for this date and stage
    const shiftInfo = await getShiftInfoForDate(currentDateStr, stageCode);
    
    if (!shiftInfo || !shiftInfo.hr_shift_master) {
      // Fallback: use default 8 AM - 6 PM if no shift info
      const currentHour = currentDateTime.getHours();
      const currentMinute = currentDateTime.getMinutes();
      const currentMinutes = currentHour * 60 + currentMinute;
      
      // If before 8 AM, start at 8 AM
      if (currentMinutes < 8 * 60) {
        currentDateTime.setHours(8, 0, 0, 0);
        continue;
      }
      // If after 6 PM, move to next day 8 AM
      if (currentMinutes >= 18 * 60) {
        currentDateTime.setDate(currentDateTime.getDate() + 1);
        currentDateTime.setHours(8, 0, 0, 0);
        continue;
      }
      
      // Calculate remaining time in this day
      const remainingInDay = (18 * 60) - currentMinutes;
      const workMinutes = Math.min(remainingInDay, minutesRemaining);
      
      // Add work time (no breaks in fallback)
      currentDateTime.setMinutes(currentDateTime.getMinutes() + workMinutes);
      minutesRemaining -= workMinutes;
      
      // If we've used up this day, move to next
      if (minutesRemaining > 0) {
        currentDateTime.setDate(currentDateTime.getDate() + 1);
        currentDateTime.setHours(8, 0, 0, 0);
      }
      continue;
    }

    const shift = shiftInfo.hr_shift_master;
    const shiftStartMinutes = timeToMinutes(shift.start_time);
    let shiftEndMinutes = timeToMinutes(shift.end_time);
    
    // Handle overnight shifts
    if (shiftEndMinutes <= shiftStartMinutes) {
      shiftEndMinutes += 24 * 60;
    }
    
    // Get break times for this shift
    const shiftBreakTimes = (shiftInfo.breakTimes || []).map((bt: any) => ({
      start_time: bt.start_time,
      end_time: bt.end_time
    }));

    const currentHour = currentDateTime.getHours();
    const currentMinute = currentDateTime.getMinutes();
    let currentMinutes = currentHour * 60 + currentMinute;

    // Adjust current time if before shift start
    if (currentMinutes < shiftStartMinutes) {
      const [startHour, startMin] = shift.start_time.split(':').map(Number);
      currentDateTime.setHours(startHour, startMin, 0, 0);
      currentMinutes = shiftStartMinutes;
      continue;
    }

    // Handle overnight: if current time is before midnight but shift ends after midnight
    if (currentMinutes < shiftStartMinutes && shiftEndMinutes > 24 * 60) {
      currentMinutes += 24 * 60;
    }

    // If after shift end, move to next day
    if (currentMinutes >= shiftEndMinutes) {
      currentDateTime.setDate(currentDateTime.getDate() + 1);
      const [startHour, startMin] = shift.start_time.split(':').map(Number);
      currentDateTime.setHours(startHour, startMin, 0, 0);
      continue;
    }

    // Calculate how much time we can work in this shift
    // We need to account for breaks - work time + break time should not exceed shift duration
    const remainingInShift = shiftEndMinutes - currentMinutes;
    
    // Calculate break time for the remaining shift period
    const currentTimeStr = `${currentHour.toString().padStart(2, '0')}:${currentMinute.toString().padStart(2, '0')}`;
    const breakMinutesInRemainingShift = calculateBreakTimeForWorkPeriod(
      currentTimeStr,
      remainingInShift,
      shiftBreakTimes
    );
    
    // Available work time = remaining shift time - breaks in that period
    const availableWorkMinutes = remainingInShift - breakMinutesInRemainingShift;
    
    // Work as much as we can (either all available time or remaining work needed)
    const workDurationMinutes = Math.min(availableWorkMinutes, minutesRemaining);
    
    // Calculate break time for the actual work period we'll do
    const breakMinutes = calculateBreakTimeForWorkPeriod(
      currentTimeStr,
      workDurationMinutes,
      shiftBreakTimes
    );
    
    // Update remaining work
    minutesRemaining -= workDurationMinutes;
    
    // If we can complete all remaining work in this shift
    if (minutesRemaining <= 0) {
      // When work completes, we should exit at shift end time
      // This ensures we've worked the full shift (work time + break time = shift duration)
      const [endHour, endMin] = shift.end_time.split(':').map(Number);
      currentDateTime.setHours(endHour, endMin, 0, 0);
      minutesRemaining = 0;
    } else {
      // We need to work until shift end, then continue next day
      // Set to shift end time
      const [endHour, endMin] = shift.end_time.split(':').map(Number);
      currentDateTime.setHours(endHour, endMin, 0, 0);
      
      // Move to next day at shift start
      currentDateTime.setDate(currentDateTime.getDate() + 1);
      const [startHour, startMin] = shift.start_time.split(':').map(Number);
      currentDateTime.setHours(startHour, startMin, 0, 0);
    }
  }

  return currentDateTime;
}

