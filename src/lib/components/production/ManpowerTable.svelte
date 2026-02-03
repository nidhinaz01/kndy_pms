<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import Button from '$lib/components/common/Button.svelte';
  import type { ProductionEmployee } from '$lib/api/production';
  import AttendanceModal from './AttendanceModal.svelte';
  import StageReassignmentModal from './StageReassignmentModal.svelte';
  import StageJourneyModal from './StageJourneyModal.svelte';
  import { filterEmployees, calculateTotals, isPlanningAttendanceLocked } from '$lib/utils/manpowerTableUtils';
  import type { ManpowerTableFilters, ManpowerTableState } from '$lib/types/manpowerTable';
  import { initialManpowerTableFilters, initialManpowerTableState } from '$lib/types/manpowerTable';
  import { sortTableData, handleSortClick, type SortConfig } from '$lib/utils/tableSorting';
  import ManpowerTableHeader from './manpower-table/ManpowerTableHeader.svelte';
  import ManpowerTableFiltersComponent from './manpower-table/ManpowerTableFilters.svelte';
  import ManpowerTableBody from './manpower-table/ManpowerTableBody.svelte';
  import ManpowerTableSummary from './manpower-table/ManpowerTableSummary.svelte';
  import BulkAttendanceModal from './manpower-table/BulkAttendanceModal.svelte';

  export let data: ProductionEmployee[] = [];
  export let isLoading: boolean = false;
  export let selectedDate: string = '';
  export let planningSubmissionStatus: any = null;
  export let shiftCode: string = ''; // Shift code for bulk operations

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
  $: eligibleEmployeesCount = sortedFilteredData.filter(emp => !isPlanningAttendanceLocked(emp, planningSubmissionStatus)).length;
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
    const eligibleEmployees = filteredData.filter(emp => !isPlanningAttendanceLocked(emp, planningSubmissionStatus));
    state.selectedEmployees = new Set(eligibleEmployees.map(emp => emp.emp_id));
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
  }

  async function handleBulkAttendanceSubmit() {
    if (state.selectedEmployees.size === 0) {
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
      eventData.plannedHours = state.bulkPlannedHours;
      eventData.fromTime = state.bulkFromTime;
      eventData.toTime = state.bulkToTime;
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
    state.selectedEmployee = { ...employee };
    state.showJourneyModal = true;
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
    <ManpowerTableSummary {totals} />
  </div>

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
          selectedEmployees={state.selectedEmployees}
          {sortConfig}
          onSort={handleSort}
          {planningSubmissionStatus}
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
    isPlanningMode={true}
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
    {shiftCode}
    bulkAttendanceStatus={state.bulkAttendanceStatus}
    bulkNotes={state.bulkNotes}
    bind:fromTime={state.bulkFromTime}
    bind:toTime={state.bulkToTime}
    bind:plannedHours={state.bulkPlannedHours}
    isSubmitting={state.isBulkSubmitting}
    onStatusChange={(status) => state.bulkAttendanceStatus = status}
    onNotesChange={(notes) => state.bulkNotes = notes}
    onSubmit={handleBulkAttendanceSubmit}
    onClose={closeBulkAttendanceModal}
  />
</div>
