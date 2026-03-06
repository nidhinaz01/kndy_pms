<script lang="ts">
  import Button from '$lib/components/common/Button.svelte';

  export let showModal = false;
  export let updateFile: File | null = null;
  export let updateResults: { success: number; errors: string[]; skipped: number } | null = null;
  export let isLoading = false;
  export let onExportTemplate: () => void;
  export let onFileSelect: (event: Event) => void;
  export let onBulkUpdate: () => void;
  export let onClose: () => void;
</script>

{#if showModal}
  <div class="fixed inset-0 z-50 flex items-center justify-center" role="dialog" aria-modal="true" tabindex="0">
    <div class="fixed inset-0 bg-black bg-opacity-50" on:click={onClose} on:keydown={(e) => e.key === 'Escape' && onClose()} role="button" tabindex="0" aria-label="Close modal"></div>
    <div class="theme-bg-primary border theme-border rounded-lg p-6 w-[600px] max-w-[90vw] max-h-[90vh] overflow-y-auto relative z-10 shadow-xl">
      <h3 class="text-lg font-semibold theme-text-primary mb-4">Bulk Update Employees</h3>
      
      <div class="space-y-4">
        <!-- Template Export -->
        <div class="p-4 bg-blue-50 dark:bg-blue-900/50 rounded-lg border border-blue-200 dark:border-blue-700/60">
          <h4 class="text-sm font-semibold text-gray-900 dark:text-blue-100 mb-2">Step 1: Download Template</h4>
          <p class="text-xs text-gray-700 dark:text-gray-200 mb-3">
            Download the CSV template containing all existing employee data. Modify only the allowed fields and upload to update.
          </p>
          <Button
            variant="secondary"
            size="sm"
            on:click={onExportTemplate}
          >
            Download Template
          </Button>
        </div>

        <!-- File Upload -->
        <div>
          <label for="updateFile" class="block text-sm font-medium theme-text-primary mb-2">
            Step 2: Select Modified CSV File
          </label>
          <input
            id="updateFile"
            type="file"
            accept=".csv"
            on:change={onFileSelect}
            class="w-full px-3 py-2 border theme-border rounded-lg theme-bg-primary theme-text-primary focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <!-- Instructions -->
        <div class="p-4 bg-yellow-50 dark:bg-yellow-900/50 rounded-lg border border-yellow-200 dark:border-yellow-700/60">
          <h4 class="text-sm font-semibold text-gray-900 dark:text-yellow-100 mb-2">⚠️ Important Instructions:</h4>
          <div class="text-xs space-y-1">
            <p class="font-semibold text-red-600 dark:text-red-300">DO NOT MODIFY:</p>
            <p class="text-gray-800 dark:text-gray-100">• Employee ID - Cannot be changed</p>
            <p class="text-gray-800 dark:text-gray-100">• Employee Name - Cannot be changed</p>
            <p class="text-gray-800 dark:text-gray-100">• Date of Joining - Cannot be changed</p>
            <p class="mt-2 font-semibold text-green-600 dark:text-green-300">YOU CAN MODIFY:</p>
            <p class="text-gray-800 dark:text-gray-100">• Employee Category (must be from dropdown values)</p>
            <p class="text-gray-800 dark:text-gray-100">• Skill (must be from dropdown values)</p>
            <p class="text-gray-800 dark:text-gray-100">• Last Appraisal Date (YYYY-MM-DD format, not future date)</p>
            <p class="text-gray-800 dark:text-gray-100">• Basic DA (positive number, or zero for Apprentice/Trainee)</p>
            <p class="text-gray-800 dark:text-gray-100">• Salary (positive number)</p>
            <p class="text-gray-800 dark:text-gray-100">• Stage (must be from dropdown values)</p>
            <p class="text-gray-800 dark:text-gray-100">• Shift Code (must be from dropdown values)</p>
          </div>
        </div>
        
        <!-- Update Results -->
        {#if updateResults}
          <div class="p-3 rounded-lg border {updateResults.success > 0 ? 'bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-200 border-green-200 dark:border-green-700/50' : 'bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-200 border-red-200 dark:border-red-700/50'}">
            <p class="font-semibold">Update Results:</p>
            <p>Successfully updated: {updateResults.success}</p>
            {#if updateResults.skipped > 0}
              <p class="mt-1">Skipped (empty rows): {updateResults.skipped}</p>
            {/if}
            {#if updateResults.errors.length > 0}
              <p class="mt-2">Errors: {updateResults.errors.length}</p>
              <details class="mt-2">
                <summary class="cursor-pointer font-semibold theme-text-primary">View Errors</summary>
                <ul class="mt-2 text-xs space-y-1 max-h-40 overflow-y-auto theme-text-primary">
                  {#each updateResults.errors as error}
                    <li class="break-words">• {error}</li>
                  {/each}
                </ul>
              </details>
            {/if}
          </div>
        {/if}
      </div>
      
      <div class="flex justify-end space-x-3 mt-6">
        <Button
          variant="secondary"
          on:click={onClose}
          disabled={isLoading}
        >
          Cancel
        </Button>
        <Button
          variant="primary"
          on:click={onBulkUpdate}
          disabled={!updateFile || isLoading}
        >
          {#if isLoading}
            <svg class="animate-spin -ml-1 mr-3 h-5 w-5 text-white inline" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Updating...
          {:else}
            Update Employees
          {/if}
        </Button>
      </div>
    </div>
  </div>
{/if}

