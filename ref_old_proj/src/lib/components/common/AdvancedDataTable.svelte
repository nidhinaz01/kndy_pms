<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import Button from '$lib/components/common/Button.svelte';
  import { exportToCSV } from '$lib/utils/exportUtils';
  import { formatDateDDMMMYYYY } from '$lib/utils/formatDate';

  export let data: any[] = [];
  export let columns: Array<{
    key: string;
    label: string;
    sortable?: boolean;
    filterable?: boolean;
    type?: 'text' | 'date' | 'number' | 'currency';
    width?: string;
  }> = [];
  export let actions: Array<{
    label: string;
    icon?: string;
    onClick: (row: any) => void;
    color?: string;
  }> = [];
  export let title: string = '';
  export let isLoading: boolean = false;
  export let error: string = '';
  export let showExport: boolean = true;
  export let exportFileName: string = 'export.csv';

  const dispatch = createEventDispatcher();

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
      if (filterConfig.value && filterConfig.value.trim() !== '') {
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
            case 'currency':
              return filterByNumber(rowValue, filterValue, filterOp);
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

  function filterByDate(rowValue: any, filterValue: string, filterOp: string): boolean {
    if (!filterOp || filterOp === '') {
      return String(rowValue || '').toLowerCase().includes(filterValue.toLowerCase());
    }
    
    // Handle empty values
    if (!rowValue || !filterValue) {
      return false;
    }
    
    const filterDate = new Date(filterValue);
    const rowDate = new Date(rowValue);
    
    // Check if dates are valid
    if (isNaN(filterDate.getTime()) || isNaN(rowDate.getTime())) {
      return String(rowValue || '').toLowerCase().includes(filterValue.toLowerCase());
    }
    
    // Normalize dates to start of day for comparison
    const normalizedFilterDate = new Date(filterDate.getFullYear(), filterDate.getMonth(), filterDate.getDate());
    const normalizedRowDate = new Date(rowDate.getFullYear(), rowDate.getMonth(), rowDate.getDate());
    
    switch (filterOp) {
      case '=':
        return normalizedRowDate.getTime() === normalizedFilterDate.getTime();
      case '<':
        return normalizedRowDate < normalizedFilterDate;
      case '>':
        return normalizedRowDate > normalizedFilterDate;
      case '<=':
        return normalizedRowDate <= normalizedFilterDate;
      case '>=':
        return normalizedRowDate >= normalizedFilterDate;
      case '<>':
        return normalizedRowDate.getTime() !== normalizedFilterDate.getTime();
      default:
        return String(rowValue || '').toLowerCase().includes(filterValue.toLowerCase());
    }
  }

  function filterByNumber(rowValue: any, filterValue: string, filterOp: string): boolean {
    if (!filterOp || filterOp === '') {
      return String(rowValue || '').toLowerCase().includes(filterValue.toLowerCase());
    }
    
    const filterNum = Number(filterValue);
    const rowNum = Number(rowValue);
    
    if (isNaN(filterNum) || isNaN(rowNum)) {
      return String(rowValue || '').toLowerCase().includes(filterValue.toLowerCase());
    }
    
    switch (filterOp) {
      case '=':
        return rowNum === filterNum;
      case '<':
        return rowNum < filterNum;
      case '>':
        return rowNum > filterNum;
      case '<=':
        return rowNum <= filterNum;
      case '>=':
        return rowNum >= filterNum;
      case '<>':
        return rowNum !== filterNum;
      default:
        return String(rowValue || '').toLowerCase().includes(filterValue.toLowerCase());
    }
  }

  function filterByText(rowValue: any, filterValue: string, filterOp: string): boolean {
    // For text fields, always use simple contains filtering
    return String(rowValue || '').toLowerCase().includes(filterValue.toLowerCase());
  }

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

  function exportData() {
    const headers = columns.map(col => col.label);
    const baseFileName = exportFileName.replace('.csv', '');
    
    exportToCSV(
      sortedData,
      headers,
      baseFileName,
      (row) => columns.map(col => {
        const value = row[col.key];
        if (col.type === 'date' && value) {
          return formatDateDDMMMYYYY(value);
        }
        return value || '';
      })
    );
  }

  function clearFilters() {
    Object.keys(filter).forEach(key => {
      filter[key] = { op: '', value: '' };
    });
    filter = filter; // Trigger reactivity
  }

  function formatValue(value: any, type?: string): string {
    if (value === null || value === undefined) return '';
    
    switch (type) {
      case 'date':
        return formatDateDDMMMYYYY(value);
      case 'currency':
        return new Intl.NumberFormat('en-IN', {
          style: 'currency',
          currency: 'INR'
        }).format(Number(value));
      case 'number':
        return new Intl.NumberFormat('en-IN').format(Number(value));
      default:
        return String(value);
    }
  }

  function getFilterOperators(type?: string): Array<{ value: string; label: string }> {
    switch (type) {
      case 'date':
        return [
          { value: '', label: 'All' },
          { value: '=', label: '=' },
          { value: '<', label: '<' },
          { value: '>', label: '>' },
          { value: '<=', label: '<=' },
          { value: '>=', label: '>=' },
          { value: '<>', label: '<>' }
        ];
      case 'number':
      case 'currency':
        return [
          { value: '', label: 'All' },
          { value: '=', label: '=' },
          { value: '<', label: '<' },
          { value: '>', label: '>' },
          { value: '<=', label: '<=' },
          { value: '>=', label: '>=' },
          { value: '<>', label: '<>' }
        ];
      case 'text':
      default:
        return [
          { value: '', label: 'All' }
        ];
    }
  }
</script>

<div class="theme-bg-primary shadow rounded-lg overflow-hidden">
  <!-- Header -->
  <div class="px-6 py-4 border-b theme-border">
    <div class="flex items-center justify-between">
      <h3 class="text-lg font-semibold theme-text-primary">{title}</h3>
      <div class="flex items-center gap-4">
        <input
          type="text"
          bind:value={search}
          placeholder="Search all columns..."
          class="px-3 py-2 border theme-border rounded-lg theme-bg-primary theme-text-primary focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        <Button
          variant="secondary"
          size="sm"
          on:click={() => showFilters = !showFilters}
        >
          {showFilters ? 'Hide' : 'Show'} Filters
        </Button>
        {#if showExport}
          <Button
            variant="success"
            on:click={exportData}
          >
            Export
          </Button>
        {/if}
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
                  {#if column.type === 'date'}
                    <select
                      bind:value={filter[column.key].op}
                      class="px-2 py-1 text-sm border theme-border rounded theme-bg-primary theme-text-primary"
                    >
                      {#each getFilterOperators(column.type) as operator}
                        <option value={operator.value}>{operator.label}</option>
                      {/each}
                    </select>
                    <input
                      id={`filter-${column.key}`}
                      type="date"
                      bind:value={filter[column.key].value}
                      class="flex-1 px-2 py-1 text-sm border theme-border rounded theme-bg-primary theme-text-primary"
                    />
                  {:else if column.type === 'number' || column.type === 'currency'}
                    <select
                      bind:value={filter[column.key].op}
                      class="px-2 py-1 text-sm border theme-border rounded theme-bg-primary theme-text-primary"
                    >
                      {#each getFilterOperators(column.type) as operator}
                        <option value={operator.value}>{operator.label}</option>
                      {/each}
                    </select>
                    <input
                      type="number"
                      bind:value={filter[column.key].value}
                      placeholder="Value"
                      class="flex-1 px-2 py-1 text-sm border theme-border rounded theme-bg-primary theme-text-primary"
                    />
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
            Clear Filters
          </Button>
        </div>
      </div>
    {/if}
  </div>

  <!-- Loading State -->
  {#if isLoading}
    <div class="p-6 text-center">
      <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      <p class="mt-2 theme-text-secondary">Loading...</p>
    </div>
  {:else if error}
    <div class="p-6 text-center">
      <p class="text-red-600">{error}</p>
    </div>
  {:else if sortedData.length === 0}
    <div class="p-6 text-center">
      <p class="theme-text-tertiary">No records found</p>
    </div>
  {:else}
    <!-- Table -->
    <div class="overflow-x-auto">
      <table class="min-w-full divide-y theme-border">
        <thead class="theme-bg-secondary">
          <tr>
            {#each columns as column}
              <th 
                class="px-6 py-3 text-left text-xs font-medium theme-text-secondary uppercase tracking-wider"
                style={column.width ? `width: ${column.width}` : ''}
              >
                {#if column.sortable}
                  <button
                    on:click={() => handleSort(column.key)}
                    class="flex items-center gap-1 hover:theme-text-primary transition-colors"
                  >
                    {column.label}
                    <span class="text-xs ml-1">{getSortIcon(column.key)}</span>
                  </button>
                {:else}
                  {column.label}
                {/if}
              </th>
            {/each}
            {#if actions && actions.length > 0}
              <th class="px-6 py-3 text-left text-xs font-medium theme-text-secondary uppercase tracking-wider">
                Actions
              </th>
            {/if}
          </tr>
        </thead>
        <tbody class="theme-bg-primary divide-y theme-border">
          {#each sortedData as row}
            <tr class="hover:theme-bg-tertiary">
              {#each columns as column}
                <td class="px-6 py-4 whitespace-nowrap text-sm theme-text-primary">
                  {formatValue(row[column.key], column.type)}
                </td>
              {/each}
              {#if actions && actions.length > 0}
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  <div class="flex space-x-2">
                    {#each actions as action}
                      <button
                        on:click={() => action.onClick(row)}
                        class="text-{action.color || 'blue'}-600 hover:text-{action.color || 'blue'}-900"
                        title={action.label}
                      >
                        {#if action.icon}
                          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            {@html action.icon}
                          </svg>
                        {:else}
                          {action.label}
                        {/if}
                      </button>
                    {/each}
                  </div>
                </td>
              {/if}
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
</div> 