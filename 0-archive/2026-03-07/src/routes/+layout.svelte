<script lang="ts">
	import '../app.css';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { theme } from '$lib/stores/theme';
	import { supabase } from '$lib/supabaseClient';
	import { browser } from '$app/environment';

	// Get session data from server with default values
	export let data: { title: string } = { title: 'Production Management' };

	// Reactive title based on authentication status with safe access
	$: pageTitle = data?.title || 'Production Management';

	onMount(async () => {
		if (!browser) return;
		
		try {
			// Initialize theme
			theme.initialize();
			
			// Skip auth check for login page and auth routes
			const pathname = window.location.pathname;
			if (pathname === '/' || pathname.startsWith('/auth/')) {
				return;
			}

			// Check if user is logged in - primary check is localStorage
			const savedUser = localStorage.getItem('user');
			const sessionId = localStorage.getItem('session_id');
			
			// If we have saved user data and session ID, allow access
			// (Supabase session might still be establishing after login)
			if (savedUser && sessionId) {
				try {
					const userData = JSON.parse(savedUser);
					
					// Verify user exists and is active in database
					const { data: userRecord } = await supabase
						.from('app_users')
						.select('is_active, is_deleted, auth_user_id')
						.eq('username', userData.username)
						.single();

					if (userRecord && userRecord.is_active && !userRecord.is_deleted) {
						// User is valid, allow access
						// Check Supabase session asynchronously (don't block)
						if (userRecord.auth_user_id) {
							supabase.auth.getSession().then(({ data: { session } }) => {
								if (!session) {
									console.warn('User has auth_user_id but no Supabase session - session may be establishing');
								}
							});
						}
						return; // Allow access
					}
				} catch (error) {
					console.error('Error verifying user:', error);
					// If verification fails, still allow if we have localStorage
					// (to prevent redirect loops during network issues)
					return;
				}
			}

			// No valid session found, redirect to login
			if (!savedUser || !sessionId) {
				// Clear any stale data
				localStorage.removeItem('user');
				localStorage.removeItem('session_id');
				await supabase.auth.signOut();
				goto('/');
			}
		} catch (error) {
			console.error('Error in onMount:', error);
			// On error, don't redirect to prevent loops
		}
	});
</script>

<svelte:head>
	<title>{pageTitle}</title>
</svelte:head>

<slot />
