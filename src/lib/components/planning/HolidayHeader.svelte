<script lang="ts">
  export let onSidebarToggle: () => void;
  export let onAddHoliday: () => void;
  export let onImportHolidays: () => void;
  export let selectedYear: number;
  export let onYearChange: (year: number) => void;
  export let showCalendar: boolean;
  export let onToggleView: () => void;
</script>

<div class="flex items-center justify-between p-4 theme-bg-primary rounded-xl shadow transition-colors duration-200">
  <div class="flex items-center gap-4">
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
      <h1 class="text-2xl font-bold theme-text-primary transition-colors duration-200">Holiday Management</h1>
      <p class="text-sm theme-text-secondary transition-colors duration-200">Manage company holidays and non-working days</p>
    </div>
  </div>
  <div class="flex items-center gap-3">
    <!-- Year Filter -->
    <div class="flex items-center gap-2">
      <span class="text-sm font-medium theme-text-primary">Year:</span>
      <div class="flex items-center gap-1">
        <button
          type="button"
          class="p-2 text-gray-600 hover:text-blue-600 dark:text-gray-300 dark:hover:text-blue-400 transition-colors duration-200 rounded"
          on:click={() => onYearChange(selectedYear - 1)}
          aria-label="Previous year"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <span class="px-3 py-2 text-sm font-semibold theme-text-primary min-w-[4rem] text-center">
          {selectedYear}
        </span>
        <button
          type="button"
          class="p-2 text-gray-600 hover:text-blue-600 dark:text-gray-300 dark:hover:text-blue-400 transition-colors duration-200 rounded"
          on:click={() => onYearChange(selectedYear + 1)}
          aria-label="Next year"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </div>
    
    <!-- View Toggle Button -->
    <button
      class="px-4 py-2 bg-purple-500 text-white rounded-lg border-2 border-purple-500 shadow hover:bg-purple-600 hover:border-purple-600 focus:outline-none focus:ring-2 focus:ring-purple-200 dark:focus:ring-purple-800 active:bg-purple-700 active:border-purple-700 transition-all duration-200"
      on:click={onToggleView}
    >
      {#if showCalendar}
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 inline mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
        Show Table
      {:else}
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 inline mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        Show Calendar
      {/if}
    </button>
    
    <!-- Import Button -->
    <button
      class="px-4 py-2 bg-green-500 text-white rounded-lg border-2 border-green-500 shadow hover:bg-green-600 hover:border-green-600 focus:outline-none focus:ring-2 focus:ring-green-200 dark:focus:ring-green-800 active:bg-green-700 active:border-green-700 transition-all duration-200"
      on:click={onImportHolidays}
    >
      <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 inline mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
      </svg>
      Import
    </button>
    
    <!-- Add Button -->
    <button
      class="px-4 py-2 bg-blue-500 text-white rounded-lg border-2 border-blue-500 shadow hover:bg-blue-600 hover:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-800 active:bg-blue-700 active:border-blue-700 transition-all duration-200"
      on:click={onAddHoliday}
    >
      <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 inline mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
      </svg>
      Add Holiday
    </button>
  </div>
</div> 