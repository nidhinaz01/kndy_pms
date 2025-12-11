<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import Button from '$lib/components/common/Button.svelte';
  import { formatTime, formatLostTimeDetails } from '../utils/timeUtils';
  import { groupReportWorks } from '../utils/planTabUtils';
  import { formatDateTimeLocal } from '$lib/utils/formatDate';
  import OvertimeReportingModal from './OvertimeReportingModal.svelte';
  import { calculateOvertime } from '$lib/services/overtimeCalculationService';
  import type { WorkerOvertime } from '$lib/services/overtimeCalculationService';
  import { supabase } from '$lib/supabaseClient';

  export let draftReportData: any[] = [];
  export let draftManpowerReportData: any[] = [];
  export let isLoading: boolean = false;
  export let stageCode: string = '';
  export let selectedDate: string = '';
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

  function getUniqueSkills(items: any[]): string {
    if (!items || items.length === 0) return 'N/A';
    const skills = items
      .map(report => report.skillMapping?.sc_name || report.prdn_work_planning?.sc_required || 'N/A')
      .filter((skill, index, arr) => arr.indexOf(skill) === index); // Get unique values
    return skills.join(', ');
  }

  async function handleReportOT() {
    isCalculatingOT = true;
    try {
      // Always try calculateOvertime first
      const result = await calculateOvertime(stageCode, selectedDate);
      
      if (result.hasOvertime && result.workers.length > 0) {
        // Success: OT detected and workers data available
        overtimeData = result.workers;
        showOvertimeModal = true;
      } else if (hasOvertime) {
        // OT was detected by secondary validation, but calculateOvertime returned false
        // This usually means missing shift details or employee records
        console.warn('OT detected via secondary validation but calculateOvertime returned false:', result.errors);
        
        let errorMessage = 'Overtime has been detected, but the system cannot calculate the exact overtime values automatically.\n\n';
        errorMessage += 'Possible causes:\n';
        errorMessage += '• Workers missing shift codes\n';
        errorMessage += '• Shift details not configured\n';
        errorMessage += '• Employee records missing or incomplete\n';
        errorMessage += '• Reports missing worker assignments\n\n';
        
        if (result.errors && result.errors.length > 0) {
          errorMessage += 'Errors encountered:\n';
          result.errors.slice(0, 3).forEach((err: string) => {
            errorMessage += `• ${err}\n`;
          });
          if (result.errors.length > 3) {
            errorMessage += `• ... and ${result.errors.length - 3} more errors\n`;
          }
          errorMessage += '\n';
        }
        
        errorMessage += 'Please:\n';
        errorMessage += '1. Verify all workers have shift codes assigned\n';
        errorMessage += '2. Check that shift details are configured in the system\n';
        errorMessage += '3. Ensure all reports have valid worker assignments\n';
        errorMessage += '4. Refresh the page and try again\n\n';
        errorMessage += 'If the issue persists, you may need to manually update overtime values or contact support.';
        
        alert(errorMessage);
      } else {
        // No OT detected
        alert('No overtime detected. All workers are within their shift times.');
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

  async function checkOvertime() {
    try {
      const result = await calculateOvertime(stageCode, selectedDate);
      let detectedOvertime = result.hasOvertime;
      
      // Secondary validation: If calculateOvertime didn't detect OT, manually verify
      // This catches cases where calculateOvertime fails due to missing data or errors
      if (!detectedOvertime && draftReportData.length > 0) {
        const reportsWithWorkers = draftReportData.filter((r: any) => r.worker_id !== null);
        
        if (reportsWithWorkers.length > 0) {
          // Group reports by worker
          const reportsByWorker = new Map<string, any[]>();
          reportsWithWorkers.forEach((report: any) => {
            const workerId = report.worker_id;
            if (!reportsByWorker.has(workerId)) {
              reportsByWorker.set(workerId, []);
            }
            reportsByWorker.get(workerId)!.push(report);
          });
          
          // Get unique worker IDs to fetch their shift details
          const workerIds = Array.from(reportsByWorker.keys());
          const { data: workerShiftData } = await supabase
            .from('hr_emp')
            .select('emp_id, shift_code')
            .in('emp_id', workerIds)
            .eq('is_active', true)
            .eq('is_deleted', false);
          
          const workerShiftMap = new Map<string, string | undefined>();
          (workerShiftData || []).forEach((w: any) => {
            workerShiftMap.set(w.emp_id, w.shift_code);
          });
          
          // Get unique shift codes
          const shiftCodes = new Set<string>();
          workerShiftMap.forEach((shiftCode) => {
            if (shiftCode) shiftCodes.add(shiftCode);
          });
          
          // Fetch shift details
          const shiftDetailsMap = new Map<string, { startTime: string; endTime: string; breakTimes: any[] }>();
          for (const shiftCode of shiftCodes) {
            const { data: shiftData } = await supabase
              .from('hr_shift_master')
              .select('shift_id, start_time, end_time')
              .eq('shift_code', shiftCode)
              .eq('is_active', true)
              .eq('is_deleted', false)
              .maybeSingle();
            
            if (shiftData) {
              const { data: breaksData } = await supabase
                .from('hr_shift_break_master')
                .select('start_time, end_time')
                .eq('shift_id', shiftData.shift_id)
                .eq('is_active', true)
                .eq('is_deleted', false)
                .order('start_time', { ascending: true });
              
              shiftDetailsMap.set(shiftCode, {
                startTime: shiftData.start_time,
                endTime: shiftData.end_time,
                breakTimes: breaksData || []
              });
            }
          }
          
          // Helper function to convert time to minutes
          const timeToMinutes = (timeStr: string): number => {
            if (!timeStr) return 0;
            const parts = timeStr.split(':');
            const hours = parseInt(parts[0] || '0', 10);
            const minutes = parseInt(parts[1] || '0', 10);
            return hours * 60 + minutes;
          };
          
          // Helper function to calculate break time
          const calculateBreakTime = (startTime: string, endTime: string, breakTimes: any[]): number => {
            if (!breakTimes || breakTimes.length === 0) return 0;
            let totalBreak = 0;
            const startMin = timeToMinutes(startTime);
            let endMin = timeToMinutes(endTime);
            if (endMin < startMin) endMin += 24 * 60;
            
            breakTimes.forEach((bt: any) => {
              let breakStart = timeToMinutes(bt.start_time);
              let breakEnd = timeToMinutes(bt.end_time);
              if (breakEnd < breakStart) breakEnd += 24 * 60;
              
              const overlapStart = Math.max(startMin, breakStart);
              const overlapEnd = Math.min(endMin, breakEnd);
              if (overlapStart < overlapEnd) {
                totalBreak += (overlapEnd - overlapStart);
              }
            });
            return totalBreak;
          };
          
          // Check each worker for potential OT
          for (const [workerId, workerReports] of reportsByWorker.entries()) {
            const shiftCode = workerShiftMap.get(workerId);
            
            // Calculate total worked time for this worker
            let totalWorkedMinutes = 0;
            workerReports.forEach((report: any) => {
              const workedMinutes = report.hours_worked_today 
                ? Math.round(report.hours_worked_today * 60)
                : 0;
              totalWorkedMinutes += workedMinutes;
            });
            
            // Check if OT has been reported for this worker
            const hasReportedOT = workerReports.some((r: any) => 
              r.overtime_minutes !== null && 
              r.overtime_minutes !== undefined &&
              r.overtime_minutes > 0
            );
            
            if (hasReportedOT) continue; // OT already reported, skip
            
            // If worker has shift details, calculate available work time
            if (shiftCode) {
              const shiftDetails = shiftDetailsMap.get(shiftCode);
              if (shiftDetails) {
                const shiftStartMin = timeToMinutes(shiftDetails.startTime);
                let shiftEndMin = timeToMinutes(shiftDetails.endTime);
                if (shiftEndMin < shiftStartMin) shiftEndMin += 24 * 60;
                
                const shiftDuration = shiftEndMin - shiftStartMin;
                const breakMinutes = calculateBreakTime(shiftDetails.startTime, shiftDetails.endTime, shiftDetails.breakTimes);
                const availableWorkMinutes = shiftDuration - breakMinutes;
                
                // If total worked time exceeds available work time, OT exists
                if (totalWorkedMinutes > availableWorkMinutes) {
                  detectedOvertime = true;
                  break; // Found OT, no need to check other workers
                }
              } else {
                // No shift details found - use conservative check (8 hours)
                if (totalWorkedMinutes > 480) {
                  detectedOvertime = true;
                  break;
                }
              }
            } else {
              // No shift code - use conservative check (8 hours)
              if (totalWorkedMinutes > 480) {
                detectedOvertime = true;
                break;
              }
            }
          }
        }
      }
      
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
          // Secondary validation detected OT, check if any reports have OT values
          const reportsWithOT = draftReportData.filter((report: any) => 
            report.overtime_minutes !== null && 
            report.overtime_minutes !== undefined && 
            report.overtime_minutes > 0
          );
          // If we have reports with OT, consider it partially reported
          // But we can't fully verify without calculateOvertime workers list
          otReported = reportsWithOT.length > 0;
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
          {#each Object.values(groupedReportWorks) as group (group.workCode)}
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
                      {:else if report.worker_id}
                        <span class="font-medium">{report.prdn_work_planning?.hr_emp?.emp_name || 'N/A'}</span>
                        <span class="text-xs {report.lt_minutes_total > 0 ? 'text-gray-600' : 'theme-text-secondary'}"> ({report.prdn_work_planning?.hr_emp?.skill_short || 'N/A'})</span>
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
                </tr>
          {/each}
        </tbody>
      </table>
    </div>

    <!-- Summary -->
    <div class="mt-6 px-6 py-4 theme-bg-secondary border-t theme-border">
      <div class="flex flex-wrap gap-4 text-sm">
        <div class="theme-text-secondary">
          <span class="font-medium">Total Draft Reports:</span> {Object.keys(groupedReportWorks).length}
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
