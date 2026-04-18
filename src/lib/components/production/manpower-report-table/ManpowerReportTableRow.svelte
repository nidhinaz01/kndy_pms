<script lang="ts">
  import ManpowerIconHintButton from '../manpower-table/ManpowerIconHintButton.svelte';
  import { CheckCircle, XCircle, UserCheck, ArrowRight, Map, ClipboardList, Lock } from 'lucide-svelte';
  import type { ProductionEmployee } from '$lib/api/production';
  import { formatManpowerCOffHoursDisplay, isReportingAttendanceLocked } from '$lib/utils/manpowerTableUtils';
  import { attendanceIsPresent, attendanceIsAbsentUninformed, normalizeManpowerAttendanceStatus } from '$lib/utils/manpowerAttendanceStatus';

  export let employee: ProductionEmployee;
  export let isSelected: boolean = false;
  export let reportingSubmissionStatus: any = null;
  /** Current tab's stage. Reassign is only enabled when this equals the employee's home stage (original_stage). */
  export let parentStageCode: string = '';
  export let onToggleSelection: () => void = () => {};
  export let onAttendanceToggle: () => void = () => {};
  export let onStageReassignment: () => void = () => {};
  export let onViewJourney: () => void = () => {};
  export let onViewWorks: () => void = () => {};

  $: canReassignFromThisStage = !parentStageCode || employee.original_stage === parentStageCode;

  $: attendanceLabel = isReportingAttendanceLocked(employee, reportingSubmissionStatus)
    ? 'Attendance Locked'
    : 'Mark Attendance';

  $: reassignHint = !canReassignFromThisStage
    ? `Reassign — from home stage (${employee.original_stage || '—'}) only`
    : 'Reassign';

  // Get shift hours from attendance
  $: shiftHoursPlanned = employee.planned_hours ?? null; // From planning attendance
  $: shiftHoursReported = employee.actual_hours ?? null; // From reporting attendance

  // Highlight if employee is present and work hours don't match shift hours
  let hasMismatchedPlannedHours = false;
  let hasMismatchedReportedHours = false;
  
  $: {
    const workHoursPlanned = employee.hours_planned || 0;
    const workHoursReported = employee.hours_reported || 0;
    const isPresent = attendanceIsPresent(employee.attendance_status);
    
    // Check planned hours mismatch
    const hasPlannedHours = shiftHoursPlanned !== null && shiftHoursPlanned !== undefined;
    hasMismatchedPlannedHours = isPresent && hasPlannedHours && workHoursPlanned !== shiftHoursPlanned;
    
    // Check reported hours mismatch
    const hasReportedHours = shiftHoursReported !== null && shiftHoursReported !== undefined;
    hasMismatchedReportedHours = isPresent && hasReportedHours && workHoursReported !== shiftHoursReported;
  }
  
  // Format hours to show up to 2 decimal places, removing trailing zeros
  function formatHours(hours: number | null | undefined): string {
    if (hours === null || hours === undefined) return '0';
    const formatted = hours.toFixed(2);
    // Remove trailing zeros and decimal point if not needed
    return formatted.replace(/\.?0+$/, '');
  }
  
  // Check if any column should be highlighted
  $: hasMismatchedHours = hasMismatchedPlannedHours || hasMismatchedReportedHours;
</script>

<tr class="hover:theme-bg-secondary transition-colors {hasMismatchedHours ? '!bg-yellow-50 dark:!bg-yellow-900/30 !border-l-4 !border-yellow-500' : ''} {attendanceIsAbsentUninformed(employee.attendance_status) ? '!bg-red-50 dark:!bg-red-950/25' : ''}">
  <td class="px-6 py-4 whitespace-nowrap">
    <input 
      type="checkbox" 
      checked={isSelected}
      on:change={onToggleSelection}
      class="rounded theme-border"
    />
  </td>
  <td class="px-6 py-4 whitespace-nowrap">
    <div>
      <div class="text-sm font-medium {hasMismatchedHours ? 'text-gray-900 dark:text-yellow-100' : 'theme-text-primary'}">{employee.emp_name}</div>
      <div class="text-sm {hasMismatchedHours ? 'text-gray-700 dark:text-yellow-200' : 'theme-text-secondary'}">{employee.emp_id}</div>
    </div>
  </td>
  <td class="px-6 py-4 whitespace-nowrap text-sm {hasMismatchedHours ? '!text-gray-900 dark:!text-yellow-100' : 'theme-text-primary'}">
    {employee.skill_short}
  </td>
  <td class="px-6 py-4 whitespace-nowrap">
    {#if attendanceIsPresent(employee.attendance_status)}
      <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-600 dark:bg-green-900 dark:text-green-200">
        <CheckCircle class="w-3 h-3 mr-1" />
        Present
      </span>
    {:else if normalizeManpowerAttendanceStatus(employee.attendance_status) === 'absent_informed'}
      <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200">
        <XCircle class="w-3 h-3 mr-1" />
        Absent (Informed)
      </span>
    {:else if attendanceIsAbsentUninformed(employee.attendance_status)}
      <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-200 ring-1 ring-red-300 dark:ring-red-700">
        <XCircle class="w-3 h-3 mr-1" />
        Absent (Uninformed)
      </span>
    {:else}
      <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600 dark:bg-gray-900 dark:text-gray-200">
        <UserCheck class="w-3 h-3 mr-1" />
        Not Marked
      </span>
    {/if}
  </td>
  <td class="px-6 py-4 whitespace-nowrap text-sm tabular-nums {hasMismatchedHours ? '!text-gray-900 dark:!text-yellow-100' : 'theme-text-primary'}">
    {formatManpowerCOffHoursDisplay(employee.c_off_value)}
  </td>
  <td class="px-6 py-4 whitespace-nowrap text-sm tabular-nums {hasMismatchedHours ? '!text-gray-900 dark:!text-yellow-100' : 'theme-text-primary'}">
    {formatHours(employee.manpower_ot_hours ?? 0)}h
  </td>
  <td class="px-6 py-4 whitespace-nowrap">
    <div class="flex items-center space-x-2">
      <div class="flex flex-col">
        <span class="text-sm font-medium theme-text-primary">{employee.current_stage}</span>
        {#if employee.original_stage && employee.original_stage !== employee.current_stage}
          <span class="text-xs theme-text-secondary">(Original: {employee.original_stage})</span>
        {/if}
      </div>
      <ManpowerIconHintButton
        label={reassignHint}
        disabled={!canReassignFromThisStage || !attendanceIsPresent(employee.attendance_status)}
        on:click={onStageReassignment}
      >
        <ArrowRight class="w-4 h-4" />
      </ManpowerIconHintButton>
    </div>
  </td>
  <td class="px-6 py-4 whitespace-nowrap">
    <div>
      <div class="text-sm font-medium {hasMismatchedHours ? 'text-gray-900 dark:text-yellow-100' : 'theme-text-primary'}">{employee.shift_code}</div>
      <div class="text-sm {hasMismatchedHours ? 'text-gray-700 dark:text-yellow-200' : 'theme-text-secondary'}">{employee.shift_name}</div>
    </div>
  </td>
  <td class="px-6 py-4 whitespace-nowrap text-sm {hasMismatchedPlannedHours ? '!text-gray-900 dark:!text-yellow-100' : 'theme-text-primary'}">
    {#if attendanceIsPresent(employee.attendance_status) && shiftHoursPlanned !== null}
      {formatHours(employee.hours_planned || 0)}h/{formatHours(shiftHoursPlanned)}h
    {:else}
      {formatHours(employee.hours_planned || 0)}h
    {/if}
  </td>
  <td class="px-6 py-4 whitespace-nowrap text-sm {hasMismatchedReportedHours ? '!text-gray-900 dark:!text-yellow-100' : 'theme-text-primary'}">
    {#if attendanceIsPresent(employee.attendance_status) && shiftHoursReported !== null}
      {formatHours(employee.hours_reported || 0)}h/{formatHours(shiftHoursReported)}h
    {:else}
      {formatHours(employee.hours_reported || 0)}h
    {/if}
  </td>
  <td class="px-6 py-4 whitespace-nowrap text-sm {hasMismatchedHours ? '!text-gray-900 dark:!text-yellow-100' : 'theme-text-primary'}">
    {employee.ot_hours || 0}h
  </td>
  <td class="px-6 py-4 whitespace-nowrap text-sm {hasMismatchedHours ? '!text-gray-900 dark:!text-yellow-100' : 'theme-text-primary'}">
    {employee.lt_hours || 0}h
  </td>
  <td class="px-6 py-4 whitespace-nowrap text-sm {hasMismatchedHours ? '!text-gray-900 dark:!text-yellow-100' : 'theme-text-primary'}">
    {employee.ltp_hours || 0}h
  </td>
  <td class="px-6 py-4 whitespace-nowrap text-sm {hasMismatchedHours ? '!text-gray-900 dark:!text-yellow-100' : 'theme-text-primary'}">
    {employee.ltnp_hours || 0}h
  </td>
  <td class="px-6 py-4 whitespace-nowrap text-sm {hasMismatchedHours ? '!text-gray-900 dark:!text-yellow-100' : 'theme-text-primary'}">
    {employee.to_other_stage_hours || 0}h
  </td>
  <td class="px-6 py-4 whitespace-nowrap text-sm {hasMismatchedHours ? '!text-gray-900 dark:!text-yellow-100' : 'theme-text-primary'}">
    {employee.from_other_stage_hours || 0}h
  </td>
  <td class="px-6 py-4 whitespace-nowrap text-sm theme-text-primary">
    <div class="flex flex-row flex-nowrap items-center gap-1.5 overflow-x-auto sm:gap-2">
      <ManpowerIconHintButton
        label={attendanceLabel}
        disabled={isReportingAttendanceLocked(employee, reportingSubmissionStatus)}
        on:click={onAttendanceToggle}
      >
        {#if isReportingAttendanceLocked(employee, reportingSubmissionStatus)}
          <Lock class="w-4 h-4" />
        {:else}
          <UserCheck class="w-4 h-4" />
        {/if}
      </ManpowerIconHintButton>
      <ManpowerIconHintButton label="View Journey" on:click={onViewJourney}>
        <Map class="w-4 h-4" />
      </ManpowerIconHintButton>
      <ManpowerIconHintButton label="View Works" on:click={onViewWorks}>
        <ClipboardList class="w-4 h-4" />
      </ManpowerIconHintButton>
    </div>
  </td>
</tr>

