<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import Sidebar from '$lib/components/navigation/Sidebar.svelte';
  import AppHeader from '$lib/components/common/AppHeader.svelte';
  import FloatingThemeToggle from '$lib/components/common/FloatingThemeToggle.svelte';
  import Button from '$lib/components/common/Button.svelte';
  import { fetchUserMenus } from '$lib/services/menuService';
  import { 
    fetchWorkOrderTypes,
    fetchPlantStages,
    fetchWorkOrderStageOrders,
    type WorkOrderStageOrder
  } from '$lib/api/planning';
  import { supabase } from '$lib/supabaseClient';

  // Page state
  let isLoading = false;
  let message = '';
  let messageType: 'success' | 'error' = 'success';

  // Form state
  let isEditMode = false;
  let selectedWorkOrderType = '';
  let selectedPlantStage = '';
  let orderNo = 1;
  let leadTimeHours = 8;
  let editingId: number | null = null;

  // Data state
  let workOrderTypes: string[] = [];
  let plantStages: string[] = [];
  let stageOrders: WorkOrderStageOrder[] = [];

  // Sidebar state
  let showSidebar = false;
  let menus: any[] = [];

  // Get current user from session
  $: currentUser = $page.data.session?.user?.email || (typeof window !== 'undefined' ? localStorage.getItem('username') : null) || 'Unknown User';

  onMount(async () => {
    const username = typeof window !== 'undefined' ? localStorage.getItem('username') : null;
    if (username) {
      menus = await fetchUserMenus(username);
    }
    await Promise.all([
      loadWorkOrderTypes(), 
      loadPlantStages(), 
      loadStageOrders()
    ]);
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
      const orders = await fetchWorkOrderStageOrders();
      stageOrders = orders;
    } catch (error) {
      showMessage('Error loading stage orders', 'error');
      console.error('Error loading stage orders:', error);
    } finally {
      isLoading = false;
    }
  }

  function showMessage(msg: string, type: 'success' | 'error' = 'success') {
    message = msg;
    messageType = type;
    setTimeout(() => {
      message = '';
    }, 5000);
  }

  function handleAdd() {
    console.log('handleAdd called');
    isEditMode = true;
    selectedWorkOrderType = '';
    selectedPlantStage = '';
    orderNo = 1;
    leadTimeHours = 8;
    editingId = null;
  }

  function handleEdit(stageOrder: WorkOrderStageOrder) {
    isEditMode = true;
    selectedWorkOrderType = stageOrder.wo_type_name;
    selectedPlantStage = stageOrder.plant_stage;
    orderNo = stageOrder.order_no;
    leadTimeHours = stageOrder.lead_time_hours;
    editingId = stageOrder.id;
  }

  function handleCancel() {
    isEditMode = false;
    selectedWorkOrderType = '';
    selectedPlantStage = '';
    orderNo = 1;
    leadTimeHours = 8;
    editingId = null;
  }

  async function handleSave() {
    if (!selectedWorkOrderType) {
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

    if (leadTimeHours < 0) {
      showMessage('Lead time hours cannot be negative', 'error');
      return;
    }

    try {
      isLoading = true;

      if (editingId) {
        // Update existing stage order
        const { error } = await supabase
          .from('plan_wo_stage_order')
          .update({
            wo_type_name: selectedWorkOrderType,
            plant_stage: selectedPlantStage,
            order_no: orderNo,
            lead_time_hours: leadTimeHours,
            modified_by: currentUser,
            modified_dt: new Date().toISOString()
          })
          .eq('id', editingId);

        if (error) throw error;
        showMessage('Lead time updated successfully');
      } else {
        // Check if stage order already exists for this type and plant stage combination
        const existing = stageOrders.find(order => 
          order.wo_type_name === selectedWorkOrderType && 
          order.plant_stage === selectedPlantStage
        );
        
        if (existing) {
          showMessage(`Stage order already exists for ${selectedWorkOrderType} - ${selectedPlantStage} combination`, 'error');
          return;
        }

        // Create new stage order
        const { error } = await supabase
          .from('plan_wo_stage_order')
          .insert([{
            wo_type_name: selectedWorkOrderType,
            plant_stage: selectedPlantStage,
            order_no: orderNo,
            lead_time_hours: leadTimeHours,
            created_by: currentUser,
            created_dt: new Date().toISOString()
          }]);

        if (error) throw error;
        showMessage('Lead time created successfully');
      }

      isEditMode = false;
      await loadStageOrders();
    } catch (error) {
      showMessage('Error saving lead time', 'error');
      console.error('Error saving lead time:', error);
    } finally {
      isLoading = false;
    }
  }

  async function handleDelete(stageOrder: WorkOrderStageOrder) {
    if (confirm(`Are you sure you want to delete the lead time for ${stageOrder.wo_type_name} - ${stageOrder.plant_stage}?`)) {
      try {
        const { error } = await supabase
          .from('plan_wo_stage_order')
          .delete()
          .eq('id', stageOrder.id);

        if (error) throw error;
        showMessage('Lead time deleted successfully');
        await loadStageOrders();
      } catch (error) {
        showMessage('Error deleting lead time', 'error');
        console.error('Error deleting lead time:', error);
      }
    }
  }

  async function handleTypeChange() {
    if (selectedWorkOrderType && !editingId) {
      // Auto-set the next order number for new entries
      const existingOrders = stageOrders.filter(order => order.wo_type_name === selectedWorkOrderType);
      if (existingOrders.length > 0) {
        const maxOrder = Math.max(...existingOrders.map(order => order.order_no));
        orderNo = maxOrder + 1;
      } else {
        orderNo = 1;
      }
    }
  }

  function handleSidebarToggle() {
    showSidebar = !showSidebar;
  }

  function getLeadTimeDescription(leadTime: number): string {
    if (leadTime === 0) return 'Immediate';
    if (leadTime < 24) return `${leadTime} hours after`;
    const days = Math.floor(leadTime / 24);
    const hours = leadTime % 24;
    if (hours === 0) return `${days} day${days !== 1 ? 's' : ''} after`;
    return `${days} day${days !== 1 ? 's' : ''} ${hours} hour${hours !== 1 ? 's' : ''} after`;
  }
</script>

<svelte:head>
  <title>Lead Times Management - Production Planning</title>
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
    title="Lead Times Management"
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
          <p class="theme-text-primary">Loading lead times...</p>
        </div>
      </div>
    {:else}
      <div class="max-w-7xl mx-auto">
        <!-- Current Lead Times -->
        <div class="theme-bg-primary rounded-lg shadow-lg p-6 mb-6">
          <div class="flex items-center justify-between mb-4">
            <h2 class="text-xl font-semibold theme-text-primary">
              Lead Times by Work Order Type
            </h2>
            {#if !isEditMode}
              <Button
                variant="primary"
                type="button"
                on:click={(e) => {
                  console.log('Button click event received', e);
                  handleAdd();
                }}
              >
                <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                Add Lead Time
              </Button>
            {/if}
          </div>

          {#if stageOrders.length > 0}
            <div class="space-y-6">
              {#each Object.entries(stageOrders.reduce((acc, order) => {
                if (!acc[order.wo_type_name]) acc[order.wo_type_name] = [];
                acc[order.wo_type_name].push(order);
                return acc;
              }, {} as Record<string, WorkOrderStageOrder[]>)) as [typeName, orders]}
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
                            Lead Time
                          </th>
                          <th class="px-4 py-2 text-center font-medium theme-text-primary border theme-border">
                            Description
                          </th>
                          <th class="px-4 py-2 text-center font-medium theme-text-primary border theme-border">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {#each orders.sort((a, b) => a.order_no - b.order_no) as order}
                          <tr class="hover:theme-bg-primary transition-colors">
                            <td class="px-4 py-2 font-medium theme-text-primary border theme-border">
                              {order.order_no}
                            </td>
                            <td class="px-4 py-2 theme-text-primary border theme-border">
                              {order.plant_stage}
                            </td>
                            <td class="px-4 py-2 text-center theme-text-primary border theme-border">
                              {order.lead_time_hours} hour{order.lead_time_hours !== 1 ? 's' : ''}
                            </td>
                            <td class="px-4 py-2 text-center theme-text-primary border theme-border">
                              <span class="text-sm theme-text-secondary">
                                {getLeadTimeDescription(order.lead_time_hours)}
                              </span>
                            </td>
                            <td class="px-4 py-2 text-center border theme-border">
                              <div class="flex items-center justify-center gap-2">
                                <button
                                  on:click={() => handleEdit(order)}
                                  class="p-1 text-blue-600 hover:text-blue-800 transition-colors"
                                  aria-label="Edit lead time"
                                  title="Edit"
                                >
                                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                  </svg>
                                </button>
                                <button
                                  on:click={() => handleDelete(order)}
                                  class="p-1 text-red-600 hover:text-red-800 transition-colors"
                                  aria-label="Delete lead time"
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
              <p class="text-lg theme-text-secondary mb-4">No lead times found</p>
              <p class="text-sm theme-text-tertiary">Click "Add Lead Time" to create the first lead time configuration</p>
            </div>
          {/if}
        </div>

        <!-- Edit Form Modal -->
        {#if isEditMode}
          <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div class="theme-bg-primary rounded-lg shadow-xl p-6 w-full max-w-md">
              <h2 class="text-xl font-semibold theme-text-primary mb-6">
                {editingId ? 'Edit Lead Time' : 'Add New Lead Time'}
              </h2>

              <form on:submit|preventDefault={handleSave} class="space-y-6">
                <!-- Work Order Type -->
                <div>
                  <label for="typeName" class="block text-sm font-medium theme-text-primary mb-2">
                    Work Order Type *
                  </label>
                  <select
                    id="typeName"
                    bind:value={selectedWorkOrderType}
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
                  {#if workOrderTypes.length === 0}
                    <p class="mt-1 text-xs text-red-600 dark:text-red-400">
                      No work order types found. Please add work order types first.
                    </p>
                  {/if}
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
                  {#if plantStages.length === 0}
                    <p class="mt-1 text-xs text-red-600 dark:text-red-400">
                      No plant stages found. Please add plant stages in Data Elements first.
                    </p>
                  {/if}
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

                <!-- Lead Time Hours -->
                <div>
                  <label for="leadTimeHours" class="block text-sm font-medium theme-text-primary mb-2">
                    Lead Time (Hours) *
                  </label>
                  <input
                    id="leadTimeHours"
                    type="number"
                    bind:value={leadTimeHours}
                    min="0"
                    class="w-full px-3 py-2 border theme-border rounded-lg theme-bg-primary theme-text-primary focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter lead time in hours"
                    required
                  />
                  <p class="mt-1 text-xs theme-text-secondary">
                    Hours to wait after previous stage completion before starting this stage
                  </p>
                </div>

                <!-- Action Buttons -->
                <div class="flex justify-end gap-3 pt-4">
                  <Button
                    variant="secondary"
                    on:click={handleCancel}
                    disabled={isLoading}
                  >
                    Cancel
                  </Button>
                  <Button
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
                      {editingId ? 'Update Lead Time' : 'Save Lead Time'}
                    {/if}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        {/if}
      </div>
    {/if}
  </div>
</div>

<!-- Floating Theme Toggle -->
<FloatingThemeToggle />
