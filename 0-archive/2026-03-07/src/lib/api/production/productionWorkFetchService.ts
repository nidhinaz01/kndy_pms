import { supabase } from '$lib/supabaseClient';
import type { ProductionWork } from './productionTypes';
import { getActiveWorkOrders, getWorkStatuses, batchFetchWorkData } from './productionWorkFetchHelpers';
import { createLookupMaps, enrichWorksWithData, enrichWorksWithTimeData } from './productionWorkEnrichmentHelpers';

export async function fetchProductionWorks(stage: string, selectedDate: string): Promise<ProductionWork[]> {
  try {
    console.log(`🔍 Fetching works for stage: ${stage} on date: ${selectedDate}`);
    
    const { workOrderMap, activeWorkOrderIds } = await getActiveWorkOrders(stage);
    
    if (activeWorkOrderIds.length === 0) {
      return [];
    }

    console.log(`📦 Found ${activeWorkOrderIds.length} active work order IDs:`, activeWorkOrderIds);

    const { workStatusMap, uniqueDerivedSwCodes, uniqueOtherWorkCodes, uniqueWoModels } = await getWorkStatuses(stage, activeWorkOrderIds);
    
    if (workStatusMap.size === 0) {
      return [];
    }

    workStatusMap.forEach((statuses, woId) => {
      const workOrder = workOrderMap.get(woId);
      if (workOrder) {
        uniqueWoModels.add(workOrder.wo_model);
      }
    });

    console.log(`📊 Batch fetching: ${uniqueDerivedSwCodes.size} standard works, ${uniqueOtherWorkCodes.size} non-standard works, ${uniqueWoModels.size} work types`);

    const {
      workTypesData,
      workTypeDetailsData,
      workFlowData,
      skillMappingsData,
      addedWorksData,
      skillTimeStandardsData,
      skillCombinationsData
    } = await batchFetchWorkData(stage, uniqueDerivedSwCodes, uniqueOtherWorkCodes, uniqueWoModels, workStatusMap, workOrderMap);

    const {
      workTypeMap,
      workTypeDetailMap,
      workFlowMap,
      skillMappingsMap,
      addedWorkMap,
      skillTimeStandardsMap,
      skillCombinationMap
    } = createLookupMaps(
      workTypesData,
      workTypeDetailsData,
      workFlowData,
      skillMappingsData,
      addedWorksData,
      skillTimeStandardsData,
      skillCombinationsData
    );

    const allEnrichedWorks = enrichWorksWithData(
      workStatusMap,
      workOrderMap,
      workTypeMap,
      workTypeDetailMap,
      workFlowMap,
      skillMappingsMap,
      addedWorkMap,
      skillTimeStandardsMap,
      skillCombinationMap,
      stage
    );

    console.log(`✅ Total enriched works found for stage ${stage}: ${allEnrichedWorks.length}`);
    
    const allWorkCodes = allEnrichedWorks.map(w => w.std_work_type_details?.derived_sw_code || w.sw_code).filter(Boolean);
    const allWoIds = [...new Set(allEnrichedWorks.map(w => w.wo_details_id).filter(Boolean))];

    const PAGE_SIZE = 1000;
    let allReportingData: any[] = [];
    if (allWorkCodes.length > 0 && allWoIds.length > 0) {
      const standardWorkCodes = allWorkCodes.filter(code => code && !code.startsWith('OW'));
      const nonStandardWorkCodes = allWorkCodes.filter(code => code && code.startsWith('OW'));

      const orConditions: string[] = [];
      if (standardWorkCodes.length > 0) {
        orConditions.push(`derived_sw_code.in.(${standardWorkCodes.join(',')})`);
      }
      if (nonStandardWorkCodes.length > 0) {
        orConditions.push(`other_work_code.in.(${nonStandardWorkCodes.join(',')})`);
      }

      const planningData: { id: number }[] = [];
      let planningOffset = 0;
      let planningHasMore = true;
      while (planningHasMore) {
        let planningQuery = supabase
          .from('prdn_work_planning')
          .select('id')
          .eq('stage_code', stage)
          .in('wo_details_id', allWoIds)
          .eq('is_deleted', false)
          .order('id')
          .range(planningOffset, planningOffset + PAGE_SIZE - 1);
        if (orConditions.length > 0) {
          planningQuery = planningQuery.or(orConditions.join(','));
        }
        const { data: page, error: planningError } = await planningQuery;
        if (planningError) {
          console.error('❌ Error fetching planning IDs:', planningError);
          planningData.length = 0;
          break;
        }
        const rows = page || [];
        planningData.push(...rows);
        planningHasMore = rows.length === PAGE_SIZE;
        planningOffset += PAGE_SIZE;
      }

      if (planningData.length > 0) {
        const planningIds = planningData.map(p => p.id);
        const baseSelect = `
          hours_worked_till_date,
          hours_worked_today,
          from_date,
          from_time,
          to_date,
          to_time,
          prdn_work_planning!inner(
            derived_sw_code,
            other_work_code,
            stage_code,
            wo_details_id,
            hr_emp!inner(skill_short)
          )
        `;
        let reportOffset = 0;
        let reportHasMore = true;
        while (reportHasMore) {
          const { data, error } = await supabase
            .from('prdn_work_reporting')
            .select(baseSelect)
            .in('planning_id', planningIds)
            .eq('is_deleted', false)
            .order('id')
            .range(reportOffset, reportOffset + PAGE_SIZE - 1);

          if (error) {
            console.error('❌ Error fetching reporting data:', error);
            allReportingData = [];
            break;
          }
          const rows = data || [];
          allReportingData.push(...rows);
          reportHasMore = rows.length === PAGE_SIZE;
          reportOffset += PAGE_SIZE;
        }
      }
    }

    const reportingDataMap = new Map<string, any[]>();
    allReportingData.forEach((report: any) => {
      const planning = report.prdn_work_planning;
      const workCode = planning?.derived_sw_code || planning?.other_work_code;
      const woId = planning?.wo_details_id;
      if (workCode && woId) {
        const key = `${workCode}_${woId}`;
        if (!reportingDataMap.has(key)) {
          reportingDataMap.set(key, []);
        }
        reportingDataMap.get(key)!.push(report);
      }
    });

    const worksWithTimeData = enrichWorksWithTimeData(allEnrichedWorks, reportingDataMap);

    console.log(`✅ Works with time data:`, worksWithTimeData);
    return worksWithTimeData;
  } catch (error) {
    console.error('❌ Error in fetchProductionWorks:', error);
    return [];
  }
}

