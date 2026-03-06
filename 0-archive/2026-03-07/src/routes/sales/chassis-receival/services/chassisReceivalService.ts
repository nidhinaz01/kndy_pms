import { supabase } from '$lib/supabaseClient';

const PAGE_SIZE = 1000;

async function fetchAllPages<T>(
  table: string,
  select: string,
  orderBy: { column: string; ascending: boolean },
  extraFilters?: (q: ReturnType<typeof supabase.from>) => ReturnType<typeof supabase.from>
): Promise<T[]> {
  const allRows: T[] = [];
  let offset = 0;
  let hasMore = true;
  while (hasMore) {
    let query = supabase
      .from(table)
      .select(select)
      .order(orderBy.column, { ascending: orderBy.ascending });
    if (extraFilters) query = extraFilters(query);
    query = query.range(offset, offset + PAGE_SIZE - 1);
    const { data, error } = await query;
    if (error) throw error;
    const page = data || [];
    allRows.push(...(page as T[]));
    hasMore = page.length === PAGE_SIZE;
    offset += PAGE_SIZE;
  }
  return allRows;
}

export interface WorkOrderWithChassisArrival {
  id: string;
  wo_no: string;
  pwo_no?: string;
  wo_type?: string;
  wo_model?: string;
  wo_chassis?: string;
  wheel_base?: string;
  customer_name?: string;
  chassisArrival?: any;
  chassisArrivalDate?: string;
  hasOngoingInspection?: boolean;
}

export async function loadWorkOrders(): Promise<WorkOrderWithChassisArrival[]> {
  try {
    // Load all work orders (paginated to avoid 1000-row limit)
    const woData = await fetchAllPages<Record<string, unknown>>(
      'prdn_wo_details',
      '*',
      { column: 'wo_date', ascending: false }
    );

    // Load all production dates (paginated to avoid 1000-row limit)
    const datesData = await fetchAllPages<Record<string, unknown>>(
      'prdn_dates',
      '*',
      { column: 'planned_date', ascending: true }
    );

    // Load existing chassis receival records (paginated to avoid 1000-row limit)
    const inspectionData = await fetchAllPages<Record<string, unknown>>(
      'sales_chassis_receival_records',
      '*',
      { column: 'id', ascending: true },
      (q) => q.eq('is_deleted', false)
    );

    // Filter work orders that have planned chassis arrival dates
    const workOrdersWithChassisArrival = (woData || []).filter(workOrder => {
      const woDates = (datesData || []).filter(d => d.sales_order_id === workOrder.id);
      const chassisArrival = woDates.find(d => d.date_type === 'chassis_arrival');
      
      // Has planned chassis arrival date
      return chassisArrival?.planned_date;
    });

    // Attach chassis arrival date and ongoing inspection status to each work order for display
    const allWorkOrders = workOrdersWithChassisArrival.map(workOrder => {
      const woDates = (datesData || []).filter(d => d.sales_order_id === workOrder.id);
      const chassisArrival = woDates.find(d => d.date_type === 'chassis_arrival');
      
      // Check if there's an ongoing inspection for this work order
      const ongoingInspection = (inspectionData || []).find(ins => 
        ins.sales_order_id === workOrder.id && 
        ins.inspection_status === 'ongoing'
      );
      
      return {
        ...workOrder,
        chassisArrival: chassisArrival,
        chassisArrivalDate: chassisArrival?.planned_date,
        hasOngoingInspection: !!ongoingInspection
      };
    });

    console.log('Chassis Receival - Loaded work orders:', {
      totalWorkOrders: woData?.length || 0,
      totalDates: datesData?.length || 0,
      workOrdersWithChassisArrival: workOrdersWithChassisArrival.length,
      allWorkOrders: allWorkOrders.map(wo => ({ 
        id: wo.id, 
        wo_no: wo.wo_no, 
        wo_type: wo.wo_type,
        wo_model: wo.wo_model,
        wo_chassis: wo.wo_chassis,
        wheel_base: wo.wheel_base,
        chassisArrival: wo.chassisArrival,
        chassisArrivalDate: wo.chassisArrivalDate,
        hasOngoingInspection: wo.hasOngoingInspection
      }))
    });

    return allWorkOrders;
  } catch (error) {
    console.error('Error loading work orders:', error);
    return [];
  }
}

export async function loadTemplates() {
  try {
    const { data, error } = await supabase
      .from('sys_chassis_receival_templates')
      .select(`
        *,
        sys_chassis_receival_template_fields(*)
      `)
      .eq('is_active', true)
      .eq('is_deleted', false)
      .order('template_name');

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error loading templates:', error);
    return [];
  }
}

