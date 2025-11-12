<script lang="ts">
  import { supabase } from '$lib/supabaseClient';
  import { sanitizeString, isValidTrimmedString } from '$lib/utils/inputSanitization';
  
  export let showAddModal: boolean;
  export let onClose: () => void;
  export let onWorkOrderAdded: () => void;

  let formData = {
    wo_number: '',
    wo_type: '',
    wo_status: '',
    wo_priority: '',
    wo_description: '',
    wo_created_by: '',
    wo_created_date: ''
  };

  let errors: Record<string, string> = {};
  let isSubmitting = false;

  function validateForm(): boolean {
    errors = {};
    
    if (!isValidTrimmedString(formData.wo_number)) {
      errors.wo_number = 'Work Order Number is required';
    }
    
    if (!isValidTrimmedString(formData.wo_type)) {
      errors.wo_type = 'Work Order Type is required';
    }
    
    if (!isValidTrimmedString(formData.wo_status)) {
      errors.wo_status = 'Status is required';
    }
    
    if (!isValidTrimmedString(formData.wo_priority)) {
      errors.wo_priority = 'Priority is required';
    }
    
    if (!isValidTrimmedString(formData.wo_description)) {
      errors.wo_description = 'Description is required';
    }

    return Object.keys(errors).length === 0;
  }

  async function handleSubmit() {
    if (!validateForm()) return;

    isSubmitting = true;

    try {
      const username = localStorage.getItem('username') || 'unknown';
      const currentDate = new Date().toISOString();

      const { data, error } = await supabase
        .from('work_orders')
        .insert({
          wo_number: sanitizeString(formData.wo_number),
          wo_type: sanitizeString(formData.wo_type),
          wo_status: sanitizeString(formData.wo_status),
          wo_priority: sanitizeString(formData.wo_priority),
          wo_description: sanitizeString(formData.wo_description),
          wo_created_by: username,
          wo_created_date: currentDate,
          created_at: currentDate,
          updated_at: currentDate
        })
        .select()
        .single();

      if (error) {
        console.error('Error adding work order:', error);
        alert('Failed to add work order. Please try again.');
      } else {
        // Reset form
        formData = {
          wo_number: '',
          wo_type: '',
          wo_status: '',
          wo_priority: '',
          wo_description: '',
          wo_created_by: '',
          wo_created_date: ''
        };
        errors = {};
        onWorkOrderAdded();
      }
    } catch (error) {
      console.error('Error adding work order:', error);
      alert('Failed to add work order. Please try again.');
    } finally {
      isSubmitting = false;
    }
  }

  function handleClose() {
    // Reset form when closing
    formData = {
      wo_number: '',
      wo_type: '',
      wo_status: '',
      wo_priority: '',
      wo_description: '',
      wo_created_by: '',
      wo_created_date: ''
    };
    errors = {};
    onClose();
  }
</script>

{#if showAddModal}
  <div class="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 transition-opacity duration-200">
    <div class="theme-bg-primary rounded-2xl shadow-2xl p-8 w-[32rem] animate-fade-in transition-colors duration-200">
      <div class="flex items-center justify-between mb-6">
        <div class="font-bold text-lg text-blue-700 dark:text-blue-300 flex items-center gap-2 transition-colors duration-200">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
          </svg>
          Add New Work Order
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

      <form on:submit|preventDefault={handleSubmit} class="space-y-4">
        <div>
          <label for="wo_number" class="block text-sm font-medium theme-text-primary mb-1">Work Order Number *</label>
          <input 
            type="text" 
            bind:value={formData.wo_number}
            class="w-full border theme-border rounded px-3 py-2 theme-bg-secondary theme-text-primary transition-colors duration-200 focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-800 focus:outline-none" 
            placeholder="Enter work order number"
            maxlength="20"
            id="wo_number"
          />
          {#if errors.wo_number}
            <p class="text-red-500 text-xs mt-1">{errors.wo_number}</p>
          {/if}
        </div>

        <div>
          <label for="wo_type" class="block text-sm font-medium theme-text-primary mb-1">Work Order Type *</label>
          <input 
            type="text" 
            bind:value={formData.wo_type}
            class="w-full border theme-border rounded px-3 py-2 theme-bg-secondary theme-text-primary transition-colors duration-200 focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-800 focus:outline-none" 
            placeholder="Enter work order type"
            maxlength="50"
            id="wo_type"
          />
          {#if errors.wo_type}
            <p class="text-red-500 text-xs mt-1">{errors.wo_type}</p>
          {/if}
        </div>

        <div>
          <label for="wo_status" class="block text-sm font-medium theme-text-primary mb-1">Status *</label>
          <select 
            bind:value={formData.wo_status}
            class="w-full border theme-border rounded px-3 py-2 theme-bg-secondary theme-text-primary transition-colors duration-200 focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-800 focus:outline-none"
            id="wo_status"
          >
            <option value="">Select status</option>
            <option value="Open">Open</option>
            <option value="In Progress">In Progress</option>
            <option value="Completed">Completed</option>
            <option value="Cancelled">Cancelled</option>
          </select>
          {#if errors.wo_status}
            <p class="text-red-500 text-xs mt-1">{errors.wo_status}</p>
          {/if}
        </div>

        <div>
          <label for="wo_priority" class="block text-sm font-medium theme-text-primary mb-1">Priority *</label>
          <select 
            bind:value={formData.wo_priority}
            class="w-full border theme-border rounded px-3 py-2 theme-bg-secondary theme-text-primary transition-colors duration-200 focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-800 focus:outline-none"
            id="wo_priority"
          >
            <option value="">Select priority</option>
            <option value="Low">Low</option>
            <option value="Medium">Medium</option>
            <option value="High">High</option>
            <option value="Critical">Critical</option>
          </select>
          {#if errors.wo_priority}
            <p class="text-red-500 text-xs mt-1">{errors.wo_priority}</p>
          {/if}
        </div>

        <div>
          <label for="wo_description" class="block text-sm font-medium theme-text-primary mb-1">Description *</label>
          <textarea 
            bind:value={formData.wo_description}
            class="w-full border theme-border rounded px-3 py-2 theme-bg-secondary theme-text-primary transition-colors duration-200 focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-800 focus:outline-none" 
            placeholder="Enter work order description"
            rows="3"
            maxlength="500"
            id="wo_description"
          ></textarea>
          {#if errors.wo_description}
            <p class="text-red-500 text-xs mt-1">{errors.wo_description}</p>
          {/if}
        </div>

        <div class="flex justify-between gap-3 pt-4">
          <button 
            type="submit"
            class="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 transition-colors duration-200 flex items-center gap-2" 
            disabled={isSubmitting}
          >
            {#if isSubmitting}
              <div class="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              Adding...
            {:else}
              Add Work Order
            {/if}
          </button>
          <button 
            type="button"
            class="px-4 py-2 theme-bg-tertiary theme-text-primary rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors duration-200" 
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