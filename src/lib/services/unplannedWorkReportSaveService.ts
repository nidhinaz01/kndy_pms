import { supabase } from '$lib/supabaseClient';
import type { MultiSkillReportFormData, BreakdownData } from '$lib/types/multiSkillReport';
import type { LostTimeReason } from '$lib/api/lostTimeReasons';
import { getEffectiveRowTimes } from '$lib/utils/planWorkUtils';
import { netHoursWorkedForReportingRow } from '$lib/utils/multiSkillReportUtils';
import { calculatePieceRateForPlanning } from './pieceRateCalculationService';

/**
 * Save unplanned work reports
 * Creates planning records first (with report_unplanned_work = true), then creates reporting records
 */
export async function saveUnplannedWorkReports(
  selectedWork: any,
  virtualWorks: any[],
  formData: MultiSkillReportFormData,
  lostTimeReasons: LostTimeReason[],
  stageCode: string,
  shiftCode: string,
  shiftBreakTimes: Array<{ start_time: string; end_time: string }> = []
): Promise<{ success: boolean; data?: any[]; error?: string }> {
  try {
    const { getCurrentUsername, getCurrentTimestamp } = await import('$lib/utils/userUtils');
    const currentUser = getCurrentUsername();
    const now = getCurrentTimestamp();
    
    const hasBreakdown = formData.breakdownData.breakdownItems.length > 0;
    
    // Calculate lt_total for each breakdown item
    const breakdownItemTotals = new Map<number, number>();
    
    if (hasBreakdown) {
      formData.breakdownData.breakdownItems.forEach(item => {
        const total = item.workerCosts 
          ? Object.values(item.workerCosts).reduce((sum, cost) => sum + (cost || 0), 0)
          : item.cost;
        breakdownItemTotals.set(item.reasonId, Math.round(total * 100) / 100);
      });
    } else if (formData.ltMinutes > 0) {
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
        return formData.breakdownData.breakdownItems.map(item => {
          const reason = lostTimeReasons.find(r => r.id === item.reasonId);
          const isPayable = reason?.p_head === 'Payable';
          
          let workerLtValue = 0;
          if (isPayable && workerId && item.workerCosts?.[workerId] !== undefined) {
            workerLtValue = item.workerCosts[workerId];
          }
          
          const ltTotal = breakdownItemTotals.get(item.reasonId) || 0;
          
          return {
            lt_minutes: item.minutes,
            lt_reason: reason?.lost_time_reason || 'Unknown',
            is_lt_payable: isPayable,
            lt_value: Math.round(workerLtValue * 100) / 100,
            lt_total: ltTotal
          };
        });
      } else {
        const selectedReason = lostTimeReasons.find(r => r.id.toString() === formData.ltReasonId);
        const isPayable = selectedReason?.p_head === 'Payable';
        
        let workerLtValue = 0;
        let ltTotal = 0;
        
        if (isPayable && workerId && formData.breakdownData.workerTotals?.[workerId] !== undefined) {
          workerLtValue = formData.breakdownData.workerTotals[workerId];
        }
        
        if (formData.breakdownData.workerTotals) {
          ltTotal = Object.values(formData.breakdownData.workerTotals).reduce((sum, cost) => sum + (cost || 0), 0);
          ltTotal = Math.round(ltTotal * 100) / 100;
        }
        
        return [{
          lt_minutes: formData.ltMinutes,
          lt_reason: selectedReason?.lost_time_reason || 'Unknown',
          is_lt_payable: isPayable,
          lt_value: Math.round(workerLtValue * 100) / 100,
          lt_total: ltTotal
        }];
      }
    };
    
    // Extract work details
    const woDetailsId = selectedWork.wo_details_id || selectedWork.prdn_wo_details_id;
    // Treat works as non-standard if they are OW (even when std_work_type_details exists),
    // or if they have other_work_code explicitly.
    const isNonStandardWork = selectedWork.other_work_code
      ? true
      : !!(
          selectedWork.std_work_type_details?.derived_sw_code?.startsWith('OW') ||
          selectedWork.std_work_type_details?.sw_code?.startsWith('OW') ||
          false
        );
    const derivedSwCode = isNonStandardWork
      ? null
      : (selectedWork.derived_sw_code || selectedWork.std_work_type_details?.derived_sw_code || null);
    const otherWorkCode = isNonStandardWork
      ? (selectedWork.other_work_code || selectedWork.sw_code || null)
      : null;

    // For carry-over works: fetch cumulative time worked till date (previous dates only)
    // for the selected workers for this specific work code + WO.
    const dateStr = (formData.fromDate || '').split('T')[0];
    const workerIdsForTillDate = Array.from(
      new Set([
        ...Object.values(formData.skillEmployees).filter(Boolean),
        ...(formData.selectedTrainees || []).map(t => t.emp_id).filter(Boolean)
      ])
    ) as string[];

    const timeWorkedTillDateByWorker: Record<string, number> = {};
    if (dateStr && woDetailsId && workerIdsForTillDate.length > 0 && (derivedSwCode || otherWorkCode)) {
      try {
        let query = supabase
          .from('prdn_work_reporting')
          .select(`
            worker_id,
            hours_worked_till_date,
            hours_worked_today,
            completion_status,
            from_date,
            prdn_work_planning!inner(
              stage_code,
              wo_details_id,
              derived_sw_code,
              other_work_code
            )
          `)
          .eq('prdn_work_planning.stage_code', stageCode)
          .eq('prdn_work_planning.wo_details_id', woDetailsId)
          .in('worker_id', workerIdsForTillDate)
          .lt('from_date', dateStr)
          .eq('is_active', true)
          .eq('is_deleted', false)
          .order('from_date', { ascending: false });

        if (derivedSwCode) {
          query = query.eq('prdn_work_planning.derived_sw_code', derivedSwCode);
        } else if (otherWorkCode) {
          query = query.eq('prdn_work_planning.other_work_code', otherWorkCode);
        }

        const { data: prevReports, error } = await query;
        if (error) throw error;

        for (const r of prevReports || []) {
          const wid = r.worker_id;
          if (!wid || timeWorkedTillDateByWorker[wid] !== undefined) continue;

          const totalHours = (Number(r.hours_worked_till_date) || 0) + (Number(r.hours_worked_today) || 0);
          timeWorkedTillDateByWorker[wid] = r.completion_status === 'NC' ? totalHours : 0;
        }
      } catch (e) {
        console.warn('Error fetching timeWorkedTillDateByWorker for unplanned work:', e);
      }
    }
    
    // Step 1: Create planning records for each skill competency
    const createdPlanningRecords: any[] = [];
    
    for (const virtualWork of virtualWorks) {
      const workerId = formData.skillEmployees[virtualWork.id];
      const deviation = formData.deviations[virtualWork.id];
      
      // Skip if no worker assigned (worker_id is required, cannot be null)
      if (!workerId) {
        continue;
      }
      
      // Get skill required from virtual work
      const scRequired = virtualWork.sc_required || 'T';
      const wsmId = virtualWork.wsm_id;
      
      const eff = getEffectiveRowTimes(String(virtualWork.id), formData);
      const rowHours = netHoursWorkedForReportingRow(eff, shiftBreakTimes);

      const hoursWorkedTillDate = timeWorkedTillDateByWorker[workerId] || 0;
      const totalHoursWorked = hoursWorkedTillDate + rowHours;
      const planningData = {
        stage_code: stageCode,
        shift_code: shiftCode,
        wo_details_id: woDetailsId,
        derived_sw_code: derivedSwCode,
        other_work_code: otherWorkCode,
        sc_required: scRequired,
        worker_id: workerId, // Required, cannot be null
        from_date: eff.fromDate,
        from_time: eff.fromTime,
        to_date: eff.toDate,
        to_time: eff.toTime,
        planned_hours: rowHours,
        time_worked_till_date: formData.completionStatus === 'NC' ? totalHoursWorked : 0,
        remaining_time: Math.max(0, rowHours - totalHoursWorked),
        status: 'approved' as const, // Approved since work is being reported
        notes: 'Unplanned work - created for reporting',
        wsm_id: wsmId,
        report_unplanned_work: true // Mark as unplanned work
      };
      
      const { createWorkPlanning } = await import('$lib/api/production');
      const planningRecord = await createWorkPlanning(planningData, currentUser);
      createdPlanningRecords.push(planningRecord);
      
      // Create deviation record if needed
      if (deviation && deviation.hasDeviation && deviation.reason) {
        const { error: deviationError } = await supabase
          .from('prdn_work_planning_deviations')
          .insert({
            planning_id: planningRecord.id,
            deviation_type: deviation.deviationType === 'no_worker' ? 'no_worker' : 
                           deviation.deviationType === 'skill_mismatch' ? 'skill_mismatch' : 
                           'exceeds_std_time',
            reason: deviation.reason,
            is_active: true,
            is_deleted: false,
            created_by: currentUser,
            created_dt: now
          });
        
        if (deviationError) {
          console.error('Error creating planning deviation:', deviationError);
        }
      }
      
      // Step 2: Create reporting record for this planning record
      const ltDetails = calculateLtDetailsForWorker(workerId);
      
      const reportData = {
        planning_id: planningRecord.id,
        worker_id: workerId, // Required, cannot be null
        from_date: eff.fromDate,
        from_time: eff.fromTime,
        to_date: eff.toDate,
        to_time: eff.toTime,
        // Store till-date before this report (exclude today's hours)
        hours_worked_till_date: hoursWorkedTillDate,
        hours_worked_today: rowHours,
        completion_status: formData.completionStatus,
        lt_minutes_total: formData.ltMinutes,
        lt_details: ltDetails,
        lt_comments: formData.ltComments || '',
        status: 'draft',
        created_by: currentUser,
        created_dt: now,
        modified_by: currentUser,
        modified_dt: now
      };
      
      const { data: reportRecord, error: reportError } = await supabase
        .from('prdn_work_reporting')
        .insert(reportData)
        .select()
        .single();
      
      if (reportError) {
        console.error('Error creating report record:', reportError);
        return { success: false, error: `Failed to create report: ${reportError.message}` };
      }
      
      // Create reporting deviation if needed
      if (deviation && deviation.hasDeviation && deviation.reason) {
        const { error: reportingDeviationError } = await supabase
          .from('prdn_work_reporting_deviations')
          .insert({
            reporting_id: reportRecord.id,
            planning_id: planningRecord.id,
            deviation_type: deviation.deviationType === 'no_worker' ? 'no_worker' : 
                           deviation.deviationType === 'skill_mismatch' ? 'skill_mismatch' : 
                           'exceeds_std_time',
            reason: deviation.reason,
            is_active: true,
            is_deleted: false,
            created_by: currentUser,
            created_dt: now
          });
        
        if (reportingDeviationError) {
          console.error('Error creating reporting deviation:', reportingDeviationError);
        }
      }
    }
    
    // Step 3: Handle trainees (if any)
    if (formData.selectedTrainees && formData.selectedTrainees.length > 0) {
      if (!formData.traineeDeviationReason || !formData.traineeDeviationReason.trim()) {
        return { success: false, error: 'Deviation reason is required for adding trainees.' };
      }
      
      const { createWorkPlanning } = await import('$lib/api/production');
      
      for (let ti = 0; ti < formData.selectedTrainees.length; ti++) {
        const trainee = formData.selectedTrainees[ti];
        const eff = getEffectiveRowTimes(`trainee-${ti}`, formData);
        const rowHours = netHoursWorkedForReportingRow(eff, shiftBreakTimes);

        const hoursWorkedTillDate = timeWorkedTillDateByWorker[trainee.emp_id] || 0;
        const totalHoursWorked = hoursWorkedTillDate + rowHours;
        const traineePlanData = {
          stage_code: stageCode,
          shift_code: shiftCode,
          wo_details_id: woDetailsId,
          derived_sw_code: derivedSwCode,
          other_work_code: otherWorkCode,
          sc_required: 'T',
          worker_id: trainee.emp_id,
          from_date: eff.fromDate,
          from_time: eff.fromTime,
          to_date: eff.toDate,
          to_time: eff.toTime,
          planned_hours: rowHours,
          time_worked_till_date: formData.completionStatus === 'NC' ? totalHoursWorked : 0,
          remaining_time: Math.max(0, rowHours - totalHoursWorked),
          status: 'approved' as const,
          notes: `Trainee: ${trainee.emp_name} - Added during unplanned work reporting`,
          wsm_id: null,
          report_unplanned_work: true // Mark as unplanned work
        };
        
        const traineePlan = await createWorkPlanning(traineePlanData, currentUser);
        
        // Create reporting record for trainee
        const traineeLtDetails = calculateLtDetailsForWorker(trainee.emp_id);
        
        const traineeReportData = {
          planning_id: traineePlan.id,
          worker_id: trainee.emp_id,
          from_date: eff.fromDate,
          from_time: eff.fromTime,
          to_date: eff.toDate,
          to_time: eff.toTime,
          hours_worked_till_date: hoursWorkedTillDate,
          hours_worked_today: rowHours,
          completion_status: formData.completionStatus,
          lt_minutes_total: formData.ltMinutes,
          lt_details: traineeLtDetails,
          lt_comments: formData.ltComments || '',
          status: 'draft',
          created_by: currentUser,
          created_dt: now,
          modified_by: currentUser,
          modified_dt: now
        };
        
        const { data: traineeReport, error: traineeReportError } = await supabase
          .from('prdn_work_reporting')
          .insert(traineeReportData)
          .select()
          .single();
        
        if (traineeReportError) {
          console.error(`Error creating report for trainee ${trainee.emp_name}:`, traineeReportError);
          return { success: false, error: `Failed to create report for trainee ${trainee.emp_name}` };
        }
        
        // Create deviation record for trainee addition
        const { error: deviationError } = await supabase
          .from('prdn_work_planning_deviations')
          .insert({
            planning_id: traineePlan.id,
            deviation_type: 'trainee_addition',
            reason: formData.traineeDeviationReason,
            is_active: true,
            is_deleted: false,
            created_by: currentUser,
            created_dt: now
          });
        
        if (deviationError) {
          console.error(`Error creating deviation for trainee ${trainee.emp_name}:`, deviationError);
          return { success: false, error: `Failed to create deviation for trainee ${trainee.emp_name}` };
        }
      }
    }
    
    // Calculate piece rate for created planning records
    if (createdPlanningRecords.length > 0) {
      try {
        for (const planRecord of createdPlanningRecords) {
          if (planRecord.id) {
            await calculatePieceRateForPlanning(planRecord.id);
          }
        }
      } catch (error) {
        console.error('Error calculating piece rate:', error);
        // Don't fail the save if piece rate calculation fails
      }
    }
    
    return { success: true, data: createdPlanningRecords };
  } catch (error) {
    return { success: false, error: (error as Error)?.message || 'Unknown error' };
  }
}
