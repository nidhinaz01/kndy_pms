<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import Button from '$lib/components/common/Button.svelte';
  import { X } from 'lucide-svelte';
  import { supabase } from '$lib/supabaseClient';
  import { getCurrentUsername, getCurrentTimestamp } from '$lib/utils/userUtils';
  import { createWorkPlanning } from '$lib/api/production';
  import type { SelectedWorker } from '$lib/types/planWork';

  export let isOpen: boolean = false;
  export let plannedWorkGroup: any = null;
  export let stageCode: string = '';
  export let selectedDate: string = '';

  const dispatch = createEventDispatcher();

  // State
  let availableTrainees: any[] = [];
  let selectedTrainees: SelectedWorker[] = [];
  let traineeDeviationReason: string = '';
  let isLoading = false;
  let showTraineeSelector = false;
  let existingTraineesCount = 0;

  // Calculate how many trainees can be added
  $: canAddTrainee = selectedTrainees.length < (2 - existingTraineesCount);

  // Load trainees when modal opens
  $: if (isOpen && plannedWorkGroup) {
    loadTrainees();
    // Count existing trainees
    existingTraineesCount = (plannedWorkGroup.items || []).filter((item: any) => item.sc_required === 'T').length;
    // Reset form
    selectedTrainees = [];
    traineeDeviationReason = '';
    showTraineeSelector = false;
  }

  async function loadTrainees() {
    if (!stageCode) return;
    
    try {
      const { data, error } = await supabase
        .from('hr_emp')
        .select('emp_id, emp_name, skill_short')
        .eq('skill_short', 'T')
        .eq('is_active', true)
        .eq('is_deleted', false)
        .order('emp_name');

      if (error) throw error;
      availableTrainees = data || [];
    } catch (error) {
      console.error('Error loading trainees:', error);
      alert('Error loading trainees');
    }
  }

  function handleTraineeAdd(traineeId: string) {
    const trainee = availableTrainees.find(t => t.emp_id === traineeId);
    if (trainee) {
      const isAlreadySelected = selectedTrainees.some(t => t.emp_id === traineeId);
      if (!isAlreadySelected && selectedTrainees.length < (2 - existingTraineesCount)) {
        selectedTrainees = [...selectedTrainees, {
          emp_id: trainee.emp_id,
          emp_name: trainee.emp_name,
          skill_short: trainee.skill_short
        }];
        showTraineeSelector = false;
      } else if (isAlreadySelected) {
        alert('This trainee is already selected');
      }
    }
  }

  function handleTraineeRemove(index: number) {
    selectedTrainees = selectedTrainees.filter((_, i) => i !== index);
    if (selectedTrainees.length === 0) {
      traineeDeviationReason = '';
    }
  }

  async function handleSave() {
    if (selectedTrainees.length === 0) {
      alert('Please select at least one trainee');
      return;
    }

    if (!traineeDeviationReason || !traineeDeviationReason.trim()) {
      alert('Please provide a reason for adding trainees');
      return;
    }

    if (!plannedWorkGroup || !plannedWorkGroup.items || plannedWorkGroup.items.length === 0) {
      alert('No planned work found');
      return;
    }

    // Get the first planned work to extract common data
    const firstPlannedWork = plannedWorkGroup.items[0];
    const woDetailsId = firstPlannedWork.wo_details_id;
    const derivedSwCode = firstPlannedWork.derived_sw_code;
    const otherWorkCode = firstPlannedWork.other_work_code;
    const fromDate = firstPlannedWork.from_date;
    const fromTime = firstPlannedWork.from_time;
    const toDate = firstPlannedWork.to_date;
    const toTime = firstPlannedWork.to_time;
    const plannedHours = firstPlannedWork.planned_hours || 0;
    const timeWorkedTillDate = firstPlannedWork.time_worked_till_date || 0;
    const remainingTime = firstPlannedWork.remaining_time || 0;
    const existingStatus = firstPlannedWork.status || 'approved'; // Use same status as existing planned work

    if (!fromDate || !fromTime || !toTime) {
      alert('Invalid planned work data');
      return;
    }

    isLoading = true;
    const currentUser = getCurrentUsername();
    const now = getCurrentTimestamp();

    try {
      // Create planning records for each trainee
      const traineePlanPromises = selectedTrainees.map(trainee => {
        const traineePlanData = {
          stage_code: stageCode,
          wo_details_id: woDetailsId,
          derived_sw_code: derivedSwCode,
          other_work_code: otherWorkCode,
          sc_required: 'T',
          worker_id: trainee.emp_id,
          from_date: fromDate,
          from_time: fromTime,
          to_date: toDate || fromDate,
          to_time: toTime,
          planned_hours: plannedHours,
          time_worked_till_date: timeWorkedTillDate,
          remaining_time: remainingTime,
          status: existingStatus as 'draft' | 'approved' | 'pending_approval' | 'rejected', // Same status as the existing planned work
          notes: `Trainee: ${trainee.emp_name}`,
          wsm_id: null
        };

        return createWorkPlanning(traineePlanData, currentUser);
      });

      const traineePlanResults = await Promise.all(traineePlanPromises);

      // Check for errors
      const errors = traineePlanResults.filter((result: any) => result.error || !result);
      if (errors.length > 0) {
        throw new Error(`Failed to create ${errors.length} trainee plan(s)`);
      }

      // Get trainee plan IDs
      const traineePlanIds = traineePlanResults
        .filter((result: any) => result && result.id)
        .map((result: any) => result.id);

      // Create deviation records for each trainee
      for (let i = 0; i < traineePlanIds.length; i++) {
        const traineePlanId = traineePlanIds[i];
        const trainee = selectedTrainees[i];

        const deviationData = {
          planning_id: traineePlanId,
          deviation_type: 'trainee_addition',
          reason: traineeDeviationReason,
          is_active: true,
          is_deleted: false,
          created_by: currentUser,
          created_dt: now
        };

        const { error: deviationError } = await supabase
          .from('prdn_work_planning_deviations')
          .insert(deviationData);

        if (deviationError) {
          throw new Error(`Failed to create deviation record: ${deviationError.message}`);
        }
      }

      dispatch('save', { success: true, message: `Successfully added ${selectedTrainees.length} trainee(s)` });
      handleClose();
    } catch (error) {
      console.error('Error adding trainees:', error);
      alert(`Error adding trainees: ${(error as Error).message}`);
    } finally {
      isLoading = false;
    }
  }

  function handleClose() {
    dispatch('close');
    selectedTrainees = [];
    traineeDeviationReason = '';
    showTraineeSelector = false;
  }
</script>

{#if isOpen && plannedWorkGroup}
  <!-- Modal backdrop -->
  <button 
    class="fixed inset-0 bg-black bg-opacity-50 z-[9999] w-full h-full border-none p-0"
    on:click={handleClose}
    aria-label="Close modal"
  ></button>
  
  <!-- Modal content -->
  <div class="fixed inset-0 z-[10000] flex items-center justify-center p-4">
    <div class="theme-bg-primary rounded-lg shadow-xl border-2 border-gray-300 dark:border-gray-600 max-w-lg w-full max-h-[90vh] overflow-y-auto">
      <!-- Header -->
      <div class="px-6 py-4 border-b theme-border">
        <div class="flex items-center justify-between">
          <h3 class="text-lg font-medium theme-text-primary">Add Trainees</h3>
          <button
            type="button"
            class="theme-text-secondary hover:theme-text-primary transition-colors"
            on:click={handleClose}
          >
            <X class="w-6 h-6" />
          </button>
        </div>
      </div>

      <!-- Content -->
      <div class="px-6 py-4 space-y-4">
        {#if isLoading}
          <div class="text-center py-8">
            <p class="theme-text-secondary">Adding trainees...</p>
          </div>
        {:else}
          <!-- Work Details -->
          <div class="theme-bg-secondary rounded-lg p-4">
            <h4 class="font-medium theme-text-primary mb-2">Work Details</h4>
            <div class="space-y-1 text-sm">
              <div>
                <span class="theme-text-secondary">Work Code:</span> 
                <span class="theme-text-primary">{plannedWorkGroup.workCode || 'N/A'}</span>
              </div>
              <div>
                <span class="theme-text-secondary">Work Name:</span> 
                <span class="theme-text-primary">{plannedWorkGroup.workName || 'N/A'}</span>
              </div>
              <div>
                <span class="theme-text-secondary">Existing Trainees:</span> 
                <span class="theme-text-primary">{existingTraineesCount}</span>
              </div>
            </div>
          </div>

          <!-- Trainee Selection -->
          <div class="space-y-3">
            <div class="flex items-center justify-between">
              <h4 class="font-medium theme-text-primary">Select Trainees</h4>
              {#if canAddTrainee}
                <button
                  type="button"
                  on:click={() => showTraineeSelector = !showTraineeSelector}
                  class="px-3 py-1.5 text-sm font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
                >
                  + Add Trainee
                </button>
              {:else}
                <span class="text-sm theme-text-secondary">Maximum 2 trainees</span>
              {/if}
            </div>
            
            {#if showTraineeSelector && canAddTrainee}
              <div class="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border theme-border">
                <label class="block text-sm font-medium theme-text-primary mb-2">
                  Select Trainee
                </label>
                <select
                  class="w-full px-3 py-2 border theme-border rounded-lg theme-bg-primary theme-text-primary focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  on:change={(e) => {
                    const traineeId = (e.target as HTMLSelectElement).value;
                    if (traineeId) {
                      handleTraineeAdd(traineeId);
                      (e.target as HTMLSelectElement).value = '';
                    }
                  }}
                >
                  <option value="">Choose a trainee...</option>
                  {#each availableTrainees as trainee}
                    {@const isAlreadySelected = selectedTrainees.some(t => t.emp_id === trainee.emp_id)}
                    <option value={trainee.emp_id} disabled={isAlreadySelected}>
                      {trainee.emp_name} {isAlreadySelected ? '(Already selected)' : ''}
                    </option>
                  {/each}
                </select>
                <button
                  type="button"
                  on:click={() => showTraineeSelector = false}
                  class="mt-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
                >
                  Cancel
                </button>
              </div>
            {/if}
            
            {#if selectedTrainees.length > 0}
              <!-- Warning Indicator -->
              <div class="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                <div class="flex items-start">
                  <svg class="w-5 h-5 text-yellow-600 dark:text-yellow-400 mt-0.5 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
                  </svg>
                  <div class="flex-1">
                    <p class="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                      Trainees Selected: This will be recorded as a deviation
                    </p>
                    <p class="text-xs text-yellow-700 dark:text-yellow-300 mt-1">
                      {selectedTrainees.length} trainee{selectedTrainees.length > 1 ? 's' : ''} selected
                    </p>
                  </div>
                </div>
              </div>
              
              <!-- Selected Trainees List -->
              <div class="space-y-2">
                {#each selectedTrainees as trainee, index}
                  <div class="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-800 rounded border theme-border">
                    <div class="flex items-center">
                      <span class="text-sm font-medium theme-text-primary mr-2">
                        {trainee.emp_name}
                      </span>
                      <span class="text-xs theme-text-secondary">({trainee.skill_short})</span>
                    </div>
                    <button
                      type="button"
                      on:click={() => handleTraineeRemove(index)}
                      class="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 text-sm font-medium"
                    >
                      Remove
                    </button>
                  </div>
                {/each}
              </div>
              
              <!-- Deviation Reason Input -->
              <div>
                <label class="block text-sm font-medium theme-text-primary mb-2">
                  Deviation Reason <span class="text-red-500">*</span>
                </label>
                <textarea
                  class="w-full px-3 py-2 border theme-border rounded-lg theme-bg-primary theme-text-primary focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  rows="3"
                  placeholder="Enter reason for adding trainees..."
                  bind:value={traineeDeviationReason}
                ></textarea>
                {#if selectedTrainees.length > 0 && !traineeDeviationReason.trim()}
                  <p class="mt-1 text-xs text-red-600 dark:text-red-400">
                    Please provide a reason for adding trainees
                  </p>
                {/if}
              </div>
            {/if}
          </div>
        {/if}
      </div>

      <!-- Footer -->
      <div class="px-6 py-4 border-t theme-border flex justify-end space-x-3">
        <Button variant="secondary" on:click={handleClose}>
          Cancel
        </Button>
        <Button 
          variant="primary" 
          on:click={handleSave}
          disabled={selectedTrainees.length === 0 || !traineeDeviationReason.trim() || isLoading}
        >
          Save
        </Button>
      </div>
    </div>
  </div>
{/if}
