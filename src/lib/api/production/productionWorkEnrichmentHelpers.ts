import type { ProductionWork } from './productionTypes';

export function createLookupMaps(
  workTypesData: any[],
  workTypeDetailsData: any[],
  workFlowData: any[],
  skillMappingsData: any[],
  addedWorksData: any[],
  skillTimeStandardsData: any[],
  skillCombinationsData: any[]
) {
  const workTypeMap = new Map<string, any>();
  workTypesData.forEach((wt: any) => {
    workTypeMap.set(wt.wo_type_name, wt);
  });

  const workTypeDetailMap = new Map<string, any>();
  workTypeDetailsData.forEach((wtd: any) => {
    workTypeDetailMap.set(wtd.derived_sw_code, wtd);
  });

  const workFlowMap = new Map<string, any>();
  workFlowData.forEach((wf: any) => {
    // Key by derived_sw_code + wo_type_id to handle different durations for different vehicle types
    const key = `${wf.derived_sw_code}_${wf.wo_type_id}`;
    workFlowMap.set(key, wf);
  });

  const skillMappingsMap = new Map<string, any[]>();
  skillMappingsData.forEach((sm: any) => {
    const code = sm.derived_sw_code;
    if (!skillMappingsMap.has(code)) {
      skillMappingsMap.set(code, []);
    }
    skillMappingsMap.get(code)!.push(sm);
  });

  const addedWorkMap = new Map<string, any>();
  addedWorksData.forEach((aw: any) => {
    const key = `${aw.wo_details_id}_${aw.other_work_code}`;
    addedWorkMap.set(key, aw);
  });

  // Group skill time standards by wsm_id
  // For each wsm_id, check if all standard_time_minutes are the same
  const skillTimeStandardsMap = new Map<number, { isUniform: boolean; values: Array<{ skill_short: string; standard_time_minutes: number }> }>();
  const wsmGroups = new Map<number, any[]>();
  
  console.log(`📊 Processing ${skillTimeStandardsData.length} skill time standards records`);
  if (skillTimeStandardsData.length > 0) {
    console.log('📊 First skill time standard sample:', skillTimeStandardsData[0]);
    console.log('📊 Keys in first record:', Object.keys(skillTimeStandardsData[0]));
  }
  
  skillTimeStandardsData.forEach((sts: any) => {
    const wsmId = sts.wsm_id;
    if (wsmId == null || wsmId === undefined) {
      console.warn('⚠️ Skill time standard missing wsm_id:', sts);
      return;
    }
    if (!wsmGroups.has(wsmId)) {
      wsmGroups.set(wsmId, []);
    }
    wsmGroups.get(wsmId)!.push(sts);
  });

  console.log(`📊 Grouped into ${wsmGroups.size} wsm_id groups`);

  wsmGroups.forEach((standards, wsmId) => {
    const timeValues = standards.map(s => s.standard_time_minutes);
    const uniqueValues = new Set(timeValues);
    const isUniform = uniqueValues.size === 1;
    
    skillTimeStandardsMap.set(wsmId, {
      isUniform,
      values: standards.map(s => ({
        skill_short: s.skill_short,
        standard_time_minutes: s.standard_time_minutes
      }))
    });
  });
  
  console.log(`📊 Created skill time standards map with ${skillTimeStandardsMap.size} entries`);

  const skillCombinationMap = new Map<string, any>();
  skillCombinationsData.forEach((sc: any) => {
    skillCombinationMap.set(sc.sc_name, sc);
  });

  return {
    workTypeMap,
    workTypeDetailMap,
    workFlowMap,
    skillMappingsMap,
    addedWorkMap,
    skillTimeStandardsMap,
    skillCombinationMap
  };
}

export function enrichWorksWithData(
  workStatusMap: Map<number, any[]>,
  workOrderMap: Map<number, any>,
  workTypeMap: Map<string, any>,
  workTypeDetailMap: Map<string, any>,
  workFlowMap: Map<string, any>,
  skillMappingsMap: Map<string, any[]>,
  addedWorkMap: Map<string, any>,
  skillTimeStandardsMap: Map<number, { isUniform: boolean; values: Array<{ skill_short: string; standard_time_minutes: number }> }>,
  skillCombinationMap: Map<string, any>,
  stage: string
): ProductionWork[] {
  const allEnrichedWorks: ProductionWork[] = [];

  for (const [woId, statuses] of workStatusMap.entries()) {
    const workOrder = workOrderMap.get(woId);
    if (!workOrder) {
      console.warn(`⚠️ Work order ${woId} not found in map`);
      continue;
    }

    const woModel = workOrder.wo_model;
    const workType = workTypeMap.get(woModel);

    if (!workType) {
      console.warn(`⚠️ No work type found for model ${woModel}, skipping work order ${woId}`);
      continue;
    }

    for (const workStatus of statuses) {
      const derivedSwCode = workStatus.derived_sw_code;
      const otherWorkCode = workStatus.other_work_code;

      if (derivedSwCode) {
        const workTypeDetail = workTypeDetailMap.get(derivedSwCode);
        if (!workTypeDetail) {
          console.warn(`⚠️ Could not find details for work ${derivedSwCode}`);
          continue;
        }

        // Look up work flow using both derived_sw_code and wo_type_id
        const workFlowKey = `${derivedSwCode}_${workType.id}`;
        const workFlow = workFlowMap.get(workFlowKey);
        const skillMappings = skillMappingsMap.get(derivedSwCode) || [];

        // If no vehicle work flow, try to get skill time standards from skill mappings
        let skillTimeStandards = undefined;
        if (!workFlow && skillMappings.length > 0) {
          // Collect all skill time standards from all skill mappings for this work
          const allSkillTimeStandards: Array<{ skill_short: string; standard_time_minutes: number }> = [];
          const wsmIdsUsed = new Set<number>();
          
          for (const mapping of skillMappings) {
            const wsmId = mapping?.wsm_id;
            if (wsmId && !wsmIdsUsed.has(wsmId)) {
              wsmIdsUsed.add(wsmId);
              const sts = skillTimeStandardsMap.get(wsmId);
              if (sts && sts.values && sts.values.length > 0) {
                allSkillTimeStandards.push(...sts.values);
              } else {
                console.log(`⚠️ No skill time standards found for wsm_id ${wsmId} for work ${derivedSwCode}`);
              }
            } else if (!wsmId) {
              console.log(`⚠️ Skill mapping missing wsm_id for work ${derivedSwCode}:`, mapping);
            }
          }
          
          if (allSkillTimeStandards.length > 0) {
            // Check if all values are the same
            const uniqueValues = new Set(allSkillTimeStandards.map(sts => sts.standard_time_minutes));
            const isUniform = uniqueValues.size === 1;
            
            skillTimeStandards = {
              isUniform,
              values: allSkillTimeStandards
            };
            console.log(`✅ Found skill time standards for work ${derivedSwCode}:`, skillTimeStandards);
          } else {
            console.log(`⚠️ No skill time standards collected for work ${derivedSwCode}, skillMappings:`, skillMappings);
          }
        } else if (!workFlow) {
          console.log(`⚠️ No vehicle work flow and no skill mappings for work ${derivedSwCode}`);
        }

        const workDetail = (workTypeDetail.std_work_details as any);
        allEnrichedWorks.push({
          ...workDetail,
          std_work_type_details: {
            derived_sw_code: workTypeDetail.derived_sw_code,
            type_description: workTypeDetail.type_description || ''
          },
          std_vehicle_work_flow: workFlow || undefined,
          skill_time_standards: skillTimeStandards,
          mstr_wo_type: workType,
          skill_mappings: skillMappings,
          wo_details_id: woId,
          wo_no: workOrder.wo_no,
          pwo_no: workOrder.pwo_no,
          is_added_work: false
        } as ProductionWork);
      } else if (otherWorkCode) {
        const key = `${woId}_${otherWorkCode}`;
        const addedWork = addedWorkMap.get(key);
        if (!addedWork) {
          console.warn(`⚠️ Could not find added work ${otherWorkCode} for WO ${woId}`);
          continue;
        }

        const skillCombination = addedWork.other_work_sc ? skillCombinationMap.get(addedWork.other_work_sc) : null;

        allEnrichedWorks.push({
          sw_id: 0,
          sw_code: otherWorkCode,
          sw_name: addedWork.other_work_desc || '',
          plant_stage: stage,
          sw_type: 'Non-Standard',
          sw_seq_no: 0,
          is_active: true,
          is_deleted: false,
          created_by: addedWork.added_by,
          created_dt: addedWork.added_dt,
          modified_by: addedWork.added_by,
          modified_dt: addedWork.added_dt,
          std_work_type_details: undefined,
          std_vehicle_work_flow: {
            sequence_order: 0,
            estimated_duration_minutes: addedWork.other_work_est_time_min || 0,
            wo_type_id: 0
          },
          mstr_wo_type: {
            wo_type_name: workOrder.wo_model
          },
          skill_mappings: skillCombination ? [{
            wsm_id: 0,
            derived_sw_code: otherWorkCode,
            sc_name: skillCombination.sc_name
          }] : [],
          wo_details_id: woId,
          wo_no: workOrder.wo_no,
          pwo_no: workOrder.pwo_no,
          is_added_work: true
        } as ProductionWork);
      }
    }
  }

  return allEnrichedWorks;
}

export function enrichWorksWithTimeData(
  allEnrichedWorks: ProductionWork[],
  reportingDataMap: Map<string, any[]>
): ProductionWork[] {
  return allEnrichedWorks.map((work) => {
    const workCode = work.std_work_type_details?.derived_sw_code || work.sw_code;
    if (!workCode) return work;

    const key = `${workCode}_${work.wo_details_id}`;
    const reportingData = reportingDataMap.get(key) || [];

    const hoursWorkedTodayValues = reportingData.map(report => report.hours_worked_today || 0).filter(h => h > 0);
    const averageTimeWorked = hoursWorkedTodayValues.length > 0 
      ? hoursWorkedTodayValues.reduce((sum, hours) => sum + hours, 0) / hoursWorkedTodayValues.length
      : 0;

    const skillTimeBreakdown = reportingData.reduce((breakdown, report) => {
      const skillShort = report.prdn_work_planning?.hr_emp?.skill_short;
      if (!skillShort) return breakdown;
      
      const skillTime = (report.hours_worked_till_date || 0) + (report.hours_worked_today || 0);
      breakdown[skillShort] = (breakdown[skillShort] || 0) + skillTime;
      return breakdown;
    }, {} as { [skill: string]: number });

    return {
      ...work,
      time_taken: averageTimeWorked,
      skill_time_breakdown: skillTimeBreakdown
    };
  });
}

