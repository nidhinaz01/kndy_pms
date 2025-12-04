<script lang="ts">
  import { History } from 'lucide-svelte';
  import type { WorkOrderDocumentGroup, DocumentSubmission } from '../../share-documents/services/documentUploadService';
  import DocumentItem from './DocumentItem.svelte';

  export let workOrderGroup: WorkOrderDocumentGroup;
  export let onDownload: (doc: DocumentSubmission) => void;
  export let onViewHistory: (group: WorkOrderDocumentGroup) => void;
</script>

<div class="theme-bg-primary rounded-lg shadow-lg p-6 border theme-border">
  <!-- Work Order Header -->
  <div class="mb-4 pb-4 border-b theme-border">
    <div class="flex items-center justify-between">
      <div>
        <h3 class="text-xl font-semibold theme-text-primary mb-1">
          {workOrderGroup.wo_no}
        </h3>
        <div class="flex flex-wrap gap-4 text-sm theme-text-secondary">
          {#if workOrderGroup.pwo_no}
            <span><span class="font-medium">PWO:</span> {workOrderGroup.pwo_no}</span>
          {/if}
          <span><span class="font-medium">Model:</span> {workOrderGroup.wo_model}</span>
          {#if workOrderGroup.customer_name}
            <span><span class="font-medium">Customer:</span> {workOrderGroup.customer_name}</span>
          {/if}
        </div>
      </div>
      <button
        on:click={() => onViewHistory(workOrderGroup)}
        class="px-4 py-2 theme-bg-secondary theme-text-primary rounded-lg hover:theme-bg-secondary transition-colors flex items-center gap-2"
      >
        <History class="w-4 h-4" />
        View History
      </button>
    </div>
  </div>

  <!-- Documents List -->
  <div class="space-y-3">
    {#each workOrderGroup.documents as doc}
      <DocumentItem document={doc} {onDownload} />
    {/each}
  </div>
</div>

