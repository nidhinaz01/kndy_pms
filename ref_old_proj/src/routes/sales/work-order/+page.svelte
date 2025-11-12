<script lang="ts">
  import { onMount } from 'svelte';
  import DataTablePage from '$lib/templates/DataTablePage.svelte';
  import WorkOrderHeader from '$lib/components/work-order/WorkOrderHeader.svelte';
  import WorkOrderStats from '$lib/components/work-order/WorkOrderStats.svelte';
  import WorkOrderTable from '$lib/components/work-order/WorkOrderTable.svelte';
  import AddWorkOrderModal from '$lib/components/work-order/AddWorkOrderModal.svelte';
  import RowDetailsModal from '$lib/components/work-order/RowDetailsModal.svelte';
  import PeriodModal from '$lib/components/work-order/PeriodModal.svelte';
  import { supabase } from '$lib/supabaseClient';
  
  // State management
  let showSidebar = false;
  let tableData: any[] = [];
  let selectedRow: any = null;
  let showAddModal = false;
  let showPeriodModal = false;
  let isLoading = true;
  let isTableLoading = false;
  let expandTable = false;

  // Event handlers
  function handleRowSelect(row: any) {
    selectedRow = row;
  }

  function closeRowDetails() {
    selectedRow = null;
  }

  function handleAddWorkOrder() {
    showAddModal = true;
  }

  function closeAddModal() {
    showAddModal = false;
  }

  function handleExpandToggle() {
    expandTable = !expandTable;
  }

  function handlePeriodClick() {
    showPeriodModal = true;
  }

  async function loadWorkOrders() {
    isTableLoading = true;
    try {
      const { data, error } = await supabase
        .from('work_orders')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error loading work orders:', error);
        tableData = [];
      } else {
        tableData = data || [];
      }
    } catch (error) {
      console.error('Error loading work orders:', error);
      tableData = [];
    } finally {
      isTableLoading = false;
    }
  }

  async function handleWorkOrderAdded() {
    await loadWorkOrders();
    showAddModal = false;
  }

  async function handleDeleteSelected(selectedIds: string[]) {
    if (confirm(`Are you sure you want to delete ${selectedIds.length} work order(s)?`)) {
      try {
        const { error } = await supabase
          .from('work_orders')
          .delete()
          .in('id', selectedIds);

        if (error) {
          console.error('Error deleting work orders:', error);
          alert('Failed to delete work orders. Please try again.');
        } else {
          await loadWorkOrders(); // Reload the data
          alert(`Successfully deleted ${selectedIds.length} work order(s).`);
        }
      } catch (error) {
        console.error('Error deleting work orders:', error);
        alert('Failed to delete work orders. Please try again.');
      }
    }
  }

  onMount(async () => {
    // Load work orders data
    await loadWorkOrders();
    isLoading = false;
  });
</script>

<DataTablePage
  pageTitle="Work Orders"
  {isLoading}
  {isTableLoading}
  {tableData}
  {selectedRow}
  {showAddModal}
  {showSidebar}
  {expandTable}
  showStats={true}
  statsComponent={WorkOrderStats}
  periodModalComponent={PeriodModal}
  {showPeriodModal}
  headerComponent={WorkOrderHeader}
  tableComponent={WorkOrderTable}
  addModalComponent={AddWorkOrderModal}
  rowDetailsModalComponent={RowDetailsModal}
  onSidebarToggle={() => showSidebar = true}
  onRowSelect={handleRowSelect}
  onCloseRowDetails={closeRowDetails}
  onAddItem={handleAddWorkOrder}
  onCloseAddModal={closeAddModal}
  onItemAdded={handleWorkOrderAdded}
  onDeleteSelected={handleDeleteSelected}
  onExpandToggle={handleExpandToggle}
  onPeriodClick={handlePeriodClick}
/> 