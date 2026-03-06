export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

export function validateEmployeeForm(
  empId: string,
  selectedEmpCategory: string,
  empName: string,
  selectedSkillShort: string,
  empDoj: string,
  lastAppraisalDate: string,
  basicDa: string,
  salary: string,
  selectedStage: string,
  selectedShiftCode: string
): ValidationResult {
  const errors: string[] = [];

  if (!empId) errors.push('Employee ID is required');
  if (!selectedEmpCategory) errors.push('Employee Category is required');
  if (!empName) errors.push('Employee Name is required');
  if (!selectedSkillShort) errors.push('Skill is required');
  if (!empDoj) errors.push('Date of Joining is required');
  if (!lastAppraisalDate) errors.push('Last Appraisal Date is required');

  const basicDaNum = Number(basicDa);
  const categoryLower = selectedEmpCategory?.toLowerCase() || '';
  const isApprenticeOrTrainee = categoryLower.includes('apprentice') || categoryLower.includes('trainee');
  
  if (!basicDa || isNaN(basicDaNum)) {
    errors.push('Basic DA must be a valid number');
  } else if (isApprenticeOrTrainee) {
    if (basicDaNum < 0) {
      errors.push('Basic DA cannot be negative');
    }
  } else {
    if (basicDaNum <= 0) {
      errors.push('Basic DA must be a positive number');
    }
  }

  if (!salary || isNaN(Number(salary)) || Number(salary) <= 0) {
    errors.push('Salary must be a positive number');
  }

  if (!selectedStage) errors.push('Stage is required');
  if (!selectedShiftCode) errors.push('Shift Code is required');

  return {
    isValid: errors.length === 0,
    errors
  };
}

export function formatDateForInput(dateValue: any): string {
  if (!dateValue) return '';
  
  if (typeof dateValue === 'string' && dateValue.match(/^\d{4}-\d{2}-\d{2}$/)) {
    return dateValue;
  }
  
  const date = new Date(dateValue);
  return date.toISOString().split('T')[0];
}

