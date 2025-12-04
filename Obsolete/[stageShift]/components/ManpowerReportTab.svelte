<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import ManpowerTable from '$lib/components/production/ManpowerTable.svelte';
  import type { ProductionEmployee } from '$lib/api/production';

  export let data: ProductionEmployee[] = [];
  export let isLoading: boolean = false;
  export let selectedDate: string = '';

  const dispatch = createEventDispatcher();

  function handleRefresh() {
    dispatch('refresh');
  }

  function handleAttendanceMarked(event: CustomEvent) {
    dispatch('attendanceMarked', event.detail);
  }

  function handleBulkAttendanceMarked(event: CustomEvent) {
    dispatch('bulkAttendanceMarked', event.detail);
  }

  function handleStageReassigned(event: CustomEvent) {
    dispatch('stageReassigned', event.detail);
  }

  function handleExport(event: CustomEvent) {
    dispatch('export', event.detail);
  }
</script>

<div class="theme-bg-primary rounded-lg shadow border theme-border">
  <div class="p-6 border-b theme-border">
    <div class="flex items-center justify-between mb-4">
      <div>
        <h2 class="text-xl font-semibold theme-text-primary">👥📊 Manpower Reporting</h2>
        <p class="text-sm theme-text-secondary mt-1">
          Report attendance and stage reassignments for {new Date(selectedDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' })}
        </p>
      </div>
    </div>
  </div>
  {#if isLoading}
    <div class="flex items-center justify-center py-12">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mr-3"></div>
      <span class="theme-text-secondary">Loading manpower data...</span>
    </div>
  {:else}
    <ManpowerTable 
      data={data} 
      isLoading={isLoading} 
      selectedDate={selectedDate}
      on:refresh={handleRefresh}
      on:attendanceMarked={handleAttendanceMarked}
      on:bulkAttendanceMarked={handleBulkAttendanceMarked}
      on:stageReassigned={handleStageReassigned}
      on:export={handleExport} 
    />
  {/if}
</div>

