/**
 * Service for managing work reporting deviations
 */

import { supabase } from '$lib/supabaseClient';
import { getCurrentUsername, getCurrentTimestamp } from '$lib/utils/userUtils';

export type DeviationType = 'no_worker' | 'skill_mismatch' | 'exceeds_std_time';

export interface WorkReportingDeviation {
  id: number;
  reporting_id: number;
  planning_id: number | null;
  deviation_type: DeviationType;
  reason: string;
  is_active: boolean;
  is_deleted: boolean;
  created_by: string;
  created_dt: string;
  modified_by?: string;
  modified_dt?: string;
}

export interface CreateDeviationData {
  reporting_id: number;
  planning_id: number | null;
  deviation_type: DeviationType;
  reason: string;
}

export interface CreateDeviationDataInput {
  reporting_id: number;
  planning_id: number;
  deviation_type: DeviationType;
  reason: string;
}

/**
 * Create a deviation record
 */
export async function createWorkReportingDeviation(
  data: CreateDeviationData
): Promise<{ success: boolean; data?: WorkReportingDeviation; error?: string }> {
  try {
    const currentUser = getCurrentUsername();
    const now = getCurrentTimestamp();

    const { data: deviation, error } = await supabase
      .from('prdn_work_reporting_deviations')
      .insert({
        reporting_id: data.reporting_id,
        planning_id: data.planning_id,
        deviation_type: data.deviation_type,
        reason: data.reason.trim(),
        is_active: true,
        is_deleted: false,
        created_by: currentUser,
        created_dt: now,
        modified_by: currentUser,
        modified_dt: now
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating deviation:', error);
      return { success: false, error: error.message };
    }

    return { success: true, data: deviation };
  } catch (error) {
    console.error('Error creating deviation:', error);
    return {
      success: false,
      error: (error as Error).message
    };
  }
}

/**
 * Create multiple deviation records
 */
export async function createWorkReportingDeviations(
  deviations: CreateDeviationDataInput[]
): Promise<{ success: boolean; created: number; errors: string[] }> {
  const errors: string[] = [];
  let created = 0;

  for (const deviation of deviations) {
    const result = await createWorkReportingDeviation({
      reporting_id: deviation.reporting_id,
      planning_id: deviation.planning_id,
      deviation_type: deviation.deviation_type,
      reason: deviation.reason
    });
    if (result.success) {
      created++;
    } else {
      errors.push(result.error || 'Unknown error');
    }
  }

  return {
    success: errors.length === 0,
    created,
    errors
  };
}

/**
 * Get deviations for a reporting record
 */
export async function getDeviationsForReporting(
  reportingId: number
): Promise<WorkReportingDeviation[]> {
  try {
    const { data, error } = await supabase
      .from('prdn_work_reporting_deviations')
      .select('*')
      .eq('reporting_id', reportingId)
      .eq('is_deleted', false)
      .eq('is_active', true)
      .order('created_dt', { ascending: true });

    if (error) {
      console.error('Error fetching deviations:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Error fetching deviations:', error);
    return [];
  }
}

/**
 * Get deviations for multiple reporting records
 */
export async function getDeviationsForReportings(
  reportingIds: number[]
): Promise<Map<number, WorkReportingDeviation[]>> {
  try {
    const { data, error } = await supabase
      .from('prdn_work_reporting_deviations')
      .select('*')
      .in('reporting_id', reportingIds)
      .eq('is_deleted', false)
      .eq('is_active', true)
      .order('created_dt', { ascending: true });

    if (error) {
      console.error('Error fetching deviations:', error);
      return new Map();
    }

    const deviationsMap = new Map<number, WorkReportingDeviation[]>();
    (data || []).forEach((deviation: WorkReportingDeviation) => {
      if (!deviationsMap.has(deviation.reporting_id)) {
        deviationsMap.set(deviation.reporting_id, []);
      }
      deviationsMap.get(deviation.reporting_id)!.push(deviation);
    });

    return deviationsMap;
  } catch (error) {
    console.error('Error fetching deviations:', error);
    return new Map();
  }
}

