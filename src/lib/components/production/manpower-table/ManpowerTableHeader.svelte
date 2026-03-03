<script lang="ts">
  import Button from '$lib/components/common/Button.svelte';
  import { Download, Users } from 'lucide-svelte';
  import type { ManpowerTableFilters } from '$lib/types/manpowerTable';

  export let filters: ManpowerTableFilters;
  export let showFilters: boolean = false;
  export let selectedCount: number = 0;
  export let onSearchChange: (value: string) => void = () => {};
  export let onToggleFilters: () => void = () => {};
  export let onExport: () => void = () => {};
  export let onBulkAttendance: () => void = () => {};
  export let onSelectAll: () => void = () => {};
  export let allSelected: boolean = false;
  export let eligibleCount: number = 0;
  export let hideSearch: boolean = false;
  export let hideActions: boolean = false;
</script>

  <div class="flex items-center justify-between space-x-2">
  <div class="flex items-center gap-2">
    {#if !hideSearch}
      <input 
        type="text" 
        placeholder="Search employees..." 
        value={filters.search}
        on:input={(e) => onSearchChange(e.currentTarget.value)}
        class="border theme-border rounded-full pl-3 pr-3 py-2 w-full max-w-xs theme-bg-secondary theme-text-primary" 
      />
    {/if}
    <span class="min-w-[140px] whitespace-nowrap">
      {#if !hideActions}
        <Button variant="secondary" size="sm" on:click={onToggleFilters}>
          {showFilters ? 'Hide' : 'Show'} Filters
        </Button>
      {/if}
    </span>
  </div>
  <div class="flex items-center gap-2">
    {#if !hideActions}
      {#if selectedCount > 0}
        <Button variant="primary" size="sm" on:click={onBulkAttendance}>
          <Users class="w-4 h-4 mr-1" />
          Mark Attendance ({selectedCount})
        </Button>
      {/if}
      <Button variant="secondary" size="sm" on:click={onExport}>
        <Download class="w-4 h-4 mr-1" />
        Export
      </Button>
    {/if}
  </div>
</div>

