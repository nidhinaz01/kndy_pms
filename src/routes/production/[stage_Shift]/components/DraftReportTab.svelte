<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import Button from '$lib/components/common/Button.svelte';
  import SortableHeader from '$lib/components/common/SortableHeader.svelte';
  import { formatTime, formatLostTimeDetails } from '../utils/timeUtils';
  import { groupReportWorks } from '../utils/planTabUtils';
  import { filterGroupedWorksBySearch } from '../utils/productionTabSearchUtils';
  import { formatDateTimeLocal } from '$lib/utils/formatDate';
  import OvertimeReportingModal from './OvertimeReportingModal.svelte';
  import { calculateOvertime } from '$lib/services/overtimeCalculationService';
  import type { WorkerOvertime } from '$lib/services/overtimeCalculationService';
  import { sortTableData, handleSortClick, type SortConfig } from '$lib/utils/tableSorting';

  export let draftReportData: any[] = [];
  export let draftManpowerReportData: any[] = [];
  export let isLoading: boolean = false;
  export let stageCode: string = '';
  export let shiftCode: string = '';
  export let selectedDate: string = '';
  export let reportingSubmissionStatus: any = null;
  export let selectedRows: Set<string> = new Set();

  const dispatch = createEventDispatcher();

  let showOvertimeModal = false;
  let overtimeData: WorkerOvertime[] = [];
  let isCalculatingOT = false;
  let hasOvertime = false;
  let otReported = false;
  let searchTerm = '';
  let sortConfig: SortConfig = { column: null, direction: null };

  // Combine draft work reports (manpower reports have different structure, handle separately if needed)
  $: allDraftReports = draftReportData || [];
  $: groupedReportWorks = groupReportWorks(allDraftReports);
  $: filteredGroupedReportWorks = filterGroupedWorksBySearch(groupedReportWorks, searchTerm);
  
  // Convert grouped works to array and sort
  $: groupedWorksArray = Object.values(filteredGroupedReportWorks);
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
      sortable_fromTime: group.items?.[0]?.from_time || '',
      sortable_toTime: group.items?.[0]?.to_time || '',
      sortable_hoursWorked: group.items?.[0]?.hours_worked_today || 0,
      sortable_totalHoursWorked: (group.items?.[0]?.hours_worked_till_date || 0) + (group.items?.[0]?.hours_worked_today || 0),
      sortable_otHours: (group.items?.[0]?.overtime_minutes || 0) / 60,
      sortable_ltHours: (group.items?.[0]?.lt_minutes_total || 0) / 60,
      sortable_reportedOn: group.items?.[0]?.created_dt || ''
    }));
    
    return sortTableData(enriched, sortConfig);
  })();
  
  $: totalReports = allDraftReports.length;

  function handleSort(column: string) {
    sortConfig = handleSortClick(column, sortConfig);
  }

  $: selectedDateDisplay = (() => {
    if (!selectedDate) return '';
    const date = new Date(selectedDate);
    return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' });
  })();

  function handleSubmit() {
    dispatch('submit');
  }

  function handleRefresh() {
    dispatch('refresh');
    // Recalculate OT when refreshing
    checkOvertime();
  }

  function getUniqueSkills(items: any[]): string {
    if (!items || items.length === 0) return 'N/A';
    // Prefer an explicit combined sc_name when available (e.g., "US + T")
    for (const report of items) {
      const scName = report.skillMapping?.sc_name || report.prdn_work_planning?.std_work_skill_mapping?.sc_name;
      if (scName && typeof scName === 'string' && scName.trim() !== '') {
        return scName;
      }
    }
    // Fallback: collect unique tokens (sc_required or mapping short) and join with ' + ' to match Plan format
    const tokens = items
      .map(report => report.prdn_work_planning?.sc_required || report.skillMapping?.sc_name || 'N/A')
      .filter((t, i, arr) => arr.indexOf(t) === i);
    return tokens.join(' + ');
  }

  async function handleReportOT() {
    isCalculatingOT = true;
    try {
      // Always try calculateOvertime first
      const result = await calculateOvertime(stageCode, selectedDate, shiftCode);
      
      if (result.hasOvertime && result.workers.length > 0) {
        overtimeData = result.workers;
        showOvertimeModal = true;
      } else if (result.errors && result.errors.length > 0) {
        const lines = result.errors.slice(0, 5).map((e: string) => `• ${e}`).join('\n');
        alert(
          `Overtime could not be calculated. Fix the issues below and try again.\n\n${lines}${
            result.errors.length > 5 ? `\n• ... and ${result.errors.length - 5} more` : ''
          }`
        );
      } else {
        alert('No overtime detected for this stage, date, and shift.');
      }
    } catch (error) {
      console.error('Error calculating overtime:', error);
      const errorMsg = (error as Error).message || 'Unknown error';
      alert(`Error calculating overtime: ${errorMsg}\n\nPlease check your data and try again.`);
    } finally {
      isCalculatingOT = false;
    }
  }

  async function handleOvertimeConfirm() {
    dispatch('reportOvertime', { overtimeData });
    showOvertimeModal = false;
    otReported = true;
    // Recalculate to update hasOvertime status
    await checkOvertime();
  }

  function handleOvertimeModalClose() {
    showOvertimeModal = false;
  }

  function handleReportUnplannedWork() {
    dispatch('reportUnplannedWork');
  }

  function handleEditReport(group: any) {
    dispatch('editReport', group);
  }

  function handleDeleteReport(group: any) {
    dispatch('deleteReport', group);
  }

  function handleMultiDeleteSelected() {
    dispatch('multiDeleteDraftReports');
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

  function dispatchSelectAllVisible() {
    dispatch('selectAllVisible', { ids: visibleReportRowIds });
  }

  function dispatchDeselectVisible() {
    dispatch('deselectVisible', { ids: visibleReportRowIds });
  }

  let reportSelectAllHeaderInput: HTMLInputElement | null = null;

  $: visibleReportRowIds = sortedGroupedWorks.flatMap((g: { items?: { id: string | number }[] }) =>
    (g.items || []).map((item: { id: string | number }) => String(item.id))
  );
  $: allVisibleReportSelected =
    visibleReportRowIds.length > 0 && visibleReportRowIds.every((id) => selectedRows.has(id));
  $: someVisibleReportSelected = visibleReportRowIds.some((id) => selectedRows.has(id));
  $: if (reportSelectAllHeaderInput) {
    reportSelectAllHeaderInput.indeterminate = someVisibleReportSelected && !allVisibleReportSelected;
  }

  async function checkOvertime() {
    try {
      const result = await calculateOvertime(stageCode, selectedDate, shiftCode);
      const detectedOvertime = result.hasOvertime;

      hasOvertime = detectedOvertime;
      
      // Check if OT has been reported (all reports have overtime_minutes set)
      if (hasOvertime && draftReportData.length > 0) {
        // If calculateOvertime returned workers, use that to check
        if (result.workers && result.workers.length > 0) {
          const allWorkersWithOTReported = result.workers.every(worker => 
            worker.works.every(work => 
              draftReportData.some((report: any) => 
                report.id === work.reportingId && 
                report.overtime_minutes !== null && 
                report.overtime_minutes !== undefined &&
                report.overtime_minutes > 0
              )
            )
          );
          otReported = allWorkersWithOTReported;
        } else {
          otReported = draftReportData.some(
            (report: any) =>
              report.overtime_minutes !== null &&
              report.overtime_minutes !== undefined &&
              report.overtime_minutes > 0
          );
        }
      } else {
        otReported = !hasOvertime;
      }
    } catch (error) {
      console.error('Error checking overtime:', error);
      hasOvertime = false;
      otReported = false;
    }
  }

  // Check overtime when component loads or data changes
  $: if (stageCode && selectedDate && draftReportData.length > 0) {
    checkOvertime();
  }


  // Submission status helpers
  $: hasSubmission = reportingSubmissionStatus !== null;
  $: isPendingApproval = reportingSubmissionStatus?.status === 'pending_approval';
  $: isApproved = reportingSubmissionStatus?.status === 'approved';
  $: isRejected = reportingSubmissionStatus?.status === 'rejected';
  $: canEdit = !hasSubmission || isRejected; // Can edit if no submission or if rejected
  $: shouldDisableSubmit = isLoading || totalReports === 0 || isPendingApproval || isApproved || (hasOvertime && !otReported);
  $: submitDisabledReason = (() => {
    if (isLoading) return 'Loading data...';
    if (totalReports === 0) return 'No reports to submit';
    if (isPendingApproval) return 'Report is pending approval';
    if (isApproved) return 'Report has been approved';
    if (hasOvertime && !otReported) return 'Overtime detected but not reported. Please click "Report OT" first.';
    return null;
  })();

  $: submissionStatusDisplay = (() => {
    if (!reportingSubmissionStatus) return null;
    const status = reportingSubmissionStatus.status;
    const version = reportingSubmissionStatus.version || 1;
    const versionText = version > 1 ? ` (v${version})` : '';
    
    if (status === 'pending_approval') {
      return { text: `Pending Approval${versionText}`, color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400' };
    } else if (status === 'approved') {
      return { text: `Approved${versionText}`, color: 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400' };
    } else if (status === 'rejected') {
      return { text: `Rejected${versionText}`, color: 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400' };
    }
    return null;
  })();

  $: submittedDateDisplay = reportingSubmissionStatus?.submitted_dt 
    ? new Date(reportingSubmissionStatus.submitted_dt).toLocaleString('en-GB', { 
        day: '2-digit', 
        month: 'short', 
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    : null;

  $: reviewedDateDisplay = reportingSubmissionStatus?.reviewed_dt 
    ? new Date(reportingSubmissionStatus.reviewed_dt).toLocaleString('en-GB', { 
        day: '2-digit', 
        month: 'short', 
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    : null;
</script>

<div class="theme-bg-primary rounded-lg shadow border theme-border p-6">
  <div class="flex items-center justify-between mb-4">
    <div>
      <h2 class="text-xl font-semibold theme-text-primary">📝 Draft Reporting</h2>
      <p class="text-sm theme-text-secondary mt-1">
        Review and submit all draft reports for: {selectedDateDisplay}
      </p>
      {#if hasSubmission}
        <div class="mt-2 flex items-center gap-3">
          <span class="text-xs theme-text-secondary">Submission Status:</span>
          {#if submissionStatusDisplay}
            <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium {submissionStatusDisplay.color}">
              {submissionStatusDisplay.text}
            </span>
          {/if}
          {#if submittedDateDisplay}
            <span class="text-xs theme-text-secondary">
              Submitted: {submittedDateDisplay}
            </span>
          {/if}
          {#if reviewedDateDisplay}
            <span class="text-xs theme-text-secondary">
              Reviewed: {reviewedDateDisplay}
              {#if reportingSubmissionStatus?.reviewed_by}
                by {reportingSubmissionStatus.reviewed_by}
              {/if}
            </span>
          {/if}
        </div>
      {/if}
    </div>
    <div class="flex items-center space-x-3">
      <Button variant="secondary" size="sm" on:click={handleRefresh} disabled={isLoading}>
        {isLoading ? 'Loading...' : 'Refresh'}
      </Button>
      <Button 
        variant="secondary" 
        size="sm" 
        on:click={handleReportUnplannedWork}
        disabled={isLoading || isPendingApproval || isApproved}
      >
        Report Unplanned Work
      </Button>
      <Button 
        variant="warning" 
        size="sm" 
        on:click={handleReportOT}
        disabled={isLoading || isCalculatingOT || !hasOvertime || otReported || isPendingApproval || isApproved}
      >
        {isCalculatingOT ? 'Calculating...' : 'Report OT'}
      </Button>
      <Button 
        variant="primary" 
        size="sm" 
        on:click={handleSubmit}
        disabled={shouldDisableSubmit}
        title={submitDisabledReason || ''}
      >
        {isPendingApproval ? 'Pending Approval' : isApproved ? 'Approved' : 'Submit Report'}
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
  
  <!-- Submit Disabled Message -->
  {#if shouldDisableSubmit && submitDisabledReason && !isPendingApproval && !isApproved}
    <div class="mt-3 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
      <p class="text-sm text-yellow-800 dark:text-yellow-300">
        <strong>⚠️ Cannot Submit:</strong> {submitDisabledReason}
      </p>
    </div>
  {/if}
  
  <!-- Rejection Comments -->
  {#if isRejected && reportingSubmissionStatus?.rejection_reason}
    <div class="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
      <div class="flex items-start">
        <div class="flex-shrink-0">
          <svg class="h-5 w-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
          </svg>
        </div>
        <div class="ml-3 flex-1">
          <h3 class="text-sm font-medium text-red-800 dark:text-red-300">
            Report Rejected
          </h3>
          <div class="mt-2 text-sm text-red-700 dark:text-red-400">
            <p class="font-medium">Rejection Reason:</p>
            <p class="mt-1 whitespace-pre-wrap">{reportingSubmissionStatus.rejection_reason}</p>
          </div>
          {#if reviewedDateDisplay}
            <p class="mt-2 text-xs text-red-600 dark:text-red-500">
              Rejected on {reviewedDateDisplay}
              {#if reportingSubmissionStatus?.reviewed_by}
                by {reportingSubmissionStatus.reviewed_by}
              {/if}
            </p>
          {/if}
        </div>
      </div>
    </div>
  {/if}

  {#if selectedRows.size > 0 && canEdit}
    <div class="mt-4 px-4 py-3 border theme-border rounded-lg bg-blue-50 dark:bg-blue-900/20">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div class="flex flex-wrap items-center gap-4">
          <span class="text-sm theme-text-primary">
            {selectedRows.size} report row{selectedRows.size === 1 ? '' : 's'} selected
          </span>
          <Button variant="danger" size="sm" on:click={handleMultiDeleteSelected}>
            Delete Selected ({selectedRows.size})
          </Button>
        </div>
        <Button variant="secondary" size="sm" on:click={clearAllSelections}>
          Clear Selection
        </Button>
      </div>
    </div>
  {/if}

  {#if isLoading}
    <div class="text-center py-12">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div>
      <p class="theme-text-secondary">Loading draft reports...</p>
    </div>
  {:else if totalReports === 0}
    <div class="text-center py-12">
      <div class="text-6xl mb-4">📝</div>
      <p class="theme-text-secondary text-lg">No draft reports found</p>
      <p class="theme-text-secondary text-sm mt-2">
        Create reports in Plan tab and Manpower Report tab
      </p>
    </div>
  {:else}
    <div class="mt-4 px-4 py-2 theme-bg-secondary border theme-border rounded-lg">
      <p class="text-xs theme-text-primary">
        <strong class="theme-text-primary">Multi-selection:</strong> Use the checkboxes to select report rows. The header checkbox selects or clears all rows currently shown (including after search).
      </p>
    </div>
    <!-- Report Data Table -->
    <div class="overflow-x-auto">
      <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700" style="table-layout: fixed; width: 100%;">
        <thead class="theme-bg-secondary">
          <tr>
            <th class="px-4 py-3 text-left text-xs font-medium theme-text-secondary uppercase tracking-wider w-14">
              <input
                bind:this={reportSelectAllHeaderInput}
                type="checkbox"
                class="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                checked={allVisibleReportSelected}
                disabled={!canEdit || visibleReportRowIds.length === 0}
                title="Select all visible rows"
                aria-label="Select all visible rows"
                on:change={(e) => {
                  if (!canEdit || visibleReportRowIds.length === 0) return;
                  const target = e.target as HTMLInputElement;
                  if (target?.checked) {
                    dispatchSelectAllVisible();
                  } else {
                    dispatchDeselectVisible();
                  }
                }}
              />
            </th>
            <SortableHeader column="sortable_woNo" {sortConfig} onSort={handleSort} label="Work Order" headerClass="w-[100px]" />
            <SortableHeader column="sortable_pwoNo" {sortConfig} onSort={handleSort} label="PWO Number" headerClass="w-[120px]" />
            <SortableHeader column="sortable_workCode" {sortConfig} onSort={handleSort} label="Work Code" headerClass="w-[120px]" />
            <SortableHeader column="sortable_workName" {sortConfig} onSort={handleSort} label="Work Name" headerClass="w-[250px]" />
            <th class="px-4 py-3 text-left text-xs font-medium theme-text-secondary uppercase tracking-wider" style="width: 180px;">Skills Required</th>
            <th class="px-4 py-3 text-left text-xs font-medium theme-text-secondary uppercase tracking-wider" style="width: 120px;">Standard Time</th>
            <th class="px-4 py-3 text-left text-xs font-medium theme-text-secondary uppercase tracking-wider" style="width: 120px;">Status</th>
            <th class="px-4 py-3 text-left text-xs font-medium theme-text-secondary uppercase tracking-wider" style="width: 180px;">Worker (Skill)</th>
            <th class="px-4 py-3 text-left text-xs font-medium theme-text-secondary uppercase tracking-wider" style="width: 140px;">Time Worked Till Date</th>
            <SortableHeader column="sortable_fromTime" {sortConfig} onSort={handleSort} label="From Time" headerClass="w-[100px]" />
            <SortableHeader column="sortable_toTime" {sortConfig} onSort={handleSort} label="To Time" headerClass="w-[100px]" />
            <SortableHeader column="sortable_hoursWorked" {sortConfig} onSort={handleSort} label="Hours Worked" headerClass="w-[140px]" />
            <SortableHeader column="sortable_totalHoursWorked" {sortConfig} onSort={handleSort} label="Total Hours Worked" headerClass="w-[140px]" />
            <SortableHeader column="sortable_otHours" {sortConfig} onSort={handleSort} label="OT Hours" headerClass="w-[120px]" />
            <SortableHeader column="sortable_ltHours" {sortConfig} onSort={handleSort} label="Lost Time" headerClass="w-[120px]" />
            <th class="px-4 py-3 text-left text-xs font-medium theme-text-secondary uppercase tracking-wider" style="width: 200px;">Reason</th>
            <SortableHeader column="sortable_reportedOn" {sortConfig} onSort={handleSort} label="Reported On" headerClass="w-[150px]" />
            <th class="px-4 py-3 text-left text-xs font-medium theme-text-secondary uppercase tracking-wider" style="width: 150px;">Actions</th>
          </tr>
        </thead>
        <tbody class="theme-bg-primary divide-y divide-gray-200 dark:divide-gray-700">
          {#each sortedGroupedWorks as group (group.workCode + '_' + (group.woDetailsId || 'unknown'))}
            {@const typedGroup = group}
            {@const allSelected = typedGroup.items.every((item: { id: string | number }) =>
              selectedRows.has(String(item.id)))}
            {@const someSelected = typedGroup.items.some((item: { id: string | number }) =>
              selectedRows.has(String(item.id)))}
            <!-- Single Row per Work -->
            <tr class="hover:theme-bg-secondary transition-colors" 
                class:lost-time={typedGroup.hasLostTime}>
              <td class="px-4 py-2 whitespace-nowrap text-sm font-medium theme-text-primary">
                <input
                  type="checkbox"
                  class="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  checked={allSelected}
                  disabled={!canEdit}
                  title={someSelected && !allSelected ? 'Some rows in this work selected' : 'Select all rows for this work'}
                  on:change={(e) => {
                    if (!canEdit) return;
                    e.stopPropagation();
                    const target = e.target as HTMLInputElement;
                    if (target?.checked) {
                      selectAllRowsInGroup(typedGroup);
                    } else {
                      typedGroup.items.forEach((item: { id: string | number }) => {
                        if (selectedRows.has(String(item.id))) {
                          toggleRowSelection(String(item.id));
                        }
                      });
                    }
                  }}
                />
              </td>
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
                      {:else if report.worker_id}
                        <span class="font-medium">{report.reporting_hr_emp?.emp_name || report.worker_id || 'N/A'}</span>
                        <span class="text-xs {report.lt_minutes_total > 0 ? 'text-gray-600' : 'theme-text-secondary'}"> ({report.reporting_hr_emp?.skill_short || 'N/A'})</span>
                      {:else}
                        <span class="text-gray-400 italic text-xs">No worker</span>
                      {/if}
                    </div>
                  {/each}
                </div>
              </td>
              <td class="px-4 py-2 text-sm {typedGroup.hasLostTime ? 'text-gray-800' : 'theme-text-primary'}">
                <div class="flex flex-col gap-0.5">
              {#each typedGroup.items as report}
                    <div class="text-xs font-medium">
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
                    <div class="text-xs">{formatDateTimeLocal(report.created_dt)}</div>
                  {/each}
                </div>
                  </td>
              <td class="px-4 py-2 whitespace-nowrap text-sm theme-text-primary">
                {#if canEdit}
                  <div class="flex space-x-2">
                    <Button 
                      variant="primary" 
                      size="sm" 
                      on:click={() => handleEditReport(typedGroup)}
                    >
                      Edit
                    </Button>
                    <Button 
                      variant="danger" 
                      size="sm" 
                      on:click={() => handleDeleteReport(typedGroup)}
                    >
                      Delete
                    </Button>
                  </div>
                {:else}
                  <span class="text-xs theme-text-secondary italic">Read-only</span>
                {/if}
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
          <span class="font-medium">Total Draft Reports:</span> {Object.keys(filteredGroupedReportWorks).length}
        </div>
        <div class="theme-text-secondary">
          <span class="font-medium">Completed:</span> {allDraftReports.filter(r => r.completion_status === 'C').length}
        </div>
        <div class="theme-text-secondary">
          <span class="font-medium">Not Completed:</span> {allDraftReports.filter(r => r.completion_status === 'NC').length}
        </div>
        <div class="theme-text-secondary">
          <span class="font-medium">Total Lost Time:</span> {allDraftReports.reduce((sum, r) => sum + (r.lt_minutes_total || 0), 0)} minutes
        </div>
      </div>
    </div>
  {/if}

  <!-- Overtime Warning -->
  {#if hasOvertime && !otReported && !isPendingApproval && !isApproved}
    <div class="mt-4 p-4 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg">
      <div class="flex items-start">
        <div class="flex-shrink-0">
          <svg class="h-5 w-5 text-orange-400" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
          </svg>
        </div>
        <div class="ml-3 flex-1">
          <h3 class="text-sm font-medium text-orange-800 dark:text-orange-300">
            Overtime Detected
          </h3>
          <div class="mt-2 text-sm text-orange-700 dark:text-orange-400">
            <p>
              Some workers have worked beyond their shift time. Please click "Report OT" to calculate and record overtime hours and amounts before submitting the report.
            </p>
          </div>
        </div>
      </div>
    </div>
  {/if}

  <!-- Overtime Reporting Modal -->
  <OvertimeReportingModal
    isOpen={showOvertimeModal}
    {overtimeData}
    isLoading={isCalculatingOT}
    on:close={handleOvertimeModalClose}
    on:confirm={handleOvertimeConfirm}
  />
</div>
