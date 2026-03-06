<script lang="ts">
  import type { WorkStatus } from '$lib/types/worksTable';

  export let filteredData: any[] = [];
  export let workStatus: { [key: string]: WorkStatus } = {};
  export let stageCode: string = '';

  function getStatusCount(status: WorkStatus): number {
    return filteredData.filter(w => {
      const key = `${w.std_work_type_details?.derived_sw_code || w.sw_code}_${stageCode}`;
      return workStatus[key] === status;
    }).length;
  }
</script>

<div class="flex flex-wrap gap-4 text-sm">
  <div class="theme-text-secondary">
    <span class="font-medium">Total Works:</span> {filteredData.length}
  </div>
  <div class="theme-text-secondary">
    <span class="font-medium">To be Planned:</span> {getStatusCount('To be planned')}
  </div>
  <div class="theme-text-secondary">
    <span class="font-medium">Draft Plan:</span> {getStatusCount('Draft Plan')}
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
</div>

