/**
 * Overtime calculation service
 * Calculates overtime per worker per work chronologically.
 *
 * Draft reporting OT: work that falls in the wall-clock window
 *   [ max(shift end, C-Off end), attendance end ]
 * intersected with each worker's attendance span from prdn_reporting_manpower
 * (reporting_from_date/from_time → reporting_to_date/to_time), anchored on the reporting date.
 */

import { supabase } from '$lib/supabaseClient';
import { calculateBreakTimeInMinutes } from '$lib/utils/breakTimeUtils';
import { getAttendanceWallWindowMs, parseWallDateTimeMs } from '$lib/utils/attendanceCOffSpanUtils';

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
  /** Wall-clock minutes where OT can accrue (after shift & C-Off, inside attendance); optional for UI. */
  otAccrualWindowMinutes?: number;
  overtimeMinutes: number;
  overtimeAmount: number;
  works: OvertimeWork[];
}

export interface OvertimeCalculationResult {
  hasOvertime: boolean;
  workers: WorkerOvertime[];
  errors: string[];
}

export type CalculateOvertimeOptions = {
  /** When set and non-empty, only these workers' draft reports are loaded and OT is computed for them only. */
  workerIdsOnly?: readonly string[] | null;
};

/**
 * Employees with declared work-report OT on reporting manpower (draft / pending_approval, date in span).
 * Submit-time OT gates use this list so OT is not calculated for the whole crew.
 */
export async function getReportingManpowerOtEmpIds(
  stageCode: string,
  reportingDate: string,
  shiftCode: string
): Promise<string[]> {
  const dateStr = reportingDate.includes('T') ? reportingDate.split('T')[0] : reportingDate;
  const { data, error } = await supabase
    .from('prdn_reporting_manpower')
    .select('emp_id, ot_hours')
    .eq('stage_code', stageCode)
    .eq('shift_code', shiftCode)
    .lte('reporting_from_date', dateStr)
    .gte('reporting_to_date', dateStr)
    .in('status', ['draft', 'pending_approval'])
    .eq('is_deleted', false)
    .not('ot_hours', 'is', null)
    .gt('ot_hours', 0);

  if (error) {
    console.warn('getReportingManpowerOtEmpIds:', error.message);
    return [];
  }
  const ids = new Set<string>();
  for (const row of data || []) {
    const id = (row as { emp_id?: string }).emp_id;
    const h = Number((row as { ot_hours?: unknown }).ot_hours);
    if (id && Number.isFinite(h) && h > 0) ids.add(id);
  }
  return Array.from(ids);
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

function normalizeDateStr(d: string | null | undefined): string {
  return (d || '').split('T')[0].trim();
}

function timeHm(t: string | null | undefined): string {
  if (t == null || t === '') return '';
  return String(t).trim().substring(0, 5);
}

/** Overlap length in minutes between two [startMs, endMs] intervals (inclusive start, exclusive end style via ms diff). */
function intersectionWallMinutes(startA: number, endA: number, startB: number, endB: number): number {
  const s = Math.max(startA, startB);
  const e = Math.min(endA, endB);
  return Math.max(0, (e - s) / 60000);
}

type ReportingManpowerRow = {
  emp_id: string;
  attendance_status?: string | null;
  reporting_from_date?: string | null;
  reporting_to_date?: string | null;
  from_time?: string | null;
  to_time?: string | null;
  c_off_value?: number | string | null;
  c_off_from_date?: string | null;
  c_off_from_time?: string | null;
  c_off_to_date?: string | null;
  c_off_to_time?: string | null;
};

/**
 * Calculate overtime for workers in a stage on a given date.
 * Pass `options.workerIdsOnly` to limit to employees with declared OT on reporting manpower (faster submit gates).
 */
export async function calculateOvertime(
  stageCode: string,
  reportingDate: string,
  shiftCode: string,
  options?: CalculateOvertimeOptions
): Promise<OvertimeCalculationResult> {
  const errors: string[] = [];
  const workers: WorkerOvertime[] = [];

  try {
    // Ensure date is in YYYY-MM-DD format
    const dateStr = reportingDate.includes('T') ? reportingDate.split('T')[0] : reportingDate;

    const onlyIds = options?.workerIdsOnly;
    if (onlyIds != null && onlyIds.length === 0) {
      return { hasOvertime: false, workers: [], errors: [] };
    }

    // 1. Get all work reports for this stage and date (paginated to avoid 1000-row limit)
    const PAGE_SIZE = 1000;
    const draftReports: any[] = [];
    let offset = 0;
    let hasMore = true;
    while (hasMore) {
      let reportsQuery = supabase
        .from('prdn_work_reporting')
        .select(`
          id,
          planning_id,
          worker_id,
          from_date,
          to_date,
          from_time,
          to_time,
          hours_worked_today,
          prdn_work_planning!inner(
            stage_code,
            shift_code,
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
        .eq('prdn_work_planning.stage_code', stageCode)
        .eq('prdn_work_planning.shift_code', shiftCode)
        .order('id')
        .range(offset, offset + PAGE_SIZE - 1);

      if (onlyIds && onlyIds.length > 0) {
        reportsQuery = reportsQuery.in('worker_id', [...onlyIds]);
      }

      const { data: page, error: reportsError } = await reportsQuery;

      if (reportsError) {
        errors.push(`Error fetching draft reports: ${reportsError.message}`);
        return { hasOvertime: false, workers: [], errors };
      }
      const rows = page || [];
      draftReports.push(...rows);
      hasMore = rows.length === PAGE_SIZE;
      offset += PAGE_SIZE;
    }

    if (draftReports.length === 0) {
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

    const workerIdsList = Array.from(reportsByWorker.keys());
    const manpowerByEmp = new Map<string, ReportingManpowerRow>();
    if (workerIdsList.length > 0) {
      const { data: mpRows, error: mpErr } = await supabase
        .from('prdn_reporting_manpower')
        .select(
          'emp_id, attendance_status, reporting_from_date, from_time, reporting_to_date, to_time, c_off_value, c_off_from_date, c_off_from_time, c_off_to_date, c_off_to_time'
        )
        .eq('stage_code', stageCode)
        .eq('shift_code', shiftCode)
        .lte('reporting_from_date', dateStr)
        .gte('reporting_to_date', dateStr)
        .in('status', ['draft', 'pending_approval'])
        .eq('is_deleted', false)
        .in('emp_id', workerIdsList);

      if (mpErr) {
        errors.push(`Error fetching reporting manpower: ${mpErr.message}`);
      } else {
        (mpRows || []).forEach((r: ReportingManpowerRow) => manpowerByEmp.set(r.emp_id, r));
      }
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

      const sortedReports = [...workerReports].sort((a, b) => {
        return timeToMinutes(a.from_time) - timeToMinutes(b.from_time);
      });

      let totalWorkedMinutes = 0;
      sortedReports.forEach((report: any) => {
        const fromMinutes = timeToMinutes(report.from_time);
        const toMinutes = timeToMinutes(report.to_time);
        let workDurationMinutes = toMinutes - fromMinutes;
        if (workDurationMinutes < 0) {
          workDurationMinutes += 24 * 60;
        }
        const workedMinutes = report.hours_worked_today
          ? Math.round(report.hours_worked_today * 60)
          : workDurationMinutes;
        totalWorkedMinutes += workedMinutes;
      });

      const shiftStartMinutes = timeToMinutes(shiftDetails.shiftStartTime);
      const shiftEndMinutes = timeToMinutes(shiftDetails.shiftEndTime);
      let shiftDurationMinutes = shiftEndMinutes - shiftStartMinutes;
      if (shiftDurationMinutes < 0) {
        shiftDurationMinutes += 24 * 60;
      }

      const totalBreakMinutes = calculateBreakTimeInMinutes(
        shiftDetails.shiftStartTime,
        shiftDetails.shiftEndTime,
        shiftDetails.breakTimes
      );

      const availableWorkMinutes = shiftDurationMinutes - totalBreakMinutes;

      let overtimeWorks: OvertimeWork[] = [];
      let overtimeMinutes = 0;
      let otAccrualWindowMinutes: number | undefined;
      let availableWorkMinutesDisplay = availableWorkMinutes;

      const mp = manpowerByEmp.get(workerId);
      /** Present worker with a parsable attendance wall window — OT is derived from this, not legacy shift totals. */
      let reportingRulesApply = false;
      let reportingOtMinutesAtLeastOne = false;

      if (mp && mp.attendance_status === 'present' && mp.from_time && mp.to_time) {
        const att = getAttendanceWallWindowMs({
          attendanceFromDate: normalizeDateStr(String(mp.reporting_from_date)),
          attendanceToDate: normalizeDateStr(String(mp.reporting_to_date || mp.reporting_from_date)),
          attendanceFromTime: timeHm(String(mp.from_time)),
          attendanceToTime: timeHm(String(mp.to_time))
        });

        if (att) {
          reportingRulesApply = true;
          const ss = timeHm(shiftDetails.shiftStartTime);
          const se = timeHm(shiftDetails.shiftEndTime);
          const shiftStartMs = parseWallDateTimeMs(dateStr, ss);
          let shiftEndMs = parseWallDateTimeMs(dateStr, se);
          if (shiftStartMs != null && shiftEndMs != null && shiftEndMs <= shiftStartMs) {
            shiftEndMs += 86400000;
          }

          let otAccrualStartMs: number | null = shiftEndMs;
          const coffVal = Number(mp.c_off_value);
          if (
            Number.isFinite(coffVal) &&
            coffVal > 0 &&
            mp.c_off_from_date &&
            mp.c_off_from_time &&
            mp.c_off_to_date &&
            mp.c_off_to_time
          ) {
            const coff = getAttendanceWallWindowMs({
              attendanceFromDate: normalizeDateStr(String(mp.c_off_from_date)),
              attendanceToDate: normalizeDateStr(String(mp.c_off_to_date || mp.c_off_from_date)),
              attendanceFromTime: timeHm(String(mp.c_off_from_time)),
              attendanceToTime: timeHm(String(mp.c_off_to_time))
            });
            if (coff && shiftEndMs != null) {
              otAccrualStartMs = Math.max(shiftEndMs, coff.endMs);
            }
          }

          if (shiftEndMs != null && otAccrualStartMs != null) {
            const otWinStartMs = Math.max(att.startMs, otAccrualStartMs);
            const otWinEndMs = att.endMs;
            if (otWinStartMs < otWinEndMs) {
              otAccrualWindowMinutes = (otWinEndMs - otWinStartMs) / 60000;
              availableWorkMinutesDisplay = otAccrualWindowMinutes;

              for (const report of sortedReports) {
                const repFromDate = normalizeDateStr(String(report.from_date || dateStr));
                const repToDate = normalizeDateStr(
                  String(report.to_date || report.from_date || dateStr)
                );
                const repWin = getAttendanceWallWindowMs({
                  attendanceFromDate: repFromDate,
                  attendanceToDate: repToDate || repFromDate,
                  attendanceFromTime: timeHm(String(report.from_time)),
                  attendanceToTime: timeHm(String(report.to_time))
                });
                if (!repWin) continue;

                const overlapMin = intersectionWallMinutes(
                  repWin.startMs,
                  repWin.endMs,
                  otWinStartMs,
                  otWinEndMs
                );
                if (overlapMin <= 0) continue;

                const clockSpanMin = (repWin.endMs - repWin.startMs) / 60000;
                const rawWorked =
                  report.hours_worked_today != null && report.hours_worked_today !== ''
                    ? Math.round(Number(report.hours_worked_today) * 60)
                    : Math.max(0, clockSpanMin);
                const otPartMin =
                  clockSpanMin > 0 ? Math.min(overlapMin, rawWorked * (overlapMin / clockSpanMin)) : 0;

                if (otPartMin > 0.25) {
                  const workCode =
                    report.prdn_work_planning?.derived_sw_code ||
                    report.prdn_work_planning?.other_work_code ||
                    'N/A';
                  const workName =
                    report.prdn_work_planning?.std_work_type_details?.std_work_details?.sw_name || 'N/A';
                  overtimeWorks.push({
                    reportingId: report.id,
                    planningId: report.planning_id,
                    workCode,
                    workName,
                    fromTime: report.from_time,
                    toTime: report.to_time,
                    hoursWorkedToday: report.hours_worked_today || 0,
                    overtimeMinutes: Math.round(otPartMin),
                    overtimeAmount: 0
                  });
                }
              }

              overtimeMinutes = overtimeWorks.reduce((s, w) => s + w.overtimeMinutes, 0);
              reportingOtMinutesAtLeastOne = overtimeMinutes >= 1;
            }
          }
        }
      }

      if (!reportingOtMinutesAtLeastOne) {
        if (reportingRulesApply) {
          // Valid attendance on reporting manpower: OT only inside the wall OT window; do not fall back to shift-net legacy.
          continue;
        }

        overtimeWorks = [];
        overtimeMinutes = 0;
        otAccrualWindowMinutes = undefined;
        availableWorkMinutesDisplay = availableWorkMinutes;

        if (totalWorkedMinutes <= availableWorkMinutes) {
          continue;
        }

        overtimeMinutes = totalWorkedMinutes - availableWorkMinutes;

        let cumulativeWorkedMinutes = 0;
        let overtimeStartIndex = -1;

        for (let i = 0; i < sortedReports.length; i++) {
          const report = sortedReports[i];
          const workedMinutes = report.hours_worked_today
            ? Math.round(report.hours_worked_today * 60)
            : timeToMinutes(report.to_time) - timeToMinutes(report.from_time);

          if (cumulativeWorkedMinutes + workedMinutes > availableWorkMinutes) {
            overtimeStartIndex = i;
            break;
          }
          cumulativeWorkedMinutes += workedMinutes;
        }

        if (overtimeStartIndex >= 0) {
          let remainingOvertimeMinutes = overtimeMinutes;

          for (let i = overtimeStartIndex; i < sortedReports.length; i++) {
            const report = sortedReports[i];
            const workedMinutes = report.hours_worked_today
              ? Math.round(report.hours_worked_today * 60)
              : timeToMinutes(report.to_time) - timeToMinutes(report.from_time);

            let workOvertimeMinutes = 0;

            if (i === overtimeStartIndex) {
              const workMinutesBeforeOT = availableWorkMinutes - cumulativeWorkedMinutes;
              workOvertimeMinutes = workedMinutes - workMinutesBeforeOT;
            } else {
              workOvertimeMinutes = workedMinutes;
            }

            if (remainingOvertimeMinutes > 0 && workOvertimeMinutes > 0) {
              workOvertimeMinutes = Math.min(workOvertimeMinutes, remainingOvertimeMinutes);
              remainingOvertimeMinutes -= workOvertimeMinutes;

              const workCode =
                report.prdn_work_planning?.derived_sw_code ||
                report.prdn_work_planning?.other_work_code ||
                'N/A';
              const workName =
                report.prdn_work_planning?.std_work_type_details?.std_work_details?.sw_name || 'N/A';

              overtimeWorks.push({
                reportingId: report.id,
                planningId: report.planning_id,
                workCode,
                workName,
                fromTime: report.from_time,
                toTime: report.to_time,
                hoursWorkedToday: report.hours_worked_today || 0,
                overtimeMinutes: workOvertimeMinutes,
                overtimeAmount: 0
              });
            }
          }
        }

        overtimeMinutes = overtimeWorks.reduce((s, w) => s + w.overtimeMinutes, 0);
        if (overtimeMinutes < 1) {
          continue;
        }
      }

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

      const reportingDateObj = new Date(dateStr);
      const year = reportingDateObj.getFullYear();
      const month = reportingDateObj.getMonth() + 1;
      const daysInMonth = new Date(year, month, 0).getDate();

      const monthlySalary = empData.basic_da || empData.salary || 0;
      const otRatePerMinute = (monthlySalary / daysInMonth / 480) * 2;

      let totalOvertimeAmount = 0;
      overtimeWorks.forEach(work => {
        work.overtimeAmount = Math.round(work.overtimeMinutes * otRatePerMinute * 100) / 100;
        totalOvertimeAmount += work.overtimeAmount;
      });

      totalOvertimeAmount = Math.round(totalOvertimeAmount * 100) / 100;

      const workerPayload: WorkerOvertime = {
        workerId,
        workerName,
        shiftCode,
        shiftStartTime: shiftDetails.shiftStartTime,
        shiftEndTime: shiftDetails.shiftEndTime,
        breakTimes: shiftDetails.breakTimes,
        totalWorkedMinutes,
        shiftMinutes: shiftDurationMinutes,
        breakMinutes: totalBreakMinutes,
        availableWorkMinutes: availableWorkMinutesDisplay,
        overtimeMinutes,
        overtimeAmount: Math.round(totalOvertimeAmount * 100) / 100,
        works: overtimeWorks
      };
      if (otAccrualWindowMinutes != null) {
        workerPayload.otAccrualWindowMinutes = otAccrualWindowMinutes;
      }
      workers.push(workerPayload);
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

