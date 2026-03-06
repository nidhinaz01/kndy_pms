<script lang="ts">
  import Button from '$lib/components/common/Button.svelte';

  export let showModal = false;
  export let fieldForm: {
    field_name: string;
    field_label: string;
    field_type: string;
    is_required: boolean;
    field_order: number;
    validation_rules: any;
    dropdown_options: { options: string[] };
  };
  export let fieldTypes: Array<{ value: string; label: string }>;
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
    <div class="relative theme-bg-primary rounded-lg shadow-xl p-6 w-full max-w-lg mx-4">
      <h2 class="text-xl font-bold theme-text-primary mb-4">Add Field to Template</h2>
      
      <form on:submit|preventDefault={onSave}>
        <div class="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label for="field-name" class="block text-sm font-medium theme-text-primary mb-2">Field Name</label>
            <input
              id="field-name"
              type="text"
              bind:value={fieldForm.field_name}
              required
              class="w-full px-3 py-2 border theme-border rounded-lg theme-bg-primary theme-text-primary focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          
          <div>
            <label for="field-label" class="block text-sm font-medium theme-text-primary mb-2">Field Label</label>
            <input
              id="field-label"
              type="text"
              bind:value={fieldForm.field_label}
              required
              class="w-full px-3 py-2 border theme-border rounded-lg theme-bg-primary theme-text-primary focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>
        
        <div class="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label for="field-type" class="block text-sm font-medium theme-text-primary mb-2">Field Type</label>
            <select
              id="field-type"
              bind:value={fieldForm.field_type}
              class="w-full px-3 py-2 border theme-border rounded-lg theme-bg-primary theme-text-primary focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {#each fieldTypes as type}
                <option value={type.value}>{type.label}</option>
              {/each}
            </select>
          </div>
          
          <div>
            <label for="field-order" class="block text-sm font-medium theme-text-primary mb-2">Field Order</label>
            <input
              id="field-order"
              type="number"
              bind:value={fieldForm.field_order}
              min="1"
              class="w-full px-3 py-2 border theme-border rounded-lg theme-bg-primary theme-text-primary focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>
        
        <div class="mb-4">
          <div class="flex items-center">
            <input
              id="field-required"
              type="checkbox"
              bind:checked={fieldForm.is_required}
              class="mr-2"
            />
            <label for="field-required" class="text-sm theme-text-primary">Required Field</label>
          </div>
        </div>
        
        {#if fieldForm.field_type === 'dropdown'}
          <div class="mb-4">
            <label for="dropdown-options" class="block text-sm font-medium theme-text-primary mb-2">Dropdown Options</label>
            <textarea
              id="dropdown-options"
              bind:value={fieldForm.dropdown_options.options}
              placeholder="Enter options separated by commas"
              rows="3"
              class="w-full px-3 py-2 border theme-border rounded-lg theme-bg-primary theme-text-primary focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            ></textarea>
          </div>
        {/if}
        
        <div class="flex justify-end gap-2">
          <Button variant="secondary" size="md" on:click={onCancel}>
            Cancel
          </Button>
          <Button variant="primary" size="md" on:click={onSave}>
            Add Field
          </Button>
        </div>
      </form>
    </div>
  </div>
{/if}

