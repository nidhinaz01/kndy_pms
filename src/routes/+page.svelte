<script lang="ts">
	import { Eye, EyeOff } from 'lucide-svelte';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import { theme } from '$lib/stores/theme';
	import FloatingThemeToggle from '$lib/components/common/FloatingThemeToggle.svelte';
	import Button from '$lib/components/common/Button.svelte';
	import { supabase } from '$lib/supabaseClient';
	import { fetchUserMenus } from '$lib/services/menuService';

	let username = '';
	let password = '';
	let errorMsg = '';
	let showPassword = false;
	let isLoading = false;

	onMount(() => {
		// Initialize theme
		theme.initialize();
	});

	function togglePasswordVisibility() {
		showPassword = !showPassword;
	}

	function handleKeyPress(event: KeyboardEvent) {
		if (event.key === 'Enter') {
			login();
		}
	}

	async function login() {
		if (!username.trim() || !password.trim()) {
			errorMsg = 'Please enter both username and password';
			return;
		}

		isLoading = true;
		errorMsg = '';

		try {
			// First, look up the user in app_users table to get their email
			const { data: users, error: lookupError } = await supabase
				.from('app_users')
				.select('email, app_user_uuid, current_session_id, role, must_change_password, password_setup_completed, account_locked_until, failed_login_attempts, auth_user_id')
				.eq('username', username)
				.eq('is_active', true)
				.maybeSingle();

			if (lookupError) {
				console.error('Database lookup error:', lookupError);
				errorMsg = 'Database connection error. Please try again.';
				return;
			}

			if (!users?.email || !users.app_user_uuid) {
				errorMsg = 'Invalid username or user not found';
				return;
			}

			// Check if user has Supabase Auth account
			const hasSupabaseAuth = !!users.auth_user_id;

			// Check if account is locked
			if (users.account_locked_until) {
				const lockUntil = new Date(users.account_locked_until);
				const now = new Date();
				if (lockUntil > now) {
					const minutesLeft = Math.ceil((lockUntil.getTime() - now.getTime()) / 60000);
					errorMsg = `Account is locked. Please try again in ${minutesLeft} minute(s).`;
					return;
				} else {
					// Lock expired, reset it
					await supabase
						.from('app_users')
						.update({ 
							account_locked_until: null,
							failed_login_attempts: 0
						})
						.eq('app_user_uuid', users.app_user_uuid);
				}
			}

			// Check if user is already logged in from another session
			const localSessionId = localStorage.getItem('session_id') || crypto.randomUUID();
			if (users.current_session_id && users.current_session_id !== localSessionId) {
				// For development/testing: allow login by clearing the old session
				console.log('Clearing old session for development');
				const { error: clearError } = await supabase
					.from('app_users')
					.update({ current_session_id: null })
					.eq('app_user_uuid', users.app_user_uuid);
				
				if (clearError) {
					console.error('Error clearing session:', clearError);
					errorMsg = `The username: ${username} is currently logged in from another machine. Please logout first.`;
					return;
				}
			}

			// Authenticate with Supabase Auth if user has auth_user_id
			if (hasSupabaseAuth) {
				const { data: authData, error: loginError } = await supabase.auth.signInWithPassword({
					email: users.email,
					password: password
				});

				if (loginError) {
					// Increment failed login attempts
					const failedAttempts = (users.failed_login_attempts || 0) + 1;
					const maxAttempts = 5;
					const lockDurationMinutes = 30;

					if (failedAttempts >= maxAttempts) {
						const lockUntil = new Date();
						lockUntil.setMinutes(lockUntil.getMinutes() + lockDurationMinutes);
						
						await supabase
							.from('app_users')
							.update({
								failed_login_attempts: failedAttempts,
								account_locked_until: lockUntil.toISOString()
							})
							.eq('app_user_uuid', users.app_user_uuid);

						errorMsg = `Too many failed login attempts. Account locked for ${lockDurationMinutes} minutes.`;
					} else {
						await supabase
							.from('app_users')
							.update({ failed_login_attempts: failedAttempts })
							.eq('app_user_uuid', users.app_user_uuid);

						errorMsg = `Invalid password. ${maxAttempts - failedAttempts} attempt(s) remaining.`;
					}
					return;
				}

				// Check if user must change password
				if (users.must_change_password || !users.password_setup_completed) {
					// Generate session ID for password change page
					const tempSessionId = crypto.randomUUID();
					localStorage.setItem('session_id', tempSessionId);
					localStorage.setItem('username', username);
					
					// Store user info temporarily
					localStorage.setItem('user', JSON.stringify({
						username: username,
						role: users.role,
						menus: []
					}));

					// Redirect to password change page
					goto('/auth/reset-password?first_login=true');
					return;
				}
			} else {
				// User does not have Supabase Auth account
				errorMsg = 'User account is not properly configured. Please contact administrator.';
				return;
			}

			// Reset failed login attempts on successful login
			await supabase
				.from('app_users')
				.update({ 
					failed_login_attempts: 0,
					account_locked_until: null
				})
				.eq('app_user_uuid', users.app_user_uuid);

			// Generate new session ID and update user record
			const newSessionId = crypto.randomUUID();
			localStorage.setItem('session_id', newSessionId);
			localStorage.setItem('username', username);

			// Get client IP (if available)
			const clientIP = await fetch('https://api.ipify.org?format=json')
				.then(res => res.json())
				.then(data => data.ip)
				.catch(() => null);

			// Update user's session info in database
			const now = new Date().toISOString();
			const { error: updateError } = await supabase
				.from('app_users')
				.update({
					current_session_id: newSessionId,
					last_login_time: now,
					last_login_ip: clientIP,
					modified_dt: now
				})
				.eq('app_user_uuid', users.app_user_uuid);

			if (updateError) {
				console.error('Error updating user session:', updateError);
			}

			// Fetch user-specific menus from database
			const userMenus = await fetchUserMenus(username);
			
			// Store user info for the app
			localStorage.setItem('user', JSON.stringify({
				username: username,
				role: users.role,
				menus: userMenus
			}));

			// Wait for session to be established and verify it
			let sessionEstablished = false;
			for (let i = 0; i < 10; i++) {
				await new Promise(resolve => setTimeout(resolve, 200));
				const { data: { session } } = await supabase.auth.getSession();
				if (session) {
					sessionEstablished = true;
					break;
				}
			}

			if (!sessionEstablished && hasSupabaseAuth) {
				console.warn('Supabase session not established after login, but proceeding anyway');
			}
			
			goto('/dashboard');
		} catch (error) {
			console.error('Unexpected error during login:', error);
			errorMsg = 'An unexpected error occurred. Please try again.';
		} finally {
			isLoading = false;
		}
	}



	function handleLoginClick() {
		login();
	}
</script>

<style>
	.login-button {
		width: 100% !important;
		border: 2px solid #2563eb !important;
		background-color: white !important;
		color: #2563eb !important;
		font-weight: 500 !important;
		padding: 12px 16px !important;
		border-radius: 8px !important;
		transition: all 0.2s ease !important;
		cursor: pointer !important;
	}

	.login-button:hover {
		background-color: #2563eb !important;
		color: white !important;
	}

	.login-button:active {
		background-color: #1d4ed8 !important;
		color: white !important;
	}

	.login-button:disabled {
		background-color: #d1d5db !important;
		border-color: #9ca3af !important;
		color: #6b7280 !important;
		cursor: not-allowed !important;
	}
</style>

<svelte:head>
	<title>Login - Production Management System</title>
</svelte:head>

<div class="flex items-center justify-center min-h-screen theme-bg-secondary">
	<div class="theme-bg-primary theme-text-primary theme-border border p-8 rounded shadow-md w-full max-w-sm text-center">
		<!-- Logo -->
		<div class="w-32 h-32 mx-auto mb-6 flex items-center justify-center">
			<img src="/favicon.png" alt="Company Logo" class="w-full h-full object-contain" />
		</div>

		<!-- Title -->
		<h2 class="text-2xl font-bold mb-4 theme-text-primary">Login for Production</h2>

		<!-- Username Input -->
		<input
			class="w-full theme-border border p-2 mb-3 theme-bg-primary theme-text-primary rounded"
			bind:value={username}
			placeholder="Username"
			on:keypress={handleKeyPress}
		/>

		<!-- Password Input with Toggle -->
		<div class="relative mb-3">
			<input
				class="w-full theme-border border p-2 pr-10 theme-bg-primary theme-text-primary rounded"
				type={showPassword ? 'text' : 'password'}
				bind:value={password}
				placeholder="Password"
				on:keypress={handleKeyPress}
			/>
			<button
				type="button"
				class="absolute right-2 top-1/2 transform -translate-y-1/2 p-1 theme-text-secondary hover:theme-text-primary transition-colors"
				on:click={togglePasswordVisibility}
				aria-label={showPassword ? 'Hide password' : 'Show password'}
			>
				{#if showPassword}
					<EyeOff class="w-4 h-4" />
				{:else}
					<Eye class="w-4 h-4" />
				{/if}
			</button>
		</div>

		<!-- Error Message -->
		{#if errorMsg}
			<p class="text-red-600 mb-3">{errorMsg}</p>
		{/if}

		<!-- Login Button -->
		<button
			on:click={handleLoginClick}
			disabled={isLoading}
			class="login-button"
		>
			{#if isLoading}
				<div class="flex items-center justify-center">
					<div class="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
					Logging In...
				</div>
			{:else}
				Log In
			{/if}
		</button>
	</div>
</div>

<!-- Floating Theme Toggle -->
<FloatingThemeToggle />
