<script lang="ts">
  import { formatTime, formatMinutes } from '$lib/utils/reportWorkUtils';

  export let plannedWork: any = null;
  export let standardTimeMinutes: number = 0;
  export let hoursWorkedTillDate: number = 0;
</script>

<div class="theme-bg-secondary rounded-lg p-4">
  <h4 class="font-medium theme-text-primary mb-2">Work Details</h4>
  <div class="space-y-1 text-sm">
    <div>
      <span class="theme-text-secondary">Work Code:</span> 
      <span class="theme-text-primary">
        {plannedWork?.other_work_code || plannedWork?.std_work_type_details?.derived_sw_code || plannedWork?.derived_sw_code || plannedWork?.std_work_type_details?.sw_code || 'N/A'}
      </span>
    </div>
    <div>
      <span class="theme-text-secondary">Work Name:</span> 
      <span class="theme-text-primary">
        {#if plannedWork?.other_work_code}
          {@const workName = plannedWork?.workAdditionData?.other_work_desc || plannedWork?.other_work_code || 'N/A'}
          {workName}
        {:else}
          {@const workName = plannedWork?.std_work_type_details?.std_work_details?.sw_name || ''}
          {@const typeDescription = plannedWork?.std_work_type_details?.type_description || ''}
          {@const fullWorkName = workName + (typeDescription ? (workName ? ' - ' : '') + typeDescription : '')}
          {fullWorkName || 'N/A'}
        {/if}
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

