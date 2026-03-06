<script lang="ts">
  export let pdfBlob: Blob | null = null;
  export let isLoading: boolean = false;

  let pdfUrl: string | null = null;

  $: if (pdfBlob) {
    // Create object URL for the PDF blob
    if (pdfUrl) {
      URL.revokeObjectURL(pdfUrl);
    }
    pdfUrl = URL.createObjectURL(pdfBlob);
  }

  // Cleanup on destroy
  import { onDestroy } from 'svelte';
  onDestroy(() => {
    if (pdfUrl) {
      URL.revokeObjectURL(pdfUrl);
    }
  });
</script>

<div class="w-full h-full theme-bg-primary border theme-border overflow-hidden" style="width: 100%; max-width: 100%; border-radius: 0;">
  {#if isLoading}
    <div class="flex items-center justify-center h-full" style="min-height: 600px;">
      <div class="text-center">
        <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
        <p class="theme-text-secondary">Generating PDF...</p>
      </div>
    </div>
  {:else if pdfUrl}
    <iframe
      src={pdfUrl}
      class="w-full h-full border-0"
      style="width: 100%; height: 100%; display: block;"
      title="Works Plan PDF"
    ></iframe>
  {:else}
    <div class="flex items-center justify-center h-full" style="min-height: 600px;">
      <p class="theme-text-secondary">No PDF available</p>
    </div>
  {/if}
</div>

