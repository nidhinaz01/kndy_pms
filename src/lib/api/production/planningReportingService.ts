/**
 * Service for planning and reporting submission workflows
 */

import { supabase } from '$lib/supabaseClient';
import { getCurrentUsername, getCurrentTimestamp } from '$lib/utils/userUtils';

// ============================================================================
// PLANNING SERVICES
// ============================================================================

/**
 * Create a planning submission
 * Supports versioning for resubmissions after rejection
 */
export async function createPlanningSubmission(
  stageCode: string,
  planningDate: string
): Promise<{ success: boolean; submissionId?: number; version?: number; error?: string }> {
  try {
    const currentUser = getCurrentUsername();
    const now = getCurrentTimestamp();

    // Check if there's a pending_approval or approved submission (block resubmission in these cases)
    const { data: activeSubmission } = await supabase
      .from('prdn_planning_submissions')
      .select('id, status, version')
      .eq('stage_code', stageCode)
      .eq('planning_date', planningDate)
      .in('status', ['pending_approval', 'approved'])
      .eq('is_deleted', false)
      .order('version', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (activeSubmission) {
      if (activeSubmission.status === 'pending_approval') {
        return { success: false, error: 'A submission is already pending approval for this stage and date' };
      }
      if (activeSubmission.status === 'approved') {
        return { success: false, error: 'A submission has already been approved for this stage and date' };
      }
    }

    // Find the maximum version number for this stage-date combination
    const { data: maxVersionData, error: maxVersionError } = await supabase
      .from('prdn_planning_submissions')
      .select('version')
      .eq('stage_code', stageCode)
      .eq('planning_date', planningDate)
      .eq('is_deleted', false)
      .order('version', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (maxVersionError && maxVersionError.code !== 'PGRST116') {
      // PGRST116 = no rows found, which is fine
      console.error('Error fetching max version:', maxVersionError);
      throw maxVersionError;
    }

    // Calculate next version number
    const nextVersion = maxVersionData?.version ? maxVersionData.version + 1 : 1;

    // Create new submission with incremented version
    const { data, error } = await supabase
      .from('prdn_planning_submissions')
      .insert({
        stage_code: stageCode,
        planning_date: planningDate,
        version: nextVersion,
        submitted_by: currentUser,
        submitted_dt: now,
        status: 'pending_approval',
        created_by: currentUser,
        created_dt: now,
        modified_by: currentUser,
        modified_dt: now
      })
      .select()
      .single();

    if (error) throw error;

    console.log(`Created planning submission v${nextVersion} for ${stageCode} on ${planningDate}`);

    return { success: true, submissionId: data.id, version: nextVersion };
  } catch (error) {
    console.error('Error creating planning submission:', error);
    return { success: false, error: (error as Error).message };
  }
}

/**
 * Get draft work plans for a stage and date
 */
export async function getDraftWorkPlans(
  stageCode: string,
  planningDate: string
): Promise<any[]> {
  try {
    console.log(`🔍 getDraftWorkPlans: Fetching for stage: ${stageCode}, date: ${planningDate}`);
    
    // Fetch plans with status 'draft', 'pending_approval', or 'approved'
    // 'rejected' plans are not included here as they should be editable (treated as draft)
    const { data, error } = await supabase
      .from('prdn_work_planning')
      .select(`
        *,
        hr_emp(emp_id, emp_name, skill_short),
        std_work_type_details(derived_sw_code, sw_code, type_description, std_work_details(sw_name)),
        prdn_wo_details(wo_no, pwo_no, wo_model, customer_name),
        std_work_skill_mapping(wsm_id, sc_name)
      `)
      .eq('stage_code', stageCode)
      .eq('from_date', planningDate)
      .in('status', ['draft', 'pending_approval', 'approved'])
      .eq('is_active', true)
      .eq('is_deleted', false)
      .order('from_time', { ascending: true });

    if (error) {
      console.error('❌ Error fetching draft work plans:', error);
      throw error;
    }
    
    console.log(`📊 getDraftWorkPlans: Raw query returned ${(data || []).length} records`);
    
    // Warn about missing related records (but still include the plan)
    (data || []).forEach(plannedWork => {
      if (!plannedWork.hr_emp) {
        console.warn(`⚠️ Draft plan ID ${plannedWork.id} has missing hr_emp record (worker_id: ${plannedWork.worker_id})`);
      }
      if (!plannedWork.prdn_wo_details) {
        console.warn(`⚠️ Draft plan ID ${plannedWork.id} has missing prdn_wo_details record (wo_details_id: ${plannedWork.wo_details_id})`);
      }
      if (!plannedWork.std_work_type_details) {
        console.warn(`⚠️ Draft plan ID ${plannedWork.id} has missing std_work_type_details record (derived_sw_code: ${plannedWork.derived_sw_code})`);
      }
    });
    
    // Enrich with skill-specific time standards and vehicle work flow using batch queries
    const { batchEnrichItems } = await import('$lib/utils/workEnrichmentService');
    const enrichedPlannedWorks = await batchEnrichItems(data || [], stageCode);

    console.log(`✅ getDraftWorkPlans: Enriched ${enrichedPlannedWorks.length} planned works`);

    return enrichedPlannedWorks;
  } catch (error) {
    console.error('❌ Error fetching draft work plans:', error);
    return [];
  }
}

/**
 * Get draft manpower plans for a stage and date
 */
export async function getDraftManpowerPlans(
  stageCode: string,
  planningDate: string
): Promise<any[]> {
  try {
    const { data, error } = await supabase
      .from('prdn_planning_manpower')
      .select(`
        *,
        hr_emp!inner(emp_id, emp_name, skill_short)
      `)
      .eq('stage_code', stageCode)
      .eq('planning_date', planningDate)
      .eq('status', 'draft')
      .eq('is_active', true)
      .eq('is_deleted', false);

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching draft manpower plans:', error);
    return [];
  }
}

/**
 * Get draft stage reassignment plans
 */
export async function getDraftStageReassignmentPlans(
  stageCode: string,
  planningDate: string
): Promise<any[]> {
  try {
    const { data, error } = await supabase
      .from('prdn_planning_stage_reassignment')
      .select(`
        *,
        hr_emp!inner(emp_id, emp_name, skill_short)
      `)
      .eq('to_stage_code', stageCode)
      .eq('planning_date', planningDate)
      .eq('status', 'draft')
      .eq('is_active', true)
      .eq('is_deleted', false);

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching draft stage reassignment plans:', error);
    return [];
  }
}

/**
 * Submit planning - link all drafts to submission and update status
 */
export async function submitPlanning(
  stageCode: string,
  planningDate: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const currentUser = getCurrentUsername();
    const now = getCurrentTimestamp();

    // Create submission
    const submissionResult = await createPlanningSubmission(stageCode, planningDate);
    if (!submissionResult.success || !submissionResult.submissionId) {
      return submissionResult;
    }

    const submissionId = submissionResult.submissionId;

    // Update all draft work plans
    const { error: workPlansError } = await supabase
      .from('prdn_work_planning')
      .update({
        planning_submission_id: submissionId,
        status: 'pending_approval',
        modified_by: currentUser,
        modified_dt: now
      })
      .eq('stage_code', stageCode)
      .eq('from_date', planningDate)
      .eq('status', 'draft')
      .eq('is_deleted', false);

    if (workPlansError) throw workPlansError;

    // Update all draft manpower plans
    const { error: manpowerError } = await supabase
      .from('prdn_planning_manpower')
      .update({
        planning_submission_id: submissionId,
        status: 'pending_approval',
        modified_by: currentUser,
        modified_dt: now
      })
      .eq('stage_code', stageCode)
      .eq('planning_date', planningDate)
      .eq('status', 'draft')
      .eq('is_deleted', false);

    if (manpowerError) throw manpowerError;

    // Update all draft stage reassignment plans
    const { error: reassignmentError } = await supabase
      .from('prdn_planning_stage_reassignment')
      .update({
        planning_submission_id: submissionId,
        status: 'pending_approval',
        modified_by: currentUser,
        modified_dt: now
      })
      .eq('to_stage_code', stageCode)
      .eq('planning_date', planningDate)
      .eq('status', 'draft')
      .eq('is_deleted', false);

    if (reassignmentError) throw reassignmentError;

    return { success: true };
  } catch (error) {
    console.error('Error submitting planning:', error);
    return { success: false, error: (error as Error).message };
  }
}

// ============================================================================
// REPORTING SERVICES
// ============================================================================

/**
 * Create a reporting submission
 * Supports versioning for resubmissions after rejection
 */
export async function createReportingSubmission(
  stageCode: string,
  reportingDate: string
): Promise<{ success: boolean; submissionId?: number; version?: number; error?: string }> {
  try {
    const currentUser = getCurrentUsername();
    const now = getCurrentTimestamp();

    // Check if there's a pending_approval or approved submission (block resubmission in these cases)
    const { data: activeSubmission } = await supabase
      .from('prdn_reporting_submissions')
      .select('id, status, version')
      .eq('stage_code', stageCode)
      .eq('reporting_date', reportingDate)
      .in('status', ['pending_approval', 'approved'])
      .eq('is_deleted', false)
      .order('version', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (activeSubmission) {
      if (activeSubmission.status === 'pending_approval') {
        return { success: false, error: 'A submission is already pending approval for this stage and date' };
      }
      if (activeSubmission.status === 'approved') {
        return { success: false, error: 'A submission has already been approved for this stage and date' };
      }
    }

    // Find the maximum version number for this stage-date combination
    const { data: maxVersionData, error: maxVersionError } = await supabase
      .from('prdn_reporting_submissions')
      .select('version')
      .eq('stage_code', stageCode)
      .eq('reporting_date', reportingDate)
      .eq('is_deleted', false)
      .order('version', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (maxVersionError && maxVersionError.code !== 'PGRST116') {
      // PGRST116 = no rows found, which is fine
      console.error('Error fetching max version:', maxVersionError);
      throw maxVersionError;
    }

    // Calculate next version number
    const nextVersion = maxVersionData?.version ? maxVersionData.version + 1 : 1;

    // Create new submission with incremented version
    const { data, error } = await supabase
      .from('prdn_reporting_submissions')
      .insert({
        stage_code: stageCode,
        reporting_date: reportingDate,
        version: nextVersion,
        submitted_by: currentUser,
        submitted_dt: now,
        status: 'pending_approval',
        created_by: currentUser,
        created_dt: now,
        modified_by: currentUser,
        modified_dt: now
      })
      .select()
      .single();

    if (error) throw error;

    console.log(`Created reporting submission v${nextVersion} for ${stageCode} on ${reportingDate}`);

    return { success: true, submissionId: data.id, version: nextVersion };
  } catch (error) {
    console.error('Error creating reporting submission:', error);
    return { success: false, error: (error as Error).message };
  }
}

/**
 * Get draft work reports for a stage and date
 */
export async function getDraftWorkReports(
  stageCode: string,
  reportingDate: string
): Promise<any[]> {
  try {
    // Fetch reports with status 'draft', 'pending_approval', or 'approved'
    // 'rejected' reports are not included here as they should be editable (treated as draft)
    const { data, error } = await supabase
      .from('prdn_work_reporting')
      .select(`
        *,
        prdn_work_planning!inner(
          *,
          std_work_type_details(derived_sw_code, sw_code, type_description, std_work_details(sw_name)),
          hr_emp(emp_id, emp_name, skill_short),
          prdn_wo_details!inner(wo_no, pwo_no, wo_model, customer_name),
          std_work_skill_mapping(wsm_id, sc_name)
        )
      `)
      .eq('prdn_work_planning.stage_code', stageCode)
      .eq('from_date', reportingDate)
      .in('status', ['draft', 'pending_approval', 'approved'])
      .eq('is_deleted', false)
      .order('from_time', { ascending: true });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching draft work reports:', error);
    return [];
  }
}

/**
 * Get draft manpower reports for a stage and date
 */
export async function getDraftManpowerReports(
  stageCode: string,
  reportingDate: string
): Promise<any[]> {
  try {
    const { data, error } = await supabase
      .from('prdn_reporting_manpower')
      .select(`
        *,
        hr_emp!inner(emp_id, emp_name, skill_short)
      `)
      .eq('stage_code', stageCode)
      .eq('reporting_date', reportingDate)
      .in('status', ['draft', 'pending_approval', 'approved'])
      .eq('is_active', true)
      .eq('is_deleted', false);

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching draft manpower reports:', error);
    return [];
  }
}

/**
 * Submit reporting - link all drafts to submission and update status
 */
export async function submitReporting(
  stageCode: string,
  reportingDate: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const currentUser = getCurrentUsername();
    const now = getCurrentTimestamp();

    // Ensure reportingDate is in YYYY-MM-DD format
    const dateStr = reportingDate.includes('T') ? reportingDate.split('T')[0] : reportingDate;

    // Create submission
    const submissionResult = await createReportingSubmission(stageCode, dateStr);
    if (!submissionResult.success || !submissionResult.submissionId) {
      console.error('Failed to create reporting submission:', submissionResult.error);
      return submissionResult;
    }

    const submissionId = submissionResult.submissionId;
    console.log('Created reporting submission with ID:', submissionId, 'for stage:', stageCode, 'date:', dateStr);

    // Get planning IDs that have draft reports for this stage and date
    // First, get all draft reports for this stage and date to get their planning IDs
    const { data: draftReports, error: draftReportsError } = await supabase
      .from('prdn_work_reporting')
      .select('planning_id, id')
      .eq('from_date', dateStr)
      .eq('status', 'draft')
      .eq('is_deleted', false)
      .not('planning_id', 'is', null);

    if (draftReportsError) {
      console.error('Error fetching draft reports:', draftReportsError);
      throw draftReportsError;
    }

    console.log('Found draft reports:', draftReports?.length || 0);

    // Get unique planning IDs from the draft reports
    const planningIds = draftReports && draftReports.length > 0
      ? [...new Set(draftReports.map(r => r.planning_id).filter(Boolean))]
      : [];

    console.log('Unique planning IDs from draft reports:', planningIds);

    if (planningIds.length > 0) {
      // Verify these planning IDs belong to the correct stage
      const { data: validPlannings, error: planningCheckError } = await supabase
        .from('prdn_work_planning')
        .select('id, stage_code')
        .eq('stage_code', stageCode)
        .eq('is_deleted', false)
        .in('id', planningIds);

      if (planningCheckError) {
        console.error('Error verifying planning IDs:', planningCheckError);
        throw planningCheckError;
      }

      const validPlanningIds = validPlannings ? validPlannings.map(p => p.id) : [];
      console.log('Valid planning IDs for stage:', validPlanningIds);

      if (validPlanningIds.length > 0) {
        const { data: updatedReports, error: workReportsError } = await supabase
          .from('prdn_work_reporting')
          .update({
            reporting_submission_id: submissionId,
            status: 'pending_approval',
            modified_by: currentUser,
            modified_dt: now
          })
          .eq('from_date', dateStr)
          .eq('status', 'draft')
          .eq('is_deleted', false)
          .in('planning_id', validPlanningIds)
          .select();

        if (workReportsError) {
          console.error('Error updating work reports:', workReportsError);
          throw workReportsError;
        }

        console.log('Updated work reports:', updatedReports?.length || 0);
      } else {
        console.warn('No valid planning IDs found for stage:', stageCode);
      }
    } else {
      console.warn('No draft reports found for date:', dateStr);
    }

    // Update all draft manpower reports
    const { data: updatedManpower, error: manpowerError } = await supabase
      .from('prdn_reporting_manpower')
      .update({
        reporting_submission_id: submissionId,
        status: 'pending_approval',
        modified_by: currentUser,
        modified_dt: now
      })
      .eq('stage_code', stageCode)
      .eq('reporting_date', dateStr)
      .eq('status', 'draft')
      .eq('is_deleted', false)
      .select();

    if (manpowerError) {
      console.error('Error updating manpower reports:', manpowerError);
      throw manpowerError;
    }

    console.log('Updated manpower reports:', updatedManpower?.length || 0);

    // Update all draft stage reassignment reports (if table exists and has records)
    // This is optional - if the table/column doesn't exist, we'll log but not fail
    try {
      const { data: updatedReassignments, error: reassignmentError } = await supabase
        .from('prdn_reporting_stage_reassignment')
        .update({
          reporting_submission_id: submissionId,
          status: 'pending_approval',
          modified_by: currentUser,
          modified_dt: now
        })
        .eq('to_stage_code', stageCode)
        .eq('reporting_date', dateStr)
        .eq('status', 'draft')
        .eq('is_deleted', false)
        .select();

      if (reassignmentError) {
        // Check if error is due to missing column/table - if so, log and continue
        if (reassignmentError.code === 'PGRST204' || reassignmentError.message?.includes('Could not find')) {
          console.warn('Stage reassignment table or column not found - skipping update. This is expected if stage reassignments are not used.');
        } else {
          console.error('Error updating stage reassignments:', reassignmentError);
          // Don't throw - allow submission to succeed even if reassignments fail
        }
      } else {
        console.log('Updated stage reassignments:', updatedReassignments?.length || 0);
      }
    } catch (error) {
      // Catch any unexpected errors and log, but don't fail the submission
      console.warn('Unexpected error updating stage reassignments (non-blocking):', error);
    }

    return { success: true };
  } catch (error) {
    console.error('Error submitting reporting:', error);
    return { success: false, error: (error as Error).message };
  }
}

