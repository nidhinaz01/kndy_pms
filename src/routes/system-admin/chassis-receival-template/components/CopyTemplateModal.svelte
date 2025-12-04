<script lang="ts">
  import Button from '$lib/components/common/Button.svelte';

  export let showModal = false;
  export let copyForm: {
    template_name: string;
    template_description: string;
  };
  export let onSave: () => void;
  export let onCancel: () => void;
</script>

{#if showModal}
  <div class="fixed inset-0 z-50 flex items-center justify-center">
    <div class="fixed inset-0 bg-black bg-opacity-50" 
         role="button" 
         tabindex="0"
         on:click={onCancel}
         on:keydown={(e) => (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') && onCancel()}></div>
    <div class="relative theme-bg-primary rounded-lg shadow-xl p-6 w-full max-w-md mx-4">
      <h2 class="text-xl font-bold theme-text-primary mb-4">Copy Template</h2>
      
      <form on:submit|preventDefault={onSave}>
        <div class="mb-4">
          <label for="copy-template-name" class="block text-sm font-medium theme-text-primary mb-2">New Template Name</label>
          <input
            id="copy-template-name"
            type="text"
            bind:value={copyForm.template_name}
            required
            class="w-full px-3 py-2 border theme-border rounded-lg theme-bg-primary theme-text-primary focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        
        <div class="mb-6">
          <label for="copy-template-description" class="block text-sm font-medium theme-text-primary mb-2">Description</label>
          <textarea
            id="copy-template-description"
            bind:value={copyForm.template_description}
            rows="3"
            class="w-full px-3 py-2 border theme-border rounded-lg theme-bg-primary theme-text-primary focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          ></textarea>
        </div>
        
        <div class="flex justify-end gap-2">
          <Button variant="secondary" size="md" on:click={onCancel}>
            Cancel
          </Button>
          <Button variant="primary" size="md" on:click={onSave}>
            Copy Template
          </Button>
        </div>
      </form>
    </div>
  </div>
{/if}

