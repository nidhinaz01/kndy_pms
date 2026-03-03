<script lang="ts">
  import Button from '$lib/components/common/Button.svelte';
  import type { ManpowerTableFilters } from '$lib/types/manpowerTable';

  export let filters: ManpowerTableFilters;
  export let onFilterChange: (field: keyof ManpowerTableFilters, value: any) => void = () => {};
  export let onClearFilters: () => void = () => {};
</script>

  <div class="flex items-center gap-4">
  <div class="flex items-center gap-4">
    <div class="block text-sm font-medium theme-text-primary mb-1 mr-4">Status:</div>
    <label class="inline-flex items-center text-sm">
      <input type="checkbox" checked={filters.selectedStatus === 'present'} on:change={() => onFilterChange('selectedStatus', filters.selectedStatus === 'present' ? '' : 'present')} />
      <span class="ml-2">Present</span>
    </label>
    <label class="inline-flex items-center text-sm">
      <input type="checkbox" checked={filters.selectedStatus === 'absent'} on:change={() => onFilterChange('selectedStatus', filters.selectedStatus === 'absent' ? '' : 'absent')} />
      <span class="ml-2">Absent</span>
    </label>
    <label class="inline-flex items-center text-sm">
      <input type="checkbox" checked={filters.selectedStatus === 'not_marked'} on:change={() => onFilterChange('selectedStatus', filters.selectedStatus === 'not_marked' ? '' : 'not_marked')} />
      <span class="ml-2">Not Marked</span>
    </label>
  <fieldset class="flex items-center gap-3">
    <legend class="sr-only">Advanced Filters</legend>
    <label class="inline-flex items-center text-sm">
      <input type="checkbox" bind:checked={filters.plannedExceedsShift} disabled={filters.selectedStatus !== 'present'} title="Only applies when Present is selected" on:change={() => onFilterChange('plannedExceedsShift', filters.plannedExceedsShift)} />
      <span class="ml-2">Hours Planned &gt; Shift Hours</span>
    </label>
    <label class="inline-flex items-center text-sm">
      <input type="checkbox" bind:checked={filters.reassignedToOther} disabled={filters.selectedStatus !== 'present'} title="Only applies when Present is selected" on:change={() => onFilterChange('reassignedToOther', filters.reassignedToOther)} />
      <span class="ml-2">Reassigned to Other Stage</span>
    </label>
    <label class="inline-flex items-center text-sm">
      <input type="checkbox" bind:checked={filters.reassignedFromOther} disabled={filters.selectedStatus !== 'present'} title="Only applies when Present is selected" on:change={() => onFilterChange('reassignedFromOther', filters.reassignedFromOther)} />
      <span class="ml-2">Reassigned from Other Stage</span>
    </label>
  </fieldset>
  </div>
  <Button variant="secondary" size="sm" on:click={onClearFilters}>
    Clear Filters
  </Button>
</div>

