<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import Button from '$lib/components/common/Button.svelte';
  import SortableHeader from '$lib/components/common/SortableHeader.svelte';
  import { formatTime, calculateBreakTimeInRange } from '../utils/timeUtils';
  import { groupPlannedWorks } from '../utils/planTabUtils';
  import { filterGroupedWorksBySearch } from '../utils/productionTabSearchUtils';
  import PlanHistoryModal from './PlanHistoryModal.svelte';
  import { supabase } from '$lib/supabaseClient';
  import { sortTableData, handleSortClick, type SortConfig } from '$lib/utils/tableSorting';
  import { validateEmployeeShiftPlanning } from '$lib/api/production/planningValidationService';

  export let draftPlanData: any[] = [];
  export let draftManpowerPlanData: any[] = []; // For external reference only (not used in this component yet)
  export let isLoading: boolean = false;
  
  // Reference draftManpowerPlanData to satisfy linter (for future use)
  $: void draftManpowerPlanData;
  export let stageCode: string = '';
  export let shiftCode: string = '';
  export let selectedDate: string = '';
  export let expandedGroups: string[] = []; // Kept for compatibility but no longer used
  export let selectedRows: Set<string> = new Set();
  export let shiftBreakTimes: Array<{ start_time: string; end_time: string }> = [];
  export let planningSubmissionStatus: any = null;

  const dispatch = createEventDispatcher();

  let showHistoryModal = false;
  const WORK_NAME_PREVIEW_LENGTH = 30;
  let expandedWorkNames: Record<string, boolean> = {};
  let hasRejectedSubmission = false; // Track if there's a previous rejected submission
  let searchTerm = '';
  let sortConfig: SortConfig = { column: null, direction: null };
  let validationErrors: string[] = [];
  let validationWarnings: string[] = [];
  let isValidationLoading = false;
  let lastValidationRequestKey = '';
  let showIssuesModal = false;

  /** When true, show `prdn_work_planning.id` column for debugging (default off). */
  let showDebugIds = false;

  // Combine draft work plans and manpower plans (only work plans for now, as manpower plans have different structure)
  $: allDraftPlans = draftPlanData || [];
  $: groupedPlannedWorks = groupPlannedWorks(allDraftPlans);
  $: filteredGroupedPlannedWorks = filterGroupedWorksBySearch(groupedPlannedWorks, searchTerm);
  
  // Convert grouped works to array and sort
  $: groupedWorksArray = Object.values(filteredGroupedPlannedWorks);
  $: sortedGroupedWorks = (() => {
    if (!sortConfig.column || !sortConfig.direction) {
      return groupedWorksArray;
    }
    
    // Create enriched groups with sortable fields
    const enriched = groupedWorksArray.map(group => ({
      ...group,
      sortable_woNo: group.woNo || '',
      sortable_pwoNo: group.pwoNo || '',
      sortable_workCode: group.workCode || '',
      sortable_workName: group.workName || '',
      sortable_fromDate: group.items?.[0]?.from_date || '',
      sortable_fromTime: group.items?.[0]?.from_time || '',
      sortable_toDate: group.items?.[0]?.to_date || '',
      sortable_toTime: group.items?.[0]?.to_time || '',
      sortable_plannedHours: group.items?.[0]?.planned_hours || 0,
      sortable_timeWorkedTillDate: group.items?.[0]?.time_worked_till_date || 0,
      sortable_remainingTime: group.items?.[0]?.remainingTimeMinutes || 0
    }));
    
    return sortTableData(enriched, sortConfig);
  })();
  
  // Count unique works (by work code), not individual skill competencies
  $: totalPlans = sortedGroupedWorks.length;

  function handleSort(column: string) {
    sortConfig = handleSortClick(column, sortConfig);
  }
  

  $: selectedDateDisplay = (() => {
    if (!selectedDate) return '';
    const date = new Date(selectedDate);
    return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' });
  })();

  function handleSubmit() {
    dispatch('submit');
  }

  function handleRefresh() {
    dispatch('refresh');
  }

  // toggleGroup function kept for compatibility but no longer used
  function toggleGroup(workCode: string) {
    // No-op: expandable groups removed
  }

  function handleDeletePlan(work: any) {
    dispatch('deletePlan', work);
  }

  function handleDeleteAllPlansForWork(group: any) {
    dispatch('deleteAllPlansForWork', group);
  }

  function handleEditPlan(group: any) {
    dispatch('editPlan', group);
  }

  function handleMultiDelete() {
    dispatch('multiDelete');
  }

  function toggleRowSelection(rowId: string) {
    dispatch('toggleRowSelection', rowId);
  }

  function selectAllRowsInGroup(group: any) {
    dispatch('selectAllInGroup', group);
  }

  function clearAllSelections() {
    dispatch('clearSelections');
  }

  function dispatchSelectAllVisible() {
    dispatch('selectAllVisible', { ids: visiblePlanRowIds });
  }

  function dispatchDeselectVisible() {
    dispatch('deselectVisible', { ids: visiblePlanRowIds });
  }

  let planSelectAllHeaderInput: HTMLInputElement | null = null;

  $: visiblePlanRowIds = sortedGroupedWorks.flatMap((g: { items?: { id: string | number }[] }) =>
    (g.items || []).map((item: { id: string | number }) => String(item.id))
  );
  $: allVisiblePlanSelected =
    visiblePlanRowIds.length > 0 && visiblePlanRowIds.every((id) => selectedRows.has(id));
  $: someVisiblePlanSelected = visiblePlanRowIds.some((id) => selectedRows.has(id));
  $: if (planSelectAllHeaderInput) {
    planSelectAllHeaderInput.indeterminate = someVisiblePlanSelected && !allVisiblePlanSelected;
  }

  // Expanded groups functionality removed - kept for compatibility
  $: expandedGroupsSet = new Set(expandedGroups);

  $: selectedWorks = allDraftPlans.filter((work) => selectedRows.has(String(work.id)));

  // Check for previous rejected submissions to determine "Resubmitted" status
  $: if (stageCode && selectedDate && planningSubmissionStatus) {
    checkForRejectedSubmissions();
  }

  async function checkForRejectedSubmissions() {
    if (!stageCode || !selectedDate || !planningSubmissionStatus) return;
    
    try {
      let dateStr: string;
      if (typeof selectedDate === 'string') {
        dateStr = selectedDate.split('T')[0];
      } else if (selectedDate && typeof selectedDate === 'object' && 'toISOString' in selectedDate) {
        dateStr = (selectedDate as Date).toISOString().split('T')[0];
      } else {
        dateStr = String(selectedDate || '').split('T')[0];
      }

      const { data } = await supabase
        .from('prdn_planning_submissions')
        .select('id, status, submitted_dt')
        .eq('stage_code', stageCode)
        .eq('planning_date', dateStr)
        .eq('is_deleted', false)
        .order('submitted_dt', { ascending: false });

      // If latest submission is pending_approval, check if there are any rejected submissions in history
      // (data is ordered by submitted_dt descending, so index 0 is latest)
      if (data && data.length > 1 && planningSubmissionStatus.status === 'pending_approval') {
        // Check if any submission after the first one (i.e., earlier in time) is rejected
        hasRejectedSubmission = data.slice(1).some(s => s.status === 'rejected');
      } else {
        hasRejectedSubmission = false;
      }
    } catch (error) {
      console.error('Error checking for rejected submissions:', error);
      hasRejectedSubmission = false;
    }
  }

  // Submission status helpers
  $: hasSubmission = planningSubmissionStatus !== null;
  $: isPendingApproval = planningSubmissionStatus?.status === 'pending_approval';
  $: isApproved = planningSubmissionStatus?.status === 'approved';
  $: isRejected = planningSubmissionStatus?.status === 'rejected';
  $: isReverted = planningSubmissionStatus?.status === 'reverted';
  $: isResubmitted = isPendingApproval && hasRejectedSubmission; // Resubmitted if pending and there's a previous rejected
  $: canSubmit = !hasSubmission || isRejected || isReverted; // Can submit if no submission, rejected, or reverted
  $: blockingIssues = [
    ...validationErrors.map((message) => ({ type: 'error' as const, message })),
    ...validationWarnings.map((message) => ({ type: 'warning' as const, message }))
  ];
  $: hasBlockingIssues = blockingIssues.length > 0;
  $: shouldDisableSubmit =
    isLoading ||
    isValidationLoading ||
    totalPlans === 0 ||
    isPendingApproval ||
    isApproved ||
    hasBlockingIssues;
  $: canEdit = !hasSubmission || isRejected || isReverted; // Can edit if no submission, rejected, or reverted

  async function loadValidationIssues(requestKey: string) {
    const requestStartedFor = requestKey;
    isValidationLoading = true;
    try {
      let dateStr: string;
      if (typeof selectedDate === 'string') {
        dateStr = selectedDate.split('T')[0];
      } else {
        dateStr = new Date(selectedDate).toISOString().split('T')[0];
      }
      const result = await validateEmployeeShiftPlanning(stageCode, shiftCode, dateStr);
      if (lastValidationRequestKey !== requestStartedFor) return;
      validationErrors = result.errors || [];
      validationWarnings = result.warnings || [];
    } catch (error) {
      if (lastValidationRequestKey !== requestStartedFor) return;
      validationErrors = [`Unable to evaluate draft-plan issues: ${(error as Error).message}`];
      validationWarnings = [];
    } finally {
      if (lastValidationRequestKey === requestStartedFor) {
        isValidationLoading = false;
      }
    }
  }

  $: {
    const dateKey =
      typeof selectedDate === 'string'
        ? selectedDate.split('T')[0]
        : new Date(selectedDate).toISOString().split('T')[0];
    const nextKey = [
      stageCode || '',
      shiftCode || '',
      dateKey || '',
      String(allDraftPlans?.length || 0),
      String(draftManpowerPlanData?.length || 0),
      String(planningSubmissionStatus?.status || ''),
      String(isLoading)
    ].join('|');
    if (nextKey !== lastValidationRequestKey) {
      lastValidationRequestKey = nextKey;
      if (!stageCode || !shiftCode || !dateKey || isLoading) {
        validationErrors = [];
        validationWarnings = [];
        isValidationLoading = false;
      } else {
        void loadValidationIssues(nextKey);
      }
    }
  }

  $: submissionStatusDisplay = (() => {
    if (!planningSubmissionStatus) {
      return { text: 'To be Submitted', color: 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400' };
    }
    const status = planningSubmissionStatus.status;
    const version = planningSubmissionStatus.version || 1;
    const versionText = version > 1 ? ` (v${version})` : '';
    
    if (isResubmitted) {
      return { text: `Resubmitted${versionText}`, color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400' };
    } else if (status === 'pending_approval') {
      return { text: `Submitted${versionText}`, color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400' };
    } else if (status === 'approved') {
      return { text: `Approved${versionText}`, color: 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400' };
    } else if (status === 'rejected') {
      return { text: `Rejected${versionText}`, color: 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400' };
    } else if (status === 'reverted') {
      return { text: `Reverted${versionText}`, color: 'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400' };
    }
    return null;
  })();

  function handleShowHistory() {
    showHistoryModal = true;
  }

  function openIssuesModal() {
    if (blockingIssues.length === 0) return;
    showIssuesModal = true;
  }

  function closeIssuesModal() {
    showIssuesModal = false;
  }

  function rowStatusDisplay(status: string | undefined): { text: string; color: string } {
    const value = (status || '').toLowerCase();
    if (value === 'approved') {
      return {
        text: 'Approved',
        color: 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
      };
    }
    if (value === 'pending_approval') {
      return {
        text: 'Submitted',
        color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400'
      };
    }
    if (value === 'rejected') {
      return {
        text: 'Rejected',
        color: 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
      };
    }
    return {
      text: 'Draft',
      color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400'
    };
  }

  function getWorkNamePreview(name: string): { preview: string; truncated: boolean } {
    const full = (name || '').trim();
    if (full.length <= WORK_NAME_PREVIEW_LENGTH) return { preview: full || 'N/A', truncated: false };
    return { preview: `${full.slice(0, WORK_NAME_PREVIEW_LENGTH)}...`, truncated: true };
  }

  function toggleWorkName(key: string) {
    expandedWorkNames = { ...expandedWorkNames, [key]: !expandedWorkNames[key] };
  }

  function formatDateDdMmYy(value: string | null | undefined): string {
    if (!value) return 'N/A';
    const datePart = String(value).split('T')[0];
    const [year, month, day] = datePart.split('-');
    if (!year || !month || !day) return value;
    return `${day}-${month}-${year.slice(-2)}`;
  }

  function formatTimeWithoutSeconds(value: string | null | undefined): string {
    if (!value) return 'N/A';
    const timePart = String(value).split('T').pop() || '';
    const parts = timePart.split(':');
    if (parts.length < 2) return value;
    return `${parts[0]}:${parts[1]}`;
  }

  /** `std_work_skill_mapping` from Supabase may be object or single-element array */
  function stdMappingScName(item: any): string | null {
    const m = item?.std_work_skill_mapping;
    if (!m) return null;
    const row = Array.isArray(m) ? m[0] : m;
    const name = row?.sc_name;
    if (name == null || String(name).trim() === '') return null;
    return String(name).trim();
  }

  /**
   * Per grouped work row: non-standard → `prdn_work_additions.other_work_sc` (via enrich `workAdditionData`);
   * standard → first item with `wsm_id` uses `std_work_skill_mapping.sc_name`.
   */
  function getGroupedSkillsRequiredDisplay(group: { items?: any[] }): string {
    const items = group.items || [];
    if (items.length === 0) return 'N/A';
    const isNonStandard = items.some((it) => Boolean(it?.other_work_code));
    if (isNonStandard) {
      for (const item of items) {
        const sc = item?.workAdditionData?.other_work_sc;
        if (sc != null && String(sc).trim() !== '') return String(sc).trim();
      }
      return 'N/A';
    }
    for (const item of items) {
      if (item?.wsm_id == null || item.wsm_id === '') continue;
      const name = stdMappingScName(item);
      if (name) return name;
    }
    return 'N/A';
  }
</script>

<div class="theme-bg-primary rounded-lg shadow border theme-border">
  <div class="p-6 border-b theme-border">
    <div class="flex items-center justify-between mb-4">
      <div>
        <h2 class="text-xl font-semibold theme-text-primary">📝 Draft Planning</h2>
        <p class="text-sm theme-text-secondary mt-1">
          Review and submit all draft plans for: {selectedDateDisplay}
        </p>
        <div class="mt-2 flex items-center gap-3">
          <span class="text-xs theme-text-secondary">Status:</span>
          {#if submissionStatusDisplay}
            <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium {submissionStatusDisplay.color}">
              {submissionStatusDisplay.text}
            </span>
          {/if}
        </div>
      </div>
      <div class="flex items-center space-x-3">
        <Button
          variant={showDebugIds ? 'primary' : 'secondary'}
          size="sm"
          title={showDebugIds ? 'Hide planning row IDs' : 'Show prdn_work_planning.id column for debugging'}
          on:click={() => (showDebugIds = !showDebugIds)}
        >
          ID
        </Button>
        <Button variant="secondary" size="sm" on:click={handleRefresh} disabled={isLoading}>
          {isLoading ? 'Loading...' : 'Refresh'}
        </Button>
        <Button 
          variant="secondary" 
          size="sm" 
          on:click={handleShowHistory}
          disabled={isLoading}
        >
          Plan History
        </Button>
        <Button 
          variant="primary" 
          size="sm" 
          on:click={handleSubmit}
          disabled={shouldDisableSubmit}
        >
          {isPendingApproval ? 'Pending Approval' : isApproved ? 'Approved' : 'Submit Plan'}
        </Button>
      </div>
    </div>
    <!-- Search Box -->
    <div class="mt-4">
      <input
        type="text"
        bind:value={searchTerm}
        placeholder="Search by work code, work name, WO number, PWO number, worker, or skill..."
        class="w-full px-4 py-2 border theme-border rounded-lg theme-bg-primary theme-text-primary focus:ring-2 focus:ring-blue-500 focus:border-transparent"
      />
    </div>
    <div class="mt-4">
      {#if isValidationLoading}
        <div class="rounded-lg border theme-border px-4 py-3 theme-bg-secondary">
          <p class="text-sm theme-text-secondary">Checking plan issues...</p>
        </div>
      {:else if blockingIssues.length > 0}
        <button
          type="button"
          class="w-full rounded-lg border border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/10 px-4 py-3 text-left"
          on:click={openIssuesModal}
        >
          <div class="flex items-center justify-between gap-2">
            <p class="text-sm font-semibold text-red-700 dark:text-red-300">
              Resolve all issues before submitting plan
            </p>
            <span class="text-xs text-red-700 dark:text-red-300">
              {blockingIssues.length} issue{blockingIssues.length === 1 ? '' : 's'}
            </span>
          </div>
        </button>
      {:else}
        <div class="rounded-lg border border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-900/10 px-4 py-3">
          <p class="text-sm text-green-700 dark:text-green-300">
            No blocking issues found. Plan can be submitted.
          </p>
        </div>
      {/if}
    </div>
  </div>
  
  <!-- Read-only notice -->
  {#if !canEdit}
    <div class="px-6 py-3 border-b theme-border theme-bg-secondary">
      <div class="flex items-center gap-2">
        <svg class="w-5 h-5 theme-text-primary" fill="currentColor" viewBox="0 0 20 20">
          <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd" />
        </svg>
        <p class="text-sm theme-text-primary">
          <strong>Read-only mode:</strong> This plan has been {isPendingApproval ? 'submitted for review' : isApproved ? 'approved' : ''}. You can view the plan but cannot make changes. {isRejected || isReverted ? 'The plan was reopened for edits - refresh if actions are still locked.' : ''}
        </p>
      </div>
    </div>
  {/if}

  <!-- Multi-delete controls -->
  {#if selectedRows.size > 0 && canEdit}
    <div class="px-6 py-3 border-b theme-border bg-blue-50 dark:bg-blue-900/20">
      <div class="flex items-center justify-between">
        <div class="flex items-center space-x-4">
          <span class="text-sm theme-text-primary">
            {selectedRows.size} skill {selectedRows.size === 1 ? 'competency' : 'competencies'} selected
          </span>
          <Button 
            variant="danger" 
            size="sm" 
            on:click={handleMultiDelete}
          >
            Delete Selected Skills ({selectedRows.size})
          </Button>
        </div>
        <Button variant="secondary" size="sm" on:click={clearAllSelections}>
          Clear Selection
        </Button>
      </div>
    </div>
  {/if}
  
  <!-- Selection instructions -->
  <div class="px-6 py-2 theme-bg-secondary border-b theme-border">
    <p class="text-xs theme-text-primary">
      💡 <strong class="theme-text-primary">Multi-selection:</strong> You can select multiple skill competencies by checking the checkbox in each row. Each work may have multiple skill competencies shown in the same row.
    </p>
  </div>
  
  {#if isLoading}
    <div class="flex items-center justify-center py-12">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mr-3"></div>
      <span class="theme-text-secondary">Loading draft plans...</span>
    </div>
  {:else if totalPlans === 0}
    <div class="text-center py-12">
      <div class="text-6xl mb-4">📝</div>
      <p class="theme-text-secondary text-lg">No draft plans found</p>
      <p class="theme-text-secondary text-sm mt-2">
        Create plans in Works tab and Manpower Plan tab
      </p>
    </div>
  {:else}
    <div class="overflow-x-auto">
      <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700" style="table-layout: auto; word-wrap: break-word;">
        <thead class="theme-bg-secondary">
          <tr>
            <th class="px-6 py-3 text-left text-xs font-medium theme-text-secondary uppercase tracking-wider w-14">
              <input
                bind:this={planSelectAllHeaderInput}
                type="checkbox"
                class="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                checked={allVisiblePlanSelected}
                disabled={!canEdit || visiblePlanRowIds.length === 0}
                title="Select all visible rows"
                aria-label="Select all visible rows"
                on:change={(e) => {
                  if (!canEdit || visiblePlanRowIds.length === 0) return;
                  const target = e.target as HTMLInputElement;
                  if (target?.checked) {
                    dispatchSelectAllVisible();
                  } else {
                    dispatchDeselectVisible();
                  }
                }}
              />
            </th>
            {#if showDebugIds}
              <th
                class="px-6 py-3 text-left text-xs font-medium theme-text-secondary uppercase tracking-wider whitespace-nowrap w-[88px]"
                title="prdn_work_planning.id (per skill row)"
              >
                ID
              </th>
            {/if}
            <SortableHeader column="sortable_woNo" {sortConfig} onSort={handleSort} label="Work Order" headerClass="w-[100px] min-w-[100px] max-w-[100px]" />
            <SortableHeader column="sortable_pwoNo" {sortConfig} onSort={handleSort} label="PWO Number" headerClass="w-[100px] min-w-[100px] max-w-[100px]" />
            <SortableHeader column="sortable_workCode" {sortConfig} onSort={handleSort} label="Work Code" headerClass="w-[120px] min-w-[120px] max-w-[120px]" />
            <SortableHeader column="sortable_workName" {sortConfig} onSort={handleSort} label="Work Name" headerClass="max-w-[200px] w-[200px]" />
            <th class="px-6 py-3 text-left text-xs font-medium theme-text-secondary uppercase tracking-wider">Skills Required</th>
            <th class="px-6 py-3 text-left text-xs font-medium theme-text-secondary uppercase tracking-wider">Standard Time</th>
            <th class="px-6 py-3 text-left text-xs font-medium theme-text-secondary uppercase tracking-wider">Skill</th>
            <th class="px-6 py-3 text-left text-xs font-medium theme-text-secondary uppercase tracking-wider">Worker (Skill)</th>
            <SortableHeader column="sortable_fromDate" {sortConfig} onSort={handleSort} label="From Date" headerClass="w-[100px]" />
            <SortableHeader column="sortable_fromTime" {sortConfig} onSort={handleSort} label="From Time" headerClass="w-[90px]" />
            <SortableHeader column="sortable_toDate" {sortConfig} onSort={handleSort} label="To Date" headerClass="w-[100px]" />
            <SortableHeader column="sortable_toTime" {sortConfig} onSort={handleSort} label="To Time" headerClass="w-[90px]" />
            <SortableHeader column="sortable_plannedHours" {sortConfig} onSort={handleSort} label="Planned Hours" />
            <SortableHeader column="sortable_timeWorkedTillDate" {sortConfig} onSort={handleSort} label="Time Worked Till Date" />
            <SortableHeader column="sortable_remainingTime" {sortConfig} onSort={handleSort} label="Remaining Time" />
            <th class="px-6 py-3 text-left text-xs font-medium theme-text-secondary uppercase tracking-wider">Actions</th>
          </tr>
        </thead>
        <tbody class="theme-bg-primary divide-y divide-gray-200 dark:divide-gray-700">
          {#each sortedGroupedWorks as group}
            {@const typedGroup = group}
            {@const skillsRequiredLabel = getGroupedSkillsRequiredDisplay(typedGroup)}
            {@const allSelected = typedGroup.items.every((item: any) => selectedRows.has(String(item.id)))}
            {@const someSelected = typedGroup.items.some((item: any) => selectedRows.has(String(item.id)))}
            <!-- Single Row per Work -->
            <tr class="hover:theme-bg-secondary transition-colors">
              <td class="px-6 py-4 whitespace-nowrap text-sm font-medium theme-text-primary">
                <input 
                  type="checkbox" 
                  class="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  checked={allSelected}
                  disabled={!canEdit}
                  on:change={(e) => {
                    if (!canEdit) return;
                    e.stopPropagation();
                    const target = e.target as HTMLInputElement;
                    if (target?.checked) {
                      selectAllRowsInGroup(typedGroup);
                    } else {
                      // Uncheck all items in the group by toggling each one
                      typedGroup.items.forEach((item: any) => {
                        if (selectedRows.has(String(item.id))) {
                          toggleRowSelection(String(item.id));
                        }
                      });
                    }
                  }}
                />
              </td>
              {#if showDebugIds}
                <td class="px-6 py-4 text-sm theme-text-primary align-top">
                  <div class="flex flex-col gap-0.5">
                    {#each typedGroup.items as plannedWork}
                      <div class="text-xs font-mono tabular-nums" title="prdn_work_planning.id">
                        {plannedWork.id ?? '—'}
                      </div>
                    {/each}
                  </div>
                </td>
              {/if}
              <td class="px-6 py-4 whitespace-nowrap text-sm font-medium theme-text-primary text-left w-[100px] min-w-[100px] max-w-[100px]">{typedGroup.woNo}</td>
              <td class="px-6 py-4 whitespace-nowrap text-sm theme-text-primary text-left w-[100px] min-w-[100px] max-w-[100px]">{typedGroup.pwoNo}</td>
              <td class="px-6 py-4 whitespace-nowrap text-sm font-medium theme-text-primary text-left w-[120px] min-w-[120px] max-w-[120px]">{typedGroup.workCode}</td>
              <td class="px-6 py-4 text-sm theme-text-primary" style="max-width: 200px; word-wrap: break-word;">
                <div class="break-words">
                  <button
                    type="button"
                    class="cursor-pointer text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50 rounded"
                    title={getWorkNamePreview(typedGroup.workName || '').truncated ? typedGroup.workName : undefined}
                    aria-expanded={expandedWorkNames[`${typedGroup.workCode || 'unknown'}_${typedGroup.woDetailsId || typedGroup.items?.[0]?.wo_details_id || 'unknown'}`] || false}
                    on:click={() => toggleWorkName(`${typedGroup.workCode || 'unknown'}_${typedGroup.woDetailsId || typedGroup.items?.[0]?.wo_details_id || 'unknown'}`)}
                  >
                    {getWorkNamePreview(typedGroup.workName || '').preview}
                  </button>
                  {#if getWorkNamePreview(typedGroup.workName || '').truncated}
                    <div class="mt-1">
                      <button
                        type="button"
                        class="text-xs text-blue-700 dark:text-blue-300 hover:underline"
                        aria-expanded={expandedWorkNames[`${typedGroup.workCode || 'unknown'}_${typedGroup.woDetailsId || typedGroup.items?.[0]?.wo_details_id || 'unknown'}`] || false}
                        on:click={() => toggleWorkName(`${typedGroup.workCode || 'unknown'}_${typedGroup.woDetailsId || typedGroup.items?.[0]?.wo_details_id || 'unknown'}`)}
                      >
                        {expandedWorkNames[`${typedGroup.workCode || 'unknown'}_${typedGroup.woDetailsId || typedGroup.items?.[0]?.wo_details_id || 'unknown'}`] ? 'Hide full name' : 'Show full name'}
                      </button>
                    </div>
                  {/if}
                  {#if expandedWorkNames[`${typedGroup.workCode || 'unknown'}_${typedGroup.woDetailsId || typedGroup.items?.[0]?.wo_details_id || 'unknown'}`] && getWorkNamePreview(typedGroup.workName || '').truncated}
                    <div class="mt-2 rounded border theme-border theme-bg-secondary p-2 text-xs leading-relaxed break-words">
                      {typedGroup.workName}
                    </div>
                  {/if}
                </div>
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm theme-text-primary">
                <span
                  class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400"
                >
                  {skillsRequiredLabel}
                </span>
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm theme-text-primary">
                {#if typedGroup.items && typedGroup.items.length > 0}
                  {@const firstItem = typedGroup.items[0]}
                  {#if firstItem?.vehicleWorkFlow?.estimated_duration_minutes}
                    {formatTime(firstItem.vehicleWorkFlow.estimated_duration_minutes / 60)}
                  {:else if firstItem?.skillTimeStandard?.standard_time_minutes}
                    {formatTime(firstItem.skillTimeStandard.standard_time_minutes / 60)}
                  {:else}
                    N/A
                  {/if}
                {:else}
                  N/A
                {/if}
              </td>
              <td class="px-6 py-4 text-sm theme-text-primary">
                <div class="space-y-1">
                  {#each typedGroup.items as plannedWork}
                    <div class="font-medium whitespace-nowrap">{plannedWork.sc_required || plannedWork.hr_emp?.skill_short || 'N/A'}</div>
                  {/each}
                </div>
              </td>
              <td class="px-6 py-4 text-sm theme-text-primary">
                <div class="space-y-1">
                  {#each typedGroup.items as plannedWork}
                    {@const empName = plannedWork.hr_emp?.emp_name || 'N/A'}
                    {@const skillShort = plannedWork.hr_emp?.skill_short || 'N/A'}
                    <div class="font-medium whitespace-nowrap">{empName} ({skillShort})</div>
                  {/each}
                </div>
              </td>
              <td class="px-6 py-4 text-sm theme-text-primary w-[100px]">
                <div class="space-y-1">
                  {#each typedGroup.items as plannedWork}
                    <div class="whitespace-nowrap">{formatDateDdMmYy(plannedWork.from_date)}</div>
                  {/each}
                </div>
                  </td>
              <td class="px-6 py-4 text-sm theme-text-primary w-[90px]">
                <div class="space-y-1">
              {#each typedGroup.items as plannedWork}
                    <div class="whitespace-nowrap">{formatTimeWithoutSeconds(plannedWork.from_time)}</div>
                  {/each}
                </div>
                  </td>
              <td class="px-6 py-4 text-sm theme-text-primary w-[100px]">
                <div class="space-y-1">
                  {#each typedGroup.items as plannedWork}
                    <div class="whitespace-nowrap">{formatDateDdMmYy(plannedWork.to_date)}</div>
                  {/each}
                </div>
                  </td>
              <td class="px-6 py-4 text-sm theme-text-primary w-[90px]">
                <div class="space-y-1">
                  {#each typedGroup.items as plannedWork}
                    <div class="whitespace-nowrap">{formatTimeWithoutSeconds(plannedWork.to_time)}</div>
                  {/each}
                </div>
                  </td>
              <td class="px-6 py-4 text-sm theme-text-primary">
                <div class="space-y-1">
                  {#each typedGroup.items as plannedWork}
                    <div>
                      <div class="font-medium">
                        {#if plannedWork.from_time && plannedWork.to_time}
                          {@const calculatedHours = (() => {
                            try {
                              const from = new Date(`2000-01-01T${plannedWork.from_time}`);
                              const to = new Date(`2000-01-01T${plannedWork.to_time}`);
                              if (to < from) to.setDate(to.getDate() + 1);
                              const diffMs = to.getTime() - from.getTime();
                              const totalHours = diffMs / (1000 * 60 * 60);
                              const breakMinutes = calculateBreakTimeInRange(plannedWork.from_time, plannedWork.to_time, shiftBreakTimes);
                              const breakHours = breakMinutes / 60;
                              const plannedHours = totalHours - breakHours;
                              return Math.max(0, plannedHours);
                            } catch {
                              return 0;
                            }
                          })()}
                          {formatTime(calculatedHours)}
                        {:else if plannedWork.planned_hours}
                          {formatTime(plannedWork.planned_hours)}
                        {:else}
                          N/A
                        {/if}
                      </div>
                        </div>
                  {/each}
                    </div>
                  </td>
              <td class="px-6 py-4 text-sm theme-text-primary">
                <div class="space-y-1">
                  {#each typedGroup.items as plannedWork}
                      <div class="font-medium">
                        {plannedWork.time_worked_till_date ? formatTime(plannedWork.time_worked_till_date) : '0h 0m'}
                      </div>
                  {/each}
                    </div>
                  </td>
              <td class="px-6 py-4 text-sm theme-text-primary">
                <div class="space-y-1">
                  {#each typedGroup.items as plannedWork}
                      <div class="font-medium">
                        {plannedWork.remaining_time === null || plannedWork.remaining_time === undefined
                          ? 'N/A'
                          : formatTime(Number(plannedWork.remaining_time) || 0)}
                      </div>
                  {/each}
                    </div>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm theme-text-primary">
                    {#if canEdit}
                      <div class="flex space-x-2">
                    <Button 
                      variant="primary" 
                      size="sm" 
                      on:click={() => handleEditPlan(typedGroup)}
                    >
                      Edit
                    </Button>
                        <Button 
                          variant="danger" 
                          size="sm" 
                      on:click={() => handleDeleteAllPlansForWork(typedGroup)}
                        >
                          Delete
                        </Button>
                      </div>
                    {:else}
                      <span class="text-xs theme-text-secondary italic">Read-only</span>
                    {/if}
                  </td>
                </tr>
          {/each}
        </tbody>
      </table>
    </div>
    
    <!-- Summary -->
    <div class="px-6 py-4 theme-bg-secondary border-t theme-border">
      <div class="flex flex-wrap gap-4 text-sm">
        <div class="theme-text-secondary">
          <span class="font-medium">Total Draft Plans:</span> {totalPlans}
        </div>
        <div class="theme-text-secondary">
          <span class="font-medium">Total Planned Hours:</span> {formatTime(Object.values(filteredGroupedPlannedWorks).reduce((sum, group) => {
            // For each unique work, get the duration from the first item
            // Use vehicle work flow duration if available, otherwise calculate from time range
            if (group.items && group.items.length > 0) {
              const firstItem = group.items[0];
              
              // Try to get duration from vehicle work flow first
              if (firstItem?.vehicleWorkFlow?.estimated_duration_minutes) {
                return sum + (firstItem.vehicleWorkFlow.estimated_duration_minutes / 60);
              }
              
              // Otherwise, calculate from the first item's time range
              if (firstItem.from_time && firstItem.to_time) {
                const from = new Date(`2000-01-01T${firstItem.from_time}`);
                const to = new Date(`2000-01-01T${firstItem.to_time}`);
                if (to < from) to.setDate(to.getDate() + 1);
                const totalHours = (to.getTime() - from.getTime()) / (1000 * 60 * 60);
                const breakMinutes = calculateBreakTimeInRange(firstItem.from_time, firstItem.to_time, shiftBreakTimes);
                const breakHours = breakMinutes / 60;
                const plannedHours = totalHours - breakHours;
                return sum + Math.max(0, plannedHours);
              }
              
              // Fallback to planned_hours if available
              if (firstItem.planned_hours) {
                return sum + firstItem.planned_hours;
              }
            }
            return sum;
          }, 0))}
        </div>
      </div>
    </div>
  {/if}
</div>

<!-- Plan History Modal -->
<PlanHistoryModal 
  bind:isOpen={showHistoryModal}
  stageCode={stageCode}
  planningDate={selectedDate}
/>

{#if showIssuesModal}
  <button
    type="button"
    class="fixed inset-0 z-[9999] w-full h-full border-none bg-black bg-opacity-50 p-0"
    aria-label="Close issues modal"
    on:click={closeIssuesModal}
  ></button>
  <div class="fixed inset-0 z-[10000] flex items-center justify-center p-4">
    <div
      class="w-full max-w-3xl rounded-lg border-2 border-gray-300 theme-bg-primary shadow-xl dark:border-gray-600"
      role="dialog"
      aria-modal="true"
      aria-label="Draft plan issues"
      tabindex="-1"
    >
      <div class="border-b px-6 py-4 theme-border">
        <div class="flex items-center justify-between gap-3">
          <h3 class="text-lg font-semibold theme-text-primary">Draft Plan Issues</h3>
          <Button variant="secondary" size="sm" on:click={closeIssuesModal}>Close</Button>
        </div>
        <p class="mt-1 text-sm theme-text-secondary">
          Resolve all issues below before submitting plan.
        </p>
      </div>
      <div class="max-h-[60vh] overflow-y-auto px-6 py-4">
        <ol class="list-decimal space-y-2 pl-5">
          {#each blockingIssues as issue, index}
            <li class="text-sm {issue.type === 'error' ? 'text-red-700 dark:text-red-300' : 'text-amber-700 dark:text-amber-300'}">
              <span class="ml-1">{issue.type === 'error' ? 'Error:' : 'Warning:'} {issue.message}</span>
            </li>
          {/each}
        </ol>
      </div>
    </div>
  </div>
{/if}
