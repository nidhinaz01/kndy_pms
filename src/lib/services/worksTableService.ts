import { supabase } from '$lib/supabaseClient';
import { canPlanWork } from '$lib/api/production';
import type { WorkPlanningStatus, WorkStatus } from '$lib/types/worksTable';
import { parseUTCDate } from '$lib/utils/formatDate';

export async function checkWorkStatus(
  works: any[],
  stageCode: string,
  selectedDate?: string
): Promise<{ [key: string]: WorkStatus }> {
  const workStatus: { [key: string]: WorkStatus } = {};
  
  // Format selectedDate if provided
  let dateStr: string | undefined;
  if (selectedDate) {
    if (typeof selectedDate === 'string') {
      dateStr = selectedDate.split('T')[0];
    } else if (selectedDate && typeof selectedDate === 'object' && 'toISOString' in selectedDate) {
      dateStr = (selectedDate as Date).toISOString().split('T')[0];
    } else {
      dateStr = String(selectedDate || '').split('T')[0];
    }
  }
  
  for (const work of works) {
    const hasDerivedSwCode = !!work.std_work_type_details?.derived_sw_code;
    const isNonStandardWork = work.is_added_work === true || !hasDerivedSwCode;
    
    const derivedSwCode = hasDerivedSwCode ? work.std_work_type_details.derived_sw_code : null;
    const otherWorkCode = isNonStandardWork ? (work.sw_code || null) : null;
    const workCode = derivedSwCode || otherWorkCode || 'Unknown';
    const woDetailsId = work.wo_details_id;
    const workKey = `${workCode}_${stageCode}`;
    
    try {
      if (!woDetailsId || !workCode || workCode === 'Unknown') {
        workStatus[workKey] = 'To be planned';
        continue;
      }

      const { data: statusData, error: statusError } = await supabase
        .from('prdn_work_status')
        .select('current_status')
        .eq('stage_code', stageCode)
        .eq('wo_details_id', woDetailsId)
        .or(`derived_sw_code.eq.${workCode},other_work_code.eq.${workCode}`)
        .maybeSingle();

      // Only use status from prdn_work_status if it's a definitive status (not 'To be Planned')
      // If it's 'To be Planned', we need to check prdn_work_planning to see if there are actual plans
      if (!statusError && statusData?.current_status) {
        const dbStatus = statusData.current_status;
        if (dbStatus === 'Planned') {
          workStatus[workKey] = 'Planned';
          continue;
        } else if (dbStatus === 'In Progress') {
          workStatus[workKey] = 'In progress';
          continue;
        } else if (dbStatus === 'Completed') {
          workStatus[workKey] = 'Completed';
          continue;
        } else if (dbStatus === 'Draft Plan') {
          // If status says 'Draft Plan', use it but still check planning table to be sure
          // (fall through to planning check)
        }
        // If status is 'To be Planned', continue to check planning table
      }

      // First, check for plans on the selected date
      let planningQuery = supabase
        .from('prdn_work_planning')
        .select('id, status, from_date')
        .eq('stage_code', stageCode)
        .eq('is_deleted', false)
        .eq('is_active', true);
      
      if (derivedSwCode) {
        planningQuery = planningQuery.eq('derived_sw_code', derivedSwCode);
      } else if (otherWorkCode) {
        planningQuery = planningQuery.eq('other_work_code', otherWorkCode);
      } else {
        workStatus[workKey] = 'To be planned';
        continue;
      }

      // Filter by date if provided
      if (dateStr) {
        console.log(`🔍 checkWorkStatus: Filtering by from_date = ${dateStr} for work ${workCode}`);
        planningQuery = planningQuery.eq('from_date', dateStr);
      } else {
        console.log(`🔍 checkWorkStatus: No date filter for work ${workCode}`);
      }

      const { data: planningData, error: planningError } = await planningQuery;

      console.log(`🔍 checkWorkStatus: Found ${planningData?.length || 0} planning records for work ${workCode} on date ${dateStr || 'any'}`);
      if (planningData && planningData.length > 0) {
        console.log(`🔍 checkWorkStatus: Planning data:`, planningData.map(p => ({ id: p.id, status: p.status, from_date: p.from_date })));
      }

      // If no plans found for selected date, check if there are any plans for this work at all
      if ((planningError || !planningData || planningData.length === 0) && dateStr) {
        console.log(`🔍 checkWorkStatus: No plans for selected date ${dateStr}, checking for any plans for work ${workCode}`);
        
        let anyDateQuery = supabase
          .from('prdn_work_planning')
          .select('id, status, from_date')
          .eq('stage_code', stageCode)
          .eq('is_deleted', false)
          .eq('is_active', true);
        
        if (derivedSwCode) {
          anyDateQuery = anyDateQuery.eq('derived_sw_code', derivedSwCode);
        } else if (otherWorkCode) {
          anyDateQuery = anyDateQuery.eq('other_work_code', otherWorkCode);
        }
        
        const { data: anyDateData } = await anyDateQuery;
        
        if (anyDateData && anyDateData.length > 0) {
          console.log(`🔍 checkWorkStatus: Found ${anyDateData.length} plans for other dates, checking status`);
          const hasDraftPlans = anyDateData.some(p => p.status === 'draft');
          const hasPendingApprovalPlans = anyDateData.some(p => p.status === 'pending_approval');
          const hasApprovedPlans = anyDateData.some(p => p.status === 'approved');
          
          // Priority: pending_approval > draft > approved
          if (hasPendingApprovalPlans && !hasApprovedPlans) {
            console.log(`🔍 checkWorkStatus: Setting status to 'Plan Pending Approval' (from other dates) for work ${workCode}`);
            workStatus[workKey] = 'Plan Pending Approval';
            continue;
          } else if (hasDraftPlans && !hasPendingApprovalPlans && !hasApprovedPlans) {
            console.log(`🔍 checkWorkStatus: Setting status to 'Draft Plan' (from other dates) for work ${workCode}`);
            workStatus[workKey] = 'Draft Plan';
            continue;
          }
        }
        
        console.log(`🔍 checkWorkStatus: No planning data found, setting status to 'Yet to be planned' for work ${workCode}`);
        workStatus[workKey] = 'To be planned';
        continue;
      } else if (planningError || !planningData || planningData.length === 0) {
        console.log(`🔍 checkWorkStatus: No planning data found, setting status to 'Yet to be planned' for work ${workCode}`);
        workStatus[workKey] = 'To be planned';
        continue;
      }

      // Check plan statuses separately
      const hasDraftPlans = planningData.some(p => p.status === 'draft');
      const hasPendingApprovalPlans = planningData.some(p => p.status === 'pending_approval');
      const hasApprovedPlans = planningData.some(p => p.status === 'approved');
      const hasRejectedPlans = planningData.some(p => p.status === 'rejected');
      
      console.log(`🔍 checkWorkStatus: hasDraftPlans=${hasDraftPlans}, hasPendingApprovalPlans=${hasPendingApprovalPlans}, hasApprovedPlans=${hasApprovedPlans}, hasRejectedPlans=${hasRejectedPlans} for work ${workCode}`);
      
      // Priority order:
      // 1. If there are pending_approval plans (and no approved), show "Plan Pending Approval"
      // 2. If there are only draft plans, show "Draft Plan"
      // 3. If there are rejected plans (and no pending/approved), show "Draft Plan" (can be re-planned)
      // 4. If there are approved plans, continue to check reporting status
      
      if (hasPendingApprovalPlans && !hasApprovedPlans) {
        console.log(`🔍 checkWorkStatus: Setting status to 'Plan Pending Approval' for work ${workCode}`);
        workStatus[workKey] = 'Plan Pending Approval';
        continue;
      }
      
      if (hasDraftPlans && !hasPendingApprovalPlans && !hasApprovedPlans) {
        console.log(`🔍 checkWorkStatus: Setting status to 'Draft Plan' for work ${workCode}`);
        workStatus[workKey] = 'Draft Plan';
        continue;
      }

      if (hasRejectedPlans && !hasPendingApprovalPlans && !hasApprovedPlans && !hasDraftPlans) {
        console.log(`🔍 checkWorkStatus: Setting status to 'Draft Plan' (rejected, can be re-planned) for work ${workCode}`);
        workStatus[workKey] = 'Draft Plan';
        continue;
      }

      // Use only approved plans for further checks (reporting, completion status, etc.)
      const approvedPlans = planningData.filter(p => p.status === 'approved');
      const planningDataToUse = approvedPlans.length > 0 ? approvedPlans : planningData;

      const { data: reportingData, error: reportingError } = await supabase
        .from('prdn_work_reporting')
        .select('id, planning_id, created_dt')
        .in('planning_id', planningDataToUse.map(p => p.id))
        .eq('is_deleted', false);

      if (reportingError || !reportingData || reportingData.length === 0) {
        // If there are draft plans but also approved plans, show "Planned"
        // If only draft plans exist, we already handled that above
        workStatus[workKey] = 'Planned';
        continue;
      }

      const allPlannedWorksReported = planningDataToUse.every(plan => 
        reportingData.some(report => (report as any).planning_id === plan.id)
      );

      if (allPlannedWorksReported) {
        const { data: completedReports, error: completedError } = await supabase
          .from('prdn_work_reporting')
          .select('completion_status')
          .in('planning_id', planningDataToUse.map(p => p.id))
          .eq('is_deleted', false);

        if (completedError) {
          workStatus[workKey] = 'In progress';
          continue;
        }

        const allReportsCompleted = completedReports?.every(report => 
          report.completion_status === 'C'
        ) || false;

        if (allReportsCompleted) {
          workStatus[workKey] = 'Completed';
        } else {
          let newerPlanningQuery = supabase
            .from('prdn_work_planning')
            .select('id, created_dt')
            .eq('stage_code', stageCode)
            .eq('is_deleted', false)
            .order('created_dt', { ascending: false })
            .limit(1);

          if (derivedSwCode) {
            newerPlanningQuery = newerPlanningQuery.eq('derived_sw_code', derivedSwCode);
          } else if (otherWorkCode) {
            newerPlanningQuery = newerPlanningQuery.eq('other_work_code', otherWorkCode);
          }

          const { data: newerPlanningData, error: newerPlanningError } = await newerPlanningQuery;

          if (newerPlanningError) {
            workStatus[workKey] = 'In progress';
            continue;
          }

          const latestReportDate = reportingData?.reduce((latest, report) => {
            const reportDate = parseUTCDate((report as any).created_dt || '1970-01-01T00:00:00Z');
            return reportDate > latest ? reportDate : latest;
          }, new Date(0));

          const hasNewerPlanning = newerPlanningData?.some(plan => {
            const planDate = parseUTCDate(plan.created_dt);
            return planDate > latestReportDate;
          }) || false;

          workStatus[workKey] = hasNewerPlanning ? 'Planned' : 'In progress';
        }
      } else {
        workStatus[workKey] = 'In progress';
      }
    } catch (error) {
      console.error(`Error checking work status for ${workCode}:`, error);
      workStatus[workKey] = 'Yet to be planned';
    }
  }
  
  return workStatus;
}

export async function checkPlanningStatus(
  works: any[],
  stageCode: string
): Promise<{ [key: string]: WorkPlanningStatus }> {
  const workPlanningStatus: { [key: string]: WorkPlanningStatus } = {};
  
  for (const work of works) {
    const hasDerivedSwCode = !!work.std_work_type_details?.derived_sw_code;
    const isNonStandardWork = work.is_added_work === true || !hasDerivedSwCode;
    
    const derivedSwCode = hasDerivedSwCode ? work.std_work_type_details.derived_sw_code : null;
    const otherWorkCode = isNonStandardWork ? (work.sw_code || null) : null;
    const workCode = derivedSwCode || otherWorkCode || 'Unknown';
    const woDetailsId = work.wo_details_id;
    const workKey = `${workCode}_${stageCode}`;
    
    try {
      const validation = await canPlanWork(derivedSwCode, stageCode, woDetailsId, otherWorkCode);
      workPlanningStatus[workKey] = validation;
    } catch (error) {
      workPlanningStatus[workKey] = { 
        canPlan: false, 
        reason: `Error checking status: ${(error as Error)?.message || 'Unknown error'}` 
      };
    }
  }
  
  return workPlanningStatus;
}

