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

export interface PlanWorkFormData {
  selectedWorkers: { [skill: string]: SelectedWorker | null };
  fromTime: string;
  toTime: string;
  plannedHours: number;
  selectedSkillMappingIndex: number;
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
  fromTime: '',
  toTime: '',
  plannedHours: 0,
  selectedSkillMappingIndex: -1
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

