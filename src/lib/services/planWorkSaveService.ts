import { supabase } from '$lib/supabaseClient';
import { createWorkPlanning } from '$lib/api/production';
import {
  getIndividualSkills,
  getEffectiveRowTimes,
  getWorkerSlotKey,
  buildExistingPlansBySlotKey
} from '$lib/utils/planWorkUtils';
import { getCurrentUsername, getCurrentTimestamp } from '$lib/utils/userUtils';
import type { PlanWorkFormData, WorkContinuation, SelectedWorker } from '$lib/types/planWork';
import { cancelWorkPlans } from '$lib/services/workCancellationService';
import { getVehicleWorkFlowStandardTimeHours } from '$lib/utils/standardTimeFromWork';

function normalizeSkill(skill: string | null | undefined): string {
  return String(skill || '').trim().toUpperCase();
}

function buildSkillMismatchReason(requiredSkill: string, workerSkill: string): string {
  return `Worker skill "${workerSkill}" does not match required skill "${requiredSkill}".`;
}

async function validatePlanningSubmissionGate(
  stageCode: string,
  shiftCode: string,
  planningDate: string
): Promise<{ allowed: boolean; reason?: string }> {
  const normalizedDate = planningDate.split('T')[0];
  const { data, error } = await supabase
    .from('prdn_planning_submissions')
    .select('status, version')
    .eq('stage_code', stageCode)
    .eq('shift_code', shiftCode)
    .eq('planning_date', normalizedDate)
    .eq('is_deleted', false)
    .order('version', { ascending: false })
    .limit(1);

  if (error) {
    return { allowed: false, reason: 'Unable to validate planning submission status.' };
  }

  const latest = (data || [])[0];
  if (!latest) return { allowed: true };
  if (latest.status === 'pending_approval' || latest.status === 'approved') {
    return { allowed: false, reason: `Planning is blocked because the submission is ${latest.status}.` };
  }
  return { allowed: true };
}

export async function saveWorkPlanning(
  work: any,
  formData: PlanWorkFormData,
  workContinuation: WorkContinuation,
  stageCode: string,
  shiftCode: string,
  fromDate: string,
  toDate?: string
): Promise<{ success: boolean; createdPlans: number; message: string }> {
  // Use toDate if provided, otherwise use fromDate
  const planningToDate = toDate || fromDate;
  const requiredSkills = work?.skill_mappings || [];

  if (!formData.fromTime || !formData.toTime) {
    throw new Error('Please fill in all required fields');
  }

  const currentUser = getCurrentUsername();
  const now = getCurrentTimestamp();
  const replanSourcePlanningIds = Array.isArray(work?.replanSourcePlanningIds)
    ? work.replanSourcePlanningIds.map((id: any) => Number(id)).filter((id: number) => Number.isFinite(id))
    : [];
  const replanReason = typeof work?.replanReason === 'string' ? work.replanReason.trim() : '';
  const hasReplanContext = replanSourcePlanningIds.length > 0 && replanReason.length > 0;

  const submissionGate = await validatePlanningSubmissionGate(stageCode, shiftCode, fromDate);
  if (!submissionGate.allowed) {
    throw new Error(submissionGate.reason || 'Planning is blocked for the selected date.');
  }
  if (planningToDate && planningToDate !== fromDate) {
    const toDateGate = await validatePlanningSubmissionGate(stageCode, shiftCode, planningToDate);
    if (!toDateGate.allowed) {
      throw new Error(toDateGate.reason || 'Planning is blocked for the selected end date.');
    }
  }

  if (hasReplanContext) {
    const cancelResult = await cancelWorkPlans(replanSourcePlanningIds, replanReason);
    if (!cancelResult.success) {
      throw new Error(cancelResult.error || 'Failed to cancel source plan for replan.');
    }
  }
  
  // Check if this is edit mode (has existing draft plans to replace)
  const isEditMode = work?.existingDraftPlans && Array.isArray(work.existingDraftPlans) && work.existingDraftPlans.length > 0;
  
  const isNonStandardWork = work.is_added_work || !work.std_work_type_details?.derived_sw_code;
  const woDetailsId = work.prdn_wo_details_id || work.wo_details_id || 1;
  const derivedSwCode = isNonStandardWork ? null : (work.std_work_type_details?.derived_sw_code || null);
  const otherWorkCode = isNonStandardWork ? work.sw_code : null;
  const stdTimeHoursForPlan = isNonStandardWork ? null : getVehicleWorkFlowStandardTimeHours(work);

  const existingPlansMap = new Map<string, any>();
  if (isEditMode && requiredSkills.length === 0) {
    work.existingDraftPlans.forEach((plan: any) => {
      const skill = plan.sc_required || plan.skill_short;
      const workerId = plan.worker_id || plan.hr_emp?.emp_id;
      if (skill && workerId) {
        existingPlansMap.set(`${skill}-${workerId}`, plan);
      }
    });
  }

  const updatePromises: PromiseLike<any>[] = [];
  const insertPromises: PromiseLike<any>[] = [];
  const updateNoWorkerPayloads: Array<{ reason: string } | null> = [];
  const insertNoWorkerPayloads: Array<{ skillShort: string; reason: string } | null> = [];
  const planIdsToKeep = new Set<number>();
  const updatePlanSkillMeta: Array<{ planId: number; requiredSkill: string; workerSkill: string }> = [];
  const insertPlanSkillMeta: Array<{ requiredSkill: string; workerSkill: string }> = [];

  if (requiredSkills.length > 0) {
    const selectedSkillMapping =
      work.skill_mappings[
        formData.selectedSkillMappingIndex >= 0 ? formData.selectedSkillMappingIndex : 0
      ];
    const individualSkills = getIndividualSkills(selectedSkillMapping);
    const wsmId = (selectedSkillMapping as any)?.wsm_id || null;

    let assignedWorkerSlots = 0;
    for (let index = 0; index < individualSkills.length; index++) {
      const skillShort = individualSkills[index];
      const workerKey = getWorkerSlotKey(skillShort, index);
      const worker = formData.selectedWorkers[workerKey];
      const dev = formData.planningSlotDeviations?.[workerKey];
      const hasW = !!(worker as SelectedWorker | null)?.emp_id;
      const hasDev = !!(dev?.noWorker && dev.reason?.trim());
      if (!hasW && !hasDev) {
        throw new Error(
          `Assign a worker or mark "No worker available" with a reason for slot ${workerKey}.`
        );
      }
      if (hasW) assignedWorkerSlots++;
    }
    if (assignedWorkerSlots === 0) {
      throw new Error(
        'At least one skill competency must have a worker assigned. You cannot mark every competency as no worker.'
      );
    }

    const existingPlansBySlot =
      isEditMode && selectedSkillMapping
        ? buildExistingPlansBySlotKey(work.existingDraftPlans || [], selectedSkillMapping)
        : new Map<string, any>();

    for (let index = 0; index < individualSkills.length; index++) {
      const skillShort = individualSkills[index];
      const workerKey = getWorkerSlotKey(skillShort, index);
      const worker = formData.selectedWorkers[workerKey];
      const dev = formData.planningSlotDeviations?.[workerKey];
      const existingPlan = existingPlansBySlot.get(workerKey);
      const eff = getEffectiveRowTimes(workerKey, formData);

      if ((worker as SelectedWorker | null)?.emp_id) {
        const workerId = (worker as SelectedWorker).emp_id;
        const planData = {
          stage_code: stageCode,
          shift_code: shiftCode,
          wo_details_id: woDetailsId,
          derived_sw_code: derivedSwCode,
          other_work_code: otherWorkCode,
          sc_required: skillShort,
          worker_id: workerId,
          from_date: eff.fromDate || fromDate,
          from_time: eff.fromTime,
          to_date: eff.toDate || planningToDate,
          to_time: eff.toTime,
          planned_hours: eff.plannedHours,
          time_worked_till_date: workContinuation.timeWorkedTillDate,
          remaining_time: Math.max(0, workContinuation.remainingTime - eff.plannedHours),
          std_time_hours: stdTimeHoursForPlan,
          status: 'draft' as const,
          notes: hasReplanContext ? replanReason : `Planned for ${skillShort} skill`,
          wsm_id: isNonStandardWork ? null : wsmId
        };

        if (existingPlan && existingPlan.id) {
          planIdsToKeep.add(existingPlan.id);
          updatePromises.push(
            supabase
              .from('prdn_work_planning')
              .update({
                ...planData,
                is_deleted: false,
                modified_by: currentUser,
                modified_dt: now
              })
              .eq('id', existingPlan.id)
              .select()
              .single()
          );
          updatePlanSkillMeta.push({
            planId: existingPlan.id,
            requiredSkill: skillShort,
            workerSkill: String((worker as SelectedWorker).skill_short || '')
          });
          updateNoWorkerPayloads.push(null);
        } else {
          insertPromises.push(createWorkPlanning(planData, currentUser));
          insertPlanSkillMeta.push({
            requiredSkill: skillShort,
            workerSkill: String((worker as SelectedWorker).skill_short || '')
          });
          insertNoWorkerPayloads.push(null);
        }
      } else if (dev?.noWorker && dev.reason?.trim()) {
        const reason = dev.reason.trim();
        const planData = {
          stage_code: stageCode,
          shift_code: shiftCode,
          wo_details_id: woDetailsId,
          derived_sw_code: derivedSwCode,
          other_work_code: otherWorkCode,
          sc_required: skillShort,
          worker_id: null as string | null,
          from_date: eff.fromDate || fromDate,
          from_time: eff.fromTime,
          to_date: eff.toDate || planningToDate,
          to_time: eff.toTime,
          planned_hours: 0,
          time_worked_till_date: workContinuation.timeWorkedTillDate,
          remaining_time: Math.max(0, workContinuation.remainingTime),
          std_time_hours: stdTimeHoursForPlan,
          status: 'draft' as const,
          notes: hasReplanContext ? replanReason : `No worker (planning): ${skillShort}`,
          wsm_id: isNonStandardWork ? null : wsmId
        };

        if (existingPlan && existingPlan.id) {
          planIdsToKeep.add(existingPlan.id);
          updatePromises.push(
            supabase
              .from('prdn_work_planning')
              .update({
                ...planData,
                worker_id: null,
                is_deleted: false,
                modified_by: currentUser,
                modified_dt: now
              })
              .eq('id', existingPlan.id)
              .select()
              .single()
          );
          updatePlanSkillMeta.push({
            planId: existingPlan.id,
            requiredSkill: skillShort,
            workerSkill: ''
          });
          updateNoWorkerPayloads.push({ reason });
        } else {
          insertPromises.push(createWorkPlanning(planData, currentUser));
          insertPlanSkillMeta.push({
            requiredSkill: skillShort,
            workerSkill: ''
          });
          insertNoWorkerPayloads.push({ skillShort, reason });
        }
      }
    }
  } else {
    const worker = formData.selectedWorkers[getWorkerSlotKey('GEN', 0)] || null;
    if (worker) {
      const workerId = (worker as any).emp_id;
      const matchKey = `GEN-${workerId}`;
      const existingPlan = existingPlansMap.get(matchKey);
      const eff = getEffectiveRowTimes(getWorkerSlotKey('GEN', 0), formData);

      const planData = {
        stage_code: stageCode,
        shift_code: shiftCode,
        wo_details_id: woDetailsId,
        derived_sw_code: derivedSwCode,
        other_work_code: otherWorkCode,
        sc_required: 'GEN',
        worker_id: workerId,
        from_date: eff.fromDate || fromDate,
        from_time: eff.fromTime,
        to_date: eff.toDate || planningToDate,
        to_time: eff.toTime,
        planned_hours: eff.plannedHours,
        time_worked_till_date: workContinuation.timeWorkedTillDate,
        remaining_time: Math.max(0, workContinuation.remainingTime - eff.plannedHours),
        std_time_hours: stdTimeHoursForPlan,
        status: 'draft' as const,
        notes: hasReplanContext ? replanReason : 'General work planning'
      };

      if (existingPlan && existingPlan.id) {
        planIdsToKeep.add(existingPlan.id);
        updatePromises.push(
          supabase
            .from('prdn_work_planning')
            .update({
              ...planData,
              is_deleted: false,
              modified_by: currentUser,
              modified_dt: now
            })
            .eq('id', existingPlan.id)
            .select()
            .single()
        );
        updatePlanSkillMeta.push({
          planId: existingPlan.id,
          requiredSkill: 'GEN',
          workerSkill: String((worker as SelectedWorker).skill_short || '')
        });
        updateNoWorkerPayloads.push(null);
      } else {
        insertPromises.push(createWorkPlanning(planData, currentUser));
        insertPlanSkillMeta.push({
          requiredSkill: 'GEN',
          workerSkill: String((worker as SelectedWorker).skill_short || '')
        });
        insertNoWorkerPayloads.push(null);
      }
    }
  }

  if (requiredSkills.length === 0) {
    const generalWorker = formData.selectedWorkers[getWorkerSlotKey('GEN', 0)];
    if (!generalWorker || !generalWorker.emp_id) {
      throw new Error(`Missing worker assignment for slot ${getWorkerSlotKey('GEN', 0)}`);
    }
  }

  // Delete plans that are no longer needed (not in the new set)
  if (isEditMode && planIdsToKeep.size > 0) {
    const allExistingPlanIds = work.existingDraftPlans.map((p: any) => p.id).filter(Boolean);
    const planIdsToDelete = allExistingPlanIds.filter((id: any) => !planIdsToKeep.has(id));
    
    if (planIdsToDelete.length > 0) {
      const { error: deleteError } = await supabase
        .from('prdn_work_planning')
        .update({ 
          is_deleted: true, 
          modified_by: currentUser, 
          modified_dt: now 
        })
        .in('id', planIdsToDelete);
      
      if (deleteError) {
        console.error('Error deleting unused plans:', deleteError);
        throw new Error(`Failed to delete unused plans: ${deleteError.message}`);
      }
      console.log(`🗑️ Deleted ${planIdsToDelete.length} unused plan(s)`);
    }
  } else if (isEditMode && planIdsToKeep.size === 0) {
    // If no plans to keep, delete all existing plans
    const allExistingPlanIds = work.existingDraftPlans.map((p: any) => p.id).filter(Boolean);
    if (allExistingPlanIds.length > 0) {
      const { error: deleteError } = await supabase
        .from('prdn_work_planning')
        .update({ 
          is_deleted: true, 
          modified_by: currentUser, 
          modified_dt: now 
        })
        .in('id', allExistingPlanIds);
      
      if (deleteError) {
        console.error('Error deleting all plans:', deleteError);
        throw new Error(`Failed to delete existing plans: ${deleteError.message}`);
      }
      console.log(`🗑️ Deleted all ${allExistingPlanIds.length} existing plan(s)`);
    }
  }

  if (updatePromises.length === 0 && insertPromises.length === 0) {
    throw new Error('No workers assigned. Please assign at least one worker.');
  }

  const updateResults = await Promise.all(updatePromises);
  const insertResults = await Promise.all(insertPromises);
  
  // Check for errors in updates
  const updateErrors = updateResults.filter((result: any) => result.error);
  if (updateErrors.length > 0) {
    console.error('Errors updating plans:', updateErrors);
    throw new Error(`Failed to update ${updateErrors.length} plan(s)`);
  }
  
  // Check for errors in inserts
  const insertErrors = insertResults.filter((result: any) => result.error || !result);
  if (insertErrors.length > 0) {
    console.error('Errors creating plans:', insertErrors);
    throw new Error(`Failed to create ${insertErrors.length} plan(s)`);
  }
  
  // Collect all created/updated plan IDs for deviation records
  const allPlanIds: number[] = [];
  updateResults.forEach((result: any) => {
    if (result.data && result.data.id) {
      allPlanIds.push(result.data.id);
    }
  });
  insertResults.forEach((result: any) => {
    if (result && result.id) {
      allPlanIds.push(result.id);
    }
  });

  const planSkillMismatchRows: Array<{ planning_id: number; reason: string }> = [];
  updatePlanSkillMeta.forEach((meta) => {
    const required = normalizeSkill(meta.requiredSkill);
    const actual = normalizeSkill(meta.workerSkill);
    if (!required || !meta.workerSkill?.trim() || !actual || required === actual) return;
    planSkillMismatchRows.push({
      planning_id: meta.planId,
      reason: buildSkillMismatchReason(meta.requiredSkill, meta.workerSkill)
    });
  });
  insertResults.forEach((result: any, idx: number) => {
    const meta = insertPlanSkillMeta[idx];
    const planId = result?.id;
    if (!meta || !planId) return;
    const required = normalizeSkill(meta.requiredSkill);
    const actual = normalizeSkill(meta.workerSkill);
    if (!required || !meta.workerSkill?.trim() || !actual || required === actual) return;
    planSkillMismatchRows.push({
      planning_id: planId,
      reason: buildSkillMismatchReason(meta.requiredSkill, meta.workerSkill)
    });
  });
  if (allPlanIds.length > 0) {
    await supabase
      .from('prdn_work_planning_deviations')
      .update({
        is_deleted: true,
        modified_by: currentUser,
        modified_dt: now
      })
      .in('planning_id', allPlanIds)
      .eq('deviation_type', 'skill_mismatch')
      .eq('is_deleted', false);
    await supabase
      .from('prdn_work_planning_deviations')
      .update({
        is_deleted: true,
        modified_by: currentUser,
        modified_dt: now
      })
      .in('planning_id', allPlanIds)
      .eq('deviation_type', 'no_worker')
      .eq('is_deleted', false);
  }
  if (planSkillMismatchRows.length > 0) {
    const { error: mismatchDeviationError } = await supabase
      .from('prdn_work_planning_deviations')
      .insert(
        planSkillMismatchRows.map((row) => ({
          planning_id: row.planning_id,
          deviation_type: 'skill_mismatch',
          reason: row.reason,
          is_active: true,
          is_deleted: false,
          created_by: currentUser,
          created_dt: now
        }))
      );
    if (mismatchDeviationError) {
      throw new Error(`Failed to create skill mismatch deviation(s): ${mismatchDeviationError.message}`);
    }
  }

  const noWorkerDeviationRows: Array<{ planning_id: number; reason: string }> = [];
  insertResults.forEach((result: any, idx: number) => {
    const nw = insertNoWorkerPayloads[idx];
    if (nw && result?.id) {
      noWorkerDeviationRows.push({ planning_id: result.id, reason: nw.reason });
    }
  });
  updateResults.forEach((result: any, idx: number) => {
    const nw = updateNoWorkerPayloads[idx];
    if (nw && result?.data?.id) {
      noWorkerDeviationRows.push({ planning_id: result.data.id, reason: nw.reason });
    }
  });
  if (noWorkerDeviationRows.length > 0) {
    const { error: nwDevErr } = await supabase.from('prdn_work_planning_deviations').insert(
      noWorkerDeviationRows.map((row) => ({
        planning_id: row.planning_id,
        deviation_type: 'no_worker',
        reason: row.reason,
        is_active: true,
        is_deleted: false,
        created_by: currentUser,
        created_dt: now
      }))
    );
    if (nwDevErr) {
      throw new Error(`Failed to create no-worker planning deviation(s): ${nwDevErr.message}`);
    }
  }

  // Create planning records for trainees and deviation records
  if (formData.selectedTrainees && formData.selectedTrainees.length > 0) {
    if (!formData.traineeDeviationReason || !formData.traineeDeviationReason.trim()) {
      throw new Error('Please provide a reason for adding trainees');
    }
    
    const traineePlanPromises: Promise<any>[] = [];
    const deviationPromises: Promise<any>[] = [];
    
    for (let ti = 0; ti < formData.selectedTrainees.length; ti++) {
      const trainee = formData.selectedTrainees[ti];
      const eff = getEffectiveRowTimes(`trainee-${ti}`, formData);
      const traineePlanData = {
        stage_code: stageCode,
        shift_code: shiftCode,
        wo_details_id: woDetailsId,
        derived_sw_code: derivedSwCode,
        other_work_code: otherWorkCode,
        sc_required: 'T', // Trainee skill
        worker_id: trainee.emp_id,
        from_date: eff.fromDate || fromDate,
        from_time: eff.fromTime,
        to_date: eff.toDate || planningToDate,
        to_time: eff.toTime,
        planned_hours: eff.plannedHours,
        time_worked_till_date: workContinuation.timeWorkedTillDate,
        remaining_time: Math.max(0, workContinuation.remainingTime - eff.plannedHours),
        std_time_hours: stdTimeHoursForPlan,
        status: 'draft' as const,
        notes: hasReplanContext ? replanReason : `Trainee: ${trainee.emp_name}`,
        wsm_id: null // Trainees don't have skill mappings
      };
      
      const traineePlanPromise = createWorkPlanning(traineePlanData, currentUser);
      traineePlanPromises.push(traineePlanPromise);
    }
    
    // Wait for all trainee plans to be created
    const traineePlanResults = await Promise.all(traineePlanPromises);
    
    // Check for errors in trainee plan creation
    const traineePlanErrors = traineePlanResults.filter((result: any) => result.error || !result);
    if (traineePlanErrors.length > 0) {
      console.error('Errors creating trainee plans:', traineePlanErrors);
      throw new Error(`Failed to create ${traineePlanErrors.length} trainee plan(s)`);
    }
    
    // Get trainee plan IDs
    const traineePlanIds = traineePlanResults
      .filter((result: any) => result && result.id)
      .map((result: any) => result.id);
    
    // Create deviation records for each trainee
    for (let i = 0; i < traineePlanIds.length; i++) {
      const traineePlanId = traineePlanIds[i];
      const trainee = formData.selectedTrainees[i];
      
      const deviationData = {
        planning_id: traineePlanId,
        deviation_type: 'trainee_addition',
        reason: formData.traineeDeviationReason,
        is_active: true,
        is_deleted: false,
        created_by: currentUser,
        created_dt: now
      };
      
      const { error: deviationError } = await supabase
        .from('prdn_work_planning_deviations')
        .insert(deviationData);
      
      if (deviationError) {
        console.error(`Error creating deviation record for trainee ${trainee.emp_name}:`, deviationError);
        throw new Error(`Failed to create deviation record: ${deviationError.message}`);
      }
      
      console.log(`✅ Created deviation record for trainee ${trainee.emp_name} (plan ID: ${traineePlanId})`);
    }
    
    // Add trainee plans to total count
    allPlanIds.push(...traineePlanIds);
  }
  
  const totalPlans = updateResults.length + insertResults.length + (formData.selectedTrainees?.length || 0);
  
  if (totalPlans > 0) {
    await updateWorkStatus(work, stageCode, currentUser, now, fromDate);
  }
  
  return {
    success: true,
    createdPlans: totalPlans,
    message: isEditMode 
      ? `Successfully updated ${updateResults.length} and created ${insertResults.length + (formData.selectedTrainees?.length || 0)} work plan(s)`
      : `Successfully created ${totalPlans} work plan(s)`
  };
}

async function updateWorkStatus(
  work: any,
  stageCode: string,
  currentUser: string,
  now: string,
  selectedDate: string
): Promise<void> {
  try {
    const isNonStandardWork = work.is_added_work || !work.std_work_type_details?.derived_sw_code;
    const derivedSwCode = isNonStandardWork ? null : (work.std_work_type_details?.derived_sw_code || null);
    const otherWorkCode = isNonStandardWork ? work.sw_code : null;
    const woDetailsId = work.prdn_wo_details_id || work.wo_details_id;

    if (!woDetailsId || (!derivedSwCode && !otherWorkCode)) {
      return;
    }

    // Check if there are any draft plans for this work (update status as soon as any plan exists)
    if (derivedSwCode) {
      const plansQuery = supabase
        .from('prdn_work_planning')
        .select('id, sc_required, status')
        .eq('stage_code', stageCode)
        .eq('wo_details_id', woDetailsId)
        .eq('derived_sw_code', derivedSwCode)
        .eq('from_date', selectedDate)
        .eq('is_deleted', false)
        .eq('is_active', true)
        .eq('status', 'draft');
      
      const { data: plansData, error: plansError } = await plansQuery;
      
      if (plansError) {
        console.error(`❌ Error fetching draft plans for ${derivedSwCode}:`, plansError);
        return;
      }
      
      // Update status to 'Draft Plan' if there's at least one draft plan
      if (plansData && plansData.length > 0) {
        // First check if the work status record exists
        const { data: existingStatus, error: checkError } = await supabase
          .from('prdn_work_status')
          .select('id')
          .eq('stage_code', stageCode)
          .eq('wo_details_id', woDetailsId)
          .eq('derived_sw_code', derivedSwCode)
          .maybeSingle();

        if (checkError) {
          console.error(`❌ Error checking work status for ${derivedSwCode}:`, checkError);
          return;
        }

        if (existingStatus) {
          // Update existing record
          const { error: updateError } = await supabase
            .from('prdn_work_status')
            .update({
              current_status: 'Draft Plan',
              modified_by: currentUser,
              modified_dt: now
            })
            .eq('id', existingStatus.id);

          if (updateError) {
            console.error(`❌ Error updating work status for ${derivedSwCode}:`, updateError);
          } else {
            console.log(`✅ Updated work status to Draft Plan for work ${derivedSwCode} (${plansData.length} draft plan(s) found)`);
          }
        } else {
          // Create new record if it doesn't exist
          const { error: insertError } = await supabase
            .from('prdn_work_status')
            .insert({
              stage_code: stageCode,
              wo_details_id: woDetailsId,
              derived_sw_code: derivedSwCode,
              other_work_code: null,
              current_status: 'Draft Plan',
              created_by: currentUser,
              created_dt: now,
              modified_by: currentUser,
              modified_dt: now
            });

          if (insertError) {
            console.error(`❌ Error creating work status for ${derivedSwCode}:`, insertError);
          } else {
            console.log(`✅ Created work status record with Draft Plan for work ${derivedSwCode} (${plansData.length} draft plan(s) found)`);
          }
        }
      } else {
        console.log(`ℹ️ No draft plans found for ${derivedSwCode} on ${selectedDate}, status not updated`);
      }
      return;
    } else if (otherWorkCode) {
      // For non-standard work, we can't determine required skills from mappings
      // Check if there are any existing plans to determine if it's fully planned
      const { data: existingPlans } = await supabase
        .from('prdn_work_planning')
        .select('sc_required')
        .eq('stage_code', stageCode)
        .eq('wo_details_id', woDetailsId)
        .eq('other_work_code', otherWorkCode)
        .eq('from_date', selectedDate)
        .eq('is_deleted', false)
        .eq('is_active', true);
      
      // For non-standard work, if there's at least one plan, consider it fully planned
      if (existingPlans && existingPlans.length > 0) {
        // First check if the work status record exists
        const { data: existingStatus, error: checkError } = await supabase
          .from('prdn_work_status')
          .select('id')
          .eq('stage_code', stageCode)
          .eq('wo_details_id', woDetailsId)
          .eq('other_work_code', otherWorkCode)
          .maybeSingle();

        if (checkError) {
          console.error(`❌ Error checking work status for non-standard work ${otherWorkCode}:`, checkError);
          return;
        }

        if (existingStatus) {
          // Update existing record
          const { error: updateError } = await supabase
            .from('prdn_work_status')
            .update({
              current_status: 'Draft Plan',
              modified_by: currentUser,
              modified_dt: now
            })
            .eq('id', existingStatus.id);

          if (updateError) {
            console.error(`❌ Error updating work status for non-standard work ${otherWorkCode}:`, updateError);
          } else {
            console.log(`✅ Updated work status to Draft Plan for non-standard work ${otherWorkCode}`);
          }
        } else {
          // Create new record if it doesn't exist
          const { error: insertError } = await supabase
            .from('prdn_work_status')
            .insert({
              stage_code: stageCode,
              wo_details_id: woDetailsId,
              derived_sw_code: null,
              other_work_code: otherWorkCode,
              current_status: 'Draft Plan',
              created_by: currentUser,
              created_dt: now,
              modified_by: currentUser,
              modified_dt: now
            });

          if (insertError) {
            console.error(`❌ Error creating work status for non-standard work ${otherWorkCode}:`, insertError);
          } else {
            console.log(`✅ Created work status record with Draft Plan for non-standard work ${otherWorkCode}`);
          }
        }
      }
      return;
    }
  } catch (error) {
    console.error('Error updating work status:', error);
  }
}

