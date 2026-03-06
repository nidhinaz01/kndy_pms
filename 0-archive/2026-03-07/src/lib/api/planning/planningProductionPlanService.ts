import { supabase } from '$lib/supabaseClient';
import { getCurrentUsername, getCurrentTimestamp } from '$lib/utils/userUtils';
import type { ProductionPlan, ProductionPlanFormData, ProductionPlanStats } from './planningTypes';

export async function saveProductionPlan(plan: ProductionPlanFormData): Promise<ProductionPlan> {
  try {
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

    const maxCount = Math.max(...plan.pattern_data);
    const currentUser = getCurrentUsername();
    
    const { data: planData, error: planError } = await supabase
      .from('plan_prod_plan_per_day')
      .insert([{
        ppd_count: maxCount,
        production_rate: plan.production_rate,
        pattern_cycle: plan.pattern_cycle,
        pattern_data: plan.pattern_data,
        slot_configuration: plan.slot_configuration,
        dt_wef: plan.dt_wef,
        created_by: currentUser,
        created_dt: getCurrentTimestamp(),
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
    const { data: existingPlan, error: findError } = await supabase
      .from('plan_prod_plan_per_day')
      .select('id')
      .eq('dt_wef', dt_wef)
      .single();

    if (findError) {
      throw new Error(`No production plan found for ${dt_wef}`);
    }

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

/**
 * Get production plan statistics
 * Uses database function for efficient calculation
 */
export async function getProductionPlanStats(): Promise<ProductionPlanStats> {
  try {
    const { data, error } = await supabase.rpc('get_production_plan_stats');

    if (error) throw error;

    // Database function returns JSONB, which Supabase converts to object
    const result = data as {
      total: number;
      totalSlots: number;
      averageSlots: number;
    };

    return result;
  } catch (error) {
    console.error('Error getting production plan stats:', error);
    throw error;
  }
}

