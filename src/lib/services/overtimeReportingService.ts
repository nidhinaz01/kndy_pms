/**
 * Service for saving overtime values to work reports
 */

import { supabase } from '$lib/supabaseClient';
import { getCurrentUsername, getCurrentTimestamp } from '$lib/utils/userUtils';
import type { WorkerOvertime } from './overtimeCalculationService';

/**
 * Save overtime values to work reports
 */
export async function saveOvertimeValues(
  overtimeData: WorkerOvertime[]
): Promise<{ success: boolean; error?: string }> {
  try {
    const currentUser = getCurrentUsername();
    const now = getCurrentTimestamp();

    // Collect all updates
    const updates: Array<{
      reportingId: number;
      overtimeMinutes: number;
      overtimeAmount: number;
    }> = [];

    overtimeData.forEach(worker => {
      worker.works.forEach(work => {
        updates.push({
          reportingId: work.reportingId,
          overtimeMinutes: work.overtimeMinutes,
          overtimeAmount: Math.round(work.overtimeAmount * 100) / 100
        });
      });
    });

    if (updates.length === 0) {
      return { success: true };
    }

    // Update each report
    const updatePromises = updates.map(update =>
      supabase
        .from('prdn_work_reporting')
        .update({
          overtime_minutes: update.overtimeMinutes,
          overtime_amount: update.overtimeAmount,
          modified_by: currentUser,
          modified_dt: now
        })
        .eq('id', update.reportingId)
        .eq('is_deleted', false)
    );

    const results = await Promise.all(updatePromises);
    
    // Check for errors
    const errors = results.filter(r => r.error);
    if (errors.length > 0) {
      const errorMessages = errors.map(e => e.error?.message).filter(Boolean);
      return {
        success: false,
        error: `Failed to update some reports: ${errorMessages.join(', ')}`
      };
    }

    console.log(`✅ Successfully updated ${updates.length} work report(s) with overtime values`);
    return { success: true };
  } catch (error) {
    console.error('Error saving overtime values:', error);
    return {
      success: false,
      error: (error as Error).message
    };
  }
}

