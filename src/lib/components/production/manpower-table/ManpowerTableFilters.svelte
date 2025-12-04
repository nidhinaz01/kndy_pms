<script lang="ts">
  import Button from '$lib/components/common/Button.svelte';
  import type { ManpowerTableFilters } from '$lib/types/manpowerTable';

  export let filters: ManpowerTableFilters;
  export let onFilterChange: (field: keyof ManpowerTableFilters, value: string) => void = () => {};
  export let onClearFilters: () => void = () => {};
</script>

<div class="flex items-center gap-4">
  <div>
    <label for="statusFilter" class="block text-sm font-medium theme-text-primary mb-1">Status Filter:</label>
    <select
      id="statusFilter"
      value={filters.selectedStatus}
      on:change={(e) => onFilterChange('selectedStatus', e.currentTarget.value)}
      class="px-3 py-2 border theme-border rounded-lg theme-bg-primary theme-text-primary text-sm"
    >
      <option value="">All Status</option>
      <option value="present">Present</option>
      <option value="absent">Absent</option>
      <option value="overtime">Overtime (OT > 0)</option>
      <option value="losttime">Lost Time (LT > 0)</option>
    </select>
  </div>
  <Button variant="secondary" size="sm" on:click={onClearFilters}>
    Clear Filters
  </Button>
</div>

