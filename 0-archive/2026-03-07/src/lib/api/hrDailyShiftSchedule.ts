import { supabase } from '$lib/supabaseClient';

export interface HrDailyShiftSchedule {
  schedule_id?: number;
  shift_id: number;
  schedule_date: string;
  total_shift_minutes: number;
  value_added_minutes: number;
  non_value_added_minutes: number;
  is_active: boolean;
  is_deleted: boolean;
  created_by: string;
  created_dt: string;
  modified_by: string;
  modified_dt?: string;
}

export interface HrDailyShiftScheduleFormData {
  shift_id: number;
  from_date: string;
  to_date: string;
}

// Fetch all daily shift schedules (not deleted)
export async function fetchAllDailyShiftSchedules(): Promise<HrDailyShiftSchedule[]> {
  try {
    console.log('Fetching daily shift schedules from database...');
    const { data, error } = await supabase
      .from('hr_daily_shift_schedule')
      .select(`
        *,
        hr_shift_master!inner(shift_name, shift_code, start_time, end_time)
      `)
      .eq('is_deleted', false)
      .order('schedule_date', { ascending: false });

    if (error) {
      console.error('Database error:', error);
      throw error;
    }
    
    console.log('Fetched data:', data);
    return data || [];
  } catch (error) {
    console.error('Error fetching daily shift schedules:', error);
    throw error;
  }
}

// Fetch daily shift schedules by date range
export async function fetchDailyShiftSchedulesByDateRange(startDate: string, endDate: string): Promise<HrDailyShiftSchedule[]> {
  try {
    const { data, error } = await supabase
      .from('hr_daily_shift_schedule')
      .select(`
        *,
        hr_shift_master!inner(shift_name, shift_code, start_time, end_time)
      `)
      .eq('is_deleted', false)
      .gte('schedule_date', startDate)
      .lte('schedule_date', endDate)
      .order('schedule_date', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching daily shift schedules by date range:', error);
    throw error;
  }
}

// Save new daily shift schedules for date range
export async function saveDailyShiftSchedules(schedule: HrDailyShiftScheduleFormData): Promise<HrDailyShiftSchedule[]> {
  try {
    // Validate date range
    const fromDate = new Date(schedule.from_date);
    const toDate = new Date(schedule.to_date);
    
    if (fromDate > toDate) {
      throw new Error('From date cannot be after to date.');
    }

    // Get shift details to calculate total minutes
    const { data: shiftData, error: shiftError } = await supabase
      .from('hr_shift_master')
      .select('start_time, end_time')
      .eq('shift_id', schedule.shift_id)
      .single();

    if (shiftError) throw shiftError;
    if (!shiftData) throw new Error('Shift not found.');

    // Calculate total shift minutes
    const startTime = shiftData.start_time;
    const endTime = shiftData.end_time;
    
    if (!startTime || !endTime) {
      throw new Error('Shift start and end times are required.');
    }

    const startMinutes = parseInt(startTime.split(':')[0]) * 60 + parseInt(startTime.split(':')[1]);
    const endMinutes = parseInt(endTime.split(':')[0]) * 60 + parseInt(endTime.split(':')[1]);
    
    let totalMinutes = endMinutes - startMinutes;
    if (totalMinutes <= 0) {
      // Handle overnight shifts (end time is next day)
      totalMinutes = (24 * 60) + totalMinutes;
    }

    // Generate all dates in the range
    const dates = [];
    const currentDate = new Date(fromDate);
    while (currentDate <= toDate) {
      dates.push(new Date(currentDate));
      currentDate.setDate(currentDate.getDate() + 1);
    }

    // Check for existing schedules in the date range
    const { data: existing, error: checkError } = await supabase
      .from('hr_daily_shift_schedule')
      .select('schedule_date')
      .eq('shift_id', schedule.shift_id)
      .in('schedule_date', dates.map(d => d.toISOString().split('T')[0]))
      .eq('is_deleted', false);

    if (checkError) throw checkError;
    
    if (existing && existing.length > 0) {
      const existingDates = existing.map(e => e.schedule_date);
      throw new Error(`Schedules already exist for dates: ${existingDates.join(', ')}`);
    }

    const { getCurrentUsername, getCurrentTimestamp } = await import('$lib/utils/userUtils');
    const username = getCurrentUsername();
    const now = getCurrentTimestamp();

    // Prepare all schedules to insert
    const schedulesToInsert = dates.map(date => ({
      shift_id: schedule.shift_id,
      schedule_date: date.toISOString().split('T')[0],
      total_shift_minutes: totalMinutes,
      value_added_minutes: totalMinutes,
      non_value_added_minutes: 0,
      is_active: true,
      is_deleted: false,
      created_by: username,
      created_dt: now,
      // modified_by and modified_dt should equal created_by and created_dt on insert
      modified_by: username,
      modified_dt: now
    }));

    console.log('Inserting schedules for date range:', {
      shift_id: schedule.shift_id,
      from_date: schedule.from_date,
      to_date: schedule.to_date,
      total_schedules: schedulesToInsert.length
    });
    
    const { data, error } = await supabase
      .from('hr_daily_shift_schedule')
      .insert(schedulesToInsert)
      .select();

    if (error) {
      console.error('Insert error:', error);
      throw error;
    }
    
    console.log('Successfully created schedules:', data);
    return data || [];
  } catch (error) {
    console.error('Error saving daily shift schedules:', error);
    throw error;
  }
}

// Update daily shift schedule
export async function updateDailyShiftSchedule(schedule_id: number, schedule: Partial<HrDailyShiftSchedule>): Promise<void> {
  try {
    const { getCurrentUsername, getCurrentTimestamp } = await import('$lib/utils/userUtils');
    const username = getCurrentUsername();
    const now = getCurrentTimestamp();

    const updateData: any = {
      modified_by: username,
      modified_dt: now
      // created_by and created_dt should not be touched on update
    };

    if (schedule.shift_id !== undefined) {
      updateData.shift_id = schedule.shift_id;
    }
    if (schedule.schedule_date !== undefined) {
      updateData.schedule_date = schedule.schedule_date;
    }

    const { error } = await supabase
      .from('hr_daily_shift_schedule')
      .update(updateData)
      .eq('schedule_id', schedule_id);

    if (error) throw error;
  } catch (error) {
    console.error('Error updating daily shift schedule:', error);
    throw error;
  }
}

// Toggle active status
export async function toggleDailyShiftScheduleActive(schedule_id: number, isActive: boolean): Promise<void> {
  try {
    const { getCurrentUsername, getCurrentTimestamp } = await import('$lib/utils/userUtils');
    const username = getCurrentUsername();
    const now = getCurrentTimestamp();

    const { error } = await supabase
      .from('hr_daily_shift_schedule')
      .update({
        is_active: isActive,
        modified_by: username,
        modified_dt: now
        // created_by and created_dt should not be touched on update
      })
      .eq('schedule_id', schedule_id);

    if (error) throw error;
  } catch (error) {
    console.error('Error toggling daily shift schedule status:', error);
    throw error;
  }
}

// Soft delete daily shift schedule
export async function deleteDailyShiftSchedule(schedule_id: number): Promise<void> {
  try {
    const { getCurrentUsername, getCurrentTimestamp } = await import('$lib/utils/userUtils');
    const username = getCurrentUsername();
    const now = getCurrentTimestamp();

    const { error } = await supabase
      .from('hr_daily_shift_schedule')
      .update({
        is_deleted: true,
        is_active: false,
        modified_by: username,
        modified_dt: now
        // created_by and created_dt should not be touched on update
      })
      .eq('schedule_id', schedule_id);

    if (error) throw error;
  } catch (error) {
    console.error('Error deleting daily shift schedule:', error);
    throw error;
  }
} 