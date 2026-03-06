import { supabase } from '$lib/supabaseClient';

export interface HrShiftBreakMaster {
  break_id?: number;
  shift_id: number;
  break_number: number;
  break_name: string;
  start_time: string;
  end_time: string;
  is_active: boolean;
  is_deleted: boolean;
  created_by: string;
  created_dt: string;
  modified_by: string;
  modified_dt?: string;
}

export interface HrShiftBreakMasterFormData {
  shift_id: number;
  break_number: number;
  break_name: string;
  start_time: string;
  end_time: string;
}

// Fetch all shift breaks (not deleted)
export async function fetchAllShiftBreaks(): Promise<HrShiftBreakMaster[]> {
  try {
    const { data, error } = await supabase
      .from('hr_shift_break_master')
      .select(`
        *,
        hr_shift_master!inner(shift_name, shift_code)
      `)
      .eq('is_deleted', false)
      .order('shift_id, break_number');

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching shift breaks:', error);
    throw error;
  }
}

// Fetch shift breaks by shift ID
export async function fetchShiftBreaksByShiftId(shift_id: number): Promise<HrShiftBreakMaster[]> {
  try {
    const { data, error } = await supabase
      .from('hr_shift_break_master')
      .select('*')
      .eq('shift_id', shift_id)
      .eq('is_deleted', false)
      .order('break_number');

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching shift breaks by shift ID:', error);
    throw error;
  }
}

// Save new shift break
export async function saveShiftBreak(shiftBreak: HrShiftBreakMasterFormData): Promise<HrShiftBreakMaster> {
  try {
    // Check if break number already exists for this shift
    const { data: existing, error: checkError } = await supabase
      .from('hr_shift_break_master')
      .select('break_id')
      .eq('shift_id', shiftBreak.shift_id)
      .eq('break_number', shiftBreak.break_number)
      .eq('is_deleted', false)
      .maybeSingle();

    if (checkError) throw checkError;
    
    if (existing) {
      throw new Error('Break number already exists for this shift.');
    }

    const { getCurrentUsername, getCurrentTimestamp } = await import('$lib/utils/userUtils');
    const username = getCurrentUsername();
    const now = getCurrentTimestamp();

    // Create the shift break
    const { data, error } = await supabase
      .from('hr_shift_break_master')
      .insert([{
        shift_id: shiftBreak.shift_id,
        break_number: shiftBreak.break_number,
        break_name: shiftBreak.break_name,
        start_time: shiftBreak.start_time,
        end_time: shiftBreak.end_time,
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
    console.error('Error saving shift break:', error);
    throw error;
  }
}

// Update shift break
export async function updateShiftBreak(break_id: number, shiftBreak: Partial<HrShiftBreakMasterFormData>): Promise<void> {
  try {
    const { getCurrentUsername, getCurrentTimestamp } = await import('$lib/utils/userUtils');
    const username = getCurrentUsername();
    const now = getCurrentTimestamp();

    const updateData: any = {
      modified_by: username,
      modified_dt: now
      // created_by and created_dt should not be touched on update
    };

    if (shiftBreak.break_number !== undefined) {
      updateData.break_number = shiftBreak.break_number;
    }
    if (shiftBreak.break_name !== undefined) {
      updateData.break_name = shiftBreak.break_name;
    }
    if (shiftBreak.start_time !== undefined) {
      updateData.start_time = shiftBreak.start_time;
    }
    if (shiftBreak.end_time !== undefined) {
      updateData.end_time = shiftBreak.end_time;
    }

    const { error } = await supabase
      .from('hr_shift_break_master')
      .update(updateData)
      .eq('break_id', break_id);

    if (error) throw error;
  } catch (error) {
    console.error('Error updating shift break:', error);
    throw error;
  }
}

// Toggle active status
export async function toggleShiftBreakActive(break_id: number, isActive: boolean): Promise<void> {
  try {
    const { getCurrentUsername, getCurrentTimestamp } = await import('$lib/utils/userUtils');
    const username = getCurrentUsername();
    const now = getCurrentTimestamp();

    const { error } = await supabase
      .from('hr_shift_break_master')
      .update({
        is_active: isActive,
        modified_by: username,
        modified_dt: now
        // created_by and created_dt should not be touched on update
      })
      .eq('break_id', break_id);

    if (error) throw error;
  } catch (error) {
    console.error('Error toggling shift break status:', error);
    throw error;
  }
}

// Soft delete shift break
export async function deleteShiftBreak(break_id: number): Promise<void> {
  try {
    const { getCurrentUsername, getCurrentTimestamp } = await import('$lib/utils/userUtils');
    const username = getCurrentUsername();
    const now = getCurrentTimestamp();

    const { error } = await supabase
      .from('hr_shift_break_master')
      .update({
        is_deleted: true,
        is_active: false,
        modified_by: username,
        modified_dt: now
        // created_by and created_dt should not be touched on update
      })
      .eq('break_id', break_id);

    if (error) throw error;
  } catch (error) {
    console.error('Error deleting shift break:', error);
    throw error;
  }
} 