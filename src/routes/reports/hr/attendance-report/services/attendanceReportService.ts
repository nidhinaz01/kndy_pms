/**
 * Attendance report: reporting manpower only — pivot by calendar day (P / A(I) / A(U)).
 */

import { supabase } from '$lib/supabaseClient';
import { eachIsoDateInclusive, isoRangesOverlap } from '$lib/utils/reportDateRange';
import { formatManpowerAttendanceShort } from '$lib/utils/manpowerAttendanceStatus';

const PAGE_SIZE = 400;

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

function groupKey(parts: {
  shiftCode: string | null;
  stageCode: string | null;
  empId: string | null;
  skillShort: string | null;
}): string {
  return `${parts.shiftCode ?? ''}|${parts.stageCode ?? ''}|${parts.empId ?? ''}|${parts.skillShort ?? ''}`;
}

export interface AttendancePivotRow {
  shiftCode: string | null;
  stageCode: string | null;
  empId: string | null;
  empName: string | null;
  skillShort: string | null;
  /** yyyy-mm-dd -> P | A(I) | A(U) | — */
  cells: Record<string, string>;
}

export interface AttendancePivotReport {
  dates: string[];
  rows: AttendancePivotRow[];
}

export async function loadAttendancePivotReport(fromDate: string, toDate: string): Promise<AttendancePivotReport> {
  const fromD = fromDate.split('T')[0];
  const toD = toDate.split('T')[0];
  const dates = eachIsoDateInclusive(fromD, toD);

  type Raw = {
    id: number;
    shiftCode: string | null;
    stageCode: string | null;
    empId: string | null;
    empName: string | null;
    skillShort: string | null;
    wFrom: string;
    wTo: string;
    attendance_status: string | null;
  };

  const rawRows: Raw[] = [];
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
        reporting_from_date,
        reporting_to_date,
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

      const emp = pickEmp(Array.isArray(row.hr_emp) ? row.hr_emp[0] : row.hr_emp);
      rawRows.push({
        id: Number(row.id),
        shiftCode: row.shift_code ?? null,
        stageCode: row.stage_code ?? null,
        empId: emp.empId ?? row.emp_id ?? null,
        empName: emp.empName,
        skillShort: emp.skillShort,
        wFrom,
        wTo,
        attendance_status: row.attendance_status ?? null
      });
    }

    if (page.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  const grouped = new Map<
    string,
    {
      shiftCode: string | null;
      stageCode: string | null;
      empId: string | null;
      empName: string | null;
      skillShort: string | null;
      cells: Record<string, string>;
    }
  >();

  for (const r of rawRows) {
    const key = groupKey(r);
    if (!grouped.has(key)) {
      grouped.set(key, {
        shiftCode: r.shiftCode,
        stageCode: r.stageCode,
        empId: r.empId,
        empName: r.empName,
        skillShort: r.skillShort,
        cells: {}
      });
    }
    const entry = grouped.get(key)!;
    const code = formatManpowerAttendanceShort(r.attendance_status);
    for (const d of dates) {
      if (d >= r.wFrom && d <= r.wTo) {
        entry.cells[d] = code;
      }
    }
  }

  const rows: AttendancePivotRow[] = [...grouped.values()].map((g) => ({
    shiftCode: g.shiftCode,
    stageCode: g.stageCode,
    empId: g.empId,
    empName: g.empName,
    skillShort: g.skillShort,
    cells: g.cells
  }));

  rows.sort((a, b) => {
    const byEmp = (a.empName ?? '').localeCompare(b.empName ?? '', undefined, { sensitivity: 'base' });
    if (byEmp !== 0) return byEmp;
    const byStage = (a.stageCode ?? '').localeCompare(b.stageCode ?? '', undefined, {
      sensitivity: 'base',
      numeric: true
    });
    if (byStage !== 0) return byStage;
    const byShift = (a.shiftCode ?? '').localeCompare(b.shiftCode ?? '', undefined, {
      sensitivity: 'base',
      numeric: true
    });
    if (byShift !== 0) return byShift;
    return (a.skillShort ?? '').localeCompare(b.skillShort ?? '', undefined, { sensitivity: 'base' });
  });

  return { dates, rows };
}
