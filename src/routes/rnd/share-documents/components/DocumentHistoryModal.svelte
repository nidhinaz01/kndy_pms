<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import Button from '$lib/components/common/Button.svelte';
  import { X, Download, FileText } from 'lucide-svelte';
  import { formatDateTime } from '../utils/dateUtils';
  import type { DocumentSubmission } from '../services/documentUploadService';
  import { theme } from '$lib/stores/theme';

  export let showModal = false;
  export let stageCode = '';
  export let workOrderNo = '';
  export let documentHistory: DocumentSubmission[] = [];

  const dispatch = createEventDispatcher();

  // Reactive theme-based classes
  $: bgPrimary = $theme === 'dark' ? 'bg-slate-800' : 'bg-white';
  $: textPrimary = $theme === 'dark' ? 'text-slate-50' : 'text-slate-800';
  $: textSecondary = $theme === 'dark' ? 'text-slate-300' : 'text-slate-500';
  $: borderColor = $theme === 'dark' ? 'border-slate-600' : 'border-slate-200';
  $: bgSecondary = $theme === 'dark' ? 'bg-slate-700' : 'bg-slate-50';
  $: hoverBgSecondary = $theme === 'dark' ? 'hover:bg-slate-700' : 'hover:bg-slate-50';

  function handleDownload(document: DocumentSubmission) {
    dispatch('download', document);
  }

  function handleClose() {
    showModal = false;
    dispatch('close');
  }
</script>

{#if showModal}
  <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
    <div class="{bgPrimary} rounded-lg shadow-xl p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto">
      <!-- Header -->
      <div class="flex items-center justify-between mb-6">
        <div>
          <h2 class="text-xl font-semibold {textPrimary}">
            Document History
          </h2>
          <p class="text-sm {textSecondary} mt-1">
            {workOrderNo} - {stageCode}
          </p>
        </div>
        <button
          on:click={handleClose}
          class="p-2 {hoverBgSecondary} rounded-lg transition-colors"
          aria-label="Close modal"
        >
          <X class="w-5 h-5 {textPrimary}" />
        </button>
      </div>

      <!-- History List -->
      {#if documentHistory.length > 0}
        <div class="space-y-3">
          {#each documentHistory as doc, index}
            {@const currentBg = doc.is_current ? ($theme === 'dark' ? 'bg-blue-900/20' : 'bg-blue-50') : ''}
            {@const currentBorder = doc.is_current ? ($theme === 'dark' ? 'border-blue-700' : 'border-blue-300') : borderColor}
            <div class="p-4 border {currentBorder} rounded-lg {currentBg}">
              <div class="flex items-start justify-between">
                <div class="flex-1">
                  <div class="flex items-center gap-2 mb-2">
                    <FileText class="w-4 h-4 {textPrimary}" />
                    <span class="font-medium {textPrimary}">
                      v{doc.revision_number} - {doc.document_name}
                    </span>
                    {#if doc.is_current}
                      <span class="px-2 py-1 {$theme === 'dark' ? 'bg-green-900 text-green-200' : 'bg-green-100 text-green-800'} rounded-full text-xs">
                        Current
                      </span>
                    {:else if doc.revised_date}
                      <span class="px-2 py-1 {$theme === 'dark' ? 'bg-gray-900 text-gray-200' : 'bg-gray-100 text-gray-800'} rounded-full text-xs">
                        Revised
                      </span>
                    {/if}
                  </div>
                  
                  <div class="text-sm {textSecondary} space-y-1">
                    <p>
                      <span class="font-medium">Uploaded:</span> {formatDateTime(doc.submission_date)}
                    </p>
                    {#if doc.revised_date}
                      <p>
                        <span class="font-medium">Revised:</span> {formatDateTime(doc.revised_date)}
                      </p>
                    {/if}
                    <p>
                      <span class="font-medium">Size:</span> {(doc.file_size / 1024).toFixed(2)} KB
                    </p>
                    <p>
                      <span class="font-medium">Uploaded by:</span> {doc.uploaded_by}
                    </p>
                  </div>
                </div>
                
                <button
                  on:click={() => handleDownload(doc)}
                  class="ml-4 p-2 {hoverBgSecondary} rounded-lg transition-colors"
                  title="Download"
                >
                  <Download class="w-5 h-5 {textPrimary}" />
                </button>
              </div>
            </div>
          {/each}
        </div>
      {:else}
        <div class="text-center py-8">
          <p class="{textSecondary}">No document history available</p>
        </div>
      {/if}

      <!-- Footer -->
      <div class="flex justify-end pt-4 mt-6 border-t {borderColor}">
        <Button
          variant="secondary"
          on:click={handleClose}
        >
          Close
        </Button>
      </div>
    </div>
  </div>
{/if}

