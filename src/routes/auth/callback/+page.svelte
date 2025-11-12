<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { supabase } from '$lib/supabaseClient';
  import FloatingThemeToggle from '$lib/components/common/FloatingThemeToggle.svelte';
  import { theme } from '$lib/stores/theme';

  let isLoading = true;
  let message = '';
  let messageType: 'success' | 'error' = 'success';

  onMount(() => {
    theme.initialize();
    handleAuthCallback();
  });

  async function handleAuthCallback() {
    try {
      // Handle the auth callback from Supabase
      const { data, error } = await supabase.auth.getSession();
      
      if (error) {
        console.error('Auth callback error:', error);
        message = 'Authentication error. Please try again.';
        messageType = 'error';
        setTimeout(() => goto('/'), 3000);
        return;
      }

      if (!data.session) {
        message = 'No active session found. Redirecting to login...';
        messageType = 'error';
        setTimeout(() => goto('/'), 3000);
        return;
      }

      // Get user email from session
      const email = data.session.user.email;
      if (!email) {
        message = 'Unable to retrieve user information.';
        messageType = 'error';
        setTimeout(() => goto('/'), 3000);
        return;
      }

      // Check if this is an email verification
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const type = hashParams.get('type');
      
      if (type === 'recovery') {
        // Password reset callback - redirect to reset password page
        message = 'Redirecting to password reset...';
        messageType = 'success';
        setTimeout(() => {
          goto('/auth/reset-password?first_login=true');
        }, 1500);
        return;
      }

      if (type === 'signup' || type === 'email') {
        // Email verification callback
        // Update email_verified flag in app_users
        const { error: updateError } = await supabase
          .from('app_users')
          .update({ 
            email_verified: true,
            modified_dt: new Date().toISOString()
          })
          .eq('email', email)
          .eq('is_deleted', false);

        if (updateError) {
          console.error('Error updating email verification:', updateError);
        }

        message = 'Email verified successfully! Redirecting to login...';
        messageType = 'success';
        setTimeout(() => {
          goto('/');
        }, 2000);
        return;
      }

      // Default: redirect to login
      message = 'Redirecting to login...';
      messageType = 'success';
      setTimeout(() => {
        goto('/');
      }, 1500);

    } catch (error) {
      console.error('Unexpected error in auth callback:', error);
      message = 'An unexpected error occurred. Redirecting to login...';
      messageType = 'error';
      setTimeout(() => goto('/'), 3000);
    } finally {
      isLoading = false;
    }
  }
</script>

<svelte:head>
  <title>Authentication - Production Management System</title>
</svelte:head>

<div class="flex items-center justify-center min-h-screen theme-bg-secondary">
  <div class="theme-bg-primary theme-text-primary theme-border border p-8 rounded shadow-md w-full max-w-md text-center">
    <!-- Logo -->
    <div class="w-24 h-24 mx-auto mb-6 flex items-center justify-center">
      <img src="/favicon.png" alt="Company Logo" class="w-full h-full object-contain" />
    </div>

    {#if isLoading}
      <div class="flex flex-col items-center">
        <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
        <p class="theme-text-secondary">Processing authentication...</p>
      </div>
    {:else}
      <div class="flex flex-col items-center">
        {#if messageType === 'success'}
          <div class="w-16 h-16 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center mb-4">
            <svg class="w-8 h-8 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
            </svg>
          </div>
        {:else}
          <div class="w-16 h-16 bg-red-100 dark:bg-red-900 rounded-full flex items-center justify-center mb-4">
            <svg class="w-8 h-8 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
            </svg>
          </div>
        {/if}
        <p class={`text-lg font-medium ${messageType === 'success' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
          {message}
        </p>
      </div>
    {/if}
  </div>
</div>

<!-- Floating Theme Toggle -->
<FloatingThemeToggle />

