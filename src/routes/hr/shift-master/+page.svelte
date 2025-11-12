<script lang="ts">
  import { onMount } from 'svelte';
  import DataTablePage from '$lib/templates/DataTablePage.svelte';
  import ShiftsTable from '$lib/components/hr/ShiftsTable.svelte';
  import ShiftBreaksTable from '$lib/components/hr/ShiftBreaksTable.svelte';
  import AddShiftModal from '$lib/components/hr/AddShiftModal.svelte';
  import AddShiftBreakModal from '$lib/components/hr/AddShiftBreakModal.svelte';
  import ShiftsHeader from '$lib/components/hr/ShiftsHeader.svelte';
  import ShiftBreaksHeader from '$lib/components/hr/ShiftBreaksHeader.svelte';
  import Sidebar from '$lib/components/navigation/Sidebar.svelte';
  import FloatingThemeToggle from '$lib/components/common/FloatingThemeToggle.svelte';
  import { fetchAllShifts } from '$lib/api/hrShiftMaster';
  import { fetchAllShiftBreaks } from '$lib/api/hrShiftBreakMaster';
  import type { HrShiftMaster } from '$lib/api/hrShiftMaster';
  import type { HrShiftBreakMaster } from '$lib/api/hrShiftBreakMaster';

  let activeTab = 'shifts';
  let showSidebar = false;
  let tableData: any[] = [];
  let selectedRow: any = null;
  let showAddShiftModal = false;
  let showAddShiftBreakModal = false;
  let isLoading = true;
  let isTableLoading = false;
  let menus: any[] = [];

  // Tab configuration with icons
  const tabs = [
    { id: 'shifts', label: 'Shifts', icon: '⏰' },
    { id: 'shift-breaks', label: 'Shift Breaks', icon: '☕' }
  ];

  function handleRowSelect(row: any) {
    selectedRow = row;
  }

  function closeRowDetails() {
    selectedRow = null;
  }

  function handleAddShift() {
    showAddShiftModal = true;
  }

  function handleAddShiftBreak() {
    showAddShiftBreakModal = true;
  }

  function closeAddShiftModal() {
    showAddShiftModal = false;
  }

  function closeAddShiftBreakModal() {
    showAddShiftBreakModal = false;
  }

  function handleSidebarToggle() {
    showSidebar = !showSidebar;
  }

  async function loadData() {
    isTableLoading = true;
    try {
      if (activeTab === 'shifts') {
        tableData = await fetchAllShifts();
      } else {
        tableData = await fetchAllShiftBreaks();
      }
    } catch (error) {
      console.error('Error loading data:', error);
      tableData = [];
    } finally {
      isTableLoading = false;
    }
  }

  async function handleShiftAdded() {
    await loadData();
    showAddShiftModal = false;
    alert('Shift created successfully!');
  }

  async function handleShiftBreakAdded() {
    await loadData();
    showAddShiftBreakModal = false;
    alert('Shift break created successfully!');
  }

  async function handleStatusUpdated() {
    await loadData();
  }

  async function handleTabChange(tab: string) {
    activeTab = tab;
    await loadData();
  }

  onMount(async () => {
    // Load menus for sidebar
    const username = localStorage.getItem('username');
    if (username) {
      try {
        const { fetchUserMenus } = await import('$lib/services/menuService');
        menus = await fetchUserMenus(username);
      } catch (error) {
        console.error('Error loading menus:', error);
      }
    }
    
    await loadData();
    isLoading = false;
  });
</script>

<svelte:head>
  <title>HR Shift Master - KNDY PMS</title>
</svelte:head>

<div class="min-h-screen theme-bg-primary">
  <!-- Row 1: Header with Burger, Tabs, and Logo -->
  <div class="theme-bg-primary shadow-sm border-b theme-border">
    <div class="w-full mx-auto px-4 sm:px-6 lg:px-8">
      <div class="flex items-center justify-between py-4">
        <!-- Burger Menu -->
        <button 
          class="p-2 rounded hover:theme-bg-tertiary focus:outline-none transition-colors duration-200" 
          on:click={handleSidebarToggle} 
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

        <!-- Logo -->
        <img src="/favicon.png" alt="Company Logo" class="h-8 w-auto" />
      </div>
    </div>
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

  <!-- Row 2: Table Content with Built-in Controls -->
  <div class="w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
    {#if activeTab === 'shifts'}
      <!-- Shifts Table -->
      <div class="theme-bg-primary rounded-lg shadow border theme-border">
        {#if isLoading}
          <div class="flex items-center justify-center py-12">
            <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
            <span class="ml-3 theme-text-primary">Loading shifts...</span>
          </div>
        {:else}
          <ShiftsTable
            {tableData}
            {isTableLoading}
            onRowSelect={handleRowSelect}
            onStatusUpdated={handleStatusUpdated}
            onAddItem={handleAddShift}
          />
        {/if}
      </div>
    {:else if activeTab === 'shift-breaks'}
      <!-- Shift Breaks Table -->
      <div class="theme-bg-primary rounded-lg shadow border theme-border">
        {#if isLoading}
          <div class="flex items-center justify-center py-12">
            <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
            <span class="ml-3 theme-text-primary">Loading shift breaks...</span>
          </div>
        {:else}
          <ShiftBreaksTable
            {tableData}
            {isTableLoading}
            onRowSelect={handleRowSelect}
            onStatusUpdated={handleStatusUpdated}
            onAddItem={handleAddShiftBreak}
          />
        {/if}
      </div>
    {/if}
  </div>
</div>

<!-- Modals -->
{#if showAddShiftModal}
  <AddShiftModal
    showAddModal={showAddShiftModal}
    onClose={closeAddShiftModal}
  />
{/if}

{#if showAddShiftBreakModal}
  <AddShiftBreakModal
    showAddModal={showAddShiftBreakModal}
    onClose={closeAddShiftBreakModal}
  />
{/if}

<FloatingThemeToggle /> 