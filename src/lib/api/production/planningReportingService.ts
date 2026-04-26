/**
 * Service for planning and reporting submission workflows
 */

import { supabase } from '$lib/supabaseClient';
import { getCurrentUsername, getCurrentTimestamp } from '$lib/utils/userUtils';

const PAGE_SIZE = 1000;

// ============================================================================
// PLANNING SERVICES
// ============================================================================

/**
 * Create a planning submission
 * Supports versioning for resubmissions after rejection
 */
export async function createPlanningSubmission(
  stageCode: string,
  planningDate: string,
  shiftCode: string
): Promise<{ success: boolean; submissionId?: number; version?: number; error?: string }> {
  try {
    const currentUser = getCurrentUsername();
    const now = getCurrentTimestamp();

    // Check if there's a pending_approval or approved submission (block resubmission in these cases)
    const { data: activeSubmission } = await supabase
      .from('prdn_planning_submissions')
      .select('id, status, version')
      .eq('stage_code', stageCode)
      .eq('shift_code', shiftCode)
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
      .eq('shift_code', shiftCode)
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
        shift_code: shiftCode,
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
  planningDate: string,
  shiftCode: string
): Promise<any[]> {
  try {
    console.log(`🔍 getDraftWorkPlans: Fetching for stage: ${stageCode}, shift: ${shiftCode}, date: ${planningDate}`);
    
    const data: any[] = [];
    let offset = 0;
    let hasMore = true;
    while (hasMore) {
      const { data: page, error } = await supabase
        .from('prdn_work_planning')
        .select(`
          *,
          hr_emp(emp_id, emp_name, skill_short),
          std_work_type_details(derived_sw_code, sw_code, type_description, std_work_details(sw_name)),
          prdn_wo_details(wo_no, pwo_no, wo_model, customer_name),
          std_work_skill_mapping(wsm_id, sc_name)
        `)
        .eq('stage_code', stageCode)
        .eq('shift_code', shiftCode)
        .eq('from_date', planningDate)
        .in('status', ['draft', 'pending_approval', 'approved', 'rejected'])
        .eq('is_active', true)
        .eq('is_deleted', false)
        .order('from_time', { ascending: true })
        .order('id', { ascending: true })
        .range(offset, offset + PAGE_SIZE - 1);

      if (error) {
        console.error('❌ Error fetching draft work plans:', error);
        throw error;
      }
      const rows = page || [];
      data.push(...rows);
      hasMore = rows.length === PAGE_SIZE;
      offset += PAGE_SIZE;
    }
    
    console.log(`📊 getDraftWorkPlans: Raw query returned ${data.length} records`);
    
    // Warn about missing related records (but still include the plan)
    data.forEach(plannedWork => {
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
    const enrichedPlannedWorks = await batchEnrichItems(data, stageCode);

    console.log(`✅ getDraftWorkPlans: Enriched ${enrichedPlannedWorks.length} planned works`);

    return enrichedPlannedWorks;
  } catch (error) {
    console.error('❌ Error fetching draft work plans:', error);
    return [];
  }
}

/**
 * Get draft manpower plans for a stage and date (paginated to avoid 1000-row limit)
 */
export async function getDraftManpowerPlans(
  stageCode: string,
  planningDate: string,
  shiftCode: string
): Promise<any[]> {
  try {
    const allRows: any[] = [];
    let offset = 0;
    let hasMore = true;
    while (hasMore) {
      const { data, error } = await supabase
        .from('prdn_planning_manpower')
        .select(`
          *,
          hr_emp!inner(emp_id, emp_name, skill_short)
        `)
        .eq('stage_code', stageCode)
        .eq('shift_code', shiftCode)
        .lte('planning_from_date', planningDate)
        .gte('planning_to_date', planningDate)
        .eq('status', 'draft')
        .eq('is_active', true)
        .eq('is_deleted', false)
        .order('id')
        .range(offset, offset + PAGE_SIZE - 1);

      if (error) throw error;
      const page = data || [];
      allRows.push(...page);
      hasMore = page.length === PAGE_SIZE;
      offset += PAGE_SIZE;
    }
    return allRows;
  } catch (error) {
    console.error('Error fetching draft manpower plans:', error);
    return [];
  }
}

/**
 * Get draft stage reassignment plans (paginated to avoid 1000-row limit)
 */
export async function getDraftStageReassignmentPlans(
  stageCode: string,
  planningDate: string
): Promise<any[]> {
  try {
    const allRows: any[] = [];
    let offset = 0;
    let hasMore = true;
    while (hasMore) {
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
        .eq('is_deleted', false)
        .order('id')
        .range(offset, offset + PAGE_SIZE - 1);

      if (error) throw error;
      const page = data || [];
      allRows.push(...page);
      hasMore = page.length === PAGE_SIZE;
      offset += PAGE_SIZE;
    }
    return allRows;
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
  planningDate: string,
  shiftCode: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const currentUser = getCurrentUsername();
    const now = getCurrentTimestamp();

    // Create submission
    const submissionResult = await createPlanningSubmission(stageCode, planningDate, shiftCode);
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
      .eq('shift_code', shiftCode)
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
      .eq('shift_code', shiftCode)
      .lte('planning_from_date', planningDate)
      .gte('planning_to_date', planningDate)
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
      .eq('shift_code', shiftCode)
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
  reportingDate: string,
  shiftCode: string
): Promise<{ success: boolean; submissionId?: number; version?: number; error?: string }> {
  try {
    const currentUser = getCurrentUsername();
    const now = getCurrentTimestamp();

    // Check if there's a pending_approval or approved submission (block resubmission in these cases)
    const { data: activeSubmission } = await supabase
      .from('prdn_reporting_submissions')
      .select('id, status, version')
      .eq('stage_code', stageCode)
      .eq('shift_code', shiftCode)
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
      .eq('shift_code', shiftCode)
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
        shift_code: shiftCode,
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
 * Populates each `prdn_work_reporting` row with `reporting_hr_emp` from `worker_id`
 * (the reported worker), not the nested planning assignee.
 */
export async function attachReportingWorkersToRows(rows: any[] | null | undefined): Promise<void> {
  if (!rows?.length) return;

  const idSet = new Set<string>();
  for (const r of rows) {
    if (r?.worker_id != null && String(r.worker_id).trim() !== '') {
      idSet.add(String(r.worker_id));
    }
  }
  if (idSet.size === 0) {
    for (const r of rows) {
      r.reporting_hr_emp = null;
    }
    return;
  }

  const empIds = Array.from(idSet);
  const empMap = new Map<string, { emp_id: string; emp_name: string; skill_short: string | null }>();
  const chunkSize = 200;
  for (let i = 0; i < empIds.length; i += chunkSize) {
    const slice = empIds.slice(i, i + chunkSize);
    const { data, error } = await supabase
      .from('hr_emp')
      .select('emp_id, emp_name, skill_short')
      .in('emp_id', slice);
    if (error) {
      console.error('attachReportingWorkersToRows:', error);
      continue;
    }
    for (const e of data || []) {
      empMap.set(String(e.emp_id), e as { emp_id: string; emp_name: string; skill_short: string | null });
    }
  }

  for (const r of rows) {
    if (r?.worker_id != null && String(r.worker_id).trim() !== '') {
      r.reporting_hr_emp = empMap.get(String(r.worker_id)) ?? null;
    } else {
      r.reporting_hr_emp = null;
    }
  }
}

/**
 * Get draft work reports for a stage and date (paginated to avoid 1000-row limit)
 */
export async function getDraftWorkReports(
  stageCode: string,
  reportingDate: string,
  shiftCode: string
): Promise<any[]> {
  try {
    const allRows: any[] = [];
    let offset = 0;
    let hasMore = true;
    while (hasMore) {
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
        .eq('prdn_work_planning.shift_code', shiftCode)
        .eq('from_date', reportingDate)
        .in('status', ['draft', 'pending_approval', 'approved'])
        .eq('is_deleted', false)
        // Tie-break on id: many workers share the same from_time; without this, keyset/range pagination can repeat rows.
        .order('from_time', { ascending: true })
        .order('id', { ascending: true })
        .range(offset, offset + PAGE_SIZE - 1);

      if (error) throw error;
      const page = data || [];
      allRows.push(...page);
      hasMore = page.length === PAGE_SIZE;
      offset += PAGE_SIZE;
    }
    const seenReportIds = new Set<string>();
    const dedupedRows: any[] = [];
    for (const r of allRows) {
      const rid = r?.id;
      if (rid == null || rid === '') {
        dedupedRows.push(r);
        continue;
      }
      const key = String(rid);
      if (seenReportIds.has(key)) continue;
      seenReportIds.add(key);
      dedupedRows.push(r);
    }
    await attachReportingWorkersToRows(dedupedRows);
    return dedupedRows;
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
  reportingDate: string,
  shiftCode: string
): Promise<any[]> {
  try {
    const { data, error } = await supabase
      .from('prdn_reporting_manpower')
      .select(`
        *,
        hr_emp!inner(emp_id, emp_name, skill_short)
      `)
        .eq('stage_code', stageCode)
        .eq('shift_code', shiftCode)
        .lte('reporting_from_date', reportingDate)
        .gte('reporting_to_date', reportingDate)
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
  reportingDate: string,
  shiftCode: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const currentUser = getCurrentUsername();
    const now = getCurrentTimestamp();

    // Ensure reportingDate is in YYYY-MM-DD format
    const dateStr = reportingDate.includes('T') ? reportingDate.split('T')[0] : reportingDate;

    // Create submission
    const submissionResult = await createReportingSubmission(stageCode, dateStr, shiftCode);
    if (!submissionResult.success || !submissionResult.submissionId) {
      console.error('Failed to create reporting submission:', submissionResult.error);
      return submissionResult;
    }

    const submissionId = submissionResult.submissionId;
    console.log('Created reporting submission with ID:', submissionId, 'for stage:', stageCode, 'date:', dateStr);

    // Get planning IDs that have draft reports for this stage and date (paginated)
    const draftReports: { planning_id: number; id: number }[] = [];
    let draftOffset = 0;
    let draftHasMore = true;
    while (draftHasMore) {
      const { data: page, error: draftReportsError } = await supabase
        .from('prdn_work_reporting')
        .select(`
          planning_id,
          id,
          prdn_work_planning!inner(stage_code, shift_code)
        `)
        .eq('from_date', dateStr)
        .eq('status', 'draft')
        .eq('is_deleted', false)
        .not('planning_id', 'is', null)
        .eq('prdn_work_planning.stage_code', stageCode)
        .eq('prdn_work_planning.shift_code', shiftCode)
        .order('id')
        .range(draftOffset, draftOffset + PAGE_SIZE - 1);

      if (draftReportsError) {
        console.error('Error fetching draft reports:', draftReportsError);
        throw draftReportsError;
      }
      const rows = page || [];
      draftReports.push(...rows);
      draftHasMore = rows.length === PAGE_SIZE;
      draftOffset += PAGE_SIZE;
    }

    console.log('Found draft reports:', draftReports.length);

    // Get unique planning IDs from the draft reports
    const planningIds = draftReports.length > 0
      ? [...new Set(draftReports.map((r: { planning_id: number; id: number }) => r.planning_id).filter(Boolean))]
      : [];

    console.log('Unique planning IDs from draft reports:', planningIds);

    if (planningIds.length > 0) {
      // Verify these planning IDs belong to the correct stage
      const { data: validPlannings, error: planningCheckError } = await supabase
        .from('prdn_work_planning')
        .select('id, stage_code, shift_code')
        .eq('stage_code', stageCode)
        .eq('shift_code', shiftCode)
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
      .eq('shift_code', shiftCode)
      .lte('reporting_from_date', dateStr)
      .gte('reporting_to_date', dateStr)
      .eq('status', 'draft')
      .eq('is_deleted', false)
      .select();

    if (manpowerError) {
      console.error('Error updating manpower reports:', manpowerError);
      throw manpowerError;
    }

    console.log('Updated manpower reports:', updatedManpower?.length || 0);

    // Update all draft stage reassignment reports
    // Prefer linking reporting_submission_id (same behavior as work/manpower submit flow).
    try {
      let reassignmentUpdate = supabase
        .from('prdn_reporting_stage_reassignment')
        .update({
          reporting_submission_id: submissionId,
          status: 'pending_approval',
          modified_by: currentUser,
          modified_dt: now
        })
        .eq('to_stage_code', stageCode)
        .eq('shift_code', shiftCode)
        .eq('reassignment_date', dateStr)
        .eq('status', 'draft')
        .eq('is_deleted', false);

      let { data: updatedReassignments, error: reassignmentError } = await reassignmentUpdate.select();

      // Backward compatibility: if reporting_submission_id doesn't exist yet, retry without it.
      if (
        reassignmentError &&
        (reassignmentError.code === 'PGRST204' ||
          reassignmentError.code === '42703' ||
          reassignmentError.message?.includes('reporting_submission_id') ||
          reassignmentError.message?.includes('Could not find'))
      ) {
        const fallback = await supabase
          .from('prdn_reporting_stage_reassignment')
          .update({
            status: 'pending_approval',
            modified_by: currentUser,
            modified_dt: now
          })
          .eq('to_stage_code', stageCode)
          .eq('shift_code', shiftCode)
          .eq('reassignment_date', dateStr)
          .eq('status', 'draft')
          .eq('is_deleted', false)
          .select();

        updatedReassignments = fallback.data;
        reassignmentError = fallback.error;
      }

      if (reassignmentError) {
        if (
          reassignmentError.code === 'PGRST204' ||
          reassignmentError.code === '42703' ||
          reassignmentError.message?.includes('Could not find')
        ) {
          console.warn('Stage reassignment table or expected columns not found - skipping update. This is non-blocking if stage reassignments are not used.');
        } else {
          console.error('Error updating stage reassignments:', reassignmentError);
        }
      } else {
        console.log('Updated stage reassignments:', updatedReassignments?.length || 0);
      }
    } catch (error) {
      console.warn('Unexpected error updating stage reassignments (non-blocking):', error);
    }

    return { success: true };
  } catch (error) {
    console.error('Error submitting reporting:', error);
    return { success: false, error: (error as Error).message };
  }
}

