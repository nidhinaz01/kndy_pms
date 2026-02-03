/**
 * Service for saving manpower planning and reporting data
 */

import { supabase } from '$lib/supabaseClient';
import { getCurrentUsername, getCurrentTimestamp } from '$lib/utils/userUtils';
import { calculateBreakTimeInMinutes } from '$lib/utils/breakTimeUtils';

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
  toTime?: string
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
    toTime
  });
  
  try {
    const currentUser = getCurrentUsername();
    const now = getCurrentTimestamp();

    // If absent, clear time/hours fields
    if (attendanceStatus === 'absent') {
      plannedHours = null;
      fromTime = null;
      toTime = null;
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
      .eq('planning_date', planningDate)
      .eq('status', 'draft')
      .eq('is_deleted', false)
      .maybeSingle();

    const updateData: any = {
      attendance_status: attendanceStatus,
      notes: notes?.trim() || null,
      modified_by: currentUser,
      modified_dt: now
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
      // Create new record
      const insertData: any = {
        emp_id: empId,
        stage_code: stageCode,
        planning_date: planningDate,
        attendance_status: attendanceStatus,
        notes: notes?.trim() || null,
        status: 'draft',
        created_by: currentUser,
        created_dt: now,
        modified_by: currentUser,
        modified_dt: now
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
  shiftCode: string,
  ltpHours: number,
  ltnpHours: number,
  notes?: string,
  actualHours?: number,
  fromTime?: string,
  toTime?: string
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
      actualHours = null;
      fromTime = null;
      toTime = null;
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
          .eq('planning_date', reportingDate)
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
      .eq('reporting_date', reportingDate)
      .eq('status', 'draft')
      .eq('is_deleted', false)
      .maybeSingle();

    const updateData: any = {
      attendance_status: attendanceStatus,
      ltp_hours: ltpHours,
      ltnp_hours: ltnpHours,
      notes: notes?.trim() || null,
      modified_by: currentUser,
      modified_dt: now
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
      // Create new record
      const insertData: any = {
        emp_id: empId,
        stage_code: stageCode,
        reporting_date: reportingDate,
        attendance_status: attendanceStatus,
        ltp_hours: ltpHours,
        ltnp_hours: ltnpHours,
        notes: notes?.trim() || null,
        status: 'draft',
        created_by: currentUser,
        created_dt: now,
        modified_by: currentUser,
        modified_dt: now
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

