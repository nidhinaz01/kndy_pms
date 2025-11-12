import { supabase } from '$lib/supabaseClient';

export interface StdWorkTypeDetail {
  swtd_id?: number;
  sw_code: string;
  type_description: string;
  derived_sw_code: string;
  is_active: boolean;
  is_deleted: boolean;
  created_by: string;
  created_dt: string;
  modified_by: string;
  modified_dt?: string;
}

export interface StdWorkTypeDetailFormData {
  sw_code: string;
  type_description: string;
}

// Fetch all derivative works (not deleted)
export async function fetchAllStdWorkTypeDetails(): Promise<StdWorkTypeDetail[]> {
  try {
    const { data, error } = await supabase
      .from('std_work_type_details')
      .select(`
        *,
        std_work_details!inner(sw_name, plant_stage, sw_type)
      `)
      .eq('is_deleted', false)
      .order('created_dt', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching derivative works:', error);
    throw error;
  }
}

// Fetch derivative works by base work code
export async function fetchDerivativeWorksByBaseCode(sw_code: string): Promise<StdWorkTypeDetail[]> {
  try {
    const { data, error } = await supabase
      .from('std_work_type_details')
      .select('*')
      .eq('sw_code', sw_code)
      .eq('is_deleted', false)
      .order('derived_sw_code');

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching derivative works by base code:', error);
    throw error;
  }
}

// Generate next available derived code
export async function generateNextDerivedCode(baseCode: string): Promise<string> {
  try {
    // Get existing derivative codes for this base code
    const { data, error } = await supabase
      .from('std_work_type_details')
      .select('derived_sw_code')
      .eq('sw_code', baseCode)
      .eq('is_deleted', false)
      .order('derived_sw_code');

    if (error) throw error;

    const existingCodes = data || [];
    
    if (existingCodes.length === 0) {
      return `${baseCode}A`;
    }

    // Find the next available suffix
    const suffixes = existingCodes.map(item => {
      const suffix = item.derived_sw_code.substring(baseCode.length);
      return suffix;
    });

    // Generate next suffix (A, B, C, ..., Z, AA, AB, ...)
    let nextSuffix = 'A';
    let found = false;
    
    while (!found) {
      if (!suffixes.includes(nextSuffix)) {
        found = true;
      } else {
        // Increment suffix
        if (nextSuffix.length === 1) {
          if (nextSuffix === 'Z') {
            nextSuffix = 'AA';
          } else {
            nextSuffix = String.fromCharCode(nextSuffix.charCodeAt(0) + 1);
          }
        } else {
          // Handle multi-character suffixes (AA, AB, etc.)
          const lastChar = nextSuffix[nextSuffix.length - 1];
          if (lastChar === 'Z') {
            // Increment the first character and reset the second
            const firstChar = nextSuffix[0];
            if (firstChar === 'Z') {
              // Add another character
              nextSuffix = 'A' + 'A'.repeat(nextSuffix.length);
            } else {
              nextSuffix = String.fromCharCode(firstChar.charCodeAt(0) + 1) + 'A'.repeat(nextSuffix.length - 1);
            }
          } else {
            nextSuffix = nextSuffix.slice(0, -1) + String.fromCharCode(lastChar.charCodeAt(0) + 1);
          }
        }
      }
    }

    return `${baseCode}${nextSuffix}`;
  } catch (error) {
    console.error('Error generating next derived code:', error);
    throw error;
  }
}

// Save new derivative work
export async function saveStdWorkTypeDetail(workType: StdWorkTypeDetailFormData): Promise<StdWorkTypeDetail> {
  try {
    // Generate derived code
    const derivedCode = await generateNextDerivedCode(workType.sw_code);
    
    const { getCurrentUsername, getCurrentTimestamp } = await import('$lib/utils/userUtils');
    const username = getCurrentUsername();
    const now = getCurrentTimestamp();

    // Create the derivative work
    const { data, error } = await supabase
      .from('std_work_type_details')
      .insert([{
        sw_code: workType.sw_code,
        type_description: workType.type_description,
        derived_sw_code: derivedCode,
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
    console.error('Error saving derivative work:', error);
    throw error;
  }
}

// Toggle active status
export async function toggleDerivativeWorkActive(swtd_id: number, isActive: boolean): Promise<void> {
  try {
    const { getCurrentUsername, getCurrentTimestamp } = await import('$lib/utils/userUtils');
    const username = getCurrentUsername();
    const now = getCurrentTimestamp();

    const { error } = await supabase
      .from('std_work_type_details')
      .update({
        is_active: isActive,
        modified_by: username,
        modified_dt: now
        // created_by and created_dt should not be touched on update
      })
      .eq('swtd_id', swtd_id);

    if (error) throw error;
  } catch (error) {
    console.error('Error toggling derivative work status:', error);
    throw error;
  }
}

// Soft delete derivative work
export async function deleteDerivativeWork(swtd_id: number): Promise<void> {
  try {
    const { getCurrentUsername, getCurrentTimestamp } = await import('$lib/utils/userUtils');
    const username = getCurrentUsername();
    const now = getCurrentTimestamp();

    const { error } = await supabase
      .from('std_work_type_details')
      .update({
        is_deleted: true,
        is_active: false,
        modified_by: username,
        modified_dt: now
        // created_by and created_dt should not be touched on update
      })
      .eq('swtd_id', swtd_id);

    if (error) throw error;
  } catch (error) {
    console.error('Error deleting derivative work:', error);
    throw error;
  }
} 