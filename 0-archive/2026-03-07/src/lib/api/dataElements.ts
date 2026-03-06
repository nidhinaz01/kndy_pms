import { supabase } from '$lib/supabaseClient';

export interface DataElement {
  id: number;
  de_name: string;
  de_value: string;
  modified_by: string;
  modified_dt: string;
  is_active: boolean;
  is_deleted: boolean;
  created_by: string;
  created_dt: string;
}

/**
 * Fetch all unique data element names from the database
 */
export async function fetchDataElementNames(): Promise<string[]> {
  try {
    const { data, error } = await supabase
      .from('sys_data_elements')
      .select('de_name')
      .eq('is_deleted', false)
      .order('de_name');

    if (error) {
      console.error('Error fetching data element names:', error);
      throw error;
    }

    // Get unique data element names
    const uniqueNames = [...new Set(data.map(item => item.de_name))];
    return uniqueNames;
  } catch (error) {
    console.error('Error in fetchDataElementNames:', error);
    throw error;
  }
}

/**
 * Save a new data element to the database
 */
export async function saveDataElement(
  deName: string,
  deValue: string,
  createdBy: string
): Promise<void> {
  try {
    const currentTime = new Date().toISOString();
    const insertData = {
      de_name: deName.trim(),
      de_value: deValue.trim(),
      is_active: true,
      is_deleted: false,
      created_by: createdBy,
      created_dt: currentTime,
      modified_by: createdBy,
      modified_dt: currentTime
    };
    
    const { error } = await supabase
      .from('sys_data_elements')
      .insert(insertData);

    if (error) {
      console.error('Error saving data element:', error);
      throw error;
    }
  } catch (error) {
    console.error('Error in saveDataElement:', error);
    throw error;
  }
}

/**
 * Save multiple data elements to the database
 */
export async function saveMultipleDataElements(
  deName: string,
  deValues: string[],
  createdBy: string
): Promise<void> {
  try {
    const dataElements = deValues.map(value => {
      const currentTime = new Date().toISOString();
      return {
        de_name: deName.trim(),
        de_value: value.trim(),
        created_by: createdBy,
        created_dt: currentTime,
        modified_by: createdBy,
        modified_dt: currentTime
      };
    });

    const { error } = await supabase
      .from('sys_data_elements')
      .insert(dataElements);

    if (error) {
      console.error('Error saving multiple data elements:', error);
      throw error;
    }
  } catch (error) {
    console.error('Error in saveMultipleDataElements:', error);
    throw error;
  }
}

/**
 * Check for existing name-value combinations
 */
export async function checkExistingCombinations(
  deName: string,
  deValues: string[]
): Promise<DataElement[]> {
  try {
    const { data, error } = await supabase
      .from('sys_data_elements')
      .select('*')
      .eq('de_name', deName)
      .eq('is_active', true)
      .eq('is_deleted', false)
      .in('de_value', deValues);

    if (error) {
      console.error('Error checking existing combinations:', error);
      throw error;
    }

    return data || [];
  } catch (error) {
    console.error('Error in checkExistingCombinations:', error);
    throw error;
  }
}

/**
 * Fetch all data elements with optional filtering
 */
export async function fetchDataElements(
  deName?: string
): Promise<DataElement[]> {
  try {
    let query = supabase
      .from('sys_data_elements')
      .select('*')
      .eq('is_deleted', false)
      .order('de_name', { ascending: true })
      .order('modified_dt', { ascending: false });

    if (deName) {
      query = query.eq('de_name', deName);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching data elements:', error);
      throw error;
    }

    return data || [];
  } catch (error) {
    console.error('Error in fetchDataElements:', error);
    throw error;
  }
}

/**
 * Update an existing data element
 */
export async function updateDataElement(
  id: number,
  deValue: string,
  modifiedBy: string
): Promise<void> {
  try {
    const { error } = await supabase
      .from('sys_data_elements')
      .update({
        de_value: deValue.trim(),
        modified_by: modifiedBy,
        modified_dt: new Date().toISOString()
      })
      .eq('id', id);

    if (error) {
      console.error('Error updating data element:', error);
      throw error;
    }
  } catch (error) {
    console.error('Error in updateDataElement:', error);
    throw error;
  }
}

/**
 * Soft delete a data element
 */
export async function deleteDataElement(id: number, modifiedBy: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('sys_data_elements')
      .update({
        is_deleted: true,
        is_active: false,
        modified_by: modifiedBy,
        modified_dt: new Date().toISOString()
      })
      .eq('id', id);

    if (error) {
      console.error('Error deleting data element:', error);
      throw error;
    }
  } catch (error) {
    console.error('Error in deleteDataElement:', error);
    throw error;
  }
}

/**
 * Toggle active status of a data element
 */
export async function toggleDataElementStatus(id: number, isActive: boolean, modifiedBy: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('sys_data_elements')
      .update({
        is_active: isActive,
        modified_by: modifiedBy,
        modified_dt: new Date().toISOString()
      })
      .eq('id', id);

    if (error) {
      console.error('Error toggling data element status:', error);
      throw error;
    }
  } catch (error) {
    console.error('Error in toggleDataElementStatus:', error);
    throw error;
  }
}

/**
 * Save a new skill name to data elements
 */
export async function saveSkillName(skillName: string, createdBy: string): Promise<void> {
  try {
    // Check if skill name already exists
    const { data: existing, error: checkError } = await supabase
      .from('sys_data_elements')
      .select('id')
      .eq('de_name', 'Skill Name')
      .eq('de_value', skillName)
      .eq('is_deleted', false);

    if (checkError) {
      console.error('Error checking existing skill name:', checkError);
      throw checkError;
    }

    if (existing && existing.length > 0) {
      throw new Error(`Skill name "${skillName}" already exists`);
    }

    await saveDataElement('Skill Name', skillName, createdBy);
  } catch (error) {
    console.error('Error in saveSkillName:', error);
    throw error;
  }
}

/**
 * Save a new skill code to data elements
 */
export async function saveSkillCode(skillCode: string, createdBy: string): Promise<void> {
  try {
    // Check if skill code already exists
    const { data: existing, error: checkError } = await supabase
      .from('sys_data_elements')
      .select('id')
      .eq('de_name', 'Skill Short')
      .eq('de_value', skillCode)
      .eq('is_deleted', false);

    if (checkError) {
      console.error('Error checking existing skill code:', checkError);
      throw checkError;
    }

    if (existing && existing.length > 0) {
      throw new Error(`Skill code "${skillCode}" already exists`);
    }

    await saveDataElement('Skill Short', skillCode, createdBy);
  } catch (error) {
    console.error('Error in saveSkillCode:', error);
    throw error;
  }
} 