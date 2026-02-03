<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import Button from '$lib/components/common/Button.svelte';
  import type { ProductionEmployee } from '$lib/api/production';
  import { supabase } from '$lib/supabaseClient';
  import { calculateBreakTimeInMinutes } from '$lib/utils/breakTimeUtils';

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
        fromTime = shiftStartTime;
      }
      if (!isEditingTime && !toTime) {
        console.log('🔍 [AttendanceModal] toTime empty, setting to shiftEndTime:', shiftEndTime);
        toTime = shiftEndTime;
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
      // Load saved values if they exist
      notes = employee.attendance_notes || '';
      fromTime = employee.attendance_from_time || '';
      toTime = employee.attendance_to_time || '';
      
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
      if (isPlanningMode) {
        eventData.plannedHours = plannedHours;
      } else {
        eventData.actualHours = actualHours;
      }
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
  <!-- Simple Modal Overlay -->
  <div style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0, 0, 0, 0.5); z-index: 1000; display: flex; align-items: center; justify-content: center;">
    
    <!-- Modal Content -->
    <div class="theme-bg-primary theme-border rounded-lg shadow-lg" style="padding: 20px; min-width: 400px; max-width: 500px;">
      
      <!-- Header -->
      <div style="display: flex; align-items: center; margin-bottom: 20px;">
        <div class="bg-blue-500 rounded-full" style="width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; margin-right: 15px;">
          <span style="color: white; font-size: 20px;">👤</span>
        </div>
        <div>
          <h3 class="theme-text-primary" style="margin: 0; font-size: 18px; font-weight: 600;">Mark Attendance</h3>
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
            <strong>Stage:</strong> {employee.current_stage}
          </p>
        </div>

        <!-- Form -->
        <div style="margin-bottom: 20px;">
          <!-- Attendance Status -->
          <div style="margin-bottom: 20px;">
            <fieldset>
              <legend class="theme-text-primary" style="margin-bottom: 10px; font-weight: 500;">Attendance Status:</legend>
              <div>
                <label style="display: flex; align-items: center; margin-bottom: 8px;">
                  <input 
                    type="radio" 
                    bind:group={attendanceStatus} 
                    value="present"
                    style="margin-right: 8px;"
                  />
                  <span class="theme-text-primary">Present</span>
                </label>
                <label style="display: flex; align-items: center;">
                  <input 
                    type="radio" 
                    bind:group={attendanceStatus} 
                    value="absent"
                    style="margin-right: 8px;"
                  />
                  <span class="theme-text-primary">Absent</span>
                </label>
              </div>
            </fieldset>
          </div>

          <!-- Time and Hours Fields (only for Present) -->
          {#if attendanceStatus === 'present'}
            {#if isLoadingShiftInfo}
              <div class="text-center" style="padding: 10px;">
                <p class="theme-text-secondary text-sm">Loading shift information...</p>
              </div>
            {:else}
              <div style="margin-bottom: 20px;">
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 15px;">
                  <!-- From Time -->
                  <div>
                    <label for="from-time" class="theme-text-primary" style="display: block; margin-bottom: 5px; font-weight: 500; font-size: 14px;">From Time:</label>
                    <input
                      id="from-time"
                      type="time"
                      bind:value={fromTime}
                      on:input={handleTimeChange}
                      on:focus={handleTimeFocus}
                      on:blur={handleTimeBlur}
                      class="theme-bg-primary theme-border theme-text-primary rounded"
                      style="width: 100%; padding: 8px; font-size: 14px;"
                    />
                  </div>
                  <!-- To Time -->
                  <div>
                    <label for="to-time" class="theme-text-primary" style="display: block; margin-bottom: 5px; font-weight: 500; font-size: 14px;">To Time:</label>
                    <input
                      id="to-time"
                      type="time"
                      bind:value={toTime}
                      on:input={handleTimeChange}
                      on:focus={handleTimeFocus}
                      on:blur={handleTimeBlur}
                      class="theme-bg-primary theme-border theme-text-primary rounded"
                      style="width: 100%; padding: 8px; font-size: 14px;"
                    />
                  </div>
                </div>
                <!-- Hours Display (Planned for planning, Actual for reporting) -->
                <div style="margin-bottom: 15px;">
                  <label class="theme-text-primary" style="display: block; margin-bottom: 5px; font-weight: 500; font-size: 14px;">
                    {isPlanningMode ? 'Planned Hours:' : 'Actual Hours:'}
                  </label>
                  <div class="theme-bg-secondary theme-border rounded" style="padding: 10px;">
                    <span class="theme-text-primary font-medium">
                      {currentHours !== null ? `${currentHours.toFixed(2)}h` : 'Calculating...'}
                    </span>
                    <span class="theme-text-secondary text-sm" style="margin-left: 10px;">
                      (Full shift: {fullShiftHours.toFixed(2)}h)
                      {#if !isPlanningMode && employee?.planned_hours}
                        <span style="margin-left: 5px;">| Planned: {employee.planned_hours.toFixed(2)}h</span>
                      {/if}
                    </span>
                  </div>
                </div>
              </div>
            {/if}
          {/if}

          <!-- Notes -->
          <div>
            <label for="notes" class="theme-text-primary" style="display: block; margin-bottom: 10px; font-weight: 500;">
              {notesLabel}
            </label>
            <textarea
              id="notes"
              bind:value={notes}
              rows="3"
              class="theme-bg-primary theme-border theme-text-primary rounded"
              style="width: 100%; padding: 8px; font-size: 14px;"
              placeholder={isNotesRequired ? "Enter reason for partial attendance..." : "Add any notes about attendance..."}
              required={isNotesRequired}
            ></textarea>
            {#if isNotesRequired && !notes.trim()}
              <p class="text-red-500 dark:text-red-400 text-sm" style="margin-top: 5px;">
                Reason is required for partial attendance
              </p>
            {/if}
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
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Saving...' : 'Save Attendance'}
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
