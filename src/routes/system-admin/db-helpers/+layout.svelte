<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';

	/** Stricter than parent system-admin layout: admin role only (not menu-granted access). */
	onMount(() => {
		try {
			const savedUserStr = localStorage.getItem('user');
			if (!savedUserStr) {
				goto('/dashboard');
				return;
			}
			let savedUser: any = null;
			try {
				savedUser = JSON.parse(savedUserStr);
			} catch {
				goto('/dashboard');
				return;
			}
			const role = savedUser?.role;
			const hasAdminRole = typeof role === 'string' && role.toLowerCase() === 'admin';
			if (!hasAdminRole) {
				goto('/dashboard');
				return;
			}
		} catch {
			goto('/dashboard');
		}
	});
</script>

<slot />
