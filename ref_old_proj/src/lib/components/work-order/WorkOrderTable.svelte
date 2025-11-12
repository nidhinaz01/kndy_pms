<script lang="ts">
  import { formatDate } from '$lib/utils/formatDate';
  import Button from '$lib/components/common/Button.svelte';
  import { exportToCSV } from '$lib/utils/exportUtils';

  export let expandTable: boolean;
  export let tableData: any[];
  export let onExpandToggle: () => void;
  export let onRowSelect: (row: any) => void;
  export let onDeleteRow: (rowId: number) => void;

  let search = '';

  // Sorting state
  let sortColumn: string = '';
  let sortDirection: 'asc' | 'desc' = 'asc';



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

  function exportData() {
    const headers = ['ID', 'WO Number', 'PWO Number', 'Type', 'Model', 'Chassis', 'Body Width', 'Height', 'Passenger Doors', 'Seats', 'Seat Configuration', 'Order Date', 'Production Start', 'Production End', 'Delivery Date'];
    
    exportToCSV(
      sortedData,
      headers,
      'work_orders',
      (row) => [
        row.id,
        row.wo_no || '',
        row.pwo_no || '',
        row.wo_type,
        row.wo_model,
        row.wo_chassis,
        row.body_width_mm,
        row.height,
        row.passenger_door_nos,
        row.no_of_seats,
        row.seat_configuration,
        formatDate(row.wo_date),
        row.wo_prdn_start ? formatDate(row.wo_prdn_start) : '',
        row.wo_prdn_end ? formatDate(row.wo_prdn_end) : '',
        row.wo_delivery ? formatDate(row.wo_delivery) : ''
      ]
    );
  }





  function getSortIcon(column: string): string {
    if (sortColumn !== column) {
      return 'text-gray-400';
    }
    return sortDirection === 'asc' ? 'text-blue-500' : 'text-blue-500 rotate-180';
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

  </div>
  <div class="flex items-center gap-2">
    <Button 
      variant="primary"
      on:click={exportData}
    >
      Export
    </Button>

    <Button 
      variant="secondary"
      on:click={onExpandToggle}
    >
      {expandTable ? 'Collapse Table' : 'Expand Table'}
    </Button>
    <Button variant="success">
      Add WO
    </Button>
  </div>
</div>



<!-- Data Table -->
<div class="flex-1 overflow-auto theme-bg-primary rounded-b-xl shadow transition-colors duration-200">
  <table class="min-w-full table-auto border-separate border-spacing-y-1">
    <thead>
      <tr class="theme-bg-secondary theme-text-primary text-sm transition-colors duration-200">

        <th class="px-4 py-2 text-left">
          <button 
            class="flex items-center gap-1 hover:theme-accent transition-colors duration-200" 
            on:click={() => handleSort('id')}
          >
            ID
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 transition-transform duration-200 {getSortIcon('id')}" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
            </svg>
          </button>
        </th>
        <th class="px-4 py-2 text-left">
          <button 
            class="flex items-center gap-1 hover:theme-accent transition-colors duration-200" 
            on:click={() => handleSort('wo_no')}
          >
            WO Number
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
            PWO Number
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
            on:click={() => handleSort('seat_configuration')}
          >
            Seat Config
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 transition-transform duration-200 {getSortIcon('seat_configuration')}" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
            </svg>
          </button>
        </th>
        <th class="px-4 py-2 text-left">
          <button 
            class="flex items-center gap-1 hover:theme-accent transition-colors duration-200" 
            on:click={() => handleSort('wo_date')}
          >
            Order Date
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 transition-transform duration-200 {getSortIcon('wo_date')}" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
            </svg>
          </button>
        </th>
        <th class="px-4 py-2 text-left">
          <button 
            class="flex items-center gap-1 hover:theme-accent transition-colors duration-200" 
            on:click={() => handleSort('wo_prdn_start')}
          >
            Production Start
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 transition-transform duration-200 {getSortIcon('wo_prdn_start')}" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
            </svg>
          </button>
        </th>
        <th class="px-4 py-2 text-left">
          <button 
            class="flex items-center gap-1 hover:theme-accent transition-colors duration-200" 
            on:click={() => handleSort('wo_prdn_end')}
          >
            Production End
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 transition-transform duration-200 {getSortIcon('wo_prdn_end')}" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
            </svg>
          </button>
        </th>
        <th class="px-4 py-2 text-left">
          <button 
            class="flex items-center gap-1 hover:theme-accent transition-colors duration-200" 
            on:click={() => handleSort('wo_delivery')}
          >
            Delivery Date
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 transition-transform duration-200 {getSortIcon('wo_delivery')}" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
          <td class="px-4 py-2 theme-bg-primary theme-text-primary transition-colors duration-200">{row.id}</td>
          <td class="px-4 py-2 theme-bg-primary theme-text-primary transition-colors duration-200">{row.wo_no || '-'}</td>
          <td class="px-4 py-2 theme-bg-primary theme-text-primary transition-colors duration-200">{row.pwo_no || '-'}</td>
          <td class="px-4 py-2 theme-bg-primary theme-text-primary transition-colors duration-200">{row.wo_type}</td>
          <td class="px-4 py-2 theme-bg-primary theme-text-primary transition-colors duration-200">{row.wo_model}</td>
          <td class="px-4 py-2 theme-bg-primary theme-text-primary transition-colors duration-200">{row.wo_chassis}</td>
          <td class="px-4 py-2 theme-bg-primary theme-text-primary transition-colors duration-200">{row.body_width_mm}</td>
          <td class="px-4 py-2 theme-bg-primary theme-text-primary transition-colors duration-200">{row.height}</td>
          <td class="px-4 py-2 theme-bg-primary theme-text-primary transition-colors duration-200">{row.passenger_door_nos}</td>
          <td class="px-4 py-2 theme-bg-primary theme-text-primary transition-colors duration-200">{row.no_of_seats}</td>
          <td class="px-4 py-2 theme-bg-primary theme-text-primary transition-colors duration-200">{row.seat_configuration}</td>
          <td class="px-4 py-2 theme-bg-primary theme-text-primary transition-colors duration-200">{formatDate(row.wo_date)}</td>
          <td class="px-4 py-2 theme-bg-primary theme-text-primary transition-colors duration-200">{row.wo_prdn_start ? formatDate(row.wo_prdn_start) : '-'}</td>
          <td class="px-4 py-2 theme-bg-primary theme-text-primary transition-colors duration-200">{row.wo_prdn_end ? formatDate(row.wo_prdn_end) : '-'}</td>
          <td class="px-4 py-2 theme-bg-primary theme-text-primary transition-colors duration-200">{row.wo_delivery ? formatDate(row.wo_delivery) : '-'}</td>
          <td class="px-4 py-2 theme-bg-primary rounded-r-lg theme-text-primary transition-colors duration-200">
            <button
              on:click|stopPropagation={() => onDeleteRow(row.id)}
              class="text-red-600 hover:text-red-900 transition-colors"
              title="Delete"
              aria-label="Delete work order"
            >
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </td>
        </tr>
      {/each}
    </tbody>
  </table>
</div> 