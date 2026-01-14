import { fetchEmployees } from '$lib/api/employee';
import { fetchEmployeeCategories, fetchSkillShorts, fetchStages, fetchShifts } from '$lib/api/employee';
import { updateEmployee } from '$lib/api/employee';
import { formatDateForInput } from '../utils/employeeValidation';
import { parseDate } from '$lib/api/employee-api/employeeUtils';

export interface BulkUpdateResult {
  success: number;
  errors: string[];
  skipped: number;
}

/**
 * Export bulk update template with existing employee data
 */
export async function exportBulkUpdateTemplate(): Promise<void> {
  try {
    const employees = await fetchEmployees();
    
    // Filter out deleted employees
    const activeEmployees = employees.filter(emp => !emp.is_deleted);
    
    const headers = ['Employee ID', 'Employee Name', 'Date of Joining', 'Employee Category', 'Skill', 'Last Appraisal Date', 'Basic DA', 'Salary', 'Stage', 'Shift Code'];
    
    const csvRows = [headers.join(',')];
    
    for (const emp of activeEmployees) {
      const row = [
        emp.emp_id,
        emp.emp_name,
        formatDateForInput(emp.emp_doj),
        emp.emp_cat,
        emp.skill_short,
        formatDateForInput(emp.last_appraisal_date),
        emp.basic_da.toString(),
        emp.salary.toString(),
        emp.stage,
        emp.shift_code
      ];
      csvRows.push(row.join(','));
    }
    
    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'employee_bulk_update_template.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Error exporting bulk update template:', error);
    throw error;
  }
}

/**
 * Process bulk update from CSV file
 */
export async function processBulkUpdate(csvText: string, username: string): Promise<BulkUpdateResult> {
  try {
    // Fetch all employees and dropdown values
    const [allEmployees, employeeCategories, skillShorts, stages, shifts] = await Promise.all([
      fetchEmployees(),
      fetchEmployeeCategories(),
      fetchSkillShorts(),
      fetchStages(),
      fetchShifts()
    ]);

    // Create a map of emp_id to employee for quick lookup
    const employeeMap = new Map(
      allEmployees
        .filter(emp => !emp.is_deleted)
        .map(emp => [emp.emp_id, emp])
    );

    const lines = csvText.trim().split('\n');
    if (lines.length < 2) {
      throw new Error('CSV must have at least a header row and one data row');
    }

    const headers = lines[0].split(',').map(h => h.trim());
    const expectedHeaders = ['Employee ID', 'Employee Name', 'Date of Joining', 'Employee Category', 'Skill', 'Last Appraisal Date', 'Basic DA', 'Salary', 'Stage', 'Shift Code'];
    
    if (headers.length !== expectedHeaders.length) {
      throw new Error(`Expected ${expectedHeaders.length} columns but found ${headers.length}. Expected: ${expectedHeaders.join(', ')}`);
    }
    
    for (let i = 0; i < expectedHeaders.length; i++) {
      if (headers[i] !== expectedHeaders[i]) {
        throw new Error(`Column ${i + 1} should be "${expectedHeaders[i]}" but found "${headers[i]}"`);
      }
    }

    const errors: string[] = [];
    const success: string[] = [];
    let skipped = 0;

    for (let i = 1; i < lines.length; i++) {
      try {
        const values = lines[i].split(',').map(v => v.trim());
        
        if (values.length !== expectedHeaders.length) {
          errors.push(`Row ${i + 1}: Expected ${expectedHeaders.length} values but found ${values.length}`);
          continue;
        }

        if (values.every(v => !v)) {
          skipped++;
          continue;
        }

        const empId = values[0];
        const empName = values[1];
        const empDoj = values[2];
        const empCat = values[3];
        const skillShort = values[4];
        const lastAppraisalDate = values[5];
        const basicDa = values[6];
        const salary = values[7];
        const stage = values[8];
        const shiftCode = values[9];

        // Find the employee by ID
        const existingEmployee = employeeMap.get(empId);
        if (!existingEmployee) {
          errors.push(`Row ${i + 1}: Employee ID "${empId}" not found in database`);
          continue;
        }

        // Validate that Employee ID, Name, and Date of Joining are not modified
        const originalDoj = formatDateForInput(existingEmployee.emp_doj);
        if (empId !== existingEmployee.emp_id) {
          errors.push(`Row ${i + 1}: Employee ID cannot be modified. Original: "${existingEmployee.emp_id}", Found: "${empId}"`);
          continue;
        }
        if (empName !== existingEmployee.emp_name) {
          errors.push(`Row ${i + 1}: Employee Name cannot be modified. Original: "${existingEmployee.emp_name}", Found: "${empName}"`);
          continue;
        }
        if (empDoj !== originalDoj) {
          errors.push(`Row ${i + 1}: Date of Joining cannot be modified. Original: "${originalDoj}", Found: "${empDoj}"`);
          continue;
        }

        // Validate Employee Category
        if (!employeeCategories.includes(empCat)) {
          errors.push(`Row ${i + 1}: Invalid employee category "${empCat}". Must be one of: ${employeeCategories.join(', ')}`);
          continue;
        }

        // Validate Skill
        if (!skillShorts.includes(skillShort)) {
          errors.push(`Row ${i + 1}: Invalid skill code "${skillShort}". Must be one of: ${skillShorts.join(', ')}`);
          continue;
        }

        // Validate Stage
        if (!stages.includes(stage)) {
          errors.push(`Row ${i + 1}: Invalid stage "${stage}". Must be one of: ${stages.join(', ')}`);
          continue;
        }

        // Validate Shift Code
        if (!shifts.includes(shiftCode)) {
          errors.push(`Row ${i + 1}: Invalid shift code "${shiftCode}". Must be one of: ${shifts.join(', ')}`);
          continue;
        }

        // Validate dates
        const today = new Date();
        today.setHours(23, 59, 59, 999);
        
        const appraisalDate = parseDate(lastAppraisalDate);
        if (!appraisalDate) {
          errors.push(`Row ${i + 1}: Invalid Last Appraisal Date format "${lastAppraisalDate}". Expected format: YYYY-MM-DD (e.g., 2024-01-15)`);
          continue;
        }
        
        if (appraisalDate > today) {
          errors.push(`Row ${i + 1}: Last appraisal date cannot be a future date`);
          continue;
        }

        // Validate Basic DA
        const basicDaNum = parseFloat(basicDa);
        if (isNaN(basicDaNum)) {
          errors.push(`Row ${i + 1}: Basic DA must be a valid number`);
          continue;
        }
        
        const categoryLower = empCat?.toLowerCase() || '';
        const isApprenticeOrTrainee = categoryLower.includes('apprentice') || categoryLower.includes('trainee');
        
        if (isApprenticeOrTrainee) {
          if (basicDaNum < 0) {
            errors.push(`Row ${i + 1}: Basic DA cannot be negative for ${empCat} category`);
            continue;
          }
        } else {
          if (basicDaNum <= 0) {
            errors.push(`Row ${i + 1}: Basic DA must be a positive number`);
            continue;
          }
        }

        // Validate Salary
        const salaryNum = parseFloat(salary);
        if (isNaN(salaryNum) || salaryNum <= 0) {
          errors.push(`Row ${i + 1}: Salary must be a positive number`);
          continue;
        }

        // All validations passed, update the employee
        await updateEmployee(existingEmployee.id, {
          emp_cat: empCat,
          skill_short: skillShort,
          last_appraisal_date: lastAppraisalDate,
          basic_da: basicDaNum,
          salary: salaryNum,
          stage: stage,
          shift_code: shiftCode
        }, username);

        success.push(empId);
        
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        errors.push(`Row ${i + 1}: ${errorMessage}`);
      }
    }
    
    return { 
      success: success.length, 
      errors,
      skipped
    };
  } catch (error) {
    console.error('Error in processBulkUpdate:', error);
    throw error;
  }
}

