import { supabase } from '$lib/supabaseClient';
import { sanitizeObject } from '$lib/utils/inputSanitization';

export interface SkillMaster {
  id: number;
  skill_name: string;
  skill_short: string;
  rate_per_hour: number;
  min_salary: number;
  max_salary: number;
  modified_by: string;
  modified_dt: string;
  wef: string;
}

// Fetch skill names from data elements
export async function fetchSkillNames(): Promise<string[]> {
  const { data, error } = await supabase
    .from('sys_data_elements')
    .select('de_value')
    .eq('de_name', 'Skill Name')
    .order('de_value');

  if (error) {
    console.error('Error fetching skill names:', error);
    throw error;
  }

  return data?.map(item => item.de_value) || [];
}

// Fetch skill shorts from data elements
export async function fetchSkillShorts(): Promise<string[]> {
  const { data, error } = await supabase
    .from('sys_data_elements')
    .select('de_value')
    .eq('de_name', 'Skill Short')
    .order('de_value');

  if (error) {
    console.error('Error fetching skill shorts:', error);
    throw error;
  }

  return data?.map(item => item.de_value) || [];
}

// Fetch all skill master records
export async function fetchSkillMaster(): Promise<SkillMaster[]> {
  const { data, error } = await supabase
    .from('hr_skill_master')
    .select('*')
    .order('skill_name');

  if (error) {
    console.error('Error fetching skill master:', error);
    throw error;
  }

  return data || [];
}

// Save skill master record
export async function saveSkillMaster(skillData: Omit<SkillMaster, 'id' | 'modified_dt'>): Promise<void> {
  const sanitizedData = sanitizeObject(skillData);
  const { error } = await supabase
    .from('hr_skill_master')
    .insert([sanitizedData]);

  if (error) {
    console.error('Error saving skill master:', error);
    throw error;
  }
}

// Update skill master record
export async function updateSkillMaster(id: number, skillData: Partial<Omit<SkillMaster, 'id' | 'skill_name' | 'skill_short'>>): Promise<void> {
  const sanitizedData = sanitizeObject(skillData);
  const { error } = await supabase
    .from('hr_skill_master')
    .update(sanitizedData)
    .eq('id', id);

  if (error) {
    console.error('Error updating skill master:', error);
    throw error;
  }
}

// Get username from email
export async function getUsernameFromEmail(email: string): Promise<string> {
  const { data, error } = await supabase
    .from('app_users')
    .select('username')
    .eq('email', email)
    .maybeSingle();

  if (error) {
    console.error('Error fetching username:', error);
    return email; // fallback to email if username not found
  }

  return data?.username || email;
}

// Delete skill master record
export async function deleteSkillMaster(id: number): Promise<void> {
  const { error } = await supabase
    .from('hr_skill_master')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting skill master:', error);
    throw error;
  }
}

// Check if skill name already exists
export async function checkSkillNameExists(skillName: string, excludeId?: number): Promise<boolean> {
  let query = supabase
    .from('hr_skill_master')
    .select('id')
    .eq('skill_name', skillName);

  if (excludeId) {
    query = query.neq('id', excludeId);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error checking skill name:', error);
    throw error;
  }

  return (data?.length || 0) > 0;
}

// Check if skill short already exists
export async function checkSkillShortExists(skillShort: string, excludeId?: number): Promise<boolean> {
  let query = supabase
    .from('hr_skill_master')
    .select('id')
    .eq('skill_short', skillShort);

  if (excludeId) {
    query = query.neq('id', excludeId);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error checking skill short:', error);
    throw error;
  }

  return (data?.length || 0) > 0;
} 