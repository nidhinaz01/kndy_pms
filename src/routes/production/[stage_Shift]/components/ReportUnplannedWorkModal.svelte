<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { browser } from '$app/environment';
  import Button from '$lib/components/common/Button.svelte';
  import { X } from 'lucide-svelte';
  import type { ProductionWork } from '$lib/api/production';

  export let isOpen: boolean = false;
  export let stageCode: string = '';
  export let selectedDate: string = '';

  const dispatch = createEventDispatcher();

  let isLoading = false;
  let unplannedWorks: ProductionWork[] = [];
  let selectedWork: ProductionWork | null = null;
  let hasLoaded = false;
  let workOrderSearchTerm = '';
  let workSearchTerm = '';

  // Filter unplanned works based on work-order and work search terms
  $: filteredUnplannedWorks = (() => {
    const woSearch = workOrderSearchTerm.toLowerCase().trim();
    const workSearch = workSearchTerm.toLowerCase().trim();
    if (!woSearch && !workSearch) {
      return unplannedWorks;
    }

    return unplannedWorks.filter((work: ProductionWork) => {
      const workCode = (work.std_work_type_details?.derived_sw_code || work.sw_code || '').toLowerCase();
      const workName = (work.sw_name || work.std_work_type_details?.std_work_details?.sw_name || '').toLowerCase();
      const woNo = (work.wo_no || work.prdn_wo_details?.wo_no || '').toLowerCase();
      const pwoNo = (work.pwo_no || work.prdn_wo_details?.pwo_no || '').toLowerCase();

      const woMatches = !woSearch || woNo.includes(woSearch) || pwoNo.includes(woSearch);
      const workMatches = !workSearch || workCode.includes(workSearch) || workName.includes(workSearch);

      return woMatches && workMatches;
    });
  })();

  // Load unplanned works when modal opens (only once per open)
  $: if (isOpen && stageCode && selectedDate && !hasLoaded && browser) {
    hasLoaded = true;
    loadUnplannedWorks();
  }

  // Reset hasLoaded when modal closes
  $: if (!isOpen) {
    hasLoaded = false;
  }

  async function loadUnplannedWorks() {
    if (!stageCode || !selectedDate || !browser) return;

    isLoading = true;
    try {
      const { supabase } = await import('$lib/supabaseClient');
      const dateStr = selectedDate.split('T')[0];
      
      // OPTIMIZATION: Load planned works and all works in parallel
      // This reduces total loading time compared to sequential loading
      const { loadStageWorks, loadStagePlannedWorks } = await import('../../services/stageProductionService');
      
      const [allWorks, plannedWorks, draftPlannedWorks] = await Promise.all([
        loadStageWorks(stageCode, selectedDate),
        loadStagePlannedWorks(stageCode, dateStr, 'approved'),
        loadStagePlannedWorks(stageCode, dateStr, 'draft')
      ]);
      
      const allPlannedWorks = [...plannedWorks, ...draftPlannedWorks];

      // Get all planning IDs to check for reporting records
      const planningIds = allPlannedWorks.map((p: any) => p.id).filter(Boolean);
      
      // Check which planning records have reporting records
      let reportedPlanningIds = new Set<number>();
      if (planningIds.length > 0) {
        const { data: reports, error: reportsError } = await supabase
          .from('prdn_work_reporting')
          .select('planning_id')
          .in('planning_id', planningIds)
          .eq('is_deleted', false)
          .eq('is_active', true);
        
        if (!reportsError && reports) {
          reportedPlanningIds = new Set(reports.map((r: any) => r.planning_id).filter(Boolean));
        }
      }

      // Create maps for efficient lookup
      // Map work key -> planning records for that work
      const workToPlanningsMap = new Map<string, any[]>();
      allPlannedWorks.forEach((planned: any) => {
        const workCode = planned.derived_sw_code || planned.other_work_code;
        const woDetailsId = planned.wo_details_id;
        if (workCode && woDetailsId) {
          const workKey = `${workCode}_${woDetailsId}`;
          if (!workToPlanningsMap.has(workKey)) {
            workToPlanningsMap.set(workKey, []);
          }
          workToPlanningsMap.get(workKey)!.push(planned);
        }
      });

      // Filter works to only show:
      // 1. Works with NO planning records (To be planned)
      // 2. Works with planning records that HAVE reporting records (In progress)
      // Exclude works with planning but NO reporting (Draft Plan, Planned)
      let candidateUnplannedWorks = allWorks.filter((work: ProductionWork) => {
        const workCode = work.std_work_type_details?.derived_sw_code || work.sw_code;
        const woDetailsId = work.wo_details_id;
        if (!workCode || !woDetailsId) return false;
        
        const workKey = `${workCode}_${woDetailsId}`;
        const plannings = workToPlanningsMap.get(workKey) || [];
        
        // If no planning records, show it (To be planned)
        if (plannings.length === 0) {
          return true;
        }
        
        // If has planning records, check if any have reporting records
        // Only show if at least one planning has a report (In progress)
        const hasReportedPlanning = plannings.some((plan: any) => 
          reportedPlanningIds.has(plan.id)
        );
        
        return hasReportedPlanning;
      });

      // De-duplicate rows early: same (workCode, wo_details_id) should appear once.
      const seen = new Set<string>();
      candidateUnplannedWorks = candidateUnplannedWorks.filter((work: ProductionWork) => {
        const hasDerivedSwCode = !!work.std_work_type_details?.derived_sw_code;
        const isNonStandardWork = (work as any).is_added_work === true || !hasDerivedSwCode;
        const derivedSwCode = hasDerivedSwCode ? work.std_work_type_details?.derived_sw_code || null : null;
        const otherWorkCode = isNonStandardWork ? (work.sw_code || null) : null;
        const workCode = (derivedSwCode || otherWorkCode || 'Unknown') as string;
        const woDetailsId = work.wo_details_id;

        if (!woDetailsId) return false;
        const key = `${workCode.toUpperCase()}_${woDetailsId}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      // Exclude works that are already Completed.
      // Important: do this via a lightweight query on `prdn_work_status` to avoid freezing
      // (the previous approach called `checkWorkStatus()` which can be very heavy).
      const derivedSwCodes = candidateUnplannedWorks
        .map((w: any) => w.std_work_type_details?.derived_sw_code)
        .filter((v: any) => !!v) as string[];
      const otherWorkCodes = candidateUnplannedWorks
        .filter((w: any) => (w.is_added_work === true) || !w.std_work_type_details?.derived_sw_code)
        .map((w: any) => w.sw_code)
        .filter((v: any) => !!v) as string[];
      const woDetailsIds = [...new Set(candidateUnplannedWorks.map((w: any) => w.wo_details_id).filter(Boolean))] as number[];

      let completedWorkKeySet = new Set<string>();
      if (woDetailsIds.length > 0 && (derivedSwCodes.length > 0 || otherWorkCodes.length > 0)) {
        const orConditions: string[] = [];
        if (derivedSwCodes.length > 0) orConditions.push(`derived_sw_code.in.(${derivedSwCodes.join(',')})`);
        if (otherWorkCodes.length > 0) orConditions.push(`other_work_code.in.(${otherWorkCodes.join(',')})`);

        const { data: statusRows, error: statusError } = await supabase
          .from('prdn_work_status')
          .select('derived_sw_code, other_work_code, wo_details_id, current_status')
          .eq('stage_code', stageCode)
          .in('wo_details_id', woDetailsIds)
          .or(orConditions.join(','));

        if (!statusError && statusRows) {
          completedWorkKeySet = new Set(
            statusRows
              .filter((r: any) => r.current_status === 'Completed')
              .map((r: any) => `${(r.derived_sw_code || r.other_work_code).toUpperCase()}_${r.wo_details_id}`)
          );
        } else if (statusError) {
          console.warn('Completed status filtering failed:', statusError);
        }
      }

      unplannedWorks = candidateUnplannedWorks.filter((work: ProductionWork) => {
        const hasDerivedSwCode = !!work.std_work_type_details?.derived_sw_code;
        const isNonStandardWork = (work as any).is_added_work === true || !hasDerivedSwCode;
        const derivedSwCode = hasDerivedSwCode ? work.std_work_type_details?.derived_sw_code || null : null;
        const otherWorkCode = isNonStandardWork ? (work.sw_code || null) : null;
        const workCode = (derivedSwCode || otherWorkCode || 'Unknown') as string;
        const woDetailsId = work.wo_details_id;
        if (!woDetailsId) return false;
        const key = `${workCode.toUpperCase()}_${woDetailsId}`;
        return !completedWorkKeySet.has(key);
      });

      console.log(`📋 Found ${unplannedWorks.length} unplanned works out of ${allWorks.length} total works (${allPlannedWorks.length} planned, ${reportedPlanningIds.size} with reports)`);
    } catch (error) {
      console.error('Error loading unplanned works:', error);
      alert('Error loading unplanned works');
      unplannedWorks = [];
    } finally {
      isLoading = false;
    }
  }

  function handleWorkSelect(work: ProductionWork) {
    selectedWork = work;
  }

  function handleReport() {
    if (!selectedWork) {
      alert('Please select a work to report');
      return;
    }
    dispatch('report', { work: selectedWork });
    handleClose();
  }

  function handleClose() {
    dispatch('close');
    selectedWork = null;
    unplannedWorks = [];
    hasLoaded = false;
    workOrderSearchTerm = '';
    workSearchTerm = '';
  }
</script>

{#if isOpen}
  <!-- Modal backdrop -->
  <button 
    class="fixed inset-0 bg-black bg-opacity-50 z-[9999] w-full h-full border-none p-0"
    on:click={handleClose}
    aria-label="Close modal"
  ></button>
  
  <!-- Modal content -->
  <div class="fixed inset-0 z-[10000] flex items-center justify-center p-4">
    <div class="theme-bg-primary rounded-lg shadow-xl border-2 border-gray-300 dark:border-gray-600 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
      <!-- Header -->
      <div class="px-6 py-4 border-b theme-border">
        <div class="flex items-center justify-between">
          <h3 class="text-lg font-medium theme-text-primary">Report Unplanned Work</h3>
          <button
            type="button"
            class="theme-text-secondary hover:theme-text-primary transition-colors"
            on:click={handleClose}
          >
            <X class="w-6 h-6" />
          </button>
        </div>
        <p class="text-sm theme-text-secondary mt-1">
          Select a work from the Works tab that was not planned for today
        </p>
      </div>

      <!-- Content -->
      <div class="px-6 py-4">
        {#if isLoading}
          <div class="text-center py-8">
            <p class="theme-text-secondary">Loading unplanned works...</p>
          </div>
        {:else if unplannedWorks.length === 0}
          <div class="text-center py-8">
            <p class="theme-text-secondary text-lg">No unplanned works found</p>
            <p class="theme-text-secondary text-sm mt-2">
              All works in the Works tab have been planned for today
            </p>
          </div>
        {:else}
          <!-- Search Boxes -->
          <div class="mb-4">
            <div class="grid grid-cols-4 gap-3">
              <input
                type="text"
                bind:value={workOrderSearchTerm}
                placeholder="Work Order No."
                class="col-span-1 px-4 py-2 border theme-border rounded-lg theme-bg-primary theme-text-primary focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <input
                type="text"
                bind:value={workSearchTerm}
                placeholder="Work Code / Work Name (Description)"
                class="col-span-3 px-4 py-2 border theme-border rounded-lg theme-bg-primary theme-text-primary focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            {#if workOrderSearchTerm.trim() || workSearchTerm.trim()}
              <p class="text-xs theme-text-secondary mt-1">
                Showing {filteredUnplannedWorks.length} of {unplannedWorks.length} unplanned works
              </p>
            {/if}
          </div>
          
          {#if filteredUnplannedWorks.length === 0 && (workOrderSearchTerm.trim() || workSearchTerm.trim())}
            <div class="text-center py-8">
              <p class="theme-text-secondary text-lg">
                No works found matching current filters
              </p>
              <p class="theme-text-secondary text-sm mt-2">
                Try a different search term
              </p>
            </div>
          {:else}
            <div class="space-y-2 max-h-[60vh] overflow-y-auto">
              {#each filteredUnplannedWorks as work}
              {@const workCode = work.std_work_type_details?.derived_sw_code || work.sw_code}
              {@const workName = work.sw_name || work.std_work_type_details?.std_work_details?.sw_name || 'N/A'}
              {@const woNo = work.wo_no || work.prdn_wo_details?.wo_no || 'N/A'}
              {@const pwoNo = work.pwo_no || work.prdn_wo_details?.pwo_no || 'N/A'}
              {@const isSelected = selectedWork?.sw_id === work.sw_id && selectedWork?.wo_details_id === work.wo_details_id}
              
              <button
                type="button"
                on:click={() => handleWorkSelect(work)}
                class="w-full text-left p-4 rounded-lg border-2 transition-colors {
                  isSelected 
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30' 
                    : 'border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800'
                }"
              >
                <div class="flex items-center justify-between">
                  <div class="flex-1">
                    <div class="flex items-center space-x-4">
                      <div class="font-medium theme-text-primary">
                        {workCode}
                      </div>
                      <div class="text-sm theme-text-secondary">
                        WO: {woNo} | PWO: {pwoNo}
                      </div>
                    </div>
                    <div class="text-sm theme-text-primary mt-1">
                      {workName}
                    </div>
                  </div>
                  {#if isSelected}
                    <div class="ml-4">
                      <svg class="w-5 h-5 text-blue-600 dark:text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
                      </svg>
                    </div>
                  {/if}
                </div>
              </button>
              {/each}
            </div>
          {/if}
        {/if}
      </div>

      <!-- Footer -->
      <div class="px-6 py-4 border-t theme-border flex justify-end space-x-3">
        <Button variant="secondary" on:click={handleClose}>
          Cancel
        </Button>
        <Button 
          variant="primary" 
          on:click={handleReport}
          disabled={!selectedWork || isLoading}
        >
          Report Work
        </Button>
      </div>
    </div>
  </div>
{/if}
