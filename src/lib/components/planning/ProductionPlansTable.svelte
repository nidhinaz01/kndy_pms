<script lang="ts">
  import type { ProductionPlan, ProductionPlanWithTimes } from '$lib/api/planning';
  import { formatDateGB } from '$lib/utils/formatDate';

  export let tableData: ProductionPlanWithTimes[] = [];
  export let expandTable: boolean = false;
  export let onExpandToggle: () => void;
  export let onRowSelect: (plan: ProductionPlanWithTimes) => void;
  export let onDeleteRow: (id: number) => void;
  export let onEditRow: (plan: ProductionPlanWithTimes) => void;

  function handleDelete(plan: ProductionPlanWithTimes, event: Event) {
    event.stopPropagation();
    if (confirm(`Are you sure you want to delete the production plan for ${formatDateGB(plan.dt_wef)}?`)) {
      onDeleteRow(plan.id);
    }
  }

  function handleEdit(plan: ProductionPlanWithTimes, event: Event) {
    event.stopPropagation();
    onEditRow(plan);
  }
</script>

<div class="theme-bg-primary rounded-xl shadow transition-colors duration-200">
  <!-- Table Header -->
  <div class="flex items-center justify-between p-6 border-b theme-border">
    <div>
      <h3 class="text-lg font-semibold theme-text-primary transition-colors duration-200">Production Plans</h3>
      <p class="text-sm theme-text-secondary transition-colors duration-200">Manage daily production targets</p>
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
              <th class="text-left py-3 px-4 font-medium theme-text-primary">ID</th>
              <th class="text-left py-3 px-4 font-medium theme-text-primary">Production Count</th>
              <th class="text-left py-3 px-4 font-medium theme-text-primary">Entry Times</th>
              <th class="text-left py-3 px-4 font-medium theme-text-primary">Effective From</th>
              <th class="text-left py-3 px-4 font-medium theme-text-primary">Created By</th>
              <th class="text-left py-3 px-4 font-medium theme-text-primary">Created Date</th>
              <th class="text-right py-3 px-4 font-medium theme-text-primary">Actions</th>
            </tr>
          </thead>
          <tbody>
            {#if tableData.length === 0}
              <tr>
                <td colspan="6" class="py-8 text-center theme-text-secondary">
                  <div class="flex flex-col items-center">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-12 w-12 text-gray-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                    <p class="text-lg font-medium">No production plans found</p>
                    <p class="text-sm">Add your first production plan to get started</p>
                  </div>
                </td>
              </tr>
            {:else}
              {#each tableData as plan}
                <tr 
                  class="border-b theme-border hover:theme-bg-secondary cursor-pointer transition-colors duration-200"
                  on:click={() => onRowSelect(plan)}
                >
                                  <td class="py-3 px-4 theme-text-primary">{plan.id}</td>
                <td class="py-3 px-4 theme-text-primary font-medium">{plan.ppd_count}</td>
                <td class="py-3 px-4 theme-text-primary">
                  <div class="flex flex-wrap gap-1">
                    {#each plan.times as time}
                      <span class="px-2 py-1 text-xs theme-bg-secondary theme-text-primary rounded">
                        Slot {time.slot_order}: {time.entry_time}
                      </span>
                    {/each}
                  </div>
                </td>
                <td class="py-3 px-4 theme-text-primary">{formatDateGB(plan.dt_wef)}</td>
                <td class="py-3 px-4 theme-text-primary">{plan.created_by}</td>
                <td class="py-3 px-4 theme-text-primary">{formatDateGB(plan.created_dt)}</td>
                  <td class="py-3 px-4 text-right">
                    <div class="flex items-center justify-end gap-2">
                      <button
                        class="p-1 text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 transition-colors duration-200"
                        on:click={(e) => handleEdit(plan, e)}
                        aria-label="Edit production plan"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button
                        class="p-1 text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 transition-colors duration-200"
                        on:click={(e) => handleDelete(plan, e)}
                        aria-label="Delete production plan"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              {/each}
            {/if}
          </tbody>
        </table>
      </div>
    </div>
  {/if}
</div> 