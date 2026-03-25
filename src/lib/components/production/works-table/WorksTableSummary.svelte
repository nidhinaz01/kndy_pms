<script lang="ts">
  import type { WorkStatus } from '$lib/types/worksTable';
  import { getWorkStatusRowKey } from '$lib/utils/worksTableUtils';

  export let filteredData: any[] = [];
  export let workStatus: { [key: string]: WorkStatus } = {};
  export let stageCode: string = '';
  /** When true, per-status counts are not shown yet (avoid treating empty map as all "To be planned"). */
  export let statusesLoading = false;

  /** One count per Works table row (each work line), not deduplicated by work order number. */
  function getStatusCount(status: WorkStatus): number {
    if (statusesLoading) return 0;
    return filteredData.filter((w) => {
      const key = getWorkStatusRowKey(w, stageCode);
      if (!key) return false;
      const rowStatus = workStatus[key];
      if (rowStatus === undefined) return false;
      return rowStatus === status;
    }).length;
  }
</script>

<div class="flex flex-wrap gap-4 text-sm">
  <div class="theme-text-secondary">
    <span class="font-medium">Total Works:</span> {filteredData.length}
  </div>
  {#if statusesLoading}
    <div class="theme-text-secondary italic">
      Resolving status breakdown…
    </div>
  {:else}
    <div class="theme-text-secondary">
      <span class="font-medium">To be Planned:</span> {getStatusCount('To be planned')}
    </div>
    <div class="theme-text-secondary">
      <span class="font-medium">Draft Plan:</span> {getStatusCount('Draft Plan')}
    </div>
    <div class="theme-text-secondary">
      <span class="font-medium">Plan Pending Approval:</span> {getStatusCount('Plan Pending Approval')}
    </div>
    <div class="theme-text-secondary">
      <span class="font-medium">Planned:</span> {getStatusCount('Planned')}
    </div>
    <div class="theme-text-secondary">
      <span class="font-medium">In Progress:</span> {getStatusCount('In progress')}
    </div>
    <div class="theme-text-secondary">
      <span class="font-medium">Completed:</span> {getStatusCount('Completed')}
    </div>
  {/if}
</div>

