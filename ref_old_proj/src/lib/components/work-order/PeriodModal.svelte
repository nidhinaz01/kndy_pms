<script lang="ts">
  export let showPeriodModal: boolean;
  export let showCustomCalendar: boolean;
  export let customRange: [string, string];
  export let flatpickrInput: HTMLInputElement | undefined;
  export let onPeriodSelect: (period: string) => void;
  export let onCustomSelect: () => void;
  export let onApplyCustomRange: () => void;
  export let onCloseCustomCalendar: () => void;
  export let onCloseModal: () => void;
</script>

{#if showPeriodModal}
  <div class="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 transition-opacity duration-200">
    <div class="theme-bg-primary rounded-2xl shadow-2xl p-8 w-96 animate-fade-in transition-colors duration-200">
      <div class="font-bold text-lg mb-4 text-blue-700 dark:text-blue-300 flex items-center gap-2 transition-colors duration-200">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        Select Period
      </div>
      {#if showCustomCalendar}
        <div class="mb-4">
          <input 
            class="border theme-border rounded px-3 py-2 w-full theme-bg-secondary theme-text-primary transition-colors duration-200" 
            placeholder="Select date range" 
            bind:this={flatpickrInput} 
            readonly 
          />
          <div class="flex justify-end gap-2 mt-4">
            <button 
              class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors duration-200" 
              on:click={onApplyCustomRange} 
              disabled={!customRange[0] || !customRange[1]}
            >
              Apply
            </button>
            <button 
              class="px-4 py-2 theme-bg-tertiary theme-text-primary rounded hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors duration-200" 
              on:click={onCloseCustomCalendar}
            >
              Cancel
            </button>
          </div>
        </div>
      {:else}
        <ul class="space-y-2">
          <li>
            <button 
              class="w-full text-left px-3 py-2 rounded hover:bg-blue-50 dark:hover:bg-blue-900 theme-text-primary transition-colors duration-200" 
              on:click={() => onPeriodSelect('Last Month')}
            >
              Last Month
            </button>
          </li>
          <li>
            <button 
              class="w-full text-left px-3 py-2 rounded hover:bg-blue-50 dark:hover:bg-blue-900 theme-text-primary transition-colors duration-200" 
              on:click={() => onPeriodSelect('Last 3 Months')}
            >
              Last 3 Months
            </button>
          </li>
          <li>
            <button 
              class="w-full text-left px-3 py-2 rounded hover:bg-blue-50 dark:hover:bg-blue-900 theme-text-primary transition-colors duration-200" 
              on:click={() => onPeriodSelect('Last Year')}
            >
              Last Year
            </button>
          </li>
          <li>
            <button 
              class="w-full text-left px-3 py-2 rounded hover:bg-blue-50 dark:hover:bg-blue-900 theme-text-primary transition-colors duration-200" 
              on:click={onCustomSelect}
            >
              Custom (calendar)
            </button>
          </li>
        </ul>
        <button 
          class="mt-6 w-full py-2 rounded theme-bg-tertiary theme-text-primary hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors duration-200" 
          on:click={onCloseModal}
        >
          Cancel
        </button>
      {/if}
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