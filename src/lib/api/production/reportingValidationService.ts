import { supabase } from '$lib/supabaseClient';
import { calculateBreakTimeInMinutes } from '$lib/utils/breakTimeUtils';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Calculate duration in minutes between two time strings (HH:MM or HH:MM:SS; seconds ignored)
 */
function calculateDuration(startTime: string, endTime: string): number {
  const [startHour, startMin] = startTime.split(':').map(Number);
  const [endHour, endMin] = endTime.split(':').map(Number);
  
  const startMinutes = startHour * 60 + startMin;
  let endMinutes = endHour * 60 + endMin;
  
  // Handle overnight shifts
  if (endMinutes < startMinutes) {
    endMinutes += 24 * 60;
  }
  
  return endMinutes - startMinutes;
}

/**
 * Compute reassignment hours for one row (Option B: duration minus break overlap)
 */
function reassignmentHours(
  fromTime: string,
  toTime: string,
  shiftBreaks: Array<{ start_time: string; end_time: string }>
): number {
  if (!fromTime || !toTime) return 0;
  const totalMinutes = calculateDuration(fromTime, toTime);
  const breakMinutes = calculateBreakTimeInMinutes(fromTime, toTime, shiftBreaks || []);
  return Math.max(0, totalMinutes - breakMinutes) / 60;
}

/**
 * Validate that reported work hours match attendance hours
 */
export async function validateEmployeeShiftReporting(
  stageCode: string,
  shiftCode: string,
  reportingDate: string
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

    // 2. Get all employees with attendance marked as 'present' in reporting
    const { data: reportedAttendance, error: attendanceError } = await supabase
      .from('prdn_reporting_manpower')
      .select(`
        emp_id,
        attendance_status,
        actual_hours,
        from_time,
        to_time,
        hr_emp!inner(
          emp_id,
          emp_name,
          skill_short,
          shift_code,
          stage
        )
      `)
      .eq('stage_code', stageCode)
      .eq('reporting_date', reportingDate)
      .eq('attendance_status', 'present')
      .in('status', ['draft', 'pending_approval', 'approved'])
      .eq('is_deleted', false)
      .eq('hr_emp.shift_code', shiftCode)
      .eq('hr_emp.is_active', true)
      .eq('hr_emp.is_deleted', false);

    if (attendanceError) {
      return {
        isValid: false,
        errors: [`Error fetching reported attendance: ${attendanceError.message}`],
        warnings: []
      };
    }

    const presentEmpIds = reportedAttendance?.map(a => a.emp_id) ?? [];

    // 3. Fetch stage reassignments for this stage and date (from or to this stage)
    const { data: reassignmentRows, error: reassignError } = await supabase
      .from('prdn_reporting_stage_reassignment')
      .select('emp_id, from_stage_code, to_stage_code, from_time, to_time')
      .or(`from_stage_code.eq.${stageCode},to_stage_code.eq.${stageCode}`)
      .eq('reassignment_date', reportingDate)
      .eq('is_deleted', false);

    if (reassignError) {
      return {
        isValid: false,
        errors: [`Error fetching stage reassignments: ${reassignError.message}`],
        warnings: []
      };
    }

    const reassignments = reassignmentRows ?? [];

    // Per-employee hours reassigned away from this stage (Option B: duration minus breaks)
    const hoursReassignedAway = new Map<string, number>();
    const hoursReassignedInto = new Map<string, number>();
    const reassignedIntoEmpIds = new Set<string>();

    reassignments.forEach((row: { emp_id: string; from_stage_code: string; to_stage_code: string; from_time: string; to_time: string }) => {
      const empId = row.emp_id;
      const hours = reassignmentHours(row.from_time, row.to_time, shiftBreaks || []);
      if (row.from_stage_code === stageCode) {
        hoursReassignedAway.set(empId, (hoursReassignedAway.get(empId) ?? 0) + hours);
      }
      if (row.to_stage_code === stageCode) {
        hoursReassignedInto.set(empId, (hoursReassignedInto.get(empId) ?? 0) + hours);
        reassignedIntoEmpIds.add(empId);
      }
    });

    // No home employees and no one reassigned into this stage => nothing to validate
    if (presentEmpIds.length === 0 && reassignedIntoEmpIds.size === 0) {
      return {
        isValid: true,
        errors: [],
        warnings: []
      };
    }

    // 4. Get reported work for home employees + anyone reassigned into this stage
    const workerIds = [...new Set([...presentEmpIds, ...reassignedIntoEmpIds])];

    const { data: reportedWorks, error: worksError } = await supabase
      .from('prdn_work_reporting')
      .select(`
        id,
        worker_id,
        from_time,
        to_time,
        hours_worked_today,
        prdn_work_planning!inner(stage_code)
      `)
      .in('worker_id', workerIds)
      .eq('from_date', reportingDate)
      .in('status', ['draft', 'pending_approval', 'approved'])
      .eq('is_deleted', false)
      .eq('prdn_work_planning.stage_code', stageCode);

    if (worksError) {
      return {
        isValid: false,
        errors: [`Error fetching reported works: ${worksError.message}`],
        warnings: []
      };
    }

    // 4. Calculate total reported hours per employee (with break deduction)
    const reportedHoursByEmployee = new Map<string, number>();
    
    (reportedWorks || []).forEach(work => {
      const empId = work.worker_id;
      let hours = 0;
      
      if (work.from_time && work.to_time) {
        // Calculate from time range, deducting breaks
        const totalMinutes = calculateDuration(work.from_time, work.to_time);
        const breakMinutes = calculateBreakTimeInMinutes(work.from_time, work.to_time, shiftBreaks || []);
        hours = (totalMinutes - breakMinutes) / 60;
      } else if (work.hours_worked_today) {
        // Use stored hours if time range is not available
        hours = work.hours_worked_today;
      }
      
      const currentHours = reportedHoursByEmployee.get(empId) || 0;
      reportedHoursByEmployee.set(empId, currentHours + hours);
    });

    // 5. Validate home employees: reported (this stage) + hours reassigned away >= actual hours
    (reportedAttendance || []).forEach(attendance => {
      const empId = attendance.emp_id;
      const empName = (attendance.hr_emp as any)?.emp_name || empId;
      const actualHours = attendance.actual_hours;
      const reportedHours = reportedHoursByEmployee.get(empId) ?? 0;
      const hoursAway = hoursReassignedAway.get(empId) ?? 0;
      const reportedPlusAway = reportedHours + hoursAway;

      if (reportedHours === 0 && hoursAway === 0 && attendance.attendance_status === 'present') {
        errors.push(
          `${empName}: Attendance is marked as 'Present' but no work has been reported.`
        );
        return;
      }

      if (actualHours !== null && actualHours !== undefined && actualHours > 0) {
        if (reportedPlusAway < actualHours) {
          const deviationHours = actualHours - reportedPlusAway;
          const hours = Math.floor(deviationHours);
          const minutes = Math.round((deviationHours % 1) * 60);
          const deviationText = hours > 0 && minutes > 0 ? `${hours}h ${minutes}m` : hours > 0 ? `${hours}h` : `${minutes}m`;
          const actualHoursFormatted = actualHours >= 1
            ? `${Math.floor(actualHours)}h ${Math.round((actualHours % 1) * 60)}m`
            : `${Math.round(actualHours * 60)}m`;
          const reportedFormatted = reportedPlusAway >= 1
            ? `${Math.floor(reportedPlusAway)}h ${Math.round((reportedPlusAway % 1) * 60)}m`
            : `${Math.round(reportedPlusAway * 60)}m`;
          errors.push(
            `${empName}: Attendance is marked for ${actualHoursFormatted} (reported here ${reportedHours >= 1 ? `${Math.floor(reportedHours)}h ${Math.round((reportedHours % 1) * 60)}m` : `${Math.round(reportedHours * 60)}m`} + ${hoursAway >= 1 ? `${Math.floor(hoursAway)}h ${Math.round((hoursAway % 1) * 60)}m` : `${Math.round(hoursAway * 60)}m`} reassigned away). ` +
            `Total ${reportedFormatted} is less than required; missing ${deviationText} of work reporting.`
          );
        }
      }
    });

    // 6. Validate incoming reassignments: reported (this stage) >= hours reassigned into this stage
    const empNameByEmpId = new Map<string, string>();
    (reportedAttendance || []).forEach(a => {
      const name = (a.hr_emp as any)?.emp_name;
      if (name) empNameByEmpId.set(a.emp_id, name);
    });
    hoursReassignedInto.forEach((hoursIn, empId) => {
      if (hoursIn <= 0) return;
      const reportedHours = reportedHoursByEmployee.get(empId) ?? 0;
      if (reportedHours < hoursIn) {
        const empName = empNameByEmpId.get(empId) ?? `Employee ${empId}`;
        const deviationHours = hoursIn - reportedHours;
        const hours = Math.floor(deviationHours);
        const minutes = Math.round((deviationHours % 1) * 60);
        const deviationText = hours > 0 && minutes > 0 ? `${hours}h ${minutes}m` : hours > 0 ? `${hours}h` : `${minutes}m`;
        const requiredFormatted = hoursIn >= 1
          ? `${Math.floor(hoursIn)}h ${Math.round((hoursIn % 1) * 60)}m`
          : `${Math.round(hoursIn * 60)}m`;
        const reportedFormatted = reportedHours >= 1
          ? `${Math.floor(reportedHours)}h ${Math.round((reportedHours % 1) * 60)}m`
          : `${Math.round(reportedHours * 60)}m`;
        errors.push(
          `${empName}: Reassigned into this stage for ${requiredFormatted}, but only ${reportedFormatted} of work is reported here. Missing ${deviationText}.`
        );
      }
    });

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  } catch (error) {
    console.error('Error validating employee shift reporting:', error);
    return {
      isValid: false,
      errors: [(error as Error).message || 'Unknown error occurred'],
      warnings: []
    };
  }
}
