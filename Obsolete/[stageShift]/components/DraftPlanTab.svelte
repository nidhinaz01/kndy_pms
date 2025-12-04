<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import Button from '$lib/components/common/Button.svelte';

  export let draftPlanData: any[] = [];
  export let draftManpowerPlanData: any[] = [];
  export let isLoading: boolean = false;
  export let selectedDate: string = '';

  const dispatch = createEventDispatcher();

  $: nextDateDisplay = (() => {
    const next = new Date(selectedDate);
    next.setDate(next.getDate() + 1);
    return next.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' });
  })();

  function handleSubmit() {
    dispatch('submit');
  }
</script>

<div class="theme-bg-primary rounded-lg shadow border theme-border">
  <div class="p-6 border-b theme-border">
    <div class="flex items-center justify-between mb-4">
      <div>
        <h2 class="text-xl font-semibold theme-text-primary">📝 Draft Planning</h2>
        <p class="text-sm theme-text-secondary mt-1">
          Review and submit all draft plans for next day: {nextDateDisplay}
        </p>
      </div>
      <Button 
        variant="primary" 
        size="sm" 
        on:click={handleSubmit}
        disabled={isLoading || (draftPlanData.length === 0 && draftManpowerPlanData.length === 0)}
      >
        Submit Planning
      </Button>
    </div>
  </div>
  {#if isLoading}
    <div class="flex items-center justify-center py-12">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mr-3"></div>
      <span class="theme-text-secondary">Loading draft plans...</span>
    </div>
  {:else if draftPlanData.length === 0 && draftManpowerPlanData.length === 0}
    <div class="text-center py-12">
      <div class="text-6xl mb-4">📝</div>
      <p class="theme-text-secondary text-lg">No draft plans found</p>
      <p class="theme-text-secondary text-sm mt-2">
        Create plans in Works tab and Manpower Plan tab
      </p>
    </div>
  {:else}
    <div class="p-6">
      <p class="theme-text-secondary mb-4">
        Work Plans: {draftPlanData.length} | Manpower Plans: {draftManpowerPlanData.length}
      </p>
      <!-- TODO: Display draft plans in a table/list -->
    </div>
  {/if}
</div>

