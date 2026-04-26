<script lang="ts">
  import { formatTime, formatMinutes } from '$lib/utils/reportWorkUtils';
  import { getWorkDisplayCode, getWorkDisplayName } from '$lib/utils/workDisplayUtils';

  export let plannedWork: any = null;
  export let standardTimeMinutes: number = 0;
  export let hoursWorkedTillDate: number = 0;
</script>

<div class="theme-bg-secondary rounded-lg p-4">
  <h4 class="font-medium theme-text-primary mb-2">Work Details</h4>
  <div class="space-y-1 text-sm">
    <div>
      <span class="theme-text-secondary">Work Order No.:</span> 
      <span class="theme-text-primary">
        {plannedWork?.wo_no || plannedWork?.prdn_wo_details?.wo_no || 'N/A'}
      </span>
    </div>
    <div>
      <span class="theme-text-secondary">Pre Work Order No.:</span> 
      <span class="theme-text-primary">
        {plannedWork?.pwo_no || plannedWork?.prdn_wo_details?.pwo_no || 'N/A'}
      </span>
    </div>
    <div>
      <span class="theme-text-secondary">Work Code:</span> 
      <span class="theme-text-primary">
        {getWorkDisplayCode(plannedWork) || 'N/A'}
      </span>
    </div>
    <div>
      <span class="theme-text-secondary">Work Name:</span> 
      <span class="theme-text-primary">
        {getWorkDisplayName(plannedWork) || 'N/A'}
      </span>
    </div>
    <div>
      <span class="theme-text-secondary">Standard Time:</span> 
      <span class="theme-text-primary">{formatMinutes(standardTimeMinutes)}</span>
    </div>
    <div>
      <span class="theme-text-secondary">Time Worked Till Date:</span> 
      <span class="theme-text-primary">{formatTime(hoursWorkedTillDate)}</span>
    </div>
  </div>
</div>

