<script lang="ts">
  import { onMount } from 'svelte';
  import DataTablePage from '$lib/templates/DataTablePage.svelte';
  import WorksTable from '$lib/components/standards/WorksTable.svelte';
  import AddWorkModal from '$lib/components/standards/AddWorkModal.svelte';
  import ImportWorkModal from '$lib/components/standards/ImportWorkModal.svelte';
  import { fetchAllStdWorkDetails, insertStdWorkDetail } from '$lib/api/stdWorkDetails';
  import { supabase } from '$lib/supabaseClient';
  import DerivativeWorksTable from '$lib/components/standards/DerivativeWorksTable.svelte';
  import AddDerivativeWorkModal from '$lib/components/standards/AddDerivativeWorkModal.svelte';
  import ImportDerivativeWorkModal from '$lib/components/standards/ImportDerivativeWorkModal.svelte';
  import WorkSkillMappingTable from '$lib/components/standards/WorkSkillMappingTable.svelte';
  import AddWorkSkillMappingModal from '$lib/components/standards/AddWorkSkillMappingModal.svelte';
  import ImportWorkSkillMappingModal from '$lib/components/standards/ImportWorkSkillMappingModal.svelte';
  import SkillTimeStandardsTable from '$lib/components/standards/SkillTimeStandardsTable.svelte';
  import AddSkillTimeStandardModal from '$lib/components/standards/AddSkillTimeStandardModal.svelte';
  import ImportSkillTimeStandardModal from '$lib/components/standards/ImportSkillTimeStandardModal.svelte';

  // Tab management
  let activeTab = 'standard-works';
  const tabs = [
    { id: 'standard-works', label: 'Standard Works', icon: '📋' },
    { id: 'derivative-works', label: 'Derivative Works', icon: '🔄' },
    { id: 'work-skill-mapping', label: 'Work-Skill Mapping', icon: '🔗' },
    { id: 'time-standards', label: 'Time Standards', icon: '⏱️' }
  ];

  // Common state
  let showSidebar = false;
  let selectedRow: any = null;
  let isLoading = true;
  let isTableLoading = false;

  // Standard Works state
  let standardWorksData: any[] = [];
  let showAddWorkModal = false;
  let showImportWorkModal = false;

  // Derivative Works state
  let derivativeWorksData: any[] = [];
  let showAddDerivativeWorkModal = false;
  let showImportDerivativeWorkModal = false;

  // Work-Skill Mapping state
  let workSkillMappingData: any[] = [];
  let showAddWorkSkillMappingModal = false;
  let showImportWorkSkillMappingModal = false;

  // Time Standards state
  let timeStandardsData: any[] = [];
  let showAddTimeStandardModal = false;
  let showImportTimeStandardModal = false;

  // Event handlers
  function handleRowSelect(row: any) {
    selectedRow = row;
  }

  function closeRowDetails() {
    selectedRow = null;
  }

  // Standard Works handlers
  function handleAddWork() {
    showAddWorkModal = true;
  }

  function closeAddWorkModal() {
    showAddWorkModal = false;
  }

  function handleImportClick() {
    showImportWorkModal = true;
  }

  function closeImportModal() {
    showImportWorkModal = false;
  }

  async function loadStandardWorks() {
    isTableLoading = true;
    try {
      standardWorksData = await fetchAllStdWorkDetails();
    } catch (error) {
      standardWorksData = [];
    } finally {
      isTableLoading = false;
    }
  }

  async function handleWorkAdded() {
    await loadStandardWorks();
    showAddWorkModal = false;
    alert('Work detail added successfully!');
  }

  async function handleStatusUpdated() {
    await loadStandardWorks();
  }

  async function handleImportSuccess() {
    await loadStandardWorks();
    showImportWorkModal = false;
  }

  // Derivative Works handlers
  function handleAddDerivativeWork() {
    showAddDerivativeWorkModal = true;
  }

  function closeAddDerivativeWorkModal() {
    showAddDerivativeWorkModal = false;
  }

  function handleImportDerivativeWork() {
    showImportDerivativeWorkModal = true;
  }

  function closeImportDerivativeWorkModal() {
    showImportDerivativeWorkModal = false;
  }

  async function loadDerivativeWorks() {
    isTableLoading = true;
    try {
      const { fetchAllStdWorkTypeDetails } = await import('$lib/api/stdWorkTypeDetails');
      derivativeWorksData = await fetchAllStdWorkTypeDetails();
    } catch (error) {
      derivativeWorksData = [];
    } finally {
      isTableLoading = false;
    }
  }

  async function handleDerivativeWorkAdded() {
    await loadDerivativeWorks();
    showAddDerivativeWorkModal = false;
    alert('Derivative work added successfully!');
  }

  async function handleDerivativeWorkStatusUpdated() {
    await loadDerivativeWorks();
  }

  async function handleDerivativeWorkImportSuccess() {
    await loadDerivativeWorks();
    showImportDerivativeWorkModal = false;
  }

  // Work-Skill Mapping handlers
  function handleAddWorkSkillMapping() {
    showAddWorkSkillMappingModal = true;
  }

  function closeAddWorkSkillMappingModal() {
    showAddWorkSkillMappingModal = false;
  }

  function handleImportWorkSkillMapping() {
    showImportWorkSkillMappingModal = true;
  }

  function closeImportWorkSkillMappingModal() {
    showImportWorkSkillMappingModal = false;
  }

  async function loadWorkSkillMappings() {
    isTableLoading = true;
    try {
      const { fetchAllWorkSkillMappings } = await import('$lib/api/stdWorkSkillMapping');
      workSkillMappingData = await fetchAllWorkSkillMappings();
    } catch (error) {
      workSkillMappingData = [];
    } finally {
      isTableLoading = false;
    }
  }

  async function handleWorkSkillMappingAdded() {
    await loadWorkSkillMappings();
    showAddWorkSkillMappingModal = false;
    alert('Work-skill mapping added successfully!');
  }

  async function handleWorkSkillMappingStatusUpdated() {
    await loadWorkSkillMappings();
  }

  async function handleWorkSkillMappingImportSuccess() {
    await loadWorkSkillMappings();
    showImportWorkSkillMappingModal = false;
  }

  // Time Standards handlers
  function handleAddTimeStandard() {
    showAddTimeStandardModal = true;
  }

  function closeAddTimeStandardModal() {
    showAddTimeStandardModal = false;
  }

  function handleImportTimeStandard() {
    showImportTimeStandardModal = true;
  }

  function closeImportTimeStandardModal() {
    showImportTimeStandardModal = false;
  }

  async function loadTimeStandards() {
    isTableLoading = true;
    try {
      const { fetchAllSkillTimeStandards } = await import('$lib/api/stdSkillTimeStandards');
      timeStandardsData = await fetchAllSkillTimeStandards();
    } catch (error) {
      timeStandardsData = [];
    } finally {
      isTableLoading = false;
    }
  }

  async function handleTimeStandardAdded() {
    await loadTimeStandards();
    showAddTimeStandardModal = false;
    alert('Time standard added successfully!');
  }

  async function handleTimeStandardStatusUpdated() {
    await loadTimeStandards();
  }

  async function handleTimeStandardImportSuccess() {
    await loadTimeStandards();
    showImportTimeStandardModal = false;
  }

  // Tab change handler
  async function handleTabChange(tabId: string) {
    activeTab = tabId;
    
    // Load data for the selected tab
    switch (tabId) {
      case 'standard-works':
        await loadStandardWorks();
        break;
      case 'derivative-works':
        await loadDerivativeWorks();
        break;
      case 'work-skill-mapping':
        await loadWorkSkillMappings();
        break;
      case 'time-standards':
        await loadTimeStandards();
        break;
      case 'vehicle-work-flow':
        // await loadVehicleWorkFlows(); // Removed as per edit hint
        break;
    }
  }

  onMount(async () => {
    await loadStandardWorks();
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
    {#if activeTab === 'standard-works'}
      <DataTablePage
        pageTitle="Standard Works"
        {isLoading}
        {isTableLoading}
        tableData={standardWorksData}
        {selectedRow}
        showAddModal={showAddWorkModal}
        {showSidebar}
        showImportModal={showImportWorkModal}
        tableComponent={WorksTable}
        tableComponentProps={{ onAddItem: handleAddWork, onImportClick: handleImportClick }}
        addModalComponent={AddWorkModal}
        importModalComponent={ImportWorkModal}
        rowDetailsModalComponent={null}
        onSidebarToggle={() => showSidebar = !showSidebar}
        onRowSelect={handleRowSelect}
        onCloseRowDetails={closeRowDetails}
        onAddItem={handleAddWork}
        onCloseAddModal={closeAddWorkModal}
        onItemAdded={handleWorkAdded}
        onDeleteSelected={() => {}}
        onStatusUpdated={handleStatusUpdated}
        onImportClick={handleImportClick}
        onCloseImportModal={closeImportModal}
        onImportSuccess={handleImportSuccess}
      />
    {:else if activeTab === 'derivative-works'}
      <DataTablePage
        pageTitle="Derivative Works"
        {isLoading}
        {isTableLoading}
        tableData={derivativeWorksData}
        {selectedRow}
        showAddModal={showAddDerivativeWorkModal}
        {showSidebar}
        showImportModal={showImportDerivativeWorkModal}
        tableComponent={DerivativeWorksTable}
        tableComponentProps={{ onAddItem: handleAddDerivativeWork, onImportClick: handleImportDerivativeWork }}
        addModalComponent={AddDerivativeWorkModal}
        importModalComponent={ImportDerivativeWorkModal}
        rowDetailsModalComponent={null}
        onSidebarToggle={() => showSidebar = !showSidebar}
        onRowSelect={handleRowSelect}
        onCloseRowDetails={closeRowDetails}
        onAddItem={handleAddDerivativeWork}
        onCloseAddModal={closeAddDerivativeWorkModal}
        onItemAdded={handleDerivativeWorkAdded}
        onDeleteSelected={() => {}}
        onStatusUpdated={handleDerivativeWorkStatusUpdated}
        onImportClick={handleImportDerivativeWork}
        onCloseImportModal={closeImportDerivativeWorkModal}
        onImportSuccess={handleDerivativeWorkImportSuccess}
      />
    {:else if activeTab === 'work-skill-mapping'}
      <DataTablePage
        pageTitle="Work-Skill Mapping"
        {isLoading}
        {isTableLoading}
        tableData={workSkillMappingData}
        {selectedRow}
        showAddModal={showAddWorkSkillMappingModal}
        {showSidebar}
        showImportModal={showImportWorkSkillMappingModal}
        tableComponent={WorkSkillMappingTable}
        tableComponentProps={{ onAddItem: handleAddWorkSkillMapping, onImportClick: handleImportWorkSkillMapping }}
        addModalComponent={AddWorkSkillMappingModal}
        importModalComponent={ImportWorkSkillMappingModal}
        rowDetailsModalComponent={null}
        onSidebarToggle={() => showSidebar = !showSidebar}
        onRowSelect={handleRowSelect}
        onCloseRowDetails={closeRowDetails}
        onAddItem={handleAddWorkSkillMapping}
        onCloseAddModal={closeAddWorkSkillMappingModal}
        onItemAdded={handleWorkSkillMappingAdded}
        onDeleteSelected={() => {}}
        onStatusUpdated={handleWorkSkillMappingStatusUpdated}
        onImportClick={handleImportWorkSkillMapping}
        onCloseImportModal={closeImportWorkSkillMappingModal}
        onImportSuccess={handleWorkSkillMappingImportSuccess}
      />
    {:else if activeTab === 'time-standards'}
      <DataTablePage
        pageTitle="Skill Time Standards"
        {isLoading}
        {isTableLoading}
        tableData={timeStandardsData}
        {selectedRow}
        showAddModal={showAddTimeStandardModal}
        {showSidebar}
        showImportModal={showImportTimeStandardModal}
        tableComponent={SkillTimeStandardsTable}
        tableComponentProps={{ onAddItem: handleAddTimeStandard, onImportClick: handleImportTimeStandard }}
        addModalComponent={AddSkillTimeStandardModal}
        importModalComponent={ImportSkillTimeStandardModal}
        rowDetailsModalComponent={null}
        onSidebarToggle={() => showSidebar = !showSidebar}
        onRowSelect={handleRowSelect}
        onCloseRowDetails={closeRowDetails}
        onAddItem={handleAddTimeStandard}
        onCloseAddModal={closeAddTimeStandardModal}
        onItemAdded={handleTimeStandardAdded}
        onDeleteSelected={() => {}}
        onStatusUpdated={handleTimeStandardStatusUpdated}
        onImportClick={handleImportTimeStandard}
        onCloseImportModal={closeImportTimeStandardModal}
        onImportSuccess={handleTimeStandardImportSuccess}
      />
    {/if}
  </div>
</div> 