<script lang="ts">
  import { onMount } from 'svelte';
  import Sidebar from '$lib/components/navigation/Sidebar.svelte';
  import { supabase } from '$lib/supabaseClient';
  import { fetchUserMenus } from '$lib/services/menuService';
  import FloatingThemeToggle from '$lib/components/common/FloatingThemeToggle.svelte';
  import HolidayHeader from '$lib/components/planning/HolidayHeader.svelte';
  import HolidayStats from '$lib/components/planning/HolidayStats.svelte';
  import HolidayTable from '$lib/components/planning/HolidayTable.svelte';
  import HolidayCalendar from '$lib/components/planning/HolidayCalendar.svelte';
  import AddHolidayModal from '$lib/components/planning/AddHolidayModal.svelte';
  import EditHolidayModal from '$lib/components/planning/EditHolidayModal.svelte';
  import ImportHolidayModal from '$lib/components/planning/ImportHolidayModal.svelte';
  import { 
    fetchHolidays, 
    saveHoliday, 
    updateHoliday, 
    deleteHoliday, 
    getHolidayStats,
    addSundaysForYear,
    importHolidays,
    type Holiday,
    type HolidayStats as HolidayStatsType,
    type HolidayFormData
  } from '$lib/api/planning';

  let holidays: Holiday[] = [];
  let stats: HolidayStatsType = {
    total: 0,
    active: 0,
    inactive: 0,
    byYear: {}
  };
  let loading = true;
  let error = '';
  let expandTable = false;
  let showAddModal = false;
  let showEditModal = false;
  let showImportModal = false;
  let selectedHoliday: Holiday | null = null;
  let selectedYear = new Date().getFullYear();
  let menus: any[] = [];
  let showSidebar = false;
  let showCalendar = true;

  onMount(async () => {
    try {
      // Load menus in background without blocking the UI
      const { getCurrentUsername } = await import('$lib/utils/userUtils');
      const username = getCurrentUsername();
      const menuData = await fetchUserMenus(username);
      menus = menuData;
    } catch (error) {
      console.error('Failed to load menus:', error);
      // Continue without menus rather than failing completely
    }
    
    await loadData();
  });

  async function loadData() {
    try {
      loading = true;
      error = '';
      
      const [holidaysData, statsData] = await Promise.all([
        fetchHolidays(selectedYear),
        getHolidayStats(selectedYear)
      ]);
      
      holidays = holidaysData;
      stats = statsData;
    } catch (err) {
      console.error('Error loading holiday data:', err);
      error = 'Failed to load holiday data. Please try again.';
    } finally {
      loading = false;
    }
  }

  async function handleSaveHoliday(holidayData: any) {
    try {
      await saveHoliday(holidayData);
      await loadData();
      showAddModal = false;
      // Show success message
      alert('Holiday saved successfully!');
    } catch (err) {
      console.error('Error saving holiday:', err);
      // Show more detailed error message
      const errorMessage = err instanceof Error ? err.message : 'Failed to save holiday. Please try again.';
      alert(`Error: ${errorMessage}`);
    }
  }

  async function handleDeleteHoliday(id: number) {
    try {
      await deleteHoliday(id);
      await loadData();
    } catch (err) {
      console.error('Error deleting holiday:', err);
      alert('Failed to delete holiday. Please try again.');
    }
  }

  function handleRowSelect(holiday: Holiday) {
    selectedHoliday = holiday;
    // TODO: Implement edit modal or details view
    console.log('Selected holiday:', holiday);
  }

  function handleEditHoliday(holiday: Holiday) {
    selectedHoliday = holiday;
    showEditModal = true;
  }

  async function handleUpdateHoliday(id: number, isActive: boolean) {
    try {
      const { getCurrentUsername, getCurrentTimestamp } = await import('$lib/utils/userUtils');
      const currentUser = getCurrentUsername();
      const now = getCurrentTimestamp();
      
      await supabase
        .from('plan_holidays')
        .update({ 
          is_active: isActive,
          modified_by: currentUser,
          modified_dt: now
          // created_by and created_dt should not be touched on update
        })
        .eq('id', id);
      await loadData();
      showEditModal = false;
    } catch (err) {
      console.error('Error updating holiday:', err);
      alert('Failed to update holiday. Please try again.');
    }
  }

  async function handleImportSundays() {
    try {
      const result = await addSundaysForYear();
      await loadData();
      if (result.added > 0) {
        alert(`Successfully added ${result.added} Sunday(s). ${result.skipped > 0 ? `${result.skipped} Sunday(s) already existed and were skipped.` : ''}`);
      } else {
        alert(`All Sundays already exist. ${result.skipped} Sunday(s) were skipped.`);
      }
    } catch (err) {
      console.error('Error adding Sundays:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to add Sundays. Please try again.';
      alert(`Error: ${errorMessage}`);
    }
  }

  async function handleImportCSV(holidaysData: HolidayFormData[]) {
    try {
      const result = await importHolidays(holidaysData);
      await loadData();
      let message = '';
      if (result.added > 0) {
        message = `Successfully imported ${result.added} holiday(s).`;
      }
      if (result.skipped > 0) {
        message += ` ${result.skipped} holiday(s) already existed and were skipped.`;
      }
      if (result.errors > 0) {
        message += ` ${result.errors} holiday(s) had errors and were skipped.`;
      }
      if (result.added === 0 && result.skipped === 0 && result.errors === 0) {
        message = 'No holidays to import.';
      }
      alert(message || 'Import completed.');
    } catch (err) {
      console.error('Error importing holidays:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to import holidays. Please try again.';
      alert(`Error: ${errorMessage}`);
    }
  }

  async function handleYearChange(year: number) {
    selectedYear = year;
    try {
      await loadData();
    } catch (error) {
      console.error('Error loading data for year change:', error);
    }
  }

  function toggleSidebar() {
    showSidebar = !showSidebar;
  }

  function toggleView() {
    showCalendar = !showCalendar;
  }
</script>

<svelte:head>
  <title>Holiday Management - KNDY PMS</title>
</svelte:head>

<!-- Sidebar Overlay -->
{#if showSidebar}
  <div class="fixed inset-0 z-50">
    <button
      type="button"
      aria-label="Close sidebar overlay"
      class="fixed inset-0 bg-black bg-opacity-40 z-40"
      on:click={toggleSidebar}
      tabindex="0"
      on:keydown={(e) => (e.key === 'Enter' || e.key === ' ') && toggleSidebar()}
      style="cursor: pointer; border: none; width: 100%; height: 100%; position: fixed; left: 0; top: 0; background-color: rgba(0,0,0,0.4);"
    ></button>
    <div class="fixed left-0 top-0 h-full w-64 z-50 theme-bg-primary shadow-lg">
      <Sidebar {menus} />
    </div>
  </div>
{/if}

<div class="flex flex-col h-full w-full theme-bg-secondary transition-colors duration-200" style="min-height: 100vh;">
  <div class="p-6">
      <!-- Header -->
      <HolidayHeader 
        onSidebarToggle={toggleSidebar}
        onAddHoliday={() => showAddModal = true}
        onImportHolidays={() => showImportModal = true}
        {selectedYear}
        onYearChange={handleYearChange}
        {showCalendar}
        onToggleView={toggleView}
      />

      <!-- Loading State -->
      {#if loading}
        <div class="flex items-center justify-center py-12">
          <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
          <span class="ml-3 theme-text-primary transition-colors duration-200">Loading holidays...</span>
        </div>
      {:else if error}
        <!-- Error State -->
        <div class="bg-red-100 dark:bg-red-900 border border-red-400 text-red-700 dark:text-red-200 px-4 py-3 rounded mb-6">
          <div class="flex items-center">
            <svg class="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
            </svg>
            {error}
          </div>
        </div>
      {:else}
        <!-- Content -->
        <div class="mt-6 space-y-6">
          <!-- Statistics -->
          <HolidayStats {stats} />

          <!-- Calendar or Table View -->
          {#if showCalendar}
            <!-- Calendar View -->
            <div class="theme-bg-primary rounded-xl shadow transition-colors duration-200">
              <HolidayCalendar {holidays} {selectedYear} />
            </div>
          {:else}
            <!-- Table View -->
            <div class="theme-bg-primary rounded-xl shadow transition-colors duration-200">
              <HolidayTable
                tableData={holidays}
                {expandTable}
                onExpandToggle={() => expandTable = !expandTable}
                onRowSelect={handleRowSelect}
                onDeleteRow={handleDeleteHoliday}
                onEditRow={handleEditHoliday}
              />
            </div>
          {/if}
        </div>
      {/if}
    </div>

    <!-- Add Holiday Modal -->
    <AddHolidayModal
      showModal={showAddModal}
      onSave={handleSaveHoliday}
      onClose={() => showAddModal = false}
    />

    <!-- Edit Holiday Modal -->
    <EditHolidayModal
      showModal={showEditModal}
      holiday={selectedHoliday}
      onSave={handleUpdateHoliday}
      onClose={() => {
        showEditModal = false;
        selectedHoliday = null;
      }}
    />

    <!-- Import Holiday Modal -->
    <ImportHolidayModal
      showModal={showImportModal}
      onImportSundays={handleImportSundays}
      onImportCSV={handleImportCSV}
      onClose={() => showImportModal = false}
    />
  </div>

  <!-- Floating Theme Toggle -->
  <FloatingThemeToggle /> 