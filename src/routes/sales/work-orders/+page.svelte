<script lang="ts">
  import { onMount } from 'svelte';
  import Sidebar from '$lib/components/navigation/Sidebar.svelte';
  import WorkOrderHeader from '$lib/components/work-order/WorkOrderHeader.svelte';
  import WorkOrderStats from '$lib/components/work-order/WorkOrderStats.svelte';
  import PeriodModal from '$lib/components/work-order/PeriodModal.svelte';
  import WorkOrderTable from '$lib/components/work-order/WorkOrderTable.svelte';
  import WorkOrderDetailsModal from '$lib/components/work-order/WorkOrderDetailsModal.svelte';
  import CreateWorkOrderModal from '$lib/components/work-order/CreateWorkOrderModal.svelte';
  import FloatingThemeToggle from '$lib/components/common/FloatingThemeToggle.svelte';
  import { fetchUserMenus } from '$lib/services/menuService';
  import { 
    fetchWorkOrderSummaries, 
    getWorkOrderStatistics, 
    deleteWorkOrder,
    fetchWorkOrderDetails,
    fetchAdditionalRequirements,
    type WorkOrderSummary 
  } from '$lib/api/workOrders';
  
  // State management
  let period = 'Last 1 Month';
  let showPeriodModal = false;
  let showSidebar = false;
  let showCreateWorkOrderModal = false;
  let duplicateWorkOrderData: any = null; // Data to pre-fill when duplicating
  let menus: any[] = [];
  let expandTable = false;
  let tableData: WorkOrderSummary[] = [];
  let selectedWorkOrderId: number | null = null;
  let showCustomCalendar = false;
  let customRange: [string, string] = ['', ''];
  let flatpickrInput: HTMLInputElement | undefined;
  let flatpickrInstance: any = null;
  let isLoading = true;
  let isTableLoading = false;

  // Pagination state
  let currentPage = 1;
  let pageSize = 50;
  let totalRecords = 0;
  let totalPages = 1;
  let searchQuery = '';
  let searchTimeout: ReturnType<typeof setTimeout> | null = null;

  // Statistics data
  let typeStats: Array<{
    label: string;
    ordered: number;
    wip: number;
    delivered: number;
  }> = [];
  let totalStats = { ordered: 0, wip: 0, delivered: 0 };

  // Event handlers
  async function handlePeriodSelect(selectedPeriod: string) {
    period = selectedPeriod;
    showPeriodModal = false;
    currentPage = 1; // Reset to first page when period changes
    await Promise.all([
      loadStatistics(), // Reload statistics with new period
      loadWorkOrders() // Reload table data with new period
    ]);
  }

  function handleCreateWorkOrder() {
    console.log('handleCreateWorkOrder called');
    duplicateWorkOrderData = null; // Clear any duplicate data
    showCreateWorkOrderModal = true;
    console.log('showCreateWorkOrderModal after:', showCreateWorkOrderModal);
  }

  async function handleDuplicateWorkOrder(workOrder: WorkOrderSummary) {
    try {
      // Fetch full work order details
      const workOrderDetails = await fetchWorkOrderDetails(workOrder.id);
      if (!workOrderDetails) {
        alert('Failed to load work order details for duplication.');
        return;
      }

      // Fetch additional requirements
      const additionalRequirements = await fetchAdditionalRequirements(workOrder.id);

      // Prepare duplicate data
      duplicateWorkOrderData = {
        ...workOrderDetails,
        additional_requirements: additionalRequirements.map(req => ({
          work_details: req.work_details,
          work_qty: req.work_qty,
          work_rate: req.work_rate,
          amount: req.work_qty * req.work_rate
        }))
      };

      // Open the modal with duplicate data
      showCreateWorkOrderModal = true;
    } catch (error) {
      console.error('Error duplicating work order:', error);
      alert('Failed to load work order for duplication. Please try again.');
    }
  }

  function handleAmendWorkOrder() {
    // TODO: Implement amend work order functionality
    console.log('Amend Work Order clicked');
    alert('Amend Work Order functionality will be implemented here');
  }

  function handleCustomSelect() {
    showCustomCalendar = true;
    setTimeout(() => {
      if (flatpickrInput) {
        if (flatpickrInstance) flatpickrInstance.destroy();
        // Note: flatpickr would need to be installed and imported
        // For now, we'll use a simple date input
        console.log('Custom date selection would be implemented here');
      }
    }, 0);
  }

  async function applyCustomRange() {
    if (customRange[0] && customRange[1]) {
      period = `${customRange[0]} to ${customRange[1]}`;
      showPeriodModal = false;
      showCustomCalendar = false;
      if (flatpickrInstance) flatpickrInstance.destroy();
      currentPage = 1; // Reset to first page when period changes
      await Promise.all([
        loadStatistics(), // Reload statistics with new period
        loadWorkOrders() // Reload table data with new period
      ]);
    }
  }

  function closeCustomCalendar() {
    showCustomCalendar = false;
    if (flatpickrInstance) flatpickrInstance.destroy();
  }

  function handleRowSelect(row: any) {
    selectedWorkOrderId = row.id;
  }

  function closeRowDetails() {
    selectedWorkOrderId = null;
  }

  async function handleRefresh() {
    console.log('🔄 Refresh button clicked - reloading all data...');
    isTableLoading = true;
    
    try {
      // Reload all data
      await Promise.all([
        loadStatistics(),
        loadWorkOrders()
      ]);
      console.log('✅ Data refreshed successfully');
    } catch (error) {
      console.error('❌ Error refreshing data:', error);
    } finally {
      isTableLoading = false;
    }
  }

  async function loadWorkOrders() {
    isTableLoading = true;
    try {
      const dateRange = getDateRangeFromPeriod(period);
      const response = await fetchWorkOrderSummaries({
        search: searchQuery,
        dateRange: dateRange || undefined,
        page: currentPage,
        pageSize: pageSize
      });
      
      tableData = response.data;
      totalRecords = response.total;
      totalPages = response.totalPages;
    } catch (error) {
      console.error('Error loading work orders:', error);
      tableData = [];
      totalRecords = 0;
      totalPages = 1;
    } finally {
      isTableLoading = false;
    }
  }

  // Handle search with debouncing
  function handleSearchChange(search: string) {
    searchQuery = search;
    
    // Clear existing timeout
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }
    
    // Debounce search - wait 500ms after user stops typing
    searchTimeout = setTimeout(() => {
      currentPage = 1; // Reset to first page on new search
      loadWorkOrders();
    }, 500);
  }

  // Handle page change
  function handlePageChange(page: number) {
    currentPage = page;
    loadWorkOrders();
  }

  // Handle page size change
  function handlePageSizeChange(size: number) {
    pageSize = size;
    currentPage = 1; // Reset to first page when page size changes
    loadWorkOrders();
  }

  // Helper function to convert period string to date range
  function getDateRangeFromPeriod(periodString: string): { start: string; end: string } | null {
    const today = new Date();
    const currentYear = today.getFullYear();
    
    switch (periodString) {
      case 'Last 1 Month':
        const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, today.getDate());
        return {
          start: lastMonth.toISOString().split('T')[0],
          end: today.toISOString().split('T')[0]
        };
      case 'Last 3 Months':
        const threeMonthsAgo = new Date(today.getFullYear(), today.getMonth() - 3, today.getDate());
        return {
          start: threeMonthsAgo.toISOString().split('T')[0],
          end: today.toISOString().split('T')[0]
        };
      case 'Last 6 Months':
        const sixMonthsAgo = new Date(today.getFullYear(), today.getMonth() - 6, today.getDate());
        return {
          start: sixMonthsAgo.toISOString().split('T')[0],
          end: today.toISOString().split('T')[0]
        };
      case 'Last 1 Year':
        const lastYear = new Date(today.getFullYear() - 1, today.getMonth(), today.getDate());
        return {
          start: lastYear.toISOString().split('T')[0],
          end: today.toISOString().split('T')[0]
        };
      default:
        // Handle custom range format "dd-MMM-yy to dd-MMM-yy"
        if (periodString.includes(' to ')) {
          const [startStr, endStr] = periodString.split(' to ');
          try {
            // Convert dd-MMM-yy format to yyyy-MM-dd
            const startDate = new Date(startStr);
            const endDate = new Date(endStr);
            return {
              start: startDate.toISOString().split('T')[0],
              end: endDate.toISOString().split('T')[0]
            };
          } catch (error) {
            console.error('Error parsing custom date range:', error);
            return null;
          }
        }
        return null;
    }
  }

  async function loadStatistics() {
    try {
      const dateRange = getDateRangeFromPeriod(period);
      const stats = await getWorkOrderStatistics(dateRange || undefined);
      typeStats = stats.typeStats;
      totalStats = stats.totalStats;
    } catch (error) {
      console.error('Error loading statistics:', error);
      typeStats = [];
      totalStats = { ordered: 0, wip: 0, delivered: 0 };
    }
  }

  async function handleDeleteRow(rowId: number) {
    if (confirm('Are you sure you want to delete this work order?')) {
      try {
        await deleteWorkOrder(rowId);
        // Reload data - if current page becomes empty, go to previous page
        await loadWorkOrders();
        if (tableData.length === 0 && currentPage > 1) {
          currentPage = currentPage - 1;
          await loadWorkOrders();
        }
        await loadStatistics(); // Reload statistics
      } catch (error) {
        console.error('Error deleting work order:', error);
        alert('Failed to delete work order. Please try again.');
      }
    }
  }

  onMount(async () => {
    // Load data
    await Promise.all([
      loadWorkOrders(),
      loadStatistics()
    ]);

    // Load menus in background without blocking the UI
    const username = localStorage.getItem('username') || 'admin';
    fetchUserMenus(username).then(menuData => {
      menus = menuData;
      isLoading = false;
    }).catch(error => {
      console.error('Failed to load menus:', error);
      isLoading = false;
    });
  });
</script>

<!-- Loading State -->
{#if isLoading}
  <div class="flex items-center justify-center h-screen theme-bg-secondary">
    <div class="text-center">
      <div class="animate-spin rounded-full h-12 w-12 border-b-2 theme-accent mx-auto mb-4"></div>
      <p class="theme-text-primary">Loading Work Orders...</p>
    </div>
  </div>
{:else}
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
        style="cursor: pointer; border: none; width: 100%; height: 100%; position: fixed; left: 0; top: 0; background-color: rgba(0,0,0,0.4);"
      ></button>
      <div class="fixed left-0 top-0 h-full w-64 z-50 theme-bg-primary shadow-lg">
        <Sidebar {menus} />
      </div>
    </div>
  {/if}

  <div class="flex flex-col h-full w-full theme-bg-secondary p-4 transition-colors duration-200" style="min-height: 100vh;">
    <!-- Header -->
    <div class={`mb-4 ${expandTable ? 'hidden' : ''}`}>  
      <WorkOrderHeader 
        period={period}
        onSidebarToggle={() => showSidebar = true}
        onPeriodClick={() => showPeriodModal = true}
        onRefresh={handleRefresh}
        isRefreshing={isTableLoading}
      />
    </div>

    <!-- Statistics -->
    <WorkOrderStats 
      {typeStats}
      {totalStats}
      {expandTable}
    />

    <!-- Period Modal -->
    <PeriodModal 
      {showPeriodModal}
      {showCustomCalendar}
      {flatpickrInput}
      onPeriodSelect={handlePeriodSelect}
      onCustomSelect={handleCustomSelect}
      onApplyCustomRange={applyCustomRange}
      onCloseCustomCalendar={closeCustomCalendar}
      onCloseModal={() => showPeriodModal = false}
    />

    <!-- Table -->
    <WorkOrderTable 
      {expandTable}
      {tableData}
      {currentPage}
      {pageSize}
      {totalRecords}
      {totalPages}
      onExpandToggle={() => expandTable = !expandTable}
      onRowSelect={handleRowSelect}
      onDeleteRow={handleDeleteRow}
      onDuplicateWorkOrder={handleDuplicateWorkOrder}
      onCreateWorkOrder={handleCreateWorkOrder}
      onAmendWorkOrder={handleAmendWorkOrder}
      onSearchChange={handleSearchChange}
      onPageChange={handlePageChange}
      onPageSizeChange={handlePageSizeChange}
    />

    <!-- Work Order Details Modal -->
    <WorkOrderDetailsModal 
      workOrderId={selectedWorkOrderId}
      onClose={closeRowDetails}
    />
  </div>
{/if}

<!-- Create Work Order Modal -->
<CreateWorkOrderModal 
  bind:showModal={showCreateWorkOrderModal}
  initialData={duplicateWorkOrderData}
  on:close={() => {
    console.log('Modal close event received');
    showCreateWorkOrderModal = false;
    duplicateWorkOrderData = null; // Clear duplicate data when modal closes
  }}
  on:workOrderCreated={async () => {
    console.log('Work order created, refreshing data...');
    duplicateWorkOrderData = null; // Clear duplicate data after creation
    // Refresh work orders list and statistics
    await Promise.all([
      loadWorkOrders(),
      loadStatistics()
    ]);
  }}
/>



<!-- Floating Theme Toggle -->
<FloatingThemeToggle />

<style>
  @keyframes fade-in {
    from { opacity: 0; transform: translateY(20px); }
    to { opacity: 1; transform: translateY(0); }
  }
  .animate-fade-in {
    animation: fade-in 0.2s ease;
  }
  
  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
  .animate-spin {
    animation: spin 1s linear infinite;
  }
</style> 