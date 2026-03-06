import { supabase } from '$lib/supabaseClient';

export interface StdSkillTimeStandard {
  sts_id?: number;
  wsm_id: number;
  skill_short: string;
  standard_time_minutes: number;
  skill_order: number;
  is_active: boolean;
  is_deleted: boolean;
  created_by: string;
  created_dt: string;
  modified_by: string;
  modified_dt?: string;
}

export interface SkillTimeStandardFormData {
  wsm_id: number;
  skill_short: string;
  standard_time_minutes: number;
  skill_order: number;
}

// Fetch all skill time standards (not deleted)
export async function fetchAllSkillTimeStandards(): Promise<StdSkillTimeStandard[]> {
  try {
    const { data, error } = await supabase
      .from('std_skill_time_standards')
      .select(`
        *,
        std_work_skill_mapping!inner(
          derived_sw_code,
          sc_name,
          std_work_type_details!inner(
            type_description,
            std_work_details!inner(
              sw_name,
              plant_stage,
              sw_type
            )
          ),
          std_skill_combinations!inner(manpower_required)
        )
      `)
      .eq('is_deleted', false)
      .eq('std_work_skill_mapping.is_deleted', false)
      .eq('std_work_skill_mapping.std_work_type_details.is_deleted', false)
      .order('created_dt', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching skill time standards:', error);
    throw error;
  }
}

// Fetch skill time standards by work-skill mapping ID
export async function fetchSkillTimeStandardsByWsmId(wsm_id: number): Promise<StdSkillTimeStandard[]> {
  try {
    const { data, error } = await supabase
      .from('std_skill_time_standards')
      .select('*')
      .eq('wsm_id', wsm_id)
      .eq('is_deleted', false)
      .order('skill_order');

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching skill time standards by WSM ID:', error);
    throw error;
  }
}

// Save new skill time standard
export async function saveSkillTimeStandard(timeStandard: SkillTimeStandardFormData): Promise<StdSkillTimeStandard> {
  try {
    // Check if time standard already exists for this skill and order in this mapping
    const { data: existing, error: checkError } = await supabase
      .from('std_skill_time_standards')
      .select('sts_id')
      .eq('wsm_id', timeStandard.wsm_id)
      .eq('skill_short', timeStandard.skill_short)
      .eq('skill_order', timeStandard.skill_order)
      .eq('is_deleted', false)
      .maybeSingle();

    if (checkError) throw checkError;
    
    if (existing) {
      throw new Error('Time standard for this skill and order already exists in this work-skill mapping.');
    }

    // Get current username (throws error if not found)
    const { getCurrentUsername, getCurrentTimestamp } = await import('$lib/utils/userUtils');
    const username = getCurrentUsername();
    const now = getCurrentTimestamp();

    // Create the time standard
    const { data, error } = await supabase
      .from('std_skill_time_standards')
      .insert([{
        wsm_id: timeStandard.wsm_id,
        skill_short: timeStandard.skill_short,
        standard_time_minutes: timeStandard.standard_time_minutes,
        skill_order: timeStandard.skill_order,
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
    console.error('Error saving skill time standard:', error);
    throw error;
  }
}

// Update skill time standard
export async function updateSkillTimeStandard(sts_id: number, timeStandard: Partial<SkillTimeStandardFormData>): Promise<void> {
  try {
    const { getCurrentUsername, getCurrentTimestamp } = await import('$lib/utils/userUtils');
    const username = getCurrentUsername();
    const now = getCurrentTimestamp();

    const updateData: any = {
      modified_by: username,
      modified_dt: now
      // created_by and created_dt should not be touched on update
    };

    if (timeStandard.standard_time_minutes !== undefined) {
      updateData.standard_time_minutes = timeStandard.standard_time_minutes;
    }
    if (timeStandard.skill_order !== undefined) {
      updateData.skill_order = timeStandard.skill_order;
    }

    const { error } = await supabase
      .from('std_skill_time_standards')
      .update(updateData)
      .eq('sts_id', sts_id);

    if (error) throw error;
  } catch (error) {
    console.error('Error updating skill time standard:', error);
    throw error;
  }
}

// Toggle active status
export async function toggleSkillTimeStandardActive(sts_id: number, isActive: boolean): Promise<void> {
  try {
    const { getCurrentUsername, getCurrentTimestamp } = await import('$lib/utils/userUtils');
    const username = getCurrentUsername();
    const now = getCurrentTimestamp();

    const { error } = await supabase
      .from('std_skill_time_standards')
      .update({
        is_active: isActive,
        modified_by: username,
        modified_dt: now
        // created_by and created_dt should not be touched on update
      })
      .eq('sts_id', sts_id);

    if (error) throw error;
  } catch (error) {
    console.error('Error toggling skill time standard status:', error);
    throw error;
  }
}

// Soft delete skill time standard
export async function deleteSkillTimeStandard(sts_id: number): Promise<void> {
  try {
    const { getCurrentUsername, getCurrentTimestamp } = await import('$lib/utils/userUtils');
    const username = getCurrentUsername();
    const now = getCurrentTimestamp();

    const { error } = await supabase
      .from('std_skill_time_standards')
      .update({
        is_deleted: true,
        is_active: false,
        modified_by: username,
        modified_dt: now
        // created_by and created_dt should not be touched on update
      })
      .eq('sts_id', sts_id);

    if (error) throw error;
  } catch (error) {
    console.error('Error deleting skill time standard:', error);
    throw error;
  }
}

// Bulk save skill time standards for a work-skill mapping
export async function saveBulkSkillTimeStandards(wsm_id: number, timeStandards: SkillTimeStandardFormData[]): Promise<void> {
  try {
    const { getCurrentUsername, getCurrentTimestamp } = await import('$lib/utils/userUtils');
    const username = getCurrentUsername();
    const now = getCurrentTimestamp();

    // Prepare data for bulk insert
    const bulkData = timeStandards.map(ts => ({
      wsm_id: wsm_id,
      skill_short: ts.skill_short,
      standard_time_minutes: ts.standard_time_minutes,
      skill_order: ts.skill_order,
      is_active: true,
      is_deleted: false,
      created_by: username,
      created_dt: now,
      // modified_by and modified_dt should equal created_by and created_dt on insert
      modified_by: username,
      modified_dt: now
    }));

    const { error } = await supabase
      .from('std_skill_time_standards')
      .insert(bulkData);

    if (error) throw error;
  } catch (error) {
    console.error('Error saving bulk skill time standards:', error);
    throw error;
  }
}

// Calculate total time for a work-skill mapping
// Uses database function for efficient calculation
export async function calculateTotalTimeForMapping(wsm_id: number): Promise<number> {
  try {
    const { data, error } = await supabase.rpc('calculate_total_time_for_mapping', {
      p_wsm_id: wsm_id
    });

    if (error) throw error;
    return data as number;
  } catch (error) {
    console.error('Error calculating total time for mapping:', error);
    throw error;
  }
}

// Get detailed time breakdown for a derivative work
// Uses database function for efficient calculation with grouping and aggregation
export async function getDetailedTimeBreakdownForDerivativeWork(derived_sw_code: string): Promise<{
  totalMinutes: number;
  breakdown: any[];
  isUniform: boolean;
}> {
  try {
    const { data, error } = await supabase.rpc('get_time_breakdown_for_derivative_work', {
      p_derived_sw_code: derived_sw_code
    });

    if (error) throw error;

    // Database function returns JSONB, which Supabase converts to object
    const result = data as {
      totalMinutes: number;
      breakdown: Array<{
        skillOrder: number;
        minutes: number;
        skillName: string;
        manpowerRequired: number;
      }>;
      isUniform: boolean;
    };

    return {
      totalMinutes: result.totalMinutes,
      breakdown: result.breakdown || [],
      isUniform: result.isUniform
    };
  } catch (error) {
    console.error('Error getting detailed time breakdown for derivative work:', error);
    throw error;
  }
} 