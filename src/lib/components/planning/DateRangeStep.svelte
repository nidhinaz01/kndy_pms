<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import Button from '$lib/components/common/Button.svelte';
  import { validateShiftsForDateRange } from '$lib/api/productionPlanService';

  export let fromDate: string = '';
  export let toDate: string = '';
  export let isValidating: boolean = false;

  const dispatch = createEventDispatcher();

  let errors: Record<string, string> = {};
  let validationResult: any = null;

  function validateForm(): boolean {
    errors = {};

    if (!fromDate) {
      errors.fromDate = 'Please select a from date';
    }

    if (!toDate) {
      errors.toDate = 'Please select a to date';
    } else if (fromDate && toDate) {
      const from = new Date(fromDate);
      const to = new Date(toDate);
      
      if (to < from) {
        errors.toDate = 'To date cannot be before from date';
      }
    }

    return Object.keys(errors).length === 0;
  }

  async function handleNext() {
    if (!validateForm()) return;

    isValidating = true;
    try {
      validationResult = await validateShiftsForDateRange(fromDate, toDate);
      
      if (validationResult.isValid) {
        dispatch('next', {
          fromDate,
          toDate,
          shifts: validationResult.shifts
        });
      } else {
        errors.general = validationResult.error;
      }
    } catch (error: any) {
      console.error('Error validating date range:', error);
      errors.general = error.message || 'Failed to validate date range. Please try again.';
    } finally {
      isValidating = false;
    }
  }

  function handleBack() {
    dispatch('back');
  }
</script>

<div class="space-y-6">
  <div class="text-center">
    <h2 class="text-2xl font-bold theme-text-primary mb-2">Step 1: Select Date Range</h2>
    <p class="text-gray-600 dark:text-gray-400">Choose the date range for your production plan</p>
  </div>

  <div class="space-y-4">
    <!-- From Date -->
    <div>
      <label for="fromDate" class="block text-sm font-medium theme-text-primary mb-2">
        From Date *
      </label>
      <input
        type="date"
        id="fromDate"
        bind:value={fromDate}
        class="w-full px-3 py-2 border theme-border rounded-md theme-bg-secondary theme-text-primary focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        min={new Date().toISOString().split('T')[0]}
      />
      {#if errors.fromDate}
        <p class="text-red-500 text-sm mt-1">{errors.fromDate}</p>
      {/if}
    </div>

    <!-- To Date -->
    <div>
      <label for="toDate" class="block text-sm font-medium theme-text-primary mb-2">
        To Date *
      </label>
      <input
        type="date"
        id="toDate"
        bind:value={toDate}
        class="w-full px-3 py-2 border theme-border rounded-md theme-bg-secondary theme-text-primary focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        min={fromDate || new Date().toISOString().split('T')[0]}
      />
      {#if errors.toDate}
        <p class="text-red-500 text-sm mt-1">{errors.toDate}</p>
      {/if}
    </div>

    <!-- General Error -->
    {#if errors.general}
      <div class="p-3 bg-red-100 border border-red-400 text-red-700 rounded dark:bg-red-900 dark:border-red-800 dark:text-red-200">
        {errors.general}
      </div>
    {/if}

    <!-- Validation Result -->
    {#if validationResult && validationResult.isValid}
      <div class="p-3 bg-green-100 border border-green-400 text-green-700 rounded dark:bg-green-900 dark:border-green-800 dark:text-green-200">
        <p class="font-medium">✓ Date range validated successfully!</p>
        <p class="text-sm mt-1">
          Found {validationResult.shifts.length} shifts: 
          {validationResult.shifts.map((s: any) => s.hr_shift_master.shift_name).join(', ')}
        </p>
      </div>
    {/if}
  </div>

  <!-- Actions -->
  <div class="flex justify-between pt-4">
    <Button
      variant="secondary"
      on:click={handleBack}
      disabled={isValidating}
    >
      Back
    </Button>
    <Button
      variant="primary"
      on:click={handleNext}
      disabled={isValidating}
    >
      {isValidating ? 'Validating...' : 'Next'}
    </Button>
  </div>
</div> 