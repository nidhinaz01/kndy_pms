<script lang="ts">
  import { onMount } from 'svelte';
  import DataTablePage from '$lib/templates/DataTablePage.svelte';
  import ModelsHeader from '$lib/components/models/ModelsHeader.svelte';
  import ModelsTable from '$lib/components/models/ModelsTable.svelte';
  import AddModelModal from '$lib/components/models/AddModelModal.svelte';
  import ModelHistoryModal from '$lib/components/models/ModelHistoryModal.svelte';
  import { supabase } from '$lib/supabaseClient';
  
  // State management
  let showSidebar = false;
  let tableData: any[] = [];
  let selectedRow: any = null;
  let showAddModal = false;
  let isLoading = true;
  let isTableLoading = false;

  // Event handlers
  function handleRowSelect(row: any) {
    selectedRow = row;
  }

  function closeRowDetails() {
    selectedRow = null;
  }

  function handleAddModel() {
    showAddModal = true;
  }

  function closeAddModal() {
    showAddModal = false;
  }

  async function loadModels() {
    isTableLoading = true;
    try {
      console.log('Loading models with is_deleted = false filter...');
      const { data, error } = await supabase
        .from('mstr_wo_type')
        .select('*')
        .or('is_deleted.eq.false,is_deleted.is.null')
        .order('modified_dt', { ascending: false });

      if (error) {
        console.error('Error loading models:', error);
        tableData = [];
      } else {
        console.log('Models loaded:', data?.length || 0, 'records');
        console.log('Sample model data:', data?.[0]);
        tableData = data || [];
      }
    } catch (error) {
      console.error('Error loading models:', error);
      tableData = [];
    } finally {
      isTableLoading = false;
    }
  }

  async function handleModelAdded() {
    console.log('handleModelAdded called');
    try {
      console.log('Loading models...');
      await loadModels();
      console.log('Models loaded successfully');
      showAddModal = false;
      alert('Model added successfully!');
    } catch (error) {
      console.error('Error refreshing models after adding:', error);
      // Don't show error to user since the model was actually added successfully
    }
  }

  async function handleDeleteModel(selectedIds: string[]) {
    if (selectedIds.length === 0) return;
    
    const modelId = selectedIds[0]; // Take the first ID since we only support single deletion
    console.log('Attempting to delete model with ID:', modelId);
    
    if (confirm(`Are you sure you want to delete this model?`)) {
      try {
        const username = localStorage.getItem('username') || 'unknown';
        const currentDate = new Date().toISOString(); // Full ISO string for timestampz

        console.log('Updating model with is_deleted = true for ID:', modelId);
        const { data, error } = await supabase
          .from('mstr_wo_type')
          .update({ 
            is_deleted: true,
            modified_by: username,
            modified_dt: currentDate
          })
          .eq('id', modelId)
          .select(); // Add select to see what was updated

        if (error) {
          console.error('Error deleting model:', error);
          alert('Failed to delete model. Please try again.');
        } else {
          console.log('Model soft deleted successfully. Updated records:', data);
          await loadModels(); // Reload the data
          alert('Model deleted successfully.');
        }
      } catch (error) {
        console.error('Error deleting model:', error);
        alert('Failed to delete model. Please try again.');
      }
    }
  }

  onMount(async () => {
    // Load models data
    await loadModels();
    isLoading = false;
  });
</script>

<DataTablePage
  pageTitle="Models"
  {isLoading}
  {isTableLoading}
  {tableData}
  {selectedRow}
  {showAddModal}
  {showSidebar}
  headerComponent={ModelsHeader}
  tableComponent={ModelsTable}
  addModalComponent={AddModelModal}
  rowDetailsModalComponent={ModelHistoryModal}
  onSidebarToggle={() => showSidebar = true}
  onRowSelect={handleRowSelect}
  onCloseRowDetails={closeRowDetails}
  onAddItem={handleAddModel}
  onCloseAddModal={closeAddModal}
  onItemAdded={handleModelAdded}
  onDeleteSelected={handleDeleteModel}
/> 