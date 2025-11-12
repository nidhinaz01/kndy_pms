import { supabase } from '$lib/supabaseClient';

export interface StdWorkSkillMapping {
  wsm_id?: number;
  derived_sw_code: string;
  sc_name: string;
  is_active: boolean;
  is_deleted: boolean;
  created_by: string;
  created_dt: string;
  modified_by: string;
  modified_dt?: string;
}

export interface StdWorkSkillMappingFormData {
  derived_sw_code: string;
  sc_name: string;
}

// Fetch all work-skill mappings (not deleted)
export async function fetchAllWorkSkillMappings(): Promise<StdWorkSkillMapping[]> {
  try {
    console.log('Fetching work-skill mappings...');
    
    const { data, error } = await supabase
      .from('std_work_skill_mapping')
      .select(`
        wsm_id,
        derived_sw_code,
        sc_name,
        is_active,
        is_deleted,
        created_by,
        created_dt,
        modified_by,
        modified_dt,
        std_skill_combinations!inner(
          sc_id,
          sc_name,
          manpower_required,
          skill_combination
        ),
        std_work_type_details!inner(
          type_description,
          std_work_details!inner(
            sw_name,
            plant_stage,
            sw_type
          )
        )
      `)
      .eq('is_deleted', false)
      .eq('std_skill_combinations.is_deleted', false)
      .eq('std_work_type_details.is_deleted', false)
      .order('created_dt', { ascending: false });

    if (error) {
      console.error('Supabase error:', error);
      throw error;
    }
    
    console.log('Raw data from Supabase:', data);
    
    // Ensure we always return an array
    let result = data || [];
    if (!Array.isArray(result)) {
      console.log('Data is not an array, converting to array');
      result = [result];
    }
    
    console.log('Final result type:', typeof result);
    console.log('Final result isArray:', Array.isArray(result));
    console.log('Final result length:', result.length);
    
    // Debug: Check each mapping's skill combination data
    if (result.length > 0) {
      result.forEach((mapping, index) => {
        const skillCombinations = mapping.std_skill_combinations as any;
        console.log(`Mapping ${index}:`, {
          wsm_id: mapping.wsm_id,
          derived_sw_code: mapping.derived_sw_code,
          sc_name: mapping.sc_name,
          skill_combinations: skillCombinations,
          skill_combination_data: Array.isArray(skillCombinations) ? skillCombinations[0]?.skill_combination : skillCombinations?.skill_combination,
          skill_combination_type: typeof (Array.isArray(skillCombinations) ? skillCombinations[0]?.skill_combination : skillCombinations?.skill_combination)
        });
        
        // Additional detailed debugging
        if (skillCombinations) {
          console.log(`Detailed skill combinations for mapping ${index}:`);
          if (Array.isArray(skillCombinations)) {
            skillCombinations.forEach((sc, scIndex) => {
              console.log(`  Skill combination ${scIndex}:`, {
                sc_id: sc.sc_id,
                sc_name: sc.sc_name,
                skill_combination: sc.skill_combination,
                skill_combination_type: typeof sc.skill_combination,
                skill_combination_length: Array.isArray(sc.skill_combination) ? sc.skill_combination.length : 'N/A'
              });
            });
          } else {
            console.log(`  Single skill combination:`, {
              sc_id: skillCombinations.sc_id,
              sc_name: skillCombinations.sc_name,
              skill_combination: skillCombinations.skill_combination,
              skill_combination_type: typeof skillCombinations.skill_combination,
              skill_combination_length: Array.isArray(skillCombinations.skill_combination) ? skillCombinations.skill_combination.length : 'N/A'
            });
          }
        }
      });
    } else {
      console.log('No data returned from Supabase');
    }
    
    return result;
  } catch (error) {
    console.error('Error fetching work-skill mappings:', error);
    throw error;
  }
}

// Fetch work-skill mappings by derived work code
export async function fetchWorkSkillMappingsByDerivedCode(derived_sw_code: string): Promise<StdWorkSkillMapping[]> {
  try {
    const { data, error } = await supabase
      .from('std_work_skill_mapping')
      .select(`
        *,
        std_skill_combinations!inner(manpower_required, skill_combination)
      `)
      .eq('derived_sw_code', derived_sw_code)
      .eq('is_deleted', false)
      .order('created_dt');

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching work-skill mappings by derived code:', error);
    throw error;
  }
}

// Save new work-skill mapping
export async function saveWorkSkillMapping(mapping: StdWorkSkillMappingFormData): Promise<StdWorkSkillMapping> {
  try {
    // Check if mapping already exists
    const { data: existing, error: checkError } = await supabase
      .from('std_work_skill_mapping')
      .select('wsm_id')
      .eq('derived_sw_code', mapping.derived_sw_code)
      .eq('sc_name', mapping.sc_name)
      .eq('is_deleted', false)
      .maybeSingle();

    if (checkError) throw checkError;
    
    if (existing) {
      throw new Error('This work-skill combination already exists.');
    }

    const { getCurrentUsername, getCurrentTimestamp } = await import('$lib/utils/userUtils');
    const username = getCurrentUsername();
    const now = getCurrentTimestamp();

    // Create the mapping
    const { data, error } = await supabase
      .from('std_work_skill_mapping')
      .insert([{
        derived_sw_code: mapping.derived_sw_code,
        sc_name: mapping.sc_name,
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
    console.error('Error saving work-skill mapping:', error);
    throw error;
  }
}

// Toggle active status
export async function toggleWorkSkillMappingActive(wsm_id: number, isActive: boolean): Promise<void> {
  try {
    const { getCurrentUsername, getCurrentTimestamp } = await import('$lib/utils/userUtils');
    const username = getCurrentUsername();
    const now = getCurrentTimestamp();

    const { error } = await supabase
      .from('std_work_skill_mapping')
      .update({
        is_active: isActive,
        modified_by: username,
        modified_dt: now
        // created_by and created_dt should not be touched on update
      })
      .eq('wsm_id', wsm_id);

    if (error) throw error;
  } catch (error) {
    console.error('Error toggling work-skill mapping status:', error);
    throw error;
  }
}

// Soft delete work-skill mapping
export async function deleteWorkSkillMapping(wsm_id: number): Promise<void> {
  try {
    const { getCurrentUsername, getCurrentTimestamp } = await import('$lib/utils/userUtils');
    const username = getCurrentUsername();
    const now = getCurrentTimestamp();

    const { error } = await supabase
      .from('std_work_skill_mapping')
      .update({
        is_deleted: true,
        is_active: false,
        modified_by: username,
        modified_dt: now
        // created_by and created_dt should not be touched on update
      })
      .eq('wsm_id', wsm_id);

    if (error) throw error;
  } catch (error) {
    console.error('Error deleting work-skill mapping:', error);
    throw error;
  }
}

// Get available skill combinations for a work
export async function getAvailableSkillCombinationsForWork(derived_sw_code: string): Promise<any[]> {
  try {
    // Get existing mappings for this work
    const { data: existingMappings, error: mappingError } = await supabase
      .from('std_work_skill_mapping')
      .select('sc_name')
      .eq('derived_sw_code', derived_sw_code)
      .eq('is_deleted', false);

    if (mappingError) throw mappingError;

    const existingScNames = existingMappings?.map(m => m.sc_name) || [];

    // Get all available skill combinations (excluding already mapped ones)
    const { data: skillCombinations, error: scError } = await supabase
      .from('std_skill_combinations')
      .select('sc_name, manpower_required, skill_combination')
      .eq('is_deleted', false)
      .not('sc_name', 'in', `(${existingScNames.map(name => `'${name}'`).join(',')})`)
      .order('sc_name');

    if (scError) throw scError;
    return skillCombinations || [];
  } catch (error) {
    console.error('Error getting available skill combinations:', error);
    throw error;
  }
} 

// Debug function to check raw data
export async function debugWorkSkillMappingData(): Promise<void> {
  try {
    console.log('=== DEBUGGING WORK-SKILL MAPPING DATA ===');
    
    // Check raw work-skill mappings
    const { data: mappings, error: mappingError } = await supabase
      .from('std_work_skill_mapping')
      .select('*')
      .eq('is_deleted', false)
      .limit(5);

    if (mappingError) throw mappingError;
    console.log('Raw work-skill mappings:', mappings);

    // Check raw skill combinations
    const { data: combinations, error: combinationError } = await supabase
      .from('std_skill_combinations')
      .select('*')
      .eq('is_deleted', false)
      .limit(5);

    if (combinationError) throw combinationError;
    console.log('Raw skill combinations:', combinations);

    // Check specific mapping for P001A
    const { data: specificMapping, error: specificError } = await supabase
      .from('std_work_skill_mapping')
      .select(`
        *,
        std_skill_combinations(*)
      `)
      .eq('derived_sw_code', 'P001A')
      .eq('is_deleted', false);

    if (specificError) throw specificError;
    console.log('Specific mapping for P001A:', specificMapping);

    // Test the join manually
    if (mappings && mappings.length > 0) {
      const firstMapping = mappings[0];
      console.log('Testing join for first mapping:', firstMapping);
      
      const { data: joinTest, error: joinError } = await supabase
        .from('std_skill_combinations')
        .select('*')
        .eq('sc_name', firstMapping.sc_name)
        .eq('is_deleted', false);

      if (joinError) throw joinError;
      console.log('Join test result for sc_name:', firstMapping.sc_name, joinTest);
    }

  } catch (error) {
    console.error('Error debugging work-skill mapping data:', error);
  }
} 