/**
 * Converts a UTC timestamp string to a local Date object
 * Handles both ISO strings with 'Z' (UTC) and without timezone info
 * Supabase returns timestamps without timezone info, so we assume they are UTC
 */
export function parseUTCDate(dateString: string | Date): Date {
  if (dateString instanceof Date) {
    return dateString;
  }
  
  if (!dateString) {
    return new Date(NaN);
  }
  
  let dateStr = String(dateString).trim();
  
  // If the string already has timezone info (Z, +, or -), use it as-is
  if (dateStr.includes('Z') || dateStr.match(/[+-]\d{2}:\d{2}$/)) {
    return new Date(dateStr);
  }
  
  // If it's a date-only string (YYYY-MM-DD), add time component as UTC
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    dateStr += 'T00:00:00Z';
    return new Date(dateStr);
  }
  
  // If it has time but no timezone, assume it's UTC from the database
  // Handle formats like: 
  // - YYYY-MM-DDTHH:MM:SS (ISO format with T)
  // - YYYY-MM-DD HH:MM:SS (PostgreSQL format with space)
  // - YYYY-MM-DDTHH:MM:SS.microseconds or YYYY-MM-DD HH:MM:SS.microseconds
  
  // Check for ISO format with 'T'
  if (dateStr.includes('T')) {
    // Remove any trailing spaces or characters
    dateStr = dateStr.replace(/\s+$/, '');
    
    // Check if it's a timestamp without timezone (format: YYYY-MM-DDTHH:MM:SS or with microseconds)
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?$/.test(dateStr)) {
      dateStr += 'Z'; // Append Z to indicate UTC
      return new Date(dateStr);
    }
  }
  // Check for PostgreSQL format with space (YYYY-MM-DD HH:MM:SS)
  else if (/^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}(\.\d+)?$/.test(dateStr)) {
    // Replace space with 'T' and append 'Z' for UTC
    dateStr = dateStr.replace(/\s+/, 'T') + 'Z';
    return new Date(dateStr);
  }
  
  // Fallback: try parsing as-is, but log a warning
  console.warn('parseUTCDate: Unexpected date format, parsing as-is:', dateStr);
  return new Date(dateStr);
}

export function formatDate(dateString: string | Date): string {
  if (!dateString) return '-';
  
  try {
    const date = parseUTCDate(dateString);
    if (isNaN(date.getTime())) return '-';
    
    const day = date.getDate().toString().padStart(2, '0');
    const month = date.toLocaleString('en-US', { month: 'short' });
    const year = date.getFullYear().toString().slice(-2);
    
    return `${day}-${month}-${year}`;
  } catch (error) {
    console.error('Error formatting date:', error);
    return '-';
  }
}

/**
 * Formats a UTC timestamp to local date string (dd-mmm-yy format)
 */
export function formatDateLocal(dateString: string | Date): string {
  if (!dateString) return '-';
  
  try {
    const date = parseUTCDate(dateString);
    if (isNaN(date.getTime())) return '-';
    
    return date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: '2-digit'
    });
  } catch (error) {
    console.error('Error formatting date:', error);
    return '-';
  }
}

/**
 * Formats a UTC timestamp to local time string (HH:MM format, 24-hour)
 */
export function formatTimeLocal(dateString: string | Date): string {
  if (!dateString) return '-';
  
  try {
    const date = parseUTCDate(dateString);
    if (isNaN(date.getTime())) return '-';
    
    return date.toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
  } catch (error) {
    console.error('Error formatting time:', error);
    return '-';
  }
}

/**
 * Formats a UTC timestamp to local date and time string
 */
export function formatDateTimeLocal(dateString: string | Date): string {
  if (!dateString) return '-';
  
  try {
    const date = parseUTCDate(dateString);
    if (isNaN(date.getTime())) return '-';
    
    const dateStr = date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: '2-digit'
    });
    const timeStr = date.toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
    
    return `${dateStr} ${timeStr}`;
  } catch (error) {
    console.error('Error formatting date time:', error);
    return '-';
  }
}

export function formatTimeBreakdown(breakdown: any[], isUniform: boolean, totalMinutes?: number): string {
  if (!breakdown || breakdown.length === 0) {
    return 'No time standards available';
  }

  if (isUniform) {
    // Use provided totalMinutes if available, otherwise calculate from breakdown
    const minutes = totalMinutes || breakdown.reduce((sum, item) => sum + item.minutes, 0);
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    
    if (hours > 0) {
      return `${hours}h ${remainingMinutes}m (${breakdown.length} skills)`;
    } else {
      return `${remainingMinutes}m (${breakdown.length} skills)`;
    }
  } else {
    return `${breakdown.length} skills with varying times`;
  }
} 