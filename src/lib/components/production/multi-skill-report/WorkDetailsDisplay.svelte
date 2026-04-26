<script lang="ts">
  import { formatMinutes } from '$lib/utils/multiSkillReportUtils';
  import { getWorkDisplayCode, getWorkDisplayName } from '$lib/utils/workDisplayUtils';

  export let selectedWorks: any[] = [];
  export let standardTimeMinutes: number = 0;
</script>

<div class="theme-bg-secondary rounded-lg p-4">
  <h4 class="font-medium theme-text-primary mb-2">Work Details</h4>
  <div class="space-y-1 text-sm">
    <div>
      <span class="theme-text-secondary">Work Order No.:</span> 
      <span class="theme-text-primary">
        {selectedWorks[0]?.wo_no || selectedWorks[0]?.prdn_wo_details?.wo_no || 'N/A'}
      </span>
    </div>
    <div>
      <span class="theme-text-secondary">Pre Work Order No.:</span> 
      <span class="theme-text-primary">
        {selectedWorks[0]?.pwo_no || selectedWorks[0]?.prdn_wo_details?.pwo_no || 'N/A'}
      </span>
    </div>
    <div>
      <span class="theme-text-secondary">Work Code:</span> 
      <span class="theme-text-primary">
        {getWorkDisplayCode(selectedWorks[0]) || 'N/A'}
      </span>
    </div>
    <div>
      <span class="theme-text-secondary">Work Name:</span> 
      <span class="theme-text-primary">
        {getWorkDisplayName(selectedWorks[0]) || 'N/A'}
      </span>
    </div>
    <div>
      <span class="theme-text-secondary">Selected Skills:</span> 
      <span class="theme-text-primary">
        {(() => {
          const uniqueSkills = selectedWorks
            .map(w => w.std_work_skill_mapping?.sc_name || w.sc_required || 'N/A')
            .filter((v, i, a) => a.indexOf(v) === i);
          return uniqueSkills.join(' + ');
        })()}
      </span>
    </div>
    <div>
      <span class="theme-text-secondary">Standard Time:</span> 
      <span class="theme-text-primary">{formatMinutes(standardTimeMinutes)}</span>
    </div>
  </div>
</div>

