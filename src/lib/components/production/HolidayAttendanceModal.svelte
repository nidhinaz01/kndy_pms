<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import Button from '$lib/components/common/Button.svelte';
  import type { ProductionEmployee } from '$lib/api/production';
  import { supabase } from '$lib/supabaseClient';
  import { calculateBreakTimeInMinutes } from '$lib/utils/breakTimeUtils';
  import { computeCOffToEndWithBreaks } from '$lib/utils/cOffWindowUtils';
  import { validateCOffWithinAttendanceWindow } from '$lib/utils/attendanceCOffSpanUtils';
  import {
    holidayEffectiveBand,
    validateHolidayManpowerOtCoff,
    type HolidaySplitChoice
  } from '$lib/utils/holidayAttendancePolicy';

  let prevHolidayBand: string | null = null;
  import {
    attendanceClearsPlanReportFields,
    attendanceIsPresent,
    normalizeManpowerAttendanceStatus,
    type ManpowerAttendanceStatus
  } from '$lib/utils/manpowerAttendanceStatus';

  export let showModal: boolean = false;
  export let employee: ProductionEmployee | null = null;
  export let selectedDate: string = '';
  /** true = Manpower Plan, false = Manpower Report */
  export let isPlanningMode: boolean = true;

  const dispatch = createEventDispatcher();

  let attendanceStatus: ManpowerAttendanceStatus = 'present';
  let notes = '';
  let isSubmitting = false;

  let fromTime = '';
  let toTime = '';
  let plannedHours: number | null = null;
  let actualHours: number | null = null;

  let attendanceFromDate = '';
  let attendanceToDate = '';

  let holidaySplitChoice: HolidaySplitChoice = 'all_ot';

  let shiftBreaks: Array<{ start_time: string; end_time: string }> = [];
  let fullShiftHours = 8;
  let isLoadingShiftInfo = false;

  let formInitialized = false;
  let previousEmployeeId: string | null = null;

  function dayFromSelected(): string {
    return typeof selectedDate === 'string' ? selectedDate.split('T')[0] : '';
  }

  $: currentHours = isPlanningMode ? plannedHours : actualHours;
  $: effectiveHours = currentHours ?? 0;
  $: hourBand = holidayEffectiveBand(effectiveHours);
  $: canPickCoff =
    attendanceIsPresent(attendanceStatus) &&
    effectiveHours >= 4 &&
    hourBand !== 'under4';

  function computeCvOt(E: number, choice: HolidaySplitChoice): { cv: number; otH: number } {
    const band = holidayEffectiveBand(E);
    if (band === 'under4') return { cv: 0, otH: E };
    if (choice === 'all_ot') return { cv: 0, otH: E };
    if (band === '4to8') return { cv: 0.5, otH: Math.max(0, E - 4) };
    if (band === '8to12') return { cv: 1, otH: Math.max(0, E - 8) };
    return { cv: 1.5, otH: Math.max(0, E - 12) };
  }

  $: splitPreview = computeCvOt(effectiveHours, holidaySplitChoice);

  $: if (hourBand !== prevHolidayBand) {
    prevHolidayBand = hourBand;
    holidaySplitChoice = 'all_ot';
  }

  $: if (showModal && employee && attendanceIsPresent(attendanceStatus) && selectedDate) {
    const ds = dayFromSelected();
    if (ds) {
      if (!attendanceFromDate) attendanceFromDate = ds;
      if (!attendanceToDate) attendanceToDate = ds;
    }
  }

  $: if (attendanceClearsPlanReportFields(attendanceStatus)) {
    attendanceFromDate = '';
    attendanceToDate = '';
  }

  async function loadShiftInfo() {
    if (!employee?.shift_code) return;
    isLoadingShiftInfo = true;
    try {
      const { data: shiftData, error: shiftError } = await supabase
        .from('hr_shift_master')
        .select('shift_id, start_time, end_time')
        .eq('shift_code', employee.shift_code)
        .eq('is_active', true)
        .eq('is_deleted', false)
        .maybeSingle();

      if (shiftError || !shiftData) return;

      const shiftId = shiftData.shift_id;
      const { data: breaksData } = await supabase
        .from('hr_shift_break_master')
        .select('start_time, end_time')
        .eq('shift_id', shiftId)
        .eq('is_active', true)
        .eq('is_deleted', false)
        .order('start_time', { ascending: true });

      shiftBreaks = breaksData || [];

      const shiftStartTime = shiftData.start_time;
      const shiftEndTime = shiftData.end_time;
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

      if (!fromTime) fromTime = shiftStartTime ? shiftStartTime.substring(0, 5) : '';
      if (!toTime) toTime = shiftEndTime ? shiftEndTime.substring(0, 5) : '';
      calculateHoursFromTimes();
    } finally {
      isLoadingShiftInfo = false;
    }
  }

  function calculateHoursFromTimes() {
    if (!fromTime || !toTime) {
      if (isPlanningMode) plannedHours = null;
      else actualHours = null;
      return;
    }
    try {
      const start = new Date(`2000-01-01T${fromTime}`);
      let end = new Date(`2000-01-01T${toTime}`);
      if (end < start) end = new Date(`2000-01-02T${toTime}`);
      const durationMinutes = (end.getTime() - start.getTime()) / (1000 * 60);
      const breakMinutes = calculateBreakTimeInMinutes(fromTime, toTime, shiftBreaks);
      const h = Math.max(0, (durationMinutes - breakMinutes) / 60);
      if (isPlanningMode) plannedHours = h;
      else actualHours = h;
    } catch {
      if (isPlanningMode) plannedHours = null;
      else actualHours = null;
    }
  }

  $: if (showModal && employee) {
    const currentEmployeeId = employee.emp_id;
    const isNewEmployee = previousEmployeeId !== currentEmployeeId;
    const isModalJustOpened = !formInitialized || isNewEmployee;

    if (isModalJustOpened) {
      previousEmployeeId = currentEmployeeId;
      formInitialized = true;
      holidaySplitChoice = 'all_ot';
      attendanceStatus = normalizeManpowerAttendanceStatus(employee.attendance_status) ?? 'present';
      notes = employee.attendance_notes || '';
      fromTime = employee.attendance_from_time ? employee.attendance_from_time.substring(0, 5) : '';
      toTime = employee.attendance_to_time ? employee.attendance_to_time.substring(0, 5) : '';

      const dayStr = dayFromSelected();
      if (!attendanceClearsPlanReportFields(attendanceStatus)) {
        attendanceFromDate = employee.attendance_from_date
          ? String(employee.attendance_from_date).split('T')[0]
          : dayStr;
        attendanceToDate = employee.attendance_to_date
          ? String(employee.attendance_to_date).split('T')[0]
          : dayStr;
      }

      if (isPlanningMode) {
        plannedHours = employee.planned_hours ?? null;
        actualHours = null;
      } else {
        actualHours = employee.actual_hours ?? null;
        plannedHours = null;
      }

      loadShiftInfo();
    }
  }

  $: if (!showModal) {
    formInitialized = false;
    previousEmployeeId = null;
  }

  function buildCOffOtPayload(E: number, choice: HolidaySplitChoice) {
    const { cv, otH } = computeCvOt(E, choice);
    const attFrom = attendanceFromDate?.trim() || dayFromSelected();
    const attTo = attendanceToDate?.trim() || attFrom;
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
        otFromDate: attFrom,
        otFromTime: ft,
        otToDate: attTo,
        otToTime: tt
      };
    }

    const cOffFromDate = attFrom;
    const cOffFromTime = ft;
    const { toDate: cOffToDate, toTime: cOffToTime } = computeCOffToEndWithBreaks(
      cOffFromDate,
      cOffFromTime,
      cv,
      shiftBreaks
    );

    const otFromDate = cOffToDate;
    const otFromTime = cOffToTime;
    const otToDate = attTo;
    const otToTime = tt;

    return {
      cOffValue: cv,
      cOffFromDate,
      cOffFromTime,
      cOffToDate,
      cOffToTime,
      otHours: otH,
      otFromDate: otH > 0.001 ? otFromDate : undefined,
      otFromTime: otH > 0.001 ? otFromTime : undefined,
      otToDate: otH > 0.001 ? otToDate : undefined,
      otToTime: otH > 0.001 ? otToTime : undefined
    };
  }

  async function handleSubmit() {
    if (!employee) return;

    if (attendanceIsPresent(attendanceStatus)) {
      if (!fromTime?.trim() || !toTime?.trim()) {
        alert('Please enter from and to times.');
        return;
      }
      if (currentHours == null || !Number.isFinite(currentHours) || currentHours <= 0) {
        alert('Effective time must be greater than zero.');
        return;
      }
      const E = currentHours;
      const payload = buildCOffOtPayload(E, holidaySplitChoice);
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
        const spanCheck = validateCOffWithinAttendanceWindow(payload.cOffValue, {
          attendanceFromDate: attendanceFromDate?.trim() || dayFromSelected(),
          attendanceToDate: attendanceToDate?.trim() || attendanceFromDate?.trim() || dayFromSelected(),
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
    }

    isSubmitting = true;

    const eventData: Record<string, unknown> = {
      empId: employee.emp_id,
      stageCode: employee.current_stage,
      date: selectedDate,
      status: attendanceStatus,
      shiftCode: employee.shift_code,
      notes: notes.trim() || undefined,
      holidayAttendance: true
    };

    if (attendanceIsPresent(attendanceStatus)) {
      const E = currentHours ?? 0;
      const payload = buildCOffOtPayload(E, holidaySplitChoice);
      eventData.fromTime = fromTime;
      eventData.toTime = toTime;
      eventData.attendanceFromDate = attendanceFromDate?.trim() || dayFromSelected();
      eventData.attendanceToDate = attendanceToDate?.trim() || eventData.attendanceFromDate;
      if (isPlanningMode) eventData.plannedHours = E;
      else eventData.actualHours = E;

      eventData.cOffValue = payload.cOffValue;
      eventData.cOffFromDate = payload.cOffFromDate;
      eventData.cOffFromTime = payload.cOffFromTime;
      eventData.cOffToDate = payload.cOffToDate;
      eventData.cOffToTime = payload.cOffToTime;
      eventData.otHours = payload.otHours;
      if (payload.otHours > 0.001) {
        eventData.otFromDate = payload.otFromDate;
        eventData.otFromTime = payload.otFromTime;
        eventData.otToDate = payload.otToDate;
        eventData.otToTime = payload.otToTime;
      }
    }

    dispatch('attendanceMarked', eventData);
    isSubmitting = false;
  }

  function handleClose() {
    formInitialized = false;
    previousEmployeeId = null;
    dispatch('close');
  }

  function coffRadioId(suffix: string) {
    return `holiday-coff-${suffix}`;
  }
</script>

{#if showModal}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <div
    class="fixed inset-0 z-[1000] flex items-center justify-center bg-black/50 p-3"
    role="presentation"
    on:click|self={handleClose}
  >
    <div
      class="flex max-h-[min(92vh,900px)] min-h-0 w-full min-w-0 max-w-[1120px] flex-col rounded-lg border theme-border theme-bg-primary p-4 shadow-lg sm:px-[18px] sm:py-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="holiday-attendance-title"
      tabindex="-1"
      on:click|stopPropagation
    >
      <div class="mb-3 flex shrink-0 items-center gap-3">
        <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-500">
          <span class="text-xl text-white">📅</span>
        </div>
        <div>
          <h3 id="holiday-attendance-title" class="m-0 text-lg font-semibold theme-text-primary">
            Mark attendance (holiday)
          </h3>
          {#if employee}
            <p class="theme-text-secondary m-0 mt-1 text-sm">
              {employee.emp_name} ({employee.emp_id})
            </p>
          {/if}
        </div>
      </div>

      {#if employee}
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
          <p class="theme-text-primary m-1 text-sm">
            <strong>Stage:</strong>
            {employee.current_stage}
          </p>
          <p class="m-1 mt-2 text-xs leading-snug text-slate-700 dark:text-slate-300">
            Effective time = duration from times minus shift breaks that fall in that interval. OT and C‑Off follow
            holiday rules (not the usual shift-hour limit).
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
                  <input class="accent-blue-600" type="radio" bind:group={attendanceStatus} value="present" />
                  <span class="text-sm text-slate-800">Present</span>
                </label>
                <label class="mb-2 flex cursor-pointer items-center gap-2">
                  <input class="accent-blue-600" type="radio" bind:group={attendanceStatus} value="absent_informed" />
                  <span class="text-sm text-slate-800">Absent (Informed)</span>
                </label>
                <label class="flex cursor-pointer items-center gap-2">
                  <input
                    class="accent-blue-600"
                    type="radio"
                    bind:group={attendanceStatus}
                    value="absent_uninformed"
                  />
                  <span class="text-sm text-slate-800">Absent (Uninformed)</span>
                </label>
              </fieldset>
            </section>

            <section
              class="min-w-[180px] max-w-full flex-1 basis-[200px] rounded-lg border border-sky-300/80 bg-sky-50 p-3 text-slate-900 dark:border-sky-400/50 dark:bg-sky-100 dark:text-slate-900"
            >
              {#if attendanceIsPresent(attendanceStatus)}
                {#if isLoadingShiftInfo}
                  <p class="text-sm text-slate-600">Loading shift…</p>
                {:else}
                  <p class="mb-2 text-sm font-semibold text-slate-900">Times</p>
                  <div class="mb-2 grid grid-cols-2 gap-2">
                    <div>
                      <label class="mb-1 block text-xs font-medium text-slate-700" for="h-from-date">From date</label>
                      <input
                        id="h-from-date"
                        type="date"
                        bind:value={attendanceFromDate}
                        class="w-full rounded-md border px-2 py-1.5 text-sm theme-border theme-bg-primary theme-text-primary"
                      />
                    </div>
                    <div>
                      <label class="mb-1 block text-xs font-medium text-slate-700" for="h-from-time">From time</label>
                      <input
                        id="h-from-time"
                        type="time"
                        bind:value={fromTime}
                        on:change={calculateHoursFromTimes}
                        class="w-full rounded-md border px-2 py-1.5 text-sm theme-border theme-bg-primary theme-text-primary"
                      />
                    </div>
                    <div>
                      <label class="mb-1 block text-xs font-medium text-slate-700" for="h-to-date">To date</label>
                      <input
                        id="h-to-date"
                        type="date"
                        bind:value={attendanceToDate}
                        class="w-full rounded-md border px-2 py-1.5 text-sm theme-border theme-bg-primary theme-text-primary"
                      />
                    </div>
                    <div>
                      <label class="mb-1 block text-xs font-medium text-slate-700" for="h-to-time">To time</label>
                      <input
                        id="h-to-time"
                        type="time"
                        bind:value={toTime}
                        on:change={calculateHoursFromTimes}
                        class="w-full rounded-md border px-2 py-1.5 text-sm theme-border theme-bg-primary theme-text-primary"
                      />
                    </div>
                  </div>
                  <div
                    class="rounded border border-dashed border-amber-400/80 bg-amber-100/60 p-2 text-slate-900 dark:bg-amber-950/50 dark:text-amber-50"
                  >
                    <span class="text-sm font-medium">
                      Effective (after breaks): {currentHours !== null ? `${currentHours.toFixed(2)} h` : '…'}
                    </span>
                    <span class="ml-1 text-xs opacity-90">(reference full shift {fullShiftHours.toFixed(2)} h)</span>
                  </div>
                {/if}
              {:else}
                <p class="text-sm text-slate-600">Dates and times apply when present.</p>
              {/if}
            </section>

            <section
              class="min-w-[220px] max-w-full flex-1 basis-[260px] rounded-lg border border-sky-300/80 bg-sky-50 p-3 text-slate-900 dark:border-sky-400/50 dark:bg-sky-100 dark:text-slate-900"
            >
              {#if attendanceIsPresent(attendanceStatus) && currentHours !== null && effectiveHours > 0}
                <p class="mb-2 text-sm font-semibold text-slate-900">Holiday OT / C‑Off split</p>

                {#if hourBand === 'under4'}
                  <p class="m-0 text-sm text-slate-800">
                    Under 4 hours effective: entire period is <strong>overtime</strong>.
                  </p>
                {:else}
                  <label class="mb-2 flex cursor-pointer items-start gap-2">
                    <input
                      class="accent-blue-600 mt-0.5"
                      type="radio"
                      bind:group={holidaySplitChoice}
                      value="all_ot"
                      id={coffRadioId('all')}
                    />
                    <span class="text-sm text-slate-800" id={coffRadioId('all')}>Count entire effective time as OT</span>
                  </label>

                  {#if hourBand === '4to8'}
                    <label class="mb-0 flex cursor-pointer items-start gap-2">
                      <input
                        class="accent-blue-600 mt-0.5"
                        type="radio"
                        bind:group={holidaySplitChoice}
                        value="coff_half"
                        id={coffRadioId('h')}
                      />
                      <span class="text-sm text-slate-800">
                        C‑Off <strong>0.5 day</strong> (4 h net) from start, remainder as OT
                      </span>
                    </label>
                  {:else if hourBand === '8to12'}
                    <label class="mb-0 flex cursor-pointer items-start gap-2">
                      <input
                        class="accent-blue-600 mt-0.5"
                        type="radio"
                        bind:group={holidaySplitChoice}
                        value="coff_full"
                        id={coffRadioId('1')}
                      />
                      <span class="text-sm text-slate-800">
                        C‑Off <strong>1 day</strong> (8 h net) from start, remainder as OT
                      </span>
                    </label>
                  {:else}
                    <label class="mb-0 flex cursor-pointer items-start gap-2">
                      <input
                        class="accent-blue-600 mt-0.5"
                        type="radio"
                        bind:group={holidaySplitChoice}
                        value="coff_onehalf"
                        id={coffRadioId('12')}
                      />
                      <span class="text-sm text-slate-800">
                        C‑Off <strong>1.5 days</strong> (12 h net) from start, remainder as OT
                      </span>
                    </label>
                  {/if}
                {/if}

                {#if canPickCoff || hourBand === 'under4'}
                  <div class="mt-3 rounded border border-slate-200 bg-white/80 p-2 text-xs text-slate-800 dark:border-slate-600 dark:bg-slate-900/40 dark:text-slate-100">
                    <div>C‑Off (net): <strong>{splitPreview.cv <= 0 ? '—' : `${splitPreview.cv} day`}</strong></div>
                    <div>OT hours: <strong>{splitPreview.otH.toFixed(2)} h</strong></div>
                  </div>
                {/if}
              {:else if attendanceIsPresent(attendanceStatus)}
                <p class="text-sm text-slate-600">Enter times to choose OT / C‑Off split.</p>
              {:else}
                <p class="text-sm text-slate-600">Split applies when present.</p>
              {/if}
            </section>

            <section
              class="min-w-[180px] max-w-full flex-1 basis-[200px] rounded-lg border border-sky-300/80 bg-sky-50 p-3 text-slate-900 dark:border-sky-400/50 dark:bg-sky-100 dark:text-slate-900"
            >
              <label class="mb-1 block text-xs font-medium text-slate-700" for="h-notes">Notes</label>
              <textarea
                id="h-notes"
                bind:value={notes}
                rows="3"
                class="w-full rounded-md border px-2 py-1.5 text-sm theme-border theme-bg-primary theme-text-primary"
                placeholder="Optional"
              ></textarea>
            </section>
          </div>
        </div>

        <div class="mt-auto flex shrink-0 justify-end gap-2 border-t theme-border pt-3">
          <Button variant="secondary" type="button" on:click={handleClose}>Cancel</Button>
          <Button variant="primary" type="button" disabled={isSubmitting} on:click={handleSubmit}>
            {isSubmitting ? 'Saving…' : 'Save'}
          </Button>
        </div>
      {/if}
    </div>
  </div>
{/if}
