<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { Eye, EyeOff } from 'lucide-svelte';
  import { supabase } from '$lib/supabaseClient';
  import Button from '$lib/components/common/Button.svelte';
  import FloatingThemeToggle from '$lib/components/common/FloatingThemeToggle.svelte';
  import { theme } from '$lib/stores/theme';
  import { validatePassword } from '$lib/utils/passwordUtils';

  let newPassword = '';
  let confirmPassword = '';
  let showPassword = false;
  let showConfirmPassword = false;
  let errorMsg = '';
  let successMsg = '';
  let isLoading = false;
  let isFirstLogin = false;

  onMount(() => {
    theme.initialize();
    
    // Check if this is a first login
    const urlParams = new URLSearchParams(window.location.search);
    isFirstLogin = urlParams.get('first_login') === 'true';

    // Check if we have a valid session (required for password reset)
    checkSession();
  });

  async function checkSession() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      errorMsg = 'Invalid or expired reset link. Please request a new password reset.';
      setTimeout(() => {
        goto('/');
      }, 3000);
    }
  }

  async function handlePasswordReset() {
    errorMsg = '';
    successMsg = '';

    // Validation
    if (!newPassword || !confirmPassword) {
      errorMsg = 'Please fill in all fields';
      return;
    }

    if (newPassword !== confirmPassword) {
      errorMsg = 'Passwords do not match';
      return;
    }

    const passwordError = validatePassword(newPassword);
    if (passwordError) {
      errorMsg = passwordError;
      return;
    }

    isLoading = true;

    try {
      // Get current session
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !session) {
        errorMsg = 'Invalid or expired reset link. Please request a new password reset.';
        setTimeout(() => {
          goto('/');
        }, 3000);
        return;
      }

      // Update password using Supabase Auth
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (updateError) {
        errorMsg = updateError.message || 'Failed to update password. Please try again.';
        return;
      }

      // Get user info from app_users table
      const { data: userData, error: userError } = await supabase
        .from('app_users')
        .select('app_user_uuid, username, must_change_password, password_setup_completed')
        .eq('email', session.user.email)
        .eq('is_deleted', false)
        .single();

      if (userError || !userData) {
        console.error('Error fetching user data:', userError);
        // Still allow password reset to complete
      } else {
        // Update user flags
        const now = new Date().toISOString();
        
        // Update app_users table
        const { error: updateUserError } = await supabase
          .from('app_users')
          .update({
            must_change_password: false,
            password_setup_completed: true,
            last_password_change: now,
            modified_dt: now
          })
          .eq('app_user_uuid', userData.app_user_uuid);

        if (updateUserError) {
          console.error('Error updating user flags:', updateUserError);
          // Don't fail the password reset, just log the error
        }
      }

      successMsg = isFirstLogin 
        ? 'Password set successfully! Redirecting to login...'
        : 'Password reset successfully! Redirecting to login...';

      // Sign out to force re-login with new password
      await supabase.auth.signOut();

      setTimeout(() => {
        goto('/');
      }, 2000);

    } catch (error) {
      console.error('Error resetting password:', error);
      errorMsg = 'An unexpected error occurred. Please try again.';
    } finally {
      isLoading = false;
    }
  }

  function togglePasswordVisibility() {
    showPassword = !showPassword;
  }

  function toggleConfirmPasswordVisibility() {
    showConfirmPassword = !showConfirmPassword;
  }

  function handleKeyPress(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      handlePasswordReset();
    }
  }
</script>

<svelte:head>
  <title>{isFirstLogin ? 'Set Your Password' : 'Reset Password'} - Production Management System</title>
</svelte:head>

<div class="flex items-center justify-center min-h-screen theme-bg-secondary">
  <div class="theme-bg-primary theme-text-primary theme-border border p-8 rounded shadow-md w-full max-w-md">
    <!-- Logo -->
    <div class="w-24 h-24 mx-auto mb-6 flex items-center justify-center">
      <img src="/favicon.png" alt="Company Logo" class="w-full h-full object-contain" />
    </div>

    <!-- Title -->
    <h2 class="text-2xl font-bold mb-2 theme-text-primary text-center">
      {isFirstLogin ? 'Set Your Password' : 'Reset Password'}
    </h2>
    <p class="text-sm theme-text-secondary text-center mb-6">
      {isFirstLogin 
        ? 'Please set a secure password for your account' 
        : 'Please enter your new password'}
    </p>

    <!-- Error Message -->
    {#if errorMsg}
      <div class="mb-4 p-3 bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 rounded">
        {errorMsg}
      </div>
    {/if}

    <!-- Success Message -->
    {#if successMsg}
      <div class="mb-4 p-3 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 rounded">
        {successMsg}
      </div>
    {/if}

    <!-- Password Requirements -->
    <div class="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded text-sm border border-blue-200 dark:border-blue-800">
      <p class="font-semibold mb-2 text-blue-900 dark:text-blue-200">Password Requirements:</p>
      <ul class="list-disc list-inside space-y-1 text-xs text-blue-800 dark:text-blue-300">
        <li>At least 8 characters long</li>
        <li>At least one uppercase letter</li>
        <li>At least one lowercase letter</li>
        <li>At least one number</li>
        <li>At least one special character</li>
      </ul>
    </div>

    <!-- New Password Input -->
    <div class="mb-4">
      <label for="newPassword" class="block text-sm font-medium theme-text-primary mb-2">
        New Password
      </label>
      <div class="relative">
        <input
          id="newPassword"
          type={showPassword ? 'text' : 'password'}
          bind:value={newPassword}
          on:keypress={handleKeyPress}
          placeholder="Enter new password"
          class="w-full px-3 py-2 pr-10 border theme-border rounded-lg theme-bg-primary theme-text-primary focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
    </div>

    <!-- Confirm Password Input -->
    <div class="mb-6">
      <label for="confirmPassword" class="block text-sm font-medium theme-text-primary mb-2">
        Confirm Password
      </label>
      <div class="relative">
        <input
          id="confirmPassword"
          type={showConfirmPassword ? 'text' : 'password'}
          bind:value={confirmPassword}
          on:keypress={handleKeyPress}
          placeholder="Confirm new password"
          class="w-full px-3 py-2 pr-10 border theme-border rounded-lg theme-bg-primary theme-text-primary focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        <button
          type="button"
          class="absolute right-2 top-1/2 transform -translate-y-1/2 p-1 theme-text-secondary hover:theme-text-primary transition-colors"
          on:click={toggleConfirmPasswordVisibility}
          aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
        >
          {#if showConfirmPassword}
            <EyeOff class="w-4 h-4" />
          {:else}
            <Eye class="w-4 h-4" />
          {/if}
        </button>
      </div>
    </div>

    <!-- Submit Button -->
    <Button
      variant="primary"
      size="lg"
      on:click={handlePasswordReset}
      disabled={isLoading}
      class="w-full"
    >
      {#if isLoading}
        <div class="flex items-center justify-center">
          <div class="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
          {isFirstLogin ? 'Setting Password...' : 'Resetting Password...'}
        </div>
      {:else}
        {isFirstLogin ? 'Set Password' : 'Reset Password'}
      {/if}
    </Button>

    <!-- Back to Login Link -->
    <div class="mt-4 text-center">
      <a
        href="/"
        class="text-sm text-blue-600 dark:text-blue-400 hover:underline"
      >
        Back to Login
      </a>
    </div>
  </div>
</div>

<!-- Floating Theme Toggle -->
<FloatingThemeToggle />

