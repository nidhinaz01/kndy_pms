<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import Sidebar from '$lib/components/navigation/Sidebar.svelte';
  import FloatingThemeToggle from '$lib/components/common/FloatingThemeToggle.svelte';
  import { fetchUserMenus } from '$lib/services/menuService';
  import { loadScheduleData, loadPlantStages } from './services/scheduleService';
  import PlanTab from './components/PlanTab.svelte';
  import ActualTab from './components/ActualTab.svelte';
  import DeviationTab from './components/DeviationTab.svelte';
  import ScheduleStatistics from './components/ScheduleStatistics.svelte';

  // Page state
  let isLoading = true;
  let showSidebar = false;
  let menus: any[] = [];

  // Date range state
  const today = new Date();
  const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  let fromDate = firstDayOfMonth.toISOString().split('T')[0];
  let toDate = today.toISOString().split('T')[0];

  // Tab state
  let activeTab = 'plan';
  const tabs = [
    { id: 'plan', label: 'Plan', icon: '📋' },
    { id: 'actual', label: 'Actual', icon: '✅' },
    { id: 'deviation', label: 'Deviation', icon: '📊' },
    { id: 'statistics', label: 'Statistics', icon: '📈' }
  ];

  // Data state
  let scheduleData: any[] = [];
  let plantStages: string[] = [];
  let isDataLoading = false;

  onMount(async () => {
    const username = typeof window !== 'undefined' ? localStorage.getItem('username') : null;
    if (username) {
      menus = await fetchUserMenus(username);
    }
    await Promise.all([loadPlantStagesData(), loadData()]);
    isLoading = false;
  });

  async function loadPlantStagesData() {
    try {
      plantStages = await loadPlantStages();
    } catch (error) {
      console.error('Error loading plant stages:', error);
      plantStages = [];
    }
  }

  async function loadData() {
    if (!fromDate || !toDate) return;
    
    isDataLoading = true;
    try {
      scheduleData = await loadScheduleData(fromDate, toDate);
    } catch (error) {
      console.error('Error loading schedule data:', error);
      scheduleData = [];
    } finally {
      isDataLoading = false;
    }
  }

  async function handleDateChange() {
    await loadData();
  }

  function handleTabChange(tabId: string) {
    activeTab = tabId;
  }
</script>

<svelte:head>
  <title>Schedule - Planning</title>
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
  <!-- Header with Burger, Tabs, Date Selectors, and Favicon -->
  <div class="theme-bg-primary shadow-sm border-b theme-border">
    <div class="w-full mx-auto px-4 sm:px-6 lg:px-8">
      <div class="flex items-center justify-between py-4 gap-4">
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

        <!-- Date Range Selectors -->
        <div class="flex items-center gap-4">
          <div class="flex items-center gap-2">
            <label for="fromDate" class="text-sm font-medium theme-text-secondary whitespace-nowrap">From Date:</label>
            <input
              id="fromDate"
              type="date"
              bind:value={fromDate}
              on:change={handleDateChange}
              class="px-3 py-2 border rounded-lg theme-border theme-bg-primary theme-text-primary focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
          </div>
          <div class="flex items-center gap-2">
            <label for="toDate" class="text-sm font-medium theme-text-secondary whitespace-nowrap">To Date:</label>
            <input
              id="toDate"
              type="date"
              bind:value={toDate}
              on:change={handleDateChange}
              class="px-3 py-2 border rounded-lg theme-border theme-bg-primary theme-text-primary focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
          </div>
        </div>

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

    <!-- Tab Content -->
    <div class="theme-bg-primary rounded-lg shadow border theme-border">
      {#if isDataLoading}
        <div class="flex items-center justify-center py-12">
          <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mr-3"></div>
          <span class="theme-text-secondary">Loading schedule data...</span>
        </div>
      {:else if activeTab === 'plan'}
        <PlanTab {scheduleData} {plantStages} />
      {:else if activeTab === 'actual'}
        <ActualTab {scheduleData} {plantStages} />
      {:else if activeTab === 'deviation'}
        <DeviationTab {scheduleData} {plantStages} />
      {:else if activeTab === 'statistics'}
        <ScheduleStatistics {scheduleData} {plantStages} />
      {/if}
    </div>
  </div>

  <FloatingThemeToggle />
</div>

