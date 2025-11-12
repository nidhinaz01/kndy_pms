/**
 * Export utilities for standardized file export with timestamps
 */

/**
 * Generates a timestamped filename for exports
 * @param baseName - The base name for the file (e.g., 'data_elements', 'work_orders')
 * @param extension - The file extension (default: 'csv')
 * @returns A filename with timestamp in format: baseName_YYYY-MM-DD_HH-MM-SS.extension
 */
export function generateTimestampedFilename(baseName: string, extension: string = 'csv'): string {
  const now = new Date();
  const timestamp = now.toISOString()
    .replace(/T/, '_')
    .replace(/\..+/, '')
    .replace(/:/g, '-');
  
  return `${baseName}_${timestamp}.${extension}`;
}

/**
 * Exports data to CSV with timestamped filename
 * @param data - Array of data objects to export
 * @param headers - Array of column headers
 * @param baseFileName - Base name for the file (e.g., 'data_elements', 'work_orders')
 * @param getRowData - Function to extract row data from each item
 */
export function exportToCSV(
  data: any[],
  headers: string[],
  baseFileName: string,
  getRowData: (item: any) => string[]
): void {
  const csvContent = [
    headers,
    ...data.map(item => getRowData(item))
  ].map(row => row.join(',')).join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = generateTimestampedFilename(baseFileName);
  a.click();
  window.URL.revokeObjectURL(url);
}

/**
 * Exports data to CSV with custom filename and timestamp
 * @param data - Array of data objects to export
 * @param headers - Array of column headers
 * @param filename - Custom filename (timestamp will be added automatically)
 * @param getRowData - Function to extract row data from each item
 */
export function exportToCSVWithCustomName(
  data: any[],
  headers: string[],
  filename: string,
  getRowData: (item: any) => string[]
): void {
  const csvContent = [
    headers,
    ...data.map(item => getRowData(item))
  ].map(row => row.join(',')).join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = generateTimestampedFilename(filename.replace('.csv', ''));
  a.click();
  window.URL.revokeObjectURL(url);
} 

/**
 * Strips currency symbols and formatting, returns only the numeric value as a string.
 */
export function sanitizeCurrency(value: string | number): string {
  if (typeof value !== 'string') value = value?.toString() ?? '';
  // Remove everything except digits and decimal point
  return value.replace(/[^0-9.]/g, '');
}

/**
 * Escapes a value for CSV (quotes if needed, escapes quotes).
 */
export function escapeCSV(value: string | number): string {
  value = value?.toString() ?? '';
  value = value.replace(/"/g, '""');
  if (/[",\n]/.test(value)) {
    value = `"${value}"`;
  }
  return value;
} 