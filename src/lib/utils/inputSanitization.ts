export function sanitizeString(input: string): string {
  if (!input) return '';
  return input.trim();
}

export function isValidTrimmedString(input: string): boolean {
  return Boolean(input && input.trim().length > 0);
}

export function sanitizeNumber(input: string): number | null {
  if (!input) return null;
  const num = parseFloat(input.trim());
  return isNaN(num) ? null : num;
}

export function isValidNumber(input: string): boolean {
  return sanitizeNumber(input) !== null;
} 