<script lang="ts">
  import { onMount } from 'svelte';
  import Button from '$lib/components/common/Button.svelte';
  import { exportToCSV } from '$lib/utils/exportUtils';
  import { formatDate } from '$lib/utils/formatDate';
  import { toggleDailyShiftScheduleActive, deleteDailyShiftSchedule } from '$lib/api/hrDailyShiftSchedule';

  export let tableData: any[] = [];
  export let isTableLoading: boolean = false;
  export let onRowSelect: (row: any) => void;
  export let onStatusUpdated: (() => void) | null = null;

  // For Edit Status
  async function handleEditStatus(row: any) {
    const currentStatus = row.is_active ? 'Active' : 'Inactive';
    const newStatus = row.is_active ? 'Inactive' : 'Active';
    
    if (confirm(`Are you sure you want to change the status of this schedule from ${currentStatus} to ${newStatus}?`)) {
      const newActive = !row.is_active;
      try {
        await toggleDailyShiftScheduleActive(row.schedule_id, newActive);
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
    if (confirm(`Are you sure you want to delete this schedule?`)) {
      try {
        await deleteDailyShiftSchedule(row.schedule_id);
        // Remove from table data
        tableData = tableData.filter(item => item.schedule_id !== row.schedule_id);
        alert('Schedule deleted successfully.');
      } catch (error) {
        console.error('Error deleting schedule:', error);
        alert('Failed to delete schedule. Please try again.');
      }
    }
  }

  let search = '';
  let sortColumn: string = 'schedule_date';
  let sortDirection: 'asc' | 'desc' = 'desc';

  // Filter state and show/hide
  let showFilters = false;
  let filter = {
    shift_name: '',
    schedule_date: '',
    is_active: ''
  };

  function clearFilters() {
    filter.shift_name = '';
    filter.schedule_date = '';
    filter.is_active = '';
  }

  $: filteredData = tableData
    .filter(row => {
      return (
        (!filter.shift_name || (row.hr_shift_master?.shift_name || '').toLowerCase().includes(filter.shift_name.toLowerCase())) &&
        (!filter.schedule_date || row.schedule_date.includes(filter.schedule_date)) &&
        (!filter.is_active || String(row.is_active) === filter.is_active)
      );
    })
    .filter(row => {
      if (!search) return true;
      const s = search.toLowerCase();
      return (
        (row.hr_shift_master?.shift_name || '').toLowerCase().includes(s) ||
        (row.hr_shift_master?.shift_code || '').toLowerCase().includes(s) ||
        row.schedule_date.toLowerCase().includes(s)
      );
    });

  $: sortedData = [...filteredData].sort((a, b) => {
    if (!sortColumn) return 0;
    let aValue = a[sortColumn];
    let bValue = b[sortColumn];
    
    if (sortColumn === 'schedule_date') {
      aValue = new Date(aValue).getTime();
      bValue = new Date(bValue).getTime();
    } else {
      if (aValue === null || aValue === undefined) aValue = '';
      if (bValue === null || bValue === undefined) bValue = '';
      aValue = String(aValue).toLowerCase();
      bValue = String(bValue).toLowerCase();
    }
    
    if (sortDirection === 'asc') {
      return aValue > bValue ? 1 : -1;
    } else {
      return aValue < bValue ? 1 : -1;
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
      'Date', 'Shift Name', 'Shift Code', 'Start Time', 'End Time', 'Active', 'Created By', 'Created Date'
    ];
    exportToCSV(
      sortedData,
      headers,
      'daily_shift_schedules',
      (row) => [
        formatDate(row.schedule_date),
        row.hr_shift_master?.shift_name || '',
        row.hr_shift_master?.shift_code || '',
        row.hr_shift_master?.start_time ? row.hr_shift_master.start_time.substring(0, 5) : '',
        row.hr_shift_master?.end_time ? row.hr_shift_master.end_time.substring(0, 5) : '',
        row.is_active ? 'Yes' : 'No',
        row.created_by,
        formatDate(row.created_dt)
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
    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div>
        <label for="filterShiftName" class="block text-sm font-medium theme-text-primary mb-1">Shift Name</label>
        <input id="filterShiftName" type="text" bind:value={filter.shift_name} placeholder="Shift Name" class="w-full px-2 py-1 text-sm border theme-border rounded theme-bg-primary theme-text-primary" />
      </div>
      <div>
        <label for="filterScheduleDate" class="block text-sm font-medium theme-text-primary mb-1">Schedule Date</label>
        <input id="filterScheduleDate" type="date" bind:value={filter.schedule_date} class="w-full px-2 py-1 text-sm border theme-border rounded theme-bg-primary theme-text-primary" />
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
        <p class="theme-text-primary text-sm">Loading daily shift schedules...</p>
      </div>
    </div>
  {:else}
    <table class="min-w-full table-auto border-separate border-spacing-y-1">
      <thead>
        <tr class="theme-bg-secondary theme-text-primary text-sm">
          <th class="px-4 py-2 text-left cursor-pointer" on:click={() => handleSort('schedule_date')}>
            Date
            <svg xmlns="http://www.w3.org/2000/svg" class="inline h-4 w-4 ml-1 transition-transform duration-200 {getSortIcon('schedule_date')}" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 11l5-5 5 5M7 13l5 5 5-5" />
            </svg>
          </th>
          <th class="px-4 py-2 text-left cursor-pointer" on:click={() => handleSort('hr_shift_master.shift_name')}>
            Shift Name
            <svg xmlns="http://www.w3.org/2000/svg" class="inline h-4 w-4 ml-1 transition-transform duration-200 {getSortIcon('hr_shift_master.shift_name')}" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 11l5-5 5 5M7 13l5 5 5-5" />
            </svg>
          </th>
          <th class="px-4 py-2 text-left cursor-pointer" on:click={() => handleSort('hr_shift_master.shift_code')}>
            Shift Code
            <svg xmlns="http://www.w3.org/2000/svg" class="inline h-4 w-4 ml-1 transition-transform duration-200 {getSortIcon('hr_shift_master.shift_code')}" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 11l5-5 5 5M7 13l5 5 5-5" />
            </svg>
          </th>
          <th class="px-4 py-2 text-left">Start Time</th>
          <th class="px-4 py-2 text-left">End Time</th>
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
            <td class="px-4 py-2 font-medium theme-text-primary">{formatDate(row.schedule_date)}</td>
            <td class="px-4 py-2 theme-text-primary">{row.hr_shift_master?.shift_name || '-'}</td>
            <td class="px-4 py-2 theme-text-primary">{row.hr_shift_master?.shift_code || '-'}</td>
            <td class="px-4 py-2 theme-text-primary">{row.hr_shift_master?.start_time ? row.hr_shift_master.start_time.substring(0, 5) : '-'}</td>
            <td class="px-4 py-2 theme-text-primary">{row.hr_shift_master?.end_time ? row.hr_shift_master.end_time.substring(0, 5) : '-'}</td>
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
                  title="Delete schedule"
                  aria-label="Delete schedule"
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
        <p class="theme-text-secondary">No daily shift schedules found.</p>
      </div>
    {/if}
  {/if}
</div> 