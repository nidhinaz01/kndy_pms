// Works Table Types and Interfaces

export interface WorkPlanningStatus {
  canPlan: boolean;
  reason?: string;
}

export type WorkStatus = 'To be planned' | 'Draft Plan' | 'Plan Pending Approval' | 'Planned' | 'In progress' | 'Completed';

export interface WorksTableFilters {
  searchTerm: string;
  woNoFilter: string;
  pwoNoFilter: string;
  vehicleModelFilter: string;
  workCodeFilter: string;
  workNameFilter: string;
  requiredSkillsFilter: string;
}

export interface WorksTableState {
  showFilters: boolean;
  selectedRows: Set<string>;
  workPlanningStatus: { [key: string]: WorkPlanningStatus };
  workStatus: { [key: string]: WorkStatus };
}

export const initialWorksTableFilters: WorksTableFilters = {
  searchTerm: '',
  woNoFilter: '',
  pwoNoFilter: '',
  vehicleModelFilter: '',
  workCodeFilter: '',
  workNameFilter: '',
  requiredSkillsFilter: ''
};

export const initialWorksTableState: WorksTableState = {
  showFilters: false,
  selectedRows: new Set(),
  workPlanningStatus: {},
  workStatus: {}
};

