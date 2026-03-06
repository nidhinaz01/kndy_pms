<script lang="ts">
  import type { WorkOrderFormData, DataElement } from '$lib/types/workOrder';
  import { calculateTotalCost } from '$lib/utils/workOrderUtils';

  export let formData: WorkOrderFormData;
  export let validationErrors: Record<string, string>;
  export let gstTaxRateOptions: DataElement[];
  export let cessTaxRateOptions: DataElement[];
  export let onFieldChange: (field: string, value: any) => void;

  function handleCostChange(value: number) {
    onFieldChange('work_order_cost', value);
    const { gst, cess, total } = calculateTotalCost(value, gstTaxRateOptions, cessTaxRateOptions);
    onFieldChange('gst', gst);
    onFieldChange('cess', cess);
    onFieldChange('total_cost', total);
  }
</script>

<div class="space-y-4">
  <h3 class="text-xl font-semibold theme-text-primary mb-4">9. Costs</h3>
  
  <div class="theme-bg-secondary theme-border border rounded-lg p-4 mb-6">
    <div class="flex items-center">
      <svg class="w-5 h-5 theme-text-accent mr-2" fill="currentColor" viewBox="0 0 20 20">
        <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd"/>
      </svg>
      <span class="theme-text-secondary text-sm">Enter the Work Order Cost. GST and Cess will be calculated automatically based on the selected tax rates.</span>
    </div>
  </div>

  <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
    <div>
      <label for="work_order_cost" class="block text-sm font-medium theme-text-primary mb-2">WO Cost *</label>
      <input
        type="number"
        id="work_order_cost"
        value={formData.work_order_cost}
        on:input={(e) => handleCostChange(Number(e.currentTarget.value))}
        min="0"
        step="0.01"
        placeholder="0.00"
        class="w-full px-3 py-2 border theme-border rounded-lg theme-bg-secondary theme-text-primary focus:ring-2 focus:ring-blue-500 focus:outline-none {validationErrors.work_order_cost ? 'border-red-500' : ''}"
      />
      {#if validationErrors.work_order_cost}
        <p class="text-red-600 text-sm mt-1">{validationErrors.work_order_cost}</p>
      {/if}
      <p class="text-sm theme-text-secondary mt-1">Enter the base cost for the work order</p>
    </div>
  </div>

  <div class="theme-bg-secondary rounded-lg p-4 theme-border border">
    <h4 class="text-sm font-medium theme-text-primary mb-3">Calculated Values</h4>
    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div class="text-center">
        <span class="block text-xs font-medium theme-text-secondary mb-1">GST Amount</span>
        <div class="text-lg font-semibold theme-text-primary">
          ₹{formData.gst.toFixed(2)}
        </div>
        <p class="text-xs theme-text-secondary">
          {gstTaxRateOptions.length > 0 ? `${gstTaxRateOptions[0].de_value}% of ₹${formData.work_order_cost.toFixed(2)}` : 'Not calculated'}
        </p>
      </div>
      <div class="text-center">
        <span class="block text-xs font-medium theme-text-secondary mb-1">Cess Amount</span>
        <div class="text-lg font-semibold theme-text-primary">
          ₹{formData.cess.toFixed(2)}
        </div>
        <p class="text-xs theme-text-secondary">
          {cessTaxRateOptions.length > 0 ? `${cessTaxRateOptions[0].de_value}% of ₹${formData.work_order_cost.toFixed(2)}` : 'Not calculated'}
        </p>
      </div>
      <div class="text-center">
        <span class="block text-xs font-medium theme-text-secondary mb-1">Total Cost</span>
        <div class="text-xl font-bold theme-text-accent">
          ₹{formData.total_cost.toFixed(2)}
        </div>
        <p class="text-xs theme-text-secondary">
          Base + GST + Cess
        </p>
      </div>
    </div>
  </div>
</div>

