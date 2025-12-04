<script lang="ts">
  import type { WorkOrderFormData, ModelOption } from '$lib/types/workOrder';
  import { updateFieldsFromModel } from '$lib/utils/workOrderUtils';

  export let formData: WorkOrderFormData;
  export let validationErrors: Record<string, string>;
  export let modelOptions: ModelOption[];
  export let isCheckingUniqueness: boolean;
  export let onFieldChange: (field: string, value: any) => void;
  export let clearValidationError: (field: string) => void;
  export let onModelChange: ((modelName: string) => void) | undefined = undefined;

  function handleModelChange(value: string) {
    onFieldChange('wo_model', value);
    if (value && onModelChange) {
      onModelChange(value);
    } else if (value) {
      const updates = updateFieldsFromModel(value, modelOptions);
      Object.entries(updates).forEach(([key, val]) => {
        onFieldChange(key, val);
      });
    }
  }
</script>

<div class="space-y-4">
  <h3 class="text-xl font-semibold theme-text-primary mb-4">1. Work Order Details</h3>
  
  <!-- WO/PWO Numbers -->
  <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
    <div>
      <label for="wo_no" class="block text-sm font-medium theme-text-primary mb-2">WO Number *</label>
      <input
        type="text"
        id="wo_no"
        value={formData.wo_no}
        on:input={(e) => onFieldChange('wo_no', e.currentTarget.value)}
        placeholder="Enter WO number"
        class="w-full px-3 py-2 border theme-border rounded-lg theme-bg-secondary theme-text-primary focus:ring-2 focus:ring-blue-500 focus:outline-none {validationErrors.wo_pwo ? 'border-red-500' : ''}"
      />
    </div>
    <div>
      <label for="pwo_no" class="block text-sm font-medium theme-text-primary mb-2">PWO Number *</label>
      <input
        type="text"
        id="pwo_no"
        value={formData.pwo_no}
        on:input={(e) => onFieldChange('pwo_no', e.currentTarget.value)}
        placeholder="Enter PWO number"
        class="w-full px-3 py-2 border theme-border rounded-lg theme-bg-secondary theme-text-primary focus:ring-2 focus:ring-blue-500 focus:outline-none {validationErrors.wo_pwo ? 'border-red-500' : ''}"
      />
    </div>
  </div>
  
  {#if validationErrors.wo_pwo}
    <div class="text-red-600 text-sm bg-red-50 dark:bg-red-900/20 p-3 rounded-lg border border-red-200 dark:border-red-800">
      {validationErrors.wo_pwo}
    </div>
  {/if}

  <!-- Customer Name -->
  <div>
    <label for="customer_name" class="block text-sm font-medium theme-text-primary mb-2">Customer Name *</label>
    <input
      type="text"
      id="customer_name"
      value={formData.customer_name}
      on:input={(e) => onFieldChange('customer_name', e.currentTarget.value)}
      placeholder="Enter customer name"
      class="w-full px-3 py-2 border theme-border rounded-lg theme-bg-secondary theme-text-primary focus:ring-2 focus:ring-blue-500 focus:outline-none {validationErrors.customer_name ? 'border-red-500' : ''}"
    />
    {#if validationErrors.customer_name}
      <p class="text-red-600 text-sm mt-1">{validationErrors.customer_name}</p>
    {/if}
  </div>

  <!-- Date WO placed + Model -->
  <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
    <div>
      <label for="wo_date" class="block text-sm font-medium theme-text-primary mb-2">Date WO placed *</label>
      <input
        type="date"
        id="wo_date"
        value={formData.wo_date}
        on:input={(e) => onFieldChange('wo_date', e.currentTarget.value)}
        max={new Date().toISOString().split('T')[0]}
        class="w-full px-3 py-2 border theme-border rounded-lg theme-bg-secondary theme-text-primary focus:ring-2 focus:ring-blue-500 focus:outline-none {validationErrors.wo_date ? 'border-red-500' : ''}"
      />
      {#if validationErrors.wo_date}
        <p class="text-red-600 text-sm mt-1">{validationErrors.wo_date}</p>
      {/if}
    </div>
    <div>
      <label for="wo_model" class="block text-sm font-medium theme-text-primary mb-2">Model *</label>
      <select
        id="wo_model"
        value={formData.wo_model}
        on:change={(e) => handleModelChange(e.currentTarget.value)}
        class="w-full px-3 py-2 border theme-border rounded-lg theme-bg-secondary theme-text-primary focus:ring-2 focus:ring-blue-500 focus:outline-none {validationErrors.wo_model ? 'border-red-500' : ''}"
      >
        <option value="">Select Model</option>
        {#each modelOptions as option}
          <option value={option.wo_type_name}>{option.wo_type_name}</option>
        {/each}
      </select>
      {#if validationErrors.wo_model}
        <p class="text-red-600 text-sm mt-1">{validationErrors.wo_model}</p>
      {/if}
    </div>
  </div>

  <!-- Type + Comfort Level -->
  <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
    <div>
      <label for="wo_type" class="block text-sm font-medium theme-text-primary mb-2">Type</label>
      <input
        type="text"
        id="wo_type"
        value={formData.wo_type}
        readonly
        class="w-full px-3 py-2 border theme-border rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 cursor-not-allowed"
      />
    </div>
    <div>
      <label for="wo_comfort_level" class="block text-sm font-medium theme-text-primary mb-2">Comfort Level</label>
      <input
        type="text"
        id="wo_comfort_level"
        value={formData.wo_comfort_level}
        readonly
        class="w-full px-3 py-2 border theme-border rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 cursor-not-allowed"
      />
    </div>
  </div>

  <!-- Capacity + Carrier Type -->
  <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
    <div>
      <label for="wo_capacity" class="block text-sm font-medium theme-text-primary mb-2">Capacity</label>
      <input
        type="text"
        id="wo_capacity"
        value={formData.wo_capacity}
        readonly
        class="w-full px-3 py-2 border theme-border rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 cursor-not-allowed"
      />
    </div>
    <div>
      <label for="wo_carrier_type" class="block text-sm font-medium theme-text-primary mb-2">Carrier Type</label>
      <input
        type="text"
        id="wo_carrier_type"
        value={formData.wo_carrier_type}
        readonly
        class="w-full px-3 py-2 border theme-border rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 cursor-not-allowed"
      />
    </div>
  </div>

  {#if isCheckingUniqueness}
    <div class="flex items-center justify-center p-4">
      <div class="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mr-2"></div>
      <span class="text-sm theme-text-secondary">Checking uniqueness...</span>
    </div>
  {/if}
</div>

