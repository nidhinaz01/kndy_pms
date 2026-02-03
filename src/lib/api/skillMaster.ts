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
  wef_date: string; // Date when this rate version becomes effective
  wef_time: string; // Time when this rate version becomes effective (HH:MM:SS)
  wet_date: string | null; // Date when this rate version ends (NULL = currently active)
  wet_time: string | null; // Time when this rate version ends (HH:MM:SS)
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

// Fetch all active skill master records (only current versions)
export async function fetchSkillMaster(): Promise<SkillMaster[]> {
  try {
    const { data, error } = await supabase
      .from('hr_skill_master')
      .select('*')
      .eq('is_deleted', false)
      .is('wet_date', null) // Only active versions (wet_date IS NULL)
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

// Fetch all versions (history) for a specific skill
export async function fetchSkillHistory(skillName: string): Promise<SkillMaster[]> {
  try {
    const { data, error } = await supabase
      .from('hr_skill_master')
      .select('*')
      .eq('skill_name', skillName)
      .eq('is_deleted', false)
      .order('wef_date', { ascending: true })
      .order('wef_time', { ascending: true });

    if (error) {
      console.error('Error fetching skill history:', error);
      throw error;
    }

    return data || [];
  } catch (error) {
    console.error('Error in fetchSkillHistory:', error);
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
  wef_date?: string;
  wef_time?: string;
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
    
    // Use provided wef_date/wef_time or derive from wef
    const wef_date = skillData.wef_date || formattedWef;
    const wef_time = skillData.wef_time || '00:00:00';
    
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
        wef_date: wef_date,
        wef_time: wef_time,
        wet_date: null, // New record is active
        wet_time: null,
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
    
    // Note: wef column has been removed, use wef_date and wef_time instead
    
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

// Validate date ranges for skill versions (check for gaps and overlaps)
export interface DateRangeValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export function validateSkillDateRanges(versions: Array<{
  id?: number;
  wef_date: string;
  wef_time: string;
  wet_date: string | null;
  wet_time: string | null;
}>): DateRangeValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Sort versions by wef_date and wef_time
  const sortedVersions = [...versions].sort((a, b) => {
    const dateCompare = a.wef_date.localeCompare(b.wef_date);
    if (dateCompare !== 0) return dateCompare;
    return a.wef_time.localeCompare(b.wef_time);
  });

  // Check for gaps and overlaps
  for (let i = 0; i < sortedVersions.length - 1; i++) {
    const current = sortedVersions[i];
    const next = sortedVersions[i + 1];

    // Current version must have wet_date if not the last one
    if (!current.wet_date && i < sortedVersions.length - 1) {
      errors.push(`Version starting at ${current.wef_date} ${current.wef_time} must have an end date (except the last version)`);
      continue;
    }

    if (current.wet_date && current.wet_time) {
      // Calculate end datetime
      const currentEnd = new Date(`${current.wet_date}T${current.wet_time}`);
      
      // Calculate next start datetime
      const nextStart = new Date(`${next.wef_date}T${next.wef_time}`);

      // Calculate expected next start (current end date + 1 day at 00:00:00)
      // If current ends at 30-06-2026 23:59:59, next should start at 01-07-2026 00:00:00
      const expectedNextStart = new Date(currentEnd);
      expectedNextStart.setDate(expectedNextStart.getDate() + 1);
      expectedNextStart.setHours(0, 0, 0, 0);

      // Check if they are exactly consecutive (wet ends on day N at 23:59:59, next wef starts on day N+1 at 00:00:00)
      const timeDiff = nextStart.getTime() - expectedNextStart.getTime();
      if (timeDiff !== 0) {
        // Not exactly consecutive
        if (timeDiff < 0) {
          errors.push(`Overlap: Version ending at ${current.wet_date} ${current.wet_time} overlaps with version starting at ${next.wef_date} ${next.wef_time}`);
        } else {
          errors.push(`Gap: Version ending at ${current.wet_date} ${current.wet_time} has a gap before version starting at ${next.wef_date} ${next.wef_time}. Expected next start: ${expectedNextStart.toISOString().split('T')[0]} 00:00:00`);
        }
      }
    }
  }

  // Check that only one version has wet_date = NULL (active)
  const activeVersions = sortedVersions.filter(v => !v.wet_date);
  if (activeVersions.length === 0) {
    errors.push('At least one version must be active (wet_date = NULL)');
  } else if (activeVersions.length > 1) {
    errors.push(`Multiple active versions found. Only one version can be active at a time.`);
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

// Bulk update skill versions
export async function bulkUpdateSkillVersions(
  skillName: string,
  versions: Array<{
    id?: number;
    rate_per_hour: number;
    min_salary: number;
    max_salary: number;
    wef_date: string;
    wef_time: string;
    wet_date: string | null;
    wet_time: string | null;
    is_active?: boolean;
  }>,
  username: string
): Promise<void> {
  try {
    // Validate date ranges
    const validation = validateSkillDateRanges(versions);
    if (!validation.isValid) {
      throw new Error(`Validation failed: ${validation.errors.join('; ')}`);
    }

    const currentTime = new Date().toISOString();

    // Update or insert each version
    for (const version of versions) {
      const rateAsInteger = Math.round(version.rate_per_hour);
      
      if (version.id) {
        // Update existing version
        const { error } = await supabase
          .from('hr_skill_master')
          .update({
            rate_per_hour: rateAsInteger,
            min_salary: version.min_salary,
            max_salary: version.max_salary,
            wef_date: version.wef_date,
            wef_time: version.wef_time,
            wet_date: version.wet_date,
            wet_time: version.wet_time,
            is_active: version.is_active ?? (version.wet_date === null),
            modified_by: username,
            modified_dt: currentTime
          })
          .eq('id', version.id);

        if (error) {
          console.error('Error updating skill version:', error);
          throw error;
        }
      } else {
        // Insert new version
        // Get skill_short from existing version
        const existing = await supabase
          .from('hr_skill_master')
          .select('skill_short')
          .eq('skill_name', skillName)
          .eq('is_deleted', false)
          .limit(1)
          .single();

        if (existing.error || !existing.data) {
          throw new Error(`Cannot find skill_short for skill: ${skillName}`);
        }

        const { error } = await supabase
          .from('hr_skill_master')
          .insert({
            skill_name: skillName,
            skill_short: existing.data.skill_short,
            rate_per_hour: rateAsInteger,
            min_salary: version.min_salary,
            max_salary: version.max_salary,
            wef_date: version.wef_date,
            wef_time: version.wef_time,
            wet_date: version.wet_date,
            wet_time: version.wet_time,
            is_active: version.is_active ?? (version.wet_date === null),
            created_by: username,
            created_dt: currentTime,
            modified_by: username,
            modified_dt: currentTime
          });

        if (error) {
          console.error('Error inserting skill version:', error);
          throw error;
        }
      }
    }
  } catch (error) {
    console.error('Error in bulkUpdateSkillVersions:', error);
    throw error;
  }
}

// Add new skill version (ends previous active version)
export async function addNewSkillVersion(
  skillName: string,
  wefDate: string,
  wefTime: string,
  skillData: {
    rate_per_hour: number;
    min_salary: number;
    max_salary: number;
    is_active?: boolean;
  },
  username: string
): Promise<void> {
  try {
    // Get current active version
    const { data: activeVersion, error: fetchError } = await supabase
      .from('hr_skill_master')
      .select('*')
      .eq('skill_name', skillName)
      .is('wet_date', null)
      .eq('is_deleted', false)
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') {
      // PGRST116 = no rows returned, which is OK for new skills
      throw fetchError;
    }

    const currentTime = new Date().toISOString();
    const rateAsInteger = Math.round(skillData.rate_per_hour);

    // Calculate previous version's end date/time
    // Previous wet_date = wef_date - 1 day
    // Previous wet_time = 23:59:59
    const wefDateTime = new Date(`${wefDate}T${wefTime}`);
    const prevEndDateTime = new Date(wefDateTime);
    prevEndDateTime.setDate(prevEndDateTime.getDate() - 1);
    prevEndDateTime.setHours(23, 59, 59, 0);

    const prevWetDate = prevEndDateTime.toISOString().split('T')[0];
    const prevWetTime = '23:59:59';

    // If there's an active version, end it
    if (activeVersion) {
      const { error: updateError } = await supabase
        .from('hr_skill_master')
        .update({
          wet_date: prevWetDate,
          wet_time: prevWetTime,
          is_active: false,
          modified_by: username,
          modified_dt: currentTime
        })
        .eq('id', activeVersion.id);

      if (updateError) {
        console.error('Error ending previous active version:', updateError);
        throw updateError;
      }
    }

    // Get skill_short
    const { data: skillDataRow } = await supabase
      .from('hr_skill_master')
      .select('skill_short')
      .eq('skill_name', skillName)
      .eq('is_deleted', false)
      .limit(1)
      .single();

    const skillShort = skillDataRow?.skill_short || activeVersion?.skill_short;
    if (!skillShort) {
      throw new Error(`Cannot find skill_short for skill: ${skillName}`);
    }

    // Insert new version
    const { error: insertError } = await supabase
      .from('hr_skill_master')
      .insert({
        skill_name: skillName,
        skill_short: skillShort,
        rate_per_hour: rateAsInteger,
        min_salary: skillData.min_salary,
        max_salary: skillData.max_salary,
        wef_date: wefDate,
        wef_time: wefTime,
        wet_date: null, // New version is active
        wet_time: null,
        is_active: skillData.is_active ?? true,
        created_by: username,
        created_dt: currentTime,
        modified_by: username,
        modified_dt: currentTime
      });

    if (insertError) {
      console.error('Error adding new skill version:', insertError);
      throw insertError;
    }
  } catch (error) {
    console.error('Error in addNewSkillVersion:', error);
    throw error;
  }
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