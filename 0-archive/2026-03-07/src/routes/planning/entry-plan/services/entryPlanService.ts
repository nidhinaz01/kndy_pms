import { supabase } from '$lib/supabaseClient';

const WO_PAGE_SIZE = 1000;

export async function loadWorkOrders() {
  try {
    const allRows: unknown[] = [];
    let offset = 0;
    let hasMore = true;
    while (hasMore) {
      const { data, error } = await supabase
        .from('prdn_wo_details')
        .select('*')
        .order('wo_date', { ascending: false })
        .range(offset, offset + WO_PAGE_SIZE - 1);

      if (error) throw error;
      const page = data || [];
      allRows.push(...page);
      hasMore = page.length === WO_PAGE_SIZE;
      offset += WO_PAGE_SIZE;
    }
    return allRows;
  } catch (error) {
    console.error('Error loading work orders:', error);
    return [];
  }
}

const PRDN_DATES_PAGE_SIZE = 1000;

export async function loadProductionDates() {
  try {
    const allRows: unknown[] = [];
    let offset = 0;
    let hasMore = true;

    while (hasMore) {
      const { data, error } = await supabase
        .from('prdn_dates')
        .select('*')
        .order('planned_date', { ascending: true })
        .range(offset, offset + PRDN_DATES_PAGE_SIZE - 1);

      if (error) throw error;
      const page = data || [];
      allRows.push(...page);
      hasMore = page.length === PRDN_DATES_PAGE_SIZE;
      offset += PRDN_DATES_PAGE_SIZE;
    }

    return allRows;
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
    const allRows: unknown[] = [];
    let offset = 0;
    const pageSize = 1000;
    let hasMore = true;
    while (hasMore) {
      const { data, error } = await supabase
        .from('plan_holidays')
        .select('dt_value')
        .order('dt_value')
        .range(offset, offset + pageSize - 1);

      if (error) throw error;
      const page = data || [];
      allRows.push(...page);
      hasMore = page.length === pageSize;
      offset += pageSize;
    }
    return allRows;
  } catch (error) {
    console.error('Error loading holidays:', error);
    return [];
  }
}

