<script lang="ts">
  import Button from '$lib/components/common/Button.svelte';

  export let showModal = false;
  export let woNumbers: string[] = [];
  export let onConfirm: () => void;
  export let onCancel: () => void;
</script>

{#if showModal}
  <div class="fixed inset-0 z-50 flex items-center justify-center">
    <div
      class="fixed inset-0 bg-black bg-opacity-50"
      role="button"
      tabindex="0"
      on:click={onCancel}
      on:keydown={(e) => (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') && onCancel()}
    ></div>
    <div class="relative theme-bg-primary rounded-lg shadow-xl p-6 w-full max-w-md mx-4">
      <h2 class="text-xl font-bold theme-text-primary mb-4">Confirm archive</h2>
      <div class="space-y-3 mb-6 theme-text-primary">
        <p class="font-medium text-amber-600 dark:text-amber-400">
          Archiving is irreversible. Data will be moved to the archive schema and removed from the main database.
        </p>
        <p class="text-sm theme-text-secondary">
          This process may take a while. You will see status updates until it completes.
        </p>
        <p class="text-sm">
          Work order(s) to archive:
        </p>
        <ul class="list-disc list-inside text-sm theme-text-secondary">
          {#each woNumbers as woNo}
            <li>{woNo}</li>
          {/each}
        </ul>
      </div>
      <div class="flex justify-end gap-2">
        <Button variant="secondary" size="md" on:click={onCancel}>Cancel</Button>
        <Button variant="primary" size="md" on:click={onConfirm}>
          Confirm
        </Button>
      </div>
    </div>
  </div>
{/if}
