import { supabase } from '$lib/supabaseClient';

export interface StageShiftPair {
  stageCode: string;
  shiftCode: string;
}

/**
 * Returns configured stage/shift combinations from `hr_shift_stage_master`.
 * Used by `/production/dashboard` to build the overview grid (read-only).
 */
export async function fetchConfiguredStageShifts(): Promise<StageShiftPair[]> {
  const { data, error } = await supabase
    .from('hr_shift_stage_master')
    .select('stage_code, shift_code')
    .eq('is_active', true)
    .eq('is_deleted', false)
    .order('stage_code')
    .order('shift_code');

  if (error) throw error;

  const map = new Map<string, StageShiftPair>();
  (data || []).forEach((row: any) => {
    const stageCode = row?.stage_code;
    const shiftCode = row?.shift_code;
    if (!stageCode || !shiftCode) return;
    const key = `${stageCode}-${shiftCode}`;
    map.set(key, { stageCode, shiftCode });
  });

  return Array.from(map.values());
}

