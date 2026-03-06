<script lang="ts">
  import { DataTable } from '$lib/utils/dataTable';
  import { onMount } from 'svelte';
  import { exportToCSV } from '$lib/utils/exportUtils';
  import { formatDate } from '$lib/utils/formatDate';
  import { CopyPlus } from 'lucide-svelte';
  import type { WorkOrderSummary } from '$lib/api/workOrders';

  export let tableData: WorkOrderSummary[];
  export let expandTable: boolean;
  export let currentPage: number = 1;
  export let pageSize: number = 50;
  export let totalRecords: number = 0;
  export let totalPages: number = 1;
  export let onExpandToggle: () => void;
  export let onRowSelect: (row: any) => void;
  export let onDeleteRow: (rowId: number) => void;
  export let onDuplicateWorkOrder: ((workOrder: WorkOrderSummary) => void) | undefined;
  export let onCreateWorkOrder: (() => void) | undefined;
  export let onAmendWorkOrder: (() => void) | undefined;
  export let onSearchChange: (search: string) => void;
  export let onPageChange: (page: number) => void;
  export let onPageSizeChange: (size: number) => void;

  let dataTable: DataTable<WorkOrderSummary>;
  let search = '';
  let showFilters = false;
  let filter = {
    wo_no: { op: '', value: '' },
    pwo_no: { op: '', value: '' },
    wo_type: { op: '', value: '' },
    wo_model: { op: '', value: '' },
    wo_chassis: { op: '', value: '' }
  };

  // Sorting state (client-side for current page only)
  let sortColumn: string = '';
  let sortDirection: 'asc' | 'desc' = 'asc';

  // Client-side sorting for current page only (server handles search and pagination)
  $: sortedData = (() => {
    if (!tableData || tableData.length === 0) return [];
    
    let data = [...tableData];
    
    // Apply column filters (client-side for current page)
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
    
    // Apply sorting (client-side for current page)
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

  // Handle search input change - triggers server-side search
  function handleSearchInput(event: Event) {
    const target = event.target as HTMLInputElement;
    search = target.value;
    onSearchChange(search);
  }

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

  function handleDeleteWorkOrder(workOrder: WorkOrderSummary) {
    if (confirm(`Are you sure you want to delete work order "${workOrder.wo_no || workOrder.pwo_no}"?`)) {
      onDeleteRow(workOrder.id);
    }
  }

  function exportData() {
    if (!dataTable) return;

    const headers = ['WO No', 'PWO No', 'Type', 'Model', 'Chassis', 'Body Width', 'Height', 'Passenger Doors', 'Seats', 'Seat Config', 'Date', 'Total Cost', 'Production Start', 'Production End', 'Delivery'];
    const processedData = dataTable.getProcessedData();
    
    exportToCSV(
      processedData,
      headers,
      'work_orders',
      (row) => [
        row.wo_no || '-',
        row.pwo_no || '-',
        row.wo_type,
        row.wo_model,
        row.wo_chassis,
        row.body_width_mm,
        row.height,
        row.passenger_door_nos,
        row.no_of_seats,
        row.seat_configuration,
        formatDate(row.wo_date),
        row.total_cost.toString(),
        row.wo_prdn_start ? formatDate(row.wo_prdn_start) : '-',
        row.wo_prdn_end ? formatDate(row.wo_prdn_end) : '-',
        row.wo_delivery ? formatDate(row.wo_delivery) : '-'
      ]
    );
  }

  function getSortIcon(column: string): string {
    if (sortColumn === column) {
      return sortDirection === 'asc' ? 'text-blue-600' : 'text-blue-600';
    }
    return 'text-gray-400';
  }

  // Pagination helpers
  function getPageNumbers(): number[] {
    const pages: number[] = [];
    const maxVisible = 5;
    let start = Math.max(1, currentPage - Math.floor(maxVisible / 2));
    let end = Math.min(totalPages, start + maxVisible - 1);
    
    if (end - start < maxVisible - 1) {
      start = Math.max(1, end - maxVisible + 1);
    }
    
    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    return pages;
  }

  function getStatusColor(workOrder: WorkOrderSummary): string {
    if (workOrder.wo_delivery) {
      return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
    } else if (workOrder.wo_prdn_start) {
      return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
    } else {
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
    }
  }

  function getStatusText(workOrder: WorkOrderSummary): string {
    if (workOrder.wo_delivery) {
      return 'Delivered';
    } else if (workOrder.wo_prdn_start) {
      return 'WIP';
    } else {
      return 'Ordered';
    }
  }
</script>

<!-- Table Controls -->
<div class="flex items-center justify-between space-x-2 p-3 border-b theme-bg-primary rounded-t-xl shadow mt-4 transition-colors duration-200">
  <div class="flex items-center gap-2">
    <div class="relative flex-1 max-w-xs">
      <input 
        type="text" 
        placeholder="Search..." 
        value={search}
        on:input={handleSearchInput}
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
  <div class="flex items-center gap-2">
    <button 
      class="px-4 py-2 bg-blue-600 text-white rounded-lg border-2 border-blue-600 shadow hover:bg-blue-700 hover:border-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-800 active:bg-blue-800 active:border-blue-800 transition-all duration-200"
      on:click={() => {
        console.log('Create Work Order button clicked');
        console.log('onCreateWorkOrder function:', onCreateWorkOrder);
        if (onCreateWorkOrder) {
          onCreateWorkOrder();
        } else {
          console.error('onCreateWorkOrder function is not defined');
        }
      }}
    >
      Create Work Order
    </button>
    <button 
      class="px-4 py-2 bg-orange-500 text-white rounded-lg border-2 border-orange-500 shadow hover:bg-orange-600 hover:border-orange-600 focus:outline-none focus:ring-2 focus:ring-orange-200 dark:focus:ring-orange-800 active:bg-orange-700 active:border-orange-700 transition-all duration-200"
      on:click={() => onAmendWorkOrder && onAmendWorkOrder()}
    >
      Amend Work Order
    </button>
    <button 
      class="px-4 py-2 bg-green-500 text-white rounded-lg border-2 border-green-500 shadow hover:bg-green-600 hover:border-green-600 focus:outline-none focus:ring-2 focus:ring-green-200 dark:focus:ring-green-800 active:bg-green-700 active:border-green-700 transition-all duration-200"
      on:click={exportData}
    >
      Export
    </button>
  </div>
</div>

<!-- Filters Section -->
{#if showFilters}
  <div class="p-3 border-b theme-bg-primary transition-colors duration-200">
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
      <div>
        <label for="woNoFilter" class="block text-sm font-medium theme-text-primary mb-1">WO No</label>
        <input
          type="text"
          bind:value={filter.wo_no.value}
          placeholder="Filter by WO No"
          class="w-full px-2 py-1 text-sm border theme-border rounded theme-bg-primary theme-text-primary"
          id="woNoFilter"
        />
      </div>
      <div>
        <label for="pwoNoFilter" class="block text-sm font-medium theme-text-primary mb-1">PWO No</label>
        <input
          type="text"
          bind:value={filter.pwo_no.value}
          placeholder="Filter by PWO No"
          class="w-full px-2 py-1 text-sm border theme-border rounded theme-bg-primary theme-text-primary"
          id="pwoNoFilter"
        />
      </div>
      <div>
        <label for="typeFilter" class="block text-sm font-medium theme-text-primary mb-1">Type</label>
        <input
          type="text"
          bind:value={filter.wo_type.value}
          placeholder="Filter by type"
          class="w-full px-2 py-1 text-sm border theme-border rounded theme-bg-primary theme-text-primary"
          id="typeFilter"
        />
      </div>
      <div>
        <label for="modelFilter" class="block text-sm font-medium theme-text-primary mb-1">Model</label>
        <input
          type="text"
          bind:value={filter.wo_model.value}
          placeholder="Filter by model"
          class="w-full px-2 py-1 text-sm border theme-border rounded theme-bg-primary theme-text-primary"
          id="modelFilter"
        />
      </div>
      <div>
        <label for="chassisFilter" class="block text-sm font-medium theme-text-primary mb-1">Chassis</label>
        <input
          type="text"
          bind:value={filter.wo_chassis.value}
          placeholder="Filter by chassis"
          class="w-full px-2 py-1 text-sm border theme-border rounded theme-bg-primary theme-text-primary"
          id="chassisFilter"
        />
      </div>
    </div>
    <div class="flex justify-end mt-4">
      <button
        class="px-3 py-1.5 bg-gray-500 text-white text-sm rounded-lg border-2 border-gray-500 shadow hover:bg-gray-600 hover:border-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-200 dark:focus:ring-gray-800 active:bg-gray-700 active:border-gray-700 transition-all duration-200"
        on:click={() => {
          filter.wo_no.value = '';
          filter.pwo_no.value = '';
          filter.wo_type.value = '';
          filter.wo_model.value = '';
          filter.wo_chassis.value = '';
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
            on:click={() => handleSort('wo_no')}
          >
            WO No
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 transition-transform duration-200 {getSortIcon('wo_no')}" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
            </svg>
          </button>
        </th>
        <th class="px-4 py-2 text-left">
          <button 
            class="flex items-center gap-1 hover:theme-accent transition-colors duration-200" 
            on:click={() => handleSort('pwo_no')}
          >
            PWO No
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 transition-transform duration-200 {getSortIcon('pwo_no')}" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
            </svg>
          </button>
        </th>
        <th class="px-4 py-2 text-left">
          <button 
            class="flex items-center gap-1 hover:theme-accent transition-colors duration-200" 
            on:click={() => handleSort('wo_type')}
          >
            Type
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 transition-transform duration-200 {getSortIcon('wo_type')}" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
            </svg>
          </button>
        </th>
        <th class="px-4 py-2 text-left">
          <button 
            class="flex items-center gap-1 hover:theme-accent transition-colors duration-200" 
            on:click={() => handleSort('wo_model')}
          >
            Model
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 transition-transform duration-200 {getSortIcon('wo_model')}" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
            </svg>
          </button>
        </th>
        <th class="px-4 py-2 text-left">
          <button 
            class="flex items-center gap-1 hover:theme-accent transition-colors duration-200" 
            on:click={() => handleSort('wo_chassis')}
          >
            Chassis
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 transition-transform duration-200 {getSortIcon('wo_chassis')}" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
            </svg>
          </button>
        </th>
        <th class="px-4 py-2 text-left">
          <button 
            class="flex items-center gap-1 hover:theme-accent transition-colors duration-200" 
            on:click={() => handleSort('body_width_mm')}
          >
            Body Width
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 transition-transform duration-200 {getSortIcon('body_width_mm')}" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
            </svg>
          </button>
        </th>
        <th class="px-4 py-2 text-left">
          <button 
            class="flex items-center gap-1 hover:theme-accent transition-colors duration-200" 
            on:click={() => handleSort('height')}
          >
            Height
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 transition-transform duration-200 {getSortIcon('height')}" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
            </svg>
          </button>
        </th>
        <th class="px-4 py-2 text-left">
          <button 
            class="flex items-center gap-1 hover:theme-accent transition-colors duration-200" 
            on:click={() => handleSort('passenger_door_nos')}
          >
            Passenger Doors
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 transition-transform duration-200 {getSortIcon('passenger_door_nos')}" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
            </svg>
          </button>
        </th>
        <th class="px-4 py-2 text-left">
          <button 
            class="flex items-center gap-1 hover:theme-accent transition-colors duration-200" 
            on:click={() => handleSort('no_of_seats')}
          >
            Seats
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 transition-transform duration-200 {getSortIcon('no_of_seats')}" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
            </svg>
          </button>
        </th>
        <th class="px-4 py-2 text-left">
          <button 
            class="flex items-center gap-1 hover:theme-accent transition-colors duration-200" 
            on:click={() => handleSort('wo_date')}
          >
            Date
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 transition-transform duration-200 {getSortIcon('wo_date')}" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
            </svg>
          </button>
        </th>
        <th class="px-4 py-2 text-left">
          <button 
            class="flex items-center gap-1 hover:theme-accent transition-colors duration-200" 
            on:click={() => handleSort('total_cost')}
          >
            Total Cost
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 transition-transform duration-200 {getSortIcon('total_cost')}" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
          <td class="px-4 py-2 theme-bg-primary theme-text-primary transition-colors duration-200">{row.wo_no || '-'}</td>
          <td class="px-4 py-2 theme-bg-primary theme-text-primary transition-colors duration-200">{row.pwo_no || '-'}</td>
          <td class="px-4 py-2 theme-bg-primary theme-text-primary transition-colors duration-200">{row.wo_type}</td>
          <td class="px-4 py-2 theme-bg-primary theme-text-primary transition-colors duration-200">{row.wo_model}</td>
          <td class="px-4 py-2 theme-bg-primary theme-text-primary transition-colors duration-200">{row.wo_chassis}</td>
          <td class="px-4 py-2 theme-bg-primary theme-text-primary transition-colors duration-200">{row.body_width_mm}</td>
          <td class="px-4 py-2 theme-bg-primary theme-text-primary transition-colors duration-200">{row.height}</td>
          <td class="px-4 py-2 theme-bg-primary theme-text-primary transition-colors duration-200">{row.passenger_door_nos}</td>
          <td class="px-4 py-2 theme-bg-primary theme-text-primary transition-colors duration-200">{row.no_of_seats}</td>
          <td class="px-4 py-2 theme-bg-primary theme-text-primary transition-colors duration-200">{formatDate(row.wo_date)}</td>
          <td class="px-4 py-2 theme-bg-primary theme-text-primary transition-colors duration-200">₹{row.total_cost.toLocaleString()}</td>
          <td class="px-4 py-2 theme-bg-primary theme-text-primary transition-colors duration-200">
            <span class="px-2 py-1 text-xs rounded-full {getStatusColor(row)}">
              {getStatusText(row)}
            </span>
          </td>
          <td class="px-4 py-2 theme-bg-primary theme-text-primary transition-colors duration-200" on:click|stopPropagation>
            <div class="flex items-center gap-2">
              {#if onDuplicateWorkOrder}
                <button
                  on:click={() => onDuplicateWorkOrder(row)}
                  class="p-1 text-blue-600 hover:text-blue-900 hover:bg-blue-100 dark:hover:bg-blue-900 rounded transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-800"
                  title="Duplicate work order"
                  aria-label="Duplicate work order"
                >
                  <CopyPlus class="w-5 h-5" />
                </button>
              {/if}
              <button
                on:click={() => handleDeleteWorkOrder(row)}
                class="p-1 text-red-600 hover:text-red-900 hover:bg-red-100 dark:hover:bg-red-900 rounded transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-red-200 dark:focus:ring-red-800"
                title="Delete work order"
                aria-label="Delete work order"
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

  <!-- Pagination Controls -->
  {#if totalPages > 1 || totalRecords > 0}
    <div class="flex items-center justify-between px-4 py-3 border-t theme-border theme-bg-primary transition-colors duration-200">
      <div class="flex items-center gap-4">
        <div class="text-sm theme-text-primary">
          Showing <span class="font-medium">{((currentPage - 1) * pageSize) + 1}</span> to 
          <span class="font-medium">{Math.min(currentPage * pageSize, totalRecords)}</span> of 
          <span class="font-medium">{totalRecords}</span> results
        </div>
        <div class="flex items-center gap-2">
          <label for="pageSize" class="text-sm theme-text-primary">Rows per page:</label>
          <select
            id="pageSize"
            value={pageSize}
            on:change={(e) => {
              const newSize = parseInt((e.target as HTMLSelectElement).value);
              onPageSizeChange(newSize);
            }}
            class="border theme-border rounded px-2 py-1 text-sm theme-bg-secondary theme-text-primary focus:outline-none focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-800"
          >
            <option value="25">25</option>
            <option value="50">50</option>
            <option value="100">100</option>
            <option value="200">200</option>
          </select>
        </div>
      </div>
      
      <div class="flex items-center gap-2">
        <button
          on:click={() => onPageChange(1)}
          disabled={currentPage === 1}
          class="px-3 py-1 text-sm border theme-border rounded theme-bg-secondary theme-text-primary disabled:opacity-50 disabled:cursor-not-allowed hover:theme-accent transition-colors duration-200"
          title="First page"
        >
          ««
        </button>
        <button
          on:click={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          class="px-3 py-1 text-sm border theme-border rounded theme-bg-secondary theme-text-primary disabled:opacity-50 disabled:cursor-not-allowed hover:theme-accent transition-colors duration-200"
          title="Previous page"
        >
          ‹
        </button>
        
        {#each getPageNumbers() as pageNum}
          <button
            on:click={() => onPageChange(pageNum)}
            class="px-3 py-1 text-sm border theme-border rounded transition-colors duration-200 {currentPage === pageNum 
              ? 'theme-accent text-white' 
              : 'theme-bg-secondary theme-text-primary hover:theme-accent'}"
          >
            {pageNum}
          </button>
        {/each}
        
        <button
          on:click={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          class="px-3 py-1 text-sm border theme-border rounded theme-bg-secondary theme-text-primary disabled:opacity-50 disabled:cursor-not-allowed hover:theme-accent transition-colors duration-200"
          title="Next page"
        >
          ›
        </button>
        <button
          on:click={() => onPageChange(totalPages)}
          disabled={currentPage === totalPages}
          class="px-3 py-1 text-sm border theme-border rounded theme-bg-secondary theme-text-primary disabled:opacity-50 disabled:cursor-not-allowed hover:theme-accent transition-colors duration-200"
          title="Last page"
        >
          »»
        </button>
      </div>
    </div>
  {/if}
</div> 