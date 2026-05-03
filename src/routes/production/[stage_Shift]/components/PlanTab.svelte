<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import Button from '$lib/components/common/Button.svelte';
  import SortableHeader from '$lib/components/common/SortableHeader.svelte';
  import { formatTime, calculateBreakTimeInRange } from '../utils/timeUtils';
  import { groupPlannedWorks, areAllSkillsReported, hasReportedSkillsSelected } from '../utils/planTabUtils';
  import { filterGroupedWorksBySearch } from '../utils/productionTabSearchUtils';
  import { sortTableData, handleSortClick, type SortConfig } from '$lib/utils/tableSorting';
  import { getWorkDisplayCode } from '$lib/utils/workDisplayUtils';

  export let plannedWorksData: any[] = [];
  export let plannedWorksWithStatus: any[] = [];
  export let isLoading: boolean = false;
  export let stageCode: string = '';
  export let selectedDate: string = '';
  export let selectedRows: Set<string> = new Set();
  export let shiftBreakTimes: Array<{ start_time: string; end_time: string }> = [];
  export let replanBusyKey: string | null = null;
  
  // Keep expandedGroups for compatibility but it's no longer used
  export let expandedGroups: string[] = [];
  $: void expandedGroups; // Reference to satisfy linter

  const dispatch = createEventDispatcher();

  // Search state
  let searchTerm = '';
  const WORK_NAME_PREVIEW_LENGTH = 30;
  let expandedWorkNames: Record<string, boolean> = {};
  let sortConfig: SortConfig = { column: null, direction: null };
  /** When true, show `prdn_work_planning.id` column for debugging (default off). */
  let showDebugIds = false;

  $: groupedPlannedWorks = groupPlannedWorks(plannedWorksWithStatus || []);
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
      sortable_timeWorkedTillDate: (() => {
        const items = group.items || [];
        const tills = items.map((i: any) => Number(i?.time_worked_till_date) || 0);
        return tills.length ? Math.max(...tills) : 0;
      })(),
      sortable_remainingTime: (group.items || []).reduce(
        (s: number, i: any) => s + (Number(i?.remaining_time) || 0),
        0
      )
    }));
    
    return sortTableData(enriched, sortConfig);
  })();
  
  // Count unique works (by work code), not individual skill competencies
  $: totalPlans = sortedGroupedWorks.length;

  function handleSort(column: string) {
    sortConfig = handleSortClick(column, sortConfig);
  }

  function handleRefresh() {
    dispatch('refresh');
  }

  function handleGenerateExcel() {
    dispatch('generateExcel');
  }

  function handleGeneratePDF() {
    dispatch('generatePDF');
  }

  function handleMultiReport() {
    dispatch('multiReport');
  }

  function handleReportWork(group: any) {
    // Report all skill competencies for this work together
    const allWorksInGroup = group.items || [];
    if (allWorksInGroup.length === 0) {
      alert('No works to report');
      return;
    }
    dispatch('reportWork', { works: allWorksInGroup, group });
  }

  function handleCancelWork(group: any) {
    // Cancel all skill competencies for this work
    const allWorksInGroup = group.items || [];
    if (allWorksInGroup.length === 0) {
      alert('No works to cancel');
      return;
    }
    dispatch('cancelWork', { works: allWorksInGroup, group });
  }

  function handleAddTrainees(group: any) {
    dispatch('addTrainees', { group });
  }

  function handleReplan(group: any) {
    dispatch('replanWork', { group });
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

  $: selectedWorks = plannedWorksWithStatus.filter(work => selectedRows.has(work.id));
  $: workCodes = [...new Set(selectedWorks.map(work => 
    getWorkDisplayCode(work)
  ))];
  $: workCode = workCodes.length === 1 ? workCodes[0] : null;
  $: allReported = workCode ? areAllSkillsReported(workCode, plannedWorksWithStatus) : false;
  $: hasReported = hasReportedSkillsSelected(selectedRows, plannedWorksWithStatus);

  function getWorkNamePreview(name: string): { preview: string; truncated: boolean } {
    const full = (name || '').trim();
    if (full.length <= WORK_NAME_PREVIEW_LENGTH) return { preview: full || 'N/A', truncated: false };
    return { preview: `${full.slice(0, WORK_NAME_PREVIEW_LENGTH)}...`, truncated: true };
  }

  function toggleWorkName(key: string) {
    expandedWorkNames = { ...expandedWorkNames, [key]: !expandedWorkNames[key] };
  }

  /** `std_work_skill_mapping` from Supabase may be object or single-element array. */
  function stdMappingScName(item: any): string | null {
    const mapping = item?.std_work_skill_mapping;
    if (!mapping) return null;
    const row = Array.isArray(mapping) ? mapping[0] : mapping;
    const name = row?.sc_name;
    if (name == null || String(name).trim() === '') return null;
    return String(name).trim();
  }

  /**
   * Per grouped work row:
   * non-standard -> prdn_work_additions.other_work_sc (via workAdditionData)
   * standard -> first row with wsm_id uses std_work_skill_mapping.sc_name
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

  /** Grouped row standard-time label: DB `std_time_hours` first, then VWF, then skill. */
  function planTabStandardTimeCell(firstItem: any): string {
    if (!firstItem) return 'N/A';
    const raw = firstItem.std_time_hours;
    if (raw != null && raw !== '' && Number.isFinite(Number(raw))) {
      return formatTime(Number(raw));
    }
    const vwf = firstItem?.vehicleWorkFlow?.estimated_duration_minutes;
    if (typeof vwf === 'number' && Number.isFinite(vwf) && vwf > 0) {
      return formatTime(vwf / 60);
    }
    const skill = firstItem?.skillTimeStandard?.standard_time_minutes;
    if (typeof skill === 'number' && Number.isFinite(skill) && skill > 0) {
      return formatTime(skill / 60);
    }
    return 'N/A';
  }

  /** Per planning row: hours for footer total — `std_time_hours`, VWF, slot minus breaks, `planned_hours`, skill. */
  function planRowPlannedHoursForFooter(item: any): number {
    if (!item) return 0;
    const raw = item.std_time_hours;
    if (raw != null && raw !== '' && Number.isFinite(Number(raw))) {
      return Math.max(0, Number(raw));
    }
    const vwfMin = item?.vehicleWorkFlow?.estimated_duration_minutes;
    if (typeof vwfMin === 'number' && Number.isFinite(vwfMin) && vwfMin > 0) {
      return vwfMin / 60;
    }
    if (item.from_time && item.to_time) {
      try {
        const from = new Date(`2000-01-01T${item.from_time}`);
        const to = new Date(`2000-01-01T${item.to_time}`);
        if (to < from) to.setDate(to.getDate() + 1);
        const totalHours = (to.getTime() - from.getTime()) / (1000 * 60 * 60);
        const breakMinutes = calculateBreakTimeInRange(item.from_time, item.to_time, shiftBreakTimes);
        return Math.max(0, totalHours - breakMinutes / 60);
      } catch {
        /* fall through */
      }
    }
    if (item.planned_hours != null && item.planned_hours !== '' && Number.isFinite(Number(item.planned_hours))) {
      return Math.max(0, Number(item.planned_hours));
    }
    const skill = item?.skillTimeStandard?.standard_time_minutes;
    if (typeof skill === 'number' && Number.isFinite(skill) && skill > 0) {
      return skill / 60;
    }
    return 0;
  }
</script>

<div class="theme-bg-primary rounded-lg shadow border theme-border">
  <div class="p-6 border-b theme-border">
    <div class="flex items-center justify-between mb-4">
      <div>
        <h2 class="text-xl font-semibold theme-text-primary">📋 Work Planning</h2>
        <p class="theme-text-secondary mt-1">
          Planned works for {stageCode} stage on {new Date(selectedDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' })}
        </p>
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
        <Button variant="primary" size="sm" on:click={handleGenerateExcel} disabled={plannedWorksWithStatus.length === 0}>
          Generate Excel
        </Button>
        <Button variant="primary" size="sm" on:click={handleGeneratePDF} disabled={plannedWorksWithStatus.length === 0}>
          Generate PDF
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
  
  {#if isLoading}
    <div class="flex items-center justify-center py-12">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mr-3"></div>
      <span class="theme-text-secondary">Loading planned works...</span>
    </div>
  {:else if plannedWorksData.length === 0}
    <div class="text-center py-12">
      <div class="text-6xl mb-4">📋</div>
      <p class="theme-text-secondary text-lg">No planned works for this date</p>
      <p class="theme-text-secondary text-sm mt-2">
        Go to the Works tab to plan works for this date
      </p>
    </div>
  {:else}
    <!-- Multi-report controls -->
    {#if selectedRows.size > 0}
      <div class="px-6 py-3 border-b theme-border bg-blue-50 dark:bg-blue-900/20">
        <div class="flex items-center justify-between">
          <div class="flex items-center space-x-4">
            <span class="text-sm theme-text-primary">
              {selectedRows.size} skill {selectedRows.size === 1 ? 'competency' : 'competencies'} selected
            </span>
            <Button 
              variant="primary" 
              size="sm" 
              on:click={handleMultiReport}
              disabled={allReported || hasReported}
            >
              Report Selected Skills ({selectedRows.size})
            </Button>
            {#if allReported}
              <span class="text-xs text-orange-600 dark:text-orange-400">
                All skill competencies for this work have been reported
              </span>
            {:else if hasReported}
              <span class="text-xs text-orange-600 dark:text-orange-400">
                Some selected skills are already reported
              </span>
            {/if}
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
    
    <div class="overflow-x-auto">
      <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700" style="table-layout: auto; word-wrap: break-word;">
        <thead class="theme-bg-secondary">
          <tr>
            <th class="px-6 py-3 text-left text-xs font-medium theme-text-secondary uppercase tracking-wider">Select</th>
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
            <SortableHeader column="sortable_workName" {sortConfig} onSort={handleSort} label="Work Name" headerClass="w-[200px] min-w-[200px] max-w-[200px]" />
            <th class="px-6 py-3 text-left text-xs font-medium theme-text-secondary uppercase tracking-wider">Skills Required</th>
            <th class="px-6 py-3 text-left text-xs font-medium theme-text-secondary uppercase tracking-wider">Standard Time</th>
            <th class="px-6 py-3 text-left text-xs font-medium theme-text-secondary uppercase tracking-wider">Status</th>
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
            {@const allSelected = typedGroup.items.every((item: any) => selectedRows.has(item.id))}
            {@const someSelected = typedGroup.items.some((item: any) => selectedRows.has(item.id))}
            {@const isCancelled = typedGroup.items.some((item: any) => item.status === 'cancelled' || item.isCancelled)}
            {@const hasReported = typedGroup.items.some((item: any) => item.workLifecycleStatus && item.workLifecycleStatus !== 'Planned' && item.workLifecycleStatus !== undefined)}
            {@const groupKey = `${typedGroup.workCode || 'unknown'}_${typedGroup.woDetailsId || typedGroup.items?.[0]?.wo_details_id || 'unknown'}`}
            {@const isReplanBusy = replanBusyKey === groupKey}
            <!-- Single Row per Work -->
            <tr class="hover:theme-bg-secondary transition-colors">
              <td class="px-6 py-4 whitespace-nowrap text-sm font-medium theme-text-primary">
                <input 
                  type="checkbox" 
                  class="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  checked={allSelected}
                  on:change={(e) => {
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
              <td class="px-6 py-4 text-sm theme-text-primary w-[200px] min-w-[200px] max-w-[200px]" style="word-wrap: break-word;">
                <div class="break-words">
                  <button
                    type="button"
                    class="cursor-pointer text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50 rounded"
                    title={getWorkNamePreview(typedGroup.workName || '').truncated ? typedGroup.workName : undefined}
                    aria-expanded={expandedWorkNames[groupKey] || false}
                    on:click={() => toggleWorkName(groupKey)}
                  >
                    {getWorkNamePreview(typedGroup.workName || '').preview}
                  </button>
                  {#if getWorkNamePreview(typedGroup.workName || '').truncated}
                    <div class="mt-1">
                      <button
                        type="button"
                        class="text-xs text-blue-700 dark:text-blue-300 hover:underline"
                        aria-expanded={expandedWorkNames[groupKey] || false}
                        on:click={() => toggleWorkName(groupKey)}
                      >
                        {expandedWorkNames[groupKey] ? 'Hide full name' : 'Show full name'}
                      </button>
                    </div>
                  {/if}
                  {#if expandedWorkNames[groupKey] && getWorkNamePreview(typedGroup.workName || '').truncated}
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
                  {planTabStandardTimeCell(typedGroup.items[0])}
                {:else}
                  N/A
                {/if}
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm">
                {#if typedGroup.items && typedGroup.items.length > 0}
                  {@const isCancelled = typedGroup.items.some((item: any) => item.status === 'cancelled' || item.isCancelled)}
                  {@const allReported = typedGroup.items.every((item: any) => item.workLifecycleStatus && item.workLifecycleStatus !== 'Planned')}
                  {@const anyReported = typedGroup.items.some((item: any) => item.workLifecycleStatus && item.workLifecycleStatus !== 'Planned')}
                  {#if isCancelled}
                    <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400">Cancelled</span>
                  {:else if allReported}
                    <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400">Reported</span>
                  {:else if anyReported}
                    <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400">Partially Reported</span>
                  {:else}
                    <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400">Planned</span>
                  {/if}
                {:else}
                  <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400">Planned</span>
                {/if}
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
                  {/each}
                    </div>
                  </td>
              <td class="px-6 py-4 text-sm theme-text-primary">
                <div class="space-y-1">
                  {#each typedGroup.items as plannedWork}
                      <div class="font-medium">
                        {formatTime(Number(plannedWork.time_worked_till_date) || 0)}
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
                    <div class="flex space-x-2">
                      <Button 
                        variant="primary" 
                        size="sm" 
                        disabled={isCancelled || hasReported || isReplanBusy}
                        on:click={() => handleReportWork(typedGroup)}
                      >
                        Report
                      </Button>
                  <Button 
                    variant="danger" 
                    size="sm" 
                    disabled={isCancelled || hasReported || isReplanBusy}
                    on:click={() => handleCancelWork(typedGroup)}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={isCancelled || hasReported || isReplanBusy}
                    on:click={() => handleReplan(typedGroup)}
                  >
                    {isReplanBusy ? 'Replanning...' : 'Replan'}
                  </Button>
                    </div>
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
          <span class="font-medium">Total Planned Works:</span> {totalPlans}
        </div>
        <div class="theme-text-secondary">
          <span class="font-medium">Total Planned Hours:</span> {formatTime(
            plannedWorksWithStatus.reduce((sum, work) => sum + planRowPlannedHoursForFooter(work), 0)
          )}
        </div>
        <div class="theme-text-secondary">
          <span class="font-medium">Total Time Worked:</span> {formatTime(plannedWorksWithStatus.reduce((sum, work) => sum + (work.time_worked_till_date || 0), 0))}
        </div>
        <div class="theme-text-secondary">
          <span class="font-medium">Total Remaining:</span> {formatTime(plannedWorksWithStatus.reduce((sum, work) => sum + (work.remaining_time || 0), 0))}
        </div>
        <div class="theme-text-secondary">
          <span class="font-medium">Planned:</span> {plannedWorksWithStatus.filter(work => work.workLifecycleStatus === 'Planned').length}
        </div>
        <div class="theme-text-secondary">
          <span class="font-medium">In Progress:</span> {plannedWorksWithStatus.filter(work => work.workLifecycleStatus === 'In progress').length}
        </div>
        <div class="theme-text-secondary">
          <span class="font-medium">Completed:</span> {plannedWorksWithStatus.filter(work => work.workLifecycleStatus === 'Completed').length}
        </div>
        <div class="theme-text-secondary">
          <span class="font-medium">To Redo:</span> {plannedWorksData.filter(work => work.status === 'to_redo').length}
        </div>
        <div class="theme-text-secondary">
          <span class="font-medium">Approved:</span> {plannedWorksData.filter(work => work.status === 'approved').length}
        </div>
      </div>
    </div>
  {/if}
</div>

