<script lang="ts">
  import Button from '$lib/components/common/Button.svelte';
  import { formatDateLocal } from '$lib/utils/formatDate';

  export let showModal = false;
  export let selectedTemplate: any = null;
  export let onAddField: () => void;
  export let onClose: () => void;
  export let onDeleteField: (field: any) => void;
</script>

{#if showModal}
  <div class="fixed inset-0 z-50 flex items-center justify-center">
    <div class="fixed inset-0 bg-black bg-opacity-50" 
         role="button" 
         tabindex="0"
         on:click={onClose}
         on:keydown={(e) => (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') && onClose()}></div>
    <div class="relative theme-bg-primary rounded-lg shadow-xl p-6 w-full max-w-4xl mx-4 max-h-[90vh] overflow-y-auto">
      <h2 class="text-xl font-bold theme-text-primary mb-4">Template Details</h2>
      
      <!-- Template Information -->
      <div class="mb-6 p-4 theme-bg-secondary border theme-border rounded-lg">
        <h3 class="text-lg font-semibold theme-text-primary mb-2">{selectedTemplate?.template_name}</h3>
        <p class="text-sm theme-text-secondary mb-2">
          <strong>Description:</strong> {selectedTemplate?.template_description || 'No description'}
        </p>
        <p class="text-sm theme-text-secondary mb-2">
          <strong>Status:</strong> 
          <span class="px-2 py-1 rounded-full text-xs {selectedTemplate?.is_active ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'}">
            {selectedTemplate?.is_active ? 'Active' : 'Inactive'}
          </span>
        </p>
        <p class="text-sm theme-text-secondary">
          <strong>Created:</strong> {selectedTemplate?.created_dt ? formatDateLocal(selectedTemplate.created_dt) : 'N/A'}
        </p>
      </div>

      <!-- Template Fields -->
      <div class="mb-6">
        <h3 class="text-lg font-semibold theme-text-primary mb-4">
          Template Fields ({selectedTemplate?.sys_chassis_receival_template_fields?.length || 0})
        </h3>
        
        {#if selectedTemplate?.sys_chassis_receival_template_fields?.length > 0}
          <div class="space-y-4">
            {#each selectedTemplate.sys_chassis_receival_template_fields.sort((a: any, b: any) => (a as any).field_order - (b as any).field_order) as field}
              <div class="p-4 border theme-border rounded-lg">
                <div class="flex justify-between items-start mb-2">
                  <div>
                    <h4 class="font-medium theme-text-primary">{field.field_label}</h4>
                    <p class="text-sm theme-text-secondary">Field Name: {field.field_name}</p>
                  </div>
                  <div class="flex items-center gap-2">
                    <span class="px-2 py-1 bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 text-xs rounded">
                      {field.field_type}
                    </span>
                    {#if field.is_required}
                      <span class="px-2 py-1 bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 text-xs rounded">
                        Required
                      </span>
                    {/if}
                    <Button variant="danger" size="sm" on:click={() => onDeleteField(field)}>
                      Delete
                    </Button>
                  </div>
                </div>
                
                <div class="text-sm theme-text-secondary">
                  <p><strong>Order:</strong> {field.field_order}</p>
                  
                  {#if field.field_type === 'dropdown' && field.dropdown_options?.options?.length > 0}
                    <p class="mt-2"><strong>Options:</strong></p>
                    <ul class="list-disc list-inside ml-4">
                      {#each field.dropdown_options.options as option}
                        <li>{option}</li>
                      {/each}
                    </ul>
                  {/if}
                  
                  {#if field.validation_rules && Object.keys(field.validation_rules).length > 0}
                    <p class="mt-2"><strong>Validation Rules:</strong></p>
                    <ul class="list-disc list-inside ml-4">
                      {#each Object.entries(field.validation_rules) as [key, value]}
                        <li>{key}: {value}</li>
                      {/each}
                    </ul>
                  {/if}
                </div>
              </div>
            {/each}
          </div>
        {:else}
          <div class="text-center py-8">
            <p class="text-gray-500 dark:text-gray-400">No fields added to this template yet.</p>
            <p class="text-sm text-gray-400 dark:text-gray-500 mt-2">Click "Add Field" to start building the template.</p>
          </div>
        {/if}
      </div>

      <!-- Action Buttons -->
      <div class="flex justify-end gap-2">
        <Button variant="secondary" size="md" on:click={onClose}>
          Close
        </Button>
        <Button variant="primary" size="md" on:click={onAddField}>
          Add Field
        </Button>
      </div>
    </div>
  </div>
{/if}

