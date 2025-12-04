import { supabase } from '$lib/supabaseClient';

/**
 * Validate that all employees have attendance marked in Manpower Report tab
 * before allowing plan to report conversion
 */
export async function validateReportingAttendance(
  stageCode: string,
  shiftCode: string,
  reportingDate: string
): Promise<{ isValid: boolean; missingEmployees: string[]; error?: string }> {
  try {
    // Get date string in YYYY-MM-DD format
    let dateStr: string;
    if (typeof reportingDate === 'string') {
      dateStr = reportingDate.split('T')[0];
    } else {
      dateStr = new Date(reportingDate).toISOString().split('T')[0];
    }

    // Get all employees assigned to this stage and shift
    const { data: employees, error: employeesError } = await supabase
      .from('hr_emp')
      .select('emp_id, emp_name, skill_short, shift_code')
      .eq('stage', stageCode)
      .eq('shift_code', shiftCode)
      .eq('is_active', true)
      .eq('is_deleted', false);

    if (employeesError) {
      return {
        isValid: false,
        missingEmployees: [],
        error: `Error fetching employees: ${employeesError.message}`
      };
    }

    if (!employees || employees.length === 0) {
      return {
        isValid: true,
        missingEmployees: [],
        error: 'No employees found for this stage and shift'
      };
    }

    // Get all employees who have attendance marked in reporting table
    const { data: reportedAttendance, error: attendanceError } = await supabase
      .from('prdn_reporting_manpower')
      .select('emp_id')
      .eq('stage_code', stageCode)
      .eq('reporting_date', dateStr)
      .eq('is_deleted', false);

    if (attendanceError) {
      return {
        isValid: false,
        missingEmployees: [],
        error: `Error fetching reported attendance: ${attendanceError.message}`
      };
    }

    const reportedEmpIds = new Set((reportedAttendance || []).map(a => a.emp_id));
    
    // Find employees without attendance marked
    const missingEmployees = (employees || [])
      .filter(emp => !reportedEmpIds.has(emp.emp_id))
      .map(emp => `${emp.emp_name} (${emp.emp_id})`);

    return {
      isValid: missingEmployees.length === 0,
      missingEmployees
    };
  } catch (error) {
    console.error('Error validating reporting attendance:', error);
    return {
      isValid: false,
      missingEmployees: [],
      error: (error as Error).message || 'Unknown error occurred'
    };
  }
}

