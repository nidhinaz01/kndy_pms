import { supabase } from '$lib/supabaseClient';

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
    // Load all work orders
    const { data: woData, error: woError } = await supabase
      .from('prdn_wo_details')
      .select('*')
      .order('wo_date', { ascending: false });

    if (woError) throw woError;

    // Load all production dates
    const { data: datesData, error: datesError } = await supabase
      .from('prdn_dates')
      .select('*')
      .order('planned_date', { ascending: true });

    if (datesError) throw datesError;

    // Load existing chassis receival records
    const { data: inspectionData, error: inspectionError } = await supabase
      .from('sales_chassis_receival_records')
      .select('*')
      .eq('is_deleted', false);

    if (inspectionError) throw inspectionError;

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

