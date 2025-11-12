<script lang="ts">
  import { onMount } from 'svelte';
  import DataTablePage from '$lib/templates/DataTablePage.svelte';
  import SkillCombinationsTable from '$lib/components/standards/SkillCombinationsTable.svelte';
  import AddSkillCombinationModal from '$lib/components/standards/AddSkillCombinationModal.svelte';
  import { fetchSkillCombinations } from '$lib/api/skillCombinations';
  import SkillCombinationsHeader from '$lib/components/standards/SkillCombinationsHeader.svelte';

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

  function handleAddCombination() {
    showAddModal = true;
  }

  function closeAddModal() {
    showAddModal = false;
  }

  async function loadSkillCombinations() {
    isTableLoading = true;
    try {
      tableData = await fetchSkillCombinations();
    } catch (error) {
      console.error('Error loading skill combinations:', error);
      tableData = [];
    } finally {
      isTableLoading = false;
    }
  }

  async function handleCombinationAdded() {
    await loadSkillCombinations();
    showAddModal = false;
    alert('Skill combination created successfully!');
  }

  async function handleStatusUpdated() {
    await loadSkillCombinations();
  }

  onMount(async () => {
    await loadSkillCombinations();
    isLoading = false;
  });
</script>

<DataTablePage
  pageTitle="Skill Combinations"
  {isLoading}
  {isTableLoading}
  {tableData}
  {selectedRow}
  {showAddModal}
  {showSidebar}
  headerComponent={SkillCombinationsHeader}
  tableComponent={SkillCombinationsTable}
  addModalComponent={AddSkillCombinationModal}
  rowDetailsModalComponent={null}
  onSidebarToggle={() => showSidebar = !showSidebar}
  onRowSelect={handleRowSelect}
  onCloseRowDetails={closeRowDetails}
  onAddItem={handleAddCombination}
  onCloseAddModal={closeAddModal}
  onItemAdded={handleCombinationAdded}
  onDeleteSelected={() => {}}
  onStatusUpdated={handleStatusUpdated}
/> 