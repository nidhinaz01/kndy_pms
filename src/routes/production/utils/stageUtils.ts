/**
 * Utility functions for parsing and formatting stage-shift combinations
 */

export interface StageShiftParams {
  stageCode: string;
  shiftCode: string;
}

/**
 * Parse a stage-shift parameter (e.g., "P1S2-GEN") into stage and shift codes
 * @param stageShiftParam - The route parameter in format "STAGE-SHIFT"
 * @returns Object with stageCode and shiftCode, or null if invalid
 */
export function parseStageShiftParam(stageShiftParam: string): StageShiftParams | null {
  if (!stageShiftParam || typeof stageShiftParam !== 'string') {
    return null;
  }

  const parts = stageShiftParam.split('-');
  if (parts.length !== 2) {
    return null;
  }

  const [stageCode, shiftCode] = parts;
  if (!stageCode || !shiftCode) {
    return null;
  }

  return { stageCode: stageCode.trim(), shiftCode: shiftCode.trim() };
}

/**
 * Format stage and shift codes into a route parameter
 * @param stageCode - The stage code (e.g., "P1S2")
 * @param shiftCode - The shift code (e.g., "GEN")
 * @returns Formatted string "STAGE-SHIFT"
 */
export function formatStageShiftParam(stageCode: string, shiftCode: string): string {
  return `${stageCode}-${shiftCode}`;
}

/**
 * Get display name for a stage-shift combination
 * @param stageCode - The stage code
 * @param shiftCode - The shift code
 * @returns Display name (e.g., "P1S2-GEN Production Management")
 */
export function getStageShiftDisplayName(stageCode: string, shiftCode: string): string {
  return `${stageCode}-${shiftCode} Production Management`;
}

/**
 * Format export filename with stage and shift codes
 * @param stageCode - The stage code
 * @param shiftCode - The shift code
 * @param date - The date string
 * @param type - The export type (e.g., "Work_Planning", "Manpower")
 * @returns Formatted filename
 */
export function formatStageShiftExportFilename(
  stageCode: string,
  shiftCode: string,
  date: string,
  type: string
): string {
  const dateStr = date.split('T')[0]; // Ensure YYYY-MM-DD format
  return `${type}_${stageCode}-${shiftCode}_${dateStr}.xlsx`;
}

/**
 * Validate that a stage code is in the correct format
 * @param stageCode - The stage code to validate
 * @returns True if valid format
 */
export function isValidStageCode(stageCode: string): boolean {
  if (!stageCode || typeof stageCode !== 'string') {
    return false;
  }
  // Basic validation: should be alphanumeric, typically starts with P followed by number and S followed by number
  return /^[A-Z0-9]+$/.test(stageCode);
}

/**
 * Validate that a shift code is in the correct format
 * @param shiftCode - The shift code to validate
 * @returns True if valid format
 */
export function isValidShiftCode(shiftCode: string): boolean {
  if (!shiftCode || typeof shiftCode !== 'string') {
    return false;
  }
  // Basic validation: should be alphanumeric
  return /^[A-Z0-9]+$/.test(shiftCode);
}

