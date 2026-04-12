/**
 * C-Off report: planning and reporting manpower rows where C-Off is used,
 * overlapping the selected date window (max ~3 months via validateReportDateRange).
 */

import { supabase } from '$lib/supabaseClient';
import { isoRangesOverlap } from '$lib/utils/reportDateRange';

const PAGE_SIZE = 400;

function hasCOffUse(row: { c_off_value?: unknown; c_off_from_date?: string | null }): boolean {
  const v = Number(row.c_off_value);
  if (!Number.isNaN(v) && v > 0) return true;
  return Boolean(row.c_off_from_date);
}

function timePart(t: string | null | undefined): string | null {
  if (t == null || t === '') return null;
  return String(t).substring(0, 5);
}

export interface COffReportRow {
  source: 'Planning' | 'Reporting';
  empId: string | null;
  empName: string | null;
  skillShort: string | null;
  stageCode: string | null;
  shiftCode: string | null;
  attendanceStatus: string | null;
  recordStatus: string | null;
  windowFrom: string | null;
  windowTo: string | null;
  attendanceFromTime: string | null;
  attendanceToTime: string | null;
  plannedHours: number | null;
  actualHours: number | null;
  cOffValue: number | null;
  cOffFromDate: string | null;
  cOffFromTime: string | null;
  cOffToDate: string | null;
  cOffToTime: string | null;
  notes: string | null;
  createdBy: string | null;
  createdDt: string | null;
  modifiedDt: string | null;
}

function pickEmp(row: { emp_id?: string | null; emp_name?: string | null; skill_short?: string | null } | null) {
  if (!row) {
    return { empId: null as string | null, empName: null as string | null, skillShort: null as string | null };
  }
  return {
    empId: row.emp_id ?? null,
    empName: row.emp_name ?? null,
    skillShort: row.skill_short ?? null
  };
}

export async function loadCOffReport(fromDate: string, toDate: string): Promise<COffReportRow[]> {
  const fromD = fromDate.split('T')[0];
  const toD = toDate.split('T')[0];
  const out: Array<{ row: COffReportRow; sortKey: string }> = [];

  async function pullPlanning() {
    let offset = 0;
    while (true) {
      const { data, error } = await supabase
        .from('prdn_planning_manpower')
        .select(
          `
          id,
          emp_id,
          stage_code,
          shift_code,
          attendance_status,
          status,
          planning_from_date,
          planning_to_date,
          from_time,
          to_time,
          planned_hours,
          notes,
          c_off_value,
          c_off_from_date,
          c_off_from_time,
          c_off_to_date,
          c_off_to_time,
          created_by,
          created_dt,
          modified_dt,
          hr_emp ( emp_id, emp_name, skill_short )
        `
        )
        .lte('planning_from_date', toD)
        .gte('planning_to_date', fromD)
        .in('status', ['draft', 'pending_approval', 'approved'])
        .eq('is_deleted', false)
        .order('id', { ascending: true })
        .range(offset, offset + PAGE_SIZE - 1);

      if (error) throw error;
      const page = data || [];
      if (page.length === 0) break;

      for (const row of page as any[]) {
        const wFrom = row.planning_from_date ? String(row.planning_from_date).split('T')[0] : '';
        const wTo = row.planning_to_date ? String(row.planning_to_date).split('T')[0] : wFrom;
        if (!isoRangesOverlap(fromD, toD, wFrom, wTo)) continue;
        if (!hasCOffUse(row)) continue;

        const emp = pickEmp(Array.isArray(row.hr_emp) ? row.hr_emp[0] : row.hr_emp);
        out.push({
          sortKey: `${wFrom}_${row.created_dt ?? ''}_${row.id}`,
          row: {
            source: 'Planning',
            empId: emp.empId ?? row.emp_id ?? null,
            empName: emp.empName,
            skillShort: emp.skillShort,
            stageCode: row.stage_code ?? null,
            shiftCode: row.shift_code ?? null,
            attendanceStatus: row.attendance_status ?? null,
            recordStatus: row.status ?? null,
            windowFrom: wFrom || null,
            windowTo: wTo || null,
            attendanceFromTime: timePart(row.from_time),
            attendanceToTime: timePart(row.to_time),
            plannedHours: row.planned_hours != null ? Number(row.planned_hours) : null,
            actualHours: null,
            cOffValue: row.c_off_value != null ? Number(row.c_off_value) : null,
            cOffFromDate: row.c_off_from_date ? String(row.c_off_from_date).split('T')[0] : null,
            cOffFromTime: timePart(row.c_off_from_time),
            cOffToDate: row.c_off_to_date ? String(row.c_off_to_date).split('T')[0] : null,
            cOffToTime: timePart(row.c_off_to_time),
            notes: row.notes ?? null,
            createdBy: row.created_by ?? null,
            createdDt: row.created_dt ?? null,
            modifiedDt: row.modified_dt ?? null
          }
        });
      }

      if (page.length < PAGE_SIZE) break;
      offset += PAGE_SIZE;
    }
  }

  async function pullReporting() {
    let offset = 0;
    while (true) {
      const { data, error } = await supabase
        .from('prdn_reporting_manpower')
        .select(
          `
          id,
          emp_id,
          stage_code,
          shift_code,
          attendance_status,
          status,
          reporting_from_date,
          reporting_to_date,
          from_time,
          to_time,
          actual_hours,
          notes,
          c_off_value,
          c_off_from_date,
          c_off_from_time,
          c_off_to_date,
          c_off_to_time,
          created_by,
          created_dt,
          modified_dt,
          hr_emp ( emp_id, emp_name, skill_short )
        `
        )
        .lte('reporting_from_date', toD)
        .gte('reporting_to_date', fromD)
        .in('status', ['draft', 'pending_approval', 'approved'])
        .eq('is_deleted', false)
        .order('id', { ascending: true })
        .range(offset, offset + PAGE_SIZE - 1);

      if (error) throw error;
      const page = data || [];
      if (page.length === 0) break;

      for (const row of page as any[]) {
        const wFrom = row.reporting_from_date ? String(row.reporting_from_date).split('T')[0] : '';
        const wTo = row.reporting_to_date ? String(row.reporting_to_date).split('T')[0] : wFrom;
        if (!isoRangesOverlap(fromD, toD, wFrom, wTo)) continue;
        if (!hasCOffUse(row)) continue;

        const emp = pickEmp(Array.isArray(row.hr_emp) ? row.hr_emp[0] : row.hr_emp);
        out.push({
          sortKey: `${wFrom}_${row.created_dt ?? ''}_${row.id}`,
          row: {
            source: 'Reporting',
            empId: emp.empId ?? row.emp_id ?? null,
            empName: emp.empName,
            skillShort: emp.skillShort,
            stageCode: row.stage_code ?? null,
            shiftCode: row.shift_code ?? null,
            attendanceStatus: row.attendance_status ?? null,
            recordStatus: row.status ?? null,
            windowFrom: wFrom || null,
            windowTo: wTo || null,
            attendanceFromTime: timePart(row.from_time),
            attendanceToTime: timePart(row.to_time),
            /** Reporting manpower table has no planned_hours in this schema; show actual only. */
            plannedHours: null,
            actualHours: row.actual_hours != null ? Number(row.actual_hours) : null,
            cOffValue: row.c_off_value != null ? Number(row.c_off_value) : null,
            cOffFromDate: row.c_off_from_date ? String(row.c_off_from_date).split('T')[0] : null,
            cOffFromTime: timePart(row.c_off_from_time),
            cOffToDate: row.c_off_to_date ? String(row.c_off_to_date).split('T')[0] : null,
            cOffToTime: timePart(row.c_off_to_time),
            notes: row.notes ?? null,
            createdBy: row.created_by ?? null,
            createdDt: row.created_dt ?? null,
            modifiedDt: row.modified_dt ?? null
          }
        });
      }

      if (page.length < PAGE_SIZE) break;
      offset += PAGE_SIZE;
    }
  }

  await pullPlanning();
  await pullReporting();

  out.sort((a, b) => b.sortKey.localeCompare(a.sortKey));
  return out.map((x) => x.row);
}
