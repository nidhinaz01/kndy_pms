<script lang="ts">
  import { onMount } from 'svelte';
  import AppHeader from '$lib/components/common/AppHeader.svelte';
  import FloatingThemeToggle from '$lib/components/common/FloatingThemeToggle.svelte';
  import Sidebar from '$lib/components/navigation/Sidebar.svelte';
  import Button from '$lib/components/common/Button.svelte';
  import { fetchUserMenus } from '$lib/services/menuService';
  import { fetchStages } from '$lib/api/employee-api/employeeDropdownService';
  import { getActiveWorkOrders } from '$lib/api/production/productionWorkFetchHelpers';
  import { getAvailableStandardWorks } from '$lib/api/production/productionWorkOrderService';
  import { addWorkToProduction } from '$lib/api/production';
  import { Loader } from 'lucide-svelte';

  // State
  let showSidebar = false;
  let menus: any[] = [];
  let isLoading = false;
  let message = '';
  let messageType: 'success' | 'error' = 'success';

  // Stage selection
  let availableStages: string[] = [];
  let selectedStage: string = '';

  // Work order selection
  let workOrders: Array<{id: number, wo_no: string | null, pwo_no: string | null, wo_model: string}> = [];
  let selectedWorkOrderId: number | null = null;
  let selectedWorkOrder: {id: number, wo_no: string | null, pwo_no: string | null, wo_model: string} | undefined = undefined;
  let isLoadingWorkOrders = false;

  // Standard work selection
  let availableStandardWorks: Array<{ derived_sw_code: string; type_description: string; sw_name: string }> = [];
  let selectedDerivedSwCode: string = '';
  let additionReason: string = '';
  let isLoadingStandardWorks = false;
  let isSubmitting = false;

  function showMessage(text: string, type: 'success' | 'error') {
    message = text;
    messageType = type;
    setTimeout(() => {
      message = '';
    }, 5000);
  }

  function handleSidebarToggle() {
    showSidebar = !showSidebar;
  }

  // Load stages on mount
  onMount(async () => {
    // Check if user is logged in
    const username = localStorage.getItem('username');
    if (!username) {
      console.log('User not logged in, redirecting to login');
      window.location.href = '/';
      return;
    }

    isLoading = true;
    try {
      menus = await fetchUserMenus(username);
      availableStages = await fetchStages();
    } catch (error) {
      console.error('Error loading initial data:', error);
    } finally {
      isLoading = false;
    }
  });

  // Load work orders when stage is selected
  async function handleStageChange() {
    if (!selectedStage) {
      workOrders = [];
      selectedWorkOrderId = null;
      selectedWorkOrder = undefined;
      availableStandardWorks = [];
      selectedDerivedSwCode = '';
      return;
    }

    isLoadingWorkOrders = true;
    try {
      const { workOrderMap } = await getActiveWorkOrders(selectedStage);
      workOrders = Array.from(workOrderMap.values());
      selectedWorkOrderId = null;
      selectedWorkOrder = undefined;
      availableStandardWorks = [];
      selectedDerivedSwCode = '';
    } catch (error) {
      console.error('Error loading work orders:', error);
      alert('Error loading work orders. Please try again.');
      workOrders = [];
    } finally {
      isLoadingWorkOrders = false;
    }
  }

  // Load available standard works when work order is selected
  async function handleWorkOrderChange() {
    if (!selectedWorkOrderId || !selectedStage) {
      availableStandardWorks = [];
      selectedDerivedSwCode = '';
      return;
    }

    selectedWorkOrder = workOrders.find(wo => wo.id === selectedWorkOrderId);
    isLoadingStandardWorks = true;
    try {
      availableStandardWorks = await getAvailableStandardWorks(selectedWorkOrderId, selectedStage);
      selectedDerivedSwCode = '';
      additionReason = '';
    } catch (error) {
      console.error('Error loading available standard works:', error);
      alert('Error loading available standard works. Please try again.');
      availableStandardWorks = [];
    } finally {
      isLoadingStandardWorks = false;
    }
  }

  // Submit form
  async function handleSubmit() {
    if (!selectedStage || !selectedWorkOrderId || !selectedDerivedSwCode || !additionReason.trim()) {
      alert('Please fill in all required fields.');
      return;
    }

    isSubmitting = true;
    try {
      const { getCurrentUsername } = await import('$lib/utils/userUtils');
      const currentUser = getCurrentUsername();

      const result = await addWorkToProduction(
        selectedStage,
        selectedWorkOrderId,
        'standard',
        {
          derived_sw_code: selectedDerivedSwCode,
          addition_reason: additionReason.trim()
        },
        undefined,
        currentUser
      );

      if (result.success) {
        showMessage('Standard work added successfully! It will now appear in the Works tab for this stage.', 'success');
        // Reset form
        selectedDerivedSwCode = '';
        additionReason = '';
        // Reload available standard works (the added one should no longer appear)
        await handleWorkOrderChange();
      } else {
        showMessage('Error adding standard work: ' + (result.error || 'Unknown error'), 'error');
      }
    } catch (error) {
      console.error('Error adding standard work:', error);
      showMessage('Error adding standard work. Please try again.', 'error');
    } finally {
      isSubmitting = false;
    }
  }

  $: canSubmit = selectedStage && selectedWorkOrderId && selectedDerivedSwCode && additionReason.trim();
</script>

<svelte:head>
  <title>Add Standard Work to Work Order</title>
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
    title="Add Standard Work to Work Order"
    onSidebarToggle={handleSidebarToggle}
  />

  <!-- Message Display -->
  {#if message}
    <div class={`mx-4 mt-4 p-4 rounded-lg ${messageType === 'success' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'}`}>
      {message}
    </div>
  {/if}

  <!-- Main Content -->
  <div class="flex flex-1 p-4">
    <div class="w-full max-w-4xl mx-auto">
      <div class="theme-bg-primary rounded-lg shadow border theme-border p-6">
        <div class="space-y-6">
          <!-- Stage Selection -->
          <div>
            <label for="stage" class="block text-sm font-medium theme-text-primary mb-2">
              Select Stage <span class="text-red-500">*</span>
            </label>
            <select
              id="stage"
              bind:value={selectedStage}
              on:change={handleStageChange}
              disabled={isLoading || isLoadingWorkOrders}
              class="w-full px-3 py-2 theme-bg-primary theme-border theme-text-primary rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
            >
              <option value="">Select a stage...</option>
              {#each availableStages as stage}
                <option value={stage}>{stage}</option>
              {/each}
            </select>
          </div>

          <!-- Work Order Selection -->
          {#if selectedStage}
            <div>
              <label for="workOrder" class="block text-sm font-medium theme-text-primary mb-2">
                Select Work Order <span class="text-red-500">*</span>
              </label>
              {#if isLoadingWorkOrders}
                <div class="flex items-center gap-2 py-2">
                  <Loader class="w-4 h-4 animate-spin text-blue-600" />
                  <span class="text-sm theme-text-secondary">Loading work orders...</span>
                </div>
              {:else if workOrders.length === 0}
                <div class="p-4 theme-bg-yellow-50 dark:theme-bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                  <p class="text-sm theme-text-primary">
                    No active work orders found for stage {selectedStage}. Work orders must be entered into the stage to appear here.
                  </p>
                </div>
              {:else}
                <select
                  id="workOrder"
                  bind:value={selectedWorkOrderId}
                  on:change={handleWorkOrderChange}
                  disabled={isLoadingStandardWorks || isSubmitting}
                  class="w-full px-3 py-2 theme-bg-primary theme-border theme-text-primary rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
                >
                  <option value="">Select a work order...</option>
                  {#each workOrders as wo}
                    <option value={wo.id}>
                      {wo.wo_no || 'N/A'} {wo.pwo_no ? `(${wo.pwo_no})` : ''} - {wo.wo_model}
                    </option>
                  {/each}
                </select>
              {/if}
            </div>
          {/if}

          <!-- Standard Work Selection -->
          {#if selectedWorkOrderId && selectedStage}
            <div>
              <label for="standardWork" class="block text-sm font-medium theme-text-primary mb-2">
                Select Standard Work <span class="text-red-500">*</span>
              </label>
              {#if isLoadingStandardWorks}
                <div class="flex items-center gap-2 py-2">
                  <Loader class="w-4 h-4 animate-spin text-blue-600" />
                  <span class="text-sm theme-text-secondary">Loading available standard works...</span>
                </div>
              {:else if availableStandardWorks.length === 0}
                <div class="p-4 theme-bg-yellow-50 dark:theme-bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                  <p class="text-sm theme-text-primary">
                    No available standard works found for this work order. All standard works may have already been added or removed.
                  </p>
                </div>
              {:else}
                <select
                  id="standardWork"
                  bind:value={selectedDerivedSwCode}
                  disabled={isSubmitting}
                  class="w-full px-3 py-2 theme-bg-primary theme-border theme-text-primary rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
                >
                  <option value="">Select a standard work...</option>
                  {#each availableStandardWorks as work}
                    <option value={work.derived_sw_code}>
                      {work.derived_sw_code} - {work.sw_name} {work.type_description ? `(${work.type_description})` : ''}
                    </option>
                  {/each}
                </select>
              {/if}
            </div>
          {/if}

          <!-- Addition Reason -->
          {#if selectedDerivedSwCode}
            <div>
              <label for="reason" class="block text-sm font-medium theme-text-primary mb-2">
                Reason for Addition <span class="text-red-500">*</span>
              </label>
              <textarea
                id="reason"
                bind:value={additionReason}
                disabled={isSubmitting}
                rows="4"
                placeholder="Enter reason for adding this standard work..."
                class="w-full px-3 py-2 theme-bg-primary theme-border theme-text-primary rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
              ></textarea>
            </div>
          {/if}

          <!-- Selected Work Order Info -->
          {#if selectedWorkOrder}
            <div class="p-4 theme-bg-secondary rounded-lg">
              <div class="text-sm theme-text-secondary mb-1">Selected Work Order</div>
              <div class="font-medium theme-text-primary">
                {selectedWorkOrder.wo_no || 'N/A'} {selectedWorkOrder.pwo_no ? `(${selectedWorkOrder.pwo_no})` : ''} - {selectedWorkOrder.wo_model}
              </div>
            </div>
          {/if}

          <!-- Submit Button -->
          {#if canSubmit}
            <div class="flex justify-end gap-3 pt-4 border-t theme-border">
              <Button
                variant="secondary"
                on:click={() => {
                  selectedStage = '';
                  selectedWorkOrderId = null;
                  selectedDerivedSwCode = '';
                  additionReason = '';
                  workOrders = [];
                  availableStandardWorks = [];
                }}
                disabled={isSubmitting}
              >
                Reset
              </Button>
              <Button
                variant="primary"
                on:click={handleSubmit}
                disabled={isSubmitting}
              >
                {#if isSubmitting}
                  <Loader class="w-4 h-4 mr-2 animate-spin" />
                  Adding...
                {:else}
                  Add Standard Work
                {/if}
              </Button>
            </div>
          {/if}
        </div>
      </div>
    </div>
  </div>
</div>

<!-- Floating Theme Toggle -->
<FloatingThemeToggle />

