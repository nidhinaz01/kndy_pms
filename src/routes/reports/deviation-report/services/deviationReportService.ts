/**
 * Combined deviation report: planning deviations + reporting deviations (each reporting deviation → 2 rows: Plan context + Report context).
 * Filter: parent plan/report window overlaps [fromDate, toDate] via from_date / to_date.
 */

import { supabase } from '$lib/supabaseClient';
import { batchEnrichItems } from '$lib/utils/workEnrichmentService';
import { isoRangesOverlap } from '$lib/utils/reportDateRange';

const PAGE_SIZE = 500;
const IN_CHUNK = 80;

/** Which timing/worker leg this line represents (not the DB table name). */
export type DeviationRowContext = 'Plan' | 'Report';

export interface DeviationReportRow {
  /** Plan = planned window/worker; Report = reported window/worker (reporting deviations emit both). */
  rowContext: DeviationRowContext;
  deviationId: number;
  deviationType: string;
  reason: string;
  createdBy: string | null;
  createdDt: string | null;
  modifiedBy: string | null;
  modifiedDt: string | null;
  woNo: string | null;
  pwoNo: string | null;
  customerName: string | null;
  workCode: string | null;
  workNameDetails: string | null;
  skillCompetency: string | null;
  /** Standard time for this line: plan context → skill standard minutes; report context → pr_std_time when set. */
  stdTimeDisplay: string | null;
  stageCode: string | null;
  shiftCode: string | null;
  workerId: string | null;
  workerName: string | null;
  skillShort: string | null;
  /** Context window start date (ISO yyyy-mm-dd) for display as dd-MMM-yyyy. */
  dateIso: string | null;
  derivedSwCode: string | null;
  otherWorkCode: string | null;
  reportStatus: string | null;
  completionStatus: string | null;
}

/** Standard time as "x Hr y Min" (total minutes). */
function formatStdTimeHrMin(mins: number | null | undefined): string | null {
  if (mins == null || Number.isNaN(Number(mins))) return null;
  const total = Math.max(0, Math.round(Number(mins)));
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${h} Hr ${m} Min`;
}

interface PlanningEnrichSlice {
  /** Resolved minutes: skill time standard → vehicle flow estimate → planned hours (×60). */
  standardTimeMinutes: number | null;
  /** Matched mapping for this plan/worker (single); used only if no full work-type list exists. */
  skillCompetencyLabel: string | null;
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
    const code = workCodeFromPlan(p);
    return code;
  }
  const swd = Array.isArray(swt.std_work_details) ? swt.std_work_details[0] : swt.std_work_details;
  const swName = swd?.sw_name ? String(swd.sw_name) : '';
  const desc = swt.type_description ? String(swt.type_description) : '';
  const parts = [swName, desc].filter(Boolean);
  if (parts.length) return parts.join(' — ');
  return swt.sw_code ? String(swt.sw_code) : workCodeFromPlan(p);
}

/** All sc_name values returned on the plan embed (comma-separated, sorted). */
function skillCompetencyAllFromPlanEmbed(p: any): string | null {
  const sm = p?.std_work_skill_mapping;
  if (!sm) return null;
  const arr = Array.isArray(sm) ? sm : [sm];
  const names = [...new Set(arr.map((x: any) => x?.sc_name).filter(Boolean))] as string[];
  return names.length ? names.sort((a, b) => a.localeCompare(b)).join(', ') : null;
}

/** Every active competency label for each standard work code (avoids showing only one mapping or sc_required). */
async function fetchAllSkillCompetencyLabelsByDerivedSwCode(derivedSwCodes: string[]): Promise<Map<string, string>> {
  const aggregate = new Map<string, Set<string>>();
  const unique = [...new Set(derivedSwCodes.filter(Boolean))];
  if (unique.length === 0) return new Map();

  const CHUNK = 80;
  for (let i = 0; i < unique.length; i += CHUNK) {
    const chunk = unique.slice(i, i + CHUNK);
    const { data, error } = await supabase
      .from('std_work_skill_mapping')
      .select('derived_sw_code, sc_name')
      .in('derived_sw_code', chunk)
      .eq('is_deleted', false)
      .eq('is_active', true);

    if (error) throw error;
    for (const row of data || []) {
      const c = row.derived_sw_code as string | null;
      const name = row.sc_name as string | null;
      if (!c || !name?.trim()) continue;
      if (!aggregate.has(c)) aggregate.set(c, new Set());
      aggregate.get(c)!.add(name.trim());
    }
  }

  const result = new Map<string, string>();
  aggregate.forEach((set, c) => {
    result.set(c, [...set].sort((a, b) => a.localeCompare(b)).join(', '));
  });
  return result;
}

const PLANNING_SELECT_EXTRA = `
          id,
          wo_details_id,
          stage_code,
          shift_code,
          worker_id,
          sc_required,
          wsm_id,
          planned_hours,
          from_date,
          from_time,
          to_date,
          to_time,
          derived_sw_code,
          other_work_code,
          prdn_wo_details ( wo_no, pwo_no, customer_name ),
          hr_emp ( emp_id, emp_name, skill_short ),
          std_work_type_details ( derived_sw_code, sw_code, type_description, std_work_details ( sw_name ) ),
          std_work_skill_mapping ( wsm_id, sc_name )
`;

async function fetchPlanningIdsOverlappingRange(fromDate: string, toDate: string): Promise<number[]> {
  const ids: number[] = [];
  let offset = 0;
  while (true) {
    const { data, error } = await supabase
      .from('prdn_work_planning')
      .select('id')
      .lte('from_date', toDate)
      .gte('to_date', fromDate)
      .eq('is_deleted', false)
      .order('id', { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) throw error;
    const page = data || [];
    for (const r of page) {
      if (r.id != null) ids.push(r.id);
    }
    if (page.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }
  return ids;
}

async function fetchReportingIdsOverlappingRange(fromDate: string, toDate: string): Promise<number[]> {
  const ids: number[] = [];
  let offset = 0;
  while (true) {
    const { data, error } = await supabase
      .from('prdn_work_reporting')
      .select('id')
      .lte('from_date', toDate)
      .gte('to_date', fromDate)
      .eq('is_deleted', false)
      .order('id', { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) throw error;
    const page = data || [];
    for (const r of page) {
      if (r.id != null) ids.push(r.id);
    }
    if (page.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }
  return ids;
}

/** Map planning.id → standard minutes + skill competency label from batch enrich (matches production planning logic). */
async function planningEnrichmentByPlanningId(plannings: any[]): Promise<Map<number, PlanningEnrichSlice>> {
  const map = new Map<number, PlanningEnrichSlice>();
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
        const p = items[i];
        const id = p?.id;
        if (id == null) return;

        let mins: number | null = e?.skillTimeStandard?.standard_time_minutes ?? null;
        if (mins == null && e?.vehicleWorkFlow?.estimated_duration_minutes != null) {
          const v = Number(e.vehicleWorkFlow.estimated_duration_minutes);
          if (!Number.isNaN(v)) mins = Math.round(v);
        }
        if (mins == null && p?.planned_hours != null) {
          const ph = Number(p.planned_hours);
          if (!Number.isNaN(ph)) mins = Math.round(ph * 60);
        }

        const scm = e?.skillMapping;
        const comp = scm?.sc_name != null && String(scm.sc_name).trim() !== '' ? String(scm.sc_name) : null;
        map.set(id, { standardTimeMinutes: mins, skillCompetencyLabel: comp });
      });
    } catch (e) {
      console.warn('Deviation report: batch enrich failed for stage', stage, e);
    }
  }

  return map;
}

function buildCommonWorkFields(
  p: any,
  wo: ReturnType<typeof pickWo>,
  enrich: PlanningEnrichSlice | null,
  skillLabelsBySwCode: Map<string, string>
) {
  const derived = p?.derived_sw_code ? String(p.derived_sw_code) : '';
  const allForStdWork = derived && skillLabelsBySwCode.has(derived) ? skillLabelsBySwCode.get(derived)! : '';
  const embedAll = skillCompetencyAllFromPlanEmbed(p);
  const enrichComp = enrich?.skillCompetencyLabel ?? null;

  let skillCompetency: string | null = null;
  if (allForStdWork.trim()) skillCompetency = allForStdWork.trim();
  else if (embedAll?.trim()) skillCompetency = embedAll.trim();
  else if (enrichComp?.trim()) skillCompetency = enrichComp.trim();

  return {
    woNo: wo.woNo,
    pwoNo: wo.pwoNo,
    customerName: wo.customerName,
    workCode: workCodeFromPlan(p),
    workNameDetails: workNameDetailsFromPlan(p),
    skillCompetency,
    stageCode: p?.stage_code ?? null,
    shiftCode: p?.shift_code ?? null,
    derivedSwCode: p?.derived_sw_code ?? null,
    otherWorkCode: p?.other_work_code ?? null
  };
}

async function fetchPlanDeviationsForPlanningIds(
  planningIds: number[],
  rangeFrom: string,
  rangeTo: string,
  enrichByPlanId: Map<number, PlanningEnrichSlice>,
  skillLabelsBySwCode: Map<string, string>
): Promise<DeviationReportRow[]> {
  if (planningIds.length === 0) return [];
  const out: DeviationReportRow[] = [];

  for (let i = 0; i < planningIds.length; i += IN_CHUNK) {
    const chunk = planningIds.slice(i, i + IN_CHUNK);
    const { data, error } = await supabase
      .from('prdn_work_planning_deviations')
      .select(
        `
        id,
        planning_id,
        deviation_type,
        reason,
        created_by,
        created_dt,
        modified_by,
        modified_dt,
        prdn_work_planning!inner (
          ${PLANNING_SELECT_EXTRA}
        )
      `
      )
      .in('planning_id', chunk)
      .eq('is_deleted', false)
      .eq('is_active', true);

    if (error) throw error;

    for (const row of data || []) {
      const p = row.prdn_work_planning as any;
      if (!p) continue;
      if (!isoRangesOverlap(rangeFrom, rangeTo, p.from_date, p.to_date)) continue;

      const wo = pickWo(
        Array.isArray(p.prdn_wo_details) ? p.prdn_wo_details[0] : p.prdn_wo_details
      );
      const emp = pickEmp(Array.isArray(p.hr_emp) ? p.hr_emp[0] : p.hr_emp);
      const enrich = enrichByPlanId.get(p.id) ?? null;
      const common = buildCommonWorkFields(p, wo, enrich, skillLabelsBySwCode);

      out.push({
        rowContext: 'Plan',
        deviationId: row.id,
        deviationType: String(row.deviation_type ?? ''),
        reason: String(row.reason ?? ''),
        createdBy: row.created_by ?? null,
        createdDt: row.created_dt ?? null,
        modifiedBy: row.modified_by ?? null,
        modifiedDt: row.modified_dt ?? null,
        ...common,
        stdTimeDisplay: formatStdTimeHrMin(enrich?.standardTimeMinutes ?? null),
        workerId: emp.workerId ?? p.worker_id ?? null,
        workerName: emp.workerName,
        skillShort: emp.skillShort,
        dateIso: p.from_date ?? null,
        reportStatus: null,
        completionStatus: null
      });
    }
  }

  return out;
}

async function fetchReportDeviationsForReportingIds(
  reportingIds: number[],
  rangeFrom: string,
  rangeTo: string,
  enrichByPlanId: Map<number, PlanningEnrichSlice>,
  skillLabelsBySwCode: Map<string, string>
): Promise<DeviationReportRow[]> {
  if (reportingIds.length === 0) return [];
  const out: DeviationReportRow[] = [];

  for (let i = 0; i < reportingIds.length; i += IN_CHUNK) {
    const chunk = reportingIds.slice(i, i + IN_CHUNK);
    const { data, error } = await supabase
      .from('prdn_work_reporting_deviations')
      .select(
        `
        id,
        reporting_id,
        planning_id,
        deviation_type,
        reason,
        created_by,
        created_dt,
        modified_by,
        modified_dt,
        prdn_work_reporting!inner (
          id,
          worker_id,
          from_date,
          from_time,
          to_date,
          to_time,
          status,
          completion_status,
          pr_std_time,
          hr_emp ( emp_id, emp_name, skill_short ),
          prdn_work_planning!inner (
            ${PLANNING_SELECT_EXTRA}
          )
        )
      `
      )
      .in('reporting_id', chunk)
      .eq('is_deleted', false)
      .eq('is_active', true);

    if (error) throw error;

    for (const row of data || []) {
      const r = row.prdn_work_reporting as any;
      if (!r) continue;
      if (!isoRangesOverlap(rangeFrom, rangeTo, r.from_date, r.to_date)) continue;

      const p = r.prdn_work_planning as any;
      if (!p) continue;

      const wo = pickWo(
        Array.isArray(p.prdn_wo_details) ? p.prdn_wo_details[0] : p.prdn_wo_details
      );
      const planEmp = pickEmp(Array.isArray(p.hr_emp) ? p.hr_emp[0] : p.hr_emp);
      const reportEmp = pickEmp(Array.isArray(r.hr_emp) ? r.hr_emp[0] : r.hr_emp);
      const enrich = enrichByPlanId.get(p.id) ?? null;
      const common = buildCommonWorkFields(p, wo, enrich, skillLabelsBySwCode);

      const audit = {
        deviationId: row.id,
        deviationType: String(row.deviation_type ?? ''),
        reason: String(row.reason ?? ''),
        createdBy: row.created_by ?? null,
        createdDt: row.created_dt ?? null,
        modifiedBy: row.modified_by ?? null,
        modifiedDt: row.modified_dt ?? null
      };

      // 1) Plan context row (planned window & planned worker; std time from skill standard)
      out.push({
        rowContext: 'Plan',
        ...audit,
        ...common,
        stdTimeDisplay: formatStdTimeHrMin(enrich?.standardTimeMinutes ?? null),
        workerId: planEmp.workerId ?? p.worker_id ?? null,
        workerName: planEmp.workerName,
        skillShort: planEmp.skillShort,
        dateIso: p.from_date ?? null,
        reportStatus: null,
        completionStatus: null
      });

      // 2) Report context row (reported window & reported worker; std time from pr_std_time, else plan skill standard)
      const reportStdDisplay =
        formatStdTimeHrMin(r.pr_std_time) ?? formatStdTimeHrMin(enrich?.standardTimeMinutes ?? null);

      out.push({
        rowContext: 'Report',
        ...audit,
        ...common,
        stdTimeDisplay: reportStdDisplay,
        workerId: reportEmp.workerId ?? r.worker_id ?? null,
        workerName: reportEmp.workerName,
        skillShort: reportEmp.skillShort,
        dateIso: r.from_date ?? null,
        reportStatus: r.status ?? null,
        completionStatus: r.completion_status ?? null
      });
    }
  }

  return out;
}

async function collectPlanningsForEnrichment(
  planningIds: number[],
  reportingIds: number[],
  rangeFrom: string,
  rangeTo: string
): Promise<any[]> {
  const collected: any[] = [];
  const seen = new Set<number>();

  for (let i = 0; i < planningIds.length; i += IN_CHUNK) {
    const chunk = planningIds.slice(i, i + IN_CHUNK);
    const { data, error } = await supabase
      .from('prdn_work_planning_deviations')
      .select(`prdn_work_planning!inner ( ${PLANNING_SELECT_EXTRA} )`)
      .in('planning_id', chunk)
      .eq('is_deleted', false)
      .eq('is_active', true);
    if (error) throw error;
    for (const row of data || []) {
      const p = row.prdn_work_planning as any;
      if (!p?.id) continue;
      if (!isoRangesOverlap(rangeFrom, rangeTo, p.from_date, p.to_date)) continue;
      if (!seen.has(p.id)) {
        seen.add(p.id);
        collected.push(p);
      }
    }
  }

  for (let i = 0; i < reportingIds.length; i += IN_CHUNK) {
    const chunk = reportingIds.slice(i, i + IN_CHUNK);
    const { data, error } = await supabase
      .from('prdn_work_reporting_deviations')
      .select(
        `prdn_work_reporting!inner ( from_date, to_date, prdn_work_planning!inner ( ${PLANNING_SELECT_EXTRA} ) )`
      )
      .in('reporting_id', chunk)
      .eq('is_deleted', false)
      .eq('is_active', true);
    if (error) throw error;
    for (const row of data || []) {
      const r = row.prdn_work_reporting as any;
      const p = r?.prdn_work_planning;
      if (!p?.id || !r) continue;
      if (!isoRangesOverlap(rangeFrom, rangeTo, r.from_date, r.to_date)) continue;
      if (!seen.has(p.id)) {
        seen.add(p.id);
        collected.push(p);
      }
    }
  }

  return collected;
}

export async function loadDeviationReport(from: string, to: string): Promise<DeviationReportRow[]> {
  const fromDate = from.split('T')[0];
  const toDate = to.split('T')[0];

  const [planningIds, reportingIds] = await Promise.all([
    fetchPlanningIdsOverlappingRange(fromDate, toDate),
    fetchReportingIdsOverlappingRange(fromDate, toDate)
  ]);

  const uniquePlanIds = [...new Set(planningIds)];
  const uniqueReportIds = [...new Set(reportingIds)];

  const planningsToEnrich = await collectPlanningsForEnrichment(
    uniquePlanIds,
    uniqueReportIds,
    fromDate,
    toDate
  );
  const derivedCodes = [
    ...new Set(
      planningsToEnrich.map((p) => p?.derived_sw_code).filter((c): c is string => Boolean(c))
    )
  ];
  const [skillLabelsBySwCode, enrichByPlanId] = await Promise.all([
    fetchAllSkillCompetencyLabelsByDerivedSwCode(derivedCodes),
    planningEnrichmentByPlanningId(planningsToEnrich)
  ]);

  const [planRows, reportRows] = await Promise.all([
    fetchPlanDeviationsForPlanningIds(uniquePlanIds, fromDate, toDate, enrichByPlanId, skillLabelsBySwCode),
    fetchReportDeviationsForReportingIds(uniqueReportIds, fromDate, toDate, enrichByPlanId, skillLabelsBySwCode)
  ]);

  const merged = [...planRows, ...reportRows];
  merged.sort((a, b) => {
    const dd = (b.dateIso || '').localeCompare(a.dateIso || '');
    if (dd !== 0) return dd;
    if (a.deviationId !== b.deviationId) return (b.deviationId || 0) - (a.deviationId || 0);
    if (a.rowContext !== b.rowContext) return a.rowContext === 'Plan' ? -1 : 1;
    return 0;
  });

  return merged;
}
