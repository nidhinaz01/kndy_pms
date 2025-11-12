<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import Button from '$lib/components/common/Button.svelte';
  import type { Holiday } from '$lib/api/holidays';
  import { validateDateCombination } from '$lib/api/holidays';

  export let showModal = false;
  export let holiday: Partial<Holiday> | null = null;
  export let isLoading = false;

  const dispatch = createEventDispatcher();

  // Form data
  let dtDay = 1;
  let dtMonth = 'January';
  let dtYear = new Date().getFullYear();
  let description = '';

  // Validation
  let errors: Record<string, string> = {};

  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const years = [
    new Date().getFullYear() - 1,
    new Date().getFullYear(),
    new Date().getFullYear() + 1
  ];

  $: {
    if (holiday) {
      dtDay = holiday.dt_day || 1;
      dtMonth = holiday.dt_month || 'January';
      dtYear = holiday.dt_year || new Date().getFullYear();
      description = holiday.description || '';
    } else {
      dtDay = 1;
      dtMonth = 'January';
      dtYear = new Date().getFullYear();
      description = '';
    }
    errors = {};
  }

  function validateForm(): boolean {
    errors = {};

    if (!description.trim()) {
      errors.description = 'Description is required';
    }

    if (dtDay < 1 || dtDay > 31) {
      errors.dtDay = 'Day must be between 1 and 31';
    }

    if (!validateDateCombination(dtDay, dtMonth, dtYear)) {
      errors.date = 'Invalid date combination';
    }

    return Object.keys(errors).length === 0;
  }

  function handleSubmit() {
    if (!validateForm()) return;

    const holidayData = {
      dt_day: dtDay,
      dt_month: dtMonth,
      dt_year: dtYear,
      description: description.trim()
    };

    dispatch('save', { holiday: holidayData, isEdit: !!holiday });
  }

  function handleClose() {
    dispatch('close');
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      handleClose();
    }
  }
</script>

{#if showModal}
  <div class="fixed inset-0 z-50 flex items-center justify-center" role="dialog" aria-modal="true" tabindex="0" on:keydown={handleKeydown}>
    <div class="fixed inset-0 bg-black bg-opacity-50" on:click={handleClose} on:keydown={(e) => e.key === 'Escape' && handleClose()} role="button" tabindex="0"></div>
    <div class="bg-white dark:bg-gray-800 rounded-lg p-6 w-96 max-w-md relative z-10">
      <h3 class="text-lg font-semibold theme-text-primary mb-4">
        {holiday ? 'Edit Holiday' : 'Add Holiday'}
      </h3>
      
      <form on:submit|preventDefault={handleSubmit} class="space-y-4">
        <!-- Day -->
        <div>
          <label for="dtDay" class="block text-sm font-medium theme-text-primary mb-2">
            Day *
          </label>
          <input
            id="dtDay"
            type="number"
            bind:value={dtDay}
            min="1"
            max="31"
            class="w-full px-3 py-2 border theme-border rounded-lg theme-bg-primary theme-text-primary focus:ring-2 focus:ring-blue-500 focus:border-transparent {errors.dtDay ? 'border-red-500' : ''}"
            required
          />
          {#if errors.dtDay}
            <p class="text-red-500 text-xs mt-1">{errors.dtDay}</p>
          {/if}
        </div>

        <!-- Month -->
        <div>
          <label for="dtMonth" class="block text-sm font-medium theme-text-primary mb-2">
            Month *
          </label>
          <select
            id="dtMonth"
            bind:value={dtMonth}
            class="w-full px-3 py-2 border theme-border rounded-lg theme-bg-primary theme-text-primary focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            required
          >
            {#each months as month}
              <option value={month}>{month}</option>
            {/each}
          </select>
        </div>

        <!-- Year -->
        <div>
          <label for="dtYear" class="block text-sm font-medium theme-text-primary mb-2">
            Year *
          </label>
          <select
            id="dtYear"
            bind:value={dtYear}
            class="w-full px-3 py-2 border theme-border rounded-lg theme-bg-primary theme-text-primary focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            required
          >
            {#each years as year}
              <option value={year}>{year}</option>
            {/each}
          </select>
        </div>

        <!-- Description -->
        <div>
          <label for="description" class="block text-sm font-medium theme-text-primary mb-2">
            Description *
          </label>
          <textarea
            id="description"
            bind:value={description}
            rows="3"
            class="w-full px-3 py-2 border theme-border rounded-lg theme-bg-primary theme-text-primary focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-vertical {errors.description ? 'border-red-500' : ''}"
            placeholder="Enter holiday description"
            required
          ></textarea>
          {#if errors.description}
            <p class="text-red-500 text-xs mt-1">{errors.description}</p>
          {/if}
        </div>

        <!-- Date validation error -->
        {#if errors.date}
          <div class="p-3 bg-red-100 border border-red-400 text-red-700 rounded-lg">
            <p class="text-sm">{errors.date}</p>
          </div>
        {/if}

        <!-- Buttons -->
        <div class="flex justify-end space-x-3 pt-4">
          <Button
            type="button"
            variant="secondary"
            on:click={handleClose}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            disabled={isLoading}
          >
            {#if isLoading}
              <svg class="animate-spin -ml-1 mr-3 h-5 w-5 text-white inline" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Saving...
            {:else}
              {holiday ? 'Update' : 'Save'}
            {/if}
          </Button>
        </div>
      </form>
    </div>
  </div>
{/if} 