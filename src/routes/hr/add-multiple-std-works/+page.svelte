<script lang="ts">
  import { onMount } from 'svelte';
  import AppHeader from '$lib/components/common/AppHeader.svelte';
  import FloatingThemeToggle from '$lib/components/common/FloatingThemeToggle.svelte';
  import Sidebar from '$lib/components/navigation/Sidebar.svelte';
  import Button from '$lib/components/common/Button.svelte';
  import SearchableSelect from '$lib/components/common/SearchableSelect.svelte';
  import { fetchUserMenus } from '$lib/services/menuService';
  import { fetchStages } from '$lib/api/employee-api/employeeDropdownService';
  import { getActiveWorkOrders } from '$lib/api/production/productionWorkFetchHelpers';
  import { getAvailableStandardWorks } from '$lib/api/production/productionWorkOrderService';
  import { addWorkToProduction } from '$lib/api/production';
  import { Loader, Trash2 } from 'lucide-svelte';

  type WorkOrder = { id: number; wo_no: string | null; pwo_no: string | null; wo_model: string };
  type StandardWork = { derived_sw_code: string; type_description: string; sw_name: string };
  type QueueItem = {
    queueKey: string;
    stage: string;
    woDetailsId: number;
    workOrderLabel: string;
    derivedSwCode: string;
    swName: string;
    typeDescription: string;
    additionReason: string;
  };

  let showSidebar = false;
  let menus: any[] = [];
  let isPageLoading = false;
  let message = '';
  let messageType: 'success' | 'error' = 'success';

  let availableStages: string[] = [];
  let selectedStage = '';

  let workOrders: WorkOrder[] = [];
  let selectedWorkOrderId: number | null = null;
  let selectedWorkOrder: WorkOrder | undefined = undefined;
  let isLoadingWorkOrders = false;

  let availableStandardWorks: StandardWork[] = [];
  let isLoadingStandardWorks = false;
  let selectedWorkCodes = new Set<string>();
  let standardWorkSearch = '';
  let additionReason = '';

  let queue: QueueItem[] = [];
  let isSubmittingAll = false;

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

  function getWorkOrderLabel(wo: WorkOrder): string {
    return `${wo.wo_no || 'N/A'}${wo.pwo_no ? ` (${wo.pwo_no})` : ''} - ${wo.wo_model}`;
  }

  function makeQueueKey(stage: string, woDetailsId: number, derivedSwCode: string): string {
    return `${stage}__${woDetailsId}__${derivedSwCode}`;
  }

  function resetCurrentSelection() {
    selectedWorkOrderId = null;
    selectedWorkOrder = undefined;
    availableStandardWorks = [];
    selectedWorkCodes = new Set<string>();
    additionReason = '';
  }

  onMount(async () => {
    const username = localStorage.getItem('username');
    if (!username) {
      window.location.href = '/';
      return;
    }

    isPageLoading = true;
    try {
      menus = await fetchUserMenus(username);
      availableStages = await fetchStages();
    } catch (error) {
      console.error('Error loading initial data:', error);
      showMessage('Error loading page data. Please refresh and try again.', 'error');
    } finally {
      isPageLoading = false;
    }
  });

  async function handleStageChange() {
    if (!selectedStage) {
      workOrders = [];
      resetCurrentSelection();
      return;
    }

    if (queue.length > 0) {
      const hasDifferentStageItems = queue.some((item) => item.stage !== selectedStage);
      if (hasDifferentStageItems) {
        const confirmClear = confirm(
          'Changing stage will clear queued works from a different stage. Continue?'
        );
        if (!confirmClear) {
          selectedStage = queue[0]?.stage || '';
          return;
        }
        queue = [];
      }
    }

    isLoadingWorkOrders = true;
    try {
      const { workOrderMap } = await getActiveWorkOrders(selectedStage);
      workOrders = Array.from(workOrderMap.values());
      resetCurrentSelection();
    } catch (error) {
      console.error('Error loading work orders:', error);
      showMessage('Error loading work orders. Please try again.', 'error');
      workOrders = [];
      resetCurrentSelection();
    } finally {
      isLoadingWorkOrders = false;
    }
  }

  async function handleWorkOrderChange() {
    if (!selectedWorkOrderId || !selectedStage) {
      selectedWorkOrder = undefined;
      availableStandardWorks = [];
      selectedWorkCodes = new Set<string>();
      standardWorkSearch = '';
      additionReason = '';
      return;
    }

    selectedWorkOrder = workOrders.find((wo) => wo.id === selectedWorkOrderId);
    isLoadingStandardWorks = true;
    try {
      availableStandardWorks = await getAvailableStandardWorks(selectedWorkOrderId, selectedStage);
      selectedWorkCodes = new Set<string>();
      standardWorkSearch = '';
      additionReason = '';
    } catch (error) {
      console.error('Error loading available standard works:', error);
      showMessage('Error loading available standard works. Please try again.', 'error');
      availableStandardWorks = [];
      selectedWorkCodes = new Set<string>();
    } finally {
      isLoadingStandardWorks = false;
    }
  }

  function toggleWorkSelection(code: string, checked: boolean) {
    const next = new Set(selectedWorkCodes);
    if (checked) {
      next.add(code);
    } else {
      next.delete(code);
    }
    selectedWorkCodes = next;
  }

  function toggleSelectAll(checked: boolean) {
    selectedWorkCodes = checked
      ? new Set(filteredStandardWorks.map((work) => work.derived_sw_code))
      : new Set<string>();
  }

  function addSelectedWorksToQueue() {
    if (!selectedStage || !selectedWorkOrderId || !selectedWorkOrder) {
      showMessage('Please select stage and work order first.', 'error');
      return;
    }
    if (selectedWorkCodes.size === 0) {
      showMessage('Please select at least one standard work.', 'error');
      return;
    }
    if (!additionReason.trim()) {
      showMessage('Please enter reason for addition.', 'error');
      return;
    }

    const chosen = availableStandardWorks.filter((work) => selectedWorkCodes.has(work.derived_sw_code));
    const workOrderLabel = getWorkOrderLabel(selectedWorkOrder);
    let addedCount = 0;
    let duplicateCount = 0;

    for (const work of chosen) {
      const queueKey = makeQueueKey(selectedStage, selectedWorkOrderId, work.derived_sw_code);
      if (queue.some((item) => item.queueKey === queueKey)) {
        duplicateCount++;
        continue;
      }
      queue = [
        ...queue,
        {
          queueKey,
          stage: selectedStage,
          woDetailsId: selectedWorkOrderId,
          workOrderLabel,
          derivedSwCode: work.derived_sw_code,
          swName: work.sw_name,
          typeDescription: work.type_description,
          additionReason: additionReason.trim()
        }
      ];
      addedCount++;
    }

    selectedWorkCodes = new Set<string>();
    additionReason = '';

    if (addedCount > 0 && duplicateCount > 0) {
      showMessage(`Added ${addedCount} work(s). Skipped ${duplicateCount} duplicate(s) already in queue.`, 'success');
    } else if (addedCount > 0) {
      showMessage(`Added ${addedCount} work(s) to queue.`, 'success');
    } else {
      showMessage('All selected works are already in the queue.', 'error');
    }
  }

  function removeQueueItem(queueKey: string) {
    queue = queue.filter((item) => item.queueKey !== queueKey);
  }

  async function submitAllQueuedWorks() {
    if (queue.length === 0) {
      showMessage('Queue is empty. Add works before submitting.', 'error');
      return;
    }

    isSubmittingAll = true;
    try {
      const { getCurrentUsername } = await import('$lib/utils/userUtils');
      const currentUser = getCurrentUsername();

      let successCount = 0;
      const failedItems: QueueItem[] = [];
      const errorLines: string[] = [];

      for (const item of queue) {
        const result = await addWorkToProduction(
          item.stage,
          item.woDetailsId,
          'standard',
          currentUser,
          {
            derived_sw_code: item.derivedSwCode,
            addition_reason: item.additionReason
          },
          undefined
        );

        if (result.success) {
          successCount++;
        } else {
          failedItems.push(item);
          errorLines.push(
            `${item.workOrderLabel} | ${item.derivedSwCode}: ${result.error || 'Unknown error'}`
          );
        }
      }

      queue = failedItems;

      if (failedItems.length === 0) {
        showMessage(`Successfully added all ${successCount} queued work(s).`, 'success');
      } else {
        console.error('Failed queue items:', errorLines);
        showMessage(
          `Added ${successCount} work(s). ${failedItems.length} failed and remain in queue.`,
          'error'
        );
      }

      if (selectedWorkOrderId && selectedStage) {
        await handleWorkOrderChange();
      }
    } catch (error) {
      console.error('Error submitting queued works:', error);
      showMessage('Error submitting queued works. Please try again.', 'error');
    } finally {
      isSubmittingAll = false;
    }
  }

  $: workOrderOptions = workOrders.map((wo) => ({
    value: wo.id,
    label: getWorkOrderLabel(wo)
  }));

  $: allSelected =
    filteredStandardWorks.length > 0 &&
    filteredStandardWorks.every((work) => selectedWorkCodes.has(work.derived_sw_code));

  $: standardWorkSearchTerm = standardWorkSearch.trim().toLowerCase();

  $: filteredStandardWorks = availableStandardWorks.filter((work) => {
    if (!standardWorkSearchTerm) return true;
    const code = work.derived_sw_code?.toLowerCase() || '';
    const name = work.sw_name?.toLowerCase() || '';
    const type = work.type_description?.toLowerCase() || '';
    return (
      code.includes(standardWorkSearchTerm) ||
      name.includes(standardWorkSearchTerm) ||
      type.includes(standardWorkSearchTerm)
    );
  });
</script>

<svelte:head>
  <title>PMS - Add Multiple Std Works</title>
</svelte:head>

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
  <AppHeader title="Add Multiple Standard Works" onSidebarToggle={handleSidebarToggle} />

  {#if message}
    <div class={`mx-4 mt-4 p-4 rounded-lg ${messageType === 'success' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'}`}>
      {message}
    </div>
  {/if}

  <div class="flex flex-1 p-4 gap-6">
    <div class="w-1/2">
      <div class="theme-bg-primary rounded-lg shadow border theme-border p-6 space-y-5">
        <div>
          <label for="stage" class="block text-sm font-medium theme-text-primary mb-2">
            Select Stage <span class="text-red-500">*</span>
          </label>
          <select
            id="stage"
            bind:value={selectedStage}
            on:change={handleStageChange}
            disabled={isPageLoading || isLoadingWorkOrders || isSubmittingAll}
            class="w-full px-3 py-2 theme-bg-primary theme-border theme-text-primary rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
          >
            <option value="">Select a stage...</option>
            {#each availableStages as stage}
              <option value={stage}>{stage}</option>
            {/each}
          </select>
        </div>

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
              <div class="p-3 theme-bg-yellow-50 dark:theme-bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                <p class="text-sm theme-text-primary">No active work orders found for this stage.</p>
              </div>
            {:else}
              <SearchableSelect
                id="workOrder"
                options={workOrderOptions}
                bind:value={selectedWorkOrderId}
                on:change={handleWorkOrderChange}
                disabled={isLoadingStandardWorks || isSubmittingAll}
                placeholder="Type to search work orders..."
                filterPlaceholder="Type to search..."
              />
            {/if}
          </div>
        {/if}

        {#if selectedWorkOrderId && selectedStage}
          <div>
            <div class="flex items-center justify-between mb-2">
              <span class="block text-sm font-medium theme-text-primary">
                Select Standard Works <span class="text-red-500">*</span>
              </span>
              {#if filteredStandardWorks.length > 0}
                <label class="text-xs theme-text-secondary flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    on:change={(e) => toggleSelectAll((e.currentTarget as HTMLInputElement).checked)}
                    disabled={isSubmittingAll}
                  />
                  Select all
                </label>
              {/if}
            </div>

            {#if !isLoadingStandardWorks}
              <div class="mb-3">
                <input
                  type="text"
                  bind:value={standardWorkSearch}
                  placeholder="Search works by code, name, or type..."
                  disabled={isSubmittingAll}
                  class="w-full px-3 py-2 theme-bg-primary theme-border theme-text-primary rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
                />
              </div>
            {/if}

            {#if isLoadingStandardWorks}
              <div class="flex items-center gap-2 py-2">
                <Loader class="w-4 h-4 animate-spin text-blue-600" />
                <span class="text-sm theme-text-secondary">Loading available standard works...</span>
              </div>
            {:else if availableStandardWorks.length === 0}
              <div class="p-3 theme-bg-yellow-50 dark:theme-bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                <p class="text-sm theme-text-primary">No available standard works for this work order.</p>
              </div>
            {:else if filteredStandardWorks.length === 0}
              <div class="p-3 theme-bg-yellow-50 dark:theme-bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                <p class="text-sm theme-text-primary">No standard works match your search.</p>
              </div>
            {:else}
              <div class="border theme-border rounded-lg max-h-64 overflow-y-auto">
                {#each filteredStandardWorks as work}
                  <label class="flex items-start gap-3 px-3 py-2 border-b theme-border last:border-b-0 cursor-pointer hover:theme-bg-secondary">
                    <input
                      type="checkbox"
                      class="mt-1"
                      checked={selectedWorkCodes.has(work.derived_sw_code)}
                      on:change={(e) => toggleWorkSelection(work.derived_sw_code, (e.currentTarget as HTMLInputElement).checked)}
                      disabled={isSubmittingAll}
                    />
                    <div class="text-sm">
                      <div class="font-medium theme-text-primary">{work.derived_sw_code} - {work.sw_name}</div>
                      {#if work.type_description}
                        <div class="theme-text-secondary text-xs">{work.type_description}</div>
                      {/if}
                    </div>
                  </label>
                {/each}
              </div>
            {/if}
          </div>
        {/if}

        {#if selectedWorkOrderId && selectedStage}
          <div>
            <label for="reason" class="block text-sm font-medium theme-text-primary mb-2">
              Reason for Addition (applies to selected works) <span class="text-red-500">*</span>
            </label>
            <textarea
              id="reason"
              bind:value={additionReason}
              disabled={isSubmittingAll}
              rows="3"
              placeholder="Enter reason for adding selected works..."
              class="w-full px-3 py-2 theme-bg-primary theme-border theme-text-primary rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
            ></textarea>
          </div>
        {/if}

        <div class="flex justify-end">
          <Button
            variant="primary"
            on:click={addSelectedWorksToQueue}
            disabled={!selectedStage || !selectedWorkOrderId || selectedWorkCodes.size === 0 || !additionReason.trim() || isSubmittingAll}
          >
            Add Selected Works to Queue
          </Button>
        </div>
      </div>
    </div>

    <div class="w-1/2">
      <div class="theme-bg-primary rounded-lg shadow border theme-border p-6 space-y-4">
        <div class="flex items-center justify-between">
          <h2 class="text-lg font-semibold theme-text-primary">Queued Works ({queue.length})</h2>
          <div class="flex items-center gap-2">
            <Button
              variant="secondary"
              on:click={() => (queue = [])}
              disabled={queue.length === 0 || isSubmittingAll}
            >
              Clear Queue
            </Button>
            <Button
              variant="primary"
              on:click={submitAllQueuedWorks}
              disabled={queue.length === 0 || isSubmittingAll}
            >
              {#if isSubmittingAll}
                <Loader class="w-4 h-4 mr-2 animate-spin" />
                Submitting...
              {:else}
                Submit All
              {/if}
            </Button>
          </div>
        </div>

        {#if queue.length === 0}
          <div class="p-4 theme-bg-yellow-50 dark:theme-bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
            <p class="text-sm theme-text-primary">
              Queue is empty. Add one or more standard works from the left panel.
            </p>
          </div>
        {:else}
          <div class="border theme-border rounded-lg max-h-[560px] overflow-y-auto">
            <table class="w-full text-sm">
              <thead class="theme-bg-secondary sticky top-0">
                <tr class="theme-text-primary">
                  <th class="text-left px-3 py-2">Stage</th>
                  <th class="text-left px-3 py-2">Work Order</th>
                  <th class="text-left px-3 py-2">Work</th>
                  <th class="text-left px-3 py-2">Reason</th>
                  <th class="text-left px-3 py-2">Action</th>
                </tr>
              </thead>
              <tbody>
                {#each queue as item}
                  <tr class="border-t theme-border align-top">
                    <td class="px-3 py-2 theme-text-primary">{item.stage}</td>
                    <td class="px-3 py-2 theme-text-primary">{item.workOrderLabel}</td>
                    <td class="px-3 py-2 theme-text-primary">
                      <div class="font-medium">{item.derivedSwCode}</div>
                      <div class="text-xs theme-text-secondary">{item.swName}</div>
                      {#if item.typeDescription}
                        <div class="text-xs theme-text-secondary">{item.typeDescription}</div>
                      {/if}
                    </td>
                    <td class="px-3 py-2 theme-text-primary break-words max-w-xs">{item.additionReason}</td>
                    <td class="px-3 py-2">
                      <button
                        class="text-red-600 hover:text-red-700 disabled:opacity-50"
                        on:click={() => removeQueueItem(item.queueKey)}
                        disabled={isSubmittingAll}
                        aria-label="Remove item"
                        title="Remove item"
                      >
                        <Trash2 class="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        {/if}
      </div>
    </div>
  </div>
</div>

<FloatingThemeToggle />
