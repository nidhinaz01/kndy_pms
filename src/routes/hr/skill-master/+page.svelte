<script lang="ts">
  import { onMount } from 'svelte';
  import { fetchSkillNames, fetchSkillShorts, saveSkillMaster, updateSkillMaster, deleteSkillMaster, checkSkillNameExists, checkSkillShortExists, exportTemplate, importSkills } from '$lib/api/skillMaster';
  import { saveSkillName, saveSkillCode } from '$lib/api/dataElements';
  import AppHeader from '$lib/components/common/AppHeader.svelte';
  import FloatingThemeToggle from '$lib/components/common/FloatingThemeToggle.svelte';
  import Sidebar from '$lib/components/navigation/Sidebar.svelte';
  import { fetchUserMenus } from '$lib/services/menuService';
  import DataTable from '$lib/components/common/DataTable.svelte';
  import { Trash2, Edit } from 'lucide-svelte';
  import { loadSkillsWithUsernames } from './services/skillMasterService';
  import { validateSkillMasterForm, formatWefDate } from './utils/skillMasterValidation';
  import SkillMasterForm from './components/SkillMasterForm.svelte';
  import ImportModal from './components/ImportModal.svelte';

  // State management
  let skillNames: string[] = [];
  let skillShorts: string[] = [];
  let selectedSkillName = '';
  let selectedSkillShort = '';
  let newSkillName = '';
  let newSkillCode = '';
  let useExistingSkills = true;
  let ratePerHour = '';
  let minSalary = '';
  let maxSalary = '';
  let wef = '';
  let isActive = true;
  let isLoading = false;
  let message = '';
  let messageType: 'success' | 'error' = 'success';
  let showSidebar = false;
  let menus: any[] = [];
  let isEditMode = false;
  let editingSkillId: number | null = null;
  let skills: any[] = [];
  let tableLoading = false;
  
  // Import functionality
  let showImportModal = false;
  let importFile: File | null = null;
  let importResults: { success: number; errors: string[] } | null = null;

  // Load existing skill names and shorts
  async function loadSkillData() {
    try {
      [skillNames, skillShorts] = await Promise.all([
        fetchSkillNames(),
        fetchSkillShorts()
      ]);
    } catch (error) {
      console.error('Error loading skill data:', error);
    }
  }

  // Load skills for table
  async function loadSkills() {
    try {
      tableLoading = true;
      skills = await loadSkillsWithUsernames();
    } catch (error) {
      console.error('Error loading skills:', error);
    } finally {
      tableLoading = false;
    }
  }

  async function handleDeleteSkill(skill: any) {
    if (!confirm(`Are you sure you want to delete "${skill.skill_name}"?`)) {
      return;
    }

    try {
      const username = localStorage.getItem('username');
      if (!username) {
        showMessage('User session not found', 'error');
        return;
      }

      await deleteSkillMaster(skill.id, username);
      await loadSkills();
      showMessage('Skill deleted successfully!', 'success');
    } catch (error) {
      console.error('Error deleting skill:', error);
      showMessage('Error deleting skill', 'error');
    }
  }

  async function handleEdit(skill: any) {
    isEditMode = true;
    editingSkillId = skill.id;
    selectedSkillName = skill.skill_name;
    selectedSkillShort = skill.skill_short;
    ratePerHour = skill.rate_per_hour.toString();
    minSalary = skill.min_salary.toString();
    maxSalary = skill.max_salary.toString();
    wef = formatWefDate(skill.wef);
    isActive = skill.is_active;
  }

  // Save skill master
  async function handleSaveSkillMaster() {
    // Validate form
    const validation = validateSkillMasterForm(
      useExistingSkills,
      selectedSkillName,
      selectedSkillShort,
      newSkillName,
      newSkillCode,
      ratePerHour,
      minSalary,
      maxSalary,
      wef
    );

    if (!validation.isValid) {
      validation.errors.forEach(error => showMessage(error, 'error'));
      return;
    }

    // Determine which skill name and code to use
    const skillName = useExistingSkills ? selectedSkillName : newSkillName.trim();
    const skillCode = useExistingSkills ? selectedSkillShort : newSkillCode.trim();
    const roundedRate = Math.round(Number(ratePerHour));

    // Validate WEF date - allow future dates but prompt for confirmation
    const wefDate = new Date(wef);
    const today = new Date();
    wefDate.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);
    
    if (wefDate > today) {
      const confirmFutureDate = confirm(`The WEF date (${wef}) is in the future. Are you sure you want to proceed?`);
      if (!confirmFutureDate) {
        return;
      }
    }

    isLoading = true;

    try {
      const username = localStorage.getItem('username');
      if (!username) {
        showMessage('User session not found', 'error');
        return;
      }

      // Only validate duplicates if not in edit mode
      if (!isEditMode) {
        const skillNameExists = await checkSkillNameExists(skillName);
        if (skillNameExists) {
          showMessage(`Skill name "${skillName}" already exists. Please select a different skill name.`, 'error');
          return;
        }

        const skillShortExists = await checkSkillShortExists(skillCode);
        if (skillShortExists) {
          showMessage(`Skill code "${skillCode}" already exists. Please select a different skill code.`, 'error');
          return;
        }

        // If using new skills, add them to data elements first
        if (!useExistingSkills) {
          try {
            await saveSkillName(skillName, username);
            await saveSkillCode(skillCode, username);
            await loadSkillData();
          } catch (error) {
            console.error('Error saving new skill to data elements:', error);
            showMessage(`Error saving new skill: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
            return;
          }
        }
      }

      if (isEditMode && editingSkillId) {
        await updateSkillMaster(editingSkillId, {
          rate_per_hour: roundedRate,
          min_salary: Number(minSalary),
          max_salary: Number(maxSalary),
          wef: wef,
          is_active: isActive
        }, username);
        showMessage('Skill master updated successfully!', 'success');
      } else {
        await saveSkillMaster({
          skill_name: skillName,
          skill_short: skillCode,
          rate_per_hour: roundedRate,
          min_salary: Number(minSalary),
          max_salary: Number(maxSalary),
          wef: wef,
          is_active: isActive
        }, username);
        showMessage('Skill master saved successfully!', 'success');
      }
      
      resetForm();
      await loadSkills();
    } catch (error) {
      console.error('Error saving skill master:', error);
      showMessage('Error saving skill master', 'error');
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
    selectedSkillName = '';
    selectedSkillShort = '';
    newSkillName = '';
    newSkillCode = '';
    useExistingSkills = true;
    ratePerHour = '';
    minSalary = '';
    maxSalary = '';
    wef = '';
    isActive = true;
    isEditMode = false;
    editingSkillId = null;
  }



  function handleSidebarToggle() {
    showSidebar = !showSidebar;
  }

  // Import functionality
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

      importResults = await importSkills(text, username);
      
      if (importResults.success > 0) {
        showMessage(`Successfully imported ${importResults.success} skills!`, 'success');
        await loadSkills(); // Refresh the table
      }
      
      if (importResults.errors.length > 0) {
        console.error('Import errors:', importResults.errors);
      }
      
    } catch (error) {
      console.error('Error importing skills:', error);
      showMessage('Error importing skills', 'error');
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

    console.log('User authenticated, loading skill master data');
    await loadSkillData();
    await loadSkills();

    // Load menus
    if (username) {
      menus = await fetchUserMenus(username);
    }
  });
</script>

<svelte:head>
  <title>Skill Master Management</title>
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
    title="Skill Master Management"
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
      <SkillMasterForm
        {skillNames}
        {skillShorts}
        bind:selectedSkillName
        bind:selectedSkillShort
        bind:newSkillName
        bind:newSkillCode
        bind:useExistingSkills
        bind:ratePerHour
        bind:minSalary
        bind:maxSalary
        bind:wef
        bind:isActive
        {isEditMode}
        {isLoading}
        onSave={handleSaveSkillMaster}
      />
    </div>

    <!-- Right Side - Existing Skills -->
    <div class="w-7/10">
      <DataTable
        data={skills}
        columns={[
          { key: 'skill_name', label: 'Skill Name', sortable: true, filterable: true, type: 'text' },
          { key: 'skill_short', label: 'Skill Code', sortable: true, filterable: true, type: 'text' },
          { key: 'rate_per_hour', label: 'Rate/Hour', sortable: true, filterable: true, type: 'number' },
          { key: 'min_salary', label: 'Min Salary', sortable: true, filterable: true, type: 'number' },
          { key: 'max_salary', label: 'Max Salary', sortable: true, filterable: true, type: 'number' },
          { key: 'wef', label: 'WEF', sortable: true, filterable: true, type: 'date' },
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
            onClick: handleDeleteSkill
          }
        ]}
        title="Skill Master Records"
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
  bind:isLoading
  onExportTemplate={handleExportTemplate}
  onFileSelect={handleFileSelect}
  onImport={handleImport}
  onClose={() => showImportModal = false}
/> 