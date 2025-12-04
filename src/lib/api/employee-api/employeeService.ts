import { supabase } from '$lib/supabaseClient';
import type { Employee, EmployeeFormData } from './employeeTypes';

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

export async function saveEmployee(employeeData: EmployeeFormData, createdBy: string): Promise<void> {
  try {
    const currentTime = new Date().toISOString();
    
    const dojDate = new Date(employeeData.emp_doj + 'T00:00:00');
    const appraisalDate = new Date(employeeData.last_appraisal_date + 'T00:00:00');
    
    if (isNaN(dojDate.getTime())) {
      throw new Error('Invalid Date of Joining format');
    }
    
    if (isNaN(appraisalDate.getTime())) {
      throw new Error('Invalid Last Appraisal Date format');
    }
    
    const formattedDoj = dojDate.toLocaleDateString('en-CA');
    const formattedAppraisal = appraisalDate.toLocaleDateString('en-CA');
    
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

export async function updateEmployee(id: number, employeeData: Partial<EmployeeFormData>, modifiedBy: string): Promise<void> {
  try {
    const updateData: any = {
      modified_by: modifiedBy,
      modified_dt: new Date().toISOString()
    };
    
    if (employeeData.emp_cat !== undefined) updateData.emp_cat = employeeData.emp_cat.trim();
    if (employeeData.emp_name !== undefined) updateData.emp_name = employeeData.emp_name.trim();
    if (employeeData.skill_short !== undefined) updateData.skill_short = employeeData.skill_short.trim();
    if (employeeData.basic_da !== undefined) updateData.basic_da = employeeData.basic_da;
    if (employeeData.salary !== undefined) updateData.salary = employeeData.salary;
    if (employeeData.shift_code !== undefined) updateData.shift_code = employeeData.shift_code.trim();
    if (employeeData.is_active !== undefined) updateData.is_active = employeeData.is_active;
    if (employeeData.stage !== undefined) updateData.stage = employeeData.stage.trim();
    
    if (employeeData.emp_doj) {
      const dojDate = new Date(employeeData.emp_doj + 'T00:00:00');
      if (isNaN(dojDate.getTime())) {
        throw new Error('Invalid Date of Joining format');
      }
      updateData.emp_doj = dojDate.toLocaleDateString('en-CA');
    }
    
    if (employeeData.last_appraisal_date) {
      const appraisalDate = new Date(employeeData.last_appraisal_date + 'T00:00:00');
      if (isNaN(appraisalDate.getTime())) {
        throw new Error('Invalid Last Appraisal Date format');
      }
      updateData.last_appraisal_date = appraisalDate.toLocaleDateString('en-CA');
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

