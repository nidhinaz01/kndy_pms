<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import FloatingThemeToggle from '$lib/components/common/FloatingThemeToggle.svelte';
  import DataTablePage from '$lib/templates/DataTablePage.svelte';
  import VehicleWorkFlowTable from '$lib/components/standards/VehicleWorkFlowTable.svelte';

  import AddVehicleWorkFlowModal from '$lib/components/standards/AddVehicleWorkFlowModal.svelte';
  import ImportVehicleWorkFlowModal from '$lib/components/standards/ImportVehicleWorkFlowModal.svelte';
  import { fetchVehicleWorkFlowsByType } from '$lib/api/stdVehicleWorkFlow';
  import { supabase } from '$lib/supabaseClient';

  // Tab management
  let activeTab = '';
  let tabs: Array<{ id: string; label: string; icon: string }> = [];

  // Common state
  let showSidebar = false;
  let selectedRow: any = null;
  let isLoading = true;
  let isTableLoading = false;

  // Vehicle Work Flow state
  let vehicleWorkFlowData: any[] = [];
  let showAddVehicleWorkFlowModal = false;
  let showImportVehicleWorkFlowModal = false;

  // Event handlers
  function handleRowSelect(row: any) {
    selectedRow = row;
  }

  function closeRowDetails() {
    selectedRow = null;
  }

  // Vehicle Work Flow handlers
  function handleAddVehicleWorkFlow() {
    showAddVehicleWorkFlowModal = true;
  }

  function closeAddVehicleWorkFlowModal() {
    showAddVehicleWorkFlowModal = false;
  }

  function handleImportClick() {
    showImportVehicleWorkFlowModal = true;
  }

  function closeImportModal() {
    showImportVehicleWorkFlowModal = false;
  }

  async function loadVehicleTypes() {
    try {
      const { data: vehicleTypes, error } = await supabase
        .from('mstr_wo_type')
        .select('id, wo_type_name')
        .eq('is_deleted', false)
        .eq('is_active', true)
        .order('wo_type_name');

      if (error) throw error;

      tabs = (vehicleTypes || []).map(type => ({
        id: type.id.toString(),
        label: type.wo_type_name,
        icon: '🚗'
      }));

      // Set first tab as active if no tab is selected
      if (tabs.length > 0 && !activeTab) {
        activeTab = tabs[0].id;
      }
    } catch (error) {
      console.error('Error loading vehicle types:', error);
      tabs = [];
    }
  }

  async function loadVehicleWorkFlows() {
    if (!activeTab) return;
    
    isTableLoading = true;
    try {
      vehicleWorkFlowData = await fetchVehicleWorkFlowsByType(parseInt(activeTab));
    } catch (error) {
      vehicleWorkFlowData = [];
    } finally {
      isTableLoading = false;
    }
  }

  async function handleVehicleWorkFlowAdded() {
    await loadVehicleWorkFlows();
  }

  // Tab change handler
  async function handleTabChange(tabId: string) {
    activeTab = tabId;
    await loadVehicleWorkFlows();
  }

  onMount(async () => {
    // Load vehicle types first
    await loadVehicleTypes();
    
    // Load initial data if we have tabs
    if (activeTab) {
      await loadVehicleWorkFlows();
    }
    
    isLoading = false;
  });
</script>

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
        <nav class="flex space-x-8 overflow-x-auto scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600 scrollbar-track-transparent">
          {#each tabs as tab}
            <button
              class="py-2 px-3 font-medium text-sm transition-colors duration-200 rounded-lg whitespace-nowrap flex-shrink-0 {activeTab === tab.id 
                ? 'border-2 border-blue-500 text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 shadow-sm' 
                : 'border-2 border-transparent theme-text-secondary hover:theme-text-primary hover:border-gray-300 dark:hover:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700/20'}"
              on:click={() => handleTabChange(tab.id)}
            >
              <span class="mr-2">{tab.icon}</span>
              {tab.label}
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
    {#if activeTab}
      <DataTablePage
        pageTitle="Vehicle Work Flow"
        {isLoading}
        {isTableLoading}
        tableData={vehicleWorkFlowData}
        {selectedRow}
        showAddModal={showAddVehicleWorkFlowModal}
        {showSidebar}
                expandTable={false}
        tableComponentProps={{ onAddItem: handleAddVehicleWorkFlow, onImportClick: handleImportClick }}
        tableComponent={VehicleWorkFlowTable}
        addModalComponent={AddVehicleWorkFlowModal}
        rowDetailsModalComponent={null}
        importModalComponent={ImportVehicleWorkFlowModal}
        showImportModal={showImportVehicleWorkFlowModal}
        onSidebarToggle={() => showSidebar = !showSidebar}
        onRowSelect={handleRowSelect}
        onCloseRowDetails={closeRowDetails}
        onAddItem={handleAddVehicleWorkFlow}
        onCloseAddModal={closeAddVehicleWorkFlowModal}
        onItemAdded={handleVehicleWorkFlowAdded}
        onDeleteSelected={() => {}}
        onImportClick={handleImportClick}
        onCloseImportModal={closeImportModal}
        onImportSuccess={handleVehicleWorkFlowAdded}
      />
    {:else}
      <div class="text-center py-12">
        <p class="text-gray-500 dark:text-gray-400">No vehicle types available</p>
      </div>
    {/if}
  </div>
</div>

<FloatingThemeToggle /> 