/**
 * Non-standard overtime report:
 * Same as OT report, but includes only work codes that do NOT start with P/M/C.
 */

import { supabase } from '$lib/supabaseClient';
import { isoRangesOverlap } from '$lib/utils/reportDateRange';

const PAGE_SIZE = 300;

const PLANNING_EMBED = `
          id,
          wo_details_id,
          stage_code,
          shift_code,
          worker_id,
          derived_sw_code,
          other_work_code,
          prdn_wo_details ( wo_no, pwo_no, customer_name ),
          hr_emp ( emp_id, emp_name, skill_short ),
          std_work_type_details ( derived_sw_code, sw_code, type_description, std_work_details ( sw_name ) )
`;

export interface NonStdOtReportRow {
  woNo: string | null;
  pwoNo: string | null;
  customerName: string | null;
  workCode: string | null;
  workNameDetails: string | null;
  stageCode: string | null;
  shiftCode: string | null;
  workerId: string | null;
  workerName: string | null;
  skillShort: string | null;
  reportFromDate: string | null;
  reportFromTime: string | null;
  reportToDate: string | null;
  reportToTime: string | null;
  overtimeMinutes: number | null;
  overtimeAmount: number | null;
  status: string | null;
  completionStatus: string | null;
  createdBy: string | null;
  createdDt: string | null;
}

export async function loadNonStdOtReportStages(): Promise<string[]> {
  const { data, error } = await supabase
    .from('sys_data_elements')
    .select('de_value')
    .eq('de_name', 'Plant-Stage')
    .eq('is_active', true)
    .eq('is_deleted', false)
    .order('de_value', { ascending: true });

  if (error) throw error;
  const unique = new Set<string>();
  for (const item of data || []) {
    const value = item?.de_value != null ? String(item.de_value).trim() : '';
    if (value) unique.add(value);
  }
  return [...unique].sort((a, b) => a.localeCompare(b));
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

function isNonStandardCode(code: string | null): boolean {
  const normalized = (code || '').trim().toUpperCase();
  if (!normalized) return false;
  const first = normalized.charAt(0);
  return first !== 'P' && first !== 'M' && first !== 'C';
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

export async function loadNonStdOtReport(fromDate: string, toDate: string, stage: string): Promise<NonStdOtReportRow[]> {
  const fromD = fromDate.split('T')[0];
  const toD = toDate.split('T')[0];
  const raw: Array<{
    row: NonStdOtReportRow;
    sortFromDate: string;
    sortFromTime: string;
    sortToDate: string;
    sortToTime: string;
    sortWorker: string;
    sortCreated: string;
    woDetailsId: number | null;
    otherWorkCode: string | null;
  }> = [];
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
        overtime_minutes,
        overtime_amount,
        status,
        completion_status,
        created_by,
        created_dt,
        hr_emp ( emp_id, emp_name, skill_short ),
        prdn_work_planning!inner (
          ${PLANNING_EMBED}
        )
      `
      )
      .lte('from_date', toD)
      .gte('to_date', fromD)
      .eq('is_deleted', false)
      .not('overtime_minutes', 'is', null)
      .in('status', ['draft', 'pending_approval', 'approved'])
      .order('id', { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) throw error;
    const page = data || [];
    if (page.length === 0) break;

    for (const row of page as any[]) {
      const ot = row.overtime_minutes != null ? Number(row.overtime_minutes) : 0;
      if (!Number.isFinite(ot) || ot <= 0) continue;

      if (!isoRangesOverlap(fromD, toD, row.from_date, row.to_date)) continue;

      const p = row.prdn_work_planning;
      const rowStage = p?.stage_code != null ? String(p.stage_code) : null;
      if (stage !== 'All' && rowStage !== stage) continue;
      const workCode = workCodeFromPlan(p);
      if (!isNonStandardCode(workCode)) continue;

      const wo = pickWo(p ? (Array.isArray(p.prdn_wo_details) ? p.prdn_wo_details[0] : p.prdn_wo_details) : null);
      const emp = pickEmp(Array.isArray(row.hr_emp) ? row.hr_emp[0] : row.hr_emp);
      const workerName = emp.workerName?.trim() || '';
      if (!workerName) continue;

      raw.push({
        sortFromDate: row.from_date ?? '',
        sortFromTime: row.from_time ?? '',
        sortToDate: row.to_date ?? '',
        sortToTime: row.to_time ?? '',
        sortWorker: workerName.toLowerCase(),
        sortCreated: row.created_dt ?? '',
        woDetailsId: p?.wo_details_id ?? null,
        otherWorkCode: p?.other_work_code ? String(p.other_work_code) : null,
        row: {
          woNo: wo.woNo,
          pwoNo: wo.pwoNo,
          customerName: wo.customerName,
          workCode,
          workNameDetails: workNameDetailsFromPlan(p),
          stageCode: rowStage,
          shiftCode: p?.shift_code ?? null,
          workerId: emp.workerId ?? row.worker_id ?? null,
          workerName: emp.workerName,
          skillShort: emp.skillShort,
          reportFromDate: row.from_date ?? null,
          reportFromTime: row.from_time ?? null,
          reportToDate: row.to_date ?? null,
          reportToTime: row.to_time ?? null,
          overtimeMinutes: ot,
          overtimeAmount: row.overtime_amount != null ? Number(row.overtime_amount) : null,
          status: row.status ?? null,
          completionStatus: row.completion_status ?? null,
          createdBy: row.created_by ?? null,
          createdDt: row.created_dt ?? null
        }
      });
    }

    if (page.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  // Resolve "Other Work" names from prdn_work_additions.other_work_desc by (wo_details_id + other_work_code).
  const otherPairs = raw
    .filter((x) => x.woDetailsId != null && x.otherWorkCode)
    .map((x) => ({ woDetailsId: x.woDetailsId as number, otherWorkCode: x.otherWorkCode as string }));
  if (otherPairs.length > 0) {
    const woIds = Array.from(new Set(otherPairs.map((x) => x.woDetailsId)));
    const codes = Array.from(new Set(otherPairs.map((x) => x.otherWorkCode)));
    const { data: additions, error: additionsError } = await supabase
      .from('prdn_work_additions')
      .select('wo_details_id, other_work_code, other_work_desc')
      .in('wo_details_id', woIds)
      .in('other_work_code', codes);

    if (!additionsError && additions) {
      const descMap = new Map<string, string>();
      for (const a of additions as Array<{ wo_details_id: number; other_work_code: string; other_work_desc?: string | null }>) {
        const key = `${a.wo_details_id}_${a.other_work_code}`;
        const desc = (a.other_work_desc || '').trim();
        if (desc) descMap.set(key, desc);
      }
      for (const item of raw) {
        if (item.woDetailsId == null || !item.otherWorkCode) continue;
        const key = `${item.woDetailsId}_${item.otherWorkCode}`;
        const desc = descMap.get(key);
        if (desc) item.row.workNameDetails = desc;
      }
    }
  }

  raw.sort((a, b) => {
    const fromDateCmp = (b.sortFromDate || '').localeCompare(a.sortFromDate || '');
    if (fromDateCmp !== 0) return fromDateCmp;
    const fromTimeCmp = (b.sortFromTime || '').localeCompare(a.sortFromTime || '');
    if (fromTimeCmp !== 0) return fromTimeCmp;
    const workerCmp = (a.sortWorker || '').localeCompare(b.sortWorker || '');
    if (workerCmp !== 0) return workerCmp;
    return (b.sortCreated || '').localeCompare(a.sortCreated || '');
  });

  return raw.map((x) => x.row);
}
