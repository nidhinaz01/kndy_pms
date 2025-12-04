<script lang="ts">
  import { onMount, createEventDispatcher } from 'svelte';
  import Button from '$lib/components/common/Button.svelte';
  import { X, Upload, FileText, History, Download, Trash2 } from 'lucide-svelte';
  import { formatDate, formatDateTime } from '../utils/dateUtils';
  import { 
    uploadStageDocument, 
    uploadGeneralDocument, 
    deleteDocument,
    getDocumentHistory,
    getDocumentDownloadUrl,
    getWorkOrderDocuments,
    type DocumentSubmission
  } from '../services/documentUploadService';
  import DocumentHistoryModal from './DocumentHistoryModal.svelte';

  export let showModal = false;
  export let workOrder: any = null; // DocumentRelease type

  let isLoading = false;
  let error = '';
  let successMessage = '';
  let hasLoaded = false;
  
  // Document data
  let stageDocuments = new Map<string, DocumentSubmission>();
  let generalDocuments: DocumentSubmission[] = [];
  
  // Upload states
  let uploadingStage: string | null = null;
  let uploadingGeneral = false;
  let fileInputs: Record<string, HTMLInputElement> = {};
  let generalFileInput: HTMLInputElement | null = null;
  
  // History modal
  let showHistoryModal = false;
  let selectedStageForHistory = '';
  let documentHistory: DocumentSubmission[] = [];

  $: if (showModal && workOrder && !hasLoaded) {
    hasLoaded = true;
    loadDocuments();
  }

  $: if (!showModal) {
    hasLoaded = false;
    error = '';
    successMessage = '';
    stageDocuments.clear();
    generalDocuments = [];
  }

  async function loadDocuments() {
    if (!workOrder) return;
    
    try {
      isLoading = true;
      error = '';
      const { stageDocuments: stageDocs, generalDocuments: generalDocs } = await getWorkOrderDocuments(workOrder.sales_order_id);
      stageDocuments = stageDocs;
      generalDocuments = generalDocs;
    } catch (err) {
      error = `Failed to load documents: ${(err as Error).message}`;
      console.error('Error loading documents:', err);
    } finally {
      isLoading = false;
    }
  }

  async function handleStageUpload(stageCode: string) {
    const fileInput = fileInputs[stageCode];
    if (!fileInput || !fileInput.files || fileInput.files.length === 0) return;
    
    const file = fileInput.files[0];
    if (!file) return;
    
    try {
      uploadingStage = stageCode;
      error = '';
      successMessage = '';
      
      const username = typeof window !== 'undefined' ? localStorage.getItem('username') : null;
      if (!username) {
        throw new Error('User not logged in');
      }
      
      await uploadStageDocument(workOrder.sales_order_id, stageCode, file, username);
      
      successMessage = `Document uploaded successfully for ${stageCode}`;
      fileInput.value = ''; // Reset input
      
      // Reload documents
      await loadDocuments();
      
      // Dispatch event to parent to refresh list
      dispatch('document-uploaded');
    } catch (err) {
      error = `Failed to upload document: ${(err as Error).message}`;
      console.error('Error uploading document:', err);
    } finally {
      uploadingStage = null;
    }
  }

  async function handleGeneralUpload() {
    if (!generalFileInput || !generalFileInput.files || generalFileInput.files.length === 0) return;
    
    const file = generalFileInput.files[0];
    if (!file) return;
    
    try {
      uploadingGeneral = true;
      error = '';
      successMessage = '';
      
      const username = typeof window !== 'undefined' ? localStorage.getItem('username') : null;
      if (!username) {
        throw new Error('User not logged in');
      }
      
      await uploadGeneralDocument(workOrder.sales_order_id, file, username);
      
      successMessage = 'General document uploaded successfully';
      generalFileInput.value = ''; // Reset input
      
      // Reload documents
      await loadDocuments();
      
      // Dispatch event to parent
      dispatch('document-uploaded');
    } catch (err) {
      error = `Failed to upload document: ${(err as Error).message}`;
      console.error('Error uploading document:', err);
    } finally {
      uploadingGeneral = false;
    }
  }

  async function handleDeleteDocument(documentId: number, isGeneral: boolean = false) {
    if (!confirm('Are you sure you want to delete this document? This action cannot be undone.')) {
      return;
    }
    
    try {
      isLoading = true;
      error = '';
      successMessage = '';
      
      const username = typeof window !== 'undefined' ? localStorage.getItem('username') : null;
      if (!username) {
        throw new Error('User not logged in');
      }
      
      await deleteDocument(documentId, username);
      
      successMessage = 'Document deleted successfully';
      
      // Reload documents
      await loadDocuments();
      
      // Dispatch event to parent
      dispatch('document-deleted');
    } catch (err) {
      error = `Failed to delete document: ${(err as Error).message}`;
      console.error('Error deleting document:', err);
    } finally {
      isLoading = false;
    }
  }

  async function handleViewHistory(stageCode: string) {
    try {
      isLoading = true;
      documentHistory = await getDocumentHistory(workOrder.sales_order_id, stageCode);
      selectedStageForHistory = stageCode;
      showHistoryModal = true;
    } catch (err) {
      error = `Failed to load document history: ${(err as Error).message}`;
      console.error('Error loading history:', err);
    } finally {
      isLoading = false;
    }
  }

  async function handleDownload(document: DocumentSubmission) {
    try {
      const url = await getDocumentDownloadUrl(document.file_path);
      window.open(url, '_blank');
    } catch (err) {
      error = `Failed to download document: ${(err as Error).message}`;
      console.error('Error downloading document:', err);
    }
  }

  function handleClose() {
    showModal = false;
    error = '';
    successMessage = '';
    stageDocuments.clear();
    generalDocuments = [];
    dispatch('close');
  }

  const dispatch = createEventDispatcher();
</script>

{#if showModal}
  <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
    <div class="theme-bg-primary rounded-lg shadow-xl p-6 w-full max-w-4xl my-8 max-h-[90vh] overflow-y-auto">
      <!-- Header -->
      <div class="flex items-center justify-between mb-6">
        <h2 class="text-2xl font-semibold theme-text-primary">
          Upload Documents - {workOrder?.wo_no}
        </h2>
        <button
          on:click={handleClose}
          class="p-2 hover:theme-bg-secondary rounded-lg transition-colors"
          aria-label="Close modal"
        >
          <X class="w-5 h-5 theme-text-primary" />
        </button>
      </div>

      <!-- Work Order Info -->
      {#if workOrder}
        <div class="mb-6 p-4 theme-bg-secondary rounded-lg">
          <div class="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span class="font-medium theme-text-primary">WO No:</span>
              <span class="ml-2 theme-text-secondary">{workOrder.wo_no}</span>
            </div>
            <div>
              <span class="font-medium theme-text-primary">PWO No:</span>
              <span class="ml-2 theme-text-secondary">{workOrder.pwo_no || 'N/A'}</span>
            </div>
            <div>
              <span class="font-medium theme-text-primary">Model:</span>
              <span class="ml-2 theme-text-secondary">{workOrder.wo_model}</span>
            </div>
            <div>
              <span class="font-medium theme-text-primary">Customer:</span>
              <span class="ml-2 theme-text-secondary">{workOrder.customer_name || 'N/A'}</span>
            </div>
          </div>
        </div>
      {/if}

      <!-- Messages -->
      {#if error}
        <div class="mb-4 p-3 bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 rounded-lg text-sm">
          {error}
        </div>
      {/if}
      {#if successMessage}
        <div class="mb-4 p-3 bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 rounded-lg text-sm">
          {successMessage}
        </div>
      {/if}

      {#if isLoading && !stageDocuments.size && generalDocuments.length === 0}
        <div class="flex items-center justify-center py-8">
          <div class="animate-spin rounded-full h-8 w-8 border-b-2 theme-accent"></div>
        </div>
      {:else}
        <!-- Stage-Specific Documents -->
        <div class="mb-6">
          <h3 class="text-lg font-semibold theme-text-primary mb-4">Stage-Specific Documents</h3>
          <div class="space-y-4">
            {#each workOrder?.stages || [] as stage}
              {@const doc = stageDocuments.get(stage.stage_code)}
              <div class="p-4 border theme-border rounded-lg">
                <div class="flex items-center justify-between mb-3">
                  <div>
                    <h4 class="font-medium theme-text-primary">{stage.stage_code}</h4>
                    <p class="text-sm theme-text-secondary">
                      Planned: {formatDate(stage.planned_date)}
                      {#if stage.actual_date}
                        | Submitted: {formatDate(stage.actual_date)}
                      {/if}
                    </p>
                  </div>
                  <div class="flex items-center gap-2">
                    {#if doc}
                      <span class="px-2 py-1 bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 rounded-full text-xs">
                        ✅ Uploaded (v{doc.revision_number})
                      </span>
                    {:else}
                      <span class="px-2 py-1 bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200 rounded-full text-xs">
                        ❌ Not Uploaded
                      </span>
                    {/if}
                  </div>
                </div>

                {#if doc}
                  <!-- Document Info -->
                  <div class="mb-3 p-3 theme-bg-secondary rounded">
                    <div class="flex items-center justify-between">
                      <div class="flex items-center gap-2">
                        <FileText class="w-4 h-4 theme-text-primary" />
                        <span class="theme-text-primary text-sm">{doc.document_name}</span>
                        {#if doc.revision_number > 1}
                          <span class="text-xs theme-text-secondary">(Revised {doc.revision_number - 1} time{doc.revision_number - 1 > 1 ? 's' : ''})</span>
                        {/if}
                      </div>
                      <div class="flex items-center gap-2">
                        <button
                          on:click={() => handleDownload(doc)}
                          class="p-1 hover:theme-bg-tertiary rounded transition-colors"
                          title="Download"
                        >
                          <Download class="w-4 h-4 theme-text-primary" />
                        </button>
                        <button
                          on:click={() => handleViewHistory(stage.stage_code)}
                          class="p-1 hover:theme-bg-tertiary rounded transition-colors"
                          title="View History"
                        >
                          <History class="w-4 h-4 theme-text-primary" />
                        </button>
                        <button
                          on:click={() => handleDeleteDocument(doc.id, false)}
                          class="p-1 hover:theme-bg-tertiary rounded transition-colors text-red-600"
                          title="Delete"
                          disabled={isLoading}
                        >
                          <Trash2 class="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    <p class="text-xs theme-text-secondary mt-1">
                      Uploaded: {formatDateTime(doc.submission_date)}
                    </p>
                  </div>
                {/if}

                <!-- Upload/Replace Button -->
                <div class="flex items-center gap-2">
                  <input
                    type="file"
                    bind:this={fileInputs[stage.stage_code]}
                    accept=".pdf,application/pdf"
                    class="hidden"
                    on:change={() => handleStageUpload(stage.stage_code)}
                    id="file-{stage.stage_code}"
                  />
                  <Button
                    variant={doc ? "secondary" : "primary"}
                    size="sm"
                    disabled={uploadingStage === stage.stage_code || isLoading}
                    fullWidth={true}
                    on:click={() => fileInputs[stage.stage_code]?.click()}
                  >
                    {#if uploadingStage === stage.stage_code}
                      <Upload class="w-4 h-4 mr-2 animate-pulse inline" />
                      Uploading...
                    {:else if doc}
                      <Upload class="w-4 h-4 mr-2 inline" />
                      Replace Document
                    {:else}
                      <Upload class="w-4 h-4 mr-2 inline" />
                      Upload Document
                    {/if}
                  </Button>
                </div>
              </div>
            {/each}
          </div>
        </div>

        <!-- General Documents -->
        <div class="mb-6">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-lg font-semibold theme-text-primary">General Documents</h3>
            <div>
              <input
                type="file"
                bind:this={generalFileInput}
                accept=".pdf,application/pdf"
                class="hidden"
                on:change={handleGeneralUpload}
                id="general-file-input"
              />
              <Button
                variant="primary"
                size="sm"
                disabled={uploadingGeneral || isLoading}
                on:click={() => generalFileInput?.click()}
              >
                {#if uploadingGeneral}
                  <Upload class="w-4 h-4 mr-2 animate-pulse inline" />
                  Uploading...
                {:else}
                  <Upload class="w-4 h-4 mr-2 inline" />
                  Add General Document
                {/if}
              </Button>
            </div>
          </div>

          {#if generalDocuments.length > 0}
            <div class="space-y-2">
              {#each generalDocuments as doc}
                <div class="p-3 border theme-border rounded-lg flex items-center justify-between">
                  <div class="flex items-center gap-2">
                    <FileText class="w-4 h-4 theme-text-primary" />
                    <span class="theme-text-primary text-sm">{doc.document_name}</span>
                    <span class="text-xs theme-text-secondary">
                      ({formatDateTime(doc.submission_date)})
                    </span>
                  </div>
                  <div class="flex items-center gap-2">
                    <button
                      on:click={() => handleDownload(doc)}
                      class="p-1 hover:theme-bg-tertiary rounded transition-colors"
                      title="Download"
                    >
                      <Download class="w-4 h-4 theme-text-primary" />
                    </button>
                    <button
                      on:click={() => handleDeleteDocument(doc.id, true)}
                      class="p-1 hover:theme-bg-tertiary rounded transition-colors text-red-600"
                      title="Delete"
                      disabled={isLoading}
                    >
                      <Trash2 class="w-4 h-4" />
                    </button>
                  </div>
                </div>
              {/each}
            </div>
          {:else}
            <p class="text-sm theme-text-secondary italic">No general documents uploaded</p>
          {/if}
        </div>
      {/if}

      <!-- Footer -->
      <div class="flex justify-end pt-4 border-t theme-border">
        <Button
          variant="secondary"
          on:click={handleClose}
          disabled={isLoading}
        >
          Close
        </Button>
      </div>
    </div>
  </div>
{/if}

<!-- Document History Modal -->
<DocumentHistoryModal
  bind:showModal={showHistoryModal}
  stageCode={selectedStageForHistory}
  workOrderNo={workOrder?.wo_no || ''}
  {documentHistory}
  on:download={(e) => handleDownload(e.detail)}
  on:close={() => showHistoryModal = false}
/>

