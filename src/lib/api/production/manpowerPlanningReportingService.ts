/**
 * Service for saving manpower planning and reporting data
 */

import { supabase } from '$lib/supabaseClient';
import { getCurrentUsername, getCurrentTimestamp } from '$lib/utils/userUtils';
import { calculateBreakTimeInMinutes } from '$lib/utils/breakTimeUtils';
import type { ManpowerCOffSave } from './productionTypes';

/**
 * Row date span for manpower attendance — same as planning_from/to / reporting_from/to.
 * Absent rows stay pinned to the anchor day; present uses modal dates or defaults to anchor.
 */
function manpowerRowDateSpan(
  attendanceStatus: 'present' | 'absent',
  anchorDay: string,
  spanFrom?: string | null,
  spanTo?: string | null
): { from: string; to: string } {
  const day = typeof anchorDay === 'string' ? anchorDay.split('T')[0] : '';
  if (attendanceStatus === 'absent') {
    return { from: day, to: day };
  }
  const fd = (spanFrom && String(spanFrom).trim()) || day;
  const td = (spanTo && String(spanTo).trim()) || fd;
  return { from: fd, to: td };
}

/** DB columns for c_off_* on prdn_planning_manpower / prdn_reporting_manpower. */
function manpowerCOffColumns(
  attendanceStatus: 'present' | 'absent',
  cOff?: ManpowerCOffSave | null
): Record<string, unknown> {
  if (attendanceStatus === 'absent') {
    return {
      c_off_value: 0.0,
      c_off_from_date: null,
      c_off_from_time: null,
      c_off_to_date: null,
      c_off_to_time: null
    };
  }
  const raw = cOff?.cOffValue != null ? Number(cOff.cOffValue) : 0;
  const allowed = [0, 0.5, 1, 1.5];
  const v = allowed.includes(raw) ? raw : 0;
  if (v <= 0) {
    return {
      c_off_value: 0.0,
      c_off_from_date: null,
      c_off_from_time: null,
      c_off_to_date: null,
      c_off_to_time: null
    };
  }
  return {
    c_off_value: v,
    c_off_from_date: cOff?.cOffFromDate ?? null,
    c_off_from_time: cOff?.cOffFromTime ?? null,
    c_off_to_date: cOff?.cOffToDate ?? null,
    c_off_to_time: cOff?.cOffToTime ?? null
  };
}

/**
 * Helper function to calculate full shift hours (shift duration minus breaks)
 */
async function getFullShiftHours(shiftCode: string): Promise<{ fullShiftHours: number; shiftStartTime: string; shiftEndTime: string; error?: string }> {
  try {
    // Get shift information
    const { data: shiftData, error: shiftError } = await supabase
      .from('hr_shift_master')
      .select('shift_id, start_time, end_time')
      .eq('shift_code', shiftCode)
      .eq('is_active', true)
      .eq('is_deleted', false)
      .maybeSingle();

    if (shiftError || !shiftData) {
      return { fullShiftHours: 8, shiftStartTime: '08:00', shiftEndTime: '17:00', error: 'Unable to fetch shift information' };
    }

    const shiftStartTime = shiftData.start_time;
    const shiftEndTime = shiftData.end_time;
    const shiftId = shiftData.shift_id;

    // Fetch shift breaks
    const { data: shiftBreaks, error: breaksError } = await supabase
      .from('hr_shift_break_master')
      .select('start_time, end_time')
      .eq('shift_id', shiftId)
      .eq('is_active', true)
      .eq('is_deleted', false)
      .order('start_time', { ascending: true });

    if (breaksError) {
      console.error('Error fetching shift breaks:', breaksError);
    }

    // Calculate total break time
    const totalBreakMinutes = calculateBreakTimeInMinutes(
      shiftStartTime,
      shiftEndTime,
      shiftBreaks || []
    );

    // Calculate shift duration in minutes
    const shiftStart = new Date(`2000-01-01T${shiftStartTime}`);
    let shiftEnd = new Date(`2000-01-01T${shiftEndTime}`);
    if (shiftEnd < shiftStart) {
      shiftEnd = new Date(`2000-01-02T${shiftEndTime}`);
    }
    const shiftDurationMinutes = (shiftEnd.getTime() - shiftStart.getTime()) / (1000 * 60);

    // Full shift hours = (shift duration - breaks) / 60
    const fullShiftHours = (shiftDurationMinutes - totalBreakMinutes) / 60;

    return { fullShiftHours, shiftStartTime, shiftEndTime };
  } catch (error) {
    console.error('Error calculating full shift hours:', error);
    return { fullShiftHours: 8, shiftStartTime: '08:00', shiftEndTime: '17:00', error: (error as Error).message };
  }
}

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
  shiftCode: string,
  notes?: string,
  plannedHours?: number,
  fromTime?: string,
  toTime?: string,
  attendanceFromDate?: string | null,
  attendanceToDate?: string | null,
  cOff?: ManpowerCOffSave | null
): Promise<{ success: boolean; error?: string }> {
  console.log('🔍 [savePlannedAttendance] Called with:', {
    empId,
    stageCode,
    planningDate,
    attendanceStatus,
    shiftCode,
    notes,
    plannedHours,
    fromTime,
    toTime,
    attendanceFromDate,
    attendanceToDate
  });
  
  try {
    const currentUser = getCurrentUsername();
    const now = getCurrentTimestamp();

    // If absent, clear time/hours fields
    if (attendanceStatus === 'absent') {
      plannedHours = undefined;
      fromTime = undefined;
      toTime = undefined;
    } else {
      // For present employees, get full shift hours if not provided
      if (plannedHours === undefined || plannedHours === null) {
        const shiftInfo = await getFullShiftHours(shiftCode);
        plannedHours = shiftInfo.fullShiftHours;
        
        // Set default times if not provided
        if (!fromTime) fromTime = shiftInfo.shiftStartTime;
        if (!toTime) toTime = shiftInfo.shiftEndTime;
      }

      // Validate: if planned_hours < full shift, notes is required
      const shiftInfo = await getFullShiftHours(shiftCode);
      if (plannedHours < shiftInfo.fullShiftHours) {
        if (!notes || !notes.trim()) {
          return { 
            success: false, 
            error: 'Reason is required for partial attendance (planned hours less than full shift)' 
          };
        }
      }
    }

    // Check if record already exists
    const { data: existing } = await supabase
      .from('prdn_planning_manpower')
      .select('id')
      .eq('emp_id', empId)
      .eq('stage_code', stageCode)
      .eq('shift_code', shiftCode)
      .lte('planning_from_date', planningDate)
      .gte('planning_to_date', planningDate)
      .eq('status', 'draft')
      .eq('is_deleted', false)
      .maybeSingle();

    const planSpan = manpowerRowDateSpan(attendanceStatus, planningDate, attendanceFromDate, attendanceToDate);
    const updateData: any = {
      attendance_status: attendanceStatus,
      notes: notes?.trim() || null,
      modified_by: currentUser,
      modified_dt: now,
      planning_from_date: planSpan.from,
      planning_to_date: planSpan.to,
      ...manpowerCOffColumns(attendanceStatus, cOff)
    };

    // Add time/hours fields only for present employees
    if (attendanceStatus === 'present') {
      updateData.planned_hours = plannedHours;
      updateData.from_time = fromTime || null;
      updateData.to_time = toTime || null;
      console.log('🔍 [savePlannedAttendance] Setting updateData for present:', {
        planned_hours: updateData.planned_hours,
        from_time: updateData.from_time,
        to_time: updateData.to_time
      });
    } else {
      updateData.planned_hours = null;
      updateData.from_time = null;
      updateData.to_time = null;
    }
    
    console.log('🔍 [savePlannedAttendance] Final updateData:', updateData);
    console.log('🔍 [savePlannedAttendance] Existing record:', existing);

    if (existing) {
      // Update existing record
      console.log('🔍 [savePlannedAttendance] Updating existing record with id:', existing.id);
      const { error } = await supabase
        .from('prdn_planning_manpower')
        .update(updateData)
        .eq('id', existing.id);

      if (error) {
        console.error('🔍 [savePlannedAttendance] Update error:', error);
        throw error;
      } else {
        console.log('🔍 [savePlannedAttendance] Update successful');
      }
    } else {
      const insertSpan = manpowerRowDateSpan(attendanceStatus, planningDate, attendanceFromDate, attendanceToDate);
      // Create new record
      const insertData: any = {
        emp_id: empId,
        stage_code: stageCode,
        shift_code: shiftCode,
        planning_from_date: insertSpan.from,
        planning_to_date: insertSpan.to,
        attendance_status: attendanceStatus,
        notes: notes?.trim() || null,
        status: 'draft',
        created_by: currentUser,
        created_dt: now,
        modified_by: currentUser,
        modified_dt: now,
        ...manpowerCOffColumns(attendanceStatus, cOff)
      };

      // Add time/hours fields only for present employees
      if (attendanceStatus === 'present') {
        insertData.planned_hours = plannedHours;
        insertData.from_time = fromTime || null;
        insertData.to_time = toTime || null;
      }

      const { error } = await supabase
        .from('prdn_planning_manpower')
        .insert(insertData);

      if (error) throw error;
    }

    // Option A: Mirror plan attendance to prdn_reporting_manpower so Report tab shows it.
    // When the user later changes attendance in the Report tab, saveReportedManpower overwrites this row.
    const reportingDate = planningDate;
    const { data: existingReporting } = await supabase
      .from('prdn_reporting_manpower')
      .select('id')
      .eq('emp_id', empId)
      .eq('stage_code', stageCode)
      .eq('shift_code', shiftCode)
      .lte('reporting_from_date', reportingDate)
      .gte('reporting_to_date', reportingDate)
      .eq('status', 'draft')
      .eq('is_deleted', false)
      .maybeSingle();

    const reportSpan = manpowerRowDateSpan(attendanceStatus, reportingDate, attendanceFromDate, attendanceToDate);
    const reportingPayload: any = {
      attendance_status: attendanceStatus,
      ltp_hours: 0,
      ltnp_hours: 0,
      notes: notes?.trim() || null,
      modified_by: currentUser,
      modified_dt: now,
      reporting_from_date: reportSpan.from,
      reporting_to_date: reportSpan.to,
      ...manpowerCOffColumns(attendanceStatus, cOff)
    };
    if (attendanceStatus === 'present') {
      reportingPayload.actual_hours = plannedHours;
      reportingPayload.from_time = fromTime || null;
      reportingPayload.to_time = toTime || null;
    } else {
      reportingPayload.actual_hours = null;
      reportingPayload.from_time = null;
      reportingPayload.to_time = null;
    }

    if (existingReporting) {
      const { error: reportErr } = await supabase
        .from('prdn_reporting_manpower')
        .update(reportingPayload)
        .eq('id', existingReporting.id);
      if (reportErr) {
        console.error('Error mirroring planned attendance to reporting:', reportErr);
        // Do not fail the whole operation; planning was saved
      }
    } else {
      const insertReportSpan = manpowerRowDateSpan(attendanceStatus, reportingDate, attendanceFromDate, attendanceToDate);
      const insertReporting: any = {
        emp_id: empId,
        stage_code: stageCode,
        shift_code: shiftCode,
        reporting_from_date: insertReportSpan.from,
        reporting_to_date: insertReportSpan.to,
        attendance_status: attendanceStatus,
        ltp_hours: 0,
        ltnp_hours: 0,
        notes: notes?.trim() || null,
        status: 'draft',
        created_by: currentUser,
        created_dt: now,
        modified_by: currentUser,
        modified_dt: now,
        ...manpowerCOffColumns(attendanceStatus, cOff)
      };
      if (attendanceStatus === 'present') {
        insertReporting.actual_hours = plannedHours;
        insertReporting.from_time = fromTime || null;
        insertReporting.to_time = toTime || null;
      }
      const { error: reportErr } = await supabase
        .from('prdn_reporting_manpower')
        .insert(insertReporting);
      if (reportErr) {
        console.error('Error mirroring planned attendance to reporting:', reportErr);
        // Do not fail the whole operation; planning was saved
      }
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

    // Insert reporting reassignment first (create reporting row)
    const reportingInsert = {
      emp_id: empId,
      from_stage_code: fromStageCode,
      to_stage_code: toStageCode,
      reassignment_date: planningDate,
      shift_code: shiftCode,
      from_time: fromTime,
      to_time: toTime,
      reason: reason || null,
      reassigned_by: currentUser,
      created_by: currentUser,
      modified_by: currentUser
    };

    const { data: reportingData, error: reportingError } = await supabase
      .from('prdn_reporting_stage_reassignment')
      .insert(reportingInsert)
      .select('reassignment_id')
      .maybeSingle();

    if (reportingError) {
      console.error('Error inserting reporting reassignment (pre-plan):', reportingError);
      throw reportingError;
    }

    const reportingId = reportingData?.reassignment_id;

    // Insert planning reassignment linking to reporting row
    const planningInsert: any = {
      emp_id: empId,
      from_stage_code: fromStageCode,
      to_stage_code: toStageCode,
      planning_date: planningDate,
      shift_code: shiftCode,
      from_time: fromTime,
      to_time: toTime,
      reason: reason || null,
      status: 'draft',
      reporting_reassignment_id: reportingId || null,
      created_by: currentUser,
      created_dt: now,
      modified_by: currentUser,
      modified_dt: now
    };

    const { data: planningData, error: planningError } = await supabase
      .from('prdn_planning_stage_reassignment')
      .insert(planningInsert)
      .select('id')
      .maybeSingle();

    if (planningError) {
      console.error('Error inserting planning reassignment:', planningError);
      // Rollback reporting row (hard delete)
      if (reportingId) {
        await supabase
          .from('prdn_reporting_stage_reassignment')
          .delete()
          .eq('reassignment_id', reportingId);
      }
      throw planningError;
    }

    const planningId = planningData?.id;

    // Update reporting row to reference planning id
    const { error: reportingUpdateError } = await supabase
      .from('prdn_reporting_stage_reassignment')
      .update({ planning_reassignment_id: planningId })
      .eq('reassignment_id', reportingId);

    if (reportingUpdateError) {
      console.error('Error updating reporting reassignment with planning id:', reportingUpdateError);
      // Rollback both inserted rows
      if (reportingId) {
        await supabase
          .from('prdn_reporting_stage_reassignment')
          .delete()
          .eq('reassignment_id', reportingId);
      }
      if (planningId) {
        await supabase
          .from('prdn_planning_stage_reassignment')
          .delete()
          .eq('id', planningId);
      }
      throw reportingUpdateError;
    }

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
  shiftCode: string,
  ltpHours: number,
  ltnpHours: number,
  notes?: string,
  actualHours?: number,
  fromTime?: string,
  toTime?: string,
  attendanceFromDate?: string | null,
  attendanceToDate?: string | null,
  cOff?: ManpowerCOffSave | null
): Promise<{ success: boolean; error?: string }> {
  try {
    const currentUser = getCurrentUsername();
    const now = getCurrentTimestamp();

    // Validate LTP + LTNP
    if (ltpHours < 0 || ltnpHours < 0) {
      return { success: false, error: 'LTP and LTNP hours must be non-negative' };
    }

    // If absent, clear time/hours fields
    if (attendanceStatus === 'absent') {
      actualHours = undefined;
      fromTime = undefined;
      toTime = undefined;
    } else {
      // For present employees, get full shift hours if not provided
      if (actualHours === undefined || actualHours === null) {
        const shiftInfo = await getFullShiftHours(shiftCode);
        actualHours = shiftInfo.fullShiftHours;
        
        // Set default times if not provided
        if (!fromTime) fromTime = shiftInfo.shiftStartTime;
        if (!toTime) toTime = shiftInfo.shiftEndTime;
      }

      // Get planned hours from planning (if exists)
      let plannedHours: number | null = null;
      try {
        const { data: plannedAttendance } = await supabase
          .from('prdn_planning_manpower')
          .select('planned_hours')
          .eq('emp_id', empId)
          .eq('stage_code', stageCode)
          .eq('shift_code', shiftCode)
          .lte('planning_from_date', reportingDate)
          .gte('planning_to_date', reportingDate)
          .eq('attendance_status', 'present')
          .eq('is_deleted', false)
          .order('id', { ascending: false })
          .limit(1)
          .maybeSingle();
        
        plannedHours = plannedAttendance?.planned_hours || null;
      } catch (error) {
        console.warn('Could not fetch planned hours:', error);
      }

      // Get full shift hours
      const shiftInfo = await getFullShiftHours(shiftCode);
      const fullShiftHours = shiftInfo.fullShiftHours;

      // Validate: if actual_hours < planned_hours OR actual_hours < full_shift, notes is required
      if (plannedHours !== null && actualHours < plannedHours) {
        if (!notes || !notes.trim()) {
          return { 
            success: false, 
            error: 'Reason is required for early out (actual hours less than planned hours)' 
          };
        }
      } else if (actualHours < fullShiftHours) {
        if (!notes || !notes.trim()) {
          return { 
            success: false, 
            error: 'Reason is required for partial attendance (actual hours less than full shift)' 
          };
        }
      }
    }

    // Check if record already exists
    const { data: existing } = await supabase
      .from('prdn_reporting_manpower')
      .select('id')
      .eq('emp_id', empId)
      .eq('stage_code', stageCode)
      .eq('shift_code', shiftCode)
      .lte('reporting_from_date', reportingDate)
      .gte('reporting_to_date', reportingDate)
      .eq('status', 'draft')
      .eq('is_deleted', false)
      .maybeSingle();

    const reportingSpan = manpowerRowDateSpan(attendanceStatus, reportingDate, attendanceFromDate, attendanceToDate);
    const updateData: any = {
      attendance_status: attendanceStatus,
      ltp_hours: ltpHours,
      ltnp_hours: ltnpHours,
      notes: notes?.trim() || null,
      modified_by: currentUser,
      modified_dt: now,
      reporting_from_date: reportingSpan.from,
      reporting_to_date: reportingSpan.to,
      ...manpowerCOffColumns(attendanceStatus, cOff)
    };

    // Add time/hours fields only for present employees
    if (attendanceStatus === 'present') {
      updateData.actual_hours = actualHours;
      updateData.from_time = fromTime || null;
      updateData.to_time = toTime || null;
    } else {
      updateData.actual_hours = null;
      updateData.from_time = null;
      updateData.to_time = null;
    }

    if (existing) {
      // Update existing record
      const { error } = await supabase
        .from('prdn_reporting_manpower')
        .update(updateData)
        .eq('id', existing.id);

      if (error) throw error;
    } else {
      const insertRepSpan = manpowerRowDateSpan(attendanceStatus, reportingDate, attendanceFromDate, attendanceToDate);
      // Create new record
      const insertData: any = {
        emp_id: empId,
        stage_code: stageCode,
        shift_code: shiftCode,
        reporting_from_date: insertRepSpan.from,
        reporting_to_date: insertRepSpan.to,
        attendance_status: attendanceStatus,
        ltp_hours: ltpHours,
        ltnp_hours: ltnpHours,
        notes: notes?.trim() || null,
        status: 'draft',
        created_by: currentUser,
        created_dt: now,
        modified_by: currentUser,
        modified_dt: now,
        ...manpowerCOffColumns(attendanceStatus, cOff)
      };

      // Add time/hours fields only for present employees
      if (attendanceStatus === 'present') {
        insertData.actual_hours = actualHours;
        insertData.from_time = fromTime || null;
        insertData.to_time = toTime || null;
      }

      const { error } = await supabase
        .from('prdn_reporting_manpower')
        .insert(insertData);

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
): Promise<{ success: boolean; reassignmentId?: number; error?: string }> {
  try {
    const currentUser = getCurrentUsername();
    const now = getCurrentTimestamp();

    const insertData: any = {
      emp_id: empId,
      from_stage_code: fromStageCode,
      to_stage_code: toStageCode,
      reassignment_date: reportingDate,
      shift_code: shiftCode,
      from_time: fromTime || null,
      to_time: toTime || null,
      reason: reason || null,
      status: 'draft',
      reassigned_by: currentUser,
      created_by: currentUser,
      modified_by: currentUser
    };

    const { data, error } = await supabase
      .from('prdn_reporting_stage_reassignment')
      .insert(insertData)
      .select('reassignment_id')
      .maybeSingle();

    if (error) throw error;

    return { success: true, reassignmentId: data?.reassignment_id };
  } catch (error) {
    console.error('Error saving reported stage reassignment:', error);
    return { success: false, error: (error as Error).message };
  }
}

/**
 * Hard delete a planned stage reassignment by id
 */
export async function deletePlannedStageReassignment(planningId: number): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('prdn_planning_stage_reassignment')
      .delete()
      .eq('id', planningId);
    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error('Error deleting planned stage reassignment:', error);
    return { success: false, error: (error as Error).message };
  }
}

/**
 * Hard delete a reported stage reassignment by reassignment_id
 */
export async function deleteReportedStageReassignment(reassignmentId: number): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('prdn_reporting_stage_reassignment')
      .delete()
      .eq('reassignment_id', reassignmentId);
    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error('Error deleting reported stage reassignment:', error);
    return { success: false, error: (error as Error).message };
  }
}

