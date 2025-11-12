<script lang="ts">
  import { onMount } from 'svelte';
  import Button from '$lib/components/common/Button.svelte';
  import { exportToCSV } from '$lib/utils/exportUtils';
  import { formatDate } from '$lib/utils/formatDate';
  import { toggleShiftActive, deleteShift } from '$lib/api/hrShiftMaster';

  export let tableData: any[] = [];
  export let isTableLoading: boolean = false;
  export let onRowSelect: (row: any) => void;
  export let onStatusUpdated: (() => void) | null = null;
  export let onAddItem: (() => void) | null = null;
  export let onImportClick: (() => void) | null = null;

  // Add fallback no-op functions
  const handleAddItem = () => { if (onAddItem) onAddItem(); };
  const handleImportClick = () => { if (onImportClick) onImportClick(); };

  // For Edit Status
  async function handleEditStatus(row: any) {
    const currentStatus = row.is_active ? 'Active' : 'Inactive';
    const newStatus = row.is_active ? 'Inactive' : 'Active';
    
    if (confirm(`Are you sure you want to change the status of this shift from ${currentStatus} to ${newStatus}?`)) {
      const newActive = !row.is_active;
      try {
        await toggleShiftActive(row.shift_id, newActive);
        row.is_active = newActive;
        alert(`Status updated successfully to ${newStatus}.`);
        onStatusUpdated?.();
      } catch (error) {
        console.error('Error updating status:', error);
        alert('Failed to update status. Please try again.');
      }
    }
  }

  // For Delete
  async function handleDelete(row: any) {
    if (confirm(`Are you sure you want to delete this shift?`)) {
      try {
        await deleteShift(row.shift_id);
        // Remove from table data
        tableData = tableData.filter(item => item.shift_id !== row.shift_id);
        alert('Shift deleted successfully.');
      } catch (error) {
        console.error('Error deleting shift:', error);
        alert('Failed to delete shift. Please try again.');
      }
    }
  }

  let search = '';
  let sortColumn: string = 'shift_name';
  let sortDirection: 'asc' | 'desc' = 'asc';
  let showFilters = false;
  let filter = {
    shift_name: '',
    shift_code: '',
    start_time: '',
    end_time: '',
    is_active: ''
  };

  function clearFilters() {
    filter.shift_name = '';
    filter.shift_code = '';
    filter.start_time = '';
    filter.end_time = '';
    filter.is_active = '';
  }

  // Computed properties
  $: filteredData = tableData.filter(row => {
    return (
      (!filter.shift_name || (row.shift_name || '').toLowerCase().includes(filter.shift_name.toLowerCase())) &&
      (!filter.shift_code || (row.shift_code || '').toLowerCase().includes(filter.shift_code.toLowerCase())) &&
      (!filter.start_time || (row.start_time || '').toLowerCase().includes(filter.start_time.toLowerCase())) &&
      (!filter.end_time || (row.end_time || '').toLowerCase().includes(filter.end_time.toLowerCase())) &&
      (!filter.is_active || String(row.is_active) === filter.is_active)
    );
  }).filter(row => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      (row.shift_name || '').toLowerCase().includes(s) ||
      (row.shift_code || '').toLowerCase().includes(s) ||
      (row.start_time || '').toLowerCase().includes(s) ||
      (row.end_time || '').toLowerCase().includes(s)
    );
  });

  $: sortedData = [...filteredData].sort((a, b) => {
    let aVal: any, bVal: any;
    
    if (sortColumn === 'shift_name') {
      aVal = a.shift_name || '';
      bVal = b.shift_name || '';
    } else if (sortColumn === 'shift_code') {
      aVal = a.shift_code || '';
      bVal = b.shift_code || '';
    } else if (sortColumn === 'start_time') {
      aVal = a.start_time || '';
      bVal = b.start_time || '';
    } else if (sortColumn === 'end_time') {
      aVal = a.end_time || '';
      bVal = b.end_time || '';
    } else if (sortColumn === 'is_active') {
      aVal = a.is_active;
      bVal = b.is_active;
    } else {
      aVal = a.shift_name || '';
      bVal = b.shift_name || '';
    }

    if (sortDirection === 'asc') {
      return aVal > bVal ? 1 : -1;
    } else {
      return aVal < bVal ? 1 : -1;
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

  function getSortIcon(column: string) {
    if (sortColumn !== column) return '';
    return sortDirection === 'asc' ? 'rotate-0' : 'rotate-180';
  }

  function handleExport() {
    const headers = ['Shift Name', 'Shift Code', 'Start Time', 'End Time', 'Active', 'Created Date'];
    
    exportToCSV(sortedData, headers, 'shifts', (row) => [
      row.shift_name || '',
      row.shift_code || '',
      row.start_time || '',
      row.end_time || '',
      row.is_active ? 'Active' : 'Inactive',
      formatDate(row.created_dt)
    ]);
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
  <div class="flex items-center gap-2">
    {#if onAddItem}
      <Button variant="primary" on:click={handleAddItem}>Add Shift</Button>
    {/if}
    <Button variant="secondary" on:click={handleExport}>Export</Button>
  </div>
</div>

<!-- Filters Section -->
{#if showFilters}
  <div class="p-3 border-b theme-bg-primary">
    <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
      <div>
        <label for="filterShiftName" class="block text-sm font-medium theme-text-primary mb-1">Shift Name</label>
        <input id="filterShiftName" type="text" bind:value={filter.shift_name} placeholder="Shift Name" class="w-full px-2 py-1 text-sm border theme-border rounded theme-bg-primary theme-text-primary" />
      </div>
      <div>
        <label for="filterShiftCode" class="block text-sm font-medium theme-text-primary mb-1">Shift Code</label>
        <input id="filterShiftCode" type="text" bind:value={filter.shift_code} placeholder="Shift Code" class="w-full px-2 py-1 text-sm border theme-border rounded theme-bg-primary theme-text-primary" />
      </div>
      <div>
        <label for="filterStartTime" class="block text-sm font-medium theme-text-primary mb-1">Start Time</label>
        <input id="filterStartTime" type="text" bind:value={filter.start_time} placeholder="Start Time" class="w-full px-2 py-1 text-sm border theme-border rounded theme-bg-primary theme-text-primary" />
      </div>
      <div>
        <label for="filterEndTime" class="block text-sm font-medium theme-text-primary mb-1">End Time</label>
        <input id="filterEndTime" type="text" bind:value={filter.end_time} placeholder="End Time" class="w-full px-2 py-1 text-sm border theme-border rounded theme-bg-primary theme-text-primary" />
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
        <p class="theme-text-primary text-sm">Loading shifts...</p>
      </div>
    </div>
  {:else}
    <table class="min-w-full table-auto border-separate border-spacing-y-1">
      <thead>
        <tr class="theme-bg-secondary theme-text-primary text-sm">
          <th class="px-4 py-2 text-left cursor-pointer" on:click={() => handleSort('shift_name')}>
            Shift Name
            <svg xmlns="http://www.w3.org/2000/svg" class="inline h-4 w-4 ml-1 transition-transform duration-200 {getSortIcon('shift_name')}" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 11l5-5 5 5M7 13l5 5 5-5" />
            </svg>
          </th>
          <th class="px-4 py-2 text-left cursor-pointer" on:click={() => handleSort('shift_code')}>
            Shift Code
            <svg xmlns="http://www.w3.org/2000/svg" class="inline h-4 w-4 ml-1 transition-transform duration-200 {getSortIcon('shift_code')}" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 11l5-5 5 5M7 13l5 5 5-5" />
            </svg>
          </th>
          <th class="px-4 py-2 text-left cursor-pointer" on:click={() => handleSort('start_time')}>
            Start Time
            <svg xmlns="http://www.w3.org/2000/svg" class="inline h-4 w-4 ml-1 transition-transform duration-200 {getSortIcon('start_time')}" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 11l5-5 5 5M7 13l5 5 5-5" />
            </svg>
          </th>
          <th class="px-4 py-2 text-left cursor-pointer" on:click={() => handleSort('end_time')}>
            End Time
            <svg xmlns="http://www.w3.org/2000/svg" class="inline h-4 w-4 ml-1 transition-transform duration-200 {getSortIcon('end_time')}" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 11l5-5 5 5M7 13l5 5 5-5" />
            </svg>
          </th>
          <th class="px-4 py-2 text-left cursor-pointer" on:click={() => handleSort('is_active')}>
            Active
            <svg xmlns="http://www.w3.org/2000/svg" class="inline h-4 w-4 ml-1 transition-transform duration-200 {getSortIcon('is_active')}" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 11l5-5 5 5M7 13l5 5 5-5" />
            </svg>
          </th>
          <th class="px-4 py-2 text-left">Actions</th>
        </tr>
      </thead>
      <tbody>
        {#each sortedData as row}
          <tr class="hover:theme-bg-tertiary cursor-pointer" on:click={() => onRowSelect(row)}>
            <td class="px-4 py-2 font-medium theme-text-primary">{row.shift_name || '-'}</td>
            <td class="px-4 py-2 theme-text-primary">{row.shift_code || '-'}</td>
            <td class="px-4 py-2 theme-text-primary">{row.start_time ? row.start_time.substring(0, 5) : '-'}</td>
            <td class="px-4 py-2 theme-text-primary">{row.end_time ? row.end_time.substring(0, 5) : '-'}</td>
            <td class="px-4 py-2">
              <span class="px-2 py-1 text-xs rounded-full {row.is_active ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'}">
                {row.is_active ? 'Active' : 'Inactive'}
              </span>
            </td>
            <td class="px-4 py-2" on:click|stopPropagation>
              <div class="flex gap-2">
                <button
                  on:click={() => handleEditStatus(row)}
                  class="p-1 text-blue-600 hover:text-blue-900 hover:bg-blue-100 dark:hover:bg-blue-900 rounded transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-800"
                  title="Edit status"
                  aria-label="Edit status"
                >
                  <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </button>
                <button
                  on:click={() => handleDelete(row)}
                  class="p-1 text-red-600 hover:text-red-900 hover:bg-red-100 dark:hover:bg-red-900 rounded transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-red-200 dark:focus:ring-red-800"
                  title="Delete shift"
                  aria-label="Delete shift"
                >
                  <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </td>
          </tr>
        {/each}
      </tbody>
    </table>

    {#if sortedData.length === 0}
      <div class="text-center p-8">
        <p class="theme-text-secondary">No shifts found.</p>
      </div>
    {/if}
  {/if}
</div> 