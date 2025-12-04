import { checkEmployeeIdExists, saveEmployee, updateEmployee, deleteEmployee, importEmployees } from '$lib/api/employee';
import { validateEmployeeForm } from '../utils/employeeValidation';

export interface EmployeeFormData {
  empId: string;
  selectedEmpCategory: string;
  empName: string;
  selectedSkillShort: string;
  empDoj: string;
  lastAppraisalDate: string;
  basicDa: string;
  salary: string;
  selectedStage: string;
  selectedShiftCode: string;
  isActive: boolean;
}

export interface EmployeeHandlers {
  handleSaveEmployee: (formData: EmployeeFormData, isEditMode: boolean, editingEmployeeId: number | null, onSuccess: () => void, onError: (error: string) => void) => Promise<void>;
  handleDeleteEmployee: (employee: any, onSuccess: () => void, onError: (error: string) => void) => Promise<void>;
  handleImport: (importFile: File, onSuccess: (results: { success: number; errors: string[] }) => void, onError: (error: string) => void) => Promise<void>;
}

export async function handleSaveEmployee(
  formData: EmployeeFormData,
  isEditMode: boolean,
  editingEmployeeId: number | null,
  onSuccess: () => void,
  onError: (error: string) => void
): Promise<void> {
  const validation = validateEmployeeForm(
    formData.empId,
    formData.selectedEmpCategory,
    formData.empName,
    formData.selectedSkillShort,
    formData.empDoj,
    formData.lastAppraisalDate,
    formData.basicDa,
    formData.salary,
    formData.selectedStage,
    formData.selectedShiftCode
  );

  if (!validation.isValid) {
    validation.errors.forEach(error => onError(error));
    return;
  }

  const dojDate = new Date(formData.empDoj);
  const appraisalDate = new Date(formData.lastAppraisalDate);
  const today = new Date();
  
  dojDate.setHours(0, 0, 0, 0);
  appraisalDate.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
  
  if (dojDate > today) {
    const confirmFutureDoj = confirm(`The Date of Joining (${formData.empDoj}) is in the future. Are you sure you want to proceed?`);
    if (!confirmFutureDoj) return;
  }
  
  if (appraisalDate > today) {
    const confirmFutureAppraisal = confirm(`The Last Appraisal Date (${formData.lastAppraisalDate}) is in the future. Are you sure you want to proceed?`);
    if (!confirmFutureAppraisal) return;
  }

  try {
    const username = localStorage.getItem('username');
    if (!username) {
      onError('User session not found');
      return;
    }

    if (!isEditMode) {
      const empIdExists = await checkEmployeeIdExists(formData.empId);
      if (empIdExists) {
        onError(`Employee ID "${formData.empId}" already exists. Please use a different employee ID.`);
        return;
      }
    }

    if (isEditMode && editingEmployeeId) {
      await updateEmployee(editingEmployeeId, {
        emp_cat: formData.selectedEmpCategory,
        emp_name: formData.empName,
        skill_short: formData.selectedSkillShort,
        emp_doj: formData.empDoj,
        last_appraisal_date: formData.lastAppraisalDate,
        basic_da: Number(formData.basicDa),
        salary: Number(formData.salary),
        is_active: formData.isActive,
        shift_code: formData.selectedShiftCode,
        stage: formData.selectedStage
      }, username);
    } else {
      await saveEmployee({
        emp_id: formData.empId,
        emp_cat: formData.selectedEmpCategory,
        emp_name: formData.empName,
        skill_short: formData.selectedSkillShort,
        emp_doj: formData.empDoj,
        last_appraisal_date: formData.lastAppraisalDate,
        basic_da: Number(formData.basicDa),
        salary: Number(formData.salary),
        stage: formData.selectedStage,
        is_active: formData.isActive,
        shift_code: formData.selectedShiftCode
      }, username);
    }
    
    onSuccess();
  } catch (error) {
    console.error('Error saving employee:', error);
    onError('Error saving employee');
  }
}

export async function handleDeleteEmployee(
  employee: any,
  onSuccess: () => void,
  onError: (error: string) => void
): Promise<void> {
  if (!confirm(`Are you sure you want to delete "${employee.emp_name}" (${employee.emp_id})?`)) {
    return;
  }

  try {
    const username = localStorage.getItem('username');
    if (!username) {
      onError('User session not found');
      return;
    }

    await deleteEmployee(employee.id, username);
    onSuccess();
  } catch (error) {
    console.error('Error deleting employee:', error);
    onError('Error deleting employee');
  }
}

export async function handleImport(
  importFile: File,
  onSuccess: (results: { success: number; errors: string[] }) => void,
  onError: (error: string) => void
): Promise<void> {
  try {
    const text = await importFile.text();
    const username = localStorage.getItem('username');
    
    if (!username) {
      onError('User session not found');
      return;
    }

    const importResults = await importEmployees(text, username);
    onSuccess(importResults);
  } catch (error) {
    console.error('Error importing employees:', error);
    onError('Error importing employees');
  }
}

