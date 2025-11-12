<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { browser } from '$app/environment';
  import { formatDate } from '$lib/utils/formatDate';
  import Button from '$lib/components/common/Button.svelte';
  import HolidayTable from '$lib/components/planning/HolidayTable.svelte';
  import HolidayModal from '$lib/components/planning/HolidayModal.svelte';
  import ImportHolidayModal from '$lib/components/planning/ImportHolidayModal.svelte';
  import Sidebar from '$lib/components/navigation/Sidebar.svelte';
  import AppHeader from '$lib/components/common/AppHeader.svelte';
  import FloatingThemeToggle from '$lib/components/common/FloatingThemeToggle.svelte';
  import { fetchUserMenus } from '$lib/api/menu';
  import { exportToCSV } from '$lib/utils/exportUtils';
  import type { Holiday, HolidayFilters } from '$lib/api/holidays';
  import {
    fetchHolidays,
    fetchHolidayFilters,
    saveHoliday,
    updateHoliday,
    deleteHoliday,
    importHolidays,
    fetchHolidaysByDateRange
  } from '$lib/api/holidays';

  // Page state
  let holidays: Holiday[] = [];
  let isLoading = false;
  let message = '';
  let messageType: 'success' | 'error' = 'success';

  // Filter state
  let selectedMonth = '';
  let selectedYear = 0;
  let availableMonths: string[] = [];
  let availableYears: number[] = [];

  // Modal state
  let showHolidayModal = false;
  let showImportModal = false;
  let selectedHoliday: Holiday | null = null;
  let importResults: { success: number; errors: string[] } | null = null;

  // Sidebar state
  let showSidebar = false;
  let menus: any[] = [];

  // Get current user from session
  $: currentUser = $page.data.session?.user?.email || localStorage.getItem('username') || 'Unknown User';

  onMount(async () => {
    const username = localStorage.getItem('username');
    if (username) {
      menus = await fetchUserMenus();
    }
    await loadHolidays();
    await loadFilters();
  });

  async function loadHolidays() {
    try {
      isLoading = true;
      const filters: HolidayFilters = {};
      if (selectedMonth) filters.month = selectedMonth;
      if (selectedYear) filters.year = selectedYear;
      
      holidays = await fetchHolidays(filters);
    } catch (error) {
      showMessage('Error loading holidays', 'error');
      console.error('Error loading holidays:', error);
    } finally {
      isLoading = false;
    }
  }

  async function loadFilters() {
    try {
      const { months, years } = await fetchHolidayFilters();
      availableMonths = months;
      availableYears = years;
    } catch (error) {
      console.error('Error loading filters:', error);
      // Fallback to current year if no data
      const currentYear = new Date().getFullYear();
      availableYears = [currentYear - 1, currentYear, currentYear + 1];
      availableMonths = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
      ];
    }
  }

  function showMessage(msg: string, type: 'success' | 'error' = 'success') {
    message = msg;
    messageType = type;
    setTimeout(() => {
      message = '';
    }, 5000);
  }



  function handleAddHoliday() {
    selectedHoliday = null;
    showHolidayModal = true;
  }

  function handleEditHoliday(holiday: Holiday) {
    selectedHoliday = holiday;
    showHolidayModal = true;
  }

  async function handleDeleteHoliday(id: number, description: string) {
    if (!confirm(`Are you sure you want to delete the holiday "${description}"?`)) {
      return;
    }

    try {
      await deleteHoliday(id);
      showMessage('Holiday deleted successfully');
      await loadHolidays();
    } catch (error) {
      showMessage('Error deleting holiday', 'error');
      console.error('Error deleting holiday:', error);
    }
  }

  async function handleSaveHoliday(event: CustomEvent) {
    const { holiday, isEdit } = event.detail;
    
    try {
      if (isEdit && selectedHoliday) {
        await updateHoliday(selectedHoliday.id, holiday, currentUser);
        showMessage('Holiday updated successfully');
      } else {
        await saveHoliday({
          ...holiday,
          created_by: currentUser
        });
        showMessage('Holiday added successfully');
      }
      
      showHolidayModal = false;
      await loadHolidays();
    } catch (error) {
      showMessage('Error saving holiday', 'error');
      console.error('Error saving holiday:', error);
    }
  }

  function handleImportHoliday(event: CustomEvent) {
    const { valid, invalid } = event.detail;
    
    if (valid.length === 0) {
      showMessage('No valid holidays found in CSV', 'error');
      return;
    }

    // Import the valid holidays
    importHolidays(valid, currentUser)
      .then(result => {
        importResults = result;
        showMessage(`Successfully imported ${result.success} holidays`);
        loadHolidays();
      })
      .catch(error => {
        showMessage('Error importing holidays', 'error');
        console.error('Error importing holidays:', error);
      });
  }

  function handleFilterChange() {
    loadHolidays();
  }

  function handleExportTemplate() {
    // This is handled in the ImportHolidayModal component
  }

  function handleImportClick() {
    showImportModal = true;
    importResults = null;
  }

  function handleSidebarToggle() {
    showSidebar = !showSidebar;
  }

  async function handleAddSundaysForYear() {
    try {
      isLoading = true;
      const today = new Date();
      const endDate = new Date(today);
      endDate.setFullYear(today.getFullYear() + 1);
      const sundays = [];
      let d = new Date(today);
      // Set to next Sunday (or today if today is Sunday)
      d.setDate(d.getDate() + ((7 - d.getDay()) % 7));
      while (d <= endDate) {
        sundays.push({
          dt_day: d.getDate(),
          dt_month: d.toLocaleString('default', { month: 'long' }),
          dt_year: d.getFullYear(),
          description: 'Sunday',
          dt_value: d.toISOString().slice(0, 10)
        });
        d.setDate(d.getDate() + 7);
      }
      // Fetch existing holidays in the range
      const existing = await fetchHolidaysByDateRange(today, endDate);
      const existingDates = new Set(existing.map(h => h.dt_value));
      // Only add Sundays that do not exist
      const toAdd = sundays.filter(s => !existingDates.has(s.dt_value));
      const formatRange = (date: Date) => `${String(date.getDate()).padStart(2, '0')}-${date.toLocaleString('default', { month: 'short' })}-${String(date.getFullYear()).slice(-2)}`;
      if (toAdd.length === 0) {
        showMessage(`All Sundays from today (${formatRange(today)}) to 1 year from today (${formatRange(endDate)}) already exist.`, 'success');
        return;
      }
      // Remove dt_value before import
      const toAddForImport = toAdd.map(({dt_day, dt_month, dt_year, description}) => ({dt_day, dt_month, dt_year, description}));
      await importHolidays(toAddForImport, currentUser);
      showMessage(`${toAdd.length} Sundays added from today (${formatRange(today)}) to 1 year from today (${formatRange(endDate)}).`, 'success');
      await loadHolidays();
    } catch (error) {
      showMessage('Error adding Sundays', 'error');
      console.error('Error adding Sundays:', error);
    } finally {
      isLoading = false;
    }
  }

  function handleExportData() {
    if (holidays.length === 0) {
      showMessage('No data to export', 'error');
      return;
    }

    const headers = ['Date', 'Description', 'Created By', 'Created Date'];
    
    const getRowData = (holiday: Holiday) => [
      holiday.dt_value ? formatDate(holiday.dt_value) : `${holiday.dt_day} ${holiday.dt_month} ${holiday.dt_year}`,
      holiday.description,
      holiday.created_by,
      formatDate(holiday.created_dt)
    ];

    exportToCSV(holidays, headers, 'holidays', getRowData);
    showMessage('Holiday data exported successfully');
  }
</script>

<svelte:head>
  <title>Holiday List - Production Management</title>
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
    title="Holiday List Management"
    onSidebarToggle={handleSidebarToggle}
  />

  <!-- Message Display -->
  {#if message}
    <div class={`mx-4 mt-4 p-4 rounded-lg ${messageType === 'success' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'}`}>
      {message}
    </div>
  {/if}

  <!-- Main Content -->
  <div class="flex flex-1 p-4">
    <div class="w-full">
      <!-- Controls Section -->
      <div class="mb-6 flex flex-wrap items-center justify-between gap-4">
        <!-- Filters -->
        <div class="flex items-center gap-3">
          <div class="flex items-center gap-2">
            <label for="monthFilter" class="text-sm font-medium theme-text-primary whitespace-nowrap">
              Month:
            </label>
            <select
              id="monthFilter"
              bind:value={selectedMonth}
              on:change={handleFilterChange}
              class="px-3 py-2 border theme-border rounded-lg theme-bg-primary theme-text-primary focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">All</option>
              {#each availableMonths as month}
                <option value={month}>{month}</option>
              {/each}
            </select>
          </div>

          <div class="flex items-center gap-2">
            <label for="yearFilter" class="text-sm font-medium theme-text-primary whitespace-nowrap">
              Year:
            </label>
            <select
              id="yearFilter"
              bind:value={selectedYear}
              on:change={handleFilterChange}
              class="px-3 py-2 border theme-border rounded-lg theme-bg-primary theme-text-primary focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value={0}>All</option>
              {#each availableYears as year}
                <option value={year}>{year}</option>
              {/each}
            </select>
          </div>
        </div>

        <!-- Action Buttons -->
        <div class="flex items-center gap-3">
          <Button
            variant="secondary"
            on:click={handleExportData}
          >
            <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Export
          </Button>
          <Button
            variant="secondary"
            on:click={handleImportClick}
          >
            <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
            </svg>
            Import
          </Button>
          <Button
            variant="primary"
            on:click={handleAddHoliday}
          >
            <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            Add Holiday
          </Button>
          <Button
            variant="primary"
            on:click={handleAddSundaysForYear}
          >
            <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-3-3v6" />
            </svg>
            Add Sundays for 1 year
          </Button>
        </div>
      </div>

      <!-- Holiday Table -->
      <HolidayTable
        {holidays}
        {isLoading}
        onEdit={handleEditHoliday}
        onDelete={handleDeleteHoliday}
      />
    </div>
  </div>
</div>

<!-- Holiday Modal -->
<HolidayModal
  showModal={showHolidayModal}
  holiday={selectedHoliday}
  isLoading={isLoading}
  on:save={handleSaveHoliday}
  on:close={() => showHolidayModal = false}
/>

<!-- Import Modal -->
<ImportHolidayModal
  showModal={showImportModal}
  {isLoading}
  {importResults}
  on:import={handleImportHoliday}
  on:close={() => showImportModal = false}
/>

<!-- Floating Theme Toggle -->
<FloatingThemeToggle /> 