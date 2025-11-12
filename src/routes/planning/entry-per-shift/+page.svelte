<script lang="ts">
  import { onMount } from 'svelte';
  import DataTablePage from '$lib/templates/DataTablePage.svelte';
  import ProductionPlanWizard from '$lib/components/planning/ProductionPlanWizard.svelte';
  import ProductionPlansShiftHeader from '$lib/components/planning/ProductionPlansShiftHeader.svelte';
  import ProductionPlansShiftTable from '$lib/components/planning/ProductionPlansShiftTable.svelte';
  import { fetchProductionPlans, updatePlanStatus, softDeleteProductionPlan, getCurrentActivePlan } from '$lib/api/productionPlanService';

  // Page state
  let isLoading = true;
  let isTableLoading = false;
  let tableData: any[] = [];
  let selectedRow: any = null;
  let showSidebar = false;
  let showAddModal = false;
  let showWizard = false;
  let expandTable = false;


  // Load data on mount
  onMount(async () => {
    await loadData();
  });

  async function loadData() {
    isLoading = true;
    try {
      console.log('Loading production plans...');
      tableData = await fetchProductionPlans();
      console.log('Loaded data:', tableData);
      console.log('Data length:', tableData.length);
    } catch (error) {
      console.error('Error loading production plans:', error);
      alert('Failed to load production plans. Please try again.');
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

  async function handleAddItem() {
    try {
      // Check if there's already an active plan
      const activePlan = await getCurrentActivePlan();
      if (activePlan) {
        alert(`Cannot create a new production plan while plan ID ${activePlan.id} (${activePlan.from_date} to ${activePlan.to_date}) is active. Please deactivate the current plan first.`);
        return;
      }
      
      // If no active plan, proceed to open wizard
      showWizard = true;
    } catch (error) {
      console.error('Error checking for active plan:', error);
      alert('Failed to check for active plans. Please try again.');
    }
  }

  function closeAddModal() {
    showAddModal = false;
  }

  function handleItemAdded() {
    loadData();
  }

  function closeWizard() {
    showWizard = false;
  }

  function handlePlanCreated() {
    loadData();
  }

  function handleExpandToggle() {
    expandTable = !expandTable;
  }

  async function togglePlanStatus(planId: number, newStatus: boolean) {
    try {
      await updatePlanStatus(planId, newStatus);
      await loadData(); // Refresh the data
      alert(`Plan ${newStatus ? 'activated' : 'deactivated'} successfully!`);
    } catch (error) {
      console.error('Error toggling plan status:', error);
      alert('Failed to update plan status. Please try again.');
    }
  }

  async function deleteProductionPlan(planId: number) {
    try {
      await softDeleteProductionPlan(planId);
      await loadData(); // Refresh the data
      alert('Production plan deleted successfully!');
    } catch (error) {
      console.error('Error deleting production plan:', error);
      alert('Failed to delete production plan. Please try again.');
    }
  }

  function handleToggleStatus(plan: any) {
    // Toggle the active status of the plan
    togglePlanStatus(plan.id, !plan.is_active);
  }

  function handleDeleteRow(id: number) {
    if (confirm('Are you sure you want to delete this production plan? This action cannot be undone.')) {
      deleteProductionPlan(id);
    }
  }
</script>

<!-- Main Content -->
<DataTablePage
  pageTitle="Production Plans (Shift-Based)"
  {isLoading}
  {isTableLoading}
  {tableData}
  {selectedRow}
  {showAddModal}
  {showSidebar}
  onSidebarToggle={handleSidebarToggle}
  onRowSelect={handleRowSelect}
  onCloseRowDetails={closeRowDetails}
  onAddItem={handleAddItem}
  onCloseAddModal={closeAddModal}
  onItemAdded={handleItemAdded}
  onDeleteSelected={() => {}}
  onStatusUpdated={() => {}}
  tableComponent={ProductionPlansShiftTable}
  addModalComponent={null}
  headerComponent={ProductionPlansShiftHeader}
  rowDetailsModalComponent={null}
  tableComponentProps={{
    expandTable,
    onExpandToggle: handleExpandToggle,
    onDeleteRow: handleDeleteRow,
    onToggleStatus: handleToggleStatus
  }}
/>

<!-- Production Plan Wizard -->
<ProductionPlanWizard 
  bind:showWizard
  on:close={closeWizard}
  on:planCreated={handlePlanCreated}
/> 