<script lang="ts">
  import Button from '$lib/components/common/Button.svelte';
  import { formatTime, getWorkId } from '$lib/utils/worksTableUtils';
  import type { WorkPlanningStatus, WorkStatus } from '$lib/types/worksTable';

  // Format minutes to "x Hr y Min" format
  function formatTimeVerbose(minutes: number): string {
    if (!minutes) return '0 Hr 0 Min';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours} Hr ${mins} Min`;
  }

  export let work: any;
  export let isSelected: boolean = false;
  export let planningStatus: WorkPlanningStatus;
  export let status: WorkStatus;
  export let isWorkPlanned: boolean = false;
  export let canRemove: boolean = false;
  export let removeReason: string | undefined = undefined;
  
  // Reference isWorkPlanned to satisfy linter (may be used for future functionality)
  $: void isWorkPlanned;
  export let onToggleSelection: () => void = () => {};
  export let onPlanWork: () => void = () => {};
  export let onViewWork: () => void = () => {};
  export let onRemoveWork: () => void = () => {};

  // Debug: Log work data for specific works
  $: {
    const workCode = work?.std_work_type_details?.derived_sw_code || work?.sw_code;
    if ((workCode === 'M0180A' || workCode === 'M0176A') && !work?.std_vehicle_work_flow?.estimated_duration_minutes) {
      console.log(`🔍 Debug work ${workCode}:`, {
        hasVehicleFlow: !!work?.std_vehicle_work_flow,
        hasSkillStandards: !!work?.skill_time_standards,
        skill_time_standards: work?.skill_time_standards,
        std_vehicle_work_flow: work?.std_vehicle_work_flow
      });
    }
  }
</script>

<tr class="hover:theme-bg-secondary transition-colors duration-150 {isSelected ? 'bg-blue-50 dark:bg-blue-900/20 text-gray-900 dark:text-gray-100' : ''}" 
    class:time-exceeded={work.time_exceeded}>
  <td class="px-6 py-4 whitespace-nowrap {isSelected ? 'text-gray-900 dark:text-gray-100' : ''}">
    <input
      type="checkbox"
      class="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
      checked={isSelected}
      disabled={!canRemove}
      on:change={onToggleSelection}
    />
  </td>
  <td class="px-6 py-4 whitespace-nowrap text-sm font-medium {isSelected ? 'text-gray-900 dark:text-gray-100' : 'theme-text-primary'}">
    {work.wo_details_id || 'N/A'}
  </td>
  <td class="px-6 py-4 whitespace-nowrap text-sm font-medium {isSelected ? 'text-gray-900 dark:text-gray-100' : 'theme-text-primary'}">
    {work.wo_no || 'N/A'}
  </td>
  <td class="px-6 py-4 whitespace-nowrap text-sm font-medium {isSelected ? 'text-gray-900 dark:text-gray-100' : 'theme-text-primary'}">
    {work.pwo_no || 'N/A'}
  </td>
  <td class="px-6 py-4 whitespace-nowrap text-sm font-medium {isSelected ? 'text-gray-900 dark:text-gray-100' : 'theme-text-primary'}">
    {work.mstr_wo_type?.wo_type_name || 'N/A'}
  </td>
  <td class="px-6 py-4 whitespace-nowrap text-sm font-medium {isSelected ? 'text-gray-900 dark:text-gray-100' : 'theme-text-primary'}">
    {work.std_work_type_details?.derived_sw_code || work.sw_code || 'N/A'}
  </td>
  <td class="px-6 py-4 text-sm {isSelected ? 'text-gray-900 dark:text-gray-100' : 'theme-text-primary'} max-w-xs">
    <div class="break-words">
      {work.sw_name}{work.std_work_type_details?.type_description ? ' - ' + work.std_work_type_details.type_description : ''}
    </div>
  </td>
  <td class="px-6 py-4 whitespace-nowrap text-sm">
    {#if status === 'To be planned'}
      <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300">
        To be planned
      </span>
    {:else if status === 'Draft Plan'}
      <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400">
        Draft Plan
      </span>
    {:else if status === 'Plan Pending Approval'}
      <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400">
        Plan Pending Approval
      </span>
    {:else if status === 'Planned'}
      <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400">
        Planned
      </span>
    {:else if status === 'In progress'}
      <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400">
        In progress
      </span>
    {:else if status === 'Completed'}
      <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400">
        Completed
      </span>
    {:else}
      <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300">
        {status}
      </span>
    {/if}
  </td>
  <td class="px-6 py-4 whitespace-nowrap text-sm">
    {#if work.skill_mappings && work.skill_mappings.length > 0}
      <div class="flex flex-wrap gap-1">
        {#each work.skill_mappings as skill}
          <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400">
            {skill.sc_name}
          </span>
        {/each}
      </div>
    {:else}
      <span class="text-gray-400">No skills</span>
    {/if}
  </td>
  <td class="px-6 py-4 whitespace-nowrap text-sm {isSelected ? 'text-gray-900 dark:text-gray-100' : 'theme-text-primary'}">
    {#if work.std_vehicle_work_flow?.estimated_duration_minutes}
      {formatTimeVerbose(work.std_vehicle_work_flow.estimated_duration_minutes)}
    {:else if work.skill_time_standards}
      {#if work.skill_time_standards.isUniform}
        <!-- All values are the same, show single value -->
        {formatTimeVerbose(work.skill_time_standards.values[0].standard_time_minutes)}
      {:else}
        <!-- Different values, show them separately -->
        <div class="space-y-1">
          {#each work.skill_time_standards.values as sts}
            <div class="text-xs">
              <span class="font-medium">{sts.skill_short}:</span> {formatTimeVerbose(sts.standard_time_minutes)}
            </div>
          {/each}
        </div>
      {/if}
    {:else}
      N/A
    {/if}
  </td>
  <td class="px-6 py-4 whitespace-nowrap text-sm {isSelected ? (work.time_exceeded ? 'text-gray-900 dark:text-gray-900 font-bold' : 'text-gray-900 dark:text-gray-100') : (work.time_exceeded ? 'text-gray-900 dark:text-gray-900 font-bold' : 'theme-text-primary')}">
    <div>
      <div class="font-medium">
        {work.time_taken ? formatTime(work.time_taken * 60) : '0h 0m'}
      </div>
      {#if work.skill_time_breakdown && Object.keys(work.skill_time_breakdown).length > 0}
        <div class="text-xs theme-text-secondary mt-1">
          {#each Object.entries(work.skill_time_breakdown) as [skill, time]}
            <div class="flex justify-between">
              <span>{skill}:</span>
              <span>{formatTime((time as number) * 60)}</span>
            </div>
          {/each}
        </div>
      {/if}
    </div>
  </td>
  <td class="px-6 py-4 whitespace-nowrap text-sm {isSelected ? (work.time_exceeded ? 'text-gray-900 dark:text-gray-900 font-bold' : 'text-gray-900 dark:text-gray-100') : (work.time_exceeded ? 'text-gray-900 dark:text-gray-900 font-bold' : 'theme-text-primary')}">
    {work.remaining_time ? formatTime(work.remaining_time * 60) : 'N/A'}
    {#if work.time_exceeded}
      <span class="ml-2 text-xs px-2 py-1 rounded-full bg-red-200 text-red-900 dark:bg-red-700 dark:text-red-100 font-bold">
        ⚠️ Exceeded
      </span>
    {/if}
  </td>
  <td class="px-6 py-4 whitespace-nowrap text-sm {isSelected ? 'text-gray-900 dark:text-gray-100' : 'theme-text-primary'}">
    <div class="flex space-x-2">
      <div class="relative group">
        <Button
          variant={planningStatus.canPlan ? "primary" : "secondary"}
          size="sm"
          disabled={!planningStatus.canPlan}
          on:click={onPlanWork}
        >
          {planningStatus.canPlan ? 'Plan' : 'Cannot Plan'}
        </Button>
        {#if !planningStatus.canPlan && planningStatus.reason}
          <div class="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 dark:bg-gray-700 text-white text-xs rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-50 max-w-xs">
            {planningStatus.reason}
            <div class="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1">
              <div class="border-4 border-transparent border-t-gray-900 dark:border-t-gray-700"></div>
            </div>
          </div>
        {/if}
      </div>
      <Button
        variant="secondary"
        size="sm"
        on:click={onViewWork}
      >
        View
      </Button>
      <div class="relative group">
        <Button
          variant="secondary"
          size="sm"
          disabled={!canRemove}
          on:click={onRemoveWork}
        >
          {canRemove ? 'Remove' : 'Cannot Remove'}
        </Button>
        {#if !canRemove && removeReason}
          <div class="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 dark:bg-gray-700 text-white text-xs rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-50 max-w-xs">
            {removeReason}
            <div class="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1">
              <div class="border-4 border-transparent border-t-gray-900 dark:border-t-gray-700"></div>
            </div>
          </div>
        {/if}
      </div>
    </div>
    {#if !planningStatus.canPlan && planningStatus.reason}
      <div class="text-xs text-red-600 dark:text-red-400 mt-1">
        {planningStatus.reason}
      </div>
    {/if}
    {#if !canRemove && removeReason}
      <div class="text-xs text-orange-600 dark:text-orange-400 mt-1">
        {removeReason}
      </div>
    {/if}
  </td>
</tr>

<style>
  :global(.time-exceeded) {
    background-color: rgba(239, 68, 68, 0.1);
  }
</style>

