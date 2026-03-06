import { supabase } from '$lib/supabaseClient';

export async function addWorkToProduction(
  stageCode: string,
  woDetailsId: number,
  workType: 'standard' | 'non-standard',
  standardWorkData?: {
    derived_sw_code: string;
    addition_reason: string;
  },
  nonStandardWorkData?: {
    other_work_code: string;
    other_work_desc: string;
    other_work_sc: string;
    other_work_est_time_min: number;
    addition_reason: string;
  },
  addedBy: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const now = new Date().toISOString();

    if (workType === 'standard') {
      if (!standardWorkData || !standardWorkData.derived_sw_code || !standardWorkData.addition_reason.trim()) {
        return { success: false, error: 'Standard work data is incomplete' };
      }

      const { data, error } = await supabase
        .from('prdn_work_additions')
        .insert({
          stage_code: stageCode,
          wo_details_id: woDetailsId,
          derived_sw_code: standardWorkData.derived_sw_code,
          addition_reason: standardWorkData.addition_reason.trim(),
          added_by: addedBy,
          added_dt: now
        })
        .select()
        .single();

      if (error) {
        console.error('Error adding standard work:', error);
        return { success: false, error: error.message };
      }

      await createWorkStatusIfNotExists(stageCode, woDetailsId, standardWorkData.derived_sw_code, null);
      return { success: true };
    } else {
      if (!nonStandardWorkData || 
          !nonStandardWorkData.other_work_code || 
          !nonStandardWorkData.other_work_desc.trim() ||
          !nonStandardWorkData.other_work_sc ||
          !nonStandardWorkData.other_work_est_time_min ||
          !nonStandardWorkData.addition_reason.trim()) {
        return { success: false, error: 'Non-standard work data is incomplete' };
      }

      const { data, error } = await supabase
        .from('prdn_work_additions')
        .insert({
          stage_code: stageCode,
          wo_details_id: woDetailsId,
          other_work_code: nonStandardWorkData.other_work_code,
          other_work_desc: nonStandardWorkData.other_work_desc.trim(),
          other_work_sc: nonStandardWorkData.other_work_sc,
          other_work_est_time_min: nonStandardWorkData.other_work_est_time_min,
          addition_reason: nonStandardWorkData.addition_reason.trim(),
          added_by: addedBy,
          added_dt: now
        })
        .select()
        .single();

      if (error) {
        console.error('Error adding non-standard work:', error);
        return { success: false, error: error.message };
      }

      await createWorkStatusIfNotExists(stageCode, woDetailsId, null, nonStandardWorkData.other_work_code);
      return { success: true };
    }
  } catch (error) {
    console.error('Error adding work to production:', error);
    return { success: false, error: (error as Error).message };
  }
}

async function createWorkStatusIfNotExists(
  stageCode: string,
  woDetailsId: number,
  derivedSwCode: string | null,
  otherWorkCode: string | null
): Promise<void> {
  const { getCurrentUsername, getCurrentTimestamp } = await import('$lib/utils/userUtils');
  const currentUser = getCurrentUsername();
  const timestamp = getCurrentTimestamp();

  let checkQuery = supabase
    .from('prdn_work_status')
    .select('id')
    .eq('stage_code', stageCode)
    .eq('wo_details_id', woDetailsId);

  if (derivedSwCode) {
    checkQuery = checkQuery.eq('derived_sw_code', derivedSwCode);
  } else if (otherWorkCode) {
    checkQuery = checkQuery.eq('other_work_code', otherWorkCode);
  }

  const { data: existingStatus, error: checkError } = await checkQuery.maybeSingle();

  if (checkError) {
    console.error('Error checking existing work status:', checkError);
  }

  if (!existingStatus) {
    const { error: statusError } = await supabase
      .from('prdn_work_status')
      .insert({
        stage_code: stageCode,
        wo_details_id: woDetailsId,
        derived_sw_code: derivedSwCode,
        other_work_code: otherWorkCode,
        current_status: 'To be Planned',
        created_by: currentUser,
        created_dt: timestamp,
        modified_by: currentUser,
        modified_dt: timestamp
      });

    if (statusError) {
      console.error('Error inserting work status:', statusError);
    } else {
      console.log(`✅ Created work status record for ${derivedSwCode || otherWorkCode}`);
    }
  } else {
    console.log(`ℹ️ Work status record already exists for ${derivedSwCode || otherWorkCode}, skipping insert`);
  }
}

