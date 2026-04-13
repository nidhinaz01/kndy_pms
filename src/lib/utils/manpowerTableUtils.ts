import type { ProductionEmployee } from '$lib/api/production';
import type { ManpowerTableFilters } from '$lib/types/manpowerTable';
import { cOffNetWorkHours } from '$lib/utils/cOffWindowUtils';

export function filterEmployees(
  data: ProductionEmployee[],
  filters: ManpowerTableFilters
): ProductionEmployee[] {
  return data.filter(employee => {
    const matchesSearch = !filters.search || 
      employee.emp_id.toLowerCase().includes(filters.search.toLowerCase()) ||
      employee.emp_name.toLowerCase().includes(filters.search.toLowerCase()) ||
      employee.skill_short.toLowerCase().includes(filters.search.toLowerCase()) ||
      employee.shift_code.toLowerCase().includes(filters.search.toLowerCase());
    
    const matchesStatus = !filters.selectedStatus || 
      (filters.selectedStatus === 'present' && ((employee.attendance_status === 'present') || (employee.hours_reported && employee.hours_reported > 0))) ||
      (filters.selectedStatus === 'absent' && (employee.attendance_status === 'absent')) ||
      (filters.selectedStatus === 'not_marked' && (!employee.attendance_status || employee.attendance_status === null)) ||
      (filters.selectedStatus === 'overtime' && employee.ot_hours && employee.ot_hours > 0) ||
      (filters.selectedStatus === 'undertime' && employee.lt_hours && employee.lt_hours > 0);

    // Additional checkbox filters
    // These advanced checkbox filters should only apply when the 'Present' status filter is active.
    const matchesPlannedExceeds = !filters.plannedExceedsShift || (filters.selectedStatus === 'present' && ((employee.hours_planned || 0) > 8));
    const matchesReassignedToOther = !filters.reassignedToOther || (filters.selectedStatus === 'present' && ((employee.to_other_stage_hours || 0) > 0));
    const matchesReassignedFromOther = !filters.reassignedFromOther || (filters.selectedStatus === 'present' && ((employee.from_other_stage_hours || 0) > 0));

    return matchesSearch && matchesStatus && matchesPlannedExceeds && matchesReassignedToOther && matchesReassignedFromOther;
  });
}

/** Display `c_off_value` from DB (0.0, 0.5, 1.0, 1.5) with one decimal place. */
export function formatManpowerCOffValueDisplay(value: number | string | null | undefined): string {
  if (value == null || value === '') return '0.0';
  const n = typeof value === 'number' ? value : parseFloat(String(value));
  if (!Number.isFinite(n)) return '0.0';
  return n.toFixed(1);
}

/** Manpower Report tab: show C-Off as net work hours (0, 4, 8, 12) matching stored day units. */
export function formatManpowerCOffHoursDisplay(value: number | string | null | undefined): string {
  if (value == null || value === '') return '0';
  const n = typeof value === 'number' ? value : parseFloat(String(value));
  if (!Number.isFinite(n)) return '0';
  return String(cOffNetWorkHours(n));
}

export function calculateTotals(employees: ProductionEmployee[]) {
  return {
    totalEmployees: employees.length,
    totalPlannedHours: employees.reduce((sum, emp) => sum + (emp.hours_planned || 0), 0),
    totalReportedHours: employees.reduce((sum, emp) => sum + (emp.hours_reported || 0), 0),
    totalOTHours: employees.reduce((sum, emp) => sum + (emp.ot_hours || 0), 0),
    totalLTHours: employees.reduce((sum, emp) => sum + (emp.lt_hours || 0), 0),
    totalLTPHours: employees.reduce((sum, emp) => sum + (emp.ltp_hours || 0), 0),
    totalLTNPHours: employees.reduce((sum, emp) => sum + (emp.ltnp_hours || 0), 0),
    totalToOtherStageHours: employees.reduce((sum, emp) => sum + (emp.to_other_stage_hours || 0), 0),
    totalFromOtherStageHours: employees.reduce((sum, emp) => sum + (emp.from_other_stage_hours || 0), 0)
  };
}

/**
 * Check if attendance is locked for planning tab
 * Only lock if plan has been submitted/approved, not just because there are planned hours
 */
export function isPlanningAttendanceLocked(employee: ProductionEmployee, planningSubmissionStatus: any): boolean {
  // If no submission status, attendance is not locked (draft state)
  if (!planningSubmissionStatus) {
    return false;
  }
  
  const status = planningSubmissionStatus.status;

  // Lock attendance only if plan is submitted (pending_approval), resubmitted, or approved
  // Allow editing if status is 'rejected' (can resubmit)
  if (status === 'pending_approval' || status === 'approved' || status === 'resubmitted') {
    return true;
  }

  // Don't lock if rejected (user can edit and resubmit)
  if (status === 'rejected') {
    return false;
  }
  
  // Default: not locked
  return false;
}

/**
 * Legacy function - kept for backward compatibility but should not be used for planning tab
 * Use isPlanningAttendanceLocked instead for planning tab
 */
export function isAttendanceLocked(employee: ProductionEmployee): boolean {
  // Lock attendance if employee has been planned (draft or approved plan)
  // Sum of hours_planned + to_other_stage_hours > 0 means employee has been planned
  const hasPlannedHours = ((employee.hours_planned || 0) + (employee.to_other_stage_hours || 0)) > 0;
  
  // Also lock if there are reassignments or work has been recorded
  const hasReassignments = !!(employee.stage_journey && employee.stage_journey.length > 0);
  const hasWorkRecorded = !!(employee.hours_reported && employee.hours_reported > 0);
  
  return hasPlannedHours || hasReassignments || hasWorkRecorded;
}

/**
 * True when the latest planning/reporting submission for a stage+shift+date
 * is no longer editable, so reassignments *into* that stage should be blocked in the UI.
 * Treat missing submission as draft (not locked). Rejected submissions stay editable → not locked.
 */
export function isDestinationStageSubmissionLocked(
  submissionRow: { status?: string } | null | undefined
): boolean {
  if (!submissionRow?.status) return false;
  const s = submissionRow.status;
  return s === 'pending_approval' || s === 'approved' || s === 'resubmitted';
}

/**
 * Check if attendance is locked for reporting tab
 * Only lock if report has been submitted/approved, not just because there are reported hours
 */
export function isReportingAttendanceLocked(employee: ProductionEmployee, reportingSubmissionStatus: any): boolean {
  // If no submission status, attendance is not locked (draft state)
  if (!reportingSubmissionStatus) {
    return false;
  }
  
  const status = reportingSubmissionStatus.status;
  
  // Lock attendance only if report is submitted (pending_approval), approved, or resubmitted
  // Allow editing if status is 'rejected' (can resubmit)
  if (status === 'pending_approval' || status === 'approved') {
    return true;
  }
  
  // Don't lock if rejected (user can edit and resubmit)
  if (status === 'rejected') {
    return false;
  }
  
  // Default: not locked
  return false;
}

export function getStatusIcon(employee: ProductionEmployee) {
  if (employee.hours_reported && employee.hours_reported > 0) {
    return { color: 'text-green-600', bg: 'bg-green-100', label: 'Present' };
  } else {
    return { color: 'text-red-600', bg: 'bg-red-100', label: 'Absent' };
  }
}

