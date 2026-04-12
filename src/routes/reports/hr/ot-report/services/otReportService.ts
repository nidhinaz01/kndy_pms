/**
 * Overtime report: work reporting rows with overtime in the selected window (max ~3 months).
 * Overlap: report from_date / to_date vs range; worker must have a name (same idea as Lost Time report).
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

export interface OtReportRow {
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

export async function loadOtReport(fromDate: string, toDate: string): Promise<OtReportRow[]> {
  const fromD = fromDate.split('T')[0];
  const toD = toDate.split('T')[0];
  const raw: Array<{ row: OtReportRow; sortFrom: string; sortCreated: string }> = [];
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
      const wo = pickWo(p ? (Array.isArray(p.prdn_wo_details) ? p.prdn_wo_details[0] : p.prdn_wo_details) : null);
      const emp = pickEmp(Array.isArray(row.hr_emp) ? row.hr_emp[0] : row.hr_emp);
      const workerName = emp.workerName?.trim() || '';
      if (!workerName) continue;

      raw.push({
        sortFrom: row.from_date ?? '',
        sortCreated: row.created_dt ?? '',
        row: {
          woNo: wo.woNo,
          pwoNo: wo.pwoNo,
          customerName: wo.customerName,
          workCode: workCodeFromPlan(p),
          workNameDetails: workNameDetailsFromPlan(p),
          stageCode: p?.stage_code ?? null,
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

  raw.sort((a, b) => {
    const rd = (b.sortFrom || '').localeCompare(a.sortFrom || '');
    if (rd !== 0) return rd;
    return (b.sortCreated || '').localeCompare(a.sortCreated || '');
  });

  return raw.map((x) => x.row);
}
