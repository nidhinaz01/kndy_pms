import { supabase } from '$lib/supabaseClient';

export async function markAttendance(
  empId: string,
  stageCode: string,
  date: string,
  status: 'present' | 'absent',
  notes?: string,
  markedBy?: string
): Promise<void> {
  try {
    const { getCurrentUsername, getCurrentTimestamp } = await import('$lib/utils/userUtils');
    const username = markedBy || getCurrentUsername();
    const now = getCurrentTimestamp();
    
    const attendanceData = {
      emp_id: empId,
      stage_code: stageCode,
      attendance_date: date,
      attendance_status: status,
      notes: notes || null,
      marked_by: username,
      created_by: username,
      created_dt: now,
      modified_by: username,
      modified_dt: now
    };

    const { data: existingAttendance } = await supabase
      .from('hr_attendance')
      .select('attendance_id')
      .eq('emp_id', empId)
      .eq('attendance_date', date)
      .eq('stage_code', stageCode)
      .eq('is_deleted', false)
      .maybeSingle();

    if (existingAttendance) {
      const { error } = await supabase
        .from('hr_attendance')
        .update({
          attendance_status: status,
          notes: notes || null,
          modified_by: username,
          modified_dt: now
        })
        .eq('attendance_id', existingAttendance.attendance_id);

      if (error) throw error;
    } else {
      const { error } = await supabase
        .from('hr_attendance')
        .insert(attendanceData);

      if (error) throw error;
    }
  } catch (error) {
    console.error('Error marking attendance:', error);
    throw error;
  }
}

export async function reassignEmployee(
  empId: string,
  fromStageCode: string,
  toStageCode: string,
  date: string,
  shiftCode: string,
  fromTime: string,
  toTime: string,
  reason?: string,
  reassignedBy?: string
): Promise<void> {
  try {
    const { getCurrentUsername, getCurrentTimestamp } = await import('$lib/utils/userUtils');
    const username = reassignedBy || getCurrentUsername();
    const now = getCurrentTimestamp();
    
    // Use prdn_reporting_stage_reassignment for actual reassignments (real-time operations)
    const reassignmentData = {
      emp_id: empId,
      from_stage_code: fromStageCode,
      to_stage_code: toStageCode,
      reassignment_date: date,
      shift_code: shiftCode,
      from_time: fromTime,
      to_time: toTime,
      reason: reason || null,
      reassigned_by: username,
      created_by: username,
      created_dt: now,
      modified_by: username,
      modified_dt: now
    };

    const { error } = await supabase
      .from('prdn_reporting_stage_reassignment')
      .insert(reassignmentData);

    if (error) throw error;
  } catch (error) {
    console.error('Error reassigning employee:', error);
    throw error;
  }
}

export async function getEmployeeCurrentStage(
  empId: string,
  date: string
): Promise<string | null> {
  try {
    // Check both reporting and planning reassignments to get current stage
    // Priority: approved reporting > approved planning > draft reporting
    const [reportingData, planningData] = await Promise.all([
      supabase
        .from('prdn_reporting_stage_reassignment')
        .select('to_stage_code')
        .eq('emp_id', empId)
        .eq('reassignment_date', date)
        .eq('is_deleted', false)
        .order('created_dt', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from('prdn_planning_stage_reassignment')
        .select('to_stage_code, status')
        .eq('emp_id', empId)
        .eq('planning_date', date)
        .eq('is_deleted', false)
        .in('status', ['approved', 'pending_approval'])
        .order('created_dt', { ascending: false })
        .limit(1)
        .maybeSingle()
    ]);

    // Prefer reporting reassignments (actual), then approved planning
    if (reportingData.data) {
      return reportingData.data.to_stage_code || null;
    }
    
    if (planningData.data) {
      return planningData.data.to_stage_code || null;
    }

    return null;
  } catch (error) {
    console.error('Error getting employee current stage:', error);
    return null;
  }
}

export async function getEmployeeStageJourney(
  empId: string,
  date: string
): Promise<Array<{
  from_stage: string;
  to_stage: string;
  reassigned_at: string;
  from_time: string;
  to_time: string;
  reason?: string;
  reassigned_by: string;
}>> {
  try {
    // Get journey from both reporting and planning reassignments
    const [reportingResult, planningResult] = await Promise.all([
      supabase
        .from('prdn_reporting_stage_reassignment')
        .select(`
          from_stage_code,
          to_stage_code,
          created_dt,
          from_time,
          to_time,
          reason,
          created_by
        `)
        .eq('emp_id', empId)
        .eq('reassignment_date', date)
        .eq('is_deleted', false)
        .order('created_dt', { ascending: true }),
      supabase
        .from('prdn_planning_stage_reassignment')
        .select(`
          from_stage_code,
          to_stage_code,
          created_dt,
          from_time,
          to_time,
          reason,
          created_by
        `)
        .eq('emp_id', empId)
        .eq('planning_date', date)
        .eq('is_deleted', false)
        .in('status', ['approved', 'pending_approval'])
        .order('created_dt', { ascending: true })
    ]);

    if (reportingResult.error) {
      console.error('Error getting reporting stage journey:', reportingResult.error);
    }
    if (planningResult.error) {
      console.error('Error getting planning stage journey:', planningResult.error);
    }

    // Combine both results and sort by created_dt
    const allReassignments = [
      ...(reportingResult.data || []).map(item => ({
        from_stage: item.from_stage_code,
        to_stage: item.to_stage_code,
        reassigned_at: item.created_dt,
        from_time: item.from_time,
        to_time: item.to_time,
        reason: item.reason,
        reassigned_by: item.created_by || 'N/A'
      })),
      ...(planningResult.data || []).map(item => ({
        from_stage: item.from_stage_code,
        to_stage: item.to_stage_code,
        reassigned_at: item.created_dt,
        from_time: item.from_time,
        to_time: item.to_time,
        reason: item.reason,
        reassigned_by: item.created_by || 'N/A'
      }))
    ].sort((a, b) => new Date(a.reassigned_at).getTime() - new Date(b.reassigned_at).getTime());

    return allReassignments;
  } catch (error) {
    console.error('Error in getEmployeeStageJourney:', error);
    return [];
  }
}

