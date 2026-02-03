<script lang="ts">
  import { onMount } from 'svelte';
  import Button from '$lib/components/common/Button.svelte';
  import { Users, X } from 'lucide-svelte';
  import { supabase } from '$lib/supabaseClient';
  import { calculateBreakTimeInMinutes } from '$lib/utils/breakTimeUtils';

  export let showModal: boolean = false;
  export let selectedCount: number = 0;
  export let selectedDate: string = '';
  export let shiftCode: string = ''; // Shift code for bulk operations
  export let bulkAttendanceStatus: 'present' | 'absent' = 'present';
  export let bulkNotes: string = '';
  export let isSubmitting: boolean = false;
  export let onStatusChange: (status: 'present' | 'absent') => void = () => {};
  export let onNotesChange: (notes: string) => void = () => {};
  export let onSubmit: () => void = () => {};
  export let onClose: () => void = () => {};

  // Time and hours fields (only for present) - bound from parent
  export let fromTime: string = '';
  export let toTime: string = '';
  export let plannedHours: number | null = null;
  
  // Shift information
  let shiftStartTime: string = '08:00';
  let shiftEndTime: string = '17:00';
  let fullShiftHours: number = 8;
  let shiftBreaks: Array<{ start_time: string; end_time: string }> = [];
  let isLoadingShiftInfo = false;

  // Calculate if notes is required
  $: isNotesRequired = bulkAttendanceStatus === 'present' && plannedHours !== null && plannedHours < fullShiftHours;
  $: notesLabel = isNotesRequired 
    ? 'Reason (Required for partial attendance):' 
    : 'Notes (Optional):';

  // Load shift information when modal opens
  async function loadShiftInfo() {
    if (!shiftCode) {
      console.warn('No shift code provided for bulk attendance');
      return;
    }

    isLoadingShiftInfo = true;
    try {
      // Get shift information
      const { data: shiftData, error: shiftError } = await supabase
        .from('hr_shift_master')
        .select('shift_id, start_time, end_time')
        .eq('shift_code', shiftCode)
        .eq('is_active', true)
        .eq('is_deleted', false)
        .maybeSingle();

      if (shiftError || !shiftData) {
        console.error('Error fetching shift info:', shiftError);
        return;
      }

      shiftStartTime = shiftData.start_time;
      shiftEndTime = shiftData.end_time;
      const shiftId = shiftData.shift_id;

      // Fetch shift breaks
      const { data: breaksData, error: breaksError } = await supabase
        .from('hr_shift_break_master')
        .select('start_time, end_time')
        .eq('shift_id', shiftId)
        .eq('is_active', true)
        .eq('is_deleted', false)
        .order('start_time', { ascending: true });

      if (breaksError) {
        console.error('Error fetching shift breaks:', breaksError);
      }

      // Store shift breaks for later use
      shiftBreaks = breaksData || [];

      // Calculate full shift hours (shift duration minus breaks)
      const shiftStart = new Date(`2000-01-01T${shiftStartTime}`);
      let shiftEnd = new Date(`2000-01-01T${shiftEndTime}`);
      if (shiftEnd < shiftStart) {
        shiftEnd = new Date(`2000-01-02T${shiftEndTime}`);
      }
      const shiftDurationMinutes = (shiftEnd.getTime() - shiftStart.getTime()) / (1000 * 60);
      
      const totalBreakMinutes = calculateBreakTimeInMinutes(
        shiftStartTime,
        shiftEndTime,
        shiftBreaks
      );
      
      fullShiftHours = (shiftDurationMinutes - totalBreakMinutes) / 60;

      // Set default times and hours
      if (!fromTime) fromTime = shiftStartTime;
      if (!toTime) toTime = shiftEndTime;
      if (plannedHours === null) plannedHours = fullShiftHours;
    } catch (error) {
      console.error('Error loading shift info:', error);
    } finally {
      isLoadingShiftInfo = false;
    }
  }

  // Calculate hours from time range
  function calculateHoursFromTimes() {
    if (!fromTime || !toTime) {
      plannedHours = null;
      return;
    }

    try {
      const start = new Date(`2000-01-01T${fromTime}`);
      let end = new Date(`2000-01-01T${toTime}`);
      if (end < start) {
        end = new Date(`2000-01-02T${toTime}`);
      }
      const durationMinutes = (end.getTime() - start.getTime()) / (1000 * 60);
      
      // Use shift breaks for calculation
      const breakMinutes = calculateBreakTimeInMinutes(fromTime, toTime, shiftBreaks);
      
      plannedHours = Math.max(0, (durationMinutes - breakMinutes) / 60);
    } catch (error) {
      console.error('Error calculating hours:', error);
      plannedHours = null;
    }
  }

  // Watch time changes to recalculate hours
  $: if (fromTime && toTime && bulkAttendanceStatus === 'present') {
    calculateHoursFromTimes();
  }

  // Reset and load shift info when modal opens
  $: if (showModal && shiftCode) {
    fromTime = '';
    toTime = '';
    plannedHours = null;
    loadShiftInfo();
  }

</script>

{#if showModal}
  <div class="fixed inset-0 bg-black bg-opacity-50 z-1000 flex items-center justify-center" on:click={onClose}>
    <div class="theme-bg-primary theme-border rounded-lg shadow-lg p-5 min-w-[500px] max-w-[600px]" on:click|stopPropagation>
      <div class="flex items-center mb-5">
        <div class="bg-blue-500 rounded-full w-10 h-10 flex items-center justify-center mr-4">
          <Users class="text-white text-xl" />
        </div>
        <div>
          <h3 class="theme-text-primary text-lg font-semibold m-0">Bulk Attendance Marking</h3>
          <p class="theme-text-secondary text-sm mt-1 m-0">
            Mark attendance for {selectedCount} selected employee{selectedCount > 1 ? 's' : ''}
          </p>
        </div>
        <button on:click={onClose} class="ml-auto theme-text-secondary hover:theme-text-primary">
          <X class="w-5 h-5" />
        </button>
      </div>

      <div class="theme-bg-secondary theme-border rounded-lg p-4 mb-5">
        <p class="theme-text-primary text-sm m-1">
          <strong>Date:</strong> {new Date(selectedDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' })}
        </p>
        <p class="theme-text-primary text-sm m-1">
          <strong>Selected Employees:</strong> {selectedCount}
        </p>
      </div>

      <div class="mb-5">
        <fieldset>
          <legend class="theme-text-primary mb-2 font-medium">Attendance Status:</legend>
          <div>
            <label class="flex items-center mb-2">
              <input 
                type="radio" 
                checked={bulkAttendanceStatus === 'present'}
                on:change={() => onStatusChange('present')}
                class="mr-2"
              />
              <span class="theme-text-primary">Present</span>
            </label>
            <label class="flex items-center">
              <input 
                type="radio" 
                checked={bulkAttendanceStatus === 'absent'}
                on:change={() => onStatusChange('absent')}
                class="mr-2"
              />
              <span class="theme-text-primary">Absent</span>
            </label>
          </div>
        </fieldset>
      </div>

      <!-- Time and Hours Fields (only for Present) -->
      {#if bulkAttendanceStatus === 'present'}
        {#if isLoadingShiftInfo}
          <div class="text-center mb-5" style="padding: 10px;">
            <p class="theme-text-secondary text-sm">Loading shift information...</p>
          </div>
        {:else}
          <div class="mb-5">
            <div class="grid grid-cols-2 gap-4 mb-4">
              <!-- From Time -->
              <div>
                <label for="bulk-from-time" class="block text-sm font-medium theme-text-primary mb-2">
                  From Time:
                </label>
                <input
                  id="bulk-from-time"
                  type="time"
                  bind:value={fromTime}
                  class="w-full px-3 py-2 border theme-border rounded-lg theme-bg-primary theme-text-primary focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <!-- To Time -->
              <div>
                <label for="bulk-to-time" class="block text-sm font-medium theme-text-primary mb-2">
                  To Time:
                </label>
                <input
                  id="bulk-to-time"
                  type="time"
                  bind:value={toTime}
                  class="w-full px-3 py-2 border theme-border rounded-lg theme-bg-primary theme-text-primary focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
            <!-- Planned Hours Display -->
            <div class="mb-4">
              <label class="block text-sm font-medium theme-text-primary mb-2">
                Planned Hours:
              </label>
              <div class="theme-bg-secondary theme-border rounded-lg p-3">
                <span class="theme-text-primary font-medium">
                  {plannedHours !== null ? `${plannedHours.toFixed(2)}h` : 'Calculating...'}
                </span>
                <span class="theme-text-secondary text-sm ml-2">
                  (Full shift: {fullShiftHours.toFixed(2)}h)
                </span>
              </div>
            </div>
          </div>
        {/if}
      {/if}

      <div class="mb-5">
        <label for="bulk-notes" class="block text-sm font-medium theme-text-primary mb-2">
          {notesLabel}
        </label>
        <textarea
          id="bulk-notes"
          value={bulkNotes}
          on:input={(e) => onNotesChange(e.currentTarget.value)}
          placeholder={isNotesRequired ? "Enter reason for partial attendance..." : "Add any notes about this attendance marking..."}
          class="w-full px-3 py-2 border theme-border rounded-lg theme-bg-primary theme-text-primary focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          rows="3"
          required={isNotesRequired}
        />
        {#if isNotesRequired && !bulkNotes.trim()}
          <p class="text-red-500 dark:text-red-400 text-sm mt-1">
            Reason is required for partial attendance
          </p>
        {/if}
      </div>

      <div class="flex justify-end gap-2">
        <Button variant="secondary" on:click={onClose} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button variant="primary" on:click={onSubmit} disabled={isSubmitting || selectedCount === 0}>
          {isSubmitting ? 'Submitting...' : 'Mark Attendance'}
        </Button>
      </div>
    </div>
  </div>
{/if}

<style>
  :global(.z-1000) {
    z-index: 1000;
  }
</style>

