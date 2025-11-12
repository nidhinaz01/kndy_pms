<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import Button from '$lib/components/common/Button.svelte';
  import { fetchAvailableStages, fetchShiftDetails } from '$lib/api/production';
  import type { ProductionEmployee } from '$lib/api/production';

  export let showModal: boolean = false;
  export let employee: ProductionEmployee | null = null;
  export let selectedDate: string = '';

  const dispatch = createEventDispatcher();

  // Form state
  let availableStages: string[] = [];
  let selectedStage: string = '';
  let fromTime: string = '';
  let toTime: string = '';
  let reason: string = '';
  let isSubmitting = false;
  let isLoadingStages = false;
  let isLoadingShift = false;

  // Validation state
  let fromTimeError: string = '';
  let toTimeError: string = '';

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

  // Watch for modal opening and load stages
  $: if (showModal && !availableStages.length) {
    loadStages();
  }

  // Watch for modal opening and load shift details
  $: if (showModal && employee && !shiftDetails.shift) {
    loadShiftDetails();
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
  }


  async function loadStages() {
    try {
      isLoadingStages = true;
      console.log('Loading available stages...');
      availableStages = await fetchAvailableStages();
      console.log('Available stages loaded:', availableStages);
    } catch (error) {
      console.error('Error loading stages:', error);
      availableStages = [];
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

  function validateTimes() {
    fromTimeError = '';
    toTimeError = '';

    if (!shiftDetails.shift) return;

    const shiftStart = shiftDetails.shift.start_time;
    const shiftEnd = shiftDetails.shift.end_time;

    if (fromTime) {
      if (fromTime < shiftStart) {
        fromTimeError = `Start time cannot be before shift start (${formatTime(shiftStart)})`;
      }
    }

    if (toTime) {
      if (toTime > shiftEnd) {
        toTimeError = `End time cannot be after shift end (${formatTime(shiftEnd)})`;
      }
    }

    if (fromTime && toTime) {
      if (fromTime >= toTime) {
        toTimeError = 'End time must be after start time';
      }

      // Check if this is a reassignment within existing time constraints
      if (employee?.stage_journey && employee.stage_journey.length > 0) {
        const lastAssignment = employee.stage_journey[employee.stage_journey.length - 1];
        if (lastAssignment.to_stage === employee.current_stage) {
          // Worker was reassigned to current stage, check time constraints
          if (fromTime < lastAssignment.from_time) {
            fromTimeError = `Start time cannot be before ${formatTime(lastAssignment.from_time)} (original assignment start)`;
          }
          if (toTime > lastAssignment.to_time) {
            toTimeError = `End time cannot be after ${formatTime(lastAssignment.to_time)} (original assignment end)`;
          }
        }
      }
    }
  }

  function handleSubmit() {
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
    if (fromTimeError || toTimeError) {
      console.error('Time validation failed');
      return;
    }

    isSubmitting = true;
    
    // Dispatch event to parent component
    dispatch('stageReassigned', {
      empId: employee.emp_id,
      fromStageCode: employee.current_stage,
      toStageCode: selectedStage,
      date: selectedDate,
      shiftCode: employee.shift_code,
      fromTime: fromTime,
      toTime: toTime,
      reason: reason.trim() || undefined
    });

    // Reset form
    selectedStage = employee.current_stage;
    fromTime = '';
    toTime = '';
    reason = '';
    fromTimeError = '';
    toTimeError = '';
    isSubmitting = false;
  }

  function handleClose() {
    dispatch('close');
  }

  function formatTime(timeStr: string): string {
    return timeStr.substring(0, 5); // Show only HH:MM
  }

  function getAvailableTimeRange() {
    if (!shiftDetails.shift) return { start: '', end: '' };

    let availableStart = shiftDetails.shift.start_time;
    let availableEnd = shiftDetails.shift.end_time;

    // If this is a reassignment, check the original assignment time constraints
    if (employee?.stage_journey && employee.stage_journey.length > 0) {
      const lastAssignment = employee.stage_journey[employee.stage_journey.length - 1];
      if (lastAssignment.to_stage === employee.current_stage) {
        // Worker was reassigned to current stage, use original assignment time constraints
        availableStart = lastAssignment.from_time;
        availableEnd = lastAssignment.to_time;
      }
    }

    return { start: availableStart, end: availableEnd };
  }
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

        <!-- Shift Information -->
        {#if shiftDetails.shift}
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
            {:else}
              <select
                id="targetStage"
                bind:value={selectedStage}
                style="width: 100%; padding: 8px; font-size: 14px; border: 1px solid #ccc; border-radius: 4px; background: white; color: black;"
              >
                <option value="">Select target stage...</option>
                {#each availableStages.filter(stage => stage !== employee.current_stage) as stage}
                  <option value={stage}>
                    {stage}
                  </option>
                {/each}
              </select>
            {/if}
          </div>

          <!-- Time Selection -->
          <fieldset style="margin-bottom: 20px;">
            <legend class="theme-text-primary" style="display: block; margin-bottom: 10px; font-weight: 500;">Reassignment Time Period:</legend>
            
            <!-- Available Time Range Info -->
            {#if shiftDetails.shift}
              {@const timeRange = getAvailableTimeRange()}
              <div class="mb-3 p-2 bg-blue-50 dark:bg-blue-900/20 rounded text-xs">
                <p class="theme-text-primary">
                  <strong>Available Time Range:</strong> {formatTime(timeRange.start)} - {formatTime(timeRange.end)}
                </p>
                {#if employee.stage_journey && employee.stage_journey.length > 0}
                  {@const lastAssignment = employee.stage_journey[employee.stage_journey.length - 1]}
                  {#if lastAssignment.to_stage === employee.current_stage}
                    <p class="theme-text-secondary mt-1">
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
            
            {#if fromTime && toTime && !fromTimeError && !toTimeError}
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
            disabled={isSubmitting || !selectedStage || !fromTime || !toTime || selectedStage === employee.current_stage || !!fromTimeError || !!toTimeError}
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
