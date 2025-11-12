import { supabase } from '$lib/supabaseClient';
import { sanitizeObject } from '$lib/utils/inputSanitization';

// Types for stage order
export interface StageOrder {
  id: number;
  wo_type_name: string;
  plant_stage: string;
  order_no: number;
  created_by: string;
  created_dt: string;
}

export interface StageOrderHistory {
  his_id: number;
  id: number;
  wo_type_name: string;
  plant_stage: string;
  order_no: number;
  created_by: string;
  created_dt: string;
}

/**
 * Fetch all work order types from mstr_wo_type
 */
export async function fetchWorkOrderTypes(): Promise<string[]> {
  try {
    const { data, error } = await supabase
      .from('mstr_wo_type')
      .select('wo_type_name')
      .or('is_deleted.eq.false,is_deleted.is.null')
      .order('wo_type_name', { ascending: true });

    if (error) {
      console.error('Error fetching work order types:', error);
      throw error;
    }

    return data?.map(item => item.wo_type_name) || [];
  } catch (error) {
    console.error('Error in fetchWorkOrderTypes:', error);
    throw error;
  }
}

/**
 * Fetch all plant stages from data elements
 */
export async function fetchPlantStages(): Promise<string[]> {
  try {
    const { data, error } = await supabase
      .from('sys_data_elements')
      .select('de_value')
      .eq('de_name', 'Plant-Stage')
      .order('de_value', { ascending: true });

    if (error) {
      console.error('Error fetching plant stages:', error);
      throw error;
    }

    return data?.map(item => item.de_value) || [];
  } catch (error) {
    console.error('Error in fetchPlantStages:', error);
    throw error;
  }
}

/**
 * Fetch all stage orders
 */
export async function fetchStageOrders(): Promise<StageOrder[]> {
  try {
    const { data, error } = await supabase
      .from('plan_wo_stage_order')
      .select('*')
      .order('wo_type_name', { ascending: true })
      .order('order_no', { ascending: true });

    if (error) {
      console.error('Error fetching stage orders:', error);
      throw error;
    }

    return data || [];
  } catch (error) {
    console.error('Error in fetchStageOrders:', error);
    throw error;
  }
}

/**
 * Fetch stage orders for a specific work order type
 */
export async function fetchStageOrdersByType(woTypeName: string): Promise<StageOrder[]> {
  try {
    const { data, error } = await supabase
      .from('plan_wo_stage_order')
      .select('*')
      .eq('wo_type_name', woTypeName)
      .order('order_no', { ascending: true });

    if (error) {
      console.error('Error fetching stage orders by type:', error);
      throw error;
    }

    return data || [];
  } catch (error) {
    console.error('Error in fetchStageOrdersByType:', error);
    throw error;
  }
}

/**
 * Fetch stage orders history
 */
export async function fetchStageOrdersHistory(): Promise<StageOrderHistory[]> {
  try {
    const { data, error } = await supabase
      .from('plan_wo_stage_order_his')
      .select('*')
      .order('created_dt', { ascending: false })
      .limit(50);

    if (error) {
      console.error('Error fetching stage orders history:', error);
      throw error;
    }

    return data || [];
  } catch (error) {
    console.error('Error in fetchStageOrdersHistory:', error);
    throw error;
  }
}

/**
 * Create a new stage order
 */
export async function createStageOrder(
  woTypeName: string,
  plantStage: string,
  orderNo: number,
  createdBy: string
): Promise<number> {
  try {
    const sanitizedData = sanitizeObject({
      wo_type_name: woTypeName,
      plant_stage: plantStage,
      order_no: orderNo,
      created_by: createdBy
    });

    const { data, error } = await supabase
      .from('plan_wo_stage_order')
      .insert([sanitizedData])
      .select('id')
      .single();

    if (error) {
      console.error('Error creating stage order:', error);
      throw error;
    }

    return data.id;
  } catch (error) {
    console.error('Error in createStageOrder:', error);
    throw error;
  }
}

/**
 * Update an existing stage order
 */
export async function updateStageOrder(
  id: number,
  woTypeName: string,
  plantStage: string,
  orderNo: number,
  createdBy: string
): Promise<void> {
  try {
    const sanitizedData = sanitizeObject({
      wo_type_name: woTypeName,
      plant_stage: plantStage,
      order_no: orderNo,
      created_by: createdBy
    });

    const { error } = await supabase
      .from('plan_wo_stage_order')
      .update(sanitizedData)
      .eq('id', id);

    if (error) {
      console.error('Error updating stage order:', error);
      throw error;
    }
  } catch (error) {
    console.error('Error in updateStageOrder:', error);
    throw error;
  }
}

/**
 * Delete a stage order
 */
export async function deleteStageOrder(id: number): Promise<void> {
  try {
    const { error } = await supabase
      .from('plan_wo_stage_order')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting stage order:', error);
      throw error;
    }
  } catch (error) {
    console.error('Error in deleteStageOrder:', error);
    throw error;
  }
}

/**
 * Check if a stage order exists for a type and plant stage combination
 */
export async function checkStageOrderExists(woTypeName: string, plantStage: string): Promise<StageOrder | null> {
  try {
    const { data, error } = await supabase
      .from('plan_wo_stage_order')
      .select('*')
      .eq('wo_type_name', woTypeName)
      .eq('plant_stage', plantStage)
      .maybeSingle();

    if (error) {
      console.error('Error checking stage order existence:', error);
      throw error;
    }

    return data;
  } catch (error) {
    console.error('Error in checkStageOrderExists:', error);
    throw error;
  }
}

/**
 * Get the next order number for a work order type
 */
export async function getNextOrderNo(woTypeName: string): Promise<number> {
  try {
    const { data, error } = await supabase
      .from('plan_wo_stage_order')
      .select('order_no')
      .eq('wo_type_name', woTypeName)
      .order('order_no', { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 is "no rows returned"
      console.error('Error getting next order number:', error);
      throw error;
    }

    return data ? data.order_no + 1 : 1;
  } catch (error) {
    console.error('Error in getNextOrderNo:', error);
    throw error;
  }
} 