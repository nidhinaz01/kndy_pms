<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import Button from '$lib/components/common/Button.svelte';
  import { supabase } from '$lib/supabaseClient';
  import { fetchAllStdWorkDetails } from '$lib/api/stdWorkDetails';
  import { generateNextDerivedCode } from '$lib/api/stdWorkTypeDetails';

  export let showImportModal: boolean;
  export let onClose: () => void;
  export let onImportSuccess: () => void;

  let file: File | null = null;
  let isDragOver = false;
  let isProcessing = false;
  let errorMsg = '';
  let successMsg = '';
  let baseWorks: any[] = [];

  const dispatch = createEventDispatcher();

  // Load base works for validation
  async function loadBaseWorks() {
    try {
      baseWorks = await fetchAllStdWorkDetails();
    } catch (error) {
      console.error('Error loading base works:', error);
    }
  }

  function handleDragOver(e: DragEvent) {
    e.preventDefault();
    isDragOver = true;
  }

  function handleDragLeave(e: DragEvent) {
    e.preventDefault();
    isDragOver = false;
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault();
    isDragOver = false;
    
    if (e.dataTransfer?.files) {
      file = e.dataTransfer.files[0];
    }
  }

  function handleFileSelect(e: Event) {
    const target = e.target as HTMLInputElement;
    if (target.files) {
      file = target.files[0];
    }
  }

  function downloadTemplate() {
    const headers = ['Base Work Code', 'Type Description'];
    const csvContent = headers.join(',') + '\n' +
      'P001,Type A\n' +
      'P002,Type B\n' +
      'P003,Type C';
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'derivative_works_template.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  }

  async function processFile() {
    console.log('Starting derivative works import process...');
    
    if (!file) {
      errorMsg = 'Please select a file to import.';
      console.log('No file selected');
      return;
    }

    if (!file.name.endsWith('.csv')) {
      errorMsg = 'Please select a CSV file.';
      console.log('File is not CSV:', file.name);
      return;
    }

    console.log('Processing file:', file.name);
    isProcessing = true;
    errorMsg = '';
    successMsg = '';

    try {
      const text = await file.text();
      const lines = text.split('\n').filter(line => line.trim());
      console.log('File content lines:', lines.length);
      
      if (lines.length < 2) {
        throw new Error('File must contain at least a header row and one data row.');
      }

      const headers = lines[0].split(',').map(h => h.trim());
      const expectedHeaders = ['Base Work Code', 'Type Description'];
      console.log('File headers:', headers);
      console.log('Expected headers:', expectedHeaders);
      
      if (!expectedHeaders.every(h => headers.includes(h))) {
        throw new Error('File must contain columns: Base Work Code, Type Description');
      }

      const { getCurrentUsername, getCurrentTimestamp } = await import('$lib/utils/userUtils');
      const username = getCurrentUsername();
      const now = getCurrentTimestamp();
      console.log('Username:', username);
      console.log('Available base works:', baseWorks.length);

      const records = [];
      const errors = [];
      const baseWorkCodeCounts = new Map<string, number>(); // Track how many derivatives for each base work

      // First pass: validate all data and count derivatives per base work
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const values = line.split(',').map(v => v.trim());
        console.log(`Processing row ${i + 1}:`, values);
        
        if (values.length < 2) {
          errors.push(`Row ${i + 1}: Insufficient data`);
          continue;
        }

        const [baseWorkCode, typeDescription] = values;
        console.log(`Row ${i + 1} - Base Work Code: "${baseWorkCode}", Type Description: "${typeDescription}"`);

        // Validate base work code exists
        const baseWork = baseWorks.find(w => w.sw_code === baseWorkCode);
        console.log(`Base work found for "${baseWorkCode}":`, baseWork ? 'Yes' : 'No');
        
        if (!baseWork) {
          errors.push(`Row ${i + 1}: Base work code "${baseWorkCode}" not found`);
          continue;
        }

        // Validate type description
        if (!typeDescription || typeDescription.length > 100) {
          errors.push(`Row ${i + 1}: Type description must be between 1 and 100 characters`);
          continue;
        }

        // Count derivatives for this base work
        baseWorkCodeCounts.set(baseWorkCode, (baseWorkCodeCounts.get(baseWorkCode) || 0) + 1);
      }

      if (errors.length > 0) {
        throw new Error(`Validation failed with ${errors.length} errors:\n${errors.join('\n')}`);
      }

      // Second pass: generate derived codes and create records
      const baseWorkCodeSuffixes = new Map<string, string[]>(); // Track used suffixes for each base work
      
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const values = line.split(',').map(v => v.trim());
        const [baseWorkCode, typeDescription] = values;

        // Generate derived code with proper sequencing
        try {
          console.log(`Generating derived code for base work: ${baseWorkCode}`);
          
          // Get existing derivatives for this base work (only once per base work)
          if (!baseWorkCodeSuffixes.has(baseWorkCode)) {
            const { data: existingDerivatives, error: fetchError } = await supabase
              .from('std_work_type_details')
              .select('derived_sw_code')
              .eq('sw_code', baseWorkCode)
              .eq('is_deleted', false)
              .order('derived_sw_code');

            if (fetchError) throw fetchError;

            const existingCodes = existingDerivatives || [];
            const existingSuffixes = existingCodes.map(item => {
              const suffix = item.derived_sw_code.substring(baseWorkCode.length);
              return suffix;
            });
            
            baseWorkCodeSuffixes.set(baseWorkCode, [...existingSuffixes]);
            console.log(`Loaded existing suffixes for ${baseWorkCode}:`, existingSuffixes);
          }
          
          const usedSuffixes = baseWorkCodeSuffixes.get(baseWorkCode) || [];
          
          // Generate next suffix (A, B, C, ..., Z, AA, AB, ...)
          let nextSuffix = 'A';
          let found = false;
          let attempts = 0;
          
          while (!found && attempts < 1000) { // Safety limit
            attempts++;
            if (!usedSuffixes.includes(nextSuffix)) {
              found = true;
            } else {
              // Increment suffix
              if (nextSuffix.length === 1) {
                if (nextSuffix === 'Z') {
                  nextSuffix = 'AA';
                } else {
                  nextSuffix = String.fromCharCode(nextSuffix.charCodeAt(0) + 1);
                }
              } else {
                // Handle multi-character suffixes (AA, AB, etc.)
                const lastChar = nextSuffix[nextSuffix.length - 1];
                if (lastChar === 'Z') {
                  // Increment the first character and reset the second
                  const firstChar = nextSuffix[0];
                  if (firstChar === 'Z') {
                    // Add another character
                    nextSuffix = 'A' + 'A'.repeat(nextSuffix.length);
                  } else {
                    nextSuffix = String.fromCharCode(firstChar.charCodeAt(0) + 1) + 'A'.repeat(nextSuffix.length - 1);
                  }
                } else {
                  nextSuffix = nextSuffix.slice(0, -1) + String.fromCharCode(lastChar.charCodeAt(0) + 1);
                }
              }
            }
          }

          if (!found) {
            throw new Error('Unable to generate unique derived code');
          }

          const derivedCode = `${baseWorkCode}${nextSuffix}`;
          console.log(`Generated derived code: ${derivedCode}`);
          
          // Add this suffix to our tracking list to avoid duplicates in the same batch
          usedSuffixes.push(nextSuffix);
          baseWorkCodeSuffixes.set(baseWorkCode, usedSuffixes);
          
          const record = {
            sw_code: baseWorkCode,
            type_description: typeDescription,
            derived_sw_code: derivedCode,
            is_active: true,
            is_deleted: false,
            created_by: username,
            created_dt: now,
            // modified_by and modified_dt should equal created_by and created_dt on insert
            modified_by: username,
            modified_dt: now
          };
          
          records.push(record);
          console.log(`Added record for row ${i + 1}:`, record);
        } catch (error) {
          console.error(`Error generating derived code for row ${i + 1}:`, error);
          errors.push(`Row ${i + 1}: Error generating derived code: ${error}`);
        }
      }

      console.log(`Processing complete. Records: ${records.length}, Errors: ${errors.length}`);
      
      if (errors.length > 0) {
        console.error('Import errors:', errors);
        throw new Error(`Import failed with ${errors.length} errors:\n${errors.join('\n')}`);
      }

      if (records.length === 0) {
        throw new Error('No valid records to import.');
      }

      console.log('Inserting records into database:', records);
      
      // Insert records
      const { error: insertError } = await supabase
        .from('std_work_type_details')
        .insert(records);

      if (insertError) {
        console.error('Database insert error:', insertError);
        throw new Error(`Database error: ${insertError.message}`);
      }

      console.log('Import successful!');
      successMsg = `Successfully imported ${records.length} derivative works.`;
      file = null;
      
      setTimeout(() => {
        onImportSuccess();
      }, 1500);

    } catch (error: any) {
      console.error('Import process error:', error);
      errorMsg = error.message;
    } finally {
      isProcessing = false;
    }
  }

  function handleClose() {
    file = null;
    isDragOver = false;
    isProcessing = false;
    errorMsg = '';
    successMsg = '';
    onClose();
  }

  // Load base works when modal opens
  $: if (showImportModal) {
    loadBaseWorks();
  }
</script>

{#if showImportModal}
  <div class="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
    <div class="theme-bg-primary rounded-2xl shadow-2xl p-8 w-[40rem] max-h-[90vh] overflow-y-auto animate-fade-in">
      <div class="flex items-center justify-between mb-6">
        <div class="font-bold text-lg theme-text-accent flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 theme-text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
          Import Derivative Works
        </div>
        <button class="theme-text-secondary hover:theme-text-accent transition-colors" on:click={handleClose} aria-label="Close modal">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

        {#if errorMsg}
          <div class="mb-4 p-3 bg-red-100 dark:bg-red-900/30 border border-red-400 dark:border-red-700 text-red-700 dark:text-red-200 rounded">
            {errorMsg}
          </div>
        {/if}

        {#if successMsg}
          <div class="mb-4 p-3 bg-green-100 dark:bg-green-900/30 border border-green-400 dark:border-green-700 text-green-700 dark:text-green-200 rounded">
            {successMsg}
          </div>
        {/if}

      <div class="space-y-6">
        <!-- Template Download -->
        <div>
          <h3 class="text-md font-semibold theme-text-primary mb-3">Step 1: Download Template</h3>
          <p class="text-sm theme-text-secondary mb-3">
            Download the template file to see the required format. Base Work Code and Type Description are mandatory.
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
          <h3 class="text-md font-semibold theme-text-primary mb-3">Step 2: Upload File</h3>
          <div
            role="button"
            tabindex="0"
            class={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
              isDragOver 
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' 
                : 'theme-border hover:border-blue-400'
            }`}
            on:dragover={handleDragOver}
            on:dragleave={handleDragLeave}
            on:drop={handleDrop}
            on:keydown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                document.getElementById('derivativeFileInput')?.click();
              }
            }}
            aria-label="File upload area. Drag and drop your CSV file here, or press Enter to browse files."
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="h-12 w-12 mx-auto mb-4 theme-text-tertiary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            <p class="theme-text-primary mb-2">
              {file ? file.name : 'Drag and drop your CSV file here, or click to browse'}
            </p>
            <p class="text-sm theme-text-secondary mb-4">
              Only CSV files are supported. Maximum file size: 5MB
            </p>
            <input
              type="file"
              accept=".csv"
              on:change={handleFileSelect}
              class="hidden"
              id="derivativeFileInput"
            />
            <Button 
              variant="primary" 
              size="md"
              on:click={() => {
                console.log('Choose File button clicked');
                document.getElementById('derivativeFileInput')?.click();
              }}
            >
              Choose File
            </Button>
          </div>
        </div>

        <!-- Import Instructions -->
        <div>
          <h3 class="text-md font-semibold theme-text-primary mb-3">Import Instructions</h3>
          <div class="text-xs mb-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <p class="font-semibold mb-1 text-gray-800 dark:text-gray-200">Important Notes:</p>
            <ul class="list-disc list-inside space-y-1 text-gray-700 dark:text-gray-300">
              <li>CSV must contain columns: <strong class="text-gray-900 dark:text-gray-100">Base Work Code, Type Description</strong></li>
              <li>Base Work Code must exist in the system</li>
              <li>Type Description must be 1-100 characters</li>
              <li>Derived codes will be automatically generated</li>
              <li>All imported works will be set as active</li>
            </ul>
          </div>
        </div>

        <!-- Action Buttons -->
        <div class="flex justify-between gap-3 pt-4">
          <Button 
            variant="primary" 
            size="md" 
            disabled={isProcessing || !file}
            on:click={processFile}
          >
            {isProcessing ? 'Importing...' : 'Import Derivative Works'}
          </Button>
          <Button variant="secondary" size="md" on:click={handleClose}>Cancel</Button>
        </div>
      </div>
    </div>
  </div>
{/if}

<style>
  @keyframes fade-in {
    from { opacity: 0; transform: translateY(20px); }
    to { opacity: 1; transform: translateY(0); }
  }
  .animate-fade-in {
    animation: fade-in 0.2s ease;
  }
</style> 