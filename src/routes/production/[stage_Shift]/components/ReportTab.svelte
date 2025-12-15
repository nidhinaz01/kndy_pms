<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import Button from '$lib/components/common/Button.svelte';
  import { formatTime, formatLostTimeDetails } from '../utils/timeUtils';
  import { groupReportWorks } from '../utils/planTabUtils';
  import { filterGroupedWorksBySearch } from '../utils/productionTabSearchUtils';
  import { formatDateTimeLocal } from '$lib/utils/formatDate';

  export let reportData: any[] = [];
  export let isLoading: boolean = false;
  export let stageCode: string = '';
  export let selectedDate: string = '';
  export let expandedReportGroups: string[] = []; // Keep for backward compatibility but not used

  const dispatch = createEventDispatcher();

  let searchTerm = '';

  $: groupedReportWorks = groupReportWorks(reportData);
  $: filteredGroupedReportWorks = filterGroupedWorksBySearch(groupedReportWorks, searchTerm);
  $: totalReports = reportData.length;

  function handleRefresh() {
    dispatch('refresh');
  }

  function handleGenerateExcel() {
    dispatch('generateExcel');
  }

  function handleGeneratePDF() {
    dispatch('generatePDF');
  }

  function getUniqueSkills(items: any[]): string {
    if (!items || items.length === 0) return 'N/A';
    const skills = items
      .map(report => report.skillMapping?.sc_name || report.prdn_work_planning?.std_work_skill_mapping?.sc_name || report.prdn_work_planning?.sc_required || 'N/A')
      .filter((skill, index, arr) => arr.indexOf(skill) === index); // Get unique values
    return skills.join(', ');
  }
</script>

<div class="theme-bg-primary rounded-lg shadow border theme-border p-6">
  <div class="flex items-center justify-between mb-4">
    <div>
      <h2 class="text-xl font-semibold theme-text-primary">📊 Work Reporting</h2>
      <p class="text-sm theme-text-secondary mt-1">
        Reported works for {stageCode} stage on {new Date(selectedDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' })}
      </p>
    </div>
    <div class="flex items-center space-x-3">
      <Button variant="secondary" size="sm" on:click={handleRefresh} disabled={isLoading}>
        {isLoading ? 'Loading...' : 'Refresh'}
      </Button>
      <Button variant="primary" size="sm" on:click={handleGenerateExcel} disabled={reportData.length === 0}>
        Generate Excel
      </Button>
      <Button variant="primary" size="sm" on:click={handleGeneratePDF} disabled={reportData.length === 0}>
        Generate PDF
      </Button>
    </div>
    <!-- Search Box -->
    <div class="mt-4">
      <input
        type="text"
        bind:value={searchTerm}
        placeholder="Search by work code, work name, WO number, PWO number, worker, or skill..."
        class="w-full px-4 py-2 border theme-border rounded-lg theme-bg-primary theme-text-primary focus:ring-2 focus:ring-blue-500 focus:border-transparent"
      />
    </div>
  </div>

  {#if isLoading}
    <div class="text-center py-12">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div>
      <p class="theme-text-secondary">Loading work reports...</p>
    </div>
  {:else if reportData.length === 0}
    <div class="text-center py-12">
      <div class="text-6xl mb-4">📊</div>
      <p class="theme-text-secondary text-lg">No work reports found for this date</p>
      <p class="theme-text-secondary text-sm mt-2">
        Work reports will appear here after work is reported from the Plan tab
      </p>
    </div>
  {:else}
    <!-- Report Data Table -->
    <div class="overflow-x-auto">
      <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700" style="table-layout: fixed; width: 100%;">
        <thead class="theme-bg-secondary">
          <tr>
            <th class="px-4 py-3 text-left text-xs font-medium theme-text-secondary uppercase tracking-wider" style="width: 100px;">Work Order</th>
            <th class="px-4 py-3 text-left text-xs font-medium theme-text-secondary uppercase tracking-wider" style="width: 120px;">PWO Number</th>
            <th class="px-4 py-3 text-left text-xs font-medium theme-text-secondary uppercase tracking-wider" style="width: 120px;">Work Code</th>
            <th class="px-4 py-3 text-left text-xs font-medium theme-text-secondary uppercase tracking-wider" style="width: 250px;">Work Name</th>
            <th class="px-4 py-3 text-left text-xs font-medium theme-text-secondary uppercase tracking-wider" style="width: 180px;">Skills Required</th>
            <th class="px-4 py-3 text-left text-xs font-medium theme-text-secondary uppercase tracking-wider" style="width: 120px;">Standard Time</th>
            <th class="px-4 py-3 text-left text-xs font-medium theme-text-secondary uppercase tracking-wider" style="width: 120px;">Status</th>
            <th class="px-4 py-3 text-left text-xs font-medium theme-text-secondary uppercase tracking-wider" style="width: 180px;">Worker (Skill)</th>
            <th class="px-4 py-3 text-left text-xs font-medium theme-text-secondary uppercase tracking-wider" style="width: 140px;">Time Worked Till Date</th>
            <th class="px-4 py-3 text-left text-xs font-medium theme-text-secondary uppercase tracking-wider" style="width: 100px;">From Time</th>
            <th class="px-4 py-3 text-left text-xs font-medium theme-text-secondary uppercase tracking-wider" style="width: 100px;">To Time</th>
            <th class="px-4 py-3 text-left text-xs font-medium theme-text-secondary uppercase tracking-wider" style="width: 140px;">Hours Worked</th>
            <th class="px-4 py-3 text-left text-xs font-medium theme-text-secondary uppercase tracking-wider" style="width: 140px;">Total Hours Worked</th>
            <th class="px-4 py-3 text-left text-xs font-medium theme-text-secondary uppercase tracking-wider" style="width: 120px;">OT Hours</th>
            <th class="px-4 py-3 text-left text-xs font-medium theme-text-secondary uppercase tracking-wider" style="width: 120px;">Lost Time</th>
            <th class="px-4 py-3 text-left text-xs font-medium theme-text-secondary uppercase tracking-wider" style="width: 200px;">Reason</th>
            <th class="px-4 py-3 text-left text-xs font-medium theme-text-secondary uppercase tracking-wider" style="width: 150px;">Reported On</th>
          </tr>
        </thead>
        <tbody class="theme-bg-primary divide-y divide-gray-200 dark:divide-gray-700">
          {#each Object.values(filteredGroupedReportWorks) as group (group.workCode)}
            {@const typedGroup = group}
            <!-- Single Row per Work -->
            <tr class="hover:theme-bg-secondary transition-colors" 
                class:lost-time={typedGroup.hasLostTime}>
              <td class="px-4 py-2 whitespace-nowrap text-sm font-medium {typedGroup.hasLostTime ? 'text-gray-800' : 'theme-text-primary'}">
                {typedGroup.woNo}
              </td>
              <td class="px-4 py-2 whitespace-nowrap text-sm {typedGroup.hasLostTime ? 'text-gray-800' : 'theme-text-primary'}">
                {typedGroup.pwoNo}
              </td>
              <td class="px-4 py-2 whitespace-nowrap text-sm font-medium {typedGroup.hasLostTime ? 'text-gray-800' : 'theme-text-primary'}">
                {typedGroup.workCode}
              </td>
              <td class="px-4 py-2 text-sm {typedGroup.hasLostTime ? 'text-gray-800' : 'theme-text-primary'}" style="word-wrap: break-word;">
                {typedGroup.workName}
              </td>
              <td class="px-4 py-2 text-sm {typedGroup.hasLostTime ? 'text-gray-800' : 'theme-text-primary'}">
                {getUniqueSkills(typedGroup.items)}
              </td>
              <td class="px-4 py-2 whitespace-nowrap text-sm {typedGroup.hasLostTime ? 'text-gray-800' : 'theme-text-primary'}">
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
              <td class="px-4 py-2 text-sm">
                {#if typedGroup.items && typedGroup.items.length > 0}
                  {@const allCompleted = typedGroup.items.every(item => item.completion_status === 'C')}
                  {@const anyNotCompleted = typedGroup.items.some(item => item.completion_status === 'NC')}
                  {#if allCompleted}
                    <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400">Completed</span>
                  {:else if anyNotCompleted}
                    <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400">Not Completed</span>
                  {:else}
                    <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300">Unknown</span>
                  {/if}
                {:else}
                  <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300">Unknown</span>
                {/if}
              </td>
              <td class="px-4 py-2 text-sm {typedGroup.hasLostTime ? 'text-gray-800' : 'theme-text-primary'}">
                <div class="flex flex-col gap-0.5">
                  {#each typedGroup.items as report}
                    <div class="text-xs">
                      {#if report.deviations && report.deviations.length > 0}
                        {@const deviation = report.deviations[0]}
                        <div class="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400">
                          ⚠️ {deviation.deviation_type}
                        </div>
                        <div class="mt-0.5 text-xs text-orange-600 dark:text-orange-400 truncate" title={deviation.reason}>
                          {deviation.reason}
                        </div>
                      {:else if report.worker_id && report.prdn_work_planning?.hr_emp}
                        <div class="font-medium">
                          {report.prdn_work_planning.hr_emp.emp_name || 'N/A'}
                        </div>
                        <div class="text-xs theme-text-secondary">
                          ({report.prdn_work_planning.hr_emp.skill_short || 'N/A'})
                        </div>
                      {:else}
                        <span class="theme-text-secondary">N/A</span>
                      {/if}
                    </div>
                  {/each}
                </div>
              </td>
              <td class="px-4 py-2 text-sm {typedGroup.hasLostTime ? 'text-gray-800' : 'theme-text-primary'}">
                <div class="flex flex-col gap-0.5">
                  {#each typedGroup.items as report}
                    <div class="text-xs">
                      {formatTime(report.hours_worked_till_date || 0)}
                    </div>
                  {/each}
                </div>
              </td>
              <td class="px-4 py-2 text-sm {typedGroup.hasLostTime ? 'text-gray-800' : 'theme-text-primary'}">
                <div class="flex flex-col gap-0.5">
                  {#each typedGroup.items as report}
                    <div class="text-xs">{report.from_time || 'N/A'}</div>
                  {/each}
                </div>
              </td>
              <td class="px-4 py-2 text-sm {typedGroup.hasLostTime ? 'text-gray-800' : 'theme-text-primary'}">
                <div class="flex flex-col gap-0.5">
                  {#each typedGroup.items as report}
                    <div class="text-xs">{report.to_time || 'N/A'}</div>
                  {/each}
                </div>
              </td>
              <td class="px-4 py-2 text-sm {typedGroup.hasLostTime ? 'text-gray-800' : 'theme-text-primary'}">
                <div class="flex flex-col gap-0.5">
                  {#each typedGroup.items as report}
                    <div class="text-xs">
                      <div class="font-medium">
                        {formatTime(report.hours_worked_today || 0)}
                      </div>
                      {#if report.skillTimeStandard}
                        <div class="text-xs {report.lt_minutes_total > 0 ? 'text-gray-600' : 'theme-text-secondary'}">
                          Std: {formatTime(report.skillTimeStandard.standard_time_minutes / 60)}
                        </div>
                        <div class="text-xs {report.lt_minutes_total > 0 ? 'text-gray-600' : 'theme-text-secondary'}">
                          Rem: {formatTime(report.remainingTimeMinutes / 60)}
                        </div>
                      {/if}
                    </div>
                  {/each}
                </div>
              </td>
              <td class="px-4 py-2 text-sm {typedGroup.hasLostTime ? 'text-gray-800' : 'theme-text-primary'}">
                <div class="flex flex-col gap-0.5">
                  {#each typedGroup.items as report}
                    <div class="text-xs font-medium">
                      {formatTime((report.hours_worked_till_date || 0) + (report.hours_worked_today || 0))}
                    </div>
                  {/each}
                </div>
              </td>
              <td class="px-4 py-2 text-sm {typedGroup.hasLostTime ? 'text-gray-800' : 'theme-text-primary'}">
                <div class="flex flex-col gap-0.5">
                  {#each typedGroup.items as report}
                    <div class="text-xs">
                      {#if report.overtime_minutes && report.overtime_minutes > 0}
                        <span class="text-orange-600 dark:text-orange-400 font-medium">
                          {formatTime((report.overtime_minutes || 0) / 60)}
                        </span>
                      {:else}
                        <span class="theme-text-secondary">-</span>
                      {/if}
                    </div>
                  {/each}
                </div>
              </td>
              <td class="px-4 py-2 text-sm {typedGroup.hasLostTime ? 'text-gray-800' : 'theme-text-primary'}">
                <div class="flex flex-col gap-0.5">
                  {#each typedGroup.items as report}
                    <div class="text-xs">
                      {#if report.lt_minutes_total > 0}
                        <span class="text-yellow-600 dark:text-yellow-400 font-medium">
                          {report.lt_minutes_total}m
                        </span>
                      {:else}
                        <span class="text-green-600 dark:text-green-400">-</span>
                      {/if}
                    </div>
                  {/each}
                </div>
              </td>
              <td class="px-4 py-2 text-sm {typedGroup.hasLostTime ? 'text-gray-800' : 'theme-text-primary'}">
                <div class="flex flex-col gap-0.5">
                  {#each typedGroup.items as report}
                    <div class="text-xs truncate" title={report.lt_details && Array.isArray(report.lt_details) && report.lt_details.length > 0 ? formatLostTimeDetails(report.lt_details) : ''}>
                      {#if report.lt_details && Array.isArray(report.lt_details) && report.lt_details.length > 0}
                        {formatLostTimeDetails(report.lt_details)}
                      {:else if report.lt_minutes_total > 0}
                        <span class="theme-text-secondary">N/A</span>
                      {:else}
                        <span class="theme-text-secondary">-</span>
                      {/if}
                    </div>
                  {/each}
                </div>
              </td>
              <td class="px-4 py-2 text-sm {typedGroup.hasLostTime ? 'text-gray-800' : 'theme-text-primary'}">
                <div class="flex flex-col gap-0.5">
                  {#each typedGroup.items as report}
                    <div class="text-xs">
                      {formatDateTimeLocal(report.created_dt)}
                    </div>
                  {/each}
                </div>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>

    <!-- Summary -->
    <div class="mt-6 px-6 py-4 theme-bg-secondary border-t theme-border">
      <div class="flex flex-wrap gap-4 text-sm">
        <div class="theme-text-secondary">
          <span class="font-medium">Total Reports:</span> {reportData.length}
        </div>
        <div class="theme-text-secondary">
          <span class="font-medium">Completed:</span> {reportData.filter(r => r.completion_status === 'C').length}
        </div>
        <div class="theme-text-secondary">
          <span class="font-medium">Not Completed:</span> {reportData.filter(r => r.completion_status === 'NC').length}
        </div>
        <div class="theme-text-secondary">
          <span class="font-medium">Total Lost Time:</span> {reportData.reduce((sum, r) => sum + (r.lt_minutes_total || 0), 0)} minutes
        </div>
      </div>
    </div>
  {/if}
</div>

