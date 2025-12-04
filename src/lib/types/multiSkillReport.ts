// Multi-Skill Report Work Types and Interfaces

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
  completionStatus: 'C' | 'NC';
  skillEmployees: { [skillId: string]: string };
  deviations: { [skillId: string]: SkillDeviation };
  ltMinutes: number;
  ltReasonId: string;
  ltComments: string;
  breakdownData: BreakdownData;
}

export interface MultiSkillReportState {
  currentStage: 1 | 2;
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
  completionStatus: 'C',
  skillEmployees: {},
  deviations: {},
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

