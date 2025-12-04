<script lang="ts">
  import Button from '$lib/components/common/Button.svelte';
  import { Search, Filter, Download, Plus } from 'lucide-svelte';
  import type { WorksTableFilters } from '$lib/types/worksTable';

  export let filters: WorksTableFilters;
  export let showFilters: boolean = false;
  export let isLoading: boolean = false;
  export let onSearchChange: (value: string) => void = () => {};
  export let onToggleFilters: () => void = () => {};
  export let onRefresh: () => void = () => {};
  export let onExport: () => void = () => {};
  export let onAddWork: () => void = () => {};
</script>

<div class="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
  <h2 class="text-xl font-semibold theme-text-primary">Works to be Planned</h2>
  
  <div class="flex flex-col sm:flex-row gap-4 flex-1">
    <div class="relative flex-1 max-w-md">
      <Search class="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 theme-text-secondary" />
      <input
        type="text"
        value={filters.searchTerm}
        on:input={(e) => onSearchChange(e.currentTarget.value)}
        placeholder="Search works..."
        class="w-full pl-10 pr-4 py-2 theme-bg-primary theme-border theme-text-primary rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
      />
    </div>

    <Button
      variant="secondary"
      size="sm"
      on:click={onToggleFilters}
    >
      <Filter class="w-4 h-4 mr-2" />
      {showFilters ? 'Hide Filters' : 'Show Filters'}
    </Button>
  </div>

  <div class="flex gap-2">
    <Button
      variant="secondary"
      size="sm"
      on:click={onRefresh}
      disabled={isLoading}
    >
      {isLoading ? 'Loading...' : 'Refresh'}
    </Button>
    <Button
      variant="secondary"
      size="sm"
      on:click={onExport}
    >
      <Download class="w-4 h-4 mr-2" />
      Export
    </Button>
    <Button
      variant="primary"
      size="sm"
      on:click={onAddWork}
    >
      <Plus class="w-4 h-4 mr-2" />
      Add Non Std. Work
    </Button>
  </div>
</div>

