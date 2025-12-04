/**
 * Service for saving manpower planning and reporting data
 */

import { supabase } from '$lib/supabaseClient';
import { getCurrentUsername, getCurrentTimestamp } from '$lib/utils/userUtils';

// ============================================================================
// PLANNING SERVICES
// ============================================================================

/**
 * Save planned attendance (for next day)
 */
export async function savePlannedAttendance(
  empId: string,
  stageCode: string,
  planningDate: string,
  attendanceStatus: 'present' | 'absent',
  notes?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const currentUser = getCurrentUsername();
    const now = getCurrentTimestamp();

    // Check if record already exists
    const { data: existing } = await supabase
      .from('prdn_planning_manpower')
      .select('id')
      .eq('emp_id', empId)
      .eq('stage_code', stageCode)
      .eq('planning_date', planningDate)
      .eq('status', 'draft')
      .eq('is_deleted', false)
      .maybeSingle();

    if (existing) {
      // Update existing record
      const { error } = await supabase
        .from('prdn_planning_manpower')
        .update({
          attendance_status: attendanceStatus,
          notes: notes || null,
          modified_by: currentUser,
          modified_dt: now
        })
        .eq('id', existing.id);

      if (error) throw error;
    } else {
      // Create new record
      const { error } = await supabase
        .from('prdn_planning_manpower')
        .insert({
          emp_id: empId,
          stage_code: stageCode,
          planning_date: planningDate,
          attendance_status: attendanceStatus,
          notes: notes || null,
          status: 'draft',
          created_by: currentUser,
          created_dt: now,
          modified_by: currentUser,
          modified_dt: now
        });

      if (error) throw error;
    }

    return { success: true };
  } catch (error) {
    console.error('Error saving planned attendance:', error);
    return { success: false, error: (error as Error).message };
  }
}

/**
 * Save planned stage reassignment (for next day)
 */
export async function savePlannedStageReassignment(
  empId: string,
  fromStageCode: string,
  toStageCode: string,
  planningDate: string,
  shiftCode: string,
  fromTime: string,
  toTime: string,
  reason?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const currentUser = getCurrentUsername();
    const now = getCurrentTimestamp();

    const { error } = await supabase
      .from('prdn_planning_stage_reassignment')
      .insert({
        emp_id: empId,
        from_stage_code: fromStageCode,
        to_stage_code: toStageCode,
        planning_date: planningDate,
        shift_code: shiftCode,
        from_time: fromTime,
        to_time: toTime,
        reason: reason || null,
        status: 'draft',
        created_by: currentUser,
        created_dt: now,
        modified_by: currentUser,
        modified_dt: now
      });

    if (error) throw error;

    return { success: true };
  } catch (error) {
    console.error('Error saving planned stage reassignment:', error);
    return { success: false, error: (error as Error).message };
  }
}

// ============================================================================
// REPORTING SERVICES
// ============================================================================

/**
 * Save reported attendance with LTP/LTNP (for current day)
 */
export async function saveReportedManpower(
  empId: string,
  stageCode: string,
  reportingDate: string,
  attendanceStatus: 'present' | 'absent',
  ltpHours: number,
  ltnpHours: number,
  notes?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const currentUser = getCurrentUsername();
    const now = getCurrentTimestamp();

    // Validate LTP + LTNP
    if (ltpHours < 0 || ltnpHours < 0) {
      return { success: false, error: 'LTP and LTNP hours must be non-negative' };
    }

    // Check if record already exists
    const { data: existing } = await supabase
      .from('prdn_reporting_manpower')
      .select('id')
      .eq('emp_id', empId)
      .eq('stage_code', stageCode)
      .eq('reporting_date', reportingDate)
      .eq('status', 'draft')
      .eq('is_deleted', false)
      .maybeSingle();

    if (existing) {
      // Update existing record
      const { error } = await supabase
        .from('prdn_reporting_manpower')
        .update({
          attendance_status: attendanceStatus,
          ltp_hours: ltpHours,
          ltnp_hours: ltnpHours,
          notes: notes || null,
          modified_by: currentUser,
          modified_dt: now
        })
        .eq('id', existing.id);

      if (error) throw error;
    } else {
      // Create new record
      const { error } = await supabase
        .from('prdn_reporting_manpower')
        .insert({
          emp_id: empId,
          stage_code: stageCode,
          reporting_date: reportingDate,
          attendance_status: attendanceStatus,
          ltp_hours: ltpHours,
          ltnp_hours: ltnpHours,
          notes: notes || null,
          status: 'draft',
          created_by: currentUser,
          created_dt: now,
          modified_by: currentUser,
          modified_dt: now
        });

      if (error) throw error;
    }

    return { success: true };
  } catch (error) {
    console.error('Error saving reported manpower:', error);
    return { success: false, error: (error as Error).message };
  }
}

/**
 * Save reported stage reassignment (for current day)
 */
export async function saveReportedStageReassignment(
  empId: string,
  fromStageCode: string,
  toStageCode: string,
  reportingDate: string,
  shiftCode: string,
  fromTime: string,
  toTime: string,
  reason?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const currentUser = getCurrentUsername();
    const now = getCurrentTimestamp();

    const { error } = await supabase
      .from('prdn_reporting_stage_reassignment')
      .insert({
        emp_id: empId,
        from_stage_code: fromStageCode,
        to_stage_code: toStageCode,
        reporting_date: reportingDate,
        shift_code: shiftCode,
        from_time: fromTime,
        to_time: toTime,
        reason: reason || null,
        status: 'draft',
        created_by: currentUser,
        created_dt: now,
        modified_by: currentUser,
        modified_dt: now
      });

    if (error) throw error;

    return { success: true };
  } catch (error) {
    console.error('Error saving reported stage reassignment:', error);
    return { success: false, error: (error as Error).message };
  }
}

