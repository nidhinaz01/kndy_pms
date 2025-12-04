import { supabase } from '$lib/supabaseClient';

export async function fetchEmployeeCategories(): Promise<string[]> {
  try {
    const { data, error } = await supabase
      .from('sys_data_elements')
      .select('de_value')
      .eq('de_name', 'Employee Category')
      .eq('is_deleted', false)
      .order('de_value');

    if (error) {
      console.error('Error fetching employee categories:', error);
      throw error;
    }

    return data?.map(item => item.de_value) || [];
  } catch (error) {
    console.error('Error in fetchEmployeeCategories:', error);
    throw error;
  }
}

export async function fetchSkillShorts(): Promise<string[]> {
  try {
    const { data, error } = await supabase
      .from('sys_data_elements')
      .select('de_value')
      .eq('de_name', 'Skill Short')
      .eq('is_deleted', false)
      .order('de_value');

    if (error) {
      console.error('Error fetching skill shorts:', error);
      throw error;
    }

    return data?.map(item => item.de_value) || [];
  } catch (error) {
    console.error('Error in fetchSkillShorts:', error);
    throw error;
  }
}

export async function fetchStages(): Promise<string[]> {
  try {
    const { data, error } = await supabase
      .from('sys_data_elements')
      .select('de_value')
      .eq('de_name', 'Plant-Stage')
      .eq('is_deleted', false)
      .order('de_value');

    if (error) {
      console.error('Error fetching stages:', error);
      throw error;
    }

    return data?.map(item => item.de_value) || [];
  } catch (error) {
    console.error('Error in fetchStages:', error);
    throw error;
  }
}

export async function fetchShifts(): Promise<string[]> {
  try {
    const { data, error } = await supabase
      .from('hr_shift_master')
      .select('shift_code, shift_name')
      .eq('is_active', true)
      .eq('is_deleted', false)
      .order('shift_name');

    if (error) {
      console.error('Error fetching shifts:', error);
      throw error;
    }

    return data?.map(item => item.shift_code) || [];
  } catch (error) {
    console.error('Error in fetchShifts:', error);
    throw error;
  }
}

