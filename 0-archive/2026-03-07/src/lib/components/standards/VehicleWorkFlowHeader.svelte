<script lang="ts">
  import Button from '$lib/components/common/Button.svelte';
  export let onAddItem: () => void;
  export let onImportClick: () => void;
</script>

<div class="flex items-center justify-end gap-4 py-4 px-6">
  <Button variant="secondary" size="md" on:click={onImportClick}>
    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
    </svg>
    Import
  </Button>
  <Button variant="primary" size="md" on:click={onAddItem}>
    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
    </svg>
    Add Work Flow
  </Button>
</div> 