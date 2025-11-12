<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { formatDate } from '$lib/utils/formatDate';
  import Button from '$lib/components/common/Button.svelte';
  import Sidebar from '$lib/components/navigation/Sidebar.svelte';
  import AppHeader from '$lib/components/common/AppHeader.svelte';
  import FloatingThemeToggle from '$lib/components/common/FloatingThemeToggle.svelte';
  import { fetchUserMenus } from '$lib/api/menu';
  import {
    fetchWorkOrderTypes,
    fetchPlantStages,
    fetchStageOrders,
    fetchStageOrdersHistory,
    createStageOrder,
    updateStageOrder,
    deleteStageOrder,
    checkStageOrderExists,
    getNextOrderNo,
    type StageOrder,
    type StageOrderHistory
  } from '$lib/api/stageOrder';

  // Page state
  let stageOrders: StageOrder[] = [];
  let stageOrdersHistory: StageOrderHistory[] = [];
  let workOrderTypes: string[] = [];
  let plantStages: string[] = [];
  let isLoading = false;
  let isHistoryLoading = false;
  let message = '';
  let messageType: 'success' | 'error' = 'success';

  // Form state
  let isEditMode = false;
  let selectedTypeName = '';
  let selectedPlantStage = '';
  let orderNo = 1;
  let editingId: number | null = null;

  // Sidebar state
  let showSidebar = false;
  let menus: any[] = [];

  // History state
  let showHistory = false;

  // Data table state
  let tableData: { [key: string]: StageOrder[] } = {};

  // Get current user from session
  $: currentUser = $page.data.session?.user?.email || (typeof window !== 'undefined' ? localStorage.getItem('username') : null) || 'Unknown User';

  onMount(async () => {
    const username = typeof window !== 'undefined' ? localStorage.getItem('username') : null;
    if (username) {
      menus = await fetchUserMenus();
    }
    await Promise.all([loadWorkOrderTypes(), loadPlantStages(), loadStageOrders(), loadStageOrdersHistory()]);
  });

  async function loadWorkOrderTypes() {
    try {
      workOrderTypes = await fetchWorkOrderTypes();
    } catch (error) {
      showMessage('Error loading work order types', 'error');
      console.error('Error loading work order types:', error);
    }
  }

  async function loadPlantStages() {
    try {
      plantStages = await fetchPlantStages();
    } catch (error) {
      showMessage('Error loading plant stages', 'error');
      console.error('Error loading plant stages:', error);
    }
  }

  async function loadStageOrders() {
    try {
      isLoading = true;
      stageOrders = await fetchStageOrders();
      buildTableData();
    } catch (error) {
      showMessage('Error loading stage orders', 'error');
      console.error('Error loading stage orders:', error);
    } finally {
      isLoading = false;
    }
  }

  async function loadStageOrdersHistory() {
    try {
      isHistoryLoading = true;
      stageOrdersHistory = await fetchStageOrdersHistory();
    } catch (error) {
      console.error('Error loading stage orders history:', error);
    } finally {
      isHistoryLoading = false;
    }
  }

  function buildTableData() {
    // Group stage orders by work order type
    tableData = {};
    stageOrders.forEach(order => {
      if (!tableData[order.wo_type_name]) {
        tableData[order.wo_type_name] = [];
      }
      tableData[order.wo_type_name].push(order);
    });

    // Sort each group by order_no
    Object.keys(tableData).forEach(typeName => {
      tableData[typeName].sort((a, b) => a.order_no - b.order_no);
    });
  }

  function showMessage(msg: string, type: 'success' | 'error' = 'success') {
    message = msg;
    messageType = type;
    setTimeout(() => {
      message = '';
    }, 5000);
  }

  function handleAdd() {
    isEditMode = true;
    selectedTypeName = '';
    selectedPlantStage = '';
    orderNo = 1;
    editingId = null;
  }

  function handleEdit(stageOrder: StageOrder) {
    isEditMode = true;
    selectedTypeName = stageOrder.wo_type_name;
    selectedPlantStage = stageOrder.plant_stage;
    orderNo = stageOrder.order_no;
    editingId = stageOrder.id;
  }



  function handleCancel() {
    isEditMode = false;
    selectedTypeName = '';
    selectedPlantStage = '';
    orderNo = 1;
    editingId = null;
  }

  async function handleSave() {
    if (!selectedTypeName) {
      showMessage('Please select a work order type', 'error');
      return;
    }

    if (!selectedPlantStage) {
      showMessage('Please select a plant stage', 'error');
      return;
    }

    if (orderNo <= 0) {
      showMessage('Order number must be greater than 0', 'error');
      return;
    }

    try {
      isLoading = true;

      if (editingId) {
        // Update existing stage order
        await updateStageOrder(editingId, selectedTypeName, selectedPlantStage, orderNo, currentUser);
        showMessage('Stage order updated successfully');
      } else {
        // Check if stage order already exists for this type and plant stage combination
        const existing = await checkStageOrderExists(selectedTypeName, selectedPlantStage);
        if (existing) {
          showMessage(`Stage order already exists for ${selectedTypeName} - ${selectedPlantStage} combination`, 'error');
          return;
        }

        // Create new stage order
        await createStageOrder(selectedTypeName, selectedPlantStage, orderNo, currentUser);
        showMessage('Stage order created successfully');
      }

      isEditMode = false;
      await Promise.all([loadStageOrders(), loadStageOrdersHistory()]);
    } catch (error) {
      showMessage('Error saving stage order', 'error');
      console.error('Error saving stage order:', error);
    } finally {
      isLoading = false;
    }
  }

  async function handleDelete(stageOrder: StageOrder) {
    if (confirm(`Are you sure you want to delete the stage order for ${stageOrder.wo_type_name} - ${stageOrder.plant_stage}?`)) {
      try {
        await deleteStageOrder(stageOrder.id);
        showMessage('Stage order deleted successfully');
        await Promise.all([loadStageOrders(), loadStageOrdersHistory()]);
      } catch (error) {
        showMessage('Error deleting stage order', 'error');
        console.error('Error deleting stage order:', error);
      }
    }
  }

  async function handleTypeChange() {
    if (selectedTypeName && !editingId) {
      // Auto-set the next order number for new entries
      try {
        orderNo = await getNextOrderNo(selectedTypeName);
      } catch (error) {
        console.error('Error getting next order number:', error);
        orderNo = 1;
      }
    }
  }

  function handleSidebarToggle() {
    showSidebar = !showSidebar;
  }

  function toggleHistory() {
    showHistory = !showHistory;
  }
</script>

<svelte:head>
  <title>Order of Stages - Production Management</title>
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
    title="Order of Stages Management"
    onSidebarToggle={handleSidebarToggle}
  />

  <!-- Message Display -->
  {#if message}
    <div class="p-4 {messageType === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'} rounded-lg mx-4 mt-4">
      {message}
    </div>
  {/if}

  <!-- Main Content -->
  <div class="flex-1 p-6">
    {#if isLoading}
      <div class="flex items-center justify-center h-64">
        <div class="text-center">
          <div class="animate-spin rounded-full h-12 w-12 border-b-2 theme-accent mx-auto mb-4"></div>
          <p class="theme-text-primary">Loading stage orders...</p>
        </div>
      </div>
    {:else}
      <div class="max-w-7xl mx-auto">
        <!-- Current Stage Orders -->
        <div class="theme-bg-primary rounded-lg shadow-lg p-6 mb-6">
          <div class="flex items-center justify-between mb-4">
            <h2 class="text-xl font-semibold theme-text-primary">
              Stage Orders by Work Order Type
            </h2>
            {#if !isEditMode}
              <Button
                variant="primary"
                on:click={handleAdd}
              >
                <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                Add Stage Order
              </Button>
            {/if}
          </div>

          {#if Object.keys(tableData).length > 0}
            <div class="space-y-6">
              {#each Object.entries(tableData) as [typeName, orders]}
                <div class="theme-bg-secondary rounded-lg p-4">
                  <h3 class="text-lg font-semibold theme-text-primary mb-4">{typeName}</h3>
                  <div class="overflow-x-auto">
                    <table class="w-full border-collapse theme-border">
                      <thead>
                        <tr class="theme-bg-primary">
                          <th class="px-4 py-2 text-left font-medium theme-text-primary border theme-border">
                            Order
                          </th>
                          <th class="px-4 py-2 text-left font-medium theme-text-primary border theme-border">
                            Plant Stage
                          </th>
                          <th class="px-4 py-2 text-center font-medium theme-text-primary border theme-border">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {#each orders as order}
                          <tr class="hover:theme-bg-primary transition-colors">
                            <td class="px-4 py-2 font-medium theme-text-primary border theme-border">
                              {order.order_no}
                            </td>
                            <td class="px-4 py-2 theme-text-primary border theme-border">
                              {order.plant_stage}
                            </td>
                            <td class="px-4 py-2 text-center border theme-border">
                              <div class="flex items-center justify-center gap-2">
                                <button
                                  on:click={() => handleEdit(order)}
                                  class="p-1 text-blue-600 hover:text-blue-800 transition-colors"
                                  aria-label="Edit stage order"
                                  title="Edit"
                                >
                                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                  </svg>
                                </button>
                                <button
                                  on:click={() => handleDelete(order)}
                                  class="p-1 text-red-600 hover:text-red-800 transition-colors"
                                  aria-label="Delete stage order"
                                  title="Delete"
                                >
                                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                  <div class="mt-2 text-xs theme-text-tertiary">
                    Total stages: {orders.length}
                  </div>
                </div>
              {/each}
            </div>
          {:else}
            <div class="text-center py-8">
              <p class="text-lg theme-text-secondary mb-4">No stage orders found</p>
              <p class="text-sm theme-text-tertiary">Click "Add Stage Order" to create the first stage order</p>
            </div>
          {/if}
        </div>

        <!-- Edit Form Modal -->
        {#if isEditMode}
          <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div class="theme-bg-primary rounded-lg shadow-xl p-6 w-full max-w-md">
              <h2 class="text-xl font-semibold theme-text-primary mb-6">
                {editingId ? 'Edit Stage Order' : 'Add New Stage Order'}
              </h2>

              <form on:submit|preventDefault={handleSave} class="space-y-6">
                <!-- Work Order Type -->
                <div>
                  <label for="typeName" class="block text-sm font-medium theme-text-primary mb-2">
                    Work Order Type *
                  </label>
                  <select
                    id="typeName"
                    bind:value={selectedTypeName}
                    on:change={handleTypeChange}
                    class="w-full px-3 py-2 border theme-border rounded-lg theme-bg-primary theme-text-primary focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                    disabled={editingId !== null}
                  >
                    <option value="">Select a work order type</option>
                    {#each workOrderTypes as type}
                      <option value={type}>{type}</option>
                    {/each}
                  </select>
                  {#if editingId}
                    <p class="mt-1 text-xs theme-text-secondary">
                      Work order type cannot be changed in edit mode
                    </p>
                  {/if}
                </div>

                <!-- Plant Stage -->
                <div>
                  <label for="plantStage" class="block text-sm font-medium theme-text-primary mb-2">
                    Plant Stage *
                  </label>
                  <select
                    id="plantStage"
                    bind:value={selectedPlantStage}
                    class="w-full px-3 py-2 border theme-border rounded-lg theme-bg-primary theme-text-primary focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                    disabled={editingId !== null}
                  >
                    <option value="">Select a plant stage</option>
                    {#each plantStages as stage}
                      <option value={stage}>{stage}</option>
                    {/each}
                  </select>
                  {#if editingId}
                    <p class="mt-1 text-xs theme-text-secondary">
                      Plant stage cannot be changed in edit mode
                    </p>
                  {/if}
                </div>

                <!-- Order Number -->
                <div>
                  <label for="orderNo" class="block text-sm font-medium theme-text-primary mb-2">
                    Order Number *
                  </label>
                  <input
                    id="orderNo"
                    type="number"
                    bind:value={orderNo}
                    min="1"
                    class="w-full px-3 py-2 border theme-border rounded-lg theme-bg-primary theme-text-primary focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter order number"
                    required
                  />
                  <p class="mt-1 text-xs theme-text-secondary">
                    The sequence number for this plant stage in the production process
                  </p>
                </div>

                <!-- Action Buttons -->
                <div class="flex justify-end gap-3 pt-4">
                  <Button
                    type="button"
                    variant="secondary"
                    on:click={handleCancel}
                    disabled={isLoading}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    variant="primary"
                    disabled={isLoading}
                  >
                    {#if isLoading}
                      <svg class="animate-spin -ml-1 mr-3 h-5 w-5 text-white inline" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Saving...
                    {:else}
                      {editingId ? 'Update Stage Order' : 'Save Stage Order'}
                    {/if}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        {/if}

        <!-- Stage Orders History -->
        <div class="theme-bg-primary rounded-lg shadow-lg p-6">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-lg font-semibold theme-text-primary">Stage Orders History</h3>
            <button
              on:click={toggleHistory}
              class="flex items-center gap-2 px-3 py-1 text-sm theme-text-secondary hover:theme-text-primary transition-colors"
            >
              {showHistory ? 'Hide' : 'Show'} History
              <svg 
                class="w-4 h-4 transition-transform {showHistory ? 'rotate-180' : ''}" 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>

          {#if showHistory}
            {#if isHistoryLoading}
              <div class="flex items-center justify-center py-8">
                <div class="animate-spin rounded-full h-8 w-8 border-b-2 theme-accent"></div>
                <span class="ml-3 theme-text-secondary">Loading history...</span>
              </div>
            {:else if stageOrdersHistory.length === 0}
              <div class="text-center py-8">
                <p class="theme-text-secondary">No stage orders history found</p>
              </div>
            {:else}
              <div class="space-y-4">
                {#each stageOrdersHistory as history}
                  <div class="theme-bg-secondary rounded-lg p-4">
                    <div class="flex items-center justify-between mb-3">
                      <div class="flex items-center gap-4">
                        <div>
                          <span class="text-sm font-medium theme-text-secondary">Work Order Type</span>
                          <p class="text-lg font-bold theme-text-primary">{history.wo_type_name}</p>
                        </div>
                        <div>
                          <span class="text-sm font-medium theme-text-secondary">Plant Stage</span>
                          <p class="text-lg font-semibold theme-text-primary">{history.plant_stage}</p>
                        </div>
                        <div>
                          <span class="text-sm font-medium theme-text-secondary">Order Number</span>
                          <p class="text-lg font-semibold theme-text-primary">{history.order_no}</p>
                        </div>
                        <div>
                          <span class="text-sm font-medium theme-text-secondary">History ID</span>
                          <p class="text-xs theme-text-tertiary">#{history.his_id}</p>
                        </div>
                      </div>
                      <div class="text-right">
                        <p class="text-xs theme-text-tertiary">Created by {history.created_by}</p>
                        <p class="text-xs theme-text-tertiary">{formatDate(history.created_dt)}</p>
                      </div>
                    </div>
                  </div>
                {/each}
              </div>
            {/if}
          {/if}
        </div>
      </div>
    {/if}
  </div>
</div>

<!-- Floating Theme Toggle -->
<FloatingThemeToggle /> 