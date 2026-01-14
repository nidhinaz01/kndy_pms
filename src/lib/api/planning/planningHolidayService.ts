import { supabase } from '$lib/supabaseClient';
import { getCurrentUsername, getCurrentTimestamp } from '$lib/utils/userUtils';
import type { Holiday, HolidayFormData, HolidayStats } from './planningTypes';

export async function fetchHolidays(year?: number): Promise<Holiday[]> {
  try {
    let query = supabase
      .from('plan_holidays')
      .select('*')
      .eq('is_deleted', false);
    
    if (year) {
      query = query.eq('dt_year', year);
    }
    
    const { data, error } = await query.order('dt_value', { ascending: true });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching holidays:', error);
    throw error;
  }
}

/**
 * Check if a holiday already exists for the given date AND description
 * Allows multiple holidays on same date if descriptions are different
 */
async function checkDuplicateHoliday(dt_value: string | null, description: string, excludeId?: number): Promise<boolean> {
  if (!dt_value || !description) return false;
  
  try {
    let query = supabase
      .from('plan_holidays')
      .select('id')
      .eq('dt_value', dt_value)
      .eq('description', description.trim())
      .eq('is_deleted', false)
      .limit(1);
    
    if (excludeId) {
      query = query.neq('id', excludeId);
    }
    
    const { data, error } = await query;
    if (error) throw error;
    return (data?.length || 0) > 0;
  } catch (error) {
    console.error('Error checking duplicate holiday:', error);
    return false;
  }
}

/**
 * Validate date consistency
 */
function validateDateConsistency(holiday: HolidayFormData): { valid: boolean; error?: string } {
  if (!holiday.dt_value) {
    return { valid: false, error: 'Date value (dt_value) is required' };
  }
  
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  
  const date = new Date(holiday.dt_value);
  if (isNaN(date.getTime())) {
    return { valid: false, error: 'Invalid date value' };
  }
  
  const monthIndex = monthNames.indexOf(holiday.dt_month);
  if (monthIndex === -1) {
    return { valid: false, error: 'Invalid month name' };
  }
  
  // Check if date components match dt_value
  if (date.getDate() !== holiday.dt_day ||
      date.getMonth() !== monthIndex ||
      date.getFullYear() !== holiday.dt_year) {
    return { valid: false, error: 'Date components do not match dt_value' };
  }
  
  return { valid: true };
}

export async function saveHoliday(holiday: HolidayFormData): Promise<Holiday> {
  try {
    // Validate date consistency
    const validation = validateDateConsistency(holiday);
    if (!validation.valid) {
      throw new Error(validation.error || 'Date validation failed');
    }
    
    // Check for duplicates (same date AND same description)
    const isDuplicate = await checkDuplicateHoliday(holiday.dt_value, holiday.description);
    if (isDuplicate) {
      throw new Error(`A holiday "${holiday.description}" already exists for ${holiday.dt_value}. Please use edit to modify existing holidays.`);
    }
    
    const { data, error } = await supabase
      .from('plan_holidays')
      .insert([{
        ...holiday,
        created_by: getCurrentUsername(),
        created_dt: getCurrentTimestamp(),
        modified_by: getCurrentUsername(),
        modified_dt: getCurrentTimestamp(),
        is_deleted: false
      }])
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error saving holiday:', error);
    throw error;
  }
}

export async function updateHoliday(id: number, holiday: Partial<HolidayFormData>): Promise<Holiday> {
  try {
    const { data, error } = await supabase
      .from('plan_holidays')
      .update({
        ...holiday,
        modified_by: getCurrentUsername(),
        modified_dt: getCurrentTimestamp()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error updating holiday:', error);
    throw error;
  }
}

export async function deleteHoliday(id: number): Promise<void> {
  try {
    const { error } = await supabase
      .from('plan_holidays')
      .update({ is_deleted: true })
      .eq('id', id);

    if (error) throw error;
  } catch (error) {
    console.error('Error deleting holiday:', error);
    throw error;
  }
}

/**
 * Get holiday statistics
 * Uses database function for efficient calculation
 * @param year Optional year filter
 */
export async function getHolidayStats(year?: number): Promise<HolidayStats> {
  try {
    const { data, error } = await supabase.rpc('get_holiday_stats', {
      p_year: year || null
    });

    if (error) throw error;

    // Database function returns JSONB, which Supabase converts to object
    // Convert byYear from string keys to number keys to match TypeScript interface
    const result = data as {
      total: number;
      active: number;
      inactive: number;
      byYear: Record<string, number>;
    };

    // Convert string keys to number keys for byYear
    const byYear: Record<number, number> = {};
    if (result.byYear) {
      Object.keys(result.byYear).forEach(key => {
        byYear[parseInt(key)] = result.byYear[key];
      });
    }

    return {
      total: result.total,
      active: result.active,
      inactive: result.inactive,
      byYear
    };
  } catch (error) {
    console.error('Error getting holiday stats:', error);
    throw error;
  }
}

export async function addSundaysForYear(): Promise<{ added: number; skipped: number }> {
  try {
    const currentDate = new Date();
    const endDate = new Date();
    endDate.setFullYear(currentDate.getFullYear() + 1);
    
    const sundays: HolidayFormData[] = [];
    const current = new Date(currentDate);
    
    while (current.getDay() !== 0) {
      current.setDate(current.getDate() + 1);
    }
    
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    
    // Collect all Sunday dates
    while (current <= endDate) {
      sundays.push({
        dt_day: current.getDate(),
        dt_month: monthNames[current.getMonth()],
        dt_year: current.getFullYear(),
        dt_value: current.toISOString().split('T')[0],
        description: 'Sunday',
        is_active: true
      });
      
      current.setDate(current.getDate() + 7);
    }
    
    // Check which Sundays already exist (same date AND same description)
    const existingHolidays = new Set<string>();
    if (sundays.length > 0) {
      const dateValues = sundays.map(s => s.dt_value).filter(Boolean) as string[];
      const { data: existing } = await supabase
        .from('plan_holidays')
        .select('dt_value, description')
        .in('dt_value', dateValues)
        .eq('description', 'Sunday')
        .eq('is_deleted', false);
      
      if (existing) {
        existing.forEach(h => {
          if (h.dt_value) {
            existingHolidays.add(`${h.dt_value}|${h.description}`);
          }
        });
      }
    }
    
    // Filter out existing Sundays (same date + same description)
    const newSundays = sundays.filter(s => {
      if (!s.dt_value) return false;
      const key = `${s.dt_value}|${s.description}`;
      return !existingHolidays.has(key);
    });
    
    if (newSundays.length === 0) {
      return { added: 0, skipped: sundays.length };
    }
    
    // Insert only new Sundays
    const { error } = await supabase
      .from('plan_holidays')
      .insert(newSundays.map(holiday => ({
        ...holiday,
        created_by: getCurrentUsername(),
        created_dt: getCurrentTimestamp(),
        modified_by: getCurrentUsername(),
        modified_dt: getCurrentTimestamp(),
        is_active: true,
        is_deleted: false
      })));
    
    if (error) throw error;
    
    return { added: newSundays.length, skipped: existingHolidays.size };
  } catch (error) {
    console.error('Error adding Sundays:', error);
    throw error;
  }
}

export async function importHolidays(holidays: HolidayFormData[]): Promise<{ added: number; skipped: number; errors: number }> {
  try {
    if (holidays.length === 0) {
      return { added: 0, skipped: 0, errors: 0 };
    }
    
    // Validate and filter holidays
    const validHolidays: HolidayFormData[] = [];
    let errors = 0;
    
    for (const holiday of holidays) {
      const validation = validateDateConsistency(holiday);
      if (!validation.valid) {
        errors++;
        continue;
      }
      validHolidays.push(holiday);
    }
    
    if (validHolidays.length === 0) {
      return { added: 0, skipped: 0, errors };
    }
    
    // Check which holidays already exist (same date AND same description)
    const existingHolidays = new Set<string>();
    const dateValues = validHolidays.map(h => h.dt_value).filter(Boolean) as string[];
    
    if (dateValues.length > 0) {
      const { data: existing } = await supabase
        .from('plan_holidays')
        .select('dt_value, description')
        .in('dt_value', dateValues)
        .eq('is_deleted', false);
      
      if (existing) {
        existing.forEach(h => {
          if (h.dt_value && h.description) {
            existingHolidays.add(`${h.dt_value}|${h.description}`);
          }
        });
      }
    }
    
    // Filter out existing holidays (same date + same description)
    const newHolidays = validHolidays.filter(h => {
      if (!h.dt_value || !h.description) return false;
      const key = `${h.dt_value}|${h.description}`;
      return !existingHolidays.has(key);
    });
    
    if (newHolidays.length === 0) {
      return { added: 0, skipped: existingDates.size, errors };
    }
    
    // Insert only new holidays
    const { error } = await supabase
      .from('plan_holidays')
      .insert(newHolidays.map(holiday => ({
        ...holiday,
        created_by: getCurrentUsername(),
        created_dt: getCurrentTimestamp(),
        modified_by: getCurrentUsername(),
        modified_dt: getCurrentTimestamp(),
        is_active: true,
        is_deleted: false
      })));
    
    if (error) throw error;
    
    return { 
      added: newHolidays.length, 
      skipped: existingHolidays.size, 
      errors 
    };
  } catch (error) {
    console.error('Error importing holidays:', error);
    throw error;
  }
}

