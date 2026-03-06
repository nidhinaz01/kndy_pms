<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { supabase } from '$lib/supabaseClient';
  import { saveSkillTimeStandard } from '$lib/api/stdSkillTimeStandards';
  import Button from '$lib/components/common/Button.svelte';

  export let showImportModal: boolean;
  export let onClose: () => void;
  export let onImportSuccess: () => void;

  const dispatch = createEventDispatcher();

  let fileInput: HTMLInputElement;
  let selectedFile: File | null = null;
  let isProcessing = false;
  let errorMsg = '';
  let successMsg = '';
  let importResults = {
    total: 0,
    success: 0,
    errors: 0,
    errorDetails: [] as string[]
  };

  function downloadTemplate() {
    const headers = ['Derived Work Code', 'Skill Combination Name', 'Skill Short', 'Standard Time (minutes)', 'Skill Order'];
    const csvContent = headers.join(',') + '\n' +
      'C0101A,Skill A,WELD,30,1\n' +
      'C0101A,Skill A,CUT,45,2\n' +
      'C0101B,Skill B,PAINT,60,1';
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'skill_time_standards_template.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  }

  function handleFileSelect(event: Event) {
    const target = event.target as HTMLInputElement;
    if (target.files && target.files[0]) {
      selectedFile = target.files[0];
      errorMsg = '';
      successMsg = '';
    }
  }

  function handleChooseFile() {
    document.getElementById('fileInput')?.click();
  }

  async function processFile() {
    if (!selectedFile) {
      errorMsg = 'Please select a CSV file to import.';
      return;
    }

    isProcessing = true;
    errorMsg = '';
    successMsg = '';
    importResults = { total: 0, success: 0, errors: 0, errorDetails: [] };

    try {
      const text = await selectedFile.text();
      const lines = text.split('\n').filter(line => line.trim());
      
      if (lines.length < 2) {
        throw new Error('CSV file must contain at least a header row and one data row.');
      }

      const headers = lines[0].split(',').map(h => h.trim());
      const expectedHeaders = ['Derived Work Code', 'Skill Combination Name', 'Skill Short', 'Standard Time (minutes)', 'Skill Order'];
      
      if (!expectedHeaders.every(header => headers.includes(header))) {
        throw new Error(`CSV must contain columns: ${expectedHeaders.join(', ')}`);
      }

      // Get current username (throws error if not found)
      const { getCurrentUsername } = await import('$lib/utils/userUtils');
      const username = getCurrentUsername();

      // Get all work-skill mappings to resolve derived work code + skill combination to wsm_id
      const { data: existingMappings, error: mappingsError } = await supabase
        .from('std_work_skill_mapping')
        .select(`
          wsm_id,
          derived_sw_code,
          sc_name
        `)
        .eq('is_deleted', false);

      if (mappingsError) throw mappingsError;

      // Create a map from (derived_sw_code, sc_name) to wsm_id
      const mappingLookup = new Map<string, number>();
      existingMappings?.forEach(mapping => {
        const key = `${mapping.derived_sw_code}|${mapping.sc_name}`;
        mappingLookup.set(key, mapping.wsm_id);
      });

      // Validate skill shorts exist
      const { data: existingSkills, error: skillsError } = await supabase
        .from('hr_skill_master')
        .select('skill_short')
        .eq('is_deleted', false);

      if (skillsError) throw skillsError;

      const validSkillShorts = new Set(existingSkills?.map(s => s.skill_short) || []);

      // Process each row
      const records = [];
      const errors = [];

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const values = line.split(',').map(v => v.trim());
        const [derivedWorkCode, skillCombinationName, skillShort, timeMinutesStr, skillOrderStr] = values;

        // Look up work-skill mapping ID
        const mappingKey = `${derivedWorkCode}|${skillCombinationName}`;
        const wsmId = mappingLookup.get(mappingKey);

        if (!wsmId) {
          errors.push(`Row ${i + 1}: No work-skill mapping found for Derived Work Code "${derivedWorkCode}" and Skill Combination "${skillCombinationName}".`);
          continue;
        }

        // Validate skill short exists
        if (!validSkillShorts.has(skillShort)) {
          errors.push(`Row ${i + 1}: Skill Short "${skillShort}" does not exist.`);
          continue;
        }

        // Validate and parse numeric values
        const timeMinutes = parseInt(timeMinutesStr);
        const skillOrder = parseInt(skillOrderStr);

        if (isNaN(timeMinutes) || timeMinutes <= 0) {
          errors.push(`Row ${i + 1}: Standard Time must be a positive number.`);
          continue;
        }

        if (isNaN(skillOrder) || skillOrder <= 0) {
          errors.push(`Row ${i + 1}: Skill Order must be a positive number.`);
          continue;
        }

        records.push({
          wsm_id: wsmId,
          skill_short: skillShort,
          standard_time_minutes: timeMinutes,
          skill_order: skillOrder
        });
      }

      if (errors.length > 0) {
        throw new Error(`Validation failed with ${errors.length} errors:\n${errors.join('\n')}`);
      }

      // Import records individually to handle duplicates properly
      let successCount = 0;
      const importErrors = [];

      for (const record of records) {
        try {
          // Use the individual save function which has built-in duplicate checking
          await saveSkillTimeStandard(record);
          successCount++;
        } catch (error: any) {
          if (error.message.includes('already exists')) {
            importErrors.push(`Skipped existing time standard: ${record.skill_short} (order ${record.skill_order}) for mapping ${record.wsm_id}`);
          } else {
            importErrors.push(`Failed to import ${record.skill_short} (order ${record.skill_order}) for mapping ${record.wsm_id}: ${error.message}`);
          }
        }
      }

      // Separate actual errors from skipped records
      const actualErrors = importErrors.filter(error => !error.includes('Skipped'));
      const skippedMessages = importErrors.filter(error => error.includes('Skipped'));

      importResults = {
        total: records.length,
        success: successCount,
        errors: actualErrors.length,
        errorDetails: importErrors
      };

      if (actualErrors.length === 0) {
        if (skippedMessages.length > 0) {
          successMsg = `Successfully imported ${successCount} skill time standards. ${skippedMessages.length} existing records were skipped.`;
        } else {
          successMsg = `Successfully imported ${successCount} skill time standards.`;
        }
        onImportSuccess();
      } else {
        errorMsg = `Import completed with ${actualErrors.length} errors. ${successCount} time standards imported successfully.`;
        if (skippedMessages.length > 0) {
          errorMsg += ` ${skippedMessages.length} existing records were skipped.`;
        }
      }

    } catch (error: any) {
      errorMsg = 'Import failed: ' + (error.message || error);
    } finally {
      isProcessing = false;
    }
  }

  function handleClose() {
    selectedFile = null;
    errorMsg = '';
    successMsg = '';
    importResults = { total: 0, success: 0, errors: 0, errorDetails: [] };
    onClose();
  }
</script>

{#if showImportModal}
  <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
    <div class="theme-bg-primary rounded-2xl shadow-2xl w-[40rem] max-h-[90vh] overflow-y-auto animate-fade-in">
      <div class="p-6">
        <div class="flex items-center justify-between mb-6">
          <div class="flex items-center">
            <svg class="w-6 h-6 text-blue-500 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
            </svg>
            <h2 class="text-xl font-semibold theme-text-accent">Import Skill Time Standards</h2>
          </div>
          <button
            on:click={handleClose}
            class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            aria-label="Close modal"
          >
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div class="space-y-6">
          <!-- Template Download -->
          <div>
            <h3 class="text-lg font-medium theme-text-primary mb-2">Download Template</h3>
            <p class="text-sm theme-text-secondary mb-3">
              Download the CSV template and fill it with your skill time standards data.
            </p>
            <Button variant="secondary" size="md" on:click={downloadTemplate}>
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Download Template
            </Button>
          </div>

          <!-- Import Instructions -->
          <div class="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <h3 class="text-lg font-medium text-gray-800 dark:text-gray-200 mb-2">Import Instructions</h3>
            <div class="text-sm text-gray-700 dark:text-gray-300 space-y-2">
              <p>• CSV must contain columns: <strong class="text-gray-900 dark:text-gray-100">Derived Work Code, Skill Combination Name, Skill Short, Standard Time (minutes), Skill Order</strong></p>
              <p>• Derived Work Code and Skill Combination Name must match an existing work-skill mapping</p>
              <p>• Skill Short must be valid skill code</p>
              <p>• Standard Time must be greater than 0</p>
              <p>• Skill Order must be greater than 0</p>
            </div>
          </div>

          <!-- File Upload -->
          <div>
            <h3 class="text-lg font-medium theme-text-primary mb-2">Upload CSV File</h3>
            <div class="border-2 border-dashed theme-border rounded-lg p-6 text-center">
              <input
                id="fileInput"
                type="file"
                accept=".csv"
                on:change={handleFileSelect}
                class="hidden"
              />
              {#if selectedFile}
                <div class="mb-4">
                  <svg class="w-12 h-12 text-green-500 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p class="theme-text-primary font-medium">{selectedFile.name}</p>
                  <p class="text-sm theme-text-secondary">{(selectedFile.size / 1024).toFixed(1)} KB</p>
                </div>
                <Button variant="secondary" size="sm" on:click={handleChooseFile}>
                  Choose Different File
                </Button>
              {:else}
                <div class="mb-4">
                  <svg class="w-12 h-12 text-gray-400 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
                  </svg>
                  <p class="theme-text-primary font-medium mb-1">Choose CSV file to import</p>
                  <p class="text-sm theme-text-secondary">Click to browse or drag and drop</p>
                </div>
                <Button variant="secondary" size="sm" on:click={handleChooseFile}>
                  Choose File
                </Button>
              {/if}
            </div>
          </div>

          <!-- Error/Success Messages -->
          {#if errorMsg}
            <div class="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg p-4">
              <div class="flex items-start">
                <svg class="w-5 h-5 text-red-500 mr-2 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <p class="text-red-700 dark:text-red-200 text-sm font-medium">Import Error</p>
                  <p class="text-red-600 dark:text-red-300 text-sm mt-1">{errorMsg}</p>
                  {#if importResults.errorDetails.length > 0}
                    <div class="mt-2 max-h-32 overflow-y-auto">
                      {#each importResults.errorDetails as error}
                        <p class="text-red-600 dark:text-red-300 text-xs">{error}</p>
                      {/each}
                    </div>
                  {/if}
                </div>
              </div>
            </div>
          {/if}

          {#if successMsg}
            <div class="bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-lg p-4">
              <div class="flex items-start">
                <svg class="w-5 h-5 text-green-500 mr-2 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <p class="text-green-700 dark:text-green-200 text-sm font-medium">Import Successful</p>
                  <p class="text-green-600 dark:text-green-300 text-sm mt-1">{successMsg}</p>
                  {#if importResults.total > 0}
                    <p class="text-green-600 dark:text-green-300 text-xs mt-1">
                      Total: {importResults.total} | Success: {importResults.success} | Errors: {importResults.errors}
                    </p>
                  {/if}
                </div>
              </div>
            </div>
          {/if}

          <!-- Action Buttons -->
          <div class="flex justify-end gap-3 pt-4">
            <Button variant="secondary" size="md" on:click={handleClose}>Close</Button>
            {#if selectedFile}
              <Button 
                variant="primary" 
                size="md" 
                on:click={processFile}
                disabled={isProcessing}
              >
                {#if isProcessing}
                  <svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Importing...
                {:else}
                  Import Time Standards
                {/if}
              </Button>
            {/if}
          </div>
        </div>
      </div>
    </div>
  </div>
{/if} 