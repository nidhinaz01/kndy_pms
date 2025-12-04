import { supabase } from '$lib/supabaseClient';

export async function removeWorkFromProduction(
  derivedSwCode: string | null,
  stageCode: string,
  woDetailsId: number,
  removalReason: string,
  removedBy: string,
  otherWorkCode: string | null = null
): Promise<{ success: boolean; error?: string }> {
  try {
    const now = new Date().toISOString();
    
    if (!removalReason || !removalReason.trim()) {
      return { success: false, error: 'Removal reason is mandatory' };
    }

    if (!woDetailsId) {
      return { success: false, error: 'Work order details ID is required' };
    }

    const isNonStandardWork = !derivedSwCode && otherWorkCode;
    
    const { data: removalData, error: removalError } = await supabase
      .from('prdn_work_removals')
      .insert({
        derived_sw_code: derivedSwCode,
        other_work_code: otherWorkCode,
        stage_code: stageCode,
        wo_details_id: woDetailsId,
        removal_reason: removalReason.trim(),
        removed_by: removedBy,
        removed_dt: now
      })
      .select()
      .single();

    if (removalError) {
      console.error('Error creating removal record:', removalError);
      return { success: false, error: removalError.message };
    }

    let planningQuery = supabase
      .from('prdn_work_planning')
      .select('id')
      .eq('stage_code', stageCode)
      .eq('wo_details_id', woDetailsId)
      .eq('is_deleted', false);

    if (derivedSwCode) {
      planningQuery = planningQuery.eq('derived_sw_code', derivedSwCode).is('other_work_code', null);
    } else if (otherWorkCode) {
      planningQuery = planningQuery.eq('other_work_code', otherWorkCode).is('derived_sw_code', null);
    }

    const { data: planningRecords, error: planningCheckError } = await planningQuery;

    let newStatus = 'To be Planned';
    
    if (!planningCheckError && planningRecords && planningRecords.length > 0) {
      const planningIds = planningRecords.map(p => p.id);
      
      const { data: reportData, error: reportCheckError } = await supabase
        .from('prdn_work_reporting')
        .select('completion_status')
        .in('planning_id', planningIds)
        .eq('is_deleted', false);

      if (!reportCheckError && reportData && reportData.length > 0) {
        const hasNonCompleted = reportData.some(report => report.completion_status === 'NC');
        if (hasNonCompleted) {
          newStatus = 'In Progress';
          console.log(`📊 Work ${derivedSwCode || otherWorkCode} was reported as Non Completed - setting status to In Progress`);
        }
      }
    }

    let planningUpdateQuery = supabase
      .from('prdn_work_planning')
      .update({
        is_deleted: true,
        modified_by: removedBy,
        modified_dt: now
      })
      .eq('stage_code', stageCode)
      .eq('wo_details_id', woDetailsId)
      .eq('is_deleted', false);

    if (derivedSwCode) {
      planningUpdateQuery = planningUpdateQuery.eq('derived_sw_code', derivedSwCode).is('other_work_code', null);
    } else if (otherWorkCode) {
      planningUpdateQuery = planningUpdateQuery.eq('other_work_code', otherWorkCode).is('derived_sw_code', null);
    } else {
      console.warn('⚠️ No work code provided for planning record deletion');
    }

    const { error: planningError } = await planningUpdateQuery;

    if (planningError) {
      console.error('Error updating planning records:', planningError);
    }

    let statusUpdateQuery = supabase
      .from('prdn_work_status')
      .update({
        current_status: newStatus,
        modified_by: removedBy,
        modified_dt: now
      })
      .eq('stage_code', stageCode)
      .eq('wo_details_id', woDetailsId);

    if (derivedSwCode) {
      statusUpdateQuery = statusUpdateQuery.eq('derived_sw_code', derivedSwCode);
    } else if (otherWorkCode) {
      statusUpdateQuery = statusUpdateQuery.eq('other_work_code', otherWorkCode);
    } else {
      console.warn('⚠️ Cannot update work status: no derived_sw_code or other_work_code provided for removal');
      return { success: true };
    }

    const { error: statusError } = await statusUpdateQuery;

    if (statusError) {
      console.error(`Error updating work status to ${newStatus}:`, statusError);
    } else {
      console.log(`✅ Updated work status to ${newStatus} for work ${derivedSwCode || otherWorkCode}`);
    }

    return { success: true };
  } catch (error) {
    console.error('Error removing work from production:', error);
    return { success: false, error: (error as Error).message };
  }
}

