<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import Button from '$lib/components/common/Button.svelte';
  import { CheckCircle, XCircle, Clock, AlertTriangle, UserCheck, ArrowRight, Map, Users, CheckSquare } from 'lucide-svelte';
  import type { ProductionEmployee } from '$lib/api/production';
  import AttendanceModal from './AttendanceModal.svelte';
  import StageReassignmentModal from './StageReassignmentModal.svelte';
  import StageJourneyModal from './StageJourneyModal.svelte';

  export let data: ProductionEmployee[] = [];
  export let isLoading: boolean = false;
  export let selectedDate: string = '';

  const dispatch = createEventDispatcher();

  // State
  let search = '';
  let showFilters = false;
  let selectedStatus = '';
  
  // Modal state
  let showAttendanceModal = false;
  let showReassignmentModal = false;
  let showJourneyModal = false;
  let selectedEmployee: ProductionEmployee | null = null;

  // Bulk attendance state
  let selectedEmployees: Set<string> = new Set();
  let showBulkAttendanceModal = false;
  let bulkAttendanceStatus: 'present' | 'absent' = 'present';
  let bulkNotes: string = '';
  let isBulkSubmitting = false;

  // Computed filtered data
  $: filteredData = data.filter(employee => {
    const matchesSearch = !search || 
      employee.emp_id.toLowerCase().includes(search.toLowerCase()) ||
      employee.emp_name.toLowerCase().includes(search.toLowerCase()) ||
      employee.skill_short.toLowerCase().includes(search.toLowerCase()) ||
      employee.shift_code.toLowerCase().includes(search.toLowerCase());
    
    const matchesStatus = !selectedStatus || 
      (selectedStatus === 'present' && employee.hours_reported && employee.hours_reported > 0) ||
      (selectedStatus === 'absent' && (!employee.hours_reported || employee.hours_reported === 0)) ||
      (selectedStatus === 'overtime' && employee.ot_hours && employee.ot_hours > 0) ||
      (selectedStatus === 'undertime' && employee.lt_hours && employee.lt_hours > 0);

    return matchesSearch && matchesStatus;
  });

  // Calculate totals
  $: totalEmployees = filteredData.length;
  $: totalPlannedHours = filteredData.reduce((sum, emp) => sum + (emp.hours_planned || 0), 0);
  $: totalReportedHours = filteredData.reduce((sum, emp) => sum + (emp.hours_reported || 0), 0);
  $: totalOTHours = filteredData.reduce((sum, emp) => sum + (emp.ot_hours || 0), 0);
  $: totalLTHours = filteredData.reduce((sum, emp) => sum + (emp.lt_hours || 0), 0);
  $: totalToOtherStageHours = filteredData.reduce((sum, emp) => sum + (emp.to_other_stage_hours || 0), 0);
  $: totalFromOtherStageHours = filteredData.reduce((sum, emp) => sum + (emp.from_other_stage_hours || 0), 0);

  // Check if attendance should be locked for an employee
  function isAttendanceLocked(employee: ProductionEmployee): boolean {
    // Lock if employee has been reassigned (has stage journey)
    const hasReassignments = !!(employee.stage_journey && employee.stage_journey.length > 0);
    
    // Lock if employee has work recorded (has reported hours)
    const hasWorkRecorded = !!(employee.hours_reported && employee.hours_reported > 0);
    
    return hasReassignments || hasWorkRecorded;
  }

  function handleAttendanceToggle(employee: ProductionEmployee) {
    console.log('Attendance button clicked for:', employee);
    console.log('Employee type:', typeof employee);
    console.log('Employee keys:', Object.keys(employee || {}));
    selectedEmployee = { ...employee }; // Create a copy to ensure reactivity
    showAttendanceModal = true;
    console.log('Modal state:', { showAttendanceModal, selectedEmployee });
  }

  function handleStageReassignment(employee: ProductionEmployee) {
    console.log('Reassignment button clicked for:', employee);
    console.log('Employee type:', typeof employee);
    console.log('Employee keys:', Object.keys(employee || {}));
    selectedEmployee = { ...employee }; // Create a copy to ensure reactivity
    showReassignmentModal = true;
    console.log('Modal state:', { showReassignmentModal, selectedEmployee });
  }

  function handleViewJourney(employee: ProductionEmployee) {
    selectedEmployee = { ...employee };
    showJourneyModal = true;
  }

  function handleAttendanceMarked(event: CustomEvent) {
    const { empId, stageCode, date, status, notes } = event.detail;
    
    // Update local data
    const employee = data.find(emp => emp.emp_id === empId);
    if (employee) {
      employee.attendance_status = status;
    }
    
    // Dispatch to parent
    dispatch('attendanceMarked', { empId, stageCode, date, status, notes });
    
    // Close modal
    showAttendanceModal = false;
    selectedEmployee = null;
  }

  function handleStageReassigned(event: CustomEvent) {
    const { empId, fromStageCode, toStageCode, date, shiftCode, fromTime, toTime, reason } = event.detail;
    
    // Update local data
    const employee = data.find(emp => emp.emp_id === empId);
    if (employee) {
      employee.current_stage = toStageCode;
    }
    
    // Dispatch to parent
    dispatch('stageReassigned', { empId, fromStageCode, toStageCode, date, shiftCode, fromTime, toTime, reason });
    
    // Close modal
    showReassignmentModal = false;
    selectedEmployee = null;
  }

  function handleJourneyModalClose() {
    showJourneyModal = false;
    selectedEmployee = null;
  }

  function closeAttendanceModal() {
    showAttendanceModal = false;
    selectedEmployee = null;
  }

  function closeReassignmentModal() {
    showReassignmentModal = false;
    selectedEmployee = null;
  }

  function handleExport() {
    // TODO: Implement export functionality
    dispatch('export');
  }

  function clearFilters() {
    search = '';
    selectedStatus = '';
    showFilters = false;
  }

  function getStatusIcon(employee: ProductionEmployee) {
    if (employee.hours_reported && employee.hours_reported > 0) {
      return { icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-100', label: 'Present' };
    } else {
      return { icon: XCircle, color: 'text-red-600', bg: 'bg-red-100', label: 'Absent' };
    }
  }

  // Bulk attendance functions
  function toggleEmployeeSelection(empId: string) {
    if (selectedEmployees.has(empId)) {
      selectedEmployees.delete(empId);
    } else {
      selectedEmployees.add(empId);
    }
    selectedEmployees = selectedEmployees; // Trigger reactivity
  }

  function selectAllEmployees() {
    const eligibleEmployees = filteredData.filter(emp => !isAttendanceLocked(emp));
    selectedEmployees = new Set(eligibleEmployees.map(emp => emp.emp_id));
  }

  function clearSelection() {
    selectedEmployees = new Set();
  }

  function openBulkAttendanceModal() {
    if (selectedEmployees.size === 0) {
      alert('Please select at least one employee to mark attendance.');
      return;
    }
    showBulkAttendanceModal = true;
    bulkAttendanceStatus = 'present';
    bulkNotes = '';
  }

  function handleBulkAttendanceSubmit() {
    if (selectedEmployees.size === 0) {
      alert('No employees selected.');
      return;
    }

    isBulkSubmitting = true;

    // Get selected employees data
    const employeesToMark = filteredData.filter(emp => selectedEmployees.has(emp.emp_id));
    
    // Dispatch bulk attendance event
    dispatch('bulkAttendanceMarked', {
      employees: employeesToMark.map(emp => ({
        empId: emp.emp_id,
        stageCode: emp.current_stage
      })),
      date: selectedDate,
      status: bulkAttendanceStatus,
      notes: bulkNotes.trim() || undefined
    });

    // Update local data
    employeesToMark.forEach(emp => {
      emp.attendance_status = bulkAttendanceStatus;
    });

    // Reset form and close modal
    selectedEmployees = new Set();
    bulkAttendanceStatus = 'present';
    bulkNotes = '';
    showBulkAttendanceModal = false;
    isBulkSubmitting = false;
  }

  function closeBulkAttendanceModal() {
    showBulkAttendanceModal = false;
    bulkAttendanceStatus = 'present';
    bulkNotes = '';
  }

  // Computed values for bulk operations
  $: selectedCount = selectedEmployees.size;
  $: eligibleEmployeesCount = filteredData.filter(emp => !isAttendanceLocked(emp)).length;
  $: allSelected = selectedCount > 0 && selectedCount === eligibleEmployeesCount;


</script>

<div class="theme-bg-primary rounded-lg shadow border theme-border">
  <!-- Heading -->
  <div class="p-4 border-b theme-border">
    <h2 class="text-xl font-semibold theme-text-primary">👥 Manpower Management</h2>
  </div>
  
  <!-- Header with Search, Filters, and Export -->
  <div class="flex items-center justify-between space-x-2 p-3 border-b theme-bg-primary rounded-t-xl shadow mt-4">
    <div class="flex items-center gap-2">
      <input 
        type="text" 
        placeholder="Search employees..." 
        bind:value={search} 
        class="border theme-border rounded-full pl-3 pr-3 py-2 w-full max-w-xs theme-bg-secondary theme-text-primary" 
      />
              <span class="min-w-[140px] whitespace-nowrap">
          <Button variant="secondary" size="sm" on:click={() => showFilters = !showFilters}>
            {showFilters ? 'Hide' : 'Show'} Filters
          </Button>
        </span>
    </div>
    <div class="flex items-center gap-2">
      <!-- Bulk Attendance Controls -->
      {#if selectedCount > 0}
        <div class="flex items-center gap-2 mr-4">
          <span class="text-sm theme-text-primary">
            {selectedCount} selected
          </span>
          <Button 
            variant="primary" 
            size="sm"
            on:click={openBulkAttendanceModal}
          >
            <Users class="w-4 h-4 mr-1" />
            Mark Attendance
          </Button>
          <Button 
            variant="secondary" 
            size="sm"
            on:click={clearSelection}
          >
            Clear
          </Button>
        </div>
      {/if}
      
      <!-- Select All Button -->
      {#if eligibleEmployeesCount > 0}
        <Button 
          variant="secondary" 
          size="sm"
          on:click={selectAllEmployees}
          disabled={allSelected}
        >
          <CheckSquare class="w-4 h-4 mr-1" />
          {allSelected ? 'All Selected' : 'Select All'}
        </Button>
      {/if}
      
      <Button variant="secondary" size="sm" on:click={() => dispatch('refresh')} disabled={isLoading}>
        {isLoading ? 'Loading...' : 'Refresh'}
      </Button>
      <Button variant="secondary" on:click={handleExport}>Export</Button>
    </div>
  </div>

  <!-- Filters Section -->
  {#if showFilters}
    <div class="p-3 border-b theme-border bg-gray-50 dark:bg-gray-800">
      <div class="flex items-center gap-4">
        <div>
          <label for="statusFilter" class="block text-sm font-medium theme-text-primary mb-1">Status Filter:</label>
          <select
            id="statusFilter"
            bind:value={selectedStatus}
            class="px-3 py-2 border theme-border rounded-lg theme-bg-primary theme-text-primary text-sm"
          >
            <option value="">All Status</option>
            <option value="present">Present</option>
            <option value="absent">Absent</option>
            <option value="overtime">Overtime (OT > 0)</option>
            <option value="losttime">Lost Time (LT > 0)</option>
          </select>
        </div>
        <Button variant="secondary" size="sm" on:click={clearFilters}>
          Clear Filters
        </Button>
      </div>
    </div>
  {/if}

  <!-- Stats Summary -->
  <div class="p-4 border-b theme-border bg-blue-50 dark:bg-blue-900/20">
    <div class="grid grid-cols-2 md:grid-cols-7 gap-4 text-center">
      <div>
        <div class="text-2xl font-bold text-blue-600 dark:text-blue-400">{totalEmployees}</div>
        <div class="text-sm text-gray-800 dark:text-gray-200">Total Employees</div>
      </div>
      <div>
        <div class="text-2xl font-bold text-green-600 dark:text-green-400">{totalPlannedHours.toFixed(1)}</div>
        <div class="text-sm text-gray-800 dark:text-gray-200">Planned Hours</div>
      </div>
      <div>
        <div class="text-2xl font-bold text-blue-600 dark:text-blue-400">{totalReportedHours.toFixed(1)}</div>
        <div class="text-sm text-gray-800 dark:text-gray-200">Reported Hours</div>
      </div>
      <div>
        <div class="text-2xl font-bold text-orange-600 dark:text-orange-400">{totalOTHours.toFixed(1)}</div>
        <div class="text-sm text-gray-800 dark:text-gray-200">OT Hours</div>
      </div>
      <div>
        <div class="text-2xl font-bold text-purple-600 dark:text-purple-400">{totalLTHours.toFixed(1)}</div>
        <div class="text-sm text-gray-800 dark:text-gray-200">LT Hours</div>
      </div>
      <div>
        <div class="text-2xl font-bold text-red-600 dark:text-red-400">{totalToOtherStageHours.toFixed(1)}</div>
        <div class="text-sm text-gray-800 dark:text-gray-200">To Other Stage</div>
      </div>
      <div>
        <div class="text-2xl font-bold text-indigo-600 dark:text-indigo-400">{totalFromOtherStageHours.toFixed(1)}</div>
        <div class="text-sm text-gray-800 dark:text-gray-200">From Other Stage</div>
      </div>
    </div>
  </div>

  <!-- Loading State -->
  {#if isLoading}
    <div class="flex items-center justify-center py-12">
      <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      <span class="ml-3 theme-text-primary">Loading manpower data...</span>
    </div>
  {:else}
    <!-- Table -->
    <div class="overflow-x-auto">
      <table class="w-full">
        <thead class="theme-bg-secondary">
          <tr>
            <th class="px-6 py-3 text-left text-xs font-medium theme-text-primary uppercase tracking-wider">
              <input 
                type="checkbox" 
                checked={allSelected}
                on:change={() => allSelected ? clearSelection() : selectAllEmployees()}
                class="rounded theme-border"
                disabled={eligibleEmployeesCount === 0}
              />
            </th>
            <th class="px-6 py-3 text-left text-xs font-medium theme-text-primary uppercase tracking-wider">
              Employee
            </th>
            <th class="px-6 py-3 text-left text-xs font-medium theme-text-primary uppercase tracking-wider">
              Skill
            </th>
            <th class="px-6 py-3 text-left text-xs font-medium theme-text-primary uppercase tracking-wider">
              Status
            </th>
                         <th class="px-6 py-3 text-left text-xs font-medium theme-text-primary uppercase tracking-wider">
               Current Stage
             </th>
             <th class="px-6 py-3 text-left text-xs font-medium theme-text-primary uppercase tracking-wider">
               Shift
             </th>
            <th class="px-6 py-3 text-left text-xs font-medium theme-text-primary uppercase tracking-wider">
              Hours Planned
            </th>
            <th class="px-6 py-3 text-left text-xs font-medium theme-text-primary uppercase tracking-wider">
              Hours Reported
            </th>
                         <th class="px-6 py-3 text-left text-xs font-medium theme-text-primary uppercase tracking-wider">
               OT Hours
             </th>
             <th class="px-6 py-3 text-left text-xs font-medium theme-text-primary uppercase tracking-wider">
               LT Hours
             </th>
             <th class="px-6 py-3 text-left text-xs font-medium theme-text-primary uppercase tracking-wider">
               To Other Stage
             </th>
             <th class="px-6 py-3 text-left text-xs font-medium theme-text-primary uppercase tracking-wider">
               From Other Stage
             </th>
            <th class="px-6 py-3 text-left text-xs font-medium theme-text-primary uppercase tracking-wider">
              Actions
            </th>
          </tr>
        </thead>
        <tbody class="theme-bg-primary divide-y theme-border">
          {#if filteredData.length === 0}
            <tr>
                             <td colspan="13" class="px-6 py-4 text-center text-sm theme-text-secondary">
                {data.length === 0 ? 'No employees found for this stage and date' : 'No employees match the current filters'}
              </td>
            </tr>
          {:else}
            {#each filteredData as employee}
              <tr class="hover:theme-bg-secondary transition-colors">
                <td class="px-6 py-4 whitespace-nowrap">
                  <input 
                    type="checkbox" 
                    checked={selectedEmployees.has(employee.emp_id)}
                    on:change={() => toggleEmployeeSelection(employee.emp_id)}
                    class="rounded theme-border"
                    disabled={isAttendanceLocked(employee)}
                  />
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <div>
                    <div class="text-sm font-medium theme-text-primary">{employee.emp_name}</div>
                    <div class="text-sm theme-text-secondary">{employee.emp_id}</div>
                  </div>
                </td>
                                 <td class="px-6 py-4 whitespace-nowrap text-sm theme-text-primary">
                   {employee.skill_short}
                 </td>
                                 <td class="px-6 py-4 whitespace-nowrap">
                   {#if employee.attendance_status === 'present'}
                     <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-600 dark:bg-green-900 dark:text-green-200">
                       <CheckCircle class="w-3 h-3 mr-1" />
                       Present
                     </span>
                   {:else if employee.attendance_status === 'absent'}
                     <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-600 dark:bg-red-900 dark:text-red-200">
                       <XCircle class="w-3 h-3 mr-1" />
                       Absent
                     </span>
                   {:else}
                     <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600 dark:bg-gray-900 dark:text-gray-200">
                       <UserCheck class="w-3 h-3 mr-1" />
                       Not Marked
                     </span>
                   {/if}
                 </td>
                 <td class="px-6 py-4 whitespace-nowrap">
                   <div class="flex items-center space-x-2">
                     <span class="text-sm font-medium theme-text-primary">{employee.current_stage}</span>
                     <Button
                       variant="secondary"
                       size="sm"
                       on:click={() => handleStageReassignment(employee)}
                       disabled={employee.attendance_status !== 'present'}
                     >
                       <ArrowRight class="w-3 h-3 mr-1" />
                       Reassign
                     </Button>
                   </div>
                 </td>
                 <td class="px-6 py-4 whitespace-nowrap">
                   <div>
                     <div class="text-sm font-medium theme-text-primary">{employee.shift_code}</div>
                     <div class="text-sm theme-text-secondary">{employee.shift_name}</div>
                   </div>
                 </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm theme-text-primary">
                  {employee.hours_planned || 0}h
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm theme-text-primary">
                  {employee.hours_reported || 0}h
                </td>
                                 <td class="px-6 py-4 whitespace-nowrap text-sm theme-text-primary">
                   {employee.ot_hours || 0}h
                 </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm theme-text-primary">
                  {employee.lt_hours || 0}h
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm theme-text-primary">
                  {employee.to_other_stage_hours || 0}h
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm theme-text-primary">
                  {employee.from_other_stage_hours || 0}h
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm theme-text-primary">
                  <div class="flex space-x-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      on:click={() => handleAttendanceToggle(employee)}
                      disabled={isAttendanceLocked(employee)}
                    >
                      {isAttendanceLocked(employee) ? 'Attendance Locked' : 'Mark Attendance'}
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      on:click={() => handleViewJourney(employee)}
                    >
                      <Map class="w-3 h-3 mr-1" />
                      View Journey
                    </Button>
                  </div>
                </td>
              </tr>
            {/each}
          {/if}
        </tbody>
      </table>
    </div>
  {/if}


  <!-- Attendance Modal -->
  <AttendanceModal
    showModal={showAttendanceModal}
    employee={selectedEmployee}
    selectedDate={selectedDate}
    on:attendanceMarked={handleAttendanceMarked}
    on:close={closeAttendanceModal}
  />

  <!-- Stage Reassignment Modal -->
  <StageReassignmentModal
    showModal={showReassignmentModal}
    employee={selectedEmployee}
    selectedDate={selectedDate}
    on:stageReassigned={handleStageReassigned}
    on:close={closeReassignmentModal}
  />

  <!-- Stage Journey Modal -->
  <StageJourneyModal
    showModal={showJourneyModal}
    employee={selectedEmployee}
    selectedDate={selectedDate}
    on:close={handleJourneyModalClose}
  />

  <!-- Bulk Attendance Modal -->
  {#if showBulkAttendanceModal}
    <div style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0, 0, 0, 0.5); z-index: 1000; display: flex; align-items: center; justify-content: center;">
      <div class="theme-bg-primary theme-border rounded-lg shadow-lg" style="padding: 20px; min-width: 500px; max-width: 600px;">
        
        <!-- Header -->
        <div style="display: flex; align-items: center; margin-bottom: 20px;">
          <div class="bg-blue-500 rounded-full" style="width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; margin-right: 15px;">
            <Users style="color: white; font-size: 20px;" />
          </div>
          <div>
            <h3 class="theme-text-primary" style="margin: 0; font-size: 18px; font-weight: 600;">Bulk Attendance Marking</h3>
            <p class="theme-text-secondary" style="margin: 5px 0 0 0; font-size: 14px;">
              Mark attendance for {selectedCount} selected employee{selectedCount > 1 ? 's' : ''}
            </p>
          </div>
        </div>

        <!-- Selected Employees Info -->
        <div class="theme-bg-secondary theme-border rounded-lg" style="padding: 15px; margin-bottom: 20px;">
          <p class="theme-text-primary" style="margin: 5px 0; font-size: 14px;">
            <strong>Date:</strong> {new Date(selectedDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' })}
          </p>
          <p class="theme-text-primary" style="margin: 5px 0; font-size: 14px;">
            <strong>Selected Employees:</strong> {selectedCount}
          </p>
        </div>

        <!-- Form -->
        <div style="margin-bottom: 20px;">
          <!-- Attendance Status -->
          <div style="margin-bottom: 20px;">
            <fieldset>
              <legend class="theme-text-primary" style="margin-bottom: 10px; font-weight: 500;">Attendance Status:</legend>
              <div>
                <label style="display: flex; align-items: center; margin-bottom: 8px;">
                  <input 
                    type="radio" 
                    bind:group={bulkAttendanceStatus} 
                    value="present"
                    style="margin-right: 8px;"
                  />
                  <span class="theme-text-primary">Present</span>
                </label>
                <label style="display: flex; align-items: center;">
                  <input 
                    type="radio" 
                    bind:group={bulkAttendanceStatus} 
                    value="absent"
                    style="margin-right: 8px;"
                  />
                  <span class="theme-text-primary">Absent</span>
                </label>
              </div>
            </fieldset>
          </div>

          <!-- Notes -->
          <div style="margin-bottom: 20px;">
            <label for="bulkNotes" class="block theme-text-primary" style="margin-bottom: 8px; font-weight: 500;">Notes (Optional):</label>
            <textarea
              id="bulkNotes"
              bind:value={bulkNotes}
              placeholder="Add any notes for this bulk attendance marking..."
              class="w-full px-3 py-2 border theme-border rounded-lg theme-bg-primary theme-text-primary"
              rows="3"
            ></textarea>
          </div>
        </div>

        <!-- Actions -->
        <div style="display: flex; justify-content: flex-end; gap: 10px;">
          <Button 
            variant="secondary" 
            on:click={closeBulkAttendanceModal}
            disabled={isBulkSubmitting}
          >
            Cancel
          </Button>
          <Button 
            variant="primary" 
            on:click={handleBulkAttendanceSubmit}
            disabled={isBulkSubmitting}
          >
            {isBulkSubmitting ? 'Marking...' : `Mark ${bulkAttendanceStatus === 'present' ? 'Present' : 'Absent'}`}
          </Button>
        </div>
      </div>
    </div>
  {/if}
</div>
