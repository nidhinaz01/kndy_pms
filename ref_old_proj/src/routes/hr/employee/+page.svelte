<script lang="ts">
  import { onMount } from 'svelte';
  import { supabase } from '$lib/supabaseClient';
  import { theme } from '$lib/stores/theme';
  import { 
    fetchSkillCodes, 
    fetchEmployeeCategories, 
    fetchStages, 
    fetchEmployees,
    saveEmployee, 
    updateEmployee, 
    deleteEmployee,
    checkEmployeeIdExists, 
    getUsernameFromEmail,
    exportTemplate,
    importEmployees
  } from '$lib/api/employee';
  import { getTodayString } from '$lib/utils/dateValidation';
  import SortableDataTable from '$lib/components/common/SortableDataTable.svelte';
  import AppHeader from '$lib/components/common/AppHeader.svelte';
  import FloatingThemeToggle from '$lib/components/common/FloatingThemeToggle.svelte';
  import Sidebar from '$lib/components/navigation/Sidebar.svelte';
  import { fetchUserMenus } from '$lib/api/menu';
  import Button from '$lib/components/common/Button.svelte';
  import { sanitizeString, isValidTrimmedString } from '$lib/utils/inputSanitization';

  // State management
  let skillCodes: string[] = [];
  let employeeCategories: string[] = [];
  let stages: string[] = [];
  let empId = '';
  let selectedEmpCat = '';
  let empName = '';
  let selectedSkillCode = '';
  let empDoj = '';
  let lastAppraisalDate = '';
  let basicDa = '';
  let salary = '';
  let selectedStage = '';
  let isLoading = false;
  let message = '';
  let messageType: 'success' | 'error' = 'success';
  let refreshTable = 0;
  let showSidebar = false;
  let menus: any[] = [];
  let isEditMode = false;
  let editingEmployeeId: number | null = null;
  let showImportModal = false;
  let importFile: File | null = null;
  let importResults: { success: number; errors: string[] } | null = null;
  let employees: any[] = [];

  // Load existing data
  async function loadData() {
    try {
      [skillCodes, employeeCategories, stages] = await Promise.all([
        fetchSkillCodes(),
        fetchEmployeeCategories(),
        fetchStages()
      ]);
    } catch (error) {
      console.error('Error loading data:', error);
    }
  }

  // Load employees for table
  async function loadEmployees() {
    try {
      const rawEmployees = await fetchEmployees();
      
      // Convert emails to usernames for display
      employees = await Promise.all(
        rawEmployees.map(async (employee) => {
          // Check if modified_by looks like an email
          if (employee.modified_by && employee.modified_by.includes('@')) {
            const username = await getUsernameFromEmail(employee.modified_by);
            return { ...employee, modified_by: username };
          }
          return employee;
        })
      );
    } catch (error) {
      console.error('Error loading employees:', error);
    }
  }

  async function handleDelete(id: number, empName: string) {
    if (!confirm(`Are you sure you want to delete "${empName}"?`)) {
      return;
    }

    try {
      await deleteEmployee(id);
      await loadEmployees();
      showMessage('Employee deleted successfully!', 'success');
    } catch (error) {
      console.error('Error deleting employee:', error);
      showMessage('Error deleting employee', 'error');
    }
  }

  // Save employee
  async function handleSaveEmployee() {
    // Sanitize and validate required fields
    const sanitizedEmpId = sanitizeString(empId);
    const sanitizedEmpName = sanitizeString(empName);

    if (!isValidTrimmedString(sanitizedEmpId)) {
      showMessage('Employee ID is required', 'error');
      return;
    }

    if (!selectedEmpCat) {
      showMessage('Employee Category is required', 'error');
      return;
    }

    if (!isValidTrimmedString(sanitizedEmpName)) {
      showMessage('Employee Name is required', 'error');
      return;
    }

    if (!selectedSkillCode) {
      showMessage('Skill Code is required', 'error');
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

    // Validate dates (not future dates)
    const today = new Date();
    today.setHours(23, 59, 59, 999); // End of today
    
    const dojDate = new Date(empDoj);
    const appraisalDate = new Date(lastAppraisalDate);
    
    if (dojDate > today) {
      showMessage('Date of joining cannot be a future date', 'error');
      return;
    }
    
    if (appraisalDate > today) {
      showMessage('Last appraisal date cannot be a future date', 'error');
      return;
    }

    if (!basicDa || isNaN(Number(basicDa)) || Number(basicDa) <= 0) {
      showMessage('Basic DA must be a positive number', 'error');
      return;
    }

    if (!salary || isNaN(Number(salary)) || Number(salary) <= 0) {
      showMessage('Salary must be a positive number', 'error');
      return;
    }

    if (!selectedStage) {
      showMessage('Stage is required', 'error');
      return;
    }

    isLoading = true;

    try {
      // Get current user
      const session = await supabase.auth.getSession();
      const user = session.data.session?.user;
      
      if (!user?.email) {
        showMessage('User session not found', 'error');
        return;
      }

      // Only validate employee ID if not in edit mode
      if (!isEditMode) {
        const empIdExists = await checkEmployeeIdExists(sanitizedEmpId);
        if (empIdExists) {
          showMessage(`Employee ID "${sanitizedEmpId}" already exists. Please use a different employee ID.`, 'error');
          return;
        }
      }

      // Get username from email
      const username = await getUsernameFromEmail(user.email);

      if (isEditMode && editingEmployeeId) {
        // Update existing employee
        await updateEmployee(editingEmployeeId, {
          emp_cat: selectedEmpCat,
          emp_name: sanitizedEmpName,
          skill_short: selectedSkillCode,
          emp_doj: empDoj,
          last_appraisal_date: lastAppraisalDate,
          basic_da: Number(basicDa),
          salary: Number(salary),
          stage: selectedStage,
          modified_by: username
        });

        showMessage('Employee updated successfully!', 'success');
      } else {
        // Save new employee
        await saveEmployee({
          emp_id: sanitizedEmpId,
          emp_cat: selectedEmpCat,
          emp_name: sanitizedEmpName,
          skill_short: selectedSkillCode,
          emp_doj: empDoj,
          last_appraisal_date: lastAppraisalDate,
          basic_da: Number(basicDa),
          salary: Number(salary),
          stage: selectedStage,
          modified_by: username
        });

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
    selectedEmpCat = '';
    empName = '';
    selectedSkillCode = '';
    empDoj = '';
    lastAppraisalDate = '';
    basicDa = '';
    salary = '';
    selectedStage = '';
    isEditMode = false;
    editingEmployeeId = null;
  }

  function handleEdit(employee: any) {
    isEditMode = true;
    editingEmployeeId = employee.id;
    empId = employee.emp_id;
    selectedEmpCat = employee.emp_cat;
    empName = employee.emp_name;
    selectedSkillCode = employee.skill_short;
    empDoj = employee.emp_doj;
    lastAppraisalDate = employee.last_appraisal_date;
    basicDa = employee.basic_da.toString();
    salary = employee.salary.toString();
    selectedStage = employee.stage;
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
      const session = await supabase.auth.getSession();
      const user = session.data.session?.user;
      
      if (!user?.email) {
        showMessage('User session not found', 'error');
        return;
      }

      const username = await getUsernameFromEmail(user.email);
      importResults = await importEmployees(text, username);
      
      if (importResults.success > 0) {
        showMessage(`Successfully imported ${importResults.success} employees!`, 'success');
        refreshTable++;
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
    const session = await supabase.auth.getSession();
    const user = session.data.session?.user;
    
    if (!user) {
      window.location.href = '/login';
      return;
    }

    console.log('User authenticated, loading employee data');
    await loadData();
    await loadEmployees();

    // Load menus
    const username = localStorage.getItem('username');
    if (username) {
      menus = await fetchUserMenus();
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
  />
  
  <!-- Action Buttons -->
  <div class="flex justify-end p-4 border-b theme-border">
    <button
      on:click={() => showImportModal = true}
      class="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
    >
      Import Data
    </button>
  </div>

  <!-- Message Display -->
  {#if message}
    <div class="p-4 {messageType === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'} rounded-lg mx-4 mt-4">
      {message}
    </div>
  {/if}

  <!-- Main Content -->
  <div class="flex-1 flex gap-6 p-6">
    <!-- Form Section -->
    <div class="w-3/10">
      <div class="theme-bg-primary rounded-lg shadow-lg p-6">
        <h2 class="text-xl font-semibold theme-text-primary mb-6">
          {isEditMode ? 'Edit Employee' : 'Add New Employee'}
        </h2>
        
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
            <label for="empCat" class="block text-sm font-medium theme-text-primary mb-2">
              Employee Category *
            </label>
            <select
              id="empCat"
              bind:value={selectedEmpCat}
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

          <!-- Skill Code -->
          <div>
            <label for="skillCode" class="block text-sm font-medium theme-text-primary mb-2">
              Skill Code *
            </label>
            <select
              id="skillCode"
              bind:value={selectedSkillCode}
              class="w-full px-3 py-2 border theme-border rounded-lg theme-bg-primary theme-text-primary focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            >
              <option value="">Select skill code</option>
              {#each skillCodes as code}
                <option value={code}>{code}</option>
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
              max={getTodayString()}
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
              max={getTodayString()}
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
            >
              <option value="">Select stage</option>
              {#each stages as stage}
                <option value={stage}>{stage}</option>
              {/each}
            </select>
          </div>

          <!-- Save Button -->
          <div class="pt-4">
            <Button
              type="submit"
              disabled={isLoading}
              fullWidth={true}
              size="lg"
            >
              {isLoading ? (isEditMode ? 'Updating...' : 'Saving...') : (isEditMode ? 'Update Employee' : 'Save Employee')}
            </Button>
          </div>
        </form>
      </div>
    </div>

    <!-- Table Section -->
    <div class="w-7/10">
      <SortableDataTable
        data={employees}
        columns={[
          { key: 'emp_id', label: 'Employee ID', sortable: true, filterable: true },
          { key: 'emp_cat', label: 'Category', sortable: true, filterable: true },
          { key: 'emp_name', label: 'Name', sortable: true, filterable: true },
          { key: 'skill_short', label: 'Skill Code', sortable: true, filterable: true },
          { key: 'emp_doj', label: 'DOJ', sortable: true, filterable: true, type: 'date' },
          { key: 'last_appraisal_date', label: 'Last Appraisal', sortable: true, filterable: true, type: 'date' },
          { key: 'basic_da', label: 'Basic DA', sortable: true, filterable: true, type: 'currency' },
          { key: 'salary', label: 'Salary', sortable: true, filterable: true, type: 'currency' },
          { key: 'stage', label: 'Stage', sortable: true, filterable: true },
          { key: 'modified_by', label: 'Modified By', sortable: true, filterable: true },
          { key: 'modified_dt', label: 'Modified Date', sortable: true, filterable: true, type: 'date' }
        ]}
        actions={[
          {
            label: 'Edit',
            icon: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />',
            onClick: handleEdit,
            color: 'blue'
          },
          {
            label: 'Delete',
            icon: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />',
            onClick: (employee) => handleDelete(employee.id, employee.emp_name),
            color: 'red'
          }
        ]}
        isLoading={isLoading}
        title="Employee Records"
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
    <div class="bg-white dark:bg-gray-800 rounded-lg p-6 w-96 max-w-md relative z-10">
      <h3 class="text-lg font-semibold theme-text-primary mb-4">Import Employees</h3>
      
      <div class="space-y-4">
        <!-- Template Export -->
        <div class="p-4 bg-blue-50 dark:bg-blue-900 rounded-lg">
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
        <div class="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
          <h4 class="text-sm font-semibold theme-text-primary mb-2">Instructions:</h4>
          <div class="text-xs theme-text-secondary space-y-1">
            <p>• CSV must have columns: emp_id,emp_cat,emp_name,skill_short,emp_doj,last_appraisal_date,basic_da,salary,stage</p>
            <p>• emp_id: Unique employee identifier</p>
            <p>• emp_cat: Employee category (from dropdown values)</p>
            <p>• emp_name: Employee full name</p>
            <p>• skill_short: Skill code (from dropdown values)</p>
            <p>• emp_doj: Date of joining (YYYY-MM-DD format, not future date)</p>
            <p>• last_appraisal_date: Last appraisal date (YYYY-MM-DD format, not future date)</p>
            <p>• basic_da: Basic DA amount (positive number)</p>
            <p>• salary: Salary amount (positive number)</p>
            <p>• stage: Employee stage (from dropdown values)</p>
          </div>
        </div>
        
        <!-- Import Results -->
        {#if importResults}
          <div class="p-3 rounded-lg {importResults.success > 0 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}">
            <p class="font-semibold">Import Results:</p>
            <p>Successfully imported: {importResults.success}</p>
            {#if importResults.errors.length > 0}
              <p class="mt-2">Errors: {importResults.errors.length}</p>
              <details class="mt-2">
                <summary class="cursor-pointer font-semibold">View Errors</summary>
                <ul class="mt-2 text-xs space-y-1">
                  {#each importResults.errors as error}
                    <li>• {error}</li>
                  {/each}
                </ul>
              </details>
            {/if}
          </div>
        {/if}
      </div>
      
      <div class="flex justify-end space-x-3 mt-6">
        <Button
          type="button"
          variant="secondary"
          on:click={() => showImportModal = false}
          disabled={isLoading}
        >
          Cancel
        </Button>
        <Button
          type="button"
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