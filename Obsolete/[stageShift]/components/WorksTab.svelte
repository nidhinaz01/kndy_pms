<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import WorksTable from '$lib/components/production/WorksTable.svelte';

  export let worksData: any[] = [];
  export let isLoading: boolean = false;

  const dispatch = createEventDispatcher();

  function handleExport(event: CustomEvent) {
    dispatch('export', event.detail);
  }

  function handleRefresh() {
    dispatch('refresh');
  }

  function handleAddWork() {
    dispatch('addWork');
  }

  function handleViewWork(event: CustomEvent) {
    dispatch('viewWork', event.detail);
  }

  function handleRemoveWork(event: CustomEvent) {
    dispatch('removeWork', event.detail);
  }

  function handleRemoveSelected(event: CustomEvent) {
    dispatch('removeSelected', event.detail);
  }

  function handlePlanWork(event: CustomEvent) {
    dispatch('planWork', event.detail);
  }
</script>

<WorksTable 
  data={worksData} 
  isLoading={isLoading} 
  on:export={handleExport}
  on:refresh={handleRefresh}
  on:addWork={handleAddWork}
  on:viewWork={handleViewWork}
  on:removeWork={handleRemoveWork}
  on:removeSelected={handleRemoveSelected}
  on:planWork={handlePlanWork}
/>

