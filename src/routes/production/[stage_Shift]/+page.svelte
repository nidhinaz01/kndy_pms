<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import Sidebar from '$lib/components/navigation/Sidebar.svelte';
  import FloatingThemeToggle from '$lib/components/common/FloatingThemeToggle.svelte';
  import PlanWorkModal from '$lib/components/production/PlanWorkModal.svelte';
  import ReportWorkModal from '$lib/components/production/ReportWorkModal.svelte';
  import MultiSkillReportModal from '$lib/components/production/MultiSkillReportModal.svelte';
  import ViewWorkHistoryModal from '$lib/components/production/ViewWorkHistoryModal.svelte';
  import RemoveWorkModal from '$lib/components/production/RemoveWorkModal.svelte';
  import AddWorkModal from '$lib/components/production/AddWorkModal.svelte';
  import { fetchUserMenus } from '$lib/services/menuService';
  import type { ProductionEmployee, ProductionWork } from '$lib/api/production';
  import { parseStageShiftParam, getStageShiftDisplayName } from '../utils/stageUtils';
  
  // Import all tab components
  import PageHeader from './components/PageHeader.svelte';
  import WorkOrdersTab from './components/WorkOrdersTab.svelte';
  import WorksTab from './components/WorksTab.svelte';
  import ManpowerPlanTab from './components/ManpowerPlanTab.svelte';
  import DraftPlanTab from './components/DraftPlanTab.svelte';
  import PlanTab from './components/PlanTab.svelte';
  import ManpowerReportTab from './components/ManpowerReportTab.svelte';
  import DraftReportTab from './components/DraftReportTab.svelte';
  import ReportTab from './components/ReportTab.svelte';
  import EntryModal from './components/EntryModal.svelte';
  import ExitModal from './components/ExitModal.svelte';
  import CancelWorkModal from './components/CancelWorkModal.svelte';
  
  // Import services
  import * as dataLoading from './services/dataLoadingService';
  import * as eventHandlers from './services/eventHandlers';
  
  // Import Excel/PDF generators
  import { generatePlanExcel } from './utils/generatePlanExcel';
  import { generatePlanPDF } from './utils/generatePlanPDF';

  // Parse route parameters
  $: stageShiftParam = $page.params.stage_Shift || '{stageCode}-GEN';
  $: parsedParams = parseStageShiftParam(stageShiftParam);
  $: stageCode = parsedParams?.stageCode || '{stageCode}';
  $: shiftCode = parsedParams?.shiftCode || 'GEN';

  // Tab management - reset to work-orders when route changes
  let activeTab = 'work-orders';
  let previousStageShift = '';
  
  // Reset to work-orders tab and reload data when route parameters change
  $: {
    const currentStageShift = `${stageCode}-${shiftCode}`;
    if (currentStageShift !== previousStageShift && previousStageShift !== '') {
      // Route parameters changed - reset to work-orders tab and reload
      activeTab = 'work-orders';
      // Reload data for the new stage-shift
      dataLoading.loadWorkOrdersData(dataLoadingContext);
      dataLoading.loadWorksData(dataLoadingContext);
    }
    previousStageShift = currentStageShift;
  }
  const tabs = [
    { id: 'work-orders', label: 'Work Orders', icon: '📦' },
    { id: 'works', label: 'Works', icon: '🔧' },
    { id: 'manpower-plan', label: 'Manpower Plan', icon: '👥📋' },
    { id: 'draft-plan', label: 'Draft Plan', icon: '📝' },
    { id: 'plan', label: 'Plan', icon: '📋' },
    { id: 'manpower-report', label: 'Manpower Report', icon: '👥📊' },
    { id: 'draft-report', label: 'Draft Report', icon: '📝' },
    { id: 'report', label: 'Report', icon: '📊' }
  ];

  // Common state
  let showSidebar = false;
  let menus: any[] = [];
  let isLoading = true;
  let selectedDate = new Date().toISOString().split('T')[0];

  // Tab-specific state
  let workOrdersData: any[] = [];
  let isWorkOrdersLoading = false;
  let worksData: ProductionWork[] = [];
  let isWorksLoading = false;
  let manpowerPlanData: ProductionEmployee[] = [];
  let isManpowerPlanLoading = false;
  let draftPlanData: any[] = [];
  let draftManpowerPlanData: any[] = [];
  let isDraftPlanLoading = false;
  let planningSubmissionStatus: any = null;
  let plannedWorksData: any[] = [];
  let isPlannedWorksLoading = false;
  let plannedWorksWithStatus: any[] = [];
  let expandedGroups: string[] = [];
  let selectedRows: Set<string> = new Set();
  let shiftBreakTimes: Array<{ start_time: string; end_time: string }> = [];
  let manpowerReportData: ProductionEmployee[] = [];
  let isManpowerReportLoading = false;
  let draftReportData: any[] = [];
  let draftManpowerReportData: any[] = [];
  let isDraftReportLoading = false;
  let reportingSubmissionStatus: any = null;
  let reportData: any[] = [];
  let isReportLoading = false;
  let expandedReportGroups: string[] = [];

  // Modal state
  let showPlanModal = false;
  let selectedWorkForPlanning: any = null;
  let showReportModal = false;
  let selectedWorkForReporting: any = null;
  let showMultiReportModal = false;
  let selectedWorksForMultiReport: any[] = [];
  let showCancelWorkModal = false;
  let selectedWorksForCancellation: any[] = [];
  let showViewWorkHistoryModal = false;
  let selectedWorkForHistory: any = null;
  let showRemoveWorkModal = false;
  let selectedWorkForRemoval: any = null;
  let showAddWorkModal = false;
  let availableWorkOrdersForAdd: Array<{id: number, wo_no: string | null, pwo_no: string | null, wo_model: string}> = [];
  let showEntryModal = false;
  let waitingWorkOrdersForEntry: any[] = [];
  let selectedWorkOrderForEntry: any = null;
  let isEntryModalLoading = false;
  let entryProgressMessage = '';
  let showExitModal = false;
  let availableWorkOrdersForExit: any[] = [];
  let selectedWorkOrderForExit: any = null;
  let isExitModalLoading = false;
  let exitProgressMessage = '';
  let exitDate = '';

  // Create data loading context
  const dataLoadingContext: dataLoading.DataLoadingContext = {
    setWorkOrdersData: (v) => workOrdersData = v,
    setIsWorkOrdersLoading: (v) => isWorkOrdersLoading = v,
    setWorksData: (v) => worksData = v,
    setIsWorksLoading: (v) => isWorksLoading = v,
    setPlannedWorksData: (v) => plannedWorksData = v,
    setIsPlannedWorksLoading: (v) => isPlannedWorksLoading = v,
    setPlannedWorksWithStatus: (v) => plannedWorksWithStatus = v,
    setManpowerPlanData: (v) => manpowerPlanData = v,
    setIsManpowerPlanLoading: (v) => isManpowerPlanLoading = v,
    setDraftPlanData: (v) => draftPlanData = v,
    setDraftManpowerPlanData: (v) => draftManpowerPlanData = v,
    setIsDraftPlanLoading: (v) => isDraftPlanLoading = v,
    setPlanningSubmissionStatus: (v) => planningSubmissionStatus = v,
    setManpowerReportData: (v) => manpowerReportData = v,
    setIsManpowerReportLoading: (v) => isManpowerReportLoading = v,
    setDraftReportData: (v) => draftReportData = v,
    setDraftManpowerReportData: (v) => draftManpowerReportData = v,
    setIsDraftReportLoading: (v) => isDraftReportLoading = v,
    setReportingSubmissionStatus: (v) => reportingSubmissionStatus = v,
    setReportData: (v) => reportData = v,
    setIsReportLoading: (v) => isReportLoading = v,
    setShiftBreakTimes: (v) => shiftBreakTimes = v,
    stageCode,
    shiftCode,
    selectedDate
  };

  // Create event handler context (reactive)
  let eventHandlerContext: eventHandlers.EventHandlerContext;
  $: eventHandlerContext = {
    setShowAddWorkModal: (v) => showAddWorkModal = v,
    setAvailableWorkOrdersForAdd: (v) => availableWorkOrdersForAdd = v,
    setShowViewWorkHistoryModal: (v) => showViewWorkHistoryModal = v,
    setSelectedWorkForHistory: (v) => selectedWorkForHistory = v,
    setShowRemoveWorkModal: (v) => showRemoveWorkModal = v,
    setSelectedWorkForRemoval: (v) => selectedWorkForRemoval = v,
    setShowPlanModal: (v) => showPlanModal = v,
    setSelectedWorkForPlanning: (v) => selectedWorkForPlanning = v,
    setShowReportModal: (v) => showReportModal = v,
    setSelectedWorkForReporting: (v) => selectedWorkForReporting = v,
    setShowMultiReportModal: (v) => showMultiReportModal = v,
    setSelectedWorksForMultiReport: (v) => selectedWorksForMultiReport = v,
    setShowCancelWorkModal: (v) => showCancelWorkModal = v,
    setSelectedWorksForCancellation: (v) => selectedWorksForCancellation = v,
    setShowEntryModal: (v) => showEntryModal = v,
    setWaitingWorkOrdersForEntry: (v) => waitingWorkOrdersForEntry = v,
    setSelectedWorkOrderForEntry: (v) => selectedWorkOrderForEntry = v,
    setEntryModalLoading: (v) => isEntryModalLoading = v,
    setEntryProgressMessage: (v) => entryProgressMessage = v,
    setShowExitModal: (v) => showExitModal = v,
    setAvailableWorkOrdersForExit: (v) => availableWorkOrdersForExit = v,
    setSelectedWorkOrderForExit: (v) => selectedWorkOrderForExit = v,
    setExitModalLoading: (v) => isExitModalLoading = v,
    setExitProgressMessage: (v) => exitProgressMessage = v,
    setExitDate: (v) => exitDate = v,
    setExpandedGroups: (v) => expandedGroups = typeof v === 'function' ? v(expandedGroups) : v,
    setSelectedRows: (v) => selectedRows = typeof v === 'function' ? v(selectedRows) : v,
    setExpandedReportGroups: (v) => expandedReportGroups = typeof v === 'function' ? v(expandedReportGroups) : v,
    setDraftPlanLoading: (v) => isDraftPlanLoading = v,
    setDraftReportLoading: (v) => isDraftReportLoading = v,
    setActiveTab: (v) => activeTab = v,
    workOrdersData,
    plannedWorksWithStatus,
    selectedRows,
    expandedGroups,
    expandedReportGroups,
    activeTab,
    stageCode,
    selectedDate,
    shiftCode,
    exitDate,
    selectedWorkOrderForEntry,
    selectedWorkOrderForExit,
    shiftBreakTimes,
    loadWorkOrdersData: () => dataLoading.loadWorkOrdersData(dataLoadingContext),
    loadWorksData: () => dataLoading.loadWorksData(dataLoadingContext),
    loadPlannedWorksData: () => dataLoading.loadPlannedWorksData(dataLoadingContext),
    loadManpowerPlanData: () => dataLoading.loadManpowerPlanData(dataLoadingContext),
    loadDraftPlanData: () => dataLoading.loadDraftPlanData(dataLoadingContext),
    loadManpowerReportData: () => dataLoading.loadManpowerReportData(dataLoadingContext),
    loadDraftReportData: () => dataLoading.loadDraftReportData(dataLoadingContext),
    loadReportData: () => dataLoading.loadReportData(dataLoadingContext)
  };

  // Tab change handler
  async function handleTabChange(tabId: string) {
    try {
      activeTab = tabId;
      if (tabId === 'work-orders') {
        await dataLoading.loadWorkOrdersData(dataLoadingContext);
      } else if (tabId === 'works') {
        await dataLoading.loadWorksData(dataLoadingContext);
      } else if (tabId === 'manpower-plan') {
        await dataLoading.loadManpowerPlanData(dataLoadingContext);
        // Also load planning submission status to check if attendance should be locked
        const { getPlanningSubmissionStatus } = await import('./services/pageDataService');
        const submissionStatus = await getPlanningSubmissionStatus(stageCode, selectedDate);
        planningSubmissionStatus = submissionStatus;
      } else if (tabId === 'draft-plan') {
        await dataLoading.loadDraftPlanData(dataLoadingContext);
      } else if (tabId === 'plan') {
        await dataLoading.loadPlannedWorksData(dataLoadingContext);
      } else if (tabId === 'manpower-report') {
        await dataLoading.loadManpowerReportData(dataLoadingContext);
      } else if (tabId === 'draft-report') {
        await dataLoading.loadDraftReportData(dataLoadingContext);
      } else if (tabId === 'report') {
        await dataLoading.loadReportData(dataLoadingContext);
      }
    } catch (error) {
      console.error(`Error loading data for tab ${tabId}:`, error);
      // Reset loading states on error
      if (tabId === 'work-orders') isWorkOrdersLoading = false;
      else if (tabId === 'works') isWorksLoading = false;
      else if (tabId === 'manpower-plan') isManpowerPlanLoading = false;
      else if (tabId === 'draft-plan') isDraftPlanLoading = false;
      else if (tabId === 'plan') isPlannedWorksLoading = false;
      else if (tabId === 'manpower-report') isManpowerReportLoading = false;
      else if (tabId === 'draft-report') isDraftReportLoading = false;
      else if (tabId === 'report') isReportLoading = false;
    }
  }

  // Date change handler
  async function handleDateChange() {
    // Use a small delay to ensure the binding has updated
    await new Promise(resolve => setTimeout(resolve, 0));
    console.log(`📅 +page.svelte: Date changed handler called, selectedDate is now: ${selectedDate}`);
    await dataLoading.loadShiftBreakTimes(dataLoadingContext);
    await handleTabChange(activeTab);
  }
  
  // Watch selectedDate for debugging
  $: if (selectedDate) {
    console.log(`👀 +page.svelte: selectedDate reactive update to: ${selectedDate}`);
  }

  // Sidebar handler
  function handleSidebarToggle() {
    showSidebar = !showSidebar;
  }

  // Track previous pathname to detect actual navigation
  let previousPathname = $page.url.pathname;
  
  // Close sidebar when route changes (navigating to a different page)
  $: {
    const currentPath = $page.url.pathname;
    // Only close if we're actually navigating to a different route
    if (showSidebar && currentPath !== previousPathname) {
      previousPathname = currentPath;
      // Close sidebar immediately when navigating
      showSidebar = false;
    } else if (currentPath !== previousPathname) {
      previousPathname = currentPath;
    }
  }

  // Excel/PDF generation
  function generatePlanExcelHandler() {
    if (plannedWorksWithStatus.length === 0) {
      alert('No planned works to export');
      return;
    }
    generatePlanExcel(plannedWorksWithStatus, stageCode, shiftCode, selectedDate, shiftBreakTimes);
  }

  function generatePlanPDFHandler() {
    if (plannedWorksWithStatus.length === 0) {
      alert('No planned works to export');
      return;
    }
    generatePlanPDF(plannedWorksWithStatus, stageCode, shiftCode, selectedDate, shiftBreakTimes);
  }

  function generateReportExcel() {
    alert('Excel generation - to be implemented');
  }

  function generateReportPDF() {
    alert('PDF generation - to be implemented');
  }

  // Update data loading context when reactive values change
  $: {
    dataLoadingContext.stageCode = stageCode;
    dataLoadingContext.shiftCode = shiftCode;
    dataLoadingContext.selectedDate = selectedDate;
    console.log(`🔄 Updated dataLoadingContext.selectedDate to: ${selectedDate}`);
  }

  // Load break times when date changes
  $: if (selectedDate) {
    dataLoading.loadShiftBreakTimes(dataLoadingContext);
  }

  onMount(async () => {
    // Ensure sidebar is closed on mount
    showSidebar = false;
    // Ensure work-orders tab is active on mount
    activeTab = 'work-orders';
    
    const username = localStorage.getItem('username');
    if (username) {
      try {
        menus = await fetchUserMenus(username);
      } catch (error) {
        console.error('Error loading menus:', error);
      }
    }
    await dataLoading.loadWorkOrdersData(dataLoadingContext);
    await dataLoading.loadWorksData(dataLoadingContext);
    isLoading = false;
  });

  // Track previous route to detect navigation
  let previousRoute = '';
  
  // Watch for route changes to reload page and reset to work-orders tab
  $: {
    const currentRoute = $page.url.pathname;
    // When navigating to a different route (or same route from different page), reset to work-orders tab
    if (currentRoute !== previousRoute && currentRoute.includes('/production/')) {
      previousRoute = currentRoute;
      activeTab = 'work-orders';
      // Reload data when navigating to this route (only if not initial load)
      if (!isLoading && previousRoute !== '') {
        dataLoading.loadWorkOrdersData(dataLoadingContext);
        dataLoading.loadWorksData(dataLoadingContext);
      }
    } else if (currentRoute !== previousRoute) {
      previousRoute = currentRoute;
    }
  }
</script>

<svelte:head>
  <title>{getStageShiftDisplayName(stageCode, shiftCode)}</title>
</svelte:head>

<div class="min-h-screen theme-bg-primary">
  <PageHeader 
    {activeTab} 
    bind:selectedDate
    {tabs}
    on:tabChange={(e) => handleTabChange(e.detail)}
    on:dateChange={handleDateChange}
    on:sidebarToggle={handleSidebarToggle}
  />

  <div class="container mx-auto px-4 py-6">
    {#if activeTab === 'work-orders'}
      <WorkOrdersTab 
        {workOrdersData}
        isLoading={isWorkOrdersLoading}
        {stageCode}
        {selectedDate}
        on:entry={() => eventHandlers.handleWorkOrderEntry(eventHandlerContext)}
        on:exit={() => eventHandlers.handleWorkOrderExit(eventHandlerContext)}
      />
    {:else if activeTab === 'works'}
      <WorksTab 
        {worksData}
        isLoading={isWorksLoading}
        {stageCode}
        {selectedDate}
        {shiftCode}
        on:export={(e) => eventHandlers.handleWorksExport(eventHandlerContext, e)}
        on:refresh={() => dataLoading.loadWorksData(dataLoadingContext)}
        on:addWork={() => eventHandlers.handleAddWork(eventHandlerContext)}
        on:viewWork={(e) => eventHandlers.handleViewWork(eventHandlerContext, e)}
        on:removeWork={(e) => eventHandlers.handleRemoveWork(eventHandlerContext, e)}
        on:removeSelected={(e) => eventHandlers.handleRemoveSelected(eventHandlerContext, e)}
        on:planWork={(e) => eventHandlers.handlePlanWork(eventHandlerContext, e)}
      />
    {:else if activeTab === 'manpower-plan'}
      <ManpowerPlanTab 
        data={manpowerPlanData}
        isLoading={isManpowerPlanLoading}
        {selectedDate}
        {planningSubmissionStatus}
        {stageCode}
        {shiftCode}
        on:refresh={() => dataLoading.loadManpowerPlanData(dataLoadingContext)}
        on:attendanceMarked={(e) => eventHandlers.handleAttendanceMarked(eventHandlerContext, e)}
        on:bulkAttendanceMarked={(e) => eventHandlers.handleBulkAttendanceMarked(eventHandlerContext, e)}
        on:stageReassigned={(e) => eventHandlers.handleStageReassigned(eventHandlerContext, e)}
        on:export={() => eventHandlers.handleManpowerExport(eventHandlerContext)}
      />
    {:else if activeTab === 'draft-plan'}
      <DraftPlanTab 
        {draftPlanData}
        {draftManpowerPlanData}
        isLoading={isDraftPlanLoading}
        {stageCode}
        {selectedDate}
        {expandedGroups}
        {selectedRows}
        {shiftBreakTimes}
        {planningSubmissionStatus}
        on:submit={() => eventHandlers.handleSubmitPlanning(eventHandlerContext)}
        on:refresh={() => dataLoading.loadDraftPlanData(dataLoadingContext)}
        on:deletePlan={(e) => eventHandlers.handleDeletePlan(eventHandlerContext, e)}
        on:deleteAllPlansForWork={(e) => eventHandlers.handleDeleteAllPlansForWork(eventHandlerContext, e)}
        on:editPlan={(e) => eventHandlers.handleEditPlan(eventHandlerContext, e)}
        on:multiDelete={() => eventHandlers.handleMultiDelete(eventHandlerContext)}
        on:toggleGroup={(e) => eventHandlers.toggleGroup(eventHandlerContext, e.detail)}
        on:toggleRowSelection={(e) => eventHandlers.toggleRowSelection(eventHandlerContext, e.detail)}
        on:selectAllInGroup={(e) => eventHandlers.selectAllInGroup(eventHandlerContext, e)}
        on:clearSelections={() => eventHandlers.clearSelections(eventHandlerContext)}
      />
    {:else if activeTab === 'plan'}
      <PlanTab 
        {plannedWorksData}
        {plannedWorksWithStatus}
        isLoading={isPlannedWorksLoading}
        {stageCode}
        {selectedDate}
        {selectedRows}
        {expandedGroups}
        {shiftBreakTimes}
        on:refresh={() => dataLoading.loadPlannedWorksData(dataLoadingContext)}
        on:generateExcel={generatePlanExcelHandler}
        on:generatePDF={generatePlanPDFHandler}
        on:multiReport={() => eventHandlers.handleMultiReport(eventHandlerContext)}
        on:reportWork={(e) => eventHandlers.handleReportWork(eventHandlerContext, e)}
        on:toggleGroup={(e) => eventHandlers.toggleGroup(eventHandlerContext, e.detail)}
        on:toggleRowSelection={(e) => eventHandlers.toggleRowSelection(eventHandlerContext, e.detail)}
        on:selectAllInGroup={(e) => eventHandlers.selectAllInGroup(eventHandlerContext, e)}
        on:clearSelections={() => eventHandlers.clearSelections(eventHandlerContext)}
      />
    {:else if activeTab === 'manpower-report'}
      <ManpowerReportTab 
        data={manpowerReportData}
        isLoading={isManpowerReportLoading}
        {selectedDate}
        {reportingSubmissionStatus}
        on:refresh={() => dataLoading.loadManpowerReportData(dataLoadingContext)}
        on:attendanceMarked={(e) => eventHandlers.handleAttendanceMarked(eventHandlerContext, e)}
        on:bulkAttendanceMarked={(e) => eventHandlers.handleBulkAttendanceMarked(eventHandlerContext, e)}
        on:stageReassigned={(e) => eventHandlers.handleStageReassigned(eventHandlerContext, e)}
        on:export={() => eventHandlers.handleManpowerExport(eventHandlerContext)}
      />
    {:else if activeTab === 'draft-report'}
      <DraftReportTab 
        {draftReportData}
        {draftManpowerReportData}
        isLoading={isDraftReportLoading}
        {stageCode}
        {selectedDate}
        {expandedReportGroups}
        {reportingSubmissionStatus}
        on:submit={() => eventHandlers.handleSubmitReporting(eventHandlerContext)}
        on:refresh={() => dataLoading.loadDraftReportData(dataLoadingContext)}
        on:toggleGroup={(e) => eventHandlers.toggleReportGroup(eventHandlerContext, e.detail)}
        on:reportOvertime={(e) => eventHandlers.handleReportOvertime(eventHandlerContext, e)}
      />
    {:else if activeTab === 'report'}
      <ReportTab 
        {reportData}
        isLoading={isReportLoading}
        {stageCode}
        {selectedDate}
        {expandedReportGroups}
        on:refresh={() => dataLoading.loadReportData(dataLoadingContext)}
        on:generateExcel={generateReportExcel}
        on:generatePDF={generateReportPDF}
        on:toggleGroup={(e) => eventHandlers.toggleReportGroup(eventHandlerContext, e.detail)}
      />
    {/if}
  </div>

  <FloatingThemeToggle />

  <!-- Modals -->
  <PlanWorkModal 
    isOpen={showPlanModal}
    work={selectedWorkForPlanning}
    {selectedDate}
    {stageCode}
    {shiftCode}
    on:close={() => eventHandlers.handlePlanModalClose(eventHandlerContext)}
    on:save={() => eventHandlers.handlePlanSave(eventHandlerContext)}
  />

  <ReportWorkModal 
    isOpen={showReportModal}
    plannedWork={selectedWorkForReporting}
    on:close={() => eventHandlers.handleReportModalClose(eventHandlerContext)}
    on:save={() => eventHandlers.handleReportSave(eventHandlerContext)}
  />

  <MultiSkillReportModal 
    isOpen={showMultiReportModal}
    selectedWorks={selectedWorksForMultiReport}
    {stageCode}
    reportingDate={selectedDate}
    on:close={() => eventHandlers.handleMultiReportModalClose(eventHandlerContext)}
    on:save={() => eventHandlers.handleMultiSkillReportSave(eventHandlerContext)}
  />

  <CancelWorkModal 
    isOpen={showCancelWorkModal}
    works={selectedWorksForCancellation}
    on:close={() => eventHandlers.handleCancelWorkModalClose(eventHandlerContext)}
    on:confirm={(e) => eventHandlers.handleCancelWorkConfirm(eventHandlerContext, e)}
  />

  <ViewWorkHistoryModal 
    isOpen={showViewWorkHistoryModal}
    work={selectedWorkForHistory}
    {stageCode}
    on:close={() => eventHandlers.handleViewWorkHistoryClose(eventHandlerContext)}
  />

  <RemoveWorkModal 
    isOpen={showRemoveWorkModal}
    work={selectedWorkForRemoval}
    {stageCode}
    on:close={() => eventHandlers.handleRemoveWorkClose(eventHandlerContext)}
    on:removed={() => eventHandlers.handleWorkRemoved(eventHandlerContext)}
  />

  <AddWorkModal 
    isOpen={showAddWorkModal}
    workOrders={availableWorkOrdersForAdd}
    {stageCode}
    on:close={() => eventHandlers.handleAddWorkClose(eventHandlerContext)}
    on:added={() => eventHandlers.handleWorkAdded(eventHandlerContext)}
  />

  <EntryModal 
    isOpen={showEntryModal}
    waitingWorkOrders={waitingWorkOrdersForEntry}
    bind:selectedWorkOrder={selectedWorkOrderForEntry}
    isLoading={isEntryModalLoading}
    progressMessage={entryProgressMessage}
    {stageCode}
    on:close={() => eventHandlers.handleEntryModalClose(eventHandlerContext)}
    on:confirm={() => eventHandlers.handleEntryConfirm(eventHandlerContext)}
  />

  <ExitModal 
    isOpen={showExitModal}
    availableWorkOrders={availableWorkOrdersForExit}
    bind:selectedWorkOrder={selectedWorkOrderForExit}
    bind:exitDate
    isLoading={isExitModalLoading}
    progressMessage={exitProgressMessage}
    {stageCode}
    on:close={() => eventHandlers.handleExitModalClose(eventHandlerContext)}
    on:confirm={() => eventHandlers.handleExitConfirm(eventHandlerContext)}
  />
</div>

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

<style>
  :global(.on-time) { background-color: #dcfce7 !important; }
  :global(.dark .on-time) { background-color: #14532d !important; }
  :global(.slight-delay) { background-color: #fef3c7 !important; }
  :global(.dark .slight-delay) { background-color: #713f12 !important; }
  :global(.moderate-delay) { background-color: #fed7aa !important; }
  :global(.dark .moderate-delay) { background-color: #7c2d12 !important; }
  :global(.significant-delay) { background-color: #fecaca !important; }
  :global(.dark .significant-delay) { background-color: #7f1d1d !important; }
  :global(.lost-time) { background-color: #fef3c7 !important; }
  :global(.dark .lost-time) { background-color: #713f12 !important; }
</style>
