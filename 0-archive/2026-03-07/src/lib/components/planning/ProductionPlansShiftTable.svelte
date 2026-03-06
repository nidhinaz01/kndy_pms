<script lang="ts">
  export let tableData: any[] = [];
  export let expandTable: boolean = false;
  export let onExpandToggle: () => void;
  export let onRowSelect: (plan: any) => void;
  export let onDeleteRow: (id: number) => void;
  export let onToggleStatus: (plan: any) => void;

  function formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  }

  function formatDateRange(fromDate: string, toDate: string): string {
    const from = new Date(fromDate);
    const to = new Date(toDate);
    
    if (from.getTime() === to.getTime()) {
      return formatDate(fromDate);
    }
    
    return `${formatDate(fromDate)} - ${formatDate(toDate)}`;
  }

  function formatShiftDistribution(shiftDistribution: any[]): string {
    if (!shiftDistribution || shiftDistribution.length === 0) return 'No shifts';
    
    return shiftDistribution.map(shift => 
      `${shift.target_quantity} units`
    ).join(', ');
  }

  function formatEntrySlots(entrySlots: any): string {
    if (!entrySlots) return 'No slots';
    
    // Handle new JSONB structure with pattern data
    if (entrySlots.pattern_time_slots && Array.isArray(entrySlots.pattern_time_slots)) {
      const totalSlots = entrySlots.pattern_time_slots.reduce((total: number, day: any) => 
        total + (day.slots ? day.slots.length : 0), 0
      );
      return `${totalSlots} pattern slot${totalSlots !== 1 ? 's' : ''}`;
    }
    
    // Handle old array structure (fallback)
    if (Array.isArray(entrySlots)) {
      const slotCount = entrySlots.reduce((total: number, shift: any) => 
        total + (shift.slots ? shift.slots.length : 0), 0
      );
      return `${slotCount} entry slot${slotCount !== 1 ? 's' : ''}`;
    }
    
    return 'No slots';
  }

  function handleDelete(plan: any, event: Event) {
    event.stopPropagation();
    if (confirm(`Are you sure you want to delete the production plan for ${formatDateRange(plan.from_date, plan.to_date)}?`)) {
      onDeleteRow(plan.id);
    }
  }

  function handleToggleStatus(plan: any, event: Event) {
    event.stopPropagation();
    onToggleStatus(plan);
  }
</script>

<div class="theme-bg-primary rounded-xl shadow transition-colors duration-200">
  <!-- Table Header -->
  <div class="flex items-center justify-between p-6 border-b theme-border">
    <div>
      <h3 class="text-lg font-semibold theme-text-primary transition-colors duration-200">Shift-Based Production Plans</h3>
      <p class="text-sm theme-text-secondary transition-colors duration-200">Manage shift-based production targets</p>
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
              <th class="text-left py-3 px-4 font-medium theme-text-primary">Date Range</th>
              <th class="text-left py-3 px-4 font-medium theme-text-primary">Daily Target</th>
              <th class="text-left py-3 px-4 font-medium theme-text-primary">Shift Distribution</th>
              <th class="text-left py-3 px-4 font-medium theme-text-primary">Entry Slots</th>
              <th class="text-left py-3 px-4 font-medium theme-text-primary">Status</th>
              <th class="text-left py-3 px-4 font-medium theme-text-primary">Created By</th>
              <th class="text-left py-3 px-4 font-medium theme-text-primary">Created Date</th>
              <th class="text-right py-3 px-4 font-medium theme-text-primary">Actions</th>
            </tr>
          </thead>
          <tbody>
            {#if tableData.length === 0}
              <tr>
                <td colspan="9" class="py-8 text-center theme-text-secondary">
                  <div class="flex flex-col items-center">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-12 w-12 text-gray-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                                         <p class="text-lg font-medium">No production plans found</p>
                     <p class="text-sm mb-2">Create your first shift-based production plan to get started</p>
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
                  <td class="py-3 px-4 theme-text-primary font-medium">
                    {formatDateRange(plan.from_date, plan.to_date)}
                  </td>
                  <td class="py-3 px-4 theme-text-primary font-medium">{plan.ppd_count} units/day</td>
                  <td class="py-3 px-4 theme-text-primary">
                    <div class="flex flex-wrap gap-1">
                      {#each plan.shift_distribution as shift}
                        <span class="px-2 py-1 text-xs theme-bg-secondary theme-text-primary rounded">
                          Shift {shift.shift_id}: {shift.target_quantity}
                        </span>
                      {/each}
                    </div>
                  </td>
                                     <td class="py-3 px-4 theme-text-primary">
                     {formatEntrySlots(plan.entry_slots)}
                     {#if plan.entry_slots && plan.entry_slots.pattern_data}
                       <div class="text-xs text-gray-500 mt-1">
                         Pattern: [{plan.entry_slots.pattern_data.join(', ')}]
                       </div>
                     {/if}
                   </td>
                   <td class="py-3 px-4 theme-text-primary">
                     <span class="px-2 py-1 text-xs rounded-full {plan.is_active ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'}">
                       {plan.is_active ? 'Active' : 'Inactive'}
                     </span>
                   </td>
                   <td class="py-3 px-4 theme-text-primary">{plan.created_by}</td>
                  <td class="py-3 px-4 theme-text-primary">{formatDate(plan.created_dt)}</td>
                  <td class="py-3 px-4 text-right">
                    <div class="flex items-center justify-end space-x-2">
                      <button
                        class="p-1 {plan.is_active ? 'text-orange-600 hover:text-orange-800 dark:text-orange-400 dark:hover:text-orange-300' : 'text-green-600 hover:text-green-800 dark:text-green-400 dark:hover:text-green-300'} transition-colors duration-200"
                        on:click={(e) => handleToggleStatus(plan, e)}
                        aria-label={plan.is_active ? 'Deactivate plan' : 'Activate plan'}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d={plan.is_active ? "M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728L5.636 5.636m12.728 12.728L5.636 5.636" : "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"} />
                        </svg>
                      </button>
                      <button
                        class="p-1 text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 transition-colors duration-200"
                        on:click={(e) => handleDelete(plan, e)}
                        aria-label="Delete plan"
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