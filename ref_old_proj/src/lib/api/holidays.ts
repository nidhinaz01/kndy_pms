import { supabase } from '$lib/supabaseClient';
import { sanitizeObject } from '$lib/utils/inputSanitization';

// Types for holiday data
export interface Holiday {
  id: number;
  dt_day: number;
  dt_month: string;
  dt_year: number;
  dt_value: string | null;
  created_dt: string;
  created_by: string;
  description: string;
  modified_by?: string;
  modified_dt?: string;
}

export interface HolidayTemplate {
  dt_day: number;
  dt_month: string;
  dt_year: number;
  description: string;
}

export interface HolidayFilters {
  month?: string;
  year?: number;
}

/**
 * Fetch all holidays with optional filters
 */
export async function fetchHolidays(filters?: HolidayFilters): Promise<Holiday[]> {
  try {
    let query = supabase
      .from('plan_holidays')
      .select('*')
      .order('dt_value', { ascending: true });

    if (filters?.month) {
      query = query.eq('dt_month', filters.month);
    }

    if (filters?.year) {
      query = query.eq('dt_year', filters.year);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching holidays:', error);
      throw error;
    }

    return data || [];
  } catch (error) {
    console.error('Error in fetchHolidays:', error);
    throw error;
  }
}

/**
 * Fetch available months and years for filtering
 */
export async function fetchHolidayFilters(): Promise<{ months: string[]; years: number[] }> {
  try {
    const { data, error } = await supabase
      .from('plan_holidays')
      .select('dt_month, dt_year')
      .order('dt_year', { ascending: false })
      .order('dt_month', { ascending: true });

    if (error) {
      console.error('Error fetching holiday filters:', error);
      throw error;
    }

    const months = [...new Set(data?.map(item => item.dt_month) || [])];
    const years = [...new Set(data?.map(item => item.dt_year) || [])].sort((a, b) => b - a);

    return { months, years };
  } catch (error) {
    console.error('Error in fetchHolidayFilters:', error);
    throw error;
  }
}

/**
 * Save a new holiday
 */
export async function saveHoliday(holidayData: Omit<Holiday, 'id' | 'created_dt' | 'dt_value'>): Promise<number> {
  try {
    // Ensure dt_value is not included in the data
    const { dt_value, ...dataToSave } = holidayData as any;
    const sanitizedData = sanitizeObject(dataToSave);
    
    const { data, error } = await supabase
      .from('plan_holidays')
      .insert([sanitizedData])
      .select('id')
      .single();

    if (error) {
      console.error('Error saving holiday:', error);
      throw error;
    }

    return data.id;
  } catch (error) {
    console.error('Error in saveHoliday:', error);
    throw error;
  }
}

/**
 * Update an existing holiday
 */
export async function updateHoliday(
  id: number,
  holidayData: Partial<Omit<Holiday, 'id' | 'created_dt' | 'dt_value'>>,
  modifiedBy: string
): Promise<void> {
  try {
    // Ensure dt_value is not included in the update data
    const { dt_value, ...dataToUpdate } = holidayData as any;
    const sanitizedData = sanitizeObject(dataToUpdate);
    sanitizedData.modified_by = modifiedBy;
    sanitizedData.modified_dt = new Date().toISOString();
    const { error } = await supabase
      .from('plan_holidays')
      .update(sanitizedData)
      .eq('id', id);

    if (error) {
      console.error('Error updating holiday:', error);
      throw error;
    }
  } catch (error) {
    console.error('Error in updateHoliday:', error);
    throw error;
  }
}

/**
 * Delete a holiday
 */
export async function deleteHoliday(id: number): Promise<void> {
  try {
    const { error } = await supabase
      .from('plan_holidays')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting holiday:', error);
      throw error;
    }
  } catch (error) {
    console.error('Error in deleteHoliday:', error);
    throw error;
  }
}

/**
 * Validate date combination
 */
export function validateDateCombination(day: number, month: string, year: number): boolean {
  try {
    const monthIndex = new Date(Date.parse(month + " 1, 2000")).getMonth();
    const date = new Date(year, monthIndex, day);
    
    return date.getDate() === day && 
           date.getMonth() === monthIndex && 
           date.getFullYear() === year;
  } catch {
    return false;
  }
}

/**
 * Generate CSV template for holidays
 */
export function generateHolidayTemplate(): string {
  const headers = ['dt_day', 'dt_month', 'dt_year', 'description'];
  const example = ['15', 'January', '2024', 'Republic Day'];
  
  return [headers.join(','), example.join(',')].join('\n');
}

/**
 * Parse and validate CSV data
 */
export function parseHolidayCSV(csvData: string): { valid: HolidayTemplate[], invalid: string[] } {
  const lines = csvData.trim().split('\n');
  const headers = lines[0]?.split(',');
  
  if (!headers || headers.length !== 4) {
    throw new Error('Invalid CSV format. Expected columns: dt_day, dt_month, dt_year, description');
  }

  const valid: HolidayTemplate[] = [];
  const invalid: string[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const values = line.split(',');
    if (values.length !== 4) {
      invalid.push(`Line ${i + 1}: Invalid number of columns`);
      continue;
    }

    const [dayStr, month, yearStr, description] = values;
    const day = parseInt(dayStr);
    const year = parseInt(yearStr);

    // Validate data types
    if (isNaN(day) || isNaN(year)) {
      invalid.push(`Line ${i + 1}: Invalid day or year format`);
      continue;
    }

    // Validate month
    const validMonths = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    
    if (!validMonths.includes(month)) {
      invalid.push(`Line ${i + 1}: Invalid month "${month}"`);
      continue;
    }

    // Validate year range (current year -1 to +1)
    const currentYear = new Date().getFullYear();
    if (year < currentYear - 1 || year > currentYear + 1) {
      invalid.push(`Line ${i + 1}: Year must be between ${currentYear - 1} and ${currentYear + 1}`);
      continue;
    }

    // Validate date combination
    if (!validateDateCombination(day, month, year)) {
      invalid.push(`Line ${i + 1}: Invalid date combination (${day} ${month} ${year})`);
      continue;
    }

    valid.push({
      dt_day: day,
      dt_month: month,
      dt_year: year,
      description: description.trim()
    });
  }

  return { valid, invalid };
}

/**
 * Import holidays from CSV data
 */
export async function importHolidays(holidays: HolidayTemplate[], createdBy: string): Promise<{ success: number; errors: string[] }> {
  try {
    const now = new Date().toISOString();
    const sanitizedHolidays = holidays.map(holiday => {
      // Ensure dt_value is not included in the import data
      const { dt_value, ...dataToImport } = holiday as any;
      return {
        ...sanitizeObject(dataToImport),
        created_by: createdBy,
        modified_by: createdBy,
        modified_dt: now
      };
    });

    const { data, error } = await supabase
      .from('plan_holidays')
      .insert(sanitizedHolidays)
      .select('id');

    if (error) {
      console.error('Error importing holidays:', error);
      throw error;
    }

    return { success: data?.length || 0, errors: [] };
  } catch (error) {
    console.error('Error in importHolidays:', error);
    throw error;
  }
} 

/**
 * Fetch holidays by date range (inclusive)
 */
export async function fetchHolidaysByDateRange(startDate: Date, endDate: Date): Promise<Holiday[]> {
  // dt_value is assumed to be ISO string (YYYY-MM-DD)
  const startStr = startDate.toISOString().slice(0, 10);
  const endStr = endDate.toISOString().slice(0, 10);
  try {
    const { data, error } = await supabase
      .from('plan_holidays')
      .select('*')
      .gte('dt_value', startStr)
      .lte('dt_value', endStr);
    if (error) {
      console.error('Error fetching holidays by date range:', error);
      throw error;
    }
    return data || [];
  } catch (error) {
    console.error('Error in fetchHolidaysByDateRange:', error);
    throw error;
  }
} 