<script lang="ts">
  import type { HolidayFormData } from '$lib/api/planning';

  export let showModal: boolean;
  export let onImportSundays: () => void;
  export let onImportCSV: (holidays: HolidayFormData[]) => void;
  export let onClose: () => void;

  let csvData = '';
  let showCSVInput = false;

  function handleImportSundays() {
    onImportSundays();
    onClose();
  }

  function handleImportCSV() {
    try {
      const lines = csvData.trim().split('\n');
      const holidays: HolidayFormData[] = [];
      
      // Skip header row if it exists
      const startIndex = lines[0].includes('Date') || lines[0].includes('Description') ? 1 : 0;
      
      for (let i = startIndex; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        const parts = line.split(',').map(part => part.trim().replace(/"/g, ''));
        if (parts.length < 2) continue;
        
        const dateStr = parts[0];
        const description = parts[1];
        
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) continue;
        
        const monthNames = [
          'January', 'February', 'March', 'April', 'May', 'June',
          'July', 'August', 'September', 'October', 'November', 'December'
        ];
        
        holidays.push({
          dt_day: date.getDate(),
          dt_month: monthNames[date.getMonth()],
          dt_year: date.getFullYear(),
          dt_value: date.toISOString().split('T')[0],
          description: description || 'Imported Holiday',
          is_active: true
        });
      }
      
      if (holidays.length > 0) {
        onImportCSV(holidays);
        onClose();
      } else {
        alert('No valid holidays found in CSV data');
      }
    } catch (error) {
      console.error('Error parsing CSV:', error);
      alert('Error parsing CSV data. Please check the format.');
    }
  }

  function handleClose() {
    csvData = '';
    showCSVInput = false;
    onClose();
  }
</script>

{#if showModal}
  <div class="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 transition-opacity duration-200">
    <div class="theme-bg-primary rounded-2xl shadow-2xl p-8 w-[32rem] max-h-[90vh] overflow-y-auto animate-fade-in transition-colors duration-200">
      <div class="flex items-center justify-between mb-6">
        <div class="font-bold text-lg text-blue-700 dark:text-blue-300 flex items-center gap-2 transition-colors duration-200">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
          </svg>
          Import Holidays
        </div>
        <button 
          class="text-gray-400 hover:text-blue-500 dark:hover:text-blue-400 transition-colors duration-200" 
          on:click={handleClose} 
          aria-label="Close modal"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div class="space-y-6">
        <!-- Add Sundays Option -->
        <div class="border theme-border rounded-lg p-4">
          <h3 class="text-lg font-semibold theme-text-primary mb-2">Quick Add Sundays</h3>
          <p class="text-sm theme-text-secondary mb-4">Add all Sundays from today to 1 year from today</p>
          <button
            class="w-full px-4 py-2 bg-green-500 text-white rounded-lg border-2 border-green-500 shadow hover:bg-green-600 hover:border-green-600 focus:outline-none focus:ring-2 focus:ring-green-200 dark:focus:ring-green-800 active:bg-green-700 active:border-green-700 transition-all duration-200"
            on:click={handleImportSundays}
          >
            Add All Sundays
          </button>
        </div>

        <!-- Import CSV Option -->
        <div class="border theme-border rounded-lg p-4">
          <h3 class="text-lg font-semibold theme-text-primary mb-2">Import from CSV</h3>
          <p class="text-sm theme-text-secondary mb-4">Import holidays from CSV format (Date, Description)</p>
          
          {#if !showCSVInput}
            <button
              class="w-full px-4 py-2 bg-blue-500 text-white rounded-lg border-2 border-blue-500 shadow hover:bg-blue-600 hover:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-800 active:bg-blue-700 active:border-blue-700 transition-all duration-200"
              on:click={() => showCSVInput = true}
            >
              Import CSV
            </button>
          {:else}
            <div class="space-y-4">
              <textarea
                bind:value={csvData}
                rows="8"
                placeholder="Paste CSV data here...&#10;Format: Date,Description&#10;Example:&#10;2024-01-01,New Year's Day&#10;2024-12-25,Christmas"
                class="w-full px-3 py-2 border theme-border rounded theme-bg-secondary theme-text-primary focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-800 focus:outline-none"
              ></textarea>
              <div class="flex gap-2">
                <button
                  class="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg border-2 border-blue-500 shadow hover:bg-blue-600 hover:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-800 active:bg-blue-700 active:border-blue-700 transition-all duration-200"
                  on:click={handleImportCSV}
                >
                  Import
                </button>
                <button
                  class="px-4 py-2 bg-gray-500 text-white rounded-lg border-2 border-gray-500 shadow hover:bg-gray-600 hover:border-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-200 dark:focus:ring-gray-800 active:bg-gray-700 active:border-gray-700 transition-all duration-200"
                  on:click={() => showCSVInput = false}
                >
                  Cancel
                </button>
              </div>
            </div>
          {/if}
        </div>

        <!-- Action Buttons -->
        <div class="flex justify-end">
          <button
            class="px-4 py-2 bg-gray-500 text-white rounded-lg border-2 border-gray-500 shadow hover:bg-gray-600 hover:border-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-200 dark:focus:ring-gray-800 active:bg-gray-700 active:border-gray-700 transition-all duration-200"
            on:click={handleClose}
          >
            Close
          </button>
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