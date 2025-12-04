<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { goto } from '$app/navigation';

  export let activeTab: string = 'work-orders';
  export let selectedDate: string = '';
  export let tabs: Array<{ id: string; label: string; icon: string }> = [];

  const dispatch = createEventDispatcher();

  function handleTabChange(tabId: string) {
    dispatch('tabChange', tabId);
  }

  function handleDateChange() {
    dispatch('dateChange');
  }

  function handleSidebarToggle() {
    dispatch('sidebarToggle');
  }
</script>

<div class="theme-bg-primary shadow-sm border-b theme-border">
  <div class="w-full mx-auto px-4 sm:px-6 lg:px-8">
    <div class="flex items-center justify-between py-4">
      <!-- Burger Menu -->
      <button 
        class="p-2 rounded hover:theme-bg-tertiary focus:outline-none transition-colors duration-200" 
        on:click={handleSidebarToggle} 
        aria-label="Show sidebar"
      >
        <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 theme-text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      <!-- Tab Navigation -->
      <nav class="flex space-x-8 overflow-x-auto scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600 scrollbar-track-transparent">
        {#each tabs as tab}
          <button
            class="py-2 px-3 font-medium text-sm transition-colors duration-200 rounded-lg whitespace-nowrap flex-shrink-0 {activeTab === tab.id 
              ? 'border-2 border-blue-500 text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 shadow-sm' 
              : 'border-2 border-transparent theme-text-secondary hover:theme-text-primary hover:border-gray-300 dark:hover:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700/20'}"
            on:click={() => handleTabChange(tab.id)}
          >
            <span class="mr-2">{tab.icon}</span>
            {tab.label}
          </button>
        {/each}
      </nav>

      <!-- Date Selection -->
      <div class="flex items-center space-x-4">
        <label for="selectedDate" class="text-sm font-medium theme-text-primary">
          Select Date:
        </label>
        <input
          id="selectedDate"
          type="date"
          bind:value={selectedDate}
          on:change={handleDateChange}
          class="px-3 py-2 border theme-border rounded-lg theme-bg-primary theme-text-primary focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        <span class="text-sm theme-text-secondary">
          Current Date: {new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' })}
        </span>
      </div>

      <!-- Favicon -->
      <button
        on:click={() => goto('/dashboard')}
        class="flex items-center hover:opacity-80 transition-opacity cursor-pointer"
        aria-label="Go to dashboard"
      >
        <img src="/favicon.png" alt="Company Logo" class="h-8 w-auto" />
      </button>
    </div>
  </div>
</div>

