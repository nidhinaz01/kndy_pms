import { supabase } from '$lib/supabaseClient';
import { fetchEmployees } from '$lib/api/employee';

export async function loadEmployeesWithUsernames(): Promise<any[]> {
  try {
    const rawEmployees = await fetchEmployees();
    
    // Get usernames for modified_by emails
    const emails = [...new Set(rawEmployees.map(emp => emp.modified_by))];
    
    if (emails.length > 0) {
      const { data: users, error: userError } = await supabase
        .from('app_users')
        .select('email, username')
        .in('email', emails);
      
      if (!userError && users) {
        const emailToUsername = new Map(users.map(u => [u.email, u.username]));
        return rawEmployees.map(emp => ({
          ...emp,
          modified_by: emailToUsername.get(emp.modified_by) || emp.modified_by
        }));
      }
    }
    
    return rawEmployees;
  } catch (error) {
    console.error('Error loading employees:', error);
    return [];
  }
}

