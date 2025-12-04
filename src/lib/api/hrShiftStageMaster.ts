import { supabase } from '$lib/supabaseClient';

export interface HrShiftStageMaster {
  id?: number;
  shift_code: string;
  stage_code: string;
  is_active: boolean;
  is_deleted: boolean;
  created_by: string;
  created_dt: string;
  modified_by: string;
  modified_dt?: string;
}

/**
 * Fetch all stages associated with a shift
 */
export async function fetchStagesForShift(shiftCode: string): Promise<string[]> {
  try {
    const { data, error } = await supabase
      .from('hr_shift_stage_master')
      .select('stage_code')
      .eq('shift_code', shiftCode)
      .eq('is_active', true)
      .eq('is_deleted', false)
      .order('stage_code');

    if (error) throw error;
    return data?.map(item => item.stage_code) || [];
  } catch (error) {
    console.error('Error fetching stages for shift:', error);
    throw error;
  }
}

/**
 * Fetch all shifts associated with a stage
 */
export async function fetchShiftsForStage(stageCode: string): Promise<string[]> {
  try {
    const { data, error } = await supabase
      .from('hr_shift_stage_master')
      .select('shift_code')
      .eq('stage_code', stageCode)
      .eq('is_active', true)
      .eq('is_deleted', false)
      .order('shift_code');

    if (error) throw error;
    return data?.map(item => item.shift_code) || [];
  } catch (error) {
    console.error('Error fetching shifts for stage:', error);
    throw error;
  }
}

/**
 * Save shift-stage associations (replaces all existing associations for the shift)
 */
export async function saveShiftStages(
  shiftCode: string,
  stageCodes: string[]
): Promise<void> {
  try {
    const { getCurrentUsername, getCurrentTimestamp } = await import('$lib/utils/userUtils');
    const username = getCurrentUsername();
    const now = getCurrentTimestamp();

    // First, soft delete all existing associations for this shift
    const { error: deleteError } = await supabase
      .from('hr_shift_stage_master')
      .update({
        is_deleted: true,
        is_active: false,
        modified_by: username,
        modified_dt: now
      })
      .eq('shift_code', shiftCode)
      .eq('is_deleted', false);

    if (deleteError) throw deleteError;

    // If no stages provided, we're done (just deleted all associations)
    if (!stageCodes || stageCodes.length === 0) {
      return;
    }

    // Check for existing records that we can reactivate
    const { data: existingRecords, error: checkError } = await supabase
      .from('hr_shift_stage_master')
      .select('id, stage_code')
      .eq('shift_code', shiftCode)
      .in('stage_code', stageCodes);

    if (checkError) throw checkError;

    const existingStageCodes = new Set(existingRecords?.map(r => r.stage_code) || []);
    const existingIds = new Map(
      existingRecords?.map(r => [r.stage_code, r.id]) || []
    );

    // Prepare records to insert/update
    const recordsToInsert: any[] = [];
    const recordsToUpdate: any[] = [];

    for (const stageCode of stageCodes) {
      if (existingStageCodes.has(stageCode)) {
        // Reactivate existing record
        recordsToUpdate.push({
          id: existingIds.get(stageCode),
          is_deleted: false,
          is_active: true,
          modified_by: username,
          modified_dt: now
        });
      } else {
        // Insert new record
        recordsToInsert.push({
          shift_code: shiftCode,
          stage_code: stageCode,
          is_active: true,
          is_deleted: false,
          created_by: username,
          created_dt: now,
          modified_by: username,
          modified_dt: now
        });
      }
    }

    // Update existing records
    if (recordsToUpdate.length > 0) {
      for (const record of recordsToUpdate) {
        const { id, ...updateData } = record;
        const { error: updateError } = await supabase
          .from('hr_shift_stage_master')
          .update(updateData)
          .eq('id', id);

        if (updateError) throw updateError;
      }
    }

    // Insert new records
    if (recordsToInsert.length > 0) {
      const { error: insertError } = await supabase
        .from('hr_shift_stage_master')
        .insert(recordsToInsert);

      if (insertError) throw insertError;
    }
  } catch (error) {
    console.error('Error saving shift stages:', error);
    throw error;
  }
}

/**
 * Fetch all available plant stages
 */
export async function fetchAllPlantStages(): Promise<string[]> {
  try {
    const { data, error } = await supabase
      .from('sys_data_elements')
      .select('de_value')
      .eq('de_name', 'Plant-Stage')
      .eq('is_active', true)
      .eq('is_deleted', false)
      .order('de_value');

    if (error) throw error;
    return data?.map(item => item.de_value) || [];
  } catch (error) {
    console.error('Error fetching plant stages:', error);
    throw error;
  }
}

