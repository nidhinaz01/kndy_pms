import { supabase } from '$lib/supabaseClient';

export interface StageEmployeeRow {
  id: number;
  emp_id: string;
  emp_name: string;
  skill_short: string;
  shift_code: string;
  shift_name: string | null;
}

export interface ShiftOption {
  shift_code: string;
  shift_name: string | null;
}

export interface ShiftChangeLogRow {
  id: number;
  emp_id: string;
  shift_code_from: string;
  shift_code_to: string;
  changed_at: string;
  changed_by: string;
}

/**
 * Active employees at a stage (same filters as product requirement).
 */
export async function fetchActiveEmployeesByStage(stage: string): Promise<StageEmployeeRow[]> {
  if (!stage?.trim()) return [];

  const { data, error } = await supabase
    .from('hr_emp')
    .select(
      `
      id,
      emp_id,
      emp_name,
      skill_short,
      shift_code,
      hr_shift_master!inner ( shift_name )
    `
    )
    .eq('stage', stage.trim())
    .eq('is_active', true)
    .eq('is_deleted', false)
    .order('emp_name', { ascending: true });

  if (error) {
    console.error('fetchActiveEmployeesByStage:', error);
    throw error;
  }

  return (data || []).map((row: any) => ({
    id: row.id,
    emp_id: row.emp_id,
    emp_name: row.emp_name,
    skill_short: row.skill_short,
    shift_code: row.shift_code,
    shift_name: row.hr_shift_master?.shift_name ?? null
  }));
}

export async function fetchActiveShiftOptions(): Promise<ShiftOption[]> {
  const { data, error } = await supabase
    .from('hr_shift_master')
    .select('shift_code, shift_name')
    .eq('is_active', true)
    .eq('is_deleted', false)
    .order('shift_name', { ascending: true });

  if (error) {
    console.error('fetchActiveShiftOptions:', error);
    throw error;
  }

  return (data || []).map((r: any) => ({
    shift_code: r.shift_code,
    shift_name: r.shift_name ?? null
  }));
}

/**
 * Shifts offered as reassignment targets: if every selected employee shares the
 * same shift, exclude that code; otherwise list all active shifts.
 */
export function computeTargetShiftOptions(
  selectedRows: StageEmployeeRow[],
  allShifts: ShiftOption[]
): ShiftOption[] {
  if (!selectedRows.length || !allShifts.length) return [];

  const codes = new Set(selectedRows.map((r) => r.shift_code));
  if (codes.size === 1) {
    const only = [...codes][0];
    return allShifts.filter((s) => s.shift_code !== only);
  }
  return [...allShifts];
}

export async function fetchShiftChangeHistory(empId: string): Promise<ShiftChangeLogRow[]> {
  const { data, error } = await supabase
    .from('prdn_emp_shift_change_log')
    .select('id, emp_id, shift_code_from, shift_code_to, changed_at, changed_by')
    .eq('emp_id', empId)
    .order('changed_at', { ascending: false });

  if (error) {
    console.error('fetchShiftChangeHistory:', error);
    throw error;
  }

  return (data || []) as ShiftChangeLogRow[];
}

/**
 * Updates hr_emp.shift_code for the given employees (same stage).
 * Audit rows are created by trigger hr_emp_shift_change_log_trg (see migration SQL).
 */
export async function applyShiftChangeForEmployees(
  stage: string,
  empIds: string[],
  newShiftCode: string,
  modifiedBy: string
): Promise<{ updated: number; skipped: number }> {
  const stageTrim = stage.trim();
  const shiftTrim = newShiftCode.trim();
  if (!stageTrim || !shiftTrim || empIds.length === 0) {
    return { updated: 0, skipped: empIds.length };
  }

  const now = new Date().toISOString();

  const { data: beforeRows, error: selErr } = await supabase
    .from('hr_emp')
    .select('emp_id, shift_code')
    .eq('stage', stageTrim)
    .eq('is_active', true)
    .eq('is_deleted', false)
    .in('emp_id', empIds);

  if (selErr) {
    console.error('applyShiftChangeForEmployees select:', selErr);
    throw selErr;
  }

  const eligible = (beforeRows || []).filter((r: any) => r.shift_code !== shiftTrim);
  const skipped = empIds.length - eligible.length;

  if (eligible.length === 0) {
    return { updated: 0, skipped };
  }

  const toUpdateIds = eligible.map((r: any) => r.emp_id);

  const { error: updErr } = await supabase
    .from('hr_emp')
    .update({
      shift_code: shiftTrim,
      modified_by: modifiedBy,
      modified_dt: now
    })
    .eq('stage', stageTrim)
    .eq('is_active', true)
    .eq('is_deleted', false)
    .in('emp_id', toUpdateIds)
    .neq('shift_code', shiftTrim);

  if (updErr) {
    console.error('applyShiftChangeForEmployees update:', updErr);
    throw updErr;
  }

  return { updated: eligible.length, skipped };
}
