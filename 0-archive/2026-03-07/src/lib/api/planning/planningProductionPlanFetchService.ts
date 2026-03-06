import { supabase } from '$lib/supabaseClient';
import type { ProductionPlan, ProductionPlanWithTimes, ProductionPlanHistoryWithTimes, ProductionTime } from './planningTypes';

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

    const times: ProductionTime[] = extractTimesFromPlan(plan);
    return { ...plan, times };
  } catch (error) {
    console.error('Error fetching production plan with times:', error);
    throw error;
  }
}

export async function fetchCurrentProductionPlanWithTimes(): Promise<ProductionPlanWithTimes | null> {
  try {
    const today = new Date().toISOString().split('T')[0];
    
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

    const times: ProductionTime[] = extractTimesFromPlan(plan);
    return { ...plan, times };
  } catch (error) {
    console.error('Error fetching current production plan with times:', error);
    throw error;
  }
}

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

    const plansWithTimes: ProductionPlanHistoryWithTimes[] = [];
    
    for (let i = 0; i < plans.length; i++) {
      const plan = plans[i];
      const times: ProductionTime[] = extractTimesFromPlan(plan);

      let endDate: string | undefined;
      if (i < plans.length - 1) {
        const nextPlan = plans[i + 1];
        const nextDate = new Date(nextPlan.dt_wef);
        nextDate.setDate(nextDate.getDate() - 1);
        endDate = nextDate.toISOString().split('T')[0];
      }

      plansWithTimes.push({
        ...plan,
        his_id: plan.id,
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

function extractTimesFromPlan(plan: any): ProductionTime[] {
  const times: ProductionTime[] = [];
  if (plan.slot_configuration && Array.isArray(plan.slot_configuration)) {
    let globalSlotOrder = 1;
    plan.slot_configuration.forEach((dayConfig: any) => {
      if (dayConfig.slots && Array.isArray(dayConfig.slots)) {
        dayConfig.slots.forEach((slot: any) => {
          times.push({
            id: globalSlotOrder,
            plan_id: plan.id,
            slot_order: globalSlotOrder,
            entry_time: slot.entry_time
          });
          globalSlotOrder++;
        });
      }
    });
  }
  return times;
}

