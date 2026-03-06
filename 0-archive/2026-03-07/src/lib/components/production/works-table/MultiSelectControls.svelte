<script lang="ts">
  import Button from '$lib/components/common/Button.svelte';
  import { Trash2 } from 'lucide-svelte';

  export let selectedCount: number = 0;
  export let removableCount: number = 0;
  export let onRemoveSelected: () => void = () => {};
  export let onClearSelection: () => void = () => {};
</script>

<div class="px-4 py-3 border-b theme-border bg-blue-50 dark:bg-blue-900/20">
  <div class="flex items-center justify-between">
    <div class="text-sm theme-text-primary">
      <span class="font-medium">{selectedCount}</span> work(s) selected
      {#if removableCount < selectedCount}
        <span class="text-xs theme-text-secondary ml-2">
          ({selectedCount - removableCount} cannot be removed - already planned)
        </span>
      {/if}
    </div>
    <div class="flex gap-2">
      {#if removableCount > 0}
        <Button
          variant="danger"
          size="sm"
          on:click={onRemoveSelected}
        >
          <Trash2 class="w-4 h-4 mr-1" />
          Remove Selected ({removableCount})
        </Button>
      {/if}
      <Button
        variant="secondary"
        size="sm"
        on:click={onClearSelection}
      >
        Clear Selection
      </Button>
    </div>
  </div>
</div>

