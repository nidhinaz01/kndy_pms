import { supabase } from '$lib/supabaseClient';

export interface LostTimeReason {
  id: number;
  p_head: 'Payable' | 'Non-Payable';
  lost_time_reason: string;
  is_active: boolean;
  is_deleted: boolean;
  created_by: string;
  created_dt: string;
  modified_by?: string;
  modified_dt?: string;
}

export interface CreateLostTimeReasonData {
  p_head: 'Payable' | 'Non-Payable';
  lost_time_reason: string;
}

export interface UpdateLostTimeReasonData {
  p_head?: 'Payable' | 'Non-Payable';
  lost_time_reason?: string;
  is_active?: boolean;
}

// Fetch all active lost time reasons
export async function fetchActiveLostTimeReasons(): Promise<LostTimeReason[]> {
  try {
    const { data, error } = await supabase
      .from('sys_lost_time_reasons')
      .select('*')
      .eq('is_active', true)
      .eq('is_deleted', false)
      .order('p_head')
      .order('lost_time_reason');

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching active lost time reasons:', error);
    throw error;
  }
}

// Fetch lost time reasons by payable head
export async function fetchLostTimeReasonsByPHead(pHead: 'Payable' | 'Non-Payable'): Promise<LostTimeReason[]> {
  try {
    const { data, error } = await supabase
      .from('sys_lost_time_reasons')
      .select('*')
      .eq('p_head', pHead)
      .eq('is_active', true)
      .eq('is_deleted', false)
      .order('lost_time_reason');

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching lost time reasons by payable head:', error);
    throw error;
  }
}

// Fetch all lost time reasons (including inactive) - for admin purposes
export async function fetchAllLostTimeReasons(): Promise<LostTimeReason[]> {
  try {
    const { data, error } = await supabase
      .from('sys_lost_time_reasons')
      .select('*')
      .eq('is_deleted', false)
      .order('p_head')
      .order('lost_time_reason');

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching all lost time reasons:', error);
    throw error;
  }
}

// Get lost time reason by ID
export async function fetchLostTimeReasonById(id: number): Promise<LostTimeReason | null> {
  try {
    const { data, error } = await supabase
      .from('sys_lost_time_reasons')
      .select('*')
      .eq('id', id)
      .eq('is_active', true)
      .eq('is_deleted', false)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No rows returned
        return null;
      }
      throw error;
    }
    return data;
  } catch (error) {
    console.error('Error fetching lost time reason by ID:', error);
    throw error;
  }
}

// Create new lost time reason
export async function createLostTimeReason(
  reasonData: CreateLostTimeReasonData,
  createdBy: string
): Promise<LostTimeReason> {
  try {
    const now = new Date().toISOString();
    
    const { data, error } = await supabase
      .from('sys_lost_time_reasons')
      .insert({
        ...reasonData,
        created_by: createdBy,
        created_dt: now
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error creating lost time reason:', error);
    throw error;
  }
}

// Update lost time reason
export async function updateLostTimeReason(
  id: number,
  reasonData: UpdateLostTimeReasonData,
  modifiedBy: string
): Promise<LostTimeReason> {
  try {
    const now = new Date().toISOString();
    
    const { data, error } = await supabase
      .from('sys_lost_time_reasons')
      .update({
        ...reasonData,
        modified_by: modifiedBy,
        modified_dt: now
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error updating lost time reason:', error);
    throw error;
  }
}

// Soft delete lost time reason
export async function deleteLostTimeReason(id: number, deletedBy: string): Promise<void> {
  try {
    const now = new Date().toISOString();
    
    const { error } = await supabase
      .from('sys_lost_time_reasons')
      .update({
        is_deleted: true,
        is_active: false,
        modified_by: deletedBy,
        modified_dt: now
      })
      .eq('id', id);

    if (error) throw error;
  } catch (error) {
    console.error('Error deleting lost time reason:', error);
    throw error;
  }
}

// Get payable heads for dropdown
export async function fetchPayableHeads(): Promise<string[]> {
  return ['Payable', 'Non-Payable'];
}

// Get default payable status for a reason
export async function getDefaultPayableStatus(reasonId: number): Promise<boolean> {
  try {
    const reason = await fetchLostTimeReasonById(reasonId);
    return reason?.p_head === 'Payable';
  } catch (error) {
    console.error('Error getting default payable status:', error);
    return false; // Default fallback
  }
}
