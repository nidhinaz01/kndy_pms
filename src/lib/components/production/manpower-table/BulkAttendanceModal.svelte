<script lang="ts">
  import { onMount } from 'svelte';
  import Button from '$lib/components/common/Button.svelte';
  import { Users } from 'lucide-svelte';
  import { supabase } from '$lib/supabaseClient';
  import { calculateBreakTimeInMinutes } from '$lib/utils/breakTimeUtils';
  import { computeCOffToEndWithBreaks } from '$lib/utils/cOffWindowUtils';
  import { validateCOffWithinAttendanceWindow } from '$lib/utils/attendanceCOffSpanUtils';
  import {
    getShiftHourLimitHours,
    MANPOWER_COFF_OT_BALANCE_EPS,
    MANPOWER_REPORT_NOTES_FULL_SHIFT_EPS,
    validateManpowerOtCoffBalance
  } from '$lib/utils/shiftHourLimitUtils';
  import {
    attendanceClearsPlanReportFields,
    attendanceIsPresent,
    type ManpowerAttendanceStatus
  } from '$lib/utils/manpowerAttendanceStatus';

  export let showModal: boolean = false;
  export let selectedCount: number = 0;
  export let selectedDate: string = '';
  export let shiftCode: string = ''; // Shift code for bulk operations
  export let bulkAttendanceStatus: ManpowerAttendanceStatus = 'present';
  export let bulkNotes: string = '';
  export let isSubmitting: boolean = false;
  export let onStatusChange: (status: ManpowerAttendanceStatus) => void = () => {};
  export let onNotesChange: (notes: string) => void = () => {};
  export let onSubmit: () => void = () => {};
  export let onClose: () => void = () => {};

  // Time and hours fields (only for present) - bound from parent
  export let fromTime: string = '';
  export let toTime: string = '';
  export let plannedHours: number | null = null;

  /** C-Off (present only); bound from parent */
  export let bulkCOffValue: number = 0;
  export let bulkCOffFromDate: string = '';
  export let bulkCOffFromTime: string = '';
  export let bulkCOffToDate: string = '';
  export let bulkCOffToTime: string = '';

  export let bulkOtHours: number = 0;
  export let bulkOtFromDate: string = '';
  export let bulkOtFromTime: string = '';
  export let bulkOtToDate: string = '';
  export let bulkOtToTime: string = '';

  // Shift information
  let shiftStartTime: string = '08:00';
  let shiftEndTime: string = '17:00';
  let fullShiftHours: number = 8;
  let shiftBreaks: Array<{ start_time: string; end_time: string }> = [];
  let isLoadingShiftInfo = false;
  let shiftHourLimitHours: number = 8;

  /** Only reset bound props / load shift once per open — avoids Svelte 5 bind feedback loops */
  let bulkShiftLoadedForOpen = false;

  $: if (!showModal) {
    bulkShiftLoadedForOpen = false;
  }

  $: if (attendanceClearsPlanReportFields(bulkAttendanceStatus)) {
    bulkCOffValue = 0;
    bulkCOffFromDate = '';
    bulkCOffFromTime = '';
    bulkCOffToDate = '';
    bulkCOffToTime = '';
    bulkOtHours = 0;
    bulkOtFromDate = '';
    bulkOtFromTime = '';
    bulkOtToDate = '';
    bulkOtToTime = '';
  }

  function bulkDayStr(): string {
    return typeof selectedDate === 'string' ? selectedDate.split('T')[0] : '';
  }

  function bulkOtNumeric(v: unknown): number {
    const n = typeof v === 'string' ? parseFloat(v) : Number(v);
    return Number.isFinite(n) ? n : 0;
  }

  $: bulkOtNum = bulkOtNumeric(bulkOtHours);
  $: bulkShowOtDateTimeFields = attendanceIsPresent(bulkAttendanceStatus) && bulkOtNum > 0;

  /** Only while modal is open — avoids bind churn with parent state when modal is closed (Svelte 5 depth errors). */
  $: if (showModal && attendanceIsPresent(bulkAttendanceStatus)) {
    if (bulkOtNum > 0) {
      const d = bulkDayStr();
      if (d) {
        if (!bulkOtFromDate?.trim()) bulkOtFromDate = d;
        if (!bulkOtToDate?.trim()) bulkOtToDate = d;
      }
    } else {
      bulkOtFromDate = '';
      bulkOtFromTime = '';
      bulkOtToDate = '';
      bulkOtToTime = '';
    }
  }

  function syncBulkCOffToEndFromStart() {
    if (bulkCOffValue <= 0) return;
    if (!bulkCOffFromDate?.trim() || !bulkCOffFromTime?.trim()) return;
    const { toDate, toTime } = computeCOffToEndWithBreaks(
      bulkCOffFromDate,
      bulkCOffFromTime,
      bulkCOffValue,
      shiftBreaks
    );
    bulkCOffToDate = toDate;
    bulkCOffToTime = toTime;
  }

  // Calculate if notes is required (compare net hours to nominal full shift only)
  $: isNotesRequired =
    attendanceIsPresent(bulkAttendanceStatus) &&
    plannedHours !== null &&
    plannedHours < fullShiftHours - MANPOWER_REPORT_NOTES_FULL_SHIFT_EPS;

  /** When net hours ≤ shift hour limit, C‑Off/OT must be zero — run imperatively (not `$:`) to avoid bind feedback loops. */
  function maybeClearBulkOtCoffWhenNetAtOrBelowLimit() {
    if (!attendanceIsPresent(bulkAttendanceStatus)) return;
    if (plannedHours == null || !Number.isFinite(plannedHours)) return;
    if (!Number.isFinite(shiftHourLimitHours)) return;
    if (plannedHours - shiftHourLimitHours > MANPOWER_COFF_OT_BALANCE_EPS) return;
    if (bulkCOffValue <= 0 && bulkOtNumeric(bulkOtHours) <= 0) return;
    bulkCOffValue = 0;
    bulkCOffFromDate = '';
    bulkCOffFromTime = '';
    bulkCOffToDate = '';
    bulkCOffToTime = '';
    bulkOtHours = 0;
    bulkOtFromDate = '';
    bulkOtFromTime = '';
    bulkOtToDate = '';
    bulkOtToTime = '';
  }

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

      try {
        shiftHourLimitHours = await getShiftHourLimitHours();
      } catch {
        shiftHourLimitHours = 8;
      }

      // Set default times and hours (normalize to HH:MM)
      if (!fromTime) fromTime = shiftStartTime ? shiftStartTime.substring(0, 5) : '';
      if (!toTime) toTime = shiftEndTime ? shiftEndTime.substring(0, 5) : '';
      if (plannedHours === null) plannedHours = fullShiftHours;
    } catch (error) {
      console.error('Error loading shift info:', error);
    } finally {
      isLoadingShiftInfo = false;
      if (bulkCOffValue > 0 && bulkCOffFromDate?.trim() && bulkCOffFromTime?.trim()) {
        syncBulkCOffToEndFromStart();
      }
      maybeClearBulkOtCoffWhenNetAtOrBelowLimit();
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
      maybeClearBulkOtCoffWhenNetAtOrBelowLimit();
    } catch (error) {
      console.error('Error calculating hours:', error);
      plannedHours = null;
    }
  }

  // Watch time changes to recalculate hours (only when modal is open — closed modal still had bound times → feedback loop)
  $: if (showModal && fromTime && toTime && attendanceIsPresent(bulkAttendanceStatus)) {
    calculateHoursFromTimes();
  }

  // Reset and load shift info once when modal opens (not on every reactive flush while open)
  $: if (showModal && shiftCode && !bulkShiftLoadedForOpen) {
    bulkShiftLoadedForOpen = true;
    fromTime = '';
    toTime = '';
    plannedHours = null;
    loadShiftInfo();
  }

  async function handleSaveClick() {
    if (!attendanceIsPresent(bulkAttendanceStatus)) {
      onSubmit();
      return;
    }
    if (bulkCOffValue > 0) {
      if (!bulkCOffFromDate?.trim() || !bulkCOffFromTime?.trim()) {
        alert('C-Off: please set From Date and From Time when C-Off value is greater than zero.');
        return;
      }
      syncBulkCOffToEndFromStart();
      const day = bulkDayStr();
      const spanCheck = validateCOffWithinAttendanceWindow(bulkCOffValue, {
        attendanceFromDate: day,
        attendanceToDate: day,
        attendanceFromTime: (fromTime || '').trim(),
        attendanceToTime: (toTime || '').trim(),
        cOffFromDate: (bulkCOffFromDate || '').trim(),
        cOffFromTime: (bulkCOffFromTime || '').trim(),
        cOffToDate: (bulkCOffToDate || '').trim(),
        cOffToTime: (bulkCOffToTime || '').trim()
      });
      if (!spanCheck.ok) {
        alert(spanCheck.message);
        return;
      }
    }
    const otNum = Number.isFinite(Number(bulkOtHours)) ? Math.max(0, Number(bulkOtHours)) : 0;
    if (otNum > 0.001) {
      if (!bulkOtFromDate?.trim() || !bulkOtFromTime?.trim()) {
        alert('OT: please set From Date and From Time when OT hours are greater than zero.');
        return;
      }
    }
    let L = shiftHourLimitHours;
    try {
      L = await getShiftHourLimitHours();
    } catch {
      L = 8;
    }
    const bal = validateManpowerOtCoffBalance(plannedHours, L, bulkCOffValue, otNum);
    if (!bal.ok) {
      alert(bal.message);
      return;
    }
    onSubmit();
  }
</script>

{#if showModal}
  <!-- svelte-ignore a11y_click_events_have_key_events — backdrop dismiss; dialog handles keyboard -->
  <div
    class="fixed inset-0 z-[1000] flex items-center justify-center bg-black/50 p-3"
    role="presentation"
    on:click|self={onClose}
  >
    <div
      class="flex max-h-[min(92vh,900px)] min-h-0 w-full min-w-0 max-w-[1120px] flex-col rounded-lg border theme-border theme-bg-primary p-4 shadow-lg sm:px-[18px] sm:py-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="bulk-attendance-modal-title"
      tabindex="-1"
      on:click|stopPropagation
    >
      <div class="mb-3 flex shrink-0 items-center gap-3">
        <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-500">
          <Users class="h-5 w-5 text-white" aria-hidden="true" />
        </div>
        <div>
          <h3 id="bulk-attendance-modal-title" class="m-0 text-lg font-semibold theme-text-primary">
            Bulk Attendance Marking
          </h3>
          <p class="theme-text-secondary m-0 mt-1 text-sm">
            Mark attendance for {selectedCount} selected employee{selectedCount > 1 ? 's' : ''}
          </p>
        </div>
      </div>

      <div class="mb-3 shrink-0 rounded-lg border theme-border theme-bg-secondary p-2.5 sm:px-3">
        <p class="theme-text-primary m-1 text-sm">
          <strong>Date:</strong>
          {new Date(selectedDate).toLocaleDateString('en-GB', {
            day: '2-digit',
            month: 'short',
            year: '2-digit'
          })}
        </p>
        <p class="theme-text-primary m-1 text-sm">
          <strong>Selected:</strong>
          {selectedCount}
        </p>
      </div>

      <div class="mb-3 min-h-0 flex-1 overflow-auto">
        <div class="flex flex-row flex-wrap items-stretch gap-3.5">
          <section
            class="min-w-[180px] max-w-full flex-1 basis-[200px] rounded-lg border border-sky-300/80 bg-sky-50 p-3 text-slate-900 dark:border-sky-400/50 dark:bg-sky-100 dark:text-slate-900"
          >
            <fieldset class="m-0 border-0 p-0">
              <legend class="mb-2 text-sm font-semibold text-slate-900">Status</legend>
              <label class="mb-2 flex cursor-pointer items-center gap-2">
                <input
                  class="accent-blue-600"
                  type="radio"
                  checked={bulkAttendanceStatus === 'present'}
                  on:change={() => onStatusChange('present')}
                />
                <span class="text-sm text-slate-800">Present</span>
              </label>
              <label class="mb-2 flex cursor-pointer items-center gap-2">
                <input
                  class="accent-blue-600"
                  type="radio"
                  checked={bulkAttendanceStatus === 'absent_informed'}
                  on:change={() => onStatusChange('absent_informed')}
                />
                <span class="text-sm text-slate-800">Absent (Informed)</span>
              </label>
              <label class="flex cursor-pointer items-center gap-2">
                <input
                  class="accent-blue-600"
                  type="radio"
                  checked={bulkAttendanceStatus === 'absent_uninformed'}
                  on:change={() => onStatusChange('absent_uninformed')}
                />
                <span class="text-sm text-slate-800">Absent (Uninformed)</span>
              </label>
            </fieldset>
          </section>

          <section
            class="min-w-[180px] max-w-full flex-1 basis-[200px] rounded-lg border border-sky-300/80 bg-sky-50 p-3 text-slate-900 dark:border-sky-400/50 dark:bg-sky-100 dark:text-slate-900"
          >
            {#if attendanceIsPresent(bulkAttendanceStatus)}
              {#if isLoadingShiftInfo}
                <p class="text-sm text-slate-600">Loading shift…</p>
              {:else}
                <p class="mb-2 text-sm font-semibold text-slate-900">Shift times</p>
                <div class="mb-2 grid grid-cols-2 gap-2">
                  <div>
                    <label for="bulk-from-time" class="mb-1 block text-xs font-medium text-slate-700"
                      >From time</label
                    >
                    <input
                      id="bulk-from-time"
                      type="time"
                      bind:value={fromTime}
                      class="w-full rounded-md border px-2 py-1.5 text-sm theme-border theme-bg-primary theme-text-primary focus:border-transparent focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label for="bulk-to-time" class="mb-1 block text-xs font-medium text-slate-700"
                      >To time</label
                    >
                    <input
                      id="bulk-to-time"
                      type="time"
                      bind:value={toTime}
                      class="w-full rounded-md border px-2 py-1.5 text-sm theme-border theme-bg-primary theme-text-primary focus:border-transparent focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
                <div
                  class="rounded border border-dashed border-sky-400/70 bg-sky-200/50 p-2 text-slate-800 dark:border-sky-500/60 dark:bg-sky-200/40 dark:text-slate-900"
                >
                  <span class="text-sm font-medium text-slate-900">
                    Planned: {plannedHours !== null ? `${plannedHours.toFixed(2)}h` : '…'}
                  </span>
                  <span class="ml-1 text-xs text-slate-700">(full {fullShiftHours.toFixed(2)}h)</span>
                </div>
              {/if}
            {:else}
              <p class="text-sm text-slate-600">Times apply when present.</p>
            {/if}
          </section>

          <section
            class="min-w-[180px] max-w-full flex-1 basis-[200px] rounded-lg border border-sky-300/80 bg-sky-50 p-3 text-slate-900 dark:border-sky-400/50 dark:bg-sky-100 dark:text-slate-900"
          >
            {#if attendanceIsPresent(bulkAttendanceStatus)}
              <p class="mb-2 text-sm font-semibold text-slate-900">C-Off (optional)</p>
              <label class="mb-1 block text-xs font-medium text-slate-700" for="bulk-coff-value"
                >Value (days)</label
              >
              <select
                id="bulk-coff-value"
                value={String(bulkCOffValue)}
                on:change={(e) => {
                  const v = parseFloat(e.currentTarget.value);
                  const next = [0, 0.5, 1, 1.5].includes(v) ? v : 0;
                  bulkCOffValue = next;
                  if (next <= 0) {
                    bulkCOffFromDate = '';
                    bulkCOffFromTime = '';
                    bulkCOffToDate = '';
                    bulkCOffToTime = '';
                  } else {
                    if (!bulkCOffFromDate?.trim()) bulkCOffFromDate = bulkDayStr();
                    if (!bulkCOffFromTime?.trim() && fromTime?.trim())
                      bulkCOffFromTime = fromTime.trim().substring(0, 5);
                    syncBulkCOffToEndFromStart();
                  }
                }}
                class="mb-2 w-full rounded-md border px-2 py-1.5 text-sm theme-border theme-bg-primary theme-text-primary focus:border-transparent focus:ring-2 focus:ring-blue-500"
              >
                <option value="0">0</option>
                <option value="0.5">0.5 (4h)</option>
                <option value="1">1 (8h)</option>
                <option value="1.5">1.5 (12h)</option>
              </select>
              {#if bulkCOffValue > 0}
                <div class="grid grid-cols-2 gap-2">
                  <div>
                    <label for="bulk-coff-from-date" class="mb-1 block text-xs font-medium text-slate-700"
                      >From date *</label
                    >
                    <input
                      id="bulk-coff-from-date"
                      type="date"
                      bind:value={bulkCOffFromDate}
                      on:change={syncBulkCOffToEndFromStart}
                      class="w-full rounded-md border px-2 py-1.5 text-sm theme-border theme-bg-primary theme-text-primary focus:border-transparent focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label for="bulk-coff-from-time" class="mb-1 block text-xs font-medium text-slate-700"
                      >From time *</label
                    >
                    <input
                      id="bulk-coff-from-time"
                      type="time"
                      bind:value={bulkCOffFromTime}
                      on:change={syncBulkCOffToEndFromStart}
                      class="w-full rounded-md border px-2 py-1.5 text-sm theme-border theme-bg-primary theme-text-primary focus:border-transparent focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label for="bulk-coff-to-date" class="mb-1 block text-xs font-medium text-slate-700"
                      >To date</label
                    >
                    <input
                      id="bulk-coff-to-date"
                      type="date"
                      bind:value={bulkCOffToDate}
                      class="w-full rounded-md border px-2 py-1.5 text-sm theme-border theme-bg-primary theme-text-primary focus:border-transparent focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label for="bulk-coff-to-time" class="mb-1 block text-xs font-medium text-slate-700"
                      >To time</label
                    >
                    <input
                      id="bulk-coff-to-time"
                      type="time"
                      bind:value={bulkCOffToTime}
                      class="w-full rounded-md border px-2 py-1.5 text-sm theme-border theme-bg-primary theme-text-primary focus:border-transparent focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
                <p class="m-0 mt-2 text-xs leading-snug text-slate-600">
                  To end uses net hours (0.5 / 1 / 1.5 day) plus shift breaks in that window—editable. C-Off must
                  fall entirely within attendance times. (Net hours − {shiftHourLimitHours}h) = C‑Off hours + OT
                  hours.
                </p>
              {:else}
                <p class="m-0 mt-2 text-xs leading-snug text-slate-600">
                  Select a C‑Off value (days) above to enter from/to dates and times.
                </p>
              {/if}
            {:else}
              <p class="text-sm text-slate-600">C-Off cleared when absent.</p>
            {/if}
          </section>

          <section
            class="min-w-[180px] max-w-full flex-1 basis-[200px] rounded-lg border border-sky-300/80 bg-sky-50 p-3 text-slate-900 dark:border-sky-400/50 dark:bg-sky-100 dark:text-slate-900"
          >
            {#if attendanceIsPresent(bulkAttendanceStatus)}
              <p class="mb-2 text-sm font-semibold text-slate-900">Overtime (optional)</p>
              <label class="mb-1 block text-xs font-medium text-slate-700" for="bulk-ot-hours">OT hours</label>
              <input
                id="bulk-ot-hours"
                type="number"
                min="0"
                max="24"
                step="0.25"
                bind:value={bulkOtHours}
                class="mb-2 w-full rounded-md border px-2 py-1.5 text-sm theme-border theme-bg-primary theme-text-primary focus:border-transparent focus:ring-2 focus:ring-blue-500"
              />
              {#if bulkShowOtDateTimeFields}
                <div class="grid grid-cols-2 gap-2">
                  <div>
                    <label for="bulk-ot-from-date" class="mb-1 block text-xs font-medium text-slate-700">From date</label>
                    <input
                      id="bulk-ot-from-date"
                      type="date"
                      bind:value={bulkOtFromDate}
                      class="w-full rounded-md border px-2 py-1.5 text-sm theme-border theme-bg-primary theme-text-primary focus:border-transparent focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label for="bulk-ot-from-time" class="mb-1 block text-xs font-medium text-slate-700">From time</label>
                    <input
                      id="bulk-ot-from-time"
                      type="time"
                      bind:value={bulkOtFromTime}
                      class="w-full rounded-md border px-2 py-1.5 text-sm theme-border theme-bg-primary theme-text-primary focus:border-transparent focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label for="bulk-ot-to-date" class="mb-1 block text-xs font-medium text-slate-700">To date</label>
                    <input
                      id="bulk-ot-to-date"
                      type="date"
                      bind:value={bulkOtToDate}
                      class="w-full rounded-md border px-2 py-1.5 text-sm theme-border theme-bg-primary theme-text-primary focus:border-transparent focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label for="bulk-ot-to-time" class="mb-1 block text-xs font-medium text-slate-700">To time</label>
                    <input
                      id="bulk-ot-to-time"
                      type="time"
                      bind:value={bulkOtToTime}
                      class="w-full rounded-md border px-2 py-1.5 text-sm theme-border theme-bg-primary theme-text-primary focus:border-transparent focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
                <p class="m-0 mt-2 text-xs leading-snug text-slate-600">
                  From / to dates default to the attendance day. Required: from date &amp; time when OT &gt; 0.
                </p>
              {:else}
                <p class="m-0 mt-2 text-xs leading-snug text-slate-600">
                  Enter OT hours above to set from/to dates and times (dates default to the attendance day).
                </p>
              {/if}
            {:else}
              <p class="text-sm text-slate-600">OT cleared when absent.</p>
            {/if}
          </section>

          <section
            class="flex min-h-0 min-w-[200px] max-w-full flex-1 basis-[200px] flex-col rounded-lg border border-sky-300/80 bg-sky-50 p-3 text-slate-900 dark:border-sky-400/50 dark:bg-sky-100 dark:text-slate-900"
          >
            <label for="bulk-notes" class="mb-2 text-sm font-semibold text-slate-900">{notesLabel}</label>
            <textarea
              id="bulk-notes"
              value={bulkNotes}
              on:input={(e) => onNotesChange(e.currentTarget.value)}
              placeholder={isNotesRequired ? 'Reason for partial attendance…' : 'Notes…'}
              class="min-h-[100px] w-full flex-1 rounded-md border border-slate-300 px-2 py-1.5 text-sm !bg-white !text-slate-900 placeholder:text-slate-400 focus:border-transparent focus:ring-2 focus:ring-blue-500 dark:border-slate-600 dark:!bg-slate-900 dark:!text-slate-100 dark:placeholder:text-slate-400"
              rows="5"
              required={isNotesRequired}
            ></textarea>
            {#if isNotesRequired && !bulkNotes.trim()}
              <p class="m-0 mt-1 text-xs text-red-500 dark:text-red-400">Reason required</p>
            {/if}
          </section>
        </div>
      </div>

      <div class="flex shrink-0 justify-end gap-3 border-t theme-border pt-2">
        <Button variant="secondary" size="md" on:click={onClose} disabled={isSubmitting}>Cancel</Button>
        <Button
          variant="primary"
          size="md"
          on:click={handleSaveClick}
          disabled={isSubmitting || selectedCount === 0}
        >
          {isSubmitting ? 'Saving…' : 'Save'}
        </Button>
      </div>
    </div>
  </div>
{/if}
