<script lang="ts">
  import { supabase } from '$lib/supabaseClient';
  import { goto } from '$app/navigation';
  import { theme } from '$lib/stores/theme';
  import { onMount } from 'svelte';
  import Button from '$lib/components/common/Button.svelte';

  let confirming = false;

  onMount(() => {
    // Initialize theme
    theme.initialize();
  });

  async function confirmLogout() {
    const session = await supabase.auth.getSession();
    const user = session.data.session?.user;

    if (user) {
      await supabase
        .from('app_users')
        .update({ current_session_id: null })
        .eq('email', user.email);

      await supabase.auth.signOut();
    }

    localStorage.clear();
    goto('/login');
  }

  function cancelLogout() {
    goto('/dashboard'); // or previous page
  }
</script>

<div class="flex flex-col items-center justify-center h-screen text-center space-y-6 theme-bg-secondary">
  <div class="theme-bg-primary rounded-lg shadow-lg p-8 max-w-md w-full mx-4">
    <h1 class="text-xl font-semibold theme-text-primary mb-6">Are you sure you want to logout?</h1>
    <div class="flex gap-4 justify-center">
      <Button on:click={confirmLogout} variant="danger" size="md">
        Yes, Logout
      </Button>
      <Button on:click={cancelLogout} variant="secondary" size="md">
        Cancel
      </Button>
    </div>
  </div>
</div>
