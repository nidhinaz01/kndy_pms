<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import Button from '$lib/components/common/Button.svelte';
  
  export let show: boolean = false;
  export let selectedWorkOrder: any = null;
  export let selectedTemplate: any = null;
  export let isResumingInspection: boolean = false;
  export let inspectionForm: {
    inspection_date: string;
    inspector_name: string;
    inspection_notes: string;
    field_responses: Record<string, any>;
  };
  export let fieldResponses: Record<string, any> = {};
  
  const dispatch = createEventDispatcher();
  
  function handleClose() {
    dispatch('close');
  }
  
  function handleSaveProgress() {
    dispatch('save-progress');
  }
  
  function handleComplete() {
    dispatch('complete');
  }
</script>

{#if show}
  <div class="fixed inset-0 z-50 flex items-center justify-center">
    <div class="fixed inset-0 bg-black bg-opacity-50" 
         role="button" 
         tabindex="0"
         on:click={handleClose}
         on:keydown={(e) => (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') && handleClose()}></div>
    <div class="relative theme-bg-primary rounded-lg shadow-xl p-6 w-full max-w-4xl mx-4 max-h-[90vh] overflow-y-auto">
      <h2 class="text-xl font-bold theme-text-primary mb-4">
        {isResumingInspection ? 'Resume Chassis Receival Inspection' : 'Chassis Receival Inspection'}
      </h2>
      <p class="text-sm theme-text-secondary mb-6">
        Work Order: <strong>{selectedWorkOrder?.wo_no}</strong> | 
        Template: <strong>{selectedTemplate?.template_name}</strong>
        {#if isResumingInspection}
          <span class="ml-2 px-2 py-1 bg-yellow-100 text-yellow-800 text-xs rounded">
            Ongoing
          </span>
        {/if}
      </p>
      
      <form>
        <!-- Inspection Details -->
        <div class="grid grid-cols-3 gap-4 mb-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <div>
            <label for="inspection-date" class="block text-sm font-medium theme-text-primary mb-2">Inspection Date</label>
            <input
              id="inspection-date"
              type="date"
              bind:value={inspectionForm.inspection_date}
              required
              class="w-full px-3 py-2 border theme-border rounded-lg theme-bg-primary theme-text-primary focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          
          <div>
            <label for="inspector-name" class="block text-sm font-medium theme-text-primary mb-2">Inspector Name</label>
            <input
              id="inspector-name"
              type="text"
              bind:value={inspectionForm.inspector_name}
              required
              class="w-full px-3 py-2 border theme-border rounded-lg theme-bg-primary theme-text-primary focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          
          <div>
            <label for="inspection-status" class="block text-sm font-medium theme-text-primary mb-2">Status</label>
            <select
              id="inspection-status"
              class="w-full px-3 py-2 border theme-border rounded-lg theme-bg-primary theme-text-primary focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled
            >
              <option>Completed</option>
            </select>
          </div>
        </div>
        
        <!-- Template Fields -->
        <div class="space-y-4 mb-6">
          <h3 class="text-lg font-semibold theme-text-primary">Inspection Checklist</h3>
          
          {#each selectedTemplate?.sys_chassis_receival_template_fields?.sort((a: any, b: any) => a.field_order - b.field_order) || [] as field}
            <div class="p-4 border theme-border rounded-lg">
              <label for="field-{field.field_name}" class="block text-sm font-medium theme-text-primary mb-2">
                {field.field_label}
                {#if field.is_required}
                  <span class="text-red-500">*</span>
                {/if}
              </label>
              
              {#if field.field_type === 'text'}
                <input
                  id="field-{field.field_name}"
                  type="text"
                  bind:value={fieldResponses[field.field_name]}
                  required={field.is_required}
                  class="w-full px-3 py-2 border theme-border rounded-lg theme-bg-primary theme-text-primary focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              {:else if field.field_type === 'textarea'}
                <textarea
                  id="field-{field.field_name}"
                  bind:value={fieldResponses[field.field_name]}
                  required={field.is_required}
                  rows="3"
                  class="w-full px-3 py-2 border theme-border rounded-lg theme-bg-primary theme-text-primary focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                ></textarea>
              {:else if field.field_type === 'number'}
                <input
                  id="field-{field.field_name}"
                  type="number"
                  bind:value={fieldResponses[field.field_name]}
                  required={field.is_required}
                  class="w-full px-3 py-2 border theme-border rounded-lg theme-bg-primary theme-text-primary focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              {:else if field.field_type === 'date'}
                <input
                  id="field-{field.field_name}"
                  type="date"
                  bind:value={fieldResponses[field.field_name]}
                  required={field.is_required}
                  class="w-full px-3 py-2 border theme-border rounded-lg theme-bg-primary theme-text-primary focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              {:else if field.field_type === 'checkbox'}
                <div class="flex items-center">
                  <input
                    id="field-{field.field_name}"
                    type="checkbox"
                    bind:checked={fieldResponses[field.field_name]}
                    class="mr-2"
                  />
                  <label for="field-{field.field_name}" class="text-sm theme-text-primary">Yes</label>
                </div>
              {:else if field.field_type === 'dropdown'}
                <select
                  id="field-{field.field_name}"
                  bind:value={fieldResponses[field.field_name]}
                  required={field.is_required}
                  class="w-full px-3 py-2 border theme-border rounded-lg theme-bg-primary theme-text-primary focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Select an option</option>
                  {#each field.dropdown_options?.options || [] as option: string}
                    <option value={option}>{option}</option>
                  {/each}
                </select>
              {/if}
            </div>
          {/each}
        </div>
        
        <!-- Inspection Notes -->
        <div class="mb-6">
          <label for="inspection-notes" class="block text-sm font-medium theme-text-primary mb-2">Inspection Notes</label>
          <textarea
            id="inspection-notes"
            bind:value={inspectionForm.inspection_notes}
            rows="3"
            placeholder="Additional notes or observations..."
            class="w-full px-3 py-2 border theme-border rounded-lg theme-bg-primary theme-text-primary focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          ></textarea>
        </div>
        
        <!-- Action Buttons -->
        <div class="flex justify-between">
          <div class="flex items-center">
            {#if isResumingInspection}
              <span class="text-sm theme-text-secondary">
                📝 Resuming ongoing inspection
              </span>
            {/if}
          </div>
          <div class="flex gap-2">
            <Button variant="secondary" size="md" on:click={handleClose}>
              Cancel
            </Button>
            <Button variant="primary" size="md" on:click={handleSaveProgress}>
              Save Progress
            </Button>
            <Button variant="primary" size="md" on:click={handleComplete}>
              Complete Inspection
            </Button>
          </div>
        </div>
      </form>
    </div>
  </div>
{/if}

