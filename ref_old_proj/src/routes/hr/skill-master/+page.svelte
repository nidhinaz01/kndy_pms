<script lang="ts">
  import { onMount } from 'svelte';
  import { supabase } from '$lib/supabaseClient';
  import { theme } from '$lib/stores/theme';
  import { fetchSkillNames, fetchSkillShorts, fetchSkillMaster, saveSkillMaster, updateSkillMaster, deleteSkillMaster, checkSkillNameExists, checkSkillShortExists, getUsernameFromEmail } from '$lib/api/skillMaster';
  import { getTodayString } from '$lib/utils/dateValidation';
  import SortableDataTable from '$lib/components/common/SortableDataTable.svelte';
  import AppHeader from '$lib/components/common/AppHeader.svelte';
  import FloatingThemeToggle from '$lib/components/common/FloatingThemeToggle.svelte';
  import Sidebar from '$lib/components/navigation/Sidebar.svelte';
  import { fetchUserMenus } from '$lib/api/menu';
  import Button from '$lib/components/common/Button.svelte';
  import { sanitizeString, isValidTrimmedString } from '$lib/utils/inputSanitization';

  // State management
  let skillNames: string[] = [];
  let skillShorts: string[] = [];
  let selectedSkillName = '';
  let selectedSkillShort = '';
  let ratePerHour = '';
  let minSalary = '';
  let maxSalary = '';
  let wef = '';
  let isLoading = false;
  let message = '';
  let messageType: 'success' | 'error' = 'success';
  let refreshTable = 0;
  let showSidebar = false;
  let menus: any[] = [];
  let isEditMode = false;
  let editingSkillId: number | null = null;
  let skills: any[] = [];

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
      const rawSkills = await fetchSkillMaster();
      
      // Convert emails to usernames for display
      skills = await Promise.all(
        rawSkills.map(async (skill: any) => {
          // Check if modified_by looks like an email
          if (skill.modified_by && skill.modified_by.includes('@')) {
            const username = await getUsernameFromEmail(skill.modified_by);
            return { ...skill, modified_by: username };
          }
          return skill;
        })
      );
    } catch (error) {
      console.error('Error loading skills:', error);
    }
  }

  async function handleDeleteSkill(id: number, skillName: string) {
    if (!confirm(`Are you sure you want to delete "${skillName}"?`)) {
      return;
    }

    try {
      await deleteSkillMaster(id);
      await loadSkills();
      showMessage('Skill deleted successfully!', 'success');
    } catch (error) {
      console.error('Error deleting skill:', error);
      showMessage('Error deleting skill', 'error');
    }
  }

  // Save skill master
  async function handleSaveSkillMaster() {
    if (!selectedSkillName) {
      showMessage('Skill Name is required', 'error');
      return;
    }

    if (!selectedSkillShort) {
      showMessage('Skill Code is required', 'error');
      return;
    }

    if (!ratePerHour || isNaN(Number(ratePerHour)) || Number(ratePerHour) <= 0) {
      showMessage('Rate per hour must be a positive number', 'error');
      return;
    }

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

    // Validate date (not future date)
    const today = new Date();
    today.setHours(23, 59, 59, 999); // End of today
    
    const wefDate = new Date(wef);
    
    if (wefDate > today) {
      showMessage('WEF date cannot be a future date', 'error');
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

      // Only validate duplicates if not in edit mode (since skill name and code can't be changed in edit mode)
      if (!isEditMode) {
        // Check if skill name already exists
        const skillNameExists = await checkSkillNameExists(selectedSkillName);
        if (skillNameExists) {
          showMessage(`Skill name "${selectedSkillName}" already exists. Please select a different skill name.`, 'error');
          return;
        }

        // Check if skill short already exists
        const skillShortExists = await checkSkillShortExists(selectedSkillShort);
        if (skillShortExists) {
          showMessage(`Skill code "${selectedSkillShort}" already exists. Please select a different skill code.`, 'error');
          return;
        }

        // Check if the combination of skill name and skill short already exists
        const { data: existingCombination } = await supabase
          .from('hr_skill_master')
          .select('id')
          .eq('skill_name', selectedSkillName)
          .eq('skill_short', selectedSkillShort)
          .maybeSingle();

        if (existingCombination) {
          showMessage(`The combination of skill name "${selectedSkillName}" and skill code "${selectedSkillShort}" already exists.`, 'error');
          return;
        }
      }

      // Get username from email
      const username = await getUsernameFromEmail(user.email);

      if (isEditMode && editingSkillId) {
        // Update existing skill master
        await updateSkillMaster(editingSkillId, {
          rate_per_hour: Number(ratePerHour),
          min_salary: Number(minSalary),
          max_salary: Number(maxSalary),
          wef: wef,
          modified_by: username
        });

        showMessage('Skill master updated successfully!', 'success');
      } else {
        // Save new skill master
        await saveSkillMaster({
          skill_name: selectedSkillName,
          skill_short: selectedSkillShort,
          rate_per_hour: Number(ratePerHour),
          min_salary: Number(minSalary),
          max_salary: Number(maxSalary),
          wef: wef,
          modified_by: username
        });

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
    ratePerHour = '';
    minSalary = '';
    maxSalary = '';
    wef = '';
    isEditMode = false;
    editingSkillId = null;
  }

  function handleEdit(skill: any) {
    isEditMode = true;
    editingSkillId = skill.id;
    selectedSkillName = skill.skill_name;
    selectedSkillShort = skill.skill_short;
    ratePerHour = skill.rate_per_hour.toString();
    minSalary = skill.min_salary.toString();
    maxSalary = skill.max_salary.toString();
    wef = skill.wef;
  }

  function handleSidebarToggle() {
    showSidebar = !showSidebar;
  }

  onMount(async () => {
    // Check if user is logged in
    const session = await supabase.auth.getSession();
    const user = session.data.session?.user;
    
    if (!user) {
      window.location.href = '/login';
      return;
    }

    console.log('User authenticated, loading skill master data');
    await loadSkillData();
    await loadSkills();

    // Load menus
    const username = localStorage.getItem('username');
    if (username) {
      menus = await fetchUserMenus();
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
  />

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
          {isEditMode ? 'Edit Skill' : 'Add New Skill'}
        </h2>
        
        <form on:submit|preventDefault={handleSaveSkillMaster} class="space-y-6">
          <!-- Skill Name -->
          <div>
            <label for="skillName" class="block text-sm font-medium theme-text-primary mb-2">
              Skill Name *
            </label>
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
            <p class="mt-1 text-xs theme-text-secondary">
              {isEditMode ? 'Skill name cannot be changed in edit mode' : 'Skill name must be unique'}
            </p>
          </div>

          <!-- Skill Code -->
          <div>
            <label for="skillShort" class="block text-sm font-medium theme-text-primary mb-2">
              Skill Code *
            </label>
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
              placeholder="Enter rate per hour"
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
              max={getTodayString()}
              class="w-full px-3 py-2 border theme-border rounded-lg theme-bg-primary theme-text-primary focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>

          <!-- Save Button -->
          <div class="pt-4">
            <Button
              type="submit"
              disabled={isLoading}
              fullWidth={true}
              size="lg"
            >
              {isLoading ? (isEditMode ? 'Updating...' : 'Saving...') : (isEditMode ? 'Update Skill Master' : 'Save Skill Master')}
            </Button>
          </div>
        </form>
      </div>
    </div>

    <!-- Table Section -->
    <div class="w-7/10">
      <SortableDataTable
        data={skills}
        columns={[
          { key: 'skill_name', label: 'Skill Name', sortable: true, filterable: true },
          { key: 'skill_short', label: 'Skill Code', sortable: true, filterable: true },
          { key: 'rate_per_hour', label: 'Rate/Hour', sortable: true, filterable: true, type: 'currency' },
          { key: 'min_salary', label: 'Min Salary', sortable: true, filterable: true, type: 'currency' },
          { key: 'max_salary', label: 'Max Salary', sortable: true, filterable: true, type: 'currency' },
          { key: 'wef', label: 'WEF', sortable: true, filterable: true, type: 'date' },
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
            onClick: (skill) => handleDeleteSkill(skill.id, skill.skill_name),
            color: 'red'
          }
        ]}
        title="Skill Master Records"
      />
    </div>
  </div>
</div>

<!-- Floating Theme Toggle -->
<FloatingThemeToggle /> 