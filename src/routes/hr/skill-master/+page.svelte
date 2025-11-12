<script lang="ts">
  import { onMount } from 'svelte';
  import { supabase } from '$lib/supabaseClient';
  import { theme } from '$lib/stores/theme';
  import { fetchSkillNames, fetchSkillShorts, fetchSkillMaster, saveSkillMaster, updateSkillMaster, deleteSkillMaster, toggleSkillMasterStatus, checkSkillNameExists, checkSkillShortExists, exportTemplate, importSkills } from '$lib/api/skillMaster';
  import { saveSkillName, saveSkillCode } from '$lib/api/dataElements';
  import AppHeader from '$lib/components/common/AppHeader.svelte';
  import FloatingThemeToggle from '$lib/components/common/FloatingThemeToggle.svelte';
  import Sidebar from '$lib/components/navigation/Sidebar.svelte';
  import { fetchUserMenus } from '$lib/services/menuService';
  import Button from '$lib/components/common/Button.svelte';
  import DataTable from '$lib/components/common/DataTable.svelte';
  import { Trash2, Edit } from 'lucide-svelte';

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
      console.log('Fetching skill master...');
      const rawSkills = await fetchSkillMaster();
      console.log('Raw skills:', rawSkills);
      
      // Get usernames for modified_by emails
      const emails = [...new Set(rawSkills.map(skill => skill.modified_by))];
      console.log('Emails to lookup:', emails);
      
      if (emails.length > 0) {
        const { data: users, error: userError } = await supabase
          .from('app_users')
          .select('email, username')
          .in('email', emails);
        
        console.log('Users lookup result:', users, userError);
        
        if (!userError && users) {
          const emailToUsername = new Map(users.map(u => [u.email, u.username]));
          skills = rawSkills.map(skill => ({
            ...skill,
            modified_by: emailToUsername.get(skill.modified_by) || skill.modified_by
          }));
        } else {
          skills = rawSkills;
        }
      } else {
        skills = rawSkills;
      }
      
      console.log('Final skills:', skills);
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
    // Handle WEF date - it's now a DATE type, so format it properly for the date input
    if (skill.wef) {
      // If it's already in YYYY-MM-DD format, use it directly
      if (typeof skill.wef === 'string' && skill.wef.match(/^\d{4}-\d{2}-\d{2}$/)) {
        wef = skill.wef;
      } else {
        // Convert from any other format to YYYY-MM-DD
        const date = new Date(skill.wef);
        wef = date.toISOString().split('T')[0];
      }
    } else {
      wef = '';
    }
    isActive = skill.is_active;
  }

  // Save skill master
  async function handleSaveSkillMaster() {
    // Determine which skill name and code to use
    let skillName = '';
    let skillCode = '';

    if (useExistingSkills) {
      if (!selectedSkillName) {
        showMessage('Skill Name is required', 'error');
        return;
      }
      if (!selectedSkillShort) {
        showMessage('Skill Code is required', 'error');
        return;
      }
      skillName = selectedSkillName;
      skillCode = selectedSkillShort;
    } else {
      if (!newSkillName.trim()) {
        showMessage('New Skill Name is required', 'error');
        return;
      }
      if (!newSkillCode.trim()) {
        showMessage('New Skill Code is required', 'error');
        return;
      }
      skillName = newSkillName.trim();
      skillCode = newSkillCode.trim();
    }

    if (ratePerHour === '' || isNaN(Number(ratePerHour)) || Number(ratePerHour) < 0) {
      showMessage('Rate per hour must be a non-negative number', 'error');
      return;
    }

    // Round rate to integer for storage
    const roundedRate = Math.round(Number(ratePerHour));

    if (!minSalary || isNaN(Number(minSalary)) || Number(minSalary) <= 0) {
      showMessage('Minimum salary must be a positive number', 'error');
      return;
    }

    if (!maxSalary || isNaN(Number(maxSalary)) || Number(maxSalary) <= 0) {
      showMessage('Maximum salary must be a positive number', 'error');
      return;
    }

    if (Number(minSalary) >= Number(maxSalary)) {
      showMessage('Maximum salary must be greater than minimum salary', 'error');
      return;
    }

    if (!wef) {
      showMessage('WEF (With Effect From) date is required', 'error');
      return;
    }

    // Validate WEF date - allow future dates but prompt for confirmation
    const wefDate = new Date(wef);
    const today = new Date();
    
    // Set both dates to start of day for proper comparison
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
      // Get current user
      const username = localStorage.getItem('username');
      if (!username) {
        showMessage('User session not found', 'error');
        return;
      }


      // Only validate duplicates if not in edit mode (since skill name and code can't be changed in edit mode)
      if (!isEditMode) {
        // Check if skill name already exists
        const skillNameExists = await checkSkillNameExists(skillName);
        if (skillNameExists) {
          showMessage(`Skill name "${skillName}" already exists. Please select a different skill name.`, 'error');
          return;
        }

        // Check if skill short already exists
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
            // Refresh the skill lists
            await loadSkillData();
          } catch (error) {
            console.error('Error saving new skill to data elements:', error);
            showMessage(`Error saving new skill: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
            return;
          }
        }
      }

      if (isEditMode && editingSkillId) {
        // Update existing skill master
        await updateSkillMaster(editingSkillId, {
          rate_per_hour: roundedRate,
          min_salary: Number(minSalary),
          max_salary: Number(maxSalary),
          wef: wef,
          is_active: isActive
        }, username);

        showMessage('Skill master updated successfully!', 'success');
      } else {
        // Save new skill master
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
      
      // Reset form
      resetForm();

      // Refresh the table
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
      <div class="theme-bg-primary rounded-lg shadow-lg p-6 border theme-border h-full">
        <h3 class="text-lg font-semibold theme-text-primary mb-6">
          {isEditMode ? 'Edit Skill' : 'Add New Skill'}
        </h3>
        
        <form on:submit|preventDefault={handleSaveSkillMaster} class="space-y-6">
          <!-- Skill Selection Toggle -->
          {#if !isEditMode}
            <fieldset>
              <legend class="block text-sm font-medium theme-text-primary mb-3">
                Skill Selection Method
              </legend>
              <div class="flex space-x-4">
                <label for="useExisting" class="flex items-center">
                  <input
                    id="useExisting"
                    type="radio"
                    bind:group={useExistingSkills}
                    value={true}
                    class="mr-2"
                  />
                  <span class="text-sm theme-text-primary">Use Existing Skills</span>
                </label>
                <label for="addNew" class="flex items-center">
                  <input
                    id="addNew"
                    type="radio"
                    bind:group={useExistingSkills}
                    value={false}
                    class="mr-2"
                  />
                  <span class="text-sm theme-text-primary">Add New Skills</span>
                </label>
              </div>
            </fieldset>
          {/if}

          <!-- Skill Name -->
          <div>
            <label for="skillName" class="block text-sm font-medium theme-text-primary mb-2">
              Skill Name *
            </label>
            {#if useExistingSkills || isEditMode}
              <select
                id="skillName"
                bind:value={selectedSkillName}
                class="w-full px-3 py-2 border theme-border rounded-lg theme-bg-primary theme-text-primary focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
                disabled={isEditMode}
              >
                <option value="">Select a skill name</option>
                {#each skillNames as name}
                  <option value={name}>{name}</option>
                {/each}
              </select>
            {:else}
              <input
                id="skillName"
                type="text"
                bind:value={newSkillName}
                class="w-full px-3 py-2 border theme-border rounded-lg theme-bg-primary theme-text-primary focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter new skill name"
                required
              />
            {/if}
            <p class="mt-1 text-xs theme-text-secondary">
              {isEditMode ? 'Skill name cannot be changed in edit mode' : 'Skill name must be unique'}
            </p>
          </div>

          <!-- Skill Code -->
          <div>
            <label for="skillShort" class="block text-sm font-medium theme-text-primary mb-2">
              Skill Code *
            </label>
            {#if useExistingSkills || isEditMode}
              <select
                id="skillShort"
                bind:value={selectedSkillShort}
                class="w-full px-3 py-2 border theme-border rounded-lg theme-bg-primary theme-text-primary focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
                disabled={isEditMode}
              >
                <option value="">Select a skill code</option>
                {#each skillShorts as short}
                  <option value={short}>{short}</option>
                {/each}
              </select>
            {:else}
              <input
                id="skillShort"
                type="text"
                bind:value={newSkillCode}
                class="w-full px-3 py-2 border theme-border rounded-lg theme-bg-primary theme-text-primary focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter new skill code"
                required
              />
            {/if}
            <p class="mt-1 text-xs theme-text-secondary">
              {isEditMode ? 'Skill code cannot be changed in edit mode' : 'Skill code must be unique'}
            </p>
          </div>

          <!-- Rate Per Hour -->
          <div>
            <label for="ratePerHour" class="block text-sm font-medium theme-text-primary mb-2">
              Rate Per Hour (₹) *
            </label>
            <input
              id="ratePerHour"
              type="number"
              bind:value={ratePerHour}
              min="0"
              step="0.01"
              class="w-full px-3 py-2 border theme-border rounded-lg theme-bg-primary theme-text-primary focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Enter rate per hour (0 is acceptable)"
              required
            />
          </div>

          <!-- Min Salary -->
          <div>
            <label for="minSalary" class="block text-sm font-medium theme-text-primary mb-2">
              Minimum Salary (₹) *
            </label>
            <input
              id="minSalary"
              type="number"
              bind:value={minSalary}
              min="0"
              step="0.01"
              class="w-full px-3 py-2 border theme-border rounded-lg theme-bg-primary theme-text-primary focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Enter minimum salary"
              required
            />
          </div>

          <!-- Max Salary -->
          <div>
            <label for="maxSalary" class="block text-sm font-medium theme-text-primary mb-2">
              Maximum Salary (₹) *
            </label>
            <input
              id="maxSalary"
              type="number"
              bind:value={maxSalary}
              min="0"
              step="0.01"
              class="w-full px-3 py-2 border theme-border rounded-lg theme-bg-primary theme-text-primary focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Enter maximum salary"
              required
            />
          </div>

          <!-- WEF Date -->
          <div>
            <label for="wef" class="block text-sm font-medium theme-text-primary mb-2">
              WEF (With Effect From) *
            </label>
            <input
              id="wef"
              type="date"
              bind:value={wef}
              class="w-full px-3 py-2 border theme-border rounded-lg theme-bg-primary theme-text-primary focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
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
              Select the status for this skill
            </p>
          </div>

          <!-- Submit Button -->
          <div class="flex justify-end">
            <Button
              variant="primary"
              size="lg"
              disabled={isLoading}
              on:click={handleSaveSkillMaster}
            >
              {#if isLoading}
                <svg class="animate-spin -ml-1 mr-3 h-5 w-5 text-white inline" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                {isEditMode ? 'Updating...' : 'Saving...'}
              {:else}
                {isEditMode ? 'Update Skill Master' : 'Save Skill Master'}
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
              <span>Select a skill name and skill code from the dropdowns. These must be pre-defined in the Data Elements.</span>
            </div>
            <div class="flex items-start space-x-2">
              <span class="text-blue-500 font-semibold">•</span>
              <span>Enter the rate per hour, minimum salary, and maximum salary for the skill.</span>
            </div>
            <div class="flex items-start space-x-2">
              <span class="text-blue-500 font-semibold">•</span>
              <span>Set the WEF (With Effect From) date when this skill rate becomes effective.</span>
            </div>
            <div class="flex items-start space-x-2">
              <span class="text-blue-500 font-semibold">•</span>
              <span>Maximum salary must be greater than minimum salary.</span>
            </div>
            <div class="flex items-start space-x-2">
              <span class="text-blue-500 font-semibold">•</span>
              <span>WEF date can be a future date, but you'll be prompted to confirm.</span>
            </div>
            <div class="flex items-start space-x-2">
              <span class="text-blue-500 font-semibold">•</span>
              <span>Select Active or Inactive status for the skill.</span>
            </div>
            <div class="flex items-start space-x-2">
              <span class="text-blue-500 font-semibold">•</span>
              <span>All fields marked with * are required.</span>
            </div>
          </div>
        </div>
      </div>
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
{#if showImportModal}
  <div class="fixed inset-0 z-50 flex items-center justify-center" role="dialog" aria-modal="true" tabindex="0">
    <div class="fixed inset-0 bg-black bg-opacity-50" on:click={() => showImportModal = false} on:keydown={(e) => e.key === 'Escape' && (showImportModal = false)} role="button" tabindex="0" aria-label="Close modal"></div>
    <div class="theme-bg-primary border theme-border rounded-lg p-6 w-96 max-w-md max-h-[90vh] overflow-y-auto relative z-10 shadow-xl">
      <h3 class="text-lg font-semibold theme-text-primary mb-4">Import Skills</h3>
      
      <div class="space-y-4">
        <!-- Template Export -->
        <div class="p-4 bg-blue-50 dark:bg-blue-900/30 rounded-lg border border-blue-200 dark:border-blue-700">
          <h4 class="text-sm font-semibold theme-text-primary mb-2">Step 1: Download Template</h4>
          <p class="text-xs theme-text-secondary mb-3">
            Download the CSV template to see the required format and add your skill data.
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
            <p class="break-words">• CSV must have columns: skill_name,skill_code,rate_per_hour,minimum_salary,maximum_salary,wef_date,status</p>
            <p>• skill_name: Skill name (must be unique)</p>
            <p>• skill_code: Skill code (must be unique)</p>
            <p>• rate_per_hour: Rate per hour (positive number)</p>
            <p>• minimum_salary: Minimum salary (positive number)</p>
            <p>• maximum_salary: Maximum salary (positive number, must be greater than minimum)</p>
            <p class="break-words">• wef_date: WEF date (YYYY-MM-DD format, e.g., 2024-01-15)</p>
            <p>• status: Status (Active or Inactive)</p>
          </div>
        </div>
        
        <!-- Import Results -->
        {#if importResults}
          <div class="p-3 rounded-lg border {importResults.success > 0 ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 border-green-200 dark:border-green-700' : 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200 border-red-200 dark:border-red-700'}">
            <div class="text-sm font-medium mb-2">
              Import Results: {importResults.success} skills imported successfully
            </div>
            {#if importResults.errors.length > 0}
              <div class="text-xs">
                <div class="font-medium mb-1">Errors:</div>
                <div class="max-h-32 overflow-y-auto space-y-1">
                  {#each importResults.errors as error}
                    <div class="break-words">{error}</div>
                  {/each}
                </div>
              </div>
            {/if}
          </div>
        {/if}
        
        <!-- Action Buttons -->
        <div class="flex justify-end space-x-3">
          <Button
            variant="secondary"
            on:click={() => showImportModal = false}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            on:click={handleImport}
            disabled={!importFile}
          >
            Import Skills
          </Button>
        </div>
      </div>
    </div>
  </div>
{/if} 