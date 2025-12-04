import { supabase } from '$lib/supabaseClient';
import { getCurrentUsername, getCurrentTimestamp } from '$lib/utils/userUtils';
import { calculateBreakTimeInMinutes } from '$lib/utils/breakTimeUtils';
import { calculateActualTime } from '$lib/utils/multiSkillReportUtils';
import { calculateLostTime } from '$lib/utils/reportWorkUtils';

/**
 * Convert approved plans to draft reports
 * This creates draft reports from all approved plans for a given stage and date
 */
export async function convertPlanToDraftReport(
  stageCode: string,
  reportingDate: string,
  shiftBreakTimes: Array<{ start_time: string; end_time: string }> = []
): Promise<{ success: boolean; createdReports: number; errors: string[] }> {
  const errors: string[] = [];
  let createdReports = 0;

  try {
    const currentUser = getCurrentUsername();
    const now = getCurrentTimestamp();

    // Get all approved plans for this stage and date
    const { data: approvedPlans, error: plansError } = await supabase
      .from('prdn_work_planning')
      .select(`
        *,
        hr_emp(emp_id, emp_name, skill_short),
        std_work_type_details(derived_sw_code, sw_code),
        prdn_wo_details(wo_no, pwo_no),
        std_work_skill_mapping(sc_name),
        vehicle_work_flow(estimated_duration_minutes),
        skill_time_standard(standard_time_minutes)
      `)
      .eq('stage_code', stageCode)
      .eq('from_date', reportingDate)
      .eq('status', 'approved')
      .eq('is_deleted', false)
      .eq('is_active', true);

    if (plansError) {
      return { success: false, createdReports: 0, errors: [plansError.message] };
    }

    if (!approvedPlans || approvedPlans.length === 0) {
      return { success: true, createdReports: 0, errors: ['No approved plans found to convert'] };
    }

    // Check which plans already have draft reports
    const planIds = approvedPlans.map(p => p.id);
    const { data: existingReports, error: reportsError } = await supabase
      .from('prdn_work_reporting')
      .select('planning_id')
      .in('planning_id', planIds)
      .eq('status', 'draft')
      .eq('is_deleted', false);

    if (reportsError) {
      return { success: false, createdReports: 0, errors: [reportsError.message] };
    }

    const existingReportPlanIds = new Set((existingReports || []).map(r => r.planning_id));

    // Create draft reports for plans that don't have reports yet
    const reportsToCreate = approvedPlans
      .filter(plan => !existingReportPlanIds.has(plan.id))
      .map(plan => {
        // Calculate hours worked today from planned time
        const fromTime = plan.from_time || '00:00';
        const toTime = plan.to_time || '00:00';
        
        // Calculate actual time worked (including breaks)
        const actualTimeMinutes = calculateActualTime(
          reportingDate,
          fromTime,
          reportingDate,
          toTime,
          shiftBreakTimes
        );

        // Calculate break time
        const breakMinutes = calculateBreakTimeInMinutes(fromTime, toTime, shiftBreakTimes);
        
        // Hours worked today = actual time - break time
        const hoursWorkedToday = Math.max(0, (actualTimeMinutes - breakMinutes) / 60);

        // Get standard time
        const standardTimeMinutes = plan.skill_time_standard?.standard_time_minutes || 
                                   plan.vehicle_work_flow?.estimated_duration_minutes || 0;

        // Calculate lost time
        // For initial conversion, assume work is not completed (NC) - user can update later
        const completionStatus: 'C' | 'NC' = 'NC';
        const ltMinutes = calculateLostTime(standardTimeMinutes, actualTimeMinutes, completionStatus);

        return {
          planning_id: plan.id,
          worker_id: plan.worker_id,
          from_date: reportingDate,
          from_time: fromTime,
          to_date: reportingDate,
          to_time: toTime,
          hours_worked_till_date: plan.time_worked_till_date || 0,
          hours_worked_today: hoursWorkedToday,
          completion_status: completionStatus,
          lt_minutes_total: ltMinutes,
          lt_details: ltMinutes > 0 ? [] : null, // User can add lost time details later
          lt_comments: '',
          status: 'draft',
          created_by: currentUser,
          created_dt: now,
          modified_by: currentUser,
          modified_dt: now
        };
      });

    if (reportsToCreate.length === 0) {
      return { 
        success: true, 
        createdReports: 0, 
        errors: ['All approved plans already have draft reports'] 
      };
    }

    // Insert all draft reports
    const { data: createdReportsData, error: insertError } = await supabase
      .from('prdn_work_reporting')
      .insert(reportsToCreate)
      .select();

    if (insertError) {
      return { success: false, createdReports: 0, errors: [insertError.message] };
    }

    createdReports = createdReportsData?.length || 0;

    return { success: true, createdReports, errors: [] };
  } catch (error) {
    console.error('Error converting plan to draft report:', error);
    return { 
      success: false, 
      createdReports, 
      errors: [(error as Error).message || 'Unknown error occurred'] 
    };
  }
}

