<script lang="ts">
  import { onMount, createEventDispatcher } from 'svelte';
  import { fetchSkills, saveSkillCombination, generateCombinationName } from '$lib/api/skillCombinations';
  import Button from '$lib/components/common/Button.svelte';

  export let showAddModal: boolean;
  export let onClose: () => void;
  export let onItemAdded: () => void;

  let skills: Array<{ skill_id: number; skill_name: string }> = [];
  let manpowerRequired = 1;
  let selectedSkills: Array<{ skill_id: number; skill_name: string; skill_order: number }> = [];
  let errorMsg = '';
  let submitting = false;
  let showDuplicateWarning = false;
  let pendingSkillChange: { index: number; skillId: string } | null = null;
  let generatedName = '';

  const dispatch = createEventDispatcher();

  onMount(async () => {
    try {
      skills = await fetchSkills();
      console.log('Loaded skills:', skills);
    } catch (error) {
      console.error('Error loading skills:', error);
      skills = [];
    }
  });

  // Generate combination name when skills change
  $: if (selectedSkills.length > 0) {
    generatedName = generateCombinationName(selectedSkills);
  } else {
    generatedName = '';
  }

  // Reset form when manpower changes
  $: if (manpowerRequired) {
    // Reset selected skills when manpower changes
    selectedSkills = [];
  }

  // Create array for dropdowns based on manpower
  $: skillDropdowns = Array.from({ length: manpowerRequired }, (_, i) => i);

  // Create reactive array for dropdown values
  $: dropdownValues = skillDropdowns.map(index => getSelectedSkillId(index));

  function handleSkillChange(index: number, skillId: string) {
    if (!skillId) {
      // Remove skill if empty selection
      selectedSkills = selectedSkills.filter((_, i) => i !== index);
      return;
    }

    const skill = skills.find(s => s.skill_id.toString() === skillId);
    if (!skill) return;

    // Check if skill is already selected in another dropdown
    const isAlreadySelected = selectedSkills.some((s, i) => i !== index && s.skill_id === skill.skill_id);
    if (isAlreadySelected) {
      // Show warning instead of preventing
      pendingSkillChange = { index, skillId };
      showDuplicateWarning = true;
      return;
    }

    // Apply the skill change directly
    applySkillChange(index, skillId);
  }

  function applySkillChange(index: number, skillId: string) {
    const skill = skills.find(s => s.skill_id.toString() === skillId);
    if (!skill) return;

    // Update or add skill at the specific index
    const newSelectedSkills = [...selectedSkills];
    newSelectedSkills[index] = {
      skill_id: skill.skill_id,
      skill_name: skill.skill_name,
      skill_order: index + 1
    };
    
    // Remove any skills beyond the current index to maintain order
    selectedSkills = newSelectedSkills.slice(0, index + 1);
    errorMsg = '';
  }

  function handleDuplicateWarningContinue() {
    if (pendingSkillChange) {
      applySkillChange(pendingSkillChange.index, pendingSkillChange.skillId);
    }
    showDuplicateWarning = false;
    pendingSkillChange = null;
  }

  function handleDuplicateWarningCancel() {
    showDuplicateWarning = false;
    pendingSkillChange = null;
  }

  function getSelectedSkillId(index: number): string {
    const skill = selectedSkills[index];
    return skill ? skill.skill_id.toString() : '';
  }

  function isSkillSelected(skillId: number, currentIndex: number): boolean {
    return selectedSkills.some((s, i) => i !== currentIndex && s.skill_id === skillId);
  }

  function handleDropdownChange(index: number, event: Event) {
    const target = event.target as HTMLSelectElement;
    if (target) {
      handleSkillChange(index, target.value);
    }
  }

  async function handleSubmit() {
    errorMsg = '';
    
    if (manpowerRequired < 1) {
      errorMsg = 'Manpower required must be at least 1.';
      return;
    }

    if (selectedSkills.length !== manpowerRequired) {
      errorMsg = `You must select exactly ${manpowerRequired} skills for ${manpowerRequired} manpower.`;
      return;
    }

    if (selectedSkills.length === 0) {
      errorMsg = 'Please select at least one skill.';
      return;
    }

    submitting = true;
    try {
      await saveSkillCombination({
        manpower_required: manpowerRequired,
        skill_combination: selectedSkills
      });
      
      // Reset form
      manpowerRequired = 1;
      selectedSkills = [];
      generatedName = '';
      onItemAdded();
    } catch (e: any) {
      errorMsg = e.message || 'Error saving skill combination.';
    } finally {
      submitting = false;
    }
  }

  function handleClose() {
    manpowerRequired = 1;
    selectedSkills = [];
    generatedName = '';
    errorMsg = '';
    showDuplicateWarning = false;
    pendingSkillChange = null;
    onClose();
  }
</script>

{#if showAddModal}
  <div class="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
    <div class="theme-bg-primary rounded-2xl shadow-2xl p-8 w-[40rem] max-h-[90vh] overflow-y-auto animate-fade-in">
      <div class="flex items-center justify-between mb-6">
        <div class="font-bold text-lg theme-text-accent flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 theme-text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
          </svg>
          Add Skill Combination
        </div>
        <button class="theme-text-secondary hover:theme-text-accent transition-colors" on:click={handleClose} aria-label="Close modal">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {#if errorMsg}
        <div class="bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 p-3 rounded-lg mb-4">
          {errorMsg}
        </div>
      {/if}

      <form on:submit|preventDefault={handleSubmit} class="space-y-6">
        <!-- Manpower Required -->
        <div>
          <label for="manpower" class="block text-sm font-medium theme-text-primary mb-2">
            Manpower Required *
          </label>
          <input 
            id="manpower"
            type="number" 
            bind:value={manpowerRequired}
            min="1" 
            max="10"
            class="w-full border theme-border rounded px-3 py-2 theme-bg-secondary theme-text-primary" 
            required 
          />
          <p class="mt-1 text-xs theme-text-secondary">
            Enter the number of workers needed. You will then select that many skills.
          </p>
        </div>

        <!-- Generated Combination Name -->
        {#if generatedName}
          <div>
            <label for="generatedName" class="block text-sm font-medium theme-text-primary mb-2">
              Generated Combination Name
            </label>
            <input 
              id="generatedName"
              type="text" 
              value={generatedName}
              class="w-full border theme-border rounded px-3 py-2 theme-bg-tertiary theme-text-secondary" 
              readonly 
            />
            <p class="mt-1 text-xs theme-text-secondary">
              This name will be automatically generated from the selected skills.
            </p>
          </div>
        {/if}

        <!-- Skill Selection Dropdowns -->
        {#if manpowerRequired > 0}
          <div>
            <span class="block text-sm font-medium theme-text-primary mb-3">
              Select Skills for Each Position
            </span>
            <div class="space-y-3">
              {#each skillDropdowns as index}
                <div class="flex items-center gap-3">
                  <span class="text-sm font-medium theme-text-primary min-w-[60px]">
                    Position {index + 1}:
                  </span>
                  <select
                    bind:value={dropdownValues[index]}
                    on:change={(e) => handleDropdownChange(index, e)}
                    class="flex-1 border theme-border rounded px-3 py-2 theme-bg-secondary theme-text-primary"
                    required
                  >
                    <option value="">-- Select a skill --</option>
                    {#each skills as skill}
                      <option value={skill.skill_id.toString()}>
                        {skill.skill_name}
                        {#if isSkillSelected(skill.skill_id, index)}
                          (Already selected)
                        {/if}
                      </option>
                    {/each}
                  </select>
                </div>
              {/each}
            </div>
          </div>
        {/if}

        <!-- Action Buttons -->
        <div class="flex justify-between gap-3 pt-4">
          <Button variant="primary" size="md" disabled={submitting || selectedSkills.length !== manpowerRequired}>
            {submitting ? 'Creating...' : 'Create Combination'}
          </Button>
          <Button variant="secondary" size="md" on:click={handleClose}>Cancel</Button>
        </div>
      </form>
    </div>
  </div>
{/if}

<!-- Duplicate Skill Warning Modal -->
{#if showDuplicateWarning}
  <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-60">
    <div class="theme-bg-primary rounded-2xl shadow-2xl w-[32rem] animate-fade-in">
      <div class="p-6">
        <div class="flex items-center mb-4">
          <svg class="w-6 h-6 text-yellow-500 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
          <h3 class="text-lg font-semibold theme-text-accent">Duplicate Skill Warning</h3>
        </div>
        
        <div class="mb-6">
          <p class="theme-text-primary mb-2">
            This skill is already selected in another position. Are you sure you want to continue?
          </p>
          <p class="text-sm theme-text-secondary">
            You can have the same skill in multiple positions if needed for your skill combination.
          </p>
        </div>

        <div class="flex justify-end gap-3">
          <Button variant="secondary" size="md" on:click={handleDuplicateWarningCancel}>
            Cancel
          </Button>
          <Button variant="primary" size="md" on:click={handleDuplicateWarningContinue}>
            Continue
          </Button>
        </div>
      </div>
    </div>
  </div>
{/if}

<style>
  @keyframes fade-in {
    from { opacity: 0; transform: translateY(20px); }
    to { opacity: 1; transform: translateY(0); }
  }
  .animate-fade-in {
    animation: fade-in 0.2s ease;
  }
</style> 