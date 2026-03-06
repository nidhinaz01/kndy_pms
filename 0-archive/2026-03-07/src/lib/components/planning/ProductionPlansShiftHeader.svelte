<script lang="ts">
  import { goto } from '$app/navigation';
  export let onSidebarToggle: () => void;
  export let onAddItem: () => void;
</script>

<div class="flex items-center justify-between p-4 theme-bg-primary rounded-t-xl border-b theme-border">
  <!-- Left side: Burger menu and title -->
  <div class="flex items-center space-x-4">
    <button
      class="p-2 text-gray-600 hover:text-blue-600 dark:text-gray-300 dark:hover:text-blue-400 transition-colors duration-200"
      on:click={onSidebarToggle}
      aria-label="Toggle sidebar"
    >
      <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
      </svg>
    </button>
    
    <div>
      <h1 class="text-xl font-semibold theme-text-primary">Production Plans (Shift-Based)</h1>
      <p class="text-sm theme-text-secondary">Manage shift-based production planning</p>
    </div>
  </div>

  <!-- Right side: Actions -->
  <div class="flex items-center space-x-3">
    <button
      class="px-4 py-2 bg-blue-500 text-white rounded-lg border-2 border-blue-500 shadow hover:bg-blue-600 hover:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-800 active:bg-blue-700 active:border-blue-700 transition-all duration-200"
      on:click={onAddItem}
    >
      <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 inline mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
      </svg>
      Create Plan
    </button>
    <button
      on:click={() => goto('/dashboard')}
      class="flex items-center hover:opacity-80 transition-opacity cursor-pointer"
      aria-label="Go to dashboard"
    >
      <img src="/favicon.png" alt="Company Logo" class="h-8 w-auto" />
    </button>
  </div>
</div> 