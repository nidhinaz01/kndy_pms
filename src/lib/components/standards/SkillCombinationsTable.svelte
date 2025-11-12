<script lang="ts">
  import { onMount } from 'svelte';
  import Button from '$lib/components/common/Button.svelte';
  import { exportToCSV } from '$lib/utils/exportUtils';
  import { formatDate } from '$lib/utils/formatDate';
  import { toggleSkillCombinationActive, deleteSkillCombination } from '$lib/api/skillCombinations';

  export let tableData: any[] = [];
  export let isTableLoading: boolean = false;
  export let onRowSelect: (row: any) => void;
  export let onStatusUpdated: (() => void) | null = null;

  // For Edit Status
  async function handleEditStatus(row: any) {
    const currentStatus = row.is_active ? 'Active' : 'Inactive';
    const newStatus = row.is_active ? 'Inactive' : 'Active';
    
    if (confirm(`Are you sure you want to change the status of "${row.sc_name}" from ${currentStatus} to ${newStatus}?`)) {
      const newActive = !row.is_active;
      try {
        await toggleSkillCombinationActive(row.sc_id, newActive);
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
    if (confirm(`Are you sure you want to delete the skill combination "${row.sc_name}"?`)) {
      try {
        await deleteSkillCombination(row.sc_id);
        // Remove from table data
        tableData = tableData.filter(item => item.sc_id !== row.sc_id);
        alert('Skill combination deleted successfully.');
      } catch (error) {
        console.error('Error deleting skill combination:', error);
        alert('Failed to delete skill combination. Please try again.');
      }
    }
  }

  let search = '';
  let sortColumn: string = 'sc_name';
  let sortDirection: 'asc' | 'desc' = 'asc';

  // Filter state and show/hide
  let showFilters = false;
  let filter = {
    sc_name: '',
    manpower_required: '',
    is_active: ''
  };

  function clearFilters() {
    filter.sc_name = '';
    filter.manpower_required = '';
    filter.is_active = '';
  }

  $: filteredData = tableData
    .filter(row => {
      return (
        (!filter.sc_name || row.sc_name.toLowerCase().includes(filter.sc_name.toLowerCase())) &&
        (!filter.manpower_required || row.manpower_required.toString() === filter.manpower_required) &&
        (!filter.is_active || String(row.is_active) === filter.is_active)
      );
    })
    .filter(row => {
      if (!search) return true;
      const s = search.toLowerCase();
      return (
        row.sc_name.toLowerCase().includes(s) ||
        row.manpower_required.toString().includes(s) ||
        row.skill_combination.some((skill: any) => skill.skill_name.toLowerCase().includes(s))
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
      'Combination Name', 'Manpower Required', 'Skills', 'Active', 'Created By', 'Created Date'
    ];
    exportToCSV(
      sortedData,
      headers,
      'skill_combinations',
      (row) => [
        row.sc_name,
        row.manpower_required,
        row.skill_combination.map((skill: any) => skill.skill_name).join(' + '),
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
        <label for="filterName" class="block text-sm font-medium theme-text-primary mb-1">Combination Name</label>
        <input id="filterName" type="text" bind:value={filter.sc_name} placeholder="Combination Name" class="w-full px-2 py-1 text-sm border theme-border rounded theme-bg-primary theme-text-primary" />
      </div>
      <div>
        <label for="filterManpower" class="block text-sm font-medium theme-text-primary mb-1">Manpower Required</label>
        <input id="filterManpower" type="number" bind:value={filter.manpower_required} placeholder="Manpower" class="w-full px-2 py-1 text-sm border theme-border rounded theme-bg-primary theme-text-primary" />
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
        <p class="theme-text-primary text-sm">Loading skill combinations...</p>
      </div>
    </div>
  {:else}
    <table class="min-w-full table-auto border-separate border-spacing-y-1">
      <thead>
        <tr class="theme-bg-secondary theme-text-primary text-sm">
          <th class="px-4 py-2 text-left cursor-pointer" on:click={() => handleSort('sc_name')}>
            Combination Name
            <svg xmlns="http://www.w3.org/2000/svg" class="inline h-4 w-4 ml-1 transition-transform duration-200 {getSortIcon('sc_name')}" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 11l5-5 5 5M7 13l5 5 5-5" />
            </svg>
          </th>
          <th class="px-4 py-2 text-left cursor-pointer" on:click={() => handleSort('manpower_required')}>
            Manpower
            <svg xmlns="http://www.w3.org/2000/svg" class="inline h-4 w-4 ml-1 transition-transform duration-200 {getSortIcon('manpower_required')}" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 11l5-5 5 5M7 13l5 5 5-5" />
            </svg>
          </th>
          <th class="px-4 py-2 text-left">Skills</th>
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
            <td class="px-4 py-2 font-medium theme-text-primary">{row.sc_name}</td>
            <td class="px-4 py-2 theme-text-primary">{row.manpower_required}</td>
            <td class="px-4 py-2 theme-text-primary">
              <div class="flex flex-wrap gap-1">
                {#each row.skill_combination as skill, index}
                  <span class="px-2 py-1 text-xs bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded">
                    {skill.skill_name}
                  </span>
                {/each}
              </div>
            </td>
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
                  title="Delete skill combination"
                  aria-label="Delete skill combination"
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
  {/if}
</div> 