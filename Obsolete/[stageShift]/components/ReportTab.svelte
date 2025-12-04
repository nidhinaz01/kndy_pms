<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import Button from '$lib/components/common/Button.svelte';
  import { formatTime, formatLostTimeDetails } from '../utils/timeUtils';
  import { groupReportWorks } from '../utils/planTabUtils';
  import { formatDateTimeLocal } from '$lib/utils/formatDate';

  export let reportData: any[] = [];
  export let isLoading: boolean = false;
  export let stageCode: string = '';
  export let selectedDate: string = '';
  export let expandedReportGroups: string[] = [];

  const dispatch = createEventDispatcher();

  $: groupedReportWorks = groupReportWorks(reportData);

  function handleRefresh() {
    dispatch('refresh');
  }

  function handleGenerateExcel() {
    dispatch('generateExcel');
  }

  function handleGeneratePDF() {
    dispatch('generatePDF');
  }

  function toggleReportGroup(workCode: string) {
    dispatch('toggleGroup', workCode);
  }

  function isReportGroupExpanded(workCode: string): boolean {
    return expandedReportGroups.includes(workCode);
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
      <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
        <thead class="theme-bg-secondary">
          <tr>
            <th class="px-6 py-3 text-left text-xs font-medium theme-text-secondary uppercase tracking-wider">Work Order</th>
            <th class="px-6 py-3 text-left text-xs font-medium theme-text-secondary uppercase tracking-wider">PWO Number</th>
            <th class="px-6 py-3 text-left text-xs font-medium theme-text-secondary uppercase tracking-wider">Work Code</th>
            <th class="px-6 py-3 text-left text-xs font-medium theme-text-secondary uppercase tracking-wider">Work Name</th>
            <th class="px-6 py-3 text-left text-xs font-medium theme-text-secondary uppercase tracking-wider">Skills Required</th>
            <th class="px-6 py-3 text-left text-xs font-medium theme-text-secondary uppercase tracking-wider">Standard Time</th>
            <th class="px-6 py-3 text-left text-xs font-medium theme-text-secondary uppercase tracking-wider">Status</th>
            <th class="px-6 py-3 text-left text-xs font-medium theme-text-secondary uppercase tracking-wider">Worker</th>
            <th class="px-6 py-3 text-left text-xs font-medium theme-text-secondary uppercase tracking-wider">Time Worked Till Date</th>
            <th class="px-6 py-3 text-left text-xs font-medium theme-text-secondary uppercase tracking-wider">From Time</th>
            <th class="px-6 py-3 text-left text-xs font-medium theme-text-secondary uppercase tracking-wider">To Time</th>
            <th class="px-6 py-3 text-left text-xs font-medium theme-text-secondary uppercase tracking-wider">Hours Worked</th>
            <th class="px-6 py-3 text-left text-xs font-medium theme-text-secondary uppercase tracking-wider">Total Hours Worked</th>
            <th class="px-6 py-3 text-left text-xs font-medium theme-text-secondary uppercase tracking-wider">Lost Time</th>
            <th class="px-6 py-3 text-left text-xs font-medium theme-text-secondary uppercase tracking-wider">Reason</th>
            <th class="px-6 py-3 text-left text-xs font-medium theme-text-secondary uppercase tracking-wider">Reported On</th>
          </tr>
        </thead>
        <tbody class="theme-bg-primary divide-y divide-gray-200 dark:divide-gray-700">
          {#each Object.values(groupedReportWorks) as group}
            {@const typedGroup = group}
            <!-- Group Header Row -->
            <tr class="hover:theme-bg-secondary transition-colors cursor-pointer" 
                class:lost-time={typedGroup.hasLostTime}
                on:click={(e) => { e.preventDefault(); toggleReportGroup(typedGroup.workCode); }}>
              <td class="px-6 py-4 whitespace-nowrap text-sm font-medium {typedGroup.hasLostTime ? 'text-gray-800' : 'theme-text-primary'}">
                {typedGroup.woNo}
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm {typedGroup.hasLostTime ? 'text-gray-800' : 'theme-text-primary'}">
                {typedGroup.pwoNo}
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm font-medium {typedGroup.hasLostTime ? 'text-gray-800' : 'theme-text-primary'}">
                {typedGroup.workCode}
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm {typedGroup.hasLostTime ? 'text-gray-800' : 'theme-text-primary'}">
                {typedGroup.workName}
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm theme-text-primary">
                {#if typedGroup.items && typedGroup.items.length > 0}
                  {@const firstItem = typedGroup.items[0]}
                  {@const skillMapping = firstItem?.skillMapping || firstItem?.prdn_work_planning?.std_work_skill_mapping}
                  {@const skillCompetency = skillMapping?.sc_name || (firstItem?.prdn_work_planning?.sc_required || 'N/A')}
                  <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400">
                    {skillCompetency}
                  </span>
                {:else}
                  <span class="text-gray-400">N/A</span>
                {/if}
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm {typedGroup.hasLostTime ? 'text-gray-800' : 'theme-text-primary'}">
                {#if typedGroup.items && typedGroup.items.length > 0}
                  {@const firstItem = typedGroup.items[0]}
                  {firstItem?.vehicleWorkFlow?.estimated_duration_minutes ? formatTime(firstItem.vehicleWorkFlow.estimated_duration_minutes / 60) : 'N/A'}
                {:else}
                  N/A
                {/if}
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm">
                {#if typedGroup.items && typedGroup.items.length > 0}
                  {@const allCompleted = typedGroup.items.every(item => item.completion_status === 'C')}
                  {@const anyCompleted = typedGroup.items.some(item => item.completion_status === 'C')}
                  {#if allCompleted}
                    <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400">
                      Completed
                    </span>
                  {:else if anyCompleted}
                    <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400">
                      Partially Completed
                    </span>
                  {:else}
                    <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400">
                      Not Completed
                    </span>
                  {/if}
                {:else}
                  <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300">
                    Unknown
                  </span>
                {/if}
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm {typedGroup.hasLostTime ? 'text-gray-800' : 'theme-text-primary'}" colspan="9">
                <div class="text-xs {typedGroup.hasLostTime ? 'text-gray-600' : 'theme-text-secondary'}">
                  Click to {isReportGroupExpanded(typedGroup.workCode) ? 'collapse' : 'expand'} skill details
                </div>
              </td>
            </tr>
            
            <!-- Individual Skill Rows (when expanded) -->
            {#if isReportGroupExpanded(typedGroup.workCode)}
              {#each typedGroup.items as report}
                <tr class="hover:theme-bg-secondary transition-colors theme-bg-secondary/30" 
                    class:lost-time={report.lt_minutes_total > 0}>
                  <td class="px-6 py-4 whitespace-nowrap text-sm {report.lt_minutes_total > 0 ? 'text-gray-800' : 'theme-text-primary'}">
                    {typedGroup.woNo}
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm {report.lt_minutes_total > 0 ? 'text-gray-800' : 'theme-text-primary'}">
                    {typedGroup.pwoNo}
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm font-medium {report.lt_minutes_total > 0 ? 'text-gray-800' : 'theme-text-primary'}">
                    {typedGroup.workCode}
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm {report.lt_minutes_total > 0 ? 'text-gray-800' : 'theme-text-primary'}">
                    {typedGroup.workName}
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm {report.lt_minutes_total > 0 ? 'text-gray-800' : 'theme-text-primary'}">
                    <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400">
                      {report.skillMapping?.sc_name || report.prdn_work_planning?.sc_required || 'N/A'}
                    </span>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm {report.lt_minutes_total > 0 ? 'text-gray-800' : 'theme-text-primary'}">
                    {report?.vehicleWorkFlow?.estimated_duration_minutes ? formatTime(report.vehicleWorkFlow.estimated_duration_minutes / 60) : 'N/A'}
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm">
                    {#if report.completion_status === 'C'}
                      <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400">
                        Completed
                      </span>
                    {:else if report.completion_status === 'NC'}
                      <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400">
                        Not Completed
                      </span>
                    {:else}
                      <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300">
                        {report.completion_status || 'Unknown'}
                      </span>
                    {/if}
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm {report.lt_minutes_total > 0 ? 'text-gray-800' : 'theme-text-primary'}">
                    <div>
                      <div class="font-medium">{report.prdn_work_planning?.hr_emp?.emp_name || 'N/A'}</div>
                      <div class="text-xs {report.lt_minutes_total > 0 ? 'text-gray-600' : 'theme-text-secondary'}">({report.prdn_work_planning?.hr_emp?.skill_short || 'N/A'})</div>
                    </div>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm {report.lt_minutes_total > 0 ? 'text-gray-800' : 'theme-text-primary'}">
                    {formatTime(report.hours_worked_till_date || 0)}
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm {report.lt_minutes_total > 0 ? 'text-gray-800' : 'theme-text-primary'}">
                    {report.from_time || 'N/A'}
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm {report.lt_minutes_total > 0 ? 'text-gray-800' : 'theme-text-primary'}">
                    {report.to_time || 'N/A'}
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm {report.lt_minutes_total > 0 ? 'text-gray-800' : 'theme-text-primary'}">
                    <div>
                      <div class="font-medium">
                        {formatTime(report.hours_worked_today || 0)}
                      </div>
                      {#if report.skillTimeStandard}
                        <div class="text-xs {report.lt_minutes_total > 0 ? 'text-gray-600' : 'theme-text-secondary'}">
                          Standard: {formatTime(report.skillTimeStandard.standard_time_minutes / 60)}
                        </div>
                        <div class="text-xs {report.lt_minutes_total > 0 ? 'text-gray-600' : 'theme-text-secondary'}">
                          Remaining: {formatTime(report.remainingTimeMinutes / 60)}
                        </div>
                      {/if}
                    </div>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm {report.lt_minutes_total > 0 ? 'text-gray-800' : 'theme-text-primary'}">
                    {formatTime((report.hours_worked_till_date || 0) + (report.hours_worked_today || 0))}
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm {report.lt_minutes_total > 0 ? 'text-gray-800' : 'theme-text-primary'}">
                    {#if report.lt_minutes_total > 0}
                      <div class="text-yellow-600 dark:text-yellow-400 font-medium">
                        {report.lt_minutes_total} minutes
                      </div>
                    {:else}
                      <span class="text-green-600 dark:text-green-400">No lost time</span>
                    {/if}
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm {report.lt_minutes_total > 0 ? 'text-gray-800' : 'theme-text-primary'}">
                    {#if report.lt_details && Array.isArray(report.lt_details) && report.lt_details.length > 0}
                      <div class="text-xs">
                        {formatLostTimeDetails(report.lt_details)}
                      </div>
                    {:else if report.lt_minutes_total > 0}
                      <span class="text-xs theme-text-secondary">N/A</span>
                    {:else}
                      <span class="text-xs theme-text-secondary">-</span>
                    {/if}
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm {report.lt_minutes_total > 0 ? 'text-gray-800' : 'theme-text-primary'}">
                    {formatDateTimeLocal(report.created_dt)}
                  </td>
                </tr>
              {/each}
            {/if}
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

