import { supabase } from '$lib/supabaseClient';

export interface ProductionPlanFormData {
  from_date: string;
  to_date: string;
  ppd_count: number;
  production_rate: number;
  pattern_cycle: number;
  shift_distribution: ShiftDistribution[];
  entry_slots: any; // JSONB object containing pattern data
}

export interface PatternTimeSlot {
  day: number;
  vehicles: number;
  slots: Array<{
    slot_order: number;
    entry_time: string;
  }>;
}

export interface ShiftDistribution {
  shift_id: number;
  target_quantity: number;
}

export interface EntrySlot {
  shift_id: number;
  slots: Slot[];
}

export interface Slot {
  entry_time: string;
  slot_order: number;
}

// Validate shifts across date range
export async function validateShiftsForDateRange(fromDate: string, toDate: string): Promise<{
  isValid: boolean;
  shifts: any[];
  error?: string;
}> {
  try {
    // Get all dates in the range
    const dates = [];
    const currentDate = new Date(fromDate);
    const endDate = new Date(toDate);
    
    while (currentDate <= endDate) {
      dates.push(currentDate.toISOString().split('T')[0]);
      currentDate.setDate(currentDate.getDate() + 1);
    }

    // Get shift schedules for all dates
    const { data: schedules, error } = await supabase
      .from('hr_daily_shift_schedule')
      .select(`
        schedule_date,
        shift_id,
        hr_shift_master!inner(shift_name, shift_code, start_time, end_time)
      `)
      .in('schedule_date', dates)
      .eq('is_deleted', false)
      .eq('is_active', true)
      .order('schedule_date, shift_id');

    if (error) throw error;

    // Group by date to check consistency
    const schedulesByDate: Record<string, any[]> = schedules.reduce((acc, schedule) => {
      if (!acc[schedule.schedule_date]) {
        acc[schedule.schedule_date] = [];
      }
      acc[schedule.schedule_date].push(schedule);
      return acc;
    }, {} as Record<string, any[]>);

    // Check if all dates have schedules
    const missingDates = dates.filter(date => !schedulesByDate[date]);
    if (missingDates.length > 0) {
      return {
        isValid: false,
        shifts: [],
        error: `No shift schedules found for dates: ${missingDates.join(', ')}`
      };
    }

    // Check if shifts are consistent across all dates
    const firstDateShifts = schedulesByDate[dates[0]].map(s => s.shift_id).sort();
    const inconsistentDates = dates.filter(date => {
      const dateShifts = schedulesByDate[date].map(s => s.shift_id).sort();
      return JSON.stringify(dateShifts) !== JSON.stringify(firstDateShifts);
    });

    if (inconsistentDates.length > 0) {
      return {
        isValid: false,
        shifts: [],
        error: `Inconsistent shifts found for dates: ${inconsistentDates.join(', ')}. All dates must have the same shifts.`
      };
    }

    // Get unique shifts (they should be the same across all dates)
    const uniqueShifts = schedulesByDate[dates[0]];

    return {
      isValid: true,
      shifts: uniqueShifts
    };
  } catch (error) {
    console.error('Error validating shifts:', error);
    return {
      isValid: false,
      shifts: [],
      error: 'Failed to validate shifts. Please try again.'
    };
  }
}

// Calculate shift distribution based on daily target
export function calculateShiftDistribution(dailyTarget: number, shifts: any[]): ShiftDistribution[] {
  const shiftCount = shifts.length;
  const baseTarget = dailyTarget / shiftCount;
  
  return shifts.map(shift => ({
    shift_id: shift.shift_id,
    target_quantity: baseTarget
  }));
}

// Generate default entry slots for shifts
export function generateDefaultEntrySlots(shifts: any[]): EntrySlot[] {
  return shifts.map(shift => ({
    shift_id: shift.shift_id,
    slots: [
      {
        entry_time: shift.hr_shift_master.start_time,
        slot_order: 1
      },
      {
        entry_time: shift.hr_shift_master.end_time,
        slot_order: 2
      }
    ]
  }));
}

// Save production plan
export async function saveProductionPlan(planData: ProductionPlanFormData): Promise<any> {
  try {
    // Check if there's already an active plan
    const existingActivePlan = await getCurrentActivePlan();
    if (existingActivePlan) {
      throw new Error(`Cannot create a new production plan while plan ID ${existingActivePlan.id} (${existingActivePlan.from_date} to ${existingActivePlan.to_date}) is active. Please deactivate the current plan first or create the new plan as inactive.`);
    }

    // Validate shifts first
    const validation = await validateShiftsForDateRange(planData.from_date, planData.to_date);
    if (!validation.isValid) {
      throw new Error(validation.error);
    }

    // Get current username (throws error if not found)
    const { getCurrentUsername, getCurrentTimestamp } = await import('$lib/utils/userUtils');
    const username = getCurrentUsername();
    const now = getCurrentTimestamp();

    // Create slot configuration JSONB
    const slotConfiguration = {
      shifts: planData.shift_distribution,
      entry_slots: planData.entry_slots
    };

    // Create the production plan
    const insertData = {
      from_date: planData.from_date,
      to_date: planData.to_date,
      ppd_count: planData.ppd_count,
      production_rate: planData.production_rate,
      pattern_cycle: planData.pattern_cycle,
      shift_distribution: planData.shift_distribution,
      entry_slots: planData.entry_slots,
      created_by: username,
      created_dt: now,
      // modified_by and modified_dt should equal created_by and created_dt on insert
      modified_by: username,
      modified_dt: now
    };
    
    console.log('Inserting with created_by:', username);
    
    const { data, error } = await supabase
      .from('plan_prod_plan_per_shift')
      .insert([insertData])
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error saving production plan:', error);
    throw error;
  }
}



// Fetch production plans
export async function fetchProductionPlans(): Promise<any[]> {
  try {
    console.log('Fetching production plans...');
    
    // Fetch ALL plans (both active and inactive) - no date filtering
    const { data, error } = await supabase
      .from('plan_prod_plan_per_shift')
      .select('*')
      .eq('is_deleted', false) // Only show non-deleted plans
      .order('from_date', { ascending: false });

    if (error) {
      console.error('Supabase error:', error);
      throw error;
    }
    
    console.log('All production plans:', data);
    return data || [];
  } catch (error) {
    console.error('Error fetching production plans:', error);
    throw error;
  }
}

// Check if there's an active plan for a specific date
export async function getActivePlanForDate(targetDate: string): Promise<any | null> {
  try {
    const { data, error } = await supabase
      .from('plan_prod_plan_per_shift')
      .select('*')
      .lte('from_date', targetDate)
      .gte('to_date', targetDate)
      .eq('is_active', true)
      .eq('is_deleted', false)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 is "no rows returned"
      console.error('Supabase error:', error);
      throw error;
    }
    
    return data || null;
  } catch (error) {
    console.error('Error checking active plan for date:', error);
    return null;
  }
}

// Get the currently active plan (only one can be active at a time)
export async function getCurrentActivePlan(): Promise<any | null> {
  try {
    const { data, error } = await supabase
      .from('plan_prod_plan_per_shift')
      .select('*')
      .eq('is_active', true)
      .eq('is_deleted', false)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 is "no rows returned"
      console.error('Supabase error:', error);
      throw error;
    }
    
    return data || null;
  } catch (error) {
    console.error('Error getting current active plan:', error);
    return null;
  }
}

// Update plan status (active/inactive)
export async function updatePlanStatus(planId: number, isActive: boolean): Promise<any> {
  try {
    // Get current user
    const { data: userData } = await supabase.auth.getUser();
    const userEmail = userData?.user?.email;
    
    // Get username from app_users table
    let username = 'system';
    if (userEmail) {
      console.log('Looking up username for email:', userEmail);
      const { data: appUser, error: userError } = await supabase
        .from('app_users')
        .select('username')
        .eq('email', userEmail)
        .single();
      
      if (userError) {
        console.error('Error looking up user:', userError);
      }
      
      if (appUser) {
        username = appUser.username;
        console.log('Found username:', username);
      } else {
        console.log('No user found for email:', userEmail);
      }
    }
    
    const now = new Date().toISOString();

    // If activating this plan, deactivate all other plans first
    if (isActive) {
      const { error: deactivateError } = await supabase
        .from('plan_prod_plan_per_shift')
        .update({ 
          is_active: false, 
          modified_by: username, 
          modified_dt: now 
        })
        .neq('id', planId)
        .eq('is_deleted', false);

      if (deactivateError) {
        console.error('Error deactivating other plans:', deactivateError);
        throw deactivateError;
      }
    }

    // Update the plan status
    const { data, error } = await supabase
      .from('plan_prod_plan_per_shift')
      .update({ 
        is_active: isActive, 
        modified_by: username, 
        modified_dt: now
        // created_by and created_dt should not be touched on update
      })
      .eq('id', planId)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error updating plan status:', error);
    throw error;
  }
}

// Soft delete production plan
export async function softDeleteProductionPlan(planId: number): Promise<any> {
  try {
    // Get current username (throws error if not found)
    const { getCurrentUsername, getCurrentTimestamp } = await import('$lib/utils/userUtils');
    const username = getCurrentUsername();
    const now = getCurrentTimestamp();

    // Soft delete the plan
    const { data, error } = await supabase
      .from('plan_prod_plan_per_shift')
      .update({ 
        is_deleted: true, 
        modified_by: username, 
        modified_dt: now
        // created_by and created_dt should not be touched on update
      })
      .eq('id', planId)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error soft deleting production plan:', error);
    throw error;
  }
} 