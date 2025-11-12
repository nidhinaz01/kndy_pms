import { supabase } from '$lib/supabaseClient';
import { sanitizeObject } from '$lib/utils/inputSanitization';

// Types for daily production planning
export interface ProductionPlanPerDay {
  id: number;
  ppd_count: number;
  dt_wef: string;
  created_by: string;
  created_dt: string;
}

export interface ProductionTime {
  id: number;
  plan_id: number;
  slot_order: number;
  entry_time: string;
}

export interface ProductionPlanWithTimes {
  plan: ProductionPlanPerDay;
  times: ProductionTime[];
}

// Types for history data
export interface ProductionPlanHistory {
  his_id: number;
  id: number;
  ppd_count: number;
  dt_wef: string;
  created_by: string;
  created_dt: string;
}

export interface ProductionTimeHistory {
  his_id: number;
  id: number;
  plan_id: number;
  slot_order: number;
  entry_time: string;
}

export interface ProductionPlanHistoryWithTimes {
  plan: ProductionPlanHistory;
  times: ProductionTimeHistory[];
}

/**
 * Fetch the latest production plan per day
 */
export async function fetchLatestProductionPlan(): Promise<ProductionPlanPerDay | null> {
  try {
    const { data, error } = await supabase
      .from('plan_prod_plan_per_day')
      .select('*')
      .order('dt_wef', { ascending: false })
      .limit(1)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No records found
        return null;
      }
      console.error('Error fetching latest production plan:', error);
      throw error;
    }

    return data;
  } catch (error) {
    console.error('Error in fetchLatestProductionPlan:', error);
    throw error;
  }
}

/**
 * Fetch production times for a specific plan
 */
export async function fetchProductionTimes(planId: number): Promise<ProductionTime[]> {
  try {
    const { data, error } = await supabase
      .from('plan_prod_times')
      .select('*')
      .eq('plan_id', planId)
      .order('slot_order', { ascending: true });

    if (error) {
      console.error('Error fetching production times:', error);
      throw error;
    }

    return data || [];
  } catch (error) {
    console.error('Error in fetchProductionTimes:', error);
    throw error;
  }
}

/**
 * Fetch the latest production plan with its times
 */
export async function fetchLatestProductionPlanWithTimes(): Promise<ProductionPlanWithTimes | null> {
  try {
    const plan = await fetchLatestProductionPlan();
    if (!plan) {
      return null;
    }

    const times = await fetchProductionTimes(plan.id);
    return { plan, times };
  } catch (error) {
    console.error('Error in fetchLatestProductionPlanWithTimes:', error);
    throw error;
  }
}

/**
 * Fetch production plan history from history tables
 */
export async function fetchProductionPlanHistory(): Promise<ProductionPlanHistoryWithTimes[]> {
  try {
    // Fetch last 10 plans from history table
    const { data: plans, error: plansError } = await supabase
      .from('plan_prod_plan_per_day_his')
      .select('*')
      .order('dt_wef', { ascending: false })
      .limit(10);

    if (plansError) {
      console.error('Error fetching production plan history:', plansError);
      throw plansError;
    }

    if (!plans || plans.length === 0) {
      return [];
    }

    // Fetch times for each plan from history table
    const plansWithTimes: ProductionPlanHistoryWithTimes[] = [];
    for (const plan of plans) {
      const { data: times, error: timesError } = await supabase
        .from('plan_prod_times_his')
        .select('*')
        .eq('plan_id', plan.id)
        .order('slot_order', { ascending: true });

      if (timesError) {
        console.error('Error fetching production times history:', timesError);
        throw timesError;
      }

      plansWithTimes.push({ 
        plan, 
        times: times || [] 
      });
    }

    return plansWithTimes;
  } catch (error) {
    console.error('Error in fetchProductionPlanHistory:', error);
    throw error;
  }
}

/**
 * Create a new production plan per day
 */
export async function createProductionPlan(
  ppdCount: number,
  dtWef: string,
  createdBy: string
): Promise<number> {
  try {
    const sanitizedData = sanitizeObject({
      ppd_count: ppdCount,
      dt_wef: dtWef,
      created_by: createdBy
    });

    const { data, error } = await supabase
      .from('plan_prod_plan_per_day')
      .insert([sanitizedData])
      .select('id')
      .single();

    if (error) {
      console.error('Error creating production plan:', error);
      throw error;
    }

    return data.id;
  } catch (error) {
    console.error('Error in createProductionPlan:', error);
    throw error;
  }
}

/**
 * Create production time entries
 */
export async function createProductionTimes(
  planId: number,
  times: Array<{ slot_order: number; entry_time: string }>
): Promise<void> {
  try {
    const sanitizedTimes = times.map(time => sanitizeObject({
      plan_id: planId,
      slot_order: time.slot_order,
      entry_time: time.entry_time
    }));

    const { error } = await supabase
      .from('plan_prod_times')
      .insert(sanitizedTimes);

    if (error) {
      console.error('Error creating production times:', error);
      throw error;
    }
  } catch (error) {
    console.error('Error in createProductionTimes:', error);
    throw error;
  }
}

/**
 * Update an existing production plan's count and times
 */
export async function updateExistingProductionPlan(
  planId: number,
  newPpdCount: number,
  newTimes: Array<{ slot_order: number; entry_time: string }>
): Promise<void> {
  try {
    // Update the plan count
    const { error: updateError } = await supabase
      .from('plan_prod_plan_per_day')
      .update({ ppd_count: newPpdCount })
      .eq('id', planId);

    if (updateError) {
      console.error('Error updating production plan count:', updateError);
      throw updateError;
    }

    // Delete existing times
    const { error: deleteError } = await supabase
      .from('plan_prod_times')
      .delete()
      .eq('plan_id', planId);

    if (deleteError) {
      console.error('Error deleting existing production times:', deleteError);
      throw deleteError;
    }

    // Create new times
    await createProductionTimes(planId, newTimes);
  } catch (error) {
    console.error('Error in updateExistingProductionPlan:', error);
    throw error;
  }
}

/**
 * Update production plan and times
 * This updates the existing plan if it's from today, otherwise creates a new plan
 */
export async function updateProductionPlan(
  currentPlan: ProductionPlanPerDay | null,
  newPpdCount: number,
  newTimes: Array<{ slot_order: number; entry_time: string }>,
  createdBy: string
): Promise<void> {
  try {
    // If no current plan, create new plan
    if (!currentPlan) {
      const today = new Date().toISOString().split('T')[0];
      const newPlanId = await createProductionPlan(newPpdCount, today, createdBy);
      await createProductionTimes(newPlanId, newTimes);
      return;
    }

    const today = new Date().toISOString().split('T')[0];
    const isCurrentPlanFromToday = currentPlan.dt_wef === today;

    // If the current plan is from today, update it regardless of count change
    if (isCurrentPlanFromToday) {
      await updateExistingProductionPlan(currentPlan.id, newPpdCount, newTimes);
    } else {
      // If the current plan is from a different date, create a new plan for today
      const newPlanId = await createProductionPlan(newPpdCount, today, createdBy);
      await createProductionTimes(newPlanId, newTimes);
    }
  } catch (error) {
    console.error('Error in updateProductionPlan:', error);
    throw error;
  }
} 