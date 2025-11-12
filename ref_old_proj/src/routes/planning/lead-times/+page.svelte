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
    fetchLeadTimes,
    fetchLeadTimesHistory,
    fetchAllStageOrders,
    createLeadTime,
    updateLeadTime,
    deleteLeadTime,
    checkLeadTimeExists,
    type LeadTime,
    type LeadTimeHistory,
    type StageOrder
  } from '$lib/api/leadTimes';

  // Page state
  let leadTimes: LeadTime[] = [];
  let leadTimesHistory: LeadTimeHistory[] = [];
  let workOrderTypes: string[] = [];
  let stageOrders: StageOrder[] = [];
  let isLoading = false;
  let isHistoryLoading = false;
  let message = '';
  let messageType: 'success' | 'error' = 'success';

  // Form state
  let isEditMode = false;
  let selectedTypeName = '';
  let selectedPlantStage = '';
  let prdnTime = 0;
  let editingId: number | null = null;

  // Sidebar state
  let showSidebar = false;
  let menus: any[] = [];

  // History state
  let showHistory = false;

  // Data table state
  let tableData: { [key: string]: { [key: string]: LeadTime | null } } = {};

  // Get current user from session
  $: currentUser = $page.data.session?.user?.email || (typeof window !== 'undefined' ? localStorage.getItem('username') : null) || 'Unknown User';

  onMount(async () => {
    const username = typeof window !== 'undefined' ? localStorage.getItem('username') : null;
    if (username) {
      menus = await fetchUserMenus();
    }
    await Promise.all([loadWorkOrderTypes(), loadStageOrders(), loadLeadTimes(), loadLeadTimesHistory()]);
  });

  async function loadWorkOrderTypes() {
    try {
      workOrderTypes = await fetchWorkOrderTypes();
    } catch (error) {
      showMessage('Error loading work order types', 'error');
      console.error('Error loading work order types:', error);
    }
  }

  async function loadStageOrders() {
    try {
      stageOrders = await fetchAllStageOrders();
    } catch (error) {
      showMessage('Error loading stage orders', 'error');
      console.error('Error loading stage orders:', error);
    }
  }

  async function loadLeadTimes() {
    try {
      isLoading = true;
      leadTimes = await fetchLeadTimes();
      buildTableData();
    } catch (error) {
      showMessage('Error loading lead times', 'error');
      console.error('Error loading lead times:', error);
    } finally {
      isLoading = false;
    }
  }

  async function loadLeadTimesHistory() {
    try {
      isHistoryLoading = true;
      leadTimesHistory = await fetchLeadTimesHistory();
    } catch (error) {
      console.error('Error loading lead times history:', error);
    } finally {
      isHistoryLoading = false;
    }
  }

  function buildTableData() {
    // Initialize table data structure
    tableData = {};
    
    // Group stage orders by work order type and get ordered plant stages
    const stageOrdersByType: { [key: string]: string[] } = {};
    stageOrders.forEach(order => {
      if (!stageOrdersByType[order.wo_type_name]) {
        stageOrdersByType[order.wo_type_name] = [];
      }
      stageOrdersByType[order.wo_type_name].push(order.plant_stage);
    });

    // Initialize table data with only applicable plant stages in correct order
    workOrderTypes.forEach(typeName => {
      tableData[typeName] = {};
      const applicableStages = stageOrdersByType[typeName] || [];
      applicableStages.forEach(plantStage => {
        tableData[typeName][plantStage] = null;
      });
    });

    // Fill in existing lead times
    leadTimes.forEach(leadTime => {
      if (tableData[leadTime.type_name] && tableData[leadTime.type_name][leadTime.plant_stage] !== undefined) {
        tableData[leadTime.type_name][leadTime.plant_stage] = leadTime;
      }
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
    prdnTime = 0;
    editingId = null;
  }

  function handleEdit(leadTime: LeadTime) {
    isEditMode = true;
    selectedTypeName = leadTime.type_name;
    selectedPlantStage = leadTime.plant_stage;
    prdnTime = leadTime.prdn_time;
    editingId = leadTime.id;
  }

  function handleEditCell(typeName: string, plantStage: string) {
    const existingLeadTime = tableData[typeName][plantStage];
    if (existingLeadTime) {
      handleEdit(existingLeadTime);
    } else {
      // Create new entry for this combination
      isEditMode = true;
      selectedTypeName = typeName;
      selectedPlantStage = plantStage;
      prdnTime = 0;
      editingId = null;
    }
  }

  function handleCancel() {
    isEditMode = false;
    selectedTypeName = '';
    selectedPlantStage = '';
    prdnTime = 0;
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

    if (prdnTime <= 0) {
      showMessage('Production time must be greater than 0', 'error');
      return;
    }

    try {
      isLoading = true;

      if (editingId) {
        // Update existing lead time
        await updateLeadTime(editingId, selectedTypeName, selectedPlantStage, prdnTime, currentUser);
        showMessage('Lead time updated successfully');
      } else {
        // Check if lead time already exists for this type and plant stage combination
        const existing = await checkLeadTimeExists(selectedTypeName, selectedPlantStage);
        if (existing) {
          showMessage(`Lead time already exists for ${selectedTypeName} - ${selectedPlantStage} combination`, 'error');
          return;
        }

        // Create new lead time
        await createLeadTime(selectedTypeName, selectedPlantStage, prdnTime, currentUser);
        showMessage('Lead time created successfully');
      }

      isEditMode = false;
      await Promise.all([loadLeadTimes(), loadLeadTimesHistory()]);
    } catch (error) {
      showMessage('Error saving lead time', 'error');
      console.error('Error saving lead time:', error);
    } finally {
      isLoading = false;
    }
  }

  async function handleDelete(leadTime: LeadTime) {
    if (confirm(`Are you sure you want to delete the lead time for ${leadTime.type_name} - ${leadTime.plant_stage}?`)) {
      try {
        await deleteLeadTime(leadTime.id);
        showMessage('Lead time deleted successfully');
        await Promise.all([loadLeadTimes(), loadLeadTimesHistory()]);
      } catch (error) {
        showMessage('Error deleting lead time', 'error');
        console.error('Error deleting lead time:', error);
      }
    }
  }

  function getApplicablePlantStages(typeName: string): string[] {
    if (!typeName) return [];
    return stageOrders
      .filter(order => order.wo_type_name === typeName)
      .sort((a, b) => a.order_no - b.order_no)
      .map(order => order.plant_stage);
  }

  function calculateTotalLeadTime(typeName: string): number {
    if (!tableData[typeName]) return 0;
    
    return Object.values(tableData[typeName])
      .filter(leadTime => leadTime !== null)
      .reduce((total, leadTime) => total + (leadTime?.prdn_time || 0), 0);
  }

  function calculateTotalLeadTimeFromData(typeName: string): number {
    return leadTimes
      .filter(leadTime => leadTime.type_name === typeName)
      .reduce((total, leadTime) => total + leadTime.prdn_time, 0);
  }



  function handleSidebarToggle() {
    showSidebar = !showSidebar;
  }

  function toggleHistory() {
    showHistory = !showHistory;
  }
</script>

<svelte:head>
  <title>Lead Times - Production Management</title>
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
        <!-- Current Lead Times Table -->
        <div class="theme-bg-primary rounded-lg shadow-lg p-6 mb-6">
          <div class="flex items-center justify-between mb-4">
            <h2 class="text-xl font-semibold theme-text-primary">
              Lead Times Matrix
            </h2>
            {#if !isEditMode}
              <Button
                variant="primary"
                on:click={handleAdd}
              >
                <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                Add Lead Time
              </Button>
            {/if}
          </div>

                    {#if Object.keys(tableData).length > 0}
            <div class="space-y-6">
                            {#each Object.entries(tableData) as [typeName, plantStageData]}
                <div class="theme-bg-secondary rounded-lg p-4">
                  <div class="flex items-center justify-between mb-4">
                    <h3 class="text-lg font-semibold theme-text-primary">{typeName}</h3>
                    <div class="text-right">
                      <p class="text-sm theme-text-secondary">Total Lead Time</p>
                      <p class="text-xl font-bold theme-text-primary">
                        {calculateTotalLeadTimeFromData(typeName)} hours
                      </p>
                    </div>
                  </div>
                  <div class="theme-bg-primary rounded-lg p-4">
                    <!-- Simple Bar Chart -->
                    <div class="space-y-4">
                      {#each Object.entries(plantStageData) as [plantStage, leadTime]}
                        <div class="flex items-center space-x-4">
                          <div class="w-32 text-sm font-medium theme-text-primary">
                            {plantStage}
                          </div>
                          <div class="flex-1">
                            <div class="relative">
                              <div 
                                class="bg-blue-500 rounded h-8 flex items-center justify-end pr-2 text-white text-sm font-medium"
                                style="width: {leadTime ? Math.min(leadTime.prdn_time * 20, 100) : 0}%"
                              >
                                {leadTime ? leadTime.prdn_time + 'h' : '0h'}
                              </div>
                            </div>
                          </div>
                          <div class="flex gap-2">
                            {#if leadTime}
                              <button
                                on:click={() => handleEdit(leadTime)}
                                class="p-1 text-blue-600 hover:text-blue-800 transition-colors"
                                aria-label="Edit lead time"
                                title="Edit"
                              >
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                              </button>
                              <button
                                on:click={() => handleDelete(leadTime)}
                                class="p-1 text-red-600 hover:text-red-800 transition-colors"
                                aria-label="Delete lead time"
                                title="Delete"
                              >
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            {:else}
                              <button
                                on:click={() => handleEditCell(typeName, plantStage)}
                                class="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                                aria-label="Add lead time"
                                title="Add lead time"
                              >
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                                </svg>
                              </button>
                            {/if}
                          </div>
                        </div>
                      {/each}
                    </div>
                    
                    <!-- Action Buttons -->
                    <div class="flex justify-center gap-4 mt-6">
                      <Button
                        variant="primary"
                        on:click={() => handleAdd()}
                      >
                        <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                        </svg>
                        Add Lead Time
                      </Button>
                    </div>
                  </div>
                </div>
              {/each}
            </div>
          {:else}
            <div class="text-center py-8">
              <p class="text-lg theme-text-secondary mb-4">No data available</p>
              <p class="text-sm theme-text-tertiary">
                Please configure stage orders in <a href="/planning/order-of-stages" class="text-blue-600 hover:text-blue-800 underline">Order of Stages</a> first
              </p>
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
                    bind:value={selectedTypeName}
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
                    {#each getApplicablePlantStages(selectedTypeName) as stage}
                      <option value={stage}>{stage}</option>
                    {/each}
                  </select>
                  {#if editingId}
                    <p class="mt-1 text-xs theme-text-secondary">
                      Plant stage cannot be changed in edit mode
                    </p>
                  {/if}
                </div>

                <!-- Production Time -->
                <div>
                  <label for="prdnTime" class="block text-sm font-medium theme-text-primary mb-2">
                    Production Time (hours) *
                  </label>
                  <input
                    id="prdnTime"
                    type="number"
                    bind:value={prdnTime}
                    min="0.01"
                    step="0.01"
                    class="w-full px-3 py-2 border theme-border rounded-lg theme-bg-primary theme-text-primary focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter production time in hours"
                    required
                  />
                  <p class="mt-1 text-xs theme-text-secondary">
                    Enter the production time in hours (e.g., 2.5 for 2 hours 30 minutes)
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
                      {editingId ? 'Update Lead Time' : 'Save Lead Time'}
                    {/if}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        {/if}

        <!-- Lead Times History -->
        <div class="theme-bg-primary rounded-lg shadow-lg p-6">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-lg font-semibold theme-text-primary">Lead Times History</h3>
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
            {:else if leadTimesHistory.length === 0}
              <div class="text-center py-8">
                <p class="theme-text-secondary">No lead times history found</p>
              </div>
            {:else}
              <div class="space-y-4">
                {#each leadTimesHistory as history}
                  <div class="theme-bg-secondary rounded-lg p-4">
                    <div class="flex items-center justify-between mb-3">
                      <div class="flex items-center gap-4">
                        <div>
                          <span class="text-sm font-medium theme-text-secondary">Work Order Type</span>
                          <p class="text-lg font-bold theme-text-primary">{history.type_name}</p>
                        </div>
                        <div>
                          <span class="text-sm font-medium theme-text-secondary">Plant Stage</span>
                          <p class="text-lg font-semibold theme-text-primary">{history.plant_stage}</p>
                        </div>
                        <div>
                          <span class="text-sm font-medium theme-text-secondary">Production Time</span>
                          <p class="text-lg font-semibold theme-text-primary">{history.prdn_time} hours</p>
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