<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import Button from '$lib/components/common/Button.svelte';
  import type { ProductionEmployee } from '$lib/api/production';
  import { supabase } from '$lib/supabaseClient';
  import { calculateBreakTimeInMinutes } from '$lib/utils/breakTimeUtils';
  import { computeCOffToEndWithBreaks } from '$lib/utils/cOffWindowUtils';
  import { validateCOffWithinAttendanceWindow, validateNetHoursForCoffAllow } from '$lib/utils/attendanceCOffSpanUtils';

  export let showModal: boolean = false;
  export let employee: ProductionEmployee | null = null;
  export let selectedDate: string = '';
  export let isPlanningMode: boolean = true; // true for planning, false for reporting

  const dispatch = createEventDispatcher();

  // Form state
  let attendanceStatus: 'present' | 'absent' = 'present';
  let notes: string = '';
  let isSubmitting = false;
  
  // Time and hours fields (only for present)
  let fromTime: string = '';
  let toTime: string = '';
  let plannedHours: number | null = null; // For planning mode
  let actualHours: number | null = null; // For reporting mode

  let cOffValue: number = 0;
  let cOffFromDate: string = '';
  let cOffFromTime: string = '';
  let cOffToDate: string = '';
  let cOffToTime: string = '';

  /** Maps to planning_from_date / planning_to_date or reporting_from_date / reporting_to_date. */
  let attendanceFromDate = '';
  let attendanceToDate = '';
  
  // Flag to prevent recalculation when loading saved data
  let isLoadingSavedData = false;
  // Track if we have saved hours to preserve them
  let hasSavedHours = false;
  // Track if user is actively editing times to prevent reset
  let isEditingTime = false;
  // Track if form has been initialized to prevent re-initialization
  let formInitialized = false;
  let previousEmployeeId: string | null = null;
  
  // Shift information
  let shiftStartTime: string = '08:00';
  let shiftEndTime: string = '17:00';
  let fullShiftHours: number = 8;
  let shiftBreaks: Array<{ start_time: string; end_time: string }> = [];
  let isLoadingShiftInfo = false;

  // Calculate if notes is required
  // For planning: if plannedHours < fullShiftHours
  // For reporting: if actualHours < plannedHours OR actualHours < fullShiftHours
  $: currentHours = isPlanningMode ? plannedHours : actualHours;
  $: isNotesRequired = attendanceStatus === 'present' && currentHours !== null && (
    isPlanningMode 
      ? currentHours < fullShiftHours
      : (currentHours < (employee?.planned_hours ?? fullShiftHours) || currentHours < fullShiftHours)
  );
  $: notesLabel = isNotesRequired 
    ? 'Reason (Required for partial attendance):' 
    : 'Notes (Optional):';

  function dayFromSelected(): string {
    return typeof selectedDate === 'string' ? selectedDate.split('T')[0] : '';
  }

  /** C-Off end: net work hours (0.5/1/1.5 day) plus shift breaks in the wall-clock window. */
  function computeCOffToEnd(fromDate: string, fromTime: string, offValue: number): { toDate: string; toTime: string } {
    return computeCOffToEndWithBreaks(fromDate, fromTime, offValue, shiftBreaks);
  }

  function syncCOffToEndFromStart() {
    if (cOffValue <= 0) return;
    if (!cOffFromDate?.trim() || !cOffFromTime?.trim()) return;
    const { toDate, toTime } = computeCOffToEnd(cOffFromDate, cOffFromTime, cOffValue);
    cOffToDate = toDate;
    cOffToTime = toTime;
  }

  $: if (attendanceStatus === 'absent') {
    cOffValue = 0;
    cOffFromDate = '';
    cOffFromTime = '';
    cOffToDate = '';
    cOffToTime = '';
    attendanceFromDate = '';
    attendanceToDate = '';
  }

  $: if (showModal && employee && attendanceStatus === 'present' && selectedDate) {
    const ds = dayFromSelected();
    if (ds) {
      if (!attendanceFromDate) attendanceFromDate = ds;
      if (!attendanceToDate) attendanceToDate = ds;
    }
  }

  // Load shift information when modal opens
  async function loadShiftInfo() {
    if (!employee?.shift_code) {
      console.warn('No shift code available for employee');
      return;
    }

    isLoadingShiftInfo = true;
    try {
      // Get shift information
      const { data: shiftData, error: shiftError } = await supabase
        .from('hr_shift_master')
        .select('shift_id, start_time, end_time')
        .eq('shift_code', employee.shift_code)
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

      // Set default times and hours only if not already set from employee data
      // Don't reset if user is actively editing
      console.log('🔍 [AttendanceModal] loadShiftInfo - setting defaults. Current state:', {
        fromTime,
        toTime,
        plannedHours,
        actualHours,
        employee_planned_hours: employee?.planned_hours,
        employee_actual_hours: employee?.actual_hours,
        fullShiftHours,
        isEditingTime
      });
      
      // Only set defaults if not editing and times are empty
      if (!isEditingTime && !fromTime) {
        console.log('🔍 [AttendanceModal] fromTime empty, setting to shiftStartTime:', shiftStartTime);
        fromTime = shiftStartTime ? shiftStartTime.substring(0,5) : '';
      }
      if (!isEditingTime && !toTime) {
        console.log('🔍 [AttendanceModal] toTime empty, setting to shiftEndTime:', shiftEndTime);
        toTime = shiftEndTime ? shiftEndTime.substring(0,5) : '';
      }
      
      // Set default hours based on mode
      if (isPlanningMode) {
        // Only set default plannedHours if it's null/undefined and we don't have saved value
        const shouldSetDefault = (plannedHours === null || plannedHours === undefined) && (!employee?.planned_hours && employee?.planned_hours !== 0);
        console.log('🔍 [AttendanceModal] Planning mode - shouldSetDefault:', shouldSetDefault, {
          plannedHours,
          employee_planned_hours: employee?.planned_hours,
          fullShiftHours
        });
        if (shouldSetDefault) {
          console.log('🔍 [AttendanceModal] Setting plannedHours to fullShiftHours:', fullShiftHours);
          plannedHours = fullShiftHours;
        }
      } else {
        // Only set default actualHours if it's null/undefined and we don't have saved value
        const shouldSetDefault = (actualHours === null || actualHours === undefined) && (!employee?.actual_hours && employee?.actual_hours !== 0);
        console.log('🔍 [AttendanceModal] Reporting mode - shouldSetDefault:', shouldSetDefault, {
          actualHours,
          employee_actual_hours: employee?.actual_hours,
          fullShiftHours
        });
        if (shouldSetDefault) {
          console.log('🔍 [AttendanceModal] Setting actualHours to fullShiftHours:', fullShiftHours);
          actualHours = fullShiftHours;
        }
      }
      
      console.log('🔍 [AttendanceModal] loadShiftInfo completed. Final state:', {
        fromTime,
        toTime,
        plannedHours,
        actualHours,
        hasSavedHours
      });
    } catch (error) {
      console.error('Error loading shift info:', error);
    } finally {
      isLoadingShiftInfo = false;
    }
  }

  // Calculate hours from time range
  function calculateHoursFromTimes() {
    console.log('🔍 [AttendanceModal] calculateHoursFromTimes called with:', {
      fromTime,
      toTime,
      isPlanningMode,
      shiftBreaks: shiftBreaks.length
    });
    
    if (!fromTime || !toTime) {
      console.log('🔍 [AttendanceModal] Missing times, setting hours to null');
      if (isPlanningMode) {
        plannedHours = null;
      } else {
        actualHours = null;
      }
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
      
      const calculatedHours = Math.max(0, (durationMinutes - breakMinutes) / 60);
      console.log('🔍 [AttendanceModal] Calculated hours:', {
        durationMinutes,
        breakMinutes,
        calculatedHours,
        isPlanningMode
      });
      
      if (isPlanningMode) {
        console.log('🔍 [AttendanceModal] Setting plannedHours to:', calculatedHours, '(was:', plannedHours, ')');
        plannedHours = calculatedHours;
      } else {
        console.log('🔍 [AttendanceModal] Setting actualHours to:', calculatedHours, '(was:', actualHours, ')');
        actualHours = calculatedHours;
      }
    } catch (error) {
      console.error('Error calculating hours:', error);
      if (isPlanningMode) {
        plannedHours = null;
      } else {
        actualHours = null;
      }
    }
  }

  // Watch time changes to recalculate hours (only if not loading saved data and we don't have saved hours)
  $: if (fromTime && toTime && attendanceStatus === 'present' && !isLoadingSavedData && !hasSavedHours) {
    console.log('🔍 [AttendanceModal] Reactive statement triggered - recalculating hours from times:', {
      fromTime,
      toTime,
      isLoadingSavedData,
      hasSavedHours,
      isPlanningMode
    });
    calculateHoursFromTimes();
  }

  // Handle manual time changes - clear saved hours flag to allow recalculation
  function handleTimeChange() {
    console.log('🔍 [AttendanceModal] Time manually changed, clearing hasSavedHours flag');
    isEditingTime = true; // Mark that user is editing
    if (hasSavedHours) {
      hasSavedHours = false; // Allow recalculation when user manually changes times
    }
  }
  
  // Handle time input focus - mark as editing
  function handleTimeFocus() {
    isEditingTime = true;
    console.log('🔍 [AttendanceModal] Time input focused, isEditingTime = true');
  }
  
  // Handle time input blur - allow reset after a delay
  function handleTimeBlur() {
    // Use setTimeout to allow the value to be set before we allow reset
    setTimeout(() => {
      isEditingTime = false;
      console.log('🔍 [AttendanceModal] Time input blurred, isEditingTime = false. Current values:', {
        fromTime,
        toTime,
        plannedHours,
        actualHours
      });
    }, 100);
  }

  // Reset form when modal opens - only initialize once per employee/modal open
  // IMPORTANT: Only check showModal and employee, NOT isEditingTime, to prevent re-initialization
  $: if (showModal && employee) {
    const currentEmployeeId = employee.emp_id;
    const isNewEmployee = previousEmployeeId !== currentEmployeeId;
    const isModalJustOpened = !formInitialized || isNewEmployee;
    
    // Only initialize if this is a new employee or modal just opened
    // AND not currently editing (to prevent resetting user's changes)
    if (isModalJustOpened && !isEditingTime) {
      console.log('🔍 [AttendanceModal] Modal opening, loading employee data:', {
        empId: employee.emp_id,
        empName: employee.emp_name,
        attendance_status: employee.attendance_status,
        planned_hours: employee.planned_hours,
        actual_hours: employee.actual_hours,
        from_time: employee.attendance_from_time,
        to_time: employee.attendance_to_time,
        notes: employee.attendance_notes,
        isPlanningMode,
        isNewEmployee,
        formInitialized
      });
      
      previousEmployeeId = currentEmployeeId;
      formInitialized = true;
      isLoadingSavedData = true; // Prevent recalculation while loading
      attendanceStatus = employee.attendance_status || 'present';
      // Load saved values if they exist (normalize to HH:MM)
      notes = employee.attendance_notes || '';
      fromTime = employee.attendance_from_time ? employee.attendance_from_time.substring(0,5) : '';
      toTime = employee.attendance_to_time ? employee.attendance_to_time.substring(0,5) : '';

      const dayStr = dayFromSelected();
      if (attendanceStatus === 'absent') {
        cOffValue = 0;
        cOffFromDate = '';
        cOffFromTime = '';
        cOffToDate = '';
        cOffToTime = '';
        attendanceFromDate = '';
        attendanceToDate = '';
      } else {
        attendanceFromDate = employee.attendance_from_date
          ? String(employee.attendance_from_date).split('T')[0]
          : dayStr;
        attendanceToDate = employee.attendance_to_date
          ? String(employee.attendance_to_date).split('T')[0]
          : dayStr;

        const rawC = employee.c_off_value != null ? Number(employee.c_off_value) : 0;
        cOffValue = [0, 0.5, 1, 1.5].includes(rawC) ? rawC : 0;
        const fd = employee.c_off_from_date;
        cOffFromDate = fd ? String(fd).split('T')[0] : '';
        cOffFromTime = employee.c_off_from_time ? String(employee.c_off_from_time).substring(0, 5) : '';
        const td = employee.c_off_to_date;
        cOffToDate = td ? String(td).split('T')[0] : '';
        cOffToTime = employee.c_off_to_time ? String(employee.c_off_to_time).substring(0, 5) : '';
        if (cOffValue > 0 && cOffFromDate && cOffFromTime) {
          if (!cOffToDate?.trim()) cOffToDate = cOffFromDate;
          if (!cOffToTime?.trim()) syncCOffToEndFromStart();
        }
      }
      
      console.log('🔍 [AttendanceModal] Loaded times:', { fromTime, toTime });
      
      // Load hours based on mode - use saved hours if available
      if (isPlanningMode) {
        const savedHours = employee.planned_hours ?? null;
        plannedHours = savedHours;
        actualHours = null;
        hasSavedHours = savedHours !== null && savedHours !== undefined;
        console.log('🔍 [AttendanceModal] Planning mode - savedHours:', savedHours, 'hasSavedHours:', hasSavedHours, 'plannedHours set to:', plannedHours);
      } else {
        const savedHours = employee.actual_hours ?? null;
        actualHours = savedHours;
        plannedHours = null;
        hasSavedHours = savedHours !== null && savedHours !== undefined;
        console.log('🔍 [AttendanceModal] Reporting mode - savedHours:', savedHours, 'hasSavedHours:', hasSavedHours, 'actualHours set to:', actualHours);
      }
      
      loadShiftInfo().then(() => {
        console.log('🔍 [AttendanceModal] Shift info loaded. Current state:', {
          fromTime,
          toTime,
          plannedHours,
          actualHours,
          hasSavedHours,
          fullShiftHours
        });
        // After shift info is loaded, allow recalculation if times are manually changed
        isLoadingSavedData = false;
        console.log('🔍 [AttendanceModal] isLoadingSavedData set to false');
        if (cOffValue > 0 && cOffFromDate?.trim() && cOffFromTime?.trim()) {
          syncCOffToEndFromStart();
        }
      });
    } else {
      console.log('🔍 [AttendanceModal] Skipping initialization - already initialized or user is editing', {
        formInitialized,
        isNewEmployee,
        isEditingTime,
        currentEmployeeId,
        previousEmployeeId
      });
    }
  }
  
  // Reset form initialization when modal closes
  $: if (!showModal) {
    formInitialized = false;
    previousEmployeeId = null;
    isEditingTime = false;
  }

  function handleSubmit() {
    if (!employee) {
      console.error('No employee selected for attendance marking');
      return;
    }

    // Validate notes if required
    if (isNotesRequired && !notes.trim()) {
      if (isPlanningMode) {
        alert('Reason is required for partial attendance (hours less than full shift)');
      } else {
        alert('Reason is required for early out (actual hours less than planned hours or full shift)');
      }
      return;
    }

    if (attendanceStatus === 'present' && cOffValue > 0) {
      const netHoursCheck = validateNetHoursForCoffAllow(currentHours);
      if (!netHoursCheck.ok) {
        alert(netHoursCheck.message);
        return;
      }
      if (!cOffFromDate?.trim() || !cOffFromTime?.trim()) {
        alert('C-Off: please set From Date and From Time when C-Off value is greater than zero.');
        return;
      }
      syncCOffToEndFromStart();
      const attFrom = attendanceFromDate?.trim() || dayFromSelected();
      const attTo = attendanceToDate?.trim() || attFrom;
      const spanCheck = validateCOffWithinAttendanceWindow(cOffValue, {
        attendanceFromDate: attFrom,
        attendanceToDate: attTo,
        attendanceFromTime: (fromTime || '').trim(),
        attendanceToTime: (toTime || '').trim(),
        cOffFromDate: (cOffFromDate || '').trim(),
        cOffFromTime: (cOffFromTime || '').trim(),
        cOffToDate: (cOffToDate || '').trim(),
        cOffToTime: (cOffToTime || '').trim()
      });
      if (!spanCheck.ok) {
        alert(spanCheck.message);
        return;
      }
    }

    isSubmitting = true;
    
    // Dispatch event to parent component
    const eventData: any = {
      empId: employee.emp_id,
      stageCode: employee.current_stage,
      date: selectedDate,
      status: attendanceStatus,
      shiftCode: employee.shift_code,
      notes: notes.trim() || undefined
    };

    // Add time/hours fields only for present employees
    if (attendanceStatus === 'present') {
      eventData.fromTime = fromTime;
      eventData.toTime = toTime;
      eventData.attendanceFromDate = attendanceFromDate?.trim() || dayFromSelected();
      eventData.attendanceToDate = attendanceToDate?.trim() || eventData.attendanceFromDate;
      if (isPlanningMode) {
        eventData.plannedHours = plannedHours;
      } else {
        eventData.actualHours = actualHours;
      }
      eventData.cOffValue = cOffValue;
      eventData.cOffFromDate = cOffFromDate?.trim() || undefined;
      eventData.cOffFromTime = cOffFromTime?.trim() || undefined;
      eventData.cOffToDate = cOffToDate?.trim() || undefined;
      eventData.cOffToTime = cOffToTime?.trim() || undefined;
      console.log('🔍 [AttendanceModal] Added time/hours to eventData:', {
        fromTime: eventData.fromTime,
        toTime: eventData.toTime,
        plannedHours: eventData.plannedHours,
        actualHours: eventData.actualHours,
        isPlanningMode
      });
    }

    console.log('🔍 [AttendanceModal] Dispatching attendanceMarked event with FULL data:', JSON.stringify(eventData, null, 2));
    console.log('🔍 [AttendanceModal] Current state values:', {
      fromTime,
      toTime,
      plannedHours,
      actualHours,
      attendanceStatus,
      isPlanningMode
    });
    dispatch('attendanceMarked', eventData);

    // Reset form
    attendanceStatus = 'present';
    notes = '';
    fromTime = '';
    toTime = '';
    if (isPlanningMode) {
      plannedHours = null;
    } else {
      actualHours = null;
    }
    cOffValue = 0;
    cOffFromDate = '';
    cOffFromTime = '';
    cOffToDate = '';
    cOffToTime = '';
    attendanceFromDate = '';
    attendanceToDate = '';
    isSubmitting = false;
  }

  function handleClose() {
    // Reset flags when closing
    isLoadingSavedData = false;
    hasSavedHours = false;
    isEditingTime = false;
    formInitialized = false;
    previousEmployeeId = null;
    dispatch('close');
  }
</script>

{#if showModal}
  <!-- svelte-ignore a11y_click_events_have_key_events — backdrop dismiss; dialog handles keyboard -->
  <div
    class="fixed inset-0 z-[1000] flex items-center justify-center bg-black/50 p-3"
    role="presentation"
    on:click|self={handleClose}
  >
    <div
      class="flex max-h-[min(92vh,900px)] min-h-0 w-full min-w-0 max-w-[1120px] flex-col rounded-lg border theme-border theme-bg-primary p-4 shadow-lg sm:px-[18px] sm:py-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="attendance-modal-title"
      tabindex="-1"
      on:click|stopPropagation
    >
      <div class="mb-3 flex shrink-0 items-center gap-3">
        <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-500">
          <span class="text-xl text-white">👤</span>
        </div>
        <div>
          <h3 id="attendance-modal-title" class="m-0 text-lg font-semibold theme-text-primary">Mark Attendance</h3>
          {#if employee}
            <p class="theme-text-secondary text-sm mt-1 m-0">
              {employee.emp_name} ({employee.emp_id})
            </p>
          {/if}
        </div>
      </div>

      {#if employee}
        <div class="mb-3 shrink-0 rounded-lg border theme-border theme-bg-secondary p-2.5 sm:px-3">
          <p class="theme-text-primary text-sm m-1">
            <strong>Date:</strong>
            {new Date(selectedDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' })}
          </p>
          <p class="theme-text-primary text-sm m-1">
            <strong>Stage:</strong>
            {employee.current_stage}
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
                <label class="flex cursor-pointer items-center gap-2">
                  <input class="accent-blue-600" type="radio" bind:group={attendanceStatus} value="absent" />
                  <span class="text-sm text-slate-800">Absent</span>
                </label>
              </fieldset>
            </section>

            <section
              class="min-w-[180px] max-w-full flex-1 basis-[200px] rounded-lg border border-sky-300/80 bg-sky-50 p-3 text-slate-900 dark:border-sky-400/50 dark:bg-sky-100 dark:text-slate-900"
            >
              {#if attendanceStatus === 'present'}
                {#if isLoadingShiftInfo}
                  <p class="text-sm text-slate-600">Loading shift…</p>
                {:else}
                  <p class="mb-2 text-sm font-semibold text-slate-900">Shift times</p>
                  <div class="mb-2 grid grid-cols-2 gap-2">
                    <div>
                      <label for="att-from-date" class="mb-1 block text-xs font-medium text-slate-700">From date</label>
                      <input
                        id="att-from-date"
                        type="date"
                        bind:value={attendanceFromDate}
                        class="w-full rounded-md border px-2 py-1.5 text-sm theme-border theme-bg-primary theme-text-primary focus:border-transparent focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label for="from-time" class="mb-1 block text-xs font-medium text-slate-700">From time</label>
                      <input
                        id="from-time"
                        type="time"
                        bind:value={fromTime}
                        on:input={handleTimeChange}
                        on:focus={handleTimeFocus}
                        on:blur={handleTimeBlur}
                        class="w-full rounded-md border px-2 py-1.5 text-sm theme-border theme-bg-primary theme-text-primary focus:border-transparent focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label for="att-to-date" class="mb-1 block text-xs font-medium text-slate-700">To date</label>
                      <input
                        id="att-to-date"
                        type="date"
                        bind:value={attendanceToDate}
                        class="w-full rounded-md border px-2 py-1.5 text-sm theme-border theme-bg-primary theme-text-primary focus:border-transparent focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label for="to-time" class="mb-1 block text-xs font-medium text-slate-700">To time</label>
                      <input
                        id="to-time"
                        type="time"
                        bind:value={toTime}
                        on:input={handleTimeChange}
                        on:focus={handleTimeFocus}
                        on:blur={handleTimeBlur}
                        class="w-full rounded-md border px-2 py-1.5 text-sm theme-border theme-bg-primary theme-text-primary focus:border-transparent focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                  <div
                    class="rounded border border-dashed border-sky-400/70 bg-sky-200/50 p-2 text-slate-800 dark:border-sky-500/60 dark:bg-sky-200/40 dark:text-slate-900"
                  >
                    <span class="text-sm font-medium text-slate-900">
                      {isPlanningMode ? 'Planned' : 'Actual'}: {currentHours !== null ? `${currentHours.toFixed(2)}h` : '…'}
                    </span>
                    <span class="ml-1 text-xs text-slate-700">(full {fullShiftHours.toFixed(2)}h)</span>
                    {#if !isPlanningMode && employee?.planned_hours}
                      <span class="text-xs text-slate-700"> | Plan {employee.planned_hours.toFixed(2)}h</span>
                    {/if}
                  </div>
                {/if}
              {:else}
                <p class="text-sm text-slate-600">Dates and times apply when present.</p>
              {/if}
            </section>

            <section
              class="min-w-[180px] max-w-full flex-1 basis-[200px] rounded-lg border border-sky-300/80 bg-sky-50 p-3 text-slate-900 dark:border-sky-400/50 dark:bg-sky-100 dark:text-slate-900"
            >
              {#if attendanceStatus === 'present'}
                <p class="mb-2 text-sm font-semibold text-slate-900">C-Off (optional)</p>
                <label class="mb-1 block text-xs font-medium text-slate-700" for="coff-value">Value (days)</label>
                <select
                  id="coff-value"
                  value={String(cOffValue)}
                  on:change={(e) => {
                    const v = parseFloat(e.currentTarget.value);
                    cOffValue = [0, 0.5, 1, 1.5].includes(v) ? v : 0;
                    if (cOffValue > 0) {
                      if (!cOffFromDate?.trim()) cOffFromDate = dayFromSelected();
                      if (!cOffFromTime?.trim() && fromTime?.trim()) cOffFromTime = fromTime.trim().substring(0, 5);
                      syncCOffToEndFromStart();
                    }
                  }}
                  class="mb-2 w-full rounded-md border px-2 py-1.5 text-sm theme-border theme-bg-primary theme-text-primary focus:border-transparent focus:ring-2 focus:ring-blue-500"
                >
                  <option value="0">0</option>
                  <option value="0.5">0.5 (4h)</option>
                  <option value="1">1 (8h)</option>
                  <option value="1.5">1.5 (12h)</option>
                </select>
                {#if cOffValue > 0}
                  <div class="grid grid-cols-2 gap-2">
                    <div>
                      <label for="coff-from-date" class="mb-1 block text-xs font-medium text-slate-700">From date *</label>
                      <input
                        id="coff-from-date"
                        type="date"
                        bind:value={cOffFromDate}
                        on:change={syncCOffToEndFromStart}
                        class="w-full rounded-md border px-2 py-1.5 text-sm theme-border theme-bg-primary theme-text-primary focus:border-transparent focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label for="coff-from-time" class="mb-1 block text-xs font-medium text-slate-700">From time *</label>
                      <input
                        id="coff-from-time"
                        type="time"
                        bind:value={cOffFromTime}
                        on:change={syncCOffToEndFromStart}
                        class="w-full rounded-md border px-2 py-1.5 text-sm theme-border theme-bg-primary theme-text-primary focus:border-transparent focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label for="coff-to-date" class="mb-1 block text-xs font-medium text-slate-700">To date</label>
                      <input
                        id="coff-to-date"
                        type="date"
                        bind:value={cOffToDate}
                        class="w-full rounded-md border px-2 py-1.5 text-sm theme-border theme-bg-primary theme-text-primary focus:border-transparent focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label for="coff-to-time" class="mb-1 block text-xs font-medium text-slate-700">To time</label>
                      <input
                        id="coff-to-time"
                        type="time"
                        bind:value={cOffToTime}
                        class="w-full rounded-md border px-2 py-1.5 text-sm theme-border theme-bg-primary theme-text-primary focus:border-transparent focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                  <p class="m-0 mt-2 text-xs leading-snug text-slate-600">
                    To end uses net hours (0.5 / 1 / 1.5 day) plus shift breaks in that window—editable. C-Off is
                    only allowed when attendance (excluding breaks) is exactly 4, 8, or 12 hours. C-Off must fall
                    entirely within attendance from/to date and time (extend attendance if needed).
                  </p>
                {/if}
              {:else}
                <p class="text-sm text-slate-600">C-Off cleared when absent.</p>
              {/if}
            </section>

            <section
              class="flex min-h-0 min-w-[200px] max-w-full flex-1 basis-[200px] flex-col rounded-lg border border-sky-300/80 bg-sky-50 p-3 text-slate-900 dark:border-sky-400/50 dark:bg-sky-100 dark:text-slate-900"
            >
              <label for="notes" class="mb-2 text-sm font-semibold text-slate-900">{notesLabel}</label>
              <textarea
                id="notes"
                bind:value={notes}
                rows="5"
                class="min-h-[100px] w-full flex-1 rounded-md border border-slate-300 px-2 py-1.5 text-sm !bg-white !text-slate-900 placeholder:text-slate-400 focus:border-transparent focus:ring-2 focus:ring-blue-500 dark:border-slate-600 dark:!bg-slate-900 dark:!text-slate-100 dark:placeholder:text-slate-400"
                placeholder={isNotesRequired ? 'Reason for partial attendance…' : 'Notes…'}
                required={isNotesRequired}
              ></textarea>
              {#if isNotesRequired && !notes.trim()}
                <p class="text-red-500 dark:text-red-400 text-xs mt-1 m-0">Reason required</p>
              {/if}
            </section>
          </div>
        </div>

        <div class="flex shrink-0 justify-end gap-3 border-t theme-border pt-2">
          <Button variant="secondary" size="md" on:click={handleClose}>Cancel</Button>
          <Button variant="primary" size="md" on:click={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? 'Saving…' : 'Save'}
          </Button>
        </div>
      {:else}
        <div class="text-center p-5">
          <p class="text-red-500 dark:text-red-400">No employee selected.</p>
          <Button variant="secondary" size="md" class="mt-3" on:click={handleClose}>Close</Button>
        </div>
      {/if}
    </div>
  </div>
{/if}
