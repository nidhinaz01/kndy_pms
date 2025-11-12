import { supabase } from '$lib/supabaseClient';

export interface Employee {
  id: number;
  emp_id: string;
  emp_cat: string;
  emp_name: string;
  skill_short: string;
  emp_doj: string;
  last_appraisal_date: string;
  basic_da: number;
  salary: number;
  stage: string;
  shift_code: string;
  modified_dt: string;
  modified_by: string;
  is_active: boolean;
  is_deleted: boolean;
  created_by: string;
  created_dt: string;
}

// Fetch employee categories from data elements
export async function fetchEmployeeCategories(): Promise<string[]> {
  try {
    const { data, error } = await supabase
      .from('sys_data_elements')
      .select('de_value')
      .eq('de_name', 'Employee Category')
      .eq('is_deleted', false)
      .order('de_value');

    if (error) {
      console.error('Error fetching employee categories:', error);
      throw error;
    }

    return data?.map(item => item.de_value) || [];
  } catch (error) {
    console.error('Error in fetchEmployeeCategories:', error);
    throw error;
  }
}

// Fetch skill shorts from data elements
export async function fetchSkillShorts(): Promise<string[]> {
  try {
    const { data, error } = await supabase
      .from('sys_data_elements')
      .select('de_value')
      .eq('de_name', 'Skill Short')
      .eq('is_deleted', false)
      .order('de_value');

    if (error) {
      console.error('Error fetching skill shorts:', error);
      throw error;
    }

    return data?.map(item => item.de_value) || [];
  } catch (error) {
    console.error('Error in fetchSkillShorts:', error);
    throw error;
  }
}

// Fetch stages from data elements
export async function fetchStages(): Promise<string[]> {
  try {
    const { data, error } = await supabase
      .from('sys_data_elements')
      .select('de_value')
      .eq('de_name', 'Plant-Stage')
      .eq('is_deleted', false)
      .order('de_value');

    if (error) {
      console.error('Error fetching stages:', error);
      throw error;
    }

    return data?.map(item => item.de_value) || [];
  } catch (error) {
    console.error('Error in fetchStages:', error);
    throw error;
  }
}

// Fetch available shifts from hr_shift_master
export async function fetchShifts(): Promise<string[]> {
  try {
    const { data, error } = await supabase
      .from('hr_shift_master')
      .select('shift_code, shift_name')
      .eq('is_active', true)
      .eq('is_deleted', false)
      .order('shift_name');

    if (error) {
      console.error('Error fetching shifts:', error);
      throw error;
    }

    return data?.map(item => item.shift_code) || [];
  } catch (error) {
    console.error('Error in fetchShifts:', error);
    throw error;
  }
}

// Fetch all employee records
export async function fetchEmployees(): Promise<Employee[]> {
  try {
    const { data, error } = await supabase
      .from('hr_emp')
      .select('*')
      .eq('is_deleted', false)
      .order('emp_name', { ascending: true })
      .order('modified_dt', { ascending: false });

    if (error) {
      console.error('Error fetching employees:', error);
      throw error;
    }

    return data || [];
  } catch (error) {
    console.error('Error in fetchEmployees:', error);
    throw error;
  }
}

// Save employee record
export async function saveEmployee(employeeData: {
  emp_id: string;
  emp_cat: string;
  emp_name: string;
  skill_short: string;
  emp_doj: string;
  last_appraisal_date: string;
  basic_da: number;
  salary: number;
  stage: string;
  shift_code: string;
  is_active?: boolean;
}, createdBy: string): Promise<void> {
  try {
    const currentTime = new Date().toISOString();
    
    // Validate and format dates
    const dojDate = new Date(employeeData.emp_doj + 'T00:00:00');
    const appraisalDate = new Date(employeeData.last_appraisal_date + 'T00:00:00');
    
    if (isNaN(dojDate.getTime())) {
      throw new Error('Invalid Date of Joining format');
    }
    
    if (isNaN(appraisalDate.getTime())) {
      throw new Error('Invalid Last Appraisal Date format');
    }
    
    // Format dates as YYYY-MM-DD for DATE type (use local date to avoid timezone issues)
    const formattedDoj = dojDate.toLocaleDateString('en-CA'); // YYYY-MM-DD format
    const formattedAppraisal = appraisalDate.toLocaleDateString('en-CA'); // YYYY-MM-DD format
    
    const { error } = await supabase
      .from('hr_emp')
      .insert({
        emp_id: employeeData.emp_id.trim(),
        emp_cat: employeeData.emp_cat.trim(),
        emp_name: employeeData.emp_name.trim(),
        skill_short: employeeData.skill_short.trim(),
        emp_doj: formattedDoj,
        last_appraisal_date: formattedAppraisal,
        basic_da: employeeData.basic_da,
        salary: employeeData.salary,
        stage: employeeData.stage.trim(),
        shift_code: employeeData.shift_code.trim(),
        is_active: employeeData.is_active ?? true,
        created_by: createdBy,
        created_dt: currentTime,
        modified_by: createdBy,
        modified_dt: currentTime
      });

    if (error) {
      console.error('Error saving employee:', error);
      throw error;
    }
  } catch (error) {
    console.error('Error in saveEmployee:', error);
    throw error;
  }
}

// Update employee record
export async function updateEmployee(id: number, employeeData: {
  emp_cat?: string;
  emp_name?: string;
  skill_short?: string;
  emp_doj?: string;
  last_appraisal_date?: string;
  basic_da?: number;
  salary?: number;
  shift_code?: string;
  is_active?: boolean;
}, modifiedBy: string): Promise<void> {
  try {
    // Prepare update data
    const updateData: any = {
      modified_by: modifiedBy,
      modified_dt: new Date().toISOString()
    };
    
    // Add other fields if provided
    if (employeeData.emp_cat !== undefined) updateData.emp_cat = employeeData.emp_cat.trim();
    if (employeeData.emp_name !== undefined) updateData.emp_name = employeeData.emp_name.trim();
    if (employeeData.skill_short !== undefined) updateData.skill_short = employeeData.skill_short.trim();
    if (employeeData.basic_da !== undefined) updateData.basic_da = employeeData.basic_da;
    if (employeeData.salary !== undefined) updateData.salary = employeeData.salary;
    if (employeeData.shift_code !== undefined) updateData.shift_code = employeeData.shift_code.trim();
    if (employeeData.is_active !== undefined) updateData.is_active = employeeData.is_active;
    
    // Handle date formatting if provided
    if (employeeData.emp_doj) {
      const dojDate = new Date(employeeData.emp_doj + 'T00:00:00');
      if (isNaN(dojDate.getTime())) {
        throw new Error('Invalid Date of Joining format');
      }
      updateData.emp_doj = dojDate.toLocaleDateString('en-CA'); // YYYY-MM-DD format
    }
    
    if (employeeData.last_appraisal_date) {
      const appraisalDate = new Date(employeeData.last_appraisal_date + 'T00:00:00');
      if (isNaN(appraisalDate.getTime())) {
        throw new Error('Invalid Last Appraisal Date format');
      }
      updateData.last_appraisal_date = appraisalDate.toLocaleDateString('en-CA'); // YYYY-MM-DD format
    }
    
    const { error } = await supabase
      .from('hr_emp')
      .update(updateData)
      .eq('id', id);

    if (error) {
      console.error('Error updating employee:', error);
      throw error;
    }
  } catch (error) {
    console.error('Error in updateEmployee:', error);
    throw error;
  }
}

// Soft delete employee record
export async function deleteEmployee(id: number, modifiedBy: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('hr_emp')
      .update({
        is_deleted: true,
        is_active: false,
        modified_by: modifiedBy,
        modified_dt: new Date().toISOString()
      })
      .eq('id', id);

    if (error) {
      console.error('Error deleting employee:', error);
      throw error;
    }
  } catch (error) {
    console.error('Error in deleteEmployee:', error);
    throw error;
  }
}

// Toggle active status of employee
export async function toggleEmployeeStatus(id: number, isActive: boolean, modifiedBy: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('hr_emp')
      .update({
        is_active: isActive,
        modified_by: modifiedBy,
        modified_dt: new Date().toISOString()
      })
      .eq('id', id);

    if (error) {
      console.error('Error toggling employee status:', error);
      throw error;
    }
  } catch (error) {
    console.error('Error in toggleEmployeeStatus:', error);
    throw error;
  }
}

// Check if employee ID already exists
export async function checkEmployeeIdExists(empId: string, excludeId?: number): Promise<boolean> {
  try {
    let query = supabase
      .from('hr_emp')
      .select('id')
      .eq('emp_id', empId)
      .eq('is_deleted', false);

    if (excludeId) {
      query = query.neq('id', excludeId);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error checking employee ID:', error);
      throw error;
    }

    return (data?.length || 0) > 0;
  } catch (error) {
    console.error('Error in checkEmployeeIdExists:', error);
    throw error;
  }
}

// Export template CSV
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

// Helper function to parse and validate date (YYYY-MM-DD format only)
function parseDate(dateString: string): Date | null {
  if (!dateString || dateString.trim() === '') {
    return null;
  }
  
  // Only accept YYYY-MM-DD format
  const match = dateString.trim().match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (match) {
    const [_, year, month, day] = match;
    const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    if (!isNaN(date.getTime())) {
      return date;
    }
  }
  
  return null;
}

// Import employees from CSV
export async function importEmployees(csvText: string, username: string): Promise<{ success: number; errors: string[] }> {
  try {
    // Load required data for validation
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
    
    // Validate headers
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

    // Process data rows
    for (let i = 1; i < lines.length; i++) {
      try {
        const values = lines[i].split(',').map(v => v.trim());
        
        if (values.length !== expectedHeaders.length) {
          errors.push(`Row ${i + 2}: Expected ${expectedHeaders.length} values but found ${values.length}`);
          continue;
        }

        // Skip empty rows
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
        
        // Validate required fields
        if (!employeeData.emp_id || !employeeData.emp_name) {
          errors.push(`Row ${i + 2}: Missing required fields`);
          continue;
        }
        
        // Validate employee category
        if (!employeeCategories.includes(employeeData.emp_cat)) {
          errors.push(`Row ${i + 2}: Invalid employee category "${employeeData.emp_cat}". Must be one of: ${employeeCategories.join(', ')}`);
          continue;
        }
        
        // Validate skill code
        if (!skillShorts.includes(employeeData.skill_short)) {
          errors.push(`Row ${i + 2}: Invalid skill code "${employeeData.skill_short}". Must be one of: ${skillShorts.join(', ')}`);
          continue;
        }
        
        // Validate stage
        if (!stages.includes(employeeData.stage)) {
          errors.push(`Row ${i + 2}: Invalid stage "${employeeData.stage}". Must be one of: ${stages.join(', ')}`);
          continue;
        }

        // Validate shift code
        if (!shifts.includes(employeeData.shift_code)) {
          errors.push(`Row ${i + 2}: Invalid shift code "${employeeData.shift_code}". Must be one of: ${shifts.join(', ')}`);
          continue;
        }
        
        // Validate dates (not future dates)
        const today = new Date();
        today.setHours(23, 59, 59, 999); // End of today
        
        // Parse dates using the helper function
        const dojDate = parseDate(employeeData.emp_doj);
        const appraisalDate = parseDate(employeeData.last_appraisal_date);
        
        // Validate date formats
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
        
        // Validate basic DA: can be zero (but not negative) for Apprentice or Trainee, otherwise must be positive
        if (isNaN(employeeData.basic_da)) {
          errors.push(`Row ${i + 2}: Basic DA must be a valid number`);
          continue;
        }
        
        const categoryLower = employeeData.emp_cat?.toLowerCase() || '';
        const isApprenticeOrTrainee = categoryLower.includes('apprentice') || categoryLower.includes('trainee');
        
        if (isApprenticeOrTrainee) {
          // For Apprentice or Trainee: allow zero but not negative
          if (employeeData.basic_da < 0) {
            errors.push(`Row ${i + 2}: Basic DA cannot be negative for ${employeeData.emp_cat} category`);
            continue;
          }
        } else {
          // For other categories: must be positive
          if (employeeData.basic_da <= 0) {
            errors.push(`Row ${i + 2}: Basic DA must be a positive number`);
            continue;
          }
        }
        
        if (isNaN(employeeData.salary) || employeeData.salary <= 0) {
          errors.push(`Row ${i + 2}: Salary must be a positive number`);
          continue;
        }
        
        // Check if employee ID already exists in database
        const exists = await checkEmployeeIdExists(employeeData.emp_id);
        if (exists) {
          duplicateEmpIds.push(employeeData.emp_id);
          errors.push(`Row ${i + 2}: Employee ID ${employeeData.emp_id} already exists in database`);
          continue;
        }
        
        // Save employee with properly formatted dates
        await saveEmployee({
          ...employeeData,
          emp_doj: dojDate.toLocaleDateString('en-CA'), // YYYY-MM-DD format
          last_appraisal_date: appraisalDate.toLocaleDateString('en-CA') // YYYY-MM-DD format
        }, username);
        success.push(employeeData.emp_id);
        
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        errors.push(`Row ${i + 2}: ${errorMessage}`);
      }
    }
    
    // Add summary of duplicate IDs if any
    if (duplicateEmpIds.length > 0) {
      errors.push(`\nSummary: ${duplicateEmpIds.length} employee(s) with duplicate IDs were skipped`);
    }
    
    return { success: success.length, errors };
  } catch (error) {
    console.error('Error in importEmployees:', error);
    throw error;
  }
} 