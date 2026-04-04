<script lang="ts">
  import type { WorksTableFilters } from '$lib/types/worksTable';
  import type { WorksFilterDatalists } from '$lib/utils/worksTableUtils';

  export let datalists: WorksFilterDatalists;
  export let filters: WorksTableFilters;
  export let onFilterChange: (field: keyof WorksTableFilters, value: string) => void = () => {};

  const STATUS_VALUES = [
    'To be planned',
    'Draft Plan',
    'Plan Pending Approval',
    'Planned',
    'In progress',
    'Completed'
  ] as const;

  $: statusOptionsAlphabetical = [...STATUS_VALUES].sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: 'base' })
  );
</script>

<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
  <div>
    <label for="wo-no-filter" class="block text-sm font-medium theme-text-primary mb-1">
      Work Order Number
    </label>
    <input
      id="wo-no-filter"
      type="text"
      list="works-filter-wo-no-datalist"
      value={filters.woNoFilter}
      on:input={(e) => onFilterChange('woNoFilter', e.currentTarget.value)}
      placeholder="Type or pick WO number…"
      autocomplete="off"
      class="w-full px-3 py-2 border theme-border rounded-lg theme-bg-primary theme-text-primary focus:ring-2 focus:ring-blue-500 focus:border-transparent"
    />
    <datalist id="works-filter-wo-no-datalist">
      {#each datalists.woNo as opt}
        <option value={opt}></option>
      {/each}
    </datalist>
  </div>

  <div>
    <label for="pwo-no-filter" class="block text-sm font-medium theme-text-primary mb-1">
      Pre-Work Order Number
    </label>
    <input
      id="pwo-no-filter"
      type="text"
      list="works-filter-pwo-no-datalist"
      value={filters.pwoNoFilter}
      on:input={(e) => onFilterChange('pwoNoFilter', e.currentTarget.value)}
      placeholder="Type or pick PWO number…"
      autocomplete="off"
      class="w-full px-3 py-2 border theme-border rounded-lg theme-bg-primary theme-text-primary focus:ring-2 focus:ring-blue-500 focus:border-transparent"
    />
    <datalist id="works-filter-pwo-no-datalist">
      {#each datalists.pwoNo as opt}
        <option value={opt}></option>
      {/each}
    </datalist>
  </div>

  <div>
    <label for="vehicle-model-filter" class="block text-sm font-medium theme-text-primary mb-1">
      Vehicle Model
    </label>
    <input
      id="vehicle-model-filter"
      type="text"
      list="works-filter-vehicle-datalist"
      value={filters.vehicleModelFilter}
      on:input={(e) => onFilterChange('vehicleModelFilter', e.currentTarget.value)}
      placeholder="Type or pick vehicle model…"
      autocomplete="off"
      class="w-full px-3 py-2 border theme-border rounded-lg theme-bg-primary theme-text-primary focus:ring-2 focus:ring-blue-500 focus:border-transparent"
    />
    <datalist id="works-filter-vehicle-datalist">
      {#each datalists.vehicleModel as opt}
        <option value={opt}></option>
      {/each}
    </datalist>
  </div>

  <div>
    <label for="work-code-filter" class="block text-sm font-medium theme-text-primary mb-1">
      Work Code
    </label>
    <input
      id="work-code-filter"
      type="text"
      list="works-filter-work-code-datalist"
      value={filters.workCodeFilter}
      on:input={(e) => onFilterChange('workCodeFilter', e.currentTarget.value)}
      placeholder="Type or pick work code…"
      autocomplete="off"
      class="w-full px-3 py-2 border theme-border rounded-lg theme-bg-primary theme-text-primary focus:ring-2 focus:ring-blue-500 focus:border-transparent"
    />
    <datalist id="works-filter-work-code-datalist">
      {#each datalists.workCode as opt}
        <option value={opt}></option>
      {/each}
    </datalist>
  </div>

  <div>
    <label for="work-name-filter" class="block text-sm font-medium theme-text-primary mb-1">
      Work Name
    </label>
    <input
      id="work-name-filter"
      type="text"
      list="works-filter-work-name-datalist"
      value={filters.workNameFilter}
      on:input={(e) => onFilterChange('workNameFilter', e.currentTarget.value)}
      placeholder="Type or pick work name…"
      autocomplete="off"
      class="w-full px-3 py-2 border theme-border rounded-lg theme-bg-primary theme-text-primary focus:ring-2 focus:ring-blue-500 focus:border-transparent"
    />
    <datalist id="works-filter-work-name-datalist">
      {#each datalists.workName as opt}
        <option value={opt}></option>
      {/each}
    </datalist>
  </div>

  <div>
    <label for="required-skills-filter" class="block text-sm font-medium theme-text-primary mb-1">
      Required Skills
    </label>
    <input
      id="required-skills-filter"
      type="text"
      list="works-filter-skills-datalist"
      value={filters.requiredSkillsFilter}
      on:input={(e) => onFilterChange('requiredSkillsFilter', e.currentTarget.value)}
      placeholder="Type or pick required skills…"
      autocomplete="off"
      class="w-full px-3 py-2 border theme-border rounded-lg theme-bg-primary theme-text-primary focus:ring-2 focus:ring-blue-500 focus:border-transparent"
    />
    <datalist id="works-filter-skills-datalist">
      {#each datalists.requiredSkills as opt}
        <option value={opt}></option>
      {/each}
    </datalist>
  </div>

  <div>
    <label for="status-filter" class="block text-sm font-medium theme-text-primary mb-1">
      Status
    </label>
    <select
      id="status-filter"
      value={filters.statusFilter}
      on:change={(e) => onFilterChange('statusFilter', e.currentTarget.value)}
      class="w-full px-3 py-2 border theme-border rounded-lg theme-bg-primary theme-text-primary focus:ring-2 focus:ring-blue-500 focus:border-transparent"
    >
      <option value="">All</option>
      {#each statusOptionsAlphabetical as status}
        <option value={status}>{status}</option>
      {/each}
    </select>
  </div>
</div>
