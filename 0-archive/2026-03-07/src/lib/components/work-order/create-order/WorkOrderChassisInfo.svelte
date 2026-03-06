<script lang="ts">
  import type { WorkOrderFormData, DataElement } from '$lib/types/workOrder';

  export let formData: WorkOrderFormData;
  export let validationErrors: Record<string, string>;
  export let chassisOptions: DataElement[];
  export let bodyWidthOptions: DataElement[];
  export let heightOptions: DataElement[];
  export let wheelbaseOptions: DataElement[];
  export let voltageOptions: DataElement[];
  export let onFieldChange: (field: string, value: any) => void;
  export let clearValidationError: (field: string) => void;
  export let hasSectionErrors: (section: number) => boolean;
</script>

<div class="space-y-4">
  <h3 class="text-xl font-semibold theme-text-primary mb-4">2. Chassis Related</h3>
  
  {#if hasSectionErrors(2)}
    <div class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-4">
      <div class="flex items-center">
        <svg class="w-5 h-5 text-red-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
          <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd"/>
        </svg>
        <span class="text-red-800 dark:text-red-200 font-medium">Please complete all required fields marked with * before proceeding to the next section.</span>
      </div>
    </div>
  {/if}
 
  <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
    <div>
      <label for="wo_chassis" class="block text-sm font-medium theme-text-primary mb-2">Chassis *</label>
      <select
        id="wo_chassis"
        value={formData.wo_chassis}
        on:change={(e) => { onFieldChange('wo_chassis', e.currentTarget.value); clearValidationError('wo_chassis'); }}
        class="w-full px-3 py-2 border theme-border rounded-lg theme-bg-secondary theme-text-primary focus:ring-2 focus:ring-blue-500 focus:outline-none {validationErrors.wo_chassis ? 'border-red-500' : ''}"
      >
        <option value="">Select Chassis</option>
        {#each chassisOptions as option}
          <option value={option.de_value}>{option.de_value}</option>
        {/each}
      </select>
      {#if validationErrors.wo_chassis}
        <p class="text-red-600 text-sm mt-1">{validationErrors.wo_chassis}</p>
      {/if}
    </div>
    <div>
      <label for="body_width_mm" class="block text-sm font-medium theme-text-primary mb-2">Body Width *</label>
      <select
        id="body_width_mm"
        value={formData.body_width_mm}
        on:change={(e) => onFieldChange('body_width_mm', e.currentTarget.value)}
        class="w-full px-3 py-2 border theme-border rounded-lg theme-bg-secondary theme-text-primary focus:ring-2 focus:ring-blue-500 focus:outline-none {validationErrors.body_width_mm ? 'border-red-500' : ''}"
      >
        <option value="">Select Body Width</option>
        {#each bodyWidthOptions as option}
          <option value={option.de_value}>{option.de_value}</option>
        {/each}
      </select>
      {#if validationErrors.body_width_mm}
        <p class="text-red-600 text-sm mt-1">{validationErrors.body_width_mm}</p>
      {/if}
    </div>
  </div>

  <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
    <div>
      <label for="height" class="block text-sm font-medium theme-text-primary mb-2">Height *</label>
      <select
        id="height"
        value={formData.height}
        on:change={(e) => onFieldChange('height', e.currentTarget.value)}
        class="w-full px-3 py-2 border theme-border rounded-lg theme-bg-secondary theme-text-primary focus:ring-2 focus:ring-blue-500 focus:outline-none {validationErrors.height ? 'border-red-500' : ''}"
      >
        <option value="">Select Height</option>
        {#each heightOptions as option}
          <option value={option.de_value}>{option.de_value}</option>
        {/each}
      </select>
      {#if validationErrors.height}
        <p class="text-red-600 text-sm mt-1">{validationErrors.height}</p>
      {/if}
    </div>
    <div>
      <label for="wheel_base" class="block text-sm font-medium theme-text-primary mb-2">Wheelbase *</label>
      <select
        id="wheel_base"
        value={formData.wheel_base}
        on:change={(e) => onFieldChange('wheel_base', e.currentTarget.value)}
        class="w-full px-3 py-2 border theme-border rounded-lg theme-bg-secondary theme-text-primary focus:ring-2 focus:ring-blue-500 focus:outline-none {validationErrors.wheel_base ? 'border-red-500' : ''}"
      >
        <option value="">Select Wheelbase</option>
        {#each wheelbaseOptions as option}
          <option value={option.de_value}>{option.de_value}</option>
        {/each}
      </select>
      {#if validationErrors.wheel_base}
        <p class="text-red-600 text-sm mt-1">{validationErrors.wheel_base}</p>
      {/if}
    </div>
  </div>

  <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
    <div>
      <label for="voltage" class="block text-sm font-medium theme-text-primary mb-2">Voltage *</label>
      <select
        id="voltage"
        value={formData.voltage}
        on:change={(e) => onFieldChange('voltage', e.currentTarget.value)}
        class="w-full px-3 py-2 border theme-border rounded-lg theme-bg-secondary theme-text-primary focus:ring-2 focus:ring-blue-500 focus:outline-none {validationErrors.voltage ? 'border-red-500' : ''}"
      >
        <option value="">Select Voltage</option>
        {#each voltageOptions as option}
          <option value={option.de_value}>{option.de_value}</option>
        {/each}
      </select>
      {#if validationErrors.voltage}
        <p class="text-red-600 text-sm mt-1">{validationErrors.voltage}</p>
      {/if}
    </div>
  </div>
</div>

