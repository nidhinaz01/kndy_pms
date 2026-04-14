<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import Button from '$lib/components/common/Button.svelte';
  import type { ProductionEmployee } from '$lib/api/production';
  import AttendanceModal from './AttendanceModal.svelte';
  import StageReassignmentModal from './StageReassignmentModal.svelte';
  import StageJourneyModal from './StageJourneyModal.svelte';
  import EmployeeWorksModal from './EmployeeWorksModal.svelte';
  import { filterEmployees, calculateTotals, isReportingAttendanceLocked } from '$lib/utils/manpowerTableUtils';
  import type { ManpowerTableFilters, ManpowerTableState } from '$lib/types/manpowerTable';
  import { initialManpowerTableFilters, initialManpowerTableState } from '$lib/types/manpowerTable';
  import { sortTableData, handleSortClick, type SortConfig } from '$lib/utils/tableSorting';
  import ManpowerTableHeader from './manpower-table/ManpowerTableHeader.svelte';
  import ManpowerRowActionsLegend from './manpower-table/ManpowerRowActionsLegend.svelte';
  import ManpowerTableFiltersComponent from './manpower-table/ManpowerTableFilters.svelte';
  import ManpowerReportTableBody from './manpower-report-table/ManpowerReportTableBody.svelte';
  import ManpowerReportTableSummary from './manpower-report-table/ManpowerReportTableSummary.svelte';
  import BulkAttendanceModal from './manpower-table/BulkAttendanceModal.svelte';

  export let data: ProductionEmployee[] = [];
  export let isLoading: boolean = false;
  export let selectedDate: string = '';
  export let reportingSubmissionStatus: any = null;
  export let shiftCode: string = ''; // Shift code for bulk operations
  export let stageCode: string = '';

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

  function handleFilterChange(field: keyof ManpowerTableFilters, value: any) {
    (filters as any)[field] = value;
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
    state.bulkFromTime = '';
    state.bulkToTime = '';
    state.bulkPlannedHours = null;
    state.bulkCOffValue = 0;
    const dayStr = typeof selectedDate === 'string' ? selectedDate.split('T')[0] : '';
    state.bulkCOffFromDate = dayStr;
    state.bulkCOffFromTime = '';
    state.bulkCOffToDate = '';
    state.bulkCOffToTime = '';
    state.bulkOtHours = 0;
    state.bulkOtFromDate = '';
    state.bulkOtFromTime = '';
    state.bulkOtToDate = '';
    state.bulkOtToTime = '';
  }

  function handleBulkAttendanceSubmit() {
    if (state.selectedEmployees.size === 0) {
      alert('No employees selected.');
      return;
    }

    // Validate notes if required for partial attendance
    if (state.bulkAttendanceStatus === 'present' && state.bulkPlannedHours !== null && state.bulkPlannedHours < 8) {
      if (!state.bulkNotes.trim()) {
        alert('Reason is required for partial attendance (hours less than full shift)');
        return;
      }
    }
    state.isBulkSubmitting = true;

    const employeesToMark = sortedFilteredData.filter(emp => state.selectedEmployees.has(emp.emp_id));
    
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
      eventData.actualHours = state.bulkPlannedHours; // Using plannedHours field for actualHours in reporting
      eventData.fromTime = state.bulkFromTime;
      eventData.toTime = state.bulkToTime;
      eventData.cOffValue = state.bulkCOffValue;
      eventData.cOffFromDate = state.bulkCOffFromDate?.trim() || undefined;
      eventData.cOffFromTime = state.bulkCOffFromTime?.trim() || undefined;
      eventData.cOffToDate = state.bulkCOffToDate?.trim() || undefined;
      eventData.cOffToTime = state.bulkCOffToTime?.trim() || undefined;
      const otNum = Number.isFinite(Number(state.bulkOtHours)) ? Math.max(0, Number(state.bulkOtHours)) : 0;
      eventData.otHours = otNum;
      if (otNum > 0) {
        eventData.otFromDate = state.bulkOtFromDate?.trim() || undefined;
        eventData.otFromTime = state.bulkOtFromTime?.trim() || undefined;
        eventData.otToDate = state.bulkOtToDate?.trim() || undefined;
        eventData.otToTime = state.bulkOtToTime?.trim() || undefined;
      }
    }
    
    dispatch('bulkAttendanceMarked', eventData);

    employeesToMark.forEach(emp => {
      emp.attendance_status = state.bulkAttendanceStatus;
    });

    state.selectedEmployees = new Set();
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
    state.bulkOtHours = 0;
    state.bulkOtFromDate = '';
    state.bulkOtFromTime = '';
    state.bulkOtToDate = '';
    state.bulkOtToTime = '';
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
    state.bulkOtHours = 0;
    state.bulkOtFromDate = '';
    state.bulkOtFromTime = '';
    state.bulkOtToDate = '';
    state.bulkOtToTime = '';
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
      />
    </div>
    <div
      class="flex basis-full flex-wrap items-center justify-end gap-2 sm:ml-auto sm:basis-auto sm:gap-3"
    >
      <ManpowerRowActionsLegend />
      <div class="border-l theme-border pl-2 sm:pl-3">
        <Button variant="secondary" size="sm" on:click={handleRefresh} disabled={isLoading}>
          {isLoading ? 'Loading...' : 'Refresh'}
        </Button>
      </div>
    </div>
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
    isPlanningMode={false}
    on:attendanceMarked={handleAttendanceMarked}
    on:close={closeAttendanceModal}
  />

  <StageReassignmentModal
    showModal={state.showReassignmentModal}
    employee={state.selectedEmployee}
    {selectedDate}
    reassignmentMode="reporting"
    on:stageReassigned={handleStageReassigned}
    on:close={closeReassignmentModal}
  />

  <StageJourneyModal
    showModal={state.showJourneyModal}
    employee={state.selectedEmployee}
    {selectedDate}
    mode="reporting"
    parentStage={stageCode}
    disableDeleteButtons={reportingSubmissionStatus?.status === 'pending_approval' || reportingSubmissionStatus?.status === 'approved' || reportingSubmissionStatus?.status === 'resubmitted'}
    on:close={handleJourneyModalClose}
    on:deleteJourney={handleJourneyDelete}
  />

  <EmployeeWorksModal
    showModal={state.showWorksModal}
    employee={state.selectedEmployee}
    {selectedDate}
    mode="reporting"
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
    bind:bulkOtHours={state.bulkOtHours}
    bind:bulkOtFromDate={state.bulkOtFromDate}
    bind:bulkOtFromTime={state.bulkOtFromTime}
    bind:bulkOtToDate={state.bulkOtToDate}
    bind:bulkOtToTime={state.bulkOtToTime}
    isSubmitting={state.isBulkSubmitting}
    onStatusChange={(status) => state.bulkAttendanceStatus = status}
    onNotesChange={(notes) => state.bulkNotes = notes}
    onSubmit={handleBulkAttendanceSubmit}
    onClose={closeBulkAttendanceModal}
  />
</div>

