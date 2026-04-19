<script lang="ts">
  import { onDestroy, onMount } from 'svelte';

  export let pdfBlob: Blob | null = null;
  export let isLoading: boolean = false;
  /** Suggested filename for Download link (mobile); sanitized by caller */
  export let downloadFileName: string = 'document.pdf';

  let pdfUrl: string | null = null;
  /** Use link-based open instead of iframe on narrow screens */
  let useExternalOpen = false;

  $: if (pdfBlob) {
    if (pdfUrl) {
      URL.revokeObjectURL(pdfUrl);
    }
    pdfUrl = URL.createObjectURL(pdfBlob);
  }

  onMount(() => {
    const mq = window.matchMedia('(max-width: 1023px)');
    const sync = () => {
      useExternalOpen = mq.matches;
    };
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  });

  onDestroy(() => {
    if (pdfUrl) {
      URL.revokeObjectURL(pdfUrl);
    }
  });
</script>

<div
  class="w-full h-full theme-bg-primary border theme-border overflow-hidden"
  style="width: 100%; max-width: 100%; border-radius: 0;"
>
  {#if isLoading}
    <div class="flex items-center justify-center h-full" style="min-height: min(600px, 70vh);">
      <div class="text-center">
        <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
        <p class="theme-text-secondary">Generating PDF...</p>
      </div>
    </div>
  {:else if pdfUrl}
    {#if useExternalOpen}
      <div
        class="flex flex-col items-center justify-center gap-4 px-4 py-8 text-center"
        style="min-height: min(560px, 65vh);"
      >
        <p class="theme-text-primary font-medium">PDF is ready</p>
        <p class="theme-text-secondary text-sm max-w-sm">
          Embedded preview is not reliable on this device. Open the PDF in your browser or download it.
        </p>
        <div class="flex flex-col sm:flex-row gap-3 w-full max-w-xs">
          <a
            href={pdfUrl}
            target="_blank"
            rel="noopener noreferrer"
            class="inline-flex justify-center items-center px-4 py-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm shadow-sm transition-colors"
          >
            Open PDF
          </a>
          <a
            href={pdfUrl}
            download={downloadFileName}
            class="inline-flex justify-center items-center px-4 py-3 rounded-lg theme-bg-secondary border theme-border theme-text-primary font-medium text-sm hover:opacity-90 transition-opacity"
          >
            Download
          </a>
        </div>
      </div>
    {:else}
      <iframe
        src={pdfUrl}
        class="w-full h-full border-0"
        style="width: 100%; height: 100%; min-height: min(600px, 75vh); display: block;"
        title="PDF preview"
      ></iframe>
    {/if}
  {:else}
    <div class="flex items-center justify-center h-full" style="min-height: min(600px, 70vh);">
      <p class="theme-text-secondary">No PDF available</p>
    </div>
  {/if}
</div>
