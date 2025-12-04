<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import Button from '$lib/components/common/Button.svelte';
  import { formatTime, calculateBreakTimeInRange } from '../utils/timeUtils';
  import { groupPlannedWorks, areAllSkillsReported, hasReportedSkillsSelected } from '../utils/planTabUtils';

  export let plannedWorksData: any[] = [];
  export let plannedWorksWithStatus: any[] = [];
  export let isLoading: boolean = false;
  export let stageCode: string = '';
  export let selectedDate: string = '';
  export let selectedRows: Set<string> = new Set();
  export let expandedGroups: string[] = [];
  export let shiftBreakTimes: Array<{ start_time: string; end_time: string }> = [];

  const dispatch = createEventDispatcher();

  $: groupedPlannedWorks = groupPlannedWorks(plannedWorksWithStatus || []);

  function handleRefresh() {
    dispatch('refresh');
  }

  function handleGenerateExcel() {
    dispatch('generateExcel');
  }

  function handleGeneratePDF() {
    dispatch('generatePDF');
  }

  function handleMultiReport() {
    dispatch('multiReport');
  }

  function handleMultiDelete() {
    dispatch('multiDelete');
  }

  function handleReportWork(work: any) {
    dispatch('reportWork', work);
  }

  function handleDeletePlan(work: any) {
    dispatch('deletePlan', work);
  }

  function toggleGroup(workCode: string) {
    dispatch('toggleGroup', workCode);
  }

  function toggleRowSelection(rowId: string) {
    dispatch('toggleRowSelection', rowId);
  }

  function selectAllRowsInGroup(group: any) {
    dispatch('selectAllInGroup', group);
  }

  function clearAllSelections() {
    dispatch('clearSelections');
  }

  function isGroupExpanded(workCode: string): boolean {
    return expandedGroups.includes(workCode);
  }

  $: selectedWorks = plannedWorksWithStatus.filter(work => selectedRows.has(work.id));
  $: workCodes = [...new Set(selectedWorks.map(work => 
    work.std_work_type_details?.derived_sw_code || work.std_work_type_details?.sw_code
  ))];
  $: workCode = workCodes.length === 1 ? workCodes[0] : null;
  $: allReported = workCode ? areAllSkillsReported(workCode, plannedWorksWithStatus) : false;
  $: hasReported = hasReportedSkillsSelected(selectedRows, plannedWorksWithStatus);
</script>

<div class="theme-bg-primary rounded-lg shadow border theme-border">
  <div class="p-6 border-b theme-border">
    <div class="flex items-center justify-between mb-4">
      <div>
        <h2 class="text-xl font-semibold theme-text-primary">📋 Work Planning</h2>
        <p class="theme-text-secondary mt-1">
          Planned works for {stageCode} stage on {new Date(selectedDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' })}
        </p>
      </div>
      <div class="flex items-center space-x-3">
        <Button variant="secondary" size="sm" on:click={handleRefresh} disabled={isLoading}>
          {isLoading ? 'Loading...' : 'Refresh'}
        </Button>
        <Button variant="primary" size="sm" on:click={handleGenerateExcel} disabled={plannedWorksWithStatus.length === 0}>
          Generate Excel
        </Button>
        <Button variant="primary" size="sm" on:click={handleGeneratePDF} disabled={plannedWorksWithStatus.length === 0}>
          Generate PDF
        </Button>
      </div>
    </div>
  </div>
  
  {#if isLoading}
    <div class="flex items-center justify-center py-12">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mr-3"></div>
      <span class="theme-text-secondary">Loading planned works...</span>
    </div>
  {:else if plannedWorksData.length === 0}
    <div class="text-center py-12">
      <div class="text-6xl mb-4">📋</div>
      <p class="theme-text-secondary text-lg">No planned works for this date</p>
      <p class="theme-text-secondary text-sm mt-2">
        Go to the Works tab to plan works for this date
      </p>
    </div>
  {:else}
    <!-- Multi-report controls -->
    {#if selectedRows.size > 0}
      <div class="px-6 py-3 border-b theme-border bg-blue-50 dark:bg-blue-900/20">
        <div class="flex items-center justify-between">
          <div class="flex items-center space-x-4">
            <span class="text-sm theme-text-primary">
              {selectedRows.size} skill competency{selectedRows.size === 1 ? '' : 'ies'} selected
            </span>
            <Button 
              variant="primary" 
              size="sm" 
              on:click={handleMultiReport}
              disabled={allReported || hasReported}
            >
              Report Selected Skills ({selectedRows.size})
            </Button>
            <Button 
              variant="secondary" 
              size="sm" 
              on:click={handleMultiDelete}
            >
              Delete Selected Skills ({selectedRows.size})
            </Button>
            {#if allReported}
              <span class="text-xs text-orange-600 dark:text-orange-400">
                All skill competencies for this work have been reported
              </span>
            {:else if hasReported}
              <span class="text-xs text-orange-600 dark:text-orange-400">
                Some selected skills are already reported
              </span>
            {/if}
          </div>
          <Button variant="secondary" size="sm" on:click={clearAllSelections}>
            Clear Selection
          </Button>
        </div>
      </div>
    {/if}
    
    <!-- Selection instructions -->
    <div class="px-6 py-2 theme-bg-secondary border-b theme-border">
      <p class="text-xs theme-text-primary">
        💡 <strong class="theme-text-primary">Multi-selection:</strong> You can select multiple skill competencies from the same work by expanding the group and checking individual skill rows. 
        Selecting skills from different works will clear previous selections.
      </p>
    </div>
    
    <div class="overflow-x-auto">
      <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700" style="table-layout: auto; word-wrap: break-word;">
        <thead class="theme-bg-secondary">
          <tr>
            <th class="px-6 py-3 text-left text-xs font-medium theme-text-secondary uppercase tracking-wider">Select</th>
            <th class="px-6 py-3 text-left text-xs font-medium theme-text-secondary uppercase tracking-wider">Work Order</th>
            <th class="px-6 py-3 text-left text-xs font-medium theme-text-secondary uppercase tracking-wider">PWO Number</th>
            <th class="px-6 py-3 text-left text-xs font-medium theme-text-secondary uppercase tracking-wider">Work Code</th>
            <th class="px-6 py-3 text-left text-xs font-medium theme-text-secondary uppercase tracking-wider" style="max-width: 200px; width: 200px;">Work Name</th>
            <th class="px-6 py-3 text-left text-xs font-medium theme-text-secondary uppercase tracking-wider">Skills Required</th>
            <th class="px-6 py-3 text-left text-xs font-medium theme-text-secondary uppercase tracking-wider">Standard Time</th>
            <th class="px-6 py-3 text-left text-xs font-medium theme-text-secondary uppercase tracking-wider">Status</th>
            <th class="px-6 py-3 text-left text-xs font-medium theme-text-secondary uppercase tracking-wider">Worker</th>
            <th class="px-6 py-3 text-left text-xs font-medium theme-text-secondary uppercase tracking-wider">Skill Competency of Worker</th>
            <th class="px-6 py-3 text-left text-xs font-medium theme-text-secondary uppercase tracking-wider">From Time</th>
            <th class="px-6 py-3 text-left text-xs font-medium theme-text-secondary uppercase tracking-wider">To Time</th>
            <th class="px-6 py-3 text-left text-xs font-medium theme-text-secondary uppercase tracking-wider">Planned Hours</th>
            <th class="px-6 py-3 text-left text-xs font-medium theme-text-secondary uppercase tracking-wider">Time Worked Till Date</th>
            <th class="px-6 py-3 text-left text-xs font-medium theme-text-secondary uppercase tracking-wider">Remaining Time</th>
            <th class="px-6 py-3 text-left text-xs font-medium theme-text-secondary uppercase tracking-wider">Actions</th>
          </tr>
        </thead>
        <tbody class="theme-bg-primary divide-y divide-gray-200 dark:divide-gray-700">
          {#each Object.values(groupedPlannedWorks) as group}
            {@const typedGroup = group}
            <!-- Group Header Row -->
            <tr class="hover:theme-bg-secondary transition-colors cursor-pointer" on:click={(e) => { e.preventDefault(); toggleGroup(typedGroup.workCode); }}>
              <td class="px-6 py-4 whitespace-nowrap text-sm font-medium theme-text-primary" on:click|stopPropagation>
                <input 
                  type="checkbox" 
                  class="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  checked={typedGroup.items.every(item => selectedRows.has(item.id))}
                  on:change={(e) => {
                    e.stopPropagation();
                    const target = e.target as HTMLInputElement;
                    if (target?.checked) {
                      selectAllRowsInGroup(typedGroup);
                    } else {
                      typedGroup.items.forEach(item => selectedRows.delete(item.id));
                      selectedRows = new Set(selectedRows);
                    }
                  }}
                />
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm font-medium theme-text-primary">{typedGroup.woNo}</td>
              <td class="px-6 py-4 whitespace-nowrap text-sm theme-text-primary">{typedGroup.pwoNo}</td>
              <td class="px-6 py-4 whitespace-nowrap text-sm font-medium theme-text-primary">{typedGroup.workCode}</td>
              <td class="px-6 py-4 text-sm theme-text-primary" style="max-width: 200px; word-wrap: break-word;">{typedGroup.workName}</td>
              <td class="px-6 py-4 whitespace-nowrap text-sm theme-text-primary">
                {#if typedGroup.items && typedGroup.items.length > 0}
                  {@const firstItem = typedGroup.items[0]}
                  {@const skillMapping = firstItem?.skillMapping || firstItem?.std_work_skill_mapping}
                  {@const skillCompetency = skillMapping?.sc_name || (firstItem?.sc_required || 'N/A')}
                  <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400">
                    {skillCompetency}
                  </span>
                {:else}
                  <span class="text-gray-400">N/A</span>
                {/if}
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm theme-text-primary">
                {#if typedGroup.items && typedGroup.items.length > 0}
                  {@const firstItem = typedGroup.items[0]}
                  {firstItem?.vehicleWorkFlow?.estimated_duration_minutes ? formatTime(firstItem.vehicleWorkFlow.estimated_duration_minutes / 60) : 'N/A'}
                {:else}
                  N/A
                {/if}
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm">
                {#if typedGroup.items && typedGroup.items.length > 0}
                  {@const allReported = typedGroup.items.every(item => item.workLifecycleStatus && item.workLifecycleStatus !== 'Planned')}
                  {@const anyReported = typedGroup.items.some(item => item.workLifecycleStatus && item.workLifecycleStatus !== 'Planned')}
                  {#if allReported}
                    <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400">Reported</span>
                  {:else if anyReported}
                    <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400">Partially Reported</span>
                  {:else}
                    <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400">Planned</span>
                  {/if}
                {:else}
                  <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400">Planned</span>
                {/if}
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm theme-text-primary" colspan="6">
                <div class="text-xs theme-text-secondary">
                  Click to {isGroupExpanded(typedGroup.workCode) ? 'collapse' : 'expand'} skill details
                </div>
              </td>
            </tr>
            
            <!-- Individual Skill Rows (when expanded) -->
            {#if isGroupExpanded(typedGroup.workCode)}
              {#each typedGroup.items as plannedWork}
                <tr class="hover:theme-bg-secondary transition-colors theme-bg-secondary/30">
                  <td class="px-6 py-4 whitespace-nowrap text-sm font-medium theme-text-primary">
                    <input 
                      type="checkbox" 
                      class="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      checked={selectedRows.has(plannedWork.id)}
                      on:change={(e) => {
                        e.stopPropagation();
                        toggleRowSelection(plannedWork.id);
                      }}
                    />
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm theme-text-primary">{typedGroup.woNo}</td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm theme-text-primary">{typedGroup.pwoNo}</td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm font-medium theme-text-primary">{typedGroup.workCode}</td>
                  <td class="px-6 py-4 text-sm theme-text-primary" style="max-width: 200px; word-wrap: break-word;">{typedGroup.workName}</td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm theme-text-primary">
                    <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400">
                      {plannedWork.sc_required || 'N/A'}
                    </span>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm theme-text-primary">
                    {plannedWork?.vehicleWorkFlow?.estimated_duration_minutes ? formatTime(plannedWork.vehicleWorkFlow.estimated_duration_minutes / 60) : 'N/A'}
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm">
                    {#if plannedWork.workLifecycleStatus === 'Planned' || !plannedWork.workLifecycleStatus}
                      <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400">Planned</span>
                    {:else}
                      <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400">Reported</span>
                    {/if}
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm theme-text-primary">
                    <div class="font-medium">{plannedWork.hr_emp?.emp_name || 'N/A'}</div>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm theme-text-primary">
                    <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400">
                      {plannedWork.hr_emp?.skill_short || 'N/A'}
                    </span>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm theme-text-primary">{plannedWork.from_time || 'N/A'}</td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm theme-text-primary">{plannedWork.to_time || 'N/A'}</td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm theme-text-primary">
                    <div>
                      <div class="font-medium">
                        {#if plannedWork.from_time && plannedWork.to_time}
                          {@const calculatedHours = (() => {
                            try {
                              const from = new Date(`2000-01-01T${plannedWork.from_time}`);
                              const to = new Date(`2000-01-01T${plannedWork.to_time}`);
                              if (to < from) to.setDate(to.getDate() + 1);
                              const diffMs = to.getTime() - from.getTime();
                              const totalHours = diffMs / (1000 * 60 * 60);
                              const breakMinutes = calculateBreakTimeInRange(plannedWork.from_time, plannedWork.to_time, shiftBreakTimes);
                              const breakHours = breakMinutes / 60;
                              const plannedHours = totalHours - breakHours;
                              return Math.max(0, plannedHours);
                            } catch {
                              return 0;
                            }
                          })()}
                          {formatTime(calculatedHours)}
                        {:else if plannedWork.planned_hours}
                          {formatTime(plannedWork.planned_hours)}
                        {:else}
                          N/A
                        {/if}
                      </div>
                      {#if plannedWork.skillTimeStandard}
                        <div class="text-xs theme-text-secondary">
                          Standard: {formatTime(plannedWork.skillTimeStandard.standard_time_minutes / 60)}
                        </div>
                      {/if}
                    </div>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm theme-text-primary">
                    <div>
                      <div class="font-medium">
                        {plannedWork.time_worked_till_date ? formatTime(plannedWork.time_worked_till_date) : '0h 0m'}
                      </div>
                      {#if plannedWork.skillTimeStandard}
                        <div class="text-xs theme-text-secondary">
                          Skill: {plannedWork.hr_emp?.skill_short || 'N/A'}
                        </div>
                      {/if}
                    </div>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm theme-text-primary">
                    <div>
                      <div class="font-medium">
                        {plannedWork.remaining_time ? formatTime(plannedWork.remaining_time) : 'N/A'}
                      </div>
                      {#if plannedWork.skillTimeStandard}
                        <div class="text-xs theme-text-secondary">
                          Skill Remaining: {formatTime(plannedWork.remainingTimeMinutes / 60)}
                        </div>
                      {/if}
                    </div>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm theme-text-primary">
                    <div class="flex space-x-2">
                      <Button 
                        variant="primary" 
                        size="sm" 
                        disabled={plannedWork.workLifecycleStatus !== 'Planned'}
                        on:click={() => handleReportWork(plannedWork)}
                      >
                        Report
                      </Button>
                      <Button 
                        variant="danger" 
                        size="sm" 
                        disabled={plannedWork.status === 'submitted'}
                        on:click={() => handleDeletePlan(plannedWork)}
                      >
                        Delete
                      </Button>
                    </div>
                  </td>
                </tr>
              {/each}
            {/if}
          {/each}
        </tbody>
      </table>
    </div>
    
    <!-- Summary -->
    <div class="px-6 py-4 theme-bg-secondary border-t theme-border">
      <div class="flex flex-wrap gap-4 text-sm">
        <div class="theme-text-secondary">
          <span class="font-medium">Total Planned Works:</span> {plannedWorksWithStatus.length}
        </div>
        <div class="theme-text-secondary">
          <span class="font-medium">Total Planned Hours:</span> {plannedWorksWithStatus.reduce((sum, work) => {
            let plannedHours = work.planned_hours || 0;
            if (plannedHours === 0 && work.from_time && work.to_time) {
              const from = new Date(`2000-01-01T${work.from_time}`);
              const to = new Date(`2000-01-01T${work.to_time}`);
              if (to < from) to.setDate(to.getDate() + 1);
              const totalHours = (to.getTime() - from.getTime()) / (1000 * 60 * 60);
              const breakMinutes = calculateBreakTimeInRange(work.from_time, work.to_time, shiftBreakTimes);
              const breakHours = breakMinutes / 60;
              plannedHours = totalHours - breakHours;
            } else if (plannedHours > 0 && work.from_time && work.to_time) {
              const from = new Date(`2000-01-01T${work.from_time}`);
              const to = new Date(`2000-01-01T${work.to_time}`);
              if (to < from) to.setDate(to.getDate() + 1);
              const totalHours = (to.getTime() - from.getTime()) / (1000 * 60 * 60);
              const breakMinutes = calculateBreakTimeInRange(work.from_time, work.to_time, shiftBreakTimes);
              const breakHours = breakMinutes / 60;
              plannedHours = totalHours - breakHours;
            }
            return sum + Math.max(0, plannedHours);
          }, 0).toFixed(1)}h
        </div>
        <div class="theme-text-secondary">
          <span class="font-medium">Total Time Worked:</span> {formatTime(plannedWorksWithStatus.reduce((sum, work) => sum + (work.time_worked_till_date || 0), 0))}
        </div>
        <div class="theme-text-secondary">
          <span class="font-medium">Total Remaining:</span> {formatTime(plannedWorksWithStatus.reduce((sum, work) => sum + (work.remaining_time || 0), 0))}
        </div>
        <div class="theme-text-secondary">
          <span class="font-medium">Planned:</span> {plannedWorksWithStatus.filter(work => work.workLifecycleStatus === 'Planned').length}
        </div>
        <div class="theme-text-secondary">
          <span class="font-medium">In Progress:</span> {plannedWorksWithStatus.filter(work => work.workLifecycleStatus === 'In progress').length}
        </div>
        <div class="theme-text-secondary">
          <span class="font-medium">Completed:</span> {plannedWorksWithStatus.filter(work => work.workLifecycleStatus === 'Completed').length}
        </div>
        <div class="theme-text-secondary">
          <span class="font-medium">To Redo:</span> {plannedWorksData.filter(work => work.status === 'to_redo').length}
        </div>
        <div class="theme-text-secondary">
          <span class="font-medium">Approved:</span> {plannedWorksData.filter(work => work.status === 'approved').length}
        </div>
      </div>
    </div>
  {/if}
</div>

