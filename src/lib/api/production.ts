import { supabase } from '$lib/supabaseClient';

export interface ProductionEmployee {
  id: number;
  emp_id: string;
  emp_name: string;
  skill_short: string;
  shift_code: string;
  shift_name?: string;
  current_stage: string; // Current stage for the selected date
  attendance_status?: 'present' | 'absent' | null;
  hours_planned?: number;
  hours_reported?: number;
  ot_hours?: number;
  lt_hours?: number;
  to_other_stage_hours?: number;
  from_other_stage_hours?: number;
  stage_journey?: Array<{
    from_stage: string;
    to_stage: string;
    reassigned_at: string;
    from_time: string;
    to_time: string;
    reason?: string;
    reassigned_by: string;
  }>;
}

export interface ShiftSchedule {
  schedule_id: number;
  schedule_date: string;
  shift_id: number;
  is_working_day: boolean;
  total_shift_minutes: number;
  value_added_minutes: number;
  non_value_added_minutes: number;
  notes?: string;
  is_active: boolean;
}

export interface WorkPlanning {
  id: number;
  stage_code: string;
  wo_details_id: number;
  derived_sw_code: string | null;
  sc_required: string;
  worker_id: string;
  from_date: string;
  from_time: string;
  to_date: string;
  to_time: string;
  planned_hours: number;
  time_worked_till_date: number;
  remaining_time: number;
  status: 'planned' | 'submitted' | 'to_redo' | 'approved';
  notes?: string;
  is_active: boolean;
  is_deleted: boolean;
  created_by: string;
  created_dt: string;
  modified_by?: string;
  modified_dt?: string;
  wsm_id?: number | null;
  other_work_code?: string | null;
}

export interface WorkReporting {
  id: number;
  planning_id: number;
  worker_id: string;
  from_date: string;
  from_time: string;
  to_date: string;
  to_time: string;
  hours_worked_till_date: number;
  hours_worked_today: number;
  completion_status: 'C' | 'NC';
  lt_minutes: number;
  lt_reason: string;
  is_lt_payable: boolean;
  lt_cost: number;
  lt_comments?: string;
  is_active: boolean;
  is_deleted: boolean;
  created_by: string;
  created_dt: string;
  modified_by?: string;
  modified_dt?: string;
}

export interface CreateWorkPlanningData {
  stage_code: string;
  wo_details_id: number;
  derived_sw_code: string | null;
  sc_required: string;
  worker_id: string;
  from_date: string;
  from_time: string;
  to_date: string;
  to_time: string;
  planned_hours: number;
  time_worked_till_date?: number;
  remaining_time?: number;
  status?: 'planned' | 'submitted' | 'to_redo' | 'approved';
  notes?: string;
  wsm_id?: number | null;
  other_work_code?: string | null;
}

// Fetch employees for a specific stage and date (only if their shift is active)
export async function fetchProductionEmployees(stage: string, date: string): Promise<ProductionEmployee[]> {
  try {
    // First, get all active shift schedules for the given date
    const { data: shiftSchedules, error: scheduleError } = await supabase
      .from('hr_daily_shift_schedule')
      .select(`
        schedule_id,
        schedule_date,
        shift_id,
        is_working_day,
        total_shift_minutes,
        value_added_minutes,
        non_value_added_minutes,
        notes,
        is_active
      `)
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

    // Get the shift IDs that are active for this date
    const activeShiftIds = shiftSchedules.map(schedule => schedule.shift_id);

    // Fetch employees for the specified stage with active shifts
    const { data: employees, error: employeeError } = await supabase
      .from('hr_emp')
      .select(`
        id,
        emp_id,
        emp_name,
        skill_short,
        shift_code,
        hr_shift_master!inner(
          shift_id,
          shift_name
        )
      `)
      .eq('stage', stage)
      .eq('is_active', true)
      .eq('is_deleted', false)
      .in('hr_shift_master.shift_id', activeShiftIds);

    if (employeeError) {
      console.error('Error fetching employees:', employeeError);
      throw employeeError;
    }

    // Fetch planned hours from work planning table
    const { data: workPlanningData, error: planningError } = await supabase
      .from('prdn_work_planning')
      .select('worker_id, planned_hours')
      .eq('stage_code', stage)
      .eq('from_date', date)
      .eq('is_active', true)
      .eq('is_deleted', false);

    if (planningError) {
      console.error('Error fetching work planning data:', planningError);
      // Continue without planned hours rather than failing completely
    }

    // Aggregate planned hours by worker_id
    const plannedHoursMap = new Map<string, number>();
    (workPlanningData || []).forEach(plan => {
      if (plan.worker_id && plan.planned_hours) {
        const currentHours = plannedHoursMap.get(plan.worker_id) || 0;
        plannedHoursMap.set(plan.worker_id, currentHours + (plan.planned_hours || 0));
      }
    });

    // Fetch reported hours from work reporting table
    const { data: workReportingData, error: reportingError } = await supabase
      .from('prdn_work_reporting')
      .select(`
        worker_id,
        hours_worked_today,
        from_date,
        prdn_work_planning!inner(
          stage_code
        )
      `)
      .eq('prdn_work_planning.stage_code', stage)
      .eq('from_date', date)
      .eq('is_deleted', false);

    if (reportingError) {
      console.error('Error fetching work reporting data:', reportingError);
      // Continue without reported hours rather than failing completely
    }

    // Aggregate reported hours by worker_id
    // Sum up hours_worked_today for each worker on the selected date
    const reportedHoursMap = new Map<string, number>();
    (workReportingData || []).forEach(report => {
      if (report.worker_id && report.hours_worked_today) {
        const currentHours = reportedHoursMap.get(report.worker_id) || 0;
        reportedHoursMap.set(report.worker_id, currentHours + (report.hours_worked_today || 0));
      }
    });

    // Transform the data to match our interface
    const productionEmployees: ProductionEmployee[] = (employees || []).map(emp => ({
      id: emp.id,
      emp_id: emp.emp_id,
      emp_name: emp.emp_name,
      skill_short: emp.skill_short,
      shift_code: emp.shift_code,
      shift_name: emp.hr_shift_master?.shift_name,
      current_stage: stage, // Base stage from hr_emp
      attendance_status: null, // Will be populated below
      hours_planned: plannedHoursMap.get(emp.emp_id) || 0, // Populated from work planning
      hours_reported: reportedHoursMap.get(emp.emp_id) || 0, // Populated from work reporting
      ot_hours: 0, // TODO: Will be calculated
      lt_hours: 0 // TODO: Will be calculated
    }));

    // Fetch attendance data for all employees
    const attendancePromises = productionEmployees.map(async (emp) => {
      try {
        const { data: attendanceData } = await supabase
          .from('hr_attendance')
          .select('attendance_status')
          .eq('emp_id', emp.emp_id)
          .eq('attendance_date', date)
          .eq('stage_code', emp.current_stage)
          .eq('is_deleted', false)
          .maybeSingle();

        // Check for stage reassignments
        const currentStage = await getEmployeeCurrentStage(emp.emp_id, date);
        if (currentStage) {
          emp.current_stage = currentStage;
        }

        // Get complete stage journey
        const stageJourney = await getEmployeeStageJourney(emp.emp_id, date);
        emp.stage_journey = stageJourney;

        // Calculate hours spent in other stages
        // Use the requested stage (not current stage) as reference point for the calculation
        const { toOtherStageHours, fromOtherStageHours } = calculateStageTransferHours(stageJourney, stage);

        return {
          ...emp,
          attendance_status: attendanceData?.attendance_status || null,
          to_other_stage_hours: toOtherStageHours,
          from_other_stage_hours: fromOtherStageHours
        };
      } catch (error) {
        console.error(`Error fetching attendance for ${emp.emp_id}:`, error);
        return emp;
      }
    });

    // Wait for all attendance data to be fetched
    const employeesWithAttendance = await Promise.all(attendancePromises);
    return employeesWithAttendance;
  } catch (error) {
    console.error('Error in fetchProductionEmployees:', error);
    throw error;
  }
}

// Fetch shift schedule for a specific date
export async function fetchShiftSchedule(date: string): Promise<ShiftSchedule[]> {
  try {
    const { data, error } = await supabase
      .from('hr_daily_shift_schedule')
      .select(`
        schedule_id,
        schedule_date,
        shift_id,
        is_working_day,
        total_shift_minutes,
        value_added_minutes,
        non_value_added_minutes,
        notes,
        is_active
      `)
      .eq('schedule_date', date)
      .eq('is_deleted', false)
      .order('shift_id');

    if (error) {
      console.error('Error fetching shift schedule:', error);
      throw error;
    }

    return data || [];
  } catch (error) {
    console.error('Error in fetchShiftSchedule:', error);
    throw error;
  }
}

// Fetch available stages from sys_data_elements
export async function fetchAvailableStages(): Promise<string[]> {
  try {
    const { data, error } = await supabase
      .from('sys_data_elements')
      .select('de_value')
      .eq('de_name', 'Plant-Stage')
      .eq('is_active', true)
      .eq('is_deleted', false)
      .order('de_value');

    if (error) {
      console.error('Error fetching stages:', error);
      throw error;
    }

    return data?.map(item => item.de_value) || [];
  } catch (error) {
    console.error('Error in fetchAvailableStages:', error);
    throw error;
  }
}

// Fetch shift details including breaks
export async function fetchShiftDetails(shiftCode: string): Promise<{
  shift: {
    shift_id: number;
    shift_name: string;
    shift_code: string;
    start_time: string;
    end_time: string;
  } | null;
  breaks: Array<{
    break_id: number;
    break_number: number;
    break_name: string;
    start_time: string;
    end_time: string;
  }>;
}> {
  try {
    // Get shift details
    const { data: shiftData, error: shiftError } = await supabase
      .from('hr_shift_master')
      .select('*')
      .eq('shift_code', shiftCode)
      .eq('is_active', true)
      .eq('is_deleted', false)
      .single();

    if (shiftError) {
      console.error('Error fetching shift details:', shiftError);
      return { shift: null, breaks: [] };
    }

    // Get break details
    const { data: breaksData, error: breaksError } = await supabase
      .from('hr_shift_break_master')
      .select('*')
      .eq('shift_id', shiftData.shift_id)
      .eq('is_active', true)
      .eq('is_deleted', false)
      .order('break_number');

    if (breaksError) {
      console.error('Error fetching break details:', breaksError);
      return { shift: shiftData, breaks: [] };
    }

    return {
      shift: shiftData,
      breaks: breaksData || []
    };
  } catch (error) {
    console.error('Error in fetchShiftDetails:', error);
    return { shift: null, breaks: [] };
    }
}

// Mark employee attendance
export async function markAttendance(
  empId: string,
  stageCode: string,
  date: string,
  status: 'present' | 'absent',
  notes?: string,
  markedBy?: string
): Promise<void> {
  try {
    // Get current username (throws error if not found)
    // Use markedBy if provided, otherwise get from utility
    const { getCurrentUsername, getCurrentTimestamp } = await import('$lib/utils/userUtils');
    const username = markedBy || getCurrentUsername();
    const now = getCurrentTimestamp();
    
    const attendanceData = {
      emp_id: empId,
      stage_code: stageCode,
      attendance_date: date,
      attendance_status: status,
      notes: notes || null,
      marked_by: username,
      created_by: username,
      created_dt: now,
      // modified_by and modified_dt should equal created_by and created_dt on insert
      modified_by: username,
      modified_dt: now
    };

    // Check if attendance already exists for this employee, date, and stage
    const { data: existingAttendance } = await supabase
      .from('hr_attendance')
      .select('attendance_id')
      .eq('emp_id', empId)
      .eq('attendance_date', date)
      .eq('stage_code', stageCode)
      .eq('is_deleted', false)
      .maybeSingle();

    if (existingAttendance) {
      // Update existing attendance
      const { error } = await supabase
        .from('hr_attendance')
        .update({
          attendance_status: status,
          notes: notes || null,
          modified_by: username,
          modified_dt: now
          // created_by and created_dt should not be touched on update
        })
        .eq('attendance_id', existingAttendance.attendance_id);

      if (error) throw error;
    } else {
      // Insert new attendance record
      const { error } = await supabase
        .from('hr_attendance')
        .insert(attendanceData);

      if (error) throw error;
    }
  } catch (error) {
    console.error('Error marking attendance:', error);
    throw error;
  }
}

// Reassign employee to different stage
export async function reassignEmployee(
  empId: string,
  fromStageCode: string,
  toStageCode: string,
  date: string,
  shiftCode: string,
  fromTime: string,
  toTime: string,
  reason?: string,
  reassignedBy?: string
): Promise<void> {
  try {
    // Get current username (throws error if not found)
    // Use reassignedBy if provided, otherwise get from utility
    const { getCurrentUsername, getCurrentTimestamp } = await import('$lib/utils/userUtils');
    const username = reassignedBy || getCurrentUsername();
    const now = getCurrentTimestamp();
    
    const reassignmentData = {
      emp_id: empId,
      from_stage_code: fromStageCode,
      to_stage_code: toStageCode,
      reassignment_date: date,
      shift_code: shiftCode,
      from_time: fromTime,
      to_time: toTime,
      reason: reason || null,
      reassigned_by: username,
      created_by: username,
      created_dt: now,
      // modified_by and modified_dt should equal created_by and created_dt on insert
      modified_by: username,
      modified_dt: now
    };

    const { error } = await supabase
      .from('hr_stage_reassignment')
      .insert(reassignmentData);

    if (error) throw error;
  } catch (error) {
    console.error('Error reassigning employee:', error);
    throw error;
  }
}

// Fetch employee's current stage for a specific date (considering reassignments)
export async function getEmployeeCurrentStage(
  empId: string,
  date: string
): Promise<string | null> {
  try {
    // Get the latest reassignment for this employee on this date
    const { data, error } = await supabase
      .from('hr_stage_reassignment')
      .select('to_stage_code')
      .eq('emp_id', empId)
      .eq('reassignment_date', date)
      .eq('is_deleted', false)
      .order('created_dt', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return data?.to_stage_code || null;
  } catch (error) {
    console.error('Error getting employee current stage:', error);
    return null;
  }
}

// Fetch complete stage journey for an employee on a specific date
export async function getEmployeeStageJourney(
  empId: string,
  date: string
): Promise<Array<{
  from_stage: string;
  to_stage: string;
  reassigned_at: string;
  from_time: string;
  to_time: string;
  reason?: string;
  reassigned_by: string;
}>> {
  try {
    const { data, error } = await supabase
      .from('hr_stage_reassignment')
      .select(`
        from_stage_code,
        to_stage_code,
        created_dt,
        from_time,
        to_time,
        reason,
        reassigned_by
      `)
      .eq('emp_id', empId)
      .eq('reassignment_date', date)
      .eq('is_deleted', false)
      .order('created_dt', { ascending: true });

    if (error) {
      console.error('Error getting employee stage journey:', error);
      throw error;
    }

    return (data || []).map(item => ({
      from_stage: item.from_stage_code,
      to_stage: item.to_stage_code,
      reassigned_at: item.created_dt,
      from_time: item.from_time,
      to_time: item.to_time,
      reason: item.reason,
      reassigned_by: item.reassigned_by
    }));
  } catch (error) {
    console.error('Error in getEmployeeStageJourney:', error);
    return [];
  }
}

// Calculate hours spent transferring to/from other stages
function calculateStageTransferHours(
  stageJourney: Array<{
    from_stage: string;
    to_stage: string;
    reassigned_at: string;
    from_time: string;
    to_time: string;
    reason?: string;
    reassigned_by: string;
  }>,
  currentStage: string
): { toOtherStageHours: number; fromOtherStageHours: number } {
  let toOtherStageHours = 0;
  let fromOtherStageHours = 0;

  stageJourney.forEach(journey => {
    // Calculate hours for this reassignment
    const hours = calculateTimeDifference(journey.from_time, journey.to_time);
    
    if (journey.from_stage === currentStage && journey.to_stage !== currentStage) {
      // Employee left current stage to go to another stage
      // From current stage's perspective: this is "To Other Stage"
      toOtherStageHours += hours;
    } else if (journey.from_stage !== currentStage && journey.to_stage === currentStage) {
      // Employee came from another stage to current stage
      // From current stage's perspective: this is "From Other Stage"
      fromOtherStageHours += hours;
    }
  });

  return { toOtherStageHours, fromOtherStageHours };
}

// Helper function to calculate time difference in hours
function calculateTimeDifference(fromTime: string, toTime: string): number {
  try {
    // Parse time strings (assuming format like "09:00" or "09:00:00")
    const from = new Date(`2000-01-01T${fromTime}`);
    const to = new Date(`2000-01-01T${toTime}`);
    
    // Handle case where toTime is next day (e.g., 23:00 to 01:00)
    if (to < from) {
      to.setDate(to.getDate() + 1);
    }
    
    const diffMs = to.getTime() - from.getTime();
    return diffMs / (1000 * 60 * 60); // Convert to hours
  } catch (error) {
    console.error('Error calculating time difference:', error);
    return 0;
  }
}

// Work/Task related interfaces and functions
export interface ProductionWork {
  // From std_work_details
  sw_id: number;
  sw_code: string;
  sw_name: string;
  plant_stage: string;
  sw_type: string;
  sw_seq_no: number;
  is_active: boolean;
  is_deleted: boolean;
  created_by: string;
  created_dt: string;
  modified_by: string;
  modified_dt: string;
  
  // From joined tables
  std_work_type_details?: {
    derived_sw_code: string;
    type_description: string;
  };
  std_vehicle_work_flow?: {
    sequence_order: number;
    estimated_duration_minutes?: number;
    wo_type_id: number;
  };
  mstr_wo_type?: {
    wo_type_name: string;
  };
  skill_mappings?: Array<{
    wsm_id: number;
    derived_sw_code: string;
    sc_name: string;
  }>;
  
  // Work order information
  wo_details_id?: number;
  wo_no?: string | null;
  pwo_no?: string | null;
  time_taken?: number;
  skill_time_breakdown?: { [skill: string]: number };
}

// Fetch works for a specific stage - Using prdn_work_status as base
export async function fetchProductionWorks(stage: string, selectedDate: string): Promise<ProductionWork[]> {
  try {
    console.log(`🔍 Fetching works for stage: ${stage} on date: ${selectedDate}`);
    
    // Step 1: Get work orders that have been entered (have actual entry date) but not exited
    const { data: enteredWorkOrders, error: enteredError } = await supabase
      .from('prdn_dates')
      .select(`
        sales_order_id,
        prdn_wo_details!inner(
          id,
          wo_model,
          wo_no,
          pwo_no
        )
      `)
      .eq('stage_code', stage)
      .eq('date_type', 'entry')
      .not('actual_date', 'is', null);

    if (enteredError) {
      console.error('❌ Error fetching entered work orders:', enteredError);
      throw enteredError;
    }

    if (!enteredWorkOrders || enteredWorkOrders.length === 0) {
      console.log(`📭 No work orders have been entered into stage ${stage}`);
      return [];
    }

    // Get work orders that have been exited
    const { data: exitedWorkOrders, error: exitedError } = await supabase
      .from('prdn_dates')
      .select('sales_order_id')
      .eq('stage_code', stage)
      .eq('date_type', 'exit')
      .not('actual_date', 'is', null);

    if (exitedError) {
      console.error('❌ Error fetching exited work orders:', exitedError);
      throw exitedError;
    }

    const exitedWoIds = new Set((exitedWorkOrders || []).map((wo: any) => wo.sales_order_id));

    // Filter out exited work orders
    const activeWorkOrderIds = [...new Set(
      enteredWorkOrders
        .map((wo: any) => wo.sales_order_id)
        .filter((woId: number) => !exitedWoIds.has(woId))
    )];

    if (activeWorkOrderIds.length === 0) {
      console.log(`📭 No active work orders in stage ${stage} (all have been exited)`);
      return [];
    }

    console.log(`📦 Found ${activeWorkOrderIds.length} active work order IDs:`, activeWorkOrderIds);

    // Create a map of work order ID -> work order details
    const workOrderMap = new Map<number, {id: number, wo_model: string, wo_no: string | null, pwo_no: string | null}>();
    enteredWorkOrders.forEach((wo: any) => {
      const woId = wo.sales_order_id;
      if (woId && wo.prdn_wo_details && activeWorkOrderIds.includes(woId)) {
        workOrderMap.set(woId, {
          id: woId,
          wo_model: wo.prdn_wo_details.wo_model,
          wo_no: wo.prdn_wo_details.wo_no,
          pwo_no: wo.prdn_wo_details.pwo_no
        });
      }
    });

    // Step 2: Get all works from prdn_work_status for active work orders
    const { data: workStatuses, error: statusError } = await supabase
      .from('prdn_work_status')
      .select('*')
      .eq('stage_code', stage)
      .in('wo_details_id', activeWorkOrderIds)
      .neq('current_status', 'Removed'); // Exclude removed works

    if (statusError) {
      console.error('❌ Error fetching work statuses:', statusError);
      throw statusError;
    }

    if (!workStatuses || workStatuses.length === 0) {
      console.log(`📭 No works found in prdn_work_status for stage ${stage}`);
      return [];
    }

    console.log(`📦 Found ${workStatuses.length} work status records`);

    // Step 3: Batch collect all unique identifiers for efficient fetching
    const uniqueDerivedSwCodes = new Set<string>();
    const uniqueOtherWorkCodes = new Set<string>();
    const uniqueWoModels = new Set<string>();
    const workStatusMap = new Map<number, any[]>(); // woId -> work statuses
    const otherWorkCodeToStatusMap = new Map<string, { woId: number; workStatus: any }>(); // other_work_code -> {woId, workStatus}

    workStatuses.forEach((ws: any) => {
      const woId = ws.wo_details_id;
      if (!workStatusMap.has(woId)) {
        workStatusMap.set(woId, []);
      }
      workStatusMap.get(woId)!.push(ws);

      if (ws.derived_sw_code) {
        uniqueDerivedSwCodes.add(ws.derived_sw_code);
      } else if (ws.other_work_code) {
        uniqueOtherWorkCodes.add(ws.other_work_code);
        otherWorkCodeToStatusMap.set(ws.other_work_code, { woId, workStatus: ws });
      }
    });

    // Collect unique work order models
    workStatusMap.forEach((statuses, woId) => {
      const workOrder = workOrderMap.get(woId);
      if (workOrder) {
        uniqueWoModels.add(workOrder.wo_model);
      }
    });

    console.log(`📊 Batch fetching: ${uniqueDerivedSwCodes.size} standard works, ${uniqueOtherWorkCodes.size} non-standard works, ${uniqueWoModels.size} work types`);

    // Step 4: Batch fetch all data in parallel (first batch)
    const [
      workTypesData,
      workTypeDetailsData,
      workFlowData,
      skillMappingsData,
      addedWorksData
    ] = await Promise.all([
      // Fetch all work types at once
      uniqueWoModels.size > 0 ? supabase
        .from('mstr_wo_type')
        .select('*')
        .in('wo_type_name', Array.from(uniqueWoModels))
        .then(({ data, error }) => {
          if (error) console.error('Error fetching work types:', error);
          return data || [];
        }) : Promise.resolve([]),

      // Fetch all work type details at once
      uniqueDerivedSwCodes.size > 0 ? supabase
        .from('std_work_type_details')
        .select(`
          *,
          std_work_details!inner(*)
        `)
        .in('derived_sw_code', Array.from(uniqueDerivedSwCodes))
        .eq('is_active', true)
        .eq('is_deleted', false)
        .then(({ data, error }) => {
          if (error) console.error('Error fetching work type details:', error);
          return data || [];
        }) : Promise.resolve([]),

      // Fetch all work flows at once
      uniqueDerivedSwCodes.size > 0 ? supabase
        .from('std_vehicle_work_flow')
        .select('*')
        .in('derived_sw_code', Array.from(uniqueDerivedSwCodes))
        .eq('is_active', true)
        .eq('is_deleted', false)
        .then(({ data, error }) => {
          if (error) console.error('Error fetching work flows:', error);
          return data || [];
        }) : Promise.resolve([]),

      // Fetch all skill mappings at once
      uniqueDerivedSwCodes.size > 0 ? supabase
        .from('std_work_skill_mapping')
        .select(`
          *,
          std_skill_combinations!inner(
            sc_id,
            sc_name,
            manpower_required,
            skill_combination
          )
        `)
        .in('derived_sw_code', Array.from(uniqueDerivedSwCodes))
        .eq('is_active', true)
        .eq('is_deleted', false)
        .then(({ data, error }) => {
          if (error) console.error('Error fetching skill mappings:', error);
          return data || [];
        }) : Promise.resolve([]),

      // Fetch all added works at once
      uniqueOtherWorkCodes.size > 0 ? supabase
        .from('prdn_work_additions')
        .select('*')
        .eq('stage_code', stage)
        .in('wo_details_id', Array.from(workStatusMap.keys()))
        .in('other_work_code', Array.from(uniqueOtherWorkCodes))
        .then(({ data, error }) => {
          if (error) console.error('Error fetching added works:', error);
          return data || [];
        }) : Promise.resolve([])
    ]);

    // Step 4b: Fetch skill combinations for added works (after we have addedWorksData)
    const scNames = [...new Set((addedWorksData || []).map((aw: any) => aw.other_work_sc).filter(Boolean))];
    const { data: skillCombinationsData, error: scError } = scNames.length > 0
      ? await supabase
          .from('std_skill_combinations')
          .select('*')
          .in('sc_name', scNames)
      : { data: [], error: null };
    
    if (scError) {
      console.error('Error fetching skill combinations:', scError);
    }

    // Create lookup maps for fast access
    const workTypeMap = new Map<string, any>();
    workTypesData.forEach((wt: any) => {
      workTypeMap.set(wt.wo_type_name, wt);
    });

    const workTypeDetailMap = new Map<string, any>();
    workTypeDetailsData.forEach((wtd: any) => {
      workTypeDetailMap.set(wtd.derived_sw_code, wtd);
    });

    const workFlowMap = new Map<string, any>();
    workFlowData.forEach((wf: any) => {
      // Store first occurrence for each derived_sw_code
      if (!workFlowMap.has(wf.derived_sw_code)) {
        workFlowMap.set(wf.derived_sw_code, wf);
      }
    });

    const skillMappingsMap = new Map<string, any[]>();
    skillMappingsData.forEach((sm: any) => {
      const code = sm.derived_sw_code;
      if (!skillMappingsMap.has(code)) {
        skillMappingsMap.set(code, []);
      }
      skillMappingsMap.get(code)!.push(sm);
    });

    const addedWorkMap = new Map<string, any>();
    addedWorksData.forEach((aw: any) => {
      const key = `${aw.wo_details_id}_${aw.other_work_code}`;
      addedWorkMap.set(key, aw);
    });

    const skillCombinationMap = new Map<string, any>();
    skillCombinationsData.forEach((sc: any) => {
      skillCombinationMap.set(sc.sc_name, sc);
    });

    // Step 5: Enrich work statuses using the cached data
    const allEnrichedWorks: ProductionWork[] = [];

    for (const [woId, statuses] of workStatusMap.entries()) {
      const workOrder = workOrderMap.get(woId);
      if (!workOrder) {
        console.warn(`⚠️ Work order ${woId} not found in map`);
        continue;
      }

      const woModel = workOrder.wo_model;
      const workType = workTypeMap.get(woModel);

      if (!workType) {
        console.warn(`⚠️ No work type found for model ${woModel}, skipping work order ${woId}`);
        continue;
      }

      // Process each work status
      for (const workStatus of statuses) {
        const derivedSwCode = workStatus.derived_sw_code;
        const otherWorkCode = workStatus.other_work_code;

        if (derivedSwCode) {
          // Standard work - use cached data
          const workTypeDetail = workTypeDetailMap.get(derivedSwCode);
          if (!workTypeDetail) {
            console.warn(`⚠️ Could not find details for work ${derivedSwCode}`);
            continue;
          }

          const workFlow = workFlowMap.get(derivedSwCode);
          const skillMappings = skillMappingsMap.get(derivedSwCode) || [];

          const workDetail = (workTypeDetail.std_work_details as any);
          allEnrichedWorks.push({
            ...workDetail,
            std_work_type_details: {
              derived_sw_code: workTypeDetail.derived_sw_code,
              type_description: workTypeDetail.type_description || ''
            },
            std_vehicle_work_flow: workFlow || undefined,
            mstr_wo_type: workType,
            skill_mappings: skillMappings,
            wo_details_id: woId,
            wo_no: workOrder.wo_no,
            pwo_no: workOrder.pwo_no,
            is_added_work: false
          });
        } else if (otherWorkCode) {
          // Non-standard work - use cached data
          const key = `${woId}_${otherWorkCode}`;
          const addedWork = addedWorkMap.get(key);
          if (!addedWork) {
            console.warn(`⚠️ Could not find added work ${otherWorkCode} for WO ${woId}`);
            continue;
          }

          const skillCombination = addedWork.other_work_sc ? skillCombinationMap.get(addedWork.other_work_sc) : null;

          allEnrichedWorks.push({
            sw_id: 0,
            sw_code: otherWorkCode,
            sw_name: addedWork.other_work_desc || '',
            plant_stage: stage,
            sw_type: 'Non-Standard',
            sw_seq_no: 0,
            is_active: true,
            is_deleted: false,
            created_by: addedWork.added_by,
            created_dt: addedWork.added_dt,
            modified_by: addedWork.added_by,
            modified_dt: addedWork.added_dt,
            std_work_type_details: undefined,
            std_vehicle_work_flow: {
              sequence_order: 0,
              estimated_duration_minutes: addedWork.other_work_est_time_min || 0,
              wo_type_id: 0
            },
            mstr_wo_type: {
              wo_type_name: workOrder.wo_model
            },
            skill_mappings: skillCombination ? [{
              wsm_id: 0,
              derived_sw_code: otherWorkCode,
              sc_name: skillCombination.sc_name
            }] : [],
            wo_details_id: woId,
            wo_no: workOrder.wo_no,
            pwo_no: workOrder.pwo_no,
            is_added_work: true
          });
        }
      }
    }

    console.log(`✅ Total enriched works found for stage ${stage}: ${allEnrichedWorks.length}`);
    
    // Step 6: Batch fetch all reporting data at once
    const allWorkCodes = allEnrichedWorks.map(w => w.std_work_type_details?.derived_sw_code || w.sw_code).filter(Boolean);
    const allWoIds = [...new Set(allEnrichedWorks.map(w => w.wo_details_id).filter(Boolean))];

    let allReportingData: any[] = [];
    if (allWorkCodes.length > 0 && allWoIds.length > 0) {
      // Separate standard and non-standard work codes
      const standardWorkCodes = allWorkCodes.filter(code => code && !code.startsWith('OW'));
      const nonStandardWorkCodes = allWorkCodes.filter(code => code && code.startsWith('OW'));

      // Base query parameters
      const baseSelect = `
        hours_worked_till_date,
        hours_worked_today,
        from_date,
        from_time,
        to_date,
        to_time,
        prdn_work_planning!inner(
          derived_sw_code,
          other_work_code,
          stage_code,
          wo_details_id,
          hr_emp!inner(skill_short)
        )
      `;

      // Fetch reporting data for standard and non-standard works separately, then combine
      const queryPromises: Promise<any>[] = [];

      // Query for standard works
      if (standardWorkCodes.length > 0) {
        queryPromises.push(
          supabase
            .from('prdn_work_reporting')
            .select(baseSelect)
            .eq('prdn_work_planning.stage_code', stage)
            .in('prdn_work_planning.wo_details_id', allWoIds)
            .in('prdn_work_planning.derived_sw_code', standardWorkCodes)
            .eq('is_deleted', false)
            .then(({ data, error }) => {
              if (error) {
                console.error('❌ Error fetching reporting data for standard works:', error);
                return [];
              }
              return data || [];
            })
        );
      }

      // Query for non-standard works
      if (nonStandardWorkCodes.length > 0) {
        queryPromises.push(
          supabase
            .from('prdn_work_reporting')
            .select(baseSelect)
            .eq('prdn_work_planning.stage_code', stage)
            .in('prdn_work_planning.wo_details_id', allWoIds)
            .in('prdn_work_planning.other_work_code', nonStandardWorkCodes)
            .eq('is_deleted', false)
            .then(({ data, error }) => {
              if (error) {
                console.error('❌ Error fetching reporting data for non-standard works:', error);
                return [];
              }
              return data || [];
            })
        );
      }

      // Execute all queries in parallel and combine results
      if (queryPromises.length > 0) {
        const results = await Promise.all(queryPromises);
        allReportingData = results.flat();
      }
    }

    // Create a map for fast lookup: workCode_woId -> reporting data array
    const reportingDataMap = new Map<string, any[]>();
    allReportingData.forEach((report: any) => {
      const planning = report.prdn_work_planning;
      const workCode = planning?.derived_sw_code || planning?.other_work_code;
      const woId = planning?.wo_details_id;
      if (workCode && woId) {
        const key = `${workCode}_${woId}`;
        if (!reportingDataMap.has(key)) {
          reportingDataMap.set(key, []);
        }
        reportingDataMap.get(key)!.push(report);
      }
    });

    // Step 7: Enrich works with time data using cached reporting data
    const worksWithTimeData = allEnrichedWorks.map((work) => {
      const workCode = work.std_work_type_details?.derived_sw_code || work.sw_code;
      if (!workCode) return work;

      const key = `${workCode}_${work.wo_details_id}`;
      const reportingData = reportingDataMap.get(key) || [];

      // Calculate total time worked
      // If multiple workers report the same work simultaneously, we should use the average
      // of hours_worked_today from all reports, not sum all hours
      const hoursWorkedTodayValues = reportingData.map(report => report.hours_worked_today || 0).filter(h => h > 0);
      const averageTimeWorked = hoursWorkedTodayValues.length > 0 
        ? hoursWorkedTodayValues.reduce((sum, hours) => sum + hours, 0) / hoursWorkedTodayValues.length
        : 0;

      // Calculate skill-specific time breakdown
      const skillTimeBreakdown = reportingData.reduce((breakdown, report) => {
        const skillShort = report.prdn_work_planning?.hr_emp?.skill_short;
        if (!skillShort) return breakdown;
        
        // For skill breakdown, use total hours (till date + today)
        const skillTime = (report.hours_worked_till_date || 0) + (report.hours_worked_today || 0);
        breakdown[skillShort] = (breakdown[skillShort] || 0) + skillTime;
        return breakdown;
      }, {} as { [skill: string]: number });

      return {
        ...work,
        time_taken: averageTimeWorked,
        skill_time_breakdown: skillTimeBreakdown
      };
    });

    console.log(`✅ Works with time data:`, worksWithTimeData);
    return worksWithTimeData;
  } catch (error) {
    console.error('❌ Error in fetchProductionWorks:', error);
    return [];
  }
}

// Work Planning Functions
export async function createWorkPlanning(planningData: CreateWorkPlanningData, createdBy: string): Promise<WorkPlanning> {
  try {
    const now = new Date().toISOString();
    
    const { data, error } = await supabase
      .from('prdn_work_planning')
      .insert({
        ...planningData,
        time_worked_till_date: planningData.time_worked_till_date || 0,
        remaining_time: planningData.remaining_time || planningData.planned_hours,
        status: planningData.status || 'planned',
        created_by: createdBy,
        created_dt: now,
        // modified_by and modified_dt should equal created_by and created_dt on insert
        modified_by: createdBy,
        modified_dt: now
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error creating work planning:', error);
    throw error;
  }
}

export async function fetchWorkPlanning(stageCode: string, date: string): Promise<WorkPlanning[]> {
  try {
    // Use explicit filter to ensure is_deleted = false is properly applied
    // Also check for null to handle any edge cases
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
      .eq('from_date', date)
      .eq('is_active', true)
      .eq('is_deleted', false)
      .order('from_time', { ascending: true });

    if (error) throw error;
    
    // Log all records before filtering for debugging
    console.log(`🔍 fetchWorkPlanning: Retrieved ${(data || []).length} records from database for ${stageCode} on ${date}`);
    if (data && data.length > 0) {
      data.forEach((record: any) => {
        console.log(`  - Record ID ${record.id}: derived_sw_code=${record.derived_sw_code}, other_work_code=${record.other_work_code}, is_deleted=${record.is_deleted} (type: ${typeof record.is_deleted})`);
      });
    }
    
    // Additional safeguard: filter out any soft-deleted records that might have slipped through
    // This handles edge cases where is_deleted might be stored as string 'true' instead of boolean true
    // Also handles cases where Supabase query filter might not work correctly for non-standard works
    const filteredData = (data || []).filter(record => {
      const isDeleted = record.is_deleted;
      // Check for all possible truthy values that indicate deletion
      const isActuallyDeleted = isDeleted === true || 
                                isDeleted === 'true' || 
                                isDeleted === 'True' || 
                                isDeleted === 'TRUE' ||
                                isDeleted === 1 ||
                                isDeleted === '1' ||
                                String(isDeleted).toLowerCase() === 'true';
      
      if (isActuallyDeleted) {
        console.warn(`⚠️ Filtered out soft-deleted planning record ID ${record.id}:`, {
          derived_sw_code: record.derived_sw_code,
          other_work_code: record.other_work_code,
          is_deleted: isDeleted,
          is_deleted_type: typeof isDeleted
        });
        return false;
      }
      return true;
    });
    
    if (filteredData.length !== (data || []).length) {
      console.log(`🔍 Filtered out ${(data || []).length - filteredData.length} soft-deleted planning records (database query should have filtered these)`);
    }
    
    console.log(`✅ fetchWorkPlanning: Returning ${filteredData.length} active planning records after filtering`);
    
    return filteredData;
  } catch (error) {
    console.error('Error fetching work planning:', error);
    throw error;
  }
}

export async function updateWorkPlanning(id: number, planningData: Partial<CreateWorkPlanningData>, modifiedBy: string): Promise<WorkPlanning> {
  try {
    const now = new Date().toISOString();
    
    const { data, error } = await supabase
      .from('prdn_work_planning')
      .update({
        ...planningData,
        modified_by: modifiedBy,
        modified_dt: now
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error updating work planning:', error);
    throw error;
  }
}

export async function deleteWorkPlanning(id: number, modifiedBy: string): Promise<void> {
  try {
    const now = new Date().toISOString();
    
    const { error } = await supabase
      .from('prdn_work_planning')
      .update({
        is_deleted: true,
        modified_by: modifiedBy,
        modified_dt: now
      })
      .eq('id', id);

    if (error) throw error;
  } catch (error) {
    console.error('Error deleting work planning:', error);
    throw error;
  }
}

// Check if a work can be planned (no pending unreported plans)
export async function canPlanWork(
  derivedSwCode: string | null,
  stageCode: string,
  woDetailsId?: number,
  otherWorkCode?: string | null
): Promise<{
  canPlan: boolean;
  reason?: string;
  lastPlan?: WorkPlanning;
}> {
  try {
    const workCode = derivedSwCode || otherWorkCode || 'Unknown';
    console.log(`🔍 Checking planning status for work: ${workCode} in stage: ${stageCode}${woDetailsId ? ` for WO ID: ${woDetailsId}` : ''} (${derivedSwCode ? 'standard' : 'non-standard'})`);
    
    // First check if this work has been removed (check specific work order if provided)
    let removalQuery = supabase
      .from('prdn_work_removals')
      .select('id, derived_sw_code, other_work_code, wo_details_id, stage_code, removal_reason')
      .eq('stage_code', stageCode);

    if (derivedSwCode) {
      removalQuery = removalQuery.eq('derived_sw_code', derivedSwCode);
    } else if (otherWorkCode) {
      removalQuery = removalQuery.eq('other_work_code', otherWorkCode);
    }

    if (woDetailsId) {
      removalQuery = removalQuery.eq('wo_details_id', woDetailsId);
    }

    const { data: removalData, error: removalError } = woDetailsId 
      ? await removalQuery.maybeSingle()
      : await removalQuery.limit(1);

    if (removalError && removalError.code !== 'PGRST116') {
      console.error('❌ Error checking work removal status:', removalError);
      // Continue with planning check even if removal check fails
    }

    if (removalData && (Array.isArray(removalData) ? removalData.length > 0 : removalData)) {
      const removal = Array.isArray(removalData) ? removalData[0] : removalData;
      console.log(`❌ Work ${workCode} has been removed from ${stageCode}${woDetailsId ? ` for WO ID: ${woDetailsId}` : ''}`);
      return {
        canPlan: false,
        reason: `This work has been removed from production. Reason: ${removal.removal_reason || 'Not specified'}`
      };
    }
    
    // Get the most recent plan for this work in this stage
    // Use OR condition to match either derived_sw_code or other_work_code
    let planningQuery = supabase
      .from('prdn_work_planning')
      .select('*')
      .eq('stage_code', stageCode)
      .eq('is_active', true)
      .eq('is_deleted', false)
      .order('created_dt', { ascending: false })
      .limit(1);

    if (derivedSwCode && otherWorkCode) {
      // Both provided (shouldn't happen, but handle it)
      planningQuery = planningQuery.or(`derived_sw_code.eq.${derivedSwCode},other_work_code.eq.${otherWorkCode}`);
    } else if (derivedSwCode) {
      planningQuery = planningQuery.eq('derived_sw_code', derivedSwCode);
    } else if (otherWorkCode) {
      planningQuery = planningQuery.eq('other_work_code', otherWorkCode);
    } else {
      console.warn(`⚠️ Cannot check planning status: no derived_sw_code or other_work_code provided`);
      return {
        canPlan: false,
        reason: 'Invalid work code provided'
      };
    }

    const { data, error } = await planningQuery;

    if (error) {
      console.error('❌ Error checking work planning status:', error);
      throw error;
    }

    console.log(`📊 Found ${data?.length || 0} previous plans for work ${workCode}`);

    // If no previous plans exist, work can be planned
    if (!data || data.length === 0) {
      console.log(`✅ No previous plans found for ${workCode} - can plan`);
      return { canPlan: true };
    }

    const lastPlan = data[0];
    console.log(`📋 Last plan found: ID ${lastPlan.id}, Date: ${lastPlan.from_date}`);

    // Check if the last plan has been reported
    const { data: reportData, error: reportError } = await supabase
      .from('prdn_work_reporting')
      .select('*')
      .eq('planning_id', lastPlan.id)
      .eq('is_active', true)
      .eq('is_deleted', false)
      .maybeSingle();

    if (reportError) {
      console.error('❌ Error checking work reporting:', reportError);
      throw reportError;
    }

    console.log(`📋 Report data for plan ${lastPlan.id}:`, reportData ? 'Found' : 'Not found');

    // If no report exists, work cannot be planned (pending unreported plan)
    if (!reportData) {
      console.log(`❌ No report found for plan ${lastPlan.id} - cannot plan`);
      return {
        canPlan: false,
        reason: `Work already has a pending plan from ${new Date(lastPlan.from_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' })} that has not been reported yet. Please report or delete the existing plan first.`,
        lastPlan
      };
    }

    // If report exists, check the completion status
    console.log(`📊 Report completion status: ${reportData.completion_status}`);
    
    if (reportData.completion_status === 'NC') {
      // Work was not completed, can be planned again
      console.log(`✅ Work was not completed (NC) - can plan again`);
      return { canPlan: true };
    } else {
      // Work was completed, cannot be planned again
      console.log(`❌ Work was completed (${reportData.completion_status}) - cannot plan again`);
      return {
        canPlan: false,
        reason: `Work was already completed on ${new Date(reportData.from_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' })} with status '${reportData.completion_status}'.`,
        lastPlan
      };
    }
  } catch (error) {
    console.error('❌ Error in canPlanWork:', error);
    return {
      canPlan: false,
      reason: `Error checking work planning status: ${(error as Error)?.message || 'Unknown error'}`
    };
  }
}

// Work Removal Functions
export async function removeWorkFromProduction(
  derivedSwCode: string | null, // Made nullable
  stageCode: string,
  woDetailsId: number,
  removalReason: string,
  removedBy: string,
  otherWorkCode: string | null = null // Added to differentiate non-standard works
): Promise<{ success: boolean; error?: string }> {
  try {
    const now = new Date().toISOString();
    
    // Validate required fields
    if (!removalReason || !removalReason.trim()) {
      return { success: false, error: 'Removal reason is mandatory' };
    }

    if (!woDetailsId) {
      return { success: false, error: 'Work order details ID is required' };
    }

    // Determine if this is a standard or non-standard work
    const isNonStandardWork = !derivedSwCode && otherWorkCode;
    
    // Insert removal record
    const { data: removalData, error: removalError } = await supabase
      .from('prdn_work_removals')
      .insert({
        derived_sw_code: derivedSwCode, // Will be null for non-standard works
        other_work_code: otherWorkCode, // Will be null for standard works
        stage_code: stageCode,
        wo_details_id: woDetailsId,
        removal_reason: removalReason.trim(),
        removed_by: removedBy,
        removed_dt: now
      })
      .select()
      .single();

    if (removalError) {
      console.error('Error creating removal record:', removalError);
      return { success: false, error: removalError.message };
    }

    // First, get planning IDs for this work to check reporting history BEFORE soft-deleting
    // This is needed to determine the correct status
    let planningQuery = supabase
      .from('prdn_work_planning')
      .select('id')
      .eq('stage_code', stageCode)
      .eq('wo_details_id', woDetailsId)
      .eq('is_deleted', false);

    // Apply the appropriate filter based on work type
    // For standard works: filter by derived_sw_code and ensure other_work_code is null
    // For non-standard works: filter by other_work_code and ensure derived_sw_code is null
    if (derivedSwCode) {
      planningQuery = planningQuery.eq('derived_sw_code', derivedSwCode).is('other_work_code', null);
    } else if (otherWorkCode) {
      planningQuery = planningQuery.eq('other_work_code', otherWorkCode).is('derived_sw_code', null);
    }

    const { data: planningRecords, error: planningCheckError } = await planningQuery;

    // Determine the appropriate status based on reporting history
    // Check if work was reported earlier with Non Completed status
    let newStatus = 'Yet to be Planned'; // Default: not reported till date
    
    if (!planningCheckError && planningRecords && planningRecords.length > 0) {
      const planningIds = planningRecords.map(p => p.id);
      
      // Check if any reports exist with Non Completed status
      const { data: reportData, error: reportCheckError } = await supabase
        .from('prdn_work_reporting')
        .select('completion_status')
        .in('planning_id', planningIds)
        .eq('is_deleted', false);

      if (!reportCheckError && reportData && reportData.length > 0) {
        // Check if any report has Non Completed status
        const hasNonCompleted = reportData.some(report => report.completion_status === 'NC');
        if (hasNonCompleted) {
          newStatus = 'In Progress';
          console.log(`📊 Work ${derivedSwCode || otherWorkCode} was reported as Non Completed - setting status to In Progress`);
        }
      }
    }

    // Soft delete all planning records for this work in this stage and work order
    // Use OR condition to handle both standard and non-standard works properly
    let planningUpdateQuery = supabase
      .from('prdn_work_planning')
      .update({
        is_deleted: true,
        modified_by: removedBy,
        modified_dt: now
      })
      .eq('stage_code', stageCode)
      .eq('wo_details_id', woDetailsId)
      .eq('is_deleted', false);

    // Apply the appropriate filter based on work type
    // For standard works: filter by derived_sw_code
    // For non-standard works: filter by other_work_code
    if (derivedSwCode) {
      planningUpdateQuery = planningUpdateQuery.eq('derived_sw_code', derivedSwCode).is('other_work_code', null);
    } else if (otherWorkCode) {
      planningUpdateQuery = planningUpdateQuery.eq('other_work_code', otherWorkCode).is('derived_sw_code', null);
    } else {
      // If neither is provided, log a warning but still try to delete (shouldn't happen)
      console.warn('⚠️ No work code provided for planning record deletion');
    }

    const { error: planningError } = await planningUpdateQuery;

    if (planningError) {
      console.error('Error updating planning records:', planningError);
      // Note: Removal record was created, but planning update failed
      // This is logged but we still return success since removal was recorded
    }

    // Update prdn_work_status with the determined status
    let statusUpdateQuery = supabase
      .from('prdn_work_status')
      .update({
        current_status: newStatus,
        modified_by: removedBy,
        modified_dt: now
      })
      .eq('stage_code', stageCode)
      .eq('wo_details_id', woDetailsId);

    if (derivedSwCode) {
      statusUpdateQuery = statusUpdateQuery.eq('derived_sw_code', derivedSwCode);
    } else if (otherWorkCode) {
      statusUpdateQuery = statusUpdateQuery.eq('other_work_code', otherWorkCode);
    } else {
      console.warn('⚠️ Cannot update work status: no derived_sw_code or other_work_code provided for removal');
      return { success: true }; // Still return success as removal record was created
    }

    const { error: statusError } = await statusUpdateQuery;

    if (statusError) {
      console.error(`Error updating work status to ${newStatus}:`, statusError);
      // Note: Removal record was created, but status update failed
      // This is logged but we still return success since removal was recorded
    } else {
      console.log(`✅ Updated work status to ${newStatus} for work ${derivedSwCode || otherWorkCode}`);
    }

    return { success: true };
  } catch (error) {
    console.error('Error removing work from production:', error);
    return { success: false, error: (error as Error).message };
  }
}

// Get available standard works for a work order (not in std_vehicle_work_flow and not removed)
export async function getAvailableStandardWorks(
  woDetailsId: number,
  stageCode: string
): Promise<Array<{ derived_sw_code: string; type_description: string; sw_name: string }>> {
  try {
    // Get work order details to find wo_model
    const { data: woDetails, error: woError } = await supabase
      .from('prdn_wo_details')
      .select('wo_model')
      .eq('id', woDetailsId)
      .single();

    if (woError || !woDetails) {
      console.error('Error fetching work order details:', woError);
      return [];
    }

    // Get work type ID from wo_model
    const { data: workType, error: workTypeError } = await supabase
      .from('mstr_wo_type')
      .select('id')
      .eq('wo_type_name', woDetails.wo_model)
      .single();

    if (workTypeError || !workType) {
      console.error('Error fetching work type:', workTypeError);
      return [];
    }

    // Get all derived work codes linked to this work type in std_vehicle_work_flow
    const { data: linkedWorks, error: linkedError } = await supabase
      .from('std_vehicle_work_flow')
      .select('derived_sw_code')
      .eq('wo_type_id', workType.id)
      .eq('is_active', true)
      .eq('is_deleted', false);

    const linkedCodes = new Set((linkedWorks || []).map(w => w.derived_sw_code));

    // Get all removed works for this work order and stage
    const { data: removedWorks, error: removedError } = await supabase
      .from('prdn_work_removals')
      .select('derived_sw_code')
      .eq('wo_details_id', woDetailsId)
      .eq('stage_code', stageCode);

    const removedCodes = new Set((removedWorks || []).map(r => r.derived_sw_code));

    // Get all derived work codes that are NOT linked and NOT removed
    const { data: allWorkTypeDetails, error: allError } = await supabase
      .from('std_work_type_details')
      .select(`
        derived_sw_code,
        type_description,
        std_work_details!inner(sw_name)
      `)
      .eq('is_active', true)
      .eq('is_deleted', false);

    if (allError) {
      console.error('Error fetching work type details:', allError);
      return [];
    }

    // Filter: not linked to this work type AND not removed for this work order
    const available = (allWorkTypeDetails || [])
      .filter(wtd => {
        const code = wtd.derived_sw_code;
        return !linkedCodes.has(code) && !removedCodes.has(code);
      })
      .map(wtd => ({
        derived_sw_code: wtd.derived_sw_code,
        type_description: wtd.type_description || '',
        sw_name: (wtd.std_work_details as any)?.sw_name || ''
      }));

    return available;
  } catch (error) {
    console.error('Error getting available standard works:', error);
    return [];
  }
}

// Get next available non-standard work code (OW001-OW999) for a work order across all stages
export async function getNextNonStandardWorkCode(woDetailsId: number): Promise<string> {
  try {
    // Get all existing other_work_codes for this work order across all stages
    const { data: existingCodes, error: existingError } = await supabase
      .from('prdn_work_additions')
      .select('other_work_code')
      .eq('wo_details_id', woDetailsId)
      .not('other_work_code', 'is', null);

    if (existingError) {
      console.error('Error fetching existing work codes:', existingError);
      // Default to OW001 if error
      return 'OW001';
    }

    // Extract numeric parts and find the highest
    const usedNumbers = new Set<number>();
    (existingCodes || []).forEach(code => {
      const match = code.other_work_code?.match(/^OW(\d+)$/);
      if (match) {
        usedNumbers.add(parseInt(match[1], 10));
      }
    });

    // Find next available number (1-999)
    for (let i = 1; i <= 999; i++) {
      if (!usedNumbers.has(i)) {
        return `OW${i.toString().padStart(3, '0')}`;
      }
    }

    // If all codes are used (shouldn't happen), return error
    throw new Error('All work codes (OW001-OW999) are already used for this work order');
  } catch (error) {
    console.error('Error getting next non-standard work code:', error);
    throw error;
  }
}

// Get all skill combinations
export async function getSkillCombinations(): Promise<Array<{ sc_name: string; skill_combination: any; skill_combination_display: string }>> {
  try {
    const { data, error } = await supabase
      .from('std_skill_combinations')
      .select('sc_name, skill_combination')
      .eq('is_active', true)
      .eq('is_deleted', false)
      .order('sc_name');

    if (error) {
      console.error('Error fetching skill combinations:', error);
      return [];
    }

    // Format skill_combination array to a readable string
    return (data || []).map(sc => {
      let displayText = '';
      if (sc.skill_combination && Array.isArray(sc.skill_combination)) {
        // Sort by skill_order and extract skill names
        const sorted = [...sc.skill_combination].sort((a, b) => (a.skill_order || 0) - (b.skill_order || 0));
        displayText = sorted.map(s => s.skill_name || s.skill_id).join(', ');
      } else if (typeof sc.skill_combination === 'string') {
        // If it's already a string, use it as is
        displayText = sc.skill_combination;
      }
      
      return {
        sc_name: sc.sc_name,
        skill_combination: sc.skill_combination,
        skill_combination_display: displayText || 'No skills'
      };
    });
  } catch (error) {
    console.error('Error getting skill combinations:', error);
    return [];
  }
}

// Add work to production (standard or non-standard)
export async function addWorkToProduction(
  stageCode: string,
  woDetailsId: number,
  workType: 'standard' | 'non-standard',
  standardWorkData?: {
    derived_sw_code: string;
    addition_reason: string;
  },
  nonStandardWorkData?: {
    other_work_code: string;
    other_work_desc: string;
    other_work_sc: string;
    other_work_est_time_min: number;
    addition_reason: string;
  },
  addedBy: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const now = new Date().toISOString();

    if (workType === 'standard') {
      if (!standardWorkData || !standardWorkData.derived_sw_code || !standardWorkData.addition_reason.trim()) {
        return { success: false, error: 'Standard work data is incomplete' };
      }

      const { data, error } = await supabase
        .from('prdn_work_additions')
        .insert({
          stage_code: stageCode,
          wo_details_id: woDetailsId,
          derived_sw_code: standardWorkData.derived_sw_code,
          addition_reason: standardWorkData.addition_reason.trim(),
          added_by: addedBy,
          added_dt: now
        })
        .select()
        .single();

      if (error) {
        console.error('Error adding standard work:', error);
        return { success: false, error: error.message };
      }

      // Insert into prdn_work_status with 'Yet to be Planned' status
      // First check if record already exists (might exist from Entry process)
      const { getCurrentUsername, getCurrentTimestamp } = await import('$lib/utils/userUtils');
      const currentUser = getCurrentUsername();
      const timestamp = getCurrentTimestamp();

      // Check if work status already exists
      const { data: existingStatus, error: checkError } = await supabase
        .from('prdn_work_status')
        .select('id')
        .eq('stage_code', stageCode)
        .eq('wo_details_id', woDetailsId)
        .eq('derived_sw_code', standardWorkData.derived_sw_code)
        .maybeSingle();

      if (checkError) {
        console.error('Error checking existing work status:', checkError);
      }

      // Only insert if it doesn't exist
      if (!existingStatus) {
        const { error: statusError } = await supabase
          .from('prdn_work_status')
          .insert({
            stage_code: stageCode,
            wo_details_id: woDetailsId,
            derived_sw_code: standardWorkData.derived_sw_code,
            other_work_code: null,
            current_status: 'Yet to be Planned',
            created_by: currentUser,
            created_dt: timestamp,
            modified_by: currentUser,
            modified_dt: timestamp
          });

        if (statusError) {
          console.error('Error inserting work status:', statusError);
          // Note: Work addition was created, but status insert failed
          // This is logged but we still return success since addition was recorded
        } else {
          console.log(`✅ Created work status record for ${standardWorkData.derived_sw_code}`);
        }
      } else {
        console.log(`ℹ️ Work status record already exists for ${standardWorkData.derived_sw_code}, skipping insert`);
      }

      return { success: true };
    } else {
      if (!nonStandardWorkData || 
          !nonStandardWorkData.other_work_code || 
          !nonStandardWorkData.other_work_desc.trim() ||
          !nonStandardWorkData.other_work_sc ||
          !nonStandardWorkData.other_work_est_time_min ||
          !nonStandardWorkData.addition_reason.trim()) {
        return { success: false, error: 'Non-standard work data is incomplete' };
      }

      const { data, error } = await supabase
        .from('prdn_work_additions')
        .insert({
          stage_code: stageCode,
          wo_details_id: woDetailsId,
          other_work_code: nonStandardWorkData.other_work_code,
          other_work_desc: nonStandardWorkData.other_work_desc.trim(),
          other_work_sc: nonStandardWorkData.other_work_sc,
          other_work_est_time_min: nonStandardWorkData.other_work_est_time_min,
          addition_reason: nonStandardWorkData.addition_reason.trim(),
          added_by: addedBy,
          added_dt: now
        })
        .select()
        .single();

      if (error) {
        console.error('Error adding non-standard work:', error);
        return { success: false, error: error.message };
      }

      // Insert into prdn_work_status with 'Yet to be Planned' status
      // First check if record already exists
      const { getCurrentUsername, getCurrentTimestamp } = await import('$lib/utils/userUtils');
      const currentUser = getCurrentUsername();
      const timestamp = getCurrentTimestamp();

      // Check if work status already exists
      const { data: existingStatus, error: checkError } = await supabase
        .from('prdn_work_status')
        .select('id')
        .eq('stage_code', stageCode)
        .eq('wo_details_id', woDetailsId)
        .eq('other_work_code', nonStandardWorkData.other_work_code)
        .maybeSingle();

      if (checkError) {
        console.error('Error checking existing work status:', checkError);
      }

      // Only insert if it doesn't exist
      if (!existingStatus) {
        const { error: statusError } = await supabase
          .from('prdn_work_status')
          .insert({
            stage_code: stageCode,
            wo_details_id: woDetailsId,
            derived_sw_code: null,
            other_work_code: nonStandardWorkData.other_work_code,
            current_status: 'Yet to be Planned',
            created_by: currentUser,
            created_dt: timestamp,
            modified_by: currentUser,
            modified_dt: timestamp
          });

        if (statusError) {
          console.error('Error inserting work status:', statusError);
          // Note: Work addition was created, but status insert failed
          // This is logged but we still return success since addition was recorded
        } else {
          console.log(`✅ Created work status record for non-standard work ${nonStandardWorkData.other_work_code}`);
        }
      } else {
        console.log(`ℹ️ Work status record already exists for non-standard work ${nonStandardWorkData.other_work_code}, skipping insert`);
      }

      return { success: true };
    }
  } catch (error) {
    console.error('Error adding work to production:', error);
    return { success: false, error: (error as Error).message };
  }
}
