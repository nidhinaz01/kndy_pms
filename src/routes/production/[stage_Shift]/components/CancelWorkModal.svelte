<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import Button from '$lib/components/common/Button.svelte';
  import { X } from 'lucide-svelte';

  export let isOpen: boolean = false;
  export let works: any[] = [];
  export let isLoading: boolean = false;

  const dispatch = createEventDispatcher();

  let cancellationReason: string = '';

  function handleClose() {
    dispatch('close');
    cancellationReason = '';
  }

  function handleConfirm() {
    if (!cancellationReason || cancellationReason.trim().length === 0) {
      alert('Please provide a reason for cancellation');
      return;
    }

    const confirmed = confirm(
      'Are you sure you want to cancel this work?\n\n' +
      'This action cannot be reversed. The workers will be freed and the plan will be marked as cancelled.\n\n' +
      'Reason: ' + cancellationReason.trim()
    );

    if (confirmed) {
      dispatch('confirm', { reason: cancellationReason.trim() });
    }
  }

  $: workCode = works.length > 0 
    ? (works[0]?.std_work_type_details?.derived_sw_code || works[0]?.std_work_type_details?.sw_code || works[0]?.other_work_code || 'N/A')
    : 'N/A';
  
  $: workName = works.length > 0
    ? (works[0]?.std_work_type_details?.std_work_type?.sw_name || 'N/A')
    : 'N/A';
  
  $: workersCount = works.length;
</script>

{#if isOpen}
  <!-- Modal backdrop -->
  <button 
    class="fixed inset-0 bg-black bg-opacity-50 dark:bg-opacity-70 z-[9999] w-full h-full border-none p-0"
    on:click={handleClose}
    aria-label="Close modal"
  ></button>
  
  <!-- Modal content -->
  <div class="fixed inset-0 z-[10000] flex items-center justify-center p-4">
    <div class="theme-bg-primary rounded-lg shadow-2xl dark:shadow-black/50 border-2 border-gray-300 dark:border-gray-600 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
      <!-- Header -->
      <div class="px-6 py-4 border-b theme-border">
        <div class="flex items-center justify-between">
          <div>
            <h3 class="text-lg font-semibold theme-text-primary">❌ Cancel Work</h3>
            <p class="text-sm theme-text-secondary mt-1">
              Cancel approved work plan
            </p>
          </div>
          <button
            type="button"
            class="theme-text-secondary hover:theme-text-primary transition-colors"
            on:click={handleClose}
          >
            <X class="w-6 h-6" />
          </button>
        </div>
      </div>

      <!-- Content -->
      <div class="px-6 py-4 space-y-6">
        {#if isLoading}
          <div class="text-center py-12">
            <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-red-500 mx-auto mb-4"></div>
            <p class="theme-text-secondary">Cancelling work...</p>
          </div>
        {:else}
          <!-- Work Details -->
          <div class="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
            <div class="space-y-2">
              <div>
                <span class="text-sm font-medium theme-text-secondary">Work Code:</span>
                <span class="ml-2 theme-text-primary">{workCode}</span>
              </div>
              <div>
                <span class="text-sm font-medium theme-text-secondary">Work Name:</span>
                <span class="ml-2 theme-text-primary">{workName}</span>
              </div>
              <div>
                <span class="text-sm font-medium theme-text-secondary">Skill Competencies:</span>
                <span class="ml-2 theme-text-primary">{workersCount}</span>
              </div>
            </div>
          </div>

          <!-- Warning -->
          <div class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
            <div class="flex items-start">
              <div class="flex-shrink-0">
                <svg class="h-5 w-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
                </svg>
              </div>
              <div class="ml-3 flex-1">
                <h3 class="text-sm font-medium text-red-800 dark:text-red-300">
                  Warning: This action cannot be reversed
                </h3>
                <div class="mt-2 text-sm text-red-700 dark:text-red-400">
                  <ul class="list-disc list-inside space-y-1">
                    <li>The approved plan will be marked as cancelled</li>
                    <li>All workers will be freed from this work</li>
                    <li>This cancellation cannot be undone</li>
                    <li>You will need to create a new plan from the Works tab if needed</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          <!-- Cancellation Reason -->
          <div>
            <label for="cancellation-reason" class="block text-sm font-medium theme-text-primary mb-2">
              Cancellation Reason <span class="text-red-500">*</span>
            </label>
            <textarea
              id="cancellation-reason"
              class="w-full px-3 py-2 border theme-border rounded-md theme-bg-primary theme-text-primary focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows="4"
              placeholder="Please provide a reason for cancelling this work..."
              bind:value={cancellationReason}
              disabled={isLoading}
            ></textarea>
            <p class="mt-1 text-xs theme-text-secondary">
              This reason will be saved in the plan notes.
            </p>
          </div>
        {/if}
      </div>

      <!-- Footer -->
      <div class="px-6 py-4 border-t theme-border flex items-center justify-end space-x-3">
        <Button variant="secondary" size="sm" on:click={handleClose} disabled={isLoading}>
          Cancel
        </Button>
        <Button 
          variant="danger" 
          size="sm" 
          on:click={handleConfirm}
          disabled={isLoading || !cancellationReason || cancellationReason.trim().length === 0}
        >
          {isLoading ? 'Cancelling...' : 'Confirm Cancellation'}
        </Button>
      </div>
    </div>
  </div>
{/if}

