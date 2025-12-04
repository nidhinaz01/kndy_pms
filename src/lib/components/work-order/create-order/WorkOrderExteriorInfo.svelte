<script lang="ts">
  import type { WorkOrderFormData, DataElement } from '$lib/types/workOrder';

  export let formData: WorkOrderFormData;
  export let validationErrors: Record<string, string>;
  export let frontOptions: DataElement[];
  export let frontGlassOptions: DataElement[];
  export let rearOptions: DataElement[];
  export let rearGlassOptions: DataElement[];
  export let paintOptions: DataElement[];
  export let onFieldChange: (field: string, value: any) => void;
</script>

<div class="space-y-4">
  <h3 class="text-xl font-semibold theme-text-primary mb-4">4. Exterior</h3>
  
  <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
    <div>
      <label for="front" class="block text-sm font-medium theme-text-primary mb-2">Front *</label>
      <select
        id="front"
        value={formData.front}
        on:change={(e) => onFieldChange('front', e.currentTarget.value)}
        class="w-full px-3 py-2 border theme-border rounded-lg theme-bg-secondary theme-text-primary focus:ring-2 focus:ring-blue-500 focus:outline-none {validationErrors.front ? 'border-red-500' : ''}"
      >
        <option value="">Select Front</option>
        {#each frontOptions as option}
          <option value={option.de_value}>{option.de_value}</option>
        {/each}
      </select>
      {#if validationErrors.front}
        <p class="text-red-600 text-sm mt-1">{validationErrors.front}</p>
      {/if}
    </div>
    <div>
      <label for="front_glass" class="block text-sm font-medium theme-text-primary mb-2">Front Glass *</label>
      <select
        id="front_glass"
        value={formData.front_glass}
        on:change={(e) => onFieldChange('front_glass', e.currentTarget.value)}
        class="w-full px-3 py-2 border theme-border rounded-lg theme-bg-secondary theme-text-primary focus:ring-2 focus:ring-blue-500 focus:outline-none {validationErrors.front_glass ? 'border-red-500' : ''}"
      >
        <option value="">Select Front Glass</option>
        {#each frontGlassOptions as option}
          <option value={option.de_value}>{option.de_value}</option>
        {/each}
      </select>
      {#if validationErrors.front_glass}
        <p class="text-red-600 text-sm mt-1">{validationErrors.front_glass}</p>
      {/if}
    </div>
  </div>

  <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
    <div>
      <label for="rear" class="block text-sm font-medium theme-text-primary mb-2">Rear *</label>
      <select
        id="rear"
        value={formData.rear}
        on:change={(e) => onFieldChange('rear', e.currentTarget.value)}
        class="w-full px-3 py-2 border theme-border rounded-lg theme-bg-secondary theme-text-primary focus:ring-2 focus:ring-blue-500 focus:outline-none {validationErrors.rear ? 'border-red-500' : ''}"
      >
        <option value="">Select Rear</option>
        {#each rearOptions as option}
          <option value={option.de_value}>{option.de_value}</option>
        {/each}
      </select>
      {#if validationErrors.rear}
        <p class="text-red-600 text-sm mt-1">{validationErrors.rear}</p>
      {/if}
    </div>
    <div>
      <label for="rear_glass" class="block text-sm font-medium theme-text-primary mb-2">Rear Glass *</label>
      <select
        id="rear_glass"
        value={formData.rear_glass}
        on:change={(e) => onFieldChange('rear_glass', e.currentTarget.value)}
        class="w-full px-3 py-2 border theme-border rounded-lg theme-bg-secondary theme-text-primary focus:ring-2 focus:ring-blue-500 focus:outline-none {validationErrors.rear_glass ? 'border-red-500' : ''}"
      >
        <option value="">Select Rear Glass</option>
        {#each rearGlassOptions as option}
          <option value={option.de_value}>{option.de_value}</option>
        {/each}
      </select>
      {#if validationErrors.rear_glass}
        <p class="text-red-600 text-sm mt-1">{validationErrors.rear_glass}</p>
      {/if}
    </div>
  </div>

  <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
    <div>
      <label for="paint" class="block text-sm font-medium theme-text-primary mb-2">Paint *</label>
      <select
        id="paint"
        value={formData.paint}
        on:change={(e) => onFieldChange('paint', e.currentTarget.value)}
        class="w-full px-3 py-2 border theme-border rounded-lg theme-bg-secondary theme-text-primary focus:ring-2 focus:ring-blue-500 focus:outline-none {validationErrors.paint ? 'border-red-500' : ''}"
      >
        <option value="">Select Paint</option>
        {#each paintOptions as option}
          <option value={option.de_value}>{option.de_value}</option>
        {/each}
      </select>
      {#if validationErrors.paint}
        <p class="text-red-600 text-sm mt-1">{validationErrors.paint}</p>
      {/if}
    </div>
  </div>
</div>

