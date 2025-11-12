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
  <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
    <div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
      <div class="p-6">
        <div class="flex items-center justify-between mb-6">
          <h2 class="text-xl font-semibold theme-text-primary">Add Work-Skill Mapping</h2>
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
          <!-- Derivative Work Selection -->
          <div>
            <label for="derivedWork" class="block text-sm font-medium theme-text-primary mb-2">
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
              <div class="block text-sm font-medium theme-text-primary mb-2">
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
            <label for="skillCombination" class="block text-sm font-medium theme-text-primary mb-2">
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
            <Button variant="primary" size="md" disabled={submitting || !selectedDerivedWork || !selectedSkillCombination}>
              {submitting ? 'Creating...' : 'Create Mapping'}
            </Button>
            <Button variant="secondary" size="md" on:click={handleClose}>Cancel</Button>
          </div>
        </form>
      </div>
    </div>
  </div>
{/if} 