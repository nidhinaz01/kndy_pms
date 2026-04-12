<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import Button from '$lib/components/common/Button.svelte';
  import { fetchAvailableStages, fetchStagesForShift, fetchShiftDetails } from '$lib/api/production';
  import type { ProductionEmployee } from '$lib/api/production';
  import { supabase } from '$lib/supabaseClient';
  import { isDestinationStageSubmissionLocked } from '$lib/utils/manpowerTableUtils';

  export let showModal: boolean = false;
  export let employee: ProductionEmployee | null = null;
  export let selectedDate: string = '';
  /** Which submission table to check for the *destination* stage+shift+date */
  export let reassignmentMode: 'planning' | 'reporting' = 'planning';

  const dispatch = createEventDispatcher();

  // Form state
  let availableStages: string[] = [];
  /** True when hr_shift_stage_master returned no rows for this shift (do not fall back to all stages). */
  let noShiftStageMapping = false;
  /** Avoid re-fetching stages on every parent re-render when modal stays open for the same employee/shift. */
  let lastStagesLoadKey = '';
  let selectedStage: string = '';
  let fromTime: string = '';
  let toTime: string = '';
  let reason: string = '';
  let isSubmitting = false;
  let isLoadingStages = false;
  let isLoadingShift = false;

  let destinationLockError = '';
  let destinationCheckInFlight = false;
  let destFetchSeq = 0;
  let destStatusFetchKey = '';

  // Validation state
  let fromTimeError: string = '';
  let toTimeError: string = '';
  let overlapError: string = '';
  let workPlanConflictError: string = '';

  // Shift information
  let shiftDetails: {
    shift: {
      shift_id: number;
      shift_name: string;
      shift_code: string;
      start_time: string;
      end_time: string;
    } | null;
    breaks: Array<{
      break_id: number;
      break_number: number;
      break_name: string;
      start_time: string;
      end_time: string;
    }>;
  } = { shift: null, breaks: [] };

  // Load available stages when modal opens
  onMount(async () => {
    await loadStages();
  });

  // Reload target stages when modal opens or employee/shift changes (shift-scoped list from hr_shift_stage_master)
  $: if (showModal && employee) {
    const key = employee.shift_code?.trim()
      ? `${employee.emp_id}::${employee.shift_code.trim()}`
      : `${employee.emp_id}::noshift`;
    if (key !== lastStagesLoadKey) {
      lastStagesLoadKey = key;
      loadStages();
    }
  }
  $: destLockKey =
    showModal && employee?.shift_code?.trim() && selectedStage && selectedDate
      ? `${reassignmentMode}|${selectedStage}|${employee.shift_code.trim()}|${selectedDate.split('T')[0]}`
      : '';

  $: if (!showModal) {
    lastStagesLoadKey = '';
    destStatusFetchKey = '';
    destinationLockError = '';
    destinationCheckInFlight = false;
  }

  $: if (destLockKey && destLockKey !== destStatusFetchKey) {
    destStatusFetchKey = destLockKey;
    void loadDestinationSubmissionLock(destLockKey);
  } else if (!destLockKey && showModal) {
    destinationLockError = '';
    destinationCheckInFlight = false;
    destStatusFetchKey = '';
  }

  async function loadDestinationSubmissionLock(key: string) {
    const seq = ++destFetchSeq;
    destinationCheckInFlight = true;
    destinationLockError = '';
    const parts = key.split('|');
    const mode = parts[0] as 'planning' | 'reporting';
    const stage = parts[1];
    const shift = parts[2];
    const dateStr = parts[3];
    try {
      const { getPlanningSubmissionStatus, getReportingSubmissionStatus } = await import(
        '../../../routes/production/[stage_Shift]/services/pageDataService'
      );
      const row =
        mode === 'planning'
          ? await getPlanningSubmissionStatus(stage, shift, dateStr)
          : await getReportingSubmissionStatus(stage, shift, dateStr);
      if (seq !== destFetchSeq) return;
      if (isDestinationStageSubmissionLocked(row)) {
        const doc = mode === 'planning' ? 'plan' : 'report';
        const st = row?.status;
        const statusWords =
          st === 'pending_approval'
            ? 'submitted (pending approval)'
            : st === 'approved'
              ? 'approved'
              : st === 'resubmitted'
                ? 'resubmitted'
                : String(st);
        destinationLockError = `Reassignment to ${stage} is not permitted: the ${doc} for ${stage}–${shift} on this date is ${statusWords}. Reassignment is only allowed when the ${doc} is still in draft (or not yet created).`;
      }
    } catch (e) {
      if (seq === destFetchSeq) {
        destinationLockError = 'Could not verify destination stage. Please try again.';
      }
    } finally {
      if (seq === destFetchSeq) destinationCheckInFlight = false;
    }
  }

  // Watch for modal opening and load shift details (only if attendance times are not available)
  $: if (showModal && employee && !shiftDetails.shift) {
    // Only load shift details if attendance times are not marked (fallback)
    if (!employee.attendance_from_time || !employee.attendance_to_time) {
      loadShiftDetails();
    }
  }
  
  // Watch for modal opening and initialize times from attendance if available
  let timesInitialized = false;
  $: if (showModal && employee && !timesInitialized) {
    // Initialize from and to times from attendance if available
    if (employee.attendance_from_time && employee.attendance_to_time) {
      fromTime = employee.attendance_from_time.substring(0, 5); // Extract HH:MM from HH:MM:SS
      toTime = employee.attendance_to_time.substring(0, 5);
      timesInitialized = true;
    }
  }
  $: if (!showModal) {
    timesInitialized = false;
  }

  // Reset selectedStage when modal opens (only once)
  let modalOpened = false;
  $: if (showModal && availableStages.length > 0 && employee && !modalOpened) {
    selectedStage = '';
    modalOpened = true;
  }
  $: if (!showModal) {
    modalOpened = false;
  }

  // Watch for time changes and validate
  $: if (fromTime || toTime) {
    validateTimes();
    // Call async function without await (it will update workPlanConflictError when done)
    checkWorkPlanConflicts();
  }


  async function loadStages() {
    try {
      isLoadingStages = true;
      noShiftStageMapping = false;
      const shiftCode = employee?.shift_code?.trim();
      if (shiftCode) {
        const mapped = await fetchStagesForShift(shiftCode);
        availableStages = mapped;
        noShiftStageMapping = mapped.length === 0;
        if (noShiftStageMapping) {
          console.warn(
            `No stages in hr_shift_stage_master for shift "${shiftCode}". Configure shift–stage rows in HR.`
          );
        }
      } else {
        availableStages = await fetchAvailableStages();
        noShiftStageMapping = false;
      }
    } catch (error) {
      console.error('Error loading stages:', error);
      availableStages = [];
      noShiftStageMapping = false;
    } finally {
      isLoadingStages = false;
    }
  }

  async function loadShiftDetails() {
    if (!employee) return;
    
    try {
      isLoadingShift = true;
      console.log('Loading shift details for:', employee.shift_code);
      shiftDetails = await fetchShiftDetails(employee.shift_code);
      console.log('Shift details loaded:', shiftDetails);
    } catch (error) {
      console.error('Error loading shift details:', error);
    } finally {
      isLoadingShift = false;
    }
  }

  async function checkWorkPlanConflicts() {
    workPlanConflictError = '';
    
    if (!employee || !fromTime || !toTime || !selectedDate) return;
    
    try {
      // Check if worker has existing work plans that overlap with the reassignment time
      const { data: existingPlans, error } = await supabase
        .from('prdn_work_planning')
        .select('id, from_date, from_time, to_date, to_time, stage_code, std_work_type_details(derived_sw_code, std_work_details(sw_name))')
        .eq('worker_id', employee.emp_id)
        .eq('from_date', selectedDate)
        .in('status', ['draft', 'pending_approval', 'approved'])
        .eq('is_active', true)
        .eq('is_deleted', false);
      
      if (error) {
        console.error('Error checking work plan conflicts:', error);
        return;
      }
      
      if (!existingPlans || existingPlans.length === 0) return;
      
      // Check for time overlaps
      const fromDateTime = new Date(`${selectedDate}T${fromTime}`);
      const toDateTime = new Date(`${selectedDate}T${toTime}`);
      
      const conflictingPlans = existingPlans.filter((plan: any) => {
        if (!plan.from_time || !plan.to_time) return false;
        const planFromDateTime = new Date(`${plan.from_date}T${plan.from_time}`);
        const planToDateTime = new Date(`${plan.to_date}T${plan.to_time}`);
        return (fromDateTime < planToDateTime && toDateTime > planFromDateTime);
      });
      
      if (conflictingPlans.length > 0) {
        const conflictDetails = conflictingPlans.map((plan: any) => {
          const workName = plan.std_work_type_details?.std_work_details?.sw_name || 'Unknown Work';
          const workCode = plan.std_work_type_details?.derived_sw_code || 'Unknown';
          return `${workName} (${workCode}) in ${plan.stage_code} from ${formatTime(plan.from_time)} to ${formatTime(plan.to_time)}`;
        }).join(', ');
        
        workPlanConflictError = `Worker has existing work plans during this time: ${conflictDetails}`;
      }
    } catch (error) {
      console.error('Error checking work plan conflicts:', error);
    }
  }

  function validateTimes() {
    fromTimeError = '';
    toTimeError = '';
    overlapError = '';

    // Normalize attendance times to HH:MM when present (employee.attendance_* may include seconds)
    const rawAttendanceStart = employee?.attendance_from_time;
    const rawAttendanceEnd = employee?.attendance_to_time;
    const attendanceStart = rawAttendanceStart ? rawAttendanceStart.substring(0, 5) : null;
    const attendanceEnd = rawAttendanceEnd ? rawAttendanceEnd.substring(0, 5) : null;

    // Use attendance time range if available, otherwise use shift time (normalized)
    let timeStart: string;
    let timeEnd: string;

    if (attendanceStart && attendanceEnd) {
      timeStart = attendanceStart;
      timeEnd = attendanceEnd;
    } else if (shiftDetails.shift) {
      timeStart = shiftDetails.shift.start_time.substring(0, 5);
      timeEnd = shiftDetails.shift.end_time.substring(0, 5);
    } else {
      // No time constraints available
      return;
    }

    // Calculate earliest allowed time (3 hours before time start)
    const earliestAllowedTime = subtractHours(timeStart, 3);

    if (fromTime) {
      // Allow start time up to 3 hours before time start
      if (fromTime < earliestAllowedTime) {
        fromTimeError = `Start time cannot be more than 3 hours before ${attendanceStart ? 'attendance start' : 'shift start'} (${formatTime(earliestAllowedTime)})`;
      }
      // Ensure fromTime is not before attendance start (compare normalized HH:MM)
      if (attendanceStart && fromTime < attendanceStart) {
        fromTimeError = `Start time cannot be before attendance start time (${formatTime(attendanceStart)})`;
      }
    }

    if (toTime) {
      // Ensure toTime is not after attendance end (compare normalized HH:MM)
      if (attendanceEnd && toTime > attendanceEnd) {
        toTimeError = `End time cannot be after attendance end time (${formatTime(attendanceEnd)})`;
      } else if (!attendanceEnd && shiftDetails.shift && toTime > timeEnd) {
        toTimeError = `End time cannot be after ${formatTime(timeEnd)} (shift end)`;
      }
    }

    if (fromTime && toTime) {
      if (fromTime >= toTime) {
        toTimeError = 'End time must be after start time';
      }
      // Overlap check: new period must not overlap existing reassignments. Touching (e.g. 09:00–10:00 and 10:00–11:00) is allowed.
      if (employee?.stage_journey && employee.stage_journey.length > 0) {
        const newStart = fromTime.substring(0, 5);
        const newEnd = toTime.substring(0, 5);
        for (const journey of employee.stage_journey) {
          const exStart = journey.from_time ? journey.from_time.substring(0, 5) : null;
          const exEnd = journey.to_time ? journey.to_time.substring(0, 5) : null;
          if (!exStart || !exEnd) continue;
          // Overlap when: newStart < exEnd && exStart < newEnd (touching is OK: newEnd === exStart or exEnd === newStart)
          if (newStart < exEnd && exStart < newEnd) {
            overlapError = `This time period overlaps with an existing reassignment (${exStart} – ${exEnd}). Use a different period or touching periods (e.g. 10:00 after 09:00–10:00).`;
            break;
          }
        }
      }
    }
  }

  async function handleSubmit() {
    if (!employee) {
      console.error('No employee selected for stage reassignment');
      return;
    }
    
    if (!selectedStage) {
      console.error('No target stage selected');
      return;
    }

    if (!fromTime || !toTime) {
      console.error('Time range not specified');
      return;
    }

    // Validate times before submitting
    validateTimes();
    // Check work plan conflicts (async, but we'll wait for it)
    await checkWorkPlanConflicts();
    if (fromTimeError || toTimeError || overlapError || workPlanConflictError) {
      console.error('Validation failed:', { fromTimeError, toTimeError, overlapError, workPlanConflictError });
      return;
    }

    await loadDestinationSubmissionLock(
      `${reassignmentMode}|${selectedStage}|${employee.shift_code.trim()}|${selectedDate.split('T')[0]}`
    );
    if (destinationLockError) {
      console.error('Destination stage submission locked:', destinationLockError);
      return;
    }

    isSubmitting = true;
    
    // Reassignments are always from the employee's home stage (original_stage), not current_stage.
    const fromStage = employee.original_stage || employee.current_stage;
    const empId = employee.emp_id;
    const shiftCodeVal = employee.shift_code;
    const currentStageForReset = employee.current_stage;

    dispatch('stageReassigned', {
      empId,
      fromStageCode: fromStage,
      toStageCode: selectedStage,
      date: selectedDate,
      shiftCode: shiftCodeVal,
      fromTime: fromTime,
      toTime: toTime,
      reason: reason.trim() || undefined
    });

    // Reset form (parent may clear employee after dispatch, so use captured values)
    selectedStage = currentStageForReset;
    fromTime = '';
    toTime = '';
    reason = '';
    fromTimeError = '';
    toTimeError = '';
    overlapError = '';
    isSubmitting = false;
  }

  function handleClose() {
    destFetchSeq++;
    dispatch('close');
  }

  function formatTime(timeStr: string): string {
    return timeStr.substring(0, 5); // Show only HH:MM
  }

  function subtractHours(timeStr: string, hours: number): string {
    // Convert time string (HH:MM or HH:MM:SS) to minutes, subtract hours, then convert back
    const [hoursPart, minutesPart] = timeStr.split(':').map(Number);
    const totalMinutes = hoursPart * 60 + minutesPart;
    const subtractedMinutes = totalMinutes - (hours * 60);
    
    // Handle negative values (wrap around to previous day)
    const adjustedMinutes = subtractedMinutes < 0 ? subtractedMinutes + (24 * 60) : subtractedMinutes;
    
    const newHours = Math.floor(adjustedMinutes / 60) % 24;
    const newMinutes = adjustedMinutes % 60;
    
    return `${newHours.toString().padStart(2, '0')}:${newMinutes.toString().padStart(2, '0')}`;
  }

  function getAvailableTimeRange() {
    // Normalize times to HH:MM for reliable comparisons and display
    const rawAttendanceStart = employee?.attendance_from_time;
    const rawAttendanceEnd = employee?.attendance_to_time;
    const attendanceStart = rawAttendanceStart ? rawAttendanceStart.substring(0, 5) : null;
    const attendanceEnd = rawAttendanceEnd ? rawAttendanceEnd.substring(0, 5) : null;

    let availableStart = '';
    let availableEnd = '';

    if (attendanceStart && attendanceEnd) {
      availableStart = attendanceStart;
      availableEnd = attendanceEnd;
    } else if (shiftDetails.shift) {
      availableStart = shiftDetails.shift.start_time.substring(0, 5);
      availableEnd = shiftDetails.shift.end_time.substring(0, 5);
    }

    // If this is a reassignment, check the original assignment time constraints
    if (employee?.stage_journey && employee.stage_journey.length > 0) {
      const lastAssignment = employee.stage_journey[employee.stage_journey.length - 1];
      if (lastAssignment.to_stage === employee.current_stage) {
        // Normalize original assignment times
        const originalStart = lastAssignment.from_time ? lastAssignment.from_time.substring(0, 5) : null;
        const originalEnd = lastAssignment.to_time ? lastAssignment.to_time.substring(0, 5) : null;

        if (originalStart && originalEnd) {
          // Use the intersection of attendance time and original assignment time when attendance exists
          if (attendanceStart && attendanceEnd) {
            availableStart = originalStart > attendanceStart ? originalStart : attendanceStart;
            availableEnd = originalEnd < attendanceEnd ? originalEnd : attendanceEnd;
          } else {
            availableStart = originalStart;
            availableEnd = originalEnd;
          }
        }
      }
    }

    return { start: availableStart, end: availableEnd };
  }

  // Reactive availableTimeRange used by the template
  let availableTimeRange: { start: string; end: string } = { start: '', end: '' };
  $: availableTimeRange = getAvailableTimeRange();
</script>

{#if showModal}
  <!-- Simple Modal Overlay -->
  <div style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0, 0, 0, 0.5); z-index: 1000; display: flex; align-items: center; justify-content: center;">
    
    <!-- Modal Content -->
    <div class="theme-bg-primary theme-border rounded-lg shadow-lg max-h-[90vh] overflow-y-auto" style="padding: 20px; min-width: 600px; max-width: 700px;">
      
      <!-- Header -->
      <div style="display: flex; align-items: center; margin-bottom: 20px;">
        <div class="bg-green-500 rounded-full" style="width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; margin-right: 15px;">
          <span style="color: white; font-size: 20px;">🔄</span>
        </div>
        <div>
          <h3 class="theme-text-primary" style="margin: 0; font-size: 18px; font-weight: 600;">Time-Based Stage Reassignment</h3>
          {#if employee}
            <p class="theme-text-secondary" style="margin: 5px 0 0 0; font-size: 14px;">
              {employee.emp_name} ({employee.emp_id})
            </p>
          {/if}
        </div>
      </div>

      <!-- Employee Info -->
      {#if employee}
        <div class="theme-bg-secondary theme-border rounded-lg" style="padding: 15px; margin-bottom: 20px;">
          <p class="theme-text-primary" style="margin: 5px 0; font-size: 14px;">
            <strong>Date:</strong> {new Date(selectedDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' })}
          </p>
          <p class="theme-text-primary" style="margin: 5px 0; font-size: 14px;">
            <strong>Current Stage:</strong> {employee.current_stage}
          </p>
          <p class="theme-text-primary" style="margin: 5px 0; font-size: 14px;">
            <strong>Shift:</strong> {employee.shift_code} ({employee.shift_name})
          </p>
        </div>

        <!-- Attendance Time Information -->
        {#if employee.attendance_from_time && employee.attendance_to_time}
          <div class="theme-bg-secondary theme-border rounded-lg" style="padding: 15px; margin-bottom: 20px;">
            <h4 class="theme-text-primary" style="margin: 0 0 10px 0; font-size: 16px; font-weight: 500;">Attendance Time Range:</h4>
            <p class="theme-text-primary font-medium">
              {formatTime(employee.attendance_from_time)} - {formatTime(employee.attendance_to_time)}
            </p>
            <p class="theme-text-secondary text-xs mt-2">
              Reassignment must be within this time range.
            </p>
          </div>
        {:else}
          <div class="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-500 rounded-lg" style="padding: 15px; margin-bottom: 20px;">
            <p class="text-yellow-800 dark:text-yellow-200 text-sm">
              <strong>⚠️ Attendance time not marked:</strong> Please mark attendance with time in the attendance modal before reassigning.
            </p>
          </div>
        {/if}

        <!-- Shift Information (fallback) -->
        {#if shiftDetails.shift && (!employee.attendance_from_time || !employee.attendance_to_time)}
          <div class="theme-bg-secondary theme-border rounded-lg" style="padding: 15px; margin-bottom: 20px;">
            <h4 class="theme-text-primary" style="margin: 0 0 10px 0; font-size: 16px; font-weight: 500;">Shift Details:</h4>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
              <div>
                <span class="theme-text-secondary text-sm">Shift Time:</span>
                <p class="theme-text-primary font-medium">{formatTime(shiftDetails.shift.start_time)} - {formatTime(shiftDetails.shift.end_time)}</p>
              </div>
              <div>
                <span class="theme-text-secondary text-sm">Breaks:</span>
                <p class="theme-text-primary font-medium">{shiftDetails.breaks.length} break(s)</p>
              </div>
            </div>
            
            {#if shiftDetails.breaks.length > 0}
              <div style="margin-top: 10px;">
                <span class="theme-text-secondary text-sm">Break Times:</span>
                <div style="display: flex; flex-wrap: wrap; gap: 5px; margin-top: 5px;">
                  {#each shiftDetails.breaks as breakItem}
                    <span class="theme-bg-primary theme-border rounded px-2 py-1 text-xs">
                      {breakItem.break_name}: {formatTime(breakItem.start_time)}-{formatTime(breakItem.end_time)}
                    </span>
                  {/each}
                </div>
              </div>
            {/if}
          </div>
        {/if}

        <!-- Form -->
        <div style="margin-bottom: 20px;">
          <!-- Target Stage -->
          <div style="margin-bottom: 20px;">
            <label for="targetStage" style="display: block; margin-bottom: 10px; font-weight: 500;">Target Stage:</label>
            {#if isLoadingStages}
              <div style="display: flex; align-items: center; justify-content: center; padding: 10px;">
                <div style="width: 20px; height: 20px; border: 2px solid #ccc; border-top: 2px solid #007bff; border-radius: 50%; animation: spin 1s linear infinite;"></div>
                <span style="margin-left: 8px; font-size: 14px;">Loading stages...</span>
              </div>
            {:else if noShiftStageMapping && employee?.shift_code}
              <p class="text-amber-700 dark:text-amber-300 text-sm">
                No stages are configured for shift <strong>{employee.shift_code}</strong> in
                <code class="text-xs">hr_shift_stage_master</code>. Add active shift–stage rows to enable reassignment targets.
              </p>
            {:else}
              <select
                id="targetStage"
                bind:value={selectedStage}
                style="width: 100%; padding: 8px; font-size: 14px; border: 1px solid #ccc; border-radius: 4px; background: white; color: black;"
              >
                <option value="">Select target stage...</option>
                {#each availableStages.filter(stage => stage !== (employee.original_stage || employee.current_stage)) as stage}
                  <option value={stage}>
                    {stage}
                  </option>
                {/each}
              </select>
            {/if}
            {#if destinationCheckInFlight && selectedStage}
              <p class="theme-text-secondary mt-2 text-sm">Checking destination {reassignmentMode === 'planning' ? 'plan' : 'report'} status…</p>
            {/if}
            {#if destinationLockError}
              <p class="mt-2 text-sm font-medium text-red-600 dark:text-red-400">{destinationLockError}</p>
            {/if}
          </div>

          <!-- Time Selection -->
          <fieldset style="margin-bottom: 20px;">
            <legend class="theme-text-primary" style="display: block; margin-bottom: 10px; font-weight: 500;">Reassignment Time Period:</legend>
            
            <!-- Available Time Range Info -->
            {#if availableTimeRange.start && availableTimeRange.end}
              <div class="mb-3 p-2 rounded text-xs" style="background-color: rgba(59, 130, 246, 0.1); border: 1px solid rgba(59, 130, 246, 0.3);">
                <p class="text-gray-900 dark:text-gray-100">
                  <strong>Available Time Range:</strong> {formatTime(availableTimeRange.start)} - {formatTime(availableTimeRange.end)}
                  {#if employee.attendance_from_time && employee.attendance_to_time}
                    <span class="text-gray-600 dark:text-gray-400">(from attendance)</span>
                  {:else if shiftDetails.shift}
                    <span class="text-gray-600 dark:text-gray-400">(from shift)</span>
                  {/if}
                </p>
                {#if employee.stage_journey && employee.stage_journey.length > 0}
                  {@const lastAssignment = employee.stage_journey[employee.stage_journey.length - 1]}
                  {#if lastAssignment.to_stage === employee.current_stage}
                    <p class="text-gray-700 dark:text-gray-300 mt-1">
                      <em>Constrained by original assignment from {formatTime(lastAssignment.from_time)} to {formatTime(lastAssignment.to_time)}</em>
                    </p>
                  {/if}
                {/if}
              </div>
            {/if}

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
              <div>
                <label for="fromTime" class="theme-text-secondary text-sm block mb-2">From Time:</label>
                <input
                  type="time"
                  id="fromTime"
                  bind:value={fromTime}
                  class="theme-bg-primary theme-border theme-text-primary rounded"
                  style="width: 100%; padding: 8px; font-size: 14px; {fromTimeError ? 'border-color: #ef4444;' : ''}"
                />
                {#if fromTimeError}
                  <p class="text-red-500 text-xs mt-1">{fromTimeError}</p>
                {/if}
              </div>
              <div>
                <label for="toTime" class="theme-text-secondary text-sm block mb-2">To Time:</label>
                <input
                  type="time"
                  id="toTime"
                  bind:value={toTime}
                  class="theme-bg-primary theme-border theme-text-primary rounded"
                  style="width: 100%; padding: 8px; font-size: 14px; {toTimeError ? 'border-color: #ef4444;' : ''}"
                />
                {#if toTimeError}
                  <p class="text-red-500 text-xs mt-1">{toTimeError}</p>
                {/if}
              </div>
            </div>
            {#if overlapError}
              <p class="text-amber-600 dark:text-amber-400 text-sm mt-2 font-medium">{overlapError}</p>
            {/if}
            
            {#if fromTime && toTime && !fromTimeError && !toTimeError && !overlapError && !workPlanConflictError}
              <div class="mt-3 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                <p class="theme-text-primary text-sm">
                  <strong>Reassignment Period:</strong> {formatTime(fromTime)} - {formatTime(toTime)}
                </p>
                <p class="theme-text-secondary text-sm mt-1">
                  Worker will be at {selectedStage} during this time, then return to {employee.current_stage}
                </p>
              </div>
            {/if}
          </fieldset>

          <!-- Reason -->
          <div>
            <label for="reason" class="theme-text-primary" style="display: block; margin-bottom: 10px; font-weight: 500;">Reason (Optional):</label>
            <textarea
              id="reason"
              bind:value={reason}
              rows="3"
              class="theme-bg-primary theme-border theme-text-primary rounded"
              style="width: 100%; padding: 8px; font-size: 14px;"
              placeholder="Add reason for reassignment..."
            ></textarea>
          </div>
        </div>

        <!-- Actions -->
        <div class="flex justify-end gap-3">
          <Button 
            variant="secondary" 
            size="md"
            on:click={handleClose}
          >
            Cancel
          </Button>
          <Button 
            variant="primary" 
            size="md"
            on:click={handleSubmit}
            disabled={isSubmitting || destinationCheckInFlight || !!destinationLockError || !selectedStage || !fromTime || !toTime || selectedStage === (employee.original_stage || employee.current_stage) || !!fromTimeError || !!toTimeError || !!overlapError || !!workPlanConflictError}
          >
            {isSubmitting ? 'Reassigning...' : 'Reassign Employee'}
          </Button>
        </div>
      {:else}
        <div class="text-center" style="padding: 20px;">
          <p class="text-red-500 dark:text-red-400">No employee selected. Please try again.</p>
        </div>
        <div class="flex justify-center">
          <Button 
            variant="secondary" 
            size="md"
            on:click={handleClose}
          >
            Close
          </Button>
        </div>
      {/if}
    </div>
  </div>
{/if}

<style>
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
</style>
