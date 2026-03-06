<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import Button from '$lib/components/common/Button.svelte';

  export let currentDate: Date = new Date();

  const dispatch = createEventDispatcher();

  // Format month and year for display
  $: monthYear = currentDate.toLocaleDateString('en-US', { 
    month: 'long', 
    year: 'numeric' 
  });

  function goToPreviousMonth() {
    const newDate = new Date(currentDate);
    newDate.setMonth(newDate.getMonth() - 1);
    dispatch('monthChanged', newDate);
  }

  function goToNextMonth() {
    const newDate = new Date(currentDate);
    newDate.setMonth(newDate.getMonth() + 1);
    dispatch('monthChanged', newDate);
  }

  function goToCurrentMonth() {
    const today = new Date();
    dispatch('monthChanged', today);
  }
</script>

<div class="flex items-center gap-4">
  <button
    on:click={goToPreviousMonth}
    class="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-700 rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
    title="Previous month"
    aria-label="Previous month"
  >
    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
    </svg>
  </button>

  <div class="flex items-center gap-2">
    <span class="text-lg font-semibold theme-text-primary">{monthYear}</span>
  </div>

  <button
    on:click={goToNextMonth}
    class="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-700 rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
    title="Next month"
    aria-label="Next month"
  >
    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
    </svg>
  </button>
  
  <button
    on:click={goToCurrentMonth}
    class="px-3 py-1 text-sm text-blue-600 hover:text-blue-800 hover:bg-blue-100 dark:text-blue-400 dark:hover:text-blue-200 dark:hover:bg-blue-900 rounded transition-colors duration-200 border border-blue-300 dark:border-blue-600"
    title="Go to current month"
  >
    Today
  </button>
</div> 