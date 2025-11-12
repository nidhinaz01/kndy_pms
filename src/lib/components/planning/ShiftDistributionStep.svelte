<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import Button from '$lib/components/common/Button.svelte';
  import { calculateShiftDistribution } from '$lib/api/productionPlanService';

  export let shifts: any[] = [];
  export let dailyTarget: number = 0;
  export let shiftDistribution: any[] = [];

  const dispatch = createEventDispatcher();

  let errors: Record<string, string> = {};
  let totalDistributed: number = 0;

  // Auto-calculate distribution when component loads or daily target changes
  $: if (shifts.length > 0 && dailyTarget > 0) {
    shiftDistribution = calculateShiftDistribution(dailyTarget, shifts);
  }

  // Calculate total distributed
  $: totalDistributed = shiftDistribution.reduce((sum, dist) => sum + dist.target_quantity, 0);

  function validateForm(): boolean {
    errors = {};

    // Check if total matches daily target
    if (Math.abs(totalDistributed - dailyTarget) > 0.01) {
      errors.total = `Total distributed (${totalDistributed.toFixed(2)}) must equal daily target (${dailyTarget})`;
    }

    // Check for negative values
    const negativeShifts = shiftDistribution.filter(dist => dist.target_quantity < 0);
    if (negativeShifts.length > 0) {
      errors.negative = 'Target quantities cannot be negative';
    }

    return Object.keys(errors).length === 0;
  }

  function handleNext() {
    if (!validateForm()) return;

    dispatch('next', {
      shiftDistribution
    });
  }

  function handleBack() {
    dispatch('back');
  }

  function updateShiftTarget(shiftId: number, newValue: number) {
    shiftDistribution = shiftDistribution.map(dist => 
      dist.shift_id === shiftId 
        ? { ...dist, target_quantity: newValue }
        : dist
    );
  }

  function resetToEqual() {
    shiftDistribution = calculateShiftDistribution(dailyTarget, shifts);
  }
</script>

<div class="space-y-6">
  <div class="text-center">
    <h2 class="text-2xl font-bold theme-text-primary mb-2">Step 3: Shift Distribution</h2>
    <p class="text-gray-600 dark:text-gray-400">Review and adjust production targets per shift</p>
  </div>

  <div class="space-y-4">
    <!-- Summary -->
    <div class="p-4 bg-blue-50 border border-blue-200 rounded-lg dark:bg-blue-900/20 dark:border-blue-800">
      <h3 class="font-medium text-blue-800 dark:text-blue-200 mb-2">Distribution Summary</h3>
      <div class="space-y-1 text-sm text-blue-700 dark:text-blue-300">
        <p>• Daily target: {dailyTarget} vehicles</p>
        <p>• Active shifts: {shifts.length} shifts</p>
        <p>• Total distributed: {totalDistributed.toFixed(2)} vehicles</p>
        <p>• Balance: {(dailyTarget - totalDistributed).toFixed(2)} vehicles</p>
      </div>
    </div>

    <!-- Shift Distribution Table -->
    <div class="space-y-3">
      <div class="flex justify-between items-center">
        <h3 class="text-lg font-medium theme-text-primary">Shift Targets</h3>
        <button
          on:click={resetToEqual}
          class="px-3 py-1 text-sm text-blue-600 hover:text-blue-800 hover:bg-blue-100 dark:text-blue-400 dark:hover:text-blue-200 dark:hover:bg-blue-900 rounded transition-colors duration-200"
        >
          Reset to Equal
        </button>
      </div>

      <div class="space-y-3">
        {#each shiftDistribution as distribution}
          {@const shift = shifts.find(s => s.shift_id === distribution.shift_id)}
          <div class="p-4 border theme-border rounded-lg theme-bg-secondary">
            <div class="flex items-center justify-between">
              <div class="flex-1">
                <h4 class="font-medium theme-text-primary">{shift?.hr_shift_master.shift_name}</h4>
                <p class="text-sm text-gray-600 dark:text-gray-400">
                  {shift?.hr_shift_master.start_time} - {shift?.hr_shift_master.end_time}
                </p>
              </div>
              <div class="flex items-center gap-2">
                <input
                  type="number"
                  bind:value={distribution.target_quantity}
                  min="0"
                  step="0.5"
                  class="w-24 px-3 py-2 border theme-border rounded-md theme-bg-primary theme-text-primary focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-center"
                  on:input={() => updateShiftTarget(distribution.shift_id, distribution.target_quantity)}
                />
                <span class="text-sm theme-text-secondary">vehicles</span>
              </div>
            </div>
          </div>
        {/each}
      </div>
    </div>

    <!-- Validation Errors -->
    {#if errors.total}
      <div class="p-3 bg-red-100 border border-red-400 text-red-700 rounded dark:bg-red-900 dark:border-red-800 dark:text-red-200">
        {errors.total}
      </div>
    {/if}

    {#if errors.negative}
      <div class="p-3 bg-red-100 border border-red-400 text-red-700 rounded dark:bg-red-900 dark:border-red-800 dark:text-red-200">
        {errors.negative}
      </div>
    {/if}

    <!-- Balance Indicator -->
    {#if Math.abs(dailyTarget - totalDistributed) > 0.01}
      <div class="p-3 bg-yellow-100 border border-yellow-400 text-yellow-700 rounded dark:bg-yellow-900 dark:border-yellow-800 dark:text-yellow-200">
        <p class="font-medium">⚠ Distribution not balanced</p>
        <p class="text-sm">Please adjust the targets to match the daily total of {dailyTarget} vehicles.</p>
      </div>
    {:else if totalDistributed > 0}
      <div class="p-3 bg-green-100 border border-green-400 text-green-700 rounded dark:bg-green-900 dark:border-green-800 dark:text-green-200">
        <p class="font-medium">✓ Distribution balanced</p>
        <p class="text-sm">Total distributed: {totalDistributed.toFixed(2)} vehicles</p>
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
      disabled={Math.abs(dailyTarget - totalDistributed) > 0.01}
    >
      Next
    </Button>
  </div>
</div> 