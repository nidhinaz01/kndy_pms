<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import Sidebar from '$lib/components/navigation/Sidebar.svelte';
  import AppHeader from '$lib/components/common/AppHeader.svelte';
  import FloatingThemeToggle from '$lib/components/common/FloatingThemeToggle.svelte';
  import { fetchUserMenus } from '$lib/services/menuService';
  import { 
    getDocumentsByStageCode, 
    getDocumentDownloadUrl,
    getDocumentHistory,
    type WorkOrderDocumentGroup,
    type DocumentSubmission
  } from '../../share-documents/services/documentUploadService';
  import DocumentHistoryModal from '../../share-documents/components/DocumentHistoryModal.svelte';
  import WorkOrderGroup from '../components/WorkOrderGroup.svelte';

  // Get stage code from route params
  $: stageCode = $page.params.stageCode || '';

  // Page state
  let isLoading = false;
  let error = '';
  let showSidebar = false;
  let menus: any[] = [];
  let documentGroups: WorkOrderDocumentGroup[] = [];
  let allDocumentGroups: WorkOrderDocumentGroup[] = []; // Store all documents for filtering
  let searchQuery = '';

  // History modal state
  let showHistoryModal = false;
  let selectedWorkOrderForHistory: WorkOrderDocumentGroup | null = null;
  let documentHistory: DocumentSubmission[] = [];

  onMount(async () => {
    const username = typeof window !== 'undefined' ? localStorage.getItem('username') : null;
    if (username) {
      menus = await fetchUserMenus(username);
    }
    await loadDocuments();
  });

  // Reload when stage code changes
  $: if (stageCode) {
    loadDocuments();
  }

  async function loadDocuments() {
    if (!stageCode) return;
    
    try {
      isLoading = true;
      error = '';
      allDocumentGroups = await getDocumentsByStageCode(stageCode);
      applySearchFilter();
    } catch (err) {
      error = `Failed to load documents: ${(err as Error).message}`;
      console.error('Error loading documents:', err);
      allDocumentGroups = [];
      documentGroups = [];
    } finally {
      isLoading = false;
    }
  }

  function applySearchFilter() {
    if (!searchQuery.trim()) {
      documentGroups = allDocumentGroups;
      return;
    }

    const query = searchQuery.toLowerCase().trim();
    documentGroups = allDocumentGroups.map(group => {
      // Filter documents within each group
      const filteredDocs = group.documents.filter(doc => {
        const docName = (doc.document_name || '').toLowerCase();
        const woNo = (group.wo_no || '').toLowerCase();
        const pwoNo = (group.pwo_no || '').toLowerCase();
        const model = (group.wo_model || '').toLowerCase();
        const customer = (group.customer_name || '').toLowerCase();
        const uploadedBy = (doc.uploaded_by || '').toLowerCase();
        
        return docName.includes(query) ||
               woNo.includes(query) ||
               pwoNo.includes(query) ||
               model.includes(query) ||
               customer.includes(query) ||
               uploadedBy.includes(query);
      }).map(doc => {
        // Ensure all properties are preserved when filtering
        return {
          ...doc,
          id: doc.id,
          sales_order_id: doc.sales_order_id,
          stage_code: doc.stage_code,
          document_name: doc.document_name,
          file_path: doc.file_path,
          file_size: doc.file_size,
          file_type: doc.file_type,
          submission_date: doc.submission_date,
          revised_date: doc.revised_date,
          revision_number: doc.revision_number,
          is_current: doc.is_current,
          is_deleted: doc.is_deleted,
          replaced_by_id: doc.replaced_by_id,
          uploaded_by: doc.uploaded_by,
          created_dt: doc.created_dt,
          modified_by: doc.modified_by,
          modified_dt: doc.modified_dt
        };
      });

      // Only include groups that have matching documents
      if (filteredDocs.length > 0) {
        return {
          ...group,
          documents: filteredDocs
        };
      }
      return null;
    }).filter(group => group !== null) as WorkOrderDocumentGroup[];
  }

  function handleSearchInput(value: string) {
    searchQuery = value;
    applySearchFilter();
  }

  async function handleDownload(document: DocumentSubmission) {
    try {
      if (!document || !document.file_path) {
        throw new Error('Document file path is missing');
      }
      const url = await getDocumentDownloadUrl(document.file_path);
      window.open(url, '_blank');
    } catch (err) {
      error = `Failed to download document: ${(err as Error).message}`;
      console.error('Error downloading document:', err);
    }
  }

  async function handleViewHistory(workOrderGroup: WorkOrderDocumentGroup) {
    try {
      isLoading = true;
      error = '';
      // Get the first document's sales_order_id (all documents in group have same sales_order_id)
      const salesOrderId = workOrderGroup.sales_order_id;
      documentHistory = await getDocumentHistory(salesOrderId, stageCode);
      selectedWorkOrderForHistory = workOrderGroup;
      showHistoryModal = true;
    } catch (err) {
      error = `Failed to load document history: ${(err as Error).message}`;
      console.error('Error loading history:', err);
    } finally {
      isLoading = false;
    }
  }

  function handleSidebarToggle() {
    showSidebar = !showSidebar;
  }

  function handleHistoryModalClose() {
    showHistoryModal = false;
    selectedWorkOrderForHistory = null;
    documentHistory = [];
  }
</script>

<svelte:head>
  <title>View Documents - {stageCode}</title>
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
    title="View Documents - {stageCode}"
    onSidebarToggle={handleSidebarToggle}
    showSearch={true}
    searchValue={searchQuery}
    onSearchInput={handleSearchInput}
    searchPlaceholder="Search by WO, PWO, Model, Customer, Document name..."
  />

  <!-- Error Message -->
  {#if error}
    <div class="p-4 bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-200 rounded-lg mx-4 mt-4">
      {error}
    </div>
  {/if}

  <!-- Main Content -->
  <div class="flex-1 p-6">
    {#if isLoading && documentGroups.length === 0}
      <div class="flex items-center justify-center h-64">
        <div class="text-center">
          <div class="animate-spin rounded-full h-12 w-12 border-b-2 theme-accent mx-auto mb-4"></div>
          <p class="theme-text-primary">Loading documents...</p>
        </div>
      </div>
    {:else if documentGroups.length === 0}
      <div class="max-w-7xl mx-auto">
        <div class="theme-bg-primary rounded-lg shadow-lg p-6">
          <div class="text-center py-8">
            <p class="text-lg theme-text-secondary mb-4">
              No documents found for stage {stageCode}
            </p>
            <p class="text-sm theme-text-tertiary">
              Documents will appear here once they are uploaded for this stage.
            </p>
          </div>
        </div>
      </div>
    {:else}
      <div class="max-w-7xl mx-auto">
        <!-- Documents List -->
        <div class="space-y-6">
          {#each documentGroups as workOrderGroup}
            <WorkOrderGroup 
              {workOrderGroup} 
              onDownload={handleDownload}
              onViewHistory={handleViewHistory}
            />
          {/each}
        </div>
      </div>
    {/if}
  </div>
</div>

<!-- Floating Theme Toggle -->
<FloatingThemeToggle />

<!-- History Modal -->
{#if showHistoryModal && selectedWorkOrderForHistory}
  <DocumentHistoryModal
    bind:showModal={showHistoryModal}
    stageCode={stageCode}
    workOrderNo={selectedWorkOrderForHistory.wo_no}
    {documentHistory}
    on:close={handleHistoryModalClose}
    on:download={(e) => handleDownload(e.detail)}
  />
{/if}

