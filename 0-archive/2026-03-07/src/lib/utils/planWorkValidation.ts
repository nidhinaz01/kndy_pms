import type { PlanWorkFormData, WorkContinuation } from '$lib/types/planWork';
import { calculatePlannedHours, getIndividualSkills, getSkillShort } from './planWorkUtils';
import { calculateBreakTimeInMinutes } from './breakTimeUtils';

export interface ValidationResult {
  isValid: boolean;
  errors: Record<string, string>;
}

export function validatePlanWork(
  formData: PlanWorkFormData,
  work: any,
  workContinuation: WorkContinuation,
  existingPlans: any[],
  fromTime: string,
  toTime: string
): ValidationResult {
  const errors: Record<string, string> = {};

  // Validate skill mapping selection
  if (work?.skill_mappings && work.skill_mappings.length > 1) {
    if (formData.selectedSkillMappingIndex < 0) {
      errors.skillMapping = 'Please select a skill combination';
    }
  }

  // Validate workers are selected
  const selectedWorkersCount = Object.values(formData.selectedWorkers).filter(w => w !== null).length;
  if (selectedWorkersCount === 0) {
    errors.workers = 'Please assign at least one worker';
  }

  // Validate time inputs
  if (!fromTime) {
    errors.fromTime = 'From time is required';
  }

  if (!toTime) {
    errors.toTime = 'To time is required';
  }

  if (fromTime && toTime) {
    const hours = calculatePlannedHours(fromTime, toTime);
    if (hours <= 0) {
      errors.timeRange = 'To time must be after from time';
    }
  }

  // Validate time doesn't exceed remaining time
  if (fromTime && toTime && workContinuation.remainingTime > 0) {
    const plannedHours = calculatePlannedHours(fromTime, toTime);
    if (plannedHours > workContinuation.remainingTime) {
      errors.timeExcess = `Planned time (${plannedHours.toFixed(2)}h) exceeds remaining time (${workContinuation.remainingTime.toFixed(2)}h)`;
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
}

export function checkTimeOverlap(
  fromTime: string,
  toTime: string,
  existingPlans: any[]
): { hasOverlap: boolean; details: string } {
  if (!fromTime || !toTime || !existingPlans || existingPlans.length === 0) {
    return { hasOverlap: false, details: '' };
  }

  try {
    const [fromHour, fromMin] = fromTime.split(':').map(Number);
    const fromMinutes = fromHour * 60 + fromMin;
    
    const [toHour, toMin] = toTime.split(':').map(Number);
    let toMinutes = toHour * 60 + toMin;
    
    if (toMinutes < fromMinutes) {
      toMinutes += 24 * 60;
    }

    const overlappingPlans: any[] = [];

    for (const plan of existingPlans) {
      if (!plan.from_time || !plan.to_time) continue;

      const [planFromHour, planFromMin] = plan.from_time.split(':').map(Number);
      let planFromMinutes = planFromHour * 60 + planFromMin;
      
      const [planToHour, planToMin] = plan.to_time.split(':').map(Number);
      let planToMinutes = planToHour * 60 + planToMin;
      
      if (planToMinutes < planFromMinutes) {
        planToMinutes += 24 * 60;
      }
      
      if (planFromMinutes < toMinutes && planToMinutes > fromMinutes) {
        overlappingPlans.push(plan);
      }
    }

    if (overlappingPlans.length > 0) {
      const workerNames = overlappingPlans
        .map(plan => plan.worker_id || 'Unknown')
        .filter(Boolean)
        .join(', ');
      
      return {
        hasOverlap: true,
        details: `The selected time overlaps with existing plans for worker(s): ${workerNames}. Please choose a different time slot.`
      };
    }

    return { hasOverlap: false, details: '' };
  } catch (error) {
    console.error('Error checking time overlap:', error);
    return { hasOverlap: false, details: '' };
  }
}

export function checkTimeExcess(
  fromTime: string,
  toTime: string,
  remainingTime: number,
  estimatedDurationMinutes: number | undefined,
  shiftBreakTimes: Array<{ start_time: string; end_time: string }> = []
): { hasExcess: boolean; details: string } {
  if (!fromTime || !toTime) {
    return { hasExcess: false, details: '' };
  }

  // Calculate total time span
  const totalHours = calculatePlannedHours(fromTime, toTime);
  
  // Subtract break time to get actual work hours
  const breakMinutes = calculateBreakTimeInMinutes(fromTime, toTime, shiftBreakTimes);
  const breakHours = breakMinutes / 60;
  const plannedHours = Math.max(0, totalHours - breakHours);
  
  const estimatedHours = estimatedDurationMinutes ? estimatedDurationMinutes / 60 : 0;
  const timeLimit = remainingTime > 0 ? remainingTime : estimatedHours;

  if (timeLimit > 0 && plannedHours > timeLimit) {
    const excessHours = plannedHours - timeLimit;
    return {
      hasExcess: true,
      details: `The planned time (${plannedHours.toFixed(2)}h) exceeds the ${remainingTime > 0 ? 'remaining' : 'estimated'} time (${timeLimit.toFixed(2)}h) by ${excessHours.toFixed(2)} hours.`
    };
  }

  return { hasExcess: false, details: '' };
}

export function checkSkillMismatch(
  selectedWorkers: { [skill: string]: any },
  work: any,
  selectedSkillMappingIndex: number
): { hasMismatch: boolean; details: string } {
  if (!work?.skill_mappings || work.skill_mappings.length === 0) {
    return { hasMismatch: false, details: '' };
  }

  const skillMapping = work.skill_mappings[selectedSkillMappingIndex >= 0 ? selectedSkillMappingIndex : 0];
  if (!skillMapping) {
    return { hasMismatch: false, details: '' };
  }

  // Get individual skills from the current skill mapping
  const individualSkills = getIndividualSkills(skillMapping);
  
  // Build expected skill keys for the current skill mapping
  // For example, if skills are ["US", "T", "T"], expected keys are ["US-0", "T-1", "T-2"]
  const expectedSkillKeys = new Set<string>();
  individualSkills.forEach((skill, index) => {
    expectedSkillKeys.add(`${skill}-${index}`);
  });
  
  // Also handle single skill case (no index) - use skillShort or sc_name
  if (individualSkills.length === 1) {
    const skillShort = getSkillShort(skillMapping);
    const singleSkillKey = skillShort || skillMapping.sc_name || individualSkills[0];
    expectedSkillKeys.add(singleSkillKey);
  }
  
  // Check if selected workers have matching skills (only for current skill mapping)
  const mismatches: string[] = [];
  
  for (const [skillKey, worker] of Object.entries(selectedWorkers)) {
    if (!worker) continue;
    
    // Only validate entries that belong to the current skill mapping
    // Check if the skillKey matches any expected pattern
    let belongsToCurrentMapping = false;
    
    if (expectedSkillKeys.has(skillKey)) {
      belongsToCurrentMapping = true;
    } else {
      // Check if it matches the indexed pattern (e.g., "US-0", "T-1")
      const skillName = skillKey.split('-')[0];
      const skillIndex = skillKey.includes('-') ? parseInt(skillKey.split('-')[1]) : 0;
      
      // Check if this skill at this index is expected in the current mapping
      if (skillIndex < individualSkills.length && individualSkills[skillIndex] === skillName) {
        belongsToCurrentMapping = true;
      }
    }
    
    // Skip entries that don't belong to the current skill mapping
    if (!belongsToCurrentMapping) {
      continue;
    }
    
    // Extract skill name from key (e.g., "S2-0" -> "S2")
    const skillName = skillKey.split('-')[0];
    
    if (worker.skill_short !== skillName) {
      mismatches.push(`${worker.emp_name} (has ${worker.skill_short}, needs ${skillName})`);
    }
  }

  if (mismatches.length > 0) {
    return {
      hasMismatch: true,
      details: `Skill mismatch detected:\n${mismatches.join('\n')}`
    };
  }

  return { hasMismatch: false, details: '' };
}

