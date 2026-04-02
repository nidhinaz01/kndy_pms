import { loadStageWorkOrdersSnapshot, loadStageWorksSnapshot, loadStagePlannedWorks, loadStageManpower, loadShiftBreakTimes } from '../../services/stageProductionService';
import { getDraftWorkPlans, getDraftManpowerPlans, getDraftWorkReports, getDraftManpowerReports } from '$lib/api/production/planningReportingService';
import { supabase } from '$lib/supabaseClient';
import { submissionStatusCache } from './submissionStatusCache';

/**
 * Load work orders data
 */
export async function loadWorkOrdersData(stageCode: string, selectedDate: string) {
  try {
    console.log(`🔍 Loading work orders snapshot for ${stageCode}`);
    const data = await loadStageWorkOrdersSnapshot(stageCode);
    console.log(`📦 Active Work Orders snapshot found for ${stageCode}:`, data.length);
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
  try {
    return await loadStageWorksSnapshot(stageCode);
  } catch (error) {
    console.error('Error loading works data:', error);
    return [];
  }
}

/**
 * Load planned works data
 */
/**
 * Fetch cumulative "time worked till date" from prdn_work_reporting for the same work (wo_details_id + work_code)
 * on prior dates, and return a map keyed by `${wo_details_id}_${workCode}` with total hours (decimal).
 * Used to show correct time worked on Plan tab and in Report modal when the plan row has no prior report.
 */
async function fetchReportingTimeWorkedTillDate(
  stageCode: string,
  shiftCode: string,
  dateStr: string,
  plannedWorks: any[]
): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  if (!plannedWorks?.length) return map;

  const woDetailsIds = [...new Set(plannedWorks.map((p: any) => p.wo_details_id).filter(Boolean))];
  if (woDetailsIds.length === 0) return map;

  try {
    const { data: reports, error } = await supabase
      .from('prdn_work_reporting')
      .select(`
        from_date,
        hours_worked_till_date,
        hours_worked_today,
        prdn_work_planning!inner(
          wo_details_id,
          derived_sw_code,
          other_work_code,
          from_date,
          stage_code
        )
      `)
      .eq('prdn_work_planning.stage_code', stageCode)
      .eq('prdn_work_planning.shift_code', shiftCode)
      .lt('prdn_work_planning.from_date', dateStr)
      .eq('is_active', true)
      .eq('is_deleted', false)
      .in('prdn_work_planning.wo_details_id', woDetailsIds)
      .order('from_date', { ascending: false });

    if (error) {
      console.warn('fetchReportingTimeWorkedTillDate:', error.message);
      return map;
    }

    const list = reports || [];
    const byKey = new Map<string, { from_date: string; hours_worked_till_date: number; hours_worked_today: number }>();
    for (const r of list) {
      const planning = r.prdn_work_planning as any;
      if (!planning) continue;
      const workCode = planning.derived_sw_code || planning.other_work_code;
      if (!workCode) continue;
      const key = `${planning.wo_details_id}_${workCode}`;
      if (!byKey.has(key)) {
        const totalHours = (Number(r.hours_worked_till_date) || 0) + (Number(r.hours_worked_today) || 0);
        byKey.set(key, {
          from_date: r.from_date,
          hours_worked_till_date: Number(r.hours_worked_till_date) || 0,
          hours_worked_today: Number(r.hours_worked_today) || 0
        });
      }
    }
    byKey.forEach((v, key) => {
      map.set(key, v.hours_worked_till_date + v.hours_worked_today);
    });
  } catch (e) {
    console.warn('fetchReportingTimeWorkedTillDate error:', e);
  }
  return map;
}

/**
 * Load cancelled works for Plan tab (they should still be visible)
 */
async function loadStagePlannedWorksWithCancelled(stageCode: string, shiftCode: string, date: string): Promise<any[]> {
  try {
    const dateStr = date.split('T')[0];
    
    // Fetch cancelled works (is_deleted=true, status='cancelled')
    const { data, error } = await supabase
      .from('prdn_work_planning')
      .select(`
        *,
        hr_emp!inner(
          emp_id,
          emp_name,
          skill_short
        ),
        std_work_type_details(
          derived_sw_code,
          sw_code,
          type_description,
          std_work_details(sw_name)
        ),
        prdn_wo_details!inner(
          wo_no,
          pwo_no,
          wo_model,
          customer_name
        ),
        std_work_skill_mapping(
          wsm_id,
          sc_name
        )
      `)
      .eq('stage_code', stageCode)
      .eq('shift_code', shiftCode)
      .eq('from_date', dateStr)
      .eq('status', 'cancelled')
      .eq('is_deleted', true)
      .eq('is_active', true)
      .order('from_time', { ascending: true });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error loading cancelled planned works:', error);
    return [];
  }
}

export async function loadPlannedWorksData(stageCode: string, shiftCode: string, selectedDate: string) {
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
    
    // Load approved works
    const approvedData = await loadStagePlannedWorks(stageCode, dateStr, 'approved', shiftCode);
    
    // Also load cancelled works (they should still appear in Plan tab)
    const cancelledData = await loadStagePlannedWorksWithCancelled(stageCode, shiftCode, dateStr);
    
    // Combine both, with cancelled works marked
    const data = [
      ...approvedData.map(w => ({ ...w, isCancelled: false })),
      ...cancelledData.map(w => ({ ...w, isCancelled: true }))
    ];
    console.log(`📋 Loaded ${data.length} planned works for ${stageCode} on ${dateStr}`);
    
    // Enrich with skill-specific time standards and vehicle work flow using batch queries
    const { batchEnrichItems } = await import('$lib/utils/workEnrichmentService');
    let enrichedPlannedWorks = await batchEnrichItems(data || [], stageCode);

    // Enrich time_worked_till_date from prdn_work_reporting (cumulative hours from prior reports for same work)
    const reportingTillDateMap = await fetchReportingTimeWorkedTillDate(stageCode, shiftCode, dateStr, enrichedPlannedWorks);
    if (reportingTillDateMap.size > 0) {
      enrichedPlannedWorks = enrichedPlannedWorks.map((p: any) => {
        const workCode = p.derived_sw_code || p.other_work_code;
        const key = workCode ? `${p.wo_details_id}_${workCode}` : null;
        const fromReporting = key ? reportingTillDateMap.get(key) : undefined;
        if (fromReporting !== undefined) {
          return { ...p, time_worked_till_date: fromReporting };
        }
        return p;
      });
    }

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
 * Optimized: Uses cache to avoid duplicate queries
 */
export async function getPlanningSubmissionStatus(stageCode: string, shiftCode: string, planningDate: string) {
  try {
    let dateStr: string;
    if (typeof planningDate === 'string') {
      dateStr = planningDate.split('T')[0];
    } else if (planningDate && typeof planningDate === 'object' && 'toISOString' in planningDate) {
      dateStr = (planningDate as Date).toISOString().split('T')[0];
    } else {
      dateStr = String(planningDate || '').split('T')[0];
    }

    // Check cache first
    const cached = submissionStatusCache.get(stageCode, shiftCode, dateStr, 'planning');
    if (cached !== null) {
      return cached;
    }

    // Get the latest submission (highest version number)
    const { data, error } = await supabase
      .from('prdn_planning_submissions')
      .select('id, status, submitted_dt, reviewed_dt, reviewed_by, rejection_reason, version')
      .eq('stage_code', stageCode)
      .eq('shift_code', shiftCode)
      .eq('planning_date', dateStr)
      .eq('is_deleted', false)
      .order('version', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
      console.error('Error fetching planning submission status:', error);
      return null;
    }

    const result = data || null;
    
    // Cache the result
    submissionStatusCache.set(stageCode, shiftCode, dateStr, 'planning', result);

    if (data) {
      console.log(`📋 Latest submission for ${stageCode} on ${dateStr}:`, {
        id: data.id,
        status: data.status,
        submitted_dt: data.submitted_dt
      });
    }

    return result;
  } catch (error) {
    console.error('Error getting planning submission status:', error);
    return null;
  }
}

/**
 * Get reporting submission status for a stage and date
 * Returns the latest version (highest version number)
 * Optimized: Uses cache to avoid duplicate queries
 */
export async function getReportingSubmissionStatus(stageCode: string, shiftCode: string, reportingDate: string) {
  try {
    let dateStr: string;
    if (typeof reportingDate === 'string') {
      dateStr = reportingDate.split('T')[0];
    } else if (reportingDate && typeof reportingDate === 'object' && 'toISOString' in reportingDate) {
      dateStr = (reportingDate as Date).toISOString().split('T')[0];
    } else {
      dateStr = String(reportingDate || '').split('T')[0];
    }

    // Check cache first
    const cached = submissionStatusCache.get(stageCode, shiftCode, dateStr, 'reporting');
    if (cached !== null) {
      return cached;
    }

    // Get the latest version (max version number) for this stage-date
    const { data, error } = await supabase
      .from('prdn_reporting_submissions')
      .select('id, status, submitted_dt, reviewed_dt, reviewed_by, rejection_reason, version')
      .eq('stage_code', stageCode)
      .eq('shift_code', shiftCode)
      .eq('reporting_date', dateStr)
      .eq('is_deleted', false)
      .order('version', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
      console.error('Error fetching reporting submission status:', error);
      return null;
    }

    const result = data || null;
    
    // Cache the result
    submissionStatusCache.set(stageCode, shiftCode, dateStr, 'reporting', result);

    return result;
  } catch (error) {
    console.error('Error getting reporting submission status:', error);
    return null;
  }
}

/**
 * Batch fetch both planning and reporting submission statuses in parallel
 * Optimized: Fetches both in parallel and uses cache
 */
export async function getBothSubmissionStatuses(stageCode: string, shiftCode: string, date: string) {
  const [planningStatus, reportingStatus] = await Promise.all([
    getPlanningSubmissionStatus(stageCode, shiftCode, date),
    getReportingSubmissionStatus(stageCode, shiftCode, date)
  ]);
  
  return { planningStatus, reportingStatus };
}

/**
 * Load draft plan data
 */
export async function loadDraftPlanData(stageCode: string, shiftCode: string, selectedDate: string) {
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
      getDraftWorkPlans(stageCode, dateStr, shiftCode),
      getDraftManpowerPlans(stageCode, dateStr, shiftCode)
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
export async function loadDraftReportData(stageCode: string, shiftCode: string, selectedDate: string) {
  if (!selectedDate) return { workReports: [], manpowerReports: [] };
  
  try {
    let dateStr: string;
    if (typeof selectedDate === 'string') {
      dateStr = selectedDate.split('T')[0];
    } else {
      dateStr = new Date(selectedDate).toISOString().split('T')[0];
    }
    
    const [rawWorkReports, manpowerReports] = await Promise.all([
      getDraftWorkReports(stageCode, dateStr, shiftCode),
      getDraftManpowerReports(stageCode, dateStr, shiftCode)
    ]);
    
    // Load deviations for all reports
    const reportIds = (rawWorkReports || []).map((r: any) => r.id).filter(Boolean);
    let deviationsMap = new Map<number, any[]>();
    if (reportIds.length > 0) {
      const { getDeviationsForReportings } = await import('$lib/services/workReportingDeviationService');
      deviationsMap = await getDeviationsForReportings(reportIds);
    }
    
    // Attach deviations to reports first
    (rawWorkReports || []).forEach(report => {
      const deviations = deviationsMap.get(report.id) || [];
      report.deviations = deviations;
    });
    
    // Enrich work reports with skill-specific time standards and vehicle work flow using batch queries
    const { batchEnrichItems } = await import('$lib/utils/workEnrichmentService');
    const enrichedWorkReports = await batchEnrichItems(rawWorkReports || [], stageCode);
    
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

