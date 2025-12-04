import type { MultiSkillReportFormData, BreakdownData } from '$lib/types/multiSkillReport';

export interface ValidationResult {
  isValid: boolean;
  errors: Record<string, string>;
}

export function validateStage1(
  formData: MultiSkillReportFormData,
  selectedWorks: any[]
): ValidationResult {
  const errors: Record<string, string> = {};

  // Check that all skills have workers assigned OR have a deviation with reason
  const unassignedSkills = selectedWorks.filter(work => {
    const hasWorker = !!formData.skillEmployees[work.id];
    const hasDeviation = formData.deviations[work.id]?.hasDeviation || false;
    const hasDeviationReason = (formData.deviations[work.id]?.reason || '').trim().length > 0;
    
    // Skill is valid if it has a worker OR (has deviation AND reason)
    return !hasWorker && !(hasDeviation && hasDeviationReason);
  });
  
  if (unassignedSkills.length > 0) {
    const skillsNeedingWorker = unassignedSkills.filter(work => {
      const hasDeviation = formData.deviations[work.id]?.hasDeviation || false;
      return !hasDeviation; // Skills without deviation need worker
    });
    
    const skillsNeedingReason = unassignedSkills.filter(work => {
      const hasDeviation = formData.deviations[work.id]?.hasDeviation || false;
      const hasReason = (formData.deviations[work.id]?.reason || '').trim().length > 0;
      return hasDeviation && !hasReason; // Skills with deviation but no reason
    });
    
    if (skillsNeedingReason.length > 0) {
      const skillNames = skillsNeedingReason.map(work => {
        const skillName = work.std_work_skill_mapping?.sc_name || work.sc_required || 'Unknown Skill';
        return skillName;
      }).join(', ');
      
      if (skillsNeedingReason.length === 1) {
        errors.deviations = `Please provide a reason for the deviation in skill: ${skillNames}`;
      } else {
        errors.deviations = `Please provide reasons for deviations in the following ${skillsNeedingReason.length} skills: ${skillNames}`;
      }
    }
    
    if (skillsNeedingWorker.length > 0) {
      const skillNames = skillsNeedingWorker.map(work => {
        const skillName = work.std_work_skill_mapping?.sc_name || work.sc_required || 'Unknown Skill';
        return skillName;
      }).join(', ');
      
      if (skillsNeedingWorker.length === 1) {
        errors.skillEmployees = `Please assign a worker to the skill: ${skillNames}, or mark it as a deviation with a reason.`;
      } else {
        errors.skillEmployees = `Please assign workers to the following ${skillsNeedingWorker.length} skills: ${skillNames}, or mark them as deviations with reasons.`;
      }
    }
  }

  if (!formData.fromDate) {
    errors.fromDate = 'From date is required';
  }

  if (!formData.fromTime) {
    errors.fromTime = 'From time is required';
  }

  if (!formData.toDate) {
    errors.toDate = 'To date is required';
  }

  if (!formData.toTime) {
    errors.toTime = 'To time is required';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
}

export function validateStage2(
  formData: MultiSkillReportFormData
): ValidationResult {
  const errors: Record<string, string> = {};

  if (formData.showLostTimeSection && formData.ltMinutes > 0) {
    const hasBreakdown = formData.breakdownData.breakdownItems.length > 0;
    
    if (hasBreakdown) {
      // Check that all breakdown items have reasons selected
      if (formData.breakdownData.breakdownItems.some(item => !item.reasonId)) {
        errors.breakdown = 'Please select reasons for all lost time breakdown items';
        return { isValid: false, errors };
      }
      
      // Check that all lost time minutes are accounted for
      const totalAllocatedMinutes = formData.breakdownData.breakdownItems.reduce((sum, item) => sum + item.minutes, 0);
      
      if (totalAllocatedMinutes !== formData.ltMinutes) {
        errors.breakdown = `Lost time allocation incomplete! Total: ${formData.ltMinutes} minutes, Allocated: ${totalAllocatedMinutes} minutes`;
        return { isValid: false, errors };
      }
    } else if (!formData.ltReasonId) {
      errors.ltReason = 'Please select a reason for lost time';
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
}

export function validateSave(
  formData: MultiSkillReportFormData,
  selectedWorks: any[],
  isNonStandardWork: boolean = false
): ValidationResult {
  // Validate stage 1
  const stage1Validation = validateStage1(formData, selectedWorks);
  if (!stage1Validation.isValid) {
    return stage1Validation;
  }

  // For non-standard works, skip lost time validation
  if (isNonStandardWork) {
    return { isValid: true, errors: {} };
  }

  // If there's lost time, validate stage 2 (only for standard works)
  if (formData.showLostTimeSection && formData.ltMinutes > 0) {
    const stage2Validation = validateStage2(formData);
    if (!stage2Validation.isValid) {
      return stage2Validation;
    }
  }

  return { isValid: true, errors: {} };
}

