<script lang="ts">
  import { onMount } from 'svelte';
  import AppHeader from '$lib/components/common/AppHeader.svelte';
  import FloatingThemeToggle from '$lib/components/common/FloatingThemeToggle.svelte';
  import Sidebar from '$lib/components/navigation/Sidebar.svelte';
  import { fetchUserMenus } from '$lib/services/menuService';
  import Button from '$lib/components/common/Button.svelte';
  import DataTable from '$lib/components/common/DataTable.svelte';
  import SelectWoModal from './components/SelectWoModal.svelte';
  import ConfirmArchiveModal from './components/ConfirmArchiveModal.svelte';
  import {
    fetchWorkOrdersForArchive,
    fetchArchivedWorkOrders,
    archiveWorkOrder,
    type WorkOrderListItem
  } from '$lib/api/archive/archiveWoService';
  import { Plus } from 'lucide-svelte';

  let menus: any[] = [];
  let showSidebar = false;
  let message = '';
  let messageType: 'success' | 'error' = 'success';
  let archivedList: any[] = [];
  let tableLoading = false;
  let showSelectModal = false;
  let showConfirmModal = false;
  let workOrdersForArchive: WorkOrderListItem[] = [];
  let woListLoading = false;
  let selectedWoIds: number[] = [];
  let archiveStatusLines: string[] = [];
  let isArchiving = false;

  function handleSidebarToggle() {
    showSidebar = !showSidebar;
  }

  function showMessage(text: string, type: 'success' | 'error') {
    message = text;
    messageType = type;
    setTimeout(() => {
      message = '';
    }, 6000);
  }

  async function loadArchivedWorkOrders() {
    try {
      tableLoading = true;
      archivedList = await fetchArchivedWorkOrders();
    } catch (err) {
      console.error('Error loading archived work orders:', err);
      showMessage('Failed to load archived work orders. Ensure the archive schema exists and is accessible.', 'error');
      archivedList = [];
    } finally {
      tableLoading = false;
    }
  }

  async function openSelectModal() {
    showSelectModal = true;
    selectedWoIds = [];
    archiveStatusLines = [];
    try {
      woListLoading = true;
      workOrdersForArchive = await fetchWorkOrdersForArchive();
    } catch (err) {
      console.error('Error loading work orders:', err);
      showMessage('Failed to load work orders.', 'error');
      workOrdersForArchive = [];
    } finally {
      woListLoading = false;
    }
  }

  function closeSelectModal() {
    showSelectModal = false;
  }

  function onSelectModalOk() {
    if (selectedWoIds.length === 0) return;
    showSelectModal = false;
    showConfirmModal = true;
  }

  function closeConfirmModal() {
    showConfirmModal = false;
  }

  function getSelectedWoNumbers(): string[] {
    return selectedWoIds
      .map((id) => workOrdersForArchive.find((w) => w.id === id)?.wo_no ?? 'ID-' + id);
  }

  async function onConfirmArchive() {
    const username = localStorage.getItem('username');
    if (!username) {
      showMessage('User session not found.', 'error');
      closeConfirmModal();
      return;
    }
    showConfirmModal = false;
    isArchiving = true;
    archiveStatusLines = [];
    let successCount = 0;
    let failCount = 0;
    for (const id of selectedWoIds) {
      const wo = workOrdersForArchive.find((w) => w.id === id);
      const woNo = wo?.wo_no ?? 'ID-' + id;
      archiveStatusLines = [...archiveStatusLines, `Archiving ${woNo}...`];
      const result = await archiveWorkOrder(id, username);
      if (result.success) {
        successCount++;
        archiveStatusLines = [...archiveStatusLines, `  Done.`];
      } else {
        failCount++;
        archiveStatusLines = [...archiveStatusLines, `  Failed: ${result.error ?? 'Unknown error'}`];
      }
    }
    isArchiving = false;
    await loadArchivedWorkOrders();
    if (failCount === 0) {
      showMessage(`Archived ${successCount} work order(s) successfully.`, 'success');
    } else {
      showMessage(`Archived ${successCount}, failed ${failCount}. See status below.`, 'error');
    }
  }

  onMount(async () => {
    try {
      const savedUserStr = localStorage.getItem('user');
      if (!savedUserStr) {
        window.location.href = '/';
        return;
      }
      let savedUser: any = null;
      try {
        savedUser = JSON.parse(savedUserStr);
      } catch {
        window.location.href = '/';
        return;
      }
      const username = savedUser?.username;
      if (!username) {
        window.location.href = '/';
        return;
      }
      await loadArchivedWorkOrders();
      menus = await fetchUserMenus(username);
    } catch (err) {
      console.error('Error during archive-wo initialization:', err);
      window.location.href = '/';
    }
  });
</script>

<svelte:head>
  <title>PMS - Archive Work Order</title>
</svelte:head>

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
  <AppHeader title="Archive Work Order" onSidebarToggle={handleSidebarToggle} />

  {#if message}
    <div
      class={`mx-4 mt-4 p-4 rounded-lg ${messageType === 'success' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'}`}
    >
      {message}
    </div>
  {/if}

  <div class="flex flex-1 flex-col p-4">
    <div class="flex items-center gap-2 mb-4">
      <Button variant="primary" size="md" on:click={openSelectModal} disabled={isArchiving}>
        <Plus class="w-5 h-5 inline mr-1" aria-hidden="true" />
        Archive work order
      </Button>
    </div>

    {#if isArchiving || archiveStatusLines.length > 0}
      <div class="mb-4 p-4 rounded-lg theme-bg-primary border theme-border">
        <p class="text-sm font-medium theme-text-primary mb-2">Status</p>
        <pre class="text-xs theme-text-secondary whitespace-pre-wrap font-sans">{archiveStatusLines.join('\n')}</pre>
      </div>
    {/if}

    <div class="flex-1">
      <DataTable
        data={archivedList}
        columns={[
          { key: 'wo_no', label: 'WO No', sortable: true, filterable: true, type: 'text' },
          { key: 'wo_type', label: 'WO Type', sortable: true, filterable: true, type: 'text' },
          { key: 'wo_model', label: 'WO Model', sortable: true, filterable: true, type: 'text' },
          { key: 'wo_date', label: 'WO Date', sortable: true, filterable: true, type: 'date' },
          { key: 'wo_delivery', label: 'WO Delivery', sortable: true, filterable: true, type: 'date' },
          { key: 'archived_by', label: 'Archived by', sortable: true, filterable: true, type: 'text' },
          { key: 'archived_dt', label: 'Archived at', sortable: true, filterable: true, type: 'date' }
        ]}
        title="Archived work orders"
        isLoading={tableLoading}
      />
    </div>
  </div>
</div>

<SelectWoModal
  showModal={showSelectModal}
  workOrders={workOrdersForArchive}
  bind:selectedIds={selectedWoIds}
  loading={woListLoading}
  onConfirm={onSelectModalOk}
  onCancel={closeSelectModal}
/>

<ConfirmArchiveModal
  showModal={showConfirmModal}
  woNumbers={getSelectedWoNumbers()}
  onConfirm={onConfirmArchive}
  onCancel={closeConfirmModal}
/>

<FloatingThemeToggle />
