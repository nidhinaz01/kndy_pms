<script lang="ts">
  import { onMount } from 'svelte';
  import Button from '$lib/components/common/Button.svelte';
  import { exportToCSV } from '$lib/utils/exportUtils';
  import { formatDate } from '$lib/utils/formatDate';
  import { toggleSkillTimeStandardActive, deleteSkillTimeStandard } from '$lib/api/stdSkillTimeStandards';

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
    
    if (confirm(`Are you sure you want to change the status of this time standard from ${currentStatus} to ${newStatus}?`)) {
      const newActive = !row.is_active;
      try {
        await toggleSkillTimeStandardActive(row.sts_id, newActive);
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
    if (confirm(`Are you sure you want to delete this time standard?`)) {
      try {
        await deleteSkillTimeStandard(row.sts_id);
        // Remove from table data
        tableData = tableData.filter(item => item.sts_id !== row.sts_id);
        alert('Time standard deleted successfully.');
      } catch (error) {
        console.error('Error deleting time standard:', error);
        alert('Failed to delete time standard. Please try again.');
      }
    }
  }

  let search = '';
  let sortColumn: string = 'derived_sw_code';
  let sortDirection: 'asc' | 'desc' = 'asc';
  let showFilters = false;
  let filter = {
    plant_stage: '',
    derived_sw_code: '',
    work_name: '',
    type_description: '',
    sc_name: '',
    skill_short: '',
    standard_time_minutes: '',
    skill_order: '',
    is_active: ''
  };

  function clearFilters() {
    filter.plant_stage = '';
    filter.derived_sw_code = '';
    filter.work_name = '';
    filter.type_description = '';
    filter.sc_name = '';
    filter.skill_short = '';
    filter.standard_time_minutes = '';
    filter.skill_order = '';
    filter.is_active = '';
  }

  // Computed properties
  $: filteredData = tableData.filter(row => {
    return (
      (!filter.plant_stage || (row.std_work_skill_mapping?.std_work_type_details?.std_work_details?.plant_stage || '').toLowerCase().includes(filter.plant_stage.toLowerCase())) &&
      (!filter.derived_sw_code || (row.std_work_skill_mapping?.derived_sw_code || '').toLowerCase().includes(filter.derived_sw_code.toLowerCase())) &&
      (!filter.work_name || (row.std_work_skill_mapping?.std_work_type_details?.std_work_details?.sw_name || '').toLowerCase().includes(filter.work_name.toLowerCase())) &&
      (!filter.type_description || (row.std_work_skill_mapping?.std_work_type_details?.type_description || '').toLowerCase().includes(filter.type_description.toLowerCase())) &&
      (!filter.sc_name || (row.std_work_skill_mapping?.sc_name || '').toLowerCase().includes(filter.sc_name.toLowerCase())) &&
      (!filter.skill_short || row.skill_short.toLowerCase().includes(filter.skill_short.toLowerCase())) &&
      (!filter.standard_time_minutes || row.standard_time_minutes.toString().includes(filter.standard_time_minutes)) &&
      (!filter.skill_order || row.skill_order.toString().includes(filter.skill_order)) &&
      (!filter.is_active || String(row.is_active) === filter.is_active)
    );
  }).filter(row => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      (row.std_work_skill_mapping?.std_work_type_details?.std_work_details?.plant_stage || '').toLowerCase().includes(s) ||
      (row.std_work_skill_mapping?.derived_sw_code || '').toLowerCase().includes(s) ||
      (row.std_work_skill_mapping?.std_work_type_details?.std_work_details?.sw_name || '').toLowerCase().includes(s) ||
      row.skill_short.toLowerCase().includes(s) ||
      (row.std_work_skill_mapping?.std_work_type_details?.type_description || '').toLowerCase().includes(s) ||
      (row.std_work_skill_mapping?.sc_name || '').toLowerCase().includes(s) ||
      row.standard_time_minutes.toString().includes(s)
    );
  });

  $: sortedData = [...filteredData].sort((a, b) => {
    let aVal = a[sortColumn];
    let bVal = b[sortColumn];

    // Handle nested properties
    if (sortColumn === 'plant_stage') {
      aVal = a.std_work_skill_mapping?.std_work_type_details?.std_work_details?.plant_stage || '';
      bVal = b.std_work_skill_mapping?.std_work_type_details?.std_work_details?.plant_stage || '';
    } else if (sortColumn === 'derived_sw_code') {
      aVal = a.std_work_skill_mapping?.derived_sw_code || '';
      bVal = b.std_work_skill_mapping?.derived_sw_code || '';
    } else if (sortColumn === 'work_name') {
      aVal = a.std_work_skill_mapping?.std_work_type_details?.std_work_details?.sw_name || '';
      bVal = b.std_work_skill_mapping?.std_work_type_details?.std_work_details?.sw_name || '';
    } else if (sortColumn === 'type_description') {
      aVal = a.std_work_skill_mapping?.std_work_type_details?.type_description || '';
      bVal = b.std_work_skill_mapping?.std_work_type_details?.type_description || '';
    } else if (sortColumn === 'sc_name') {
      aVal = a.std_work_skill_mapping?.sc_name || '';
      bVal = b.std_work_skill_mapping?.sc_name || '';
    }

    if (typeof aVal === 'string') {
      aVal = aVal.toLowerCase();
      bVal = bVal.toLowerCase();
    }

    if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
    return 0;
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
    if (sortColumn !== column) return '';
    return sortDirection === 'asc' ? 'rotate-180' : '';
  }

  function exportData() {
    const headers = [
      'Plant Stage', 'Derived Work Code', 'Work Name', 'Type Description', 'Skill Combination', 'Skill', 'Standard Time (min)', 'Skill Order', 'Active', 'Created By', 'Created Date'
    ];
    exportToCSV(
      tableData, // Export all data, not just filtered/sorted data
      headers,
      'skill_time_standards',
      (row) => [
        row.std_work_skill_mapping?.std_work_type_details?.std_work_details?.plant_stage || '',
        row.std_work_skill_mapping?.derived_sw_code || '',
        row.std_work_skill_mapping?.std_work_type_details?.std_work_details?.sw_name || '',
        row.std_work_skill_mapping?.std_work_type_details?.type_description || '',
        row.std_work_skill_mapping?.sc_name || '',
        row.skill_short,
        row.standard_time_minutes,
        row.skill_order,
        row.is_active ? 'Yes' : 'No',
        row.created_by,
        formatDate(row.created_dt)
      ]
    );
  }
</script>

<!-- Table Controls -->
<div class="flex items-center justify-between space-x-2 p-3 border-b theme-bg-primary rounded-t-xl shadow mt-4">
  <span class="text-lg font-semibold theme-text-primary">Skill Time Standards</span>
  <div class="flex items-center gap-2">
    <input type="text" placeholder="Search..." bind:value={search} class="border theme-border rounded-full pl-3 pr-3 py-2 w-full max-w-xs theme-bg-secondary theme-text-primary" />
    <span class="min-w-[140px] whitespace-nowrap">
      <Button variant="secondary" size="sm" on:click={() => showFilters = !showFilters}>
        {showFilters ? 'Hide' : 'Show'} Filters
      </Button>
    </span>
    <Button variant="secondary" size="sm" on:click={handleImportClick}>
      <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
      </svg>
      Import
    </Button>
    <Button variant="primary" size="sm" on:click={handleAddItem}>
      <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
      </svg>
      Add
    </Button>
    <Button variant="secondary" size="sm" on:click={exportData}>
      <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v8m0 0l-3-3m3 3l3-3" />
      </svg>
      Export
    </Button>
  </div>
</div>

<!-- Filters Section -->
{#if showFilters}
  <div class="p-3 border-b theme-bg-primary">
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-9 gap-4">
      <div>
        <label for="filterPlantStage" class="block text-sm font-medium theme-text-primary mb-1">Plant Stage</label>
        <input id="filterPlantStage" type="text" bind:value={filter.plant_stage} placeholder="Plant Stage" class="w-full px-2 py-1 text-sm border theme-border rounded theme-bg-primary theme-text-primary" />
      </div>
      <div>
        <label for="filterDerivedWorkCode" class="block text-sm font-medium theme-text-primary mb-1">Derived Work Code</label>
        <input id="filterDerivedWorkCode" type="text" bind:value={filter.derived_sw_code} placeholder="Derived Work Code" class="w-full px-2 py-1 text-sm border theme-border rounded theme-bg-primary theme-text-primary" />
      </div>
      <div>
        <label for="filterWorkName" class="block text-sm font-medium theme-text-primary mb-1">Work Name</label>
        <input id="filterWorkName" type="text" bind:value={filter.work_name} placeholder="Work Name" class="w-full px-2 py-1 text-sm border theme-border rounded theme-bg-primary theme-text-primary" />
      </div>
      <div>
        <label for="filterTypeDescription" class="block text-sm font-medium theme-text-primary mb-1">Type Description</label>
        <input id="filterTypeDescription" type="text" bind:value={filter.type_description} placeholder="Type Description" class="w-full px-2 py-1 text-sm border theme-border rounded theme-bg-primary theme-text-primary" />
      </div>
      <div>
        <label for="filterSkillCombination" class="block text-sm font-medium theme-text-primary mb-1">Skill Combination</label>
        <input id="filterSkillCombination" type="text" bind:value={filter.sc_name} placeholder="Skill Combination" class="w-full px-2 py-1 text-sm border theme-border rounded theme-bg-primary theme-text-primary" />
      </div>
      <div>
        <label for="filterSkill" class="block text-sm font-medium theme-text-primary mb-1">Skill</label>
        <input id="filterSkill" type="text" bind:value={filter.skill_short} placeholder="Skill" class="w-full px-2 py-1 text-sm border theme-border rounded theme-bg-primary theme-text-primary" />
      </div>
      <div>
        <label for="filterStandardTime" class="block text-sm font-medium theme-text-primary mb-1">Standard Time (min)</label>
        <input id="filterStandardTime" type="text" bind:value={filter.standard_time_minutes} placeholder="Standard Time" class="w-full px-2 py-1 text-sm border theme-border rounded theme-bg-primary theme-text-primary" />
      </div>
      <div>
        <label for="filterSkillOrder" class="block text-sm font-medium theme-text-primary mb-1">Skill Order</label>
        <input id="filterSkillOrder" type="text" bind:value={filter.skill_order} placeholder="Skill Order" class="w-full px-2 py-1 text-sm border theme-border rounded theme-bg-primary theme-text-primary" />
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

<!-- Table -->
<div class="overflow-auto theme-bg-primary rounded-b-xl shadow">
  {#if isTableLoading}
    <div class="flex items-center justify-center p-8">
      <div class="text-center">
        <div class="animate-spin rounded-full h-8 w-8 border-b-2 theme-accent mx-auto mb-2"></div>
        <p class="theme-text-primary text-sm">Loading skill time standards...</p>
      </div>
    </div>
  {:else}
    <table class="min-w-full table-auto border-separate border-spacing-y-1">
      <thead>
        <tr class="theme-bg-secondary theme-text-primary text-sm">
          <!-- Plant Stage is now the first column -->
          <th class="px-4 py-2 text-left cursor-pointer" on:click={() => handleSort('plant_stage')}>
            Plant Stage
            <svg xmlns="http://www.w3.org/2000/svg" class="inline h-4 w-4 ml-1 transition-transform duration-200 {getSortIcon('plant_stage')}" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 11l5-5 5 5M7 13l5 5 5-5" />
            </svg>
          </th>
          <th class="px-4 py-2 text-left cursor-pointer" on:click={() => handleSort('derived_sw_code')}>
            Derived Work Code
            <svg xmlns="http://www.w3.org/2000/svg" class="inline h-4 w-4 ml-1 transition-transform duration-200 {getSortIcon('derived_sw_code')}" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 11l5-5 5 5M7 13l5 5 5-5" />
            </svg>
          </th>
          <th class="px-4 py-2 text-left cursor-pointer" on:click={() => handleSort('work_name')}>
            Work Name
            <svg xmlns="http://www.w3.org/2000/svg" class="inline h-4 w-4 ml-1 transition-transform duration-200 {getSortIcon('work_name')}" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 11l5-5 5 5M7 13l5 5 5-5" />
            </svg>
          </th>
          <th class="px-4 py-2 text-left cursor-pointer" on:click={() => handleSort('type_description')}>
            Type Description
            <svg xmlns="http://www.w3.org/2000/svg" class="inline h-4 w-4 ml-1 transition-transform duration-200 {getSortIcon('type_description')}" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 11l5-5 5 5M7 13l5 5 5-5" />
            </svg>
          </th>
          <th class="px-4 py-2 text-left cursor-pointer" on:click={() => handleSort('sc_name')}>
            Skill Combination
            <svg xmlns="http://www.w3.org/2000/svg" class="inline h-4 w-4 ml-1 transition-transform duration-200 {getSortIcon('sc_name')}" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 11l5-5 5 5M7 13l5 5 5-5" />
            </svg>
          </th>
          <th class="px-4 py-2 text-left cursor-pointer" on:click={() => handleSort('skill_short')}>
            Skill
            <svg xmlns="http://www.w3.org/2000/svg" class="inline h-4 w-4 ml-1 transition-transform duration-200 {getSortIcon('skill_short')}" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 11l5-5 5 5M7 13l5 5 5-5" />
            </svg>
          </th>
          <th class="px-4 py-2 text-left cursor-pointer" on:click={() => handleSort('standard_time_minutes')}>
            Standard Time (min)
            <svg xmlns="http://www.w3.org/2000/svg" class="inline h-4 w-4 ml-1 transition-transform duration-200 {getSortIcon('standard_time_minutes')}" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 11l5-5 5 5M7 13l5 5 5-5" />
            </svg>
          </th>
          <th class="px-4 py-2 text-left cursor-pointer" on:click={() => handleSort('skill_order')}>
            Skill Order
            <svg xmlns="http://www.w3.org/2000/svg" class="inline h-4 w-4 ml-1 transition-transform duration-200 {getSortIcon('skill_order')}" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
            <td class="px-4 py-2 theme-text-primary">{row.std_work_skill_mapping?.std_work_type_details?.std_work_details?.plant_stage || '-'}</td>
            <td class="px-4 py-2 font-medium theme-text-primary">{row.std_work_skill_mapping?.derived_sw_code || '-'}</td>
            <td class="px-4 py-2 theme-text-primary">{row.std_work_skill_mapping?.std_work_type_details?.std_work_details?.sw_name || '-'}</td>
            <td class="px-4 py-2 theme-text-primary">{row.std_work_skill_mapping?.std_work_type_details?.type_description || '-'}</td>
            <td class="px-4 py-2 theme-text-primary">{row.std_work_skill_mapping?.sc_name || '-'}</td>
            <td class="px-4 py-2 theme-text-primary">{row.skill_short}</td>
            <td class="px-4 py-2 theme-text-primary">{row.standard_time_minutes}</td>
            <td class="px-4 py-2 theme-text-primary">{row.skill_order}</td>
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
                  title="Delete time standard"
                  aria-label="Delete time standard"
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
        <p class="theme-text-secondary">No skill time standards found.</p>
      </div>
    {/if}
  {/if}
</div> 