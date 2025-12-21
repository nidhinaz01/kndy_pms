<script lang="ts">
  import TimePicker from '$lib/components/common/TimePicker.svelte';
  import type { ShiftInfo, TimeSlot } from '$lib/types/planWork';
  import { generateTimeSlots, formatTime } from '$lib/utils/planWorkUtils';

  export let fromDate: string = '';
  export let toDate: string = '';
  export let fromTime: string = '';
  export let toTime: string = '';
  
  // Make fromTime bindable
  $: if (fromTime !== undefined) {
    // This ensures the prop is reactive
  }
  export let plannedHours: number = 0;
  export let shiftInfo: ShiftInfo | null = null;
  export let work: any = null;
  export let onFromTimeChange: (value: string) => void = () => {};
  export let onAutoCalculate: () => void = () => {};
  export let onFromDateChange: ((value: string) => void) | null = null;
  export let onToDateChange: ((value: string) => void) | null = null;
</script>

<div class="space-y-4">
  <div class="flex items-center justify-between">
    <h4 class="font-medium theme-text-primary">Time Planning</h4>
    {#if work?.std_vehicle_work_flow?.estimated_duration_minutes}
      <button
        type="button"
        class="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 font-medium"
        on:click={onAutoCalculate}
      >
        Auto Calculate End Time
      </button>
    {/if}
  </div>
  
  <!-- Date Selection -->
  <div class="grid grid-cols-2 gap-4">
    <div>
      <label for="from-date-input" class="block text-sm font-medium theme-text-primary mb-2">
        From Date
      </label>
      <input
        id="from-date-input"
        type="date"
        value={fromDate}
        on:change={(e) => {
          const value = e.currentTarget.value;
          if (onFromDateChange) {
            onFromDateChange(value);
          }
        }}
        class="w-full px-3 py-2 border theme-border rounded-lg theme-bg-primary theme-text-primary focus:ring-2 focus:ring-blue-500 focus:border-transparent"
      />
    </div>
    <div>
      <label for="to-date-input" class="block text-sm font-medium theme-text-primary mb-2">
        To Date
      </label>
      <input
        id="to-date-input"
        type="date"
        value={toDate}
        on:change={(e) => {
          const value = e.currentTarget.value;
          if (onToDateChange) {
            onToDateChange(value);
          }
        }}
        class="w-full px-3 py-2 border theme-border rounded-lg theme-bg-primary theme-text-primary focus:ring-2 focus:ring-blue-500 focus:border-transparent"
      />
    </div>
  </div>
  
  <!-- Time Selection -->
  <div class="grid grid-cols-2 gap-4">
    <div>
      <label for="from-time-select" class="block text-sm font-medium theme-text-primary mb-2">
        From Time
      </label>
      <select
        id="from-time-select"
        value={fromTime}
        on:change={(e) => onFromTimeChange(e.currentTarget.value)}
        class="w-full px-3 py-2 border theme-border rounded-lg theme-bg-primary theme-text-primary focus:ring-2 focus:ring-blue-500 focus:border-transparent"
      >
        <option value="">Select time...</option>
        {#if shiftInfo?.hr_shift_master?.start_time && shiftInfo?.hr_shift_master?.end_time}
          {@const timeSlots = generateTimeSlots(shiftInfo.hr_shift_master.start_time, shiftInfo.hr_shift_master.end_time)}
          {#each timeSlots as slot}
            <option value={slot.value}>{slot.display}</option>
          {/each}
        {:else}
          <option value="" disabled>Shift information not available</option>
        {/if}
      </select>
    </div>
    <div>
      <TimePicker
        label="To Time"
        bind:value={toTime}
      />
    </div>
  </div>
  
  <!-- Shift Information Display -->
  {#if shiftInfo?.hr_shift_master}
    <div class="theme-bg-blue-50 dark:theme-bg-blue-900/20 rounded-lg p-3 border border-blue-200 dark:border-blue-800">
      <div class="text-sm text-blue-800 dark:text-blue-200">
        <div class="font-medium mb-1">Shift Information:</div>
        <div>
          Shift: {shiftInfo.hr_shift_master.shift_name} 
          ({shiftInfo.hr_shift_master.start_time} - {shiftInfo.hr_shift_master.end_time})
        </div>
      </div>
    </div>
  {/if}
  
  <!-- Auto-calculation Info -->
  {#if work?.std_vehicle_work_flow?.estimated_duration_minutes && fromTime}
    <div class="text-xs theme-text-secondary italic">
      Estimated duration: {formatTime(work.std_vehicle_work_flow.estimated_duration_minutes / 60)}
    </div>
  {/if}
</div>

<!-- Planned Hours Display -->
{#if plannedHours > 0}
  <div class="theme-bg-green-50 dark:theme-bg-green-900/20 rounded-lg p-3 border border-green-200 dark:border-green-800">
    <div class="text-sm text-green-800 dark:text-green-200">
      <span class="font-medium">Planned Hours:</span> {formatTime(plannedHours)}
    </div>
  </div>
{/if}

