<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import Button from '$lib/components/common/Button.svelte';
  import SortableHeader from '$lib/components/common/SortableHeader.svelte';
  import { formatTime, formatLostTimeDetails, formatDeviationTypeLabel } from '../utils/timeUtils';
  import { groupReportWorks } from '../utils/planTabUtils';
  import { filterGroupedWorksBySearch } from '../utils/productionTabSearchUtils';
  import { formatDateTimeLocal } from '$lib/utils/formatDate';
  import { sortTableData, handleSortClick, type SortConfig } from '$lib/utils/tableSorting';
  import {
    formatDateDdMmYy,
    formatTimeWithoutSeconds,
    formatRemainingTimeMinutesDisplay,
    getGroupedSkillsRequiredForReports,
    planningScRequiredForReportRow
  } from '../utils/reportTableDisplayUtils';

  export let reportData: any[] = [];
  export let isLoading: boolean = false;
  export let stageCode: string = '';
  export let selectedDate: string = '';
  export let expandedReportGroups: string[] = []; // Keep for backward compatibility but not used

  const dispatch = createEventDispatcher();

  let searchTerm = '';
  const WORK_NAME_PREVIEW_LENGTH = 30;
  let expandedWorkNames: Record<string, boolean> = {};
  let sortConfig: SortConfig = { column: null, direction: null };
  /** When true, show `prdn_work_reporting.id` column for debugging (default off). */
  let showDebugIds = false;

  $: groupedReportWorks = groupReportWorks(reportData);
  $: filteredGroupedReportWorks = filterGroupedWorksBySearch(groupedReportWorks, searchTerm);
  
  // Convert grouped works to array and sort
  $: groupedWorksArray = Object.entries(filteredGroupedReportWorks).map(([key, group]) => ({ groupKey: key, ...group }));
  $: sortedGroupedWorks = (() => {
    if (!sortConfig.column || !sortConfig.direction) {
      return groupedWorksArray;
    }
    
    // Create enriched groups with sortable fields
    const enriched = groupedWorksArray.map(group => ({
      ...group,
      sortable_woNo: group.woNo || '',
      sortable_pwoNo: group.pwoNo || '',
      sortable_workCode: group.workCode || '',
      sortable_workName: group.workName || '',
      sortable_fromDate: group.items?.[0]?.from_date || '',
      sortable_fromTime: group.items?.[0]?.from_time || '',
      sortable_toDate: group.items?.[0]?.to_date || '',
      sortable_toTime: group.items?.[0]?.to_time || '',
      sortable_hoursWorked: group.items?.[0]?.hours_worked_today || 0,
      sortable_totalHoursWorked: (group.items?.[0]?.hours_worked_till_date || 0) + (group.items?.[0]?.hours_worked_today || 0),
      sortable_otHours: (group.items?.[0]?.overtime_minutes || 0) / 60,
      sortable_ltHours: (group.items?.[0]?.lt_minutes_total || 0) / 60,
      sortable_reportedOn: group.items?.[0]?.created_dt || ''
    }));
    
    return sortTableData(enriched, sortConfig);
  })();
  
  $: totalReports = reportData.length;

  function handleSort(column: string) {
    sortConfig = handleSortClick(column, sortConfig);
  }

  function handleRefresh() {
    dispatch('refresh');
  }

  function handleGenerateExcel() {
    dispatch('generateExcel');
  }

  function handleGeneratePDF() {
    dispatch('generatePDF');
  }

  function getWorkNamePreview(name: string): { preview: string; truncated: boolean } {
    const full = (name || '').trim();
    if (full.length <= WORK_NAME_PREVIEW_LENGTH) return { preview: full || 'N/A', truncated: false };
    return { preview: `${full.slice(0, WORK_NAME_PREVIEW_LENGTH)}...`, truncated: true };
  }

  function toggleWorkName(key: string) {
    expandedWorkNames = { ...expandedWorkNames, [key]: !expandedWorkNames[key] };
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
      <Button
        variant={showDebugIds ? 'primary' : 'secondary'}
        size="sm"
        title={showDebugIds ? 'Hide reporting row IDs' : 'Show prdn_work_reporting.id column for debugging'}
        on:click={() => (showDebugIds = !showDebugIds)}
      >
        ID
      </Button>
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
      <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700" style="table-layout: auto; word-wrap: break-word;">
        <thead class="theme-bg-secondary">
          <tr>
            {#if showDebugIds}
              <th
                class="px-6 py-3 text-left text-xs font-medium theme-text-secondary uppercase tracking-wider w-[88px]"
                title="prdn_work_reporting.id (per worker/skill row)"
              >
                ID
              </th>
            {/if}
            <SortableHeader column="sortable_woNo" {sortConfig} onSort={handleSort} label="Work Order" headerClass="w-[100px] min-w-[100px] max-w-[100px]" />
            <SortableHeader column="sortable_pwoNo" {sortConfig} onSort={handleSort} label="PWO Number" headerClass="w-[100px] min-w-[100px] max-w-[100px]" />
            <SortableHeader column="sortable_workCode" {sortConfig} onSort={handleSort} label="Work Code" headerClass="w-[120px] min-w-[120px] max-w-[120px]" />
            <SortableHeader column="sortable_workName" {sortConfig} onSort={handleSort} label="Work Name" headerClass="max-w-[200px] w-[200px]" />
            <th class="px-6 py-3 text-left text-xs font-medium theme-text-secondary uppercase tracking-wider">Skills Required</th>
            <th class="px-6 py-3 text-left text-xs font-medium theme-text-secondary uppercase tracking-wider" style="width: 120px;">Standard Time</th>
            <th class="px-6 py-3 text-left text-xs font-medium theme-text-secondary uppercase tracking-wider" style="width: 120px;">Status</th>
            <th class="px-6 py-3 text-left text-xs font-medium theme-text-secondary uppercase tracking-wider">Skill</th>
            <th class="px-6 py-3 text-left text-xs font-medium theme-text-secondary uppercase tracking-wider" style="width: 180px;">Worker (Skill)</th>
            <th class="px-6 py-3 text-left text-xs font-medium theme-text-secondary uppercase tracking-wider whitespace-nowrap" style="min-width: 140px;">Time Worked Till Date</th>
            <SortableHeader column="sortable_fromDate" {sortConfig} onSort={handleSort} label="From Date" headerClass="w-[100px]" />
            <SortableHeader column="sortable_fromTime" {sortConfig} onSort={handleSort} label="From Time" headerClass="w-[90px]" />
            <SortableHeader column="sortable_toDate" {sortConfig} onSort={handleSort} label="To Date" headerClass="w-[100px]" />
            <SortableHeader column="sortable_toTime" {sortConfig} onSort={handleSort} label="To Time" headerClass="w-[90px]" />
            <SortableHeader column="sortable_hoursWorked" {sortConfig} onSort={handleSort} label="Hours Worked" headerClass="w-[140px]" />
            <SortableHeader column="sortable_totalHoursWorked" {sortConfig} onSort={handleSort} label="Total Hours Worked" headerClass="w-[140px]" />
            <SortableHeader column="sortable_otHours" {sortConfig} onSort={handleSort} label="OT Hours" headerClass="w-[120px]" />
            <SortableHeader column="sortable_ltHours" {sortConfig} onSort={handleSort} label="Lost Time" headerClass="w-[120px]" />
            <th class="px-6 py-3 text-left text-xs font-medium theme-text-secondary uppercase tracking-wider" style="width: 200px;">Reason</th>
            <SortableHeader column="sortable_reportedOn" {sortConfig} onSort={handleSort} label="Reported On" headerClass="w-[150px]" />
          </tr>
        </thead>
        <tbody class="theme-bg-primary divide-y divide-gray-200 dark:divide-gray-700">
          {#each sortedGroupedWorks as group (group.groupKey)}
            {@const typedGroup = group}
            {@const skillsRequiredLabel = getGroupedSkillsRequiredForReports(typedGroup)}
            <!-- Single Row per Work -->
            <tr class="hover:theme-bg-secondary transition-colors" 
                class:lost-time={typedGroup.hasLostTime}>
              {#if showDebugIds}
                <td class="px-6 py-4 text-sm theme-text-primary align-top">
                  <div class="flex flex-col gap-0.5">
                    {#each typedGroup.items as report}
                      <div class="text-xs font-mono tabular-nums" title="prdn_work_reporting.id">
                        {report.id ?? '—'}
                      </div>
                    {/each}
                  </div>
                </td>
              {/if}
              <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-left w-[100px] min-w-[100px] max-w-[100px] {typedGroup.hasLostTime ? 'text-gray-800' : 'theme-text-primary'}">
                {typedGroup.woNo}
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-left w-[100px] min-w-[100px] max-w-[100px] {typedGroup.hasLostTime ? 'text-gray-800' : 'theme-text-primary'}">
                {typedGroup.pwoNo}
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-left w-[120px] min-w-[120px] max-w-[120px] {typedGroup.hasLostTime ? 'text-gray-800' : 'theme-text-primary'}">
                {typedGroup.workCode}
              </td>
              <td class="px-6 py-4 text-sm {typedGroup.hasLostTime ? 'text-gray-800' : 'theme-text-primary'}" style="max-width: 200px; word-wrap: break-word;">
                <div class="break-words">
                  <button
                    type="button"
                    class="cursor-pointer text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50 rounded"
                    title={getWorkNamePreview(typedGroup.workName || '').truncated ? typedGroup.workName : undefined}
                    aria-expanded={expandedWorkNames[typedGroup.groupKey] || false}
                    on:click={() => toggleWorkName(typedGroup.groupKey)}
                  >
                    {getWorkNamePreview(typedGroup.workName || '').preview}
                  </button>
                  {#if getWorkNamePreview(typedGroup.workName || '').truncated}
                    <div class="mt-1">
                      <button
                        type="button"
                        class="text-xs text-blue-700 dark:text-blue-300 hover:underline"
                        aria-expanded={expandedWorkNames[typedGroup.groupKey] || false}
                        on:click={() => toggleWorkName(typedGroup.groupKey)}
                      >
                        {expandedWorkNames[typedGroup.groupKey] ? 'Hide full name' : 'Show full name'}
                      </button>
                    </div>
                  {/if}
                  {#if expandedWorkNames[typedGroup.groupKey] && getWorkNamePreview(typedGroup.workName || '').truncated}
                    <div class="mt-2 rounded border theme-border theme-bg-secondary p-2 text-xs leading-relaxed break-words">
                      {typedGroup.workName}
                    </div>
                  {/if}
                </div>
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm {typedGroup.hasLostTime ? 'text-gray-800' : 'theme-text-primary'}">
                <span
                  class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400"
                >
                  {skillsRequiredLabel}
                </span>
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm {typedGroup.hasLostTime ? 'text-gray-800' : 'theme-text-primary'}">
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
              <td class="px-6 py-4 text-sm">
                {#if typedGroup.items && typedGroup.items.length > 0}
                  {@const allCompleted = typedGroup.items.every((item: any) => item.completion_status === 'C')}
                  {@const anyNotCompleted = typedGroup.items.some((item: any) => item.completion_status === 'NC')}
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
              <td class="px-6 py-4 text-sm {typedGroup.hasLostTime ? 'text-gray-800' : 'theme-text-primary'}">
                <div class="flex flex-col gap-0.5">
                  {#each typedGroup.items as report}
                    <div class="font-medium whitespace-nowrap text-xs">{planningScRequiredForReportRow(report)}</div>
                  {/each}
                </div>
              </td>
              <td class="px-6 py-4 text-sm {typedGroup.hasLostTime ? 'text-gray-800' : 'theme-text-primary'}">
                <div class="flex flex-col gap-0.5">
                  {#each typedGroup.items as report}
                    <div class="text-xs">
                      {#if report.worker_id}
                        <span class="font-medium whitespace-nowrap">{report.reporting_hr_emp?.emp_name || report.worker_id || 'N/A'} ({report.reporting_hr_emp?.skill_short || 'N/A'})</span>
                      {:else}
                        <span class="theme-text-secondary">N/A</span>
                      {/if}
                    </div>
                  {/each}
                </div>
              </td>
              <td class="px-6 py-4 text-sm whitespace-nowrap {typedGroup.hasLostTime ? 'text-gray-800' : 'theme-text-primary'}">
                <div class="flex flex-col gap-0.5">
                  {#each typedGroup.items as report}
                    <div class="text-xs font-medium whitespace-nowrap">
                      {formatTime(report.hours_worked_till_date || 0)}
                    </div>
                  {/each}
                </div>
              </td>
              <td class="px-6 py-4 text-sm w-[100px] {typedGroup.hasLostTime ? 'text-gray-800' : 'theme-text-primary'}">
                <div class="flex flex-col gap-0.5">
                  {#each typedGroup.items as report}
                    <div class="text-xs whitespace-nowrap">{formatDateDdMmYy(report.from_date)}</div>
                  {/each}
                </div>
              </td>
              <td class="px-6 py-4 text-sm w-[90px] {typedGroup.hasLostTime ? 'text-gray-800' : 'theme-text-primary'}">
                <div class="flex flex-col gap-0.5">
                  {#each typedGroup.items as report}
                    <div class="text-xs whitespace-nowrap">{formatTimeWithoutSeconds(report.from_time)}</div>
                  {/each}
                </div>
              </td>
              <td class="px-6 py-4 text-sm w-[100px] {typedGroup.hasLostTime ? 'text-gray-800' : 'theme-text-primary'}">
                <div class="flex flex-col gap-0.5">
                  {#each typedGroup.items as report}
                    <div class="text-xs whitespace-nowrap">{formatDateDdMmYy(report.to_date)}</div>
                  {/each}
                </div>
              </td>
              <td class="px-6 py-4 text-sm w-[90px] {typedGroup.hasLostTime ? 'text-gray-800' : 'theme-text-primary'}">
                <div class="flex flex-col gap-0.5">
                  {#each typedGroup.items as report}
                    <div class="text-xs whitespace-nowrap">{formatTimeWithoutSeconds(report.to_time)}</div>
                  {/each}
                </div>
              </td>
              <td class="px-6 py-4 text-sm {typedGroup.hasLostTime ? 'text-gray-800' : 'theme-text-primary'}">
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
                          Rem: {formatRemainingTimeMinutesDisplay(report.remainingTimeMinutes)}
                        </div>
                      {/if}
                    </div>
                  {/each}
                </div>
              </td>
              <td class="px-6 py-4 text-sm {typedGroup.hasLostTime ? 'text-gray-800' : 'theme-text-primary'}">
                <div class="flex flex-col gap-0.5">
                  {#each typedGroup.items as report}
                    <div class="text-xs font-medium">
                      {formatTime((report.hours_worked_till_date || 0) + (report.hours_worked_today || 0))}
                    </div>
                  {/each}
                </div>
              </td>
              <td class="px-6 py-4 text-sm {typedGroup.hasLostTime ? 'text-gray-800' : 'theme-text-primary'}">
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
              <td class="px-6 py-4 text-sm {typedGroup.hasLostTime ? 'text-gray-800' : 'theme-text-primary'}">
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
              <td class="px-6 py-4 text-sm {typedGroup.hasLostTime ? 'text-gray-800' : 'theme-text-primary'}">
                <div class="flex flex-col gap-0.5">
                  {#each typedGroup.items as report}
                    <div class="text-xs space-y-1">
                      {#if report.deviations && report.deviations.length > 0}
                        {@const deviation = report.deviations[0]}
                        <div class="text-orange-600 dark:text-orange-400">
                          <span class="font-medium">{formatDeviationTypeLabel(deviation.deviation_type)}</span>
                          {#if deviation.reason?.trim()}
                            <div class="mt-0.5 whitespace-normal">{deviation.reason.trim()}</div>
                          {/if}
                        </div>
                      {/if}
                      {#if report.lt_details && Array.isArray(report.lt_details) && report.lt_details.length > 0}
                        <div class="truncate theme-text-primary" title={formatLostTimeDetails(report.lt_details)}>
                          {formatLostTimeDetails(report.lt_details)}
                        </div>
                      {:else if report.lt_minutes_total > 0}
                        <span class="theme-text-secondary">N/A</span>
                      {:else if !(report.deviations && report.deviations.length > 0)}
                        <span class="theme-text-secondary">-</span>
                      {/if}
                    </div>
                  {/each}
                </div>
              </td>
              <td class="px-6 py-4 text-sm {typedGroup.hasLostTime ? 'text-gray-800' : 'theme-text-primary'}">
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

