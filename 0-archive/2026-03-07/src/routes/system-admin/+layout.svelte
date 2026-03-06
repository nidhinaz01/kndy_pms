<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';

  onMount(() => {
    try {
      // Prefer role/menus from the stored user object — allow access if role is admin
      // or if the user has a mapped menu that points to the system-admin module.
      const savedUserStr = localStorage.getItem('user');
      if (!savedUserStr) {
        console.log('No saved user found, redirecting to dashboard');
        goto('/dashboard');
        return;
      }

      let savedUser: any = null;
      try {
        savedUser = JSON.parse(savedUserStr);
      } catch (err) {
        console.error('Failed to parse saved user from localStorage:', err);
        goto('/dashboard');
        return;
      }

      const role = savedUser?.role;
      const menus = Array.isArray(savedUser?.menus) ? savedUser.menus : [];

      const hasAdminRole = typeof role === 'string' && role.toLowerCase() === 'admin';
      const hasSystemAdminMenu = menus.some((m: any) => {
        const path = (m?.menu_path || '').toString().toLowerCase();
        const name = (m?.menu_name || '').toString().toLowerCase();
        return path.startsWith('/system-admin') || name.includes('system admin');
      });

      if (!hasAdminRole && !hasSystemAdminMenu) {
        console.log('User lacks System Admin access, redirecting to dashboard');
        goto('/dashboard');
        return;
      }
    } catch (e) {
      console.error('Error checking system-admin access:', e);
      goto('/dashboard');
      return;
    }
  });
</script>

<slot /> 