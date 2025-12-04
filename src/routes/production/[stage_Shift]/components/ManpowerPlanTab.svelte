<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import ManpowerTable from '$lib/components/production/ManpowerTable.svelte';
  import type { ProductionEmployee } from '$lib/api/production';

  import { getManpowerLoadMetadata } from '../../services/stageProductionService';

  export let data: ProductionEmployee[] = [];
  export let isLoading: boolean = false;
  export let selectedDate: string = '';
  export let planningSubmissionStatus: any = null;
  export let stageCode: string = '';
  export let shiftCode: string = '';

  const dispatch = createEventDispatcher();
  
  // Warning state
  let warningMetadata: {
    reason: 'no_shift_schedule' | 'no_employees' | 'no_shift_match' | 'null_shift_codes' | 'success';
    availableShiftCodes?: string[];
    totalEmployees?: number;
    nullShiftCodeCount?: number;
  } | null = null;
  
  // Check if we should show warnings
  $: showWarning = !isLoading && data.length === 0 && selectedDate && warningMetadata && warningMetadata.reason !== 'success';
  
  // Load metadata when data is empty
  $: if (!isLoading && data.length === 0 && selectedDate && stageCode && shiftCode) {
    loadWarningMetadata();
  }
  
  async function loadWarningMetadata() {
    try {
      const metadata = await getManpowerLoadMetadata(stageCode, shiftCode, selectedDate, 'planning');
      warningMetadata = metadata;
    } catch (error) {
      console.error('Error loading warning metadata:', error);
      warningMetadata = { reason: 'no_employees' };
    }
  }

  $: selectedDateDisplay = (() => {
    if (!selectedDate) return '';
    const date = new Date(selectedDate);
    return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' });
  })();

  function handleRefresh() {
    dispatch('refresh');
  }

  function handleAttendanceMarked(event: CustomEvent) {
    dispatch('attendanceMarked', event.detail);
  }

  function handleBulkAttendanceMarked(event: CustomEvent) {
    dispatch('bulkAttendanceMarked', event.detail);
  }

  function handleStageReassigned(event: CustomEvent) {
    dispatch('stageReassigned', event.detail);
  }

  function handleExport(event: CustomEvent) {
    dispatch('export', event.detail);
  }
</script>

<div class="theme-bg-primary rounded-lg shadow border theme-border">
  <div class="p-6 border-b theme-border">
    <div class="flex items-center justify-between mb-4">
      <div>
        <h2 class="text-xl font-semibold theme-text-primary">👥📋 Manpower Planning</h2>
        <p class="text-sm theme-text-secondary mt-1">
          Plan attendance and stage reassignments for: {selectedDateDisplay}
        </p>
      </div>
    </div>
  </div>
  
  <!-- Warnings for different scenarios -->
  {#if showWarning && warningMetadata}
    {#if warningMetadata.reason === 'no_shift_schedule'}
      <div class="mx-6 mt-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
        <div class="flex items-start">
          <svg class="w-5 h-5 text-yellow-600 dark:text-yellow-400 mt-0.5 mr-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
          </svg>
          <div class="flex-1">
            <h3 class="text-sm font-medium text-yellow-800 dark:text-yellow-200">
              No Shift Schedule Found
            </h3>
            <div class="mt-2 text-sm text-yellow-700 dark:text-yellow-300">
              <p>
                No active shift schedule has been configured for <strong>{selectedDateDisplay}</strong>. 
                Employees cannot be loaded without a shift schedule.
              </p>
              <p class="mt-2">
                Please create a shift schedule for this date in the <strong>HR → Daily Shift Schedule</strong> section 
                with <code class="px-1 py-0.5 bg-yellow-100 dark:bg-yellow-900/40 rounded">is_working_day = true</code> and <code class="px-1 py-0.5 bg-yellow-100 dark:bg-yellow-900/40 rounded">is_active = true</code>.
              </p>
            </div>
          </div>
        </div>
      </div>
    {:else if warningMetadata.reason === 'no_employees'}
      <div class="mx-6 mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
        <div class="flex items-start">
          <svg class="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 mr-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd" />
          </svg>
          <div class="flex-1">
            <h3 class="text-sm font-medium text-blue-800 dark:text-blue-200">
              No Employees Assigned to Stage
            </h3>
            <div class="mt-2 text-sm text-blue-700 dark:text-blue-300">
              <p>
                Shift schedules exist for <strong>{selectedDateDisplay}</strong>, but no employees are currently assigned to stage <strong>{stageCode}</strong>.
              </p>
              <p class="mt-2">
                Please assign employees to this stage in the <strong>HR → Employee Management</strong> section, or check if employees need to be reassigned for this date.
              </p>
            </div>
          </div>
        </div>
      </div>
    {:else if warningMetadata.reason === 'no_shift_match'}
      <div class="mx-6 mt-4 p-4 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg">
        <div class="flex items-start">
          <svg class="w-5 h-5 text-orange-600 dark:text-orange-400 mt-0.5 mr-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
          </svg>
          <div class="flex-1">
            <h3 class="text-sm font-medium text-orange-800 dark:text-orange-200">
              No Employees Match Shift Code
            </h3>
            <div class="mt-2 text-sm text-orange-700 dark:text-orange-300">
              <p>
                Found <strong>{warningMetadata.totalEmployees}</strong> employee(s) for stage <strong>{stageCode}</strong>, but none match shift code <strong>{shiftCode}</strong>.
              </p>
              {#if warningMetadata.availableShiftCodes && warningMetadata.availableShiftCodes.length > 0}
                <p class="mt-2">
                  Available shift codes in this stage: <strong>{warningMetadata.availableShiftCodes.join(', ')}</strong>
                </p>
                <p class="mt-1">
                  Please navigate to the correct shift tab or update employee shift codes in <strong>HR → Employee Management</strong>.
                </p>
              {/if}
            </div>
          </div>
        </div>
      </div>
    {:else if warningMetadata.reason === 'null_shift_codes'}
      <div class="mx-6 mt-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
        <div class="flex items-start">
          <svg class="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5 mr-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
          </svg>
          <div class="flex-1">
            <h3 class="text-sm font-medium text-red-800 dark:text-red-200">
              Employees Missing Shift Code
            </h3>
            <div class="mt-2 text-sm text-red-700 dark:text-red-300">
              <p>
                Found <strong>{warningMetadata.totalEmployees}</strong> employee(s) for stage <strong>{stageCode}</strong>, but <strong>{warningMetadata.nullShiftCodeCount}</strong> employee(s) have missing or null shift codes.
              </p>
              {#if warningMetadata.availableShiftCodes && warningMetadata.availableShiftCodes.length > 0}
                <p class="mt-2">
                  Available shift codes: <strong>{warningMetadata.availableShiftCodes.join(', ')}</strong>
                </p>
              {/if}
              <p class="mt-2">
                Please update employee shift codes in <strong>HR → Employee Management</strong> to assign them to the correct shift.
              </p>
            </div>
          </div>
        </div>
      </div>
    {/if}
  {/if}
  
  {#if isLoading}
    <div class="flex items-center justify-center py-12">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mr-3"></div>
      <span class="theme-text-secondary">Loading manpower data...</span>
    </div>
  {:else}
    <ManpowerTable 
      data={data} 
      isLoading={isLoading} 
      selectedDate={selectedDate}
      {planningSubmissionStatus}
      on:refresh={handleRefresh}
      on:attendanceMarked={handleAttendanceMarked}
      on:bulkAttendanceMarked={handleBulkAttendanceMarked}
      on:stageReassigned={handleStageReassigned}
      on:export={handleExport} 
    />
  {/if}
</div>

