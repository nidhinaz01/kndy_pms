import { saveEmployee } from './employeeService';
import { fetchEmployeeCategories, fetchSkillShorts, fetchStages, fetchShifts } from './employeeDropdownService';
import { checkEmployeeIdExists } from './employeeUtils';
import { parseDate } from './employeeUtils';

export async function exportTemplate(): Promise<void> {
  try {
    const headers = ['Employee ID', 'Employee Category', 'Employee Name', 'Skill', 'Date of Joining', 'Last Appraisal Date', 'Basic DA', 'Salary', 'Stage', 'Shift Code'];
    const sampleData = [
      'EMP001',
      'Worker',
      'John Doe',
      'WELD',
      '2024-01-15',
      '2024-01-15',
      '15000.00',
      '25000.00',
      'P1S1',
      'GEN'
    ];
    
    const csvContent = [headers.join(','), sampleData.join(',')].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'employee_import_template.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Error exporting template:', error);
    throw error;
  }
}

export async function importEmployees(csvText: string, username: string): Promise<{ success: number; errors: string[] }> {
  try {
    const [employeeCategories, skillShorts, stages, shifts] = await Promise.all([
      fetchEmployeeCategories(),
      fetchSkillShorts(),
      fetchStages(),
      fetchShifts()
    ]);

    const lines = csvText.trim().split('\n');
    if (lines.length < 2) {
      throw new Error('CSV must have at least a header row and one data row');
    }

    const headers = lines[0].split(',').map(h => h.trim());
    const expectedHeaders = ['Employee ID', 'Employee Category', 'Employee Name', 'Skill', 'Date of Joining', 'Last Appraisal Date', 'Basic DA', 'Salary', 'Stage', 'Shift Code'];
    
    if (headers.length !== expectedHeaders.length) {
      throw new Error(`Expected ${expectedHeaders.length} columns but found ${headers.length}. Expected: ${expectedHeaders.join(', ')}`);
    }
    
    for (let i = 0; i < expectedHeaders.length; i++) {
      if (headers[i] !== expectedHeaders[i]) {
        throw new Error(`Column ${i + 1} should be "${expectedHeaders[i]}" but found "${headers[i]}"`);
      }
    }

    const success: string[] = [];
    const errors: string[] = [];
    const duplicateEmpIds: string[] = [];

    for (let i = 1; i < lines.length; i++) {
      try {
        const values = lines[i].split(',').map(v => v.trim());
        
        if (values.length !== expectedHeaders.length) {
          errors.push(`Row ${i + 2}: Expected ${expectedHeaders.length} values but found ${values.length}`);
          continue;
        }

        if (values.every(v => !v)) {
          continue;
        }

        const employeeData = {
          emp_id: values[0],
          emp_cat: values[1],
          emp_name: values[2],
          skill_short: values[3],
          emp_doj: values[4],
          last_appraisal_date: values[5],
          basic_da: parseFloat(values[6]),
          salary: parseFloat(values[7]),
          stage: values[8],
          shift_code: values[9],
          is_active: true
        };
        
        if (!employeeData.emp_id || !employeeData.emp_name) {
          errors.push(`Row ${i + 2}: Missing required fields`);
          continue;
        }
        
        if (!employeeCategories.includes(employeeData.emp_cat)) {
          errors.push(`Row ${i + 2}: Invalid employee category "${employeeData.emp_cat}". Must be one of: ${employeeCategories.join(', ')}`);
          continue;
        }
        
        if (!skillShorts.includes(employeeData.skill_short)) {
          errors.push(`Row ${i + 2}: Invalid skill code "${employeeData.skill_short}". Must be one of: ${skillShorts.join(', ')}`);
          continue;
        }
        
        if (!stages.includes(employeeData.stage)) {
          errors.push(`Row ${i + 2}: Invalid stage "${employeeData.stage}". Must be one of: ${stages.join(', ')}`);
          continue;
        }

        if (!shifts.includes(employeeData.shift_code)) {
          errors.push(`Row ${i + 2}: Invalid shift code "${employeeData.shift_code}". Must be one of: ${shifts.join(', ')}`);
          continue;
        }
        
        const today = new Date();
        today.setHours(23, 59, 59, 999);
        
        const dojDate = parseDate(employeeData.emp_doj);
        const appraisalDate = parseDate(employeeData.last_appraisal_date);
        
        if (!dojDate) {
          errors.push(`Row ${i + 2}: Invalid Date of Joining format "${employeeData.emp_doj}". Expected format: YYYY-MM-DD (e.g., 2024-01-15)`);
          continue;
        }
        
        if (!appraisalDate) {
          errors.push(`Row ${i + 2}: Invalid Last Appraisal Date format "${employeeData.last_appraisal_date}". Expected format: YYYY-MM-DD (e.g., 2024-01-15)`);
          continue;
        }
        
        if (dojDate > today) {
          errors.push(`Row ${i + 2}: Date of joining cannot be a future date`);
          continue;
        }
        
        if (appraisalDate > today) {
          errors.push(`Row ${i + 2}: Last appraisal date cannot be a future date`);
          continue;
        }
        
        if (isNaN(employeeData.basic_da)) {
          errors.push(`Row ${i + 2}: Basic DA must be a valid number`);
          continue;
        }
        
        const categoryLower = employeeData.emp_cat?.toLowerCase() || '';
        const isApprenticeOrTrainee = categoryLower.includes('apprentice') || categoryLower.includes('trainee');
        
        if (isApprenticeOrTrainee) {
          if (employeeData.basic_da < 0) {
            errors.push(`Row ${i + 2}: Basic DA cannot be negative for ${employeeData.emp_cat} category`);
            continue;
          }
        } else {
          if (employeeData.basic_da <= 0) {
            errors.push(`Row ${i + 2}: Basic DA must be a positive number`);
            continue;
          }
        }
        
        if (isNaN(employeeData.salary) || employeeData.salary <= 0) {
          errors.push(`Row ${i + 2}: Salary must be a positive number`);
          continue;
        }
        
        const exists = await checkEmployeeIdExists(employeeData.emp_id);
        if (exists) {
          duplicateEmpIds.push(employeeData.emp_id);
          errors.push(`Row ${i + 2}: Employee ID ${employeeData.emp_id} already exists in database`);
          continue;
        }
        
        await saveEmployee({
          ...employeeData,
          emp_doj: dojDate.toLocaleDateString('en-CA'),
          last_appraisal_date: appraisalDate.toLocaleDateString('en-CA')
        }, username);
        success.push(employeeData.emp_id);
        
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        errors.push(`Row ${i + 2}: ${errorMessage}`);
      }
    }
    
    if (duplicateEmpIds.length > 0) {
      errors.push(`\nSummary: ${duplicateEmpIds.length} employee(s) with duplicate IDs were skipped`);
    }
    
    return { success: success.length, errors };
  } catch (error) {
    console.error('Error in importEmployees:', error);
    throw error;
  }
}

