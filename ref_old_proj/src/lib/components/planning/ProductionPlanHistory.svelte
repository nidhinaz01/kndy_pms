<script lang="ts">
  import { formatDate } from '$lib/utils/formatDate';
  import type { ProductionPlanHistoryWithTimes } from '$lib/api/planning';

  export let plans: ProductionPlanHistoryWithTimes[] = [];
  export let isLoading = false;

  let showHistory = false;

  function toggleHistory() {
    showHistory = !showHistory;
  }
</script>

<div class="theme-bg-primary rounded-lg shadow-lg p-6">
  <div class="flex items-center justify-between mb-4">
    <h3 class="text-lg font-semibold theme-text-primary">Production Plan History</h3>
    <button
      on:click={toggleHistory}
      class="flex items-center gap-2 px-3 py-1 text-sm theme-text-secondary hover:theme-text-primary transition-colors"
    >
      {showHistory ? 'Hide' : 'Show'} History
      <svg 
        class="w-4 h-4 transition-transform {showHistory ? 'rotate-180' : ''}" 
        fill="none" 
        stroke="currentColor" 
        viewBox="0 0 24 24"
      >
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
      </svg>
    </button>
  </div>

  {#if showHistory}
    {#if isLoading}
      <div class="flex items-center justify-center py-8">
        <div class="animate-spin rounded-full h-8 w-8 border-b-2 theme-accent"></div>
        <span class="ml-3 theme-text-secondary">Loading history...</span>
      </div>
    {:else if plans.length === 0}
      <div class="text-center py-8">
        <p class="theme-text-secondary">No production plan history found</p>
      </div>
    {:else}
      <div class="space-y-4">
        {#each plans as plan, index}
          <div class="theme-bg-secondary rounded-lg p-4">
            <div class="flex items-center justify-between mb-3">
              <div class="flex items-center gap-4">
                <div>
                  <span class="text-sm font-medium theme-text-secondary">Production Count</span>
                  <p class="text-lg font-bold theme-text-primary">{plan.plan.ppd_count} vehicles/day</p>
                </div>
                <div>
                  <span class="text-sm font-medium theme-text-secondary">Effective From</span>
                  <p class="text-sm theme-text-primary">{formatDate(plan.plan.dt_wef)}</p>
                </div>
                <div>
                  <span class="text-sm font-medium theme-text-secondary">History ID</span>
                  <p class="text-xs theme-text-tertiary">#{plan.plan.his_id}</p>
                </div>
              </div>
              <div class="text-right">
                <p class="text-xs theme-text-tertiary">Created by {plan.plan.created_by}</p>
                <p class="text-xs theme-text-tertiary">{formatDate(plan.plan.created_dt)}</p>
              </div>
            </div>

            <div>
              <span class="text-sm font-medium theme-text-secondary">Entry Times:</span>
              <div class="flex flex-wrap gap-2 mt-2">
                {#each plan.times as time}
                  <span class="px-2 py-1 text-xs theme-bg-primary theme-text-primary rounded">
                    Slot {time.slot_order}: {time.entry_time}
                  </span>
                {/each}
              </div>
            </div>
          </div>
        {/each}
      </div>
    {/if}
  {/if}
</div> 