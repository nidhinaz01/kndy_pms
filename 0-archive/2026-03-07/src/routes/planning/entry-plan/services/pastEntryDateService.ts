/**
 * Service for handling past entry date planning
 * Used when work orders have already entered production
 */

import { supabase } from '$lib/supabaseClient';
import { calculateDateBefore } from '$lib/utils/dateCalculationUtils';
import { fetchShiftsForStage } from '$lib/api/hrShiftStageMaster';

/**
 * Validate time against shift hours for a given stage
 */
export async function validateTimeAgainstShifts(
  time: string,
  stageCode: string
): Promise<{ isValid: boolean; error?: string }> {
  try {
    // Get allowed shifts for the stage
    const allowedShiftCodes = await fetchShiftsForStage(stageCode);
    
    if (allowedShiftCodes.length === 0) {
      // No shift restrictions, allow any time
      return { isValid: true };
    }

    // Convert time to minutes for comparison
    const [hours, minutes] = time.split(':').map(Number);
    const timeMinutes = hours * 60 + minutes;

    // Fetch shift details
    const { data: shiftsData, error: shiftsError } = await supabase
      .from('hr_shift_master')
      .select('shift_code, start_time, end_time')
      .in('shift_code', allowedShiftCodes)
      .eq('is_active', true)
      .eq('is_deleted', false);

    if (shiftsError) {
      console.warn('Error fetching shifts for validation:', shiftsError);
      // If we can't validate, allow the time (fail open)
      return { isValid: true };
    }

    if (!shiftsData || shiftsData.length === 0) {
      return { isValid: true };
    }

    // Check if time falls within any allowed shift
    for (const shift of shiftsData) {
      const [startHours, startMinutes] = shift.start_time.split(':').map(Number);
      const [endHours, endMinutes] = shift.end_time.split(':').map(Number);
      
      const startTimeMinutes = startHours * 60 + startMinutes;
      let endTimeMinutes = endHours * 60 + endMinutes;

      // Handle overnight shifts (end time is next day)
      if (endTimeMinutes < startTimeMinutes) {
        // Shift spans midnight
        if (timeMinutes >= startTimeMinutes || timeMinutes <= endTimeMinutes) {
          return { isValid: true };
        }
      } else {
        // Normal shift (same day)
        if (timeMinutes >= startTimeMinutes && timeMinutes <= endTimeMinutes) {
          return { isValid: true };
        }
      }
    }

    // Time doesn't fall within any allowed shift
    const shiftRanges = shiftsData
      .map(s => `${s.start_time.substring(0, 5)}-${s.end_time.substring(0, 5)}`)
      .join(', ');
    
    return {
      isValid: false,
      error: `Selected time ${time} is not within allowed shift hours (${shiftRanges})`
    };
  } catch (error) {
    console.error('Error validating time against shifts:', error);
    // Fail open - allow the time if validation fails
    return { isValid: true };
  }
}

/**
 * Calculate dates for past entry
 * Returns chassis arrival and document release dates calculated backward from entry date
 */
export function calculatePastEntryDates(
  entryDate: string,
  entryTime: string,
  chassisLeadTime: number,
  documentLeadTime: number,
  holidays: any[]
): {
  productionEntryDate: string;
  productionEntryTime: string;
  chassisArrivalDate: string;
  documentReleaseDate: string;
} {
  const chassisArrivalDate = calculateDateBefore(entryDate, chassisLeadTime, holidays);
  const documentReleaseDate = calculateDateBefore(entryDate, documentLeadTime, holidays);

  return {
    productionEntryDate: entryDate,
    productionEntryTime: entryTime,
    chassisArrivalDate,
    documentReleaseDate
  };
}

/**
 * Format date-time for display
 */
export function formatPastEntryDateTime(date: string, time: string): string {
  const dateObj = new Date(`${date}T${time}`);
  return dateObj.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

