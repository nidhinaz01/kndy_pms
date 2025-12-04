import { supabase } from '$lib/supabaseClient';
import { getCurrentUsername, getCurrentTimestamp } from '$lib/utils/userUtils';
import type { WorkOrderStageOrder, WorkOrderStageOrderFormData, WorkOrderStageOrderStats } from './planningTypes';

export async function fetchWorkOrderTypes(): Promise<string[]> {
  try {
    const { data, error } = await supabase
      .from('mstr_wo_type')
      .select('wo_type_name')
      .eq('is_active', true)
      .eq('is_deleted', false)
      .order('wo_type_name');

    if (error) throw error;
    return data?.map(item => item.wo_type_name) || [];
  } catch (error) {
    console.error('Error fetching work order types:', error);
    throw error;
  }
}

export async function fetchPlantStages(): Promise<string[]> {
  try {
    const { data, error } = await supabase
      .from('sys_data_elements')
      .select('de_value')
      .eq('de_name', 'Plant-Stage')
      .eq('is_active', true)
      .eq('is_deleted', false)
      .order('de_value');

    if (error) throw error;
    return data?.map(item => item.de_value) || [];
  } catch (error) {
    console.error('Error fetching plant stages:', error);
    throw error;
  }
}

export async function fetchWorkOrderStageOrders(): Promise<WorkOrderStageOrder[]> {
  try {
    const { data, error } = await supabase
      .from('plan_wo_stage_order')
      .select('*')
      .order('wo_type_name', { ascending: true })
      .order('order_no', { ascending: true });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching work order stage orders:', error);
    throw error;
  }
}

/**
 * Check if a work order type and plant stage combination already exists
 * @param woTypeName - The work order type name
 * @param plantStage - The plant stage
 * @returns True if the combination exists, false otherwise
 */
export async function checkWorkOrderStageOrderExists(woTypeName: string, plantStage: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('plan_wo_stage_order')
      .select('id')
      .eq('wo_type_name', woTypeName)
      .eq('plant_stage', plantStage)
      .limit(1);

    if (error) throw error;
    return (data && data.length > 0) || false;
  } catch (error) {
    console.error('Error checking work order stage order existence:', error);
    throw error;
  }
}

export async function saveWorkOrderStageOrder(order: WorkOrderStageOrderFormData): Promise<WorkOrderStageOrder> {
  try {
    const { data, error } = await supabase
      .from('plan_wo_stage_order')
      .insert([{
        ...order,
        created_by: getCurrentUsername(),
        created_dt: getCurrentTimestamp()
      }])
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error saving work order stage order:', error);
    throw error;
  }
}

export async function updateWorkOrderStageOrder(id: number, order: Partial<WorkOrderStageOrderFormData>): Promise<WorkOrderStageOrder> {
  try {
    const { data, error } = await supabase
      .from('plan_wo_stage_order')
      .update({
        ...order
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error updating work order stage order:', error);
    throw error;
  }
}

export async function deleteWorkOrderStageOrder(id: number): Promise<void> {
  try {
    const { error } = await supabase
      .from('plan_wo_stage_order')
      .delete()
      .eq('id', id);

    if (error) throw error;
  } catch (error) {
    console.error('Error deleting work order stage order:', error);
    throw error;
  }
}

/**
 * Get work order stage order statistics
 * Uses database function for efficient calculation
 */
export async function getWorkOrderStageOrderStats(): Promise<WorkOrderStageOrderStats> {
  try {
    const { data, error } = await supabase.rpc('get_work_order_stage_order_stats');

    if (error) throw error;

    // Database function returns JSONB, which Supabase converts to object
    const result = data as {
      total: number;
      active: number;
      inactive: number;
      byType: Record<string, number>;
      byStage: Record<string, number>;
    };

    return result;
  } catch (error) {
    console.error('Error getting work order stage order stats:', error);
    throw error;
  }
}

