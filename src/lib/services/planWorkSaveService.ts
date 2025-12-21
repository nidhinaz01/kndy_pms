import { supabase } from '$lib/supabaseClient';
import { createWorkPlanning } from '$lib/api/production';
import { getIndividualSkills } from '$lib/utils/planWorkUtils';
import { getCurrentUsername, getCurrentTimestamp } from '$lib/utils/userUtils';
import type { PlanWorkFormData, WorkContinuation } from '$lib/types/planWork';

export async function saveWorkPlanning(
  work: any,
  formData: PlanWorkFormData,
  workContinuation: WorkContinuation,
  stageCode: string,
  fromDate: string,
  toDate?: string
): Promise<{ success: boolean; createdPlans: number; message: string }> {
  // Use toDate if provided, otherwise use fromDate
  const planningToDate = toDate || fromDate;
  const requiredSkills = work?.skill_mappings || [];
  const assignedWorkers = Object.values(formData.selectedWorkers).filter(Boolean);
  
  if (requiredSkills.length > 0 && assignedWorkers.length === 0) {
    throw new Error('Please assign workers for all required skills');
  }

  if (!formData.fromTime || !formData.toTime) {
    throw new Error('Please fill in all required fields');
  }

  const currentUser = getCurrentUsername();
  const now = getCurrentTimestamp();
  
  // Check if this is edit mode (has existing draft plans to replace)
  const isEditMode = work?.existingDraftPlans && Array.isArray(work.existingDraftPlans) && work.existingDraftPlans.length > 0;
  
  const isNonStandardWork = work.is_added_work || !work.std_work_type_details?.derived_sw_code;
  const woDetailsId = work.prdn_wo_details_id || work.wo_details_id || 1;
  const derivedSwCode = isNonStandardWork ? null : (work.std_work_type_details?.derived_sw_code || null);
  const otherWorkCode = isNonStandardWork ? work.sw_code : null;
  
  // Create a map of existing plans by skill and worker for matching
  const existingPlansMap = new Map<string, any>();
  if (isEditMode) {
    work.existingDraftPlans.forEach((plan: any) => {
      const skill = plan.sc_required || plan.skill_short;
      const workerId = plan.worker_id || plan.hr_emp?.emp_id;
      if (skill && workerId) {
        const key = `${skill}-${workerId}`;
        existingPlansMap.set(key, plan);
      }
    });
  }
  
  const updatePromises: Promise<any>[] = [];
  const insertPromises: Promise<any>[] = [];
  const planIdsToKeep = new Set<number>();
  
  if (requiredSkills.length > 0) {
    const selectedSkillMapping = work.skill_mappings[formData.selectedSkillMappingIndex >= 0 ? formData.selectedSkillMappingIndex : 0];
    const individualSkills = getIndividualSkills(selectedSkillMapping);
    const wsmId = (selectedSkillMapping as any)?.wsm_id || null;
    
    individualSkills.forEach((skillShort, index) => {
      const workerKey = `${skillShort}-${index}`;
      const worker = formData.selectedWorkers[workerKey] || formData.selectedWorkers[skillShort];
      
      if (worker) {
        const workerId = (worker as any).emp_id;
        const matchKey = `${skillShort}-${workerId}`;
        const existingPlan = existingPlansMap.get(matchKey);
        
        const planData = {
          stage_code: stageCode,
          wo_details_id: woDetailsId,
          derived_sw_code: derivedSwCode,
          other_work_code: otherWorkCode,
          sc_required: skillShort,
          worker_id: workerId,
          from_date: fromDate,
          from_time: formData.fromTime,
          to_date: planningToDate,
          to_time: formData.toTime,
          planned_hours: formData.plannedHours,
          time_worked_till_date: workContinuation.timeWorkedTillDate,
          remaining_time: workContinuation.remainingTime,
          status: 'draft' as const,
          notes: `Planned for ${skillShort} skill`,
          wsm_id: isNonStandardWork ? null : wsmId
        };
        
        if (existingPlan && existingPlan.id) {
          // Update existing plan
          planIdsToKeep.add(existingPlan.id);
          const updatePromise = supabase
            .from('prdn_work_planning')
            .update({
              ...planData,
              is_deleted: false, // Ensure it's not deleted
              modified_by: currentUser,
              modified_dt: now
            })
            .eq('id', existingPlan.id)
            .select()
            .single();
          updatePromises.push(updatePromise);
          console.log(`🔄 Updating plan ${existingPlan.id} for skill ${skillShort}, worker ${workerId}`);
        } else {
          // Create new plan
          insertPromises.push(
            createWorkPlanning(planData, currentUser)
          );
          console.log(`➕ Creating new plan for skill ${skillShort}, worker ${workerId}`);
        }
      }
    });
  } else {
    const worker = Object.values(formData.selectedWorkers)[0];
    if (worker) {
      const workerId = (worker as any).emp_id;
      const matchKey = `GEN-${workerId}`;
      const existingPlan = existingPlansMap.get(matchKey);
      
      const planData = {
        stage_code: stageCode,
        wo_details_id: woDetailsId,
        derived_sw_code: derivedSwCode,
        other_work_code: otherWorkCode,
        sc_required: 'GEN',
        worker_id: workerId,
        from_date: fromDate,
        from_time: formData.fromTime,
        to_date: planningToDate,
        to_time: formData.toTime,
        planned_hours: formData.plannedHours,
        time_worked_till_date: workContinuation.timeWorkedTillDate,
        remaining_time: workContinuation.remainingTime,
        status: 'draft' as const,
        notes: 'General work planning'
      };
      
      if (existingPlan && existingPlan.id) {
        // Update existing plan
        planIdsToKeep.add(existingPlan.id);
        const updatePromise = supabase
          .from('prdn_work_planning')
          .update({
            ...planData,
            is_deleted: false,
            modified_by: currentUser,
            modified_dt: now
          })
          .eq('id', existingPlan.id)
          .select()
          .single();
        updatePromises.push(updatePromise);
      } else {
        // Create new plan
        insertPromises.push(
          createWorkPlanning(planData, currentUser)
        );
      }
    }
  }

  // Delete plans that are no longer needed (not in the new set)
  if (isEditMode && planIdsToKeep.size > 0) {
    const allExistingPlanIds = work.existingDraftPlans.map((p: any) => p.id).filter(Boolean);
    const planIdsToDelete = allExistingPlanIds.filter(id => !planIdsToKeep.has(id));
    
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
  
  const totalPlans = updateResults.length + insertResults.length;
  
  if (totalPlans > 0) {
    await updateWorkStatus(work, stageCode, currentUser, now, fromDate);
  }
  
  return {
    success: true,
    createdPlans: totalPlans,
    message: isEditMode 
      ? `Successfully updated ${updateResults.length} and created ${insertResults.length} work plan(s)`
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

