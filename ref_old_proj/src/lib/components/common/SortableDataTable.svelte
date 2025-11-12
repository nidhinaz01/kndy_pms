<script lang="ts">
  import { formatDate, formatDateDDMMMYYYY } from '$lib/utils/formatDate';
  import { exportToCSV, sanitizeCurrency, escapeCSV } from '$lib/utils/exportUtils';
  import Button from '$lib/components/common/Button.svelte';

  export let data: any[] = [];
  export let columns: Array<{
    key: string;
    label: string;
    sortable?: boolean;
    filterable?: boolean;
    type?: 'text' | 'number' | 'date' | 'currency';
    width?: string;
  }> = [];
  export let actions: Array<{
    label: string;
    icon: string;
    onClick: (row: any) => void;
    color?: string;
  }> = [];
  export let isLoading = false;
  export let error = '';
  export let title = 'Data Records';

  // Search and filter state
  let search = '';
  let filters: Record<string, { op: string; value: string }> = {};
  let showFilters = false;

  // Initialize filters for each column
  $: if (columns.length > 0) {
    columns.forEach(col => {
      if (col.filterable && !filters[col.key]) {
        filters[col.key] = { op: '', value: '' };
      }
    });
  }

  // Sorting state
  let sortColumn: string = '';
  let sortDirection: 'asc' | 'desc' = 'asc';

  // Svelte reactive sorting and filtering
  $: filteredAndSortedData = (() => {
    console.log('SortableDataTable - data received:', data);
    console.log('SortableDataTable - columns received:', columns);
    
    if (!data || data.length === 0) {
      console.log('SortableDataTable - no data or empty array');
      return [];
    }
    
    let result = [...data];
    
    // Apply global search
    if (search) {
      const searchLower = search.toLowerCase();
      result = result.filter(row => 
        Object.values(row).some(value => 
          String(value || '').toLowerCase().includes(searchLower)
        )
      );
    }
    
    // Apply column filters
    Object.entries(filters).forEach(([column, filter]) => {
      if (filter.value && filter.value.trim() !== '') {
        const columnConfig = columns.find(col => col.key === column);
        if (!columnConfig) return;

        result = result.filter(row => {
          const value = row[column];
          const filterValue = filter.value;

          switch (columnConfig.type) {
            case 'number':
            case 'currency':
              if (!filter.op) return true; // Skip if no operator for numeric fields
              const numValue = Number(value);
              const numFilterValue = Number(filterValue);
              switch (filter.op) {
                case '=': return numValue === numFilterValue;
                case '<': return numValue < numFilterValue;
                case '>': return numValue > numFilterValue;
                case '<=': return numValue <= numFilterValue;
                case '>=': return numValue >= numFilterValue;
                case '<>': return numValue !== numFilterValue;
                default: return true;
              }
            case 'date':
              if (!filter.op) return true; // Skip if no operator for date fields
              const dateValue = new Date(value);
              const dateFilterValue = new Date(filterValue);
              switch (filter.op) {
                case '=': return dateValue.getTime() === dateFilterValue.getTime();
                case '<': return dateValue < dateFilterValue;
                case '>': return dateValue > dateFilterValue;
                case '<=': return dateValue <= dateFilterValue;
                case '>=': return dateValue >= dateFilterValue;
                case '<>': return dateValue.getTime() !== dateFilterValue.getTime();
                default: return true;
              }
            default:
              // For text fields, use simple contains filtering
              return String(value || '').toLowerCase().includes(filterValue.toLowerCase());
          }
        });
      }
    });
    
    // Apply sorting
    if (sortColumn) {
      result.sort((a, b) => {
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
    
    return result;
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

  function getSortIcon(column: string) {
    if (sortColumn !== column) return '↕️';
    return sortDirection === 'asc' ? '↑' : '↓';
  }

  function formatValue(value: any, type?: string) {
    if (value === null || value === undefined) return '';
    
    switch (type) {
      case 'date':
        return formatDate(value);
      case 'currency':
        return `₹${Number(value).toLocaleString()}`;
      case 'number':
        return Number(value).toLocaleString();
      default:
        return String(value);
    }
  }

  function clearFilters() {
    filters = {};
    search = '';
  }

  function exportData() {
    const headers = columns.map(col => col.label);
    const baseFileName = title.toLowerCase().replace(/\s+/g, '_');
    
    exportToCSV(
      filteredAndSortedData,
      headers,
      baseFileName,
      (row) => columns.map(col => {
        let value = row[col.key];
        if (col.type === 'currency') {
          value = sanitizeCurrency(value);
        }
        return escapeCSV(value);
      })
    );
  }
</script>

<div class="theme-bg-primary shadow rounded-lg overflow-hidden">
  <div class="px-6 py-4 border-b theme-border">
    <div class="flex items-center justify-between">
      <h3 class="text-lg font-semibold theme-text-primary">{title}</h3>
      <div class="flex items-center gap-2">
        <input
          type="text"
          bind:value={search}
          placeholder="Search all columns..."
          class="px-3 py-1 text-sm border theme-border rounded theme-bg-primary theme-text-primary focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        <Button
          variant="secondary"
          size="sm"
          on:click={() => showFilters = !showFilters}
        >
          {showFilters ? 'Hide' : 'Show'} Filters
        </Button>
        <Button
          variant="success"
          size="sm"
          on:click={exportData}
        >
          Export
        </Button>
      </div>
    </div>

    <!-- Filters -->
    <div class="mt-4 space-y-4">

      <!-- Column Filters -->
      {#if showFilters}
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {#each columns as column}
            {#if column.filterable}
              <div>
                <label for={`filter-${column.key}`} class="block text-sm font-medium theme-text-primary mb-1">
                  {column.label}
                </label>
                <div class="flex gap-2">
                  {#if column.type === 'number' || column.type === 'currency'}
                                          <select
                        value={filters[column.key]?.op || ''}
                        on:change={(e) => {
                          const target = e.target as HTMLSelectElement;
                          if (!filters[column.key]) filters[column.key] = { op: '', value: '' };
                          filters[column.key].op = target.value;
                          filters = filters;
                        }}
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
                        value={filters[column.key]?.value || ''}
                        on:input={(e) => {
                          const target = e.target as HTMLInputElement;
                          if (!filters[column.key]) filters[column.key] = { op: '', value: '' };
                          filters[column.key].value = target.value;
                          filters = filters;
                        }}
                        placeholder="Value"
                        class="flex-1 px-2 py-1 text-sm border theme-border rounded theme-bg-primary theme-text-primary"
                      />
                  {:else if column.type === 'date'}
                    <select
                      value={filters[column.key]?.op || ''}
                      on:change={(e) => {
                        const target = e.target as HTMLSelectElement;
                        if (!filters[column.key]) filters[column.key] = { op: '', value: '' };
                        filters[column.key].op = target.value;
                        filters = filters;
                      }}
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
                      value={filters[column.key]?.value || ''}
                      on:input={(e) => {
                        const target = e.target as HTMLInputElement;
                        if (!filters[column.key]) filters[column.key] = { op: '', value: '' };
                        filters[column.key].value = target.value;
                        filters = filters;
                      }}
                      class="flex-1 px-2 py-1 text-sm border theme-border rounded theme-bg-primary theme-text-primary"
                    />
                  {:else}
                    <input
                      type="text"
                      value={filters[column.key]?.value || ''}
                      on:input={(e) => {
                        const target = e.target as HTMLInputElement;
                        if (!filters[column.key]) filters[column.key] = { op: '', value: '' };
                        filters[column.key].value = target.value;
                        filters = filters;
                      }}
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
      {/if}
    </div>
  </div>

  {#if isLoading}
    <div class="p-6 text-center">
      <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      <p class="mt-2 theme-text-secondary">Loading...</p>
    </div>
  {:else if error}
    <div class="p-6 text-center">
      <p class="text-red-600">{error}</p>
    </div>
  {:else if filteredAndSortedData.length === 0}
    <div class="p-6 text-center">
      <p class="theme-text-tertiary">No records found</p>
    </div>
  {:else}
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
                    <span class="text-xs">{getSortIcon(column.key)}</span>
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
          {#each filteredAndSortedData as row}
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
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          {@html action.icon}
                        </svg>
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