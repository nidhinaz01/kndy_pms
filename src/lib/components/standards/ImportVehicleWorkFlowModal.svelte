<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import Button from '$lib/components/common/Button.svelte';
  import { saveVehicleWorkFlow } from '$lib/api/stdVehicleWorkFlow';
  import { getDetailedTimeBreakdownForDerivativeWork } from '$lib/api/stdSkillTimeStandards';
  import { supabase } from '$lib/supabaseClient';

  export let showImportModal: boolean;
  export let onClose: () => void;
  export let onImportSuccess: () => void;

  const dispatch = createEventDispatcher();

  let selectedFile: File | null = null;
  let isImporting = false;
  let importResults = { success: 0, errors: [] as string[] };
  let showResults = false;

  function downloadTemplate() {
    const headers = ['Vehicle Type ID', 'Derived Work Code', 'Sequence Order', 'Dependency Derived Work Code'];
    const csvContent = headers.join(',') + '\n' +
      '1,P001A,1,\n' +
      '1,P002A,2,P001A\n' +
      '1,P003A,3,P002A';
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'vehicle_work_flows_template.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  }

  function handleFileSelect(event: Event) {
    const target = event.target as HTMLInputElement;
    if (target.files && target.files[0]) {
      selectedFile = target.files[0];
    }
  }

  async function validateAndImport() {
    if (!selectedFile) {
      importResults.errors = ['Please select a file to import.'];
      showResults = true;
      return;
    }

    isImporting = true;
    importResults = { success: 0, errors: [] };

    try {
      const text = await selectedFile.text();
      const lines = text.split('\n').filter(line => line.trim());
      
      if (lines.length < 2) {
        importResults.errors = ['File must contain at least a header row and one data row.'];
        showResults = true;
        return;
      }

      const headers = lines[0].split(',').map(h => h.trim());
      const expectedHeaders = ['Vehicle Type ID', 'Derived Work Code', 'Sequence Order', 'Dependency Derived Work Code'];
      
      if (!expectedHeaders.every(header => headers.includes(header))) {
        importResults.errors = ['Invalid CSV format. Please use the template provided.'];
        showResults = true;
        return;
      }

      // Parse data rows
      const dataRows = lines.slice(1);
      let successCount = 0;
      const errors: string[] = [];

      for (let i = 0; i < dataRows.length; i++) {
        const row = dataRows[i];
        const values = row.split(',').map(v => v.trim());
        
        if (values.length !== 4) {
          errors.push(`Row ${i + 2}: Invalid number of columns`);
          continue;
        }

        const [vehicleTypeId, derivedWorkCode, sequenceOrder, dependencyCode] = values;

        // Validate data
        if (!vehicleTypeId || !derivedWorkCode || !sequenceOrder) {
          errors.push(`Row ${i + 2}: Missing required fields`);
          continue;
        }

        const woTypeId = parseInt(vehicleTypeId);
        const seqOrder = parseInt(sequenceOrder);

        if (isNaN(woTypeId) || isNaN(seqOrder)) {
          errors.push(`Row ${i + 2}: Invalid numeric values`);
          continue;
        }

        if (seqOrder <= 0) {
          errors.push(`Row ${i + 2}: Sequence order must be greater than 0`);
          continue;
        }

        // Validate vehicle type exists
        const { data: vehicleType, error: vehicleError } = await supabase
          .from('mstr_wo_type')
          .select('id')
          .eq('id', woTypeId)
          .eq('is_deleted', false)
          .eq('is_active', true)
          .maybeSingle();

        if (vehicleError || !vehicleType) {
          errors.push(`Row ${i + 2}: Vehicle type ID ${woTypeId} not found`);
          continue;
        }

        // Validate derived work exists
        const { data: derivedWork, error: workError } = await supabase
          .from('std_work_type_details')
          .select('derived_sw_code')
          .eq('derived_sw_code', derivedWorkCode)
          .eq('is_deleted', false)
          .maybeSingle();

        if (workError || !derivedWork) {
          errors.push(`Row ${i + 2}: Derived work code ${derivedWorkCode} not found`);
          continue;
        }

        // Validate dependency if provided
        if (dependencyCode) {
          const { data: dependencyWork, error: depError } = await supabase
            .from('std_work_type_details')
            .select('derived_sw_code')
            .eq('derived_sw_code', dependencyCode)
            .eq('is_deleted', false)
            .maybeSingle();

          if (depError || !dependencyWork) {
            errors.push(`Row ${i + 2}: Dependency work code ${dependencyCode} not found`);
            continue;
          }
        }

        // Check for duplicate sequence order
        const { data: existing, error: checkError } = await supabase
          .from('std_vehicle_work_flow')
          .select('vwf_id')
          .eq('wo_type_id', woTypeId)
          .eq('sequence_order', seqOrder)
          .eq('is_deleted', false)
          .maybeSingle();

        if (checkError) {
          errors.push(`Row ${i + 2}: Error checking for duplicates`);
          continue;
        }

        if (existing) {
          errors.push(`Row ${i + 2}: Sequence order ${seqOrder} already exists for vehicle type ${woTypeId}`);
          continue;
        }

        // Auto-calculate duration from time standards
        let durationMinutes = 0;
        try {
          const timeBreakdown = await getDetailedTimeBreakdownForDerivativeWork(derivedWorkCode);
          durationMinutes = timeBreakdown.totalMinutes;
          
          if (durationMinutes <= 0) {
            errors.push(`Row ${i + 2}: No time standards found for ${derivedWorkCode}. Please add time standards first.`);
            continue;
          }
        } catch (error: any) {
          errors.push(`Row ${i + 2}: Failed to calculate duration for ${derivedWorkCode}: ${error.message}`);
          continue;
        }

        // Save the work flow
        try {
          await saveVehicleWorkFlow({
            wo_type_id: woTypeId,
            derived_sw_code: derivedWorkCode,
            sequence_order: seqOrder,
            dependency_derived_sw_code: dependencyCode || undefined,
            estimated_duration_minutes: durationMinutes
          });
          successCount++;
        } catch (error: any) {
          errors.push(`Row ${i + 2}: ${error.message || 'Error saving work flow'}`);
        }
      }

      importResults.success = successCount;
      importResults.errors = errors;
      showResults = true;

      if (successCount > 0) {
        onImportSuccess();
      }
    } catch (error: any) {
      importResults.errors = [`Import failed: ${error.message || 'Unknown error'}`];
      showResults = true;
    } finally {
      isImporting = false;
    }
  }

  function handleClose() {
    selectedFile = null;
    isImporting = false;
    importResults = { success: 0, errors: [] };
    showResults = false;
    onClose();
  }
</script>

{#if showImportModal}
  <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
    <div class="theme-bg-primary rounded-lg shadow-xl max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
      <div class="p-6">
        <div class="flex items-center justify-between mb-6">
          <h2 class="text-xl font-semibold theme-text-primary">Import Vehicle Work Flows</h2>
          <button
            on:click={handleClose}
            class="theme-text-secondary hover:theme-text-primary transition-colors"
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
              Download the CSV template and fill it with your vehicle work flow data.
            </p>
            <Button variant="secondary" size="md" on:click={downloadTemplate}>
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Download Template
            </Button>
          </div>

          <!-- File Upload -->
          <div>
            <h3 class="text-lg font-medium theme-text-primary mb-2">Upload CSV File</h3>
            <input
              type="file"
              accept=".csv"
              on:change={handleFileSelect}
              class="w-full border theme-border rounded px-3 py-2 theme-bg-secondary theme-text-primary"
            />
            {#if selectedFile}
              <p class="text-sm theme-text-secondary mt-2">Selected: {selectedFile.name}</p>
            {/if}
          </div>

          <!-- Import Instructions -->
          <div>
            <h3 class="text-lg font-medium theme-text-primary mb-2">Import Instructions</h3>
            <div class="text-sm theme-text-secondary space-y-2">
              <p>• CSV must contain columns: <strong>Vehicle Type ID, Derived Work Code, Sequence Order, Dependency Derived Work Code</strong></p>
              <p>• Vehicle Type ID must exist in the system</p>
              <p>• Derived Work Code must exist in the system</p>
              <p>• Sequence Order must be greater than 0</p>
              <p>• Dependency Derived Work Code is optional</p>
              <p>• Estimated Duration will be auto-calculated from time standards</p>
            </div>
          </div>

          <!-- Import Results -->
          {#if showResults}
            <div class="border theme-border rounded-lg p-4">
              <h3 class="text-lg font-medium theme-text-primary mb-2">Import Results</h3>
              {#if importResults.success > 0}
                <div class="bg-green-100 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3 mb-3">
                  <p class="text-green-700 dark:text-green-300 text-sm">
                    Successfully imported {importResults.success} work flow(s).
                  </p>
                </div>
              {/if}
              {#if importResults.errors.length > 0}
                <div class="bg-red-100 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
                  <p class="text-red-700 dark:text-red-300 text-sm font-medium mb-2">Errors:</p>
                  <ul class="text-red-700 dark:text-red-300 text-sm space-y-1">
                    {#each importResults.errors as error}
                      <li>• {error}</li>
                    {/each}
                  </ul>
                </div>
              {/if}
            </div>
          {/if}

          <!-- Action Buttons -->
          <div class="flex justify-end gap-3 pt-4">
            <Button variant="secondary" size="md" on:click={handleClose}>Close</Button>
            <Button 
              variant="primary" 
              size="md" 
              on:click={validateAndImport}
              disabled={isImporting || !selectedFile}
            >
              {isImporting ? 'Importing...' : 'Import'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  </div>
{/if} 