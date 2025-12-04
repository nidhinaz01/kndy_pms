<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import Button from '$lib/components/common/Button.svelte';

  export let isOpen: boolean = false;
  export let availableWorkOrders: any[] = [];
  export let selectedWorkOrder: any = null;
  export let exitDate: string = '';
  export let isLoading: boolean = false;
  export let progressMessage: string = '';
  export let stageCode: string = '';

  const dispatch = createEventDispatcher();

  function handleClose() {
    dispatch('close');
  }

  function handleConfirm() {
    dispatch('confirm', { workOrder: selectedWorkOrder, exitDate });
  }

  function handleWorkOrderChange(event: Event) {
    const target = event.target as HTMLSelectElement;
    const selectedIndex = parseInt(target.value);
    if (!isNaN(selectedIndex) && selectedIndex >= 0 && selectedIndex < availableWorkOrders.length) {
      selectedWorkOrder = availableWorkOrders[selectedIndex];
    } else {
      selectedWorkOrder = null;
    }
  }
</script>

{#if isOpen}
  <div 
    class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50" 
    role="dialog"
    aria-modal="true"
    aria-labelledby="exit-modal-title"
    tabindex="-1"
    on:click={(e) => e.target === e.currentTarget && handleClose()} 
    on:keydown={(e) => e.key === 'Escape' && handleClose()}
  >
    <div 
      class="theme-bg-primary rounded-lg shadow-xl border theme-border max-w-md w-full mx-4"
    >
      <div class="p-6">
        <div class="flex items-center justify-between mb-4">
          <h2 id="exit-modal-title" class="text-xl font-semibold theme-text-primary">
            Exit Work Order from {stageCode}
          </h2>
          <button
            type="button"
            aria-label="Close exit modal"
            class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            on:click={handleClose}
          >
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div class="mb-4">
          <label for="workOrderSelectExit" class="block text-sm font-medium theme-text-primary mb-2">
            Select Work Order <span class="text-red-500">*</span>
          </label>
          <select
            id="workOrderSelectExit"
            disabled={isLoading}
            class="w-full px-3 py-2 border theme-border rounded-lg theme-bg-primary theme-text-primary focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
            on:change={handleWorkOrderChange}
          >
            <option value="">Choose a work order...</option>
            {#each availableWorkOrders as wo, index}
              <option value={index}>
                {wo.prdn_wo_details?.wo_no || 'N/A'} - {wo.prdn_wo_details?.pwo_no || 'N/A'} - {wo.prdn_wo_details?.wo_model || 'N/A'}
              </option>
            {/each}
          </select>
        </div>

        <div class="mb-4">
          <label for="exitDateInput" class="block text-sm font-medium theme-text-primary mb-2">
            Exit Date <span class="text-red-500">*</span>
          </label>
          <input
            type="date"
            id="exitDateInput"
            bind:value={exitDate}
            disabled={isLoading}
            class="w-full px-3 py-2 border theme-border rounded-lg theme-bg-primary theme-text-primary focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
          />
        </div>

        {#if isLoading && progressMessage}
          <div class="mb-4 p-3 theme-bg-blue-50 dark:theme-bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
            <div class="flex items-center gap-2">
              <svg class="animate-spin h-5 w-5 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span class="text-sm theme-text-primary">{progressMessage}</span>
            </div>
          </div>
        {/if}

        <div class="flex justify-end gap-2">
          <Button variant="secondary" size="sm" on:click={handleClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button variant="primary" size="sm" on:click={handleConfirm} disabled={isLoading || !selectedWorkOrder || !exitDate}>
            {isLoading ? 'Processing...' : 'Exit'}
          </Button>
        </div>
      </div>
    </div>
  </div>
{/if}

