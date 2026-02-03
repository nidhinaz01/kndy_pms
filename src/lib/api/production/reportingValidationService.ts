import { supabase } from '$lib/supabaseClient';
import { calculateBreakTimeInMinutes } from '$lib/utils/breakTimeUtils';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Calculate duration in minutes between two time strings (HH:MM:SS format)
 */
function calculateDuration(startTime: string, endTime: string): number {
  const [startHour, startMin, startSec = 0] = startTime.split(':').map(Number);
  const [endHour, endMin, endSec = 0] = endTime.split(':').map(Number);
  
  const startMinutes = startHour * 60 + startMin + startSec / 60;
  let endMinutes = endHour * 60 + endMin + endSec / 60;
  
  // Handle overnight shifts
  if (endMinutes < startMinutes) {
    endMinutes += 24 * 60;
  }
  
  return endMinutes - startMinutes;
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

    if (!reportedAttendance || reportedAttendance.length === 0) {
      return {
        isValid: true,
        errors: [],
        warnings: []
      };
    }

    // 3. Get all reported work for these employees
    const presentEmpIds = reportedAttendance.map(a => a.emp_id);
    
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
      .in('worker_id', presentEmpIds)
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

    // 5. Validate each employee
    reportedAttendance.forEach(attendance => {
      const empId = attendance.emp_id;
      const empName = (attendance.hr_emp as any)?.emp_name || empId;
      const actualHours = attendance.actual_hours;
      
      // Get reported work hours for this employee
      const reportedHours = reportedHoursByEmployee.get(empId) || 0;
      
      // Check if attendance is marked as present but no work is reported
      if (reportedHours === 0 && attendance.attendance_status === 'present') {
        errors.push(
          `${empName}: Attendance is marked as 'Present' but no work has been reported.`
        );
        return; // Skip further checks for this employee
      }
      
      // Check if attendance hours are specified
      if (actualHours !== null && actualHours !== undefined && actualHours > 0) {
        // Check if reported hours < attendance hours
        if (reportedHours < actualHours) {
          const deviationHours = actualHours - reportedHours;
          // Format deviation nicely
          const hours = Math.floor(deviationHours);
          const minutes = Math.round((deviationHours % 1) * 60);
          let deviationText = '';
          if (hours > 0 && minutes > 0) {
            deviationText = `${hours}h ${minutes}m`;
          } else if (hours > 0) {
            deviationText = `${hours}h`;
          } else {
            deviationText = `${minutes}m`;
          }
          
          // Format actual hours nicely
          const actualHoursFormatted = actualHours >= 1 
            ? `${Math.floor(actualHours)}h ${Math.round((actualHours % 1) * 60)}m`
            : `${Math.round(actualHours * 60)}m`;
          
          // Format reported hours nicely
          const reportedHoursFormatted = reportedHours >= 1 
            ? `${Math.floor(reportedHours)}h ${Math.round((reportedHours % 1) * 60)}m`
            : `${Math.round(reportedHours * 60)}m`;
          
          errors.push(
            `${empName}: Attendance is marked for ${actualHoursFormatted}, but only ${reportedHoursFormatted} of work is reported. ` +
            `Missing ${deviationText} of work reporting.`
          );
        }
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
