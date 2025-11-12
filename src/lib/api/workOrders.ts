import { supabase } from '$lib/supabaseClient';

// Types for work order data
export interface WorkOrderDetails {
  id: number;
  wo_no: string | null;
  pwo_no: string | null;
  wo_type: string;
  wo_model: string;
  wo_chassis: string;
  wheel_base: string;
  model_rate: number;
  body_width_mm: string;
  height: string;
  air_ventilation_nos: string;
  escape_hatch: string;
  front: string;
  rear: string;
  front_glass: string;
  emergency_door_nos: string;
  platform: string;
  inside_grab_rails: string;
  seat_type: string;
  no_of_seats: string;
  seat_configuration: string;
  dickey: string;
  passenger_door_nos: string;
  side_ventilation: string;
  door_position_front: string;
  door_position_rear: string;
  inside_top_panel: string;
  inside_side_panel: string;
  inside_luggage_rack: string;
  sound_system: string;
  paint: string;
  fire_extinguisher_kg: string;
  wiper: string;
  stepney: string;
  record_box_nos: string;
  route_board: string;
  seat_fabrics: string;
  rear_glass: string;
  driver_cabin_partition: string;
  voltage: string;
  work_order_cost: number;
  gst: number;
  cess: number;
  total_cost: number;
  wo_date: string;
  wo_prdn_start: string | null;
  wo_prdn_end: string | null;
  wo_delivery: string | null;
  customer_name: string | null;
}

export interface AdditionalRequirement {
  id: number;
  pos_num: number;
  work_details: string;
  work_qty: number;
  work_rate: number;
  wo_id: number;
}

export interface WorkOrderAmendment {
  id: number;
  pos_num: number;
  work_type: string;
  work_details: string;
  work_cost: number;
  gst: number;
  amend_date: string;
  wo_id: number;
}

export interface WorkOrderSummary {
  id: number;
  wo_no: string | null;
  pwo_no: string | null;
  wo_type: string;
  wo_model: string;
  wo_chassis: string;
  body_width_mm: string;
  height: string;
  passenger_door_nos: string;
  no_of_seats: string;
  seat_configuration: string;
  wo_date: string;
  total_cost: number;
  wo_prdn_start: string | null;
  wo_prdn_end: string | null;
  wo_delivery: string | null;
  customer_name: string | null;
}

/**
 * Fetch all work order summaries for the data table
 */
export async function fetchWorkOrderSummaries(): Promise<WorkOrderSummary[]> {
  try {
    const { data, error } = await supabase
      .from('prdn_wo_details')
      .select(`
        id,
        wo_no,
        pwo_no,
        wo_type,
        wo_model,
        wo_chassis,
        body_width_mm,
        height,
        passenger_door_nos,
        no_of_seats,
        seat_configuration,
        wo_date,
        total_cost,
        wo_prdn_start,
        wo_prdn_end,
        wo_delivery,
        customer_name
      `)
      .order('wo_date', { ascending: false });

    if (error) {
      console.error('Error fetching work order summaries:', error);
      throw error;
    }

    return data || [];
  } catch (error) {
    console.error('Error in fetchWorkOrderSummaries:', error);
    throw error;
  }
}

/**
 * Fetch complete work order details by ID
 */
export async function fetchWorkOrderDetails(id: number): Promise<WorkOrderDetails | null> {
  try {
    const { data, error } = await supabase
      .from('prdn_wo_details')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error('Error fetching work order details:', error);
      throw error;
    }

    return data;
  } catch (error) {
    console.error('Error in fetchWorkOrderDetails:', error);
    throw error;
  }
}

/**
 * Fetch additional requirements for a work order
 */
export async function fetchAdditionalRequirements(woId: number): Promise<AdditionalRequirement[]> {
  try {
    const { data, error } = await supabase
      .from('prdn_wo_add_req')
      .select('*')
      .eq('wo_id', woId)
      .order('pos_num', { ascending: true });

    if (error) {
      console.error('Error fetching additional requirements:', error);
      throw error;
    }

    return data || [];
  } catch (error) {
    console.error('Error in fetchAdditionalRequirements:', error);
    throw error;
  }
}

/**
 * Fetch amendments for a work order
 */
export async function fetchWorkOrderAmendments(woId: number): Promise<WorkOrderAmendment[]> {
  try {
    const { data, error } = await supabase
      .from('prdn_wo_amend')
      .select('*')
      .eq('wo_id', woId)
      .order('amend_date', { ascending: false });

    if (error) {
      console.error('Error fetching work order amendments:', error);
      throw error;
    }

    return data || [];
  } catch (error) {
    console.error('Error in fetchWorkOrderAmendments:', error);
    throw error;
  }
}

/**
 * Fetch all work order types for statistics
 */
export async function fetchWorkOrderTypes(): Promise<string[]> {
  try {
    const { data, error } = await supabase
      .from('mstr_wo_type')
      .select('wo_type_name')
      .eq('is_deleted', false)
      .order('wo_type_name');

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
 * Get work order statistics by type based on the 5 key columns
 * wo_model (type_name), wo_date, wo_prdn_start, wo_prdn_end, wo_delivery
 */
export async function getWorkOrderStatistics(period?: { start: string; end: string }): Promise<{
  typeStats: Array<{
    label: string;
    ordered: number;
    wip: number;
    delivered: number;
  }>;
  totalStats: {
    ordered: number;
    wip: number;
    delivered: number;
  };
}> {
  try {
    // First get all work order types
    const types = await fetchWorkOrderTypes();
    
    // Build the query to get work orders with the 5 key columns
    let query = supabase
      .from('prdn_wo_details')
      .select('wo_model, wo_date, wo_prdn_start, wo_prdn_end, wo_delivery');

    // Apply date filter if period is provided
    if (period) {
      query = query.gte('wo_date', period.start).lte('wo_date', period.end);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching work order statistics:', error);
      throw error;
    }

    const workOrders = data || [];
    const typeStats = types.map(type => {
      const typeOrders = workOrders.filter(wo => wo.wo_model === type);
      
      const ordered = typeOrders.length;
      const wip = typeOrders.filter(wo => wo.wo_prdn_start && !wo.wo_delivery).length;
      const delivered = typeOrders.filter(wo => wo.wo_delivery).length;

      return {
        label: type,
        ordered,
        wip,
        delivered
      };
    });

    const totalStats = {
      ordered: workOrders.length,
      wip: workOrders.filter(wo => wo.wo_prdn_start && !wo.wo_delivery).length,
      delivered: workOrders.filter(wo => wo.wo_delivery).length
    };

    return { typeStats, totalStats };
  } catch (error) {
    console.error('Error in getWorkOrderStatistics:', error);
    throw error;
  }
}

/**
 * Save a new work order
 */
export async function saveWorkOrder(workOrderData: Omit<WorkOrderDetails, 'id'>): Promise<number> {
  try {
    const { data, error } = await supabase
      .from('prdn_wo_details')
      .insert(workOrderData)
      .select('id')
      .single();

    if (error) {
      console.error('Error saving work order:', error);
      throw error;
    }

    return data.id;
  } catch (error) {
    console.error('Error in saveWorkOrder:', error);
    throw error;
  }
}

/**
 * Update an existing work order
 */
export async function updateWorkOrder(id: number, workOrderData: Partial<WorkOrderDetails>): Promise<void> {
  try {
    const { error } = await supabase
      .from('prdn_wo_details')
      .update(workOrderData)
      .eq('id', id);

    if (error) {
      console.error('Error updating work order:', error);
      throw error;
    }
  } catch (error) {
    console.error('Error in updateWorkOrder:', error);
    throw error;
  }
}

/**
 * Delete a work order (soft delete by setting is_deleted flag)
 */
export async function deleteWorkOrder(id: number): Promise<void> {
  try {
    const { error } = await supabase
      .from('prdn_wo_details')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting work order:', error);
      throw error;
    }
  } catch (error) {
    console.error('Error in deleteWorkOrder:', error);
    throw error;
  }
}

/**
 * Save additional requirements for a work order
 */
export async function saveAdditionalRequirements(woId: number, requirements: Omit<AdditionalRequirement, 'id' | 'wo_id'>[]): Promise<void> {
  try {
    const requirementsWithWoId = requirements.map(req => ({ ...req, wo_id: woId }));
    
    const { error } = await supabase
      .from('prdn_wo_add_req')
      .insert(requirementsWithWoId);

    if (error) {
      console.error('Error saving additional requirements:', error);
      throw error;
    }
  } catch (error) {
    console.error('Error in saveAdditionalRequirements:', error);
    throw error;
  }
}

/**
 * Save work order amendments
 */
export async function saveWorkOrderAmendment(amendment: Omit<WorkOrderAmendment, 'id'>): Promise<void> {
  try {
    const { error } = await supabase
      .from('prdn_wo_amend')
      .insert(amendment);

    if (error) {
      console.error('Error saving work order amendment:', error);
      throw error;
    }
  } catch (error) {
    console.error('Error in saveWorkOrderAmendment:', error);
    throw error;
  }
} 