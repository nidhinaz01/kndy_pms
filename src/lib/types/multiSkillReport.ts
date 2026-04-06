// Multi-Skill Report Work Types and Interfaces

import type { RowTimeOverride } from '$lib/types/planWork';

export interface MultiSkillTraineeEntry {
  emp_id: string;
  emp_name: string;
  skill_short: string;
  /** When editing an existing draft report row */
  reporting_id?: number;
  planning_id?: number;
}

export interface BreakdownItem {
  reasonId: number;
  minutes: number;
  cost: number;
  workerCosts?: { [workerId: string]: number }; // Per-worker lost time costs
}

export interface BreakdownData {
  totalMinutes: number;
  totalCost: number;
  breakdownItems: BreakdownItem[];
  workerTotals?: { [workerId: string]: number }; // Per-worker total lost time amounts
}

export interface SkillDeviation {
  hasDeviation: boolean;
  reason: string;
  deviationType: 'no_worker' | 'skill_mismatch' | 'exceeds_std_time';
}

export interface MultiSkillReportFormData {
  fromDate: string;
  fromTime: string;
  toDate: string;
  toTime: string;
  /** Span of global from/to (used as default for rows without custom times). */
  plannedHours: number;
  completionStatus: 'C' | 'NC';
  skillEmployees: { [skillId: string]: string };
  deviations: { [skillId: string]: SkillDeviation };
  selectedTrainees: MultiSkillTraineeEntry[];
  traineeDeviationReason: string;
  /** Keys: planning id string for skill rows, `trainee-0` … for additional trainees. */
  rowTimeOverrides: Record<string, RowTimeOverride>;
  ltMinutes: number;
  ltReasonId: string;
  ltComments: string;
  breakdownData: BreakdownData;
  actualTimeMinutes?: number;
  showLostTimeSection?: boolean;
}

export interface MultiSkillReportState {
  /** 1 = time, 2 = assign workers (+ optional row times), 3 = lost time & save (standard works only). */
  currentStage: 1 | 2 | 3;
  standardTimeMinutes: number;
  actualTimeMinutes: number;
  showLostTimeSection: boolean;
  averageEmployeeSalary: number;
}

export const initialMultiSkillReportFormData: MultiSkillReportFormData = {
  fromDate: '',
  fromTime: '',
  toDate: '',
  toTime: '',
  plannedHours: 0,
  completionStatus: 'C',
  skillEmployees: {},
  deviations: {},
  selectedTrainees: [],
  traineeDeviationReason: '',
  rowTimeOverrides: {},
  ltMinutes: 0,
  ltReasonId: '',
  ltComments: '',
  breakdownData: {
    totalMinutes: 0,
    totalCost: 0,
    breakdownItems: []
  }
};

export const initialMultiSkillReportState: MultiSkillReportState = {
  currentStage: 1,
  standardTimeMinutes: 0,
  actualTimeMinutes: 0,
  showLostTimeSection: false,
  averageEmployeeSalary: 0
};

