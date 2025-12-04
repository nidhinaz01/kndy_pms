<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import Button from '$lib/components/common/Button.svelte';

  export let draftReportData: any[] = [];
  export let draftManpowerReportData: any[] = [];
  export let isLoading: boolean = false;
  export let selectedDate: string = '';

  const dispatch = createEventDispatcher();

  function handleSubmit() {
    dispatch('submit');
  }
</script>

<div class="theme-bg-primary rounded-lg shadow border theme-border">
  <div class="p-6 border-b theme-border">
    <div class="flex items-center justify-between mb-4">
      <div>
        <h2 class="text-xl font-semibold theme-text-primary">📝 Draft Reporting</h2>
        <p class="text-sm theme-text-secondary mt-1">
          Review and submit all draft reports for {new Date(selectedDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' })}
        </p>
      </div>
      <Button 
        variant="primary" 
        size="sm" 
        on:click={handleSubmit}
        disabled={isLoading || (draftReportData.length === 0 && draftManpowerReportData.length === 0)}
      >
        Submit Reporting
      </Button>
    </div>
  </div>
  {#if isLoading}
    <div class="flex items-center justify-center py-12">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mr-3"></div>
      <span class="theme-text-secondary">Loading draft reports...</span>
    </div>
  {:else if draftReportData.length === 0 && draftManpowerReportData.length === 0}
    <div class="text-center py-12">
      <div class="text-6xl mb-4">📝</div>
      <p class="theme-text-secondary text-lg">No draft reports found</p>
      <p class="theme-text-secondary text-sm mt-2">
        Create reports in Plan tab and Manpower Report tab
      </p>
    </div>
  {:else}
    <div class="p-6">
      <p class="theme-text-secondary mb-4">
        Work Reports: {draftReportData.length} | Manpower Reports: {draftManpowerReportData.length}
      </p>
      <!-- TODO: Display draft reports in a table/list -->
    </div>
  {/if}
</div>

