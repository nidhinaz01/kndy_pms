<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import Button from '$lib/components/common/Button.svelte';
  import { formatTime, formatLostTimeDetails } from '../utils/timeUtils';
  import { groupReportWorks } from '../utils/planTabUtils';
  import { formatDateTimeLocal } from '$lib/utils/formatDate';
  import OvertimeReportingModal from './OvertimeReportingModal.svelte';
  import { calculateOvertime } from '$lib/services/overtimeCalculationService';
  import type { WorkerOvertime } from '$lib/services/overtimeCalculationService';

  export let draftReportData: any[] = [];
  export let draftManpowerReportData: any[] = [];
  export let isLoading: boolean = false;
  export let stageCode: string = '';
  export let selectedDate: string = '';
  export let expandedReportGroups: string[] = [];
  export let reportingSubmissionStatus: any = null;

  const dispatch = createEventDispatcher();

  let showOvertimeModal = false;
  let overtimeData: WorkerOvertime[] = [];
  let isCalculatingOT = false;
  let hasOvertime = false;
  let otReported = false;

  // Combine draft work reports (manpower reports have different structure, handle separately if needed)
  $: allDraftReports = draftReportData || [];
  $: groupedReportWorks = groupReportWorks(allDraftReports);
  $: totalReports = allDraftReports.length;

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

  function toggleReportGroup(workCode: string) {
    dispatch('toggleGroup', workCode);
  }

  async function handleReportOT() {
    isCalculatingOT = true;
    try {
      const result = await calculateOvertime(stageCode, selectedDate);
      if (result.hasOvertime) {
        overtimeData = result.workers;
        showOvertimeModal = true;
      } else {
        alert('No overtime detected. All workers are within their shift times.');
      }
    } catch (error) {
      console.error('Error calculating overtime:', error);
      alert(`Error calculating overtime: ${(error as Error).message}`);
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

  async function checkOvertime() {
    try {
      const result = await calculateOvertime(stageCode, selectedDate);
      hasOvertime = result.hasOvertime;
      
      // Check if OT has been reported (all reports have overtime_minutes set)
      if (hasOvertime && draftReportData.length > 0) {
        const reportsWithOT = draftReportData.filter((report: any) => 
          report.overtime_minutes !== null && report.overtime_minutes !== undefined && report.overtime_minutes > 0
        );
        // If all workers with OT have reported OT, consider it reported
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

  $: submissionStatusDisplay = (() => {
    if (!reportingSubmissionStatus) return null;
    const status = reportingSubmissionStatus.status;
    if (status === 'pending_approval') {
      return { text: 'Pending Approval', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400' };
    } else if (status === 'approved') {
      return { text: 'Approved', color: 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400' };
    } else if (status === 'rejected') {
      return { text: 'Rejected', color: 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400' };
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
      >
        {isPendingApproval ? 'Pending Approval' : isApproved ? 'Approved' : 'Submit Report'}
      </Button>
    </div>
  </div>
  
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
          {#each Object.values(groupedReportWorks) as group (group.workCode)}
            {@const typedGroup = group}
            <!-- Group Header Row -->
            <tr class="hover:theme-bg-secondary transition-colors cursor-pointer" 
                class:lost-time={typedGroup.hasLostTime}
                on:click={() => toggleReportGroup(typedGroup.workCode)}>
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
                  {@const firstItem = typedGroup.items[0]}
                  {#if firstItem.status === 'pending_approval'}
                    <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400">Pending Approval</span>
                  {:else if firstItem.status === 'approved'}
                    <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400">Approved</span>
                  {:else}
                    <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400">Draft</span>
                  {/if}
                {:else}
                  <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400">Draft</span>
                {/if}
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm {typedGroup.hasLostTime ? 'text-gray-800' : 'theme-text-primary'}" colspan="9">
                <div class="text-xs {typedGroup.hasLostTime ? 'text-gray-600' : 'theme-text-secondary'}">
                  Click to {expandedReportGroups.includes(typedGroup.workCode) ? 'collapse' : 'expand'} skill details
                </div>
              </td>
            </tr>
            
            <!-- Individual Skill Rows (when expanded) -->
            {#if expandedReportGroups.includes(typedGroup.workCode)}
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
                    {#if report?.vehicleWorkFlow?.estimated_duration_minutes}
                      {formatTime(report.vehicleWorkFlow.estimated_duration_minutes / 60)}
                    {:else if report?.skillTimeStandard?.standard_time_minutes}
                      {formatTime(report.skillTimeStandard.standard_time_minutes / 60)}
                    {:else}
                      N/A
                    {/if}
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
                      {#if report.deviations && report.deviations.length > 0}
                        {@const deviation = report.deviations[0]}
                        <div class="flex items-center space-x-2">
                          <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400">
                            ⚠️ Deviation: {deviation.deviation_type}
                          </span>
                        </div>
                        <div class="mt-1 text-xs text-orange-600 dark:text-orange-400">
                          {deviation.reason}
                        </div>
                      {:else if report.worker_id}
                        <div class="font-medium">{report.prdn_work_planning?.hr_emp?.emp_name || 'N/A'}</div>
                        <div class="text-xs {report.lt_minutes_total > 0 ? 'text-gray-600' : 'theme-text-secondary'}">({report.prdn_work_planning?.hr_emp?.skill_short || 'N/A'})</div>
                      {:else}
                        <span class="text-gray-400 italic">No worker assigned</span>
                      {/if}
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
          <span class="font-medium">Total Draft Reports:</span> {totalReports}
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
