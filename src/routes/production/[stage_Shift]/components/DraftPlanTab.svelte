<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import Button from '$lib/components/common/Button.svelte';
  import { formatTime, calculateBreakTimeInRange } from '../utils/timeUtils';
  import { groupPlannedWorks } from '../utils/planTabUtils';
  import { filterGroupedWorksBySearch } from '../utils/productionTabSearchUtils';
  import PlanHistoryModal from './PlanHistoryModal.svelte';
  import { supabase } from '$lib/supabaseClient';

  export let draftPlanData: any[] = [];
  export let draftManpowerPlanData: any[] = []; // For external reference only (not used in this component yet)
  export let isLoading: boolean = false;
  
  // Reference draftManpowerPlanData to satisfy linter (for future use)
  $: void draftManpowerPlanData;
  export let stageCode: string = '';
  export let selectedDate: string = '';
  export let expandedGroups: string[] = []; // Kept for compatibility but no longer used
  export let selectedRows: Set<string> = new Set();
  export let shiftBreakTimes: Array<{ start_time: string; end_time: string }> = [];
  export let planningSubmissionStatus: any = null;

  const dispatch = createEventDispatcher();

  let showHistoryModal = false;
  let hasRejectedSubmission = false; // Track if there's a previous rejected submission
  let searchTerm = '';

  // Combine draft work plans and manpower plans (only work plans for now, as manpower plans have different structure)
  $: allDraftPlans = draftPlanData || [];
  $: groupedPlannedWorks = groupPlannedWorks(allDraftPlans);
  $: filteredGroupedPlannedWorks = filterGroupedWorksBySearch(groupedPlannedWorks, searchTerm);
  // Count unique works (by work code), not individual skill competencies
  $: totalPlans = Object.keys(filteredGroupedPlannedWorks).length;
  

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

  // Expanded groups functionality removed - kept for compatibility
  $: expandedGroupsSet = new Set(expandedGroups);

  $: selectedWorks = allDraftPlans.filter(work => selectedRows.has(work.id));

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
  $: isResubmitted = isPendingApproval && hasRejectedSubmission; // Resubmitted if pending and there's a previous rejected
  $: canSubmit = !hasSubmission || isRejected; // Can submit if no submission or if rejected
  $: shouldDisableSubmit = isLoading || totalPlans === 0 || isPendingApproval || isApproved;
  $: canEdit = !hasSubmission || isRejected; // Can edit if no submission or if rejected

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
    }
    return null;
  })();

  function handleShowHistory() {
    showHistoryModal = true;
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
  </div>
  
  <!-- Read-only notice -->
  {#if !canEdit}
    <div class="px-6 py-3 border-b theme-border theme-bg-secondary">
      <div class="flex items-center gap-2">
        <svg class="w-5 h-5 theme-text-primary" fill="currentColor" viewBox="0 0 20 20">
          <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd" />
        </svg>
        <p class="text-sm theme-text-primary">
          <strong>Read-only mode:</strong> This plan has been {isPendingApproval ? 'submitted for review' : isApproved ? 'approved' : ''}. You can view the plan but cannot make changes. {isRejected ? 'The plan was rejected - you can now make changes.' : ''}
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
            {selectedRows.size} skill competency{selectedRows.size === 1 ? '' : 'ies'} selected
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
            <th class="px-6 py-3 text-left text-xs font-medium theme-text-secondary uppercase tracking-wider">Select</th>
            <th class="px-6 py-3 text-left text-xs font-medium theme-text-secondary uppercase tracking-wider">Work Order</th>
            <th class="px-6 py-3 text-left text-xs font-medium theme-text-secondary uppercase tracking-wider">PWO Number</th>
            <th class="px-6 py-3 text-left text-xs font-medium theme-text-secondary uppercase tracking-wider">Work Code</th>
            <th class="px-6 py-3 text-left text-xs font-medium theme-text-secondary uppercase tracking-wider" style="max-width: 200px; width: 200px;">Work Name</th>
            <th class="px-6 py-3 text-left text-xs font-medium theme-text-secondary uppercase tracking-wider">Skills Required</th>
            <th class="px-6 py-3 text-left text-xs font-medium theme-text-secondary uppercase tracking-wider">Standard Time</th>
            <th class="px-6 py-3 text-left text-xs font-medium theme-text-secondary uppercase tracking-wider">Status</th>
            <th class="px-6 py-3 text-left text-xs font-medium theme-text-secondary uppercase tracking-wider">Worker (Skill)</th>
            <th class="px-6 py-3 text-left text-xs font-medium theme-text-secondary uppercase tracking-wider">From Time</th>
            <th class="px-6 py-3 text-left text-xs font-medium theme-text-secondary uppercase tracking-wider">To Time</th>
            <th class="px-6 py-3 text-left text-xs font-medium theme-text-secondary uppercase tracking-wider">Planned Hours</th>
            <th class="px-6 py-3 text-left text-xs font-medium theme-text-secondary uppercase tracking-wider">Time Worked Till Date</th>
            <th class="px-6 py-3 text-left text-xs font-medium theme-text-secondary uppercase tracking-wider">Remaining Time</th>
            <th class="px-6 py-3 text-left text-xs font-medium theme-text-secondary uppercase tracking-wider">Actions</th>
          </tr>
        </thead>
        <tbody class="theme-bg-primary divide-y divide-gray-200 dark:divide-gray-700">
          {#each Object.values(filteredGroupedPlannedWorks) as group}
            {@const typedGroup = group}
            {@const allSelected = typedGroup.items.every((item: any) => selectedRows.has(item.id))}
            {@const someSelected = typedGroup.items.some((item: any) => selectedRows.has(item.id))}
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
                        if (selectedRows.has(item.id)) {
                          toggleRowSelection(item.id);
                        }
                      });
                    }
                  }}
                />
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm font-medium theme-text-primary">{typedGroup.woNo}</td>
              <td class="px-6 py-4 whitespace-nowrap text-sm theme-text-primary">{typedGroup.pwoNo}</td>
              <td class="px-6 py-4 whitespace-nowrap text-sm font-medium theme-text-primary">{typedGroup.workCode}</td>
              <td class="px-6 py-4 text-sm theme-text-primary" style="max-width: 200px; word-wrap: break-word;">{typedGroup.workName}</td>
              <td class="px-6 py-4 whitespace-nowrap text-sm theme-text-primary">
                <div class="flex flex-wrap gap-1">
                  {#each typedGroup.items as plannedWork}
                  <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400">
                      {plannedWork.sc_required || 'N/A'}
                  </span>
                  {/each}
                </div>
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
              <td class="px-6 py-4 whitespace-nowrap text-sm">
                <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400">Draft</span>
              </td>
              <td class="px-6 py-4 text-sm theme-text-primary">
                <div class="space-y-1">
                  {#each typedGroup.items as plannedWork}
                    {@const empName = plannedWork.hr_emp?.emp_name || 'N/A'}
                    {@const skillShort = plannedWork.hr_emp?.skill_short || 'N/A'}
                    <div class="font-medium">{empName} ({skillShort})</div>
                  {/each}
                </div>
              </td>
              <td class="px-6 py-4 text-sm theme-text-primary">
                <div class="space-y-1">
              {#each typedGroup.items as plannedWork}
                    <div>{plannedWork.from_time || 'N/A'}</div>
                  {/each}
                </div>
                  </td>
              <td class="px-6 py-4 text-sm theme-text-primary">
                <div class="space-y-1">
                  {#each typedGroup.items as plannedWork}
                    <div>{plannedWork.to_time || 'N/A'}</div>
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
                        {plannedWork.remaining_time ? formatTime(plannedWork.remaining_time) : 'N/A'}
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
