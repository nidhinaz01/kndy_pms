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
      <h3 class="text-lg font-semibold theme-text-primary mb-4">Import Employees</h3>
      
      <div class="space-y-4">
        <!-- Template Export -->
        <div class="p-4 bg-blue-50 dark:bg-blue-900/30 rounded-lg border border-blue-200 dark:border-blue-700">
          <h4 class="text-sm font-semibold theme-text-primary mb-2">Step 1: Download Template</h4>
          <p class="text-xs theme-text-secondary mb-3">
            Download the CSV template to see the required format and add your employee data.
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
            <p class="break-words">• CSV must have columns: emp_id,emp_cat,emp_name,skill_short,emp_doj,last_appraisal_date,basic_da,salary,stage,shift_code</p>
            <p>• emp_id: Unique employee identifier</p>
            <p>• emp_cat: Employee category (from dropdown values)</p>
            <p>• emp_name: Employee full name</p>
            <p>• skill_short: Skill code (from dropdown values)</p>
            <p class="break-words">• emp_doj: Date of joining (YYYY-MM-DD format, e.g., 2024-01-15, not future date)</p>
            <p class="break-words">• last_appraisal_date: Last appraisal date (YYYY-MM-DD format, e.g., 2024-01-15, not future date)</p>
            <p>• basic_da: Basic DA amount (positive number, or zero for Apprentice/Trainee categories)</p>
            <p>• salary: Salary amount (positive number)</p>
            <p>• stage: Employee stage (from dropdown values)</p>
            <p>• shift_code: Shift code (from dropdown values)</p>
          </div>
        </div>
        
        <!-- Import Results -->
        {#if importResults}
          <div class="p-3 rounded-lg border {importResults.success > 0 ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 border-green-200 dark:border-green-700' : 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200 border-red-200 dark:border-red-700'}">
            <p class="font-semibold">Import Results:</p>
            <p>Successfully imported: {importResults.success}</p>
            {#if importResults.errors.length > 0}
              <p class="mt-2">Errors: {importResults.errors.length}</p>
              <details class="mt-2">
                <summary class="cursor-pointer font-semibold">View Errors</summary>
                <ul class="mt-2 text-xs space-y-1">
                  {#each importResults.errors as error}
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
          on:click={onImport}
          disabled={!importFile || isLoading}
        >
          {#if isLoading}
            <svg class="animate-spin -ml-1 mr-3 h-5 w-5 text-white inline" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Importing...
          {:else}
            Import
          {/if}
        </Button>
      </div>
    </div>
  </div>
{/if}

