import { supabase } from '$lib/supabaseClient';

export interface StdVehicleWorkFlow {
  vwf_id?: number;
  wo_type_id: number;
  derived_sw_code: string;
  sequence_order: number;
  dependency_derived_sw_code?: string;
  estimated_duration_minutes: number;
  is_active: boolean;
  is_deleted: boolean;
  created_by: string;
  created_dt: string;
  modified_by: string;
  modified_dt?: string;
}

export interface VehicleWorkFlowFormData {
  wo_type_id: number;
  derived_sw_code: string;
  sequence_order: number;
  dependency_derived_sw_code?: string;
  estimated_duration_minutes: number;
}

// Fetch all vehicle work flows (not deleted)
export async function fetchAllVehicleWorkFlows(): Promise<StdVehicleWorkFlow[]> {
  try {
    const { data, error } = await supabase
      .from('std_vehicle_work_flow')
      .select(`
        *,
        mstr_wo_type!inner(wo_type_name),
        work_details:std_vehicle_work_flow_derived_sw_code_fkey(type_description, sw_code, std_work_details!inner(sw_name, plant_stage))
      `)
      .eq('is_deleted', false)
      .order('wo_type_id, sequence_order');

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching vehicle work flows:', error);
    throw error;
  }
}

// Fetch vehicle work flows by vehicle type
export async function fetchVehicleWorkFlowsByType(wo_type_id: number): Promise<StdVehicleWorkFlow[]> {
  try {
    const { data, error } = await supabase
      .from('std_vehicle_work_flow')
      .select(`
        *,
        mstr_wo_type!inner(wo_type_name),
        work_details:std_vehicle_work_flow_derived_sw_code_fkey(type_description, sw_code, std_work_details!inner(sw_name, plant_stage))
      `)
      .eq('wo_type_id', wo_type_id)
      .eq('is_deleted', false)
      .order('sequence_order');

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching vehicle work flows by type:', error);
    throw error;
  }
}

// Save new vehicle work flow
export async function saveVehicleWorkFlow(workFlow: VehicleWorkFlowFormData): Promise<StdVehicleWorkFlow> {
  try {
    // Check if sequence order already exists for this vehicle type
    const { data: existing, error: checkError } = await supabase
      .from('std_vehicle_work_flow')
      .select('vwf_id')
      .eq('wo_type_id', workFlow.wo_type_id)
      .eq('sequence_order', workFlow.sequence_order)
      .eq('is_deleted', false)
      .maybeSingle();

    if (checkError) throw checkError;
    
    if (existing) {
      throw new Error('Sequence order already exists for this vehicle type.');
    }

    const { getCurrentUsername, getCurrentTimestamp } = await import('$lib/utils/userUtils');
    const username = getCurrentUsername();
    const now = getCurrentTimestamp();

    // Create the work flow
    const { data, error } = await supabase
      .from('std_vehicle_work_flow')
      .insert([{
        wo_type_id: workFlow.wo_type_id,
        derived_sw_code: workFlow.derived_sw_code,
        sequence_order: workFlow.sequence_order,
        dependency_derived_sw_code: workFlow.dependency_derived_sw_code,
        estimated_duration_minutes: workFlow.estimated_duration_minutes,
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
    console.error('Error saving vehicle work flow:', error);
    throw error;
  }
}

// Update vehicle work flow
export async function updateVehicleWorkFlow(vwf_id: number, workFlow: Partial<VehicleWorkFlowFormData>): Promise<void> {
  try {
    const { getCurrentUsername, getCurrentTimestamp } = await import('$lib/utils/userUtils');
    const username = getCurrentUsername();
    const now = getCurrentTimestamp();

    const updateData: any = {
      modified_by: username,
      modified_dt: now
      // created_by and created_dt should not be touched on update
    };

    if (workFlow.sequence_order !== undefined) {
      updateData.sequence_order = workFlow.sequence_order;
    }
    if (workFlow.dependency_derived_sw_code !== undefined) {
      updateData.dependency_derived_sw_code = workFlow.dependency_derived_sw_code;
    }
    if (workFlow.estimated_duration_minutes !== undefined) {
      updateData.estimated_duration_minutes = workFlow.estimated_duration_minutes;
    }

    const { error } = await supabase
      .from('std_vehicle_work_flow')
      .update(updateData)
      .eq('vwf_id', vwf_id);

    if (error) throw error;
  } catch (error) {
    console.error('Error updating vehicle work flow:', error);
    throw error;
  }
}

// Toggle active status
export async function toggleVehicleWorkFlowActive(vwf_id: number, isActive: boolean): Promise<void> {
  try {
    const { getCurrentUsername, getCurrentTimestamp } = await import('$lib/utils/userUtils');
    const username = getCurrentUsername();
    const now = getCurrentTimestamp();

    const { error } = await supabase
      .from('std_vehicle_work_flow')
      .update({
        is_active: isActive,
        modified_by: username,
        modified_dt: now
        // created_by and created_dt should not be touched on update
      })
      .eq('vwf_id', vwf_id);

    if (error) throw error;
  } catch (error) {
    console.error('Error toggling vehicle work flow status:', error);
    throw error;
  }
}

// Soft delete vehicle work flow
export async function deleteVehicleWorkFlow(vwf_id: number): Promise<void> {
  try {
    const { getCurrentUsername, getCurrentTimestamp } = await import('$lib/utils/userUtils');
    const username = getCurrentUsername();
    const now = getCurrentTimestamp();

    const { error } = await supabase
      .from('std_vehicle_work_flow')
      .update({
        is_deleted: true,
        is_active: false,
        modified_by: username,
        modified_dt: now
        // created_by and created_dt should not be touched on update
      })
      .eq('vwf_id', vwf_id);

    if (error) throw error;
  } catch (error) {
    console.error('Error deleting vehicle work flow:', error);
    throw error;
  }
}

// Get available derivative works for a vehicle type
export async function getAvailableDerivativeWorksForVehicle(wo_type_id: number): Promise<any[]> {
  try {
    // Get existing work flows for this vehicle type
    const { data: existingFlows, error: flowError } = await supabase
      .from('std_vehicle_work_flow')
      .select('derived_sw_code')
      .eq('wo_type_id', wo_type_id)
      .eq('is_deleted', false);

    if (flowError) throw flowError;

    const existingDerivedCodes = existingFlows?.map(f => f.derived_sw_code) || [];

    // Get all available derivative works (excluding already mapped ones)
    const { data: derivativeWorks, error: dwError } = await supabase
      .from('std_work_type_details')
      .select(`
        derived_sw_code,
        type_description,
        sw_code,
        std_work_details!inner(sw_name, plant_stage)
      `)
      .eq('is_deleted', false)
      .eq('is_active', true)
      .not('derived_sw_code', 'in', `(${existingDerivedCodes.map(code => `'${code}'`).join(',')})`)
      .order('derived_sw_code');

    if (dwError) throw dwError;
    return derivativeWorks || [];
  } catch (error) {
    console.error('Error getting available derivative works for vehicle:', error);
    throw error;
  }
}

// Calculate total production time for a vehicle type
export async function calculateTotalProductionTime(wo_type_id: number): Promise<number> {
  try {
    const { data, error } = await supabase
      .from('std_vehicle_work_flow')
      .select('estimated_duration_minutes')
      .eq('wo_type_id', wo_type_id)
      .eq('is_deleted', false)
      .eq('is_active', true);

    if (error) throw error;
    
    const totalMinutes = data?.reduce((sum, item) => sum + item.estimated_duration_minutes, 0) || 0;
    return totalMinutes;
  } catch (error) {
    console.error('Error calculating total production time:', error);
    throw error;
  }
}

// Reorder sequence for a vehicle type
export async function reorderVehicleWorkFlow(wo_type_id: number, newOrder: Array<{ vwf_id: number; sequence_order: number }>): Promise<void> {
  try {
    const { getCurrentUsername, getCurrentTimestamp } = await import('$lib/utils/userUtils');
    const username = getCurrentUsername();
    const now = getCurrentTimestamp();

    // Update each work flow with new sequence order
    for (const item of newOrder) {
      const { error } = await supabase
        .from('std_vehicle_work_flow')
        .update({
          sequence_order: item.sequence_order,
          modified_by: username,
          modified_dt: now
          // created_by and created_dt should not be touched on update
        })
        .eq('vwf_id', item.vwf_id);

      if (error) throw error;
    }
  } catch (error) {
    console.error('Error reordering vehicle work flow:', error);
    throw error;
  }
} 