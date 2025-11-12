import { supabase } from '$lib/supabaseClient';

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
  created_by: string;
  created_dt: string;
  is_active: boolean;
  is_deleted: boolean;
}

// Fetch skill names from data elements
export async function fetchSkillNames(): Promise<string[]> {
  try {
    const { data, error } = await supabase
      .from('sys_data_elements')
      .select('de_value')
      .eq('de_name', 'Skill Name')
      .eq('is_deleted', false)
      .order('de_value');

    if (error) {
      console.error('Error fetching skill names:', error);
      throw error;
    }

    return data?.map(item => item.de_value) || [];
  } catch (error) {
    console.error('Error in fetchSkillNames:', error);
    throw error;
  }
}

// Fetch skill shorts from data elements
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

// Fetch all skill master records
export async function fetchSkillMaster(): Promise<SkillMaster[]> {
  try {
    const { data, error } = await supabase
      .from('hr_skill_master')
      .select('*')
      .eq('is_deleted', false)
      .order('skill_name', { ascending: true })
      .order('modified_dt', { ascending: false });

    if (error) {
      console.error('Error fetching skill master:', error);
      throw error;
    }

    return data || [];
  } catch (error) {
    console.error('Error in fetchSkillMaster:', error);
    throw error;
  }
}

// Save skill master record
export async function saveSkillMaster(skillData: {
  skill_name: string;
  skill_short: string;
  rate_per_hour: number;
  min_salary: number;
  max_salary: number;
  wef: string;
  is_active?: boolean;
}, createdBy: string): Promise<void> {
  try {
    const currentTime = new Date().toISOString();
    
    // Validate and format WEF date
    const wefDate = new Date(skillData.wef);
    if (isNaN(wefDate.getTime())) {
      throw new Error('Invalid WEF date format');
    }
    
    // Format WEF as YYYY-MM-DD for DATE type
    const formattedWef = wefDate.toISOString().split('T')[0];
    
    // Convert rate_per_hour to integer (round to nearest whole number)
    const rateAsInteger = Math.round(skillData.rate_per_hour);
    
    const { error } = await supabase
      .from('hr_skill_master')
      .insert({
        skill_name: skillData.skill_name.trim(),
        skill_short: skillData.skill_short.trim(),
        rate_per_hour: rateAsInteger,
        min_salary: skillData.min_salary,
        max_salary: skillData.max_salary,
        wef: formattedWef,
        is_active: skillData.is_active ?? true,
        created_by: createdBy,
        created_dt: currentTime,
        modified_by: createdBy,
        modified_dt: currentTime
      });

    if (error) {
      console.error('Error saving skill master:', error);
      throw error;
    }
  } catch (error) {
    console.error('Error in saveSkillMaster:', error);
    throw error;
  }
}

// Update skill master record
export async function updateSkillMaster(id: number, skillData: {
  rate_per_hour?: number;
  min_salary?: number;
  max_salary?: number;
  wef?: string;
  is_active?: boolean;
}, modifiedBy: string): Promise<void> {
  try {
    // Prepare update data
    const updateData: any = {
      modified_by: modifiedBy,
      modified_dt: new Date().toISOString()
    };
    
    // Add other fields if provided
    if (skillData.rate_per_hour !== undefined) {
      // Convert rate_per_hour to integer (round to nearest whole number)
      updateData.rate_per_hour = Math.round(skillData.rate_per_hour);
    }
    if (skillData.min_salary !== undefined) updateData.min_salary = skillData.min_salary;
    if (skillData.max_salary !== undefined) updateData.max_salary = skillData.max_salary;
    if (skillData.is_active !== undefined) updateData.is_active = skillData.is_active;
    
    // Handle WEF date formatting if provided
    if (skillData.wef) {
      const wefDate = new Date(skillData.wef);
      if (isNaN(wefDate.getTime())) {
        throw new Error('Invalid WEF date format');
      }
      // Format WEF as YYYY-MM-DD for DATE type
      updateData.wef = wefDate.toISOString().split('T')[0];
    }
    
    const { error } = await supabase
      .from('hr_skill_master')
      .update(updateData)
      .eq('id', id);

    if (error) {
      console.error('Error updating skill master:', error);
      throw error;
    }
  } catch (error) {
    console.error('Error in updateSkillMaster:', error);
    throw error;
  }
}

// Soft delete skill master record
export async function deleteSkillMaster(id: number, modifiedBy: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('hr_skill_master')
      .update({
        is_deleted: true,
        is_active: false,
        modified_by: modifiedBy,
        modified_dt: new Date().toISOString()
      })
      .eq('id', id);

    if (error) {
      console.error('Error deleting skill master:', error);
      throw error;
    }
  } catch (error) {
    console.error('Error in deleteSkillMaster:', error);
    throw error;
  }
}

// Toggle active status of skill master
export async function toggleSkillMasterStatus(id: number, isActive: boolean, modifiedBy: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('hr_skill_master')
      .update({
        is_active: isActive,
        modified_by: modifiedBy,
        modified_dt: new Date().toISOString()
      })
      .eq('id', id);

    if (error) {
      console.error('Error toggling skill master status:', error);
      throw error;
    }
  } catch (error) {
    console.error('Error in toggleSkillMasterStatus:', error);
    throw error;
  }
}

// Check if skill name already exists
export async function checkSkillNameExists(skillName: string, excludeId?: number): Promise<boolean> {
  try {
    let query = supabase
      .from('hr_skill_master')
      .select('id')
      .eq('skill_name', skillName)
      .eq('is_deleted', false);

    if (excludeId) {
      query = query.neq('id', excludeId);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error checking skill name:', error);
      throw error;
    }

    return (data?.length || 0) > 0;
  } catch (error) {
    console.error('Error in checkSkillNameExists:', error);
    throw error;
  }
}

// Check if skill short already exists
export async function checkSkillShortExists(skillShort: string, excludeId?: number): Promise<boolean> {
  try {
    let query = supabase
      .from('hr_skill_master')
      .select('id')
      .eq('skill_short', skillShort)
      .eq('is_deleted', false);

    if (excludeId) {
      query = query.neq('id', excludeId);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error checking skill short:', error);
      throw error;
    }

    return (data?.length || 0) > 0;
  } catch (error) {
    console.error('Error in checkSkillShortExists:', error);
    throw error;
  }
}

// Export template CSV for skill master import
export async function exportTemplate(): Promise<void> {
  try {
    const headers = ['Skill Name', 'Skill Code', 'Rate Per Hour', 'Minimum Salary', 'Maximum Salary', 'WEF Date', 'Status'];
    const sampleData = [
      'Welding',
      'WELD',
      '150.00',
      '15000.00',
      '25000.00',
      '2024-01-15',
      'Active'
    ];
    
    const csvContent = [headers.join(','), sampleData.join(',')].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'skill_master_import_template.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Error exporting template:', error);
    throw error;
  }
}

// Helper function to parse and validate date (YYYY-MM-DD format only)
function parseDate(dateString: string): Date | null {
  if (!dateString || dateString.trim() === '') {
    return null;
  }
  
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(dateString.trim())) {
    return null;
  }
  
  const date = new Date(dateString.trim());
  return isNaN(date.getTime()) ? null : date;
}

// Import skills from CSV data
export async function importSkills(csvData: string, username: string): Promise<{ success: number; errors: string[] }> {
  const errors: string[] = [];
  let successCount = 0;
  
  try {
    const lines = csvData.split('\n').filter(line => line.trim());
    
    if (lines.length < 2) {
      throw new Error('CSV must have at least a header row and one data row');
    }
    
    // Parse header
    const headers = lines[0].split(',').map(h => h.trim());
    const expectedHeaders = ['skill_name', 'skill_code', 'rate_per_hour', 'minimum_salary', 'maximum_salary', 'wef_date', 'status'];
    
    // Check if headers match expected format
    if (headers.length !== expectedHeaders.length) {
      throw new Error(`Expected ${expectedHeaders.length} columns, found ${headers.length}`);
    }
    
    // Process data rows
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      const values = line.split(',').map(v => v.trim());
      
      if (values.length !== expectedHeaders.length) {
        errors.push(`Row ${i + 1}: Expected ${expectedHeaders.length} columns, found ${values.length}`);
        continue;
      }
      
      try {
        // Parse and validate data
        const skillName = values[0];
        const skillCode = values[1];
        const ratePerHour = parseFloat(values[2]);
        const minSalary = parseFloat(values[3]);
        const maxSalary = parseFloat(values[4]);
        const wefDate = values[5];
        const status = values[6].toLowerCase();
        
        // Validate required fields
        if (!skillName) {
          errors.push(`Row ${i + 1}: Skill name is required`);
          continue;
        }
        
        if (!skillCode) {
          errors.push(`Row ${i + 1}: Skill code is required`);
          continue;
        }
        
        if (isNaN(ratePerHour) || ratePerHour < 0) {
          errors.push(`Row ${i + 1}: Rate per hour must be a non-negative number`);
          continue;
        }
        
        // Round rate to integer for storage
        const roundedRatePerHour = Math.round(ratePerHour);
        
        if (isNaN(minSalary) || minSalary <= 0) {
          errors.push(`Row ${i + 1}: Minimum salary must be a positive number`);
          continue;
        }
        
        if (isNaN(maxSalary) || maxSalary <= 0) {
          errors.push(`Row ${i + 1}: Maximum salary must be a positive number`);
          continue;
        }
        
        if (minSalary >= maxSalary) {
          errors.push(`Row ${i + 1}: Maximum salary must be greater than minimum salary`);
          continue;
        }
        
        const parsedDate = parseDate(wefDate);
        if (!parsedDate) {
          errors.push(`Row ${i + 1}: Invalid WEF date format. Use YYYY-MM-DD format`);
          continue;
        }
        
        if (!['active', 'inactive'].includes(status)) {
          errors.push(`Row ${i + 1}: Status must be 'Active' or 'Inactive'`);
          continue;
        }
        
        // Check for duplicates
        const skillNameExists = await checkSkillNameExists(skillName);
        if (skillNameExists) {
          errors.push(`Row ${i + 1}: Skill name "${skillName}" already exists`);
          continue;
        }
        
        const skillCodeExists = await checkSkillShortExists(skillCode);
        if (skillCodeExists) {
          errors.push(`Row ${i + 1}: Skill code "${skillCode}" already exists`);
          continue;
        }
        
        // Save the skill
        await saveSkillMaster({
          skill_name: skillName,
          skill_short: skillCode,
          rate_per_hour: roundedRatePerHour,
          min_salary: minSalary,
          max_salary: maxSalary,
          wef: wefDate,
          is_active: status === 'active'
        }, username);
        
        successCount++;
        
      } catch (error) {
        errors.push(`Row ${i + 1}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
    
  } catch (error) {
    errors.push(`Import failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
  
  return { success: successCount, errors };
} 