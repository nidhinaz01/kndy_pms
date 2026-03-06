<script lang="ts">
  import { supabase } from '$lib/supabaseClient';
  import { onMount } from 'svelte';
  
  export let showEditModal: boolean;
  export let selectedModel: any;
  export let onClose: () => void;
  export let onModelUpdated: () => void;

  let formData = {
    is_active: true
  };

  let errors: Record<string, string> = {};
  let isSubmitting = false;

  // Initialize form data when modal opens
  $: if (showEditModal && selectedModel) {
    formData.is_active = selectedModel.is_active;
  }

  async function handleSubmit() {
    if (!selectedModel) return;

    isSubmitting = true;

    try {
      const username = localStorage.getItem('username') || 'unknown';
      const currentDate = new Date().toISOString();

      console.log('Updating model status:', {
        id: selectedModel.id,
        is_active: formData.is_active,
        modified_by: username,
        modified_dt: currentDate
      });

      const { data, error } = await supabase
        .from('mstr_wo_type')
        .update({
          is_active: formData.is_active,
          modified_by: username,
          modified_dt: currentDate
        })
        .eq('id', selectedModel.id)
        .select();

      console.log('Supabase response:', { data, error });

      if (error) {
        console.error('Error updating model:', error);
        alert('Failed to update model. Please try again.');
      } else {
        console.log('Model updated successfully');
        onModelUpdated();
      }
    } catch (error) {
      console.error('Exception during model update:', error);
      alert('Failed to update model. Please try again.');
    } finally {
      isSubmitting = false;
    }
  }

  function handleClose() {
    onClose();
  }
</script>

{#if showEditModal && selectedModel}
  <div class="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 transition-opacity duration-200">
    <div class="theme-bg-primary rounded-2xl shadow-2xl p-8 w-[32rem] animate-fade-in transition-colors duration-200">
      <div class="flex items-center justify-between mb-6">
        <div class="font-bold text-lg text-blue-700 dark:text-blue-300 flex items-center gap-2 transition-colors duration-200">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
          Edit Model - {selectedModel.wo_type_name}
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

      <!-- Current Model Details (Read-only) -->
      <div class="theme-bg-tertiary rounded p-4 text-sm transition-colors duration-200 mb-6">
        <h3 class="font-semibold theme-text-primary mb-3">Current Model Details</h3>
        <div class="grid grid-cols-2 gap-4">
          <div>
            <span class="font-semibold theme-text-secondary">Type Code:</span> 
            <span class="theme-text-primary ml-2">{selectedModel.wo_type_code}</span>
          </div>
          <div>
            <span class="font-semibold theme-text-secondary">Type Name:</span> 
            <span class="theme-text-primary ml-2">{selectedModel.wo_type_name}</span>
          </div>
          <div>
            <span class="font-semibold theme-text-secondary">Comfort Level:</span> 
            <span class="theme-text-primary ml-2">{selectedModel.wo_comfort_level}</span>
          </div>
          <div>
            <span class="font-semibold theme-text-secondary">Capacity:</span> 
            <span class="theme-text-primary ml-2">{selectedModel.wo_capacity}</span>
          </div>
          <div>
            <span class="font-semibold theme-text-secondary">Carrier Type:</span> 
            <span class="theme-text-primary ml-2">{selectedModel.wo_carrier_type}</span>
          </div>
        </div>
      </div>

      <form on:submit|preventDefault={handleSubmit} class="space-y-4">
        <div>
          <label for="is_active" class="block text-sm font-medium theme-text-primary mb-1">Status *</label>
          <select 
            id="is_active"
            bind:value={formData.is_active}
            class="w-full border theme-border rounded px-3 py-2 theme-bg-secondary theme-text-primary transition-colors duration-200 focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-800 focus:outline-none"
            required
          >
            <option value={true}>Active</option>
            <option value={false}>Inactive</option>
          </select>
          {#if errors.is_active}
            <p class="text-red-500 text-xs mt-1">{errors.is_active}</p>
          {/if}
        </div>

        <div class="flex justify-between gap-3 pt-4">
          <button 
            type="submit"
            class="px-4 py-2 bg-blue-500 text-white rounded-lg border-2 border-blue-500 shadow hover:bg-blue-600 hover:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-800 active:bg-blue-700 active:border-blue-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={isSubmitting}
          >
            {#if isSubmitting}
              <svg class="animate-spin -ml-1 mr-3 h-5 w-5 text-white inline" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Updating...
            {:else}
              Update Model
            {/if}
          </button>
          <button 
            type="button"
            class="px-4 py-2 bg-gray-500 text-white rounded-lg border-2 border-gray-500 shadow hover:bg-gray-600 hover:border-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-200 dark:focus:ring-gray-800 active:bg-gray-700 active:border-gray-700 transition-all duration-200"
            on:click={handleClose}
          >
            Cancel
          </button>
        </div>
      </form>
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