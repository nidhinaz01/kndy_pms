import { supabase } from '$lib/supabaseClient';
import { canPlanWork } from '$lib/api/production';
import type { WorkPlanningStatus, WorkStatus } from '$lib/types/worksTable';
import { parseUTCDate } from '$lib/utils/formatDate';

/**
 * Optimized batched version that groups works by work code and fetches all data in minimal queries
 */
export async function checkWorkStatus(
  works: any[],
  stageCode: string,
  selectedDate?: string
): Promise<{ [key: string]: WorkStatus }> {
  const workStatus: { [key: string]: WorkStatus } = {};
  
  if (!works || works.length === 0) {
    return workStatus;
  }

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

  // Step 1: Track works individually by work code AND wo_details_id
  const workMap = new Map<string, {
    work: any;
    workCode: string;
    derivedSwCode: string | null;
    otherWorkCode: string | null;
    woDetailsId: number;
    workKey: string;
  }>();

  // Collect unique work codes and wo_details_ids for batch queries
  const uniqueWorkCodes = new Set<string>();
  const uniqueWoDetailsIds = new Set<number>();

  for (const work of works) {
    const hasDerivedSwCode = !!work.std_work_type_details?.derived_sw_code;
    const isNonStandardWork = work.is_added_work === true || !hasDerivedSwCode;
    
    const derivedSwCode = hasDerivedSwCode ? work.std_work_type_details.derived_sw_code : null;
    const otherWorkCode = isNonStandardWork ? (work.sw_code || null) : null;
    const workCode = derivedSwCode || otherWorkCode || 'Unknown';
    const woDetailsId = work.wo_details_id;
    
    // Include wo_details_id in workKey to differentiate between work orders
    const workKey = `${workCode}_${woDetailsId}_${stageCode}`;

    if (!woDetailsId || !workCode || workCode === 'Unknown') {
      workStatus[workKey] = 'To be planned';
      continue;
    }

    workMap.set(workKey, {
      work,
      workCode,
      derivedSwCode,
      otherWorkCode,
      woDetailsId,
      workKey
    });

    uniqueWorkCodes.add(workCode);
    uniqueWoDetailsIds.add(woDetailsId);
  }

  if (workMap.size === 0) {
    return workStatus;
  }

  // Step 2: Batch fetch work status data for all work codes
  const allWorkCodes = Array.from(uniqueWorkCodes);
  const derivedSwCodes = Array.from(workMap.values())
    .map(w => w.derivedSwCode)
    .filter((code): code is string => !!code);
  const otherWorkCodes = Array.from(workMap.values())
    .map(w => w.otherWorkCode)
    .filter((code): code is string => !!code);

  // Batch fetch work status
  let workStatusDataMap = new Map<string, any>();
  try {
    const orConditions: string[] = [];
    if (derivedSwCodes.length > 0) {
      orConditions.push(`derived_sw_code.in.(${derivedSwCodes.join(',')})`);
    }
    if (otherWorkCodes.length > 0) {
      orConditions.push(`other_work_code.in.(${otherWorkCodes.join(',')})`);
    }

    if (orConditions.length > 0 && uniqueWoDetailsIds.size > 0) {
      const { data: statusData } = await supabase
        .from('prdn_work_status')
        .select('derived_sw_code, other_work_code, wo_details_id, current_status')
        .eq('stage_code', stageCode)
        .in('wo_details_id', Array.from(uniqueWoDetailsIds))
        .or(orConditions.join(','));

      if (statusData) {
        statusData.forEach(status => {
          const code = status.derived_sw_code || status.other_work_code;
          const woId = status.wo_details_id;
          if (code && woId) {
            // Key by work code AND wo_details_id
            workStatusDataMap.set(`${code}_${woId}`, status);
          }
        });
      }
    }
  } catch (error) {
    console.error('Error batch fetching work status:', error);
  }

  // Step 3: Batch fetch planning data for selected date
  let planningDataMap = new Map<string, any[]>();
  let anyDatePlanningDataMap = new Map<string, any[]>();

  try {
    const orConditions: string[] = [];
    if (derivedSwCodes.length > 0) {
      orConditions.push(`derived_sw_code.in.(${derivedSwCodes.join(',')})`);
    }
    if (otherWorkCodes.length > 0) {
      orConditions.push(`other_work_code.in.(${otherWorkCodes.join(',')})`);
    }

    if (orConditions.length > 0 && uniqueWoDetailsIds.size > 0) {
      // Fetch plans for selected date (filter by wo_details_id as well)
      if (dateStr) {
        // Build query with wo_details_id filter and work code conditions
        let query = supabase
          .from('prdn_work_planning')
          .select('id, derived_sw_code, other_work_code, wo_details_id, status, from_date, created_dt')
          .eq('stage_code', stageCode)
          .eq('from_date', dateStr)
          .eq('is_deleted', false)
          .eq('is_active', true)
          .in('wo_details_id', Array.from(uniqueWoDetailsIds));
        
        // Apply work code filter
        if (orConditions.length > 0) {
          query = query.or(orConditions.join(','));
        }
        
        const { data: datePlanningData, error: dateError } = await query;

        if (dateError) {
          console.error('Error fetching planning data for date:', dateError);
        }

        if (datePlanningData) {
          datePlanningData.forEach(plan => {
            const code = plan.derived_sw_code || plan.other_work_code;
            const woId = plan.wo_details_id;
            if (code && woId) {
              // Key by work code AND wo_details_id
              const key = `${code}_${woId}`;
              if (!planningDataMap.has(key)) {
                planningDataMap.set(key, []);
              }
              planningDataMap.get(key)!.push(plan);
            }
          });
        }
      }

      // Fetch plans for any date (filter by wo_details_id as well)
      let anyDateQuery = supabase
        .from('prdn_work_planning')
        .select('id, derived_sw_code, other_work_code, wo_details_id, status, from_date, created_dt')
        .eq('stage_code', stageCode)
        .eq('is_deleted', false)
        .eq('is_active', true)
        .in('wo_details_id', Array.from(uniqueWoDetailsIds));
      
      // Apply work code filter
      if (orConditions.length > 0) {
        anyDateQuery = anyDateQuery.or(orConditions.join(','));
      }
      
      const { data: anyDatePlanningData, error: anyDateError } = await anyDateQuery;

      if (anyDateError) {
        console.error('Error fetching any date planning data:', anyDateError);
      }

      if (anyDatePlanningData) {
        anyDatePlanningData.forEach(plan => {
          const code = plan.derived_sw_code || plan.other_work_code;
          const woId = plan.wo_details_id;
          if (code && woId) {
            // Key by work code AND wo_details_id
            const key = `${code}_${woId}`;
            if (!anyDatePlanningDataMap.has(key)) {
              anyDatePlanningDataMap.set(key, []);
            }
            anyDatePlanningDataMap.get(key)!.push(plan);
          }
        });
      }
    }
  } catch (error) {
    console.error('Error batch fetching planning data:', error);
  }

  // Step 4: Batch fetch reporting data for all planning IDs
  const allPlanningIds = Array.from(planningDataMap.values())
    .flat()
    .map(p => p.id)
    .filter((id): id is number => !!id);

  let reportingDataMap = new Map<number, any[]>();
  if (allPlanningIds.length > 0) {
    try {
      const { data: reportingData } = await supabase
        .from('prdn_work_reporting')
        .select('id, planning_id, created_dt, completion_status')
        .in('planning_id', allPlanningIds)
        .eq('is_deleted', false);

      if (reportingData) {
        reportingData.forEach(report => {
          const planningId = report.planning_id;
          if (planningId) {
            if (!reportingDataMap.has(planningId)) {
              reportingDataMap.set(planningId, []);
            }
            reportingDataMap.get(planningId)!.push(report);
          }
        });
      }
    } catch (error) {
      console.error('Error batch fetching reporting data:', error);
    }
  }

  // Step 5: Process each work individually (by work code AND wo_details_id)
  for (const [workKey, workInfo] of workMap.entries()) {
    const { workCode, derivedSwCode, otherWorkCode, woDetailsId } = workInfo;
    
    try {
      // Check work status first (keyed by work code AND wo_details_id)
      // Try both derived_sw_code and other_work_code keys
      let statusKey = `${workCode}_${woDetailsId}`;
      let statusRecord = workStatusDataMap.get(statusKey);
      
      // If not found, try with the alternative work code
      if (!statusRecord && derivedSwCode && otherWorkCode) {
        const altKey = `${otherWorkCode}_${woDetailsId}`;
        statusRecord = workStatusDataMap.get(altKey);
        if (statusRecord) {
          statusKey = altKey;
        }
      }
      if (statusRecord?.current_status) {
        const dbStatus = statusRecord.current_status;
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
          // Respect the database status if it's 'Draft Plan'
          workStatus[workKey] = 'Draft Plan';
          continue;
        }
        // If 'To be Planned' or other status, continue to check planning table
      }

      // Get planning data for this specific work code AND wo_details_id
      // Try all possible work code combinations to find matching planning data
      let planningData: any[] = [];
      let anyDateData: any[] = [];
      
      // Build list of possible keys to try
      const possibleKeys: string[] = [];
      if (workCode) possibleKeys.push(`${workCode}_${woDetailsId}`);
      if (derivedSwCode) possibleKeys.push(`${derivedSwCode}_${woDetailsId}`);
      if (otherWorkCode) possibleKeys.push(`${otherWorkCode}_${woDetailsId}`);
      
      // Remove duplicates
      const uniqueKeys = [...new Set(possibleKeys)];
      
      // Try each key to find planning data
      for (const key of uniqueKeys) {
        const dateData = planningDataMap.get(key) || [];
        const anyDate = anyDatePlanningDataMap.get(key) || [];
        
        if (dateData.length > 0) {
          planningData = dateData;
        }
        if (anyDate.length > 0) {
          anyDateData = anyDate;
        }
        
        // If we found data, we can stop searching
        if (planningData.length > 0 && anyDateData.length > 0) {
          break;
        }
      }
      
      // If no planning data for selected date, check any date planning data
      if (planningData.length === 0 && anyDateData.length > 0) {
        if (dateStr) {
          // If we have a date filter but found plans for other dates, show appropriate status
          const hasDraftPlans = anyDateData.some(p => p.status === 'draft');
          const hasPendingApprovalPlans = anyDateData.some(p => p.status === 'pending_approval');
          const hasApprovedPlans = anyDateData.some(p => p.status === 'approved');
          
          if (hasPendingApprovalPlans && !hasApprovedPlans) {
            workStatus[workKey] = 'Plan Pending Approval';
            continue;
          } else if (hasDraftPlans && !hasPendingApprovalPlans && !hasApprovedPlans) {
            workStatus[workKey] = 'Draft Plan';
            continue;
          }
          // If plans exist but don't match the selected date, show "To be planned" for that date
        } else {
          // No date filter - use any date planning data
          planningData = anyDateData;
        }
      }

      if (planningData.length === 0) {
        workStatus[workKey] = 'To be planned';
        continue;
      }

      // Check plan statuses
      const hasDraftPlans = planningData.some(p => p.status === 'draft');
      const hasPendingApprovalPlans = planningData.some(p => p.status === 'pending_approval');
      const hasApprovedPlans = planningData.some(p => p.status === 'approved');
      const hasRejectedPlans = planningData.some(p => p.status === 'rejected');

      // Priority order: pending_approval > draft > approved
      if (hasPendingApprovalPlans && !hasApprovedPlans) {
        workStatus[workKey] = 'Plan Pending Approval';
        continue;
      }

      if (hasDraftPlans && !hasPendingApprovalPlans && !hasApprovedPlans) {
        workStatus[workKey] = 'Draft Plan';
        continue;
      }

      if (hasRejectedPlans && !hasPendingApprovalPlans && !hasApprovedPlans && !hasDraftPlans) {
        workStatus[workKey] = 'Draft Plan';
        continue;
      }

      // Use only approved plans for further checks
      const approvedPlans = planningData.filter(p => p.status === 'approved');
      const planningDataToUse = approvedPlans.length > 0 ? approvedPlans : planningData;

      // Check reporting status
      const planningIds = planningDataToUse.map(p => p.id);
      const reportsForPlans = planningIds
        .flatMap(id => reportingDataMap.get(id) || [])
        .filter(Boolean);

      if (reportsForPlans.length === 0) {
        workStatus[workKey] = 'Planned';
        continue;
      }

      const allPlannedWorksReported = planningDataToUse.every(plan => 
        reportsForPlans.some(report => report.planning_id === plan.id)
      );

      if (allPlannedWorksReported) {
        const allReportsCompleted = reportsForPlans.every(report => 
          report.completion_status === 'C'
        );

        if (allReportsCompleted) {
          workStatus[workKey] = 'Completed';
        } else {
          // Check if there's newer planning
          const latestReportDate = reportsForPlans.reduce((latest, report) => {
            const reportDate = parseUTCDate(report.created_dt || '1970-01-01T00:00:00Z');
            return reportDate > latest ? reportDate : latest;
          }, new Date(0));

          const latestPlanDate = planningDataToUse.reduce((latest, plan) => {
            const planDate = parseUTCDate(plan.created_dt);
            return planDate > latest ? planDate : latest;
          }, new Date(0));

          const hasNewerPlanning = latestPlanDate > latestReportDate;
          workStatus[workKey] = hasNewerPlanning ? 'Planned' : 'In progress';
        }
      } else {
        workStatus[workKey] = 'In progress';
      }
    } catch (error) {
      console.error(`Error checking work status for ${workCode} (WO: ${woDetailsId}):`, error);
      workStatus[workKey] = 'Yet to be planned';
    }
  }

  return workStatus;
}

/**
 * Optimized batched version of checkPlanningStatus
 * This now batches the canPlanWork checks by grouping works
 */
export async function checkPlanningStatus(
  works: any[],
  stageCode: string
): Promise<{ [key: string]: WorkPlanningStatus }> {
  const workPlanningStatus: { [key: string]: WorkPlanningStatus } = {};
  
  if (!works || works.length === 0) {
    return workPlanningStatus;
  }

  // Track works individually by work code AND wo_details_id
  const workMap = new Map<string, {
    work: any;
    workCode: string;
    derivedSwCode: string | null;
    otherWorkCode: string | null;
    woDetailsId: number;
    workKey: string;
  }>();

  // Collect unique work codes and wo_details_ids for batch queries
  const uniqueWorkCodes = new Set<string>();
  const uniqueWoDetailsIds = new Set<number>();

  for (const work of works) {
    const hasDerivedSwCode = !!work.std_work_type_details?.derived_sw_code;
    const isNonStandardWork = work.is_added_work === true || !hasDerivedSwCode;
    
    const derivedSwCode = hasDerivedSwCode ? work.std_work_type_details.derived_sw_code : null;
    const otherWorkCode = isNonStandardWork ? (work.sw_code || null) : null;
    const workCode = derivedSwCode || otherWorkCode || 'Unknown';
    const woDetailsId = work.wo_details_id;
    
    // Include wo_details_id in workKey to differentiate between work orders
    const workKey = `${workCode}_${woDetailsId}_${stageCode}`;

    if (!woDetailsId || !workCode || workCode === 'Unknown') {
      workPlanningStatus[workKey] = {
        canPlan: false,
        reason: 'Invalid work code or work order ID'
      };
      continue;
    }

    workMap.set(workKey, {
      work,
      workCode,
      derivedSwCode,
      otherWorkCode,
      woDetailsId,
      workKey
    });

    uniqueWorkCodes.add(workCode);
    uniqueWoDetailsIds.add(woDetailsId);
  }

  // Batch fetch removal data
  const derivedSwCodes = Array.from(workMap.values())
    .map(w => w.derivedSwCode)
    .filter((code): code is string => !!code);
  const otherWorkCodes = Array.from(workMap.values())
    .map(w => w.otherWorkCode)
    .filter((code): code is string => !!code);

  let removalDataMap = new Map<string, any>();
  try {
    const orConditions: string[] = [];
    if (derivedSwCodes.length > 0) {
      orConditions.push(`derived_sw_code.in.(${derivedSwCodes.join(',')})`);
    }
    if (otherWorkCodes.length > 0) {
      orConditions.push(`other_work_code.in.(${otherWorkCodes.join(',')})`);
    }

    if (orConditions.length > 0 && uniqueWoDetailsIds.size > 0) {
      const { data: removalData } = await supabase
        .from('prdn_work_removals')
        .select('derived_sw_code, other_work_code, wo_details_id, stage_code, removal_reason')
        .eq('stage_code', stageCode)
        .in('wo_details_id', Array.from(uniqueWoDetailsIds))
        .or(orConditions.join(','));

      if (removalData) {
        removalData.forEach(removal => {
          const code = removal.derived_sw_code || removal.other_work_code;
          const woId = removal.wo_details_id;
          if (code && woId) {
            // Key by work code AND wo_details_id
            removalDataMap.set(`${code}_${woId}`, removal);
          }
        });
      }
    }
  } catch (error) {
    console.error('Error batch fetching removal data:', error);
  }

  // Batch fetch last planning data
  let lastPlanningDataMap = new Map<string, any>();
  try {
    const orConditions: string[] = [];
    if (derivedSwCodes.length > 0) {
      orConditions.push(`derived_sw_code.in.(${derivedSwCodes.join(',')})`);
    }
    if (otherWorkCodes.length > 0) {
      orConditions.push(`other_work_code.in.(${otherWorkCodes.join(',')})`);
    }

    if (orConditions.length > 0 && uniqueWoDetailsIds.size > 0) {
      // Fetch the latest plan for each work code AND wo_details_id combination
      const { data: planningData } = await supabase
        .from('prdn_work_planning')
        .select('id, derived_sw_code, other_work_code, wo_details_id, status, from_date, created_dt')
        .eq('stage_code', stageCode)
        .eq('is_active', true)
        .eq('is_deleted', false)
        .in('wo_details_id', Array.from(uniqueWoDetailsIds))
        .or(orConditions.join(','))
        .order('created_dt', { ascending: false });

      if (planningData) {
        // Group by work code AND wo_details_id and take the first (latest) for each
        const seenKeys = new Set<string>();
        planningData.forEach(plan => {
          const code = plan.derived_sw_code || plan.other_work_code;
          const woId = plan.wo_details_id;
          if (code && woId) {
            const key = `${code}_${woId}`;
            if (!seenKeys.has(key)) {
              lastPlanningDataMap.set(key, plan);
              seenKeys.add(key);
            }
          }
        });
      }
    }
  } catch (error) {
    console.error('Error batch fetching last planning data:', error);
  }

  // Process each work individually (by work code AND wo_details_id)
  for (const [workKey, workInfo] of workMap.entries()) {
    const { workCode, woDetailsId } = workInfo;
    
    try {
      // Check if work is removed (keyed by work code AND wo_details_id)
      const removalKey = `${workCode}_${woDetailsId}`;
      const removal = removalDataMap.get(removalKey);
      if (removal) {
        const reason = `This work has been removed from production. Reason: ${removal.removal_reason || 'Not specified'}`;
        workPlanningStatus[workKey] = {
          canPlan: false,
          reason
        };
        continue;
      }

      // Check last plan status (keyed by work code AND wo_details_id)
      const lastPlan = lastPlanningDataMap.get(removalKey);
      if (lastPlan) {
        if (lastPlan.status === 'draft' || lastPlan.status === 'pending_approval') {
          const reason = `Work already has a ${lastPlan.status} plan from ${lastPlan.from_date}. Please wait for approval or delete the existing plan first.`;
          workPlanningStatus[workKey] = {
            canPlan: false,
            reason,
            lastPlan: lastPlan
          };
          continue;
        }
      }

      // Can plan
      workPlanningStatus[workKey] = {
        canPlan: true
      };
    } catch (error) {
      const reason = `Error checking status: ${(error as Error)?.message || 'Unknown error'}`;
      workPlanningStatus[workKey] = {
        canPlan: false,
        reason
      };
    }
  }

  return workPlanningStatus;
}
