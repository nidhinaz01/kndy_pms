<script lang="ts">
  import { onMount, createEventDispatcher } from 'svelte';
  import { fetchAllStdWorkDetails } from '$lib/api/stdWorkDetails';
  import { saveStdWorkTypeDetail, generateNextDerivedCode } from '$lib/api/stdWorkTypeDetails';
  import Button from '$lib/components/common/Button.svelte';

  export let showAddModal: boolean;
  export let onClose: () => void;
  export let onItemAdded: () => void;

  let baseWorks: any[] = [];
  let selectedBaseWork = '';
  let typeDescription = '';
  let generatedDerivedCode = '';
  let errorMsg = '';
  let submitting = false;

  const dispatch = createEventDispatcher();

  onMount(async () => {
    try {
      baseWorks = await fetchAllStdWorkDetails();
      console.log('Loaded base works:', baseWorks);
    } catch (error) {
      console.error('Error loading base works:', error);
      baseWorks = [];
    }
  });

  // Generate derived code when base work changes
  $: if (selectedBaseWork) {
    generateDerivedCode();
  } else {
    generatedDerivedCode = '';
  }

  async function generateDerivedCode() {
    if (!selectedBaseWork) return;
    
    try {
      generatedDerivedCode = await generateNextDerivedCode(selectedBaseWork);
    } catch (error) {
      console.error('Error generating derived code:', error);
      generatedDerivedCode = '';
    }
  }

  async function handleSubmit() {
    errorMsg = '';
    
    if (!selectedBaseWork) {
      errorMsg = 'Please select a base work.';
      return;
    }

    if (!typeDescription.trim()) {
      errorMsg = 'Type description is required.';
      return;
    }

    if (typeDescription.length > 100) {
      errorMsg = 'Type description must be less than 100 characters.';
      return;
    }

    if (!generatedDerivedCode) {
      errorMsg = 'Could not generate derived code.';
      return;
    }

    submitting = true;
    try {
      await saveStdWorkTypeDetail({
        sw_code: selectedBaseWork,
        type_description: typeDescription.trim()
      });
      
      // Reset form
      selectedBaseWork = '';
      typeDescription = '';
      generatedDerivedCode = '';
      onItemAdded();
    } catch (e: any) {
      errorMsg = 'Error saving derivative work: ' + (e.message || e);
    } finally {
      submitting = false;
    }
  }

  function handleClose() {
    selectedBaseWork = '';
    typeDescription = '';
    generatedDerivedCode = '';
    errorMsg = '';
    onClose();
  }
</script>

{#if showAddModal}
  <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
    <div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
      <div class="p-6">
        <div class="flex items-center justify-between mb-6">
          <h2 class="text-xl font-semibold theme-text-primary">Add Derivative Work</h2>
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
          <!-- Base Work Selection -->
          <div>
            <label for="baseWork" class="block text-sm font-medium theme-text-primary mb-2">
              Base Work *
            </label>
            <select
              id="baseWork"
              bind:value={selectedBaseWork}
              class="w-full border theme-border rounded px-3 py-2 theme-bg-secondary theme-text-primary"
              required
            >
              <option value="">-- Select a base work --</option>
              {#each baseWorks as work}
                <option value={work.sw_code}>
                  {work.sw_code} - {work.sw_name} ({work.plant_stage})
                </option>
              {/each}
            </select>
            <p class="mt-1 text-xs theme-text-secondary">
              Select the base work to create a derivative from.
            </p>
          </div>

          <!-- Type Description -->
          <div>
            <label for="typeDescription" class="block text-sm font-medium theme-text-primary mb-2">
              Type Description *
            </label>
            <input
              id="typeDescription"
              type="text"
              bind:value={typeDescription}
              maxlength="100"
              class="w-full border theme-border rounded px-3 py-2 theme-bg-secondary theme-text-primary"
              placeholder="e.g., Type 1, Variant A, Special Edition"
              required
            />
            <p class="mt-1 text-xs theme-text-secondary">
              Describe the type or variant of this derivative work (max 100 characters).
            </p>
          </div>

          <!-- Generated Derived Code -->
          {#if generatedDerivedCode}
            <div>
              <label for="derivedCode" class="block text-sm font-medium theme-text-primary mb-2">
                Generated Derived Code
              </label>
              <input
                id="derivedCode"
                type="text"
                value={generatedDerivedCode}
                class="w-full border theme-border rounded px-3 py-2 theme-bg-tertiary theme-text-secondary"
                readonly
              />
              <p class="mt-1 text-xs theme-text-secondary">
                This code will be automatically generated based on the base work code.
              </p>
            </div>
          {/if}

          <!-- Action Buttons -->
          <div class="flex justify-between gap-3 pt-4">
            <Button variant="primary" size="md" disabled={submitting || !selectedBaseWork || !typeDescription.trim()}>
              {submitting ? 'Creating...' : 'Create Derivative Work'}
            </Button>
            <Button variant="secondary" size="md" on:click={handleClose}>Cancel</Button>
          </div>
        </form>
      </div>
    </div>
  </div>
{/if} 