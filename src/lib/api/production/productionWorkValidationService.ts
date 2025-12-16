import { supabase } from '$lib/supabaseClient';
import type { WorkPlanning } from './productionTypes';

/**
 * Check if planning is blocked for a stage-shift-date combination due to an approved submission
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

    // Check if there's an approved planning submission for this stage-date
    const { data: submission, error: submissionError } = await supabase
      .from('prdn_planning_submissions')
      .select('id, status, planning_date, reviewed_dt')
      .eq('stage_code', stageCode)
      .eq('planning_date', dateStr)
      .eq('status', 'approved')
      .eq('is_deleted', false)
      .maybeSingle();

    if (submissionError) {
      console.error('❌ Error checking approved submission:', submissionError);
      return { isBlocked: false }; // Don't block on error
    }

    if (!submission) {
      return { isBlocked: false }; // No approved submission, planning is allowed
    }

    // If there's an approved submission for this stage-date, check if any work plans
    // in that submission involve workers from the current shift
    const { data: workPlans, error: plansError } = await supabase
      .from('prdn_work_planning')
      .select(`
        id, 
        worker_id,
        hr_emp!inner(emp_id, shift_code)
      `)
      .eq('planning_submission_id', submission.id)
      .eq('stage_code', stageCode)
      .eq('from_date', dateStr)
      .eq('status', 'approved')
      .eq('is_deleted', false);

    if (plansError) {
      console.error('❌ Error checking work plans:', plansError);
      // If we can't check work plans, but there's an approved submission, block to be safe
      return {
        isBlocked: true,
        reason: `Planning is blocked for ${stageCode}-${shiftCode} on ${new Date(dateStr).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' })}. An approved plan already exists for this stage-date combination.`
      };
    }

    // If there are approved work plans, check if any involve workers from the current shift
    if (workPlans && workPlans.length > 0) {
      const hasWorkersFromShift = workPlans.some((plan: any) => {
        // Handle both single object and array responses from Supabase
        const empData = Array.isArray(plan.hr_emp) ? plan.hr_emp[0] : plan.hr_emp;
        const empShiftCode = empData?.shift_code;
        return empShiftCode === shiftCode;
      });

      if (hasWorkersFromShift) {
        return {
          isBlocked: true,
          reason: `Planning is blocked for ${stageCode}-${shiftCode} on ${new Date(dateStr).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' })}. An approved plan already exists for this stage-shift-date combination.`
        };
      }
    }

    return { isBlocked: false };
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
    
    let planningQuery = supabase
      .from('prdn_work_planning')
      .select('*')
      .eq('stage_code', stageCode)
      .eq('is_active', true)
      .eq('is_deleted', false)
      .order('created_dt', { ascending: false })
      .limit(1);

    if (derivedSwCode && otherWorkCode) {
      planningQuery = planningQuery.or(`derived_sw_code.eq.${derivedSwCode},other_work_code.eq.${otherWorkCode}`);
    } else if (derivedSwCode) {
      planningQuery = planningQuery.eq('derived_sw_code', derivedSwCode);
    } else if (otherWorkCode) {
      planningQuery = planningQuery.eq('other_work_code', otherWorkCode);
    } else {
      console.warn(`⚠️ Cannot check planning status: no derived_sw_code or other_work_code provided`);
      return {
        canPlan: false,
        reason: 'Invalid work code provided'
      };
    }

    // Filter by wo_details_id to check plans for this specific work order
    if (woDetailsId) {
      planningQuery = planningQuery.eq('wo_details_id', woDetailsId);
    }

    const { data, error } = await planningQuery;

    if (error) {
      console.error('❌ Error checking work planning status:', error);
      throw error;
    }

    console.log(`📊 Found ${data?.length || 0} previous plans for work ${workCode}`);

    if (!data || data.length === 0) {
      console.log(`✅ No previous plans found for ${workCode} - can plan`);
      return { canPlan: true };
    }

    const lastPlan = data[0];
    console.log(`📋 Last plan found: ID ${lastPlan.id}, Date: ${lastPlan.from_date}, Status: ${lastPlan.status}`);

    // Check if the last plan is still in draft or pending_approval status
    // If so, don't allow new planning until it's approved/rejected
    if (lastPlan.status === 'draft' || lastPlan.status === 'pending_approval') {
      console.log(`❌ Work has a ${lastPlan.status} plan - cannot plan again`);
      return {
        canPlan: false,
        reason: `Work already has a ${lastPlan.status === 'draft' ? 'draft' : 'pending approval'} plan from ${new Date(lastPlan.from_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' })}. Please wait for approval or delete the existing plan first.`,
        lastPlan
      };
    }

    // If the plan is approved, check if it has been reported
    if (lastPlan.status === 'approved') {
      const { data: reportData, error: reportError } = await supabase
        .from('prdn_work_reporting')
        .select('*')
        .eq('planning_id', lastPlan.id)
        .eq('is_active', true)
        .eq('is_deleted', false)
        .maybeSingle();

      if (reportError) {
        console.error('❌ Error checking work reporting:', reportError);
        throw reportError;
      }

      console.log(`📋 Report data for plan ${lastPlan.id}:`, reportData ? 'Found' : 'Not found');

      if (!reportData) {
        console.log(`❌ Approved plan ${lastPlan.id} has not been reported yet - cannot plan`);
        return {
          canPlan: false,
          reason: `Work already has an approved plan from ${new Date(lastPlan.from_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' })} that has not been reported yet. Please report the existing plan first.`,
          lastPlan
        };
      }

      console.log(`📊 Report completion status: ${reportData.completion_status}`);
      
      if (reportData.completion_status === 'NC') {
        console.log(`✅ Work was not completed (NC) - can plan again`);
        return { canPlan: true };
      } else {
        console.log(`❌ Work was completed (${reportData.completion_status}) - cannot plan again`);
        return {
          canPlan: false,
          reason: `Work was already completed on ${new Date(reportData.from_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' })} with status '${reportData.completion_status}'.`,
          lastPlan
        };
      }
    }

    // If plan is rejected, allow new planning
    if (lastPlan.status === 'rejected') {
      console.log(`✅ Last plan was rejected - can plan again`);
      return { canPlan: true };
    }

    // Default: allow planning if status is unknown
    console.log(`✅ Unknown plan status (${lastPlan.status}) - allowing planning`);
    return { canPlan: true };
  } catch (error) {
    console.error('❌ Error in canPlanWork:', error);
    return {
      canPlan: false,
      reason: `Error checking work planning status: ${(error as Error)?.message || 'Unknown error'}`
    };
  }
}

