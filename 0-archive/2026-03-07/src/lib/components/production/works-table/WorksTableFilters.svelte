<script lang="ts">
  import type { WorksTableFilters } from '$lib/types/worksTable';

  export let filters: WorksTableFilters;
  export let onFilterChange: (field: keyof WorksTableFilters, value: string) => void = () => {};
</script>

<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
  <div>
    <label for="wo-no-filter" class="block text-sm font-medium theme-text-primary mb-1">
      Work Order Number
    </label>
    <input
      id="wo-no-filter"
      type="text"
      value={filters.woNoFilter}
      on:input={(e) => onFilterChange('woNoFilter', e.currentTarget.value)}
      placeholder="Filter by WO Number..."
      class="w-full px-3 py-2 border theme-border rounded-lg theme-bg-primary theme-text-primary focus:ring-2 focus:ring-blue-500 focus:border-transparent"
    />
  </div>

  <div>
    <label for="pwo-no-filter" class="block text-sm font-medium theme-text-primary mb-1">
      Pre-Work Order Number
    </label>
    <input
      id="pwo-no-filter"
      type="text"
      value={filters.pwoNoFilter}
      on:input={(e) => onFilterChange('pwoNoFilter', e.currentTarget.value)}
      placeholder="Filter by PWO Number..."
      class="w-full px-3 py-2 border theme-border rounded-lg theme-bg-primary theme-text-primary focus:ring-2 focus:ring-blue-500 focus:border-transparent"
    />
  </div>

  <div>
    <label for="vehicle-model-filter" class="block text-sm font-medium theme-text-primary mb-1">
      Vehicle Model
    </label>
    <input
      id="vehicle-model-filter"
      type="text"
      value={filters.vehicleModelFilter}
      on:input={(e) => onFilterChange('vehicleModelFilter', e.currentTarget.value)}
      placeholder="Filter by Vehicle Model..."
      class="w-full px-3 py-2 border theme-border rounded-lg theme-bg-primary theme-text-primary focus:ring-2 focus:ring-blue-500 focus:border-transparent"
    />
  </div>

  <div>
    <label for="work-code-filter" class="block text-sm font-medium theme-text-primary mb-1">
      Work Code
    </label>
    <input
      id="work-code-filter"
      type="text"
      value={filters.workCodeFilter}
      on:input={(e) => onFilterChange('workCodeFilter', e.currentTarget.value)}
      placeholder="Filter by Work Code..."
      class="w-full px-3 py-2 border theme-border rounded-lg theme-bg-primary theme-text-primary focus:ring-2 focus:ring-blue-500 focus:border-transparent"
    />
  </div>

  <div>
    <label for="work-name-filter" class="block text-sm font-medium theme-text-primary mb-1">
      Work Name
    </label>
    <input
      id="work-name-filter"
      type="text"
      value={filters.workNameFilter}
      on:input={(e) => onFilterChange('workNameFilter', e.currentTarget.value)}
      placeholder="Filter by Work Name..."
      class="w-full px-3 py-2 border theme-border rounded-lg theme-bg-primary theme-text-primary focus:ring-2 focus:ring-blue-500 focus:border-transparent"
    />
  </div>

  <div>
    <label for="required-skills-filter" class="block text-sm font-medium theme-text-primary mb-1">
      Required Skills
    </label>
    <input
      id="required-skills-filter"
      type="text"
      value={filters.requiredSkillsFilter}
      on:input={(e) => onFilterChange('requiredSkillsFilter', e.currentTarget.value)}
      placeholder="Filter by Required Skills..."
      class="w-full px-3 py-2 border theme-border rounded-lg theme-bg-primary theme-text-primary focus:ring-2 focus:ring-blue-500 focus:border-transparent"
    />
  </div>
</div>

