<script lang="ts">
	import Sidebar from '$lib/components/navigation/Sidebar.svelte';
	import FloatingThemeToggle from '$lib/components/common/FloatingThemeToggle.svelte';
	import { onMount } from 'svelte';

	let menus: any[] = [];

	onMount(async () => {
		const user = localStorage.getItem('user');
		if (user) {
			const userData = JSON.parse(user);
			// Use the menu structure from database
			menus = userData.menus || [];
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