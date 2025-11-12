<script lang="ts">
  import { onMount } from 'svelte';
  import { supabase } from '$lib/supabaseClient';
  import Sidebar from '$lib/components/navigation/Sidebar.svelte';
  import FloatingThemeToggle from '$lib/components/common/FloatingThemeToggle.svelte';
  import { fetchUserMenus } from '$lib/services/menuService';
  import EntrySlotSelectionModal from '$lib/components/planning/EntrySlotSelectionModal.svelte';
  import PlanSummaryModal from '$lib/components/planning/PlanSummaryModal.svelte';

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
        tabCounts[tab.id] = workOrders.filter(wo => isWorkOrderInTab(wo, tab.id)).length;
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
    const matchesStage = !selectedStage || isWorkOrderInStage(wo, selectedStage);
    const matchesTab = isWorkOrderInTab(wo, activeTab);
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
      await Promise.all([
        loadWorkOrders(),
        loadProductionDates(),
        loadPlantStages(),
        loadHolidays()
      ]);
      
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      isTableLoading = false;
    }
  }

  async function loadWorkOrders() {
    try {
      const { data, error } = await supabase
        .from('prdn_wo_details')
        .select('*')
        .order('wo_date', { ascending: false });

      if (error) throw error;
      workOrders = data || [];
    } catch (error) {
      console.error('Error loading work orders:', error);
      workOrders = [];
    }
  }

  async function loadProductionDates() {
    try {
      const { data, error } = await supabase
        .from('prdn_dates')
        .select('*')
        .order('planned_date', { ascending: true });

      if (error) throw error;
      productionDates = data || [];
    } catch (error) {
      console.error('Error loading production dates:', error);
      productionDates = [];
    }
  }

  async function loadPlantStages() {
    try {
      const { data, error } = await supabase
        .from('sys_data_elements')
        .select('de_value')
        .eq('de_name', 'Plant-Stage')
        .order('de_value');

      if (error) throw error;
      plantStages = data?.map(item => item.de_value) || [];
    } catch (error) {
      console.error('Error loading plant stages:', error);
      plantStages = [];
    }
  }

  async function loadHolidays() {
    try {
      const { data, error } = await supabase
        .from('plan_holidays')
        .select('dt_value')
        .order('dt_value');

      if (error) throw error;
      holidays = data || [];
    } catch (error) {
      console.error('Error loading holidays:', error);
      holidays = [];
    }
  }

  // Tab change handler
  async function handleTabChange(tabId: string) {
    activeTab = tabId;
    // Data is already loaded, just switch tabs
  }

  function isWorkOrderInTab(workOrder: any, tabId: string): boolean {
    const woDates = productionDates.filter(d => d.sales_order_id === workOrder.id);
    
    // Define these variables at the function level so they can be used across cases
    const chassisArrival = woDates.find(d => d.date_type === 'chassis_arrival');
    const rndDocuments = woDates.find(d => d.date_type === 'rnd_documents');
    const allEntryDates = woDates.filter(d => d.date_type === 'entry');
    const allExitDates = woDates.filter(d => d.date_type === 'exit');
    const finalInspection = woDates.find(d => d.date_type === 'final_inspection');
    const delivery = woDates.find(d => d.date_type === 'delivery');
    
    let result = false;
    
    switch (tabId) {
      case 'to-be-planned':
        // No planning records exist at all
        result = woDates.length === 0;
        break;
        
      case 'chassis-to-be-received':
        // Has planned chassis arrival date but not yet received
        result = chassisArrival?.planned_date && !chassisArrival?.actual_date;
        break;
        
      case 'documents-to-be-released':
        // Has planned document release date but not yet released
        result = rndDocuments?.planned_date && !rndDocuments?.actual_date;
        break;
        
      case 'wip':
        // Has planned production entry dates (includes both not started and in progress)
        result = allEntryDates.length > 0;
        break;
        
      case 'to-be-inspected':
        // Has planned final inspection date but not yet inspected
        result = finalInspection?.planned_date && !finalInspection?.actual_date;
        break;
        
      case 'to-be-delivered':
        // Has planned delivery date but not yet delivered
        result = delivery?.planned_date && !delivery?.actual_date;
        break;
        
      default:
        result = false;
    }
    
    
    return result;
  }

  function isWorkOrderInStage(workOrder: any, stage: string): boolean {
    const woDates = productionDates.filter(d => d.sales_order_id === workOrder.id);
    const stageEntry = woDates.find(d => d.date_type === 'entry' && d.stage_code === stage);
    const stageExit = woDates.find(d => d.date_type === 'exit' && d.stage_code === stage);
    
    // Check if work order is currently in this stage (has entry but no exit)
    return stageEntry?.actual_date && !stageExit?.actual_date;
  }

  function getWorkOrderDates(workOrder: any) {
    const woDates = productionDates.filter(d => d.sales_order_id === workOrder.id);
    return {
      chassisArrival: woDates.find(d => d.date_type === 'chassis_arrival'),
      rndDocuments: woDates.find(d => d.date_type === 'rnd_documents'),
      entryDates: woDates.filter(d => d.date_type === 'entry').sort((a, b) => a.planned_date.localeCompare(b.planned_date)),
      exitDates: woDates.filter(d => d.date_type === 'exit').sort((a, b) => a.planned_date.localeCompare(b.planned_date)),
      finalInspection: woDates.find(d => d.date_type === 'final_inspection'),
      delivery: woDates.find(d => d.date_type === 'delivery')
    };
  }

  function getDateDifference(plannedDate: string, actualDate: string | null): number {
    if (!actualDate) return 0;
    const planned = new Date(plannedDate);
    const actual = new Date(actualDate);
    const diffTime = actual.getTime() - planned.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  function isHoliday(dateStr: string): boolean {
    return holidays.some(holiday => holiday.dt_value === dateStr);
  }

  function getWorkingDaysDifference(plannedDate: string, actualDate: string | null): number {
    const endDate = actualDate || new Date().toISOString().split('T')[0]; // Use today if no actual date
    const planned = new Date(plannedDate);
    const end = new Date(endDate);
    
    // If planned date is in the future, return 0 (on time)
    if (planned > end) {
      return 0;
    }
    
    let currentDate = new Date(planned);
    let workingDays = 0;
    
    while (currentDate <= end) {
      const dateStr = currentDate.toISOString().split('T')[0];
      
      // Skip weekends (Saturday = 6, Sunday = 0)
      const dayOfWeek = currentDate.getDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        // Skip holidays
        if (!isHoliday(dateStr)) {
          workingDays++;
        }
      }
      
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    return workingDays - 1; // Subtract 1 because we count the planned date as day 0
  }

  function getDateColor(daysDiff: number): string {
    if (daysDiff === 0) return 'text-green-600';
    if (daysDiff <= 2) return 'text-yellow-600';
    if (daysDiff <= 5) return 'text-orange-600';
    return 'text-red-600';
  }

  function getRowBackgroundColor(daysDiff: number): string {
    if (daysDiff === 0) return 'on-time';
    if (daysDiff <= 2) return 'slight-delay';
    if (daysDiff <= 5) return 'moderate-delay';
    return 'significant-delay';
  }

  function getTabColor(tabId: string): string {
    switch (tabId) {
      case 'to-be-planned': return 'bg-gray-100 text-gray-800';
      case 'to-begin-production': return 'bg-blue-100 text-blue-800';
      case 'wip': return 'bg-green-100 text-green-800';
      case 'to-be-inspected': return 'bg-yellow-100 text-yellow-800';
      case 'to-be-delivered': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  }

  function formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: '2-digit'
    });
  }

  function formatDateTime(dateString: string): string {
    const date = new Date(dateString);
    const dateStr = date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: '2-digit'
    });
    const timeStr = date.toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
    return `${dateStr} ${timeStr}`;
  }

  function getCurrentStage(workOrder: any): string {
    const dates = getWorkOrderDates(workOrder);
    const currentEntry = dates.entryDates.find(entry => 
      entry.actual_date && 
      !dates.exitDates.find(exit => 
        exit.stage_code === entry.stage_code && exit.actual_date
      )
    );
    return currentEntry?.stage_code || 'N/A';
  }

  function getPlannedStartDate(workOrder: any): string {
    const dates = getWorkOrderDates(workOrder);
    const firstEntry = dates.entryDates[0];
    return firstEntry ? formatDateTime(firstEntry.planned_date) : 'N/A';
  }

  function getPlannedEndDate(workOrder: any): string {
    const dates = getWorkOrderDates(workOrder);
    const lastExit = dates.exitDates[dates.exitDates.length - 1];
    return lastExit ? formatDateTime(lastExit.planned_date) : 'N/A';
  }

  function getActualStartDate(workOrder: any): string {
    const dates = getWorkOrderDates(workOrder);
    const firstActualEntry = dates.entryDates.find(entry => entry.actual_date);
    return firstActualEntry ? formatDate(firstActualEntry.actual_date) : 'N/A';
  }

  function getActualEndDate(workOrder: any): string {
    const dates = getWorkOrderDates(workOrder);
    const lastActualExit = dates.exitDates.find(exit => exit.actual_date);
    return lastActualExit ? formatDate(lastActualExit.actual_date) : 'N/A';
  }

  function getChassisPlannedDate(workOrder: any): string {
    const dates = getWorkOrderDates(workOrder);
    return dates.chassisArrival ? formatDateTime(dates.chassisArrival.planned_date) : 'N/A';
  }

  function getDocumentsPlannedDate(workOrder: any): string {
    const dates = getWorkOrderDates(workOrder);
    return dates.rndDocuments ? formatDateTime(dates.rndDocuments.planned_date) : 'N/A';
  }

  function getChassisActualDate(workOrder: any): string {
    const dates = getWorkOrderDates(workOrder);
    return dates.chassisArrival?.actual_date && dates.chassisArrival.actual_date !== null && dates.chassisArrival.actual_date !== '' ? formatDate(dates.chassisArrival.actual_date) : 'N/A';
  }

  function getDocumentsActualDate(workOrder: any): string {
    const dates = getWorkOrderDates(workOrder);
    return dates.rndDocuments?.actual_date && dates.rndDocuments.actual_date !== null && dates.rndDocuments.actual_date !== '' ? formatDate(dates.rndDocuments.actual_date) : 'N/A';
  }

  function getFinalInspectionPlannedDate(workOrder: any): string {
    const dates = getWorkOrderDates(workOrder);
    return dates.finalInspection ? formatDateTime(dates.finalInspection.planned_date) : 'N/A';
  }

  function getFinalInspectionActualDate(workOrder: any): string {
    const dates = getWorkOrderDates(workOrder);
    return dates.finalInspection?.actual_date && dates.finalInspection.actual_date !== null && dates.finalInspection.actual_date !== '' ? formatDate(dates.finalInspection.actual_date) : 'N/A';
  }

  function getDeliveryPlannedDate(workOrder: any): string {
    const dates = getWorkOrderDates(workOrder);
    return dates.delivery ? formatDateTime(dates.delivery.planned_date) : 'N/A';
  }

  function getDeliveryActualDate(workOrder: any): string {
    const dates = getWorkOrderDates(workOrder);
    return dates.delivery?.actual_date && dates.delivery.actual_date !== null && dates.delivery.actual_date !== '' ? formatDate(dates.delivery.actual_date) : 'N/A';
  }

  function getDateComparison(workOrder: any): { planned: string; actual: string; diff: number; color: string } {
    const dates = getWorkOrderDates(workOrder);
    const firstEntry = dates.entryDates[0];
    const firstActualEntry = dates.entryDates.find(entry => entry.actual_date);
    
    if (!firstEntry) {
      return { planned: 'N/A', actual: 'N/A', diff: 0, color: 'text-gray-600' };
    }

    const planned = formatDateTime(firstEntry.planned_date);
    const actual = firstActualEntry ? formatDate(firstActualEntry.actual_date) : 'N/A';
    const diff = firstActualEntry ? getDateDifference(firstEntry.planned_date, firstActualEntry.actual_date) : 0;
    const color = getDateColor(diff);

    return { planned, actual, diff, color };
  }

  function getTabDateComparison(workOrder: any, tabId: string): { planned: string; actual: string; diff: number; color: string } {
    const dates = getWorkOrderDates(workOrder);
    
    switch (tabId) {
      case 'chassis-to-be-received':
        if (!dates.chassisArrival) {
          return { planned: 'N/A', actual: 'N/A', diff: 0, color: 'text-gray-600' };
        }
        const planned = formatDate(dates.chassisArrival.planned_date);
        const actual = dates.chassisArrival.actual_date ? formatDate(dates.chassisArrival.actual_date) : 'N/A';
        const diff = getWorkingDaysDifference(dates.chassisArrival.planned_date, dates.chassisArrival.actual_date);
        return { planned, actual, diff, color: getDateColor(diff) };
        
      case 'documents-to-be-released':
        if (!dates.rndDocuments) {
          return { planned: 'N/A', actual: 'N/A', diff: 0, color: 'text-gray-600' };
        }
        const plannedDoc = formatDate(dates.rndDocuments.planned_date);
        const actualDoc = dates.rndDocuments.actual_date ? formatDate(dates.rndDocuments.actual_date) : 'N/A';
        const diffDoc = getWorkingDaysDifference(dates.rndDocuments.planned_date, dates.rndDocuments.actual_date);
        return { planned: plannedDoc, actual: actualDoc, diff: diffDoc, color: getDateColor(diffDoc) };
        
      case 'to-be-inspected':
        if (!dates.finalInspection) {
          return { planned: 'N/A', actual: 'N/A', diff: 0, color: 'text-gray-600' };
        }
        const plannedInsp = formatDate(dates.finalInspection.planned_date);
        const actualInsp = dates.finalInspection.actual_date ? formatDate(dates.finalInspection.actual_date) : 'N/A';
        const diffInsp = getWorkingDaysDifference(dates.finalInspection.planned_date, dates.finalInspection.actual_date);
        return { planned: plannedInsp, actual: actualInsp, diff: diffInsp, color: getDateColor(diffInsp) };
        
      case 'to-be-delivered':
        if (!dates.delivery) {
          return { planned: 'N/A', actual: 'N/A', diff: 0, color: 'text-gray-600' };
        }
        const plannedDel = formatDate(dates.delivery.planned_date);
        const actualDel = dates.delivery.actual_date ? formatDate(dates.delivery.actual_date) : 'N/A';
        const diffDel = getWorkingDaysDifference(dates.delivery.planned_date, dates.delivery.actual_date);
        return { planned: plannedDel, actual: actualDel, diff: diffDel, color: getDateColor(diffDel) };
        
      case 'wip':
        const firstEntry = dates.entryDates[0];
        const firstActualEntry = dates.entryDates.find(entry => entry.actual_date);
        
        if (!firstEntry) {
          return { planned: 'N/A', actual: 'N/A', diff: 0, color: 'text-gray-600' };
        }

        const plannedWip = formatDate(firstEntry.planned_date);
        const actualWip = firstActualEntry ? formatDate(firstActualEntry.actual_date) : 'N/A';
        const diffWip = getWorkingDaysDifference(firstEntry.planned_date, firstActualEntry?.actual_date || null);
        return { planned: plannedWip, actual: actualWip, diff: diffWip, color: getDateColor(diffWip) };
        
      default:
        return { planned: 'N/A', actual: 'N/A', diff: 0, color: 'text-gray-600' };
    }
  }

  function clearFilters() {
    searchTerm = '';
    selectedStage = '';
  }

  function getTabActionButton(tabId: string): string {
    switch (tabId) {
      case 'to-be-planned': return 'Create Entry Plan';
      case 'chassis-to-be-received': return '';
      case 'documents-to-be-released': return '';
      case 'wip': return '';
      case 'stage-wise-wip': return '';
      case 'to-complete-production': return '';
      case 'to-be-inspected': return '';
      case 'to-be-delivered': return '';
      default: return '';
    }
  }

  function handleTabAction() {
    // Placeholder for tab-specific actions
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
    // Refresh data after plan is saved
    loadData();
    showPlanSummaryModal = false;
    selectedWorkOrder = null;
    selectedSlot = null;
    calculatedDates = null;
  }

  function handleViewWorkOrder(workOrder: any) {
    // TODO: Open modal to view work order details and progress
    console.log('View work order details:', workOrder.wo_no);
    // This should show:
    // 1. Work order details
    // 2. Current production status
    // 3. All planned vs actual dates
    // 4. Stage-wise progress
  }

  function handleRecordChassisArrival(workOrder: any) {
    // TODO: Open modal to record chassis arrival
    console.log('Record chassis arrival for work order:', workOrder.wo_no);
    // This should:
    // 1. Allow user to set actual chassis arrival date
    // 2. Update prdn_dates table with actual_date for chassis_arrival
    // 3. Move work order to "Documents to be Released" tab
  }

  function handleReleaseDocuments(workOrder: any) {
    // TODO: Open modal to release R&D documents
    console.log('Release documents for work order:', workOrder.wo_no);
    // This should:
    // 1. Allow user to set actual document release date
    // 2. Update prdn_dates table with actual_date for rnd_documents
    // 3. Move work order to "To begin Production" tab
  }

  function handleScheduleInspection(workOrder: any) {
    // TODO: Open modal to schedule final inspection
    console.log('Schedule inspection for work order:', workOrder.wo_no);
    // This should:
    // 1. Allow user to set actual final inspection date
    // 2. Update prdn_dates table with actual_date for final_inspection
    // 3. Move work order to "To be Delivered" tab
  }

  function handleScheduleDelivery(workOrder: any) {
    // TODO: Open modal to schedule delivery
    console.log('Schedule delivery for work order:', workOrder.wo_no);
    // This should:
    // 1. Allow user to set actual delivery date
    // 2. Update prdn_dates table with actual_date for delivery
    // 3. Work order is completed
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
        <img src="/favicon.png" alt="Company Logo" class="h-8 w-auto" />
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
                   {@const dateComparison = getTabDateComparison(workOrder, activeTab)}
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
                         {getCurrentStage(workOrder)}
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
                         {#if activeTab === 'to-be-planned'}
                           <button
                             class="px-4 py-2 bg-green-600 text-white font-semibold text-sm rounded-lg shadow-md hover:bg-green-700 hover:shadow-lg transform hover:scale-105 transition-all duration-200 border-2 border-green-500"
                             on:click={() => handleCreateEntryPlan(workOrder)}
                           >
                             📋 Create Plan
                           </button>
                         {/if}
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

             <!-- Color Legend (not shown for 'to-be-planned' tab) -->
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