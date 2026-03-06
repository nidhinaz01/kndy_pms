<script lang="ts">
  import { getSortIconClass, getSortIndicator, type SortConfig } from '$lib/utils/tableSorting';

  export let column: string;
  export let sortConfig: SortConfig;
  export let onSort: (column: string) => void;
  export let label: string;
  export let headerClass: string = '';

  function handleClick() {
    onSort(column);
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleClick();
    }
  }
</script>

<th 
  class="px-6 py-3 text-left text-xs font-medium theme-text-secondary uppercase tracking-wider cursor-pointer hover:theme-bg-primary transition-colors select-none {headerClass}"
  on:click={handleClick}
  role="columnheader"
  tabindex="0"
  on:keydown={handleKeydown}
  aria-sort={sortConfig.column === column 
    ? (sortConfig.direction === 'asc' ? 'ascending' : 'descending')
    : 'none'}
>
  <div class="flex items-center gap-2">
    <span>{label}</span>
    <svg 
      class="w-4 h-4 transition-transform {getSortIconClass(column, sortConfig)}" 
      fill="none" 
      stroke="currentColor" 
      viewBox="0 0 24 24"
      aria-label={getSortIndicator(column, sortConfig)}
    >
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7" />
    </svg>
  </div>
</th>
