import { supabase } from '$lib/supabaseClient';
import { fetchSkillMaster } from '$lib/api/skillMaster';

export async function loadSkillsWithUsernames(): Promise<any[]> {
  try {
    const rawSkills = await fetchSkillMaster();
    
    // Get usernames for modified_by emails
    const emails = [...new Set(rawSkills.map(skill => skill.modified_by))];
    
    if (emails.length > 0) {
      const { data: users, error: userError } = await supabase
        .from('app_users')
        .select('email, username')
        .in('email', emails);
      
      if (!userError && users) {
        const emailToUsername = new Map(users.map(u => [u.email, u.username]));
        return rawSkills.map(skill => ({
          ...skill,
          modified_by: emailToUsername.get(skill.modified_by) || skill.modified_by
        }));
      }
    }
    
    return rawSkills;
  } catch (error) {
    console.error('Error loading skills:', error);
    return [];
  }
}

