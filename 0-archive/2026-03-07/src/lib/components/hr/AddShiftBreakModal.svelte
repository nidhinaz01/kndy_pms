<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import Button from '$lib/components/common/Button.svelte';
  import { saveShiftBreak } from '$lib/api/hrShiftBreakMaster';
  import { fetchAllShifts } from '$lib/api/hrShiftMaster';
  import type { HrShiftBreakMasterFormData } from '$lib/api/hrShiftBreakMaster';
  import type { HrShiftMaster } from '$lib/api/hrShiftMaster';

  export let showAddModal: boolean;
  export let onClose: () => void;

  const dispatch = createEventDispatcher();

  let formData: HrShiftBreakMasterFormData = {
    shift_id: 0,
    break_number: 1,
    break_name: '',
    start_time: '',
    end_time: ''
  };

  let shifts: HrShiftMaster[] = [];
  let isSubmitting = false;
  let errorMessage = '';
  let isLoadingShifts = true;

  onMount(async () => {
    try {
      shifts = await fetchAllShifts();
    } catch (error) {
      console.error('Error fetching shifts:', error);
      errorMessage = 'Failed to load shifts. Please try again.';
    } finally {
      isLoadingShifts = false;
    }
  });

  function resetForm() {
    formData = {
      shift_id: 0,
      break_number: 1,
      break_name: '',
      start_time: '',
      end_time: ''
    };
    errorMessage = '';
  }

  async function handleSubmit() {
    if (!formData.shift_id || !formData.break_name.trim() || !formData.start_time || !formData.end_time) {
      errorMessage = 'Please fill in all required fields.';
      return;
    }

    if (formData.break_number < 1) {
      errorMessage = 'Break number must be at least 1.';
      return;
    }

    isSubmitting = true;
    errorMessage = '';

    try {
      const newShiftBreak = await saveShiftBreak(formData);
      alert('Shift break created successfully!');
      resetForm();
      dispatch('itemAdded', newShiftBreak);
      onClose();
    } catch (error: any) {
      console.error('Error creating shift break:', error);
      errorMessage = error.message || 'Failed to create shift break. Please try again.';
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
        <h2 class="text-xl font-semibold theme-text-primary">Add New Shift Break</h2>
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
        <!-- Shift Selection -->
        <div>
          <label for="shift_id" class="block text-sm font-medium theme-text-primary mb-2">
            Shift *
          </label>
          {#if isLoadingShifts}
            <div class="w-full px-3 py-2 border theme-border rounded theme-bg-secondary theme-text-primary">
              Loading shifts...
            </div>
          {:else}
            <select
              id="shift_id"
              bind:value={formData.shift_id}
              class="w-full px-3 py-2 border theme-border rounded theme-bg-secondary theme-text-primary focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            >
              <option value={0}>Select a shift</option>
              {#each shifts as shift}
                <option value={shift.shift_id}>{shift.shift_name} ({shift.shift_code})</option>
              {/each}
            </select>
          {/if}
        </div>

        <!-- Break Number -->
        <div>
          <label for="break_number" class="block text-sm font-medium theme-text-primary mb-2">
            Break Number *
          </label>
          <input
            id="break_number"
            type="number"
            min="1"
            bind:value={formData.break_number}
            class="w-full px-3 py-2 border theme-border rounded theme-bg-secondary theme-text-primary focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
        </div>

        <!-- Break Name -->
        <div>
          <label for="break_name" class="block text-sm font-medium theme-text-primary mb-2">
            Break Name *
          </label>
          <input
            id="break_name"
            type="text"
            bind:value={formData.break_name}
            placeholder="e.g., Lunch Break"
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
            disabled={isSubmitting || isLoadingShifts}
            on:click={handleSubmit}
          >
            {isSubmitting ? 'Creating...' : 'Create Break'}
          </Button>
        </div>
      </form>
    </div>
  </div>
{/if} 