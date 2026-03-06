<script lang="ts">
  import { onMount } from 'svelte';
  import Sidebar from '$lib/components/navigation/Sidebar.svelte';
  import AppHeader from '$lib/components/common/AppHeader.svelte';
  import FloatingThemeToggle from '$lib/components/common/FloatingThemeToggle.svelte';
  import { fetchUserMenus } from '$lib/services/menuService';
  import { 
    getDocumentsByDocumentType, 
    getDocumentDownloadUrl,
    getDocumentHistory,
    type WorkOrderDocumentGroup,
    type DocumentSubmission
  } from '../../share-documents/services/documentUploadService';
  import { DOCUMENT_TYPES } from '../../share-documents/constants/documentTypes';
  import DocumentHistoryModal from '../../share-documents/components/DocumentHistoryModal.svelte';
  import WorkOrderGroup from '../components/WorkOrderGroup.svelte';

  const documentType = DOCUMENT_TYPES.SEAT_LAYOUT;

  // Page state
  let isLoading = false;
  let error = '';
  let showSidebar = false;
  let menus: any[] = [];
  let documentGroups: WorkOrderDocumentGroup[] = [];
  let allDocumentGroups: WorkOrderDocumentGroup[] = [];
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

  async function loadDocuments() {
    try {
      isLoading = true;
      error = '';
      allDocumentGroups = await getDocumentsByDocumentType(documentType);
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
      });

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
      const salesOrderId = workOrderGroup.sales_order_id;
      documentHistory = await getDocumentHistory(salesOrderId, documentType);
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
  <title>View Documents - {documentType}</title>
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
    title="View Documents - {documentType}"
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
              No documents found for {documentType}
            </p>
            <p class="text-sm theme-text-tertiary">
              Documents will appear here once they are uploaded for this document type.
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
    documentType={documentType}
    workOrderNo={selectedWorkOrderForHistory.wo_no}
    {documentHistory}
    on:close={handleHistoryModalClose}
    on:download={(e) => handleDownload(e.detail)}
  />
{/if}

