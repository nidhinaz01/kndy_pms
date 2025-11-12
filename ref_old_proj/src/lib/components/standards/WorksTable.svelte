<script lang="ts">
  import { onMount } from 'svelte';
  import Button from '$lib/components/common/Button.svelte';
  import { exportToCSV } from '$lib/utils/exportUtils';
  import { formatDate } from '$lib/utils/formatDate';
  import { supabase } from '$lib/supabaseClient';

  export let tableData: any[] = [];
  export let isTableLoading: boolean = false;
  export let onRowSelect: (row: any) => void;

  // For Active toggle
  async function handleToggleActive(row: any) {
    const newActive = !row.is_active;
    const { data: userData } = await supabase.auth.getUser();
    const username = userData?.user?.email || 'system';
    const now = new Date().toISOString();
    await supabase
      .from('std_work_details')
      .update({ is_active: newActive, modified_by: username, modified_dt: now })
      .eq('sw_id', row.sw_id);
    row.is_active = newActive;
    row.modified_by = username;
    row.modified_dt = now;
  }

  let search = '';
  let sortColumn: string = 'sw_type';
  let sortDirection: 'asc' | 'desc' = 'asc';

  // Filter state and show/hide
  let showFilters = false;
  let filter = {
    sw_type: '',
    plant_stage: '',
    sw_code: '',
    sw_name: '',
    is_active: ''
  };

  function clearFilters() {
    filter.sw_type = '';
    filter.plant_stage = '';
    filter.sw_code = '';
    filter.sw_name = '';
    filter.is_active = '';
  }

  $: filteredData = tableData
    .filter(row => {
      return (
        (!filter.sw_type || row.sw_type.toLowerCase().includes(filter.sw_type.toLowerCase())) &&
        (!filter.plant_stage || row.plant_stage.toLowerCase().includes(filter.plant_stage.toLowerCase())) &&
        (!filter.sw_code || row.sw_code.toLowerCase().includes(filter.sw_code.toLowerCase())) &&
        (!filter.sw_name || row.sw_name.toLowerCase().includes(filter.sw_name.toLowerCase())) &&
        (!filter.is_active || String(row.is_active) === filter.is_active)
      );
    })
    .filter(row => {
      if (!search) return true;
      const s = search.toLowerCase();
      return (
        row.sw_code.toLowerCase().includes(s) ||
        row.sw_name.toLowerCase().includes(s) ||
        row.plant_stage.toLowerCase().includes(s) ||
        row.sw_type.toLowerCase().includes(s)
      );
    });

  $: sortedData = [...filteredData].sort((a, b) => {
    if (!sortColumn) return 0;
    let aValue = a[sortColumn];
    let bValue = b[sortColumn];
    if (aValue === null || aValue === undefined) aValue = '';
    if (bValue === null || bValue === undefined) bValue = '';
    aValue = String(aValue).toLowerCase();
    bValue = String(bValue).toLowerCase();
    if (sortDirection === 'asc') {
      return aValue.localeCompare(bValue);
    } else {
      return bValue.localeCompare(aValue);
    }
  });

  function handleSort(column: string) {
    if (sortColumn === column) {
      sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      sortColumn = column;
      sortDirection = 'asc';
    }
  }

  function getSortIcon(column: string): string {
    if (sortColumn !== column) return 'text-gray-400';
    return sortDirection === 'asc' ? 'text-blue-500 rotate-180' : 'text-blue-500';
  }

  function exportData() {
    const headers = [
      'Type', 'Plant-Stage', 'Work Code', 'Work Name', 'Active'
    ];
    exportToCSV(
      sortedData,
      headers,
      'std_work_details',
      (row) => [
        row.sw_type,
        row.plant_stage,
        row.sw_code,
        row.sw_name,
        row.is_active ? 'Yes' : 'No'
      ]
    );
  }
</script>

<!-- Table Controls -->
<div class="flex items-center justify-between space-x-2 p-3 border-b theme-bg-primary rounded-t-xl shadow mt-4">
  <div class="flex items-center gap-2">
    <input type="text" placeholder="Search..." bind:value={search} class="border theme-border rounded-full pl-3 pr-3 py-2 w-full max-w-xs theme-bg-secondary theme-text-primary" />
    <span class="min-w-[140px] whitespace-nowrap">
      <Button variant="secondary" size="sm" on:click={() => showFilters = !showFilters}>
        {showFilters ? 'Hide' : 'Show'} Filters
      </Button>
    </span>
  </div>
  <Button variant="secondary" on:click={exportData}>Export</Button>
</div>

<!-- Filters Section -->
{#if showFilters}
  <div class="p-3 border-b theme-bg-primary">
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
      <div>
        <label for="filterType" class="block text-sm font-medium theme-text-primary mb-1">Type</label>
        <input id="filterType" type="text" bind:value={filter.sw_type} placeholder="Type" class="w-full px-2 py-1 text-sm border theme-border rounded theme-bg-primary theme-text-primary" />
      </div>
      <div>
        <label for="filterPlantStage" class="block text-sm font-medium theme-text-primary mb-1">Plant-Stage</label>
        <input id="filterPlantStage" type="text" bind:value={filter.plant_stage} placeholder="Plant-Stage" class="w-full px-2 py-1 text-sm border theme-border rounded theme-bg-primary theme-text-primary" />
      </div>
      <div>
        <label for="filterWorkCode" class="block text-sm font-medium theme-text-primary mb-1">Work Code</label>
        <input id="filterWorkCode" type="text" bind:value={filter.sw_code} placeholder="Work Code" class="w-full px-2 py-1 text-sm border theme-border rounded theme-bg-primary theme-text-primary" />
      </div>
      <div>
        <label for="filterWorkName" class="block text-sm font-medium theme-text-primary mb-1">Work Name</label>
        <input id="filterWorkName" type="text" bind:value={filter.sw_name} placeholder="Work Name" class="w-full px-2 py-1 text-sm border theme-border rounded theme-bg-primary theme-text-primary" />
      </div>
      <div>
        <label for="filterActive" class="block text-sm font-medium theme-text-primary mb-1">Active</label>
        <select id="filterActive" bind:value={filter.is_active} class="w-full px-2 py-1 text-sm border theme-border rounded theme-bg-primary theme-text-primary">
          <option value="">All</option>
          <option value="true">Active</option>
          <option value="false">Inactive</option>
        </select>
      </div>
    </div>
    <div class="flex justify-end mt-4">
      <Button variant="secondary" size="sm" on:click={clearFilters}>
        Clear Filters
      </Button>
    </div>
  </div>
{/if}

<div class="overflow-auto theme-bg-primary rounded-b-xl shadow">
  {#if isTableLoading}
    <div class="flex items-center justify-center p-8">
      <div class="text-center">
        <div class="animate-spin rounded-full h-8 w-8 border-b-2 theme-accent mx-auto mb-2"></div>
        <p class="theme-text-primary text-sm">Loading works...</p>
      </div>
    </div>
  {:else}
    <table class="min-w-full table-auto border-separate border-spacing-y-1">
      <thead>
        <tr class="theme-bg-secondary theme-text-primary text-sm">
          <th class="px-4 py-2 text-left cursor-pointer" on:click={() => handleSort('sw_type')}>
            Type
            <svg xmlns="http://www.w3.org/2000/svg" class="inline h-4 w-4 ml-1 transition-transform duration-200 {getSortIcon('sw_type')}" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 11l5-5 5 5M7 13l5 5 5-5" />
            </svg>
          </th>
          <th class="px-4 py-2 text-left cursor-pointer" on:click={() => handleSort('plant_stage')}>
            Plant-Stage
            <svg xmlns="http://www.w3.org/2000/svg" class="inline h-4 w-4 ml-1 transition-transform duration-200 {getSortIcon('plant_stage')}" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 11l5-5 5 5M7 13l5 5 5-5" />
            </svg>
          </th>
          <th class="px-4 py-2 text-left cursor-pointer" on:click={() => handleSort('sw_code')}>
            Work Code
            <svg xmlns="http://www.w3.org/2000/svg" class="inline h-4 w-4 ml-1 transition-transform duration-200 {getSortIcon('sw_code')}" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 11l5-5 5 5M7 13l5 5 5-5" />
            </svg>
          </th>
          <th class="px-4 py-2 text-left cursor-pointer" on:click={() => handleSort('sw_name')}>
            Work Name
            <svg xmlns="http://www.w3.org/2000/svg" class="inline h-4 w-4 ml-1 transition-transform duration-200 {getSortIcon('sw_name')}" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 11l5-5 5 5M7 13l5 5 5-5" />
            </svg>
          </th>
          <th class="px-4 py-2 text-left cursor-pointer" on:click={() => handleSort('is_active')}>
            Active
            <svg xmlns="http://www.w3.org/2000/svg" class="inline h-4 w-4 ml-1 transition-transform duration-200 {getSortIcon('is_active')}" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 11l5-5 5 5M7 13l5 5 5-5" />
            </svg>
          </th>
        </tr>
      </thead>
      <tbody>
        {#each sortedData as row}
          <tr class="hover:theme-bg-tertiary cursor-pointer" on:click={() => onRowSelect(row)}>
            <td class="px-4 py-2">{row.sw_type}</td>
            <td class="px-4 py-2">{row.plant_stage}</td>
            <td class="px-4 py-2">{row.sw_code}</td>
            <td class="px-4 py-2">{row.sw_name}</td>
            <td class="px-4 py-2">
              <label class="inline-flex items-center cursor-pointer">
                <input type="checkbox" checked={row.is_active} on:change={() => handleToggleActive(row)} />
                <span class="ml-2">{row.is_active ? 'Yes' : 'No'}</span>
              </label>
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  {/if}
</div> 