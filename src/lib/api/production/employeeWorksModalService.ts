import { supabase } from '$lib/supabaseClient';

/** One row for EmployeeWorksModal (planning or reporting). */
export interface EmployeeWorksModalRow {
  workOrder: string;
  workCode: string;
  workName: string;
  fromDate: string;
  fromTime: string;
  toDate: string;
  toTime: string;
  /** Set for reporting mode: workflow + completion when applicable */
  status?: string;
}

function dateOnly(date: string): string {
  return (date || '').split('T')[0];
}

function workNameFromStdDetails(std: any): string {
  if (!std) return '—';
  const row = Array.isArray(std) ? std[0] : std;
  const name = row?.std_work_details?.sw_name;
  return name && String(name).trim() ? String(name) : '—';
}

function workOrderLabel(wo: any): string {
  if (!wo) return '—';
  const w = Array.isArray(wo) ? wo[0] : wo;
  const a = w?.wo_no != null && String(w.wo_no).trim() !== '' ? String(w.wo_no) : '';
  const b = w?.pwo_no != null && String(w.pwo_no).trim() !== '' ? String(w.pwo_no) : '';
  if (a && b) return `${a} / ${b}`;
  return a || b || '—';
}

function planningWorkCode(row: any): string {
  return (row.derived_sw_code || row.other_work_code || '—') as string;
}

function filterSoftDeletedPlanning(rows: any[]): any[] {
  return (rows || []).filter((record) => {
    const v = record?.is_deleted;
    if (v === true || v === 'true' || v === 'True' || v === 1 || v === '1') return false;
    return true;
  });
}

/**
 * All active planning rows for the worker on the given calendar day (any stage/shift).
 */
export async function fetchEmployeePlanningWorksForDate(
  empId: string,
  date: string
): Promise<EmployeeWorksModalRow[]> {
  const dateStr = dateOnly(date);
  if (!empId || !dateStr) return [];

  const { data, error } = await supabase
    .from('prdn_work_planning')
    .select(
      `
      from_date,
      from_time,
      to_date,
      to_time,
      derived_sw_code,
      other_work_code,
      status,
      std_work_type_details(
        std_work_details(sw_name)
      ),
      prdn_wo_details!inner(wo_no, pwo_no),
      hr_emp!inner(emp_id)
    `
    )
    .eq('worker_id', empId)
    .eq('from_date', dateStr)
    .eq('is_active', true)
    .eq('is_deleted', false)
    .order('from_time', { ascending: true });

  if (error) {
    console.error('fetchEmployeePlanningWorksForDate:', error);
    throw new Error(error.message || 'Failed to load planning works');
  }

  const rows = filterSoftDeletedPlanning(data || []);
  return rows.map((row: any) => ({
    workOrder: workOrderLabel(row.prdn_wo_details),
    workCode: planningWorkCode(row),
    workName: workNameFromStdDetails(row.std_work_type_details),
    fromDate: row.from_date ?? '—',
    fromTime: row.from_time ?? '—',
    toDate: row.to_date ?? '—',
    toTime: row.to_time ?? '—'
  }));
}

function formatReportingStatus(row: any): string {
  const workflow = row.status != null && String(row.status).trim() !== '' ? String(row.status) : '—';
  const c = row.completion_status;
  if (c === 'C') return `${workflow} · Completed`;
  if (c === 'NC') return `${workflow} · In progress`;
  return workflow;
}

/**
 * All non-deleted reporting rows for the worker on the given calendar day (any stage/shift).
 */
export async function fetchEmployeeReportingWorksForDate(
  empId: string,
  date: string
): Promise<EmployeeWorksModalRow[]> {
  const dateStr = dateOnly(date);
  if (!empId || !dateStr) return [];

  const { data, error } = await supabase
    .from('prdn_work_reporting')
    .select(
      `
      from_date,
      from_time,
      to_date,
      to_time,
      status,
      completion_status,
      prdn_work_planning!inner(
        derived_sw_code,
        other_work_code,
        std_work_type_details(
          std_work_details(sw_name)
        ),
        prdn_wo_details!inner(wo_no, pwo_no),
        hr_emp!inner(emp_id)
      )
    `
    )
    .eq('worker_id', empId)
    .eq('from_date', dateStr)
    .eq('is_active', true)
    .eq('is_deleted', false)
    .order('from_time', { ascending: true });

  if (error) {
    console.error('fetchEmployeeReportingWorksForDate:', error);
    throw new Error(error.message || 'Failed to load reporting works');
  }

  return (data || []).map((row: any) => {
    const p = row.prdn_work_planning || {};
    return {
      workOrder: workOrderLabel(p.prdn_wo_details),
      workCode: planningWorkCode(p),
      workName: workNameFromStdDetails(p.std_work_type_details),
      fromDate: row.from_date ?? '—',
      fromTime: row.from_time ?? '—',
      toDate: row.to_date ?? '—',
      toTime: row.to_time ?? '—',
      status: formatReportingStatus(row)
    };
  });
}
