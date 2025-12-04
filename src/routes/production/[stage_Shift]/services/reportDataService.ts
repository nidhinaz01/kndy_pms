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
 */
export async function calculatePlannedWorksStatus(plannedWorksData: any[]) {
  if (!plannedWorksData || plannedWorksData.length === 0) {
    return [];
  }
  
  const worksWithStatus = await Promise.all(
    plannedWorksData.map(async (plannedWork) => {
      const { data: reportData } = await supabase
        .from('prdn_work_reporting')
        .select('id, completion_status')
        .eq('planning_id', plannedWork.id)
        .eq('is_deleted', false)
        .maybeSingle();
      
      if (!reportData) return { ...plannedWork, workLifecycleStatus: 'Planned' };
      if (reportData.completion_status === 'NC') return { ...plannedWork, workLifecycleStatus: 'In progress' };
      return { ...plannedWork, workLifecycleStatus: 'Completed' };
    })
  );
  
  return worksWithStatus;
}

