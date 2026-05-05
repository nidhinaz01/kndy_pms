/**
 * System-admin: “duplicate” = two+ rows that are **identical in all data columns** except `id`
 * (audit columns excluded from comparison). Same load filters as `getDraftWorkPlans` /
 * `getDraftWorkReports`. Hard-delete; submission status is not used to block deletes.
 */

import { supabase } from '$lib/supabaseClient';

const PAGE_SIZE = 1000;

/** Full `prdn_work_planning` row shape for duplicate UI (dynamic columns). */
export type DraftWorkPlanDupRow = Record<string, unknown> & { id: number };

export type DraftWorkPlanDupGroup = {
  groupKey: string;
  headerLabel: string;
  rows: DraftWorkPlanDupRow[];
};

/** Full `prdn_work_reporting` row plus optional join helpers from planning. */
export type DraftWorkReportDupRow = Record<string, unknown> & { id: number };

export type DraftWorkReportDupGroup = {
  groupKey: string;
  headerLabel: string;
  rows: DraftWorkReportDupRow[];
};

function normalizeDate(d: string): string {
  return d.split('T')[0];
}

/** Omitted from “copy” comparison (audit, join blobs, display-only fields). */
const SIGNATURE_SKIP_KEYS = new Set<string>([
  'id',
  'created_dt',
  'modified_dt',
  'created_by',
  'modified_by',
  'hr_emp',
  'worker_name',
  'planning_stage_code',
  'planning_shift_code'
]);

function stableValue(v: unknown): unknown {
  if (v === null || v === undefined) return null;
  if (typeof v === 'number' || typeof v === 'boolean') return v;
  if (typeof v === 'string') return v;
  if (Array.isArray(v)) return v.map((x) => stableValue(x));
  if (typeof v === 'object') {
    if (v instanceof Date) return v.toISOString();
    const o = v as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(o).sort()) {
      out[k] = stableValue(o[k]);
    }
    return out;
  }
  return String(v);
}

/**
 * Rows that are **copies** of each other: same values for every column except `id`.
 * Audit columns are ignored so identical logical rows with different timestamps still group.
 */
function rowContentSignature(r: Record<string, unknown>): string {
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(r).sort()) {
    if (SIGNATURE_SKIP_KEYS.has(k)) continue;
    out[k] = stableValue(r[k]);
  }
  return JSON.stringify(out);
}

function empNameFromJoin(hrEmp: unknown): string {
  const emp = Array.isArray(hrEmp) ? hrEmp[0] : hrEmp;
  if (!emp || typeof emp !== 'object') return '';
  const n = (emp as { emp_name?: unknown }).emp_name;
  return n != null ? String(n).trim() : '';
}

async function hrEmpNameByWorkerIds(workerIds: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const uniq = [...new Set(workerIds.filter((id) => id !== ''))];
  const chunkSize = 500;
  for (let i = 0; i < uniq.length; i += chunkSize) {
    const slice = uniq.slice(i, i + chunkSize);
    const { data, error } = await supabase.from('hr_emp').select('emp_id, emp_name').in('emp_id', slice);
    if (error) {
      console.error('duplicateDraftWorkAdminService: hr_emp batch', error);
      continue;
    }
    for (const e of data || []) {
      const row = e as { emp_id: string; emp_name?: string | null };
      map.set(String(row.emp_id), String(row.emp_name ?? '').trim());
    }
  }
  return map;
}

function validateGroupDeletion(rowIdsInGroup: number[], selectedIds: Set<number>): string | null {
  const n = rowIdsInGroup.length;
  if (n < 2) return null;
  const k = rowIdsInGroup.filter((id) => selectedIds.has(id)).length;
  if (k === 0) return null;
  if (k > n - 1) {
    return 'Cannot delete every row in a duplicate group: leave at least one row unselected.';
  }
  return null;
}

const REPORT_PIECE_RATE_NULL_FIELDS: Record<string, null> = {
  pr_amount: null,
  pr_calculated_dt: null,
  pr_pow: null,
  pr_rate_work: null,
  pr_rate_worker: null,
  pr_std_time: null,
  pr_type: null
};

type PlanJoinShape = { stage_code: string; shift_code: string | null };

function planningJoinMeta(
  j: PlanJoinShape | PlanJoinShape[] | null | undefined
): PlanJoinShape | null {
  if (j == null) return null;
  return Array.isArray(j) ? j[0] ?? null : j;
}

async function nullifyReportPieceRateForWorkCombinations(
  seedPlanningIds: number[]
): Promise<{ error?: string }> {
  const uniqSeed = [...new Set(seedPlanningIds.filter((x) => Number.isFinite(Number(x))).map((x) => Number(x)))];
  if (uniqSeed.length === 0) return {};

  // 1) Read work-order + work-code combo for selected planning rows.
  const comboSeedRows: Array<{
    id: number;
    wo_details_id: number;
    derived_sw_code: string | null;
    other_work_code: string | null;
  }> = [];
  for (let i = 0; i < uniqSeed.length; i += 500) {
    const chunk = uniqSeed.slice(i, i + 500);
    const { data, error } = await supabase
      .from('prdn_work_planning')
      .select('id, wo_details_id, derived_sw_code, other_work_code')
      .in('id', chunk);
    if (error) return { error: error.message };
    comboSeedRows.push(
      ...((data || []) as Array<{
        id: number;
        wo_details_id: number;
        derived_sw_code: string | null;
        other_work_code: string | null;
      }>)
    );
  }
  if (comboSeedRows.length === 0) return {};

  const comboKey = (r: { wo_details_id: number; derived_sw_code: string | null; other_work_code: string | null }) =>
    `${Number(r.wo_details_id)}|${String(r.derived_sw_code ?? '').trim()}|${String(r.other_work_code ?? '').trim()}`;
  const comboKeys = new Set(comboSeedRows.map((r) => comboKey(r)));
  const woIds = [...new Set(comboSeedRows.map((r) => Number(r.wo_details_id)).filter((n) => Number.isFinite(n)))];
  if (woIds.length === 0) return {};

  // 2) Find all planning ids that belong to those same work-order + work-code combos.
  const allPlanningInWo: Array<{
    id: number;
    wo_details_id: number;
    derived_sw_code: string | null;
    other_work_code: string | null;
  }> = [];
  for (let i = 0; i < woIds.length; i += 500) {
    const chunk = woIds.slice(i, i + 500);
    const { data, error } = await supabase
      .from('prdn_work_planning')
      .select('id, wo_details_id, derived_sw_code, other_work_code')
      .in('wo_details_id', chunk);
    if (error) return { error: error.message };
    allPlanningInWo.push(
      ...((data || []) as Array<{
        id: number;
        wo_details_id: number;
        derived_sw_code: string | null;
        other_work_code: string | null;
      }>)
    );
  }

  const targetPlanningIds = [
    ...new Set(
      allPlanningInWo
        .filter((r) => comboKeys.has(comboKey(r)))
        .map((r) => Number(r.id))
        .filter((n) => Number.isFinite(n))
    )
  ];
  if (targetPlanningIds.length === 0) return {};

  // 3) Nullify piece-rate fields on reporting rows under those combinations.
  for (let i = 0; i < targetPlanningIds.length; i += 500) {
    const chunk = targetPlanningIds.slice(i, i + 500);
    const { error } = await supabase
      .from('prdn_work_reporting')
      .update(REPORT_PIECE_RATE_NULL_FIELDS)
      .in('planning_id', chunk)
      .eq('is_deleted', false);
    if (error) return { error: error.message };
  }
  return {};
}

/** Drop `hr_emp` join, add `worker_name` for table display. */
function planRowForDisplay(r: Record<string, unknown>): DraftWorkPlanDupRow {
  const name = empNameFromJoin(r.hr_emp);
  const { hr_emp: _h, ...rest } = r;
  const id = Number(rest.id);
  const row = { ...rest, id: Number.isFinite(id) ? id : (rest.id as number) } as DraftWorkPlanDupRow;
  if (name) row.worker_name = name;
  return row;
}

/**
 * `prdn_work_planning` rows matching production `getDraftWorkPlans` filters (same statuses,
 * `is_active`, `is_deleted`), org-wide. Shown **only** when 2+ rows are byte-for-byte the same
 * in all non-id, non-audit fields (true copies with different `id`s).
 */
export async function loadDuplicateDraftWorkPlans(): Promise<{ groups: DraftWorkPlanDupGroup[]; error?: string }> {
  const raw: Record<string, unknown>[] = [];
  let offset = 0;
  let hasMore = true;
  while (hasMore) {
    const { data: page, error } = await supabase
      .from('prdn_work_planning')
      .select('*, hr_emp(emp_id, emp_name)')
      .in('status', ['draft', 'pending_approval', 'approved', 'rejected'])
      .eq('is_active', true)
      .eq('is_deleted', false)
      .order('id', { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) {
      return { groups: [], error: error.message };
    }
    const chunk = page || [];
    raw.push(...chunk);
    hasMore = chunk.length === PAGE_SIZE;
    offset += PAGE_SIZE;
  }

  const bySig = new Map<string, DraftWorkPlanDupRow[]>();
  for (const rec of raw) {
    const rawRow = rec as Record<string, unknown>;
    const workerId = String(rawRow.worker_id ?? '').trim();
    if (workerId === '') continue;
    const sig = rowContentSignature(rawRow);
    const r = planRowForDisplay(rawRow);
    if (!bySig.has(sig)) bySig.set(sig, []);
    bySig.get(sig)!.push(r);
  }

  const groups: DraftWorkPlanDupGroup[] = [];
  for (const [sig, list] of bySig) {
    if (list.length < 2) continue;
    const first = list[0];
    const code =
      String(first.derived_sw_code ?? '').trim() ||
      String(first.other_work_code ?? '').trim() ||
      '—';
    const fd = String(first.from_date ?? '');
    const wk = String(first.worker_id ?? '—');
    const wn = String(first.worker_name ?? '').trim();
    const idList = list
      .map((row) => row.id)
      .sort((a, b) => a - b)
      .join(', ');
    const who = wn ? `${wn} (${wk})` : wk;
    const headerLabel = `Identical copies · ids ${idList} · ${first.stage_code}-${String(first.shift_code ?? '—')} · ${normalizeDate(fd)} · ${who} · WO ${first.wo_details_id} · ${code}`;
    groups.push({ groupKey: sig, headerLabel, rows: list });
  }

  groups.sort((a, b) => a.headerLabel.localeCompare(b.headerLabel, undefined, { sensitivity: 'base' }));

  return { groups };
}

/**
 * `prdn_work_reporting` rows matching production `getDraftWorkReports` (inner planning join,
 * same statuses, `is_deleted`), org-wide. Shown only when 2+ rows match on all columns except
 * `id` (and audit fields), i.e. true copies with different ids — same rule as plan tab.
 */
export async function loadDuplicateDraftWorkReports(): Promise<{ groups: DraftWorkReportDupGroup[]; error?: string }> {
  type RawRepRow = Record<string, unknown> & {
    prdn_work_planning?: PlanJoinShape | PlanJoinShape[] | null;
  };

  const rowsRaw: RawRepRow[] = [];
  let offset = 0;
  let hasMore = true;
  while (hasMore) {
    const { data: page, error } = await supabase
      .from('prdn_work_reporting')
      .select(
        `
        *,
        prdn_work_planning!inner(stage_code, shift_code)
      `
      )
      .in('status', ['draft', 'pending_approval', 'approved'])
      .eq('is_deleted', false)
      .order('from_time', { ascending: true })
      .order('id', { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) {
      return { groups: [], error: error.message };
    }
    const chunk = (page || []) as RawRepRow[];
    rowsRaw.push(...chunk);
    hasMore = chunk.length === PAGE_SIZE;
    offset += PAGE_SIZE;
  }

  const seenReportIds = new Set<string>();
  const dedupedRows: RawRepRow[] = [];
  for (const r of rowsRaw) {
    const workerId = String(r.worker_id ?? '').trim();
    if (workerId === '') continue;
    const rid = r?.id;
    if (rid == null || (typeof rid === 'string' && String(rid).trim() === '')) {
      dedupedRows.push(r);
      continue;
    }
    const key = String(rid);
    if (seenReportIds.has(key)) continue;
    seenReportIds.add(key);
    dedupedRows.push(r);
  }

  const reportWorkerIds = dedupedRows
    .map((row) => row.worker_id)
    .filter((x) => x != null && String(x).trim() !== '')
    .map((x) => String(x).trim());
  const reportEmpNames = await hrEmpNameByWorkerIds(reportWorkerIds);

  type Staged = { flat: DraftWorkReportDupRow; signatureSource: Record<string, unknown> };

  const staged: Staged[] = [];
  for (const r of dedupedRows) {
    const pl = planningJoinMeta(r.prdn_work_planning);
    const { prdn_work_planning: _nested, ...rest } = r;
    const flat: DraftWorkReportDupRow = { ...(rest as Record<string, unknown>) } as DraftWorkReportDupRow;
    const idNum = Number(flat.id);
    flat.id = Number.isFinite(idNum) ? idNum : (flat.id as number);
    if (pl) {
      flat.planning_stage_code = pl.stage_code;
      flat.planning_shift_code = pl.shift_code;
    }
    const wkey = String(r.worker_id ?? '').trim();
    const wn = reportEmpNames.get(wkey);
    if (wn) flat.worker_name = wn;
    staged.push({ flat, signatureSource: rest as Record<string, unknown> });
  }

  const bySig = new Map<string, DraftWorkReportDupRow[]>();
  for (const { flat, signatureSource } of staged) {
    const sig = rowContentSignature(signatureSource);
    if (!bySig.has(sig)) bySig.set(sig, []);
    bySig.get(sig)!.push(flat);
  }

  const groups: DraftWorkReportDupGroup[] = [];
  for (const [sig, list] of bySig) {
    if (list.length < 2) continue;
    const first = list[0];
    const wid = String(first.worker_id ?? '');
    const wn = String(first.worker_name ?? '').trim();
    const idList = list
      .map((row) => row.id)
      .sort((a, b) => a - b)
      .join(', ');
    const who = wn ? `${wn} (${wid})` : wid;
    const headerLabel = `Identical copies · ids ${idList} · ${who} · planning #${first.planning_id}`;
    groups.push({ groupKey: sig, headerLabel, rows: list });
  }

  groups.sort((a, b) => a.headerLabel.localeCompare(b.headerLabel, undefined, { sensitivity: 'base' }));

  return { groups };
}

export async function deleteDraftWorkPlanRows(
  groups: DraftWorkPlanDupGroup[],
  selectedIds: number[]
): Promise<{ error?: string; deleted?: number }> {
  const sel = new Set(selectedIds);
  if (sel.size === 0) {
    return { error: 'Select at least one row to delete.' };
  }

  const idSet = new Set<number>();
  for (const g of groups) {
    for (const r of g.rows) {
      idSet.add(r.id);
    }
  }

  for (const id of sel) {
    if (!idSet.has(id)) {
      return { error: `Invalid selection: row id ${id} is not in the loaded duplicate set.` };
    }
  }

  for (const g of groups) {
    const ids = g.rows.map((r) => r.id);
    const err = validateGroupDeletion(ids, sel);
    if (err) return { error: err };
  }

  const { error } = await supabase.from('prdn_work_planning').delete().in('id', [...sel]);

  if (error) {
    return { error: error.message };
  }

  return { deleted: sel.size };
}

export async function deleteDraftWorkReportRows(
  groups: DraftWorkReportDupGroup[],
  selectedIds: number[]
): Promise<{ error?: string; deleted?: number }> {
  const sel = new Set(selectedIds);
  if (sel.size === 0) {
    return { error: 'Select at least one row to delete.' };
  }

  const idSet = new Set<number>();
  for (const g of groups) {
    for (const r of g.rows) {
      idSet.add(r.id);
    }
  }

  for (const id of sel) {
    if (!idSet.has(id)) {
      return { error: `Invalid selection: row id ${id} is not in the loaded duplicate set.` };
    }
  }

  for (const g of groups) {
    const ids = g.rows.map((r) => r.id);
    const err = validateGroupDeletion(ids, sel);
    if (err) return { error: err };
  }

  const { error } = await supabase.from('prdn_work_reporting').delete().in('id', [...sel]);

  if (error) {
    return { error: error.message };
  }

  // After deleting duplicates, clear piece-rate derived fields for same WO + work combinations.
  const planningIdsForSelection = [
    ...new Set(
      groups
        .flatMap((g) => g.rows)
        .filter((r) => sel.has(r.id))
        .map((r) => Number(r.planning_id))
        .filter((n) => Number.isFinite(n))
    )
  ];
  const nullifyResult = await nullifyReportPieceRateForWorkCombinations(planningIdsForSelection);
  if (nullifyResult.error) {
    return {
      error: `Deleted ${sel.size} row(s), but failed to clear piece-rate fields for related work combinations: ${nullifyResult.error}`
    };
  }

  return { deleted: sel.size };
}
