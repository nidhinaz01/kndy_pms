import { supabase } from '$lib/supabaseClient';

export async function getActiveWorkOrders(stage: string) {
  try {
    const { data, error } = await supabase.rpc('get_active_work_orders', {
      p_stage_code: stage
    });

    if (error) {
      console.error('❌ Error fetching active work orders:', error);
      throw error;
    }

    if (!data || data.length === 0) {
      console.log(`📭 No active work orders in stage ${stage}`);
      return { workOrderMap: new Map(), activeWorkOrderIds: [] };
    }

    const workOrderMap = new Map<number, {id: number, wo_model: string, wo_no: string | null, pwo_no: string | null}>();
    const activeWorkOrderIds: number[] = [];

    data.forEach((wo: any) => {
      if (wo.wo_id) {
        workOrderMap.set(wo.wo_id, {
          id: wo.wo_id,
          wo_model: wo.wo_model,
          wo_no: wo.wo_no,
          pwo_no: wo.pwo_no
        });
        activeWorkOrderIds.push(wo.wo_id);
      }
    });

    return { workOrderMap, activeWorkOrderIds };
  } catch (error) {
    console.error('❌ Error in getActiveWorkOrders:', error);
    throw error;
  }
}

export async function getWorkStatuses(stage: string, activeWorkOrderIds: number[]) {
  try {
    if (activeWorkOrderIds.length === 0) {
      return { workStatusMap: new Map(), uniqueDerivedSwCodes: new Set(), uniqueOtherWorkCodes: new Set(), uniqueWoModels: new Set(), otherWorkCodeToStatusMap: new Map() };
    }

    const { data, error } = await supabase.rpc('get_work_statuses_with_codes', {
      p_stage_code: stage,
      p_wo_ids: activeWorkOrderIds
    });

    if (error) {
      console.error('❌ Error fetching work statuses:', error);
      throw error;
    }

    if (!data || !data.workStatuses || data.workStatuses.length === 0) {
      console.log(`📭 No works found in prdn_work_status for stage ${stage}`);
      return { workStatusMap: new Map(), uniqueDerivedSwCodes: new Set(), uniqueOtherWorkCodes: new Set(), uniqueWoModels: new Set(), otherWorkCodeToStatusMap: new Map() };
    }

    const workStatuses = data.workStatuses as any[];
    const uniqueDerivedSwCodes = new Set<string>((data.uniqueDerivedSwCodes || []) as string[]);
    const uniqueOtherWorkCodes = new Set<string>((data.uniqueOtherWorkCodes || []) as string[]);
    const uniqueWoModels = new Set<string>();
    const workStatusMap = new Map<number, any[]>();
    const otherWorkCodeToStatusMap = new Map<string, { woId: number; workStatus: any }>();

    workStatuses.forEach((ws: any) => {
      const woId = ws.wo_details_id;
      if (!workStatusMap.has(woId)) {
        workStatusMap.set(woId, []);
      }
      workStatusMap.get(woId)!.push(ws);

      if (ws.other_work_code) {
        otherWorkCodeToStatusMap.set(ws.other_work_code, { woId, workStatus: ws });
      }
    });

    return { workStatusMap, uniqueDerivedSwCodes, uniqueOtherWorkCodes, uniqueWoModels, otherWorkCodeToStatusMap };
  } catch (error) {
    console.error('❌ Error in getWorkStatuses:', error);
    throw error;
  }
}

export async function batchFetchWorkData(
  stage: string,
  uniqueDerivedSwCodes: Set<string>,
  uniqueOtherWorkCodes: Set<string>,
  uniqueWoModels: Set<string>,
  workStatusMap: Map<number, any[]>,
  workOrderMap: Map<number, {id: number, wo_model: string, wo_no: string | null, pwo_no: string | null}>
) {
  // Phase 1: Fetch all independent queries in parallel
  const [
    workTypesData,
    workTypeDetailsData,
    skillMappingsData,
    addedWorksData
  ] = await Promise.all([
    uniqueWoModels.size > 0 ? supabase
      .from('mstr_wo_type')
      .select('*')
      .in('wo_type_name', Array.from(uniqueWoModels))
      .then(({ data, error }) => {
        if (error) console.error('Error fetching work types:', error);
        return data || [];
      }) : Promise.resolve([]),

    uniqueDerivedSwCodes.size > 0 ? supabase
      .from('std_work_type_details')
      .select(`*, std_work_details!inner(*)`)
      .in('derived_sw_code', Array.from(uniqueDerivedSwCodes))
      .eq('is_active', true)
      .eq('is_deleted', false)
      .then(({ data, error }) => {
        if (error) console.error('Error fetching work type details:', error);
        return data || [];
      }) : Promise.resolve([]),

    uniqueDerivedSwCodes.size > 0 ? supabase
      .from('std_work_skill_mapping')
      .select(`wsm_id, derived_sw_code, sc_name, std_skill_combinations!inner(sc_id, sc_name, manpower_required, skill_combination)`)
      .in('derived_sw_code', Array.from(uniqueDerivedSwCodes))
      .eq('is_active', true)
      .eq('is_deleted', false)
      .then(({ data, error }) => {
        if (error) console.error('Error fetching skill mappings:', error);
        console.log('📊 Fetched skill mappings:', data?.length || 0, 'mappings');
        return data || [];
      }) : Promise.resolve([]),

    uniqueOtherWorkCodes.size > 0 ? supabase
      .from('prdn_work_additions')
      .select('*')
      .eq('stage_code', stage)
      .in('wo_details_id', Array.from(workStatusMap.keys()))
      .in('other_work_code', Array.from(uniqueOtherWorkCodes))
      .then(({ data, error }) => {
        if (error) console.error('Error fetching added works:', error);
        return data || [];
      }) : Promise.resolve([])
  ]);

  // Phase 2: Fetch dependent queries using data from Phase 1
  // Optimize: Reuse workTypesData for work flows (avoid duplicate query)
  // Optimize: Extract wsm_ids from skillMappingsData (avoid duplicate query)
  const [workFlowData, skillTimeStandardsData] = await Promise.all([
    // Fetch vehicle work flows using wo_type_ids from workTypesData
    uniqueWoModels.size > 0 && uniqueDerivedSwCodes.size > 0 && workTypesData.length > 0 ? 
      (() => {
        const woTypeIds = workTypesData.map(wt => wt.id).filter(Boolean);
        if (woTypeIds.length === 0) return Promise.resolve([]);
        
        return supabase
          .from('std_vehicle_work_flow')
          .select('*')
          .in('derived_sw_code', Array.from(uniqueDerivedSwCodes))
          .in('wo_type_id', woTypeIds)
          .eq('is_active', true)
          .eq('is_deleted', false)
          .then(({ data, error }) => {
            if (error) {
              console.error('Error fetching work flows:', error);
              return [];
            }
            return data || [];
          });
      })() : Promise.resolve([]),

    // Fetch skill time standards using wsm_ids from skillMappingsData
    uniqueDerivedSwCodes.size > 0 && skillMappingsData.length > 0 ?
      (() => {
        const wsmIds = [...new Set((skillMappingsData as any[]).map((m: any) => m.wsm_id).filter(Boolean))];
        if (wsmIds.length === 0) return Promise.resolve([]);
        
        return supabase
          .from('std_skill_time_standards')
          .select('wsm_id, skill_short, standard_time_minutes, skill_order')
          .in('wsm_id', wsmIds)
          .eq('is_active', true)
          .eq('is_deleted', false)
          .order('wsm_id', { ascending: true })
          .order('skill_order', { ascending: true })
          .then(({ data, error }) => {
            if (error) {
              console.error('Error fetching skill time standards:', error);
              return [];
            }
            console.log(`📊 Fetched skill time standards: ${data?.length || 0} records for ${wsmIds.length} wsm_ids`);
            return data || [];
          });
      })() : Promise.resolve([])
  ]);

  const scNames = [...new Set((addedWorksData || []).map((aw: any) => aw.other_work_sc).filter(Boolean))];
  const { data: skillCombinationsData, error: scError } = scNames.length > 0
    ? await supabase
        .from('std_skill_combinations')
        .select('*')
        .in('sc_name', scNames)
    : { data: [], error: null };
  
  if (scError) {
    console.error('Error fetching skill combinations:', scError);
  }

  return {
    workTypesData,
    workTypeDetailsData,
    workFlowData,
    skillMappingsData,
    addedWorksData,
    skillTimeStandardsData: skillTimeStandardsData || [],
    skillCombinationsData: skillCombinationsData || []
  };
}

