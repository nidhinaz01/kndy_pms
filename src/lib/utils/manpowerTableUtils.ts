import type { ProductionEmployee } from '$lib/api/production';
import type { ManpowerTableFilters } from '$lib/types/manpowerTable';

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
      (filters.selectedStatus === 'present' && employee.hours_reported && employee.hours_reported > 0) ||
      (filters.selectedStatus === 'absent' && (!employee.hours_reported || employee.hours_reported === 0)) ||
      (filters.selectedStatus === 'overtime' && employee.ot_hours && employee.ot_hours > 0) ||
      (filters.selectedStatus === 'undertime' && employee.lt_hours && employee.lt_hours > 0);

    return matchesSearch && matchesStatus;
  });
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
  
  // Lock attendance only if plan is submitted (pending_approval), approved, or resubmitted
  // Allow editing if status is 'rejected' (can resubmit)
  if (status === 'pending_approval' || status === 'approved') {
    return true;
  }
  
  // Check if it's a resubmission (pending_approval with previous rejected submission)
  // This would be handled by checking if there's a rejected submission in history
  // For now, we'll rely on the status field
  
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

