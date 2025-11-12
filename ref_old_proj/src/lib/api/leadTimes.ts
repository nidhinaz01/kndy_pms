import { supabase } from '$lib/supabaseClient';
import { sanitizeObject } from '$lib/utils/inputSanitization';

// Types for lead times
export interface LeadTime {
  id: number;
  type_name: string;
  plant_stage: string;
  prdn_time: number;
  created_by: string;
  created_dt: string;
}

export interface LeadTimeHistory {
  his_id: number;
  id: number;
  type_name: string;
  plant_stage: string;
  prdn_time: number;
  created_by: string;
  created_dt: string;
}

// Types for stage order (imported from stageOrder.ts)
export interface StageOrder {
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
 * Fetch all stage orders
 */
export async function fetchAllStageOrders(): Promise<StageOrder[]> {
  try {
    const { data, error } = await supabase
      .from('plan_wo_stage_order')
      .select('*')
      .order('wo_type_name', { ascending: true })
      .order('order_no', { ascending: true });

    if (error) {
      console.error('Error fetching all stage orders:', error);
      throw error;
    }

    return data || [];
  } catch (error) {
    console.error('Error in fetchAllStageOrders:', error);
    throw error;
  }
}

/**
 * Fetch all lead times
 */
export async function fetchLeadTimes(): Promise<LeadTime[]> {
  try {
    const { data, error } = await supabase
      .from('plan_lead_times')
      .select('*')
      .order('type_name', { ascending: true })
      .order('plant_stage', { ascending: true });

    if (error) {
      console.error('Error fetching lead times:', error);
      throw error;
    }

    return data || [];
  } catch (error) {
    console.error('Error in fetchLeadTimes:', error);
    throw error;
  }
}

/**
 * Fetch lead times history
 */
export async function fetchLeadTimesHistory(): Promise<LeadTimeHistory[]> {
  try {
    const { data, error } = await supabase
      .from('plan_lead_times_his')
      .select('*')
      .order('created_dt', { ascending: false })
      .limit(50);

    if (error) {
      console.error('Error fetching lead times history:', error);
      throw error;
    }

    return data || [];
  } catch (error) {
    console.error('Error in fetchLeadTimesHistory:', error);
    throw error;
  }
}

/**
 * Create a new lead time
 */
export async function createLeadTime(
  typeName: string,
  plantStage: string,
  prdnTime: number,
  createdBy: string
): Promise<number> {
  try {
    const sanitizedData = sanitizeObject({
      type_name: typeName,
      plant_stage: plantStage,
      prdn_time: prdnTime,
      created_by: createdBy
    });

    const { data, error } = await supabase
      .from('plan_lead_times')
      .insert([sanitizedData])
      .select('id')
      .single();

    if (error) {
      console.error('Error creating lead time:', error);
      throw error;
    }

    return data.id;
  } catch (error) {
    console.error('Error in createLeadTime:', error);
    throw error;
  }
}

/**
 * Update an existing lead time
 */
export async function updateLeadTime(
  id: number,
  typeName: string,
  plantStage: string,
  prdnTime: number,
  createdBy: string
): Promise<void> {
  try {
    const sanitizedData = sanitizeObject({
      type_name: typeName,
      plant_stage: plantStage,
      prdn_time: prdnTime,
      created_by: createdBy
    });

    const { error } = await supabase
      .from('plan_lead_times')
      .update(sanitizedData)
      .eq('id', id);

    if (error) {
      console.error('Error updating lead time:', error);
      throw error;
    }
  } catch (error) {
    console.error('Error in updateLeadTime:', error);
    throw error;
  }
}

/**
 * Delete a lead time
 */
export async function deleteLeadTime(id: number): Promise<void> {
  try {
    const { error } = await supabase
      .from('plan_lead_times')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting lead time:', error);
      throw error;
    }
  } catch (error) {
    console.error('Error in deleteLeadTime:', error);
    throw error;
  }
}

/**
 * Check if a lead time exists for a type and plant stage combination
 */
export async function checkLeadTimeExists(typeName: string, plantStage: string): Promise<LeadTime | null> {
  try {
    const { data, error } = await supabase
      .from('plan_lead_times')
      .select('*')
      .eq('type_name', typeName)
      .eq('plant_stage', plantStage)
      .maybeSingle();

    if (error) {
      console.error('Error checking lead time existence:', error);
      throw error;
    }

    return data;
  } catch (error) {
    console.error('Error in checkLeadTimeExists:', error);
    throw error;
  }
} 