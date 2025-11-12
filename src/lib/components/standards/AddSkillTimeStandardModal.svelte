<script lang="ts">
  import { onMount, createEventDispatcher } from 'svelte';
  import { fetchAllWorkSkillMappings, debugWorkSkillMappingData } from '$lib/api/stdWorkSkillMapping';
  import { fetchSkills, debugSkillCombinations } from '$lib/api/skillCombinations';
  import { saveSkillTimeStandard } from '$lib/api/stdSkillTimeStandards';
  import Button from '$lib/components/common/Button.svelte';

  export let showAddModal: boolean;
  export let onClose: () => void;
  export let onItemAdded: () => void;

  let workSkillMappings: any[] = [];
  let skills: any[] = [];
  let selectedMapping = '';
  let selectedSkill = '';
  let standardTimeMinutes = 0;
  let skillOrder = 1;
  let errorMsg = '';
  let submitting = false;

  const dispatch = createEventDispatcher();

  onMount(async () => {
    try {
      // Debug skill combinations first
      await debugSkillCombinations();
      
      // Debug work-skill mapping data
      await debugWorkSkillMappingData();
      
      [workSkillMappings, skills] = await Promise.all([
        fetchAllWorkSkillMappings(),
        fetchSkills()
      ]);
      
      console.log('Loaded work-skill mappings:', workSkillMappings);
      console.log('Loaded skills:', skills);
      
      // Debug: Check if any mappings have skill combinations
      workSkillMappings.forEach((mapping, index) => {
        console.log(`Mapping ${index}:`, {
          wsm_id: mapping.wsm_id,
          derived_sw_code: mapping.derived_sw_code,
          sc_name: mapping.sc_name,
          skill_combinations: mapping.std_skill_combinations,
          skill_combination_data: mapping.std_skill_combinations?.skill_combination
        });
      });
    } catch (error) {
      console.error('Error loading data:', error);
      workSkillMappings = [];
      skills = [];
    }
  });

  // Get available skills for selected mapping
  $: availableSkills = selectedMapping ? 
    (() => {
      const mapping = workSkillMappings.find(m => m.wsm_id === parseInt(selectedMapping));
      if (!mapping) return [];
      
      console.log('Processing mapping:', mapping);
      
      // Handle both array and single object cases for skill combinations
      const skillCombinations = mapping.std_skill_combinations as any;
      console.log('Skill combinations raw:', skillCombinations);
      
      let skillCombination;
      if (Array.isArray(skillCombinations)) {
        skillCombination = skillCombinations[0]?.skill_combination;
        console.log('Skill combination from array:', skillCombination);
      } else {
        skillCombination = skillCombinations?.skill_combination;
        console.log('Skill combination from object:', skillCombination);
      }
        
      if (!skillCombination) {
        console.log('No skill combination found');
        return [];
      }
      
      console.log('Skill combination type:', typeof skillCombination);
      console.log('Skill combination value:', skillCombination);
      
      // Handle the JSON array structure: Array<{skill_id: number, skill_name: string, skill_order: number}>
      if (Array.isArray(skillCombination)) {
        console.log('Skill combination is array, length:', skillCombination.length);
        const skills = skillCombination
          .map((s: any) => s.skill_name)
          .filter(Boolean)
          .sort();
        console.log('Extracted skills from array:', skills);
        return skills;
      } else if (typeof skillCombination === 'string') {
        // If it's a JSON string, try to parse it
        console.log('Skill combination is string, attempting to parse...');
        try {
          const parsed = JSON.parse(skillCombination);
          console.log('Parsed skill combination:', parsed);
          if (Array.isArray(parsed)) {
            const skills = parsed
              .map((s: any) => s.skill_name)
              .filter(Boolean)
              .sort();
            console.log('Extracted skills from parsed string:', skills);
            return skills;
          }
        } catch (e) {
          console.error('Error parsing skill combination JSON:', e);
        }
      }
      
      console.log('No valid skill data found');
      return [];
    })() : [];

  // Debug logging
  $: if (selectedMapping) {
    console.log('Selected mapping ID:', selectedMapping, 'Type:', typeof selectedMapping);
    console.log('Available work-skill mappings:', workSkillMappings);
    
    // Try different comparison methods
    const selectedMappingNum = parseInt(selectedMapping);
    console.log('Parsed selectedMapping:', selectedMappingNum, 'Type:', typeof selectedMappingNum);
    
    const selectedMappingData = workSkillMappings.find(m => m.wsm_id === selectedMappingNum);
    console.log('Selected mapping data:', selectedMappingData);
    
    if (!selectedMappingData) {
      console.log('Mapping not found! Available mappings:');
      workSkillMappings.forEach((mapping, index) => {
        console.log(`  Mapping ${index}: wsm_id=${mapping.wsm_id} (type: ${typeof mapping.wsm_id}), selectedMapping=${selectedMapping} (type: ${typeof selectedMapping}), selectedMappingNum=${selectedMappingNum} (type: ${typeof selectedMappingNum})`);
        console.log(`  Comparison: ${mapping.wsm_id} === ${selectedMappingNum} = ${mapping.wsm_id === selectedMappingNum}`);
        console.log(`  Full mapping object:`, mapping);
      });
    } else {
      const skillCombinations = selectedMappingData?.std_skill_combinations as any;
      const skillCombination = Array.isArray(skillCombinations) 
        ? skillCombinations[0]?.skill_combination 
        : skillCombinations?.skill_combination;
        
      console.log('Skill combinations data:', skillCombinations);
      console.log('Skill combination field:', skillCombination);
      console.log('Skill combination type:', typeof skillCombination);
      console.log('Available skills:', availableSkills);
      
      // Detailed skill combination analysis
      if (skillCombination) {
        if (Array.isArray(skillCombination)) {
          console.log('Skill combination is array with length:', skillCombination.length);
          skillCombination.forEach((skill, index) => {
            console.log(`Skill ${index}:`, skill);
          });
        } else if (typeof skillCombination === 'string') {
          console.log('Skill combination is string, attempting to parse...');
          try {
            const parsed = JSON.parse(skillCombination);
            console.log('Parsed skill combination:', parsed);
          } catch (e) {
            console.error('Failed to parse skill combination JSON:', e);
          }
        }
      }
    }
  }

  // Reset skill selection when mapping changes
  $: if (selectedMapping) {
    selectedSkill = '';
    skillOrder = 1;
  }

  async function handleSubmit() {
    errorMsg = '';
    
    if (!selectedMapping) {
      errorMsg = 'Please select a work-skill mapping.';
      return;
    }

    if (!selectedSkill) {
      errorMsg = 'Please select a skill.';
      return;
    }

    if (standardTimeMinutes <= 0) {
      errorMsg = 'Standard time must be greater than 0.';
      return;
    }

    if (skillOrder <= 0) {
      errorMsg = 'Skill order must be greater than 0.';
      return;
    }

    submitting = true;
    try {
      await saveSkillTimeStandard({
        wsm_id: parseInt(selectedMapping),
        skill_short: selectedSkill,
        standard_time_minutes: standardTimeMinutes,
        skill_order: skillOrder
      });
      
      // Reset form
      selectedMapping = '';
      selectedSkill = '';
      standardTimeMinutes = 0;
      skillOrder = 1;
      onItemAdded();
    } catch (e: any) {
      errorMsg = 'Error saving skill time standard: ' + (e.message || e);
    } finally {
      submitting = false;
    }
  }

  function handleClose() {
    selectedMapping = '';
    selectedSkill = '';
    standardTimeMinutes = 0;
    skillOrder = 1;
    errorMsg = '';
    onClose();
  }
</script>

{#if showAddModal}
  <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
    <div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
      <div class="p-6">
        <div class="flex items-center justify-between mb-6">
          <h2 class="text-xl font-semibold theme-text-primary">Add Skill Time Standard</h2>
          <button
            on:click={handleClose}
            class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            aria-label="Close modal"
          >
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {#if errorMsg}
          <div class="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
            {errorMsg}
          </div>
        {/if}

        <form on:submit|preventDefault={handleSubmit} class="space-y-6">
          <!-- Work-Skill Mapping Selection -->
          <div>
            <label for="mapping" class="block text-sm font-medium theme-text-primary mb-2">
              Work-Skill Mapping *
            </label>
            <select
              id="mapping"
              bind:value={selectedMapping}
              class="w-full border theme-border rounded px-3 py-2 theme-bg-secondary theme-text-primary"
              required
            >
              <option value="">-- Select a work-skill mapping --</option>
              {#each workSkillMappings as mapping}
                <option value={mapping.wsm_id}>
                  {mapping.derived_sw_code} - {mapping.sc_name}
                </option>
              {/each}
            </select>
            <p class="mt-1 text-xs theme-text-secondary">
              {#if workSkillMappings.length === 0}
                <span class="text-orange-600 dark:text-orange-400">
                  No work-skill mappings available. Please create skill combinations first, then create work-skill mappings.
                </span>
              {:else}
                Select the work-skill mapping to add time standards to.
              {/if}
            </p>
          </div>

          <!-- Skill Selection -->
          <div>
            <label for="skill" class="block text-sm font-medium theme-text-primary mb-2">
              Skill *
            </label>
            <select
              id="skill"
              bind:value={selectedSkill}
              class="w-full border theme-border rounded px-3 py-2 theme-bg-secondary theme-text-primary"
              required
              disabled={!selectedMapping || availableSkills.length === 0}
            >
              <option value="">-- Select a skill --</option>
              {#each availableSkills as skill}
                <option value={skill}>{skill}</option>
              {/each}
            </select>
            <p class="mt-1 text-xs theme-text-secondary">
              {#if selectedMapping && availableSkills.length === 0}
                <span class="text-orange-600 dark:text-orange-400">
                  No skills available for this mapping. The skill combination may not have any skills defined.
                </span>
              {:else if selectedMapping}
                Select a skill from the combination.
              {:else}
                Select a work-skill mapping first to see available skills.
              {/if}
            </p>
          </div>

          <!-- Standard Time -->
          <div>
            <label for="standardTime" class="block text-sm font-medium theme-text-primary mb-2">
              Standard Time (minutes) *
            </label>
            <input
              id="standardTime"
              type="number"
              bind:value={standardTimeMinutes}
              min="1"
              class="w-full border theme-border rounded px-3 py-2 theme-bg-secondary theme-text-primary"
              placeholder="Enter standard time in minutes"
              required
            />
            <p class="mt-1 text-xs theme-text-secondary">
              Enter the standard time required for this skill in minutes.
            </p>
          </div>

          <!-- Skill Order -->
          <div>
            <label for="skillOrder" class="block text-sm font-medium theme-text-primary mb-2">
              Skill Order *
            </label>
            <input
              id="skillOrder"
              type="number"
              bind:value={skillOrder}
              min="1"
              class="w-full border theme-border rounded px-3 py-2 theme-bg-secondary theme-text-primary"
              placeholder="Enter skill order"
              required
            />
            <p class="mt-1 text-xs theme-text-secondary">
              Enter the order of this skill within the combination (1, 2, 3, etc.).
            </p>
          </div>

          <!-- Action Buttons -->
          <div class="flex justify-between gap-3 pt-4">
            <Button variant="primary" size="md" disabled={submitting || !selectedMapping || !selectedSkill || standardTimeMinutes <= 0 || skillOrder <= 0 || workSkillMappings.length === 0}>
              {submitting ? 'Creating...' : 'Create Time Standard'}
            </Button>
            <Button variant="secondary" size="md" on:click={handleClose}>Cancel</Button>
          </div>
        </form>
      </div>
    </div>
  </div>
{/if} 