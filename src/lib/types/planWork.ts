// Plan Work Types and Interfaces

export interface Worker {
  emp_id: string;
  emp_name: string;
  skill_short: string;
}

export interface SelectedWorker {
  emp_id: string;
  emp_name: string;
  skill_short: string;
}

export interface WorkContinuation {
  hasPreviousWork: boolean;
  timeWorkedTillDate: number;
  remainingTime: number;
  previousReports: any[];
}

export interface ShiftInfo {
  hr_shift_master?: {
    shift_id?: number;
    shift_name: string;
    start_time: string;
    end_time: string;
    [key: string]: any; // Allow other fields from database
  };
}

export interface TimeSlot {
  value: string;
  display: string;
}

/** Optional per-row override (times only; dates use global Step 1). Key = skill slot e.g. US-0 or trainee-0. */
export interface RowTimeOverride {
  useCustom: boolean;
  fromTime: string;
  toTime: string;
}

/** Shared by Plan Work and Multi-Skill Report for `getEffectiveRowTimes`. */
export interface RowTimeFormLike {
  fromDate?: string;
  toDate?: string;
  fromTime?: string;
  toTime?: string;
  plannedHours?: number;
  /** When set, planned hours subtract overlap with these breaks inside each slot. */
  shiftBreakTimes?: Array<{ start_time: string; end_time: string }>;
  rowTimeOverrides?: Record<string, RowTimeOverride>;
}

export interface PlanWorkFormData {
  selectedWorkers: { [skill: string]: SelectedWorker | null };
  selectedTrainees: SelectedWorker[];
  traineeDeviationReason: string;
  fromDate: string;
  toDate: string;
  fromTime: string;
  toTime: string;
  plannedHours: number;
  selectedSkillMappingIndex: number;
  /** Shift breaks from DB; used for net planned hours (overlap subtraction). */
  shiftBreakTimes: Array<{ start_time: string; end_time: string }>;
  /** Per assignment row: custom from/to time only (optional). */
  rowTimeOverrides: Record<string, RowTimeOverride>;
}

export interface PlanWorkWarnings {
  showSkillMismatchWarning: boolean;
  skillMismatchDetails: string;
  showTimeOverlapWarning: boolean;
  timeOverlapDetails: string;
  showTimeExcessWarning: boolean;
  timeExcessDetails: string;
  hasAlternativePlanningConflict: boolean;
  alternativeConflictDetails: string;
}

export const initialPlanWorkFormData: PlanWorkFormData = {
  selectedWorkers: {},
  selectedTrainees: [],
  traineeDeviationReason: '',
  fromDate: '',
  toDate: '',
  fromTime: '',
  toTime: '',
  plannedHours: 0,
  selectedSkillMappingIndex: -1,
  shiftBreakTimes: [],
  rowTimeOverrides: {}
};

export const initialWarnings: PlanWorkWarnings = {
  showSkillMismatchWarning: false,
  skillMismatchDetails: '',
  showTimeOverlapWarning: false,
  timeOverlapDetails: '',
  showTimeExcessWarning: false,
  timeExcessDetails: '',
  hasAlternativePlanningConflict: false,
  alternativeConflictDetails: ''
};

