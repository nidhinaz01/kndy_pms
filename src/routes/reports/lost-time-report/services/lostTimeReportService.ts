/**
 * Lost time report: one row per lt_details line on work reports (worker must have a name).
 * Filter: report from_date/to_date overlaps range; lt_details non-null with ≥1 line.
 */

import { supabase } from '$lib/supabaseClient';
import { batchEnrichItems } from '$lib/utils/workEnrichmentService';
import { isoRangesOverlap } from '$lib/utils/reportDateRange';

const PAGE_SIZE = 300;

const PLANNING_SELECT_EXTRA = `
          id,
          wo_details_id,
          stage_code,
          shift_code,
          worker_id,
          sc_required,
          wsm_id,
          derived_sw_code,
          other_work_code,
          prdn_wo_details ( wo_no, pwo_no, customer_name ),
          hr_emp ( emp_id, emp_name, skill_short ),
          std_work_type_details ( derived_sw_code, sw_code, type_description, std_work_details ( sw_name ) ),
          std_work_skill_mapping ( wsm_id, sc_name )
`;

export interface LostTimeReportRow {
  woNo: string | null;
  pwoNo: string | null;
  customerName: string | null;
  workCode: string | null;
  workNameDetails: string | null;
  skillCompetency: string | null;
  stdTimeDisplay: string | null;
  stageCode: string | null;
  shiftCode: string | null;
  workerId: string | null;
  workerName: string | null;
  skillShort: string | null;
  reportFromDate: string | null;
  reportFromTime: string | null;
  reportToDate: string | null;
  reportToTime: string | null;
  ltMinutesLine: number | null;
  ltReason: string | null;
  isLtPayable: boolean | null;
  ltValue: number | null;
  ltMinutesTotal: number | null;
  ltComments: string | null;
  status: string | null;
  completionStatus: string | null;
  createdBy: string | null;
  createdDt: string | null;
  modifiedBy: string | null;
  modifiedDt: string | null;
}

interface LtDetailEntry {
  lt_minutes?: number;
  lt_reason?: string;
  is_lt_payable?: boolean;
  lt_value?: number;
  lt_total?: number;
}

function formatStdTimeHrMin(mins: number | null | undefined): string | null {
  if (mins == null || Number.isNaN(Number(mins))) return null;
  const total = Math.max(0, Math.round(Number(mins)));
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${h} Hr ${m} Min`;
}

function parseLtLines(raw: unknown): LtDetailEntry[] {
  if (raw == null) return [];
  if (!Array.isArray(raw)) return [];
  return raw.filter((x) => x && typeof x === 'object') as LtDetailEntry[];
}

function pickWo(row: { wo_no?: string | null; pwo_no?: string | null; customer_name?: string | null } | null) {
  if (!row) return { woNo: null as string | null, pwoNo: null as string | null, customerName: null as string | null };
  return {
    woNo: row.wo_no ?? null,
    pwoNo: row.pwo_no ?? null,
    customerName: row.customer_name ?? null
  };
}

function pickEmp(row: { emp_id?: string | null; emp_name?: string | null; skill_short?: string | null } | null) {
  if (!row) return { workerId: null as string | null, workerName: null as string | null, skillShort: null as string | null };
  return {
    workerId: row.emp_id ?? null,
    workerName: row.emp_name ?? null,
    skillShort: row.skill_short ?? null
  };
}

function workCodeFromPlan(p: any): string | null {
  const v = p?.derived_sw_code || p?.other_work_code;
  return v ? String(v) : null;
}

function workNameDetailsFromPlan(p: any): string | null {
  const swt = p?.std_work_type_details;
  if (!swt) {
    return workCodeFromPlan(p);
  }
  const swd = Array.isArray(swt.std_work_details) ? swt.std_work_details[0] : swt.std_work_details;
  const swName = swd?.sw_name ? String(swd.sw_name) : '';
  const desc = swt.type_description ? String(swt.type_description) : '';
  const parts = [swName, desc].filter(Boolean);
  if (parts.length) return parts.join(' — ');
  return swt.sw_code ? String(swt.sw_code) : workCodeFromPlan(p);
}

function skillCompetencyFromPlan(p: any): string | null {
  const sm = p?.std_work_skill_mapping;
  if (!sm) return null;
  const arr = Array.isArray(sm) ? sm : [sm];
  const names = [...new Set(arr.map((x: any) => x?.sc_name).filter(Boolean))] as string[];
  return names.length ? names.join(', ') : null;
}

async function stdTimeMinutesByPlanningId(plannings: any[]): Promise<Map<number, number | null>> {
  const map = new Map<number, number | null>();
  if (plannings.length === 0) return map;

  const byStage = new Map<string, Map<number, any>>();
  for (const p of plannings) {
    if (!p?.id || !p.stage_code) continue;
    if (!byStage.has(p.stage_code)) byStage.set(p.stage_code, new Map());
    byStage.get(p.stage_code)!.set(p.id, p);
  }

  for (const [stage, idMap] of byStage) {
    const items = [...idMap.values()];
    if (items.length === 0) continue;
    try {
      const enriched = await batchEnrichItems(items, stage);
      enriched.forEach((e, i) => {
        const id = items[i]?.id;
        if (id == null) return;
        const mins = e?.skillTimeStandard?.standard_time_minutes ?? null;
        map.set(id, mins);
      });
    } catch (e) {
      console.warn('Lost time report: batch enrich failed for stage', stage, e);
    }
  }

  return map;
}

function buildCommonWorkFields(p: any, wo: ReturnType<typeof pickWo>) {
  return {
    woNo: wo.woNo,
    pwoNo: wo.pwoNo,
    customerName: wo.customerName,
    workCode: workCodeFromPlan(p),
    workNameDetails: workNameDetailsFromPlan(p),
    skillCompetency: skillCompetencyFromPlan(p),
    stageCode: p?.stage_code ?? null,
    shiftCode: p?.shift_code ?? null
  };
}

export async function loadLostTimeReport(fromDate: string, toDate: string): Promise<LostTimeReportRow[]> {
  const fromD = fromDate.split('T')[0];
  const toD = toDate.split('T')[0];
  const raw: Array<{ row: LostTimeReportRow; sortFrom: string; sortCreated: string }> = [];
  let offset = 0;

  while (true) {
    const { data, error } = await supabase
      .from('prdn_work_reporting')
      .select(
        `
        id,
        planning_id,
        worker_id,
        from_date,
        from_time,
        to_date,
        to_time,
        pr_std_time,
        lt_minutes_total,
        lt_details,
        lt_comments,
        status,
        completion_status,
        created_by,
        created_dt,
        modified_by,
        modified_dt,
        hr_emp ( emp_id, emp_name, skill_short ),
        prdn_work_planning!inner (
          ${PLANNING_SELECT_EXTRA}
        )
      `
      )
      .lte('from_date', toD)
      .gte('to_date', fromD)
      .eq('is_deleted', false)
      .not('lt_details', 'is', null)
      .order('id', { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) throw error;
    const page = data || [];
    if (page.length === 0) break;

    const uniquePlannings: any[] = [];
    const seenPlan = new Set<number>();
    for (const row of page as any[]) {
      const p = row.prdn_work_planning;
      if (p?.id != null && !seenPlan.has(p.id)) {
        seenPlan.add(p.id);
        uniquePlannings.push(p);
      }
    }
    const stdByPlanId = await stdTimeMinutesByPlanningId(uniquePlannings);

    for (const row of page as any[]) {
      if (!isoRangesOverlap(fromD, toD, row.from_date, row.to_date)) continue;

      const lines = parseLtLines(row.lt_details);
      if (lines.length === 0) continue;

      const p = row.prdn_work_planning;
      const wo = pickWo(
        p ? (Array.isArray(p.prdn_wo_details) ? p.prdn_wo_details[0] : p.prdn_wo_details) : null
      );
      const emp = pickEmp(Array.isArray(row.hr_emp) ? row.hr_emp[0] : row.hr_emp);
      const workerName = emp.workerName?.trim() || '';
      if (!workerName) continue;

      const common = buildCommonWorkFields(p, wo);
      const planStdMins = p?.id != null ? stdByPlanId.get(p.id) ?? null : null;
      const stdTimeDisplay =
        formatStdTimeHrMin(row.pr_std_time) ?? formatStdTimeHrMin(planStdMins);

      lines.forEach((line) => {
        raw.push({
          sortFrom: row.from_date ?? '',
          sortCreated: row.created_dt ?? '',
          row: {
            ...common,
            stdTimeDisplay,
            workerId: emp.workerId ?? row.worker_id ?? null,
            workerName: emp.workerName,
            skillShort: emp.skillShort,
            reportFromDate: row.from_date ?? null,
            reportFromTime: row.from_time ?? null,
            reportToDate: row.to_date ?? null,
            reportToTime: row.to_time ?? null,
            ltMinutesLine: line.lt_minutes ?? null,
            ltReason: line.lt_reason ?? null,
            isLtPayable: line.is_lt_payable ?? null,
            ltValue: line.lt_value ?? null,
            ltMinutesTotal: row.lt_minutes_total ?? null,
            ltComments: row.lt_comments ?? null,
            status: row.status ?? null,
            completionStatus: row.completion_status ?? null,
            createdBy: row.created_by ?? null,
            createdDt: row.created_dt ?? null,
            modifiedBy: row.modified_by ?? null,
            modifiedDt: row.modified_dt ?? null
          }
        });
      });
    }

    if (page.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  raw.sort((a, b) => {
    const rd = (b.sortFrom || '').localeCompare(a.sortFrom || '');
    if (rd !== 0) return rd;
    return (b.sortCreated || '').localeCompare(a.sortCreated || '');
  });

  return raw.map((x) => x.row);
}
