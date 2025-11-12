<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import DateRangeStep from './DateRangeStep.svelte';
  import DailyPlanStep from './DailyPlanStep.svelte';
  import ShiftDistributionStep from './ShiftDistributionStep.svelte';
  import PatternAndSlotsStep from './PatternAndSlotsStep.svelte';
  import { saveProductionPlan } from '$lib/api/productionPlanService';

  export let showWizard: boolean = false;

  const dispatch = createEventDispatcher();

  // Wizard state
  let currentStep = 1;
  let totalSteps = 4;

  // Step data
  let fromDate = '';
  let toDate = '';
  let shifts: any[] = [];
  let ppdCount = 0;
  let pattern = { cycle: 1, pattern: [1] };
  let shiftDistribution: any[] = [];
  let entrySlots: any[] = [];
  let patternTimeSlots: any[] = [];

  // UI state
  let isSubmitting = false;
  let errorMessage = '';



  function handleStep1Next(event: CustomEvent) {
    const { fromDate: fd, toDate: td, shifts: s } = event.detail;
    fromDate = fd;
    toDate = td;
    shifts = s;
    currentStep = 2;
  }

  function handleStep2Next(event: CustomEvent) {
    const { ppdCount: ppd } = event.detail;
    ppdCount = ppd;
    currentStep = 3;
  }

  function handleStep3Next(event: CustomEvent) {
    const { shiftDistribution: sd } = event.detail;
    shiftDistribution = sd;
    currentStep = 4;
  }

  function handleStep4Next(event: CustomEvent) {
    const { pattern: pat, patternTimeSlots: pts } = event.detail;
    pattern = pat;
    patternTimeSlots = pts;
    handleSubmit();
  }

  function handleBack() {
    if (currentStep > 1) {
      currentStep--;
    } else {
      dispatch('close');
    }
  }

  async function handleSubmit() {
    isSubmitting = true;
    errorMessage = '';

    try {
      // Store pattern information in entry_slots since the table doesn't have pattern_data
      const entrySlotsWithPattern = {
        pattern_cycle: pattern.cycle,
        pattern_data: pattern.pattern,
        pattern_time_slots: patternTimeSlots,
        shift_distribution: shiftDistribution
      };

      const planData = {
        from_date: fromDate,
        to_date: toDate,
        ppd_count: ppdCount,
        production_rate: ppdCount, // Use ppd_count as production_rate
        pattern_cycle: pattern.cycle,
        shift_distribution: shiftDistribution,
        entry_slots: entrySlotsWithPattern
      };

      // Create new plan
      await saveProductionPlan(planData);
      alert('Production plan created successfully!');
      
      dispatch('planCreated');
      dispatch('close');
    } catch (error: any) {
      console.error('Error saving production plan:', error);
      errorMessage = error.message || 'Failed to save production plan. Please try again.';
    } finally {
      isSubmitting = false;
    }
  }

  function resetWizard() {
    currentStep = 1;
    fromDate = '';
    toDate = '';
    shifts = [];
    ppdCount = 0;
    pattern = { cycle: 1, pattern: [1] };
    shiftDistribution = [];
    entrySlots = [];
    patternTimeSlots = [];
    errorMessage = '';
  }

  function handleClose() {
    resetWizard();
    dispatch('close');
  }
</script>

{#if showWizard}
  <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
    <div class="theme-bg-primary rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
      <!-- Header -->
      <div class="flex items-center justify-between p-6 border-b theme-border">
        <div>
          <h2 class="text-xl font-semibold theme-text-primary">
            Create Production Plan
          </h2>
          <p class="text-sm text-gray-600 dark:text-gray-400">Step {currentStep} of {totalSteps}</p>
        </div>
        <button
          on:click={handleClose}
          class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors duration-200"
          aria-label="Close wizard"
        >
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <!-- Progress Bar -->
      <div class="px-6 py-4 border-b theme-border">
        <div class="flex space-x-2">
          {#each Array(totalSteps) as _, i}
            <div class="flex-1 h-2 rounded-full {i < currentStep ? 'theme-accent' : 'bg-gray-200 dark:bg-gray-700'}"></div>
          {/each}
        </div>
        <div class="flex justify-between mt-2 text-xs text-gray-600 dark:text-gray-400">
          <span>Date Range</span>
          <span>Daily Plan</span>
          <span>Shift Distribution</span>
          <span>Pattern & Slots</span>
        </div>
      </div>

      <!-- Content -->
      <div class="p-6">
        {#if errorMessage}
          <div class="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded dark:bg-red-900 dark:border-red-800 dark:text-red-200">
            {errorMessage}
          </div>
        {/if}

        {#if currentStep === 1}
          <DateRangeStep 
            bind:fromDate 
            bind:toDate 
            isValidating={isSubmitting}
            on:next={handleStep1Next}
            on:back={handleBack}
          />
        {:else if currentStep === 2}
          <DailyPlanStep 
            bind:ppdCount 
            {shifts}
            on:next={handleStep2Next}
            on:back={handleBack}
          />
        {:else if currentStep === 3}
          <ShiftDistributionStep 
            {shifts}
            dailyTarget={ppdCount}
            bind:shiftDistribution
            on:next={handleStep3Next}
            on:back={handleBack}
          />
        {:else if currentStep === 4}
          <PatternAndSlotsStep 
            {shifts}
            {shiftDistribution}
            {ppdCount}
            on:next={handleStep4Next}
            on:back={handleBack}
          />
        {/if}
      </div>

      <!-- Footer -->
      <div class="p-6 border-t theme-border">
        <div class="flex justify-between items-center">
          <div class="text-sm text-gray-600 dark:text-gray-400">
            {#if currentStep === 1}
              Select the date range for your production plan
            {:else if currentStep === 2}
              Define daily production targets and parameters
            {:else if currentStep === 3}
              Review and adjust production targets per shift
            {:else if currentStep === 4}
              Define entry time slots for each shift
            {/if}
          </div>
          
          {#if currentStep === 4}
            <div class="flex gap-2">
              <button
                on:click={handleBack}
                class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-gray-800 dark:text-gray-200 dark:border-gray-600 dark:hover:bg-gray-700"
                disabled={isSubmitting}
              >
                Back
              </button>
              <button
                on:click={handleSubmit}
                class="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Creating...' : 'Create Plan'}
              </button>
            </div>
          {/if}
        </div>
      </div>
    </div>
  </div>
{/if} 