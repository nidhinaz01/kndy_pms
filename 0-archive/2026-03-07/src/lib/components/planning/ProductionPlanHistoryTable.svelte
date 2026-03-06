<script lang="ts">
  import type { ProductionPlanHistoryWithTimes } from '$lib/api/planning';

  export let historyData: ProductionPlanHistoryWithTimes[] = [];
  export let expandTable: boolean = false;
  export let onExpandToggle: () => void;

  function formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  }

  function formatPeriod(startDate: string, endDate?: string): string {
    const start = formatDate(startDate);
    if (!endDate) {
      return `${start} - Present`;
    }
    const end = formatDate(endDate);
    return `${start} - ${end}`;
  }

  function formatTimeSlots(times: any[]): string {
    return times.map(time => `Slot ${time.slot_order}: ${time.entry_time}`).join(', ');
  }
</script>

<div class="theme-bg-primary rounded-xl shadow transition-colors duration-200">
  <!-- Table Header -->
  <div class="flex items-center justify-between p-6 border-b theme-border">
    <div>
      <h3 class="text-lg font-semibold theme-text-primary transition-colors duration-200">Production Plan History</h3>
      <p class="text-sm theme-text-secondary transition-colors duration-200">Historical production plans with effective periods</p>
    </div>
    <button
      class="p-2 text-gray-600 hover:text-blue-600 dark:text-gray-300 dark:hover:text-blue-400 transition-colors duration-200 rounded"
      on:click={onExpandToggle}
      aria-label={expandTable ? 'Collapse table' : 'Expand table'}
    >
      <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d={expandTable ? "M5 15l7-7 7 7" : "M19 9l-7 7-7-7"} />
      </svg>
    </button>
  </div>

  <!-- Table Content -->
  {#if !expandTable}
    <div class="p-6">
      <div class="overflow-x-auto">
        <table class="w-full">
          <thead>
            <tr class="border-b theme-border">
              <th class="text-left py-3 px-4 font-medium theme-text-primary">History ID</th>
              <th class="text-left py-3 px-4 font-medium theme-text-primary">Production Rate</th>
              <th class="text-left py-3 px-4 font-medium theme-text-primary">Pattern</th>
              <th class="text-left py-3 px-4 font-medium theme-text-primary">Effective Period</th>
              <th class="text-left py-3 px-4 font-medium theme-text-primary">Entry Times</th>
              <th class="text-left py-3 px-4 font-medium theme-text-primary">Created By</th>
              <th class="text-left py-3 px-4 font-medium theme-text-primary">Created Date</th>
            </tr>
          </thead>
          <tbody>
            {#if historyData.length === 0}
              <tr>
                <td colspan="7" class="py-8 text-center theme-text-secondary">
                  <div class="flex flex-col items-center">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-12 w-12 text-gray-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                    <p class="text-lg font-medium">No history data found</p>
                    <p class="text-sm">Production plan history will appear here</p>
                  </div>
                </td>
              </tr>
            {:else}
              {#each historyData as plan}
                <tr class="border-b theme-border hover:theme-bg-secondary transition-colors duration-200">
                  <td class="py-3 px-4 theme-text-primary font-mono text-sm">#{plan.his_id}</td>
                  <td class="py-3 px-4 theme-text-primary font-medium">{plan.production_rate} vehicles/day</td>
                  <td class="py-3 px-4 theme-text-primary">
                    <span class="px-2 py-1 text-xs theme-bg-secondary theme-text-primary rounded">
                      [{plan.pattern_data?.join(', ') || 'N/A'}] over {plan.pattern_cycle || 1} days
                    </span>
                  </td>
                  <td class="py-3 px-4 theme-text-primary">
                    <span class="px-2 py-1 text-xs theme-bg-secondary theme-text-primary rounded">
                      {formatPeriod(plan.dt_wef, plan.end_date)}
                    </span>
                  </td>
                  <td class="py-3 px-4 theme-text-primary">
                    <div class="max-w-xs">
                      {#if plan.slot_configuration && plan.slot_configuration.length > 0}
                        <div class="text-sm theme-text-secondary mb-1">Pattern Days:</div>
                        <div class="space-y-1">
                          {#each plan.slot_configuration as dayConfig, dayIndex}
                            <div class="text-xs">
                              <span class="font-medium theme-text-secondary">Day {dayConfig.day}:</span>
                              <div class="flex flex-wrap gap-1 mt-1">
                                {#each dayConfig.slots as slot}
                                  <span class="px-1 py-0.5 text-xs theme-bg-secondary theme-text-primary rounded">
                                    {slot.slot_order}: {slot.entry_time}
                                  </span>
                                {/each}
                              </div>
                            </div>
                          {/each}
                        </div>
                      {:else}
                        <div class="text-sm theme-text-secondary mb-1">Time Slots:</div>
                        <div class="flex flex-wrap gap-1">
                          {#each plan.times as time}
                            <span class="px-2 py-1 text-xs theme-bg-secondary theme-text-primary rounded">
                              {time.slot_order}: {time.entry_time}
                            </span>
                          {/each}
                        </div>
                      {/if}
                    </div>
                  </td>
                  <td class="py-3 px-4 theme-text-primary">{plan.created_by}</td>
                  <td class="py-3 px-4 theme-text-primary">{formatDate(plan.created_dt)}</td>
                </tr>
              {/each}
            {/if}
          </tbody>
        </table>
      </div>
    </div>
  {/if}
</div> 