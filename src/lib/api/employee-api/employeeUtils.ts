import { supabase } from '$lib/supabaseClient';

export async function checkEmployeeIdExists(empId: string, excludeId?: number): Promise<boolean> {
  try {
    let query = supabase
      .from('hr_emp')
      .select('id')
      .eq('emp_id', empId)
      .eq('is_deleted', false);

    if (excludeId) {
      query = query.neq('id', excludeId);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error checking employee ID:', error);
      throw error;
    }

    return (data?.length || 0) > 0;
  } catch (error) {
    console.error('Error in checkEmployeeIdExists:', error);
    throw error;
  }
}

export function parseDate(dateString: string): Date | null {
  if (!dateString || dateString.trim() === '') {
    return null;
  }
  
  const match = dateString.trim().match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (match) {
    const [_, year, month, day] = match;
    const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    if (!isNaN(date.getTime())) {
      return date;
    }
  }
  
  return null;
}

