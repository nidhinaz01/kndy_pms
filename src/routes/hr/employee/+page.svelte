<script lang="ts">
  import { onMount } from 'svelte';
  import { supabase } from '$lib/supabaseClient';
  import { theme } from '$lib/stores/theme';
  import { fetchEmployeeCategories, fetchSkillShorts, fetchStages, fetchShifts, fetchEmployees, saveEmployee, updateEmployee, deleteEmployee, toggleEmployeeStatus, checkEmployeeIdExists, exportTemplate, importEmployees } from '$lib/api/employee';
  import AppHeader from '$lib/components/common/AppHeader.svelte';
  import FloatingThemeToggle from '$lib/components/common/FloatingThemeToggle.svelte';
  import Sidebar from '$lib/components/navigation/Sidebar.svelte';
  import { fetchUserMenus } from '$lib/services/menuService';
  import Button from '$lib/components/common/Button.svelte';
  import DataTable from '$lib/components/common/DataTable.svelte';
  import { Trash2, Edit } from 'lucide-svelte';

  // State management
  let employeeCategories: string[] = [];
  let skillShorts: string[] = [];
  let stages: string[] = [];
  let shifts: string[] = [];
  let empId = '';
  let selectedEmpCategory = '';
  let empName = '';
  let selectedSkillShort = '';
  let empDoj = '';
  let lastAppraisalDate = '';
  let basicDa = '';
  let salary = '';
  let selectedStage = '';
  let selectedShiftCode = '';
  let isActive = true;
  let isLoading = false;
  let message = '';
  let messageType: 'success' | 'error' = 'success';
  let showSidebar = false;
  let menus: any[] = [];
  let isEditMode = false;
  let editingEmployeeId: number | null = null;
  let employees: any[] = [];
  let tableLoading = false;
  let showImportModal = false;
  let importFile: File | null = null;
  let importResults: { success: number; errors: string[] } | null = null;

  // Load existing data elements
  async function loadDataElements() {
    try {
      [employeeCategories, skillShorts, stages, shifts] = await Promise.all([
        fetchEmployeeCategories(),
        fetchSkillShorts(),
        fetchStages(),
        fetchShifts()
      ]);
    } catch (error) {
      console.error('Error loading data elements:', error);
    }
  }

  // Load employees for table
  async function loadEmployees() {
    try {
      tableLoading = true;
      console.log('Fetching employees...');
      const rawEmployees = await fetchEmployees();
      console.log('Raw employees:', rawEmployees);
      
      // Get usernames for modified_by emails
      const emails = [...new Set(rawEmployees.map(emp => emp.modified_by))];
      console.log('Emails to lookup:', emails);
      
      if (emails.length > 0) {
        const { data: users, error: userError } = await supabase
          .from('app_users')
          .select('email, username')
          .in('email', emails);
        
        console.log('Users lookup result:', users, userError);
        
        if (!userError && users) {
          const emailToUsername = new Map(users.map(u => [u.email, u.username]));
          employees = rawEmployees.map(emp => ({
            ...emp,
            modified_by: emailToUsername.get(emp.modified_by) || emp.modified_by
          }));
        } else {
          employees = rawEmployees;
        }
      } else {
        employees = rawEmployees;
      }
      
      console.log('Final employees:', employees);
    } catch (error) {
      console.error('Error loading employees:', error);
    } finally {
      tableLoading = false;
    }
  }

  async function handleDeleteEmployee(employee: any) {
    if (!confirm(`Are you sure you want to delete "${employee.emp_name}" (${employee.emp_id})?`)) {
      return;
    }

    try {
      const username = localStorage.getItem('username');
      if (!username) {
        showMessage('User session not found', 'error');
        return;
      }

      await deleteEmployee(employee.id, username);
      await loadEmployees();
      showMessage('Employee deleted successfully!', 'success');
    } catch (error) {
      console.error('Error deleting employee:', error);
      showMessage('Error deleting employee', 'error');
    }
  }

  async function handleEdit(employee: any) {
    isEditMode = true;
    editingEmployeeId = employee.id;
    empId = employee.emp_id;
    selectedEmpCategory = employee.emp_cat;
    empName = employee.emp_name;
    selectedSkillShort = employee.skill_short;
    
    // Handle date formatting for date inputs
    if (employee.emp_doj) {
      if (typeof employee.emp_doj === 'string' && employee.emp_doj.match(/^\d{4}-\d{2}-\d{2}$/)) {
        empDoj = employee.emp_doj;
      } else {
        const date = new Date(employee.emp_doj);
        empDoj = date.toISOString().split('T')[0];
      }
    } else {
      empDoj = '';
    }
    
    if (employee.last_appraisal_date) {
      if (typeof employee.last_appraisal_date === 'string' && employee.last_appraisal_date.match(/^\d{4}-\d{2}-\d{2}$/)) {
        lastAppraisalDate = employee.last_appraisal_date;
      } else {
        const date = new Date(employee.last_appraisal_date);
        lastAppraisalDate = date.toISOString().split('T')[0];
      }
    } else {
      lastAppraisalDate = '';
    }
    
    basicDa = employee.basic_da.toString();
    salary = employee.salary.toString();
    selectedStage = employee.stage;
    selectedShiftCode = employee.shift_code;
    isActive = employee.is_active;
  }

  // Save employee
  async function handleSaveEmployee() {
    if (!empId) {
      showMessage('Employee ID is required', 'error');
      return;
    }

    if (!selectedEmpCategory) {
      showMessage('Employee Category is required', 'error');
      return;
    }

    if (!empName) {
      showMessage('Employee Name is required', 'error');
      return;
    }

    if (!selectedSkillShort) {
      showMessage('Skill is required', 'error');
      return;
    }

    if (!empDoj) {
      showMessage('Date of Joining is required', 'error');
      return;
    }

    if (!lastAppraisalDate) {
      showMessage('Last Appraisal Date is required', 'error');
      return;
    }

    // Validate basic DA: can be zero (but not negative) for Apprentice or Trainee, otherwise must be positive
    const basicDaNum = Number(basicDa);
    const categoryLower = selectedEmpCategory?.toLowerCase() || '';
    const isApprenticeOrTrainee = categoryLower.includes('apprentice') || categoryLower.includes('trainee');
    
    if (!basicDa || isNaN(basicDaNum)) {
      showMessage('Basic DA must be a valid number', 'error');
      return;
    }
    
    if (isApprenticeOrTrainee) {
      // For Apprentice or Trainee: allow zero but not negative
      if (basicDaNum < 0) {
        showMessage('Basic DA cannot be negative', 'error');
        return;
      }
    } else {
      // For other categories: must be positive
      if (basicDaNum <= 0) {
        showMessage('Basic DA must be a positive number', 'error');
        return;
      }
    }

    if (!salary || isNaN(Number(salary)) || Number(salary) <= 0) {
      showMessage('Salary must be a positive number', 'error');
      return;
    }

    if (!selectedStage) {
      showMessage('Stage is required', 'error');
      return;
    }

    if (!selectedShiftCode) {
      showMessage('Shift Code is required', 'error');
      return;
    }

    // Validate dates
    const dojDate = new Date(empDoj);
    const appraisalDate = new Date(lastAppraisalDate);
    const today = new Date();
    
    // Set all dates to start of day for proper comparison
    dojDate.setHours(0, 0, 0, 0);
    appraisalDate.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);
    
    if (dojDate > today) {
      const confirmFutureDoj = confirm(`The Date of Joining (${empDoj}) is in the future. Are you sure you want to proceed?`);
      if (!confirmFutureDoj) {
        return;
      }
    }
    
    if (appraisalDate > today) {
      const confirmFutureAppraisal = confirm(`The Last Appraisal Date (${lastAppraisalDate}) is in the future. Are you sure you want to proceed?`);
      if (!confirmFutureAppraisal) {
        return;
      }
    }

    isLoading = true;

    try {
      // Get current user
      const username = localStorage.getItem('username');
      if (!username) {
        showMessage('User session not found', 'error');
        return;
      }

      // Only validate duplicates if not in edit mode (since emp_id can't be changed in edit mode)
      if (!isEditMode) {
        // Check if employee ID already exists
        const empIdExists = await checkEmployeeIdExists(empId);
        if (empIdExists) {
          showMessage(`Employee ID "${empId}" already exists. Please use a different employee ID.`, 'error');
          return;
        }
      }

      if (isEditMode && editingEmployeeId) {
        // Update existing employee
        await updateEmployee(editingEmployeeId, {
          emp_cat: selectedEmpCategory,
          emp_name: empName,
          skill_short: selectedSkillShort,
          emp_doj: empDoj,
          last_appraisal_date: lastAppraisalDate,
          basic_da: Number(basicDa),
          salary: Number(salary),
          is_active: isActive,
          shift_code: selectedShiftCode
        }, username);

        showMessage('Employee updated successfully!', 'success');
      } else {
        // Save new employee
        await saveEmployee({
          emp_id: empId,
          emp_cat: selectedEmpCategory,
          emp_name: empName,
          skill_short: selectedSkillShort,
          emp_doj: empDoj,
          last_appraisal_date: lastAppraisalDate,
          basic_da: Number(basicDa),
          salary: Number(salary),
          stage: selectedStage,
          is_active: isActive,
          shift_code: selectedShiftCode
        }, username);

        showMessage('Employee saved successfully!', 'success');
      }
      
      // Reset form
      resetForm();

      // Refresh the table
      await loadEmployees();
    } catch (error) {
      console.error('Error saving employee:', error);
      showMessage('Error saving employee', 'error');
    } finally {
      isLoading = false;
    }
  }

  function showMessage(text: string, type: 'success' | 'error') {
    message = text;
    messageType = type;
    setTimeout(() => {
      message = '';
    }, 5000);
  }

  function resetForm() {
    empId = '';
    selectedEmpCategory = '';
    empName = '';
    selectedSkillShort = '';
    empDoj = '';
    lastAppraisalDate = '';
    basicDa = '';
    salary = '';
    selectedStage = '';
    selectedShiftCode = '';
    isActive = true;
    isEditMode = false;
    editingEmployeeId = null;
  }

  function handleSidebarToggle() {
    showSidebar = !showSidebar;
  }

  async function handleExportTemplate() {
    await exportTemplate();
  }

  function handleFileSelect(event: Event) {
    const target = event.target as HTMLInputElement;
    if (target.files && target.files[0]) {
      importFile = target.files[0];
    }
  }

  async function handleImport() {
    if (!importFile) {
      showMessage('Please select a file to import', 'error');
      return;
    }

    try {
      const text = await importFile.text();
      const username = localStorage.getItem('username');
      
      if (!username) {
        showMessage('User session not found', 'error');
        return;
      }

      importResults = await importEmployees(text, username);
      
      if (importResults.success > 0) {
        showMessage(`Successfully imported ${importResults.success} employees!`, 'success');
        await loadEmployees(); // Refresh the table
      }
      
      if (importResults.errors.length > 0) {
        showMessage(`Import completed with ${importResults.errors.length} errors. Check console for details.`, 'error');
        console.log('Import errors:', importResults.errors);
      }
      
      // Reset file input
      importFile = null;
      const fileInput = document.getElementById('importFile') as HTMLInputElement;
      if (fileInput) fileInput.value = '';
      
    } catch (error) {
      console.error('Error importing employees:', error);
      showMessage('Error importing employees', 'error');
    }
  }

  onMount(async () => {
    // Check if user is logged in
    const username = localStorage.getItem('username');
    if (!username) {
      console.log('User not logged in, redirecting to login');
      window.location.href = '/';
      return;
    }

    console.log('User authenticated, loading employee data');
    await loadDataElements();
    await loadEmployees();

    // Load menus
    if (username) {
      menus = await fetchUserMenus(username);
    }
  });
</script>

<svelte:head>
  <title>Employee Management</title>
</svelte:head>

<!-- Sidebar Overlay -->
{#if showSidebar}
  <div class="fixed inset-0 z-50">
    <button
      type="button"
      aria-label="Close sidebar overlay"
      class="fixed inset-0 bg-black bg-opacity-40 z-40"
      on:click={handleSidebarToggle}
      tabindex="0"
      on:keydown={(e) => (e.key === 'Enter' || e.key === ' ') && handleSidebarToggle()}
      style="cursor: pointer; border: none; width: 100%; height: 100%; position: fixed; left: 0; top: 0; background-color: rgba(0,0,0,0.4);"
    ></button>
    <div class="fixed left-0 top-0 h-full w-64 z-50 theme-bg-primary shadow-lg">
      <Sidebar {menus} />
    </div>
  </div>
{/if}

<div class="flex flex-col h-full w-full theme-bg-secondary transition-colors duration-200" style="min-height: 100vh;">
  <!-- Header -->
  <AppHeader 
    title="Employee Management"
    onSidebarToggle={handleSidebarToggle}
    showImportButton={true}
    onImportClick={() => showImportModal = true}
  />

  <!-- Message Display -->
  {#if message}
    <div class={`mx-4 mt-4 p-4 rounded-lg ${messageType === 'success' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'}`}>
      {message}
    </div>
  {/if}

  <!-- Main Content - Horizontal Split -->
  <div class="flex flex-1 p-4 gap-6">
    <!-- Left Side - Creation Form -->
    <div class="w-3/10">
      <div class="theme-bg-primary rounded-lg shadow-lg p-6 border theme-border h-full">
        <h3 class="text-lg font-semibold theme-text-primary mb-6">
          {isEditMode ? 'Edit Employee' : 'Add New Employee'}
        </h3>
        
        <form on:submit|preventDefault={handleSaveEmployee} class="space-y-6">
          <!-- Employee ID -->
          <div>
            <label for="empId" class="block text-sm font-medium theme-text-primary mb-2">
              Employee ID *
            </label>
            <input
              id="empId"
              type="text"
              bind:value={empId}
              class="w-full px-3 py-2 border theme-border rounded-lg theme-bg-primary theme-text-primary focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Enter employee ID"
              required
              disabled={isEditMode}
            />
            <p class="mt-1 text-xs theme-text-secondary">
              {isEditMode ? 'Employee ID cannot be changed in edit mode' : 'Employee ID must be unique'}
            </p>
          </div>

          <!-- Employee Category -->
          <div>
            <label for="empCategory" class="block text-sm font-medium theme-text-primary mb-2">
              Employee Category *
            </label>
            <select
              id="empCategory"
              bind:value={selectedEmpCategory}
              class="w-full px-3 py-2 border theme-border rounded-lg theme-bg-primary theme-text-primary focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            >
              <option value="">Select employee category</option>
              {#each employeeCategories as category}
                <option value={category}>{category}</option>
              {/each}
            </select>
          </div>

          <!-- Employee Name -->
          <div>
            <label for="empName" class="block text-sm font-medium theme-text-primary mb-2">
              Employee Name *
            </label>
            <input
              id="empName"
              type="text"
              bind:value={empName}
              class="w-full px-3 py-2 border theme-border rounded-lg theme-bg-primary theme-text-primary focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Enter employee name"
              required
            />
          </div>

          <!-- Skill -->
          <div>
            <label for="skillShort" class="block text-sm font-medium theme-text-primary mb-2">
              Skill *
            </label>
            <select
              id="skillShort"
              bind:value={selectedSkillShort}
              class="w-full px-3 py-2 border theme-border rounded-lg theme-bg-primary theme-text-primary focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            >
              <option value="">Select skill</option>
              {#each skillShorts as skill}
                <option value={skill}>{skill}</option>
              {/each}
            </select>
          </div>

          <!-- Date of Joining -->
          <div>
            <label for="empDoj" class="block text-sm font-medium theme-text-primary mb-2">
              Date of Joining *
            </label>
            <input
              id="empDoj"
              type="date"
              bind:value={empDoj}
              class="w-full px-3 py-2 border theme-border rounded-lg theme-bg-primary theme-text-primary focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>

          <!-- Last Appraisal Date -->
          <div>
            <label for="lastAppraisalDate" class="block text-sm font-medium theme-text-primary mb-2">
              Last Appraisal Date *
            </label>
            <input
              id="lastAppraisalDate"
              type="date"
              bind:value={lastAppraisalDate}
              class="w-full px-3 py-2 border theme-border rounded-lg theme-bg-primary theme-text-primary focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>

          <!-- Basic DA -->
          <div>
            <label for="basicDa" class="block text-sm font-medium theme-text-primary mb-2">
              Basic DA (₹) *
            </label>
            <input
              id="basicDa"
              type="number"
              bind:value={basicDa}
              min="0"
              step="0.01"
              class="w-full px-3 py-2 border theme-border rounded-lg theme-bg-primary theme-text-primary focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Enter basic DA"
              required
            />
          </div>

          <!-- Salary -->
          <div>
            <label for="salary" class="block text-sm font-medium theme-text-primary mb-2">
              Salary (₹) *
            </label>
            <input
              id="salary"
              type="number"
              bind:value={salary}
              min="0"
              step="0.01"
              class="w-full px-3 py-2 border theme-border rounded-lg theme-bg-primary theme-text-primary focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Enter salary"
              required
            />
          </div>

          <!-- Stage -->
          <div>
            <label for="stage" class="block text-sm font-medium theme-text-primary mb-2">
              Stage *
            </label>
            <select
              id="stage"
              bind:value={selectedStage}
              class="w-full px-3 py-2 border theme-border rounded-lg theme-bg-primary theme-text-primary focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
              disabled={isEditMode}
            >
              <option value="">Select stage</option>
              {#each stages as stage}
                <option value={stage}>{stage}</option>
              {/each}
            </select>
            <p class="mt-1 text-xs theme-text-secondary">
              {isEditMode ? 'Stage cannot be changed in edit mode' : 'Select the employee stage'}
            </p>
          </div>

          <!-- Shift Code -->
          <div>
            <label for="shiftCode" class="block text-sm font-medium theme-text-primary mb-2">
              Shift Code *
            </label>
            <select
              id="shiftCode"
              bind:value={selectedShiftCode}
              class="w-full px-3 py-2 border theme-border rounded-lg theme-bg-primary theme-text-primary focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            >
              <option value="">Select shift code</option>
              {#each shifts as shift}
                <option value={shift}>{shift}</option>
              {/each}
            </select>
            <p class="mt-1 text-xs theme-text-secondary">
              Select the shift code for this employee
            </p>
          </div>

          <!-- Status -->
          <div>
            <div class="block text-sm font-medium theme-text-primary mb-2">
              Status *
            </div>
            <div class="space-y-2" role="radiogroup" aria-labelledby="status-label">
              <label class="flex items-center space-x-2">
                <input
                  id="status-active"
                  type="radio"
                  bind:group={isActive}
                  value={true}
                  class="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                />
                <span class="text-sm theme-text-primary">Active</span>
              </label>
              <label class="flex items-center space-x-2">
                <input
                  id="status-inactive"
                  type="radio"
                  bind:group={isActive}
                  value={false}
                  class="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                />
                <span class="text-sm theme-text-primary">Inactive</span>
              </label>
            </div>
            <p class="mt-1 text-xs theme-text-secondary">
              Select the status for this employee
            </p>
          </div>

          <!-- Submit Button -->
          <div class="flex justify-end">
            <Button
              variant="primary"
              size="lg"
              disabled={isLoading}
              on:click={handleSaveEmployee}
            >
              {#if isLoading}
                <svg class="animate-spin -ml-1 mr-3 h-5 w-5 text-white inline" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                {isEditMode ? 'Updating...' : 'Saving...'}
              {:else}
                {isEditMode ? 'Update Employee' : 'Save Employee'}
              {/if}
            </Button>
          </div>
        </form>

        <!-- Help Section -->
        <div class="mt-8 pt-6 border-t theme-border">
          <h4 class="text-sm font-semibold theme-text-primary mb-3">How to use this form:</h4>
          <div class="space-y-2 text-xs theme-text-secondary">
            <div class="flex items-start space-x-2">
              <span class="text-blue-500 font-semibold">•</span>
              <span>Enter a unique employee ID for the new employee.</span>
            </div>
            <div class="flex items-start space-x-2">
              <span class="text-blue-500 font-semibold">•</span>
              <span>Select employee category, skill, and stage from the dropdowns.</span>
            </div>
            <div class="flex items-start space-x-2">
              <span class="text-blue-500 font-semibold">•</span>
              <span>Employee ID and Stage cannot be changed in edit mode.</span>
            </div>
            <div class="flex items-start space-x-2">
              <span class="text-blue-500 font-semibold">•</span>
              <span>Enter the employee's name, date of joining, and last appraisal date.</span>
            </div>
            <div class="flex items-start space-x-2">
              <span class="text-blue-500 font-semibold">•</span>
              <span>Set the basic DA and salary amounts.</span>
            </div>
            <div class="flex items-start space-x-2">
              <span class="text-blue-500 font-semibold">•</span>
              <span>Future dates will prompt for confirmation.</span>
            </div>
            <div class="flex items-start space-x-2">
              <span class="text-blue-500 font-semibold">•</span>
              <span>Select Active or Inactive status for the employee.</span>
            </div>
            <div class="flex items-start space-x-2">
              <span class="text-blue-500 font-semibold">•</span>
              <span>All fields marked with * are required.</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Right Side - Existing Employees -->
    <div class="w-7/10">
      <DataTable
        data={employees}
        columns={[
          { key: 'emp_id', label: 'Employee ID', sortable: true, filterable: true, type: 'text' },
          { key: 'emp_cat', label: 'Category', sortable: true, filterable: true, type: 'text' },
          { key: 'emp_name', label: 'Employee Name', sortable: true, filterable: true, type: 'text' },
          { key: 'skill_short', label: 'Skill', sortable: true, filterable: true, type: 'text' },
          { key: 'emp_doj', label: 'Date of Joining', sortable: true, filterable: true, type: 'date' },
          { key: 'last_appraisal_date', label: 'Last Appraisal', sortable: true, filterable: true, type: 'date' },
          { key: 'basic_da', label: 'Basic DA', sortable: true, filterable: true, type: 'number' },
          { key: 'salary', label: 'Salary', sortable: true, filterable: true, type: 'number' },
          { key: 'stage', label: 'Stage', sortable: true, filterable: true, type: 'text' },
          { key: 'shift_code', label: 'Shift Code', sortable: true, filterable: true, type: 'text' },
          { key: 'is_active', label: 'Status', sortable: true, filterable: true, type: 'status' }
        ]}
        actions={[
          {
            label: 'Edit',
            icon: Edit,
            onClick: handleEdit
          },
          {
            label: 'Delete',
            icon: Trash2,
            onClick: handleDeleteEmployee
          }
        ]}
        title="Employee Records"
        isLoading={tableLoading}
      />
    </div>
  </div>
</div>

<!-- Floating Theme Toggle -->
<FloatingThemeToggle />

<!-- Import Modal -->
{#if showImportModal}
  <div class="fixed inset-0 z-50 flex items-center justify-center" role="dialog" aria-modal="true" tabindex="0">
    <div class="fixed inset-0 bg-black bg-opacity-50" on:click={() => showImportModal = false} on:keydown={(e) => e.key === 'Escape' && (showImportModal = false)} role="button" tabindex="0" aria-label="Close modal"></div>
    <div class="theme-bg-primary border theme-border rounded-lg p-6 w-96 max-w-md max-h-[90vh] overflow-y-auto relative z-10 shadow-xl">
      <h3 class="text-lg font-semibold theme-text-primary mb-4">Import Employees</h3>
      
      <div class="space-y-4">
        <!-- Template Export -->
        <div class="p-4 bg-blue-50 dark:bg-blue-900/30 rounded-lg border border-blue-200 dark:border-blue-700">
          <h4 class="text-sm font-semibold theme-text-primary mb-2">Step 1: Download Template</h4>
          <p class="text-xs theme-text-secondary mb-3">
            Download the CSV template to see the required format and add your employee data.
          </p>
          <Button
            variant="secondary"
            size="sm"
            on:click={handleExportTemplate}
          >
            Download Template
          </Button>
        </div>

        <!-- File Upload -->
        <div>
          <label for="importFile" class="block text-sm font-medium theme-text-primary mb-2">
            Step 2: Select CSV File
          </label>
          <input
            id="importFile"
            type="file"
            accept=".csv"
            on:change={handleFileSelect}
            class="w-full px-3 py-2 border theme-border rounded-lg theme-bg-primary theme-text-primary focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <!-- Instructions -->
        <div class="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600">
          <h4 class="text-sm font-semibold theme-text-primary mb-2">Instructions:</h4>
          <div class="text-xs theme-text-secondary space-y-1">
            <p class="break-words">• CSV must have columns: emp_id,emp_cat,emp_name,skill_short,emp_doj,last_appraisal_date,basic_da,salary,stage,shift_code</p>
            <p>• emp_id: Unique employee identifier</p>
            <p>• emp_cat: Employee category (from dropdown values)</p>
            <p>• emp_name: Employee full name</p>
            <p>• skill_short: Skill code (from dropdown values)</p>
            <p class="break-words">• emp_doj: Date of joining (YYYY-MM-DD format, e.g., 2024-01-15, not future date)</p>
            <p class="break-words">• last_appraisal_date: Last appraisal date (YYYY-MM-DD format, e.g., 2024-01-15, not future date)</p>
            <p>• basic_da: Basic DA amount (positive number, or zero for Apprentice/Trainee categories)</p>
            <p>• salary: Salary amount (positive number)</p>
            <p>• stage: Employee stage (from dropdown values)</p>
            <p>• shift_code: Shift code (from dropdown values)</p>
          </div>
        </div>
        
        <!-- Import Results -->
        {#if importResults}
          <div class="p-3 rounded-lg border {importResults.success > 0 ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 border-green-200 dark:border-green-700' : 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200 border-red-200 dark:border-red-700'}">
            <p class="font-semibold">Import Results:</p>
            <p>Successfully imported: {importResults.success}</p>
            {#if importResults.errors.length > 0}
              <p class="mt-2">Errors: {importResults.errors.length}</p>
              <details class="mt-2">
                <summary class="cursor-pointer font-semibold">View Errors</summary>
                <ul class="mt-2 text-xs space-y-1">
                  {#each importResults.errors as error}
                    <li class="break-words">• {error}</li>
                  {/each}
                </ul>
              </details>
            {/if}
          </div>
        {/if}
      </div>
      
      <div class="flex justify-end space-x-3 mt-6">
        <Button
          variant="secondary"
          on:click={() => showImportModal = false}
          disabled={isLoading}
        >
          Cancel
        </Button>
        <Button
          variant="primary"
          on:click={handleImport}
          disabled={!importFile || isLoading}
        >
          {#if isLoading}
            <svg class="animate-spin -ml-1 mr-3 h-5 w-5 text-white inline" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Importing...
          {:else}
            Import
          {/if}
        </Button>
      </div>
    </div>
  </div>
{/if} 