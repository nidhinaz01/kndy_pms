import { supabase } from '$lib/supabaseClient';

/**
 * Shared utility for batch enriching work/plan/report data
 * This eliminates N+1 queries by batching all enrichment queries
 */

export interface EnrichmentData {
  workAdditionDataMap: Map<string, any>;
  vehicleWorkFlowMap: Map<string, any>;
  skillMappingsMap: Map<string, any[]>;
  skillTimeStandardsMap: Map<string, any>;
}

/**
 * Batch fetch all enrichment data needed for works/plans/reports
 */
export async function batchFetchEnrichmentData(
  items: any[],
  stageCode: string
): Promise<EnrichmentData> {
  const enrichmentData: EnrichmentData = {
    workAdditionDataMap: new Map(),
    vehicleWorkFlowMap: new Map(),
    skillMappingsMap: new Map(),
    skillTimeStandardsMap: new Map()
  };

  if (!items || items.length === 0) {
    return enrichmentData;
  }

  // Extract unique work codes and skill requirements
  const uniqueOtherWorkCodes = new Set<string>();
  const uniqueDerivedSwCodes = new Set<string>();
  const uniqueSkillRequirements = new Map<string, Set<string>>(); // derivedSwCode -> Set<scRequired>

  items.forEach(item => {
    const planningRecord = item.prdn_work_planning || item;
    const derivedSwCode = planningRecord.std_work_type_details?.derived_sw_code;
    const otherWorkCode = planningRecord.other_work_code;
    const scRequired = planningRecord.sc_required;

    if (otherWorkCode) {
      uniqueOtherWorkCodes.add(otherWorkCode);
    }
    if (derivedSwCode) {
      uniqueDerivedSwCodes.add(derivedSwCode);
      if (scRequired) {
        if (!uniqueSkillRequirements.has(derivedSwCode)) {
          uniqueSkillRequirements.set(derivedSwCode, new Set());
        }
        uniqueSkillRequirements.get(derivedSwCode)!.add(scRequired);
      }
    }
  });

  // Batch fetch work additions (for non-standard works)
  if (uniqueOtherWorkCodes.size > 0) {
    try {
      const { data: workAdditions } = await supabase
        .from('prdn_work_additions')
        .select('other_work_code, other_work_desc, other_work_sc')
        .in('other_work_code', Array.from(uniqueOtherWorkCodes))
        .eq('stage_code', stageCode)
        .eq('is_deleted', false);

      if (workAdditions) {
        workAdditions.forEach(addition => {
          enrichmentData.workAdditionDataMap.set(addition.other_work_code, addition);
        });
      }
    } catch (error) {
      console.error('Error batch fetching work additions:', error);
    }
  }

  // Batch fetch vehicle work flow
  if (uniqueDerivedSwCodes.size > 0) {
    try {
      const { data: vehicleWorkFlows } = await supabase
        .from('std_vehicle_work_flow')
        .select('derived_sw_code, estimated_duration_minutes')
        .in('derived_sw_code', Array.from(uniqueDerivedSwCodes))
        .eq('is_deleted', false)
        .eq('is_active', true);

      if (vehicleWorkFlows) {
        vehicleWorkFlows.forEach(vwf => {
          enrichmentData.vehicleWorkFlowMap.set(vwf.derived_sw_code, vwf);
        });
      }
    } catch (error) {
      console.error('Error batch fetching vehicle work flows:', error);
    }
  }

  // Batch fetch skill mappings for all derived work codes
  if (uniqueDerivedSwCodes.size > 0) {
    try {
      const { data: allMappings } = await supabase
        .from('std_work_skill_mapping')
        .select(`
          wsm_id,
          derived_sw_code,
          sc_name,
          std_skill_combinations!inner(
            skill_combination
          )
        `)
        .in('derived_sw_code', Array.from(uniqueDerivedSwCodes))
        .eq('is_deleted', false)
        .eq('is_active', true);

      if (allMappings) {
        // Group mappings by derived_sw_code
        allMappings.forEach(mapping => {
          const code = mapping.derived_sw_code;
          if (!enrichmentData.skillMappingsMap.has(code)) {
            enrichmentData.skillMappingsMap.set(code, []);
          }
          enrichmentData.skillMappingsMap.get(code)!.push(mapping);
        });
      }
    } catch (error) {
      console.error('Error batch fetching skill mappings:', error);
    }
  }

  // Batch fetch skill time standards
  // We need to collect all (wsm_id, scRequired) pairs
  const wsmIdToScRequiredMap = new Map<number, Set<string>>();
  const wsmIdToDerivedSwCodeMap = new Map<number, string>();

  // Collect wsm_ids and their associations
  uniqueSkillRequirements.forEach((scRequiredSet, derivedSwCode) => {
    const mappings = enrichmentData.skillMappingsMap.get(derivedSwCode) || [];
    mappings.forEach(mapping => {
      const skillCombination = (mapping as any).std_skill_combinations?.skill_combination;
      if (skillCombination && Array.isArray(skillCombination)) {
        scRequiredSet.forEach(scRequired => {
          const hasSkill = skillCombination.some((skill: any) => 
            skill.skill_name === scRequired || skill.skill_short === scRequired
          );
          if (hasSkill) {
            if (!wsmIdToScRequiredMap.has(mapping.wsm_id)) {
              wsmIdToScRequiredMap.set(mapping.wsm_id, new Set());
            }
            wsmIdToScRequiredMap.get(mapping.wsm_id)!.add(scRequired);
            wsmIdToDerivedSwCodeMap.set(mapping.wsm_id, derivedSwCode);
          }
        });
      }
    });
  });

  const allWsmIds = Array.from(wsmIdToScRequiredMap.keys());
  if (allWsmIds.length > 0) {
    try {
      const { data: skillTimeStandards } = await supabase
        .from('std_skill_time_standards')
        .select('*')
        .in('wsm_id', allWsmIds)
        .eq('is_deleted', false)
        .eq('is_active', true);

      if (skillTimeStandards) {
        skillTimeStandards.forEach(sts => {
          const scRequiredSet = wsmIdToScRequiredMap.get(sts.wsm_id);
          const derivedSwCode = wsmIdToDerivedSwCodeMap.get(sts.wsm_id);
          if (scRequiredSet && scRequiredSet.has(sts.skill_short) && derivedSwCode) {
            const key = `${derivedSwCode}_${sts.skill_short}_${sts.wsm_id}`;
            enrichmentData.skillTimeStandardsMap.set(key, sts);
          }
        });
      }
    } catch (error) {
      console.error('Error batch fetching skill time standards:', error);
    }
  }

  return enrichmentData;
}

/**
 * Enrich a single work/plan/report item using pre-fetched batch data
 */
export function enrichItem(
  item: any,
  enrichmentData: EnrichmentData,
  stageCode: string
): any {
  const planningRecord = item.prdn_work_planning || item;
  const derivedSwCode = planningRecord.std_work_type_details?.derived_sw_code;
  const otherWorkCode = planningRecord.other_work_code;
  const skillShort = planningRecord.hr_emp?.skill_short;
  const scRequired = planningRecord.sc_required;

  // Get work addition data for non-standard works
  let workAdditionData = null;
  if (otherWorkCode) {
    workAdditionData = enrichmentData.workAdditionDataMap.get(otherWorkCode) || null;
  }

  // Get vehicle work flow
  const vehicleWorkFlow = derivedSwCode 
    ? enrichmentData.vehicleWorkFlowMap.get(derivedSwCode) || null
    : null;

  // For non-standard works, return early
  if (otherWorkCode) {
    return {
      ...item,
      skillTimeStandard: null,
      skillMapping: null,
      vehicleWorkFlow: vehicleWorkFlow,
      workAdditionData: workAdditionData
    };
  }

  if (!derivedSwCode || !skillShort || !scRequired) {
    return {
      ...item,
      skillTimeStandard: null,
      skillMapping: null,
      vehicleWorkFlow: vehicleWorkFlow,
      workAdditionData: workAdditionData
    };
  }

  // Find matching skill mapping
  const allMappings = enrichmentData.skillMappingsMap.get(derivedSwCode) || [];
  let matchingWsm = null;

  for (const mapping of allMappings) {
    const skillCombination = (mapping as any).std_skill_combinations?.skill_combination;
    if (skillCombination && Array.isArray(skillCombination)) {
      const hasSkill = skillCombination.some((skill: any) => 
        skill.skill_name === scRequired || skill.skill_short === scRequired
      );
      if (hasSkill) {
        matchingWsm = mapping;
        break;
      }
    }
  }

  if (!matchingWsm) {
    return {
      ...item,
      skillTimeStandard: null,
      skillMapping: null,
      vehicleWorkFlow: vehicleWorkFlow,
      workAdditionData: workAdditionData
    };
  }

  // Get skill time standard
  const key = `${derivedSwCode}_${scRequired}_${matchingWsm.wsm_id}`;
  const skillTimeStandard = enrichmentData.skillTimeStandardsMap.get(key) || null;

  // Use existing mapping from planning record if available, otherwise use matched one
  const planningWsm = planningRecord.std_work_skill_mapping;
  const finalSkillMapping = planningWsm || matchingWsm;

  // Calculate remaining time (if applicable)
  let remainingTimeMinutes = 0;
  if (skillTimeStandard && item.hours_worked_till_date !== undefined) {
    const hoursWorkedTillDate = item.hours_worked_till_date || 0;
    const hoursWorkedToday = item.hours_worked_today || 0;
    remainingTimeMinutes = Math.max(0, skillTimeStandard.standard_time_minutes - ((hoursWorkedTillDate + hoursWorkedToday) * 60));
  }

  return {
    ...item,
    vehicleWorkFlow,
    skillTimeStandard,
    remainingTimeMinutes,
    skillMapping: finalSkillMapping,
    workAdditionData: workAdditionData
  };
}

/**
 * Batch enrich multiple items
 */
export async function batchEnrichItems(
  items: any[],
  stageCode: string
): Promise<any[]> {
  if (!items || items.length === 0) {
    return [];
  }

  // Fetch all enrichment data in batches
  const enrichmentData = await batchFetchEnrichmentData(items, stageCode);

  // Enrich each item using the pre-fetched data
  return items.map(item => enrichItem(item, enrichmentData, stageCode));
}

