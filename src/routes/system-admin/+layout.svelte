<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';

  onMount(() => {
    // Check if user is admin
    const username = localStorage.getItem('username');
    if (!username || username.toLowerCase() !== 'admin') {
      console.log('User is not admin, redirecting to dashboard');
      goto('/dashboard');
      return;
    }
  });
</script>

<slot /> 