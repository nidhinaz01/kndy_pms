// src/lib/auth/checkSession.ts
import { supabase } from '$lib/supabaseClient';
import { browser } from '$app/environment';

export async function ensureValidSession(): Promise<boolean> {
  if (!browser) return true;

  const session = await supabase.auth.getSession();
  const sessionId = localStorage.getItem('session_id');
  const user = session.data.session?.user;

  if (!user || !sessionId) {
    localStorage.clear();
    await supabase.auth.signOut();
    return false;
  }

  const { data, error } = await supabase
    .from('app_users')
    .select('current_session_id, last_force_logout_time, last_force_logout_by')
    .eq('email', user.email)
    .maybeSingle();

  if (error || !data) {
    console.error('Session check error:', error?.message);
    localStorage.clear();
    await supabase.auth.signOut();
    return false;
  }

  if (data.current_session_id !== sessionId) {
    alert('Session mismatch: You have been logged out from another device.');
    localStorage.clear();
    await supabase.auth.signOut();
    return false;
  }

  if (data.last_force_logout_time && data.last_force_logout_by) {
    const forcedOutTime = new Date(data.last_force_logout_time);
    const now = new Date();
    if ((now.getTime() - forcedOutTime.getTime()) < 60_000) {
      alert('System Administrator has logged you out.');
      localStorage.clear();
      await supabase.auth.signOut();
      return false;
    }
  }

  return true;
}
