<script lang="ts">
  import WorksTableRow from './WorksTableRow.svelte';
  import SortableHeader from '$lib/components/common/SortableHeader.svelte';
  import { getWorkId } from '$lib/utils/worksTableUtils';
  import type { WorkPlanningStatus, WorkStatus } from '$lib/types/worksTable';
  import type { SortConfig } from '$lib/utils/tableSorting';

  export let filteredData: any[] = [];
  export let isLoading: boolean = false;
  export let selectedRows: Set<string>;
  export let workPlanningStatus: { [key: string]: WorkPlanningStatus };
  export let workStatus: { [key: string]: WorkStatus };
  export let filters: any;
  export let stageCode: string = '';
  export let sortConfig: SortConfig = { column: null, direction: null };
  export let onSort: (column: string) => void = () => {};
  export let onToggleSelection: (work: any) => void = () => {};
  export let onPlanWork: (work: any) => void = () => {};
  export let onViewWork: (work: any) => void = () => {};
  export let onRemoveWork: (work: any) => void = () => {};
  export let isWorkPlanned: (work: any) => boolean = () => false;
  export let canRemoveWork: (work: any) => boolean = () => false;
  export let getRemoveWorkReason: (work: any) => { canRemove: boolean; reason?: string } = () => ({ canRemove: false });
  export let onSelectAll: () => void = () => {};
  export let onClearAll: () => void = () => {};
  export let allRemovableSelected: boolean = false;
</script>

<thead class="theme-bg-secondary sticky top-0 z-10">
  <tr>
    <th class="px-6 py-3 text-left text-xs font-medium theme-text-secondary uppercase tracking-wider w-12">
      <input
        type="checkbox"
        class="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
        checked={allRemovableSelected}
        on:change={(e) => {
          if (e.currentTarget.checked) {
            onSelectAll();
          } else {
            onClearAll();
          }
        }}
      />
    </th>
    <SortableHeader column="wo_details_id" {sortConfig} {onSort} label="WO Details ID" />
    <SortableHeader column="wo_no" {sortConfig} {onSort} label="Work Order Number" />
    <SortableHeader column="pwo_no" {sortConfig} {onSort} label="Pre-Work Order Number" />
    <SortableHeader column="wo_model" {sortConfig} {onSort} label="Vehicle Model" />
    <SortableHeader column="work_code" {sortConfig} {onSort} label="Work Code" />
    <SortableHeader column="work_name" {sortConfig} {onSort} label="Work Name" />
    <th class="px-6 py-3 text-left text-xs font-medium theme-text-secondary uppercase tracking-wider">
      Status
    </th>
    <th class="px-6 py-3 text-left text-xs font-medium theme-text-secondary uppercase tracking-wider">
      Required Skills
    </th>
    <SortableHeader column="duration" {sortConfig} {onSort} label="Duration" />
    <SortableHeader column="time_taken" {sortConfig} {onSort} label="Time Taken" />
    <SortableHeader column="remaining_time" {sortConfig} {onSort} label="Remaining Time" />
    <th class="px-6 py-3 text-left text-xs font-medium theme-text-secondary uppercase tracking-wider">
      Actions
    </th>
  </tr>
</thead>
<tbody class="theme-bg-primary divide-y divide-gray-200 dark:divide-gray-700">
  {#if isLoading}
    <tr>
      <td colspan="13" class="px-6 py-4 text-center">
        <div class="flex items-center justify-center">
          <div class="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500 mr-2"></div>
          <span class="theme-text-secondary">Loading works...</span>
        </div>
      </td>
    </tr>
  {:else if filteredData.length === 0}
    <tr>
      <td colspan="13" class="px-6 py-4 text-center">
        <div class="text-center py-8">
          <div class="text-4xl mb-2">🔧</div>
          <p class="theme-text-secondary text-lg">No works found</p>
          <p class="theme-text-secondary text-sm mt-1">
            {filters.searchTerm || filters.woNoFilter || filters.pwoNoFilter || filters.vehicleModelFilter || filters.workCodeFilter || filters.workNameFilter || filters.requiredSkillsFilter ? 'Try adjusting your filters' : 'No works have been added yet'}
          </p>
        </div>
      </td>
    </tr>
  {:else}
    {#each filteredData as work}
      {@const derivedSwCode = work.std_work_type_details?.derived_sw_code || work.sw_code}
      {@const otherWorkCode = work.is_added_work ? (work.sw_code || null) : null}
      {@const workCode = derivedSwCode || otherWorkCode || 'Unknown'}
      {@const woDetailsId = work.wo_details_id}
      {@const workKey = `${workCode}_${woDetailsId}_${stageCode}`}
      {@const status = workStatus[workKey] || 'To be planned'}
      {@const planningStatus = workPlanningStatus[workKey] || { canPlan: false }}
      {@const isPlanned = isWorkPlanned(work)}
      {@const canRemove = canRemoveWork(work)}
      {@const removeReason = getRemoveWorkReason(work)}
      
      <WorksTableRow
        {work}
        isSelected={selectedRows.has(getWorkId(work))}
        {planningStatus}
        {status}
        isWorkPlanned={isPlanned}
        {canRemove}
        removeReason={removeReason.reason}
        onToggleSelection={() => onToggleSelection(work)}
        onPlanWork={() => onPlanWork(work)}
        onViewWork={() => onViewWork(work)}
        onRemoveWork={() => onRemoveWork(work)}
      />
    {/each}
  {/if}
</tbody>

