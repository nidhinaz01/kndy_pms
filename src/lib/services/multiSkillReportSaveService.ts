import { supabase } from '$lib/supabaseClient';
import type { MultiSkillReportFormData, BreakdownData } from '$lib/types/multiSkillReport';
import type { LostTimeReason } from '$lib/api/lostTimeReasons';
import { calculatePieceRateForPlanning } from './pieceRateCalculationService';

export async function saveMultiSkillReports(
  selectedWorks: any[],
  formData: MultiSkillReportFormData,
  lostTimeReasons: LostTimeReason[]
): Promise<{ success: boolean; data?: any[]; error?: string }> {
  try {
    const { getCurrentUsername, getCurrentTimestamp } = await import('$lib/utils/userUtils');
    const currentUser = getCurrentUsername();
    const now = getCurrentTimestamp();
    
    const hoursWorkedToday = formData.actualTimeMinutes / 60;
    
    const hasBreakdown = formData.breakdownData.breakdownItems.length > 0;
    
    // Calculate lt_total for each breakdown item (sum of all workers' lt_value for that item)
    // This is the same across all reports for the same breakdown item
    const breakdownItemTotals = new Map<number, number>(); // reasonId -> total
    
    if (hasBreakdown) {
      formData.breakdownData.breakdownItems.forEach(item => {
        // Sum all worker costs for this breakdown item
        const total = item.workerCosts 
          ? Object.values(item.workerCosts).reduce((sum, cost) => sum + (cost || 0), 0)
          : item.cost; // Fallback to total cost if workerCosts not available
        breakdownItemTotals.set(item.reasonId, Math.round(total * 100) / 100);
      });
    } else if (formData.ltMinutes > 0) {
      // No breakdown - use workerTotals if available
      const selectedReason = lostTimeReasons.find(r => r.id.toString() === formData.ltReasonId);
      if (selectedReason && formData.breakdownData.workerTotals) {
        const total = Object.values(formData.breakdownData.workerTotals).reduce((sum, cost) => sum + (cost || 0), 0);
        breakdownItemTotals.set(parseInt(formData.ltReasonId), Math.round(total * 100) / 100);
      }
    }
    
    // Helper function to calculate lt_details for a specific worker
    const calculateLtDetailsForWorker = (workerId: string | null) => {
      if (formData.ltMinutes === 0) return null;
      
      if (hasBreakdown) {
        // Calculate per-worker lost time from breakdown items
        return formData.breakdownData.breakdownItems.map(item => {
          const reason = lostTimeReasons.find(r => r.id === item.reasonId);
          const isPayable = reason?.p_head === 'Payable';
          
          // Get this worker's cost from workerCosts
          // If worker_id is null (deviation), lt_value = 0
          let workerLtValue = 0;
          if (isPayable && workerId && item.workerCosts?.[workerId] !== undefined) {
            // Use the pre-calculated per-worker cost from LostTimeBreakdown
            workerLtValue = item.workerCosts[workerId];
          } else if (isPayable && workerId) {
            // Fallback: if workerCosts not available, log warning
            // This shouldn't happen if LostTimeBreakdown is working correctly
            console.warn(`⚠️ Worker cost not found in breakdown for ${workerId}. Breakdown item:`, item);
            workerLtValue = 0; // Set to 0 as fallback
          }
          // If workerId is null (deviation case), workerLtValue remains 0
          
          // Get the total for this breakdown item (sum of all workers)
          const ltTotal = breakdownItemTotals.get(item.reasonId) || 0;
          
          return {
            lt_minutes: item.minutes,
            lt_reason: reason?.lost_time_reason || 'Unknown',
            is_lt_payable: isPayable,
            lt_value: Math.round(workerLtValue * 100) / 100, // Per-worker value (0 if no worker)
            lt_total: ltTotal // Total for this breakdown item across all workers
          };
        });
      } else {
        // No breakdown - single reason for all lost time
        // For multi-worker reports, we should always use breakdown, but handle this case
        const selectedReason = lostTimeReasons.find(r => r.id.toString() === formData.ltReasonId);
        const isPayable = selectedReason?.p_head === 'Payable';
        
        // If no breakdown but we have workerTotals from breakdownData, use that
        let workerLtValue = 0;
        let ltTotal = 0;
        
        if (isPayable && workerId && formData.breakdownData.workerTotals?.[workerId] !== undefined) {
          workerLtValue = formData.breakdownData.workerTotals[workerId];
        } else if (isPayable && workerId) {
          // Cannot calculate per-worker without breakdown or workerTotals
          console.warn(`⚠️ Cannot calculate per-worker lost time for ${workerId} without breakdown. Using 0.`);
          workerLtValue = 0;
        }
        // If workerId is null (deviation case), workerLtValue remains 0
        
        // Calculate total from workerTotals if available
        if (formData.breakdownData.workerTotals) {
          ltTotal = Object.values(formData.breakdownData.workerTotals).reduce((sum, cost) => sum + (cost || 0), 0);
          ltTotal = Math.round(ltTotal * 100) / 100;
        } else {
          // Fallback: use the breakdownItemTotals map if available
          const reasonId = parseInt(formData.ltReasonId);
          ltTotal = breakdownItemTotals.get(reasonId) || 0;
        }
        
        return [{
          lt_minutes: formData.ltMinutes,
          lt_reason: selectedReason?.lost_time_reason || 'No reason specified',
          is_lt_payable: isPayable,
          lt_value: Math.round(workerLtValue * 100) / 100, // Per-worker value (0 if no worker)
          lt_total: ltTotal // Total for this reason across all workers
        }];
      }
    };
    
    const reportData = selectedWorks.map(work => {
      const hasDeviation = formData.deviations[work.id]?.hasDeviation || false;
      const workerId = hasDeviation ? null : (formData.skillEmployees[work.id] || null);
      
      // Calculate lt_details specific to this worker
      const workerLtDetails = calculateLtDetailsForWorker(workerId);
      
      return {
        planning_id: work.id,
        worker_id: workerId, // null if deviation, otherwise the assigned worker
        from_date: formData.fromDate,
        from_time: formData.fromTime,
        to_date: formData.toDate,
        to_time: formData.toTime,
        hours_worked_till_date: work.time_worked_till_date || 0,
        hours_worked_today: hoursWorkedToday,
        completion_status: formData.completionStatus,
        lt_minutes_total: formData.ltMinutes,
        lt_details: workerLtDetails, // Per-worker lost time details
        lt_comments: formData.ltComments,
        status: 'draft', // Save as draft
        created_by: currentUser,
        created_dt: now,
        modified_by: currentUser,
        modified_dt: now
      };
    });

    const { data, error } = await supabase
      .from('prdn_work_reporting')
      .insert(reportData)
      .select();

    if (error) {
      return { success: false, error: error.message || 'Unknown error' };
    }

    const savedReports = data || [];
    
    // Calculate piece rate for all planning_ids if any report is completed
    const completedPlanningIds = new Set<number>();
    savedReports.forEach((report: any) => {
      if (report.completion_status === 'C') {
        completedPlanningIds.add(report.planning_id);
      }
    });

    // Calculate piece rate for each completed planning
    for (const planningId of completedPlanningIds) {
      const pieceRateResult = await calculatePieceRateForPlanning(planningId);
      if (!pieceRateResult.success) {
        console.warn(`Piece rate calculation failed for planning ${planningId}:`, pieceRateResult.error);
        // Don't fail the save, just log the warning
      }
    }
    
    // Create deviation records for skills with deviations
    const deviationsToCreate: Array<{
      reporting_id: number;
      planning_id: number;
      deviation_type: 'no_worker' | 'skill_mismatch' | 'exceeds_std_time';
      reason: string;
    }> = [];
    
    savedReports.forEach((report: any) => {
      const work = selectedWorks.find(w => w.id === report.planning_id);
      if (work) {
        const deviation = formData.deviations[work.id];
        if (deviation?.hasDeviation && deviation.reason.trim().length > 0) {
          deviationsToCreate.push({
            reporting_id: report.id,
            planning_id: work.id,
            deviation_type: deviation.deviationType || 'no_worker',
            reason: deviation.reason.trim()
          });
        }
      }
    });
    
    // Create deviation records if any
    if (deviationsToCreate.length > 0) {
      const { createWorkReportingDeviations } = await import('$lib/services/workReportingDeviationService');
      const deviationResult = await createWorkReportingDeviations(deviationsToCreate);
      
      if (!deviationResult.success) {
        console.error('Error creating deviation records:', deviationResult.errors);
        // Don't fail the entire save, but log the error
        // The reports are saved, just the deviation records failed
      } else {
        console.log(`✅ Created ${deviationResult.created} deviation record(s)`);
      }
    }

    return { success: true, data: savedReports };
  } catch (error) {
    return { success: false, error: (error as Error)?.message || 'Unknown error' };
  }
}

export async function updatePlanningStatus(
  planningIds: number[],
  reportDataArray: any[]
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!planningIds || planningIds.length === 0) {
      return { success: false, error: 'No planning IDs provided' };
    }

    const { getCurrentUsername, getCurrentTimestamp } = await import('$lib/utils/userUtils');
    const currentUser = getCurrentUsername();
    const now = getCurrentTimestamp();

    // Create a map of planning_id -> report data for time tracking updates
    const reportMap = new Map<number, any>();
    if (reportDataArray) {
      reportDataArray.forEach((report: any) => {
        if (report.planning_id) {
          reportMap.set(report.planning_id, report);
        }
      });
    }

    // Get existing planning records to update time tracking
    const { data: existingPlans, error: checkError } = await supabase
      .from('prdn_work_planning')
      .select('id, planned_hours, time_worked_till_date')
      .in('id', planningIds)
      .eq('is_deleted', false);

    if (checkError) {
      return { success: false, error: `Error checking planning records: ${checkError.message}` };
    }

    if (!existingPlans || existingPlans.length === 0) {
      return { success: false, error: 'No valid planning records found' };
    }

    // Update each planning record with time tracking (similar to single skill reporting)
    // Don't update status - reports are saved as draft, status will be updated when reporting submission is approved
    const updatePromises = existingPlans.map(async (plan) => {
      const report = reportMap.get(plan.id);
      if (!report) return;

      const hoursWorkedTillDate = report.hours_worked_till_date || plan.time_worked_till_date || 0;
      const hoursWorkedToday = report.hours_worked_today || 0;
      const totalHoursWorked = hoursWorkedTillDate + hoursWorkedToday;
      const plannedHours = plan.planned_hours || 0;
      const remainingTime = Math.max(0, plannedHours - totalHoursWorked);

      // Only update time tracking fields, not status
      const { error } = await supabase
        .from('prdn_work_planning')
        .update({
          time_worked_till_date: report.completion_status === 'NC' ? totalHoursWorked : 0,
          remaining_time: remainingTime,
          modified_by: currentUser,
          modified_dt: now
        })
        .eq('id', plan.id);

      if (error) {
        console.error(`Error updating planning record ${plan.id}:`, error);
        throw error;
      }
    });

    await Promise.all(updatePromises);

    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error)?.message || 'Unknown error' };
  }
}

export async function updateProductionDatesIfFirstReport(reportDataArray: any[]): Promise<void> {
  try {
    if (!reportDataArray || reportDataArray.length === 0) return;

    const reportsByWorkOrder = new Map();
    
    for (const reportData of reportDataArray) {
      const { data: planningData, error: planningError } = await supabase
        .from('prdn_work_planning')
        .select('stage_code, wo_details_id')
        .eq('id', reportData.planning_id)
        .single();

      if (planningError) continue;

      const stageCode = planningData.stage_code;
      const woDetailsId = planningData.wo_details_id;
      const key = `${woDetailsId}_${stageCode}`;

      if (!reportsByWorkOrder.has(key)) {
        reportsByWorkOrder.set(key, {
          woDetailsId,
          stageCode,
          reports: []
        });
      }
      
      reportsByWorkOrder.get(key).reports.push(reportData);
    }

    for (const [key, workOrderData] of reportsByWorkOrder) {
      const { woDetailsId, stageCode, reports } = workOrderData;
      
      const { data: existingReports, error: reportsError } = await supabase
        .from('prdn_work_reporting')
        .select('id')
        .eq('is_deleted', false)
        .in('planning_id', 
          await supabase
            .from('prdn_work_planning')
            .select('id')
            .eq('stage_code', stageCode)
            .eq('wo_details_id', woDetailsId)
            .then(({ data }) => data?.map(p => p.id) || [])
        )
        .order('created_dt', { ascending: true })
        .limit(1);

      if (reportsError) continue;

      const isFirstReport = existingReports && existingReports.length === 1 && 
        reports.some((r: any) => r.id === existingReports[0].id);

      if (isFirstReport) {
        const earliestDate = reports.reduce((earliest: string, report: any) => 
          report.from_date < earliest ? report.from_date : earliest, reports[0].from_date);
        
        const { getCurrentUsername, getCurrentTimestamp } = await import('$lib/utils/userUtils');
        const currentUser = getCurrentUsername();
        const now = getCurrentTimestamp();
        
        await supabase
          .from('prdn_dates')
          .update({
            actual_date: earliestDate,
            modified_by: currentUser,
            modified_dt: now
          })
          .eq('sales_order_id', woDetailsId)
          .eq('stage_code', stageCode)
          .eq('date_type', 'entry');
      }
    }
  } catch (error) {
    console.error('Error in updateProductionDatesIfFirstReport:', error);
  }
}

export async function updateWorkStatus(
  planningIds: number[],
  completionStatus: 'C' | 'NC'
): Promise<void> {
  try {
    const { data: planningRecords, error: planningError } = await supabase
      .from('prdn_work_planning')
      .select('derived_sw_code, other_work_code, wo_details_id, stage_code')
      .in('id', planningIds);

    if (planningError || !planningRecords) return;

    const { getCurrentUsername, getCurrentTimestamp } = await import('$lib/utils/userUtils');
    const currentUser = getCurrentUsername();
    const now = getCurrentTimestamp();

    const newStatus = completionStatus === 'C' ? 'Completed' : 'In Progress';
    
    for (const planningRecord of planningRecords) {
      let statusUpdateQuery = supabase
        .from('prdn_work_status')
        .update({
          current_status: newStatus,
          modified_by: currentUser,
          modified_dt: now
        })
        .eq('stage_code', planningRecord.stage_code)
        .eq('wo_details_id', planningRecord.wo_details_id);

      if (planningRecord.derived_sw_code) {
        statusUpdateQuery = statusUpdateQuery.eq('derived_sw_code', planningRecord.derived_sw_code);
      } else if (planningRecord.other_work_code) {
        statusUpdateQuery = statusUpdateQuery.eq('other_work_code', planningRecord.other_work_code);
      }

      await statusUpdateQuery;
    }
  } catch (error) {
    console.error('Error updating work status:', error);
  }
}

