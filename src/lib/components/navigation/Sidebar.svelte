<script lang="ts">
	import { ChevronDown, Menu as MenuIcon } from 'lucide-svelte';
	import MenuIconComp from './MenuIcon.svelte';
	import SidebarSubMenu from './SidebarSubMenu.svelte';
	import { get } from 'svelte/store';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import Button from '$lib/components/common/Button.svelte';
	import { supabase } from '$lib/supabaseClient';
	import { onMount } from 'svelte';

	export let menus: any[] = [];

	let expanded: Record<string, boolean> = {};
	let sidebarOpen = true;
	let sidebarToggled = false;
	const currentPath = get(page).url.pathname;
	let showLogoutModal = false;
	
	// Get current username from localStorage
	let currentUsername = '';
	
	// Load username on mount
	onMount(() => {
		currentUsername = localStorage.getItem('username') || '';
	});

	// Set sidebarToggled to true initially for non-dashboard pages
	$: if (currentPath !== '/dashboard') {
		sidebarToggled = true;
	}

	async function confirmLogout() {
		try {
			// Get current user info
			const username = localStorage.getItem('username');
			
			if (username) {
				// Clear session in database
				const { error: updateError } = await supabase
					.from('app_users')
					.update({ 
						current_session_id: null,
						last_logout_time: new Date().toISOString()
					})
					.eq('username', username);

				if (updateError) {
					console.error('Error clearing session in database:', updateError);
				}
			}

			// Sign out from Supabase
			await supabase.auth.signOut();
			
			// Clear local storage
			localStorage.clear();
			
			// Redirect to login
			goto('/');
		} catch (error) {
			console.error('Error during logout:', error);
			// Still clear localStorage and redirect even if database update fails
			localStorage.clear();
			goto('/');
		}
	}

	function toggle(menuId: string) {
		expanded[menuId] = !expanded[menuId];
	}

	function toggleSidebar() {
		sidebarOpen = !sidebarOpen;
		sidebarToggled = true;
	}
</script>

<!-- Sidebar -->
<aside class={`transition-all duration-300 theme-bg-primary theme-text-primary theme-border border-r overflow-hidden h-full ${sidebarOpen ? 'w-64' : 'w-12'}`}>
	<div class="flex flex-col h-full">

		<!-- Burger Icon -->
		<div class="p-2 border-b theme-border">
			<button
				class="theme-bg-tertiary rounded p-1 shadow mx-auto block"
				on:click={toggleSidebar}
				aria-label="Toggle sidebar"
			>
				<MenuIcon class="w-5 h-5" />
			</button>
		</div>

		<!-- Scrollable Menu Items -->
		<div class="flex-1 overflow-y-auto p-2 space-y-2">
			{#each menus as menu}
				<div>
					<div
						class="flex items-center justify-between cursor-pointer px-2 py-1 rounded hover:theme-bg-tertiary"
						on:click={() => menu.submenus?.length > 0 ? toggle(menu.menu_id) : goto(menu.menu_path)}
						role="button"
						tabindex="0"
						on:keydown={(e) => (e.key === 'Enter' || e.key === ' ') && (menu.submenus?.length > 0 ? toggle(menu.menu_id) : goto(menu.menu_path))}
					>
						<div class="flex items-center gap-2 font-semibold text-sm">
							<MenuIconComp name={menu.menu_name} />
							{#if sidebarOpen}
								{menu.menu_name}
							{/if}
						</div>
						{#if menu.submenus?.length > 0 && sidebarOpen}
							<ChevronDown class={`w-4 h-4 transition-transform ${expanded[menu.menu_id] ? 'rotate-180' : ''}`} />
						{/if}
					</div>

					{#if menu.submenus?.length > 0 && expanded[menu.menu_id] && sidebarOpen}
						<ul class="ml-6 mt-1 space-y-1">
							<SidebarSubMenu submenus={menu.submenus} currentPath={currentPath} />
						</ul>
					{/if}
				</div>
			{/each}
		</div>

		<!-- Logout Button -->
		<div class="p-2 border-t theme-border">
			<button
				on:click={() => showLogoutModal = true}
				class="w-full flex items-center gap-2 justify-center md:justify-start px-2 py-2 rounded text-sm text-red-600 hover:bg-red-100"
				aria-label="Logout"
			>
				<svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a2 2 0 002 2h3a2 2 0 002-2V7a2 2 0 00-2-2h-3a2 2 0 00-2 2v1" />
				</svg>
				{#if sidebarOpen}
					<span>Logout{currentUsername ? ` (${currentUsername})` : ''}</span>
				{/if}
			</button>
		</div>
	</div>
</aside>

<!-- Centered Logo Overlay when Sidebar is Toggled -->
{#if sidebarToggled && currentPath !== '/dashboard'}
	<div class="fixed inset-0 flex items-center justify-center z-30 pointer-events-none" style="left: 16rem;">
		<div class="text-center">
			<div class="w-96 h-auto mx-auto">
				<img src="/favicon.png" alt="Company Logo" class="w-32 h-32 mx-auto object-contain" />
			</div>
		</div>
	</div>
{/if}

<!-- Logout Confirmation Modal -->
{#if showLogoutModal}
	<div class="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
		<div class="theme-bg-primary p-6 rounded-lg shadow-lg text-center space-y-4 w-80 max-w-full mx-4">
			<h2 class="text-lg font-semibold theme-text-primary">Confirm Logout</h2>
			<p class="theme-text-secondary">Are you sure you want to logout?</p>
			<div class="flex justify-center gap-3">
				<Button
					variant="danger"
					size="md"
					on:click={confirmLogout}
				>
					Yes, Logout
				</Button>
				<Button
					variant="secondary"
					size="md"
					on:click={() => showLogoutModal = false}
				>
					Cancel
				</Button>
			</div>
		</div>
	</div>
{/if} 