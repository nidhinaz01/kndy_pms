<script lang="ts">
  import ManpowerReportTableRow from './ManpowerReportTableRow.svelte';
  import type { ProductionEmployee } from '$lib/api/production';

  export let filteredData: ProductionEmployee[] = [];
  export let data: ProductionEmployee[] = [];
  export let selectedEmployees: Set<string>;
  export let reportingSubmissionStatus: any = null;
  export let onToggleSelection: (employee: ProductionEmployee) => void = () => {};
  export let onAttendanceToggle: (employee: ProductionEmployee) => void = () => {};
  export let onStageReassignment: (employee: ProductionEmployee) => void = () => {};
  export let onViewJourney: (employee: ProductionEmployee) => void = () => {};
  export let onSelectAll: () => void = () => {};
  export let onClearAll: () => void = () => {};
  export let allSelected: boolean = false;
  export let eligibleCount: number = 0;
</script>

<thead class="theme-bg-secondary">
  <tr>
    <th class="px-6 py-3 text-left text-xs font-medium theme-text-primary uppercase tracking-wider">
      <input 
        type="checkbox" 
        checked={allSelected}
        on:change={() => allSelected ? onClearAll() : onSelectAll()}
        class="rounded theme-border"
        disabled={eligibleCount === 0}
      />
    </th>
    <th class="px-6 py-3 text-left text-xs font-medium theme-text-primary uppercase tracking-wider">Employee</th>
    <th class="px-6 py-3 text-left text-xs font-medium theme-text-primary uppercase tracking-wider">Skill</th>
    <th class="px-6 py-3 text-left text-xs font-medium theme-text-primary uppercase tracking-wider">Status</th>
    <th class="px-6 py-3 text-left text-xs font-medium theme-text-primary uppercase tracking-wider">Current Stage</th>
    <th class="px-6 py-3 text-left text-xs font-medium theme-text-primary uppercase tracking-wider">Shift</th>
    <th class="px-6 py-3 text-left text-xs font-medium theme-text-primary uppercase tracking-wider">Hours Planned</th>
    <th class="px-6 py-3 text-left text-xs font-medium theme-text-primary uppercase tracking-wider">Hours Reported</th>
    <th class="px-6 py-3 text-left text-xs font-medium theme-text-primary uppercase tracking-wider">OT Hours</th>
    <th class="px-6 py-3 text-left text-xs font-medium theme-text-primary uppercase tracking-wider">LT Hours</th>
    <th class="px-6 py-3 text-left text-xs font-medium theme-text-primary uppercase tracking-wider">LTP Hours</th>
    <th class="px-6 py-3 text-left text-xs font-medium theme-text-primary uppercase tracking-wider">LTNP Hours</th>
    <th class="px-6 py-3 text-left text-xs font-medium theme-text-primary uppercase tracking-wider">To Other Stage</th>
    <th class="px-6 py-3 text-left text-xs font-medium theme-text-primary uppercase tracking-wider">From Other Stage</th>
    <th class="px-6 py-3 text-left text-xs font-medium theme-text-primary uppercase tracking-wider">Actions</th>
  </tr>
</thead>
<tbody class="theme-bg-primary divide-y theme-border">
  {#if filteredData.length === 0}
    <tr>
      <td colspan="15" class="px-6 py-4 text-center text-sm theme-text-secondary">
        {data.length === 0 ? 'No employees found for this stage and date' : 'No employees match the current filters'}
      </td>
    </tr>
  {:else}
    {#each filteredData as employee}
      <ManpowerReportTableRow
        {employee}
        isSelected={selectedEmployees.has(employee.emp_id)}
        {reportingSubmissionStatus}
        onToggleSelection={() => onToggleSelection(employee)}
        onAttendanceToggle={() => onAttendanceToggle(employee)}
        onStageReassignment={() => onStageReassignment(employee)}
        onViewJourney={() => onViewJourney(employee)}
      />
    {/each}
  {/if}
</tbody>

