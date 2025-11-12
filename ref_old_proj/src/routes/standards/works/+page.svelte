<script lang="ts">
  import { onMount } from 'svelte';
  import DataTablePage from '$lib/templates/DataTablePage.svelte';
  import WorksTable from '$lib/components/standards/WorksTable.svelte';
  import AddWorkModal from '$lib/components/standards/AddWorkModal.svelte';
  import { fetchAllStdWorkDetails, insertStdWorkDetail } from '$lib/api/stdWorkDetails';
  import { supabase } from '$lib/supabaseClient';
  import WorksHeader from '$lib/components/standards/WorksHeader.svelte';

  let showSidebar = false;
  let tableData: any[] = [];
  let selectedRow: any = null;
  let showAddModal = false;
  let isLoading = true;
  let isTableLoading = false;

  function handleRowSelect(row: any) {
    selectedRow = row;
  }

  function closeRowDetails() {
    selectedRow = null;
  }

  function handleAddWork() {
    showAddModal = true;
  }

  function closeAddModal() {
    showAddModal = false;
  }

  async function loadWorks() {
    isTableLoading = true;
    try {
      tableData = await fetchAllStdWorkDetails();
    } catch (error) {
      tableData = [];
    } finally {
      isTableLoading = false;
    }
  }

  async function handleWorkAdded() {
    await loadWorks();
    showAddModal = false;
    alert('Work detail added successfully!');
  }

  async function handleDeleteWork(selectedIds: string[]) {
    if (selectedIds.length === 0) return;
    const sw_id = Number(selectedIds[0]);
    if (confirm(`Are you sure you want to delete this work?`)) {
      try {
        const { data: userData } = await supabase.auth.getUser();
        const username = userData?.user?.email || 'system';
        const now = new Date().toISOString();
        // Soft delete: set is_active = false
        const { error } = await supabase
          .from('std_work_details')
          .update({ is_active: false, modified_by: username, modified_dt: now })
          .eq('sw_id', sw_id);
        if (error) {
          alert('Failed to delete work. Please try again.');
        } else {
          await loadWorks();
          alert('Work deleted successfully.');
        }
      } catch (error) {
        alert('Failed to delete work. Please try again.');
      }
    }
  }

  onMount(async () => {
    await loadWorks();
    isLoading = false;
  });
</script>

<DataTablePage
  pageTitle="Standard Works"
  {isLoading}
  {isTableLoading}
  {tableData}
  {selectedRow}
  {showAddModal}
  {showSidebar}
  headerComponent={WorksHeader}
  tableComponent={WorksTable}
  addModalComponent={AddWorkModal}
  rowDetailsModalComponent={null}
  onSidebarToggle={() => showSidebar = true}
  onRowSelect={() => {}}
  onCloseRowDetails={() => {}}
  onAddItem={handleAddWork}
  onCloseAddModal={closeAddModal}
  onItemAdded={handleWorkAdded}
  onDeleteSelected={() => {}}
/> 