<script lang="ts">
  import { onMount } from 'svelte';
  import { setupPlanningMenu } from '$lib/api/setupPlanningMenu';
  import Button from '$lib/components/common/Button.svelte';

  let isLoading = false;
  let message = '';
  let messageType: 'success' | 'error' = 'success';

  async function setupMenu() {
    try {
      isLoading = true;
      const result = await setupPlanningMenu();
      
      if (result.success) {
        showMessage(result.message, 'success');
      } else {
        showMessage(result.message, 'error');
      }
    } catch (error) {
      showMessage('Error setting up menu: ' + (error instanceof Error ? error.message : 'Unknown error'), 'error');
      console.error('Error setting up menu:', error);
    } finally {
      isLoading = false;
    }
  }

  function showMessage(msg: string, type: 'success' | 'error' = 'success') {
    message = msg;
    messageType = type;
    setTimeout(() => {
      message = '';
    }, 5000);
  }
</script>

<svelte:head>
  <title>Setup Planning Menu - Production Management</title>
</svelte:head>

<div class="min-h-screen theme-bg-secondary flex items-center justify-center p-4">
  <div class="theme-bg-primary rounded-lg shadow-lg p-8 max-w-md w-full">
    <h1 class="text-2xl font-bold theme-text-primary mb-6 text-center">
      Setup Planning Menu
    </h1>

    {#if message}
      <div class="p-4 {messageType === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'} rounded-lg mb-6">
        {message}
      </div>
    {/if}

    <div class="space-y-4">
      <p class="theme-text-secondary text-center">
        This will add the "Entry Per Day" menu item to the Planning section.
      </p>

      <Button
        variant="primary"
        on:click={setupMenu}
        disabled={isLoading}
        fullWidth={true}
      >
        {#if isLoading}
          <svg class="animate-spin -ml-1 mr-3 h-5 w-5 text-white inline" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          Setting up...
        {:else}
          Setup Planning Menu
        {/if}
      </Button>

      <div class="text-center">
        <a 
          href="/planning/entry-per-day" 
          class="text-blue-600 hover:text-blue-800 text-sm"
        >
          ← Back to Entry Per Day
        </a>
      </div>
    </div>
  </div>
</div> 