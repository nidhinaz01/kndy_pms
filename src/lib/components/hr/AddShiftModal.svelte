<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import Button from '$lib/components/common/Button.svelte';
  import { saveShift } from '$lib/api/hrShiftMaster';
  import type { HrShiftMasterFormData } from '$lib/api/hrShiftMaster';

  export let showAddModal: boolean;
  export let onClose: () => void;

  const dispatch = createEventDispatcher();

  let formData: HrShiftMasterFormData = {
    shift_name: '',
    shift_code: '',
    start_time: '',
    end_time: ''
  };

  let isSubmitting = false;
  let errorMessage = '';

  function resetForm() {
    formData = {
      shift_name: '',
      shift_code: '',
      start_time: '',
      end_time: ''
    };
    errorMessage = '';
  }

  async function handleSubmit() {
    if (!formData.shift_name.trim() || !formData.shift_code.trim() || !formData.start_time || !formData.end_time) {
      errorMessage = 'Please fill in all required fields.';
      return;
    }

    isSubmitting = true;
    errorMessage = '';

    try {
      const newShift = await saveShift(formData);
      alert('Shift created successfully!');
      resetForm();
      dispatch('itemAdded', newShift);
      onClose();
    } catch (error: any) {
      console.error('Error creating shift:', error);
      errorMessage = error.message || 'Failed to create shift. Please try again.';
    } finally {
      isSubmitting = false;
    }
  }

  function handleClose() {
    resetForm();
    onClose();
  }
</script>

{#if showAddModal}
  <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
    <div class="theme-bg-primary theme-border border rounded-lg shadow-xl w-full max-w-md mx-4">
      <!-- Header -->
      <div class="flex items-center justify-between p-6 border-b theme-border">
        <h2 class="text-xl font-semibold theme-text-primary">Add New Shift</h2>
        <button
          on:click={handleClose}
          class="text-gray-400 hover:theme-text-primary transition-colors duration-200"
          aria-label="Close modal"
        >
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <!-- Form -->
      <form on:submit|preventDefault={handleSubmit} class="p-6 space-y-4">
        <!-- Shift Name -->
        <div>
          <label for="shift_name" class="block text-sm font-medium theme-text-primary mb-2">
            Shift Name *
          </label>
          <input
            id="shift_name"
            type="text"
            bind:value={formData.shift_name}
            placeholder="e.g., Morning Shift"
            class="w-full px-3 py-2 border theme-border rounded theme-bg-secondary theme-text-primary focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
        </div>

        <!-- Shift Code -->
        <div>
          <label for="shift_code" class="block text-sm font-medium theme-text-primary mb-2">
            Shift Code *
          </label>
          <input
            id="shift_code"
            type="text"
            bind:value={formData.shift_code}
            placeholder="e.g., MS001"
            class="w-full px-3 py-2 border theme-border rounded theme-bg-secondary theme-text-primary focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
        </div>

        <!-- Start Time -->
        <div>
          <label for="start_time" class="block text-sm font-medium theme-text-primary mb-2">
            Start Time *
          </label>
          <input
            id="start_time"
            type="time"
            bind:value={formData.start_time}
            class="w-full px-3 py-2 border theme-border rounded theme-bg-secondary theme-text-primary focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
        </div>

        <!-- End Time -->
        <div>
          <label for="end_time" class="block text-sm font-medium theme-text-primary mb-2">
            End Time *
          </label>
          <input
            id="end_time"
            type="time"
            bind:value={formData.end_time}
            class="w-full px-3 py-2 border theme-border rounded theme-bg-secondary theme-text-primary focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
        </div>

        <!-- Error Message -->
        {#if errorMessage}
          <div class="p-3 bg-red-100 border border-red-400 text-red-700 rounded dark:bg-red-900 dark:border-red-800 dark:text-red-200">
            {errorMessage}
          </div>
        {/if}

        <!-- Actions -->
        <div class="flex justify-between pt-4">
          <Button
            variant="secondary"
            on:click={handleClose}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Creating...' : 'Create Shift'}
          </Button>
        </div>
      </form>
    </div>
  </div>
{/if} 