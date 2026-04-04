import { supabase } from '$lib/supabaseClient';

const PLANNING_REASSIGN_STATUSES = ['draft', 'pending_approval', 'approved'];
const REPORTING_REASSIGN_STATUSES = ['draft', 'pending_approval', 'approved'];

export function normalizeReportDate(dateInput: string): string {
  if (!dateInput) return '';
  return dateInput.split('T')[0];
}

/**
 * Emp IDs with a reassignment INTO `stageCode` on the given date (planning and/or reporting tables).
 */
export async function getEmpIdsReassignedIntoStage(
  stageCode: string,
  dateStr: string,
  shiftCode?: string
): Promise<Set<string>> {
  const ids = new Set<string>();
  if (!stageCode || !dateStr) return ids;

  let planQ = supabase
    .from('prdn_planning_stage_reassignment')
    .select('emp_id')
    .eq('to_stage_code', stageCode)
    .eq('planning_date', dateStr)
    .in('status', PLANNING_REASSIGN_STATUSES)
    .eq('is_deleted', false);
  if (shiftCode) planQ = planQ.eq('shift_code', shiftCode);
  let { data: planRows, error: planErr } = await planQ;
  if (planErr && String(planErr.message || '').includes('status')) {
    planQ = supabase
      .from('prdn_planning_stage_reassignment')
      .select('emp_id')
      .eq('to_stage_code', stageCode)
      .eq('planning_date', dateStr)
      .eq('is_deleted', false);
    if (shiftCode) planQ = planQ.eq('shift_code', shiftCode);
    const retry = await planQ;
    planRows = retry.data;
    planErr = retry.error;
  }
  if (planErr) {
    console.error('reportStageWorkerInclusion: planning reassignment query failed', planErr);
  } else {
    (planRows || []).forEach((r: { emp_id?: string }) => {
      if (r.emp_id) ids.add(r.emp_id);
    });
  }

  let repQ = supabase
    .from('prdn_reporting_stage_reassignment')
    .select('emp_id')
    .eq('to_stage_code', stageCode)
    .eq('reassignment_date', dateStr)
    .in('status', REPORTING_REASSIGN_STATUSES)
    .eq('is_deleted', false);
  if (shiftCode) repQ = repQ.eq('shift_code', shiftCode);
  let { data: repRows, error: repErr } = await repQ;

  if (repErr && String(repErr.message || '').includes('status')) {
    repQ = supabase
      .from('prdn_reporting_stage_reassignment')
      .select('emp_id')
      .eq('to_stage_code', stageCode)
      .eq('reassignment_date', dateStr)
      .eq('is_deleted', false);
    if (shiftCode) repQ = repQ.eq('shift_code', shiftCode);
    const retry = await repQ;
    repRows = retry.data;
    repErr = retry.error;
  }

  if (repErr) {
    console.error('reportStageWorkerInclusion: reporting reassignment query failed', repErr);
  } else {
    (repRows || []).forEach((r: { emp_id?: string }) => {
      if (r.emp_id) ids.add(r.emp_id);
    });
  }

  return ids;
}

const CHUNK = 80;

/**
 * Load hr_emp rows (with present hr_attendance on `attendanceDate`) for the given emp IDs.
 * Same shape as reportWorkService.loadWorkers base query (nested hr_attendance).
 */
export async function fetchPresentHrEmpRowsForIds(
  empIds: string[],
  attendanceDate: string,
  shiftCode?: string
): Promise<any[]> {
  if (empIds.length === 0 || !attendanceDate) return [];
  const out: any[] = [];

  for (let i = 0; i < empIds.length; i += CHUNK) {
    const chunk = [...new Set(empIds.slice(i, i + CHUNK))];
    let q = supabase
      .from('hr_emp')
      .select(
        `
        emp_id,
        emp_name,
        skill_short,
        stage,
        hr_attendance!inner(
          attendance_status
        )
      `
      )
      .in('emp_id', chunk)
      .eq('is_active', true)
      .eq('is_deleted', false)
      .eq('hr_attendance.attendance_date', attendanceDate)
      .eq('hr_attendance.attendance_status', 'present')
      .eq('hr_attendance.is_deleted', false);
    if (shiftCode) q = q.eq('shift_code', shiftCode);
    const { data, error } = await q;
    if (error) {
      console.error('fetchPresentHrEmpRowsForIds:', error);
      continue;
    }
    out.push(...(data || []));
  }

  return out;
}
