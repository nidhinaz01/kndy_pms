import { supabase } from '$lib/supabaseClient';
import type { ProductionEmployee } from './productionTypes';
import { calculateStageTransferHours } from './productionEmployeeUtils';
import { calculateBreakTimeInMinutes } from '$lib/utils/breakTimeUtils';

/**
 * Fetch production employees with all related data using JOINs
 * Optimized to eliminate N+1 query problem
 * Uses JOINs for attendance and stage reassignments (both have foreign keys to hr_emp)
 * 
 * @param stage - Stage code
 * @param date - Date to fetch data for
 * @param mode - 'planning' for planning tables (prdn_planning_stage_reassignment), 
 *               'reporting' for reporting tables (prdn_reporting_stage_reassignment), 
 *               'current' for hr_attendance/prdn_reporting_stage_reassignment
 */
export async function fetchProductionEmployees(
  stage: string, 
  date: string, 
  mode: 'planning' | 'reporting' | 'current' = 'current'
): Promise<ProductionEmployee[]> {
  try {
    // Query 1: Shift schedules
    const { data: shiftSchedules, error: scheduleError } = await supabase
      .from('hr_daily_shift_schedule')
      .select('shift_id')
      .eq('schedule_date', date)
      .eq('is_working_day', true)
      .eq('is_active', true)
      .eq('is_deleted', false);

    if (scheduleError) {
      console.error('Error fetching shift schedules:', scheduleError);
      throw scheduleError;
    }

    if (!shiftSchedules || shiftSchedules.length === 0) {
      console.log('No active shift schedules found for date:', date);
      return [];
    }

    const activeShiftIds = shiftSchedules.map(schedule => schedule.shift_id);

    // Query 2a: Employees originally assigned to this stage
    const { data: employeesOriginal, error: employeeError1 } = await supabase
      .from('hr_emp')
      .select(`
        id,
        emp_id,
        emp_name,
        skill_short,
        shift_code,
        stage,
        hr_shift_master!inner(
          shift_id,
          shift_name
        )
      `)
      .eq('stage', stage)
      .eq('is_active', true)
      .eq('is_deleted', false)
      .in('hr_shift_master.shift_id', activeShiftIds);

    if (employeeError1) {
      console.error('Error fetching original employees:', employeeError1);
    }

    // Query 2b: Employees reassigned TO this stage for the selected date
    let reassignedEmployeeIds: string[] = [];
    
    if (mode === 'planning') {
      // For planning mode, check prdn_planning_stage_reassignment
      // Include draft, pending_approval, and approved reassignments
      const { data: reassignments, error: reassignmentError } = await supabase
        .from('prdn_planning_stage_reassignment')
        .select('emp_id')
        .eq('to_stage_code', stage)
        .eq('planning_date', date)
        .in('status', ['draft', 'pending_approval', 'approved'])
        .eq('is_deleted', false);

      if (reassignmentError) {
        console.error('Error fetching reassigned employee IDs (planning):', reassignmentError);
      } else if (reassignments) {
        reassignedEmployeeIds = reassignments.map(r => r.emp_id);
        console.log(`🔍 Found ${reassignedEmployeeIds.length} employees reassigned TO ${stage} on ${date}:`, reassignedEmployeeIds);
      }
    } else {
      // For reporting/current mode, check prdn_reporting_stage_reassignment
      const { data: reassignments, error: reassignmentError } = await supabase
        .from('prdn_reporting_stage_reassignment')
        .select('emp_id')
        .eq('to_stage_code', stage)
        .eq('reassignment_date', date)
        .eq('is_deleted', false);

      if (reassignmentError) {
        console.error('Error fetching reassigned employee IDs (reporting):', reassignmentError);
      } else if (reassignments) {
        reassignedEmployeeIds = reassignments.map(r => r.emp_id);
      }
    }

    // Query 2c: Fetch employee details for reassigned employees (if any)
    let reassignedEmployees: any[] = [];
    if (reassignedEmployeeIds.length > 0) {
      const { data: reassignedEmps, error: reassignedEmpsError } = await supabase
        .from('hr_emp')
        .select(`
          id,
          emp_id,
          emp_name,
          skill_short,
          shift_code,
          stage,
          hr_shift_master!inner(
            shift_id,
            shift_name
          )
        `)
        .in('emp_id', reassignedEmployeeIds)
        .eq('is_active', true)
        .eq('is_deleted', false)
        .in('hr_shift_master.shift_id', activeShiftIds);

      if (reassignedEmpsError) {
        console.error('Error fetching reassigned employee details:', reassignedEmpsError);
      } else {
        reassignedEmployees = reassignedEmps || [];
      }
    }

    // Combine original and reassigned employees, removing duplicates
    const originalEmployeeIds = new Set((employeesOriginal || []).map(emp => emp.emp_id));
    const uniqueReassignedEmployees = reassignedEmployees.filter(emp => !originalEmployeeIds.has(emp.emp_id));
    const employees = [...(employeesOriginal || []), ...uniqueReassignedEmployees];

    console.log(`📊 Employee summary for ${stage} on ${date}: ${employeesOriginal?.length || 0} original, ${uniqueReassignedEmployees.length} reassigned, ${employees.length} total`);

    if (employees.length === 0) {
      console.log(`No employees found for stage ${stage} on ${date} (mode: ${mode})`);
      return [];
    }

    // Query 3: Work planning (aggregate)
    // For planning mode, only get draft status records
    // For reporting/current mode, get all statuses (approved, pending_approval, etc.)
    let workPlanningQuery = supabase
      .from('prdn_work_planning')
      .select('worker_id, planned_hours, from_time, to_time, from_date')
      .eq('stage_code', stage)
      .eq('from_date', date)
      .eq('is_active', true)
      .eq('is_deleted', false);
    
    // For planning mode, fetch draft, pending_approval, and approved plans
    // (approved plans should still show planned hours in Manpower Plan tab)
    if (mode === 'planning') {
      workPlanningQuery = workPlanningQuery.in('status', ['draft', 'pending_approval', 'approved']);
    }
    
    const { data: workPlanningData, error: planningError } = await workPlanningQuery;

    if (planningError) {
      console.error('Error fetching work planning data:', planningError);
    }

    // Get shift break times per shift for calculating planned hours
    // Create a map: shift_code -> break times
    const shiftBreakTimesMap = new Map<string, Array<{ start_time: string; end_time: string }>>();
    
    // Get unique shift codes from employees
    const uniqueShiftCodes = [...new Set(employees.map(emp => emp.shift_code).filter(Boolean))];
    
    // Fetch break times for each unique shift
    for (const shiftCode of uniqueShiftCodes) {
      const { data: shiftData } = await supabase
        .from('hr_shift_master')
        .select('shift_id')
        .eq('shift_code', shiftCode)
        .eq('is_active', true)
        .eq('is_deleted', false)
        .maybeSingle();
      
      if (shiftData?.shift_id) {
        const { data: breaksData } = await supabase
          .from('hr_shift_break_master')
          .select('start_time, end_time')
          .eq('shift_id', shiftData.shift_id)
          .eq('is_active', true)
          .eq('is_deleted', false)
          .order('start_time', { ascending: true });
        
        if (breaksData) {
          shiftBreakTimesMap.set(shiftCode, breaksData);
        }
      }
    }
    
    // Create a map of worker_id -> shift_code for quick lookup
    const workerShiftMap = new Map<string, string>();
    employees.forEach(emp => {
      if (emp.emp_id && emp.shift_code) {
        workerShiftMap.set(emp.emp_id, emp.shift_code);
      }
    });

    // Query 4: Work reporting (aggregate)
    const { data: workReportingData, error: reportingError } = await supabase
      .from('prdn_work_reporting')
      .select(`
        worker_id,
        hours_worked_today,
        prdn_work_planning!inner(
          stage_code
        )
      `)
      .eq('prdn_work_planning.stage_code', stage)
      .eq('from_date', date)
      .eq('is_deleted', false);

    if (reportingError) {
      console.error('Error fetching work reporting data:', reportingError);
    }

    // Query 5: Attendance data
    const employeeIds = (employees || []).map(emp => emp.emp_id);
    let attendanceData: any[] = [];
    let reassignmentData: any[] = [];
    let ltpMap = new Map<string, number>();
    let ltnpMap = new Map<string, number>();
    let ltMap = new Map<string, number>();
    
    if (employeeIds.length > 0) {
      // Use different tables based on mode:
      // - 'planning': prdn_planning_manpower (planned attendance for selected date)
      // - 'reporting': prdn_reporting_manpower (reported attendance for selected date)
      // - 'current': hr_attendance (current attendance)
      let attendanceQuery;
      
      if (mode === 'planning') {
        // For planning mode, query prdn_planning_manpower with planning_date
        // Include draft, pending_approval, and approved statuses (all should show attendance)
        attendanceQuery = supabase
          .from('prdn_planning_manpower')
          .select('emp_id, attendance_status')
          .in('emp_id', employeeIds)
          .eq('planning_date', date)
          .eq('stage_code', stage)
          .in('status', ['draft', 'pending_approval', 'approved'])
          .eq('is_deleted', false);
      } else if (mode === 'reporting') {
        // For reporting mode, query prdn_reporting_manpower with reporting_date
        // Include draft, pending_approval, and approved statuses (all should show attendance)
        attendanceQuery = supabase
          .from('prdn_reporting_manpower')
          .select('emp_id, attendance_status')
          .in('emp_id', employeeIds)
          .eq('reporting_date', date)
          .eq('stage_code', stage)
          .in('status', ['draft', 'pending_approval', 'approved'])
          .eq('is_deleted', false);
      } else {
        // 'current' mode - use hr_attendance
        attendanceQuery = supabase
          .from('hr_attendance')
          .select('emp_id, attendance_status')
          .in('emp_id', employeeIds)
          .eq('attendance_date', date)
          .eq('stage_code', stage)
          .eq('is_deleted', false);
      }

      const { data: attendanceDataResult, error: attendanceError } = await attendanceQuery;

      if (attendanceError) {
        console.error('Error fetching attendance data:', attendanceError);
      } else {
        attendanceData = attendanceDataResult || [];
      }

      // Query 6: Stage reassignment data
      // Use different tables based on mode:
      // - 'reporting': prdn_reporting_stage_reassignment (actual reassignments for reporting)
      // - 'planning': prdn_planning_stage_reassignment (planned reassignments for selected date)
      // - 'current': Use reporting table (actual reassignments)
      let reassignmentQuery;
      
      if (mode === 'planning') {
        // Include draft, pending_approval, and approved reassignments (all should show in Manpower Plan tab)
        reassignmentQuery = supabase
          .from('prdn_planning_stage_reassignment')
          .select('emp_id, from_stage_code, to_stage_code, planning_date, from_time, to_time, reason, created_by, created_dt')
          .in('emp_id', employeeIds)
          .eq('planning_date', date)
          .in('status', ['draft', 'pending_approval', 'approved'])
          .eq('is_deleted', false)
          .order('created_dt', { ascending: true });
      } else {
        // For 'reporting' and 'current' modes, use reporting table
        reassignmentQuery = supabase
          .from('prdn_reporting_stage_reassignment')
          .select('emp_id, from_stage_code, to_stage_code, reassignment_date, from_time, to_time, reason, created_by, created_dt')
          .in('emp_id', employeeIds)
          .eq('reassignment_date', date)
          .eq('is_deleted', false)
          .order('created_dt', { ascending: true });
      }
      
      const { data: reassignmentDataResult, error: reassignmentError } = await reassignmentQuery;

      if (reassignmentError) {
        console.error('Error fetching stage reassignment data:', reassignmentError);
      } else {
        reassignmentData = reassignmentDataResult || [];
      }

      // Query 7: Reporting manpower data (for LTP/LTNP hours) - only for reporting mode
      if (mode === 'reporting') {
        const { data: reportingManpowerData, error: reportingManpowerError } = await supabase
          .from('prdn_reporting_manpower')
          .select('emp_id, ltp_hours, ltnp_hours')
          .in('emp_id', employeeIds)
          .eq('stage_code', stage)
          .eq('reporting_date', date)
          .eq('is_deleted', false);

        if (reportingManpowerError) {
          console.error('Error fetching reporting manpower data:', reportingManpowerError);
        } else {
          // Store in maps for easy lookup
          (reportingManpowerData || []).forEach(record => {
            if (record.emp_id) {
              ltpMap.set(record.emp_id, Number(record.ltp_hours) || 0);
              ltnpMap.set(record.emp_id, Number(record.ltnp_hours) || 0);
            }
          });
        }

        // Query 8: Calculate lost time from work reports (lt_details) - aggregate by employee
        // First, get work reports for this stage by joining with planning
        const { data: workReportsData, error: workReportsError } = await supabase
          .from('prdn_work_reporting')
          .select(`
            worker_id,
            lt_details,
            lt_minutes_total,
            prdn_work_planning!inner(
              stage_code
            )
          `)
          .eq('prdn_work_planning.stage_code', stage)
          .eq('from_date', date)
          .in('status', ['draft', 'pending_approval', 'approved'])
          .eq('is_deleted', false);

        if (workReportsError) {
          console.error('Error fetching work reports for lost time calculation:', workReportsError);
        } else {
          // Aggregate lost time by employee from work reports
          const employeeLTP: Map<string, number> = new Map();
          const employeeLTNP: Map<string, number> = new Map();
          const employeeLT: Map<string, number> = new Map();

          (workReportsData || []).forEach((report: any) => {
            const empId = report.worker_id;
            if (!empId) return;

            // Calculate from lt_details if available
            if (report.lt_details && Array.isArray(report.lt_details)) {
              report.lt_details.forEach((lt: any) => {
                const minutes = lt.lt_minutes || 0;
                if (lt.is_lt_payable) {
                  const currentLTP = employeeLTP.get(empId) || 0;
                  employeeLTP.set(empId, currentLTP + minutes);
                } else {
                  const currentLTNP = employeeLTNP.get(empId) || 0;
                  employeeLTNP.set(empId, currentLTNP + minutes);
                }
                // Total lost time
                const currentLT = employeeLT.get(empId) || 0;
                employeeLT.set(empId, currentLT + minutes);
              });
            } else if (report.lt_minutes_total && report.lt_minutes_total > 0) {
              // If lt_details is not available but lt_minutes_total is, add to LTNP (default)
              const currentLTNP = employeeLTNP.get(empId) || 0;
              employeeLTNP.set(empId, currentLTNP + report.lt_minutes_total);
              // Total lost time
              const currentLT = employeeLT.get(empId) || 0;
              employeeLT.set(empId, currentLT + report.lt_minutes_total);
            }
          });

          // Update maps with calculated values (use calculated if stored value is 0 or missing)
          employeeIds.forEach(empId => {
            const calculatedLTP = (employeeLTP.get(empId) || 0) / 60; // Convert minutes to hours
            const calculatedLTNP = (employeeLTNP.get(empId) || 0) / 60;
            const calculatedLT = (employeeLT.get(empId) || 0) / 60;

            // Use calculated values if stored values are 0 or missing
            const storedLTP = ltpMap.get(empId) || 0;
            const storedLTNP = ltnpMap.get(empId) || 0;

            ltpMap.set(empId, storedLTP > 0 ? storedLTP : calculatedLTP);
            ltnpMap.set(empId, storedLTNP > 0 ? storedLTNP : calculatedLTNP);
            ltMap.set(empId, calculatedLT);
          });
        }
      }
    }

    // Process aggregated data
    const plannedHoursMap = new Map<string, number>();
    console.log(`📊 Processing ${workPlanningData?.length || 0} work plans for date ${date}`);
    
    (workPlanningData || []).forEach(plan => {
      if (plan.worker_id) {
        let hours = 0;
        
        // Always calculate from time range to ensure break time is subtracted
        if (plan.from_time && plan.to_time) {
          try {
            const from = new Date(`2000-01-01T${plan.from_time}`);
            const to = new Date(`2000-01-01T${plan.to_time}`);
            if (to < from) to.setDate(to.getDate() + 1);
            const diffMs = to.getTime() - from.getTime();
            const totalHours = diffMs / (1000 * 60 * 60);
            
            // Get break times for this worker's shift
            const workerShiftCode = workerShiftMap.get(plan.worker_id);
            const breakTimes = workerShiftCode ? (shiftBreakTimesMap.get(workerShiftCode) || []) : [];
            
            // Subtract break time using the worker's shift break times
            const breakMinutes = calculateBreakTimeInMinutes(plan.from_time, plan.to_time, breakTimes);
            const breakHours = breakMinutes / 60;
            hours = Math.max(0, totalHours - breakHours);
            
            console.log(`  Worker ${plan.worker_id}: ${plan.from_time}-${plan.to_time} = ${totalHours.toFixed(2)}h - ${breakHours.toFixed(2)}h break = ${hours.toFixed(2)}h`);
          } catch (error) {
            console.error('Error calculating planned hours from time range:', error);
            // Fallback to stored planned_hours if calculation fails
            hours = plan.planned_hours || 0;
          }
        } else {
          // Fallback to stored planned_hours if time range is not available
          hours = plan.planned_hours || 0;
        }
        
        if (hours > 0) {
          const currentHours = plannedHoursMap.get(plan.worker_id) || 0;
          plannedHoursMap.set(plan.worker_id, currentHours + hours);
          console.log(`  Total for ${plan.worker_id}: ${currentHours + hours}h`);
        }
      }
    });
    
    console.log('📊 Final planned hours map:', Array.from(plannedHoursMap.entries()));

    const reportedHoursMap = new Map<string, number>();
    (workReportingData || []).forEach(report => {
      if (report.worker_id && report.hours_worked_today) {
        const currentHours = reportedHoursMap.get(report.worker_id) || 0;
        reportedHoursMap.set(report.worker_id, currentHours + (report.hours_worked_today || 0));
      }
    });

    // Process employees with joined data
    const productionEmployees: ProductionEmployee[] = (employees || []).map(emp => {
      // Find attendance for this employee
      const attendance = attendanceData.find(a => a.emp_id === emp.emp_id);
      
      // Find reassignments for this employee
      // Normalize date field name (could be planning_date or reassignment_date)
      const reassignments = (reassignmentData || []).filter(r => r.emp_id === emp.emp_id).map(r => ({
        ...r,
        reassignment_date: r.planning_date || r.reassignment_date || date
      }));

      // Sort reassignments by created_dt to get journey
      const sortedReassignments = reassignments.sort((a, b) => 
        new Date(a.created_dt).getTime() - new Date(b.created_dt).getTime()
      );

      // Get current stage (latest reassignment's to_stage_code, or default to emp.stage)
      const latestReassignment = sortedReassignments[sortedReassignments.length - 1];
      const currentStage = latestReassignment?.to_stage_code || stage;

      // Build stage journey
      const stageJourney = sortedReassignments.map(reassign => ({
        from_stage: reassign.from_stage_code,
        to_stage: reassign.to_stage_code,
        reassigned_at: reassign.created_dt,
        from_time: reassign.from_time,
        to_time: reassign.to_time,
        reason: reassign.reason,
        reassigned_by: reassign.created_by || reassign.reassigned_by || 'N/A'
      }));

      // Calculate transfer hours
      const { toOtherStageHours, fromOtherStageHours } = calculateStageTransferHours(stageJourney, stage);

      // Get LTP/LTNP hours if in reporting mode
      const ltpHours = mode === 'reporting' ? (ltpMap.get(emp.emp_id) || 0) : 0;
      const ltnpHours = mode === 'reporting' ? (ltnpMap.get(emp.emp_id) || 0) : 0;

      return {
        id: emp.id,
        emp_id: emp.emp_id,
        emp_name: emp.emp_name,
        skill_short: emp.skill_short,
        shift_code: emp.shift_code,
        shift_name: emp.hr_shift_master?.shift_name,
        current_stage: currentStage,
        original_stage: emp.stage, // Original assigned stage from hr_emp table
        attendance_status: attendance ? (attendance.attendance_status || null) : null,
        hours_planned: plannedHoursMap.get(emp.emp_id) || 0,
        hours_reported: reportedHoursMap.get(emp.emp_id) || 0,
        ot_hours: 0,
        lt_hours: mode === 'reporting' ? (ltMap.get(emp.emp_id) || 0) : 0,
        ltp_hours: ltpHours,
        ltnp_hours: ltnpHours,
        stage_journey: stageJourney,
        to_other_stage_hours: toOtherStageHours,
        from_other_stage_hours: fromOtherStageHours
      };
    });

    return productionEmployees;
  } catch (error) {
    console.error('Error in fetchProductionEmployees:', error);
    throw error;
  }
}

