import { loadStageWorkOrders, loadStageWorks, loadStagePlannedWorks, loadStageManpower, loadShiftBreakTimes } from '../../services/stageProductionService';
import { getDraftWorkPlans, getDraftManpowerPlans, getDraftWorkReports, getDraftManpowerReports } from '$lib/api/production/planningReportingService';
import { supabase } from '$lib/supabaseClient';

/**
 * Load work orders data
 */
export async function loadWorkOrdersData(stageCode: string, selectedDate: string) {
  if (!selectedDate) return [];
  
  try {
    console.log(`🔍 Loading work orders for ${stageCode} on date: ${selectedDate}`);
    const data = await loadStageWorkOrders(stageCode, selectedDate);
    console.log(`📦 Active Work Orders found for ${stageCode} on ${selectedDate}:`, data.length);
    return data;
  } catch (error) {
    console.error('Error loading work orders data:', error);
    return [];
  }
}

/**
 * Load works data
 */
export async function loadWorksData(stageCode: string, selectedDate: string) {
  if (!selectedDate) return [];
  
  try {
    return await loadStageWorks(stageCode, selectedDate);
  } catch (error) {
    console.error('Error loading works data:', error);
    return [];
  }
}

/**
 * Load planned works data
 */
export async function loadPlannedWorksData(stageCode: string, selectedDate: string) {
  if (!selectedDate) return [];
  
  try {
    let dateStr: string;
    if (typeof selectedDate === 'string') {
      dateStr = selectedDate.split('T')[0];
    } else if (selectedDate && typeof selectedDate === 'object' && 'toISOString' in selectedDate) {
      dateStr = (selectedDate as Date).toISOString().split('T')[0];
    } else {
      dateStr = String(selectedDate || '').split('T')[0];
    }
    
    const data = await loadStagePlannedWorks(stageCode, dateStr, 'approved');
    console.log(`📋 Loaded ${data.length} planned works for ${stageCode} on ${dateStr}`);
    
    // Enrich with skill-specific time standards and vehicle work flow (same as Draft Plan)
    const enrichedPlannedWorks = await Promise.all(
      (data || []).map(async (plannedWork) => {
        const derivedSwCode = plannedWork.std_work_type_details?.derived_sw_code;
        const otherWorkCode = plannedWork.other_work_code;
        const skillShort = plannedWork.hr_emp?.skill_short;
        const scRequired = plannedWork.sc_required;
        
        // For non-standard works, fetch work addition data
        let workAdditionData = null;
        if (otherWorkCode) {
          try {
            let query = supabase
              .from('prdn_work_additions')
              .select('other_work_code, other_work_desc, other_work_sc')
              .eq('other_work_code', otherWorkCode)
              .eq('stage_code', stageCode);
            
            // Include wo_details_id in filter if available for more precise matching
            if (plannedWork.wo_details_id) {
              query = query.eq('wo_details_id', plannedWork.wo_details_id);
            }
            
            const { data: additionData, error: additionError } = await query.maybeSingle();
            
            if (additionError) {
              // Log the error but don't throw - this is non-critical data
              console.warn(`Error fetching work addition data for ${otherWorkCode} in ${stageCode}:`, additionError);
            } else {
              workAdditionData = additionData;
            }
          } catch (error) {
            // Log but don't throw - this is enrichment data, not critical
            console.warn(`Error fetching work addition data for ${otherWorkCode}:`, error);
          }
        }
        
        // Fetch vehicle work flow
        let vehicleWorkFlow = null;
        if (derivedSwCode) {
          try {
            const { data: vwfData } = await supabase
              .from('std_vehicle_work_flow')
              .select('estimated_duration_minutes')
              .eq('derived_sw_code', derivedSwCode)
              .eq('is_deleted', false)
              .eq('is_active', true)
              .limit(1)
              .maybeSingle();
            vehicleWorkFlow = vwfData;
          } catch (error) {
            console.error('Error fetching vehicle work flow:', error);
          }
        }
        
        if (!derivedSwCode || !skillShort || !scRequired) {
          return { ...plannedWork, skillTimeStandard: null, skillMapping: null, vehicleWorkFlow: vehicleWorkFlow, workAdditionData: workAdditionData };
        }

        // Find skill combination that contains the required skill
        let matchingWsm = null;
        try {
          const { data: allMappings } = await supabase
            .from('std_work_skill_mapping')
            .select(`
              wsm_id,
              sc_name,
              std_skill_combinations!inner(
                skill_combination
              )
            `)
            .eq('derived_sw_code', derivedSwCode)
            .eq('is_deleted', false)
            .eq('is_active', true);

          if (allMappings && allMappings.length > 0) {
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
          }
        } catch (error) {
          console.error('Error fetching skill mappings:', error);
        }

        if (!matchingWsm) {
          return { ...plannedWork, skillTimeStandard: null, skillMapping: null, vehicleWorkFlow: vehicleWorkFlow, workAdditionData: workAdditionData };
        }

        // Get skill time standard
        let skillTimeStandard = null;
        try {
          const { data: stsData } = await supabase
            .from('std_skill_time_standards')
            .select('*')
            .eq('wsm_id', matchingWsm.wsm_id)
            .eq('skill_short', scRequired)
            .eq('is_deleted', false)
            .eq('is_active', true)
            .maybeSingle();
          skillTimeStandard = stsData;
        } catch (error) {
          console.error('Error fetching skill time standard:', error);
        }

        return {
          ...plannedWork,
          skillTimeStandard: skillTimeStandard,
          skillMapping: matchingWsm,
          vehicleWorkFlow: vehicleWorkFlow,
          workAdditionData: workAdditionData
        };
      })
    );

    console.log(`✅ Enriched ${enrichedPlannedWorks.length} planned works with skill-specific data`);
    return enrichedPlannedWorks;
  } catch (error) {
    console.error('Error loading planned works data:', error);
    return [];
  }
}

/**
 * Load manpower plan data
 */
export async function loadManpowerPlanData(stageCode: string, shiftCode: string, selectedDate: string) {
  console.log(`🔍 loadManpowerPlanData called with:`, {
    stageCode,
    shiftCode,
    selectedDate,
    selectedDateType: typeof selectedDate
  });
  
  if (!selectedDate) {
    console.warn(`⚠️ loadManpowerPlanData: selectedDate is empty, returning empty array`);
    return [];
  }
  
  try {
    // Use selected date directly (no next day calculation)
    let dateStr: string;
    if (typeof selectedDate === 'string') {
      dateStr = selectedDate.split('T')[0];
    } else if (selectedDate && typeof selectedDate === 'object' && 'toISOString' in selectedDate) {
      dateStr = (selectedDate as Date).toISOString().split('T')[0];
    } else {
      dateStr = String(selectedDate || '').split('T')[0];
    }
    console.log(`📅 loadManpowerPlanData: parsed dateStr="${dateStr}"`);
    const result = await loadStageManpower(stageCode, shiftCode, dateStr, 'planning');
    console.log(`✅ loadManpowerPlanData: returning ${result.length} employees`);
    return result;
  } catch (error) {
    console.error('❌ Error loading manpower plan data:', error);
    return [];
  }
}

/**
 * Load manpower report data
 */
export async function loadManpowerReportData(stageCode: string, shiftCode: string, selectedDate: string) {
  if (!selectedDate) return [];
  
  try {
    let dateStr: string;
    if (typeof selectedDate === 'string') {
      dateStr = selectedDate.split('T')[0];
    } else {
      dateStr = new Date(selectedDate).toISOString().split('T')[0];
    }
    return await loadStageManpower(stageCode, shiftCode, dateStr, 'reporting');
  } catch (error) {
    console.error('Error loading manpower report data:', error);
    return [];
  }
}

/**
 * Get planning submission status for a stage and date
 */
export async function getPlanningSubmissionStatus(stageCode: string, planningDate: string) {
  try {
    let dateStr: string;
    if (typeof planningDate === 'string') {
      dateStr = planningDate.split('T')[0];
    } else if (planningDate && typeof planningDate === 'object' && 'toISOString' in planningDate) {
      dateStr = (planningDate as Date).toISOString().split('T')[0];
    } else {
      dateStr = String(planningDate || '').split('T')[0];
    }

    // Get the latest submission (most recent submitted_dt)
    // Order by submitted_dt DESC, then by id DESC as tiebreaker
    const { data, error } = await supabase
      .from('prdn_planning_submissions')
      .select('id, status, submitted_dt, reviewed_dt, reviewed_by, rejection_reason')
      .eq('stage_code', stageCode)
      .eq('planning_date', dateStr)
      .eq('is_deleted', false)
      .order('submitted_dt', { ascending: false })
      .order('id', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
      console.error('Error fetching planning submission status:', error);
      return null;
    }

    if (data) {
      console.log(`📋 Latest submission for ${stageCode} on ${dateStr}:`, {
        id: data.id,
        status: data.status,
        submitted_dt: data.submitted_dt
      });
    }

    return data || null;
  } catch (error) {
    console.error('Error getting planning submission status:', error);
    return null;
  }
}

/**
 * Get reporting submission status for a stage and date
 */
export async function getReportingSubmissionStatus(stageCode: string, reportingDate: string) {
  try {
    let dateStr: string;
    if (typeof reportingDate === 'string') {
      dateStr = reportingDate.split('T')[0];
    } else if (reportingDate && typeof reportingDate === 'object' && 'toISOString' in reportingDate) {
      dateStr = (reportingDate as Date).toISOString().split('T')[0];
    } else {
      dateStr = String(reportingDate || '').split('T')[0];
    }

    const { data, error } = await supabase
      .from('prdn_reporting_submissions')
      .select('id, status, submitted_dt, reviewed_dt, reviewed_by, rejection_reason')
      .eq('stage_code', stageCode)
      .eq('reporting_date', dateStr)
      .eq('is_deleted', false)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
      console.error('Error fetching reporting submission status:', error);
      return null;
    }

    return data || null;
  } catch (error) {
    console.error('Error getting reporting submission status:', error);
    return null;
  }
}

/**
 * Load draft plan data
 */
export async function loadDraftPlanData(stageCode: string, selectedDate: string) {
  if (!selectedDate) return { workPlans: [], manpowerPlans: [] };
  
  try {
    // Use the selected date directly (not next date)
    let dateStr: string;
    if (typeof selectedDate === 'string') {
      dateStr = selectedDate.split('T')[0];
    } else if (selectedDate && typeof selectedDate === 'object' && 'toISOString' in selectedDate) {
      dateStr = (selectedDate as Date).toISOString().split('T')[0];
    } else {
      dateStr = String(selectedDate || '').split('T')[0];
    }
    
    const [workPlans, manpowerPlans] = await Promise.all([
      getDraftWorkPlans(stageCode, dateStr),
      getDraftManpowerPlans(stageCode, dateStr)
    ]);
    
    return { workPlans, manpowerPlans };
  } catch (error) {
    console.error('Error loading draft plan data:', error);
    return { workPlans: [], manpowerPlans: [] };
  }
}

/**
 * Load draft report data
 */
export async function loadDraftReportData(stageCode: string, selectedDate: string) {
  if (!selectedDate) return { workReports: [], manpowerReports: [] };
  
  try {
    let dateStr: string;
    if (typeof selectedDate === 'string') {
      dateStr = selectedDate.split('T')[0];
    } else {
      dateStr = new Date(selectedDate).toISOString().split('T')[0];
    }
    
    const [rawWorkReports, manpowerReports] = await Promise.all([
      getDraftWorkReports(stageCode, dateStr),
      getDraftManpowerReports(stageCode, dateStr)
    ]);
    
    // Load deviations for all reports
    const reportIds = (rawWorkReports || []).map((r: any) => r.id).filter(Boolean);
    let deviationsMap = new Map<number, any[]>();
    if (reportIds.length > 0) {
      const { getDeviationsForReportings } = await import('$lib/services/workReportingDeviationService');
      deviationsMap = await getDeviationsForReportings(reportIds);
    }
    
    // Enrich work reports with skill-specific time standards and vehicle work flow (same as Draft Plan)
    const enrichedWorkReports = await Promise.all(
      (rawWorkReports || []).map(async (report) => {
        // Attach deviations to report
        const deviations = deviationsMap.get(report.id) || [];
        report.deviations = deviations;
        const planningRecord = report.prdn_work_planning;
        const derivedSwCode = planningRecord?.std_work_type_details?.derived_sw_code;
        const skillShort = planningRecord?.hr_emp?.skill_short;
        const scRequired = planningRecord?.sc_required;
        
        // Fetch vehicle work flow
        let vehicleWorkFlow = null;
        if (derivedSwCode) {
          try {
            const { data: vwfData } = await supabase
              .from('std_vehicle_work_flow')
              .select('estimated_duration_minutes')
              .eq('derived_sw_code', derivedSwCode)
              .eq('is_deleted', false)
              .eq('is_active', true)
              .limit(1)
              .maybeSingle();
            vehicleWorkFlow = vwfData;
          } catch (error) {
            console.error('Error fetching vehicle work flow:', error);
          }
        }
        
        if (!derivedSwCode || !skillShort || !scRequired) {
          return { ...report, skillTimeStandard: null, skillMapping: null, vehicleWorkFlow: vehicleWorkFlow };
        }

        // Find skill combination that contains the required skill
        let matchingWsm = null;
        try {
          const { data: allMappings } = await supabase
            .from('std_work_skill_mapping')
            .select(`
              wsm_id,
              sc_name,
              std_skill_combinations!inner(
                skill_combination
              )
            `)
            .eq('derived_sw_code', derivedSwCode)
            .eq('is_deleted', false)
            .eq('is_active', true);

          if (allMappings && allMappings.length > 0) {
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
          }
        } catch (error) {
          console.error('Error fetching skill mappings:', error);
        }

        if (!matchingWsm) {
          return { ...report, skillTimeStandard: null, skillMapping: null, vehicleWorkFlow: vehicleWorkFlow };
        }

        // Get skill time standard
        let skillTimeStandard = null;
        try {
          const { data: stsData } = await supabase
            .from('std_skill_time_standards')
            .select('*')
            .eq('wsm_id', matchingWsm.wsm_id)
            .eq('skill_short', scRequired)
            .eq('is_deleted', false)
            .eq('is_active', true)
            .maybeSingle();
          skillTimeStandard = stsData;
        } catch (error) {
          console.error('Error fetching skill time standard:', error);
        }

        return {
          ...report,
          skillTimeStandard: skillTimeStandard,
          skillMapping: matchingWsm,
          vehicleWorkFlow: vehicleWorkFlow
        };
      })
    );
    
    return { workReports: enrichedWorkReports, manpowerReports };
  } catch (error) {
    console.error('Error loading draft report data:', error);
    return { workReports: [], manpowerReports: [] };
  }
}

/**
 * Load shift break times
 */
export async function loadShiftBreakTimesData(selectedDate: string) {
  if (!selectedDate) return [];
  
  try {
    return await loadShiftBreakTimes(selectedDate);
  } catch (error) {
    console.error('Error loading shift break times:', error);
    return [];
  }
}

