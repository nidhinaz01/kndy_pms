<script lang="ts">
  import Button from '$lib/components/common/Button.svelte';
  import { formatDate } from '../utils/dateUtils';

  export let showModal = false;
  export let selectedWorkOrder: any = null;
  export let documentSubmissionDate = '';
  export let isLoading = false;

  export let onSubmit: () => void;
  export let onCancel: () => void;

  function handleSubmit() {
    onSubmit();
  }

  function handleCancel() {
    onCancel();
  }
</script>

{#if showModal}
  <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
    <div class="theme-bg-primary rounded-lg shadow-xl p-6 w-full max-w-md">
      <h2 class="text-xl font-semibold theme-text-primary mb-6">
        Record Document Submission
      </h2>

      {#if selectedWorkOrder}
        <div class="mb-6 p-4 theme-bg-secondary rounded-lg">
          <h3 class="font-medium theme-text-primary mb-2">Work Order Details:</h3>
          <p class="text-sm theme-text-secondary"><strong>WO No:</strong> {selectedWorkOrder.prdn_wo_details.wo_no}</p>
          <p class="text-sm theme-text-secondary"><strong>Model:</strong> {selectedWorkOrder.prdn_wo_details.wo_model}</p>
          <p class="text-sm theme-text-secondary"><strong>Customer:</strong> {selectedWorkOrder.prdn_wo_details.customer_name || 'N/A'}</p>
          <p class="text-sm theme-text-secondary"><strong>Planned Release:</strong> {formatDate(selectedWorkOrder.planned_date)}</p>
        </div>
      {/if}

      <form on:submit|preventDefault={handleSubmit} class="space-y-6">
        <div>
          <label for="submissionDate" class="block text-sm font-medium theme-text-primary mb-2">
            Document Submission Date *
          </label>
          <input
            id="submissionDate"
            type="date"
            bind:value={documentSubmissionDate}
            class="w-full px-3 py-2 border theme-border rounded-lg theme-bg-primary theme-text-primary focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            required
          />
        </div>

        <div class="flex justify-end gap-3 pt-4">
          <Button
            variant="secondary"
            on:click={handleCancel}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            disabled={isLoading}
          >
            {#if isLoading}
              <svg class="animate-spin -ml-1 mr-3 h-5 w-5 text-white inline" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Recording...
            {:else}
              Record Submission
            {/if}
          </Button>
        </div>
      </form>
    </div>
  </div>
{/if}

