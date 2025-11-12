import { supabase } from '$lib/supabaseClient';

export interface SkillCombination {
  sc_id?: number;
  sc_name: string;
  manpower_required: number;
  skill_combination: Array<{
    skill_id: number;
    skill_name: string;
    skill_order: number;
  }>;
  is_active: boolean;
  is_deleted: boolean;
  created_by: string;
  created_dt: string;
  modified_by?: string;
  modified_dt?: string;
}

export interface SkillCombinationFormData {
  manpower_required: number;
  skill_combination: Array<{
    skill_id: number;
    skill_name: string;
    skill_order: number;
  }>;
}

// Fetch all skill combinations (not deleted)
export async function fetchSkillCombinations(): Promise<SkillCombination[]> {
  try {
    const { data, error } = await supabase
      .from('std_skill_combinations')
      .select('*')
      .eq('is_deleted', false)
      .order('created_dt', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching skill combinations:', error);
    throw error;
  }
}

// Fetch all skills from skill master
export async function fetchSkills(): Promise<Array<{ skill_id: number; skill_name: string }>> {
  try {
    const { data, error } = await supabase
      .from('hr_skill_master')
      .select('id, skill_short')
      .eq('is_deleted', false)
      .order('skill_short');

    if (error) throw error;
    
    console.log('Fetched skills from hr_skill_master:', data);
    
    // Transform the data to match the expected format
    return (data || []).map(item => ({
      skill_id: item.id,
      skill_name: item.skill_short
    }));
  } catch (error) {
    console.error('Error fetching skills:', error);
    throw error;
  }
}

// Generate combination name from skills
export function generateCombinationName(skills: Array<{ skill_name: string }>): string {
  return skills.map(skill => skill.skill_name).join(' + ');
}

// Check if combination name already exists
export async function checkCombinationNameExists(scName: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('std_skill_combinations')
      .select('sc_id')
      .eq('sc_name', scName)
      .eq('is_deleted', false)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return !!data;
  } catch (error) {
    console.error('Error checking combination name:', error);
    throw error;
  }
}

// Save new skill combination
export async function saveSkillCombination(combination: SkillCombinationFormData): Promise<SkillCombination> {
  try {
    // Generate combination name
    const scName = generateCombinationName(combination.skill_combination);
    
    // Check if name already exists
    const exists = await checkCombinationNameExists(scName);
    if (exists) {
      throw new Error(`Skill combination "${scName}" already exists.`);
    }

    const { getCurrentUsername, getCurrentTimestamp } = await import('$lib/utils/userUtils');
    const username = getCurrentUsername();
    const now = getCurrentTimestamp();

    // Create the skill combination
    const { data, error } = await supabase
      .from('std_skill_combinations')
      .insert([{
        sc_name: scName,
        manpower_required: combination.manpower_required,
        skill_combination: combination.skill_combination,
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
    console.error('Error saving skill combination:', error);
    throw error;
  }
}

// Delete skill combination (soft delete)
export async function deleteSkillCombination(scId: number): Promise<void> {
  try {
    const { getCurrentUsername, getCurrentTimestamp } = await import('$lib/utils/userUtils');
    const username = getCurrentUsername();
    const now = getCurrentTimestamp();

    const { error } = await supabase
      .from('std_skill_combinations')
      .update({ 
        is_deleted: true, 
        is_active: false,
        modified_by: username, 
        modified_dt: now
        // created_by and created_dt should not be touched on update
      })
      .eq('sc_id', scId);

    if (error) throw error;
  } catch (error) {
    console.error('Error deleting skill combination:', error);
    throw error;
  }
}

// Toggle active status
export async function toggleSkillCombinationActive(scId: number, isActive: boolean): Promise<void> {
  try {
    const { getCurrentUsername, getCurrentTimestamp } = await import('$lib/utils/userUtils');
    const username = getCurrentUsername();
    const now = getCurrentTimestamp();

    const { error } = await supabase
      .from('std_skill_combinations')
      .update({ 
        is_active: isActive,
        modified_by: username, 
        modified_dt: now
        // created_by and created_dt should not be touched on update
      })
      .eq('sc_id', scId);

    if (error) throw error;
  } catch (error) {
    console.error('Error toggling skill combination active status:', error);
    throw error;
  }
} 

// Get available skill combinations for a specific work (not already mapped)
export async function getAvailableSkillCombinationsForWork(derivedSwCode: string): Promise<SkillCombination[]> {
  try {
    // First, get all skill combinations that are active and not deleted
    const { data: allCombinations, error: fetchError } = await supabase
      .from('std_skill_combinations')
      .select('*')
      .eq('is_deleted', false)
      .eq('is_active', true)
      .order('sc_name');

    if (fetchError) throw fetchError;

    // Then, get the skill combinations already mapped to this work
    const { data: mappedCombinations, error: mappedError } = await supabase
      .from('std_work_skill_mapping')
      .select('sc_name')
      .eq('derived_sw_code', derivedSwCode)
      .eq('is_deleted', false);

    if (mappedError) throw mappedError;

    // Filter out already mapped combinations
    const mappedScNames = new Set((mappedCombinations || []).map(item => item.sc_name));
    const availableCombinations = (allCombinations || []).filter(combination => 
      !mappedScNames.has(combination.sc_name)
    );

    return availableCombinations;
  } catch (error) {
    console.error('Error fetching available skill combinations for work:', error);
    throw error;
  }
} 

// Debug function to check skill combinations
export async function debugSkillCombinations(): Promise<void> {
  try {
    const { data, error } = await supabase
      .from('std_skill_combinations')
      .select('*')
      .eq('is_deleted', false)
      .limit(5);

    if (error) throw error;
    
    console.log('Debug: Skill combinations in database:', data);
    
    if (data && data.length > 0) {
      data.forEach((combination, index) => {
        console.log(`Skill combination ${index}:`, {
          sc_id: combination.sc_id,
          sc_name: combination.sc_name,
          skill_combination: combination.skill_combination,
          skill_combination_type: typeof combination.skill_combination
        });
      });
    } else {
      console.log('Debug: No skill combinations found in database');
    }
  } catch (error) {
    console.error('Error debugging skill combinations:', error);
  }
} 