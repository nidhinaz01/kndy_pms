<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import Button from '$lib/components/common/Button.svelte';
  import {
    getPlannedStartDate,
    getPlannedEndDate,
    getActualStartDate,
    getActualEndDate,
    getDocumentReleaseDate,
    getWorkOrderStatus,
    getDateColor,
    getRowBackgroundColor
  } from '../utils/workOrderUtils';

  export let workOrdersData: any[] = [];
  export let isLoading: boolean = false;
  export let stageCode: string = '';
  export let selectedDate: string = '';

  const dispatch = createEventDispatcher();

  function handleEntry() {
    dispatch('entry');
  }

  function handleExit() {
    dispatch('exit');
  }
</script>

<div class="theme-bg-primary rounded-lg shadow border theme-border">
  <div class="p-6 border-b theme-border">
    <div class="flex items-center justify-between mb-4">
      <h2 class="text-xl font-semibold theme-text-primary">📦 Active Work Orders in {stageCode}</h2>
      <div class="flex gap-2">
        <Button variant="primary" size="sm" on:click={handleEntry}>
          Entry
        </Button>
        <Button variant="primary" size="sm" on:click={handleExit}>
          Exit
        </Button>
      </div>
    </div>
    <p class="theme-text-secondary mb-4">
      Work orders active in {stageCode} stage for {new Date(selectedDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' })} - showing pending and in-progress work orders
    </p>
    
    <!-- Date Comparison Legend -->
    <div class="flex flex-wrap gap-4 text-sm mb-4">
      <div class="flex items-center gap-2">
        <div class="w-4 h-4 rounded" style="background-color: #dcfce7;"></div>
        <span class="theme-text-primary">On Time (0 days)</span>
      </div>
      <div class="flex items-center gap-2">
        <div class="w-4 h-4 rounded" style="background-color: #fef3c7;"></div>
        <span class="theme-text-primary">Slight Delay (1-2 days)</span>
      </div>
      <div class="flex items-center gap-2">
        <div class="w-4 h-4 rounded" style="background-color: #fed7aa;"></div>
        <span class="theme-text-primary">Moderate Delay (3-5 days)</span>
      </div>
      <div class="flex items-center gap-2">
        <div class="w-4 h-4 rounded" style="background-color: #fecaca;"></div>
        <span class="theme-text-primary">Significant Delay (5+ days)</span>
      </div>
    </div>
  </div>
  
  {#if isLoading}
    <div class="flex items-center justify-center py-12">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mr-3"></div>
      <span class="theme-text-secondary">Loading work orders...</span>
    </div>
  {:else if workOrdersData.length === 0}
    <div class="text-center py-12">
      <div class="text-6xl mb-4">📦</div>
      <p class="theme-text-secondary text-lg">No active work orders in {stageCode}</p>
      <p class="theme-text-secondary text-sm mt-2">
        Work orders will appear here when they reach {stageCode} stage
      </p>
    </div>
  {:else}
    <div class="overflow-x-auto">
      <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
        <thead class="theme-bg-secondary">
          <tr>
            <th class="px-6 py-3 text-left text-xs font-medium theme-text-secondary uppercase tracking-wider">
              Work Order
            </th>
            <th class="px-6 py-3 text-left text-xs font-medium theme-text-secondary uppercase tracking-wider">
              PWO Number
            </th>
            <th class="px-6 py-3 text-left text-xs font-medium theme-text-secondary uppercase tracking-wider">
              Model
            </th>
            <th class="px-6 py-3 text-left text-xs font-medium theme-text-secondary uppercase tracking-wider">
              Customer
            </th>
            <th class="px-6 py-3 text-left text-xs font-medium theme-text-secondary uppercase tracking-wider">
              Document Release
            </th>
            <th class="px-6 py-3 text-left text-xs font-medium theme-text-secondary uppercase tracking-wider">
              Planned Start
            </th>
            <th class="px-6 py-3 text-left text-xs font-medium theme-text-secondary uppercase tracking-wider">
              Actual Start
            </th>
            <th class="px-6 py-3 text-left text-xs font-medium theme-text-secondary uppercase tracking-wider">
              Planned End
            </th>
            <th class="px-6 py-3 text-left text-xs font-medium theme-text-secondary uppercase tracking-wider">
              Actual End
            </th>
            <th class="px-6 py-3 text-left text-xs font-medium theme-text-secondary uppercase tracking-wider">
              Status
            </th>
          </tr>
        </thead>
        <tbody class="theme-bg-primary divide-y divide-gray-200 dark:divide-gray-700">
          {#each workOrdersData as workOrder}
           {@const plannedStart = getPlannedStartDate(workOrder)}
           {@const actualStart = getActualStartDate(workOrder)}
           {@const daysDiff = workOrder.workingDaysDiff || 0}
           {@const endDaysDiff = workOrder.endWorkingDaysDiff || 0}
           {@const rowBgClass = getRowBackgroundColor(daysDiff)}
           {@const workStatus = getWorkOrderStatus(workOrder)}
            <tr class="hover:theme-bg-secondary transition-colors" 
                class:on-time={rowBgClass === 'on-time'} 
                class:slight-delay={rowBgClass === 'slight-delay'} 
                class:moderate-delay={rowBgClass === 'moderate-delay'} 
                class:significant-delay={rowBgClass === 'significant-delay'}>
              <td class="px-6 py-4 whitespace-nowrap text-sm font-medium {rowBgClass ? 'text-gray-800' : 'theme-text-primary'}">
                {workOrder.prdn_wo_details?.wo_no || 'N/A'}
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm {rowBgClass ? 'text-gray-800' : 'theme-text-primary'}">
                {workOrder.prdn_wo_details?.pwo_no || 'N/A'}
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm {rowBgClass ? 'text-gray-800' : 'theme-text-primary'}">
                {workOrder.prdn_wo_details?.wo_model || 'N/A'}
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm {rowBgClass ? 'text-gray-800' : 'theme-text-primary'}">
                {workOrder.prdn_wo_details?.customer_name || 'N/A'}
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm {rowBgClass ? 'text-gray-800' : 'theme-text-primary'}">
                {getDocumentReleaseDate(workOrder, stageCode)}
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm {rowBgClass ? 'text-gray-800' : 'theme-text-primary'}">
                {getPlannedStartDate(workOrder)}
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm">
                {#if getActualStartDate(workOrder) !== 'N/A'}
                 <span class="{getDateColor(daysDiff)}">
                   {getActualStartDate(workOrder)}
                 </span>
                 {#if daysDiff !== 0}
                   <div class="text-xs {getDateColor(daysDiff)}">
                     ({daysDiff > 0 ? '+' : ''}{daysDiff} working days)
                   </div>
                 {/if}
                {:else}
                  <div>
                   <span class="text-gray-500 dark:text-gray-400">Not Started</span>
                   {#if daysDiff > 0}
                     <div class="text-xs {getDateColor(daysDiff)}">
                       (Delayed by {daysDiff} working days)
                     </div>
                   {/if}
                  </div>
                {/if}
              </td>
             <td class="px-6 py-4 whitespace-nowrap text-sm {rowBgClass ? 'text-gray-800' : 'theme-text-primary'}">
               {getPlannedEndDate(workOrder)}
             </td>
             <td class="px-6 py-4 whitespace-nowrap text-sm {rowBgClass ? 'text-gray-800' : 'theme-text-primary'}">
               {#if getActualEndDate(workOrder) !== 'N/A'}
                 <span class="{getDateColor(endDaysDiff)}">
                   {getActualEndDate(workOrder)}
                 </span>
                 {#if endDaysDiff !== 0}
                   <div class="text-xs {getDateColor(endDaysDiff)}">
                     ({endDaysDiff > 0 ? '+' : ''}{endDaysDiff} working days)
                   </div>
                 {/if}
               {:else}
                 <div>
                   <span class="text-gray-500 dark:text-gray-400">Not Completed</span>
                   {#if endDaysDiff > 0}
                     <div class="text-xs {getDateColor(endDaysDiff)}">
                       (Delayed by {endDaysDiff} working days)
                     </div>
                   {/if}
                 </div>
               {/if}
             </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm">
                <span class="font-medium {workStatus.color}">
                  {workStatus.status}
                </span>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
    
    <!-- Summary -->
    <div class="px-6 py-4 theme-bg-secondary border-t theme-border">
      <div class="flex flex-wrap gap-4 text-sm">
        <div class="theme-text-secondary">
          <span class="font-medium">Total Work Orders:</span> {workOrdersData.length}
        </div>
      </div>
    </div>
  {/if}
</div>

