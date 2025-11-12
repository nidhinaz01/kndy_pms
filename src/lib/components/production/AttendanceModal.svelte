<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import Button from '$lib/components/common/Button.svelte';
  import type { ProductionEmployee } from '$lib/api/production';

  export let showModal: boolean = false;
  export let employee: ProductionEmployee | null = null;
  export let selectedDate: string = '';

  const dispatch = createEventDispatcher();

  // Form state
  let attendanceStatus: 'present' | 'absent' = 'present';
  let notes: string = '';
  let isSubmitting = false;

  // Reset form when modal opens
  $: if (showModal && employee) {
    attendanceStatus = employee.attendance_status || 'present';
    notes = '';
  }

  function handleSubmit() {
    if (!employee) {
      console.error('No employee selected for attendance marking');
      return;
    }

    isSubmitting = true;
    
    // Dispatch event to parent component
    dispatch('attendanceMarked', {
      empId: employee.emp_id,
      stageCode: employee.current_stage,
      date: selectedDate,
      status: attendanceStatus,
      notes: notes.trim() || undefined
    });

    // Reset form
    attendanceStatus = 'present';
    notes = '';
    isSubmitting = false;
  }

  function handleClose() {
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

          <!-- Notes -->
          <div>
            <label for="notes" class="theme-text-primary" style="display: block; margin-bottom: 10px; font-weight: 500;">Notes (Optional):</label>
            <textarea
              id="notes"
              bind:value={notes}
              rows="3"
              class="theme-bg-primary theme-border theme-text-primary rounded"
              style="width: 100%; padding: 8px; font-size: 14px;"
              placeholder="Add any notes about attendance..."
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
