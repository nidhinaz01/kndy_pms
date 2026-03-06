<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import Button from './Button.svelte';
  import { Trash2, Edit, Filter, X, Download } from 'lucide-svelte';
  import { exportToCSV } from '$lib/utils/exportUtils';
  import { formatDateGB } from '$lib/utils/formatDate';

  export let data: any[] = [];
  export let columns: Array<{
    key: string;
    label: string;
    sortable?: boolean;
    filterable?: boolean;
    type?: 'text' | 'date' | 'number' | 'status';
  }> = [];
  export let actions: Array<{
    label: string;
    icon?: any;
    onClick: (row: any) => void;
    color?: string;
  }> = [];
  export let title: string = '';
  export let isLoading: boolean = false;

  const dispatch = createEventDispatcher();

  // Utility functions
  function formatNumber(value: any, columnKey?: string): string {
    if (value === null || value === undefined || value === '') return '';
    const num = Number(value);
    if (isNaN(num)) return String(value);
    
    // Format as currency for salary and basic_da columns
    if (columnKey && (columnKey.includes('salary') || columnKey.includes('basic_da'))) {
      return `₹${num.toFixed(2)}`;
    }
    
    // For rate_per_hour, display as raw integer
    if (columnKey && columnKey.includes('rate')) {
      return num.toString();
    }
    
    // Format as regular number with commas for large numbers
    return num.toLocaleString();
  }

  // State management
  let search = '';
  let showFilters = false;
  let filter: Record<string, { op: string; value: string }> = {};
  let sortColumn: string = '';
  let sortDirection: 'asc' | 'desc' = 'asc';

  // Initialize filter object based on columns
  $: if (columns.length > 0 && Object.keys(filter).length === 0) {
    filter = {};
    columns.forEach(col => {
      if (col.filterable) {
        filter[col.key] = { op: '', value: '' };
      }
    });
  }

  // Export function
  function handleExport() {
    if (!data || data.length === 0) return;
    
    const headers = columns.map(col => col.label);
    const rowMapper = (row: any) => columns.map(col => {
      let value = row[col.key];
      
      // Format based on column type
      if (col.type === 'date' && value) {
        value = formatDateGB(value);
      } else if (col.type === 'status') {
        value = value ? 'Active' : 'Inactive';
      }
      
      // Handle null/undefined values
      if (value === null || value === undefined) value = '';
      
      return value;
    });
    
    exportToCSV(data, headers, title.toLowerCase().replace(/\s+/g, '_'), rowMapper);
  }

  // Reactive sorted and filtered data
  $: sortedData = (() => {
    if (!data || data.length === 0) return [];
    
    let filteredData = [...data];
    
    // Apply search filter
    if (search) {
      const searchLower = search.toLowerCase();
      filteredData = filteredData.filter(row => 
        Object.values(row).some(value => 
          String(value || '').toLowerCase().includes(searchLower)
        )
      );
    }
    
    // Apply column filters
    Object.entries(filter).forEach(([key, filterConfig]) => {
      // Check if filter has a value (handle different data types)
      const hasValue = filterConfig.value !== null && 
                      filterConfig.value !== undefined && 
                      filterConfig.value !== '';
      
      if (hasValue) {
        const filterValue = filterConfig.value;
        const filterOp = filterConfig.op;
        const column = columns.find(col => col.key === key);
        
        filteredData = filteredData.filter(row => {
          const rowValue = row[key];
          
          if (!column) return true;
          
          switch (column.type) {
            case 'date':
              return filterByDate(rowValue, filterValue, filterOp);
            case 'number':
              return filterByNumber(rowValue, filterValue, filterOp);
            case 'status':
              return filterByStatus(rowValue, filterValue);
            case 'text':
            default:
              return filterByText(rowValue, filterValue, filterOp);
          }
        });
      }
    });
    
    // Apply sorting
    if (sortColumn) {
      filteredData.sort((a, b) => {
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
    
    return filteredData;
  })();

  function handleSort(column: string) {
    if (sortColumn === column) {
      sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      sortColumn = column;
      sortDirection = 'asc';
    }
  }

  function getSortIcon(column: string): string {
    if (sortColumn !== column) {
      return '↕️';
    }
    return sortDirection === 'asc' ? '↑' : '↓';
  }

  function filterByDate(rowValue: any, filterValue: string, filterOp: string): boolean {
    if (!filterOp || filterOp === '') {
      // For date fields, require an operator to be selected
      return true;
    }
    
    if (!rowValue || !filterValue) return false;
    
    const filterDate = new Date(filterValue);
    const rowDate = new Date(rowValue);
    
    if (isNaN(filterDate.getTime()) || isNaN(rowDate.getTime())) {
      return true; // Skip invalid dates
    }
    
    const normalizedFilterDate = new Date(filterDate.getFullYear(), filterDate.getMonth(), filterDate.getDate());
    const normalizedRowDate = new Date(rowDate.getFullYear(), rowDate.getMonth(), rowDate.getDate());
    
    switch (filterOp) {
      case '=': return normalizedRowDate.getTime() === normalizedFilterDate.getTime();
      case '<': return normalizedRowDate < normalizedFilterDate;
      case '>': return normalizedRowDate > normalizedFilterDate;
      case '<=': return normalizedRowDate <= normalizedFilterDate;
      case '>=': return normalizedRowDate >= normalizedFilterDate;
      case '<>': return normalizedRowDate.getTime() !== normalizedFilterDate.getTime();
      default: return true;
    }
  }

  function filterByNumber(rowValue: any, filterValue: string, filterOp: string): boolean {
    if (!filterOp || filterOp === '') {
      // For number fields, require an operator to be selected
      return true;
    }
    
    const filterNum = Number(filterValue);
    const rowNum = Number(rowValue);
    
    if (isNaN(filterNum) || isNaN(rowNum)) {
      return true; // Skip invalid numbers
    }
    
    switch (filterOp) {
      case '=': return rowNum === filterNum;
      case '<': return rowNum < filterNum;
      case '>': return rowNum > filterNum;
      case '<=': return rowNum <= filterNum;
      case '>=': return rowNum >= filterNum;
      case '<>': return rowNum !== filterNum;
      default: return true;
    }
  }

  function filterByStatus(rowValue: any, filterValue: string): boolean {
    if (!filterValue || filterValue === '') return true;
    
    // Convert boolean to status string
    const statusText = rowValue ? 'Active' : 'Inactive';
    return statusText === filterValue;
  }

  function filterByText(rowValue: any, filterValue: string, filterOp: string): boolean {
    return String(rowValue || '').toLowerCase().includes(filterValue.toLowerCase());
  }

  function clearFilters() {
    Object.keys(filter).forEach(key => {
      filter[key] = { op: '', value: '' };
    });
    filter = filter; // Trigger reactivity
  }
</script>

<div class="theme-bg-primary rounded-lg shadow-lg border theme-border">
  <!-- Header -->
        <div class="p-6 border-b theme-border">
    <div class="flex justify-between items-center">
              <h3 class="text-lg font-semibold theme-text-primary">{title}</h3>
      
      <!-- Search and Filters -->
      <div class="flex items-center space-x-4">
        <div class="relative">
          <input
            type="text"
            bind:value={search}
            placeholder="Search all columns..."
            class="pl-10 pr-4 py-2 border theme-border rounded-lg theme-bg-primary theme-text-primary focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <svg class="absolute left-3 top-2.5 h-4 w-4 theme-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        <Button
          variant="secondary"
          size="sm"
          on:click={() => showFilters = !showFilters}
        >
          <Filter class="w-4 h-4 mr-1" />
          {showFilters ? 'Hide' : 'Show'} Filters
        </Button>
        <Button
          variant="secondary"
          size="sm"
          on:click={handleExport}
        >
          <Download class="w-4 h-4 mr-1" />
          Export
        </Button>
      </div>
    </div>

    <!-- Filters Section -->
    {#if showFilters}
      <div class="mt-4 space-y-4">
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {#each columns as column}
            {#if column.filterable}
              <div>
                <label for={`filter-${column.key}`} class="block text-sm font-medium theme-text-primary mb-1">
                  {column.label}
                </label>
                <div class="flex gap-2">
                  {#if column.type === 'number'}
                    <select
                      bind:value={filter[column.key].op}
                      class="px-2 py-1 text-sm border theme-border rounded theme-bg-primary theme-text-primary"
                    >
                      <option value="">All</option>
                      <option value="=">=</option>
                      <option value="<">&lt;</option>
                      <option value=">">&gt;</option>
                      <option value="<=">&lt;=</option>
                      <option value=">=">&gt;=</option>
                      <option value="<>">&lt;&gt;</option>
                    </select>
                    <input
                      type="number"
                      bind:value={filter[column.key].value}
                      placeholder="Value"
                      class="flex-1 px-2 py-1 text-sm border theme-border rounded theme-bg-primary theme-text-primary"
                    />
                  {:else if column.type === 'date'}
                    <select
                      bind:value={filter[column.key].op}
                      class="px-2 py-1 text-sm border theme-border rounded theme-bg-primary theme-text-primary"
                    >
                      <option value="">All</option>
                      <option value="=">=</option>
                      <option value="<">&lt;</option>
                      <option value=">">&gt;</option>
                      <option value="<=">&lt;=</option>
                      <option value=">=">&gt;=</option>
                      <option value="<>">&lt;&gt;</option>
                    </select>
                    <input
                      type="date"
                      bind:value={filter[column.key].value}
                      class="flex-1 px-2 py-1 text-sm border theme-border rounded theme-bg-primary theme-text-primary"
                    />
                  {:else if column.type === 'status'}
                    <select
                      bind:value={filter[column.key].value}
                      class="flex-1 px-2 py-1 text-sm border theme-border rounded theme-bg-primary theme-text-primary"
                    >
                      <option value="">All</option>
                      <option value="Active">Active</option>
                      <option value="Inactive">Inactive</option>
                    </select>
                  {:else}
                    <input
                      type="text"
                      bind:value={filter[column.key].value}
                      placeholder={`Filter ${column.label}`}
                      class="flex-1 px-2 py-1 text-sm border theme-border rounded theme-bg-primary theme-text-primary"
                    />
                  {/if}
                </div>
              </div>
            {/if}
          {/each}
        </div>
        <div class="flex justify-end">
          <Button
            variant="secondary"
            size="sm"
            on:click={clearFilters}
          >
            <X class="w-4 h-4 mr-1" />
            Clear Filters
          </Button>
        </div>
      </div>
    {/if}
  </div>



  <!-- Loading State -->
  {#if isLoading}
    <div class="p-8 text-center">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 theme-border-accent mx-auto"></div>
      <p class="mt-2 theme-text-secondary">Loading...</p>
    </div>
  {:else}
    <!-- Table -->
    <div class="overflow-x-auto">
      <table class="w-full">
        <thead class="theme-bg-secondary">
          <tr>
            {#each columns as column}
              <th class="px-6 py-3 text-left text-xs font-medium theme-text-primary uppercase tracking-wider">
                <button
                  class="flex items-center space-x-1 hover:theme-text-accent transition-colors"
                  on:click={() => column.sortable && handleSort(column.key)}
                  disabled={!column.sortable}
                >
                  <span>{column.label}</span>
                  {#if column.sortable}
                    <span class="text-xs">{getSortIcon(column.key)}</span>
                  {/if}
                </button>
              </th>
            {/each}
            {#if actions.length > 0}
              <th class="px-6 py-3 text-left text-xs font-medium theme-text-primary uppercase tracking-wider">
                Actions
              </th>
            {/if}
          </tr>
        </thead>
                <tbody class="theme-bg-primary divide-y theme-border">
          {#if sortedData.length === 0}
            <tr>
              <td colspan={columns.length + (actions.length > 0 ? 1 : 0)} class="px-6 py-4 text-center text-sm theme-text-secondary">
                No data to display
              </td>
            </tr>
          {:else}
            {#each sortedData as row, index}
              <tr class="hover:theme-bg-secondary transition-colors">
                {#each columns as column}
                  <td class="px-6 py-4 whitespace-nowrap text-sm theme-text-primary">
                    {#if column.type === 'date'}
                      {formatDateGB(row[column.key])}
                    {:else if column.type === 'status'}
                      <span class={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        row[column.key] 
                          ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' 
                          : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                      }`}>
                        {row[column.key] ? 'Active' : 'Inactive'}
                      </span>
                    {:else if column.type === 'number'}
                      {formatNumber(row[column.key], column.key)}
                    {:else}
                      {row[column.key] || ''}
                    {/if}
                  </td>
                {/each}
                {#if actions.length > 0}
                  <td class="px-6 py-4 whitespace-nowrap text-sm theme-text-primary">
                    <div class="flex space-x-2">
                      {#each actions as action}
                        <button
                          class="p-1 rounded hover:theme-bg-secondary transition-colors theme-text-secondary"
                          on:click={() => action.onClick(row)}
                          title={action.label}
                        >
                          <svelte:component this={action.icon} class="w-4 h-4" />
                        </button>
                      {/each}
                    </div>
                  </td>
                {/if}
              </tr>
            {/each}
          {/if}
        </tbody>
      </table>
    </div>

    <!-- Empty State -->
    {#if sortedData.length === 0}
      <div class="p-8 text-center">
        <p class="theme-text-secondary">No data found</p>
      </div>
    {/if}
  {/if}
</div> 