<script lang="ts">
  import type { WorkContinuation } from '$lib/types/planWork';
  import { formatTime, getSkillShort } from '$lib/utils/planWorkUtils';

  export let work: any = null;
  export let workContinuation: WorkContinuation;
</script>

<!-- Work Details -->
<div class="theme-bg-secondary rounded-lg p-4">
  <h4 class="font-medium theme-text-primary mb-2">Work Details</h4>
  <div class="space-y-1 text-sm">
    <div>
      <span class="theme-text-secondary">Work Order No.:</span> 
      <span class="theme-text-primary">
        {work?.wo_no || work?.prdn_wo_details?.wo_no || 'N/A'}
      </span>
    </div>
    <div>
      <span class="theme-text-secondary">Pre Work Order No.:</span> 
      <span class="theme-text-primary">
        {work?.pwo_no || work?.prdn_wo_details?.pwo_no || 'N/A'}
      </span>
    </div>
    <div>
      <span class="theme-text-secondary">Code:</span> 
      <span class="theme-text-primary">
        {work?.std_work_type_details?.derived_sw_code || work?.sw_code}
      </span>
    </div>
    <div>
      <span class="theme-text-secondary">Name:</span> 
      <span class="theme-text-primary">
        {work?.sw_name}{work?.std_work_type_details?.type_description ? ' - ' + work.std_work_type_details.type_description : ''}
      </span>
    </div>
    <div>
      <span class="theme-text-secondary">Standard Time:</span> 
      <span class="theme-text-primary">
        {#if work?.std_vehicle_work_flow?.estimated_duration_minutes}
          {formatTime(work.std_vehicle_work_flow.estimated_duration_minutes / 60)}
        {:else if work?.skill_time_standards}
          {#if work.skill_time_standards.isUniform && work.skill_time_standards.values.length > 0}
            {formatTime(work.skill_time_standards.values[0].standard_time_minutes / 60)}
          {:else if work.skill_time_standards.values.length > 0}
            {formatTime(Math.max(...work.skill_time_standards.values.map(v => v.standard_time_minutes)) / 60)}
          {:else}
            N/A
          {/if}
        {:else}
          N/A
        {/if}
      </span>
    </div>
    <div>
      <span class="theme-text-secondary">Time Taken:</span> 
      <span class="theme-text-primary">{formatTime(workContinuation.timeWorkedTillDate)}</span>
    </div>
    <div>
      <span class="theme-text-secondary">Remaining Time:</span> 
      <span class="theme-text-primary">{formatTime(workContinuation.remainingTime)}</span>
    </div>
  </div>
</div>

<!-- Required Skills -->
{#if work?.skill_mappings && work.skill_mappings.length > 0}
  <div>
    <h4 class="font-medium theme-text-primary mb-2">Required Skills</h4>
    <div class="flex flex-wrap gap-2">
      {#each work.skill_mappings as skill}
        {@const skillAny = skill as any}
        {@const skillShort = getSkillShort(skillAny)}
        <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400">
          {skillShort || skillAny.sc_name}
        </span>
      {/each}
    </div>
  </div>
{/if}

<!-- Work Continuation Info -->
{#if workContinuation.hasPreviousWork}
  <div class="theme-bg-yellow-50 dark:theme-bg-yellow-900/20 rounded-lg p-4 border border-yellow-200 dark:border-yellow-800">
    <h4 class="font-medium text-yellow-800 dark:text-yellow-200 mb-2">Work Continuation</h4>
    <div class="space-y-1 text-sm text-yellow-700 dark:text-yellow-300">
      <div>
        Time worked till date: 
        <span class="font-medium">{formatTime(workContinuation.timeWorkedTillDate)}</span>
      </div>
      <div>
        Remaining time: 
        <span class="font-medium">{formatTime(workContinuation.remainingTime)}</span>
      </div>
    </div>
  </div>
{/if}

