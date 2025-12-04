<script lang="ts">
  import { getDateDifference, getDateColor, getRowBackgroundColor } from '../utils/chassisReceivalUtils';
  
  export let workOrders: any[] = [];
</script>

{#if workOrders.length > 0}
  <div class="theme-bg-primary rounded-lg shadow-lg">
    <div class="p-6 border-b theme-border">
      <h3 class="text-lg font-semibold theme-text-primary">Completed Chassis Receival ({workOrders.length})</h3>
    </div>
    <div class="overflow-x-auto">
      <table class="w-full">
        <thead>
          <tr class="border-b theme-border">
            <th class="px-4 py-3 text-left font-medium theme-text-primary">Work Order</th>
            <th class="px-4 py-3 text-left font-medium theme-text-primary">PWO Number</th>
            <th class="px-4 py-3 text-left font-medium theme-text-primary">Type</th>
            <th class="px-4 py-3 text-left font-medium theme-text-primary">Model</th>
            <th class="px-4 py-3 text-left font-medium theme-text-primary">Chassis</th>
            <th class="px-4 py-3 text-left font-medium theme-text-primary">Wheel Base</th>
            <th class="px-4 py-3 text-left font-medium theme-text-primary">Customer</th>
            <th class="px-4 py-3 text-left font-medium theme-text-primary">Planned Date</th>
            <th class="px-4 py-3 text-left font-medium theme-text-primary">Actual Date</th>
            <th class="px-4 py-3 text-left font-medium theme-text-primary">Status</th>
          </tr>
        </thead>
        <tbody>
          {#each workOrders as workOrder}
            {@const daysDiff = getDateDifference(workOrder.chassisArrival.planned_date, workOrder.chassisArrival.actual_date)}
            {@const rowBgClass = getRowBackgroundColor(daysDiff)}
            <tr class="border-b theme-border hover:theme-bg-secondary transition-colors" class:on-time={rowBgClass === 'on-time'} class:slight-delay={rowBgClass === 'slight-delay'} class:moderate-delay={rowBgClass === 'moderate-delay'} class:significant-delay={rowBgClass === 'significant-delay'}>
              <td class="px-4 py-3 font-medium border theme-border {rowBgClass ? 'text-gray-800' : 'theme-text-primary'}">
                {workOrder.wo_no}
              </td>
              <td class="px-4 py-3 border theme-border {rowBgClass ? 'text-gray-800' : 'theme-text-primary'}">
                {workOrder.pwo_no || 'N/A'}
              </td>
              <td class="px-4 py-3 border theme-border {rowBgClass ? 'text-gray-800' : 'theme-text-primary'}">
                {workOrder.wo_type || 'N/A'}
              </td>
              <td class="px-4 py-3 border theme-border {rowBgClass ? 'text-gray-800' : 'theme-text-primary'}">
                {workOrder.wo_model || 'N/A'}
              </td>
              <td class="px-4 py-3 border theme-border {rowBgClass ? 'text-gray-800' : 'theme-text-primary'}">
                {workOrder.wo_chassis || 'N/A'}
              </td>
              <td class="px-4 py-3 border theme-border {rowBgClass ? 'text-gray-800' : 'theme-text-primary'}">
                {workOrder.wheel_base || 'N/A'}
              </td>
              <td class="px-4 py-3 border theme-border {rowBgClass ? 'text-gray-800' : 'theme-text-primary'}">
                {workOrder.customer_name || 'N/A'}
              </td>
              <td class="px-4 py-3 border theme-border {rowBgClass ? 'text-gray-800' : 'theme-text-primary'}">
                {workOrder.chassisArrival.planned_date ? new Date(workOrder.chassisArrival.planned_date).toLocaleDateString('en-GB', {
                  day: '2-digit',
                  month: 'short',
                  year: '2-digit'
                }) : 'N/A'}
              </td>
              <td class="px-4 py-3 border theme-border">
                <span class="{getDateColor(daysDiff)}">
                  {workOrder.chassisArrival.actual_date ? new Date(workOrder.chassisArrival.actual_date).toLocaleDateString('en-GB', {
                    day: '2-digit',
                    month: 'short',
                    year: '2-digit'
                  }) : 'N/A'}
                </span>
                {#if daysDiff !== 0}
                  <div class="text-xs {getDateColor(daysDiff)}">
                    ({daysDiff > 0 ? '+' : ''}{daysDiff} days)
                  </div>
                {/if}
              </td>
              <td class="px-4 py-3 border theme-border">
                <span class="px-2 py-1 bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 rounded-full text-xs">
                  Completed
                </span>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>

    <!-- Date Comparison Legend -->
    <div class="mt-4 p-4 theme-bg-secondary rounded-lg">
      <h3 class="text-sm font-medium theme-text-primary mb-3">Date Comparison Legend:</h3>
      <div class="flex flex-wrap gap-4 text-sm">
        <div class="flex items-center gap-2">
          <div class="w-3 h-3 bg-green-600 rounded"></div>
          <span class="theme-text-primary">On Time (0 days)</span>
        </div>
        <div class="flex items-center gap-2">
          <div class="w-3 h-3 bg-yellow-600 rounded"></div>
          <span class="theme-text-primary">Slight Delay (1-2 days)</span>
        </div>
        <div class="flex items-center gap-2">
          <div class="w-3 h-3 bg-orange-600 rounded"></div>
          <span class="theme-text-primary">Moderate Delay (3-5 days)</span>
        </div>
        <div class="flex items-center gap-2">
          <div class="w-3 h-3 bg-red-600 rounded"></div>
          <span class="theme-text-primary">Significant Delay (5+ days)</span>
        </div>
      </div>
    </div>
  </div>
{:else}
  <div class="theme-bg-primary rounded-lg shadow-lg p-6 mb-6">
    <div class="text-center py-8">
      <p class="text-lg theme-text-secondary mb-4">No completed chassis receivals</p>
      <p class="text-sm theme-text-tertiary">Complete some chassis receivals to see them here</p>
    </div>
  </div>
{/if}

<style>
  /* Row highlighting styles for chassis receival status */
  tr.on-time {
    background-color: #f0fdf4;
    border-left: 4px solid #22c55e;
  }
  
  tr.slight-delay {
    background-color: #fefce8;
    border-left: 4px solid #eab308;
  }
  
  tr.moderate-delay {
    background-color: #fff7ed;
    border-left: 4px solid #f97316;
  }
  
  tr.significant-delay {
    background-color: #fef2f2;
    border-left: 4px solid #ef4444;
  }
  
  /* Dark mode support */
  :global(.dark) tr.on-time {
    background-color: rgba(34, 197, 94, 0.2);
    border-left: 4px solid #22c55e;
  }
  
  :global(.dark) tr.on-time td,
  :global(.dark) tr.on-time td * {
    color: #1f2937 !important;
  }
  
  :global(.dark) tr.slight-delay {
    background-color: rgba(234, 179, 8, 0.2);
    border-left: 4px solid #eab308;
  }
  
  :global(.dark) tr.slight-delay td,
  :global(.dark) tr.slight-delay td * {
    color: #1f2937 !important;
  }
  
  :global(.dark) tr.moderate-delay {
    background-color: rgba(249, 115, 22, 0.2);
    border-left: 4px solid #f97316;
  }
  
  :global(.dark) tr.moderate-delay td,
  :global(.dark) tr.moderate-delay td * {
    color: #1f2937 !important;
  }
  
  :global(.dark) tr.significant-delay {
    background-color: rgba(239, 68, 68, 0.2);
    border-left: 4px solid #ef4444;
  }
  
  :global(.dark) tr.significant-delay td,
  :global(.dark) tr.significant-delay td * {
    color: #1f2937 !important;
  }
</style>

