<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import Button from '$lib/components/common/Button.svelte';

  export let ppdCount: number = 0;
  export let shifts: any[] = [];

  const dispatch = createEventDispatcher();

  let errors: Record<string, string> = {};

  function validateForm(): boolean {
    errors = {};

    if (!ppdCount || ppdCount <= 0) {
      errors.ppdCount = 'Please enter a valid daily production count';
    }

    return Object.keys(errors).length === 0;
  }

  function handleNext() {
    if (!validateForm()) return;

    dispatch('next', {
      ppdCount
    });
  }



  function handleBack() {
    dispatch('back');
  }

  // Calculate total days in the plan
  $: totalDays = shifts.length > 0 ? Math.ceil(ppdCount * shifts.length) : 0;
</script>

<div class="space-y-6">
  <div class="text-center">
    <h2 class="text-2xl font-bold theme-text-primary mb-2">Step 2: Daily Production Plan</h2>
    <p class="text-gray-600 dark:text-gray-400">Set your daily production targets and parameters</p>
  </div>

  <div class="space-y-4">
    <!-- Daily Production Count -->
    <div>
      <label for="ppdCount" class="block text-sm font-medium theme-text-primary mb-2">
        Daily Production Count *
      </label>
      <input
        type="number"
        id="ppdCount"
        bind:value={ppdCount}
        min="1"
        step="0.5"
        class="w-full px-3 py-2 border theme-border rounded-md theme-bg-secondary theme-text-primary focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        placeholder="e.g., 3"
      />
      {#if errors.ppdCount}
        <p class="text-red-500 text-sm mt-1">{errors.ppdCount}</p>
      {/if}
      <p class="text-gray-500 text-sm mt-1">Number of vehicles to produce per day</p>
    </div>

    <!-- Summary -->
    {#if ppdCount > 0 && shifts.length > 0}
      <div class="p-4 bg-blue-50 border border-blue-200 rounded-lg dark:bg-blue-900/20 dark:border-blue-800">
        <h3 class="font-medium text-blue-800 dark:text-blue-200 mb-2">Plan Summary</h3>
        <div class="space-y-1 text-sm text-blue-700 dark:text-blue-300">
          <p>• Daily target: {ppdCount} vehicles per day</p>
          <p>• Active shifts: {shifts.length} shifts</p>
          <p>• Estimated distribution: {(ppdCount / shifts.length).toFixed(2)} vehicles per shift</p>
        </div>
      </div>
    {/if}
  </div>

  <!-- Actions -->
  <div class="flex justify-between pt-4">
    <Button
      variant="secondary"
      on:click={handleBack}
    >
      Back
    </Button>
    <Button
      variant="primary"
      on:click={handleNext}
    >
      Next
    </Button>
  </div>
</div> 