import { supabase } from '$lib/supabaseClient';
import type { ShiftSchedule } from './productionTypes';

export async function fetchShiftSchedule(date: string): Promise<ShiftSchedule[]> {
  try {
    const { data, error } = await supabase
      .from('hr_daily_shift_schedule')
      .select(`
        schedule_id,
        schedule_date,
        shift_id,
        is_working_day,
        total_shift_minutes,
        value_added_minutes,
        non_value_added_minutes,
        notes,
        is_active
      `)
      .eq('schedule_date', date)
      .eq('is_deleted', false)
      .order('shift_id');

    if (error) {
      console.error('Error fetching shift schedule:', error);
      throw error;
    }

    return data || [];
  } catch (error) {
    console.error('Error in fetchShiftSchedule:', error);
    throw error;
  }
}

export async function fetchAvailableStages(): Promise<string[]> {
  try {
    const { data, error } = await supabase
      .from('sys_data_elements')
      .select('de_value')
      .eq('de_name', 'Plant-Stage')
      .eq('is_active', true)
      .eq('is_deleted', false)
      .order('de_value');

    if (error) {
      console.error('Error fetching stages:', error);
      throw error;
    }

    return data?.map(item => item.de_value) || [];
  } catch (error) {
    console.error('Error in fetchAvailableStages:', error);
    throw error;
  }
}

export async function fetchShiftDetails(shiftCode: string): Promise<{
  shift: {
    shift_id: number;
    shift_name: string;
    shift_code: string;
    start_time: string;
    end_time: string;
  } | null;
  breaks: Array<{
    break_id: number;
    break_number: number;
    break_name: string;
    start_time: string;
    end_time: string;
  }>;
}> {
  try {
    const { data: shiftData, error: shiftError } = await supabase
      .from('hr_shift_master')
      .select('*')
      .eq('shift_code', shiftCode)
      .eq('is_active', true)
      .eq('is_deleted', false)
      .single();

    if (shiftError) {
      console.error('Error fetching shift details:', shiftError);
      return { shift: null, breaks: [] };
    }

    const { data: breaksData, error: breaksError } = await supabase
      .from('hr_shift_break_master')
      .select('*')
      .eq('shift_id', shiftData.shift_id)
      .eq('is_active', true)
      .eq('is_deleted', false)
      .order('break_number');

    if (breaksError) {
      console.error('Error fetching break details:', breaksError);
      return { shift: shiftData, breaks: [] };
    }

    return {
      shift: shiftData,
      breaks: breaksData || []
    };
  } catch (error) {
    console.error('Error in fetchShiftDetails:', error);
    return { shift: null, breaks: [] };
  }
}

