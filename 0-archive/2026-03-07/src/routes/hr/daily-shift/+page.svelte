<script lang="ts">
  import { onMount } from 'svelte';
  import DataTablePage from '$lib/templates/DataTablePage.svelte';
  import DailyShiftScheduleHeader from '$lib/components/hr/DailyShiftScheduleHeader.svelte';
  import DailyShiftScheduleTable from '$lib/components/hr/DailyShiftScheduleTable.svelte';
  import AddDailyShiftScheduleModal from '$lib/components/hr/AddDailyShiftScheduleModal.svelte';
  import { fetchDailyShiftSchedulesByDateRange } from '$lib/api/hrDailyShiftSchedule';

  // Page state
  let isLoading = true;
  let isTableLoading = false;
  let tableData: any[] = [];
  let selectedRow: any = null;
  let showSidebar = false;
  let showAddModal = false;
  let currentDate = new Date();

  // Load data on mount
  onMount(async () => {
    await loadData();
  });

  async function loadData() {
    isLoading = true;
    try {
      console.log('Loading daily shift schedules for month:', currentDate.toLocaleDateString());
      
      // Calculate start and end of month
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth();
      
      // Format dates as YYYY-MM-DD without timezone conversion to avoid date shifting
      // Start of month is always the 1st
      const startDate = `${year}-${String(month + 1).padStart(2, '0')}-01`;
      
      // End of month: get last day of the month
      const endOfMonth = new Date(year, month + 1, 0);
      const endDate = `${year}-${String(endOfMonth.getMonth() + 1).padStart(2, '0')}-${String(endOfMonth.getDate()).padStart(2, '0')}`;
      
      console.log('Date range:', startDate, 'to', endDate);
      
      tableData = await fetchDailyShiftSchedulesByDateRange(startDate, endDate);
      console.log('Loaded data:', tableData);
    } catch (error) {
      console.error('Error loading daily shift schedules:', error);
      alert('Failed to load daily shift schedules. Please try again.');
    } finally {
      isLoading = false;
    }
  }

  // Event handlers
  function handleSidebarToggle() {
    showSidebar = !showSidebar;
  }

  function handleRowSelect(row: any) {
    selectedRow = row;
  }

  function closeRowDetails() {
    selectedRow = null;
  }

  function handleAddItem() {
    showAddModal = true;
  }

  function closeAddModal() {
    showAddModal = false;
  }

  function handleItemAdded() {
    console.log('Item added, reloading data...');
    loadData();
  }

  function handleStatusUpdated() {
    // Data is already updated in the table component
  }

  function handleMonthChanged(event: CustomEvent<Date>) {
    currentDate = event.detail;
    loadData();
  }
</script>

<DataTablePage
  pageTitle="Daily Shift Schedule"
  {isLoading}
  {isTableLoading}
  {tableData}
  {selectedRow}
  {showAddModal}
  {showSidebar}
  headerComponent={DailyShiftScheduleHeader}
  tableComponent={DailyShiftScheduleTable}
  addModalComponent={AddDailyShiftScheduleModal}
  rowDetailsModalComponent={null}
  onSidebarToggle={handleSidebarToggle}
  onRowSelect={handleRowSelect}
  onCloseRowDetails={closeRowDetails}
  onAddItem={handleAddItem}
  onCloseAddModal={closeAddModal}
  onItemAdded={handleItemAdded}
  onDeleteSelected={() => {}}
  onStatusUpdated={handleStatusUpdated}
  headerComponentProps={{
    currentDate,
    onMonthChanged: handleMonthChanged
  }}
/> 