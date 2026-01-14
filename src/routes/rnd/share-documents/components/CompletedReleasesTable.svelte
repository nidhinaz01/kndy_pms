<script lang="ts">
  import Button from '$lib/components/common/Button.svelte';
  import { formatDate } from '../utils/dateUtils';
  import type { DocumentStatus } from '../services/documentUploadService';

  export let releases: any[] = [];
  export let onViewDocuments: (release: any) => void;

  function getEarliestDate(release: any): string | null {
    const dates = (release.documentStatuses || [])
      .filter((s: DocumentStatus) => s.status === 'uploaded' && s.submission_date)
      .map((s: DocumentStatus) => new Date(s.submission_date!))
      .sort((a: Date, b: Date) => a.getTime() - b.getTime());
    return dates.length > 0 ? dates[0].toISOString() : null;
  }

  function getLatestDate(release: any): string | null {
    const dates = (release.documentStatuses || [])
      .filter((s: DocumentStatus) => s.status === 'uploaded' && s.submission_date)
      .map((s: DocumentStatus) => new Date(s.submission_date!))
      .sort((a: Date, b: Date) => b.getTime() - a.getTime());
    return dates.length > 0 ? dates[0].toISOString() : null;
  }

  function getCompletedCount(release: any): number {
    return (release.documentStatuses || []).filter(
      (s: DocumentStatus) => s.status === 'uploaded' || s.status === 'not_required'
    ).length;
  }
</script>

<div class="theme-bg-primary rounded-lg shadow-lg p-6 mb-6">
  <div class="flex items-center justify-between mb-6">
    <h3 class="text-lg font-semibold theme-text-primary">
      Completed Document Releases ({releases.length})
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
            Documents
          </th>
          <th class="px-4 py-3 text-left font-medium theme-text-primary border theme-border">
            Submission Dates
          </th>
          <th class="px-4 py-3 text-center font-medium theme-text-primary border theme-border">
            Actions
          </th>
        </tr>
      </thead>
      <tbody>
        {#each releases as release}
          {@const earliestDate = getEarliestDate(release)}
          {@const latestDate = getLatestDate(release)}
          {@const completedCount = getCompletedCount(release)}
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
                {completedCount} / {release.documentStatuses?.length || 0} completed
              </span>
              <div class="text-xs theme-text-secondary mt-1">
                {#each (release.documentStatuses || []).slice(0, 3) as status}
                  <span class="inline-block mr-2">
                    {status.document_type}
                    {#if status.status === 'uploaded'}✅
                    {:else if status.status === 'not_required'}➖
                    {/if}
                  </span>
                {/each}
                {#if (release.documentStatuses || []).length > 3}
                  <span class="theme-text-tertiary">+{(release.documentStatuses || []).length - 3} more</span>
                {/if}
              </div>
            </td>
            <td class="px-4 py-3 theme-text-primary border theme-border">
              {#if earliestDate && latestDate}
                <div class="text-sm">
                  <div>First: {formatDate(earliestDate)}</div>
                  {#if earliestDate !== latestDate}
                    <div class="text-xs theme-text-secondary">Last: {formatDate(latestDate)}</div>
                  {/if}
                </div>
              {:else}
                <span class="text-gray-500 text-sm">N/A</span>
              {/if}
            </td>
            <td class="px-4 py-3 text-center border theme-border">
              <Button
                variant="primary"
                size="sm"
                on:click={() => onViewDocuments(release)}
              >
                📄 View Documents
              </Button>
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
</div>
