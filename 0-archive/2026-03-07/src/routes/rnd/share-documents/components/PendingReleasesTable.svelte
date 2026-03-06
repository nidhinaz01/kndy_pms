<script lang="ts">
  import Button from '$lib/components/common/Button.svelte';
  import { ALL_DOCUMENT_TYPES } from '../constants/documentTypes';
  import type { DocumentStatus } from '../services/documentUploadService';

  export let releases: any[] = [];
  export let onUploadDocuments: (release: any) => void;

  function getDocumentStatusSummary(release: any): { uploaded: number; notRequired: number; pending: number; total: number } {
    const statuses = release.documentStatuses || [];
    const uploaded = statuses.filter((s: DocumentStatus) => s.status === 'uploaded').length;
    const notRequired = statuses.filter((s: DocumentStatus) => s.status === 'not_required').length;
    const pending = statuses.filter((s: DocumentStatus) => s.status === 'pending').length;
    return { uploaded, notRequired, pending, total: ALL_DOCUMENT_TYPES.length };
  }
</script>

<div class="theme-bg-primary rounded-lg shadow-lg p-6 mb-6">
  <div class="flex items-center justify-between mb-6">
    <h3 class="text-lg font-semibold theme-text-primary">
      Pending Document Releases ({releases.length})
    </h3>
  </div>

  <div class="overflow-x-auto">
    <table class="w-full border-collapse theme-border">
      <thead>
        <tr class="theme-bg-secondary">
          <th class="px-4 py-3 text-left font-medium theme-text-primary border theme-border">
            Work Order
          </th>
          <th class="px-4 py-3 text-left font-medium theme-text-primary border theme-border">
            PWO Number
          </th>
          <th class="px-4 py-3 text-left font-medium theme-text-primary border theme-border">
            Model
          </th>
          <th class="px-4 py-3 text-left font-medium theme-text-primary border theme-border">
            Customer
          </th>
          <th class="px-4 py-3 text-left font-medium theme-text-primary border theme-border">
            Document Status
          </th>
          <th class="px-4 py-3 text-center font-medium theme-text-primary border theme-border">
            Actions
          </th>
        </tr>
      </thead>
      <tbody>
        {#each releases as release}
          {@const summary = getDocumentStatusSummary(release)}
          <tr class="hover:theme-bg-secondary transition-colors">
            <td class="px-4 py-3 font-medium theme-text-primary border theme-border">
              {release.wo_no}
            </td>
            <td class="px-4 py-3 theme-text-primary border theme-border">
              {release.pwo_no || 'N/A'}
            </td>
            <td class="px-4 py-3 theme-text-primary border theme-border">
              {release.wo_model}
            </td>
            <td class="px-4 py-3 theme-text-primary border theme-border">
              {release.customer_name || 'N/A'}
            </td>
            <td class="px-4 py-3 theme-text-primary border theme-border">
              <span class="text-sm">
                {summary.uploaded} uploaded, {summary.notRequired} not required, {summary.pending} pending
              </span>
              <div class="text-xs theme-text-secondary mt-1">
                {#each (release.documentStatuses || []).slice(0, 4) as status}
                  <span class="inline-block mr-2">
                    {status.document_type}: 
                    {#if status.status === 'uploaded'}✅
                    {:else if status.status === 'not_required'}➖
                    {:else}⏳
                    {/if}
                  </span>
                {/each}
                {#if (release.documentStatuses || []).length > 4}
                  <span class="theme-text-tertiary">+{(release.documentStatuses || []).length - 4} more</span>
                {/if}
              </div>
            </td>
            <td class="px-4 py-3 text-center border theme-border">
              <Button
                variant="primary"
                size="sm"
                on:click={() => onUploadDocuments(release)}
              >
                📄 Upload Documents
              </Button>
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
</div>
