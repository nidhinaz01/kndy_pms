import { supabase } from '$lib/supabaseClient';
import { getCurrentUsername, getCurrentTimestamp } from '$lib/utils/userUtils';

const REPORT_PAGE = 1000;

/**
 * Hours driving `prdn_work_planning.time_worked_till_date` after save — matches
 * `multiSkillReportSaveService.updatePlanningStatus` (till + today).
 */
export function impliedCumulativeHoursForReportingRow(r: {
  hours_worked_till_date?: number | null;
  hours_worked_today?: number | null;
}): number {
  const till = Number(r.hours_worked_till_date) || 0;
  const today = Number(r.hours_worked_today) || 0;
  return till + today;
}

function sortReportsChronological(reports: { id?: number; from_date?: string | null }[]): any[] {
  return [...reports].sort((a, b) => {
    const da = String(a.from_date || '');
    const db = String(b.from_date || '');
    if (da !== db) return da < db ? -1 : da > db ? 1 : 0;
    return (Number(a.id) || 0) - (Number(b.id) || 0);
  });
}

/**
 * After deletes, planning cumulative for this competency line is taken from the
 * chronologically last remaining report (same convention as save: last session total).
 */
function cumulativeFromRemainingReportsForPlanning(remaining: any[]): number {
  if (remaining.length === 0) return 0;
  const last = sortReportsChronological(remaining)[remaining.length - 1];
  return impliedCumulativeHoursForReportingRow(last);
}

export type WorkKey = {
  stage_code: string;
  wo_details_id: number;
  derived_sw_code: string | null;
  other_work_code: string | null;
};

function workKeyString(k: WorkKey): string {
  return `${k.stage_code}_${k.wo_details_id}_${k.derived_sw_code ?? ''}_${k.other_work_code ?? ''}`;
}

/** Match `updateWorkStatus` / planning filters for standard vs other work. */
function planningRowsQuery(k: WorkKey) {
  let q = supabase
    .from('prdn_work_planning')
    .select('id, status')
    .eq('stage_code', k.stage_code)
    .eq('wo_details_id', k.wo_details_id)
    .eq('is_deleted', false)
    .eq('is_active', true);
  if (k.derived_sw_code) {
    q = q.eq('derived_sw_code', k.derived_sw_code);
  } else if (k.other_work_code) {
    q = q.eq('other_work_code', k.other_work_code);
  }
  return q;
}

/**
 * When there are no reporting rows left for this work on the stage, align with
 * `worksTableService.checkWorkStatus`: planned vs unplanned vs draft-only.
 */
function prdnStatusWhenNoReports(planningRows: { status: string }[]): string {
  if (!planningRows.length) return 'To be Planned';

  const hasPending = planningRows.some((p) => p.status === 'pending_approval');
  const hasApproved = planningRows.some((p) => p.status === 'approved');
  const hasDraft = planningRows.some((p) => p.status === 'draft');
  const hasRejected = planningRows.some((p) => p.status === 'rejected');

  if (hasPending && !hasApproved) {
    return 'Planned';
  }
  if (hasDraft && !hasPending && !hasApproved) {
    return 'Draft Plan';
  }
  if (hasRejected && !hasPending && !hasApproved && !hasDraft) {
    return 'Draft Plan';
  }
  if (hasApproved) {
    return 'Planned';
  }
  if (hasDraft) {
    return 'Draft Plan';
  }
  return 'To be Planned';
}

async function fetchAllReportingForPlanningIds(
  planningIds: number[],
  excludeReportIds: Set<number>
): Promise<Map<number, any[]>> {
  const byPlan = new Map<number, any[]>();
  if (planningIds.length === 0) return byPlan;
  for (const id of planningIds) byPlan.set(id, []);

  let offset = 0;
  let hasMore = true;
  while (hasMore) {
    const { data, error } = await supabase
      .from('prdn_work_reporting')
      .select('id, planning_id, from_date, hours_worked_till_date, hours_worked_today, completion_status')
      .in('planning_id', planningIds)
      .eq('is_deleted', false)
      .order('id')
      .range(offset, offset + REPORT_PAGE - 1);

    if (error) throw new Error(error.message);
    const rows = data || [];
    for (const r of rows) {
      if (excludeReportIds.has(Number(r.id))) continue;
      const pid = Number(r.planning_id);
      const list = byPlan.get(pid);
      if (list) list.push(r);
    }
    hasMore = rows.length === REPORT_PAGE;
    offset += REPORT_PAGE;
  }
  return byPlan;
}

async function fetchAllRemainingReportsForWorkKey(
  k: WorkKey,
  excludeReportIds: Set<number>
): Promise<any[]> {
  const { data: plans, error: pErr } = await planningRowsQuery(k);
  if (pErr) throw new Error(pErr.message);
  const planningIds = (plans || []).map((p: any) => Number(p.id)).filter(Boolean);
  if (planningIds.length === 0) return [];

  const out: any[] = [];
  let offset = 0;
  let hasMore = true;
  while (hasMore) {
    const { data, error } = await supabase
      .from('prdn_work_reporting')
      .select('id, completion_status')
      .in('planning_id', planningIds)
      .eq('is_deleted', false)
      .order('id')
      .range(offset, offset + REPORT_PAGE - 1);

    if (error) throw new Error(error.message);
    const rows = data || [];
    for (const r of rows) {
      if (!excludeReportIds.has(Number(r.id))) out.push(r);
    }
    hasMore = rows.length === REPORT_PAGE;
    offset += REPORT_PAGE;
  }
  return out;
}

/**
 * Recompute `prdn_work_planning` time fields and `prdn_work_status` for every
 * planning line and work key touched by deleting these reporting rows.
 * On failure, callers must not delete.
 */
export async function reconcileBeforeDraftReportDelete(
  reportIds: (number | string)[]
): Promise<{ success: boolean; error?: string }> {
  const ids = [
    ...new Set(
      reportIds
        .map((id) => Number(id))
        .filter((n) => Number.isFinite(n) && n > 0)
    )
  ];
  if (ids.length === 0) {
    return { success: false, error: 'No valid report ids' };
  }

  const excludeIds = new Set(ids);

  const { data: toDelete, error: loadErr } = await supabase
    .from('prdn_work_reporting')
    .select(
      `
      id,
      planning_id,
      prdn_work_planning!inner (
        id,
        planned_hours,
        stage_code,
        wo_details_id,
        derived_sw_code,
        other_work_code
      )
    `
    )
    .in('id', ids)
    .eq('is_deleted', false);

  if (loadErr) {
    return { success: false, error: loadErr.message };
  }
  if (!toDelete?.length) {
    return { success: false, error: 'No matching report rows to delete' };
  }

  const planningIdsToTouch = new Set<number>();
  const workKeys = new Map<string, WorkKey>();

  for (const row of toDelete as any[]) {
    const p = row.prdn_work_planning;
    if (p?.id) planningIdsToTouch.add(Number(p.id));
    if (p?.stage_code != null && p?.wo_details_id != null) {
      const key: WorkKey = {
        stage_code: p.stage_code,
        wo_details_id: Number(p.wo_details_id),
        derived_sw_code: p.derived_sw_code ?? null,
        other_work_code: p.other_work_code ?? null
      };
      workKeys.set(workKeyString(key), key);
    }
  }

  const planningIdList = [...planningIdsToTouch];

  try {
    const byPlan = await fetchAllReportingForPlanningIds(planningIdList, excludeIds);

    const currentUser = getCurrentUsername();
    const now = getCurrentTimestamp();

    const { data: plannedHoursRows, error: phErr } = await supabase
      .from('prdn_work_planning')
      .select('id, planned_hours')
      .in('id', planningIdList);

    if (phErr) {
      return { success: false, error: phErr.message };
    }

    const plannedById = new Map<number, number>();
    for (const pr of plannedHoursRows || []) {
      plannedById.set(Number((pr as any).id), Number((pr as any).planned_hours) || 0);
    }

    for (const planningId of planningIdList) {
      const remaining = byPlan.get(planningId) || [];
      const plannedHours = plannedById.get(planningId) ?? 0;
      const cumulative =
        remaining.length === 0 ? 0 : cumulativeFromRemainingReportsForPlanning(remaining);
      const remainingTime = Math.max(0, plannedHours - cumulative);

      const { error: upErr } = await supabase
        .from('prdn_work_planning')
        .update({
          time_worked_till_date: cumulative,
          remaining_time: remainingTime,
          modified_by: currentUser,
          modified_dt: now
        })
        .eq('id', planningId);

      if (upErr) {
        return { success: false, error: upErr.message };
      }
    }

    for (const k of workKeys.values()) {
      const remainingReports = await fetchAllRemainingReportsForWorkKey(k, excludeIds);
      let newStatus: string;

      if (remainingReports.length === 0) {
        const { data: plans, error: plErr } = await planningRowsQuery(k);
        if (plErr) {
          return { success: false, error: plErr.message };
        }
        newStatus = prdnStatusWhenNoReports((plans || []).map((p: any) => ({ status: p.status })));
      } else {
        const allC = remainingReports.every((r: any) => r.completion_status === 'C');
        newStatus = allC ? 'Completed' : 'In Progress';
      }

      let statusUpdateQuery = supabase
        .from('prdn_work_status')
        .update({
          current_status: newStatus,
          modified_by: currentUser,
          modified_dt: now
        })
        .eq('stage_code', k.stage_code)
        .eq('wo_details_id', k.wo_details_id);

      if (k.derived_sw_code) {
        statusUpdateQuery = statusUpdateQuery.eq('derived_sw_code', k.derived_sw_code);
      } else if (k.other_work_code) {
        statusUpdateQuery = statusUpdateQuery.eq('other_work_code', k.other_work_code);
      }

      const { error: stErr } = await statusUpdateQuery;
      if (stErr) {
        return { success: false, error: stErr.message };
      }
    }

    return { success: true };
  } catch (e) {
    return { success: false, error: (e as Error)?.message || 'Reconcile failed' };
  }
}
