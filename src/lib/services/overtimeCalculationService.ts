/**
 * Overtime calculation service
 * Calculates overtime per worker per work chronologically
 */

import { supabase } from '$lib/supabaseClient';
import { calculateBreakTimeInMinutes } from '$lib/utils/breakTimeUtils';

export interface OvertimeWork {
  reportingId: number;
  planningId: number;
  workCode: string;
  workName: string;
  fromTime: string;
  toTime: string;
  hoursWorkedToday: number;
  overtimeMinutes: number;
  overtimeAmount: number;
}

export interface WorkerOvertime {
  workerId: string;
  workerName: string;
  shiftCode: string;
  shiftStartTime: string;
  shiftEndTime: string;
  breakTimes: Array<{ start_time: string; end_time: string }>;
  totalWorkedMinutes: number;
  shiftMinutes: number;
  breakMinutes: number;
  availableWorkMinutes: number;
  overtimeMinutes: number;
  overtimeAmount: number;
  works: OvertimeWork[];
}

export interface OvertimeCalculationResult {
  hasOvertime: boolean;
  workers: WorkerOvertime[];
  errors: string[];
}

/**
 * Convert time string (HH:MM or HH:MM:SS) to minutes since midnight
 */
function timeToMinutes(timeStr: string): number {
  if (!timeStr) return 0;
  const parts = timeStr.split(':');
  const hours = parseInt(parts[0] || '0', 10);
  const minutes = parseInt(parts[1] || '0', 10);
  return hours * 60 + minutes;
}

/**
 * Convert minutes to time string (HH:MM)
 */
function minutesToTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
}

/**
 * Calculate overtime for all workers in a stage on a given date
 */
export async function calculateOvertime(
  stageCode: string,
  reportingDate: string
): Promise<OvertimeCalculationResult> {
  const errors: string[] = [];
  const workers: WorkerOvertime[] = [];

  try {
    // Ensure date is in YYYY-MM-DD format
    const dateStr = reportingDate.includes('T') ? reportingDate.split('T')[0] : reportingDate;

    // 1. Get all work reports for this stage and date (both draft and pending_approval)
    // When submitting, we need to check OT for all reports regardless of status
    const { data: draftReports, error: reportsError } = await supabase
      .from('prdn_work_reporting')
      .select(`
        id,
        planning_id,
        worker_id,
        from_time,
        to_time,
        hours_worked_today,
        prdn_work_planning!inner(
          stage_code,
          derived_sw_code,
          other_work_code,
          std_work_type_details(
            derived_sw_code,
            std_work_details(sw_name)
          )
        ),
        hr_emp!inner(
          emp_id,
          emp_name,
          shift_code
        )
      `)
      .eq('from_date', dateStr)
      .in('status', ['draft', 'pending_approval'])
      .eq('is_deleted', false)
      .eq('prdn_work_planning.stage_code', stageCode);

    if (reportsError) {
      errors.push(`Error fetching draft reports: ${reportsError.message}`);
      return { hasOvertime: false, workers: [], errors };
    }

    if (!draftReports || draftReports.length === 0) {
      return { hasOvertime: false, workers: [], errors: [] };
    }

    // 2. Group reports by worker
    const reportsByWorker = new Map<string, any[]>();
    draftReports.forEach((report: any) => {
      const workerId = report.worker_id;
      if (!reportsByWorker.has(workerId)) {
        reportsByWorker.set(workerId, []);
      }
      reportsByWorker.get(workerId)!.push(report);
    });

    // 3. Get unique shift codes and fetch shift details
    const uniqueShiftCodes = new Set<string>();
    const workerShiftMap = new Map<string, string>();
    
    draftReports.forEach((report: any) => {
      const shiftCode = report.hr_emp?.shift_code;
      if (shiftCode) {
        uniqueShiftCodes.add(shiftCode);
        workerShiftMap.set(report.worker_id, shiftCode);
      }
    });

    // Fetch shift details (start time, end time, break times)
    const shiftDetailsMap = new Map<string, {
      shiftStartTime: string;
      shiftEndTime: string;
      breakTimes: Array<{ start_time: string; end_time: string }>;
    }>();

    for (const shiftCode of uniqueShiftCodes) {
      const { data: shiftData, error: shiftError } = await supabase
        .from('hr_shift_master')
        .select('shift_id, start_time, end_time')
        .eq('shift_code', shiftCode)
        .eq('is_active', true)
        .eq('is_deleted', false)
        .maybeSingle();

      if (shiftError || !shiftData) {
        errors.push(`Error fetching shift details for ${shiftCode}: ${shiftError?.message || 'Shift not found'}`);
        continue;
      }

      const { data: breaksData, error: breaksError } = await supabase
        .from('hr_shift_break_master')
        .select('start_time, end_time')
        .eq('shift_id', shiftData.shift_id)
        .eq('is_active', true)
        .eq('is_deleted', false)
        .order('start_time', { ascending: true });

      if (breaksError) {
        errors.push(`Error fetching break times for ${shiftCode}: ${breaksError.message}`);
        continue;
      }

      shiftDetailsMap.set(shiftCode, {
        shiftStartTime: shiftData.start_time,
        shiftEndTime: shiftData.end_time,
        breakTimes: breaksData || []
      });
    }

    // 4. Calculate overtime for each worker
    for (const [workerId, workerReports] of reportsByWorker.entries()) {
      const shiftCode = workerShiftMap.get(workerId);
      if (!shiftCode) {
        errors.push(`Worker ${workerId} has no shift code assigned`);
        continue;
      }

      const shiftDetails = shiftDetailsMap.get(shiftCode);
      if (!shiftDetails) {
        errors.push(`Shift details not found for worker ${workerId} (shift: ${shiftCode})`);
        continue;
      }

      const workerName = workerReports[0]?.hr_emp?.emp_name || workerId;

      // Sort reports chronologically by from_time
      const sortedReports = [...workerReports].sort((a, b) => {
        return timeToMinutes(a.from_time) - timeToMinutes(b.from_time);
      });

      // Calculate total worked time (chronologically)
      let totalWorkedMinutes = 0;
      const workSlots: Array<{ from: string; to: string; report: any }> = [];

      sortedReports.forEach((report: any) => {
        const fromMinutes = timeToMinutes(report.from_time);
        const toMinutes = timeToMinutes(report.to_time);
        
        // Handle overnight shifts
        let workDurationMinutes = toMinutes - fromMinutes;
        if (workDurationMinutes < 0) {
          workDurationMinutes += 24 * 60; // Add 24 hours for overnight
        }

        // Use hours_worked_today if available, otherwise calculate from time range
        const workedMinutes = report.hours_worked_today 
          ? Math.round(report.hours_worked_today * 60)
          : workDurationMinutes;

        totalWorkedMinutes += workedMinutes;
        workSlots.push({
          from: report.from_time,
          to: report.to_time,
          report
        });
      });

      // Calculate shift time (excluding breaks)
      const shiftStartMinutes = timeToMinutes(shiftDetails.shiftStartTime);
      const shiftEndMinutes = timeToMinutes(shiftDetails.shiftEndTime);
      let shiftDurationMinutes = shiftEndMinutes - shiftStartMinutes;
      if (shiftDurationMinutes < 0) {
        shiftDurationMinutes += 24 * 60; // Overnight shift
      }

      // Calculate total break time in shift
      const totalBreakMinutes = calculateBreakTimeInMinutes(
        shiftDetails.shiftStartTime,
        shiftDetails.shiftEndTime,
        shiftDetails.breakTimes
      );

      const availableWorkMinutes = shiftDurationMinutes - totalBreakMinutes;

      // Check if overtime exists
      if (totalWorkedMinutes <= availableWorkMinutes) {
        // No overtime
        continue;
      }

      const overtimeMinutes = totalWorkedMinutes - availableWorkMinutes;

      // 5. Identify which works were done in overtime (chronologically)
      // We need to find where the shift time ends and calculate OT for works after that
      let cumulativeWorkedMinutes = 0;
      const overtimeWorks: OvertimeWork[] = [];
      let overtimeStartIndex = -1;

      // Find where overtime starts
      for (let i = 0; i < sortedReports.length; i++) {
        const report = sortedReports[i];
        const workedMinutes = report.hours_worked_today 
          ? Math.round(report.hours_worked_today * 60)
          : (timeToMinutes(report.to_time) - timeToMinutes(report.from_time));

        if (cumulativeWorkedMinutes + workedMinutes > availableWorkMinutes) {
          overtimeStartIndex = i;
          break;
        }
        cumulativeWorkedMinutes += workedMinutes;
      }

      // Calculate OT for each work that extends into overtime
      if (overtimeStartIndex >= 0) {
        let remainingOvertimeMinutes = overtimeMinutes;

        for (let i = overtimeStartIndex; i < sortedReports.length; i++) {
          const report = sortedReports[i];
          const workedMinutes = report.hours_worked_today 
            ? Math.round(report.hours_worked_today * 60)
            : (timeToMinutes(report.to_time) - timeToMinutes(report.from_time));

          let workOvertimeMinutes = 0;

          if (i === overtimeStartIndex) {
            // First work in OT: calculate how much of it is OT
            const workMinutesBeforeOT = availableWorkMinutes - cumulativeWorkedMinutes;
            workOvertimeMinutes = workedMinutes - workMinutesBeforeOT;
          } else {
            // Subsequent works: all are OT
            workOvertimeMinutes = workedMinutes;
          }

          // Distribute remaining OT proportionally if multiple works extend beyond shift
          if (remainingOvertimeMinutes > 0 && workOvertimeMinutes > 0) {
            // Ensure we don't exceed total OT
            workOvertimeMinutes = Math.min(workOvertimeMinutes, remainingOvertimeMinutes);
            remainingOvertimeMinutes -= workOvertimeMinutes;

            // Get work details
            const workCode = report.prdn_work_planning?.derived_sw_code 
              || report.prdn_work_planning?.other_work_code 
              || 'N/A';
            const workName = report.prdn_work_planning?.std_work_type_details?.std_work_details?.sw_name || 'N/A';

            // Calculate OT amount (will be calculated later with employee salary)
            overtimeWorks.push({
              reportingId: report.id,
              planningId: report.planning_id,
              workCode,
              workName,
              fromTime: report.from_time,
              toTime: report.to_time,
              hoursWorkedToday: report.hours_worked_today || 0,
              overtimeMinutes: workOvertimeMinutes,
              overtimeAmount: 0 // Will be calculated later
            });
          }
        }
      }

      // 6. Calculate OT amount for each work
      // Get employee salary/basic_da
      const { data: empData, error: empError } = await supabase
        .from('hr_emp')
        .select('basic_da, salary')
        .eq('emp_id', workerId)
        .eq('is_active', true)
        .eq('is_deleted', false)
        .maybeSingle();

      if (empError || !empData) {
        errors.push(`Error fetching employee salary for ${workerId}: ${empError?.message || 'Employee not found'}`);
        continue;
      }

      // Get number of days in reporting month
      const reportingDateObj = new Date(dateStr);
      const year = reportingDateObj.getFullYear();
      const month = reportingDateObj.getMonth() + 1;
      const daysInMonth = new Date(year, month, 0).getDate();

      // Calculate OT rate per minute (overtime is paid at double the regular rate)
      const monthlySalary = empData.basic_da || empData.salary || 0;
      const otRatePerMinute = (monthlySalary / daysInMonth / 480) * 2; // 480 minutes = 8 hours, × 2 for double rate

      // Calculate OT amount for each work
      let totalOvertimeAmount = 0;
      overtimeWorks.forEach(work => {
        work.overtimeAmount = Math.round((work.overtimeMinutes * otRatePerMinute) * 100) / 100;
        totalOvertimeAmount += work.overtimeAmount;
      });
      
      // Round total overtime amount
      totalOvertimeAmount = Math.round(totalOvertimeAmount * 100) / 100;

      workers.push({
        workerId,
        workerName,
        shiftCode,
        shiftStartTime: shiftDetails.shiftStartTime,
        shiftEndTime: shiftDetails.shiftEndTime,
        breakTimes: shiftDetails.breakTimes,
        totalWorkedMinutes,
        shiftMinutes: shiftDurationMinutes,
        breakMinutes: totalBreakMinutes,
        availableWorkMinutes,
        overtimeMinutes,
        overtimeAmount: Math.round(totalOvertimeAmount * 100) / 100,
        works: overtimeWorks
      });
    }

    return {
      hasOvertime: workers.length > 0,
      workers,
      errors
    };
  } catch (error) {
    errors.push(`Error calculating overtime: ${(error as Error).message}`);
    return { hasOvertime: false, workers: [], errors };
  }
}

