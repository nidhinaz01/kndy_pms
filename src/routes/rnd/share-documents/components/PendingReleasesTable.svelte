<script lang="ts">
  import Button from '$lib/components/common/Button.svelte';
  import { formatDate } from '../utils/dateUtils';

  export let releases: any[] = [];
  export let onUploadDocuments: (release: any) => void;

  function getStagesStatus(release: any): { uploaded: number; total: number } {
    const uploaded = release.stages.filter((s: any) => s.hasDocument).length;
    const total = release.stages.length;
    return { uploaded, total };
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
            Stages Status
          </th>
          <th class="px-4 py-3 text-center font-medium theme-text-primary border theme-border">
            Actions
          </th>
        </tr>
      </thead>
      <tbody>
        {#each releases as release}
          {@const status = getStagesStatus(release)}
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
                {status.uploaded} / {status.total} stages uploaded
              </span>
              <div class="text-xs theme-text-secondary mt-1">
                {#each release.stages.slice(0, 3) as stage}
                  <span class="inline-block mr-2">
                    {stage.stage_code}: {stage.hasDocument ? '✅' : '❌'}
                  </span>
                {/each}
                {#if release.stages.length > 3}
                  <span class="theme-text-tertiary">+{release.stages.length - 3} more</span>
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

