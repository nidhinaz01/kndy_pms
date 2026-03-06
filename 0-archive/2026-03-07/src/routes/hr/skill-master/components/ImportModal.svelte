<script lang="ts">
  import Button from '$lib/components/common/Button.svelte';

  export let showModal = false;
  export let importFile: File | null = null;
  export let importResults: { success: number; errors: string[] } | null = null;
  export let isLoading = false;
  export let onExportTemplate: () => void;
  export let onFileSelect: (event: Event) => void;
  export let onImport: () => void;
  export let onClose: () => void;
</script>

{#if showModal}
  <div class="fixed inset-0 z-50 flex items-center justify-center" role="dialog" aria-modal="true" tabindex="0">
    <div class="fixed inset-0 bg-black bg-opacity-50" on:click={onClose} on:keydown={(e) => e.key === 'Escape' && onClose()} role="button" tabindex="0" aria-label="Close modal"></div>
    <div class="theme-bg-primary border theme-border rounded-lg p-6 w-96 max-w-md max-h-[90vh] overflow-y-auto relative z-10 shadow-xl">
      <h3 class="text-lg font-semibold theme-text-primary mb-4">Import Skills</h3>
      
      <div class="space-y-4">
        <!-- Template Export -->
        <div class="p-4 bg-blue-50 dark:bg-blue-900/30 rounded-lg border border-blue-200 dark:border-blue-700">
          <h4 class="text-sm font-semibold theme-text-primary mb-2">Step 1: Download Template</h4>
          <p class="text-xs theme-text-secondary mb-3">
            Download the CSV template to see the required format and add your skill data.
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
          <label for="importFile" class="block text-sm font-medium theme-text-primary mb-2">
            Step 2: Select CSV File
          </label>
          <input
            id="importFile"
            type="file"
            accept=".csv"
            on:change={onFileSelect}
            class="w-full px-3 py-2 border theme-border rounded-lg theme-bg-primary theme-text-primary focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <!-- Instructions -->
        <div class="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600">
          <h4 class="text-sm font-semibold theme-text-primary mb-2">Instructions:</h4>
          <div class="text-xs theme-text-secondary space-y-1">
            <p class="break-words">• CSV must have columns: skill_name,skill_code,rate_per_hour,minimum_salary,maximum_salary,wef_date,status</p>
            <p>• skill_name: Skill name (must be unique)</p>
            <p>• skill_code: Skill code (must be unique)</p>
            <p>• rate_per_hour: Rate per hour (positive number)</p>
            <p>• minimum_salary: Minimum salary (positive number)</p>
            <p>• maximum_salary: Maximum salary (positive number, must be greater than minimum)</p>
            <p class="break-words">• wef_date: WEF date (YYYY-MM-DD format, e.g., 2024-01-15)</p>
            <p>• status: Status (Active or Inactive)</p>
          </div>
        </div>
        
        <!-- Import Results -->
        {#if importResults}
          <div class="p-3 rounded-lg border {importResults.success > 0 ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 border-green-200 dark:border-green-700' : 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200 border-red-200 dark:border-red-700'}">
            <div class="text-sm font-medium mb-2">
              Import Results: {importResults.success} skills imported successfully
            </div>
            {#if importResults.errors.length > 0}
              <div class="text-xs">
                <div class="font-medium mb-1">Errors:</div>
                <div class="max-h-32 overflow-y-auto space-y-1">
                  {#each importResults.errors as error}
                    <div class="break-words">{error}</div>
                  {/each}
                </div>
              </div>
            {/if}
          </div>
        {/if}
        
        <!-- Action Buttons -->
        <div class="flex justify-end space-x-3">
          <Button
            variant="secondary"
            on:click={onClose}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            on:click={onImport}
            disabled={!importFile}
          >
            Import Skills
          </Button>
        </div>
      </div>
    </div>
  </div>
{/if}

