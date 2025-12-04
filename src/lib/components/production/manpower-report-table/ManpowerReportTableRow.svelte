<script lang="ts">
  import Button from '$lib/components/common/Button.svelte';
  import { CheckCircle, XCircle, UserCheck, ArrowRight, Map } from 'lucide-svelte';
  import type { ProductionEmployee } from '$lib/api/production';
  import { isReportingAttendanceLocked } from '$lib/utils/manpowerTableUtils';

  export let employee: ProductionEmployee;
  export let isSelected: boolean = false;
  export let reportingSubmissionStatus: any = null;
  export let onToggleSelection: () => void = () => {};
  export let onAttendanceToggle: () => void = () => {};
  export let onStageReassignment: () => void = () => {};
  export let onViewJourney: () => void = () => {};
</script>

<tr class="hover:theme-bg-secondary transition-colors">
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
      <div class="text-sm font-medium theme-text-primary">{employee.emp_name}</div>
      <div class="text-sm theme-text-secondary">{employee.emp_id}</div>
    </div>
  </td>
  <td class="px-6 py-4 whitespace-nowrap text-sm theme-text-primary">
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
      <span class="text-sm font-medium theme-text-primary">{employee.current_stage}</span>
      <Button
        variant="secondary"
        size="sm"
        on:click={onStageReassignment}
        disabled={employee.attendance_status !== 'present'}
      >
        <ArrowRight class="w-3 h-3 mr-1" />
        Reassign
      </Button>
    </div>
  </td>
  <td class="px-6 py-4 whitespace-nowrap">
    <div>
      <div class="text-sm font-medium theme-text-primary">{employee.shift_code}</div>
      <div class="text-sm theme-text-secondary">{employee.shift_name}</div>
    </div>
  </td>
  <td class="px-6 py-4 whitespace-nowrap text-sm theme-text-primary">
    {employee.hours_planned || 0}h
  </td>
  <td class="px-6 py-4 whitespace-nowrap text-sm theme-text-primary">
    {employee.hours_reported || 0}h
  </td>
  <td class="px-6 py-4 whitespace-nowrap text-sm theme-text-primary">
    {employee.ot_hours || 0}h
  </td>
  <td class="px-6 py-4 whitespace-nowrap text-sm theme-text-primary">
    {employee.lt_hours || 0}h
  </td>
  <td class="px-6 py-4 whitespace-nowrap text-sm theme-text-primary">
    {employee.ltp_hours || 0}h
  </td>
  <td class="px-6 py-4 whitespace-nowrap text-sm theme-text-primary">
    {employee.ltnp_hours || 0}h
  </td>
  <td class="px-6 py-4 whitespace-nowrap text-sm theme-text-primary">
    {employee.to_other_stage_hours || 0}h
  </td>
  <td class="px-6 py-4 whitespace-nowrap text-sm theme-text-primary">
    {employee.from_other_stage_hours || 0}h
  </td>
  <td class="px-6 py-4 whitespace-nowrap text-sm theme-text-primary">
    <div class="flex space-x-2">
      <Button
        variant="secondary"
        size="sm"
        on:click={onAttendanceToggle}
        disabled={isReportingAttendanceLocked(employee, reportingSubmissionStatus)}
      >
        {isReportingAttendanceLocked(employee, reportingSubmissionStatus) ? 'Attendance Locked' : 'Mark Attendance'}
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

