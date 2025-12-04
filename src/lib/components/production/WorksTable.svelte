<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import { checkWorkStatus, checkPlanningStatus } from '$lib/services/worksTableService';
  import { applyFilters, enrichWorkData, getWorkId } from '$lib/utils/worksTableUtils';
  import type { WorksTableFilters, WorksTableState } from '$lib/types/worksTable';
  import { initialWorksTableFilters, initialWorksTableState } from '$lib/types/worksTable';
  import WorksTableHeader from './works-table/WorksTableHeader.svelte';
  import WorksTableFiltersComponent from './works-table/WorksTableFilters.svelte';
  import WorksTableBody from './works-table/WorksTableBody.svelte';
  import WorksTableSummary from './works-table/WorksTableSummary.svelte';
  import MultiSelectControls from './works-table/MultiSelectControls.svelte';

  export let data: any[] = [];
  export let isLoading: boolean = false;
  export let stageCode: string = '';
  export let selectedDate: string = '';
  export let shiftCode: string = '';

  const dispatch = createEventDispatcher();

  // State
  let filters: WorksTableFilters = { ...initialWorksTableFilters };
  let state: WorksTableState = { ...initialWorksTableState };
  let filteredData: any[] = [];

  // Watch for data changes and apply filters
  $: {
    const filtered = applyFilters(data, filters);
    filteredData = filtered.map(enrichWorkData);
  }

  // Check planning status and work status when data, stageCode, or selectedDate changes
  $: if (data.length > 0 && stageCode && selectedDate) {
    console.log('🔍 WorksTable: Re-checking work status for date:', selectedDate);
    checkPlanningStatus(data, stageCode).then(status => {
      state.workPlanningStatus = status;
    });
    checkWorkStatus(data, stageCode, selectedDate).then(status => {
      console.log('🔍 WorksTable: Work status updated:', status);
      state.workStatus = status;
    });
  }

  function handleSearchChange(value: string) {
    filters.searchTerm = value;
  }

  function handleFilterChange(field: keyof WorksTableFilters, value: string) {
    filters[field] = value;
  }

  function handleToggleFilters() {
    state.showFilters = !state.showFilters;
  }

  function handleExport() {
    dispatch('export', { data: filteredData, type: 'works' });
  }

  function handleAddWork() {
    dispatch('addWork');
  }

  function handleRefresh() {
    dispatch('refresh');
  }

  function handleViewWork(work: any) {
    dispatch('viewWork', { work });
  }

  function handleRemoveWork(work: any) {
    dispatch('removeWork', { work });
  }

  async function handlePlanWork(work: any) {
    try {
      const { canPlanWork } = await import('$lib/api/production');
      const hasDerivedSwCode = !!work.std_work_type_details?.derived_sw_code;
      const isNonStandardWork = work.is_added_work === true || !hasDerivedSwCode;
      const derivedSwCode = hasDerivedSwCode ? work.std_work_type_details.derived_sw_code : null;
      const otherWorkCode = isNonStandardWork ? (work.sw_code || null) : null;
      const woDetailsId = work.wo_details_id;
      
      const validation = await canPlanWork(derivedSwCode, stageCode, woDetailsId, otherWorkCode, shiftCode, selectedDate);
      
      if (validation.canPlan) {
        dispatch('planWork', { work });
      } else {
        alert(validation.reason || 'This work cannot be planned at this time.');
      }
    } catch (error) {
      console.error('Error checking work planning status:', error);
      alert('Error checking work planning status. Please try again.');
    }
  }

  function toggleRowSelection(work: any) {
    const workId = getWorkId(work);
    if (!workId) return;

    if (state.selectedRows.has(workId)) {
      state.selectedRows.delete(workId);
    } else {
      state.selectedRows.add(workId);
    }
    state.selectedRows = new Set(state.selectedRows);
  }

  function handleRemoveSelected() {
    const selectedWorks = filteredData.filter(work => state.selectedRows.has(getWorkId(work)));
    const removableWorks = selectedWorks.filter(work => canRemoveWork(work));
    
    if (removableWorks.length === 0) {
      alert('No removable works selected');
      return;
    }

    dispatch('removeSelected', { works: removableWorks });
    state.selectedRows = new Set();
  }

  function clearAllSelections() {
    state.selectedRows = new Set();
  }

  function selectAllRemovable() {
    const removableWorks = filteredData.filter(work => canRemoveWork(work));
    state.selectedRows = new Set(removableWorks.map(work => getWorkId(work)));
  }

  function isWorkPlanned(work: any): boolean {
    const derivedSwCode = work.std_work_type_details?.derived_sw_code || work.sw_code;
    const workKey = `${derivedSwCode}_${stageCode}`;
    const status = state.workStatus[workKey];
    const planningStatus = state.workPlanningStatus[workKey];
    
    // Work is considered planned if:
    // 1. It has Draft Plan, Plan Pending Approval, Planned, In progress, or Completed status, OR
    // 2. Planning is not allowed (canPlan === false), which means there's a draft/pending plan
    const hasPlannedStatus = status === 'Draft Plan' || status === 'Plan Pending Approval' || status === 'Planned' || status === 'In progress' || status === 'Completed';
    const cannotPlan = planningStatus && !planningStatus.canPlan;
    
    return hasPlannedStatus || cannotPlan;
  }

  function canRemoveWork(work: any): boolean {
    const result = getRemoveWorkReason(work);
    return result.canRemove;
  }

  function getRemoveWorkReason(work: any): { canRemove: boolean; reason?: string } {
    const derivedSwCode = work.std_work_type_details?.derived_sw_code || work.sw_code;
    const workKey = `${derivedSwCode}_${stageCode}`;
    // Default to 'To be planned' if status is not yet loaded (matches template behavior)
    const status = state.workStatus[workKey] || 'To be planned';
    
    // Work can only be removed if:
    // 1. Status is 'To be planned', AND
    // 2. No work has been reported (time_worked_till_date or time_taken is 0 or null)
    const isToBePlanned = status === 'To be planned';
    
    // Check if work has been done - be explicit about null/undefined/0 checks
    const timeWorkedTillDate = work.time_worked_till_date ?? 0;
    const timeTaken = work.time_taken ?? 0;
    const hasWorkBeenDone = (timeWorkedTillDate > 0) || (timeTaken > 0);
    
    const canRemove = isToBePlanned && !hasWorkBeenDone;
    
    if (canRemove) {
      return { canRemove: true };
    }
    
    // Determine the reason why it cannot be removed
    if (!isToBePlanned) {
      return { 
        canRemove: false, 
        reason: `Work status is "${status}". Only works with "To be planned" status can be removed.` 
      };
    }
    
    if (hasWorkBeenDone) {
      const reasons: string[] = [];
      if (timeWorkedTillDate > 0) {
        reasons.push(`Time worked till date: ${timeWorkedTillDate.toFixed(2)}h`);
      }
      if (timeTaken > 0) {
        reasons.push(`Time taken: ${timeTaken.toFixed(2)}h`);
      }
      return { 
        canRemove: false, 
        reason: `Work has been reported (${reasons.join(', ')}). Works with reported time cannot be removed.` 
      };
    }
    
    return { canRemove: false, reason: 'Work cannot be removed at this time.' };
  }

  function getPlanningStatus(work: any) {
    const derivedSwCode = work.std_work_type_details?.derived_sw_code || work.sw_code;
    const workKey = `${derivedSwCode}_${stageCode}`;
    return state.workPlanningStatus[workKey] || { canPlan: false };
  }

  $: selectedWorks = filteredData.filter(work => state.selectedRows.has(getWorkId(work)));
  $: removableWorks = selectedWorks.filter(work => canRemoveWork(work));
  $: allRemovableSelected = filteredData.filter(work => canRemoveWork(work)).length > 0 && 
    filteredData.filter(work => canRemoveWork(work)).every(work => state.selectedRows.has(getWorkId(work)));
</script>

<div class="theme-bg-primary rounded-lg shadow border theme-border">
  <div class="p-4 border-b theme-border">
    <WorksTableHeader
      {filters}
      showFilters={state.showFilters}
      {isLoading}
      onSearchChange={handleSearchChange}
      onToggleFilters={handleToggleFilters}
      onRefresh={handleRefresh}
      onExport={handleExport}
      onAddWork={handleAddWork}
    />

    {#if state.selectedRows.size > 0}
      <MultiSelectControls
        selectedCount={state.selectedRows.size}
        removableCount={removableWorks.length}
        onRemoveSelected={handleRemoveSelected}
        onClearSelection={clearAllSelections}
      />
    {/if}

    {#if state.showFilters}
      <div class="mt-4 p-4 theme-bg-secondary rounded-lg border theme-border">
        <WorksTableFiltersComponent
          {filters}
          onFilterChange={handleFilterChange}
        />
      </div>
    {/if}
  </div>

  <div class="mb-4 p-4 theme-bg-secondary rounded-lg border theme-border">
    <h3 class="text-sm font-medium theme-text-primary mb-3">Color Legend</h3>
    <div class="flex flex-wrap gap-4 text-sm">
      <div class="flex items-center gap-2">
        <div class="w-4 h-4 rounded" style="background-color: #fecaca;"></div>
        <span class="theme-text-primary">Time Exceeded (Actual time > Planned duration)</span>
      </div>
    </div>
  </div>

  <div class="overflow-x-auto relative">
    <div class="overflow-x-auto pb-0" id="table-scroll-container">
      <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
        <WorksTableBody
          {filteredData}
          {isLoading}
          selectedRows={state.selectedRows}
          workPlanningStatus={state.workPlanningStatus}
          workStatus={state.workStatus}
          {filters}
          {stageCode}
          onToggleSelection={toggleRowSelection}
          onPlanWork={handlePlanWork}
          onViewWork={handleViewWork}
          onRemoveWork={handleRemoveWork}
          {isWorkPlanned}
          canRemoveWork={canRemoveWork}
          getRemoveWorkReason={getRemoveWorkReason}
          onSelectAll={selectAllRemovable}
          onClearAll={clearAllSelections}
          {allRemovableSelected}
        />
      </table>
    </div>
  </div>

  {#if filteredData.length > 0}
    <div class="px-6 py-4 theme-bg-secondary border-t theme-border">
      <WorksTableSummary {filteredData} workStatus={state.workStatus} {stageCode} />
    </div>
  {/if}
</div>

<style>
  :global(.time-exceeded) {
    background-color: rgba(239, 68, 68, 0.1);
  }
</style>
