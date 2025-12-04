<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import Button from '$lib/components/common/Button.svelte';
  import { X, Plus, Loader } from 'lucide-svelte';
  import { 
    getNextNonStandardWorkCode, 
    getSkillCombinations,
    addWorkToProduction 
  } from '$lib/api/production';

  export let isOpen: boolean = false;
  export let workOrders: Array<{id: number, wo_no: string | null, pwo_no: string | null, wo_model: string}> = [];
  export let stageCode: string = '';

  const dispatch = createEventDispatcher();

  // Debug: Log when isOpen changes
  $: if (isOpen) {
    console.log('AddWorkModal isOpen changed to true, workOrders:', workOrders);
  }

  let isLoading = false;
  let loadingData = false;
  
  // Work type is always non-standard for production team
  let selectedWorkType: 'non-standard' = 'non-standard';
  
  // Step 2: Work order selection
  let selectedWorkOrderId: number | null = null;
  let selectedWorkOrder: {id: number, wo_no: string | null, pwo_no: string | null, wo_model: string} | undefined = undefined;
  
  // Non-standard work form
  let nextWorkCode: string = '';
  let otherWorkDesc: string = '';
  let selectedSkillCombination: string = '';
  let estimatedTimeMinutes: number | null = null;
  let nonStandardAdditionReason: string = '';
  let skillCombinations: Array<{ sc_name: string; skill_combination: any; skill_combination_display: string }> = [];

  // Reset form when modal opens/closes and load skill combinations
  $: if (isOpen) {
    resetForm();
    // Load skill combinations for non-standard work
    loadingData = true;
    getSkillCombinations()
      .then(data => {
        skillCombinations = data;
      })
      .catch(error => {
        console.error('Error loading skill combinations:', error);
        alert('Error loading skill combinations. Please try again.');
      })
      .finally(() => {
        loadingData = false;
      });
  }

  function resetForm() {
    selectedWorkOrderId = null;
    selectedWorkOrder = undefined;
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

  // Removed handleWorkTypeSelect - always non-standard now

  async function handleWorkOrderSelect(woId: number) {
    console.log('handleWorkOrderSelect called with woId:', woId);
    console.log('workOrders:', workOrders);
    selectedWorkOrderId = woId;
    console.log('selectedWorkOrderId set to:', selectedWorkOrderId);
    
    // Get next available work code for non-standard work
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
    
    if (!selectedWorkOrderId) {
      alert('Please select a work order.');
      return;
    }

    if (!canSubmitNonStandard()) {
      alert('Please fill in all required fields for non-standard work.');
      return;
    }

    isLoading = true;
    try {
      const { getCurrentUsername } = await import('$lib/utils/userUtils');
      const currentUser = getCurrentUsername();
      
      const result = await addWorkToProduction(
        stageCode,
        selectedWorkOrderId,
        'non-standard',
        undefined,
        {
          other_work_code: nextWorkCode,
          other_work_desc: otherWorkDesc.trim(),
          other_work_sc: selectedSkillCombination,
          other_work_est_time_min: estimatedTimeMinutes!,
          addition_reason: nonStandardAdditionReason.trim()
        },
        currentUser
      );

      if (result.success) {
        alert('Non-standard work added successfully.');
        dispatch('added', { 
          workType: 'non-standard',
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
    !!(nextWorkCode && otherWorkDesc.trim() && selectedSkillCombination && estimatedTimeMinutes && estimatedTimeMinutes > 0 && nonStandardAdditionReason.trim())
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
              <h2 class="text-2xl font-semibold theme-text-primary">Add Non-Standard Work</h2>
              <p class="text-sm theme-text-secondary mt-1">Add a new non-standard work to production</p>
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
          {#if !selectedWorkOrderId}
            <!-- Step 2: Select work order -->
            <div class="space-y-4">
              <div class="flex items-center gap-2 mb-4">
                <h3 class="text-lg font-medium theme-text-primary">
                  Select Work Order (Non-Standard Work)
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
                  Non-Standard Work Details
                </h3>
              </div>

              <!-- Work Order Info -->
              <div class="p-4 theme-bg-secondary rounded-lg">
                <div class="text-sm theme-text-secondary mb-1">Work Order</div>
                <div class="font-medium theme-text-primary">
                  {selectedWorkOrder?.wo_no || 'N/A'} {selectedWorkOrder?.pwo_no ? `(${selectedWorkOrder.pwo_no})` : ''} - {selectedWorkOrder?.wo_model || 'N/A'}
                </div>
              </div>

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
                Add Non-Standard Work
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
              Add Non-Standard Work
            </Button>
          </div>
        {/if}
      </div>
    </div>
  </div>
{/if}

