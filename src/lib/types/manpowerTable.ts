import type { ProductionEmployee } from '$lib/api/production';

export interface ManpowerTableFilters {
  search: string;
  selectedStatus: string;
}

export interface ManpowerTableState {
  showFilters: boolean;
  selectedEmployees: Set<string>;
  showAttendanceModal: boolean;
  showReassignmentModal: boolean;
  showJourneyModal: boolean;
  showBulkAttendanceModal: boolean;
  selectedEmployee: ProductionEmployee | null;
  bulkAttendanceStatus: 'present' | 'absent';
  bulkNotes: string;
  isBulkSubmitting: boolean;
}

export const initialManpowerTableFilters: ManpowerTableFilters = {
  search: '',
  selectedStatus: ''
};

export const initialManpowerTableState: ManpowerTableState = {
  showFilters: false,
  selectedEmployees: new Set(),
  showAttendanceModal: false,
  showReassignmentModal: false,
  showJourneyModal: false,
  showBulkAttendanceModal: false,
  selectedEmployee: null,
  bulkAttendanceStatus: 'present',
  bulkNotes: '',
  isBulkSubmitting: false
};

