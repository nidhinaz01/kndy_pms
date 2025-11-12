/**
 * Utility functions for input sanitization and validation
 */

/**
 * Sanitizes a string by trimming whitespace
 * @param value - The string value to sanitize
 * @returns The trimmed string or empty string if null/undefined
 */
export function sanitizeString(value: string | null | undefined): string {
  return value?.trim() || '';
}

/**
 * Sanitizes an object by trimming all string values
 * @param obj - The object to sanitize
 * @returns A new object with all string values trimmed
 */
export function sanitizeObject<T extends Record<string, any>>(obj: T): T {
  const sanitized = { ...obj } as T;
  for (const [key, value] of Object.entries(sanitized)) {
    if (typeof value === 'string') {
      (sanitized as any)[key] = sanitizeString(value);
    }
  }
  return sanitized;
}

/**
 * Validates that a trimmed string is not empty
 * @param value - The string value to validate
 * @returns true if the trimmed string is not empty, false otherwise
 */
export function isValidTrimmedString(value: string | null | undefined): boolean {
  return sanitizeString(value).length > 0;
}

/**
 * Validates multiple required string fields
 * @param fields - Object with field names as keys and values as strings
 * @returns Object with validation results for each field
 */
export function validateRequiredFields(fields: Record<string, string | null | undefined>): {
  isValid: boolean;
  errors: Record<string, string>;
} {
  const errors: Record<string, string> = {};
  let isValid = true;

  for (const [fieldName, value] of Object.entries(fields)) {
    if (!isValidTrimmedString(value)) {
      errors[fieldName] = `${fieldName.charAt(0).toUpperCase() + fieldName.slice(1)} is required`;
      isValid = false;
    }
  }

  return { isValid, errors };
}

/**
 * Sanitizes and validates a form data object
 * @param formData - The form data object
 * @param requiredFields - Array of field names that are required
 * @returns Object with sanitized data and validation results
 */
export function sanitizeAndValidateForm<T extends Record<string, any>>(
  formData: T,
  requiredFields: (keyof T)[]
): {
  sanitizedData: T;
  isValid: boolean;
  errors: Record<string, string>;
} {
  const sanitizedData = sanitizeObject(formData);
  
  const requiredFieldsObj: Record<string, string | null | undefined> = {};
  requiredFields.forEach(field => {
    requiredFieldsObj[field as string] = sanitizedData[field];
  });

  const validation = validateRequiredFields(requiredFieldsObj);
  
  return {
    sanitizedData,
    isValid: validation.isValid,
    errors: validation.errors
  };
} 