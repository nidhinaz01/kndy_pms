export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

export function validateSkillMasterForm(
  useExistingSkills: boolean,
  selectedSkillName: string,
  selectedSkillShort: string,
  newSkillName: string,
  newSkillCode: string,
  ratePerHour: string,
  minSalary: string,
  maxSalary: string,
  wef: string
): ValidationResult {
  const errors: string[] = [];

  // Determine which skill name and code to use
  let skillName = '';
  let skillCode = '';

  if (useExistingSkills) {
    if (!selectedSkillName) {
      errors.push('Skill Name is required');
    }
    if (!selectedSkillShort) {
      errors.push('Skill Code is required');
    }
    skillName = selectedSkillName;
    skillCode = selectedSkillShort;
  } else {
    if (!newSkillName.trim()) {
      errors.push('New Skill Name is required');
    }
    if (!newSkillCode.trim()) {
      errors.push('New Skill Code is required');
    }
    skillName = newSkillName.trim();
    skillCode = newSkillCode.trim();
  }

  if (ratePerHour === '' || isNaN(Number(ratePerHour)) || Number(ratePerHour) < 0) {
    errors.push('Rate per hour must be a non-negative number');
  }

  if (!minSalary || isNaN(Number(minSalary)) || Number(minSalary) <= 0) {
    errors.push('Minimum salary must be a positive number');
  }

  if (!maxSalary || isNaN(Number(maxSalary)) || Number(maxSalary) <= 0) {
    errors.push('Maximum salary must be a positive number');
  }

  if (Number(minSalary) >= Number(maxSalary)) {
    errors.push('Maximum salary must be greater than minimum salary');
  }

  if (!wef) {
    errors.push('WEF (With Effect From) date is required');
  }

  // Validate WEF date - allow future dates but prompt for confirmation
  if (wef) {
    const wefDate = new Date(wef);
    const today = new Date();
    
    wefDate.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);
    
    if (wefDate > today) {
      // Future date warning - this will be handled by the caller
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

export function formatWefDate(wef: any): string {
  if (!wef) return '';
  
  if (typeof wef === 'string' && wef.match(/^\d{4}-\d{2}-\d{2}$/)) {
    return wef;
  }
  
  const date = new Date(wef);
  return date.toISOString().split('T')[0];
}

