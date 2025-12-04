<script lang="ts">
  import { onMount } from 'svelte';
  import { fetchEmployeeCategories, fetchSkillShorts, fetchStages, fetchShifts, saveEmployee, updateEmployee, deleteEmployee, checkEmployeeIdExists, exportTemplate, importEmployees } from '$lib/api/employee';
  import AppHeader from '$lib/components/common/AppHeader.svelte';
  import FloatingThemeToggle from '$lib/components/common/FloatingThemeToggle.svelte';
  import Sidebar from '$lib/components/navigation/Sidebar.svelte';
  import { fetchUserMenus } from '$lib/services/menuService';
  import DataTable from '$lib/components/common/DataTable.svelte';
  import { Trash2, Edit } from 'lucide-svelte';
  import { loadEmployeesWithUsernames } from './services/employeeService';
  import { formatDateForInput } from './utils/employeeValidation';
  import { handleSaveEmployee as saveEmployeeHandler, handleDeleteEmployee as deleteEmployeeHandler, handleImport as importHandler } from './services/employeeHandlers';
  import EmployeeForm from './components/EmployeeForm.svelte';
  import ImportModal from './components/ImportModal.svelte';

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
      employees = await loadEmployeesWithUsernames();
    } catch (error) {
      console.error('Error loading employees:', error);
    } finally {
      tableLoading = false;
    }
  }

  async function handleDeleteEmployee(employee: any) {
    await deleteEmployeeHandler(
      employee,
      async () => {
        await loadEmployees();
        showMessage('Employee deleted successfully!', 'success');
      },
      (error) => showMessage(error, 'error')
    );
  }

  async function handleEdit(employee: any) {
    isEditMode = true;
    editingEmployeeId = employee.id;
    empId = employee.emp_id;
    selectedEmpCategory = employee.emp_cat;
    empName = employee.emp_name;
    selectedSkillShort = employee.skill_short;
    
    empDoj = formatDateForInput(employee.emp_doj);
    lastAppraisalDate = formatDateForInput(employee.last_appraisal_date);
    
    basicDa = employee.basic_da.toString();
    salary = employee.salary.toString();
    selectedStage = employee.stage;
    selectedShiftCode = employee.shift_code;
    isActive = employee.is_active;
  }

  // Save employee
  async function handleSaveEmployee() {
    isLoading = true;
    try {
      await saveEmployeeHandler(
        {
          empId,
          selectedEmpCategory,
          empName,
          selectedSkillShort,
          empDoj,
          lastAppraisalDate,
          basicDa,
          salary,
          selectedStage,
          selectedShiftCode,
          isActive
        },
        isEditMode,
        editingEmployeeId,
        async () => {
          showMessage(isEditMode ? 'Employee updated successfully!' : 'Employee saved successfully!', 'success');
          resetForm();
          await loadEmployees();
        },
        (error) => showMessage(error, 'error')
      );
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

    isLoading = true;
    try {
      await importHandler(
        importFile,
        async (results) => {
          importResults = results;
          if (results.success > 0) {
            showMessage(`Successfully imported ${results.success} employees!`, 'success');
            await loadEmployees();
          }
          if (results.errors.length > 0) {
            showMessage(`Import completed with ${results.errors.length} errors. Check console for details.`, 'error');
            console.log('Import errors:', results.errors);
          }
          importFile = null;
          const fileInput = document.getElementById('importFile') as HTMLInputElement;
          if (fileInput) fileInput.value = '';
        },
        (error) => showMessage(error, 'error')
      );
    } finally {
      isLoading = false;
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
      <EmployeeForm
        {employeeCategories}
        {skillShorts}
        {stages}
        {shifts}
        bind:empId
        bind:selectedEmpCategory
        bind:empName
        bind:selectedSkillShort
        bind:empDoj
        bind:lastAppraisalDate
        bind:basicDa
        bind:salary
        bind:selectedStage
        bind:selectedShiftCode
        bind:isActive
        {isEditMode}
        {isLoading}
        onSave={handleSaveEmployee}
      />
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
<ImportModal
  bind:showModal={showImportModal}
  bind:importFile
  bind:importResults
  {isLoading}
  onExportTemplate={handleExportTemplate}
  onFileSelect={handleFileSelect}
  onImport={handleImport}
  onClose={() => showImportModal = false}
/> 