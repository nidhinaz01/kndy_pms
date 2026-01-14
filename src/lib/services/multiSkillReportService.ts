import { supabase } from '$lib/supabaseClient';
import { fetchActiveLostTimeReasons } from '$lib/api/lostTimeReasons';
import { getDetailedTimeBreakdownForDerivativeWork } from '$lib/api/stdSkillTimeStandards';
import type { LostTimeReason } from '$lib/api/lostTimeReasons';

export async function loadWorkers(stageCode: string, fromDate: string, selectedWorks?: any[]): Promise<any[]> {
  if (!stageCode || !fromDate) return [];
  
  try {
    // Get date string in YYYY-MM-DD format
    let dateStr: string;
    if (typeof fromDate === 'string') {
      dateStr = fromDate.split('T')[0];
    } else {
      dateStr = new Date(fromDate).toISOString().split('T')[0];
    }

    // Load workers from prdn_reporting_manpower (attendance saved in Manpower Report tab)
    const { data: reportingAttendance, error: attendanceError } = await supabase
      .from('prdn_reporting_manpower')
      .select(`
        emp_id,
        hr_emp!inner(
          emp_id,
          emp_name,
          skill_short,
          stage
        )
      `)
      .eq('stage_code', stageCode)
      .eq('reporting_date', dateStr)
      .eq('attendance_status', 'present')
      .eq('is_deleted', false);

    if (attendanceError) {
      console.error('❌ Error loading reporting attendance:', attendanceError);
    } else {
      console.log(`📋 Found ${reportingAttendance?.length || 0} workers with attendance marked for ${stageCode} on ${dateStr}`);
    }

    const workersMap = new Map<string, any>();

    // Add workers from reporting attendance
    if (reportingAttendance && reportingAttendance.length > 0) {
      reportingAttendance.forEach((item: any) => {
        if (item.hr_emp?.emp_id) {
          workersMap.set(item.hr_emp.emp_id, {
            emp_id: item.hr_emp.emp_id,
            emp_name: item.hr_emp.emp_name,
            skill_short: item.hr_emp.skill_short,
            stage: item.hr_emp.stage
          });
        }
      });
    } else {
      console.warn(`⚠️ No workers found in prdn_reporting_manpower for ${stageCode} on ${dateStr}. Make sure attendance is marked in Manpower Report tab.`);
    }

    // Also include workers that are assigned in the plan (selectedWorks)
    if (selectedWorks && selectedWorks.length > 0) {
      const plannedWorkerIds = selectedWorks
        .map(work => work.worker_id)
        .filter(Boolean) as string[];
      
      if (plannedWorkerIds.length > 0) {
        const { data: plannedWorkers, error: plannedWorkersError } = await supabase
          .from('hr_emp')
          .select('emp_id, emp_name, skill_short, stage')
          .in('emp_id', plannedWorkerIds)
          .eq('stage', stageCode)
          .eq('is_active', true)
          .eq('is_deleted', false);

        if (!plannedWorkersError && plannedWorkers) {
          plannedWorkers.forEach((worker: any) => {
            if (worker.emp_id && !workersMap.has(worker.emp_id)) {
              workersMap.set(worker.emp_id, {
                emp_id: worker.emp_id,
                emp_name: worker.emp_name,
                skill_short: worker.skill_short,
                stage: worker.stage
              });
            }
          });
        }
      }
    }

    return Array.from(workersMap.values());
  } catch (error) {
    console.error('Error loading workers:', error);
    return [];
  }
}

export async function loadStandardTime(selectedWorks: any[]): Promise<number> {
  if (!selectedWorks || selectedWorks.length === 0) return 0;
  
  const firstWork = selectedWorks[0];
  const derivedWorkCode = firstWork?.derived_sw_code || 
                         firstWork?.std_work_type_details?.derived_sw_code ||
                         firstWork?.std_work_type_details?.sw_code;
  
  if (!derivedWorkCode) {
    return 0;
  }
  
  try {
    const timeBreakdown = await getDetailedTimeBreakdownForDerivativeWork(derivedWorkCode);
    return timeBreakdown.totalMinutes;
  } catch (error) {
    console.error('Error loading standard time:', error);
    return 0;
  }
}

export async function loadLostTimeReasons(): Promise<LostTimeReason[]> {
  try {
    return await fetchActiveLostTimeReasons();
  } catch (error) {
    console.error('Error loading lost time reasons:', error);
    return [];
  }
}

export async function loadShiftInfo(stageCode: string, fromDate: string): Promise<any> {
  if (!fromDate || !stageCode) return null;

  try {
    // Get shifts associated with this stage
    const { fetchShiftsForStage } = await import('$lib/api/hrShiftStageMaster');
    const allowedShiftCodes = await fetchShiftsForStage(stageCode);
    
    if (!allowedShiftCodes || allowedShiftCodes.length === 0) {
      // No shifts configured for this stage - use fallback
      console.warn(`No shifts configured for stage ${stageCode}, using fallback`);
      return await getShiftScheduleForDate(fromDate);
    }

    // Get shift schedules for the date that match allowed shifts
    const { data: scheduleData, error: scheduleError } = await supabase
      .from('hr_daily_shift_schedule')
      .select(`
        shift_id,
        hr_shift_master!inner(
          shift_id,
          shift_code,
          shift_name,
          start_time,
          end_time
        )
      `)
      .eq('schedule_date', fromDate)
      .eq('is_working_day', true)
      .eq('is_active', true)
      .eq('is_deleted', false)
      .in('hr_shift_master.shift_code', allowedShiftCodes)
      .limit(1)
      .maybeSingle();

    if (scheduleError || !scheduleData) {
      console.warn(`No shift schedule found for stage ${stageCode} on ${fromDate}, using fallback`);
      return await getShiftScheduleForDate(fromDate);
    }

    const shiftMaster = scheduleData.hr_shift_master as any;
    if (!shiftMaster) {
      return await getShiftScheduleForDate(fromDate);
    }

    // Get the full schedule data
    const { data: fullScheduleData, error: fullScheduleError } = await supabase
      .from('hr_daily_shift_schedule')
      .select('*')
      .eq('schedule_date', fromDate)
      .eq('shift_id', shiftMaster.shift_id)
      .eq('is_working_day', true)
      .eq('is_active', true)
      .eq('is_deleted', false)
      .maybeSingle();

    if (fullScheduleError || !fullScheduleData) {
      return await getShiftScheduleForDate(fromDate);
    }

    // Add shift master info
    fullScheduleData.hr_shift_master = shiftMaster;

    // Get break times for this shift
    const { data: breakData, error: breakError } = await supabase
      .from('hr_shift_break_master')
      .select('*')
      .eq('shift_id', shiftMaster.shift_id)
      .eq('is_active', true)
      .eq('is_deleted', false)
      .order('break_number');

    if (!breakError && breakData) {
      fullScheduleData.breakTimes = breakData;
    }

    return fullScheduleData;
  } catch (error) {
    console.error('Error loading shift info for stage:', error);
    // Fallback to any available shift
    return await getShiftScheduleForDate(fromDate);
  }
}

/**
 * Get any available shift schedule for the date
 */
async function getShiftScheduleForDate(fromDate: string): Promise<any> {
  try {
    // First get a shift schedule for the date
    const { data: scheduleData, error: scheduleError } = await supabase
      .from('hr_daily_shift_schedule')
      .select('shift_id')
      .eq('schedule_date', fromDate)
      .eq('is_working_day', true)
      .eq('is_active', true)
      .eq('is_deleted', false)
      .limit(1)
      .maybeSingle();

    if (scheduleError || !scheduleData || !scheduleData.shift_id) {
      return null;
    }

    // Get shift master info
    const { data: shiftMasterData, error: shiftMasterError } = await supabase
      .from('hr_shift_master')
      .select('shift_id, shift_code, shift_name, start_time, end_time')
      .eq('shift_id', scheduleData.shift_id)
      .eq('is_active', true)
      .eq('is_deleted', false)
      .maybeSingle();

    if (shiftMasterError || !shiftMasterData) {
      return null;
    }

    // Get the full schedule data
    const { data: fullScheduleData, error: fullScheduleError } = await supabase
      .from('hr_daily_shift_schedule')
      .select('*')
      .eq('schedule_date', fromDate)
      .eq('shift_id', scheduleData.shift_id)
      .eq('is_working_day', true)
      .eq('is_active', true)
      .eq('is_deleted', false)
      .maybeSingle();

    if (fullScheduleError || !fullScheduleData) {
      return null;
    }

    // Add shift master info
    fullScheduleData.hr_shift_master = shiftMasterData;

    // Get break times for this shift
    const { data: breakData, error: breakError } = await supabase
      .from('hr_shift_break_master')
      .select('*')
      .eq('shift_id', shiftMasterData.shift_id)
      .eq('is_active', true)
      .eq('is_deleted', false)
      .order('break_number');

    if (!breakError && breakData) {
      fullScheduleData.breakTimes = breakData;
    }

    return fullScheduleData;
  } catch (error) {
    console.error('Error in fallback shift info:', error);
    return null;
  }
}

export async function loadAverageEmployeeSalary(employeeIds: string[]): Promise<number> {
  if (!employeeIds || employeeIds.length === 0) return 0;

  try {
    const { data, error } = await supabase
      .from('hr_emp')
      .select('salary')
      .in('emp_id', employeeIds)
      .eq('is_active', true)
      .eq('is_deleted', false);

    if (error) throw error;

    if (!data || data.length === 0) return 0;

    const salaries = data.map(emp => emp.salary || 0).filter(s => s > 0);
    if (salaries.length === 0) return 0;

    const average = salaries.reduce((sum, salary) => sum + salary, 0) / salaries.length;
    return average;
  } catch (error) {
    console.error('Error loading average employee salary:', error);
    return 0;
  }
}

export async function checkWorkerConflicts(
  skillEmployees: { [skillId: string]: string },
  fromDate: string,
  fromTime: string,
  toDate: string,
  toTime: string,
  excludePlanningIds?: number[],
  excludeReportIds?: number[]
): Promise<{ hasConflict: boolean; hasReportConflict: boolean; message: string }> {
  if (!fromDate || !fromTime || !toDate || !toTime) {
    return { hasConflict: false, hasReportConflict: false, message: '' };
  }

  try {
    const fromDateTime = new Date(`${fromDate}T${fromTime}`);
    const toDateTime = new Date(`${toDate}T${toTime}`);
    
    const uniqueWorkerIds = [...new Set(Object.values(skillEmployees).filter(Boolean))];
    if (uniqueWorkerIds.length === 0) {
      return { hasConflict: false, hasReportConflict: false, message: '' };
    }

    // Format dates to YYYY-MM-DD for comparison
    const fromDateStr = typeof fromDate === 'string' ? fromDate.split('T')[0] : fromDate;
    
    const conflictPromises = uniqueWorkerIds.map(async (workerId) => {
      let reportsQuery = supabase
        .from('prdn_work_reporting')
        .select('*')
        .eq('worker_id', workerId)
        .eq('is_deleted', false)
        // Filter by same date - both reports should be on the same date
        .eq('from_date', fromDateStr);
      
      // Exclude current reports if editing
      if (excludeReportIds && excludeReportIds.length > 0) {
        reportsQuery = reportsQuery.not('id', 'in', `(${excludeReportIds.join(',')})`);
      }
      
      const { data: existingReports, error: reportsError } = await reportsQuery;

      if (reportsError) throw reportsError;

      // Get all plans for this worker
      const { data: allPlans, error: plansError } = await supabase
        .from('prdn_work_planning')
        .select('*')
        .eq('worker_id', workerId)
        .eq('is_deleted', false);

      if (plansError) throw plansError;

      // Exclude planning records that are being reported (to avoid false conflicts)
      const existingPlans = excludePlanningIds && excludePlanningIds.length > 0
        ? allPlans?.filter(plan => !excludePlanningIds.includes(plan.id)) || []
        : allPlans || [];

      if (plansError) throw plansError;

      // Check for time conflicts in reports on the same date
      const reportConflicts = existingReports?.filter((report: any) => {
        // Ensure we're comparing times on the same date
        const reportFromDateStr = typeof report.from_date === 'string' ? report.from_date.split('T')[0] : report.from_date;
        
        // Only check conflicts if on the same date
        if (reportFromDateStr !== fromDateStr) {
          return false;
        }
        
        const reportFromDateTime = new Date(`${report.from_date}T${report.from_time}`);
        const reportToDateTime = new Date(`${report.to_date}T${report.to_time}`);
        
        // Check if time ranges overlap (excluding adjacent slots)
        // Two ranges overlap if: start1 < end2 && end1 > start2
        return (fromDateTime < reportToDateTime && toDateTime > reportFromDateTime);
      }) || [];

      const planConflicts = existingPlans?.filter((plan: any) => {
        const planFromDateTime = new Date(`${plan.from_date}T${plan.from_time}`);
        const planToDateTime = new Date(`${plan.to_date}T${plan.to_time}`);
        return (fromDateTime < planToDateTime && toDateTime > planFromDateTime);
      }) || [];

      return { workerId, reportConflicts, planConflicts };
    });

    const conflictResults = await Promise.all(conflictPromises);
    const workersWithReportConflicts = conflictResults.filter(result => result.reportConflicts.length > 0);
    const workersWithPlanConflicts = conflictResults.filter(result => 
      result.planConflicts.length > 0 && result.reportConflicts.length === 0
    );

    // If there are report conflicts, BLOCK (cannot proceed)
    if (workersWithReportConflicts.length > 0) {
      const conflictDetails = workersWithReportConflicts.map(({ workerId, reportConflicts }) => {
        const conflictList = reportConflicts.map((conflict: any) => {
          const conflictFromTime = new Date(`${conflict.from_date}T${conflict.from_time}`).toLocaleString('en-GB', { 
            day: '2-digit', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' 
          });
          const conflictToTime = new Date(`${conflict.to_date}T${conflict.to_time}`).toLocaleString('en-GB', { 
            day: '2-digit', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' 
          });
          return `  • ${conflictFromTime} - ${conflictToTime} [Reported]`;
        }).join('\n');
        
        return `Worker ${workerId}:\n${conflictList}`;
      }).join('\n\n');

      const currentFromTime = fromDateTime.toLocaleString('en-GB', { 
        day: '2-digit', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' 
      });
      const currentToTime = toDateTime.toLocaleString('en-GB', { 
        day: '2-digit', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' 
      });

      const message = `❌ REPORTING BLOCKED!\n\nWorkers have already been reported for overlapping time periods on the same date.\n\nCurrent Reporting: ${currentFromTime} - ${currentToTime}\n\nExisting Reports:\n\n${conflictDetails}\n\nA worker cannot be reported for overlapping time periods on the same date. Please adjust the reporting time.`;

      return { hasConflict: true, hasReportConflict: true, message };
    }

    // If there are only plan conflicts, WARN (can proceed with confirmation)
    if (workersWithPlanConflicts.length > 0) {
      const conflictDetails = workersWithPlanConflicts.map(({ workerId, planConflicts }) => {
        const conflictList = planConflicts.map((conflict: any) => {
          const conflictFromTime = new Date(`${conflict.from_date}T${conflict.from_time}`).toLocaleString('en-GB', { 
            day: '2-digit', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' 
          });
          const conflictToTime = new Date(`${conflict.to_date}T${conflict.to_time}`).toLocaleString('en-GB', { 
            day: '2-digit', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' 
          });
          return `  • ${conflictFromTime} - ${conflictToTime} [Planned]`;
        }).join('\n');
        
        return `Worker ${workerId}:\n${conflictList}`;
      }).join('\n\n');

      const currentFromTime = fromDateTime.toLocaleString('en-GB', { 
        day: '2-digit', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' 
      });
      const currentToTime = toDateTime.toLocaleString('en-GB', { 
        day: '2-digit', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' 
      });

      const message = `⚠️ WORKER CONFLICTS DETECTED!\n\nCurrent Reporting: ${currentFromTime} - ${currentToTime}\n\nWorkers with conflicts:\n\n${conflictDetails}\n\nDo you want to proceed anyway?`;

      return { hasConflict: true, hasReportConflict: false, message };
    }

    return { hasConflict: false, hasReportConflict: false, message: '' };
  } catch (error) {
    console.error('Error checking worker conflicts:', error);
    return { hasConflict: false, hasReportConflict: false, message: '' };
  }
}

