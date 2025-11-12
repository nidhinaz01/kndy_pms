<script lang="ts">
  import { supabase } from '$lib/supabaseClient';
  import { goto } from '$app/navigation';
  import { replaceState } from '$app/navigation';
  import { browser } from '$app/environment';
  import { onMount } from 'svelte';
  import { theme } from '$lib/stores/theme';
  import FloatingThemeToggle from '$lib/components/common/FloatingThemeToggle.svelte';
  import Button from '$lib/components/common/Button.svelte';
  import { Eye, EyeOff } from 'lucide-svelte';

  let username = '';
  let password = '';
  let errorMsg = '';
  let logoutSuccess = false;
  let showPassword = false;
  let isLoading = false;

  // Check for logout parameter using window.location instead of page store
  $: logoutSuccess = browser ? new URLSearchParams(window.location.search).get('logout') === '1' : false;

  // Remove ?logout=1 from URL after first mount
  onMount(() => {
    if (browser) {
      const url = new URL(window.location.href);
      if (url.searchParams.has('logout')) {
        url.searchParams.delete('logout');
        replaceState(url.pathname + url.search + url.hash, '');
      }
    }
    
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
      const { data: users, error: lookupError } = await supabase
        .from('users_login_map')
        .select('email, app_user_uuid, current_session_id')
        .eq('username', username)
        .maybeSingle();

      if (lookupError) {
        errorMsg = 'Database connection error. Please try again.';
        return;
      }

      if (!users?.email || !users.app_user_uuid) {
        errorMsg = 'Invalid username or user not found';
        return;
      }

      const localSessionId = browser
        ? localStorage.getItem('session_id') || crypto.randomUUID()
        : '';

      if (
        username.toLowerCase() !== 'admin' &&
        users.current_session_id &&
        users.current_session_id !== localSessionId
      ) {
        errorMsg = `The username: ${username} is currently logged in from another machine. Please logout first.`;
        return;
      }

      const { data: authData, error: loginError } = await supabase.auth.signInWithPassword({
        email: users.email,
        password
      });

      if (loginError) {
        errorMsg = 'Invalid password or authentication failed';
        return;
      }

      const newSessionId = crypto.randomUUID();
      if (browser) {
        localStorage.setItem('session_id', newSessionId);
        localStorage.setItem('username', username);
      }

      const { error: updateError } = await supabase
        .from('app_users')
        .update({
          current_session_id: newSessionId,
          last_login_time: new Date().toISOString()
        })
        .eq('app_user_uuid', users.app_user_uuid);

      if (updateError) {
        console.error('Error updating user session:', updateError);
      }

      // Wait a moment for the session to be properly established
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Use window.location for a hard redirect to ensure session is established
      if (browser) {
        window.location.href = '/dashboard';
      } else {
        goto('/dashboard');
      }
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

<div class="flex items-center justify-center min-h-screen theme-bg-secondary">
  <div class="theme-bg-primary theme-text-primary theme-border border p-8 rounded shadow-md w-full max-w-sm text-center">
    <!-- Logo -->
    <img src="/logo_kdy.png" alt="Company Logo" class="w-32 mx-auto mb-6" />

    <!-- Title -->
    <h2 class="text-2xl font-bold mb-4 theme-text-primary">Login for Production</h2>

    <!-- ✅ Logout Success Message -->
    {#if logoutSuccess}
      <p class="text-green-600 font-semibold mb-4">Logged out successfully.</p>
    {/if}

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
    <Button 
      on:click={handleLoginClick} 
      fullWidth={true}
      disabled={isLoading}
    >
      {#if isLoading}
        <div class="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
        Logging In...
      {:else}
        Log In
      {/if}
    </Button>
  </div>
</div>

<!-- Floating Theme Toggle -->
<FloatingThemeToggle />
