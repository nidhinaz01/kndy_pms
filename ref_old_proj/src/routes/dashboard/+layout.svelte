<!-- src/routes/dashboard/+layout.svelte -->
<script lang="ts">
  import Sidebar from '$lib/components/navigation/Sidebar.svelte';
  import FloatingThemeToggle from '$lib/components/common/FloatingThemeToggle.svelte';
  import { onMount } from 'svelte';
  import { fetchUserMenus } from '$lib/api/menu';

  let menus: any[] = [];

  onMount(async () => {
    const username = localStorage.getItem('username');
    if (username) {
      menus = await fetchUserMenus();
    }
  });
</script>

<div class="flex h-screen w-screen overflow-hidden">
  <Sidebar {menus} />
  <main class="flex-1 theme-bg-secondary transition-colors duration-200 overflow-auto">
    <slot />
  </main>
</div>

<!-- Floating Theme Toggle -->
<FloatingThemeToggle />
