<script lang="ts">
  import { onMount, createEventDispatcher } from 'svelte';
  import { fetchAllStdWorkTypeDetails } from '$lib/api/stdWorkTypeDetails';
  import { fetchSkillCombinations, getAvailableSkillCombinationsForWork } from '$lib/api/skillCombinations';
  import { saveWorkSkillMapping } from '$lib/api/stdWorkSkillMapping';
  import Button from '$lib/components/common/Button.svelte';

  export let showAddModal: boolean;
  export let onClose: () => void;
  export let onItemAdded: () => void;

  let derivativeWorks: any[] = [];
  let availableSkillCombinations: any[] = [];
  let selectedDerivedWork = '';
  let selectedSkillCombination = '';
  let errorMsg = '';
  let submitting = false;

  // Computed property to get selected work details
  $: selectedWorkDetails = derivativeWorks.find(work => work.derived_sw_code === selectedDerivedWork);

  const dispatch = createEventDispatcher();

  onMount(async () => {
    try {
      derivativeWorks = await fetchAllStdWorkTypeDetails();
      console.log('Loaded derivative works:', derivativeWorks);
    } catch (error) {
      console.error('Error loading derivative works:', error);
      derivativeWorks = [];
    }
  });

  // Load available skill combinations when derivative work changes
  $: if (selectedDerivedWork) {
    loadAvailableSkillCombinations();
  } else {
    availableSkillCombinations = [];
    selectedSkillCombination = '';
  }

  async function loadAvailableSkillCombinations() {
    if (!selectedDerivedWork) return;
    
    try {
      availableSkillCombinations = await getAvailableSkillCombinationsForWork(selectedDerivedWork);
      console.log('Available skill combinations:', availableSkillCombinations);
    } catch (error) {
      console.error('Error loading available skill combinations:', error);
      availableSkillCombinations = [];
    }
  }

  async function handleSubmit() {
    errorMsg = '';
    
    if (!selectedDerivedWork) {
      errorMsg = 'Please select a derivative work.';
      return;
    }

    if (!selectedSkillCombination) {
      errorMsg = 'Please select a skill combination.';
      return;
    }

    submitting = true;
    try {
      await saveWorkSkillMapping({
        derived_sw_code: selectedDerivedWork,
        sc_name: selectedSkillCombination
      });
      
      // Reset form
      selectedDerivedWork = '';
      selectedSkillCombination = '';
      availableSkillCombinations = [];
      onItemAdded();
    } catch (e: any) {
      errorMsg = 'Error saving work-skill mapping: ' + (e.message || e);
    } finally {
      submitting = false;
    }
  }

  function handleClose() {
    selectedDerivedWork = '';
    selectedSkillCombination = '';
    availableSkillCombinations = [];
    errorMsg = '';
    onClose();
  }
</script>

{#if showAddModal}
  <div class="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
    <div class="theme-bg-primary rounded-2xl shadow-2xl p-8 w-[32rem] max-h-[90vh] overflow-y-auto animate-fade-in">
      <div class="flex items-center justify-between mb-6">
        <div class="font-bold text-lg theme-text-accent flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 theme-text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
          </svg>
          Add Work-Skill Mapping
        </div>
        <button class="theme-text-secondary hover:theme-text-accent transition-colors" on:click={handleClose} aria-label="Close modal">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {#if errorMsg}
        <div class="theme-text-danger mb-2">{errorMsg}</div>
      {/if}

      <form on:submit|preventDefault={handleSubmit} class="space-y-4">
        <!-- Derivative Work Selection -->
        <div>
          <label for="derivedWork" class="block text-sm font-medium theme-text-primary mb-1">
            Work Code *
          </label>
          <select
            id="derivedWork"
            bind:value={selectedDerivedWork}
            class="w-full border theme-border rounded px-3 py-2 theme-bg-secondary theme-text-primary"
            required
          >
            <option value="">-- Select a work code --</option>
            {#each derivativeWorks as work}
              <option value={work.derived_sw_code}>
                {work.derived_sw_code}
              </option>
            {/each}
          </select>
          <p class="mt-1 text-xs theme-text-secondary">
            Select the work code to map skills to.
          </p>
        </div>

        <!-- Work Description Display -->
        {#if selectedWorkDetails}
          <div>
            <div class="block text-sm font-medium theme-text-primary mb-1">
              Work Description
            </div>
            <div class="w-full border theme-border rounded px-3 py-2 theme-bg-secondary theme-text-primary">
              {selectedWorkDetails.std_work_details?.sw_name || 'N/A'} - {selectedWorkDetails.type_description || 'N/A'}
            </div>
            <p class="mt-1 text-xs theme-text-secondary">
              Standard work name and type description.
            </p>
          </div>
        {/if}

        <!-- Skill Combination Selection -->
        <div>
          <label for="skillCombination" class="block text-sm font-medium theme-text-primary mb-1">
            Skill Combination *
          </label>
          <select
            id="skillCombination"
            bind:value={selectedSkillCombination}
            class="w-full border theme-border rounded px-3 py-2 theme-bg-secondary theme-text-primary"
            required
            disabled={!selectedDerivedWork || availableSkillCombinations.length === 0}
          >
            <option value="">-- Select a skill combination --</option>
            {#each availableSkillCombinations as combination}
              <option value={combination.sc_name}>
                {combination.sc_name} ({combination.manpower_required} manpower)
              </option>
            {/each}
          </select>
          <p class="mt-1 text-xs theme-text-secondary">
            {#if selectedDerivedWork && availableSkillCombinations.length === 0}
              No available skill combinations for this work.
            {:else if selectedDerivedWork}
              Select a skill combination to map to this work.
            {:else}
              Select a derivative work first to see available skill combinations.
            {/if}
          </p>
        </div>

        <!-- Action Buttons -->
        <div class="flex justify-between gap-3 pt-4">
          <Button variant="primary" size="md" type="submit" disabled={submitting || !selectedDerivedWork || !selectedSkillCombination}>
            {submitting ? 'Creating...' : 'Create Mapping'}
          </Button>
          <Button variant="secondary" size="md" on:click={handleClose}>Cancel</Button>
        </div>
      </form>
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