<script lang="ts">
  import { onMount, createEventDispatcher, tick } from 'svelte';
  import Button from '$lib/components/common/Button.svelte';
  import { X, Upload, FileText, History, Download, Trash2, XCircle, CheckCircle, Clock } from 'lucide-svelte';
  import { formatDate, formatDateTime } from '../utils/dateUtils';
  import { 
    uploadDocument,
    deleteDocument,
    getDocumentHistory,
    getDocumentDownloadUrl,
    getDocumentStatuses,
    markAsNotRequired,
    removeNotRequiredStatus,
    type DocumentSubmission,
    type DocumentStatus
  } from '../services/documentUploadService';
  import { ALL_DOCUMENT_TYPES, isSingleFileType, isMultiFileType } from '../constants/documentTypes';
  import DocumentHistoryModal from './DocumentHistoryModal.svelte';

  export let showModal = false;
  export let workOrder: any = null; // Work order with sales_order_id

  let isLoading = false;
  let error = '';
  let successMessage = '';
  let hasLoaded = false;
  
  // Document statuses
  let documentStatuses: DocumentStatus[] = [];
  
  // Upload states
  let uploadingType: string | null = null;
  let fileInputs: Record<string, HTMLInputElement> = {};
  let multiFileInputs: Record<string, HTMLInputElement> = {};
  
  // Not Required modal state
  let showNotRequiredModal = false;
  let selectedTypeForNotRequired = '';
  let notRequiredComments = '';
  let savingNotRequired = false;
  
  // History modal
  let showHistoryModal = false;
  let selectedTypeForHistory = '';
  let documentHistory: DocumentSubmission[] = [];

  $: if (showModal && workOrder && !hasLoaded) {
    hasLoaded = true;
    loadDocuments();
  }

  $: if (!showModal) {
    hasLoaded = false;
    error = '';
    successMessage = '';
    documentStatuses = [];
    notRequiredComments = '';
    selectedTypeForNotRequired = '';
  }

  async function loadDocuments() {
    if (!workOrder) return;
    
    try {
      isLoading = true;
      error = '';
      const statuses = await getDocumentStatuses(workOrder.sales_order_id);
      // Force reactivity by clearing first, then assigning new array
      // This ensures Svelte detects the change
      documentStatuses = [];
      await tick();
      documentStatuses = statuses;
      await tick();
      console.log('Loaded document statuses:', documentStatuses);
    } catch (err) {
      error = `Failed to load documents: ${(err as Error).message}`;
      console.error('Error loading documents:', err);
    } finally {
      isLoading = false;
    }
  }

  // Create a reactive map for quick lookups - this will update when documentStatuses changes
  $: statusMap = new Map(documentStatuses.map(s => [s.document_type, s]));
  
  // Create a reactive object that maps document types to their statuses
  // This ensures the template re-renders when documentStatuses changes
  $: statusesByType = Object.fromEntries(
    documentStatuses.map(s => [s.document_type, s])
  );
  
  // Create a reactive key that changes when statuses change (for #key block)
  $: statusesKey = documentStatuses.map(s => `${s.document_type}:${s.status}:${s.document_id || ''}`).join('|');

  async function handleUpload(documentType: string, isMultiFile: boolean = false) {
    const fileInput = isMultiFile ? multiFileInputs[documentType] : fileInputs[documentType];
    if (!fileInput || !fileInput.files || fileInput.files.length === 0) return;
    
    const files = Array.from(fileInput.files);
    if (files.length === 0) return;
    
    // For single-file types, only take first file
    const filesToUpload = isMultiFile ? files : [files[0]];
    
    try {
      uploadingType = documentType;
      error = '';
      successMessage = '';
      
      const username = typeof window !== 'undefined' ? localStorage.getItem('username') : null;
      if (!username) {
        throw new Error('User not logged in');
      }
      
      // Upload all files
      for (const file of filesToUpload) {
        await uploadDocument(workOrder.sales_order_id, documentType, file, username);
      }
      
      // Reset input
      fileInput.value = '';
      
      // Small delay to ensure database transaction is fully committed
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Reload documents - this will update the UI
      await loadDocuments();
      
      // Wait for Svelte to process the DOM updates
      await tick();
      
      successMessage = `Document${filesToUpload.length > 1 ? 's' : ''} uploaded successfully for ${documentType}`;
      
      // Dispatch event to parent
      dispatch('document-uploaded');
    } catch (err) {
      error = `Failed to upload document: ${(err as Error).message}`;
      console.error('Error uploading document:', err);
    } finally {
      uploadingType = null;
    }
  }

  async function handleDeleteDocument(documentId: number) {
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
      
      // Small delay to ensure database transaction is committed
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Reload documents
      await loadDocuments();
      await tick();
      
      successMessage = 'Document deleted successfully';
      
      // Dispatch event to parent
      dispatch('document-deleted');
    } catch (err) {
      error = `Failed to delete document: ${(err as Error).message}`;
      console.error('Error deleting document:', err);
    } finally {
      isLoading = false;
    }
  }

  function handleMarkNotRequired(documentType: string) {
    selectedTypeForNotRequired = documentType;
    notRequiredComments = '';
    showNotRequiredModal = true;
  }

  async function saveNotRequired() {
    if (!notRequiredComments.trim()) {
      error = 'Comments are required when marking document as not required';
      return;
    }
    
    try {
      savingNotRequired = true;
      error = '';
      successMessage = '';
      
      const username = typeof window !== 'undefined' ? localStorage.getItem('username') : null;
      if (!username) {
        throw new Error('User not logged in');
      }
      
      await markAsNotRequired(
        workOrder.sales_order_id,
        selectedTypeForNotRequired,
        notRequiredComments,
        username
      );
      
      // Small delay to ensure database transaction is committed
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Reload documents
      await loadDocuments();
      await tick();
      
      successMessage = `${selectedTypeForNotRequired} marked as not required`;
      showNotRequiredModal = false;
      notRequiredComments = '';
      selectedTypeForNotRequired = '';
      
      // Dispatch event to parent
      dispatch('document-uploaded');
    } catch (err) {
      error = `Failed to mark as not required: ${(err as Error).message}`;
      console.error('Error marking as not required:', err);
    } finally {
      savingNotRequired = false;
    }
  }

  async function handleRemoveNotRequired(documentType: string) {
    if (!confirm('Remove "Not Required" status? You will be able to upload documents for this type.')) {
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
      
      await removeNotRequiredStatus(workOrder.sales_order_id, documentType, username);
      
      // Small delay to ensure database transaction is committed
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Reload documents
      await loadDocuments();
      await tick();
      
      successMessage = `"Not Required" status removed for ${documentType}`;
      
      // Dispatch event to parent
      dispatch('document-uploaded');
    } catch (err) {
      error = `Failed to remove not required status: ${(err as Error).message}`;
      console.error('Error removing not required status:', err);
    } finally {
      isLoading = false;
    }
  }

  async function handleViewHistory(documentType: string) {
    try {
      isLoading = true;
      documentHistory = await getDocumentHistory(workOrder.sales_order_id, documentType);
      selectedTypeForHistory = documentType;
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
    documentStatuses = [];
    notRequiredComments = '';
    selectedTypeForNotRequired = '';
    dispatch('close');
  }

  const dispatch = createEventDispatcher();
</script>

{#if showModal}
  <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
    <div class="theme-bg-primary rounded-lg shadow-xl p-6 w-full max-w-5xl my-8 max-h-[90vh] overflow-y-auto">
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

      {#if isLoading && documentStatuses.length === 0}
        <div class="flex items-center justify-center py-8">
          <div class="animate-spin rounded-full h-8 w-8 border-b-2 theme-accent"></div>
        </div>
      {:else}
        <!-- Document Types -->
        <!-- Use key block to force re-render when documentStatuses changes -->
        {#key statusesKey}
          <div class="space-y-4">
            {#each ALL_DOCUMENT_TYPES as documentType}
              {@const isSingle = isSingleFileType(documentType)}
              {@const isMulti = isMultiFileType(documentType)}
              
              <div class="p-4 border theme-border rounded-lg">
                <div class="flex items-center justify-between mb-3">
                  <div class="flex items-center gap-3">
                    <h4 class="font-medium theme-text-primary text-lg">{documentType}</h4>
                    <!-- Access status directly - this is reactive -->
                    {#if statusesByType[documentType]?.status === 'uploaded'}
                    <span class="px-2 py-1 bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 rounded-full text-xs flex items-center gap-1">
                      <CheckCircle class="w-3 h-3" />
                      Uploaded
                    </span>
                  {:else if statusesByType[documentType]?.status === 'not_required'}
                    <span class="px-2 py-1 bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200 rounded-full text-xs flex items-center gap-1">
                      <XCircle class="w-3 h-3" />
                      Not Required
                    </span>
                  {:else}
                    <span class="px-2 py-1 bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200 rounded-full text-xs flex items-center gap-1">
                      <Clock class="w-3 h-3" />
                      Pending
                    </span>
                  {/if}
                  {#if isSingle}
                    <span class="text-xs theme-text-secondary">(Single file)</span>
                  {:else}
                    <span class="text-xs theme-text-secondary">(Multiple files)</span>
                  {/if}
                </div>
              </div>

              {#if statusesByType[documentType]?.status === 'uploaded' && statusesByType[documentType]?.documents && statusesByType[documentType].documents.length > 0}
                {@const status = statusesByType[documentType]}
                <!-- Uploaded Documents -->
                {#if isSingle}
                  <!-- Single file - show current document -->
                  {@const doc = status.documents[0]}
                  {#if doc}
                    <div class="mb-3 p-3 theme-bg-secondary rounded">
                      <div class="flex items-center justify-between">
                        <div class="flex items-center gap-2">
                          <FileText class="w-4 h-4 theme-text-primary" />
                          <span class="theme-text-primary text-sm">{doc.document_name}</span>
                          {#if doc.revision_number > 1}
                            <span class="text-xs theme-text-secondary">(v{doc.revision_number})</span>
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
                            on:click={() => handleViewHistory(documentType)}
                            class="p-1 hover:theme-bg-tertiary rounded transition-colors"
                            title="View History"
                          >
                            <History class="w-4 h-4 theme-text-primary" />
                          </button>
                          <button
                            on:click={() => handleDeleteDocument(doc.id)}
                            class="p-1 hover:theme-bg-tertiary rounded transition-colors text-red-600"
                            title="Delete"
                            disabled={isLoading}
                          >
                            <Trash2 class="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      <p class="text-xs theme-text-secondary mt-1">
                        Uploaded: {formatDateTime(doc.submission_date)} by {doc.uploaded_by}
                      </p>
                    </div>
                  {/if}
                {:else if isMulti}
                  <!-- Multi-file - show all documents -->
                  <div class="mb-3 space-y-2">
                    {#each status.documents as doc}
                      <div class="p-3 theme-bg-secondary rounded flex items-center justify-between">
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
                            on:click={() => handleDeleteDocument(doc.id)}
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
                {/if}

                <!-- Replace/Add More Button -->
                <div class="flex items-center gap-2">
                  {#if isSingle}
                    <input
                      type="file"
                      bind:this={fileInputs[documentType]}
                      accept=".pdf,application/pdf"
                      class="hidden"
                      on:change={() => handleUpload(documentType, false)}
                      id="file-{documentType}"
                    />
                  {:else}
                    <input
                      type="file"
                      bind:this={multiFileInputs[documentType]}
                      accept=".pdf,application/pdf"
                      class="hidden"
                      on:change={() => handleUpload(documentType, true)}
                      multiple={true}
                      id="file-multi-{documentType}"
                    />
                  {/if}
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={uploadingType === documentType || isLoading}
                    on:click={() => {
                      const input = isSingle ? fileInputs[documentType] : multiFileInputs[documentType];
                      input?.click();
                    }}
                  >
                    {#if uploadingType === documentType}
                      <Upload class="w-4 h-4 mr-2 animate-pulse inline" />
                      Uploading...
                    {:else if isSingle}
                      <Upload class="w-4 h-4 mr-2 inline" />
                      Replace Document
                    {:else}
                      <Upload class="w-4 h-4 mr-2 inline" />
                      Add More Documents
                    {/if}
                  </Button>
                </div>
              {:else if statusesByType[documentType]?.status === 'not_required'}
                {@const status = statusesByType[documentType]}
                <!-- Not Required -->
                <div class="mb-3 p-3 theme-bg-secondary rounded">
                  <p class="text-sm theme-text-primary mb-2">
                    <strong>Comments:</strong> {status.not_required_comments}
                  </p>
                  <p class="text-xs theme-text-secondary">
                    Marked by {status.not_required_marked_by} on {formatDateTime(status.not_required_marked_dt || '')}
                  </p>
                </div>
                <div class="flex items-center gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={isLoading}
                    on:click={() => handleRemoveNotRequired(documentType)}
                  >
                    Remove "Not Required"
                  </Button>
                </div>
              {:else}
                <!-- Pending -->
                <div class="flex items-center gap-2">
                  {#if isSingle}
                    <input
                      type="file"
                      bind:this={fileInputs[documentType]}
                      accept=".pdf,application/pdf"
                      class="hidden"
                      on:change={() => handleUpload(documentType, false)}
                      id="file-{documentType}"
                    />
                  {:else}
                    <input
                      type="file"
                      bind:this={multiFileInputs[documentType]}
                      accept=".pdf,application/pdf"
                      class="hidden"
                      on:change={() => handleUpload(documentType, true)}
                      multiple={true}
                      id="file-multi-{documentType}"
                    />
                  {/if}
                  <Button
                    variant="primary"
                    size="sm"
                    disabled={uploadingType === documentType || isLoading}
                    on:click={() => {
                      const input = isSingle ? fileInputs[documentType] : multiFileInputs[documentType];
                      input?.click();
                    }}
                  >
                    {#if uploadingType === documentType}
                      <Upload class="w-4 h-4 mr-2 animate-pulse inline" />
                      Uploading...
                    {:else}
                      <Upload class="w-4 h-4 mr-2 inline" />
                      Upload Document{isMulti ? 's' : ''}
                    {/if}
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={isLoading}
                    on:click={() => handleMarkNotRequired(documentType)}
                  >
                    Mark as Not Required
                  </Button>
                </div>
              {/if}
            </div>
          {/each}
          </div>
        {/key}
      {/if}

      <!-- Footer -->
      <div class="flex justify-end pt-4 border-t theme-border mt-6">
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

<!-- Not Required Modal -->
{#if showNotRequiredModal}
  <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
    <div class="theme-bg-primary rounded-lg shadow-xl p-6 w-full max-w-md">
      <h3 class="text-xl font-semibold theme-text-primary mb-4">
        Mark as Not Required
      </h3>
      <p class="text-sm theme-text-secondary mb-4">
        Document Type: <strong>{selectedTypeForNotRequired}</strong>
      </p>
      <div class="mb-4">
        <label class="block text-sm font-medium theme-text-primary mb-2">
          Comments <span class="text-red-500">*</span>
        </label>
        <textarea
          bind:value={notRequiredComments}
          placeholder="Please provide a reason why this document is not required..."
          class="w-full px-3 py-2 theme-bg-secondary theme-text-primary theme-border border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          rows="4"
        ></textarea>
      </div>
      <div class="flex justify-end gap-2">
        <Button
          variant="secondary"
          on:click={() => {
            showNotRequiredModal = false;
            notRequiredComments = '';
            selectedTypeForNotRequired = '';
          }}
          disabled={savingNotRequired}
        >
          Cancel
        </Button>
        <Button
          variant="primary"
          on:click={saveNotRequired}
          disabled={savingNotRequired || !notRequiredComments.trim()}
        >
          {savingNotRequired ? 'Saving...' : 'Mark as Not Required'}
        </Button>
      </div>
    </div>
  </div>
{/if}

<!-- Document History Modal -->
{#if showHistoryModal}
  <DocumentHistoryModal
    bind:showModal={showHistoryModal}
    documentType={selectedTypeForHistory}
    workOrderNo={workOrder?.wo_no || ''}
    {documentHistory}
    on:download={(e) => handleDownload(e.detail)}
    on:close={() => showHistoryModal = false}
  />
{/if}













