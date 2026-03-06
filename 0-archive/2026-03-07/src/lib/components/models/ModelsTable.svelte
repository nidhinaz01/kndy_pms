<script lang="ts">
  import { DataTable } from '$lib/utils/dataTable';
  import { onMount } from 'svelte';
  import Button from '$lib/components/common/Button.svelte';
  import { exportToCSV } from '$lib/utils/exportUtils';

  export let tableData: any[];
  export let isTableLoading: boolean;
  export let onRowSelect: (row: any) => void;
  export let onDeleteSelected: (selectedIds: string[]) => void;
  export let onEditModel: (model: any) => void;

  let dataTable: DataTable<any>;
  let search = '';
  let showFilters = false;
  let filter = {
    wo_type_code: { op: '', value: '' },
    wo_type_name: { op: '', value: '' },
    wo_comfort_level: { op: '', value: '' },
    wo_capacity: { op: '', value: '' },
    wo_carrier_type: { op: '', value: '' }
  };

  // Sorting state
  let sortColumn: string = '';
  let sortDirection: 'asc' | 'desc' = 'asc';

  // Initialize data table when tableData is available
  $: if (tableData && tableData.length > 0 && !dataTable) {
    console.log('ModelsTable creating DataTable - tableData length:', tableData.length);
    dataTable = new DataTable(tableData, {
      searchable: true,
      sortable: true,
      filterable: true,
      pageSize: 50
    });
  }

  // Update data table when tableData changes
  $: if (dataTable && tableData) {
    console.log('ModelsTable updating data - tableData length:', tableData.length);
    dataTable.updateData(tableData);
  }

  // Update search when it changes
  $: if (dataTable && search !== undefined) {
    dataTable.setSearch(search);
  }

  // Svelte reactive sorting - this will automatically re-run when dependencies change
  $: sortedData = (() => {
    if (!tableData || tableData.length === 0) return [];
    
    let data = [...tableData];
    
    // Apply search filter
    if (search) {
      const searchLower = search.toLowerCase();
      data = data.filter(row => 
        Object.values(row).some(value => 
          String(value || '').toLowerCase().includes(searchLower)
        )
      );
    }
    
    // Apply column filters
    Object.entries(filter).forEach(([key, filterConfig]) => {
      if (filterConfig.value && filterConfig.value.trim() !== '') {
        const filterValue = filterConfig.value;
        const filterOp = filterConfig.op;
        
        data = data.filter(row => {
          const rowValue = row[key];
          
          // Text filtering for all fields
          if (!filterOp || filterOp === '') {
            return String(rowValue || '').toLowerCase().includes(filterValue.toLowerCase());
          }
          
          const rowValueStr = String(rowValue || '').toLowerCase();
          const filterValueStr = filterValue.toLowerCase();
          
          switch (filterOp) {
            case '=':
              return rowValueStr === filterValueStr;
            case 'contains':
              return rowValueStr.includes(filterValueStr);
            default:
              return rowValueStr.includes(filterValueStr);
          }
        });
      }
    });
    
    // Apply sorting
    if (sortColumn) {
      data.sort((a, b) => {
        let aValue = a[sortColumn];
        let bValue = b[sortColumn];
        
        // Handle null/undefined values
        if (aValue === null || aValue === undefined) aValue = '';
        if (bValue === null || bValue === undefined) bValue = '';
        
        // Convert to string for comparison
        aValue = String(aValue).toLowerCase();
        bValue = String(bValue).toLowerCase();
        
        if (sortDirection === 'asc') {
          return aValue.localeCompare(bValue);
        } else {
          return bValue.localeCompare(aValue);
        }
      });
    }
    
    return data;
  })();

  function handleSort(column: string) {
    if (sortColumn === column) {
      // Toggle direction if same column
      sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      // New column, default to ascending
      sortColumn = column;
      sortDirection = 'asc';
    }
  }

  function handleDeleteModel(model: any) {
    if (confirm(`Are you sure you want to delete "${model.wo_type_name}"?`)) {
      onDeleteSelected([model.id]);
    }
  }

  function handleEditModel(model: any) {
    onEditModel(model);
  }

  function exportData() {
    if (!dataTable) return;

    const headers = ['Type Code', 'Type Name', 'Comfort Level', 'Capacity', 'Carrier Type', 'Status'];
    const processedData = dataTable.getProcessedData();
    
    exportToCSV(
      processedData,
      headers,
      'models',
      (row) => [
        row.wo_type_code,
        row.wo_type_name,
        row.wo_comfort_level,
        row.wo_capacity,
        row.wo_carrier_type,
        row.is_active ? 'Active' : 'Inactive'
      ]
    );
  }

  function getSortIcon(column: string): string {
    return dataTable ? dataTable.getSortIcon(column) : 'text-gray-400';
  }

  function getProcessedData() {
    return dataTable ? dataTable.getProcessedData() : [];
  }
</script>

<!-- Table Controls -->
<div class="flex items-center justify-between space-x-2 p-3 border-b theme-bg-primary rounded-t-xl shadow mt-4 transition-colors duration-200">
  <div class="flex items-center gap-2">
    <div class="relative flex-1 max-w-xs">
      <input 
        type="text" 
        placeholder="Search..." 
        bind:value={search} 
        class="border theme-border rounded-full pl-10 pr-3 py-2 w-full focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-800 focus:outline-none theme-bg-secondary theme-text-primary transition-colors duration-200" 
      />
      <span class="absolute left-3 top-2.5 theme-text-tertiary transition-colors duration-200">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-4.35-4.35M17 11A6 6 0 105 11a6 6 0 0012 0z" />
        </svg>
      </span>
    </div>
    <button
      class="px-3 py-1.5 bg-gray-500 text-white text-sm rounded-lg border-2 border-gray-500 shadow hover:bg-gray-600 hover:border-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-200 dark:focus:ring-gray-800 active:bg-gray-700 active:border-gray-700 transition-all duration-200"
      on:click={() => showFilters = !showFilters}
    >
      {showFilters ? 'Hide' : 'Show'} Filters
    </button>
  </div>
  <button 
    class="px-4 py-2 bg-green-500 text-white rounded-lg border-2 border-green-500 shadow hover:bg-green-600 hover:border-green-600 focus:outline-none focus:ring-2 focus:ring-green-200 dark:focus:ring-green-800 active:bg-green-700 active:border-green-700 transition-all duration-200"
    on:click={exportData}
  >
    Export
  </button>
</div>

<!-- Filters Section -->
{#if showFilters}
  <div class="p-3 border-b theme-bg-primary transition-colors duration-200">
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
      <div>
        <label for="typeCodeFilter" class="block text-sm font-medium theme-text-primary mb-1">Type Code</label>
        <input
          type="text"
          bind:value={filter.wo_type_code.value}
          placeholder="Filter by code"
          class="w-full px-2 py-1 text-sm border theme-border rounded theme-bg-primary theme-text-primary"
          id="typeCodeFilter"
        />
      </div>
      <div>
        <label for="typeNameFilter" class="block text-sm font-medium theme-text-primary mb-1">Type Name</label>
        <input
          type="text"
          bind:value={filter.wo_type_name.value}
          placeholder="Filter by name"
          class="w-full px-2 py-1 text-sm border theme-border rounded theme-bg-primary theme-text-primary"
          id="typeNameFilter"
        />
      </div>
      <div>
        <label for="comfortLevelFilter" class="block text-sm font-medium theme-text-primary mb-1">Comfort Level</label>
        <input
          type="text"
          bind:value={filter.wo_comfort_level.value}
          placeholder="Filter by comfort"
          class="w-full px-2 py-1 text-sm border theme-border rounded theme-bg-primary theme-text-primary"
          id="comfortLevelFilter"
        />
      </div>
      <div>
        <label for="capacityFilter" class="block text-sm font-medium theme-text-primary mb-1">Capacity</label>
        <input
          type="text"
          bind:value={filter.wo_capacity.value}
          placeholder="Filter by capacity"
          class="w-full px-2 py-1 text-sm border theme-border rounded theme-bg-primary theme-text-primary"
          id="capacityFilter"
        />
      </div>
      <div>
        <label for="carrierTypeFilter" class="block text-sm font-medium theme-text-primary mb-1">Carrier Type</label>
        <input
          type="text"
          bind:value={filter.wo_carrier_type.value}
          placeholder="Filter by carrier"
          class="w-full px-2 py-1 text-sm border theme-border rounded theme-bg-primary theme-text-primary"
          id="carrierTypeFilter"
        />
      </div>
    </div>
    <div class="flex justify-end mt-4">
      <button
        class="px-3 py-1.5 bg-gray-500 text-white text-sm rounded-lg border-2 border-gray-500 shadow hover:bg-gray-600 hover:border-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-200 dark:focus:ring-gray-800 active:bg-gray-700 active:border-gray-700 transition-all duration-200"
        on:click={() => {
          filter.wo_type_code.value = '';
          filter.wo_type_name.value = '';
          filter.wo_comfort_level.value = '';
          filter.wo_capacity.value = '';
          filter.wo_carrier_type.value = '';
          filter = filter; // Trigger reactivity
        }}
      >
        Clear Filters
      </button>
    </div>
  </div>
{/if}

<!-- Data Table -->
<div class="flex-1 overflow-auto theme-bg-primary rounded-b-xl shadow transition-colors duration-200">
  {#if isTableLoading}
    <div class="flex items-center justify-center p-8">
      <div class="text-center">
        <div class="animate-spin rounded-full h-8 w-8 border-b-2 theme-accent mx-auto mb-2"></div>
        <p class="theme-text-primary text-sm">Loading models...</p>
      </div>
    </div>
  {:else}
    <table class="min-w-full table-auto border-separate border-spacing-y-1">
      <thead>
        <tr class="theme-bg-secondary theme-text-primary text-sm transition-colors duration-200">
          <th class="px-4 py-2 text-left">
            <button 
              class="flex items-center gap-1 hover:theme-accent transition-colors duration-200" 
              on:click={() => handleSort('wo_type_code')}
            >
              Type Code
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 transition-transform duration-200 {getSortIcon('wo_type_code')}" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
              </svg>
            </button>
          </th>
          <th class="px-4 py-2 text-left">
            <button 
              class="flex items-center gap-1 hover:theme-accent transition-colors duration-200" 
              on:click={() => handleSort('wo_type_name')}
            >
              Type Name
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 transition-transform duration-200 {getSortIcon('wo_type_name')}" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
              </svg>
            </button>
          </th>
          <th class="px-4 py-2 text-left">
            <button 
              class="flex items-center gap-1 hover:theme-accent transition-colors duration-200" 
              on:click={() => handleSort('wo_comfort_level')}
            >
              Comfort Level
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 transition-transform duration-200 {getSortIcon('wo_comfort_level')}" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
              </svg>
            </button>
          </th>
          <th class="px-4 py-2 text-left">
            <button 
              class="flex items-center gap-1 hover:theme-accent transition-colors duration-200" 
              on:click={() => handleSort('wo_capacity')}
            >
              Capacity
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 transition-transform duration-200 {getSortIcon('wo_capacity')}" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
              </svg>
            </button>
          </th>
          <th class="px-4 py-2 text-left">
            <button 
              class="flex items-center gap-1 hover:theme-accent transition-colors duration-200" 
              on:click={() => handleSort('wo_carrier_type')}
            >
              Carrier Type
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 transition-transform duration-200 {getSortIcon('wo_carrier_type')}" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
              </svg>
            </button>
          </th>
          <th class="px-4 py-2 text-left">
            <button 
              class="flex items-center gap-1 hover:theme-accent transition-colors duration-200" 
              on:click={() => handleSort('is_active')}
            >
              Status
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 transition-transform duration-200 {getSortIcon('is_active')}" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
              </svg>
            </button>
          </th>
          <th class="px-4 py-2 text-left">
            Actions
          </th>
        </tr>
      </thead>
      <tbody>
        {#each sortedData as row}
          <tr 
            class="hover:bg-blue-100 dark:hover:bg-blue-900 cursor-pointer transition-colors duration-200" 
            on:click={() => onRowSelect(row)}
          >
            <td class="px-4 py-2 theme-bg-primary theme-text-primary transition-colors duration-200">{row.wo_type_code}</td>
            <td class="px-4 py-2 theme-bg-primary theme-text-primary transition-colors duration-200">{row.wo_type_name}</td>
            <td class="px-4 py-2 theme-bg-primary theme-text-primary transition-colors duration-200">{row.wo_comfort_level}</td>
            <td class="px-4 py-2 theme-bg-primary theme-text-primary transition-colors duration-200">{row.wo_capacity}</td>
            <td class="px-4 py-2 theme-bg-primary theme-text-primary transition-colors duration-200">{row.wo_carrier_type}</td>
            <td class="px-4 py-2 theme-bg-primary theme-text-primary transition-colors duration-200">
              <span class="px-2 py-1 text-xs rounded-full {row.is_active ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'}">
                {row.is_active ? 'Active' : 'Inactive'}
              </span>
            </td>
            <td class="px-4 py-2 theme-bg-primary theme-text-primary transition-colors duration-200" on:click|stopPropagation>
              <div class="flex gap-2">
                <button
                  on:click={() => handleEditModel(row)}
                  class="p-1 text-blue-600 hover:text-blue-900 hover:bg-blue-100 dark:hover:bg-blue-900 rounded transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-800"
                  title="Edit model"
                  aria-label="Edit model"
                >
                  <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </button>
                <button
                  on:click={() => handleDeleteModel(row)}
                  class="p-1 text-red-600 hover:text-red-900 hover:bg-red-100 dark:hover:bg-red-900 rounded transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-red-200 dark:focus:ring-red-800"
                  title="Delete model"
                  aria-label="Delete model"
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