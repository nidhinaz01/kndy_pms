<script lang="ts">
  import { DataTable } from '$lib/utils/dataTable';
  import { onMount } from 'svelte';
  import { exportToCSV } from '$lib/utils/exportUtils';
  import { formatDate } from '$lib/utils/formatDate';
  import type { Holiday } from '$lib/api/planning';

  export let tableData: Holiday[];
  export let expandTable: boolean;
  export let onExpandToggle: () => void;
  export let onRowSelect: (row: any) => void;
  export let onDeleteRow: (rowId: number) => void;
  export let onEditRow: (row: any) => void;

  let dataTable: DataTable<Holiday>;
  let search = '';
  let showFilters = false;
  let filter = {
    dt_month: { op: '', value: '' },
    dt_year: { op: '', value: '' },
    description: { op: '', value: '' }
  };

  // Sorting state
  let sortColumn: string = '';
  let sortDirection: 'asc' | 'desc' = 'asc';

  // Initialize data table when tableData is available
  $: if (tableData && tableData.length > 0 && !dataTable) {
    console.log('HolidayTable creating DataTable - tableData length:', tableData.length);
    dataTable = new DataTable(tableData, {
      searchable: true,
      sortable: true,
      filterable: true,
      pageSize: 50
    });
  }

  // Update data table when tableData changes
  $: if (dataTable && tableData) {
    console.log('HolidayTable updating data - tableData length:', tableData.length);
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
        Object.values(row as unknown as Record<string, unknown>).some(value => 
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
          const rowValue = (row as unknown as Record<string, unknown>)[key];
          
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
        let aValue = (a as unknown as Record<string, unknown>)[sortColumn];
        let bValue = (b as unknown as Record<string, unknown>)[sortColumn];
        
        // Handle null/undefined values
        if (aValue === null || aValue === undefined) aValue = '';
        if (bValue === null || bValue === undefined) bValue = '';
        
        // Convert to string for comparison
        const aValueStr = String(aValue).toLowerCase();
        const bValueStr = String(bValue).toLowerCase();
        
        if (sortDirection === 'asc') {
          return aValueStr.localeCompare(bValueStr);
        } else {
          return bValueStr.localeCompare(aValueStr);
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

  function handleDeleteHoliday(holiday: Holiday) {
    if (confirm(`Are you sure you want to delete holiday "${holiday.description}"?`)) {
      onDeleteRow(holiday.id);
    }
  }

  function exportData() {
    if (!dataTable) return;

    const headers = ['Date', 'Day', 'Month', 'Year', 'Description', 'Status', 'Created By', 'Created Date'];
    const processedData = dataTable.getProcessedData();
    
    exportToCSV(
      processedData,
      headers,
      'holidays',
      (row) => [
        row.dt_value ? formatDate(row.dt_value) : `${row.dt_day} ${row.dt_month} ${row.dt_year}`,
        row.dt_day.toString(),
        row.dt_month,
        row.dt_year.toString(),
        row.description,
        row.is_active ? 'Active' : 'Inactive',
        row.created_by,
        formatDate(row.created_dt)
      ]
    );
  }

  function getSortIcon(column: string): string {
    return dataTable ? dataTable.getSortIcon(column) : 'text-gray-400';
  }

  function getStatusColor(holiday: Holiday): string {
    return holiday.is_active 
      ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
      : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
  }

  function getStatusText(holiday: Holiday): string {
    return holiday.is_active ? 'Active' : 'Inactive';
  }

  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
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
    <button
      class="px-3 py-1.5 bg-blue-500 text-white text-sm rounded-lg border-2 border-blue-500 shadow hover:bg-blue-600 hover:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-800 active:bg-blue-700 active:border-blue-700 transition-all duration-200"
      on:click={onExpandToggle}
    >
      {expandTable ? 'Collapse' : 'Expand'} Table
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
    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div>
        <label for="monthFilter" class="block text-sm font-medium theme-text-primary mb-1">Month</label>
        <select
          bind:value={filter.dt_month.value}
          class="w-full px-2 py-1 text-sm border theme-border rounded theme-bg-primary theme-text-primary"
          id="monthFilter"
        >
          <option value="">All Months</option>
          {#each months as month}
            <option value={month}>{month}</option>
          {/each}
        </select>
      </div>
      <div>
        <label for="yearFilter" class="block text-sm font-medium theme-text-primary mb-1">Year</label>
        <input
          type="number"
          bind:value={filter.dt_year.value}
          placeholder="Filter by year"
          class="w-full px-2 py-1 text-sm border theme-border rounded theme-bg-primary theme-text-primary"
          id="yearFilter"
        />
      </div>
      <div>
        <label for="descriptionFilter" class="block text-sm font-medium theme-text-primary mb-1">Description</label>
        <input
          type="text"
          bind:value={filter.description.value}
          placeholder="Filter by description"
          class="w-full px-2 py-1 text-sm border theme-border rounded theme-bg-primary theme-text-primary"
          id="descriptionFilter"
        />
      </div>
    </div>
    <div class="flex justify-end mt-4">
      <button
        class="px-3 py-1.5 bg-gray-500 text-white text-sm rounded-lg border-2 border-gray-500 shadow hover:bg-gray-600 hover:border-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-200 dark:focus:ring-gray-800 active:bg-gray-700 active:border-gray-700 transition-all duration-200"
        on:click={() => {
          filter.dt_month.value = '';
          filter.dt_year.value = '';
          filter.description.value = '';
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
  <table class="min-w-full table-auto border-separate border-spacing-y-1">
    <thead>
      <tr class="theme-bg-secondary theme-text-primary text-sm transition-colors duration-200">
        <th class="px-4 py-2 text-left">
          <button 
            class="flex items-center gap-1 hover:theme-accent transition-colors duration-200" 
            on:click={() => handleSort('dt_value')}
          >
            Date
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 transition-transform duration-200 {getSortIcon('dt_value')}" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
            </svg>
          </button>
        </th>
        <th class="px-4 py-2 text-left">
          <button 
            class="flex items-center gap-1 hover:theme-accent transition-colors duration-200" 
            on:click={() => handleSort('dt_day')}
          >
            Day
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 transition-transform duration-200 {getSortIcon('dt_day')}" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
            </svg>
          </button>
        </th>
        <th class="px-4 py-2 text-left">
          <button 
            class="flex items-center gap-1 hover:theme-accent transition-colors duration-200" 
            on:click={() => handleSort('dt_month')}
          >
            Month
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 transition-transform duration-200 {getSortIcon('dt_month')}" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
            </svg>
          </button>
        </th>
        <th class="px-4 py-2 text-left">
          <button 
            class="flex items-center gap-1 hover:theme-accent transition-colors duration-200" 
            on:click={() => handleSort('dt_year')}
          >
            Year
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 transition-transform duration-200 {getSortIcon('dt_year')}" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
            </svg>
          </button>
        </th>
        <th class="px-4 py-2 text-left">
          <button 
            class="flex items-center gap-1 hover:theme-accent transition-colors duration-200" 
            on:click={() => handleSort('description')}
          >
            Description
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 transition-transform duration-200 {getSortIcon('description')}" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
            </svg>
          </button>
        </th>
        <th class="px-4 py-2 text-left">Status</th>
        <th class="px-4 py-2 text-left">Actions</th>
      </tr>
    </thead>
    <tbody>
      {#each sortedData as row}
        <tr 
          class="hover:bg-blue-100 dark:hover:bg-blue-900 cursor-pointer transition-colors duration-200" 
          on:click={() => onRowSelect(row)}
        >
          <td class="px-4 py-2 theme-bg-primary theme-text-primary transition-colors duration-200">
            {row.dt_value ? formatDate(row.dt_value) : `${row.dt_day} ${row.dt_month} ${row.dt_year}`}
          </td>
          <td class="px-4 py-2 theme-bg-primary theme-text-primary transition-colors duration-200">{row.dt_day}</td>
          <td class="px-4 py-2 theme-bg-primary theme-text-primary transition-colors duration-200">{row.dt_month}</td>
          <td class="px-4 py-2 theme-bg-primary theme-text-primary transition-colors duration-200">{row.dt_year}</td>
          <td class="px-4 py-2 theme-bg-primary theme-text-primary transition-colors duration-200">{row.description}</td>
          <td class="px-4 py-2 theme-bg-primary theme-text-primary transition-colors duration-200">
            <span class="px-2 py-1 text-xs rounded-full {getStatusColor(row)}">
              {getStatusText(row)}
            </span>
          </td>
          <td class="px-4 py-2 theme-bg-primary theme-text-primary transition-colors duration-200" on:click|stopPropagation>
            <div class="flex gap-1">
              <button
                on:click={() => onEditRow(row)}
                class="p-1 text-blue-600 hover:text-blue-900 hover:bg-blue-100 dark:hover:bg-blue-900 rounded transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-800"
                title="Edit holiday"
                aria-label="Edit holiday"
              >
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </button>
              <button
                on:click={() => handleDeleteHoliday(row)}
                class="p-1 text-red-600 hover:text-red-900 hover:bg-red-100 dark:hover:bg-red-900 rounded transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-red-200 dark:focus:ring-red-800"
                title="Delete holiday"
                aria-label="Delete holiday"
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
</div> 