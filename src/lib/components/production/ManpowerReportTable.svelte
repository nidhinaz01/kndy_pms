<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import Button from '$lib/components/common/Button.svelte';
  import type { ProductionEmployee } from '$lib/api/production';
  import AttendanceModal from './AttendanceModal.svelte';
  import StageReassignmentModal from './StageReassignmentModal.svelte';
  import StageJourneyModal from './StageJourneyModal.svelte';
  import { filterEmployees, calculateTotals, isReportingAttendanceLocked } from '$lib/utils/manpowerTableUtils';
  import type { ManpowerTableFilters, ManpowerTableState } from '$lib/types/manpowerTable';
  import { initialManpowerTableFilters, initialManpowerTableState } from '$lib/types/manpowerTable';
  import { sortTableData, handleSortClick, type SortConfig } from '$lib/utils/tableSorting';
  import ManpowerTableHeader from './manpower-table/ManpowerTableHeader.svelte';
  import ManpowerTableFiltersComponent from './manpower-table/ManpowerTableFilters.svelte';
  import ManpowerReportTableBody from './manpower-report-table/ManpowerReportTableBody.svelte';
  import ManpowerReportTableSummary from './manpower-report-table/ManpowerReportTableSummary.svelte';
  import BulkAttendanceModal from './manpower-table/BulkAttendanceModal.svelte';

  export let data: ProductionEmployee[] = [];
  export let isLoading: boolean = false;
  export let selectedDate: string = '';
  export let reportingSubmissionStatus: any = null;

  const dispatch = createEventDispatcher();

  let filters: ManpowerTableFilters = { ...initialManpowerTableFilters };
  let state: ManpowerTableState = { ...initialManpowerTableState };
  let sortConfig: SortConfig = { column: 'emp_name', direction: 'asc' }; // Default sort by name

  $: filteredData = filterEmployees(data, filters);
  // Apply sorting
  $: sortedFilteredData = sortConfig.column && sortConfig.direction 
    ? sortTableData(filteredData, sortConfig)
    : filteredData;
  $: totals = calculateTotals(sortedFilteredData);
  $: selectedCount = state.selectedEmployees.size;
  $: eligibleEmployeesCount = sortedFilteredData.filter(emp => !isReportingAttendanceLocked(emp, reportingSubmissionStatus)).length;
  $: allSelected = selectedCount > 0 && selectedCount === eligibleEmployeesCount;

  function handleSearchChange(value: string) {
    filters.search = value;
  }

  function handleFilterChange(field: keyof ManpowerTableFilters, value: string) {
    filters[field] = value;
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

  function toggleEmployeeSelection(employee: ProductionEmployee) {
    if (state.selectedEmployees.has(employee.emp_id)) {
      state.selectedEmployees.delete(employee.emp_id);
    } else {
      state.selectedEmployees.add(employee.emp_id);
    }
    state.selectedEmployees = new Set(state.selectedEmployees);
  }

  function selectAllEmployees() {
    // In report tab, allow selecting all employees (no restrictions based on planning)
    state.selectedEmployees = new Set(sortedFilteredData.map(emp => emp.emp_id));
  }

  function clearSelection() {
    state.selectedEmployees = new Set();
  }

  function openBulkAttendanceModal() {
    if (state.selectedEmployees.size === 0) {
      alert('Please select at least one employee to mark attendance.');
      return;
    }
    state.showBulkAttendanceModal = true;
    state.bulkAttendanceStatus = 'present';
    state.bulkNotes = '';
  }

  function handleBulkAttendanceSubmit() {
    if (state.selectedEmployees.size === 0) {
      alert('No employees selected.');
      return;
    }

    state.isBulkSubmitting = true;

    const employeesToMark = sortedFilteredData.filter(emp => state.selectedEmployees.has(emp.emp_id));
    
    dispatch('bulkAttendanceMarked', {
      employees: employeesToMark.map(emp => ({
        empId: emp.emp_id,
        stageCode: emp.current_stage
      })),
      date: selectedDate,
      status: state.bulkAttendanceStatus,
      notes: state.bulkNotes.trim() || undefined
    });

    employeesToMark.forEach(emp => {
      emp.attendance_status = state.bulkAttendanceStatus;
    });

    state.selectedEmployees = new Set();
    state.bulkAttendanceStatus = 'present';
    state.bulkNotes = '';
    state.showBulkAttendanceModal = false;
    state.isBulkSubmitting = false;
  }

  function closeBulkAttendanceModal() {
    state.showBulkAttendanceModal = false;
    state.bulkAttendanceStatus = 'present';
    state.bulkNotes = '';
  }

  function handleAttendanceToggle(employee: ProductionEmployee) {
    state.selectedEmployee = { ...employee };
    state.showAttendanceModal = true;
  }

  function handleStageReassignment(employee: ProductionEmployee) {
    state.selectedEmployee = { ...employee };
    state.showReassignmentModal = true;
  }

  function handleViewJourney(employee: ProductionEmployee) {
    state.selectedEmployee = { ...employee };
    state.showJourneyModal = true;
  }

  function handleAttendanceMarked(event: CustomEvent) {
    const { empId, stageCode, date, status, notes } = event.detail;
    
    const employee = data.find(emp => emp.emp_id === empId);
    if (employee) {
      employee.attendance_status = status;
    }
    
    dispatch('attendanceMarked', { empId, stageCode, date, status, notes });
    
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
  <div class="flex items-center justify-between space-x-2 p-3 border-b theme-bg-primary rounded-t-xl shadow">
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
    />
    <Button variant="secondary" size="sm" on:click={handleRefresh} disabled={isLoading}>
      {isLoading ? 'Loading...' : 'Refresh'}
    </Button>
  </div>

  {#if state.showFilters}
    <div class="p-3 border-b theme-border bg-gray-50 dark:bg-gray-800">
      <ManpowerTableFiltersComponent
        {filters}
        onFilterChange={handleFilterChange}
        onClearFilters={handleClearFilters}
      />
    </div>
  {/if}

  <div class="p-4 border-b theme-border theme-bg-secondary">
    <ManpowerReportTableSummary {totals} />
  </div>

  {#if isLoading}
    <div class="flex items-center justify-center py-12">
      <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      <span class="ml-3 theme-text-primary">Loading manpower data...</span>
    </div>
  {:else}
    <div class="overflow-x-auto">
      <table class="w-full">
        <ManpowerReportTableBody
          filteredData={sortedFilteredData}
          {data}
          selectedEmployees={state.selectedEmployees}
          {sortConfig}
          onSort={handleSort}
          {reportingSubmissionStatus}
          onToggleSelection={toggleEmployeeSelection}
          onAttendanceToggle={handleAttendanceToggle}
          onStageReassignment={handleStageReassignment}
          onViewJourney={handleViewJourney}
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
    on:attendanceMarked={handleAttendanceMarked}
    on:close={closeAttendanceModal}
  />

  <StageReassignmentModal
    showModal={state.showReassignmentModal}
    employee={state.selectedEmployee}
    {selectedDate}
    on:stageReassigned={handleStageReassigned}
    on:close={closeReassignmentModal}
  />

  <StageJourneyModal
    showModal={state.showJourneyModal}
    employee={state.selectedEmployee}
    {selectedDate}
    on:close={handleJourneyModalClose}
  />

  <BulkAttendanceModal
    showModal={state.showBulkAttendanceModal}
    {selectedCount}
    {selectedDate}
    bulkAttendanceStatus={state.bulkAttendanceStatus}
    bulkNotes={state.bulkNotes}
    isSubmitting={state.isBulkSubmitting}
    onStatusChange={(status) => state.bulkAttendanceStatus = status}
    onNotesChange={(notes) => state.bulkNotes = notes}
    onSubmit={handleBulkAttendanceSubmit}
    onClose={closeBulkAttendanceModal}
  />
</div>

