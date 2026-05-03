import type { ProductionEmployee } from '$lib/api/production';
import type { ManpowerAttendanceStatus } from '$lib/utils/manpowerAttendanceStatus';

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
  /** When true, Manpower Plan uses holiday bulk modal instead of standard bulk modal */
  showHolidayBulkAttendanceModal: boolean;
  selectedEmployee: ProductionEmployee | null;
  bulkAttendanceStatus: ManpowerAttendanceStatus;
  bulkNotes: string;
  bulkFromTime: string;
  bulkToTime: string;
  bulkPlannedHours: number | null;
  bulkCOffValue: number;
  bulkCOffFromDate: string;
  bulkCOffFromTime: string;
  bulkCOffToDate: string;
  bulkCOffToTime: string;
  bulkOtHours: number;
  bulkOtFromDate: string;
  bulkOtFromTime: string;
  bulkOtToDate: string;
  bulkOtToTime: string;
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
  showHolidayBulkAttendanceModal: false,
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
  bulkOtHours: 0,
  bulkOtFromDate: '',
  bulkOtFromTime: '',
  bulkOtToDate: '',
  bulkOtToTime: '',
  isBulkSubmitting: false
};

