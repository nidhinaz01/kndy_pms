<script lang="ts">
  import { onMount } from 'svelte';
  import { theme } from '$lib/stores/theme';
  import { fetchSkillMaster, deleteSkillMaster, getUsernameFromEmail } from '$lib/api/skillMaster';
  import { formatDate, formatDateDDMMMYYYY } from '$lib/utils/formatDate';

  export let refreshTrigger = 0;
  export let onEdit: (skill: any) => void = () => {};

  let skills: any[] = [];
  let isLoading = true;
  let error = '';

  async function loadSkills() {
    try {
      isLoading = true;
      error = '';
      const rawSkills = await fetchSkillMaster();
      
      // Convert emails to usernames for display
      skills = await Promise.all(
        rawSkills.map(async (skill) => {
          // Check if modified_by looks like an email
          if (skill.modified_by && skill.modified_by.includes('@')) {
            const username = await getUsernameFromEmail(skill.modified_by);
            return { ...skill, modified_by: username };
          }
          return skill;
        })
      );
    } catch (err) {
      console.error('Error loading skills:', err);
      error = 'Failed to load skills';
    } finally {
      isLoading = false;
    }
  }

  async function handleDelete(id: number, skillName: string) {
    if (!confirm(`Are you sure you want to delete "${skillName}"?`)) {
      return;
    }

    try {
      await deleteSkillMaster(id);
      await loadSkills();
    } catch (err) {
      console.error('Error deleting skill:', err);
      alert('Failed to delete skill');
    }
  }

  $: if (refreshTrigger > 0) {
    loadSkills();
  }

  onMount(() => {
    loadSkills();
  });
</script>

<div class="theme-bg-primary shadow rounded-lg overflow-hidden">
  <div class="px-6 py-4 border-b theme-border">
    <h3 class="text-lg font-semibold theme-text-primary">Skill Master Records</h3>
  </div>

  {#if isLoading}
    <div class="p-6 text-center">
      <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      <p class="mt-2 theme-text-secondary">Loading skills...</p>
    </div>
  {:else if error}
    <div class="p-6 text-center">
      <p class="text-red-600">{error}</p>
    </div>
  {:else if skills.length === 0}
    <div class="p-6 text-center">
      <p class="theme-text-tertiary">No skill records found</p>
    </div>
  {:else}
    <div class="overflow-x-auto">
      <table class="min-w-full divide-y theme-border">
        <thead class="theme-bg-secondary">
                      <tr>
              <th class="px-6 py-3 text-left text-xs font-medium theme-text-secondary uppercase tracking-wider">
                Skill Name
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium theme-text-secondary uppercase tracking-wider">
                Skill Short
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium theme-text-secondary uppercase tracking-wider">
                Rate/Hour
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium theme-text-secondary uppercase tracking-wider">
                Min Salary
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium theme-text-secondary uppercase tracking-wider">
                Max Salary
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium theme-text-secondary uppercase tracking-wider">
                WEF
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium theme-text-secondary uppercase tracking-wider">
                Modified By
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium theme-text-secondary uppercase tracking-wider">
                Modified Date
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium theme-text-secondary uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody class="theme-bg-primary divide-y theme-border">
            {#each skills as skill}
              <tr class="hover:theme-bg-tertiary">
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium theme-text-primary">
                  {skill.skill_name}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm theme-text-primary">
                  {skill.skill_short}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm theme-text-primary">
                  ₹{skill.rate_per_hour}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm theme-text-primary">
                  ₹{skill.min_salary.toLocaleString()}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm theme-text-primary">
                  ₹{skill.max_salary.toLocaleString()}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm theme-text-primary">
                  {formatDateDDMMMYYYY(skill.wef)}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm theme-text-primary">
                  {skill.modified_by}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm theme-text-primary">
                  {formatDate(skill.modified_dt)}
                </td>
                                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  <div class="flex space-x-2">
                    <button
                      on:click={() => onEdit(skill)}
                      class="text-blue-600 hover:text-blue-900"
                      title="Edit skill"
                      aria-label="Edit skill"
                    >
                      <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button
                      on:click={() => handleDelete(skill.id, skill.skill_name)}
                      class="text-red-600 hover:text-red-900"
                      title="Delete skill"
                      aria-label="Delete skill"
                    >
                      <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
</div> 