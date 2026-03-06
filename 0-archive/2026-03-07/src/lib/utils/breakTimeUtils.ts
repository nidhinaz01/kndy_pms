/**
 * Break time calculation utilities
 * Standardized function that returns break time in minutes
 */

/**
 * Calculate break time in minutes that overlaps with a work period
 * This is the standard function - all other break time calculations should use this
 * 
 * @param startTimeStr - Start time in HH:MM format
 * @param endTimeStr - End time in HH:MM format (or can be calculated from startTime + duration)
 * @param breakTimes - Array of break time objects with start_time and end_time (HH:MM format)
 * @returns Total break time in minutes (rounded)
 */
export function calculateBreakTimeInMinutes(
  startTimeStr: string,
  endTimeStr: string,
  breakTimes: Array<{ start_time: string; end_time: string }>
): number {
  if (!startTimeStr || !endTimeStr || !breakTimes || breakTimes.length === 0) {
    return 0;
  }

  try {
    // Convert times to Date objects for easier calculation
    const workStart = new Date(`2000-01-01T${startTimeStr}`);
    let workEnd = new Date(`2000-01-01T${endTimeStr}`);
    
    // Handle overnight shifts
    if (workEnd < workStart) {
      workEnd = new Date(`2000-01-02T${endTimeStr}`);
    }
    
    let totalBreakMinutes = 0;
    
    // Calculate overlap with each break time
    breakTimes.forEach((breakTime: { start_time: string; end_time: string }) => {
      const breakStart = new Date(`2000-01-01T${breakTime.start_time}`);
      let breakEnd = new Date(`2000-01-01T${breakTime.end_time}`);
      
      // Handle overnight breaks
      if (breakEnd < breakStart) {
        breakEnd = new Date(`2000-01-02T${breakTime.end_time}`);
      }
      
      // Check overlap with break time
      const overlapStart = new Date(Math.max(workStart.getTime(), breakStart.getTime()));
      const overlapEnd = new Date(Math.min(workEnd.getTime(), breakEnd.getTime()));
      
      if (overlapStart < overlapEnd) {
        const overlapMs = overlapEnd.getTime() - overlapStart.getTime();
        const overlapMinutes = overlapMs / (1000 * 60);
        totalBreakMinutes += Math.max(0, overlapMinutes);
      }
    });
    
    return Math.round(totalBreakMinutes);
  } catch (error) {
    console.error('Error calculating break time:', error);
    return 0;
  }
}

/**
 * Calculate break time for a work period starting at a specific time with a duration
 * 
 * @param startTimeStr - Start time in HH:MM format
 * @param workDurationMinutes - Duration of work in minutes
 * @param breakTimes - Array of break time objects
 * @returns Total break time in minutes
 */
export function calculateBreakTimeForWorkPeriod(
  startTimeStr: string,
  workDurationMinutes: number,
  breakTimes: Array<{ start_time: string; end_time: string }>
): number {
  if (!startTimeStr || workDurationMinutes <= 0 || !breakTimes || breakTimes.length === 0) {
    return 0;
  }

  try {
    const [startHour, startMin] = startTimeStr.split(':').map(Number);
    const startMinutes = startHour * 60 + startMin;
    const endMinutes = startMinutes + workDurationMinutes;
    
    // Convert end minutes to time string
    const endHours = Math.floor((endMinutes % (24 * 60)) / 60);
    const endMins = endMinutes % 60;
    const endTimeStr = `${endHours.toString().padStart(2, '0')}:${endMins.toString().padStart(2, '0')}`;
    
    return calculateBreakTimeInMinutes(startTimeStr, endTimeStr, breakTimes);
  } catch (error) {
    console.error('Error calculating break time for work period:', error);
    return 0;
  }
}

