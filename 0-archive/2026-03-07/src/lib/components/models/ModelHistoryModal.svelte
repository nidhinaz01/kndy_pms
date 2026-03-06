<script lang="ts">
  import { supabase } from '$lib/supabaseClient';
  import { onMount } from 'svelte';
  import { formatDate } from '$lib/utils/formatDate';
  
  export let selectedRow: any;
  export let onClose: () => void;

  let historyData: any[] = [];
  let isLoading = false;

  async function loadHistory() {
    if (!selectedRow) return;

    isLoading = true;
    try {
      const { data, error } = await supabase
        .from('mstr_wo_type_his')
        .select('*')
        .eq('id', selectedRow.id)
        .order('modified_dt', { ascending: false });

      if (error) {
        console.error('Error loading history:', error);
        historyData = [];
      } else {
        historyData = data || [];
      }
    } catch (error) {
      console.error('Error loading history:', error);
      historyData = [];
    } finally {
      isLoading = false;
    }
  }

  onMount(() => {
    if (selectedRow) {
      loadHistory();
    }
  });

  $: if (selectedRow) {
    loadHistory();
  }
</script>

{#if selectedRow}
  <div class="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 transition-opacity duration-200">
    <div class="theme-bg-primary rounded-2xl shadow-2xl p-8 w-[40rem] max-h-[80vh] overflow-y-auto animate-fade-in transition-colors duration-200">
      <div class="flex items-center justify-between mb-6">
        <div class="font-bold text-lg text-blue-700 dark:text-blue-300 flex items-center gap-2 transition-colors duration-200">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 17v-2a2 2 0 012-2h2a2 2 0 012 2v2m-6 4h6a2 2 0 002-2v-6a2 2 0 00-2-2h-2a2 2 0 00-2 2v6a2 2 0 002 2z" />
          </svg>
          Model History - {selectedRow.wo_type_name}
        </div>
        <button 
          class="text-gray-400 hover:text-blue-500 dark:hover:text-blue-400 transition-colors duration-200" 
          on:click={onClose} 
          aria-label="Close modal"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <!-- Current Model Details -->
      <div class="theme-bg-tertiary rounded p-4 text-sm transition-colors duration-200 mb-6">
        <h3 class="font-semibold theme-text-primary mb-3">Current Model Details</h3>
        <div class="grid grid-cols-2 gap-4">
          <div>
            <span class="font-semibold theme-text-secondary">Type Code:</span> 
            <span class="theme-text-primary ml-2">{selectedRow.wo_type_code}</span>
          </div>
          <div>
            <span class="font-semibold theme-text-secondary">Type Name:</span> 
            <span class="theme-text-primary ml-2">{selectedRow.wo_type_name}</span>
          </div>
          <div>
            <span class="font-semibold theme-text-secondary">Comfort Level:</span> 
            <span class="theme-text-primary ml-2">{selectedRow.wo_comfort_level}</span>
          </div>
          <div>
            <span class="font-semibold theme-text-secondary">Capacity:</span> 
            <span class="theme-text-primary ml-2">{selectedRow.wo_capacity}</span>
          </div>
          <div>
            <span class="font-semibold theme-text-secondary">Carrier Type:</span> 
            <span class="theme-text-primary ml-2">{selectedRow.wo_carrier_type}</span>
          </div>
          <div>
            <span class="font-semibold theme-text-secondary">Modified By:</span> 
            <span class="theme-text-primary ml-2">{selectedRow.modified_by}</span>
          </div>
          <div>
            <span class="font-semibold theme-text-secondary">Modified Date:</span> 
            <span class="theme-text-primary ml-2">{formatDate(selectedRow.modified_dt)}</span>
          </div>
        </div>
      </div>

      <!-- History Table -->
      <div>
        <h3 class="font-semibold theme-text-primary mb-3">History Records</h3>
        {#if isLoading}
          <div class="flex items-center justify-center p-4">
            <div class="text-center">
              <div class="animate-spin rounded-full h-6 w-6 border-b-2 theme-accent mx-auto mb-2"></div>
              <p class="theme-text-primary text-sm">Loading history...</p>
            </div>
          </div>
        {:else if historyData.length === 0}
          <div class="text-center p-4">
            <p class="theme-text-secondary">No history records found for this model.</p>
          </div>
        {:else}
          <div class="overflow-x-auto">
            <table class="min-w-full table-auto border-separate border-spacing-y-1">
              <thead>
                <tr class="theme-bg-secondary theme-text-primary text-xs transition-colors duration-200">
                  <th class="px-3 py-2 text-left">Type Code</th>
                  <th class="px-3 py-2 text-left">Type Name</th>
                  <th class="px-3 py-2 text-left">Comfort Level</th>
                  <th class="px-3 py-2 text-left">Capacity</th>
                  <th class="px-3 py-2 text-left">Carrier Type</th>
                  <th class="px-3 py-2 text-left">Modified By</th>
                  <th class="px-3 py-2 text-left">Modified Date</th>
                </tr>
              </thead>
              <tbody>
                {#each historyData as record}
                  <tr class="theme-bg-primary transition-colors duration-200">
                    <td class="px-3 py-2 theme-text-primary text-xs">{record.wo_type_code || '-'}</td>
                    <td class="px-3 py-2 theme-text-primary text-xs">{record.wo_type_name || '-'}</td>
                    <td class="px-3 py-2 theme-text-primary text-xs">{record.wo_comfort_level || '-'}</td>
                    <td class="px-3 py-2 theme-text-primary text-xs">{record.wo_capacity || '-'}</td>
                    <td class="px-3 py-2 theme-text-primary text-xs">{record.wo_carrier_type || '-'}</td>
                    <td class="px-3 py-2 theme-text-primary text-xs">{record.modified_by || '-'}</td>
                    <td class="px-3 py-2 theme-text-primary text-xs">
                      {record.modified_dt ? formatDate(record.modified_dt) : '-'}
                    </td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        {/if}
      </div>

      <div class="flex justify-end mt-6">
        <button 
          class="px-4 py-2 bg-gray-500 text-white rounded-lg border-2 border-gray-500 shadow hover:bg-gray-600 hover:border-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-200 dark:focus:ring-gray-800 active:bg-gray-700 active:border-gray-700 transition-all duration-200" 
          on:click={onClose}
        >
          Close
        </button>
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