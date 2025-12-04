/**
 * Service for cancelling approved work plans
 */

import { supabase } from '$lib/supabaseClient';
import { getCurrentUsername, getCurrentTimestamp } from '$lib/utils/userUtils';

/**
 * Cancel approved work plans
 * Marks plans as is_deleted = true and status = 'cancelled'
 */
export async function cancelWorkPlans(
  planningIds: number[],
  reason: string
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!planningIds || planningIds.length === 0) {
      return { success: false, error: 'No planning IDs provided' };
    }

    if (!reason || reason.trim().length === 0) {
      return { success: false, error: 'Cancellation reason is required' };
    }

    const currentUser = getCurrentUsername();
    const now = getCurrentTimestamp();

    // Update all plans
    const { error } = await supabase
      .from('prdn_work_planning')
      .update({
        is_deleted: true,
        status: 'cancelled',
        notes: reason.trim(),
        modified_by: currentUser,
        modified_dt: now
      })
      .in('id', planningIds)
      .eq('is_deleted', false)
      .eq('status', 'approved');

    if (error) {
      console.error('Error cancelling work plans:', error);
      return { success: false, error: error.message };
    }

    console.log(`✅ Successfully cancelled ${planningIds.length} work plan(s)`);
    return { success: true };
  } catch (error) {
    console.error('Error cancelling work plans:', error);
    return {
      success: false,
      error: (error as Error).message
    };
  }
}

