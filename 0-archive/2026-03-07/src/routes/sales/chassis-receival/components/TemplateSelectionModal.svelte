<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import Button from '$lib/components/common/Button.svelte';
  
  export let show: boolean = false;
  export let templates: any[] = [];
  export let selectedWorkOrder: any = null;
  
  const dispatch = createEventDispatcher();
  
  function handleSelect(template: any) {
    dispatch('select', template);
  }
  
  function handleClose() {
    dispatch('close');
  }
</script>

{#if show}
  <div class="fixed inset-0 z-50 flex items-center justify-center">
    <div class="fixed inset-0 bg-black bg-opacity-50" 
         role="button" 
         tabindex="0"
         on:click={handleClose}
         on:keydown={(e) => (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') && handleClose()}></div>
    <div class="relative theme-bg-primary rounded-lg shadow-xl p-6 w-full max-w-2xl mx-4">
      <h2 class="text-xl font-bold theme-text-primary mb-4">Select Inspection Template</h2>
      <p class="text-sm theme-text-secondary mb-6">
        Choose a template for work order: <strong>{selectedWorkOrder?.wo_no}</strong>
      </p>
      
      <div class="grid gap-4">
        {#each templates as template}
          <div class="border theme-border rounded-lg p-4 hover:theme-bg-secondary cursor-pointer" 
               role="button" 
               tabindex="0"
               on:click={() => handleSelect(template)}
               on:keydown={(e) => (e.key === 'Enter' || e.key === ' ') && handleSelect(template)}>
            <div class="flex justify-between items-start">
              <div>
                <h3 class="font-semibold theme-text-primary">{template.template_name}</h3>
                <p class="text-sm theme-text-secondary mt-1">{template.template_description || 'No description'}</p>
                <p class="text-xs theme-text-tertiary mt-2">
                  {template.sys_chassis_receival_template_fields?.length || 0} fields
                </p>
              </div>
              <Button variant="primary" size="sm">
                Select
              </Button>
            </div>
          </div>
        {/each}
      </div>
      
      <div class="mt-6 flex justify-end">
        <button
          class="px-4 py-2 theme-text-secondary hover:theme-text-primary transition-colors"
          on:click={handleClose}
        >
          Cancel
        </button>
      </div>
    </div>
  </div>
{/if}

