import { supabase } from '$lib/supabaseClient';
import { sanitizeObject } from '$lib/utils/inputSanitization';
import { generateTimestampedFilename } from '$lib/utils/exportUtils';

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
  modified_dt: string;
  modified_by: string;
}

// Fetch skill codes from data elements
export async function fetchSkillCodes(): Promise<string[]> {
  const { data, error } = await supabase
    .from('sys_data_elements')
    .select('de_value')
    .eq('de_name', 'Skill Short')
    .order('de_value');

  if (error) {
    console.error('Error fetching skill codes:', error);
    throw error;
  }

  return data?.map(item => item.de_value) || [];
}

// Fetch employee categories from data elements
export async function fetchEmployeeCategories(): Promise<string[]> {
  const { data, error } = await supabase
    .from('sys_data_elements')
    .select('de_value')
    .eq('de_name', 'Employee Category')
    .order('de_value');

  if (error) {
    console.error('Error fetching employee categories:', error);
    throw error;
  }

  return data?.map(item => item.de_value) || [];
}

// Fetch stages from data elements
export async function fetchStages(): Promise<string[]> {
  const { data, error } = await supabase
    .from('sys_data_elements')
    .select('de_value')
    .eq('de_name', 'Plant-Stage')
    .order('de_value');

  if (error) {
    console.error('Error fetching stages:', error);
    throw error;
  }

  return data?.map(item => item.de_value) || [];
}

// Fetch all employee records
export async function fetchEmployees(): Promise<Employee[]> {
  const { data, error } = await supabase
    .from('hr_emp')
    .select('*')
    .order('emp_name');

  if (error) {
    console.error('Error fetching employees:', error);
    throw error;
  }

  return data || [];
}

// Save employee record
export async function saveEmployee(employeeData: Omit<Employee, 'id' | 'modified_dt'>): Promise<void> {
  const sanitizedData = sanitizeObject(employeeData);
  const { error } = await supabase
    .from('hr_emp')
    .insert([sanitizedData]);

  if (error) {
    console.error('Error saving employee:', error);
    throw error;
  }
}

// Update employee record
export async function updateEmployee(id: number, employeeData: Partial<Omit<Employee, 'id' | 'emp_id'>>): Promise<void> {
  const sanitizedData = sanitizeObject(employeeData);
  const { error } = await supabase
    .from('hr_emp')
    .update(sanitizedData)
    .eq('id', id);

  if (error) {
    console.error('Error updating employee:', error);
    throw error;
  }
}

// Delete employee record
export async function deleteEmployee(id: number): Promise<void> {
  const { error } = await supabase
    .from('hr_emp')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting employee:', error);
    throw error;
  }
}

// Check if employee ID already exists
export async function checkEmployeeIdExists(empId: string, excludeId?: number): Promise<boolean> {
  let query = supabase
    .from('hr_emp')
    .select('id')
    .eq('emp_id', empId);

  if (excludeId) {
    query = query.neq('id', excludeId);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error checking employee ID:', error);
    throw error;
  }

  return (data?.length || 0) > 0;
}

// Get username from email
export async function getUsernameFromEmail(email: string): Promise<string> {
  const { data, error } = await supabase
    .from('app_users')
    .select('username')
    .eq('email', email)
    .maybeSingle();

  if (error) {
    console.error('Error fetching username:', error);
    return email; // fallback to email if username not found
  }

  return data?.username || email;
}

// Export template as XLSX
export async function exportTemplate(): Promise<void> {
  // We'll need to install and use a library like 'xlsx' for Excel export
  // For now, we'll create a CSV with dropdown validation info
  const headers = [
    'emp_id',
    'emp_cat', 
    'emp_name',
    'skill_short',
    'emp_doj',
    'last_appraisal_date',
    'basic_da',
    'salary',
    'stage'
  ];
  
  // Get dropdown values for validation
  const [employeeCategories, skillCodes, stages] = await Promise.all([
    fetchEmployeeCategories(),
    fetchSkillCodes(),
    fetchStages()
  ]);
  
  const csvContent = [
    headers.join(','),
    'NOTE: emp_cat must be one of: ' + employeeCategories.join('|'),
    'NOTE: skill_short must be one of: ' + skillCodes.join('|'),
    'NOTE: stage must be one of: ' + stages.join('|'),
    'NOTE: emp_doj and last_appraisal_date must be in YYYY-MM-DD format and not future dates',
    'NOTE: basic_da and salary must be positive numbers'
  ].join('\n');
  
  const blob = new Blob([csvContent], { type: 'text/csv' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = generateTimestampedFilename('employee_template');
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
}

// Import employees from CSV
export async function importEmployees(csvData: string, username: string): Promise<{ success: number; errors: string[] }> {
  const lines = csvData.split('\n').filter(line => line.trim());
  const headers = lines[0].split(',').map(h => h.trim());
  const dataLines = lines.slice(1);
  
  const success: any[] = [];
  const errors: string[] = [];
  const duplicateEmpIds: string[] = [];
  
  // Get validation data
  const [employeeCategories, skillCodes, stages] = await Promise.all([
    fetchEmployeeCategories(),
    fetchSkillCodes(),
    fetchStages()
  ]);
  
  // Check for duplicate employee IDs in the import file
  const empIdsInFile = dataLines.map(line => line.split(',')[0].trim()).filter(id => id);
  const duplicateIdsInFile = empIdsInFile.filter((id, index) => empIdsInFile.indexOf(id) !== index);
  
  if (duplicateIdsInFile.length > 0) {
    errors.push(`Duplicate Employee IDs found in import file: ${[...new Set(duplicateIdsInFile)].join(', ')}`);
  }
  
  for (let i = 0; i < dataLines.length; i++) {
    const line = dataLines[i];
    const values = line.split(',').map(v => v.trim());
    
    try {
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
        modified_by: username
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
      if (!skillCodes.includes(employeeData.skill_short)) {
        errors.push(`Row ${i + 2}: Invalid skill code "${employeeData.skill_short}". Must be one of: ${skillCodes.join(', ')}`);
        continue;
      }
      
      // Validate stage
      if (!stages.includes(employeeData.stage)) {
        errors.push(`Row ${i + 2}: Invalid stage "${employeeData.stage}". Must be one of: ${stages.join(', ')}`);
        continue;
      }
      
      // Validate dates (not future dates)
      const today = new Date();
      today.setHours(23, 59, 59, 999); // End of today
      
      const dojDate = new Date(employeeData.emp_doj);
      const appraisalDate = new Date(employeeData.last_appraisal_date);
      
      if (dojDate > today) {
        errors.push(`Row ${i + 2}: Date of joining cannot be a future date`);
        continue;
      }
      
      if (appraisalDate > today) {
        errors.push(`Row ${i + 2}: Last appraisal date cannot be a future date`);
        continue;
      }
      
      // Validate numbers
      if (isNaN(employeeData.basic_da) || employeeData.basic_da <= 0) {
        errors.push(`Row ${i + 2}: Basic DA must be a positive number`);
        continue;
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
      
      // Save employee
      await saveEmployee(employeeData);
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
} 