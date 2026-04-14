// Production API Types and Interfaces

/** C-Off fields saved with planned/reported manpower attendance (same row). */
export interface ManpowerCOffSave {
  cOffValue: number;
  cOffFromDate?: string | null;
  cOffFromTime?: string | null;
  cOffToDate?: string | null;
  cOffToTime?: string | null;
}

/** OT fields saved with planned/reported manpower attendance (prdn_*_manpower.ot_*). */
export interface ManpowerOTSave {
  otHours: number;
  otFromDate?: string | null;
  otFromTime?: string | null;
  otToDate?: string | null;
  otToTime?: string | null;
}

export interface ProductionEmployee {
  id: number;
  emp_id: string;
  emp_name: string;
  skill_short: string;
  shift_code: string;
  shift_name?: string;
  current_stage: string;
  original_stage?: string; // Original assigned stage from hr_emp.stage
  attendance_status?: 'present' | 'absent' | null;
  // Attendance details (from prdn_planning_manpower or prdn_reporting_manpower)
  planned_hours?: number | null; // For planning mode
  actual_hours?: number | null; // For reporting mode
  /** Same as planning_from_date / planning_to_date or reporting_from_date / reporting_to_date on the row. */
  attendance_from_date?: string | null;
  attendance_to_date?: string | null;
  attendance_from_time?: string | null;
  attendance_to_time?: string | null;
  attendance_notes?: string | null;
  c_off_value?: number | null;
  c_off_from_date?: string | null;
  c_off_from_time?: string | null;
  c_off_to_date?: string | null;
  c_off_to_time?: string | null;
  /** Manpower row OT (DB prdn_*_manpower.ot_*), not work-report OT aggregate. */
  manpower_ot_hours?: number | null;
  manpower_ot_from_date?: string | null;
  manpower_ot_from_time?: string | null;
  manpower_ot_to_date?: string | null;
  manpower_ot_to_time?: string | null;
  hours_planned?: number;
  hours_reported?: number;
  /** Aggregated OT from work reporting (prdn_work_reporting); Manpower Report tab “Work OT”. */
  ot_hours?: number;
  lt_hours?: number;
  ltp_hours?: number;
  ltnp_hours?: number;
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
  shift_code: string;
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
  shift_code: string;
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
  status?: 'draft' | 'planned' | 'submitted' | 'to_redo' | 'approved' | 'pending_approval' | 'rejected';
  notes?: string;
  wsm_id?: number | null;
  other_work_code?: string | null;
}

export interface ProductionWork {
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
  std_work_type_details?: {
    derived_sw_code: string;
    type_description: string;
    std_work_details?: {
      sw_name: string;
    };
  };
  prdn_wo_details?: {
    wo_no: string;
    pwo_no: string;
  };
  std_vehicle_work_flow?: {
    sequence_order: number;
    estimated_duration_minutes?: number;
    wo_type_id: number;
  };
  skill_time_standards?: {
    isUniform: boolean;
    values: Array<{
      skill_short: string;
      standard_time_minutes: number;
    }>;
  };
  mstr_wo_type?: {
    wo_type_name: string;
  };
  skill_mappings?: Array<{
    wsm_id: number;
    derived_sw_code: string;
    sc_name: string;
  }>;
  wo_details_id?: number;
  wo_no?: string | null;
  pwo_no?: string | null;
  time_taken?: number;
  skill_time_breakdown?: { [skill: string]: number };
}

