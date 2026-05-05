/**
 * System-admin helpers: find duplicate planning/reporting manpower rows (same emp, same calendar day
 * in row date span) and hard-delete with submission guards.
 */

import { supabase } from '$lib/supabaseClient';

/** Submission statuses that block hard-delete of linked manpower rows */
export const BLOCKED_SUBMISSION_STATUSES = ['approved', 'pending_approval'] as const;

export type PlanManpowerAdminRow = {
  id: number;
  emp_id: string;
  emp_name: string | null;
  stage_code: string;
  shift_code: string | null;
  planning_from_date: string;
  planning_to_date: string;
  attendance_status: string | null;
  status: string | null;
  planning_submission_id: number | null;
  submission_status: string | null;
  deletable: boolean;
};

export type ReportManpowerAdminRow = {
  id: number;
  emp_id: string;
  emp_name: string | null;
  stage_code: string;
  shift_code: string | null;
  reporting_from_date: string;
  reporting_to_date: string;
  attendance_status: string | null;
  status: string | null;
  reporting_submission_id: number | null;
  submission_status: string | null;
  deletable: boolean;
};

export type DuplicateGroupPlan = {
  empId: string;
  empName: string;
  rows: PlanManpowerAdminRow[];
};

export type DuplicateGroupReport = {
  empId: string;
  empName: string;
  rows: ReportManpowerAdminRow[];
};

function normalizeDate(d: string): string {
  return d.split('T')[0];
}

function isBlockedSubmissionStatus(status: string | null | undefined): boolean {
  if (!status) return false;
  return (BLOCKED_SUBMISSION_STATUSES as readonly string[]).includes(String(status).trim());
}

export function rowDeletableBySubmission(
  submissionId: number | null | undefined,
  submissionStatus: string | null | undefined
): boolean {
  if (submissionId == null) return true;
  return !isBlockedSubmissionStatus(submissionStatus);
}

type PlanRowRaw = {
  id: number;
  emp_id: string;
  stage_code: string;
  shift_code: string | null;
  planning_from_date: string;
  planning_to_date: string;
  attendance_status: string | null;
  status: string | null;
  planning_submission_id: number | null;
  hr_emp?: { emp_id?: string; emp_name?: string | null } | null;
};

type ReportRowRaw = {
  id: number;
  emp_id: string;
  stage_code: string;
  shift_code: string | null;
  reporting_from_date: string;
  reporting_to_date: string;
  attendance_status: string | null;
  status: string | null;
  reporting_submission_id: number | null;
  hr_emp?: { emp_id?: string; emp_name?: string | null } | null;
};

type SubmissionIdRow = { id: number; status: string | null };

function groupByEmpId<T extends { emp_id: string; emp_name?: string | null }>(rows: T[]): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const r of rows) {
    const id = r.emp_id;
    if (!m.has(id)) m.set(id, []);
    m.get(id)!.push(r);
  }
  return m;
}

/**
 * Load planning manpower rows overlapping date; return only employees with 2+ rows (duplicates).
 */
export async function loadPlanningDuplicates(
  selectedDate: string
): Promise<{ groups: DuplicateGroupPlan[]; error?: string }> {
  const dateStr = normalizeDate(selectedDate);
  const { data: raw, error } = await supabase
    .from('prdn_planning_manpower')
    .select(
      `
      id,
      emp_id,
      stage_code,
      shift_code,
      planning_from_date,
      planning_to_date,
      attendance_status,
      status,
      planning_submission_id,
      hr_emp ( emp_id, emp_name )
    `
    )
    .eq('is_deleted', false)
    .lte('planning_from_date', dateStr)
    .gte('planning_to_date', dateStr)
    .order('emp_id', { ascending: true })
    .order('stage_code', { ascending: true })
    .limit(5000);

  if (error) {
    return { groups: [], error: error.message };
  }

  const rows = (raw || []) as PlanRowRaw[];
  const subIds = [
    ...new Set(rows.map((r) => r.planning_submission_id).filter((x): x is number => x != null))
  ];

  const statusById = new Map<number, string>();
  if (subIds.length > 0) {
    const { data: subs, error: subErr } = await supabase
      .from('prdn_planning_submissions')
      .select('id, status')
      .in('id', subIds);
    if (subErr) {
      return { groups: [], error: subErr.message };
    }
    for (const s of (subs || []) as SubmissionIdRow[]) {
      statusById.set(s.id, String(s.status ?? ''));
    }
  }

  const enriched: PlanManpowerAdminRow[] = rows.map((r) => {
    const sid = r.planning_submission_id ?? null;
    const subSt = sid != null ? statusById.get(sid) ?? null : null;
    const name = r.hr_emp?.emp_name ?? null;
    const deletable = rowDeletableBySubmission(sid, subSt);
    return {
      id: r.id,
      emp_id: r.emp_id,
      emp_name: name,
      stage_code: r.stage_code,
      shift_code: r.shift_code,
      planning_from_date: r.planning_from_date,
      planning_to_date: r.planning_to_date,
      attendance_status: r.attendance_status,
      status: r.status,
      planning_submission_id: sid,
      submission_status: subSt,
      deletable
    };
  });

  const byEmp = groupByEmpId(enriched);
  const groups: DuplicateGroupPlan[] = [];
  for (const [empId, list] of byEmp) {
    if (list.length < 2) continue;
    const empName = list.find((x) => x.emp_name)?.emp_name || empId;
    groups.push({ empId, empName, rows: list });
  }

  groups.sort((a, b) => a.empName.localeCompare(b.empName, undefined, { sensitivity: 'base' }));

  return { groups };
}

/**
 * Load reporting manpower rows overlapping date; return only employees with 2+ rows (duplicates).
 */
export async function loadReportingDuplicates(
  selectedDate: string
): Promise<{ groups: DuplicateGroupReport[]; error?: string }> {
  const dateStr = normalizeDate(selectedDate);
  const { data: raw, error } = await supabase
    .from('prdn_reporting_manpower')
    .select(
      `
      id,
      emp_id,
      stage_code,
      shift_code,
      reporting_from_date,
      reporting_to_date,
      attendance_status,
      status,
      reporting_submission_id,
      hr_emp ( emp_id, emp_name )
    `
    )
    .eq('is_deleted', false)
    .lte('reporting_from_date', dateStr)
    .gte('reporting_to_date', dateStr)
    .order('emp_id', { ascending: true })
    .order('stage_code', { ascending: true })
    .limit(5000);

  if (error) {
    return { groups: [], error: error.message };
  }

  const rows = (raw || []) as ReportRowRaw[];
  const subIds = [
    ...new Set(rows.map((r) => r.reporting_submission_id).filter((x): x is number => x != null))
  ];

  const statusById = new Map<number, string>();
  if (subIds.length > 0) {
    const { data: subs, error: subErr } = await supabase
      .from('prdn_reporting_submissions')
      .select('id, status')
      .in('id', subIds);
    if (subErr) {
      return { groups: [], error: subErr.message };
    }
    for (const s of (subs || []) as SubmissionIdRow[]) {
      statusById.set(s.id, String(s.status ?? ''));
    }
  }

  const enriched: ReportManpowerAdminRow[] = rows.map((r) => {
    const sid = r.reporting_submission_id ?? null;
    const subSt = sid != null ? statusById.get(sid) ?? null : null;
    const name = r.hr_emp?.emp_name ?? null;
    const deletable = rowDeletableBySubmission(sid, subSt);
    return {
      id: r.id,
      emp_id: r.emp_id,
      emp_name: name,
      stage_code: r.stage_code,
      shift_code: r.shift_code,
      reporting_from_date: r.reporting_from_date,
      reporting_to_date: r.reporting_to_date,
      attendance_status: r.attendance_status,
      status: r.status,
      reporting_submission_id: sid,
      submission_status: subSt,
      deletable
    };
  });

  const byEmp = groupByEmpId(enriched);
  const groups: DuplicateGroupReport[] = [];
  for (const [empId, list] of byEmp) {
    if (list.length < 2) continue;
    const empName = list.find((x) => x.emp_name)?.emp_name || empId;
    groups.push({ empId, empName, rows: list });
  }

  groups.sort((a, b) => a.empName.localeCompare(b.empName, undefined, { sensitivity: 'base' }));

  return { groups };
}

function validateGroupDeletion(
  rowIdsInGroup: number[],
  selectedIds: Set<number>,
  deletableById: Map<number, boolean>
): string | null {
  const n = rowIdsInGroup.length;
  if (n < 2) return null;
  const k = rowIdsInGroup.filter((id) => selectedIds.has(id)).length;
  if (k === 0) return null;
  if (k > n - 1) {
    return 'Cannot delete every row in a duplicate group: leave at least one row unselected.';
  }
  for (const id of rowIdsInGroup) {
    if (selectedIds.has(id) && !deletableById.get(id)) {
      return `Row id ${id} is linked to an approved or pending approval submission and cannot be deleted.`;
    }
  }
  return null;
}

/**
 * Validates selection rules and hard-deletes planning manpower rows.
 */
export async function deletePlanningManpowerRows(
  groups: DuplicateGroupPlan[],
  selectedIds: number[]
): Promise<{ error?: string; deleted?: number }> {
  const sel = new Set(selectedIds);
  if (sel.size === 0) {
    return { error: 'Select at least one row to delete.' };
  }

  const deletableById = new Map<number, boolean>();
  for (const g of groups) {
    for (const r of g.rows) {
      deletableById.set(r.id, r.deletable);
    }
  }

  for (const id of sel) {
    if (!deletableById.has(id)) {
      return { error: `Invalid selection: row id ${id} is not in the loaded duplicate set.` };
    }
  }

  for (const g of groups) {
    const ids = g.rows.map((r) => r.id);
    const err = validateGroupDeletion(ids, sel, deletableById);
    if (err) return { error: err };
  }

  const { error } = await supabase.from('prdn_planning_manpower').delete().in('id', [...sel]);

  if (error) {
    return { error: error.message };
  }

  return { deleted: sel.size };
}

/**
 * Validates selection rules and hard-deletes reporting manpower rows.
 */
export async function deleteReportingManpowerRows(
  groups: DuplicateGroupReport[],
  selectedIds: number[]
): Promise<{ error?: string; deleted?: number }> {
  const sel = new Set(selectedIds);
  if (sel.size === 0) {
    return { error: 'Select at least one row to delete.' };
  }

  const deletableById = new Map<number, boolean>();
  for (const g of groups) {
    for (const r of g.rows) {
      deletableById.set(r.id, r.deletable);
    }
  }

  for (const id of sel) {
    if (!deletableById.has(id)) {
      return { error: `Invalid selection: row id ${id} is not in the loaded duplicate set.` };
    }
  }

  for (const g of groups) {
    const ids = g.rows.map((r) => r.id);
    const err = validateGroupDeletion(ids, sel, deletableById);
    if (err) return { error: err };
  }

  const { error } = await supabase.from('prdn_reporting_manpower').delete().in('id', [...sel]);

  if (error) {
    return { error: error.message };
  }

  return { deleted: sel.size };
}
