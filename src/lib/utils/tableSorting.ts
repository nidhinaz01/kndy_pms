/**
 * Professional table sorting utility
 * Handles sorting for various data types (strings, numbers, dates, nested objects)
 */

export type SortDirection = 'asc' | 'desc' | null;

export interface SortConfig {
  column: string | null;
  direction: SortDirection;
}

/**
 * Get sortable value from an object, handling nested properties and various data types
 */
function getSortValue(obj: any, column: string): any {
  if (!column) return '';
  
  // Handle nested properties (e.g., 'prdn_wo_details.wo_no')
  const parts = column.split('.');
  let value = obj;
  
  for (const part of parts) {
    if (value === null || value === undefined) return '';
    value = value[part];
  }
  
  return value ?? '';
}

/**
 * Compare two values for sorting
 */
function compareValues(a: any, b: any, direction: 'asc' | 'desc'): number {
  // Handle null/undefined
  if (a === null || a === undefined) a = '';
  if (b === null || b === undefined) b = '';
  
  // Handle dates
  if (a instanceof Date && b instanceof Date) {
    return direction === 'asc' ? a.getTime() - b.getTime() : b.getTime() - a.getTime();
  }
  
  // Handle date strings (YYYY-MM-DD format)
  const dateRegex = /^\d{4}-\d{2}-\d{2}/;
  if (typeof a === 'string' && typeof b === 'string' && dateRegex.test(a) && dateRegex.test(b)) {
    const dateA = new Date(a);
    const dateB = new Date(b);
    if (!isNaN(dateA.getTime()) && !isNaN(dateB.getTime())) {
      return direction === 'asc' ? dateA.getTime() - dateB.getTime() : dateB.getTime() - dateA.getTime();
    }
  }
  
  // Handle numbers
  const numA = typeof a === 'string' ? parseFloat(a) : a;
  const numB = typeof b === 'string' ? parseFloat(b) : b;
  if (!isNaN(numA) && !isNaN(numB) && typeof numA === 'number' && typeof numB === 'number') {
    return direction === 'asc' ? numA - numB : numB - numA;
  }
  
  // Handle strings (case-insensitive)
  const strA = String(a).toLowerCase().trim();
  const strB = String(b).toLowerCase().trim();
  
  const comparison = strA.localeCompare(strB, undefined, { numeric: true, sensitivity: 'base' });
  return direction === 'asc' ? comparison : -comparison;
}

/**
 * Sort an array of objects based on sort configuration
 */
export function sortTableData<T>(data: T[], sortConfig: SortConfig): T[] {
  if (!sortConfig.column || !sortConfig.direction) {
    return [...data];
  }
  
  return [...data].sort((a, b) => {
    const aValue = getSortValue(a, sortConfig.column!);
    const bValue = getSortValue(b, sortConfig.column!);
    return compareValues(aValue, bValue, sortConfig.direction!);
  });
}

/**
 * Handle column header click - toggle sort direction or set new column
 */
export function handleSortClick(
  column: string,
  currentSort: SortConfig
): SortConfig {
  if (currentSort.column === column) {
    // Toggle direction: asc -> desc -> null -> asc
    if (currentSort.direction === 'asc') {
      return { column, direction: 'desc' };
    } else if (currentSort.direction === 'desc') {
      return { column: null, direction: null };
    } else {
      return { column, direction: 'asc' };
    }
  } else {
    // New column - start with ascending
    return { column, direction: 'asc' };
  }
}

/**
 * Get sort icon class for a column header
 */
export function getSortIconClass(column: string, sortConfig: SortConfig): string {
  if (sortConfig.column !== column || !sortConfig.direction) {
    return 'opacity-30'; // Neutral state
  }
  
  return sortConfig.direction === 'asc' 
    ? 'opacity-100 rotate-180' 
    : 'opacity-100';
}

/**
 * Get sort indicator text (for accessibility)
 */
export function getSortIndicator(column: string, sortConfig: SortConfig): string {
  if (sortConfig.column !== column) return '';
  if (sortConfig.direction === 'asc') return ' (sorted ascending)';
  if (sortConfig.direction === 'desc') return ' (sorted descending)';
  return '';
}
