<script lang="ts">
  import type { WorkOrderFormData, DataElement } from '$lib/types/workOrder';
  import { calculateAmount } from '$lib/utils/workOrderUtils';

  export let formData: WorkOrderFormData;
  export let validationErrors: Record<string, string>;
  export let additionalRequirementsOptions: DataElement[];
  export let onFieldChange: (field: string, value: any) => void;
  export let addAdditionalRequirement: () => void;
  export let removeAdditionalRequirement: (index: number) => void;

  function handleCalculateAmount(index: number) {
    const row = formData.additional_requirements[index];
    if (row) {
      const amount = calculateAmount(row.work_qty, row.work_rate);
      const updated = [...formData.additional_requirements];
      updated[index] = { ...row, amount };
      onFieldChange('additional_requirements', updated);
    }
  }

  function handleWorkDetailsChange(index: number, value: string) {
    const updated = [...formData.additional_requirements];
    updated[index] = { ...updated[index], work_details: value };
    onFieldChange('additional_requirements', updated);
  }

  function handleWorkQtyChange(index: number, value: number) {
    const updated = [...formData.additional_requirements];
    updated[index] = { ...updated[index], work_qty: value };
    onFieldChange('additional_requirements', updated);
    handleCalculateAmount(index);
  }

  function handleWorkRateChange(index: number, value: number) {
    const updated = [...formData.additional_requirements];
    updated[index] = { ...updated[index], work_rate: value };
    onFieldChange('additional_requirements', updated);
    handleCalculateAmount(index);
  }
</script>

<div class="space-y-4">
  <h3 class="text-xl font-semibold theme-text-primary mb-4">8. Additional Requirements</h3>
  
  <div class="theme-bg-secondary theme-border border rounded-lg p-4 mb-6">
    <div class="flex items-center">
      <svg class="w-5 h-5 theme-text-accent mr-2" fill="currentColor" viewBox="0 0 20 20">
        <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd"/>
      </svg>
      <span class="theme-text-secondary text-sm">Add additional work requirements with quantity and rate. Amount will be calculated automatically.</span>
    </div>
  </div>

  {#each formData.additional_requirements as row, index}
    <div class="theme-border border rounded-lg p-4 theme-bg-secondary">
      <div class="flex items-center justify-between mb-3">
        <h4 class="text-sm font-medium theme-text-primary">Requirement {index + 1}</h4>
        {#if formData.additional_requirements.length > 1}
          <button
            type="button"
            on:click={() => removeAdditionalRequirement(index)}
            class="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 p-1 rounded-full hover:theme-bg-tertiary transition-colors"
            aria-label="Remove requirement {index + 1}"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
            </svg>
          </button>
        {/if}
      </div>
      
      <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div class="md:col-span-2">
          <label for="work_details_{index}" class="block text-sm font-medium theme-text-primary mb-2">Work Details *</label>
          <select
            id="work_details_{index}"
            value={row.work_details}
            on:change={(e) => handleWorkDetailsChange(index, e.currentTarget.value)}
            class="w-full px-3 py-2 border theme-border rounded-lg theme-bg-secondary theme-text-primary focus:ring-2 focus:ring-blue-500 focus:outline-none {validationErrors[`work_details_${index}`] ? 'border-red-500' : ''}"
          >
            <option value="">Select Work Details</option>
            {#each additionalRequirementsOptions as option}
              <option value={option.de_value}>{option.de_value}</option>
            {/each}
          </select>
          {#if validationErrors[`work_details_${index}`]}
            <p class="text-red-600 text-sm mt-1">{validationErrors[`work_details_${index}`]}</p>
          {/if}
        </div>
        <div>
          <label for="work_qty_{index}" class="block text-sm font-medium theme-text-primary mb-2">Quantity {row.work_details ? '*' : ''}</label>
          <input
            type="number"
            id="work_qty_{index}"
            value={row.work_qty}
            on:input={(e) => handleWorkQtyChange(index, Number(e.currentTarget.value))}
            min="1"
            step="1"
            class="w-full px-3 py-2 border theme-border rounded-lg theme-bg-secondary theme-text-primary focus:ring-2 focus:ring-blue-500 focus:outline-none {validationErrors[`work_qty_${index}`] ? 'border-red-500' : ''}"
          />
          {#if validationErrors[`work_qty_${index}`]}
            <p class="text-red-600 text-sm mt-1">{validationErrors[`work_qty_${index}`]}</p>
          {/if}
        </div>
        <div>
          <label for="work_rate_{index}" class="block text-sm font-medium theme-text-primary mb-2">Rate (₹) {row.work_details ? '*' : ''}</label>
          <input
            type="number"
            id="work_rate_{index}"
            value={row.work_rate}
            on:input={(e) => handleWorkRateChange(index, Number(e.currentTarget.value))}
            min="0"
            step="0.01"
            class="w-full px-3 py-2 border theme-border rounded-lg theme-bg-secondary theme-text-primary focus:ring-2 focus:ring-blue-500 focus:outline-none {validationErrors[`work_rate_${index}`] ? 'border-red-500' : ''}"
          />
          {#if validationErrors[`work_rate_${index}`]}
            <p class="text-red-600 text-sm mt-1">{validationErrors[`work_rate_${index}`]}</p>
          {/if}
        </div>
        <div>
          <label for="amount_{index}" class="block text-sm font-medium theme-text-primary mb-2">Amount</label>
          <div class="w-full px-3 py-2 theme-bg-secondary theme-border border rounded-lg text-center">
            <span class="text-lg font-bold theme-text-accent">₹{row.amount.toFixed(2)}</span>
            <p class="text-xs theme-text-secondary mt-1">
              {row.work_qty} × ₹{row.work_rate.toFixed(2)}
            </p>
          </div>
        </div>
      </div>
    </div>
  {/each}

  <div class="flex justify-center">
    <button
      type="button"
      on:click={addAdditionalRequirement}
      class="inline-flex items-center px-4 py-2 theme-border border rounded-md shadow-sm text-sm font-medium theme-text-primary theme-bg-primary hover:theme-bg-secondary focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
    >
      <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path>
      </svg>
      Add Another Requirement
    </button>
  </div>
</div>

