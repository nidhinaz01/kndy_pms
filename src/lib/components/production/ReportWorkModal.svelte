<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import Button from '$lib/components/common/Button.svelte';
  import { X } from 'lucide-svelte';
  import { supabase } from '$lib/supabaseClient';
  import { loadWorkers, loadStandardTime, loadLostTimeReasons, loadEmployeeSalary, checkWorkerConflict } from '$lib/services/reportWorkService';
  import { saveWorkReport, updatePlanningStatus, updateProductionDatesIfFirstReport, updateWorkStatus } from '$lib/services/reportWorkSaveService';
  import { calculateActualTime, calculateHoursWorkedToday, calculateLostTime, calculateChunkCost } from '$lib/utils/reportWorkUtils';
  import { validateSave } from '$lib/utils/reportWorkValidation';
  import type { ReportWorkFormData, ReportWorkState, LostTimeChunk } from '$lib/types/reportWork';
  import { initialReportWorkFormData, initialReportWorkState } from '$lib/types/reportWork';
  import type { LostTimeReason } from '$lib/api/lostTimeReasons';
  import WorkDetailsDisplay from './report-work/WorkDetailsDisplay.svelte';
  import WorkerTimeSelection from './report-work/WorkerTimeSelection.svelte';
  import LostTimeSplitting from './report-work/LostTimeSplitting.svelte';
  import ReasonAssignment from './report-work/ReasonAssignment.svelte';

  export let isOpen: boolean = false;
  export let plannedWork: any = null;

  const dispatch = createEventDispatcher();

  // Form data and state
  let formData: ReportWorkFormData = { ...initialReportWorkFormData };
  let state: ReportWorkState = { ...initialReportWorkState };

  // Modal state
  let isLoading = false;
  let availableWorkers: any[] = [];
  let lostTimeReasons: LostTimeReason[] = [];

  // Watch for plannedWork changes
  $: if (plannedWork && isOpen) {
    console.log('ReportWorkModal: Planned work changed:', plannedWork);
    initializeForm();
    loadAllData();
  }

  // Watch for date changes to reload workers
  $: if (plannedWork && formData.fromDate) {
    loadWorkersData();
  }

  // Watch for worker selection to load salary
  $: if (formData.selectedWorkerId) {
    loadEmployeeSalaryData();
  }

  // Check if this is a non-standard work (code starts with OW or has other_work_code)
  $: isNonStandardWork = plannedWork?.other_work_code ? true : 
    (plannedWork?.std_work_type_details?.derived_sw_code?.startsWith('OW') || 
     plannedWork?.std_work_type_details?.sw_code?.startsWith('OW') || false);

  // Watch for time changes to calculate lost time (only for standard works)
  $: {
    if (formData.fromDate && formData.fromTime && formData.toDate && formData.toTime) {
      state.actualTimeMinutes = calculateActualTime(
        formData.fromDate,
        formData.fromTime,
        formData.toDate,
        formData.toTime
      );
      formData.hoursWorkedToday = calculateHoursWorkedToday(state.actualTimeMinutes);
      
      // Only calculate lost time for standard works (not non-standard works starting with OW)
      if (!isNonStandardWork && state.standardTimeMinutes > 0) {
        formData.ltMinutes = calculateLostTime(
          state.standardTimeMinutes,
          state.actualTimeMinutes,
          formData.completionStatus
        );
        state.showLostTimeSection = formData.ltMinutes > 0;
      } else {
        // For non-standard works, set lost time to 0 and don't show lost time section
        formData.ltMinutes = 0;
        state.showLostTimeSection = false;
      }
    }
  }

  async function loadAllData() {
    if (!plannedWork) return;
    
    isLoading = true;
    try {
      await Promise.all([
        loadStandardTimeData(),
        loadLostTimeReasonsData()
      ]);
    } finally {
      isLoading = false;
    }
  }

  async function loadWorkersData() {
    if (!plannedWork?.stage_code || !formData.fromDate) return;
    availableWorkers = await loadWorkers(plannedWork.stage_code, formData.fromDate);
  }

  async function loadStandardTimeData() {
    state.standardTimeMinutes = await loadStandardTime(plannedWork);
  }

  async function loadLostTimeReasonsData() {
    lostTimeReasons = await loadLostTimeReasons();
  }

  async function loadEmployeeSalaryData() {
    state.selectedEmployeeSalary = await loadEmployeeSalary(formData.selectedWorkerId);
  }

  function initializeForm() {
    if (!plannedWork) return;
    
    formData = {
      ...initialReportWorkFormData,
      selectedWorkerId: plannedWork.worker_id || '',
      fromDate: plannedWork.from_date || '',
      fromTime: plannedWork.from_time || '',
      toDate: plannedWork.to_date || '',
      toTime: plannedWork.to_time || '',
      hoursWorkedTillDate: plannedWork.time_worked_till_date || 0
    };
    
    state = { ...initialReportWorkState };
  }

  function proceedToStage2() {
    const validation = validateSave(formData, isNonStandardWork);
    if (!validation.isValid) {
      alert(Object.values(validation.errors)[0]);
      return;
    }

    // For non-standard works, skip lost time section and go directly to save
    if (isNonStandardWork) {
      handleSave();
      return;
    }

    if (state.showLostTimeSection && formData.ltMinutes > 0) {
      formData.totalLostTimeMinutes = formData.ltMinutes;
      formData.lostTimeChunks = [];
      state.currentStage = 2;
    } else {
      handleSave();
    }
  }

  function goBackToStage1() {
    state.currentStage = 1;
  }

  function proceedToStage3() {
    if (calculateRemainingMinutes() > 0) {
      alert('Please allocate all lost time minutes before proceeding');
      return;
    }
    
    if (formData.lostTimeChunks.length === 0) {
      alert('Please add at least one lost time chunk');
      return;
    }
    
    formData.currentChunkIndex = 0;
    state.currentStage = 3;
  }

  function goBackToStage2() {
    state.currentStage = 2;
  }

  function proceedToNextChunk() {
    if (formData.currentChunkIndex < formData.lostTimeChunks.length - 1) {
      formData.currentChunkIndex++;
    } else {
      handleSave();
    }
  }

  function goBackToPreviousChunk() {
    if (formData.currentChunkIndex > 0) {
      formData.currentChunkIndex--;
    } else {
      state.currentStage = 2;
    }
  }

  function calculateRemainingMinutes(): number {
    const allocatedMinutes = formData.lostTimeChunks.reduce((sum, chunk) => sum + chunk.minutes, 0);
    return formData.totalLostTimeMinutes - allocatedMinutes;
  }

  function addLostTimeChunk() {
    if (calculateRemainingMinutes() <= 0) {
      alert('No remaining minutes to allocate');
      return;
    }
    
    const newChunk: LostTimeChunk = {
      id: `chunk_${Date.now()}`,
      minutes: 0,
      reasonId: 0,
      reasonName: '',
      isPayable: false,
      cost: 0
    };
    
    formData.lostTimeChunks = [...formData.lostTimeChunks, newChunk];
  }

  function removeLostTimeChunk(chunkId: string) {
    formData.lostTimeChunks = formData.lostTimeChunks.filter(c => c.id !== chunkId);
  }

  function updateChunkMinutes(chunkId: string, minutes: number) {
    const chunkIndex = formData.lostTimeChunks.findIndex(c => c.id === chunkId);
    if (chunkIndex !== -1) {
      formData.lostTimeChunks[chunkIndex] = {
        ...formData.lostTimeChunks[chunkIndex],
        minutes: minutes
      };
      
      if (formData.lostTimeChunks[chunkIndex].reasonId > 0) {
        calculateChunkCostForIndex(chunkIndex);
      }
      
      formData.lostTimeChunks = [...formData.lostTimeChunks];
    }
  }

  function calculateChunkCostForIndex(chunkIndex: number) {
    const chunk = formData.lostTimeChunks[chunkIndex];
    const cost = calculateChunkCost(chunk.minutes, chunk.isPayable, state.selectedEmployeeSalary);
    
    formData.lostTimeChunks[chunkIndex] = {
      ...chunk,
      cost: cost
    };
    
    formData.lostTimeChunks = [...formData.lostTimeChunks];
  }

  function assignReasonToChunk(reasonId: number) {
    if (formData.currentChunkIndex < 0 || formData.currentChunkIndex >= formData.lostTimeChunks.length) {
      return;
    }

    const isAlreadyUsed = formData.lostTimeChunks.some((chunk, index) => 
      chunk.reasonId === reasonId && index !== formData.currentChunkIndex
    );
    
    if (isAlreadyUsed) {
      const reason = lostTimeReasons.find(r => r.id === reasonId);
      alert(`Duplicate reason detected!\n\n"${reason?.lost_time_reason}" is already used in another chunk.\n\nPlease select a different reason.`);
      return;
    }
    
    const reason = lostTimeReasons.find(r => r.id === reasonId);
    if (reason) {
      formData.lostTimeChunks[formData.currentChunkIndex] = {
        ...formData.lostTimeChunks[formData.currentChunkIndex],
        reasonId: reasonId,
        reasonName: reason.lost_time_reason,
        isPayable: reason.p_head === 'Payable'
      };
      
      calculateChunkCostForIndex(formData.currentChunkIndex);
      formData.lostTimeChunks = [...formData.lostTimeChunks];
    }
  }

  async function handleSave() {
    console.log('🔍 ReportWorkModal.handleSave: Starting save process');
    console.log('🔍 Form data:', {
      selectedWorkerId: formData.selectedWorkerId,
      fromDate: formData.fromDate,
      fromTime: formData.fromTime,
      toDate: formData.toDate,
      toTime: formData.toTime,
      isNonStandardWork
    });
    
    const validation = validateSave(formData, isNonStandardWork);
    if (!validation.isValid) {
      alert(Object.values(validation.errors)[0]);
      return;
    }

    console.log('🔍 ReportWorkModal.handleSave: Calling checkWorkerConflict...');
    const conflictResult = await checkWorkerConflict(
      formData.selectedWorkerId,
      formData.fromDate,
      formData.fromTime,
      formData.toDate,
      formData.toTime,
      plannedWork?.reporting_id // Exclude current report if editing
    );
    
    console.log('🔍 ReportWorkModal.handleSave: Conflict result:', conflictResult);
    
    if (conflictResult.hasConflict) {
      // If there's a report conflict, BLOCK (cannot proceed)
      if (conflictResult.hasReportConflict) {
        console.log('❌ ReportWorkModal.handleSave: BLOCKING due to report conflict');
        alert(conflictResult.message);
        return;
      }
      // If there's only a plan conflict, WARN (can proceed with confirmation)
      console.log('⚠️ ReportWorkModal.handleSave: Warning due to plan conflict');
      const proceed = confirm(conflictResult.message);
      if (!proceed) return;
    } else {
      console.log('✅ ReportWorkModal.handleSave: No conflicts detected, proceeding with save');
    }

    try {
      isLoading = true;
      
      const result = await saveWorkReport(plannedWork, formData);
      if (!result.success) {
        alert('Error creating work report: ' + (result.error || 'Unknown error'));
        return;
      }

      await updateProductionDatesIfFirstReport(result.data);

      const updateResult = await updatePlanningStatus(plannedWork.id, formData, plannedWork.planned_hours);
      if (!updateResult.success) {
        alert('Work report created but failed to update planning status');
        return;
      }

      await updateWorkStatus(plannedWork.id, formData);

      dispatch('save', {
        success: true,
        reportId: result.data.id,
        message: 'Work report created successfully'
      });
      
      handleClose();
    } catch (error) {
      console.error('Error creating work report:', error);
      alert('Error creating work report: ' + ((error as Error)?.message || 'Unknown error'));
    } finally {
      isLoading = false;
    }
  }

  function handleClose() {
    dispatch('close');
    resetForm();
  }

  function resetForm() {
    formData = { ...initialReportWorkFormData };
    state = { ...initialReportWorkState };
  }

  function handleWorkerChange(value: string) {
    formData.selectedWorkerId = value;
  }

  function handleDateChange(field: string, value: string) {
    if (field === 'fromDate') formData.fromDate = value;
    if (field === 'toDate') formData.toDate = value;
  }

  function handleTimeChange(field: string, value: string) {
    if (field === 'fromTime') formData.fromTime = value;
    if (field === 'toTime') formData.toTime = value;
  }

  function handleStatusChange(value: 'C' | 'NC') {
    formData.completionStatus = value;
  }

  $: currentChunk = formData.lostTimeChunks[formData.currentChunkIndex] || null;
</script>

{#if isOpen}
  <button 
    class="fixed inset-0 bg-black bg-opacity-50 dark:bg-opacity-70 z-[9999] w-full h-full border-none p-0"
    on:click={handleClose}
    aria-label="Close modal"
  ></button>
  
  <div class="fixed inset-0 z-[10000] flex items-center justify-center p-4">
    <div class="theme-bg-primary rounded-lg shadow-2xl dark:shadow-black/50 border-2 border-gray-300 dark:border-gray-600 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
      <div class="px-6 py-4 border-b theme-border">
        <div class="flex items-center justify-between">
          <div>
            <h3 class="text-lg font-medium theme-text-primary">Report Work</h3>
            <div class="flex items-center space-x-4 mt-2">
              <div class="flex items-center space-x-2">
                <div class="w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium {state.currentStage >= 1 ? 'bg-blue-500 text-white' : 'bg-gray-300 dark:bg-gray-600 text-gray-600 dark:text-gray-300'}">1</div>
                <span class="text-sm theme-text-secondary">Worker & Time</span>
              </div>
              {#if !isNonStandardWork}
                <div class="w-8 h-px bg-gray-300 dark:bg-gray-600"></div>
                <div class="flex items-center space-x-2">
                  <div class="w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium {state.currentStage >= 2 ? 'bg-blue-500 text-white' : 'bg-gray-300 dark:bg-gray-600 text-gray-600 dark:text-gray-300'}">2</div>
                  <span class="text-sm theme-text-secondary">Split Lost Time</span>
                </div>
                <div class="w-8 h-px bg-gray-300 dark:bg-gray-600"></div>
                <div class="flex items-center space-x-2">
                  <div class="w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium {state.currentStage >= 3 ? 'bg-blue-500 text-white' : 'bg-gray-300 dark:bg-gray-600 text-gray-600 dark:text-gray-300'}">3+</div>
                  <span class="text-sm theme-text-secondary">Assign Reasons</span>
                </div>
              {/if}
            </div>
          </div>
          <button
            type="button"
            class="theme-text-secondary hover:theme-text-primary transition-colors"
            on:click={handleClose}
          >
            <X class="w-6 h-6" />
          </button>
        </div>
      </div>

      <div class="px-6 py-4 space-y-6">
        {#if isLoading}
          <div class="text-center py-8">
            <p class="theme-text-secondary">Loading...</p>
          </div>
        {:else if plannedWork}
          <WorkDetailsDisplay 
            {plannedWork} 
            standardTimeMinutes={state.standardTimeMinutes}
            hoursWorkedTillDate={formData.hoursWorkedTillDate}
          />

          {#if state.currentStage === 1}
            <WorkerTimeSelection
              {formData}
              {availableWorkers}
              actualTimeMinutes={state.actualTimeMinutes}
              hoursWorkedToday={formData.hoursWorkedToday}
              onWorkerChange={handleWorkerChange}
              onDateChange={handleDateChange}
              onTimeChange={handleTimeChange}
              onStatusChange={handleStatusChange}
            />
          {/if}

          {#if state.currentStage === 2}
            <LostTimeSplitting
              {formData}
              standardTimeMinutes={state.standardTimeMinutes}
              actualTimeMinutes={state.actualTimeMinutes}
              onAddChunk={addLostTimeChunk}
              onRemoveChunk={removeLostTimeChunk}
              onUpdateChunkMinutes={updateChunkMinutes}
            />
          {/if}

          {#if state.currentStage >= 3}
            <ReasonAssignment
              {formData}
              {lostTimeReasons}
              {currentChunk}
              onAssignReason={assignReasonToChunk}
            />
          {/if}
        {/if}
      </div>

      <div class="px-6 py-4 border-t theme-border flex justify-between">
        <div>
          {#if state.currentStage === 2}
            <Button variant="secondary" on:click={goBackToStage1}>
              ← Back to Stage 1
            </Button>
          {:else if state.currentStage >= 3}
            <Button variant="secondary" on:click={goBackToPreviousChunk}>
              ← Previous
            </Button>
          {/if}
        </div>
        <div class="flex space-x-3">
          <Button variant="secondary" on:click={handleClose}>
            Cancel
          </Button>
          {#if state.currentStage === 1}
            <Button variant="primary" on:click={proceedToStage2}>
              {isNonStandardWork ? 'Save' : 'Next →'}
            </Button>
          {:else if state.currentStage === 2}
            <Button variant="primary" on:click={proceedToStage3}>
              Next →
            </Button>
          {:else if state.currentStage >= 3}
            <Button variant="primary" on:click={proceedToNextChunk}>
              {formData.currentChunkIndex < formData.lostTimeChunks.length - 1 ? 'Next Chunk →' : 'Save'}
            </Button>
          {/if}
        </div>
      </div>
    </div>
  </div>
{/if}


