<script lang="ts">
  import { onMount } from 'svelte';
  import Button from '$lib/components/common/Button.svelte';
  import { exportToCSV } from '$lib/utils/exportUtils';
  import { formatDate } from '$lib/utils/formatDate';
  import { supabase } from '$lib/supabaseClient';
  import { fetchPlantStages } from '$lib/api/stdWorkDetails';

  export let tableData: any[] = [];
  export let isTableLoading: boolean = false;
  export let onRowSelect: (row: any) => void;
  export let onStatusUpdated: (() => void) | null = null;
  export let onAddItem: (() => void) | null = null;
  export let onImportClick: (() => void) | null = null;

  // Add fallback no-op functions
  const handleAddItem = () => { if (onAddItem) onAddItem(); };
  const handleImportClick = () => { if (onImportClick) onImportClick(); };

  // For Active toggle
  async function handleToggleActive(row: any) {
    const newActive = !row.is_active;
    try {
      const { getCurrentUsername, getCurrentTimestamp } = await import('$lib/utils/userUtils');
      const username = getCurrentUsername();
      const now = getCurrentTimestamp();
      await supabase
        .from('std_work_details')
        .update({ is_active: newActive, modified_by: username, modified_dt: now
          // created_by and created_dt should not be touched on update
        })
        .eq('sw_id', row.sw_id);
      row.is_active = newActive;
      row.modified_by = username;
      row.modified_dt = now;
      onStatusUpdated?.();
    } catch (error) {
      console.error('Error updating status:', error);
      alert('Failed to update status. Please try again.');
    }
  }

  // For Edit Status
  async function handleEditStatus(row: any) {
    const currentStatus = row.is_active ? 'Active' : 'Inactive';
    const newStatus = row.is_active ? 'Inactive' : 'Active';
    
    if (confirm(`Are you sure you want to change the status of "${row.sw_name}" from ${currentStatus} to ${newStatus}?`)) {
      const newActive = !row.is_active;
      try {
        const { getCurrentUsername, getCurrentTimestamp } = await import('$lib/utils/userUtils');
        const username = getCurrentUsername();
        const now = getCurrentTimestamp();
        await supabase
          .from('std_work_details')
          .update({ is_active: newActive, modified_by: username, modified_dt: now
            // created_by and created_dt should not be touched on update
          })
          .eq('sw_id', row.sw_id);
        row.is_active = newActive;
        row.modified_by = username;
        row.modified_dt = now;
        onStatusUpdated?.();
        alert(`Status updated successfully to ${newStatus}.`);
      } catch (error) {
        console.error('Error updating status:', error);
        alert('Failed to update status. Please try again.');
      }
    }
  }

  // For Delete
  async function handleDelete(row: any) {
    if (confirm(`Are you sure you want to delete the work "${row.sw_name}"?`)) {
      try {
        const { getCurrentUsername, getCurrentTimestamp } = await import('$lib/utils/userUtils');
        const username = getCurrentUsername();
        const now = getCurrentTimestamp();
        // Soft delete: set is_active = false
        const { error } = await supabase
          .from('std_work_details')
          .update({ is_active: false, modified_by: username, modified_dt: now
            // created_by and created_dt should not be touched on update
          })
          .eq('sw_id', row.sw_id);
        if (error) {
          alert('Failed to delete work. Please try again.');
        } else {
          // Remove from table data
          tableData = tableData.filter(item => item.sw_id !== row.sw_id);
          alert('Work deleted successfully.');
        }
      } catch (error) {
        console.error('Error deleting work:', error);
        alert('Failed to delete work. Please try again.');
      }
    }
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

  // Edit functionality
  let editingRow: any = null;
  let availablePlantStages: string[] = [];
  let isLoadingPlantStages = false;

  function clearFilters() {
    filter.sw_type = '';
    filter.plant_stage = '';
    filter.sw_code = '';
    filter.sw_name = '';
    filter.is_active = '';
  }

  // Load plant stages for edit dropdown
  async function loadPlantStages() {
    isLoadingPlantStages = true;
    try {
      availablePlantStages = await fetchPlantStages();
    } catch (error) {
      console.error('Error loading plant stages:', error);
      availablePlantStages = [];
    } finally {
      isLoadingPlantStages = false;
    }
  }

  // Start editing a row
  function startEdit(row: any) {
    editingRow = { ...row };
    if (availablePlantStages.length === 0) {
      loadPlantStages();
    }
  }

  // Cancel editing
  function cancelEdit() {
    editingRow = null;
  }

  // Save plant stage edit
  async function saveEdit() {
    if (!editingRow) return;

    try {
      const { getCurrentUsername, getCurrentTimestamp } = await import('$lib/utils/userUtils');
      const username = getCurrentUsername();
      const now = getCurrentTimestamp();

      const { error } = await supabase
        .from('std_work_details')
        .update({ 
          plant_stage: editingRow.plant_stage,
          modified_by: username,
          modified_dt: now
          // created_by and created_dt should not be touched on update
        })
        .eq('sw_id', editingRow.sw_id);

      if (error) {
        alert('Failed to update plant stage. Please try again.');
        return;
      }

      // Update the table data
      const index = tableData.findIndex(item => item.sw_id === editingRow.sw_id);
      if (index !== -1) {
        tableData[index].plant_stage = editingRow.plant_stage;
        tableData[index].modified_by = username;
        tableData[index].modified_dt = now;
        tableData = [...tableData]; // Trigger reactivity
      }

      editingRow = null;
      alert('Plant stage updated successfully.');
      onStatusUpdated?.();
    } catch (error) {
      console.error('Error updating plant stage:', error);
      alert('Failed to update plant stage. Please try again.');
    }
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
      'Plant-Stage', 'Type', 'Work Code', 'Work Name', 'Active'
    ];
    exportToCSV(
      tableData, // Export all data, not just filtered/sorted data
      headers,
      'std_work_details',
      (row) => [
        row.plant_stage,
        row.sw_type,
        row.sw_code,
        row.sw_name,
        row.is_active ? 'Yes' : 'No'
      ]
    );
  }
</script>

<!-- Table Controls -->
<div class="flex items-center justify-between space-x-2 p-3 border-b theme-bg-primary rounded-t-xl shadow mt-4">
  <span class="text-lg font-semibold theme-text-primary">Standard Works</span>
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
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
      <div>
        <label for="filterPlantStage" class="block text-sm font-medium theme-text-primary mb-1">Plant-Stage</label>
        <input id="filterPlantStage" type="text" bind:value={filter.plant_stage} placeholder="Plant-Stage" class="w-full px-2 py-1 text-sm border theme-border rounded theme-bg-primary theme-text-primary" />
      </div>
      <div>
        <label for="filterType" class="block text-sm font-medium theme-text-primary mb-1">Type</label>
        <input id="filterType" type="text" bind:value={filter.sw_type} placeholder="Type" class="w-full px-2 py-1 text-sm border theme-border rounded theme-bg-primary theme-text-primary" />
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
          <!-- Plant Stage is now the first column -->
          <th class="px-4 py-2 text-left cursor-pointer" on:click={() => handleSort('plant_stage')}>
            Plant-Stage
            <svg xmlns="http://www.w3.org/2000/svg" class="inline h-4 w-4 ml-1 transition-transform duration-200 {getSortIcon('plant_stage')}" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 11l5-5 5 5M7 13l5 5 5-5" />
            </svg>
          </th>
          <th class="px-4 py-2 text-left cursor-pointer" on:click={() => handleSort('sw_type')}>
            Type
            <svg xmlns="http://www.w3.org/2000/svg" class="inline h-4 w-4 ml-1 transition-transform duration-200 {getSortIcon('sw_type')}" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
          <th class="px-4 py-2 text-left">Actions</th>
        </tr>
      </thead>
      <tbody>
        {#each sortedData as row}
          <tr class="hover:theme-bg-tertiary cursor-pointer" on:click={() => onRowSelect(row)}>
            <td class="px-4 py-2">
              {#if editingRow && editingRow.sw_id === row.sw_id}
                <select 
                  bind:value={editingRow.plant_stage}
                  class="px-2 py-1 text-sm border theme-border rounded theme-bg-primary theme-text-primary"
                  on:click|stopPropagation
                >
                  {#each availablePlantStages as stage}
                    <option value={stage}>{stage}</option>
                  {/each}
                </select>
              {:else}
                {row.plant_stage}
              {/if}
            </td>
            <td class="px-4 py-2">{row.sw_type}</td>
            <td class="px-4 py-2">{row.sw_code}</td>
            <td class="px-4 py-2">{row.sw_name}</td>
            <td class="px-4 py-2">
              <span class="px-2 py-1 text-xs rounded-full {row.is_active ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'}">
                {row.is_active ? 'Active' : 'Inactive'}
              </span>
            </td>
            <td class="px-4 py-2" on:click|stopPropagation>
              <div class="flex gap-2">
                {#if editingRow && editingRow.sw_id === row.sw_id}
                  <!-- Save and Cancel buttons when editing -->
                  <button
                    on:click={saveEdit}
                    class="p-1 text-green-600 hover:text-green-900 hover:bg-green-100 dark:hover:bg-green-900 rounded transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-green-200 dark:focus:ring-green-800"
                    title="Save changes"
                    aria-label="Save changes"
                  >
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                    </svg>
                  </button>
                  <button
                    on:click={cancelEdit}
                    class="p-1 text-gray-600 hover:text-gray-900 hover:bg-gray-100 dark:hover:bg-gray-900 rounded transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-gray-200 dark:focus:ring-gray-800"
                    title="Cancel editing"
                    aria-label="Cancel editing"
                  >
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                {:else}
                  <!-- Normal action buttons -->
                  <button
                    on:click={() => startEdit(row)}
                    class="p-1 text-blue-600 hover:text-blue-900 hover:bg-blue-100 dark:hover:bg-blue-900 rounded transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-800"
                    title="Edit plant stage"
                    aria-label="Edit plant stage"
                  >
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  <button
                    on:click={() => handleEditStatus(row)}
                    class="p-1 text-orange-600 hover:text-orange-900 hover:bg-orange-100 dark:hover:bg-orange-900 rounded transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-orange-200 dark:focus:ring-orange-800"
                    title="Edit status"
                    aria-label="Edit status"
                  >
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 9l4-4 4 4m0 6l-4 4-4-4" />
                    </svg>
                  </button>
                  <button
                    on:click={() => handleDelete(row)}
                    class="p-1 text-red-600 hover:text-red-900 hover:bg-red-100 dark:hover:bg-red-900 rounded transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-red-200 dark:focus:ring-red-800"
                    title="Delete work"
                    aria-label="Delete work"
                  >
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                {/if}
              </div>
            </td>
          </tr>
        {/each}
      </tbody>
    </table>

    {#if sortedData.length === 0}
      <div class="text-center p-8">
        <p class="theme-text-secondary">No standard works found.</p>
      </div>
    {/if}
  {/if}
</div> 