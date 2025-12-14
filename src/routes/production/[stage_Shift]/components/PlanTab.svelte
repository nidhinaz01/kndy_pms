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
  export let shiftBreakTimes: Array<{ start_time: string; end_time: string }> = [];
  
  // Keep expandedGroups for compatibility but it's no longer used
  export let expandedGroups: string[] = [];
  $: void expandedGroups; // Reference to satisfy linter

  const dispatch = createEventDispatcher();

  $: groupedPlannedWorks = groupPlannedWorks(plannedWorksWithStatus || []);
  // Count unique works (by work code), not individual skill competencies
  $: totalPlans = Object.keys(groupedPlannedWorks).length;

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

  function handleReportWork(group: any) {
    // Report all skill competencies for this work together
    const allWorksInGroup = group.items || [];
    if (allWorksInGroup.length === 0) {
      alert('No works to report');
      return;
    }
    dispatch('reportWork', { works: allWorksInGroup, group });
  }

  function handleCancelWork(group: any) {
    // Cancel all skill competencies for this work
    const allWorksInGroup = group.items || [];
    if (allWorksInGroup.length === 0) {
      alert('No works to cancel');
      return;
    }
    dispatch('cancelWork', { works: allWorksInGroup, group });
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
        💡 <strong class="theme-text-primary">Multi-selection:</strong> You can select multiple skill competencies by checking the checkbox in each row. Each work may have multiple skill competencies shown in the same row.
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
            <th class="px-6 py-3 text-left text-xs font-medium theme-text-secondary uppercase tracking-wider">Worker (Skill)</th>
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
            {@const allSelected = typedGroup.items.every((item: any) => selectedRows.has(item.id))}
            {@const someSelected = typedGroup.items.some((item: any) => selectedRows.has(item.id))}
            {@const isCancelled = typedGroup.items.some((item: any) => item.status === 'cancelled' || item.isCancelled)}
            {@const hasReported = typedGroup.items.some((item: any) => item.workLifecycleStatus && item.workLifecycleStatus !== 'Planned' && item.workLifecycleStatus !== undefined)}
            <!-- Single Row per Work -->
            <tr class="hover:theme-bg-secondary transition-colors">
              <td class="px-6 py-4 whitespace-nowrap text-sm font-medium theme-text-primary">
                <input 
                  type="checkbox" 
                  class="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  checked={allSelected}
                  on:change={(e) => {
                    e.stopPropagation();
                    const target = e.target as HTMLInputElement;
                    if (target?.checked) {
                      selectAllRowsInGroup(typedGroup);
                    } else {
                      // Uncheck all items in the group by toggling each one
                      typedGroup.items.forEach((item: any) => {
                        if (selectedRows.has(item.id)) {
                          toggleRowSelection(item.id);
                        }
                      });
                    }
                  }}
                />
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm font-medium theme-text-primary">{typedGroup.woNo}</td>
              <td class="px-6 py-4 whitespace-nowrap text-sm theme-text-primary">{typedGroup.pwoNo}</td>
              <td class="px-6 py-4 whitespace-nowrap text-sm font-medium theme-text-primary">{typedGroup.workCode}</td>
              <td class="px-6 py-4 text-sm theme-text-primary" style="max-width: 200px; word-wrap: break-word;">{typedGroup.workName}</td>
              <td class="px-6 py-4 whitespace-nowrap text-sm theme-text-primary">
                <div class="flex flex-wrap gap-1">
                  {#each typedGroup.items as plannedWork}
                  <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400">
                      {plannedWork.sc_required || 'N/A'}
                  </span>
                  {/each}
                </div>
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm theme-text-primary">
                {#if typedGroup.items && typedGroup.items.length > 0}
                  {@const firstItem = typedGroup.items[0]}
                  {#if firstItem?.vehicleWorkFlow?.estimated_duration_minutes}
                    {formatTime(firstItem.vehicleWorkFlow.estimated_duration_minutes / 60)}
                  {:else if firstItem?.skillTimeStandard?.standard_time_minutes}
                    {formatTime(firstItem.skillTimeStandard.standard_time_minutes / 60)}
                  {:else}
                    N/A
                  {/if}
                {:else}
                  N/A
                {/if}
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm">
                {#if typedGroup.items && typedGroup.items.length > 0}
                  {@const isCancelled = typedGroup.items.some((item: any) => item.status === 'cancelled' || item.isCancelled)}
                  {@const allReported = typedGroup.items.every((item: any) => item.workLifecycleStatus && item.workLifecycleStatus !== 'Planned')}
                  {@const anyReported = typedGroup.items.some((item: any) => item.workLifecycleStatus && item.workLifecycleStatus !== 'Planned')}
                  {#if isCancelled}
                    <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400">Cancelled</span>
                  {:else if allReported}
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
              <td class="px-6 py-4 text-sm theme-text-primary">
                <div class="space-y-1">
                  {#each typedGroup.items as plannedWork}
                    {@const empName = plannedWork.hr_emp?.emp_name || 'N/A'}
                    {@const skillShort = plannedWork.hr_emp?.skill_short || 'N/A'}
                    <div class="font-medium">{empName} ({skillShort})</div>
                  {/each}
                </div>
              </td>
              <td class="px-6 py-4 text-sm theme-text-primary">
                <div class="space-y-1">
              {#each typedGroup.items as plannedWork}
                    <div>{plannedWork.from_time || 'N/A'}</div>
                  {/each}
                </div>
                  </td>
              <td class="px-6 py-4 text-sm theme-text-primary">
                <div class="space-y-1">
                  {#each typedGroup.items as plannedWork}
                    <div>{plannedWork.to_time || 'N/A'}</div>
                  {/each}
                </div>
                  </td>
              <td class="px-6 py-4 text-sm theme-text-primary">
                <div class="space-y-1">
                  {#each typedGroup.items as plannedWork}
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
                  {/each}
                    </div>
                  </td>
              <td class="px-6 py-4 text-sm theme-text-primary">
                <div class="space-y-1">
                  {#each typedGroup.items as plannedWork}
                      <div class="font-medium">
                        {plannedWork.time_worked_till_date ? formatTime(plannedWork.time_worked_till_date) : '0h 0m'}
                      </div>
                  {/each}
                    </div>
                  </td>
              <td class="px-6 py-4 text-sm theme-text-primary">
                <div class="space-y-1">
                  {#each typedGroup.items as plannedWork}
                      <div class="font-medium">
                        {plannedWork.remaining_time ? formatTime(plannedWork.remaining_time) : 'N/A'}
                      </div>
                  {/each}
                    </div>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm theme-text-primary">
                    <div class="flex space-x-2">
                      <Button 
                        variant="primary" 
                        size="sm" 
                    disabled={isCancelled || hasReported}
                    on:click={() => handleReportWork(typedGroup)}
                      >
                        Report
                      </Button>
                  <Button 
                    variant="danger" 
                    size="sm" 
                    disabled={isCancelled || hasReported}
                    on:click={() => handleCancelWork(typedGroup)}
                  >
                    Cancel
                  </Button>
                    </div>
                  </td>
                </tr>
          {/each}
        </tbody>
      </table>
    </div>
    
    <!-- Summary -->
    <div class="px-6 py-4 theme-bg-secondary border-t theme-border">
      <div class="flex flex-wrap gap-4 text-sm">
        <div class="theme-text-secondary">
          <span class="font-medium">Total Planned Works:</span> {totalPlans}
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

