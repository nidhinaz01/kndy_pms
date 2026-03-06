<script lang="ts">
  import { FileText, Download } from 'lucide-svelte';
  import { formatDateTime } from '../../share-documents/utils/dateUtils';
  import type { DocumentSubmission } from '../../share-documents/services/documentUploadService';
  import { theme } from '$lib/stores/theme';

  export let document: DocumentSubmission;
  export let onDownload: (doc: DocumentSubmission) => void;
  
  // Store document in a local variable to avoid conflicts with global 'document' object
  $: docData = document;
</script>

<div class="p-4 border theme-border rounded-lg theme-bg-secondary">
  <div class="flex items-start justify-between">
    <div class="flex-1">
      <div class="flex items-center gap-2 mb-2">
        <FileText class="w-5 h-5 theme-text-primary" />
        <span class="font-medium theme-text-primary">
          {docData.document_name}
        </span>
        {#if docData.is_current}
          <span class="px-2 py-1 {$theme === 'dark' ? 'bg-green-900 text-green-200' : 'bg-green-100 text-green-800'} rounded-full text-xs">
            Current
          </span>
        {/if}
      </div>
      
      <div class="text-sm theme-text-secondary space-y-1">
        <p>
          <span class="font-medium">Uploaded:</span> {formatDateTime(docData.submission_date)}
        </p>
        <p>
          <span class="font-medium">Revision:</span> {docData.revision_number != null ? `v${docData.revision_number}` : 'N/A'}
        </p>
        <p>
          <span class="font-medium">Size:</span> {docData.file_size != null ? `${(docData.file_size / 1024).toFixed(2)} KB` : 'N/A'}
        </p>
        <p>
          <span class="font-medium">Uploaded by:</span> {docData.uploaded_by || 'N/A'}
        </p>
      </div>
    </div>
    
    <button
      on:click={() => onDownload(docData)}
      class="ml-4 p-2 hover:theme-bg-secondary rounded-lg transition-colors"
      title="Download"
    >
      <Download class="w-5 h-5 theme-text-primary" />
    </button>
  </div>
</div>

