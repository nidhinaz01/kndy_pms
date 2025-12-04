import { supabase } from '$lib/supabaseClient';

export interface ScheduleData {
  id: number;
  sales_order_id: number;
  stage_code: string | null;
  date_type: string;
  planned_date: string | null;
  actual_date: string | null;
  prdn_wo_details: {
    id: number;
    wo_no: string | null;
    pwo_no: string | null;
    wo_model: string;
    customer_name: string | null;
  };
}

/**
 * Load all plant stages
 */
export async function loadPlantStages(): Promise<string[]> {
  try {
    const { data, error } = await supabase
      .from('sys_data_elements')
      .select('de_value')
      .eq('de_name', 'Plant-Stage')
      .order('de_value');

    if (error) {
      console.error('Error loading plant stages:', error);
      return [];
    }

    return data?.map(item => item.de_value) || [];
  } catch (error) {
    console.error('Error in loadPlantStages:', error);
    return [];
  }
}

/**
 * Load schedule data from prdn_dates table filtered by date range
 */
export async function loadScheduleData(fromDate: string, toDate: string): Promise<ScheduleData[]> {
  try {
    // Convert dates to ISO format for comparison
    const fromDateISO = new Date(fromDate).toISOString().split('T')[0];
    const toDateISO = new Date(toDate + 'T23:59:59').toISOString();

    // Fetch all date records - we'll filter in-memory for accuracy
    // This ensures we catch records where either planned_date or actual_date falls in range
    const { data, error } = await supabase
      .from('prdn_dates')
      .select(`
        id,
        sales_order_id,
        stage_code,
        date_type,
        planned_date,
        actual_date,
        prdn_wo_details!inner(
          id,
          wo_no,
          pwo_no,
          wo_model,
          customer_name
        )
      `)
      .order('planned_date', { ascending: true });

    if (error) {
      console.error('Error loading schedule data:', error);
      throw error;
    }

    // Filter in-memory to ensure dates are within range
    const fromDateObj = new Date(fromDate);
    const toDateObj = new Date(toDate + 'T23:59:59');
    
    const filteredData = (data || []).filter((record) => {
      const plannedInRange = record.planned_date 
        ? new Date(record.planned_date) >= fromDateObj && new Date(record.planned_date) <= toDateObj
        : false;
      const actualInRange = record.actual_date
        ? new Date(record.actual_date) >= fromDateObj && new Date(record.actual_date) <= toDateObj
        : false;
      return plannedInRange || actualInRange;
    });

    return filteredData;
  } catch (error) {
    console.error('Error in loadScheduleData:', error);
    return [];
  }
}

