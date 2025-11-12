<script lang="ts">
  import { onMount } from 'svelte';
  import { supabase } from '$lib/supabaseClient';
  import { goto } from '$app/navigation';
  import { browser } from '$app/environment';

  onMount(async () => {
    if (!browser) return;
    const session = await supabase.auth.getSession();
    const user = session.data.session?.user;
    if (user) {
      goto('/dashboard');
    } else {
      goto('/login');
    }
  });
</script>

<!-- Optionally, show a loading message while redirecting -->
<p>Redirecting...</p>