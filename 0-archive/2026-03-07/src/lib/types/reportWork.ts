// Report Work Types and Interfaces

export interface LostTimeChunk {
  id: string;
  minutes: number;
  reasonId: number;
  reasonName: string;
  isPayable: boolean;
  cost: number;
}

export interface ReportWorkFormData {
  selectedWorkerId: string;
  fromDate: string;
  fromTime: string;
  toDate: string;
  toTime: string;
  completionStatus: 'C' | 'NC';
  hoursWorkedToday: number;
  hoursWorkedTillDate: number;
  ltMinutes: number;
  lostTimeChunks: LostTimeChunk[];
  totalLostTimeMinutes: number;
  currentChunkIndex: number;
}

export interface ReportWorkState {
  currentStage: 1 | 2 | 3;
  standardTimeMinutes: number;
  actualTimeMinutes: number;
  showLostTimeSection: boolean;
  selectedEmployeeSalary: number;
}

export const initialReportWorkFormData: ReportWorkFormData = {
  selectedWorkerId: '',
  fromDate: '',
  fromTime: '',
  toDate: '',
  toTime: '',
  completionStatus: 'C',
  hoursWorkedToday: 0,
  hoursWorkedTillDate: 0,
  ltMinutes: 0,
  lostTimeChunks: [],
  totalLostTimeMinutes: 0,
  currentChunkIndex: 0
};

export const initialReportWorkState: ReportWorkState = {
  currentStage: 1,
  standardTimeMinutes: 0,
  actualTimeMinutes: 0,
  showLostTimeSection: false,
  selectedEmployeeSalary: 0
};

