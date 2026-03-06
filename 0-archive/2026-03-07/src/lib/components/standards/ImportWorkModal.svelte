<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import Button from '$lib/components/common/Button.svelte';
  import { exportToCSV } from '$lib/utils/exportUtils';
  import { importWorkDetails, type WorkImportResult, type WorkImportData, fetchPlantStages } from '$lib/api/stdWorkDetails';

  export let showImportModal: boolean;
  export let onClose: () => void;
  export let onImportSuccess: () => void;

  const dispatch = createEventDispatcher();

  let selectedFile: File | null = null;
  let isImporting = false;
  let importResults: WorkImportResult | null = null;
  let dragOver = false;
  let availablePlantStages: string[] = [];
  let isLoadingPlantStages = false;

  async function loadPlantStages() {
    isLoadingPlantStages = true;
    try {
      availablePlantStages = await fetchPlantStages();
    } catch (error) {
      console.error('Error loading plant stages:', error);
      availablePlantStages = [];
    } finally {
      isLoadingPlantStages = false;
    }
  }

  // Load plant stages when modal opens
  $: if (showImportModal && availablePlantStages.length === 0) {
    loadPlantStages();
  }

  // Debug: Check if file input exists when modal opens
  $: if (showImportModal) {
    setTimeout(() => {
      const fileInput = document.getElementById('fileInput');
      console.log('File input element:', fileInput);
      console.log('Modal is open:', showImportModal);
    }, 100);
  }

  function downloadTemplate() {
    const headers = ['Work Code', 'Work Name', 'Plant Stage', 'Work Type', 'Sequence Number (Optional)'];
    const sampleData = [
      ['W001', 'Sample Work 1', 'Stage 1', 'Parent', ''],
      ['W002', 'Sample Work 2', 'Stage 2', 'Mother', '1'],
      ['W003', 'Sample Work 3', 'Stage 3', 'Child', '']
    ];

    exportToCSV(
      sampleData,
      headers,
      'works_template',
      (row) => row
    );
  }

  function handleFileSelect(event: Event) {
    console.log('File select handler called', event);
    const target = event.target as HTMLInputElement;
    console.log('Target files:', target.files);
    if (target.files && target.files[0]) {
      selectedFile = target.files[0];
      importResults = null;
      console.log('File selected:', selectedFile.name);
    }
  }

  function handleDragOver(event: DragEvent) {
    event.preventDefault();
    dragOver = true;
  }

  function handleDragLeave(event: DragEvent) {
    event.preventDefault();
    dragOver = false;
  }

  function handleDrop(event: DragEvent) {
    event.preventDefault();
    dragOver = false;
    
    if (event.dataTransfer?.files && event.dataTransfer.files[0]) {
      selectedFile = event.dataTransfer.files[0];
      importResults = null;
    }
  }

  async function handleImport() {
    if (!selectedFile) {
      alert('Please select a file to import.');
      return;
    }

    isImporting = true;
    importResults = null;

    try {
      const text = await selectedFile.text();
      const lines = text.split('\n').filter(line => line.trim());
      
      if (lines.length < 2) {
        throw new Error('File must contain at least a header row and one data row.');
      }

      // Parse CSV
      const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
      const expectedHeaders = ['Work Code', 'Work Name', 'Plant Stage', 'Work Type', 'Sequence Number (Optional)'];
      
      // Validate headers
      const missingHeaders = expectedHeaders.filter(h => !headers.includes(h));
      if (missingHeaders.length > 0) {
        throw new Error(`Missing required columns: ${missingHeaders.join(', ')}`);
      }

      const workDetails: WorkImportData[] = [];
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const values = line.split(',').map(v => v.trim().replace(/"/g, ''));
        if (values.length < 5) continue;

        const seqNo = values[4] ? parseInt(values[4]) : undefined;
        
        workDetails.push({
          sw_code: values[0],
          sw_name: values[1],
          plant_stage: values[2],
          sw_type: values[3] as 'Parent' | 'Mother' | 'Child',
          sw_seq_no: seqNo
        });
      }

      if (workDetails.length === 0) {
        throw new Error('No valid data rows found in the file.');
      }

      // Get current username (throws error if not found)
      const { getCurrentUsername } = await import('$lib/utils/userUtils');
      const username = getCurrentUsername();
      
      // Import the data
      const results = await importWorkDetails(workDetails, username);
      importResults = results;

      if (results.success > 0) {
        onImportSuccess();
      }
    } catch (error) {
      console.error('Import error:', error);
      importResults = {
        success: 0,
        failed: 1,
        errors: [error instanceof Error ? error.message : 'Unknown error occurred']
      };
    } finally {
      isImporting = false;
    }
  }

  function handleClose() {
    selectedFile = null;
    importResults = null;
    isImporting = false;
    onClose();
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
          Import Works
        </div>
        <button class="theme-text-secondary hover:theme-text-accent transition-colors" on:click={handleClose} aria-label="Close modal">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div class="space-y-6">
        <!-- Template Download -->
        <div>
          <h3 class="text-md font-semibold theme-text-primary mb-3">Step 1: Download Template</h3>
          <p class="text-sm theme-text-secondary mb-3">
            Download the template file to see the required format. Work Code, Work Name, Plant Stage, and Work Type are mandatory. 
            Sequence Number is optional and will be auto-generated if not provided.
          </p>
          
          <!-- Available Plant Stages Guide -->
          <div class="mb-3">
            <p class="text-sm font-medium theme-text-primary mb-2">Available Plant Stages:</p>
            {#if isLoadingPlantStages}
              <div class="text-sm theme-text-secondary">Loading plant stages...</div>
            {:else if availablePlantStages.length > 0}
              <div class="flex flex-wrap gap-2">
                {#each availablePlantStages as stage}
                  <span class="px-2 py-1 text-xs bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded border">
                    {stage}
                  </span>
                {/each}
              </div>
            {:else}
              <div class="text-sm text-red-600 dark:text-red-400">No plant stages found in the system.</div>
            {/if}
          </div>

          <div class="text-xs mb-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <p class="font-semibold mb-1 text-gray-800 dark:text-gray-200">Important Notes:</p>
            <ul class="list-disc list-inside space-y-1 text-gray-700 dark:text-gray-300">
              <li>Plant Stage must be one of the values shown above (from sys_data_elements)</li>
              <li>Work Type must be one of: Parent, Mother, Child</li>
              <li>Sequence Number is optional - leave empty to auto-generate</li>
              <li>Work Code must be unique and not exist in the database</li>
            </ul>
          </div>
          <Button variant="secondary" size="md" on:click={downloadTemplate}>
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
              dragOver 
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' 
                : 'theme-border hover:border-blue-400'
            }`}
            on:dragover={handleDragOver}
            on:dragleave={handleDragLeave}
            on:drop={handleDrop}
            on:keydown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                document.getElementById('fileInput')?.click();
              }
            }}
            aria-label="File upload area. Drag and drop your CSV file here, or press Enter to browse files."
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="h-12 w-12 mx-auto mb-4 theme-text-tertiary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            <p class="theme-text-primary mb-2">
              {selectedFile ? selectedFile.name : 'Drag and drop your CSV file here, or click to browse'}
            </p>
            <p class="text-sm theme-text-secondary mb-4">
              Only CSV files are supported. Maximum file size: 5MB
            </p>
            <input
              type="file"
              accept=".csv"
              on:change={handleFileSelect}
              class="hidden"
              id="fileInput"
            />
            <Button 
              variant="primary" 
              size="md"
              on:click={() => {
                console.log('Choose File button clicked');
                document.getElementById('fileInput')?.click();
              }}
            >
              Choose File
            </Button>
          </div>
        </div>

        <!-- Import Results -->
        {#if importResults}
          <div class={`p-4 rounded-lg border ${
            importResults.success > 0 
              ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 border-green-200 dark:border-green-700' 
              : 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200 border-red-200 dark:border-red-700'
          }`}>
            <div class="flex items-center gap-2 mb-2">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span class="font-semibold">
                {importResults.success > 0 ? 'Import Successful' : 'Import Failed'}
              </span>
            </div>
            <p class="mb-2">
              {importResults.success > 0 
                ? `${importResults.success} work(s) imported successfully.`
                : `${importResults.failed} work(s) failed to import.`
              }
            </p>
            {#if importResults.errors.length > 0}
              <div class="mt-3">
                <p class="font-semibold mb-2">Errors:</p>
                <ul class="list-disc list-inside space-y-1 text-sm">
                  {#each importResults.errors as error}
                    <li>{error}</li>
                  {/each}
                </ul>
              </div>
            {/if}
          </div>
        {/if}

        <!-- Action Buttons -->
        <div class="flex justify-between gap-3 pt-4">
          <Button 
            variant="primary" 
            size="md" 
            disabled={!selectedFile || isImporting}
            on:click={handleImport}
          >
            {isImporting ? 'Importing...' : 'Import Works'}
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