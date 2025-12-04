import { supabase } from '$lib/supabaseClient';
import type { ReportWorkFormData } from '$lib/types/reportWork';

export async function saveWorkReport(
  plannedWork: any,
  formData: ReportWorkFormData
): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    const { getCurrentUsername, getCurrentTimestamp } = await import('$lib/utils/userUtils');
    const currentUser = getCurrentUsername();
    const now = getCurrentTimestamp();
    
    let ltDetails = null;
    if (formData.ltMinutes > 0 && formData.lostTimeChunks.length > 0) {
      ltDetails = formData.lostTimeChunks.map(chunk => ({
        lt_minutes: chunk.minutes,
        lt_reason: chunk.reasonName,
        is_lt_payable: chunk.isPayable,
        lt_value: Math.round(chunk.cost * 100) / 100 // Round to 2 decimal places
      }));
    }
    
    const insertData = {
      planning_id: plannedWork.id,
      worker_id: formData.selectedWorkerId,
      from_date: formData.fromDate,
      from_time: formData.fromTime,
      to_date: formData.toDate,
      to_time: formData.toTime,
      hours_worked_till_date: formData.completionStatus === 'NC' ? formData.hoursWorkedTillDate + formData.hoursWorkedToday : 0,
      hours_worked_today: formData.hoursWorkedToday,
      completion_status: formData.completionStatus,
      lt_minutes_total: formData.ltMinutes,
      lt_details: ltDetails,
      lt_comments: '',
      status: 'draft',  // Save as draft, will be submitted later
      created_by: currentUser,
      created_dt: now,
      modified_by: currentUser,
      modified_dt: now
    };
    
    const { data, error } = await supabase
      .from('prdn_work_reporting')
      .insert(insertData)
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message || 'Unknown error' };
    }

    return { success: true, data };
  } catch (error) {
    return { success: false, error: (error as Error)?.message || 'Unknown error' };
  }
}

export async function updatePlanningStatus(
  plannedWorkId: number,
  formData: ReportWorkFormData,
  plannedHours: number
): Promise<{ success: boolean; error?: string }> {
  try {
    const { getCurrentUsername, getCurrentTimestamp } = await import('$lib/utils/userUtils');
    const currentUser = getCurrentUsername();
    const now = getCurrentTimestamp();

    // Don't update planning status to 'submitted' anymore - reports are saved as draft
    // Status will be updated when the reporting submission is approved
    // Keep the time tracking updates
    const { error } = await supabase
      .from('prdn_work_planning')
      .update({
        time_worked_till_date: formData.completionStatus === 'NC' ? formData.hoursWorkedTillDate + formData.hoursWorkedToday : 0,
        remaining_time: Math.max(0, plannedHours - (formData.hoursWorkedTillDate + formData.hoursWorkedToday)),
        modified_by: currentUser,
        modified_dt: now
      })
      .eq('id', plannedWorkId);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error)?.message || 'Unknown error' };
  }
}

export async function updateProductionDatesIfFirstReport(reportData: any): Promise<void> {
  try {
    const { data: planningData, error: planningError } = await supabase
      .from('prdn_work_planning')
      .select('stage_code, wo_details_id')
      .eq('id', reportData.planning_id)
      .single();

    if (planningError) return;

    const { data: existingReports, error: reportsError } = await supabase
      .from('prdn_work_reporting')
      .select('id')
      .eq('is_deleted', false)
      .in('planning_id', 
        await supabase
          .from('prdn_work_planning')
          .select('id')
          .eq('stage_code', planningData.stage_code)
          .eq('wo_details_id', planningData.wo_details_id)
          .then(({ data }) => data?.map(p => p.id) || [])
      )
      .order('created_dt', { ascending: true })
      .limit(1);

    if (reportsError || !existingReports) return;

    if (existingReports.length === 1 && existingReports[0].id === reportData.id) {
      const { getCurrentUsername, getCurrentTimestamp } = await import('$lib/utils/userUtils');
      const currentUser = getCurrentUsername();
      const now = getCurrentTimestamp();
      
      await supabase
        .from('prdn_dates')
        .update({
          actual_date: reportData.from_date,
          modified_by: currentUser,
          modified_dt: now
        })
        .eq('sales_order_id', planningData.wo_details_id)
        .eq('stage_code', planningData.stage_code)
        .eq('date_type', 'entry');
    }
  } catch (error) {
    console.error('Error in updateProductionDatesIfFirstReport:', error);
  }
}

export async function updateWorkStatus(
  plannedWorkId: number,
  formData: ReportWorkFormData
): Promise<void> {
  try {
    const { data: planningRecord, error: planningError } = await supabase
      .from('prdn_work_planning')
      .select('derived_sw_code, other_work_code, wo_details_id, stage_code')
      .eq('id', plannedWorkId)
      .single();

    if (planningError || !planningRecord) return;

    const { getCurrentUsername, getCurrentTimestamp } = await import('$lib/utils/userUtils');
    const currentUser = getCurrentUsername();
    const now = getCurrentTimestamp();

    const newStatus = formData.completionStatus === 'C' ? 'Completed' : 'In Progress';
    
    let statusUpdateQuery = supabase
      .from('prdn_work_status')
      .update({
        current_status: newStatus,
        modified_by: currentUser,
        modified_dt: now
      })
      .eq('stage_code', planningRecord.stage_code)
      .eq('wo_details_id', planningRecord.wo_details_id);

    if (planningRecord.derived_sw_code) {
      statusUpdateQuery = statusUpdateQuery.eq('derived_sw_code', planningRecord.derived_sw_code);
    } else if (planningRecord.other_work_code) {
      statusUpdateQuery = statusUpdateQuery.eq('other_work_code', planningRecord.other_work_code);
    }

    await statusUpdateQuery;
  } catch (error) {
    console.error('Error updating work status:', error);
  }
}

