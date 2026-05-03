<script lang="ts">
  import { onMount } from 'svelte';
  import Button from '$lib/components/common/Button.svelte';
  import { Users } from 'lucide-svelte';
  import { supabase } from '$lib/supabaseClient';
  import { calculateBreakTimeInMinutes } from '$lib/utils/breakTimeUtils';
  import { computeCOffToEndWithBreaks } from '$lib/utils/cOffWindowUtils';
  import { validateCOffWithinAttendanceWindow } from '$lib/utils/attendanceCOffSpanUtils';
  import {
    holidayEffectiveBand,
    validateHolidayManpowerOtCoff,
    type HolidaySplitChoice
  } from '$lib/utils/holidayAttendancePolicy';
  import {
    attendanceClearsPlanReportFields,
    attendanceIsPresent,
    type ManpowerAttendanceStatus
  } from '$lib/utils/manpowerAttendanceStatus';
  export let showModal: boolean = false;
  export let selectedCount: number = 0;
  export let selectedDate: string = '';
  export let shiftCode: string = '';
  /** true = Manpower Report (actual hours); false = Manpower Plan */
  export let reportingMode: boolean = false;
  export let bulkAttendanceStatus: ManpowerAttendanceStatus = 'present';
  export let bulkNotes: string = '';
  export let isSubmitting: boolean = false;
  export let onStatusChange: (status: ManpowerAttendanceStatus) => void = () => {};
  export let onNotesChange: (notes: string) => void = () => {};
  export let onSubmit: () => void = () => {};
  export let onClose: () => void = () => {};

  export let fromTime: string = '';
  export let toTime: string = '';
  export let plannedHours: number | null = null;

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

  let shiftBreaks: Array<{ start_time: string; end_time: string }> = [];
  let fullShiftHours = 8;
  let isLoadingShiftInfo = false;
  let holidaySplitChoice: HolidaySplitChoice = 'all_ot';
  let prevHolidayBand: string | null = null;

  /** Only reset bound props / load shift once per open — avoids Svelte 5 bind feedback loops */
  let bulkHolidayShiftLoadedForOpen = false;

  $: if (!showModal) {
    bulkHolidayShiftLoadedForOpen = false;
  }

  $: effectiveHours = plannedHours ?? 0;
  $: hourBand = holidayEffectiveBand(effectiveHours);
  $: canPickCoff =
    attendanceIsPresent(bulkAttendanceStatus) && effectiveHours >= 4 && hourBand !== 'under4';

  $: if (hourBand !== prevHolidayBand) {
    prevHolidayBand = hourBand;
    holidaySplitChoice = 'all_ot';
  }

  function bulkDayStr(): string {
    return typeof selectedDate === 'string' ? selectedDate.split('T')[0] : '';
  }

  function computeCvOt(E: number, choice: HolidaySplitChoice): { cv: number; otH: number } {
    const band = holidayEffectiveBand(E);
    if (band === 'under4') return { cv: 0, otH: E };
    if (choice === 'all_ot') return { cv: 0, otH: E };
    if (band === '4to8') return { cv: 0.5, otH: Math.max(0, E - 4) };
    if (band === '8to12') return { cv: 1, otH: Math.max(0, E - 8) };
    return { cv: 1.5, otH: Math.max(0, E - 12) };
  }

  $: splitPreview = computeCvOt(effectiveHours, holidaySplitChoice);

  $: if (attendanceClearsPlanReportFields(bulkAttendanceStatus)) {
    holidaySplitChoice = 'all_ot';
  }

  async function loadShiftInfo() {
    if (!shiftCode) return;
    isLoadingShiftInfo = true;
    try {
      const { data: shiftData, error: shiftError } = await supabase
        .from('hr_shift_master')
        .select('shift_id, start_time, end_time')
        .eq('shift_code', shiftCode)
        .eq('is_active', true)
        .eq('is_deleted', false)
        .maybeSingle();

      if (shiftError || !shiftData) return;

      shiftBreaks =
        (
          await supabase
            .from('hr_shift_break_master')
            .select('start_time, end_time')
            .eq('shift_id', shiftData.shift_id)
            .eq('is_active', true)
            .eq('is_deleted', false)
            .order('start_time', { ascending: true })
        ).data || [];

      const shiftStartTime = shiftData.start_time;
      const shiftEndTime = shiftData.end_time;
      const shiftStart = new Date(`2000-01-01T${shiftStartTime}`);
      let shiftEnd = new Date(`2000-01-01T${shiftEndTime}`);
      if (shiftEnd < shiftStart) shiftEnd = new Date(`2000-01-02T${shiftEndTime}`);
      const shiftDurationMinutes = (shiftEnd.getTime() - shiftStart.getTime()) / (1000 * 60);
      const totalBreakMinutes = calculateBreakTimeInMinutes(
        shiftStartTime,
        shiftEndTime,
        shiftBreaks
      );
      fullShiftHours = (shiftDurationMinutes - totalBreakMinutes) / 60;

      if (!fromTime) fromTime = shiftStartTime ? shiftStartTime.substring(0, 5) : '';
      if (!toTime) toTime = shiftEndTime ? shiftEndTime.substring(0, 5) : '';
      calculateHoursFromTimes();
    } finally {
      isLoadingShiftInfo = false;
    }
  }

  function calculateHoursFromTimes() {
    if (!fromTime || !toTime) {
      plannedHours = null;
      return;
    }
    try {
      const start = new Date(`2000-01-01T${fromTime}`);
      let end = new Date(`2000-01-01T${toTime}`);
      if (end < start) end = new Date(`2000-01-02T${toTime}`);
      const durationMinutes = (end.getTime() - start.getTime()) / (1000 * 60);
      const breakMinutes = calculateBreakTimeInMinutes(fromTime, toTime, shiftBreaks);
      plannedHours = Math.max(0, (durationMinutes - breakMinutes) / 60);
    } catch {
      plannedHours = null;
    }
  }

  $: if (showModal && fromTime && toTime && attendanceIsPresent(bulkAttendanceStatus)) {
    calculateHoursFromTimes();
  }

  $: if (showModal && shiftCode && !bulkHolidayShiftLoadedForOpen) {
    bulkHolidayShiftLoadedForOpen = true;
    fromTime = '';
    toTime = '';
    plannedHours = null;
    holidaySplitChoice = 'all_ot';
    prevHolidayBand = null;
    loadShiftInfo();
  }

  function buildPayload(E: number, choice: HolidaySplitChoice) {
    const { cv, otH } = computeCvOt(E, choice);
    const day = bulkDayStr();
    const ft = (fromTime || '').trim().substring(0, 5);
    const tt = (toTime || '').trim().substring(0, 5);

    if (cv <= 0) {
      return {
        cOffValue: 0,
        cOffFromDate: undefined as string | undefined,
        cOffFromTime: undefined as string | undefined,
        cOffToDate: undefined as string | undefined,
        cOffToTime: undefined as string | undefined,
        otHours: otH,
        otFromDate: day,
        otFromTime: ft,
        otToDate: day,
        otToTime: tt
      };
    }

    const cOffFromDate = day;
    const cOffFromTime = ft;
    const { toDate: cOffToDate, toTime: cOffToTime } = computeCOffToEndWithBreaks(
      cOffFromDate,
      cOffFromTime,
      cv,
      shiftBreaks
    );

    return {
      cOffValue: cv,
      cOffFromDate,
      cOffFromTime,
      cOffToDate,
      cOffToTime,
      otHours: otH,
      otFromDate: otH > 0.001 ? cOffToDate : undefined,
      otFromTime: otH > 0.001 ? cOffToTime : undefined,
      otToDate: otH > 0.001 ? day : undefined,
      otToTime: otH > 0.001 ? tt : undefined
    };
  }

  async function handleSaveClick() {
    if (!attendanceIsPresent(bulkAttendanceStatus)) {
      onSubmit();
      return;
    }
    if (!fromTime?.trim() || !toTime?.trim()) {
      alert('Please enter from and to times.');
      return;
    }
    if (plannedHours == null || !Number.isFinite(plannedHours) || plannedHours <= 0) {
      alert('Effective time must be greater than zero.');
      return;
    }

    const E = plannedHours;
    const payload = buildPayload(E, holidaySplitChoice);
    const cOff = {
      cOffValue: payload.cOffValue,
      cOffFromDate: payload.cOffFromDate,
      cOffFromTime: payload.cOffFromTime,
      cOffToDate: payload.cOffToDate,
      cOffToTime: payload.cOffToTime
    };
    const ot = {
      otHours: payload.otHours,
      otFromDate: payload.otFromDate,
      otFromTime: payload.otFromTime,
      otToDate: payload.otToDate,
      otToTime: payload.otToTime
    };

    const hVal = validateHolidayManpowerOtCoff(E, cOff, ot);
    if (!hVal.ok) {
      alert(hVal.message);
      return;
    }

    if (payload.cOffValue > 0) {
      const day = bulkDayStr();
      const spanCheck = validateCOffWithinAttendanceWindow(payload.cOffValue, {
        attendanceFromDate: day,
        attendanceToDate: day,
        attendanceFromTime: (fromTime || '').trim(),
        attendanceToTime: (toTime || '').trim(),
        cOffFromDate: String(payload.cOffFromDate ?? ''),
        cOffFromTime: String(payload.cOffFromTime ?? ''),
        cOffToDate: String(payload.cOffToDate ?? ''),
        cOffToTime: String(payload.cOffToTime ?? '')
      });
      if (!spanCheck.ok) {
        alert(spanCheck.message);
        return;
      }
    }

    if (plannedHours !== null && plannedHours < fullShiftHours - 0.001) {
      if (!bulkNotes.trim()) {
        alert('Reason is required when effective time is below full shift hours.');
        return;
      }
    }

    bulkCOffValue = payload.cOffValue;
    bulkCOffFromDate = payload.cOffFromDate?.trim() || '';
    bulkCOffFromTime = payload.cOffFromTime?.trim() || '';
    bulkCOffToDate = payload.cOffToDate?.trim() || '';
    bulkCOffToTime = payload.cOffToTime?.trim() || '';
    bulkOtHours = payload.otHours;
    bulkOtFromDate = payload.otFromDate?.trim() || '';
    bulkOtFromTime = payload.otFromTime?.trim() || '';
    bulkOtToDate = payload.otToDate?.trim() || '';
    bulkOtToTime = payload.otToTime?.trim() || '';

    onSubmit();
  }
</script>

{#if showModal}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <div
    class="fixed inset-0 z-[1000] flex items-center justify-center bg-black/50 p-3"
    role="presentation"
    on:click|self={onClose}
  >
    <div
      class="flex max-h-[min(92vh,900px)] min-h-0 w-full min-w-0 max-w-[1120px] flex-col rounded-lg border theme-border theme-bg-primary p-4 shadow-lg sm:px-[18px] sm:py-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="holiday-bulk-attendance-title"
      tabindex="-1"
      on:click|stopPropagation
    >
      <div class="mb-3 flex shrink-0 items-center gap-3">
        <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-500">
          <Users class="h-5 w-5 text-white" aria-hidden="true" />
        </div>
        <div>
          <h3 id="holiday-bulk-attendance-title" class="m-0 text-lg font-semibold theme-text-primary">
            Bulk attendance (holiday)
          </h3>
          <p class="theme-text-secondary m-0 mt-1 text-sm">
            {selectedCount} selected · effective time uses breaks within your interval
          </p>
        </div>
      </div>

      <div class="mb-3 shrink-0 rounded-lg border border-amber-200 bg-amber-50 p-2.5 dark:border-amber-900/50 dark:bg-amber-950/40 sm:px-3">
        <p class="theme-text-primary m-1 text-sm">
          <strong>Date:</strong>
          {new Date(selectedDate).toLocaleDateString('en-GB', {
            day: '2-digit',
            month: 'short',
            year: '2-digit'
          })}
          <span class="ml-2 rounded bg-amber-200 px-2 py-0.5 text-xs font-semibold text-amber-950 dark:bg-amber-800 dark:text-amber-50">
            Holiday
          </span>
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
                <p class="mb-2 text-sm font-semibold text-slate-900">Times</p>
                <div class="mb-2 grid grid-cols-2 gap-2">
                  <div>
                    <label class="mb-1 block text-xs font-medium text-slate-700" for="hb-from">From time</label>
                    <input
                      id="hb-from"
                      type="time"
                      bind:value={fromTime}
                      class="w-full rounded-md border px-2 py-1.5 text-sm theme-border theme-bg-primary theme-text-primary"
                    />
                  </div>
                  <div>
                    <label class="mb-1 block text-xs font-medium text-slate-700" for="hb-to">To time</label>
                    <input
                      id="hb-to"
                      type="time"
                      bind:value={toTime}
                      class="w-full rounded-md border px-2 py-1.5 text-sm theme-border theme-bg-primary theme-text-primary"
                    />
                  </div>
                </div>
                <div
                  class="rounded border border-dashed border-amber-400/80 bg-amber-100/60 p-2 text-sm text-slate-900 dark:bg-amber-950/50 dark:text-amber-50"
                >
                  Effective (after breaks): {plannedHours !== null ? `${plannedHours.toFixed(2)} h` : '…'}
                  <span class="text-xs opacity-90">({reportingMode ? 'Actual' : 'Planned'} · ref. full shift {fullShiftHours.toFixed(2)} h)</span>
                </div>
              {/if}
            {:else}
              <p class="text-sm text-slate-600">Times apply when present.</p>
            {/if}
          </section>

          <section
            class="min-w-[220px] max-w-full flex-1 basis-[260px] rounded-lg border border-sky-300/80 bg-sky-50 p-3 text-slate-900 dark:border-sky-400/50 dark:bg-sky-100 dark:text-slate-900"
          >
            {#if attendanceIsPresent(bulkAttendanceStatus) && plannedHours !== null && effectiveHours > 0}
              <p class="mb-2 text-sm font-semibold text-slate-900">Holiday OT / C‑Off split</p>
              {#if hourBand === 'under4'}
                <p class="m-0 text-sm text-slate-800">Under 4 h effective: entire period is <strong>OT</strong>.</p>
              {:else}
                <label class="mb-2 flex cursor-pointer items-start gap-2">
                  <input class="accent-blue-600 mt-0.5" type="radio" bind:group={holidaySplitChoice} value="all_ot" />
                  <span class="text-sm text-slate-800">All effective time as OT</span>
                </label>
                {#if hourBand === '4to8'}
                  <label class="mb-0 flex cursor-pointer items-start gap-2">
                    <input class="accent-blue-600 mt-0.5" type="radio" bind:group={holidaySplitChoice} value="coff_half" />
                    <span class="text-sm text-slate-800">C‑Off 0.5 day (4 h net), remainder OT</span>
                  </label>
                {:else if hourBand === '8to12'}
                  <label class="mb-0 flex cursor-pointer items-start gap-2">
                    <input class="accent-blue-600 mt-0.5" type="radio" bind:group={holidaySplitChoice} value="coff_full" />
                    <span class="text-sm text-slate-800">C‑Off 1 day (8 h net), remainder OT</span>
                  </label>
                {:else}
                  <label class="mb-0 flex cursor-pointer items-start gap-2">
                    <input
                      class="accent-blue-600 mt-0.5"
                      type="radio"
                      bind:group={holidaySplitChoice}
                      value="coff_onehalf"
                    />
                    <span class="text-sm text-slate-800">C‑Off 1.5 days (12 h net), remainder OT</span>
                  </label>
                {/if}
              {/if}
              {#if canPickCoff || hourBand === 'under4'}
                <div class="mt-3 rounded border border-slate-200 bg-white/80 p-2 text-xs dark:border-slate-600 dark:bg-slate-900/40">
                  <div>C‑Off (net): <strong>{splitPreview.cv <= 0 ? '—' : `${splitPreview.cv} day`}</strong></div>
                  <div>OT hours: <strong>{splitPreview.otH.toFixed(2)} h</strong></div>
                </div>
              {/if}
            {:else if attendanceIsPresent(bulkAttendanceStatus)}
              <p class="text-sm text-slate-600">Enter times to see split options.</p>
            {/if}
          </section>

          <section
            class="min-w-[180px] max-w-full flex-1 basis-[200px] rounded-lg border border-sky-300/80 bg-sky-50 p-3 text-slate-900 dark:border-sky-400/50 dark:bg-sky-100 dark:text-slate-900"
          >
            <label class="mb-1 block text-xs font-medium text-slate-700" for="hb-notes">Notes</label>
            <textarea
              id="hb-notes"
              value={bulkNotes}
              on:input={(e) => onNotesChange(e.currentTarget.value)}
              rows="3"
              class="w-full rounded-md border px-2 py-1.5 text-sm theme-border theme-bg-primary theme-text-primary"
              placeholder="Required if effective time is short (see validation)"
            ></textarea>
          </section>
        </div>
      </div>

      <div class="mt-auto flex shrink-0 justify-end gap-2 border-t theme-border pt-3">
        <Button variant="secondary" type="button" on:click={onClose}>Cancel</Button>
        <Button variant="primary" type="button" disabled={isSubmitting} on:click={handleSaveClick}>
          {isSubmitting ? 'Saving…' : 'Apply to selected'}
        </Button>
      </div>
    </div>
  </div>
{/if}
