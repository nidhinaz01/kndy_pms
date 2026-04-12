import type { ProductionEmployee } from '$lib/api/production';

export interface ManpowerTableFilters {
  search: string;
  selectedStatus: string;
  plannedExceedsShift?: boolean;
  reassignedToOther?: boolean;
  reassignedFromOther?: boolean;
}

export interface ManpowerTableState {
  showFilters: boolean;
  selectedEmployees: Set<string>;
  showAttendanceModal: boolean;
  showReassignmentModal: boolean;
  showJourneyModal: boolean;
  showWorksModal: boolean;
  showBulkAttendanceModal: boolean;
  selectedEmployee: ProductionEmployee | null;
  bulkAttendanceStatus: 'present' | 'absent';
  bulkNotes: string;
  bulkFromTime: string;
  bulkToTime: string;
  bulkPlannedHours: number | null;
  bulkCOffValue: number;
  bulkCOffFromDate: string;
  bulkCOffFromTime: string;
  bulkCOffToDate: string;
  bulkCOffToTime: string;
  isBulkSubmitting: boolean;
}

export const initialManpowerTableFilters: ManpowerTableFilters = {
  search: '',
  selectedStatus: ''
  ,
  plannedExceedsShift: false,
  reassignedToOther: false,
  reassignedFromOther: false
};

export const initialManpowerTableState: ManpowerTableState = {
  showFilters: false,
  selectedEmployees: new Set(),
  showAttendanceModal: false,
  showReassignmentModal: false,
  showJourneyModal: false,
  showWorksModal: false,
  showBulkAttendanceModal: false,
  selectedEmployee: null,
  bulkAttendanceStatus: 'present',
  bulkNotes: '',
  bulkFromTime: '',
  bulkToTime: '',
  bulkPlannedHours: null,
  bulkCOffValue: 0,
  bulkCOffFromDate: '',
  bulkCOffFromTime: '',
  bulkCOffToDate: '',
  bulkCOffToTime: '',
  isBulkSubmitting: false
};

