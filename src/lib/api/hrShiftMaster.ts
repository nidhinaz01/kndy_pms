import { supabase } from '$lib/supabaseClient';

export interface HrShiftMaster {
  shift_id?: number;
  shift_name: string;
  shift_code: string;
  start_time: string;
  end_time: string;
  is_active: boolean;
  is_deleted: boolean;
  created_by: string;
  created_dt: string;
  modified_by: string;
  modified_dt?: string;
}

export interface HrShiftMasterFormData {
  shift_name: string;
  shift_code: string;
  start_time: string;
  end_time: string;
}

// Fetch all shifts (not deleted)
export async function fetchAllShifts(): Promise<HrShiftMaster[]> {
  try {
    const { data, error } = await supabase
      .from('hr_shift_master')
      .select('*')
      .eq('is_deleted', false)
      .order('shift_name');

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching shifts:', error);
    throw error;
  }
}

// Save new shift
export async function saveShift(shift: HrShiftMasterFormData): Promise<HrShiftMaster> {
  try {
    // Check if shift code already exists
    const { data: existing, error: checkError } = await supabase
      .from('hr_shift_master')
      .select('shift_id')
      .eq('shift_code', shift.shift_code)
      .eq('is_deleted', false)
      .maybeSingle();

    if (checkError) throw checkError;
    
    if (existing) {
      throw new Error('Shift code already exists.');
    }

    const { getCurrentUsername, getCurrentTimestamp } = await import('$lib/utils/userUtils');
    const username = getCurrentUsername();
    const now = getCurrentTimestamp();

    // Create the shift
    const { data, error } = await supabase
      .from('hr_shift_master')
      .insert([{
        shift_name: shift.shift_name,
        shift_code: shift.shift_code,
        start_time: shift.start_time,
        end_time: shift.end_time,
        is_active: true,
        is_deleted: false,
        created_by: username,
        created_dt: now,
        // modified_by and modified_dt should equal created_by and created_dt on insert
        modified_by: username,
        modified_dt: now
      }])
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error saving shift:', error);
    throw error;
  }
}

// Update shift
export async function updateShift(shift_id: number, shift: Partial<HrShiftMasterFormData>): Promise<void> {
  try {
    const { getCurrentUsername, getCurrentTimestamp } = await import('$lib/utils/userUtils');
    const username = getCurrentUsername();
    const now = getCurrentTimestamp();

    const updateData: any = {
      modified_by: username,
      modified_dt: now
      // created_by and created_dt should not be touched on update
    };

    if (shift.shift_name !== undefined) {
      updateData.shift_name = shift.shift_name;
    }
    if (shift.shift_code !== undefined) {
      updateData.shift_code = shift.shift_code;
    }
    if (shift.start_time !== undefined) {
      updateData.start_time = shift.start_time;
    }
    if (shift.end_time !== undefined) {
      updateData.end_time = shift.end_time;
    }

    const { error } = await supabase
      .from('hr_shift_master')
      .update(updateData)
      .eq('shift_id', shift_id);

    if (error) throw error;
  } catch (error) {
    console.error('Error updating shift:', error);
    throw error;
  }
}

// Toggle active status
export async function toggleShiftActive(shift_id: number, isActive: boolean): Promise<void> {
  try {
    const { getCurrentUsername, getCurrentTimestamp } = await import('$lib/utils/userUtils');
    const username = getCurrentUsername();
    const now = getCurrentTimestamp();

    const { error } = await supabase
      .from('hr_shift_master')
      .update({
        is_active: isActive,
        modified_by: username,
        modified_dt: now
        // created_by and created_dt should not be touched on update
      })
      .eq('shift_id', shift_id);

    if (error) throw error;
  } catch (error) {
    console.error('Error toggling shift status:', error);
    throw error;
  }
}

// Soft delete shift
export async function deleteShift(shift_id: number): Promise<void> {
  try {
    const { getCurrentUsername, getCurrentTimestamp } = await import('$lib/utils/userUtils');
    const username = getCurrentUsername();
    const now = getCurrentTimestamp();

    const { error } = await supabase
      .from('hr_shift_master')
      .update({
        is_deleted: true,
        is_active: false,
        modified_by: username,
        modified_dt: now
        // created_by and created_dt should not be touched on update
      })
      .eq('shift_id', shift_id);

    if (error) throw error;
  } catch (error) {
    console.error('Error deleting shift:', error);
    throw error;
  }
} 