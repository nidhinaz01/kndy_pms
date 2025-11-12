<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { ProductionEmployee } from '$lib/api/production';

  export let showModal: boolean = false;
  export let employee: ProductionEmployee | null = null;
  export let selectedDate: string = '';

  const dispatch = createEventDispatcher();

  function handleClose() {
    dispatch('close');
  }

  function formatTime(dateString: string): string {
    return new Date(dateString).toLocaleTimeString('en-GB', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  }
</script>

{#if showModal}
  <!-- Simple Modal Overlay -->
  <div style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0, 0, 0, 0.5); z-index: 1000; display: flex; align-items: center; justify-content: center;">
    
    <!-- Modal Content -->
    <div class="theme-bg-primary theme-border rounded-lg shadow-lg" style="padding: 20px; min-width: 500px; max-width: 700px;">
      
      <!-- Header -->
      <div style="display: flex; align-items: center; margin-bottom: 20px;">
        <div class="bg-purple-500 rounded-full" style="width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; margin-right: 15px;">
          <span style="color: white; font-size: 20px;">🔄</span>
        </div>
        <div>
          <h3 class="theme-text-primary" style="margin: 0; font-size: 18px; font-weight: 600;">Stage Journey</h3>
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
        </div>

        <!-- Stage Journey -->
        <div style="margin-bottom: 20px;">
          <h4 class="theme-text-primary" style="margin: 0 0 15px 0; font-size: 16px; font-weight: 500;">Stage Transfers:</h4>
          
          {#if employee.stage_journey && employee.stage_journey.length > 0}
            <div style="max-height: 300px; overflow-y: auto;">
              {#each employee.stage_journey as journey, index}
                <div class="theme-bg-secondary theme-border rounded-lg" style="padding: 15px; margin-bottom: 10px;">
                  <div style="display: flex; align-items: center; margin-bottom: 8px;">
                    <div class="bg-blue-500 rounded-full" style="width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; margin-right: 10px;">
                      <span style="color: white; font-size: 12px; font-weight: bold;">{index + 1}</span>
                    </div>
                                         <div style="flex: 1;">
                       <div style="display: flex; align-items: center; margin-bottom: 5px;">
                         <span class="theme-text-primary font-medium">{journey.from_stage}</span>
                         <span class="theme-text-secondary mx-2">→</span>
                         <span class="theme-text-primary font-medium">{journey.to_stage}</span>
                       </div>
                       <div style="display: flex; justify-content: space-between; align-items: center;">
                         <span class="theme-text-secondary text-sm">
                           {formatTime(journey.reassigned_at)}
                         </span>
                         <span class="theme-text-secondary text-sm">
                           by {journey.reassigned_by}
                         </span>
                       </div>
                       <div style="margin-top: 5px;">
                         <span class="theme-text-secondary text-sm">
                           <strong>Time Period:</strong> {journey.from_time} - {journey.to_time}
                         </span>
                       </div>
                       {#if journey.reason}
                         <p class="theme-text-secondary text-sm mt-2" style="font-style: italic;">
                           "{journey.reason}"
                         </p>
                       {/if}
                     </div>
                  </div>
                </div>
              {/each}
            </div>
          {:else}
            <div class="theme-bg-secondary theme-border rounded-lg" style="padding: 20px; text-align: center;">
              <p class="theme-text-secondary">No stage transfers recorded for this date.</p>
              <p class="theme-text-secondary text-sm mt-1">Employee is working at their assigned stage: {employee.current_stage}</p>
            </div>
          {/if}
        </div>

        <!-- Actions -->
        <div style="display: flex; justify-content: center;">
          <button 
            on:click={handleClose}
            class="theme-border theme-text-primary hover:theme-bg-secondary"
            style="padding: 8px 16px; background: transparent; border: 1px solid; border-radius: 4px; cursor: pointer; transition: background-color 0.2s;"
          >
            Close
          </button>
        </div>
      {:else}
        <div class="text-center" style="padding: 20px;">
          <p class="text-red-500 dark:text-red-400">No employee selected. Please try again.</p>
        </div>
        <div style="display: flex; justify-content: center;">
          <button 
            on:click={handleClose}
            class="theme-border theme-text-primary hover:theme-bg-secondary"
            style="padding: 8px 16px; background: transparent; border: 1px solid; border-radius: 4px; cursor: pointer; transition: background-color 0.2s;"
          >
            Close
          </button>
        </div>
      {/if}
    </div>
  </div>
{/if}
