<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { onMount } from 'svelte';
  import Button from '$lib/components/common/Button.svelte';
  import { saveDailyShiftSchedules } from '$lib/api/hrDailyShiftSchedule';
  import { fetchAllShifts } from '$lib/api/hrShiftMaster';

  export let showAddModal: boolean = false;
  export let onClose: () => void;
  export let onItemAdded: () => void;

  const dispatch = createEventDispatcher();

  let formData = {
    shift_id: 0,
    from_date: '',
    to_date: ''
  };

  let shifts: any[] = [];
  let isLoadingShifts = false;
  let isSubmitting = false;
  let errors: Record<string, string> = {};

  onMount(async () => {
    await loadShifts();
  });

  async function loadShifts() {
    isLoadingShifts = true;
    try {
      shifts = await fetchAllShifts();
    } catch (error) {
      console.error('Error loading shifts:', error);
      alert('Failed to load shifts. Please try again.');
    } finally {
      isLoadingShifts = false;
    }
  }

  function validateForm(): boolean {
    errors = {};

    if (!formData.shift_id) {
      errors.shift_id = 'Please select a shift';
    }

    if (!formData.from_date) {
      errors.from_date = 'Please select a from date';
    } else {
      const fromDate = new Date(formData.from_date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      if (fromDate < today) {
        errors.from_date = 'From date cannot be in the past';
      }
    }

    if (!formData.to_date) {
      errors.to_date = 'Please select a to date';
    } else {
      const toDate = new Date(formData.to_date);
      const fromDate = new Date(formData.from_date);
      
      if (toDate < fromDate) {
        errors.to_date = 'To date cannot be before from date';
      }
    }

    return Object.keys(errors).length === 0;
  }

  async function handleSubmit() {
    if (!validateForm()) return;

    isSubmitting = true;
    try {
      const schedules = await saveDailyShiftSchedules(formData);
      alert(`Successfully created ${schedules.length} schedules!`);
      console.log('Calling onItemAdded...');
      onItemAdded();
      handleClose();
    } catch (error: any) {
      console.error('Error creating schedules:', error);
      alert(error.message || 'Failed to create schedules. Please try again.');
    } finally {
      isSubmitting = false;
    }
  }

  function handleClose() {
    formData = {
      shift_id: 0,
      from_date: '',
      to_date: ''
    };
    errors = {};
    onClose();
  }
</script>

{#if showAddModal}
  <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
    <div class="theme-bg-primary rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
      <!-- Header -->
      <div class="flex items-center justify-between p-6 border-b theme-border">
        <h2 class="text-xl font-semibold theme-text-primary">Add Daily Shift Schedules</h2>
        <button
          on:click={handleClose}
          class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors duration-200"
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
          <select
            id="shift_id"
            bind:value={formData.shift_id}
            class="w-full px-3 py-2 border theme-border rounded-md theme-bg-secondary theme-text-primary focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            disabled={isLoadingShifts}
          >
            <option value={0}>Select a shift</option>
            {#each shifts as shift}
              <option value={shift.shift_id}>
                {shift.shift_name} ({shift.shift_code}) - {shift.start_time ? shift.start_time.substring(0, 5) : ''} to {shift.end_time ? shift.end_time.substring(0, 5) : ''}
              </option>
            {/each}
          </select>
          {#if errors.shift_id}
            <p class="text-red-500 text-sm mt-1">{errors.shift_id}</p>
          {/if}
          {#if isLoadingShifts}
            <p class="text-gray-500 text-sm mt-1">Loading shifts...</p>
          {/if}
        </div>

        <!-- From Date -->
        <div>
          <label for="from_date" class="block text-sm font-medium theme-text-primary mb-2">
            From Date *
          </label>
          <input
            type="date"
            id="from_date"
            bind:value={formData.from_date}
            class="w-full px-3 py-2 border theme-border rounded-md theme-bg-secondary theme-text-primary focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            min={new Date().toISOString().split('T')[0]}
          />
          {#if errors.from_date}
            <p class="text-red-500 text-sm mt-1">{errors.from_date}</p>
          {/if}
        </div>

        <!-- To Date -->
        <div>
          <label for="to_date" class="block text-sm font-medium theme-text-primary mb-2">
            To Date *
          </label>
          <input
            type="date"
            id="to_date"
            bind:value={formData.to_date}
            class="w-full px-3 py-2 border theme-border rounded-md theme-bg-secondary theme-text-primary focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            min={new Date().toISOString().split('T')[0]}
          />
          {#if errors.to_date}
            <p class="text-red-500 text-sm mt-1">{errors.to_date}</p>
          {/if}
        </div>

        <!-- Actions -->
        <div class="flex justify-between pt-4">
          <button
            type="button"
            class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-gray-800 dark:text-gray-200 dark:border-gray-600 dark:hover:bg-gray-700"
            on:click={handleClose}
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <Button
            type="submit"
            variant="primary"
            disabled={isSubmitting || isLoadingShifts}
          >
            {isSubmitting ? 'Creating...' : 'Create Schedules'}
          </Button>
        </div>
      </form>
    </div>
  </div>
{/if} 