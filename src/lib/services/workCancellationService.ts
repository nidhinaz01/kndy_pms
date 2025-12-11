/**
 * Service for cancelling approved work plans
 */

import { supabase } from '$lib/supabaseClient';
import { getCurrentUsername, getCurrentTimestamp } from '$lib/utils/userUtils';

/**
 * Cancel approved work plans
 * Marks plans as is_deleted = true and status = 'cancelled'
 */
export async function cancelWorkPlans(
  planningIds: number[],
  reason: string
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!planningIds || planningIds.length === 0) {
      return { success: false, error: 'No planning IDs provided' };
    }

    if (!reason || reason.trim().length === 0) {
      return { success: false, error: 'Cancellation reason is required' };
    }

    const currentUser = getCurrentUsername();
    const now = getCurrentTimestamp();

    // Check if any of the plans have been reported
    const { data: reportingData, error: reportingCheckError } = await supabase
      .from('prdn_work_reporting')
      .select('planning_id')
      .in('planning_id', planningIds)
      .eq('is_deleted', false);

    if (reportingCheckError) {
      console.error('Error checking reporting status:', reportingCheckError);
      return { success: false, error: 'Error checking if works have been reported' };
    }

    const reportedPlanningIds = new Set((reportingData || []).map((r: any) => r.planning_id));
    const unreportedPlanningIds = planningIds.filter(id => !reportedPlanningIds.has(id));

    if (unreportedPlanningIds.length === 0) {
      return { success: false, error: 'All selected works have already been reported. Only planned (unreported) works can be cancelled.' };
    }

    if (unreportedPlanningIds.length < planningIds.length) {
      console.warn(`⚠️ Some works have been reported and cannot be cancelled. Cancelling ${unreportedPlanningIds.length} of ${planningIds.length} works.`);
    }

    // First, fetch the planning records to get work details for status update
    const { data: planningRecords, error: fetchError } = await supabase
      .from('prdn_work_planning')
      .select('id, stage_code, wo_details_id, derived_sw_code, other_work_code')
      .in('id', unreportedPlanningIds);

    if (fetchError) {
      console.error('Error fetching planning records:', fetchError);
      return { success: false, error: 'Error fetching planning records' };
    }

    // Update only unreported plans
    const { error } = await supabase
      .from('prdn_work_planning')
      .update({
        is_deleted: true,
        status: 'cancelled',
        notes: reason.trim(),
        modified_by: currentUser,
        modified_dt: now
      })
      .in('id', unreportedPlanningIds)
      .eq('is_deleted', false);

    if (error) {
      console.error('Error cancelling work plans:', error);
      return { success: false, error: error.message };
    }

    // Update prdn_work_status to 'To be Planned' for cancelled works
    // Group by work code to avoid duplicate updates
    const workStatusUpdates = new Map<string, { stageCode: string; woDetailsId: number; derivedSwCode: string | null; otherWorkCode: string | null }>();
    
    (planningRecords || []).forEach((plan: any) => {
      const workKey = `${plan.stage_code}_${plan.wo_details_id}_${plan.derived_sw_code || plan.other_work_code}`;
      if (!workStatusUpdates.has(workKey)) {
        workStatusUpdates.set(workKey, {
          stageCode: plan.stage_code,
          woDetailsId: plan.wo_details_id,
          derivedSwCode: plan.derived_sw_code,
          otherWorkCode: plan.other_work_code
        });
      }
    });

    // Update work status for each unique work
    for (const workInfo of workStatusUpdates.values()) {
      let statusUpdateQuery = supabase
        .from('prdn_work_status')
        .update({
          current_status: 'To be Planned',
          modified_by: currentUser,
          modified_dt: now
        })
        .eq('stage_code', workInfo.stageCode)
        .eq('wo_details_id', workInfo.woDetailsId);

      if (workInfo.derivedSwCode) {
        statusUpdateQuery = statusUpdateQuery.eq('derived_sw_code', workInfo.derivedSwCode);
      } else if (workInfo.otherWorkCode) {
        statusUpdateQuery = statusUpdateQuery.eq('other_work_code', workInfo.otherWorkCode);
      }

      const { error: statusError } = await statusUpdateQuery;
      if (statusError) {
        console.warn(`Warning: Could not update work status for cancelled work: ${statusError.message}`);
        // Don't fail the entire operation if status update fails
      } else {
        console.log(`✅ Updated work status to 'To be Planned' for cancelled work`);
      }
    }

    console.log(`✅ Successfully cancelled ${unreportedPlanningIds.length} work plan(s)`);
    return { 
      success: true, 
      cancelledCount: unreportedPlanningIds.length,
      skippedCount: planningIds.length - unreportedPlanningIds.length
    };
  } catch (error) {
    console.error('Error cancelling work plans:', error);
    return {
      success: false,
      error: (error as Error).message
    };
  }
}

