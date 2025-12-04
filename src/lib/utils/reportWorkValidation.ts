import type { ReportWorkFormData, LostTimeChunk } from '$lib/types/reportWork';

export interface ValidationResult {
  isValid: boolean;
  errors: Record<string, string>;
}

export function validateStage1(formData: ReportWorkFormData): ValidationResult {
  const errors: Record<string, string> = {};

  if (!formData.selectedWorkerId) {
    errors.worker = 'Worker is required';
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

export function validateStage2(formData: ReportWorkFormData): ValidationResult {
  const errors: Record<string, string> = {};

  if (formData.totalLostTimeMinutes > 0) {
    if (formData.lostTimeChunks.length === 0) {
      errors.chunks = 'Please add at least one lost time chunk';
    }

    const totalAllocated = formData.lostTimeChunks.reduce((sum, chunk) => sum + chunk.minutes, 0);
    if (totalAllocated !== formData.totalLostTimeMinutes) {
      errors.allocation = `Lost time allocation incomplete! Total: ${formData.totalLostTimeMinutes} minutes, Allocated: ${totalAllocated} minutes`;
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
}

export function validateStage3(formData: ReportWorkFormData): ValidationResult {
  const errors: Record<string, string> = {};

  if (formData.lostTimeChunks.length === 0) {
    errors.chunks = 'No lost time chunks to validate';
    return { isValid: false, errors };
  }

  // Check that all chunks have reasons assigned
  const chunksWithoutReasons = formData.lostTimeChunks.filter(chunk => !chunk.reasonId);
  if (chunksWithoutReasons.length > 0) {
    errors.reasons = `Please assign reasons to all lost time chunks. ${chunksWithoutReasons.length} chunk(s) missing reasons.`;
  }

  // Check for duplicate reasons
  const reasonIds = formData.lostTimeChunks
    .map(chunk => chunk.reasonId)
    .filter(id => id > 0);
  const uniqueReasonIds = new Set(reasonIds);
  if (reasonIds.length !== uniqueReasonIds.size) {
    errors.duplicateReasons = 'Duplicate reasons detected. Each chunk must have a unique reason.';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
}

export function validateSave(formData: ReportWorkFormData): ValidationResult {
  // Validate stage 1
  const stage1Validation = validateStage1(formData);
  if (!stage1Validation.isValid) {
    return stage1Validation;
  }

  // If there's lost time, validate stages 2 and 3
  if (formData.totalLostTimeMinutes > 0) {
    const stage2Validation = validateStage2(formData);
    if (!stage2Validation.isValid) {
      return stage2Validation;
    }

    const stage3Validation = validateStage3(formData);
    if (!stage3Validation.isValid) {
      return stage3Validation;
    }
  }

  return { isValid: true, errors: {} };
}

