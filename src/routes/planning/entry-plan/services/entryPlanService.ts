import { supabase } from '$lib/supabaseClient';

export async function loadWorkOrders() {
  try {
    const { data, error } = await supabase
      .from('prdn_wo_details')
      .select('*')
      .order('wo_date', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error loading work orders:', error);
    return [];
  }
}

export async function loadProductionDates() {
  try {
    const { data, error } = await supabase
      .from('prdn_dates')
      .select('*')
      .order('planned_date', { ascending: true });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error loading production dates:', error);
    return [];
  }
}

export async function loadPlantStages() {
  try {
    const { data, error } = await supabase
      .from('sys_data_elements')
      .select('de_value')
      .eq('de_name', 'Plant-Stage')
      .order('de_value');

    if (error) throw error;
    return data?.map(item => item.de_value) || [];
  } catch (error) {
    console.error('Error loading plant stages:', error);
    return [];
  }
}

export async function loadHolidays() {
  try {
    const { data, error } = await supabase
      .from('plan_holidays')
      .select('dt_value')
      .order('dt_value');

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error loading holidays:', error);
    return [];
  }
}

