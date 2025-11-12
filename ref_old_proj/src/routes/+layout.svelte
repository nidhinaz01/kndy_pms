<script lang="ts">
  import '../app.css';
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { supabase } from '$lib/supabaseClient';
  import { browser } from '$app/environment';
  import { tick } from 'svelte';
  import { theme } from '$lib/stores/theme';

  // Get session data from server with default values
  export let data: { title: string } = { title: 'Production Management' };

  // Reactive title based on authentication status with safe access
  $: pageTitle = data?.title || 'Production Management';

  async function validateSession() {
    if (!browser) return;

    try {
      await tick(); // ensure DOM is ready

      const session = await supabase.auth.getSession();
      const sessionId = localStorage.getItem('session_id');
      const user = session.data.session?.user;

      // Only redirect if we have no user at all
      if (!user) {
        console.log('No user session found, redirecting to login');
        return redirectToLogin();
      }

      // If we have a user but no sessionId, just log it but don't redirect
      if (!sessionId) {
        console.log('User session exists but no sessionId in localStorage');
        return;
      }

      const { data: userData, error } = await supabase
        .from('app_users')
        .select('current_session_id, last_force_logout_time, last_force_logout_by')
        .eq('email', user.email)
        .maybeSingle();

      if (error || !userData) {
        console.error('Session consistency check failed:', error?.message);
        // Don't redirect on database errors, just log
        return;
      }

      if (userData.current_session_id !== sessionId) {
        console.log('Session ID mismatch, but not redirecting');
        // Don't redirect for session ID mismatch, just log
        return;
      }

      if (userData.last_force_logout_time && userData.last_force_logout_by) {
        const forcedOutTime = new Date(userData.last_force_logout_time);
        const now = new Date();
        const diffSec = Math.floor((now.getTime() - forcedOutTime.getTime()) / 1000);
        if (diffSec < 60) {
          alert('You are being logged out by the System Administrator.');
          return redirectToLogin();
        }
      }
    } catch (error) {
      console.error('Error validating session:', error);
    }
  }

  async function redirectToLogin() {
    try {
      localStorage.clear();
      await supabase.auth.signOut();
      await tick();

      // Avoid redirect loop
      if (!window.location.pathname.startsWith('/login')) {
        goto('/login?logout=1');
      }
    } catch (error) {
      console.error('Error redirecting to login:', error);
    }
  }

  onMount(() => {
    try {
      // Only validate session if we're not on the login page
      if (browser && !window.location.pathname.startsWith('/login')) {
        validateSession();
      }
      if (browser) {
        theme.initialize();
      }
    } catch (error) {
      console.error('Error in onMount:', error);
    }
  });
</script>

<svelte:head>
  <link rel="icon" type="image/png" href="/favicon.png" />
  <title>{pageTitle}</title>
</svelte:head>

<slot />
