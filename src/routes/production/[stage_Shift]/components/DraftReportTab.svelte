<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import Button from '$lib/components/common/Button.svelte';
  import SortableHeader from '$lib/components/common/SortableHeader.svelte';
  import { formatTime, formatLostTimeDetails, formatDeviationTypeLabel } from '../utils/timeUtils';
  import { groupReportWorks } from '../utils/planTabUtils';
  import { filterGroupedWorksBySearch } from '../utils/productionTabSearchUtils';
  import { formatDateTimeLocal } from '$lib/utils/formatDate';
  import OvertimeReportingModal from './OvertimeReportingModal.svelte';
  import { calculateOvertime, getReportingManpowerOtEmpIds } from '$lib/services/overtimeCalculationService';
  import { validateEmployeeShiftReporting } from '$lib/api/production/reportingValidationService';
  import type { WorkerOvertime } from '$lib/services/overtimeCalculationService';
  import { sortTableData, handleSortClick, type SortConfig } from '$lib/utils/tableSorting';
  import {
    formatDateDdMmYy,
    formatTimeWithoutSeconds,
    formatRemainingTimeMinutesDisplay,
    getGroupedSkillsRequiredForReports,
    planningScRequiredForReportRow
  } from '../utils/reportTableDisplayUtils';

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
  const WORK_NAME_PREVIEW_LENGTH = 30;
  let expandedWorkNames: Record<string, boolean> = {};
  let overtimeData: WorkerOvertime[] = [];
  let isCalculatingOT = false;
  let hasOvertime = false;
  let otReported = false;
  let validationErrors: string[] = [];
  let validationWarnings: string[] = [];
  let isValidationLoading = false;
  let lastValidationRequestKey = '';
  let validationRefreshToken = 0;
  let showIssuesModal = false;
  /** Same checks as submit: all present / reassigned-in employees have work hours aligned with manpower before Report OT. */
  let allEmployeeReportingComplete = true;
  let searchTerm = '';
  let sortConfig: SortConfig = { column: null, direction: null };

  /** When true, show `prdn_work_reporting.id` column for debugging (default off). */
  let showDebugIds = false;

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
    validationRefreshToken += 1;
  }

  function openIssuesModal() {
    if (blockingIssues.length === 0) return;
    showIssuesModal = true;
  }

  function closeIssuesModal() {
    showIssuesModal = false;
  }

  function reportingDateStr(): string {
    if (!selectedDate) return '';
    return typeof selectedDate === 'string'
      ? selectedDate.split('T')[0]
      : new Date(selectedDate).toISOString().split('T')[0];
  }

  async function handleReportOT() {
    isCalculatingOT = true;
    try {
      const otEmpIds = await getReportingManpowerOtEmpIds(stageCode, selectedDate, shiftCode);
      if (otEmpIds.length === 0) {
        alert(
          'No employees have OT hours on reporting manpower for this date.\n\n' +
            'Set OT hours on attendance first, then use Report OT.'
        );
        return;
      }

      const dateStr = reportingDateStr();
      const reportingValidation = await validateEmployeeShiftReporting(stageCode, shiftCode, dateStr);
      if (!reportingValidation.isValid) {
        const lines = reportingValidation.errors.slice(0, 8).join('\n');
        alert(
          'Report OT is available only after reporting is complete for every employee on this shift.\n\n' +
            'Fix the following first, then try again:\n\n' +
            lines +
            (reportingValidation.errors.length > 8
              ? `\n\n... and ${reportingValidation.errors.length - 8} more`
              : '')
        );
        return;
      }

      const result = await calculateOvertime(stageCode, selectedDate, shiftCode, {
        workerIdsOnly: otEmpIds
      });

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
      const dateStr = reportingDateStr();
      const otEmpIds = await getReportingManpowerOtEmpIds(stageCode, selectedDate, shiftCode);
      if (otEmpIds.length === 0) {
        hasOvertime = false;
        otReported = true;
        allEmployeeReportingComplete = true;
        return;
      }

      const reportingValidation = await validateEmployeeShiftReporting(stageCode, shiftCode, dateStr);
      allEmployeeReportingComplete = reportingValidation.isValid;

      const result = await calculateOvertime(stageCode, selectedDate, shiftCode, {
        workerIdsOnly: otEmpIds
      });
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
      allEmployeeReportingComplete = false;
    }
  }

  // Check overtime when component loads or data changes (manpower + drafts drive completeness)
  $: if (
    stageCode &&
    shiftCode &&
    selectedDate &&
    (draftReportData.length > 0 || draftManpowerReportData.length > 0)
  ) {
    checkOvertime();
  }


  // Submission status helpers
  $: hasSubmission = reportingSubmissionStatus !== null;
  $: isPendingApproval = reportingSubmissionStatus?.status === 'pending_approval';
  $: isApproved = reportingSubmissionStatus?.status === 'approved';
  $: isRejected = reportingSubmissionStatus?.status === 'rejected';
  $: isReverted = reportingSubmissionStatus?.status === 'reverted';
  $: blockingIssues = [
    ...validationErrors.map((message) => ({ type: 'error' as const, message })),
    ...validationWarnings.map((message) => ({ type: 'warning' as const, message }))
  ];
  $: hasBlockingIssues = blockingIssues.length > 0;
  $: canEdit = !hasSubmission || isRejected || isReverted; // Can edit if no submission, rejected, or reverted
  $: shouldDisableSubmit =
    isLoading ||
    isValidationLoading ||
    totalReports === 0 ||
    isPendingApproval ||
    isApproved ||
    hasBlockingIssues ||
    (hasOvertime && (!otReported || !allEmployeeReportingComplete));

  async function loadValidationIssues(requestKey: string) {
    const requestStartedFor = requestKey;
    isValidationLoading = true;
    try {
      const dateStr = reportingDateStr();
      const result = await validateEmployeeShiftReporting(stageCode, shiftCode, dateStr);
      if (lastValidationRequestKey !== requestStartedFor) return;
      validationErrors = result.errors || [];
      validationWarnings = result.warnings || [];
    } catch (error) {
      if (lastValidationRequestKey !== requestStartedFor) return;
      validationErrors = [`Unable to evaluate draft-report issues: ${(error as Error).message}`];
      validationWarnings = [];
    } finally {
      if (lastValidationRequestKey === requestStartedFor) {
        isValidationLoading = false;
      }
    }
  }

  $: {
    const dateKey = reportingDateStr();
    const nextKey = [
      stageCode || '',
      shiftCode || '',
      dateKey || '',
      String(allDraftReports?.length || 0),
      String(draftManpowerReportData?.length || 0),
      String(reportingSubmissionStatus?.status || ''),
      String(isLoading),
      String(validationRefreshToken)
    ].join('|');
    if (nextKey !== lastValidationRequestKey) {
      lastValidationRequestKey = nextKey;
      if (!stageCode || !shiftCode || !dateKey || isLoading) {
        validationErrors = [];
        validationWarnings = [];
        isValidationLoading = false;
      } else {
        void loadValidationIssues(nextKey);
      }
    }
  }

  $: submitDisabledReason = (() => {
    if (isLoading) return 'Loading data...';
    if (isValidationLoading) return 'Checking reporting issues...';
    if (totalReports === 0) return 'No reports to submit';
    if (isPendingApproval) return 'Report is pending approval';
    if (isApproved) return 'Report has been approved';
    if (hasBlockingIssues) return `Resolve ${blockingIssues.length} issue(s) listed below.`;
    if (hasOvertime && !allEmployeeReportingComplete)
      return 'Finish reporting for all employees (manpower + work hours), then use Report OT.';
    if (hasOvertime && !otReported) return 'Overtime detected but not reported. Please click "Report OT" first.';
    return null;
  })();

  $: reportOtDisabledReason = (() => {
    if (isLoading) return 'Loading...';
    if (isPendingApproval || isApproved) return 'Not editable in this status.';
    if (!hasOvertime) return 'No calculated overtime for employees with OT hours on manpower.';
    if (!allEmployeeReportingComplete)
      return 'Complete reporting for every employee on this shift (attendance and work hours) before Report OT.';
    if (otReported) return 'Overtime already saved for this calculation.';
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
    } else if (status === 'reverted') {
      return { text: `Reverted${versionText}`, color: 'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-300' };
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

  type DuplicateWorkerReportHint = {
    planningId: number;
    workerId: string;
    workerName: string;
    count: number;
    reportIds: number[];
  };

  /** More than one draft row for the same planning line + worker (different report ids). */
  $: duplicateWorkerReportHints = ((): DuplicateWorkerReportHint[] => {
    const byKey = new Map<string, DuplicateWorkerReportHint>();
    for (const r of allDraftReports) {
      const pidRaw = r.planning_id ?? r.prdn_work_planning?.id;
      const wid = r.worker_id;
      if (pidRaw == null || wid == null || String(wid).trim() === '') continue;
      const planningId = Number(pidRaw);
      if (!Number.isFinite(planningId)) continue;
      const workerId = String(wid).trim();
      const key = `${planningId}_${workerId}`;
      const name = r.reporting_hr_emp?.emp_name || workerId;
      const rid = Number(r.id);
      const prev = byKey.get(key);
      if (prev) {
        prev.count += 1;
        if (Number.isFinite(rid)) prev.reportIds.push(rid);
      } else {
        byKey.set(key, {
          planningId,
          workerId,
          workerName: name,
          count: 1,
          reportIds: Number.isFinite(rid) ? [rid] : []
        });
      }
    }
    return [...byKey.values()].filter((h) => h.count > 1);
  })();

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
          disabled={isLoading || isCalculatingOT || !hasOvertime || !allEmployeeReportingComplete || otReported || isPendingApproval || isApproved}
        title={reportOtDisabledReason || ''}
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

  <div class="mt-3">
    {#if isValidationLoading}
      <div class="rounded-lg border theme-border px-4 py-3 theme-bg-secondary">
        <p class="text-sm theme-text-secondary">Checking report issues...</p>
      </div>
    {:else if blockingIssues.length > 0}
      <button
        type="button"
        class="w-full rounded-lg border border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/10 px-4 py-3 text-left"
        on:click={openIssuesModal}
      >
        <div class="flex items-center justify-between gap-2">
          <p class="text-sm font-semibold text-red-700 dark:text-red-300">
            Resolve all issues before submitting report
          </p>
          <span class="text-xs text-red-700 dark:text-red-300">
            {blockingIssues.length} issue{blockingIssues.length === 1 ? '' : 's'}
          </span>
        </div>
      </button>
    {:else}
      <div class="rounded-lg border border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-900/10 px-4 py-3">
        <p class="text-sm text-green-700 dark:text-green-300">
          No blocking issues found. Report can be submitted.
        </p>
      </div>
    {/if}
  </div>

  {#if duplicateWorkerReportHints.length > 0}
    <div
      class="mt-3 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg"
      role="status"
    >
      <p class="text-sm font-medium text-amber-900 dark:text-amber-200">
        Possible duplicate draft reports
      </p>
      <p class="text-xs text-amber-800 dark:text-amber-300 mt-1">
        There is more than one draft row for the same planned work line and the same worker. Totals and submit
        checks can be wrong until extras are removed. Delete spare rows or merge in the database, then click
        Refresh.
      </p>
      <ul class="mt-2 text-xs text-amber-900 dark:text-amber-200 list-disc pl-4 space-y-1">
        {#each duplicateWorkerReportHints.slice(0, 8) as d}
          <li>
            {d.workerName} — planning #{d.planningId} — {d.count} rows (report ids: {d.reportIds.join(', ')})
          </li>
        {/each}
      </ul>
      {#if duplicateWorkerReportHints.length > 8}
        <p class="text-xs mt-1 text-amber-800 dark:text-amber-300">
          … and {duplicateWorkerReportHints.length - 8} more.
        </p>
      {/if}
    </div>
  {/if}
  
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
      <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700" style="table-layout: auto; word-wrap: break-word;">
        <thead class="theme-bg-secondary">
          <tr>
            <th class="px-6 py-3 text-left text-xs font-medium theme-text-secondary uppercase tracking-wider w-14">
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
            {#if showDebugIds}
              <th
                class="px-6 py-3 text-left text-xs font-medium theme-text-secondary uppercase tracking-wider whitespace-nowrap w-[88px]"
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
            <th class="px-6 py-3 text-left text-xs font-medium theme-text-secondary uppercase tracking-wider" style="width: 150px;">Actions</th>
          </tr>
        </thead>
        <tbody class="theme-bg-primary divide-y divide-gray-200 dark:divide-gray-700">
          {#each sortedGroupedWorks as group (group.workCode + '_' + (group.woDetailsId || 'unknown'))}
            {@const typedGroup = group}
            {@const skillsRequiredLabel = getGroupedSkillsRequiredForReports(typedGroup)}
            {@const allSelected = typedGroup.items.every((item: { id: string | number }) =>
              selectedRows.has(String(item.id)))}
            {@const someSelected = typedGroup.items.some((item: { id: string | number }) =>
              selectedRows.has(String(item.id)))}
            <!-- Single Row per Work -->
            <tr class="hover:theme-bg-secondary transition-colors" 
                class:lost-time={typedGroup.hasLostTime}>
              <td class="px-6 py-4 whitespace-nowrap text-sm font-medium theme-text-primary">
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
              {#if showDebugIds}
                <td class="px-6 py-4 text-sm align-top {typedGroup.hasLostTime ? 'text-gray-800' : 'theme-text-primary'}">
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
                    aria-expanded={expandedWorkNames[`${typedGroup.workCode || 'unknown'}_${typedGroup.woDetailsId || typedGroup.items?.[0]?.wo_details_id || 'unknown'}`] || false}
                    on:click={() => toggleWorkName(`${typedGroup.workCode || 'unknown'}_${typedGroup.woDetailsId || typedGroup.items?.[0]?.wo_details_id || 'unknown'}`)}
                  >
                    {getWorkNamePreview(typedGroup.workName || '').preview}
                  </button>
                  {#if getWorkNamePreview(typedGroup.workName || '').truncated}
                    <div class="mt-1">
                      <button
                        type="button"
                        class="text-xs text-blue-700 dark:text-blue-300 hover:underline"
                        aria-expanded={expandedWorkNames[`${typedGroup.workCode || 'unknown'}_${typedGroup.woDetailsId || typedGroup.items?.[0]?.wo_details_id || 'unknown'}`] || false}
                        on:click={() => toggleWorkName(`${typedGroup.workCode || 'unknown'}_${typedGroup.woDetailsId || typedGroup.items?.[0]?.wo_details_id || 'unknown'}`)}
                      >
                        {expandedWorkNames[`${typedGroup.workCode || 'unknown'}_${typedGroup.woDetailsId || typedGroup.items?.[0]?.wo_details_id || 'unknown'}`] ? 'Hide full name' : 'Show full name'}
                      </button>
                    </div>
                  {/if}
                  {#if expandedWorkNames[`${typedGroup.workCode || 'unknown'}_${typedGroup.woDetailsId || typedGroup.items?.[0]?.wo_details_id || 'unknown'}`] && getWorkNamePreview(typedGroup.workName || '').truncated}
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
                        <span class="text-gray-400 italic text-xs">No worker</span>
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
                    <div class="text-xs">{formatDateTimeLocal(report.created_dt)}</div>
                  {/each}
                </div>
                  </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm theme-text-primary">
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
            {#if !allEmployeeReportingComplete}
              <p>
                Reporting is not complete for every employee on this shift (see Manpower Report and draft work
                rows). Finish attendance and work hours for all employees first, then use Report OT so overtime can
                be applied in one pass.
              </p>
            {:else}
              <p>
                Some workers have worked beyond their shift time. Please click "Report OT" to calculate and record
                overtime hours and amounts before submitting the report.
              </p>
            {/if}
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

  {#if showIssuesModal}
    <button
      type="button"
      class="fixed inset-0 z-[9999] w-full h-full border-none bg-black bg-opacity-50 p-0"
      aria-label="Close issues modal"
      on:click={closeIssuesModal}
    ></button>
    <div class="fixed inset-0 z-[10000] flex items-center justify-center p-4">
      <div
        class="w-full max-w-3xl rounded-lg border-2 border-gray-300 theme-bg-primary shadow-xl dark:border-gray-600"
        role="dialog"
        aria-modal="true"
        aria-label="Draft report issues"
        tabindex="-1"
      >
        <div class="border-b px-6 py-4 theme-border">
          <div class="flex items-center justify-between gap-3">
            <h3 class="text-lg font-semibold theme-text-primary">Draft Report Issues</h3>
            <Button variant="secondary" size="sm" on:click={closeIssuesModal}>Close</Button>
          </div>
          <p class="mt-1 text-sm theme-text-secondary">
            Resolve all issues below before submitting report.
          </p>
        </div>
        <div class="max-h-[60vh] overflow-y-auto px-6 py-4">
          <ol class="list-decimal space-y-2 pl-5">
            {#each blockingIssues as issue}
              <li class="text-sm {issue.type === 'error' ? 'text-red-700 dark:text-red-300' : 'text-amber-700 dark:text-amber-300'}">
                <span class="ml-1">{issue.type === 'error' ? 'Error:' : 'Warning:'} {issue.message}</span>
              </li>
            {/each}
          </ol>
        </div>
      </div>
    </div>
  {/if}
</div>
