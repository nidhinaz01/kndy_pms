<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import Sidebar from '$lib/components/navigation/Sidebar.svelte';
  import FloatingThemeToggle from '$lib/components/common/FloatingThemeToggle.svelte';
  import { fetchUserMenus } from '$lib/services/menuService';
  import EntrySlotSelectionModal from '$lib/components/planning/EntrySlotSelectionModal.svelte';
  import PlanSummaryModal from '$lib/components/planning/PlanSummaryModal.svelte';
  import { loadWorkOrders, loadProductionDates, loadPlantStages, loadHolidays } from './services/entryPlanService';
  import { formatDate, formatDateTimeLocal, getRowBackgroundColor } from './utils/dateUtils';
  import { isWorkOrderInTab, isWorkOrderInStage, getWorkOrderDates, getCurrentStage, getTabDateComparison } from './utils/workOrderUtils';

  // Page state
  let isLoading = true;
  let isTableLoading = false;
  let showSidebar = false;
  
  // Modal state
  let showEntrySlotModal = false;
  let showPlanSummaryModal = false;
  let selectedWorkOrder: any = null;
  let selectedSlot: any = null;
  let calculatedDates: any = null;

  // Data
  let workOrders: any[] = [];
  let productionDates: any[] = [];
  let plantStages: string[] = [];
  let menus: any[] = [];
  let holidays: any[] = [];
  
  // Tab counts
  let tabCounts: Record<string, number> = {};
  
  // Reactive statement to calculate tab counts when data changes
  $: {
    if (workOrders.length > 0 && productionDates.length >= 0) {
      tabCounts = {};
      tabs.forEach(tab => {
        tabCounts[tab.id] = workOrders.filter(wo => isWorkOrderInTab(wo, tab.id, productionDates)).length;
      });
    }
  }

  // Tab state
  let activeTab = 'to-be-planned';
  let tabs = [
    { id: 'to-be-planned', label: 'To be Planned', icon: '📋' },
    { id: 'chassis-to-be-received', label: 'Chassis to be Received', icon: '🚛' },
    { id: 'documents-to-be-released', label: 'Documents to be Released', icon: '📄' },
    { id: 'wip', label: 'WIP', icon: '🚀' },
    { id: 'to-be-inspected', label: 'To be Inspected', icon: '🔍' },
    { id: 'to-be-delivered', label: 'To be Delivered', icon: '🚚' }
  ];

  // Filters
  let selectedStage = '';
  let searchTerm = '';

  // Filtered work orders based on active tab
  $: filteredWorkOrders = workOrders.filter(wo => {
    const matchesSearch = !searchTerm || 
      wo.wo_no.toLowerCase().includes(searchTerm.toLowerCase()) ||
      wo.wo_model.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStage = !selectedStage || isWorkOrderInStage(wo, selectedStage, productionDates);
    const matchesTab = isWorkOrderInTab(wo, activeTab, productionDates);
    return matchesSearch && matchesStage && matchesTab;
  });

  onMount(async () => {
    const username = typeof window !== 'undefined' ? localStorage.getItem('username') : null;
    if (username) {
      menus = await fetchUserMenus(username);
    }
    await loadData();
    isLoading = false;
  });

  async function loadData() {
    isTableLoading = true;
    try {
      const [woData, datesData, stagesData, holidaysData] = await Promise.all([
        loadWorkOrders(),
        loadProductionDates(),
        loadPlantStages(),
        loadHolidays()
      ]);
      workOrders = woData;
      productionDates = datesData;
      plantStages = stagesData;
      holidays = holidaysData;
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      isTableLoading = false;
    }
  }

  // Tab change handler
  async function handleTabChange(tabId: string) {
    activeTab = tabId;
  }

  // Helper functions for date formatting
  function getPlannedStartDate(workOrder: any): string {
    const dates = getWorkOrderDates(workOrder, productionDates);
    const firstEntry = dates.entryDates[0];
    return firstEntry ? formatDateTimeLocal(firstEntry.planned_date) : 'N/A';
  }

  function getPlannedEndDate(workOrder: any): string {
    const dates = getWorkOrderDates(workOrder, productionDates);
    const lastExit = dates.exitDates[dates.exitDates.length - 1];
    return lastExit ? formatDateTimeLocal(lastExit.planned_date) : 'N/A';
  }

  function getActualStartDate(workOrder: any): string {
    const dates = getWorkOrderDates(workOrder, productionDates);
    const firstActualEntry = dates.entryDates.find(entry => entry.actual_date);
    return firstActualEntry ? formatDate(firstActualEntry.actual_date) : 'N/A';
  }

  function getActualEndDate(workOrder: any): string {
    const dates = getWorkOrderDates(workOrder, productionDates);
    const lastActualExit = dates.exitDates.find(exit => exit.actual_date);
    return lastActualExit ? formatDate(lastActualExit.actual_date) : 'N/A';
  }

  function getChassisPlannedDate(workOrder: any): string {
    const dates = getWorkOrderDates(workOrder, productionDates);
    return dates.chassisArrival ? formatDateTimeLocal(dates.chassisArrival.planned_date) : 'N/A';
  }

  function getDocumentsPlannedDate(workOrder: any): string {
    const dates = getWorkOrderDates(workOrder, productionDates);
    return dates.rndDocuments ? formatDateTimeLocal(dates.rndDocuments.planned_date) : 'N/A';
  }

  function getChassisActualDate(workOrder: any): string {
    const dates = getWorkOrderDates(workOrder, productionDates);
    return dates.chassisArrival?.actual_date && dates.chassisArrival.actual_date !== null && dates.chassisArrival.actual_date !== '' ? formatDate(dates.chassisArrival.actual_date) : 'N/A';
  }

  function getDocumentsActualDate(workOrder: any): string {
    const dates = getWorkOrderDates(workOrder, productionDates);
    return dates.rndDocuments?.actual_date && dates.rndDocuments.actual_date !== null && dates.rndDocuments.actual_date !== '' ? formatDate(dates.rndDocuments.actual_date) : 'N/A';
  }

  function getFinalInspectionPlannedDate(workOrder: any): string {
    const dates = getWorkOrderDates(workOrder, productionDates);
    return dates.finalInspection ? formatDateTimeLocal(dates.finalInspection.planned_date) : 'N/A';
  }

  function getFinalInspectionActualDate(workOrder: any): string {
    const dates = getWorkOrderDates(workOrder, productionDates);
    return dates.finalInspection?.actual_date && dates.finalInspection.actual_date !== null && dates.finalInspection.actual_date !== '' ? formatDate(dates.finalInspection.actual_date) : 'N/A';
  }

  function getDeliveryPlannedDate(workOrder: any): string {
    const dates = getWorkOrderDates(workOrder, productionDates);
    return dates.delivery ? formatDateTimeLocal(dates.delivery.planned_date) : 'N/A';
  }

  function getDeliveryActualDate(workOrder: any): string {
    const dates = getWorkOrderDates(workOrder, productionDates);
    return dates.delivery?.actual_date && dates.delivery.actual_date !== null && dates.delivery.actual_date !== '' ? formatDate(dates.delivery.actual_date) : 'N/A';
  }

  function clearFilters() {
    searchTerm = '';
    selectedStage = '';
  }

  function getTabActionButton(tabId: string): string {
    switch (tabId) {
      case 'to-be-planned': return 'Create Entry Plan';
      default: return '';
    }
  }

  function handleTabAction() {
    console.log(`Action for ${activeTab} tab`);
  }

  function handleCreateEntryPlan(workOrder: any) {
    selectedWorkOrder = workOrder;
    showEntrySlotModal = true;
  }

  function handleEntrySlotConfirm(event: any) {
    const { workOrder, selectedSlot: slot, calculatedDates: dates } = event.detail;
    selectedWorkOrder = workOrder;
    selectedSlot = slot;
    calculatedDates = dates;
    showEntrySlotModal = false;
    showPlanSummaryModal = true;
  }

  function handlePlanSaved(event: any) {
    loadData();
    showPlanSummaryModal = false;
    selectedWorkOrder = null;
    selectedSlot = null;
    calculatedDates = null;
  }

  function handleViewWorkOrder(workOrder: any) {
    console.log('View work order details:', workOrder.wo_no);
  }

  function handleRecordChassisArrival(workOrder: any) {
    console.log('Record chassis arrival for work order:', workOrder.wo_no);
  }

  function handleReleaseDocuments(workOrder: any) {
    console.log('Release documents for work order:', workOrder.wo_no);
  }

  function handleScheduleInspection(workOrder: any) {
    console.log('Schedule inspection for work order:', workOrder.wo_no);
  }

  function handleScheduleDelivery(workOrder: any) {
    console.log('Schedule delivery for work order:', workOrder.wo_no);
  }
</script>

<svelte:head>
  <title>Entry Plan Management - Planning</title>
</svelte:head>

<!-- Sidebar Overlay -->
{#if showSidebar}
  <div class="fixed inset-0 z-50">
    <button
      type="button"
      aria-label="Close sidebar overlay"
      class="fixed inset-0 bg-black bg-opacity-40 z-40"
      on:click={() => showSidebar = false}
      tabindex="0"
      on:keydown={(e) => (e.key === 'Enter' || e.key === ' ') && (showSidebar = false)}
    ></button>
    <div class="fixed left-0 top-0 h-full w-64 z-50 theme-bg-primary shadow-lg">
      <Sidebar {menus} />
    </div>
  </div>
{/if}

<div class="min-h-screen theme-bg-primary">
  <!-- Header with Burger, Tabs, and Favicon -->
  <div class="theme-bg-primary shadow-sm border-b theme-border">
    <div class="w-full mx-auto px-4 sm:px-6 lg:px-8">
      <div class="flex items-center justify-between py-4">
        <!-- Burger Menu -->
        <button 
          class="p-2 rounded hover:theme-bg-tertiary focus:outline-none transition-colors duration-200" 
          on:click={() => showSidebar = !showSidebar} 
          aria-label="Show sidebar"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 theme-text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        <!-- Tab Navigation -->
        <nav class="flex space-x-8">
          {#each tabs as tab}
            <button
              class="py-2 px-3 font-medium text-sm transition-colors duration-200 rounded-lg {activeTab === tab.id 
                ? 'border-2 border-blue-500 text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 shadow-sm' 
                : 'border-2 border-transparent theme-text-secondary hover:theme-text-primary hover:border-gray-300 dark:hover:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700/20'}"
              on:click={() => handleTabChange(tab.id)}
            >
              <span class="mr-2">{tab.icon}</span>
              {tab.label}
              <span class="ml-2 text-xs bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 px-2 py-1 rounded-full">
                {tabCounts[tab.id] || 0}
              </span>
            </button>
          {/each}
        </nav>

        <!-- Favicon -->
        <button
          on:click={() => goto('/dashboard')}
          class="flex items-center hover:opacity-80 transition-opacity cursor-pointer"
          aria-label="Go to dashboard"
        >
          <img src="/favicon.png" alt="Company Logo" class="h-8 w-auto" />
        </button>
      </div>
    </div>
  </div>

  <!-- Tab Content -->
  <div class="w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
    {#if isLoading}
      <div class="flex items-center justify-center h-64">
        <div class="text-center">
          <div class="animate-spin rounded-full h-12 w-12 border-b-2 theme-accent mx-auto mb-4"></div>
          <p class="theme-text-primary">Loading work orders...</p>
        </div>
      </div>
    {:else}
      <!-- Search and Filters -->
      <div class="theme-bg-primary rounded-lg shadow-lg p-6 mb-6">
        <div class="flex flex-col lg:flex-row gap-4 mb-4">
          <div class="flex-1">
            <label for="search" class="block text-sm font-medium theme-text-primary mb-2">
              Search Work Orders
            </label>
            <input
              id="search"
              type="text"
              bind:value={searchTerm}
              placeholder="Search by work order number or model..."
              class="w-full px-3 py-2 border theme-border rounded-lg theme-bg-primary theme-text-primary focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {#if activeTab === 'wip' || activeTab === 'to-be-inspected' || activeTab === 'to-be-delivered'}
            <div class="w-full lg:w-48">
              <label for="filterStage" class="block text-sm font-medium theme-text-primary mb-2">
                Plant Stage
              </label>
              <select
                id="filterStage"
                bind:value={selectedStage}
                class="w-full px-3 py-2 border theme-border rounded-lg theme-bg-primary theme-text-primary focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">All Stages</option>
                {#each plantStages as stage}
                  <option value={stage}>{stage}</option>
                {/each}
              </select>
            </div>
          {/if}

          <div class="flex items-end">
            <button
              class="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              on:click={clearFilters}
              disabled={!searchTerm && !selectedStage}
            >
              Clear Filters
            </button>
          </div>
        </div>
      </div>

      <!-- Work Orders List -->
      <div class="theme-bg-primary rounded-lg shadow-lg p-6 mb-6">
        <div class="flex items-center justify-between mb-6">
          <h2 class="text-xl font-semibold theme-text-primary">
            {tabs.find(t => t.id === activeTab)?.label} ({filteredWorkOrders.length})
          </h2>
          {#if filteredWorkOrders.length > 0 && activeTab !== 'to-be-planned'}
            <button
              class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              on:click={handleTabAction}
            >
              {getTabActionButton(activeTab)}
            </button>
          {/if}
        </div>

        {#if filteredWorkOrders.length > 0}
          <div class="overflow-x-auto">
            <table class="w-full border-collapse theme-border">
              <thead>
                <tr class="theme-bg-secondary">
                  {#if activeTab === 'to-be-planned'}
                    <th class="px-4 py-3 text-left font-medium theme-text-primary border theme-border w-1/6">
                      WO No
                    </th>
                    <th class="px-4 py-3 text-left font-medium theme-text-primary border theme-border w-1/6">
                      PWO No
                    </th>
                    <th class="px-4 py-3 text-left font-medium theme-text-primary border theme-border w-1/6">
                      Model
                    </th>
                    <th class="px-4 py-3 text-left font-medium theme-text-primary border theme-border w-1/6">
                      Customer
                    </th>
                    <th class="px-4 py-3 text-left font-medium theme-text-primary border theme-border w-1/6">
                      Order Date
                    </th>
                  {:else if activeTab === 'chassis-to-be-received'}
                    <th class="px-4 py-3 text-left font-medium theme-text-primary border theme-border">
                      Work Order
                    </th>
                    <th class="px-4 py-3 text-left font-medium theme-text-primary border theme-border">
                      PWO Number
                    </th>
                    <th class="px-4 py-3 text-left font-medium theme-text-primary border theme-border">
                      Model
                    </th>
                    <th class="px-4 py-3 text-left font-medium theme-text-primary border theme-border">
                      Planned Date
                    </th>
                    <th class="px-4 py-3 text-left font-medium theme-text-primary border theme-border">
                      Actual Date
                    </th>
                    <th class="px-4 py-3 text-left font-medium theme-text-primary border theme-border">
                      Status
                    </th>
                  {:else if activeTab === 'documents-to-be-released' || activeTab === 'to-be-inspected' || activeTab === 'to-be-delivered'}
                    <th class="px-4 py-3 text-left font-medium theme-text-primary border theme-border">
                      Work Order
                    </th>
                    <th class="px-4 py-3 text-left font-medium theme-text-primary border theme-border">
                      PWO Number
                    </th>
                    <th class="px-4 py-3 text-left font-medium theme-text-primary border theme-border">
                      Model
                    </th>
                    <th class="px-4 py-3 text-left font-medium theme-text-primary border theme-border">
                      Planned Date
                    </th>
                    <th class="px-4 py-3 text-left font-medium theme-text-primary border theme-border">
                      Actual Date
                    </th>
                    <th class="px-4 py-3 text-left font-medium theme-text-primary border theme-border">
                      Status
                    </th>
                  {:else}
                    <th class="px-4 py-3 text-left font-medium theme-text-primary border theme-border">
                      Work Order
                    </th>
                    <th class="px-4 py-3 text-left font-medium theme-text-primary border theme-border">
                      PWO Number
                    </th>
                    <th class="px-4 py-3 text-left font-medium theme-text-primary border theme-border">
                      Model
                    </th>
                    <th class="px-4 py-3 text-left font-medium theme-text-primary border theme-border">
                      Current Stage
                    </th>
                    <th class="px-4 py-3 text-left font-medium theme-text-primary border theme-border">
                      Planned Start
                    </th>
                    <th class="px-4 py-3 text-left font-medium theme-text-primary border theme-border">
                      Actual Start
                    </th>
                    <th class="px-4 py-3 text-left font-medium theme-text-primary border theme-border">
                      Planned End
                    </th>
                    <th class="px-4 py-3 text-left font-medium theme-text-primary border theme-border">
                      Actual End
                    </th>
                  {/if}
                  {#if activeTab === 'to-be-planned'}
                    <th class="px-4 py-3 text-center font-medium theme-text-primary border theme-border">
                      Actions
                    </th>
                  {/if}
                </tr>
              </thead>
              <tbody>
                {#each filteredWorkOrders as workOrder}
                  {@const dateComparison = getTabDateComparison(workOrder, activeTab, productionDates, holidays)}
                  {@const rowBgClass = (activeTab === 'wip' || activeTab === 'chassis-to-be-received' || activeTab === 'documents-to-be-released' || activeTab === 'to-be-inspected' || activeTab === 'to-be-delivered') ? getRowBackgroundColor(dateComparison.diff) : ''}
                  <tr class="hover:theme-bg-secondary transition-colors" class:on-time={rowBgClass === 'on-time'} class:slight-delay={rowBgClass === 'slight-delay'} class:moderate-delay={rowBgClass === 'moderate-delay'} class:significant-delay={rowBgClass === 'significant-delay'}>
                    {#if activeTab === 'to-be-planned'}
                      <td class="px-4 py-3 font-medium theme-text-primary border theme-border w-1/6">
                        {workOrder.wo_no || 'N/A'}
                      </td>
                      <td class="px-4 py-3 theme-text-primary border theme-border w-1/6">
                        {workOrder.pwo_no || 'N/A'}
                      </td>
                      <td class="px-4 py-3 theme-text-primary border theme-border w-1/6">
                        {workOrder.wo_model}
                      </td>
                      <td class="px-4 py-3 theme-text-primary border theme-border w-1/6">
                        {workOrder.customer_name || 'N/A'}
                      </td>
                      <td class="px-4 py-3 theme-text-primary border theme-border w-1/6">
                        {formatDate(workOrder.wo_date)}
                      </td>
                    {:else if activeTab === 'chassis-to-be-received'}
                      <td class="px-4 py-3 font-medium border theme-border {rowBgClass ? 'text-gray-800' : 'theme-text-primary'}">
                        {workOrder.wo_no}
                      </td>
                      <td class="px-4 py-3 border theme-border {rowBgClass ? 'text-gray-800' : 'theme-text-primary'}">
                        {workOrder.pwo_no || 'N/A'}
                      </td>
                      <td class="px-4 py-3 border theme-border {rowBgClass ? 'text-gray-800' : 'theme-text-primary'}">
                        {workOrder.wo_model}
                      </td>
                      <td class="px-4 py-3 border theme-border {rowBgClass ? 'text-gray-800' : 'theme-text-primary'}">
                        {getChassisPlannedDate(workOrder)}
                      </td>
                      <td class="px-4 py-3 border theme-border {rowBgClass ? 'text-gray-800' : 'theme-text-primary'}">
                        {getChassisActualDate(workOrder)}
                      </td>
                      <td class="px-4 py-3 border theme-border">
                        <span class="px-2 py-1 {getChassisActualDate(workOrder) !== 'N/A' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'} rounded-full text-xs">
                          {getChassisActualDate(workOrder) !== 'N/A' ? 'Completed' : 'Pending'}
                        </span>
                      </td>
                    {:else if activeTab === 'documents-to-be-released'}
                      <td class="px-4 py-3 font-medium border theme-border {rowBgClass ? 'text-gray-800' : 'theme-text-primary'}">
                        {workOrder.wo_no}
                      </td>
                      <td class="px-4 py-3 border theme-border {rowBgClass ? 'text-gray-800' : 'theme-text-primary'}">
                        {workOrder.pwo_no || 'N/A'}
                      </td>
                      <td class="px-4 py-3 border theme-border {rowBgClass ? 'text-gray-800' : 'theme-text-primary'}">
                        {workOrder.wo_model}
                      </td>
                      <td class="px-4 py-3 border theme-border {rowBgClass ? 'text-gray-800' : 'theme-text-primary'}">
                        {getDocumentsPlannedDate(workOrder)}
                      </td>
                      <td class="px-4 py-3 border theme-border {rowBgClass ? 'text-gray-800' : 'theme-text-primary'}">
                        {getDocumentsActualDate(workOrder)}
                      </td>
                      <td class="px-4 py-3 border theme-border">
                        <span class="px-2 py-1 {getDocumentsActualDate(workOrder) !== 'N/A' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'} rounded-full text-xs">
                          {getDocumentsActualDate(workOrder) !== 'N/A' ? 'Completed' : 'Pending'}
                        </span>
                      </td>
                    {:else if activeTab === 'to-be-inspected'}
                      <td class="px-4 py-3 font-medium border theme-border {rowBgClass ? 'text-gray-800' : 'theme-text-primary'}">
                        {workOrder.wo_no}
                      </td>
                      <td class="px-4 py-3 border theme-border {rowBgClass ? 'text-gray-800' : 'theme-text-primary'}">
                        {workOrder.pwo_no || 'N/A'}
                      </td>
                      <td class="px-4 py-3 border theme-border {rowBgClass ? 'text-gray-800' : 'theme-text-primary'}">
                        {workOrder.wo_model}
                      </td>
                      <td class="px-4 py-3 border theme-border {rowBgClass ? 'text-gray-800' : 'theme-text-primary'}">
                        {getFinalInspectionPlannedDate(workOrder)}
                      </td>
                      <td class="px-4 py-3 border theme-border {rowBgClass ? 'text-gray-800' : 'theme-text-primary'}">
                        {getFinalInspectionActualDate(workOrder)}
                      </td>
                      <td class="px-4 py-3 border theme-border">
                        <span class="px-2 py-1 {getFinalInspectionActualDate(workOrder) !== 'N/A' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'} rounded-full text-xs">
                          {getFinalInspectionActualDate(workOrder) !== 'N/A' ? 'Completed' : 'Pending'}
                        </span>
                      </td>
                    {:else if activeTab === 'to-be-delivered'}
                      <td class="px-4 py-3 font-medium border theme-border {rowBgClass ? 'text-gray-800' : 'theme-text-primary'}">
                        {workOrder.wo_no}
                      </td>
                      <td class="px-4 py-3 border theme-border {rowBgClass ? 'text-gray-800' : 'theme-text-primary'}">
                        {workOrder.pwo_no || 'N/A'}
                      </td>
                      <td class="px-4 py-3 border theme-border {rowBgClass ? 'text-gray-800' : 'theme-text-primary'}">
                        {workOrder.wo_model}
                      </td>
                      <td class="px-4 py-3 border theme-border {rowBgClass ? 'text-gray-800' : 'theme-text-primary'}">
                        {getDeliveryPlannedDate(workOrder)}
                      </td>
                      <td class="px-4 py-3 border theme-border {rowBgClass ? 'text-gray-800' : 'theme-text-primary'}">
                        {getDeliveryActualDate(workOrder)}
                      </td>
                      <td class="px-4 py-3 border theme-border">
                        <span class="px-2 py-1 {getDeliveryActualDate(workOrder) !== 'N/A' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'} rounded-full text-xs">
                          {getDeliveryActualDate(workOrder) !== 'N/A' ? 'Completed' : 'Pending'}
                        </span>
                      </td>
                    {:else}
                      <td class="px-4 py-3 font-medium border theme-border {rowBgClass ? 'text-gray-800' : 'theme-text-primary'}">
                        {workOrder.wo_no}
                      </td>
                      <td class="px-4 py-3 border theme-border {rowBgClass ? 'text-gray-800' : 'theme-text-primary'}">
                        {workOrder.pwo_no || 'N/A'}
                      </td>
                      <td class="px-4 py-3 border theme-border {rowBgClass ? 'text-gray-800' : 'theme-text-primary'}">
                        {workOrder.wo_model}
                      </td>
                      <td class="px-4 py-3 border theme-border {rowBgClass ? 'text-gray-800' : 'theme-text-primary'}">
                        {getCurrentStage(workOrder, productionDates)}
                      </td>
                      <td class="px-4 py-3 border theme-border {rowBgClass ? 'text-gray-800' : 'theme-text-primary'}">
                        {dateComparison.planned}
                      </td>
                      <td class="px-4 py-3 border theme-border">
                        <span class="{dateComparison.color}">
                          {dateComparison.actual}
                        </span>
                        {#if dateComparison.diff !== 0}
                          <div class="text-xs {dateComparison.color}">
                            ({dateComparison.diff > 0 ? '+' : ''}{dateComparison.diff} days)
                          </div>
                        {/if}
                      </td>
                      <td class="px-4 py-3 border theme-border {rowBgClass ? 'text-gray-800' : 'theme-text-primary'}">
                        {getPlannedEndDate(workOrder)}
                      </td>
                      <td class="px-4 py-3 border theme-border {rowBgClass ? 'text-gray-800' : 'theme-text-primary'}">
                        {getActualEndDate(workOrder)}
                      </td>
                    {/if}
                    {#if activeTab === 'to-be-planned'}
                      <td class="px-4 py-3 text-center border theme-border">
                        <div class="flex items-center justify-center gap-2">
                          <button
                            class="px-4 py-2 bg-green-600 text-white font-semibold text-sm rounded-lg shadow-md hover:bg-green-700 hover:shadow-lg transform hover:scale-105 transition-all duration-200 border-2 border-green-500"
                            on:click={() => handleCreateEntryPlan(workOrder)}
                          >
                            📋 Create Plan
                          </button>
                        </div>
                      </td>
                    {/if}
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        {:else}
          <div class="text-center py-8">
            <p class="text-lg theme-text-secondary mb-4">
              {searchTerm || selectedStage ? 'No work orders match your search criteria' : `No work orders in ${tabs.find(t => t.id === activeTab)?.label.toLowerCase()}`}
            </p>
            {#if !searchTerm && !selectedStage}
              <p class="text-sm theme-text-tertiary">Work orders will appear here based on their current status</p>
            {/if}
          </div>
        {/if}
      </div>

      <!-- Color Legend -->
      {#if activeTab !== 'to-be-planned'}
        <div class="theme-bg-primary rounded-lg shadow-lg p-4">
          <h3 class="text-sm font-medium theme-text-primary mb-3">Date Comparison Legend:</h3>
          <div class="flex flex-wrap gap-4 text-sm">
            <div class="flex items-center gap-2">
              <div class="w-3 h-3 bg-green-600 rounded"></div>
              <span class="theme-text-primary">On Time (0 days)</span>
            </div>
            <div class="flex items-center gap-2">
              <div class="w-3 h-3 bg-yellow-600 rounded"></div>
              <span class="theme-text-primary">Slight Delay (1-2 days)</span>
            </div>
            <div class="flex items-center gap-2">
              <div class="w-3 h-3 bg-orange-600 rounded"></div>
              <span class="theme-text-primary">Moderate Delay (3-5 days)</span>
            </div>
            <div class="flex items-center gap-2">
              <div class="w-3 h-3 bg-red-600 rounded"></div>
              <span class="theme-text-primary">Significant Delay (5+ days)</span>
            </div>
          </div>
        </div>
      {/if}
    {/if}
  </div>
</div>

<!-- Entry Slot Selection Modal -->
<EntrySlotSelectionModal 
  bind:showModal={showEntrySlotModal}
  workOrder={selectedWorkOrder}
  on:confirm={handleEntrySlotConfirm}
  on:close={() => showEntrySlotModal = false}
/>

<!-- Plan Summary Modal -->
<PlanSummaryModal 
  bind:showModal={showPlanSummaryModal}
  workOrder={selectedWorkOrder}
  selectedSlot={selectedSlot}
  calculatedDates={calculatedDates}
  on:saved={handlePlanSaved}
  on:back={() => {
    showPlanSummaryModal = false;
    showEntrySlotModal = true;
  }}
  on:close={() => showPlanSummaryModal = false}
/>

<!-- Floating Theme Toggle -->
<FloatingThemeToggle />

<style>
  /* Row highlighting styles for WIP tab */
  tr.on-time {
    background-color: #f0fdf4;
    border-left: 4px solid #22c55e;
  }
  
  tr.slight-delay {
    background-color: #fefce8;
    border-left: 4px solid #eab308;
  }
  
  tr.moderate-delay {
    background-color: #fff7ed;
    border-left: 4px solid #f97316;
  }
  
  tr.significant-delay {
    background-color: #fef2f2;
    border-left: 4px solid #ef4444;
  }
  
  /* Dark mode support */
  :global(.dark) tr.on-time {
    background-color: rgba(34, 197, 94, 0.2);
    border-left: 4px solid #22c55e;
  }
  
  :global(.dark) tr.on-time td,
  :global(.dark) tr.on-time td * {
    color: #1f2937 !important;
  }
  
  :global(.dark) tr.slight-delay {
    background-color: rgba(234, 179, 8, 0.2);
    border-left: 4px solid #eab308;
  }
  
  :global(.dark) tr.slight-delay td,
  :global(.dark) tr.slight-delay td * {
    color: #1f2937 !important;
  }
  
  :global(.dark) tr.moderate-delay {
    background-color: rgba(249, 115, 22, 0.2);
    border-left: 4px solid #f97316;
  }
  
  :global(.dark) tr.moderate-delay td,
  :global(.dark) tr.moderate-delay td * {
    color: #1f2937 !important;
  }
  
  :global(.dark) tr.significant-delay {
    background-color: rgba(239, 68, 68, 0.2);
    border-left: 4px solid #ef4444;
  }
  
  :global(.dark) tr.significant-delay td,
  :global(.dark) tr.significant-delay td * {
    color: #1f2937 !important;
  }
</style>
