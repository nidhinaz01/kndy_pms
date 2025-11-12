<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import Button from '$lib/components/common/Button.svelte';
  import { generateHolidayTemplate, parseHolidayCSV } from '$lib/api/holidays';

  export let showModal = false;
  export let isLoading = false;
  export let importResults: { success: number; errors: string[] } | null = null;

  const dispatch = createEventDispatcher();

  let importFile: File | null = null;
  let csvData = '';
  let showTemplate = false;

  function handleFileSelect(event: Event) {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];
    
    if (file && file.type === 'text/csv') {
      importFile = file;
      const reader = new FileReader();
      reader.onload = (e) => {
        csvData = e.target?.result as string;
      };
      reader.readAsText(file);
    } else {
      alert('Please select a valid CSV file.');
    }
  }

  function handleImport() {
    if (!csvData.trim()) {
      alert('Please select a CSV file first.');
      return;
    }

    try {
      const result = parseHolidayCSV(csvData);
      dispatch('import', result);
    } catch (error) {
      alert(`Error parsing CSV: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  function handleExportTemplate() {
    const template = generateHolidayTemplate();
    const blob = new Blob([template], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'holiday_template.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function handleClose() {
    dispatch('close');
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      handleClose();
    }
  }
</script>

{#if showModal}
  <div class="fixed inset-0 z-50 flex items-center justify-center" role="dialog" aria-modal="true" tabindex="0" on:keydown={handleKeydown}>
    <div class="fixed inset-0 bg-black bg-opacity-50" on:click={handleClose} on:keydown={(e) => e.key === 'Escape' && handleClose()} role="button" tabindex="0"></div>
    <div class="bg-white dark:bg-gray-800 rounded-lg p-6 w-96 max-w-md relative z-10">
      <h3 class="text-lg font-semibold theme-text-primary mb-4">Import Holidays</h3>
      
      <div class="space-y-4">
        <!-- Template Export -->
        <div class="p-4 bg-blue-50 dark:bg-blue-900 rounded-lg">
          <h4 class="text-sm font-semibold theme-text-primary mb-2">Step 1: Download Template</h4>
          <p class="text-xs theme-text-secondary mb-3">
            Download the CSV template to see the required format and add your holiday data.
          </p>
          <Button
            variant="secondary"
            size="sm"
            on:click={handleExportTemplate}
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
            on:change={handleFileSelect}
            class="w-full px-3 py-2 border theme-border rounded-lg theme-bg-primary theme-text-primary focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <!-- Instructions -->
        <div class="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
          <h4 class="text-sm font-semibold theme-text-primary mb-2">Instructions:</h4>
          <div class="text-xs theme-text-secondary space-y-1">
            <p>• CSV must have columns: dt_day, dt_month, dt_year, description</p>
            <p>• Day: 1-31 (valid for the selected month)</p>
            <p>• Month: January, February, March, etc.</p>
            <p>• Year: Current year -1, current year, or current year +1</p>
            <p>• Description: Holiday name/description</p>
            <p>• Example: 15,January,2024,Republic Day</p>
          </div>
        </div>

        <!-- Import Results -->
        {#if importResults}
          <div class="p-3 rounded-lg {importResults.success > 0 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}">
            <p class="font-semibold">Import Results:</p>
            <p>Successfully imported: {importResults.success}</p>
            {#if importResults.errors.length > 0}
              <p class="mt-2">Errors: {importResults.errors.length}</p>
              <details class="mt-2">
                <summary class="cursor-pointer font-semibold">View Errors</summary>
                <ul class="mt-2 text-xs space-y-1">
                  {#each importResults.errors as error}
                    <li>• {error}</li>
                  {/each}
                </ul>
              </details>
            {/if}
          </div>
        {/if}
      </div>
      
      <div class="flex justify-end space-x-3 mt-6">
        <Button
          type="button"
          variant="secondary"
          on:click={handleClose}
          disabled={isLoading}
        >
          Cancel
        </Button>
        <Button
          type="button"
          variant="primary"
          on:click={handleImport}
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