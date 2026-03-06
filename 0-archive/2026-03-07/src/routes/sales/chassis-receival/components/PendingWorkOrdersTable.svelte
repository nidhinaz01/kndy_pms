<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import Button from '$lib/components/common/Button.svelte';
  
  export let workOrders: any[] = [];
  
  const dispatch = createEventDispatcher();
  
  function handleStartInspection(workOrder: any) {
    dispatch('start-inspection', workOrder);
  }
</script>

{#if workOrders.length > 0}
  <div class="theme-bg-primary rounded-lg shadow-lg">
    <div class="p-6 border-b theme-border">
      <h3 class="text-lg font-semibold theme-text-primary">Pending Chassis Receival ({workOrders.length})</h3>
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
            <th class="px-4 py-3 text-center font-medium theme-text-primary">Actions</th>
          </tr>
        </thead>
        <tbody>
          {#each workOrders as workOrder}
            <tr class="border-b theme-border hover:theme-bg-secondary">
              <td class="px-4 py-3 font-medium theme-text-primary">
                {workOrder.wo_no}
              </td>
              <td class="px-4 py-3 theme-text-primary">
                {workOrder.pwo_no || 'N/A'}
              </td>
              <td class="px-4 py-3 theme-text-primary">
                {workOrder.wo_type || 'N/A'}
              </td>
              <td class="px-4 py-3 theme-text-primary">
                {workOrder.wo_model || 'N/A'}
              </td>
              <td class="px-4 py-3 theme-text-primary">
                {workOrder.wo_chassis || 'N/A'}
              </td>
              <td class="px-4 py-3 theme-text-primary">
                {workOrder.wheel_base || 'N/A'}
              </td>
              <td class="px-4 py-3 theme-text-primary">
                {workOrder.customer_name || 'N/A'}
              </td>
              <td class="px-4 py-3 theme-text-primary">
                {workOrder.chassisArrivalDate ? new Date(workOrder.chassisArrivalDate).toLocaleDateString() : 'N/A'}
              </td>
              <td class="px-4 py-3 text-center">
                <Button variant="primary" size="sm" on:click={() => handleStartInspection(workOrder)}>
                  {workOrder.hasOngoingInspection ? 'Continue Inspection' : 'Start Inspection'}
                </Button>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  </div>
{:else}
  <div class="theme-bg-primary rounded-lg shadow-lg p-6 mb-6">
    <div class="text-center py-8">
      <p class="text-lg theme-text-secondary mb-4">No pending chassis receivals</p>
      <p class="text-sm theme-text-tertiary">All chassis receivals are up to date</p>
    </div>
  </div>
{/if}

