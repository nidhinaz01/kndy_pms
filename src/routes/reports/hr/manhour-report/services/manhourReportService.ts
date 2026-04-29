import { supabase } from '$lib/supabaseClient';
import { eachIsoDateInclusive } from '$lib/utils/reportDateRange';

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

export interface ManhourPivotRow {
  workerId: string;
  workerName: string | null;
  skillShort: string | null;
  cells: Record<string, number>;
  totalHours: number;
}

export interface ManhourPivotReport {
  dates: string[];
  rows: ManhourPivotRow[];
}

export async function loadManhourReportStages(): Promise<string[]> {
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

export async function loadManhourPivotReport(fromDate: string, toDate: string, stage: string): Promise<ManhourPivotReport> {
  const fromD = fromDate.split('T')[0];
  const toD = toDate.split('T')[0];
  const dates = eachIsoDateInclusive(fromD, toD);

  const grouped = new Map<
    string,
    {
      workerId: string;
      workerName: string | null;
      skillShort: string | null;
      cells: Record<string, number>;
    }
  >();

  let offset = 0;
  while (true) {
    const { data, error } = await supabase
      .from('prdn_work_reporting')
      .select(
        `
        id,
        worker_id,
        from_date,
        hours_worked_today,
        hr_emp ( emp_id, emp_name, skill_short ),
        prdn_work_planning!inner ( stage_code )
      `
      )
      .gte('from_date', fromD)
      .lte('from_date', toD)
      .not('worker_id', 'is', null)
      .eq('is_deleted', false)
      .in('status', ['draft', 'pending_approval', 'approved'])
      .order('id', { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) throw error;
    const page = data || [];
    if (page.length === 0) break;

    for (const row of page as any[]) {
      const plan = row.prdn_work_planning;
      const rowStage = plan?.stage_code != null ? String(plan.stage_code) : null;
      if (stage !== 'All' && rowStage !== stage) continue;

      const dateKey = row.from_date ? String(row.from_date).split('T')[0] : '';
      if (!dateKey || !dates.includes(dateKey)) continue;

      const hours = Number(row.hours_worked_today);
      if (!Number.isFinite(hours)) continue;

      const emp = pickEmp(Array.isArray(row.hr_emp) ? row.hr_emp[0] : row.hr_emp);
      const workerId = (emp.empId ?? row.worker_id ?? '').toString().trim();
      if (!workerId) continue;

      if (!grouped.has(workerId)) {
        const cells: Record<string, number> = {};
        for (const d of dates) cells[d] = 0;
        grouped.set(workerId, {
          workerId,
          workerName: emp.empName ?? null,
          skillShort: emp.skillShort ?? null,
          cells
        });
      }

      const entry = grouped.get(workerId)!;
      entry.cells[dateKey] = (entry.cells[dateKey] ?? 0) + hours;
      if (!entry.workerName && emp.empName) entry.workerName = emp.empName;
      if (!entry.skillShort && emp.skillShort) entry.skillShort = emp.skillShort;
    }

    if (page.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  const rows: ManhourPivotRow[] = [...grouped.values()].map((g) => {
    let totalHours = 0;
    for (const d of dates) totalHours += g.cells[d] ?? 0;
    return {
      workerId: g.workerId,
      workerName: g.workerName,
      skillShort: g.skillShort,
      cells: g.cells,
      totalHours
    };
  });

  rows.sort((a, b) => {
    const byName = (a.workerName ?? '').localeCompare(b.workerName ?? '', undefined, { sensitivity: 'base' });
    if (byName !== 0) return byName;
    return a.workerId.localeCompare(b.workerId, undefined, { sensitivity: 'base' });
  });

  return { dates, rows };
}
