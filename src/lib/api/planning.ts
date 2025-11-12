import { supabase } from '$lib/supabaseClient';
import { getCurrentUsername, getCurrentTimestamp } from '$lib/utils/userUtils';

// ===== HOLIDAYS =====
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

export interface HolidayFormData {
  dt_day: number;
  dt_month: string;
  dt_year: number;
  dt_value: string | null;
  description: string;
  is_active: boolean;
}

export interface HolidayStats {
  total: number;
  active: number;
  inactive: number;
  byYear: Record<number, number>;
}

// ===== PRODUCTION PLANS PER DAY =====
export interface ProductionPlan {
  id: number;
  ppd_count: number;
  production_rate: number;
  pattern_cycle: number;
  pattern_data: number[];
  slot_configuration: SlotConfig[];
  dt_wef: string;
  created_by: string;
  created_dt: string;
}

export interface SlotConfig {
  day: number;
  slots: Array<{
    slot_order: number;
    entry_time: string;
  }>;
}

// Pattern calculation functions
export function calculatePattern(rate: number): { cycle: number; pattern: number[] } {
  if (rate <= 0) {
    return { cycle: 1, pattern: [0] };
  }

  // Handle simple cases
  if (rate === Math.floor(rate)) {
    return { cycle: 1, pattern: [rate] };
  }

  // Convert decimal to fraction approximation
  const precision = 100;
  const numerator = Math.round(rate * precision);
  const denominator = precision;
  
  // Find the simplest fraction
  const gcd = (a: number, b: number): number => b === 0 ? a : gcd(b, a % b);
  const divisor = gcd(numerator, denominator);
  const simplifiedNum = numerator / divisor;
  const simplifiedDen = denominator / divisor;

  // Generate pattern
  const pattern: number[] = [];
  for (let i = 0; i < simplifiedDen; i++) {
    pattern.push(Math.floor(simplifiedNum / simplifiedDen) + (i < simplifiedNum % simplifiedDen ? 1 : 0));
  }

  return { cycle: simplifiedDen, pattern };
}

export function validatePattern(pattern: number[], cycle: number): boolean {
  if (pattern.length !== cycle) return false;
  if (pattern.some(p => p < 0)) return false;
  return true;
}

export interface ProductionPlanFormData {
  production_rate: number;
  dt_wef: string;
  pattern_cycle: number;
  pattern_data: number[];
  slot_configuration: SlotConfig[];
}

export interface ProductionTime {
  id: number;
  plan_id: number;
  slot_order: number;
  entry_time: string;
}

export interface ProductionTimeFormData {
  slot_order: number;
  entry_time: string;
}

export interface ProductionPlanWithTimes extends ProductionPlan {
  times: ProductionTime[];
}

export interface ProductionPlanHistoryWithTimes extends ProductionPlan {
  his_id: number;
  times: ProductionTime[];
  end_date?: string;
}

export interface ProductionPlanStats {
  total: number;
  totalSlots: number;
  averageSlots: number;
}

// ===== WORK ORDER STAGE ORDERS =====
export interface WorkOrderStageOrder {
  id: number;
  wo_type_name: string;
  plant_stage: string;
  order_no: number;
  lead_time_hours: number;
  created_by: string;
  created_dt: string;
}

/**
 * Fetch all work order types
 */
export async function fetchWorkOrderTypes(): Promise<string[]> {
  try {
    const { data, error } = await supabase
      .from('mstr_wo_type')
      .select('wo_type_name')
      .eq('is_deleted', false)
      .order('wo_type_name');

    if (error) {
      console.error('Error fetching work order types:', error);
      throw error;
    }

    return data?.map(item => item.wo_type_name) || [];
  } catch (error) {
    console.error('Error in fetchWorkOrderTypes:', error);
    throw error;
  }
}

/**
 * Fetch all plant stages from data elements
 */
export async function fetchPlantStages(): Promise<string[]> {
  try {
    const { data, error } = await supabase
      .from('sys_data_elements')
      .select('de_value')
      .eq('de_name', 'Plant-Stage')
      .order('de_value', { ascending: true });

    if (error) {
      console.error('Error fetching plant stages:', error);
      throw error;
    }

    return data?.map(item => item.de_value) || [];
  } catch (error) {
    console.error('Error in fetchPlantStages:', error);
    throw error;
  }
}

export interface WorkOrderStageOrderFormData {
  wo_type_name: string;
  plant_stage: string;
  order_no: number;
  lead_time_hours: number;
}

export interface WorkOrderStageOrderStats {
  total: number;
  byType: Record<string, number>;
  byStage: Record<string, number>;
}

// ===== HOLIDAYS API =====
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
        // modified_by and modified_dt should equal created_by and created_dt on insert
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
        // created_by and created_dt should not be touched on update
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

export async function getHolidayStats(year?: number): Promise<HolidayStats> {
  try {
    let query = supabase
      .from('plan_holidays')
      .select('*')
      .eq('is_deleted', false);
    
    if (year) {
      query = query.eq('dt_year', year);
    }
    
    const { data, error } = await query;

    if (error) throw error;

    const holidays = data || [];
    const stats: HolidayStats = {
      total: holidays.length,
      active: holidays.filter(h => h.is_active).length,
      inactive: holidays.filter(h => !h.is_active).length,
      byYear: {}
    };

    holidays.forEach(holiday => {
      const year = holiday.dt_year;
      stats.byYear[year] = (stats.byYear[year] || 0) + 1;
    });

    return stats;
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
    
    // Find next Sunday
    while (current.getDay() !== 0) {
      current.setDate(current.getDate() + 1);
    }
    
    // Add all Sundays for the next year
    while (current <= endDate) {
      const monthNames = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
      ];
      
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
    
    // Insert all Sundays
    const { error } = await supabase
      .from('plan_holidays')
      .insert(sundays.map(holiday => ({
        ...holiday,
        created_by: getCurrentUsername(),
        created_dt: getCurrentTimestamp(),
        // modified_by and modified_dt should equal created_by and created_dt on insert
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
        // modified_by and modified_dt should equal created_by and created_dt on insert
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

// ===== PRODUCTION PLANS API =====
export async function fetchProductionPlans(): Promise<ProductionPlan[]> {
  try {
    const { data, error } = await supabase
      .from('plan_prod_plan_per_day')
      .select('*')
      .order('dt_wef', { ascending: true });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching production plans:', error);
    throw error;
  }
}

export async function fetchProductionPlanWithTimes(planId: number): Promise<ProductionPlanWithTimes | null> {
  try {
    const { data: plan, error: planError } = await supabase
      .from('plan_prod_plan_per_day')
      .select('*')
      .eq('id', planId)
      .single();

    if (planError) throw planError;

    // Extract times from slot_configuration JSONB
    const times: ProductionTime[] = [];
    if (plan.slot_configuration && Array.isArray(plan.slot_configuration)) {
      let globalSlotOrder = 1;
      plan.slot_configuration.forEach((dayConfig: any) => {
        if (dayConfig.slots && Array.isArray(dayConfig.slots)) {
          dayConfig.slots.forEach((slot: any) => {
            times.push({
              id: globalSlotOrder, // Use slot order as ID since we don't have separate table
              plan_id: plan.id,
              slot_order: globalSlotOrder,
              entry_time: slot.entry_time
            });
            globalSlotOrder++;
          });
        }
      });
    }

    return {
      ...plan,
      times: times
    };
  } catch (error) {
    console.error('Error fetching production plan with times:', error);
    throw error;
  }
}

/**
 * Fetch the current active production plan with times
 */
export async function fetchCurrentProductionPlanWithTimes(): Promise<ProductionPlanWithTimes | null> {
  try {
    const today = new Date().toISOString().split('T')[0];
    
    // Find the plan that is currently active (dt_wef <= today, most recent)
    const { data: plan, error: planError } = await supabase
      .from('plan_prod_plan_per_day')
      .select('*')
      .lte('dt_wef', today)
      .order('dt_wef', { ascending: false })
      .limit(1)
      .single();

    if (planError) {
      if (planError.code === 'PGRST116') {
        return null;
      }
      throw planError;
    }

    // Extract times from slot_configuration JSONB
    const times: ProductionTime[] = [];
    if (plan.slot_configuration && Array.isArray(plan.slot_configuration)) {
      let globalSlotOrder = 1;
      plan.slot_configuration.forEach((dayConfig: any) => {
        if (dayConfig.slots && Array.isArray(dayConfig.slots)) {
          dayConfig.slots.forEach((slot: any) => {
            times.push({
              id: globalSlotOrder, // Use slot order as ID since we don't have separate table
              plan_id: plan.id,
              slot_order: globalSlotOrder,
              entry_time: slot.entry_time
            });
            globalSlotOrder++;
          });
        }
      });
    }

    return {
      ...plan,
      times: times
    };
  } catch (error) {
    console.error('Error fetching current production plan with times:', error);
    throw error;
  }
}

/**
 * Fetch all production plans as history with effective periods
 */
export async function fetchProductionPlanHistory(): Promise<ProductionPlanHistoryWithTimes[]> {
  try {
    const { data: plans, error: plansError } = await supabase
      .from('plan_prod_plan_per_day')
      .select('*')
      .order('dt_wef', { ascending: false });

    if (plansError) {
      throw plansError;
    }

    if (!plans || plans.length === 0) {
      return [];
    }

    // Process each plan and extract times from JSONB
    const plansWithTimes: ProductionPlanHistoryWithTimes[] = [];
    
    for (let i = 0; i < plans.length; i++) {
      const plan = plans[i];
      
      // Extract times from slot_configuration JSONB
      const times: ProductionTime[] = [];
      if (plan.slot_configuration && Array.isArray(plan.slot_configuration)) {
        let globalSlotOrder = 1;
        plan.slot_configuration.forEach((dayConfig: any) => {
          if (dayConfig.slots && Array.isArray(dayConfig.slots)) {
            dayConfig.slots.forEach((slot: any) => {
              times.push({
                id: globalSlotOrder, // Use slot order as ID since we don't have separate table
                plan_id: plan.id,
                slot_order: globalSlotOrder,
                entry_time: slot.entry_time
              });
              globalSlotOrder++;
            });
          }
        });
      }

      // Calculate end date: next plan's start date - 1 day, or null if it's the latest
      let endDate: string | undefined;
      if (i < plans.length - 1) {
        const nextPlan = plans[i + 1];
        const nextDate = new Date(nextPlan.dt_wef);
        nextDate.setDate(nextDate.getDate() - 1);
        endDate = nextDate.toISOString().split('T')[0];
      }

      plansWithTimes.push({
        ...plan,
        his_id: plan.id, // Use the main table ID as history ID
        times: times,
        end_date: endDate
      } as ProductionPlanHistoryWithTimes);
    }

    return plansWithTimes;
  } catch (error) {
    console.error('Error fetching production plan history:', error);
    throw error;
  }
}

export async function saveProductionPlan(plan: ProductionPlanFormData): Promise<ProductionPlan> {
  try {
    // Check if a plan already exists for this effective date
    const { data: existingPlan, error: checkError } = await supabase
      .from('plan_prod_plan_per_day')
      .select('id, dt_wef, production_rate')
      .eq('dt_wef', plan.dt_wef)
      .single();

    if (checkError && checkError.code !== 'PGRST116') {
      throw checkError;
    }

    if (existingPlan) {
      throw new Error(`A production plan already exists for ${plan.dt_wef}. Please choose a different effective date or update the existing plan.`);
    }

    // Calculate max count from pattern for legacy compatibility
    const maxCount = Math.max(...plan.pattern_data);
    
    // Get current user for debugging
    const currentUser = getCurrentUsername();
    console.log('Saving production plan with user:', currentUser);
    
    // Create the production plan with all data in the main table
    const { data: planData, error: planError } = await supabase
      .from('plan_prod_plan_per_day')
      .insert([{
        ppd_count: maxCount, // Legacy field for backward compatibility
        production_rate: plan.production_rate,
        pattern_cycle: plan.pattern_cycle,
        pattern_data: plan.pattern_data,
        slot_configuration: plan.slot_configuration,
        dt_wef: plan.dt_wef,
        created_by: currentUser,
        created_dt: getCurrentTimestamp(),
        // modified_by and modified_dt should equal created_by and created_dt on insert
        modified_by: currentUser,
        modified_dt: getCurrentTimestamp()
      }])
      .select()
      .single();

    if (planError) throw planError;

    return planData;
  } catch (error) {
    console.error('Error saving production plan:', error);
    throw error;
  }
}

export async function updateProductionPlan(id: number, plan: Partial<ProductionPlanFormData>): Promise<ProductionPlan> {
  try {
    // Calculate max count from pattern for legacy compatibility if pattern_data is provided
    let updateData: any = { ...plan };
    if (plan.pattern_data) {
      const maxCount = Math.max(...plan.pattern_data);
      updateData.ppd_count = maxCount;
    }

    const { data, error } = await supabase
      .from('plan_prod_plan_per_day')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error updating production plan:', error);
    throw error;
  }
}

export async function updateProductionPlanByDate(dt_wef: string, plan: ProductionPlanFormData): Promise<ProductionPlan> {
  try {
    // Find the plan with the given effective date
    const { data: existingPlan, error: findError } = await supabase
      .from('plan_prod_plan_per_day')
      .select('id')
      .eq('dt_wef', dt_wef)
      .single();

    if (findError) {
      throw new Error(`No production plan found for ${dt_wef}`);
    }

    // Update the existing plan
    return await updateProductionPlan(existingPlan.id, plan);
  } catch (error) {
    console.error('Error updating production plan by date:', error);
    throw error;
  }
}

export async function deleteProductionPlan(id: number): Promise<void> {
  try {
    const { error } = await supabase
      .from('plan_prod_plan_per_day')
      .delete()
      .eq('id', id);

    if (error) throw error;
  } catch (error) {
    console.error('Error deleting production plan:', error);
    throw error;
  }
}

export async function getProductionPlanStats(): Promise<ProductionPlanStats> {
  try {
    const { data: plans, error: plansError } = await supabase
      .from('plan_prod_plan_per_day')
      .select('*');

    if (plansError) throw plansError;

    const { data: times, error: timesError } = await supabase
      .from('plan_prod_times')
      .select('*');

    if (timesError) throw timesError;

    const totalSlots = times?.length || 0;
    const averageSlots = plans?.length ? totalSlots / plans.length : 0;

    return {
      total: plans?.length || 0,
      totalSlots,
      averageSlots: Math.round(averageSlots * 100) / 100
    };
  } catch (error) {
    console.error('Error getting production plan stats:', error);
    throw error;
  }
}

// ===== WORK ORDER STAGE ORDERS API =====
export async function fetchWorkOrderStageOrders(): Promise<WorkOrderStageOrder[]> {
  try {
    const { data, error } = await supabase
      .from('plan_wo_stage_order')
      .select('*')
      .order('wo_type_name', { ascending: true })
      .order('order_no', { ascending: true });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching work order stage orders:', error);
    throw error;
  }
}

export async function saveWorkOrderStageOrder(order: WorkOrderStageOrderFormData): Promise<WorkOrderStageOrder> {
  try {
    const { data, error } = await supabase
      .from('plan_wo_stage_order')
      .insert([{
        ...order,
        created_by: getCurrentUsername(),
        created_dt: getCurrentTimestamp(),
        // modified_by and modified_dt should equal created_by and created_dt on insert
        modified_by: getCurrentUsername(),
        modified_dt: getCurrentTimestamp()
      }])
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error saving work order stage order:', error);
    throw error;
  }
}

export async function updateWorkOrderStageOrder(id: number, order: Partial<WorkOrderStageOrderFormData>): Promise<WorkOrderStageOrder> {
  try {
    const { data, error } = await supabase
      .from('plan_wo_stage_order')
      .update(order)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error updating work order stage order:', error);
    throw error;
  }
}

export async function deleteWorkOrderStageOrder(id: number): Promise<void> {
  try {
    const { error } = await supabase
      .from('plan_wo_stage_order')
      .delete()
      .eq('id', id);

    if (error) throw error;
  } catch (error) {
    console.error('Error deleting work order stage order:', error);
    throw error;
  }
}

export async function getWorkOrderStageOrderStats(): Promise<WorkOrderStageOrderStats> {
  try {
    const { data, error } = await supabase
      .from('plan_wo_stage_order')
      .select('*');

    if (error) throw error;

    const orders = data || [];
    const stats: WorkOrderStageOrderStats = {
      total: orders.length,
      byType: {},
      byStage: {}
    };

    orders.forEach(order => {
      stats.byType[order.wo_type_name] = (stats.byType[order.wo_type_name] || 0) + 1;
      stats.byStage[order.plant_stage] = (stats.byStage[order.plant_stage] || 0) + 1;
    });

    return stats;
  } catch (error) {
    console.error('Error getting work order stage order stats:', error);
    throw error;
  }
} 