import { supabase } from '$lib/supabaseClient';
import type { WorkPlanning } from './productionTypes';

/**
 * Check if planning is blocked for a stage-shift-date combination due to an approved submission.
 * Scoped to the same shift as the route: another shift's approved plan (e.g. GEN) does not block MRN.
 */
export async function isPlanningBlockedForStageShiftDate(
  stageCode: string,
  shiftCode: string,
  planningDate: string
): Promise<{ isBlocked: boolean; reason?: string }> {
  try {
    // Format date to YYYY-MM-DD
    const dateStr = typeof planningDate === 'string' 
      ? planningDate.split('T')[0] 
      : planningDate;

    const { data: submission, error: submissionError } = await supabase
      .from('prdn_planning_submissions')
      .select('id, status, planning_date, reviewed_dt')
      .eq('stage_code', stageCode)
      .eq('shift_code', shiftCode)
      .eq('planning_date', dateStr)
      .eq('status', 'approved')
      .eq('is_deleted', false)
      .order('version', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (submissionError) {
      console.error('❌ Error checking approved submission:', submissionError);
      return { isBlocked: false }; // Don't block on error
    }

    if (!submission) {
      return { isBlocked: false };
    }

    const formatted = new Date(dateStr).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: '2-digit'
    });
    return {
      isBlocked: true,
      reason: `Planning is blocked for ${stageCode}-${shiftCode} on ${formatted}. An approved plan already exists for this stage-shift-date combination.`
    };
  } catch (error) {
    console.error('❌ Error in isPlanningBlockedForStageShiftDate:', error);
    return { isBlocked: false }; // Don't block on error
  }
}

export async function canPlanWork(
  derivedSwCode: string | null,
  stageCode: string,
  woDetailsId?: number,
  otherWorkCode?: string | null,
  shiftCode?: string,
  planningDate?: string
): Promise<{
  canPlan: boolean;
  reason?: string;
  lastPlan?: WorkPlanning;
}> {
  try {
    // First check if planning is blocked due to approved submission
    if (shiftCode && planningDate) {
      const blockCheck = await isPlanningBlockedForStageShiftDate(stageCode, shiftCode, planningDate);
      if (blockCheck.isBlocked) {
        return {
          canPlan: false,
          reason: blockCheck.reason
        };
      }
    }

    const workCode = derivedSwCode || otherWorkCode || 'Unknown';
    console.log(`🔍 Checking planning status for work: ${workCode} in stage: ${stageCode}${woDetailsId ? ` for WO ID: ${woDetailsId}` : ''} (${derivedSwCode ? 'standard' : 'non-standard'})`);
    
    let removalQuery = supabase
      .from('prdn_work_removals')
      .select('id, derived_sw_code, other_work_code, wo_details_id, stage_code, removal_reason')
      .eq('stage_code', stageCode);

    if (derivedSwCode) {
      removalQuery = removalQuery.eq('derived_sw_code', derivedSwCode);
    } else if (otherWorkCode) {
      removalQuery = removalQuery.eq('other_work_code', otherWorkCode);
    }

    if (woDetailsId) {
      removalQuery = removalQuery.eq('wo_details_id', woDetailsId);
    }

    const { data: removalData, error: removalError } = woDetailsId 
      ? await removalQuery.maybeSingle()
      : await removalQuery.limit(1);

    if (removalError && removalError.code !== 'PGRST116') {
      console.error('❌ Error checking work removal status:', removalError);
    }

    if (removalData && (Array.isArray(removalData) ? removalData.length > 0 : removalData)) {
      const removal = Array.isArray(removalData) ? removalData[0] : removalData;
      console.log(`❌ Work ${workCode} has been removed from ${stageCode}${woDetailsId ? ` for WO ID: ${woDetailsId}` : ''}`);
      return {
        canPlan: false,
        reason: `This work has been removed from production. Reason: ${removal.removal_reason || 'Not specified'}`
      };
    }
    
    let statusQuery = supabase
      .from('prdn_work_status')
      .select('current_status')
      .eq('stage_code', stageCode);

    if (woDetailsId) {
      statusQuery = statusQuery.eq('wo_details_id', woDetailsId);
    }

    if (derivedSwCode) {
      statusQuery = statusQuery.eq('derived_sw_code', derivedSwCode);
    } else if (otherWorkCode) {
      statusQuery = statusQuery.eq('other_work_code', otherWorkCode);
    } else {
      console.warn(`⚠️ Cannot check planning status: no derived_sw_code or other_work_code provided`);
      return {
        canPlan: false,
        reason: 'Invalid work code provided'
      };
    }

    const { data: statusRecord, error: statusError } = await statusQuery.maybeSingle();
    if (statusError && statusError.code !== 'PGRST116') {
      console.error('❌ Error checking work status:', statusError);
      throw statusError;
    }

    const status = statusRecord?.current_status || null;
    if (status === 'In Progress' || status === 'To be Planned') {
      return { canPlan: true };
    }
    if (status === 'Draft Plan') {
      return {
        canPlan: false,
        reason: 'Work already has a draft plan. Please complete or delete the draft first.'
      };
    }
    if (status === 'Plan Pending Approval') {
      return {
        canPlan: false,
        reason: 'Work already has a plan pending approval.'
      };
    }
    if (status === 'Planned') {
      return {
        canPlan: false,
        reason: 'Work is already planned for the selected context.'
      };
    }
    if (status === 'Completed') {
      return {
        canPlan: false,
        reason: 'Work is already completed.'
      };
    }
    if (status === 'Removed') {
      return {
        canPlan: false,
        reason: 'This work has been removed from production.'
      };
    }

    // No status row / unknown status: allow and let save-path validations decide.
    return { canPlan: true };
  } catch (error) {
    console.error('❌ Error in canPlanWork:', error);
    return {
      canPlan: false,
      reason: `Error checking work planning status: ${(error as Error)?.message || 'Unknown error'}`
    };
  }
}

