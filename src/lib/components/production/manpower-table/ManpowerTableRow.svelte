<script lang="ts">
  import Button from '$lib/components/common/Button.svelte';
  import { CheckCircle, XCircle, UserCheck, ArrowRight, Map } from 'lucide-svelte';
  import type { ProductionEmployee } from '$lib/api/production';
  import { isPlanningAttendanceLocked } from '$lib/utils/manpowerTableUtils';

  export let employee: ProductionEmployee;
  export let isSelected: boolean = false;
  export let planningSubmissionStatus: any = null;
  export let onToggleSelection: () => void = () => {};
  export let onAttendanceToggle: () => void = () => {};
  export let onStageReassignment: () => void = () => {};
  export let onViewJourney: () => void = () => {};

  // Calculate total hours planned (hours_planned + to_other_stage_hours + from_other_stage_hours)
  $: totalHours = (employee.hours_planned || 0) + (employee.to_other_stage_hours || 0) + (employee.from_other_stage_hours || 0);
  // Get shift hours from attendance (planned_hours from attendance modal)
  $: shiftHoursPlanned = employee.planned_hours ?? null;
  
  // Highlight if employee is present and work hours don't match shift hours planned
  // This helps identify employees with mismatched work allocation (under or over allocation)
  let hasMismatchedHours = false;
  $: {
    const workHours = employee.hours_planned || 0;
    const shiftHours = shiftHoursPlanned;
    const isPresent = employee.attendance_status === 'present';
    const hasShiftHours = shiftHours !== null && shiftHours !== undefined;
    // Highlight when work hours ≠ shift hours (any mismatch - under or over allocation)
    const shouldHighlight = isPresent && hasShiftHours && workHours !== shiftHours;
    
    // Debug logging
    if (isPresent && hasShiftHours) {
      console.log('🔍 [ManpowerTableRow] Highlight check:', {
        empId: employee.emp_id,
        empName: employee.emp_name,
        workHours,
        shiftHours,
        isPresent,
        hasShiftHours,
        shouldHighlight,
        comparison: `${workHours} !== ${shiftHours} = ${workHours !== shiftHours}`
      });
    }
    
    hasMismatchedHours = shouldHighlight;
  }
  
  // Format hours to show up to 2 decimal places, removing trailing zeros
  function formatHours(hours: number): string {
    const formatted = hours.toFixed(2);
    // Remove trailing zeros and decimal point if not needed
    return formatted.replace(/\.?0+$/, '');
  }
</script>

<tr class="hover:theme-bg-secondary transition-colors {hasMismatchedHours ? '!bg-yellow-50 dark:!bg-yellow-900/30 !border-l-4 !border-yellow-500' : ''}">
  <td class="px-6 py-4 whitespace-nowrap">
    <input 
      type="checkbox" 
      checked={isSelected}
      on:change={onToggleSelection}
      class="rounded theme-border"
      disabled={isPlanningAttendanceLocked(employee, planningSubmissionStatus)}
    />
  </td>
  <td class="px-6 py-4 whitespace-nowrap">
    <div>
      <div class="text-sm font-medium {hasMismatchedHours ? 'text-gray-900 dark:text-yellow-100' : 'theme-text-primary'}">{employee.emp_name}</div>
      <div class="text-sm {hasMismatchedHours ? 'text-gray-700 dark:text-yellow-200' : 'theme-text-secondary'}">{employee.emp_id}</div>
    </div>
  </td>
  <td class="px-6 py-4 whitespace-nowrap text-sm {hasMismatchedHours ? 'text-gray-900 dark:text-yellow-100' : 'theme-text-primary'}">
    {employee.skill_short}
  </td>
  <td class="px-6 py-4 whitespace-nowrap">
    {#if employee.attendance_status === 'present'}
      <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-600 dark:bg-green-900 dark:text-green-200">
        <CheckCircle class="w-3 h-3 mr-1" />
        Present
      </span>
    {:else if employee.attendance_status === 'absent'}
      <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-600 dark:bg-red-900 dark:text-red-200">
        <XCircle class="w-3 h-3 mr-1" />
        Absent
      </span>
    {:else}
      <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600 dark:bg-gray-900 dark:text-gray-200">
        <UserCheck class="w-3 h-3 mr-1" />
        Not Marked
      </span>
    {/if}
  </td>
  <td class="px-6 py-4 whitespace-nowrap">
    <div class="flex items-center space-x-2">
      <div class="flex flex-col">
      <span class="text-sm font-medium {hasMismatchedHours ? 'text-gray-900 dark:text-yellow-100' : 'theme-text-primary'}">{employee.current_stage}</span>
        {#if employee.original_stage && employee.original_stage !== employee.current_stage}
          <span class="text-xs {hasMismatchedHours ? 'text-gray-700 dark:text-yellow-200' : 'theme-text-secondary'}">(Original: {employee.original_stage})</span>
        {/if}
      </div>
      <Button
        variant="secondary"
        size="sm"
        on:click={onStageReassignment}
        disabled={employee.attendance_status !== 'present' || !employee.attendance_from_time || !employee.attendance_to_time}
        title={employee.attendance_status !== 'present' 
          ? 'Attendance must be marked as Present' 
          : (!employee.attendance_from_time || !employee.attendance_to_time)
          ? 'Attendance time must be marked in attendance modal'
          : 'Reassign employee to another stage'}
      >
        <ArrowRight class="w-3 h-3 mr-1" />
        Reassign
      </Button>
    </div>
  </td>
  <td class="px-6 py-4 whitespace-nowrap">
    <div>
      <div class="text-sm font-medium {hasMismatchedHours ? 'text-gray-900 dark:text-yellow-100' : 'theme-text-primary'}">{employee.shift_code}</div>
      <div class="text-sm {hasMismatchedHours ? 'text-gray-700 dark:text-yellow-200' : 'theme-text-secondary'}">{employee.shift_name}</div>
    </div>
  </td>
  <td class="px-6 py-4 whitespace-nowrap text-sm {hasMismatchedHours ? 'text-gray-900 dark:text-yellow-100' : 'theme-text-primary'}">
    {#if employee.attendance_status === 'present' && shiftHoursPlanned !== null}
      {formatHours(employee.hours_planned || 0)}h/{formatHours(shiftHoursPlanned)}h
    {:else}
      {formatHours(employee.hours_planned || 0)}h
    {/if}
  </td>
  <td class="px-6 py-4 whitespace-nowrap text-sm {hasMismatchedHours ? 'text-gray-900 dark:text-yellow-100' : 'theme-text-primary'}">
    {employee.to_other_stage_hours || 0}h
  </td>
  <td class="px-6 py-4 whitespace-nowrap text-sm {hasMismatchedHours ? 'text-gray-900 dark:text-yellow-100' : 'theme-text-primary'}">
    {employee.from_other_stage_hours || 0}h
  </td>
  <td class="px-6 py-4 whitespace-nowrap text-sm {hasMismatchedHours ? 'text-gray-900 dark:text-yellow-100' : 'theme-text-primary'}">
    <div class="flex space-x-2">
      <Button
        variant="secondary"
        size="sm"
        on:click={onAttendanceToggle}
        disabled={isPlanningAttendanceLocked(employee, planningSubmissionStatus)}
      >
        {isPlanningAttendanceLocked(employee, planningSubmissionStatus) ? 'Attendance Locked' : 'Mark Attendance'}
      </Button>
      <Button
        variant="secondary"
        size="sm"
        on:click={onViewJourney}
      >
        <Map class="w-3 h-3 mr-1" />
        View Journey
      </Button>
    </div>
  </td>
</tr>

