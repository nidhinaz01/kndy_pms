<script lang="ts">
  import type { WorkOrderFormData, DataElement } from '$lib/types/workOrder';

  export let formData: WorkOrderFormData;
  export let validationErrors: Record<string, string>;
  export let platformOptions: DataElement[];
  export let sidePanelOptions: DataElement[];
  export let topPanelOptions: DataElement[];
  export let grabRailsOptions: DataElement[];
  export let luggageRackOptions: DataElement[];
  export let onFieldChange: (field: string, value: any) => void;
</script>

<div class="space-y-4">
  <h3 class="text-xl font-semibold theme-text-primary mb-4">5. Interior</h3>
  
  <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
    <div>
      <label for="platform" class="block text-sm font-medium theme-text-primary mb-2">Platform *</label>
      <select
        id="platform"
        value={formData.platform}
        on:change={(e) => onFieldChange('platform', e.currentTarget.value)}
        class="w-full px-3 py-2 border theme-border rounded-lg theme-bg-secondary theme-text-primary focus:ring-2 focus:ring-blue-500 focus:outline-none {validationErrors.platform ? 'border-red-500' : ''}"
      >
        <option value="">Select Platform</option>
        {#each platformOptions as option}
          <option value={option.de_value}>{option.de_value}</option>
        {/each}
      </select>
      {#if validationErrors.platform}
        <p class="text-red-600 text-sm mt-1">{validationErrors.platform}</p>
      {/if}
    </div>
  </div>

  <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
    <div>
      <label for="inside_side_panel" class="block text-sm font-medium theme-text-primary mb-2">Side Panel *</label>
      <select
        id="inside_side_panel"
        value={formData.inside_side_panel}
        on:change={(e) => onFieldChange('inside_side_panel', e.currentTarget.value)}
        class="w-full px-3 py-2 border theme-border rounded-lg theme-bg-secondary theme-text-primary focus:ring-2 focus:ring-blue-500 focus:outline-none {validationErrors.inside_side_panel ? 'border-red-500' : ''}"
      >
        <option value="">Select Side Panel</option>
        {#each sidePanelOptions as option}
          <option value={option.de_value}>{option.de_value}</option>
        {/each}
      </select>
      {#if validationErrors.inside_side_panel}
        <p class="text-red-600 text-sm mt-1">{validationErrors.inside_side_panel}</p>
      {/if}
    </div>
    <div>
      <label for="inside_top_panel" class="block text-sm font-medium theme-text-primary mb-2">Top Panel *</label>
      <select
        id="inside_top_panel"
        value={formData.inside_top_panel}
        on:change={(e) => onFieldChange('inside_top_panel', e.currentTarget.value)}
        class="w-full px-3 py-2 border theme-border rounded-lg theme-bg-secondary theme-text-primary focus:ring-2 focus:ring-blue-500 focus:outline-none {validationErrors.inside_top_panel ? 'border-red-500' : ''}"
      >
        <option value="">Select Top Panel</option>
        {#each topPanelOptions as option}
          <option value={option.de_value}>{option.de_value}</option>
        {/each}
      </select>
      {#if validationErrors.inside_top_panel}
        <p class="text-red-600 text-sm mt-1">{validationErrors.inside_top_panel}</p>
      {/if}
    </div>
  </div>

  <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
    <div>
      <label for="inside_grab_rails" class="block text-sm font-medium theme-text-primary mb-2">Grab Rails *</label>
      <select
        id="inside_grab_rails"
        value={formData.inside_grab_rails}
        on:change={(e) => onFieldChange('inside_grab_rails', e.currentTarget.value)}
        class="w-full px-3 py-2 border theme-border rounded-lg theme-bg-secondary theme-text-primary focus:ring-2 focus:ring-blue-500 focus:outline-none {validationErrors.inside_grab_rails ? 'border-red-500' : ''}"
      >
        <option value="">Select Grab Rails</option>
        {#each grabRailsOptions as option}
          <option value={option.de_value}>{option.de_value}</option>
        {/each}
      </select>
      {#if validationErrors.inside_grab_rails}
        <p class="text-red-600 text-sm mt-1">{validationErrors.inside_grab_rails}</p>
      {/if}
    </div>
    <div>
      <label for="inside_luggage_rack" class="block text-sm font-medium theme-text-primary mb-2">Luggage Rack *</label>
      <select
        id="inside_luggage_rack"
        value={formData.inside_luggage_rack}
        on:change={(e) => onFieldChange('inside_luggage_rack', e.currentTarget.value)}
        class="w-full px-3 py-2 border theme-border rounded-lg theme-bg-secondary theme-text-primary focus:ring-2 focus:ring-blue-500 focus:outline-none {validationErrors.inside_luggage_rack ? 'border-red-500' : ''}"
      >
        <option value="">Select Luggage Rack</option>
        {#each luggageRackOptions as option}
          <option value={option.de_value}>{option.de_value}</option>
        {/each}
      </select>
      {#if validationErrors.inside_luggage_rack}
        <p class="text-red-600 text-sm mt-1">{validationErrors.inside_luggage_rack}</p>
      {/if}
    </div>
  </div>
</div>

