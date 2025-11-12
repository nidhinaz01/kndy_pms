<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import Button from '$lib/components/common/Button.svelte';
  import { X, Plus, Loader } from 'lucide-svelte';
  import { 
    getAvailableStandardWorks, 
    getNextNonStandardWorkCode, 
    getSkillCombinations,
    addWorkToProduction 
  } from '$lib/api/production';

  export let isOpen: boolean = false;
  export let workOrders: Array<{id: number, wo_no: string | null, pwo_no: string | null, wo_model: string}> = [];
  export let stageCode: string = 'P1S2';

  const dispatch = createEventDispatcher();

  // Debug: Log when isOpen changes
  $: if (isOpen) {
    console.log('AddWorkModal isOpen changed to true, workOrders:', workOrders);
  }

  let isLoading = false;
  let loadingData = false;
  
  // Step 1: Work type selection
  let selectedWorkType: 'standard' | 'non-standard' | null = null;
  
  // Step 2: Work order selection
  let selectedWorkOrderId: number | null = null;
  let selectedWorkOrder: {id: number, wo_no: string | null, pwo_no: string | null, wo_model: string} | undefined = undefined;
  
  // Standard work form
  let availableStandardWorks: Array<{ derived_sw_code: string; type_description: string; sw_name: string }> = [];
  let selectedDerivedSwCode: string = '';
  let standardAdditionReason: string = '';
  
  // Non-standard work form
  let nextWorkCode: string = '';
  let otherWorkDesc: string = '';
  let selectedSkillCombination: string = '';
  let estimatedTimeMinutes: number | null = null;
  let nonStandardAdditionReason: string = '';
  let skillCombinations: Array<{ sc_name: string; skill_combination: any; skill_combination_display: string }> = [];

  // Reset form when modal opens/closes
  $: if (isOpen) {
    resetForm();
  }

  function resetForm() {
    selectedWorkType = null;
    selectedWorkOrderId = null;
    selectedWorkOrder = undefined;
    availableStandardWorks = [];
    selectedDerivedSwCode = '';
    standardAdditionReason = '';
    nextWorkCode = '';
    otherWorkDesc = '';
    selectedSkillCombination = '';
    estimatedTimeMinutes = null;
    nonStandardAdditionReason = '';
  }

  function handleClose() {
    if (!isLoading && !loadingData) {
      resetForm();
      dispatch('close');
    }
  }

  async function handleWorkTypeSelect(type: 'standard' | 'non-standard') {
    selectedWorkType = type;
    selectedWorkOrderId = null;
    
    // Reset form fields
    selectedDerivedSwCode = '';
    standardAdditionReason = '';
    nextWorkCode = '';
    otherWorkDesc = '';
    selectedSkillCombination = '';
    estimatedTimeMinutes = null;
    nonStandardAdditionReason = '';
    
    // Load skill combinations for non-standard work
    if (type === 'non-standard') {
      loadingData = true;
      try {
        skillCombinations = await getSkillCombinations();
      } catch (error) {
        console.error('Error loading skill combinations:', error);
        alert('Error loading skill combinations. Please try again.');
      } finally {
        loadingData = false;
      }
    }
  }

  async function handleWorkOrderSelect(woId: number) {
    console.log('handleWorkOrderSelect called with woId:', woId);
    console.log('workOrders:', workOrders);
    selectedWorkOrderId = woId;
    console.log('selectedWorkOrderId set to:', selectedWorkOrderId);
    
    if (selectedWorkType === 'standard') {
      // Load available standard works for this work order
      loadingData = true;
      try {
        availableStandardWorks = await getAvailableStandardWorks(woId, stageCode);
        if (availableStandardWorks.length === 0) {
          alert('No available standard works found for this work order.');
        }
      } catch (error) {
        console.error('Error loading available standard works:', error);
        alert('Error loading available standard works. Please try again.');
      } finally {
        loadingData = false;
      }
    } else if (selectedWorkType === 'non-standard') {
      // Get next available work code
      loadingData = true;
      try {
        nextWorkCode = await getNextNonStandardWorkCode(woId);
      } catch (error) {
        console.error('Error getting next work code:', error);
        alert('Error generating work code. Please try again.');
        nextWorkCode = '';
      } finally {
        loadingData = false;
      }
    }
  }

  function canSubmitStandard(): boolean {
    const canSubmit = !!(
      selectedWorkOrderId &&
      selectedDerivedSwCode &&
      standardAdditionReason.trim()
    );
    console.log('canSubmitStandard check:', {
      selectedWorkOrderId,
      selectedDerivedSwCode,
      standardAdditionReason: standardAdditionReason.trim(),
      canSubmit
    });
    return canSubmit;
  }

  function canSubmitNonStandard(): boolean {
    return !!(
      selectedWorkOrderId &&
      nextWorkCode &&
      otherWorkDesc.trim() &&
      selectedSkillCombination &&
      estimatedTimeMinutes !== null &&
      estimatedTimeMinutes > 0 &&
      nonStandardAdditionReason.trim()
    );
  }

  async function handleSubmit() {
    console.log('handleSubmit called');
    console.log('selectedWorkOrderId:', selectedWorkOrderId);
    console.log('selectedWorkType:', selectedWorkType);
    console.log('selectedDerivedSwCode:', selectedDerivedSwCode);
    console.log('standardAdditionReason:', standardAdditionReason);
    console.log('canSubmitStandard():', canSubmitStandard());
    
    if (!selectedWorkOrderId) {
      alert('Please select a work order.');
      return;
    }

    if (selectedWorkType === 'standard') {
      if (!canSubmitStandard()) {
        alert('Please fill in all required fields for standard work.');
        return;
      }
    } else {
      if (!canSubmitNonStandard()) {
        alert('Please fill in all required fields for non-standard work.');
        return;
      }
    }

    isLoading = true;
    try {
      const { getCurrentUsername } = await import('$lib/utils/userUtils');
      const currentUser = getCurrentUsername();
      
      const result = await addWorkToProduction(
        stageCode,
        selectedWorkOrderId,
        selectedWorkType!,
        selectedWorkType === 'standard' ? {
          derived_sw_code: selectedDerivedSwCode,
          addition_reason: standardAdditionReason.trim()
        } : undefined,
        selectedWorkType === 'non-standard' ? {
          other_work_code: nextWorkCode,
          other_work_desc: otherWorkDesc.trim(),
          other_work_sc: selectedSkillCombination,
          other_work_est_time_min: estimatedTimeMinutes!,
          addition_reason: nonStandardAdditionReason.trim()
        } : undefined,
        currentUser
      );

      if (result.success) {
        alert('Work added successfully.');
        dispatch('added', { 
          workType: selectedWorkType,
          woDetailsId: selectedWorkOrderId 
        });
        handleClose();
      } else {
        alert('Error adding work: ' + (result.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error adding work:', error);
      alert('Error adding work. Please try again.');
    } finally {
      isLoading = false;
    }
  }

  // Reactive variable for selected work order
  $: {
    if (selectedWorkOrderId && workOrders && workOrders.length > 0) {
      selectedWorkOrder = workOrders.find(wo => wo.id === selectedWorkOrderId);
    } else {
      selectedWorkOrder = undefined;
    }
  }

  // Reactive check for submit button visibility
  $: canSubmit = selectedWorkOrderId && (
    selectedWorkType === 'standard' 
      ? !!(selectedDerivedSwCode && standardAdditionReason.trim())
      : !!(nextWorkCode && otherWorkDesc.trim() && selectedSkillCombination && estimatedTimeMinutes && estimatedTimeMinutes > 0 && nonStandardAdditionReason.trim())
  );
</script>

{#if isOpen}
  <div class="fixed inset-0 z-50 overflow-y-auto">
    <!-- Backdrop -->
    <div 
      class="fixed inset-0 bg-black bg-opacity-50 transition-opacity" 
      role="button"
      tabindex="-1"
      aria-label="Close modal"
      on:click={handleClose}
      on:keydown={(e) => e.key === 'Enter' || e.key === ' ' ? handleClose() : null}
    ></div>
    
    <!-- Modal -->
    <div class="flex min-h-full items-center justify-center p-4">
      <div class="relative w-full max-w-3xl theme-bg-primary rounded-lg shadow-xl border theme-border">
        <!-- Header -->
        <div class="flex items-center justify-between p-6 border-b theme-border">
          <div class="flex items-center gap-3">
            <Plus class="w-6 h-6 text-blue-600 dark:text-blue-400" />
            <div>
              <h2 class="text-2xl font-semibold theme-text-primary">Add Work</h2>
              <p class="text-sm theme-text-secondary mt-1">Add a new work to production</p>
            </div>
          </div>
          <button
            on:click={handleClose}
            disabled={isLoading || loadingData}
            class="p-2 hover:theme-bg-secondary rounded-lg transition-colors disabled:opacity-50"
          >
            <X class="w-5 h-5 theme-text-secondary" />
          </button>
        </div>

        <!-- Content -->
        <div class="p-6">
          {#if !selectedWorkType}
            <!-- Step 1: Select work type -->
            <div class="space-y-4">
              <h3 class="text-lg font-medium theme-text-primary mb-4">Select Work Type</h3>
              <div class="grid grid-cols-2 gap-4">
                <button
                  on:click={() => handleWorkTypeSelect('standard')}
                  class="p-6 border-2 theme-border rounded-lg hover:border-blue-500 transition-colors text-left"
                >
                  <div class="font-semibold theme-text-primary mb-2">Standard Work</div>
                  <div class="text-sm theme-text-secondary">Add a work that has a derived work code</div>
                </button>
                <button
                  on:click={() => handleWorkTypeSelect('non-standard')}
                  class="p-6 border-2 theme-border rounded-lg hover:border-blue-500 transition-colors text-left"
                >
                  <div class="font-semibold theme-text-primary mb-2">Non-Standard Work</div>
                  <div class="text-sm theme-text-secondary">Add a custom work without a derived work code</div>
                </button>
              </div>
            </div>
          {:else if !selectedWorkOrderId}
            <!-- Step 2: Select work order -->
            <div class="space-y-4">
              <div class="flex items-center gap-2 mb-4">
                <button
                  on:click={() => selectedWorkType = null}
                  class="text-blue-600 dark:text-blue-400 hover:underline"
                  disabled={isLoading || loadingData}
                >
                  ← Back
                </button>
                <h3 class="text-lg font-medium theme-text-primary">
                  Select Work Order ({selectedWorkType === 'standard' ? 'Standard Work' : 'Non-Standard Work'})
                </h3>
              </div>
              
              {#if workOrders.length === 0}
                <div class="text-center py-8 theme-text-secondary">
                  No work orders available for this stage and date.
                </div>
              {:else}
                <div class="space-y-2 max-h-96 overflow-y-auto">
                  {#each workOrders as workOrder}
                    <button
                      on:click={() => {
                        console.log('Work order button clicked:', workOrder);
                        handleWorkOrderSelect(workOrder.id);
                      }}
                      class="w-full p-4 border theme-border rounded-lg hover:theme-bg-secondary transition-colors text-left"
                    >
                      <div class="font-medium theme-text-primary">
                        {workOrder.wo_no || 'N/A'} {workOrder.pwo_no ? `(${workOrder.pwo_no})` : ''}
                      </div>
                      <div class="text-sm theme-text-secondary mt-1">
                        Model: {workOrder.wo_model}
                      </div>
                    </button>
                  {/each}
                </div>
              {/if}
            </div>
          {:else}
            <!-- Step 3: Fill form -->
            <div class="space-y-4">
              <div class="flex items-center gap-2 mb-4">
                <button
                  on:click={() => selectedWorkOrderId = null}
                  class="text-blue-600 dark:text-blue-400 hover:underline"
                  disabled={isLoading || loadingData}
                >
                  ← Back
                </button>
                <h3 class="text-lg font-medium theme-text-primary">
                  {selectedWorkType === 'standard' ? 'Standard Work Details' : 'Non-Standard Work Details'}
                </h3>
              </div>

              <!-- Work Order Info -->
              <div class="p-4 theme-bg-secondary rounded-lg">
                <div class="text-sm theme-text-secondary mb-1">Work Order</div>
                <div class="font-medium theme-text-primary">
                  {selectedWorkOrder?.wo_no || 'N/A'} {selectedWorkOrder?.pwo_no ? `(${selectedWorkOrder.pwo_no})` : ''} - {selectedWorkOrder?.wo_model || 'N/A'}
                </div>
              </div>

              {#if selectedWorkType === 'standard'}
                <!-- Standard Work Form -->
                {#if loadingData}
                  <div class="flex items-center justify-center py-8">
                    <Loader class="w-6 h-6 animate-spin text-blue-600" />
                    <span class="ml-2 theme-text-secondary">Loading available works...</span>
                  </div>
                {:else if availableStandardWorks.length === 0}
                  <div class="p-4 theme-bg-yellow-50 dark:theme-bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                    <div class="text-sm theme-text-primary">
                      No available standard works found for this work order.
                    </div>
                  </div>
                {:else}
                  <div class="space-y-4">
                    <div>
                      <label for="derivedSwCode" class="block text-sm font-medium theme-text-primary mb-2">
                        Derived Work Code <span class="text-red-500">*</span>
                      </label>
                      <select
                        id="derivedSwCode"
                        bind:value={selectedDerivedSwCode}
                        disabled={isLoading || loadingData}
                        class="w-full px-3 py-2 theme-bg-primary theme-border theme-text-primary rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
                      >
                        <option value="">Select a work code...</option>
                        {#each availableStandardWorks as work}
                          <option value={work.derived_sw_code}>
                            {work.derived_sw_code} - {work.sw_name} {work.type_description ? `(${work.type_description})` : ''}
                          </option>
                        {/each}
                      </select>
                    </div>

                    <div>
                      <label for="standardReason" class="block text-sm font-medium theme-text-primary mb-2">
                        Reason for Addition <span class="text-red-500">*</span>
                      </label>
                      <textarea
                        id="standardReason"
                        bind:value={standardAdditionReason}
                        disabled={isLoading || loadingData}
                        rows="4"
                        placeholder="Enter reason for adding this work..."
                        class="w-full px-3 py-2 theme-bg-primary theme-border theme-text-primary rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
                      ></textarea>
                    </div>
                  </div>
                {/if}
              {:else}
                <!-- Non-Standard Work Form -->
                {#if loadingData}
                  <div class="flex items-center justify-center py-8">
                    <Loader class="w-6 h-6 animate-spin text-blue-600" />
                    <span class="ml-2 theme-text-secondary">Loading data...</span>
                  </div>
                {:else}
                  <div class="space-y-4">
                    <div>
                      <label for="work-code-input" class="block text-sm font-medium theme-text-primary mb-2">
                        Work Code
                      </label>
                      <input
                        id="work-code-input"
                        type="text"
                        value={nextWorkCode}
                        disabled
                        class="w-full px-3 py-2 theme-bg-secondary theme-border theme-text-primary rounded-lg disabled:opacity-50"
                      />
                      <p class="text-xs theme-text-secondary mt-1">Auto-generated work code</p>
                    </div>

                    <div>
                      <label for="workDesc" class="block text-sm font-medium theme-text-primary mb-2">
                        What is the work to be done? <span class="text-red-500">*</span>
                      </label>
                      <textarea
                        id="workDesc"
                        bind:value={otherWorkDesc}
                        disabled={isLoading || loadingData}
                        rows="3"
                        placeholder="Describe the work to be done..."
                        class="w-full px-3 py-2 theme-bg-primary theme-border theme-text-primary rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
                      ></textarea>
                    </div>

                    <div>
                      <label for="skillCombination" class="block text-sm font-medium theme-text-primary mb-2">
                        Skill Competency Combination <span class="text-red-500">*</span>
                      </label>
                      <select
                        id="skillCombination"
                        bind:value={selectedSkillCombination}
                        disabled={isLoading || loadingData}
                        class="w-full px-3 py-2 theme-bg-primary theme-border theme-text-primary rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
                      >
                        <option value="">Select skill combination...</option>
                        {#each skillCombinations as sc}
                          <option value={sc.sc_name}>
                            {sc.sc_name}
                          </option>
                        {/each}
                      </select>
                    </div>

                    <div>
                      <label for="estimatedTime" class="block text-sm font-medium theme-text-primary mb-2">
                        Estimated Time (minutes) <span class="text-red-500">*</span>
                      </label>
                      <input
                        id="estimatedTime"
                        type="number"
                        bind:value={estimatedTimeMinutes}
                        disabled={isLoading || loadingData}
                        min="1"
                        placeholder="Enter estimated time in minutes..."
                        class="w-full px-3 py-2 theme-bg-primary theme-border theme-text-primary rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
                      />
                    </div>

                    <div>
                      <label for="nonStandardReason" class="block text-sm font-medium theme-text-primary mb-2">
                        Reason for Addition <span class="text-red-500">*</span>
                      </label>
                      <textarea
                        id="nonStandardReason"
                        bind:value={nonStandardAdditionReason}
                        disabled={isLoading || loadingData}
                        rows="4"
                        placeholder="Enter reason for adding this work..."
                        class="w-full px-3 py-2 theme-bg-primary theme-border theme-text-primary rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
                      ></textarea>
                    </div>
                  </div>
                {/if}
              {/if}
            </div>
          {/if}
        </div>

        <!-- Footer -->
        {#if selectedWorkOrderId && canSubmit}
          <div class="flex items-center justify-end gap-3 p-6 border-t theme-border">
            <Button
              variant="secondary"
              on:click={handleClose}
              disabled={isLoading || loadingData}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              on:click={(e) => {
                console.log('Add Work button clicked in modal');
                e.preventDefault();
                e.stopPropagation();
                handleSubmit();
              }}
              disabled={isLoading || loadingData}
            >
              {#if isLoading}
                <Loader class="w-4 h-4 mr-2 animate-spin" />
                Adding...
              {:else}
                Add Work
              {/if}
            </Button>
          </div>
        {:else if selectedWorkOrderId}
          <div class="flex items-center justify-end gap-3 p-6 border-t theme-border">
            <Button
              variant="secondary"
              on:click={handleClose}
              disabled={isLoading || loadingData}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              disabled={true}
            >
              Add Work
            </Button>
          </div>
        {/if}
      </div>
    </div>
  </div>
{/if}

