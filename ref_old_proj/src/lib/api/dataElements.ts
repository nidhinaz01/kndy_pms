import { supabase } from '$lib/supabaseClient';
import { sanitizeString } from '$lib/utils/inputSanitization';

export interface DataElement {
  id: number;
  de_name: string;
  de_value: string;
  modified_by: string;
  modified_dt: string;
}

/**
 * Fetch all unique data element names from the database
 */
export async function fetchDataElementNames(): Promise<string[]> {
  try {
    const { data, error } = await supabase
      .from('sys_data_elements')
      .select('de_name')
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
  modifiedBy: string
): Promise<void> {
  try {
    const { error } = await supabase
      .from('sys_data_elements')
      .insert({
        de_name: sanitizeString(deName),
        de_value: sanitizeString(deValue),
        modified_by: sanitizeString(modifiedBy)
      });

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
  modifiedBy: string
): Promise<void> {
  try {
    const dataElements = deValues.map(value => ({
      de_name: sanitizeString(deName),
      de_value: sanitizeString(value),
      modified_by: sanitizeString(modifiedBy)
    }));

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
        de_value: sanitizeString(deValue),
        modified_by: sanitizeString(modifiedBy)
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
 * Delete a data element
 */
export async function deleteDataElement(id: number): Promise<void> {
  try {
    const { error } = await supabase
      .from('sys_data_elements')
      .delete()
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