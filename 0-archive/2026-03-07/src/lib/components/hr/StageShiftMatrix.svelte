<script lang="ts">
  import { onMount } from 'svelte';
  import { fetchAllShifts } from '$lib/api/hrShiftMaster';
  import { fetchAllPlantStages, fetchStagesForShift, saveShiftStages } from '$lib/api/hrShiftStageMaster';
  import type { HrShiftMaster } from '$lib/api/hrShiftMaster';

  let shifts: HrShiftMaster[] = [];
  let stages: string[] = [];
  let associations: Map<string, Set<string>> = new Map(); // stage -> Set of shift_codes
  let isLoading = true;
  let isSaving = false;
  let errorMessage = '';

  onMount(async () => {
    await loadData();
  });

  async function loadData() {
    isLoading = true;
    errorMessage = '';
    try {
      // Load shifts and stages in parallel
      const [shiftsData, stagesData] = await Promise.all([
        fetchAllShifts(),
        fetchAllPlantStages()
      ]);

      shifts = shiftsData;
      stages = stagesData;

      // Load existing associations
      await loadAssociations();
    } catch (error: any) {
      console.error('Error loading data:', error);
      errorMessage = error.message || 'Failed to load data. Please refresh the page.';
    } finally {
      isLoading = false;
    }
  }

  async function loadAssociations() {
    associations.clear();
    
    // Initialize map for all stages
    for (const stage of stages) {
      associations.set(stage, new Set());
    }

    // Load associations for each shift
    for (const shift of shifts) {
      try {
        const stageCodes = await fetchStagesForShift(shift.shift_code);
        for (const stageCode of stageCodes) {
          if (associations.has(stageCode)) {
            associations.get(stageCode)!.add(shift.shift_code);
          }
        }
      } catch (error) {
        console.error(`Error loading associations for shift ${shift.shift_code}:`, error);
      }
    }
  }

  function isAssociated(stageCode: string, shiftCode: string): boolean {
    return associations.get(stageCode)?.has(shiftCode) || false;
  }

  async function toggleAssociation(stageCode: string, shiftCode: string) {
    if (isSaving) return;

    const currentState = isAssociated(stageCode, shiftCode);
    const newState = !currentState;

    // Optimistically update UI
    if (newState) {
      associations.get(stageCode)?.add(shiftCode);
    } else {
      associations.get(stageCode)?.delete(shiftCode);
    }

    // Save to database
    // We need to get all stages currently associated with this shift
    isSaving = true;
    try {
      // Get all stages that should be associated with this shift
      const stagesForThisShift: string[] = [];
      for (const [stage, shiftSet] of associations.entries()) {
        if (shiftSet.has(shiftCode)) {
          stagesForThisShift.push(stage);
        }
      }
      
      await saveShiftStages(shiftCode, stagesForThisShift);
    } catch (error: any) {
      console.error('Error saving association:', error);
      // Revert on error
      if (newState) {
        associations.get(stageCode)?.delete(shiftCode);
      } else {
        associations.get(stageCode)?.add(shiftCode);
      }
      alert(`Failed to ${newState ? 'link' : 'unlink'} stage ${stageCode} with shift ${shiftCode}. Please try again.`);
    } finally {
      isSaving = false;
    }
  }
</script>

<div class="theme-bg-primary rounded-lg shadow border theme-border p-6">
  {#if isLoading}
    <div class="flex items-center justify-center py-12">
      <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      <span class="ml-3 theme-text-primary">Loading stage-shift associations...</span>
    </div>
  {:else if errorMessage}
    <div class="p-4 bg-red-100 border border-red-400 text-red-700 rounded dark:bg-red-900 dark:border-red-800 dark:text-red-200">
      {errorMessage}
      <button
        on:click={loadData}
        class="ml-4 underline hover:no-underline"
      >
        Retry
      </button>
    </div>
  {:else}
    <div class="mb-4 flex items-center justify-between">
      <h3 class="text-lg font-semibold theme-text-primary">Stage - Shift Associations</h3>
      <button
        on:click={loadData}
        class="px-4 py-2 text-sm theme-bg-secondary theme-text-primary rounded hover:theme-bg-tertiary transition-colors"
        disabled={isSaving}
      >
        Refresh
      </button>
    </div>

    {#if stages.length === 0 || shifts.length === 0}
      <div class="text-center py-8 theme-text-secondary">
        {#if stages.length === 0}
          <p>No stages found. Please configure stages first.</p>
        {:else}
          <p>No shifts found. Please create shifts first.</p>
        {/if}
      </div>
    {:else}
      <div class="overflow-x-auto">
        <table class="w-full border-collapse">
          <thead>
            <tr>
              <th class="sticky left-0 z-10 theme-bg-primary theme-border border px-4 py-3 text-left font-semibold theme-text-primary bg-opacity-95">
                Stage
              </th>
              {#each shifts as shift}
                <th class="theme-border border px-4 py-3 text-center font-semibold theme-text-primary min-w-[120px]">
                  <div class="flex flex-col items-center">
                    <span class="text-sm font-medium">{shift.shift_name}</span>
                    <span class="text-xs theme-text-secondary">({shift.shift_code})</span>
                  </div>
                </th>
              {/each}
            </tr>
          </thead>
          <tbody>
            {#each stages as stage}
              <tr class="hover:theme-bg-secondary">
                <td class="sticky left-0 z-10 theme-bg-primary theme-border border px-4 py-3 font-medium theme-text-primary bg-opacity-95">
                  {stage}
                </td>
                {#each shifts as shift}
                  <td class="theme-border border px-4 py-3 text-center">
                    <input
                      type="checkbox"
                      checked={isAssociated(stage, shift.shift_code)}
                      on:change={() => toggleAssociation(stage, shift.shift_code)}
                      disabled={isSaving}
                      class="w-5 h-5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Click to {isAssociated(stage, shift.shift_code) ? 'unlink' : 'link'} {stage} with {shift.shift_name}"
                    />
                  </td>
                {/each}
              </tr>
            {/each}
          </tbody>
        </table>
      </div>

      {#if isSaving}
        <div class="mt-4 text-center theme-text-secondary text-sm">
          Saving changes...
        </div>
      {/if}
    {/if}
  {/if}
</div>

<style>
  /* Ensure sticky header and first column work properly */
  thead th {
    position: sticky;
    top: 0;
    z-index: 20;
  }
  
  tbody td.sticky,
  thead th.sticky {
    position: sticky;
    left: 0;
    z-index: 10;
  }
  
  thead th.sticky {
    z-index: 30;
  }
</style>

