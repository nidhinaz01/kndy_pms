/**
 * Validation service for planning submissions
 */

import { supabase } from '$lib/supabaseClient';
import { calculateBreakTimeInMinutes } from '$lib/utils/breakTimeUtils';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

interface TimeSlot {
  from: string; // HH:MM format
  to: string; // HH:MM format
}

/**
 * Convert time string (HH:MM) to minutes since midnight
 */
function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

/**
 * Convert minutes since midnight to time string (HH:MM)
 */
function minutesToTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

/**
 * Calculate duration in minutes between two times
 */
function calculateDuration(from: string, to: string): number {
  const fromMinutes = timeToMinutes(from);
  let toMinutes = timeToMinutes(to);
  
  // Handle next day (e.g., 23:00 to 01:00)
  if (toMinutes < fromMinutes) {
    toMinutes += 24 * 60; // Add 24 hours
  }
  
  return toMinutes - fromMinutes;
}

/**
 * Merge overlapping time slots
 */
function mergeTimeSlots(slots: TimeSlot[]): TimeSlot[] {
  if (slots.length === 0) return [];
  
  // Sort by start time
  const sorted = [...slots].sort((a, b) => timeToMinutes(a.from) - timeToMinutes(b.from));
  const merged: TimeSlot[] = [sorted[0]];
  
  for (let i = 1; i < sorted.length; i++) {
    const current = sorted[i];
    const last = merged[merged.length - 1];
    
    const currentStart = timeToMinutes(current.from);
    const lastEnd = timeToMinutes(last.to);
    
    // Handle next day
    let adjustedLastEnd = lastEnd;
    if (adjustedLastEnd < timeToMinutes(last.from)) {
      adjustedLastEnd += 24 * 60;
    }
    
    if (currentStart <= adjustedLastEnd) {
      // Overlapping or adjacent, merge
      const currentEnd = timeToMinutes(current.to);
      let adjustedCurrentEnd = currentEnd;
      if (adjustedCurrentEnd < currentStart) {
        adjustedCurrentEnd += 24 * 60;
      }
      
      if (adjustedCurrentEnd > adjustedLastEnd) {
        last.to = current.to;
      }
    } else {
      // Not overlapping, add as new slot
      merged.push(current);
    }
  }
  
  return merged;
}

/**
 * Calculate total minutes covered by time slots
 */
function calculateTotalCovered(slots: TimeSlot[]): number {
  return slots.reduce((total, slot) => {
    return total + calculateDuration(slot.from, slot.to);
  }, 0);
}

/**
 * Calculate total minutes covered by time slots, deducting break time
 */
function calculateTotalCoveredWithBreaks(
  slots: TimeSlot[], 
  breakTimes: Array<{ start_time: string; end_time: string }>
): number {
  return slots.reduce((total, slot) => {
    const rawDuration = calculateDuration(slot.from, slot.to);
    const breakMinutes = calculateBreakTimeInMinutes(slot.from, slot.to, breakTimes);
    return total + (rawDuration - breakMinutes);
  }, 0);
}

/**
 * Validate that all employees have their full shift planned
 */
export async function validateEmployeeShiftPlanning(
  stageCode: string,
  shiftCode: string,
  planningDate: string
): Promise<ValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];

  try {
    // 1. Get shift information
    const { data: shiftData, error: shiftError } = await supabase
      .from('hr_shift_master')
      .select('shift_id, shift_name, start_time, end_time')
      .eq('shift_code', shiftCode)
      .eq('is_active', true)
      .eq('is_deleted', false)
      .maybeSingle();

    if (shiftError || !shiftData) {
      return {
        isValid: false,
        errors: [`Unable to fetch shift information for ${shiftCode}`],
        warnings: []
      };
    }

    const shiftStartTime = shiftData.start_time;
    const shiftEndTime = shiftData.end_time;
    const shiftId = shiftData.shift_id;
    
    // Fetch shift breaks
    const { data: shiftBreaks, error: breaksError } = await supabase
      .from('hr_shift_break_master')
      .select('start_time, end_time')
      .eq('shift_id', shiftId)
      .eq('is_active', true)
      .eq('is_deleted', false)
      .order('start_time', { ascending: true });

    if (breaksError) {
      console.error('Error fetching shift breaks:', breaksError);
    }

    // Calculate total break time
    const totalBreakMinutes = (shiftBreaks || []).reduce((total, breakTime) => {
      return total + calculateDuration(breakTime.start_time, breakTime.end_time);
    }, 0);

    // Total shift minutes (full duration, no break deduction)
    // Break time should only be deducted from work planned, not from shift time
    const totalShiftMinutes = calculateDuration(shiftStartTime, shiftEndTime);

    // 2. Get all employees assigned to this stage and shift who are marked as present
    const { data: employees, error: employeesError } = await supabase
      .from('hr_emp')
      .select('emp_id, emp_name, skill_short, shift_code')
      .eq('stage', stageCode)
      .eq('shift_code', shiftCode)
      .eq('is_active', true)
      .eq('is_deleted', false);

    if (employeesError) {
      return {
        isValid: false,
        errors: [`Error fetching employees: ${employeesError.message}`],
        warnings: []
      };
    }

    // 3. Get all employees recorded in planning attendance (both present and absent)
    const { data: plannedAttendance, error: presentError } = await supabase
      .from('prdn_planning_manpower')
      .select('emp_id, attendance_status')
      .eq('stage_code', stageCode)
      .eq('planning_date', planningDate)
      .eq('status', 'draft')
      .eq('is_deleted', false);

    if (presentError) {
      return {
        isValid: false,
        errors: [`Error fetching planned attendance: ${presentError.message}`],
        warnings: []
      };
    }

    const plannedEmpIds = new Set((plannedAttendance || []).map(e => e.emp_id));
    const presentEmpIds = new Set(
      (plannedAttendance || [])
        .filter(e => e.attendance_status === 'present')
        .map(e => e.emp_id)
    );

    // Check if all employees are recorded in planning attendance
    const employeesNotRecorded = (employees || []).filter(emp => !plannedEmpIds.has(emp.emp_id));
    if (employeesNotRecorded.length > 0) {
      const missingNames = employeesNotRecorded.map(e => `${e.emp_name} (${e.emp_id})`).join(', ');
      return {
        isValid: false,
        errors: [
          `Cannot Proceed. All employees in ${stageCode} must be recorded in planning attendance for ${planningDate}. ` +
          `Missing employees: ${missingNames}`
        ],
        warnings: []
      };
    }

    // 6. Get all stage reassignments TO this stage (to find employees reassigned here)
    const { data: reassignmentsTo, error: reassignToError } = await supabase
      .from('prdn_planning_stage_reassignment')
      .select('emp_id, hr_emp!inner(emp_id, emp_name, skill_short, shift_code)')
      .eq('to_stage_code', stageCode)
      .eq('planning_date', planningDate)
      .eq('status', 'draft')
      .eq('is_deleted', false)
      .eq('hr_emp.shift_code', shiftCode)
      .eq('hr_emp.is_active', true)
      .eq('hr_emp.is_deleted', false);

    if (reassignToError) {
      return {
        isValid: false,
        errors: [`Error fetching reassignments to stage: ${reassignToError.message}`],
        warnings: []
      };
    }

    const employeesToCheck = (employees || []).filter(emp => presentEmpIds.has(emp.emp_id));
    
    // Add employees reassigned TO this stage (they also need work planned)
    const reassignedEmployees = (reassignmentsTo || []).map(r => ({
      emp_id: r.emp_id,
      emp_name: r.hr_emp?.emp_name || r.emp_id,
      skill_short: r.hr_emp?.skill_short || '',
      shift_code: r.hr_emp?.shift_code || shiftCode
    }));
    
    // Merge employees, avoiding duplicates
    const allEmployeesToCheck = new Map<string, any>();
    employeesToCheck.forEach(emp => allEmployeesToCheck.set(emp.emp_id, emp));
    reassignedEmployees.forEach(emp => {
      if (!allEmployeesToCheck.has(emp.emp_id)) {
        allEmployeesToCheck.set(emp.emp_id, emp);
      }
    });

    if (allEmployeesToCheck.size === 0) {
      return {
        isValid: false,
        errors: [
          `Cannot Proceed. No employees marked as present for ${stageCode} shift ${shiftCode} on ${planningDate}. ` +
          `All employees must be recorded in planning attendance.`
        ],
        warnings: []
      };
    }

    // 4. Get all planned work for this stage and date
    const { data: plannedWorks, error: worksError } = await supabase
      .from('prdn_work_planning')
      .select('worker_id, from_time, to_time, derived_sw_code, other_work_code, wo_details_id')
      .eq('stage_code', stageCode)
      .eq('from_date', planningDate)
      .eq('status', 'draft')
      .eq('is_deleted', false);

    if (worksError) {
      return {
        isValid: false,
        errors: [`Error fetching planned works: ${worksError.message}`],
        warnings: []
      };
    }

    // Validation #3: All employees who have works in draft plan should be marked as present
    const workersWithPlannedWork = new Set((plannedWorks || []).map(w => w.worker_id).filter(Boolean));
    const workersNotPresent: string[] = [];
    
    for (const workerId of workersWithPlannedWork) {
      const attendance = (plannedAttendance || []).find(a => a.emp_id === workerId);
      if (!attendance || attendance.attendance_status !== 'present') {
        const employee = (employees || []).find(e => e.emp_id === workerId);
        const empName = employee?.emp_name || workerId;
        workersNotPresent.push(`${empName} (${workerId})`);
      }
    }
    
    if (workersNotPresent.length > 0) {
      errors.push(
        `Cannot Proceed. All employees with planned work must be marked as present in attendance. ` +
        `Missing or not marked as present: ${workersNotPresent.join(', ')}`
      );
    }

    // 5. Get all stage reassignments FROM this stage
    const { data: reassignmentsFrom, error: reassignFromError } = await supabase
      .from('prdn_planning_stage_reassignment')
      .select('emp_id, from_time, to_time')
      .eq('from_stage_code', stageCode)
      .eq('planning_date', planningDate)
      .eq('status', 'draft')
      .eq('is_deleted', false);

    if (reassignFromError) {
      return {
        isValid: false,
        errors: [`Error fetching reassignments from stage: ${reassignFromError.message}`],
        warnings: []
      };
    }

    // 7. Get all stage reassignments TO this stage (for time slot checking)
    const { data: reassignmentsToSlots, error: reassignToSlotsError } = await supabase
      .from('prdn_planning_stage_reassignment')
      .select('emp_id, from_time, to_time')
      .eq('to_stage_code', stageCode)
      .eq('planning_date', planningDate)
      .eq('status', 'draft')
      .eq('is_deleted', false);

    if (reassignToSlotsError) {
      return {
        isValid: false,
        errors: [`Error fetching reassignments to stage: ${reassignToSlotsError.message}`],
        warnings: []
      };
    }

    // 8. Validate each employee
    for (const employee of Array.from(allEmployeesToCheck.values())) {
      const empId = employee.emp_id;
      const empName = employee.emp_name;
      const isOriginallyAssigned = presentEmpIds.has(empId);

      // Get work planned for this employee at this stage
      const employeeWorks = (plannedWorks || []).filter(w => w.worker_id === empId);
      const workSlots: TimeSlot[] = employeeWorks.map(w => ({
        from: w.from_time,
        to: w.to_time
      }));

      // Get reassignments FROM this stage (employee is away)
      const reassignedAway = (reassignmentsFrom || []).filter(r => r.emp_id === empId);
      const awaySlots: TimeSlot[] = reassignedAway.map(r => ({
        from: r.from_time,
        to: r.to_time
      }));

      // Get reassignments TO this stage (employee is here)
      const reassignedHere = (reassignmentsToSlots || []).filter(r => r.emp_id === empId);
      const hereSlots: TimeSlot[] = reassignedHere.map(r => ({
        from: r.from_time,
        to: r.to_time
      }));

      if (isOriginallyAssigned) {
        // For employees originally assigned to this stage:
        // Their full shift must be covered by either work at this stage OR reassignment away
        
        // Merge work slots to avoid double-counting overlapping work plans
        const mergedWorkSlots = mergeTimeSlots(workSlots);
        const mergedAwaySlots = mergeTimeSlots(awaySlots);

        // Calculate work planned hours (raw time for coverage check, effective time for display)
        const workPlannedRawMinutes = calculateTotalCovered(mergedWorkSlots); // Raw time for coverage validation
        const workPlannedEffectiveMinutes = calculateTotalCoveredWithBreaks(mergedWorkSlots, shiftBreaks || []); // Effective time for display
        const reassignedAwayMinutes = calculateTotalCovered(mergedAwaySlots); // Reassignments don't need break deduction
        
        // Total covered = work planned (raw time) + reassigned away (raw time)
        // Compare against full shift duration (no break deduction)
        // Break time should NOT be deducted from coverage check - only from display
        const totalCoveredMinutes = workPlannedRawMinutes + reassignedAwayMinutes;

        // Check if full shift is covered
        if (totalCoveredMinutes < totalShiftMinutes) {
          const missingMinutes = totalShiftMinutes - totalCoveredMinutes;
          const missingHours = Math.floor(missingMinutes / 60);
          const missingMins = missingMinutes % 60;
          errors.push(
            `${empName} (${empId}): ${missingHours}h ${missingMins}m of shift time is not planned. ` +
            `Work planned: ${Math.round(workPlannedEffectiveMinutes / 60 * 10) / 10}h, ` +
            `Reassigned away: ${Math.round(reassignedAwayMinutes / 60 * 10) / 10}h`
          );
        }
      }

      // Check if employees reassigned TO this stage have work planned for that time
      // This applies to both originally assigned and reassigned employees
      for (const reassignment of reassignedHere) {
        const reassignStart = timeToMinutes(reassignment.from_time);
        const reassignEnd = timeToMinutes(reassignment.to_time);
        let adjustedReassignEnd = reassignEnd;
        if (adjustedReassignEnd < reassignStart) {
          adjustedReassignEnd += 24 * 60;
        }

        // Check if there's work planned during this reassignment period
        const hasWorkDuringReassignment = workSlots.some(workSlot => {
          const workStart = timeToMinutes(workSlot.from);
          const workEnd = timeToMinutes(workSlot.to);
          let adjustedWorkEnd = workEnd;
          if (adjustedWorkEnd < workStart) {
            adjustedWorkEnd += 24 * 60;
          }

          // Check for overlap (work overlaps with reassignment period)
          return !(adjustedWorkEnd <= reassignStart || workStart >= adjustedReassignEnd);
        });

        if (!hasWorkDuringReassignment) {
          errors.push(
            `${empName} (${empId}): Reassigned to ${stageCode} from ${reassignment.from_time} to ${reassignment.to_time}, ` +
            `but no work is planned for this period`
          );
        }
      }

      // Validation #7: Ensure that one worker is not engaged in 2 works at the same time
      // Check for overlapping time slots across different works for the same worker
      if (employeeWorks.length > 1) {
        // Sort works by start time
        const sortedWorks = [...employeeWorks].sort((a, b) => {
          const aStart = timeToMinutes(a.from_time);
          const bStart = timeToMinutes(b.from_time);
          return aStart - bStart;
        });

        // Check each pair of works for overlap
        for (let i = 0; i < sortedWorks.length - 1; i++) {
          const work1 = sortedWorks[i];
          const work2 = sortedWorks[i + 1];
          
          const work1Start = timeToMinutes(work1.from_time);
          const work1End = timeToMinutes(work1.to_time);
          let adjustedWork1End = work1End;
          if (adjustedWork1End < work1Start) {
            adjustedWork1End += 24 * 60;
          }

          const work2Start = timeToMinutes(work2.from_time);
          const work2End = timeToMinutes(work2.to_time);
          let adjustedWork2End = work2End;
          if (adjustedWork2End < work2Start) {
            adjustedWork2End += 24 * 60;
          }

          // Check for overlap (excluding adjacent slots where one ends exactly when another starts)
          const hasOverlap = !(adjustedWork1End <= work2Start || work1Start >= adjustedWork2End);
          const isAdjacent = (adjustedWork1End === work2Start) || (work1Start === adjustedWork2End);

          if (hasOverlap && !isAdjacent) {
            const work1Code = work1.derived_sw_code || work1.other_work_code || 'Unknown';
            const work2Code = work2.derived_sw_code || work2.other_work_code || 'Unknown';
            errors.push(
              `${empName} (${empId}): Overlapping work assignments detected. ` +
              `Work ${work1Code} (${work1.from_time}-${work1.to_time}) overlaps with ` +
              `Work ${work2Code} (${work2.from_time}-${work2.to_time})`
            );
            break; // Only report first overlap to avoid duplicate messages
          }
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  } catch (error) {
    return {
      isValid: false,
      errors: [`Validation error: ${(error as Error).message}`],
      warnings: []
    };
  }
}

