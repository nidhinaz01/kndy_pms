<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import Button from '$lib/components/common/Button.svelte';
  import type { ProductionEmployee } from '$lib/api/production';
  import AttendanceModal from './AttendanceModal.svelte';
  import StageReassignmentModal from './StageReassignmentModal.svelte';
  import StageJourneyModal from './StageJourneyModal.svelte';
  import EmployeeWorksModal from './EmployeeWorksModal.svelte';
  import { filterEmployees, calculateTotals, isPlanningAttendanceLocked } from '$lib/utils/manpowerTableUtils';
  import type { ManpowerTableFilters, ManpowerTableState } from '$lib/types/manpowerTable';
  import { initialManpowerTableFilters, initialManpowerTableState } from '$lib/types/manpowerTable';
  import { sortTableData, handleSortClick, type SortConfig } from '$lib/utils/tableSorting';
  import ManpowerTableHeader from './manpower-table/ManpowerTableHeader.svelte';
  import ManpowerRowActionsLegend from './manpower-table/ManpowerRowActionsLegend.svelte';
  import ManpowerTableFiltersComponent from './manpower-table/ManpowerTableFilters.svelte';
  import ManpowerTableBody from './manpower-table/ManpowerTableBody.svelte';
  import ManpowerTableSummary from './manpower-table/ManpowerTableSummary.svelte';
  import BulkAttendanceModal from './manpower-table/BulkAttendanceModal.svelte';

  export let data: ProductionEmployee[] = [];
  export let isLoading: boolean = false;
  export let selectedDate: string = '';
  export let planningSubmissionStatus: any = null;
  export let shiftCode: string = ''; // Shift code for bulk operations
  export let stageCode: string = '';
  export let showInternalSearch: boolean = true;
  export let externalSearch: string | null = null;
  export let externalSelected: Set<string> | null = null;
  export let parentControlledSort: boolean = false;
  export let toggleFiltersSignal: number = 0;
  export let bulkAttendanceSignal: number = 0;
  export let exportSignal: number = 0;
  export let hideActions: boolean = false;
  export let hideHeader: boolean = false;
  export let hideSummary: boolean = false;
  /** When set (e.g. by parent with pagination), bulk attendance uses this list for selected IDs instead of data (current page) */
  export let allEmployeesForBulk: ProductionEmployee[] | null = null;

  const dispatch = createEventDispatcher();

  let filters: ManpowerTableFilters = { ...initialManpowerTableFilters };
  let state: ManpowerTableState = { ...initialManpowerTableState };
  let sortConfig: SortConfig = { column: 'emp_name', direction: 'asc' }; // Default sort by name

  $: filteredData = filterEmployees(data, filters);
  // Apply sorting
  $: sortedFilteredData = parentControlledSort
    ? filteredData
    : (sortConfig.column && sortConfig.direction ? sortTableData(filteredData, sortConfig) : filteredData);
  $: totals = calculateTotals(sortedFilteredData);
  $: selectedCount = externalSelected ? externalSelected.size : state.selectedEmployees.size;
  $: eligibleEmployeesCount = sortedFilteredData.filter(emp => !isPlanningAttendanceLocked(emp, planningSubmissionStatus)).length;
  $: allSelected = selectedCount > 0 && selectedCount === eligibleEmployeesCount;

  function handleSearchChange(value: string) {
    filters.search = value;
  }

  $: if (externalSearch !== null && externalSearch !== undefined) {
    // Keep internal filters.search in sync with parent-controlled external search box
    filters.search = externalSearch;
  }

  function handleFilterChange(field: keyof ManpowerTableFilters, value: any) {
    // Coerce boolean-like flags for advanced filters
    if (field === 'plannedExceedsShift' || field === 'reassignedToOther' || field === 'reassignedFromOther') {
      // value may be boolean or string
      filters[field] = (value === true || value === 'true');
    } else {
      filters[field] = value as any;
    }
  }

  function handleClearFilters() {
    filters = { ...initialManpowerTableFilters };
  }

  function handleSort(column: string) {
    sortConfig = handleSortClick(column, sortConfig);
  }

  function handleToggleFilters() {
    state.showFilters = !state.showFilters;
  }

  function handleExport() {
    dispatch('export');
  }

  function handleRefresh() {
    dispatch('refresh');
  }

  // react to external signals
  let _prevToggleFiltersSignal = toggleFiltersSignal;
  $: if (toggleFiltersSignal !== _prevToggleFiltersSignal) {
    _prevToggleFiltersSignal = toggleFiltersSignal;
    handleToggleFilters();
  }

  let _prevBulkAttendanceSignal = bulkAttendanceSignal;
  $: if (bulkAttendanceSignal !== _prevBulkAttendanceSignal) {
    _prevBulkAttendanceSignal = bulkAttendanceSignal;
    openBulkAttendanceModal();
  }

  let _prevExportSignal = exportSignal;
  $: if (exportSignal !== _prevExportSignal) {
    _prevExportSignal = exportSignal;
    handleExport();
  }

  function toggleEmployeeSelection(employee: ProductionEmployee) {
    if (externalSelected !== null) {
      const newSet = new Set(externalSelected);
      if (newSet.has(employee.emp_id)) newSet.delete(employee.emp_id);
      else newSet.add(employee.emp_id);
      dispatch('selectionChange', newSet);
    } else {
      if (state.selectedEmployees.has(employee.emp_id)) {
        state.selectedEmployees.delete(employee.emp_id);
      } else {
        state.selectedEmployees.add(employee.emp_id);
      }
      state.selectedEmployees = new Set(state.selectedEmployees);
      dispatch('selectionChange', new Set(state.selectedEmployees));
    }
  }

  function selectAllEmployees() {
    const eligibleEmployees = filteredData.filter(emp => !isPlanningAttendanceLocked(emp, planningSubmissionStatus));
    const ids = eligibleEmployees.map(emp => emp.emp_id);
    if (externalSelected !== null) {
      const newSet = new Set(externalSelected);
      ids.forEach(id => newSet.add(id));
      dispatch('selectionChange', newSet);
    } else {
      state.selectedEmployees = new Set(ids);
      dispatch('selectionChange', new Set(state.selectedEmployees));
    }
  }

  function clearSelection() {
    if (externalSelected !== null) {
      dispatch('selectionChange', new Set());
    } else {
      state.selectedEmployees = new Set();
      dispatch('selectionChange', new Set());
    }
  }

  function openBulkAttendanceModal() {
    const selectedSet = externalSelected !== null ? externalSelected : state.selectedEmployees;
    if (selectedSet.size === 0) {
      alert('Please select at least one employee to mark attendance.');
      return;
    }
    state.showBulkAttendanceModal = true;
    state.bulkAttendanceStatus = 'present';
    state.bulkNotes = '';
    state.bulkFromTime = '';
    state.bulkToTime = '';
    state.bulkPlannedHours = null;
    state.bulkCOffValue = 0;
    const dayStr = typeof selectedDate === 'string' ? selectedDate.split('T')[0] : '';
    state.bulkCOffFromDate = dayStr;
    state.bulkCOffFromTime = '';
    state.bulkCOffToDate = '';
    state.bulkCOffToTime = '';
  }

  async function handleBulkAttendanceSubmit() {
    const selectedSet = externalSelected !== null ? externalSelected : state.selectedEmployees;
    if (selectedSet.size === 0) {
      alert('No employees selected.');
      return;
    }

    // Validate notes if required for partial attendance
    if (state.bulkAttendanceStatus === 'present' && state.bulkPlannedHours !== null) {
      // Calculate full shift hours for validation
      let fullShiftHours = 8; // Default fallback
      if (shiftCode) {
        try {
          const { supabase } = await import('$lib/supabaseClient');
          const { calculateBreakTimeInMinutes } = await import('$lib/utils/breakTimeUtils');
          
          const { data: shiftData } = await supabase
            .from('hr_shift_master')
            .select('shift_id, start_time, end_time')
            .eq('shift_code', shiftCode)
            .eq('is_active', true)
            .eq('is_deleted', false)
            .maybeSingle();

          if (shiftData) {
            const shiftStartTime = shiftData.start_time;
            const shiftEndTime = shiftData.end_time;
            const shiftId = shiftData.shift_id;

            const { data: shiftBreaks } = await supabase
              .from('hr_shift_break_master')
              .select('start_time, end_time')
              .eq('shift_id', shiftId)
              .eq('is_active', true)
              .eq('is_deleted', false)
              .order('start_time', { ascending: true });

            const shiftStart = new Date(`2000-01-01T${shiftStartTime}`);
            let shiftEnd = new Date(`2000-01-01T${shiftEndTime}`);
            if (shiftEnd < shiftStart) {
              shiftEnd = new Date(`2000-01-02T${shiftEndTime}`);
            }
            const shiftDurationMinutes = (shiftEnd.getTime() - shiftStart.getTime()) / (1000 * 60);
            
            const totalBreakMinutes = calculateBreakTimeInMinutes(
              shiftStartTime,
              shiftEndTime,
              shiftBreaks || []
            );
            
            fullShiftHours = (shiftDurationMinutes - totalBreakMinutes) / 60;
          }
        } catch (error) {
          console.error('Error calculating full shift hours:', error);
        }
      }

      if (state.bulkPlannedHours < fullShiftHours) {
        if (!state.bulkNotes.trim()) {
          alert('Reason is required for partial attendance (hours less than full shift)');
          return;
        }
      }
    }
    state.isBulkSubmitting = true;

    // When parent provides full list (e.g. all pages) and controls selection, use it so "Select All" marks everyone
    const sourceList = (allEmployeesForBulk != null && externalSelected !== null) ? allEmployeesForBulk : sortedFilteredData;
    const employeesToMark = sourceList.filter(emp => selectedSet.has(emp.emp_id));

    const eventData: any = {
      employees: employeesToMark.map(emp => ({
        empId: emp.emp_id,
        stageCode: emp.current_stage
      })),
      date: selectedDate,
      status: state.bulkAttendanceStatus,
      shiftCode: shiftCode,
      notes: state.bulkNotes.trim() || undefined
    };

    // Add time/hours fields only for present employees
    if (state.bulkAttendanceStatus === 'present') {
      const bulkDay = typeof selectedDate === 'string' ? selectedDate.split('T')[0] : '';
      eventData.attendanceFromDate = bulkDay;
      eventData.attendanceToDate = bulkDay;
      eventData.plannedHours = state.bulkPlannedHours;
      eventData.fromTime = state.bulkFromTime;
      eventData.toTime = state.bulkToTime;
      eventData.cOffValue = state.bulkCOffValue;
      eventData.cOffFromDate = state.bulkCOffFromDate?.trim() || undefined;
      eventData.cOffFromTime = state.bulkCOffFromTime?.trim() || undefined;
      eventData.cOffToDate = state.bulkCOffToDate?.trim() || undefined;
      eventData.cOffToTime = state.bulkCOffToTime?.trim() || undefined;
    }
    
    dispatch('bulkAttendanceMarked', eventData);

    employeesToMark.forEach(emp => {
      emp.attendance_status = state.bulkAttendanceStatus;
    });

    if (externalSelected !== null) dispatch('selectionChange', new Set());
    else state.selectedEmployees = new Set();
    state.bulkAttendanceStatus = 'present';
    state.bulkNotes = '';
    state.bulkFromTime = '';
    state.bulkToTime = '';
    state.bulkPlannedHours = null;
    state.bulkCOffValue = 0;
    state.bulkCOffFromDate = '';
    state.bulkCOffFromTime = '';
    state.bulkCOffToDate = '';
    state.bulkCOffToTime = '';
    state.showBulkAttendanceModal = false;
    state.isBulkSubmitting = false;
  }

  function closeBulkAttendanceModal() {
    state.showBulkAttendanceModal = false;
    state.bulkAttendanceStatus = 'present';
    state.bulkNotes = '';
    state.bulkFromTime = '';
    state.bulkToTime = '';
    state.bulkPlannedHours = null;
    state.bulkCOffValue = 0;
    state.bulkCOffFromDate = '';
    state.bulkCOffFromTime = '';
    state.bulkCOffToDate = '';
    state.bulkCOffToTime = '';
  }

  function handleAttendanceToggle(employee: ProductionEmployee) {
    // Find the latest employee data from the table (in case it was refreshed)
    const latestEmployee = data.find(e => e.emp_id === employee.emp_id) || employee;
    state.selectedEmployee = { ...latestEmployee };
    state.showAttendanceModal = true;
  }

  function handleStageReassignment(employee: ProductionEmployee) {
    state.selectedEmployee = { ...employee };
    state.showReassignmentModal = true;
  }

  function handleViewJourney(employee: ProductionEmployee) {
    state.showWorksModal = false;
    state.selectedEmployee = { ...employee };
    state.showJourneyModal = true;
  }

  function handleViewWorks(employee: ProductionEmployee) {
    state.showJourneyModal = false;
    state.selectedEmployee = { ...employee };
    state.showWorksModal = true;
  }

  function handleJourneyDelete(event: CustomEvent) {
    dispatch('stageJourneyDelete', event.detail);
  }

  function handleAttendanceMarked(event: CustomEvent) {
    // Pass through ALL fields from the event, not just a subset
    const eventDetail = event.detail;
    const { empId, stageCode, date, status, notes, shiftCode, fromTime, toTime, plannedHours, actualHours } = eventDetail;
    
    const employee = data.find(emp => emp.emp_id === empId);
    if (employee) {
      employee.attendance_status = status;
    }
    
    // Pass through all fields including time/hours data
    dispatch('attendanceMarked', eventDetail);
    
    state.showAttendanceModal = false;
    state.selectedEmployee = null;
  }

  function handleStageReassigned(event: CustomEvent) {
    const { empId, fromStageCode, toStageCode, date, shiftCode, fromTime, toTime, reason } = event.detail;
    
    const employee = data.find(emp => emp.emp_id === empId);
    if (employee) {
      employee.current_stage = toStageCode;
    }
    
    dispatch('stageReassigned', { empId, fromStageCode, toStageCode, date, shiftCode, fromTime, toTime, reason });
    
    state.showReassignmentModal = false;
    state.selectedEmployee = null;
  }

  function handleJourneyModalClose() {
    state.showJourneyModal = false;
    state.selectedEmployee = null;
  }

  function handleWorksModalClose() {
    state.showWorksModal = false;
    state.selectedEmployee = null;
  }

  function closeAttendanceModal() {
    state.showAttendanceModal = false;
    state.selectedEmployee = null;
  }

  function closeReassignmentModal() {
    state.showReassignmentModal = false;
    state.selectedEmployee = null;
  }
</script>

<div class="theme-bg-primary rounded-lg shadow border theme-border">
  {#if !hideHeader}
    <div
      class="flex flex-wrap items-center justify-between gap-2 border-b theme-bg-primary p-3 shadow rounded-t-xl"
    >
      <div class="min-w-0 flex-1 basis-full sm:basis-auto">
        <ManpowerTableHeader
          {filters}
          showFilters={state.showFilters}
          {selectedCount}
          onSearchChange={handleSearchChange}
          onToggleFilters={handleToggleFilters}
          onExport={handleExport}
          onBulkAttendance={openBulkAttendanceModal}
          onSelectAll={selectAllEmployees}
          {allSelected}
          eligibleCount={eligibleEmployeesCount}
          hideSearch={!showInternalSearch}
          hideActions={hideActions}
        />
      </div>
      <div
        class="flex basis-full flex-wrap items-center justify-end gap-2 sm:ml-auto sm:basis-auto sm:gap-3"
      >
        <ManpowerRowActionsLegend />
        {#if !hideActions}
          <div class="border-l theme-border pl-2 sm:pl-3">
            <Button variant="secondary" size="sm" on:click={handleRefresh} disabled={isLoading}>
              {isLoading ? 'Loading...' : 'Refresh'}
            </Button>
          </div>
        {/if}
      </div>
    </div>
  {/if}

  {#if state.showFilters}
    <div class="p-3 border-b theme-border bg-gray-50 dark:bg-gray-800">
      <ManpowerTableFiltersComponent
        {filters}
        onFilterChange={handleFilterChange}
        onClearFilters={handleClearFilters}
      />
    </div>
  {/if}

  {#if !hideSummary}
    <div class="p-4 border-b theme-border theme-bg-secondary">
      <ManpowerTableSummary {totals} />
    </div>
  {/if}

  {#if isLoading}
    <div class="flex items-center justify-center py-12">
      <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      <span class="ml-3 theme-text-primary">Loading manpower data...</span>
    </div>
  {:else}
    <div class="overflow-x-auto">
      <table class="w-full">
        <ManpowerTableBody
          filteredData={sortedFilteredData}
          {data}
          selectedEmployees={externalSelected ? externalSelected : state.selectedEmployees}
          {sortConfig}
          onSort={handleSort}
          {planningSubmissionStatus}
          disableRowActions={selectedCount > 1}
          {stageCode}
          onToggleSelection={toggleEmployeeSelection}
          onAttendanceToggle={handleAttendanceToggle}
          onStageReassignment={handleStageReassignment}
          onViewJourney={handleViewJourney}
          onViewWorks={handleViewWorks}
          onSelectAll={selectAllEmployees}
          onClearAll={clearSelection}
          {allSelected}
          eligibleCount={eligibleEmployeesCount}
        />
      </table>
    </div>
  {/if}

  <AttendanceModal
    showModal={state.showAttendanceModal}
    employee={state.selectedEmployee}
    {selectedDate}
    isPlanningMode={true}
    on:attendanceMarked={handleAttendanceMarked}
    on:close={closeAttendanceModal}
  />

  <StageReassignmentModal
    showModal={state.showReassignmentModal}
    employee={state.selectedEmployee}
    {selectedDate}
    reassignmentMode="planning"
    on:stageReassigned={handleStageReassigned}
    on:close={closeReassignmentModal}
  />

  <StageJourneyModal
    showModal={state.showJourneyModal}
    employee={state.selectedEmployee}
    {selectedDate}
    mode="planning"
    parentStage={stageCode}
    disableDeleteButtons={planningSubmissionStatus?.status === 'pending_approval' || planningSubmissionStatus?.status === 'approved' || planningSubmissionStatus?.status === 'resubmitted'}
    on:close={handleJourneyModalClose}
    on:deleteJourney={handleJourneyDelete}
  />

  <EmployeeWorksModal
    showModal={state.showWorksModal}
    employee={state.selectedEmployee}
    {selectedDate}
    mode="planning"
    on:close={handleWorksModalClose}
  />

  <BulkAttendanceModal
    showModal={state.showBulkAttendanceModal}
    {selectedCount}
    {selectedDate}
    {shiftCode}
    bulkAttendanceStatus={state.bulkAttendanceStatus}
    bulkNotes={state.bulkNotes}
    bind:fromTime={state.bulkFromTime}
    bind:toTime={state.bulkToTime}
    bind:plannedHours={state.bulkPlannedHours}
    bind:bulkCOffValue={state.bulkCOffValue}
    bind:bulkCOffFromDate={state.bulkCOffFromDate}
    bind:bulkCOffFromTime={state.bulkCOffFromTime}
    bind:bulkCOffToDate={state.bulkCOffToDate}
    bind:bulkCOffToTime={state.bulkCOffToTime}
    isSubmitting={state.isBulkSubmitting}
    onStatusChange={(status) => state.bulkAttendanceStatus = status}
    onNotesChange={(notes) => state.bulkNotes = notes}
    onSubmit={handleBulkAttendanceSubmit}
    onClose={closeBulkAttendanceModal}
  />
</div>
