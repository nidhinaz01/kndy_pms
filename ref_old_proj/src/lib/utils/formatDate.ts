export function formatDate(dateString: string): string {
  if (!dateString) return '';
  
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return dateString;
  
  const day = date.getDate().toString().padStart(2, '0');
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
                     'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const month = monthNames[date.getMonth()];
  const year = date.getFullYear().toString().slice(-2); // Get last 2 digits
  
  return `${day}-${month}-${year}`;
}

// Legacy function for backward compatibility - now uses the same format
export function formatDateDDMMMYYYY(dateString: string): string {
  return formatDate(dateString);
} 