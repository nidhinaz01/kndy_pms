import { supabase } from '$lib/supabaseClient';

export interface Holiday {
  id: number;
  dt_day: number;
  dt_month: string;
  dt_year: number;
  dt_value: string | null;
  created_dt: string;
  created_by: string;
  description: string;
  modified_by: string;
  modified_dt: string;
  is_active: boolean;
  is_deleted: boolean;
}

// Fetch all active holidays
export async function fetchHolidays(): Promise<Holiday[]> {
  try {
    const { data, error } = await supabase
      .from('plan_holidays')
      .select('*')
      .eq('is_active', true)
      .eq('is_deleted', false)
      .order('dt_year', { ascending: true })
      .order('dt_month', { ascending: true })
      .order('dt_day', { ascending: true });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching holidays:', error);
    throw error;
  }
}

// Fetch holidays for a specific year
export async function fetchHolidaysByYear(year: number): Promise<Holiday[]> {
  try {
    const { data, error } = await supabase
      .from('plan_holidays')
      .select('*')
      .eq('dt_year', year)
      .eq('is_active', true)
      .eq('is_deleted', false)
      .order('dt_month', { ascending: true })
      .order('dt_day', { ascending: true });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching holidays by year:', error);
    throw error;
  }
}

// Get holiday dates as Date objects for a given year range
export async function getHolidayDates(startYear: number, endYear: number): Promise<Date[]> {
  try {
    const holidays = await fetchHolidays();
    
    // Filter holidays within the year range
    const relevantHolidays = holidays.filter(holiday => 
      holiday.dt_year >= startYear && holiday.dt_year <= endYear
    );

    // Convert to Date objects
    const holidayDates = relevantHolidays.map(holiday => {
      // Use dt_value if available, otherwise construct from dt_day, dt_month, dt_year
      if (holiday.dt_value) {
        return new Date(holiday.dt_value);
      } else {
        // Convert month name to number
        const monthNames = [
          'January', 'February', 'March', 'April', 'May', 'June',
          'July', 'August', 'September', 'October', 'November', 'December'
        ];
        const monthIndex = monthNames.indexOf(holiday.dt_month);
        if (monthIndex === -1) {
          console.warn(`Invalid month name: ${holiday.dt_month}`);
          return null;
        }
        
        return new Date(holiday.dt_year, monthIndex, holiday.dt_day);
      }
    }).filter(date => date !== null) as Date[];

    return holidayDates;
  } catch (error) {
    console.error('Error getting holiday dates:', error);
    return [];
  }
}

// Check if a specific date is a holiday
export async function isHoliday(date: Date): Promise<boolean> {
  try {
    const year = date.getFullYear();
    const month = date.getMonth() + 1; // JavaScript months are 0-based
    const day = date.getDate();

    const { data, error } = await supabase
      .from('plan_holidays')
      .select('id')
      .eq('dt_year', year)
      .eq('dt_day', day)
      .eq('is_active', true)
      .eq('is_deleted', false)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    return !!data;
  } catch (error) {
    console.error('Error checking if date is holiday:', error);
    return false;
  }
}

// Calculate working days between two dates (excluding holidays)
export async function calculateWorkingDays(startDate: Date, endDate: Date): Promise<number> {
  try {
    const holidays = await getHolidayDates(startDate.getFullYear(), endDate.getFullYear());
    
    let workingDays = 0;
    const currentDate = new Date(startDate);
    
    while (currentDate <= endDate) {
      // Skip weekends (Saturday = 6, Sunday = 0)
      const dayOfWeek = currentDate.getDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        // Check if it's not a holiday
        const isHolidayDate = holidays.some(holiday => 
          holiday.getFullYear() === currentDate.getFullYear() &&
          holiday.getMonth() === currentDate.getMonth() &&
          holiday.getDate() === currentDate.getDate()
        );
        
        if (!isHolidayDate) {
          workingDays++;
        }
      }
      
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    return workingDays;
  } catch (error) {
    console.error('Error calculating working days:', error);
    // Fallback to simple day difference if holiday calculation fails
    const diffTime = endDate.getTime() - startDate.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }
}
