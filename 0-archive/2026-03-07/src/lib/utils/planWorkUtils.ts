import type { TimeSlot } from '$lib/types/planWork';
import { formatTime } from './timeFormatUtils';
import { calculateBreakTimeForWorkPeriod, calculateBreakTimeInMinutes } from './breakTimeUtils';

// Re-export for backward compatibility
export { formatTime };

/**
 * Convert time string (HH:MM) to minutes
 */
export function timeToMinutes(timeStr: string): number {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
}

/**
 * Convert minutes to time string (HH:MM)
 */
export function minutesToTime(minutes: number): string {
  const hours = Math.floor(minutes / 60) % 24;
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
}

/**
 * Check if a date is a weekend (Saturday or Sunday)
 */
export function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6; // Sunday = 0, Saturday = 6
}

export function calculatePlannedHours(fromTime: string, toTime: string): number {
  if (!fromTime || !toTime) return 0;
  
  try {
    const [fromHour, fromMin] = fromTime.split(':').map(Number);
    const [toHour, toMin] = toTime.split(':').map(Number);
    
    const fromMinutes = fromHour * 60 + fromMin;
    const toMinutes = toHour * 60 + toMin;
    
    // Handle overnight shifts
    let diffMinutes = toMinutes - fromMinutes;
    if (diffMinutes < 0) {
      diffMinutes += 24 * 60; // Add 24 hours
    }
    
    return diffMinutes / 60;
  } catch (error) {
    console.error('Error calculating planned hours:', error);
    return 0;
  }
}

/**
 * Calculate break time in a time slot
 * Returns hours for backward compatibility
 * @deprecated Use calculateBreakTimeInMinutes from breakTimeUtils and convert to hours if needed
 */
export function calculateBreakTimeInSlot(
  fromTime: string,
  toTime: string,
  shiftBreakTimes: Array<{ start_time: string; end_time: string }>
): number {
  const breakMinutes = calculateBreakTimeInMinutes(fromTime, toTime, shiftBreakTimes);
  return breakMinutes / 60; // Convert to hours for backward compatibility
}

export function autoCalculateEndTime(
  fromTime: string,
  remainingTime: number,
  estimatedDurationMinutes: number | undefined,
  shiftBreakTimes: Array<{ start_time: string; end_time: string }>
): string {
  if (!fromTime) return '';

  try {
    const [fromHour, fromMin] = fromTime.split(':').map(Number);
    const fromMinutes = fromHour * 60 + fromMin;
    
    // Use remaining time if available, otherwise use estimated duration
    const workDurationMinutes = remainingTime > 0 
      ? remainingTime * 60 
      : (estimatedDurationMinutes || 0);
    
    if (workDurationMinutes <= 0) return '';

    // Calculate break time in the work period (returns minutes)
    const breakMinutes = calculateBreakTimeForWorkPeriod(
      fromTime,
      workDurationMinutes,
      shiftBreakTimes
    );

    // Total time = work duration + break time
    const totalMinutes = workDurationMinutes + breakMinutes;
    const endMinutes = fromMinutes + totalMinutes;
    
    // Handle overnight
    const endHour = Math.floor((endMinutes % (24 * 60)) / 60);
    const endMin = endMinutes % 60;
    
    return `${endHour.toString().padStart(2, '0')}:${endMin.toString().padStart(2, '0')}`;
  } catch (error) {
    console.error('Error auto-calculating end time:', error);
    return '';
  }
}

export function generateTimeSlots(shiftStartTime: string, shiftEndTime: string): TimeSlot[] {
  const slots: TimeSlot[] = [];
  
  try {
    const [startHour, startMinute] = shiftStartTime.split(':').map(Number);
    const shiftStartDate = new Date(2000, 0, 1, startHour, startMinute);
    
    const slotStartDate = new Date(shiftStartDate.getTime() - 3 * 60 * 60 * 1000);
    
    const [endHour, endMinute] = shiftEndTime.split(':').map(Number);
    let shiftEndDate = new Date(2000, 0, 1, endHour, endMinute);
    
    if (shiftEndDate < shiftStartDate) {
      shiftEndDate = new Date(shiftEndDate.getTime() + 24 * 60 * 60 * 1000);
    }
    
    let currentTime = new Date(slotStartDate);
    while (currentTime <= shiftEndDate) {
      const hours24 = currentTime.getHours();
      const minutes = currentTime.getMinutes();
      
      const value = `${hours24.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
      
      const hours12 = hours24 === 0 ? 12 : hours24 > 12 ? hours24 - 12 : hours24;
      const ampm = hours24 < 12 ? 'AM' : 'PM';
      const display = `${hours12}:${minutes.toString().padStart(2, '0')} ${ampm}`;
      
      slots.push({ value, display });
      
      currentTime = new Date(currentTime.getTime() + 15 * 60 * 1000);
    }
    
    return slots;
  } catch (error) {
    console.error('Error generating time slots:', error);
    return [];
  }
}

export function getSkillShort(skillMapping: any): string {
  try {
    const skillCombination = skillMapping.std_skill_combinations;
    if (!skillCombination) return skillMapping.sc_name;

    const combination = Array.isArray(skillCombination) 
      ? skillCombination[0]?.skill_combination 
      : skillCombination?.skill_combination;

    if (!combination) return skillMapping.sc_name;

    if (Array.isArray(combination)) {
      const skillNames = combination
        .map(skill => skill.skill_name)
        .filter(Boolean)
        .join(' + ');
      return skillNames || skillMapping.sc_name;
    }

    return skillMapping.sc_name;
  } catch (error) {
    console.error('Error extracting skill short:', error);
    return skillMapping.sc_name;
  }
}

export function getIndividualSkills(skillMapping: any): string[] {
  try {
    const skillCombination = skillMapping.std_skill_combinations;
    
    const combination = skillCombination 
      ? (Array.isArray(skillCombination) 
        ? skillCombination[0]?.skill_combination 
        : skillCombination?.skill_combination)
      : null;

    if (combination && Array.isArray(combination)) {
      // Sort by skill_order to maintain the hierarchy from std_work_skill_mapping
      const sortedCombination = [...combination].sort((a, b) => {
        const orderA = a.skill_order ?? 999;
        const orderB = b.skill_order ?? 999;
        return orderA - orderB;
      });
      
      const skillNames = sortedCombination
        .map(skill => skill.skill_name)
        .filter(Boolean);
      if (skillNames.length > 0) {
        return skillNames;
      }
    }

    if (skillMapping.sc_name && typeof skillMapping.sc_name === 'string') {
      const scName = skillMapping.sc_name.trim();
      if (scName.includes(' + ')) {
        const individualSkills = scName.split(' + ').map((s: string) => s.trim()).filter(Boolean);
        if (individualSkills.length > 0) {
          return individualSkills;
        }
      }
    }

    return [skillMapping.sc_name || 'Unknown'];
  } catch (error) {
    console.error('Error extracting individual skills:', error);
    if (skillMapping?.sc_name && typeof skillMapping.sc_name === 'string') {
      const scName = skillMapping.sc_name.trim();
      if (scName.includes(' + ')) {
        const individualSkills = scName.split(' + ').map((s: string) => s.trim()).filter(Boolean);
        if (individualSkills.length > 0) {
          return individualSkills;
        }
      }
      return [scName];
    }
    return [skillMapping?.sc_name || 'Unknown'];
  }
}

