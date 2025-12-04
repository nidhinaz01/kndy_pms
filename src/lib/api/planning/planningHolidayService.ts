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

export async function saveHoliday(holiday: HolidayFormData): Promise<Holiday> {
  try {
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

export async function addSundaysForYear(): Promise<void> {
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
    
    const { error } = await supabase
      .from('plan_holidays')
      .insert(sundays.map(holiday => ({
        ...holiday,
        created_by: getCurrentUsername(),
        created_dt: getCurrentTimestamp(),
        modified_by: getCurrentUsername(),
        modified_dt: getCurrentTimestamp(),
        is_active: true,
        is_deleted: false
      })));
    
    if (error) throw error;
  } catch (error) {
    console.error('Error adding Sundays:', error);
    throw error;
  }
}

export async function importHolidays(holidays: HolidayFormData[]): Promise<void> {
  try {
    const { error } = await supabase
      .from('plan_holidays')
      .insert(holidays.map(holiday => ({
        ...holiday,
        created_by: getCurrentUsername(),
        created_dt: getCurrentTimestamp(),
        modified_by: getCurrentUsername(),
        modified_dt: getCurrentTimestamp(),
        is_active: true,
        is_deleted: false
      })));
    
    if (error) throw error;
  } catch (error) {
    console.error('Error importing holidays:', error);
    throw error;
  }
}

