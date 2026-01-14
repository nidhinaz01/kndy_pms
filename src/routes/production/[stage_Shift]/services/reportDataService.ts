import { supabase } from '$lib/supabaseClient';

/**
 * Load report data
 */
export async function loadReportData(stageCode: string, selectedDate: string) {
  if (!selectedDate) return [];
  
  try {
    const { data, error } = await supabase
      .from('prdn_work_reporting')
      .select(`
        *,
        prdn_work_planning!inner(
          *,
          std_work_type_details(
            *,
            std_work_details(sw_name)
          ),
          hr_emp!inner(emp_name, skill_short),
          prdn_wo_details!inner(wo_no, pwo_no, wo_model, customer_name),
          std_work_skill_mapping(
            wsm_id,
            sc_name
          )
        )
      `)
      .eq('prdn_work_planning.stage_code', stageCode)
      .gte('from_date', selectedDate)
      .lte('from_date', selectedDate)
      .eq('status', 'approved')
      .eq('is_deleted', false);
    
    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error loading report data:', error);
    return [];
  }
}

/**
 * Calculate planned works status
 * Optimized: Batch fetch all reporting statuses in one query instead of N queries
 */
export async function calculatePlannedWorksStatus(plannedWorksData: any[]) {
  if (!plannedWorksData || plannedWorksData.length === 0) {
    return [];
  }
  
  // Extract all planning IDs
  const planningIds = plannedWorksData.map(work => work.id).filter(Boolean);
  
  if (planningIds.length === 0) {
    // No valid planning IDs, return all as 'Planned'
    return plannedWorksData.map(plannedWork => ({ ...plannedWork, workLifecycleStatus: 'Planned' }));
  }
  
  // Batch fetch all reporting data in one query
  const { data: allReportData, error } = await supabase
    .from('prdn_work_reporting')
    .select('planning_id, completion_status')
    .in('planning_id', planningIds)
    .eq('is_deleted', false);
  
  if (error) {
    console.error('Error batch fetching reporting statuses:', error);
    // Fallback to original behavior - return all as 'Planned' on error
    return plannedWorksData.map(plannedWork => ({ ...plannedWork, workLifecycleStatus: 'Planned' }));
  }
  
  // Create a map: planning_id -> completion_status
  const reportingStatusMap = new Map<number, string>();
  (allReportData || []).forEach(report => {
    if (report.planning_id) {
      reportingStatusMap.set(report.planning_id, report.completion_status || '');
    }
  });
  
  // Map planned works with their status
  const worksWithStatus = plannedWorksData.map(plannedWork => {
    const completionStatus = reportingStatusMap.get(plannedWork.id);
    
    if (!completionStatus) {
      return { ...plannedWork, workLifecycleStatus: 'Planned' };
    }
    if (completionStatus === 'NC') {
      return { ...plannedWork, workLifecycleStatus: 'In progress' };
    }
    return { ...plannedWork, workLifecycleStatus: 'Completed' };
  });
  
  return worksWithStatus;
}

