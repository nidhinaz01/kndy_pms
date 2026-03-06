<script lang="ts">
  export let showPeriodModal: boolean;
  export let showCustomCalendar: boolean;
  export let flatpickrInput: HTMLInputElement | undefined;
  export let onPeriodSelect: (period: string) => void;
  export let onCustomSelect: () => void;
  export let onApplyCustomRange: () => void;
  export let onCloseCustomCalendar: () => void;
  export let onCloseModal: () => void;

  const periods = [
    'Last 1 Month',
    'Last 3 Months', 
    'Last 6 Months',
    'Last 1 Year'
  ];
</script>

{#if showPeriodModal}
  <div class="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 transition-opacity duration-200">
    <div class="theme-bg-primary rounded-2xl shadow-2xl p-8 w-[32rem] animate-fade-in transition-colors duration-200">
      <div class="flex items-center justify-between mb-6">
        <div class="font-bold text-lg text-blue-700 dark:text-blue-300 flex items-center gap-2 transition-colors duration-200">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          Select Period
        </div>
        <button 
          class="text-gray-400 hover:text-blue-500 dark:hover:text-blue-400 transition-colors duration-200" 
          on:click={onCloseModal} 
          aria-label="Close modal"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div class="space-y-4">
        <!-- Predefined Periods -->
        <div>
          <h3 class="text-sm font-medium theme-text-primary mb-3">Quick Select</h3>
          <div class="grid grid-cols-2 gap-3">
            {#each periods as period}
              <button
                class="px-4 py-3 text-left border theme-border rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-800"
                on:click={() => onPeriodSelect(period)}
              >
                <div class="font-medium theme-text-primary">{period}</div>
              </button>
            {/each}
          </div>
        </div>

        <!-- Custom Range -->
        <div>
          <h3 class="text-sm font-medium theme-text-primary mb-3">Custom Range</h3>
          <button
            class="w-full px-4 py-3 text-left border theme-border rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-800"
            on:click={onCustomSelect}
          >
            <div class="font-medium theme-text-primary">Select Custom Date Range</div>
            <div class="text-sm theme-text-secondary mt-1">Choose your own start and end dates</div>
          </button>
        </div>

        <!-- Custom Calendar Input -->
        {#if showCustomCalendar}
          <div class="border theme-border rounded-lg p-4 bg-gray-50 dark:bg-gray-800">
            <h4 class="text-sm font-medium theme-text-primary mb-3">Custom Date Range</h4>
            <div class="space-y-3">
              <input
                type="text"
                bind:this={flatpickrInput}
                placeholder="Select date range..."
                class="w-full px-3 py-2 border theme-border rounded theme-bg-secondary theme-text-primary focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-800 focus:outline-none"
                readonly
              />
              <div class="flex gap-2">
                <button
                  class="px-4 py-2 bg-blue-500 text-white rounded-lg border-2 border-blue-500 shadow hover:bg-blue-600 hover:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-800 active:bg-blue-700 active:border-blue-700 transition-all duration-200"
                  on:click={onApplyCustomRange}
                >
                  Apply Range
                </button>
                <button
                  class="px-4 py-2 bg-gray-500 text-white rounded-lg border-2 border-gray-500 shadow hover:bg-gray-600 hover:border-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-200 dark:focus:ring-gray-800 active:bg-gray-700 active:border-gray-700 transition-all duration-200"
                  on:click={onCloseCustomCalendar}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        {/if}
      </div>
    </div>
  </div>
{/if}

<style>
  @keyframes fade-in {
    from { opacity: 0; transform: translateY(20px); }
    to { opacity: 1; transform: translateY(0); }
  }
  .animate-fade-in {
    animation: fade-in 0.2s ease;
  }
</style> 